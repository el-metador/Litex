import { describe, expect, it } from 'vitest';
import { normalizeRoutePath, routePathToRemixFilename, routePathToRouteFile } from './remix-route-filename';

describe('routePathToRemixFilename', () => {
  it('maps "/" to app/routes/_index.tsx', () => {
    expect(routePathToRemixFilename('/')).toBe('_index.tsx');
    expect(routePathToRouteFile('/')).toBe('app/routes/_index.tsx');
  });

  it('maps static routes', () => {
    expect(routePathToRemixFilename('/dashboard')).toBe('dashboard.tsx');
    expect(routePathToRemixFilename('/dashboard/settings')).toBe('dashboard.settings.tsx');
  });

  it('maps dynamic and splat routes', () => {
    expect(routePathToRemixFilename('/posts/:id')).toBe('posts.$id.tsx');
    expect(routePathToRemixFilename('/docs/*')).toBe('docs.$.tsx');
  });
});

describe('normalizeRoutePath', () => {
  it('trims trailing slash', () => {
    expect(normalizeRoutePath('/account/')).toBe('/account');
  });

  it('throws on invalid path', () => {
    expect(() => normalizeRoutePath('account')).toThrowError('Route path must start with "/"');
  });
});
