function sanitizeRouteToken(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  return normalized || 'route';
}

export function normalizeRoutePath(routePath: string) {
  const trimmed = routePath.trim();

  if (!trimmed.startsWith('/')) {
    throw new Error(`Route path must start with "/": ${routePath}`);
  }

  if (trimmed === '/') {
    return '/';
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  return withoutTrailingSlash.length > 0 ? withoutTrailingSlash : '/';
}

function toRemixSegment(segment: string) {
  if (segment === '*') {
    return '$';
  }

  if (segment.startsWith(':')) {
    return `$${sanitizeRouteToken(segment.slice(1))}`;
  }

  return sanitizeRouteToken(segment);
}

export function routePathToRemixFilename(routePath: string) {
  const normalizedPath = normalizeRoutePath(routePath);

  if (normalizedPath === '/') {
    return '_index.tsx';
  }

  const segments = normalizedPath
    .split('/')
    .filter(Boolean)
    .map((segment) => toRemixSegment(segment));

  return `${segments.join('.')}.tsx`;
}

export function routePathToRouteFile(routePath: string) {
  return `app/routes/${routePathToRemixFilename(routePath)}`;
}
