import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { createReadableStreamFromReadable, json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { buildRepositoryExport } from '~/lib/export/generator.server';
import { loadProjectIR } from '~/lib/export/project-ir-loader.server';
import { formatProjectIRIssues, projectIRSchema } from '~/lib/export/project-ir.schema';

function sanitizeFilename(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'generated-project';
}

export async function loader(_: LoaderFunctionArgs) {
  return json({ error: 'Method not allowed' }, { status: 405 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const projectId = params.projectId?.trim();

  if (!projectId) {
    return json({ error: 'Missing projectId parameter' }, { status: 400 });
  }

  const projectIR = await loadProjectIR(projectId);

  if (!projectIR) {
    return json(
      {
        error: 'Project IR not found',
        projectId,
      },
      { status: 404 },
    );
  }

  const parsedProjectIR = projectIRSchema.safeParse(projectIR);

  if (!parsedProjectIR.success) {
    return json(
      {
        error: 'Project IR validation failed',
        issues: formatProjectIRIssues(parsedProjectIR.error),
      },
      { status: 400 },
    );
  }

  const exportedRepo = await buildRepositoryExport(parsedProjectIR.data);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  archive.on('warning', (warning) => {
    if (warning.code === 'ENOENT') {
      return;
    }

    passThrough.destroy(warning);
  });

  archive.on('error', (error) => {
    passThrough.destroy(error);
  });

  for (const file of exportedRepo.files) {
    archive.append(file.contents, { name: file.path });
  }

  void archive.finalize();

  const zipFilename = `${sanitizeFilename(exportedRepo.projectSlug)}.zip`;

  return new Response(createReadableStreamFromReadable(passThrough), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
