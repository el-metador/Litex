import type { ProjectIRAsset } from './project-ir.schema';

export interface AssetPayload {
  contentType: string;
  content: Buffer;
}

export async function fetchAsset(asset: ProjectIRAsset): Promise<AssetPayload> {
  const source = asset.sourceUrlOrStorageKey ?? 'unconfigured-source';
  const placeholder = `Asset placeholder for "${asset.path}" (${asset.contentType})\nsource: ${source}\n\n` +
    'Replace fetchAsset(asset) in app/lib/export/assets.server.ts with your storage integration.\n';

  return {
    contentType: asset.contentType,
    content: Buffer.from(placeholder, 'utf8'),
  };
}
