import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { createChatSession, listChatSessions, resolveActor } from '~/lib/.server/node-layer';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const actor = await resolveActor(request);

    if (actor.isAnonymous) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessions = await listChatSessions(actor);

    if (!sessions) {
      return json({ error: 'History backend unavailable' }, { status: 503 });
    }

    return json({ sessions });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to list chat sessions' },
      { status: 500 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const actor = await resolveActor(request);

    if (actor.isAnonymous) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const session = await createChatSession(actor, body.title);

    if (!session) {
      return json({ error: 'History backend unavailable' }, { status: 503 });
    }

    return json({ session }, { status: 201 });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to create chat session' },
      { status: 500 },
    );
  }
}
