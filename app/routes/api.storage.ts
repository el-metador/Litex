import { json, type ActionFunctionArgs } from '@remix-run/node';
import { resolveActor, saveToStorage } from '~/lib/.server/node-layer';

interface StorageRequestBody {
  path: string;
  content: string;
  contentType?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const actor = await resolveActor(request);

  if (actor.isAnonymous) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as StorageRequestBody;
  const normalizedPath = body.path?.trim();

  if (!normalizedPath || !body.content) {
    return json({ error: 'Missing required fields: path, content' }, { status: 400 });
  }

  if (normalizedPath.includes('..')) {
    return json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const storedPath = await saveToStorage({
      actor,
      path: normalizedPath,
      content: body.content,
      contentType: body.contentType,
    });

    if (!storedPath) {
      return json({ error: 'Storage backend unavailable' }, { status: 503 });
    }

    return json({ path: storedPath }, { status: 200 });
  } catch (error) {
    return json(
      {
        error: 'Failed to store object',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
