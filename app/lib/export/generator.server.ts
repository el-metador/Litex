import path from 'node:path';
import { fetchAsset } from './assets.server';
import { formatGeneratedSource } from './prettier.server';
import type { ProjectIR, RouteIR } from './project-ir.schema';
import { normalizeRoutePath, routePathToRemixFilename, routePathToRouteFile } from './remix-route-filename';
import { loadTemplateFiles } from './template-files.server';

const TEMPLATE_ROOT = path.resolve(process.cwd(), 'templates/remix-vercel-supabase');
const GENERATED_APP_PATH = 'app/components/generated/GeneratedApp.tsx';
const GENERATED_QUERIES_PATH = 'app/lib/queries.generated.ts';
const GENERATED_ASSETS_PREFIX = 'public/assets/';

type FileContents = string | Buffer;

export interface GeneratedRepoFile {
  path: string;
  contents: Buffer;
}

export interface GeneratedRepositoryExport {
  projectSlug: string;
  files: GeneratedRepoFile[];
  generatedPaths: string[];
}

function toPascalCaseIdentifier(rawValue: string) {
  const words = rawValue
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'GeneratedRoute';
  }

  const transformed = words
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '');

  if (!transformed) {
    return 'GeneratedRoute';
  }

  if (/^\d/.test(transformed)) {
    return `Generated${transformed}`;
  }

  return transformed;
}

function normalizeAssetPath(relativeAssetPath: string) {
  const normalized = relativeAssetPath.trim().replace(/^\/+/, '').split('/').filter(Boolean);

  if (normalized.length === 0) {
    throw new Error(`Invalid asset path: "${relativeAssetPath}"`);
  }

  if (normalized.includes('..')) {
    throw new Error(`Asset path cannot contain "..": "${relativeAssetPath}"`);
  }

  return normalized.join('/');
}

function asBuffer(contents: FileContents) {
  if (Buffer.isBuffer(contents)) {
    return contents;
  }

  return Buffer.from(contents, 'utf8');
}

function serializeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function createGeneratedRouteModule(route: RouteIR, requiresAuth: boolean) {
  const normalizedRoutePath = normalizeRoutePath(route.path);
  const componentName = `${toPascalCaseIdentifier(normalizedRoutePath)}Route`;
  const title = route.title?.trim() || 'Generated Route';

  if (requiresAuth) {
    return `
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { GeneratedApp } from '~/components/generated/GeneratedApp';
import { requireUser } from '~/lib/auth.server';

export const meta: MetaFunction = () => [{ title: ${JSON.stringify(title)} }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { headers } = await requireUser(request);

  return json({}, { headers });
}

export default function ${componentName}() {
  return <GeneratedApp routePath=${JSON.stringify(normalizedRoutePath)} />;
}
`;
  }

  return `
import type { MetaFunction } from '@remix-run/node';
import { GeneratedApp } from '~/components/generated/GeneratedApp';

export const meta: MetaFunction = () => [{ title: ${JSON.stringify(title)} }];

export default function ${componentName}() {
  return <GeneratedApp routePath=${JSON.stringify(normalizedRoutePath)} />;
}
`;
}

