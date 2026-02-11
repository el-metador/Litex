import { describe, expect, it } from 'vitest';
import { projectIRSchema } from './project-ir.schema';

describe('projectIRSchema', () => {
  it('accepts minimal valid project IR', () => {
    const parsed = projectIRSchema.safeParse({
      project: {
        id: 'project_1',
        name: 'Demo',
        slug: 'demo',
        templateVersion: '1.0.0',
      },
      routes: [
        {
          path: '/',
          title: 'Home',
          componentTree: {
            type: 'Stack',
            props: { gap: 12 },
            children: [
              {
                type: 'Text',
                props: { text: 'Hello world' },
                children: [],
                events: {},
              },
            ],
            events: {},
          },
        },
      ],
      components: {},
      queries: [],
      auth: { enabled: false, requireAuthRoutes: [] },
      assets: [],
      envRefs: {
        SUPABASE_URL: 'env:SUPABASE_URL',
        SUPABASE_ANON_KEY: 'env:SUPABASE_ANON_KEY',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('fails when root route is missing', () => {
    const parsed = projectIRSchema.safeParse({
      project: {
        id: 'project_1',
        name: 'Demo',
        slug: 'demo',
        templateVersion: '1.0.0',
      },
      routes: [
        {
          path: '/about',
          title: 'About',
          componentTree: {
            type: 'Text',
            props: { text: 'About' },
            children: [],
            events: {},
          },
        },
      ],
      components: {},
      queries: [],
      auth: { enabled: false, requireAuthRoutes: [] },
      assets: [],
      envRefs: {
        SUPABASE_URL: 'env:SUPABASE_URL',
        SUPABASE_ANON_KEY: 'env:SUPABASE_ANON_KEY',
      },
    });

    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('must contain "/"'))).toBe(true);
    }
  });
});
