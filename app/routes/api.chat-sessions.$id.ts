import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { getChatSessionWithMessages, resolveActor, softDeleteChatSession, syncChatMessages } from '~/lib/.server/node-layer';
import type { Message } from 'ai';

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const actor = await resolveActor(request);

    if (actor.isAnonymous) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionId = params.id;

    if (!sessionId) {
      return json({ error: 'Missing session id' }, { status: 400 });
    }

    const session = await getChatSessionWithMessages(actor, sessionId);

    if (!session) {
      return json({ error: 'Session not found' }, { status: 404 });
    }

    return json({ session });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to load chat session' },
      { status: 500 },
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const actor = await resolveActor(request);

    if (actor.isAnonymous) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionId = params.id;

    if (!sessionId) {
      return json({ error: 'Missing session id' }, { status: 400 });
    }

    if (request.method === 'PUT') {
      const body = (await request.json().catch(() => ({}))) as { messages?: Message[] };

      if (!Array.isArray(body.messages)) {
        return json({ error: 'Invalid messages payload' }, { status: 400 });
      }

      const synced = await syncChatMessages(actor, sessionId, body.messages);

      if (synced === null) {
        return json({ error: 'History backend unavailable' }, { status: 503 });
      }

      if (synced === false) {
        return json({ error: 'Session not found' }, { status: 404 });
      }

      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      const deleted = await softDeleteChatSession(actor, sessionId);

      if (deleted === null) {
        return json({ error: 'History backend unavailable' }, { status: 503 });
      }

      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to update chat session' },
      { status: 500 },
    );
  }
}