function createGeneratedAppModule(projectIR: ProjectIR) {
  const routeTrees = Object.fromEntries(
    projectIR.routes.map((route) => [normalizeRoutePath(route.path), route.componentTree]),
  );

  const componentRegistry = projectIR.components;

  return `
import { useMemo, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { getSupabaseBrowserClient } from '~/lib/supabase.client';
import { runGeneratedQuery } from '~/lib/queries.generated';

type PrimitiveValue = string | number | boolean | null;
type JsonValue = PrimitiveValue | JsonValue[] | { [key: string]: JsonValue };

type EventAction =
  | { type: 'navigate'; to: string }
  | { type: 'callQuery'; name: string }
  | { type: 'setState'; key: string; value: PrimitiveValue };

interface GeneratedNode {
  type: string;
  props?: Record<string, JsonValue>;
  children?: GeneratedNode[];
  events?: {
    onClick?: EventAction[];
  };
}

interface RenderContext {
  executeActions: (actions: EventAction[] | undefined) => Promise<void>;
}

const ROUTE_TREES: Record<string, GeneratedNode> = ${serializeJson(routeTrees)};
const COMPONENT_REGISTRY: Record<string, GeneratedNode> = ${serializeJson(componentRegistry)};

const ALLOWED_PROPS: Record<string, ReadonlySet<string>> = {
  Box: new Set(['className', 'id', 'style']),
  Text: new Set(['className', 'id', 'style', 'text']),
  Button: new Set(['className', 'id', 'style', 'label', 'type', 'disabled']),
  Input: new Set(['className', 'id', 'style', 'name', 'placeholder', 'defaultValue', 'type', 'required']),
  Form: new Set(['className', 'id', 'style', 'method', 'action']),
  Stack: new Set(['className', 'id', 'style', 'direction', 'gap', 'align', 'justify']),
};

function toStyleObject(value: JsonValue | undefined) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }

  const styleEntries = Object.entries(value).filter(
    (entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number',
  );

  if (styleEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(styleEntries);
}

function pickAllowedProps(node: GeneratedNode) {
  const props = node.props ?? {};
  const allowed = ALLOWED_PROPS[node.type] ?? new Set<string>();
  const safeProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (!allowed.has(key)) {
      console.warn('[GeneratedApp] Unsupported prop dropped', { nodeType: node.type, key });
      continue;
    }

    if (key === 'style') {
      safeProps.style = toStyleObject(value);
      continue;
    }

    safeProps[key] = value;
  }

  return safeProps;
}

function resolveComponentReference(node: GeneratedNode) {
  if (COMPONENT_REGISTRY[node.type]) {
    return COMPONENT_REGISTRY[node.type];
  }

  if (!node.type.startsWith('Component:')) {
    return undefined;
  }

  const componentName = node.type.slice('Component:'.length);

  return COMPONENT_REGISTRY[componentName];
}

function renderNode(node: GeneratedNode, context: RenderContext, keyPath: string): React.ReactNode {
  const children = (node.children ?? []).map((child, index) => renderNode(child, context, \`\${keyPath}.\${index}\`));
  const safeProps = pickAllowedProps(node);
  const clickActions = node.events?.onClick;

  switch (node.type) {
    case 'Box':
      return (
        <div key={keyPath} className={safeProps.className as string | undefined} id={safeProps.id as string | undefined} style={safeProps.style as React.CSSProperties | undefined}>
          {children}
        </div>
      );

    case 'Text':
      return (
        <p key={keyPath} className={safeProps.className as string | undefined} id={safeProps.id as string | undefined} style={safeProps.style as React.CSSProperties | undefined}>
          {typeof safeProps.text === 'string' ? safeProps.text : children}
        </p>
      );

    case 'Button':
      return (
        <button
          key={keyPath}
          type={(safeProps.type as 'button' | 'submit' | 'reset' | undefined) ?? 'button'}
          className={safeProps.className as string | undefined}
          id={safeProps.id as string | undefined}
          style={safeProps.style as React.CSSProperties | undefined}
          disabled={Boolean(safeProps.disabled)}
          onClick={() => {
            void context.executeActions(clickActions);
          }}
        >
          {typeof safeProps.label === 'string' ? safeProps.label : 'Button'}
        </button>
      );

    case 'Input':
      return (
        <input
          key={keyPath}
          className={safeProps.className as string | undefined}
          id={safeProps.id as string | undefined}
          style={safeProps.style as React.CSSProperties | undefined}
          name={safeProps.name as string | undefined}
          placeholder={safeProps.placeholder as string | undefined}
          defaultValue={safeProps.defaultValue as string | number | undefined}
          type={(safeProps.type as string | undefined) ?? 'text'}
          required={Boolean(safeProps.required)}
        />
      );

    case 'Form':
      return (
        <form
          key={keyPath}
          className={safeProps.className as string | undefined}
          id={safeProps.id as string | undefined}
          style={safeProps.style as React.CSSProperties | undefined}
          method={(safeProps.method as string | undefined) ?? 'post'}
          action={safeProps.action as string | undefined}
        >
          {children}
        </form>
      );

    case 'Stack': {
      const direction = typeof node.props?.direction === 'string' ? node.props.direction : 'column';
      const gap = typeof node.props?.gap === 'number' || typeof node.props?.gap === 'string' ? node.props.gap : 12;
      const align = typeof node.props?.align === 'string' ? node.props.align : undefined;
      const justify = typeof node.props?.justify === 'string' ? node.props.justify : undefined;
      const stackStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: direction === 'row' ? 'row' : 'column',
        gap: typeof gap === 'number' ? \`\${gap}px\` : gap,
        alignItems: align,
        justifyContent: justify,
        ...(safeProps.style as React.CSSProperties | undefined),
      };

      return (
        <div key={keyPath} className={safeProps.className as string | undefined} id={safeProps.id as string | undefined} style={stackStyle}>
          {children}
        </div>
      );
    }

    default: {
      const componentReference = resolveComponentReference(node);

      if (componentReference) {
        return renderNode(componentReference, context, \`\${keyPath}.component\`);
      }

      console.warn('[GeneratedApp] Unsupported node type rendered as placeholder', { type: node.type });

      return (
        <div key={keyPath} style={{ border: '1px dashed #ef4444', padding: '12px', borderRadius: '8px' }}>
          Unsupported node type: {node.type}
        </div>
      );
    }
  }
}

export function GeneratedApp({ routePath }: { routePath: string }) {
  const navigate = useNavigate();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [localState, setLocalState] = useState<Record<string, PrimitiveValue>>({});
  const [queryResults, setQueryResults] = useState<Record<string, unknown>>({});
  const [queryErrors, setQueryErrors] = useState<Record<string, string | null>>({});

  const routeTree = ROUTE_TREES[routePath];

  const executeActions = async (actions: EventAction[] | undefined) => {
    if (!actions || actions.length === 0) {
      return;
    }

    for (const action of actions) {
      if (action.type === 'navigate') {
        navigate(action.to);
        continue;
      }

      if (action.type === 'setState') {
        setLocalState((current) => ({
          ...current,
          [action.key]: action.value,
        }));
        continue;
      }

      if (action.type === 'callQuery') {
        try {
          const result = await runGeneratedQuery(action.name, supabase);
          setQueryResults((current) => ({ ...current, [action.name]: result }));
          setQueryErrors((current) => ({ ...current, [action.name]: null }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown query error';
          setQueryErrors((current) => ({ ...current, [action.name]: message }));
        }
      }
    }
  };

  if (!routeTree) {
    console.warn('[GeneratedApp] Missing route tree', { routePath, availableRoutes: Object.keys(ROUTE_TREES) });

    return <div>Route "{routePath}" is not defined in Project IR.</div>;
  }

  return (
    <div data-generated-route={routePath}>
      {renderNode(routeTree, { executeActions }, 'root')}
      <pre style={{ marginTop: '24px', background: '#111827', color: '#d1d5db', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
        {JSON.stringify({ state: localState, queryResults, queryErrors }, null, 2)}
      </pre>
    </div>
  );
}
`;
}

