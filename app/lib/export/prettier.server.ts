import path from 'node:path';
import { format } from 'prettier';

function resolveParser(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.ts' || extension === '.tsx') {
    return 'typescript';
  }

  if (extension === '.json') {
    return 'json';
  }

  if (extension === '.md') {
    return 'markdown';
  }

  if (extension === '.css') {
    return 'css';
  }

  return undefined;
}

export async function formatGeneratedSource(filePath: string, source: string) {
  const parser = resolveParser(filePath);

  if (!parser) {
    return source;
  }

  try {
    return await format(source, {
      parser,
      printWidth: 120,
      singleQuote: true,
      semi: true,
      tabWidth: 2,
      useTabs: false,
      bracketSpacing: true,
    });
  } catch {
    return source;
  }
}
