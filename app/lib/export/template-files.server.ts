import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function loadTemplateFiles(templateRoot: string) {
  const files = new Map<string, Buffer>();

  async function walk(currentAbsoluteDir: string) {
    const entries = await fs.readdir(currentAbsoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentAbsoluteDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = path.relative(templateRoot, absolutePath).split(path.sep).join('/');

      files.set(relativePath, await fs.readFile(absolutePath));
    }
  }

  await walk(templateRoot);

  return files;
}