function createGeneratedQueriesModule(projectIR: ProjectIR) {
  const queryDefinitions = projectIR.queries.map((query) => ({
    name: query.name,
    table: query.table,
    select: query.select,
    filters: query.filters,
    single: query.single,
  }));

  const wrappers = projectIR.queries
    .map((query) => {
      const safeFunctionName = `${toPascalCaseIdentifier(query.name)}Query`;

      return `
export async function ${safeFunctionName}(supabase: SupabaseClient) {
  return executeQuery(${JSON.stringify(query.name)}, supabase);
}
`;
    })
    .join('\n');

  return `
import type { SupabaseClient } from '@supabase/supabase-js';

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';

interface QueryFilterDefinition {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

interface QueryDefinition {
  name: string;
  table: string;
  select: string;
  filters: QueryFilterDefinition[];
  single: boolean;
}

const QUERY_DEFINITIONS: QueryDefinition[] = ${serializeJson(queryDefinitions)};

function applyFilter(builder: any, filter: QueryFilterDefinition) {
  switch (filter.operator) {
    case 'eq':
      return builder.eq(filter.column, filter.value);
    case 'neq':
      return builder.neq(filter.column, filter.value);
    case 'gt':
      return builder.gt(filter.column, filter.value);
    case 'gte':
      return builder.gte(filter.column, filter.value);
    case 'lt':
      return builder.lt(filter.column, filter.value);
    case 'lte':
      return builder.lte(filter.column, filter.value);
    case 'like':
      return builder.like(filter.column, filter.value);
    case 'ilike':
      return builder.ilike(filter.column, filter.value);
    case 'is':
      return builder.is(filter.column, filter.value);
    case 'in': {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      return builder.in(filter.column, values);
    }
    default:
      return builder;
  }
}

async function executeQuery(name: string, supabase: SupabaseClient) {
  const definition = QUERY_DEFINITIONS.find((query) => query.name === name);

  if (!definition) {
    throw new Error(\`Unknown generated query: \${name}\`);
  }

  let builder: any = supabase.from(definition.table).select(definition.select);

  for (const filter of definition.filters) {
    builder = applyFilter(builder, filter);
  }

  if (definition.single) {
    return builder.single();
  }

  return builder;
}

${wrappers}

export async function runGeneratedQuery(name: string, supabase: SupabaseClient) {
  return executeQuery(name, supabase);
}
`;
}

