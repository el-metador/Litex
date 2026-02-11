import { z } from 'zod';

const primitiveValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type JsonPrimitive = z.infer<typeof primitiveValueSchema>;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([primitiveValueSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const routePathSchema = z
  .string()
  .min(1, 'Route path is required')
  .refine((path) => path.startsWith('/'), 'Route path must start with "/"');

const assetPathSchema = z
  .string()
  .min(1, 'Asset path is required')
  .refine((value) => !value.startsWith('/'), 'Asset path must be relative')
  .refine((value) => !value.split('/').includes('..'), 'Asset path cannot contain ".."');

const filterOperatorSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is']);

export const eventActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('navigate'),
    to: z.string().min(1, 'navigate.to is required'),
  }),
  z.object({
    type: z.literal('callQuery'),
    name: z.string().min(1, 'callQuery.name is required'),
  }),
  z.object({
    type: z.literal('setState'),
    key: z.string().min(1, 'setState.key is required'),
    value: primitiveValueSchema,
  }),
]);

export type EventActionIR = z.infer<typeof eventActionSchema>;

export type ComponentNodeIR = {
  type: string;
  props?: Record<string, JsonValue>;
  children?: ComponentNodeIR[];
  events?: {
    onClick?: EventActionIR[];
  };
};

export const componentNodeSchema: z.ZodType<ComponentNodeIR> = z.lazy(() =>
  z.object({
    type: z.string().min(1, 'Component node type is required'),
    props: z.record(jsonValueSchema).default({}),
    children: z.array(componentNodeSchema).default([]),
    events: z
      .object({
        onClick: z.array(eventActionSchema).min(1).optional(),
      })
      .default({}),
  }),
);

export const queryFilterSchema = z.object({
  column: z.string().min(1, 'Query filter column is required'),
  operator: filterOperatorSchema,
  value: jsonValueSchema,
});

export type QueryFilterIR = z.infer<typeof queryFilterSchema>;

export const querySchema = z.object({
  name: z.string().min(1, 'Query name is required'),
  table: z.string().min(1, 'Query table is required'),
  select: z.string().min(1, 'Query select is required'),
  filters: z.array(queryFilterSchema).default([]),
  single: z.boolean().default(false),
});

export type QueryIR = z.infer<typeof querySchema>;

export const routeSchema = z.object({
  path: routePathSchema,
  title: z.string().optional(),
  componentTree: componentNodeSchema,
});

export type RouteIR = z.infer<typeof routeSchema>;

export const projectSchema = z.object({
  id: z.string().min(1, 'project.id is required'),
  name: z.string().min(1, 'project.name is required'),
  slug: z
    .string()
    .min(1, 'project.slug is required')
    .regex(/^[a-z0-9-]+$/, 'project.slug must match /^[a-z0-9-]+$/'),
  templateVersion: z.string().min(1, 'project.templateVersion is required'),
});

export const authConfigSchema = z.object({
  enabled: z.boolean().default(false),
  requireAuthRoutes: z.array(routePathSchema).default([]),
});

export const assetSchema = z.object({
  path: assetPathSchema,
  contentType: z.string().min(1, 'asset.contentType is required'),
  sourceUrlOrStorageKey: z.string().min(1, 'asset.sourceUrlOrStorageKey is required').optional(),
});

export type ProjectIRAsset = z.infer<typeof assetSchema>;

export const envRefsSchema = z.object({
  SUPABASE_URL: z.string().min(1, 'envRefs.SUPABASE_URL is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'envRefs.SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export const projectIRSchema = z
  .object({
    project: projectSchema,
    routes: z.array(routeSchema).min(1, 'At least one route is required'),
    components: z.record(componentNodeSchema).default({}),
    queries: z.array(querySchema).default([]),
    auth: authConfigSchema.default({ enabled: false, requireAuthRoutes: [] }),
    assets: z.array(assetSchema).default([]),
    envRefs: envRefsSchema,
  })
  .superRefine((value, ctx) => {
    const routePathSet = new Set<string>();
    let hasRootRoute = false;

    for (const route of value.routes) {
      if (route.path === '/') {
        hasRootRoute = true;
      }

      if (routePathSet.has(route.path)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['routes'],
          message: `Duplicate route path "${route.path}"`,
        });
      }

      routePathSet.add(route.path);
    }

    if (!hasRootRoute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['routes'],
        message: 'Route list must contain "/" for app/routes/_index.tsx generation',
      });
    }

    const queryNameSet = new Set<string>();

    for (const query of value.queries) {
      if (queryNameSet.has(query.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['queries'],
          message: `Duplicate query name "${query.name}"`,
        });
      }

      queryNameSet.add(query.name);
    }
  });

export type ProjectIR = z.infer<typeof projectIRSchema>;

export function formatProjectIRIssues(error: z.ZodError<ProjectIR>) {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
