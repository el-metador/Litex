import { useLoaderData, useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore } from '~/lib/stores/auth';
import { fetchJsonWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';
import { getMessages, getPersistenceDatabase } from './db';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

interface ServerSessionPayload {
  session: {
    id: string;
    title: string | null;
    messages: Message[];
    lastMessageAt: string;
  };
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const auth = useStore(authStore);
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | undefined>();

  const creatingSessionPromiseRef = useRef<Promise<string> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const initHistory = async () => {
      if (auth.status === 'loading') {
        return;
      }

      setReady(false);
      setInitialMessages([]);
      setSessionId(undefined);
      chatId.set(undefined);
      description.set(undefined);

      if (auth.status === 'authenticated') {
        if (!mixedId) {
          setReady(true);
          return;
        }

        try {
          const payload = await fetchJsonWithSupabaseAuth<ServerSessionPayload>(`/api/chat-sessions/${mixedId}`);

          if (cancelled) {
            return;
          }

          setInitialMessages(payload.session.messages ?? []);
          setSessionId(payload.session.id);
          chatId.set(payload.session.id);
          description.set(payload.session.title ?? undefined);
          setReady(true);
        } catch {
          if (!cancelled) {
            navigate(`/`, { replace: true });
            setReady(true);
          }
        }

        return;
      }

      if (!persistenceEnabled || !mixedId) {
        setReady(true);
        return;
      }

      try {
        const activeDb = await getPersistenceDatabase();

        if (!activeDb) {
          setReady(true);
          return;
        }

        const storedMessages = await getMessages(activeDb, mixedId);

        if (!storedMessages || storedMessages.messages.length === 0) {
          navigate(`/`, { replace: true });
          setReady(true);
          return;
        }

        if (cancelled) {
          return;
        }

        setInitialMessages(storedMessages.messages);
        setSessionId(storedMessages.id);
        chatId.set(storedMessages.id);
        description.set(storedMessages.description);
        setReady(true);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to initialize chat persistence';
          toast.error(message);
          setReady(true);
        }
      }
    };

    void initHistory();

    return () => {
      cancelled = true;
    };
  }, [auth.status, mixedId, navigate]);

  async function ensureSessionId(messages: Message[]) {
    if (sessionId) {
      return sessionId;
    }

    if (creatingSessionPromiseRef.current) {
      return creatingSessionPromiseRef.current;
    }

    creatingSessionPromiseRef.current = (async () => {
      const title = workbenchStore.firstArtifact?.title || inferDescriptionFromMessages(messages);
      const payload = await fetchJsonWithSupabaseAuth<{ session: { id: string } }>('/api/chat-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      const nextId = payload.session.id;
      setSessionId(nextId);
      chatId.set(nextId);
      description.set(title ?? undefined);
      navigateChat(nextId);

      return nextId;
    })();

    try {
      return await creatingSessionPromiseRef.current;
    } finally {
      creatingSessionPromiseRef.current = undefined;
    }
  }

  return {
    ready: auth.status !== 'loading' && (!mixedId || ready),
    initialMessages,
    sessionId,
    storeMessageHistory: async (messages: Message[]) => {
      if (messages.length === 0 || auth.status !== 'authenticated') {
        return;
      }

      const activeSessionId = await ensureSessionId(messages);

      await fetchJsonWithSupabaseAuth<{ ok: boolean }>(`/api/chat-sessions/${activeSessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!description.get()) {
        description.set(inferDescriptionFromMessages(messages));
      }
    },
  };
}

function inferDescriptionFromMessages(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');

  if (!firstUserMessage) {
    return undefined;
  }

  const content = typeof firstUserMessage.content === 'string' ? firstUserMessage.content : JSON.stringify(firstUserMessage.content);

  return content.trim().slice(0, 120) || undefined;
}

function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