async function buildGeneratedAssets(projectIR: ProjectIR) {
  const generatedAssets = new Map<string, FileContents>();

  for (const asset of projectIR.assets) {
    const normalizedPath = normalizeAssetPath(asset.path);
    const zipPath = `${GENERATED_ASSETS_PREFIX}${normalizedPath}`;
    const resolved = await fetchAsset(asset);

    generatedAssets.set(zipPath, resolved.content);
  }

  return generatedAssets;
}

async function buildGeneratedFiles(projectIR: ProjectIR) {
  const generatedFiles = new Map<string, FileContents>();
  const requireAuthRoutes = new Set(projectIR.auth.requireAuthRoutes.map((routePath) => normalizeRoutePath(routePath)));
  const seenRouteFiles = new Set<string>();

  for (const route of projectIR.routes) {
    const routePath = normalizeRoutePath(route.path);
    const routeFilePath = routePathToRouteFile(routePath);

    if (seenRouteFiles.has(routeFilePath)) {
      throw new Error(`Conflicting route filename generated for path "${routePath}"`);
    }

    seenRouteFiles.add(routeFilePath);
    generatedFiles.set(routeFilePath, createGeneratedRouteModule(route, requireAuthRoutes.has(routePath)));
  }

  generatedFiles.set(GENERATED_APP_PATH, createGeneratedAppModule(projectIR));
  generatedFiles.set(GENERATED_QUERIES_PATH, createGeneratedQueriesModule(projectIR));

  const generatedAssets = await buildGeneratedAssets(projectIR);

  for (const [assetPath, contents] of generatedAssets.entries()) {
    generatedFiles.set(assetPath, contents);
  }

  for (const [filePath, contents] of generatedFiles.entries()) {
    if (typeof contents !== 'string') {
      continue;
    }

    generatedFiles.set(filePath, await formatGeneratedSource(filePath, contents));
  }

  return generatedFiles;
}

export async function buildRepositoryExport(projectIR: ProjectIR): Promise<GeneratedRepositoryExport> {
  const templateFiles = await loadTemplateFiles(TEMPLATE_ROOT);
  const generatedFiles = await buildGeneratedFiles(projectIR);

  for (const [generatedPath, contents] of generatedFiles.entries()) {
    templateFiles.set(generatedPath, asBuffer(contents));
  }

  const files: GeneratedRepoFile[] = Array.from(templateFiles.entries())
    .map(([filePath, contents]) => ({
      path: filePath,
      contents,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    projectSlug: projectIR.project.slug,
    generatedPaths: Array.from(generatedFiles.keys()).sort((left, right) => left.localeCompare(right)),
    files,
  };
}

export { routePathToRemixFilename };
