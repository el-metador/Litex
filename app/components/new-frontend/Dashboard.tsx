import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowUp, Archive, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { authStore } from '~/lib/stores/auth';
import { fetchWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';
import { signInWithGoogle } from '~/lib/supabase/auth.client';
import type { Branch, Repository } from './types';

interface DashboardProps {
  onStartTask: (prompt: string) => void;
  onOpenChatSession: (sessionId: string) => void;
  showToast: (msg: string) => void;
  repositories: Repository[];
  branches: Branch[];
}

interface ChatSessionsPayload {
  sessions: Array<{
    id: string;
    title: string | null;
    messageCount: number;
    lastMessageAt: string;
  }>;
}

const ARCHIVE_STORAGE_KEY = 'litecode_archived_chat_ids';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Dashboard({ onStartTask, onOpenChatSession, showToast }: DashboardProps) {
  const auth = useStore(authStore);
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'review' | 'archive'>('tasks');
  const [sessions, setSessions] = useState<ChatSessionsPayload['sessions']>([]);
  const [search, setSearch] = useState('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [archivedChatIds, setArchivedChatIds] = useState<string[]>([]);
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewScope, setReviewScope] = useState<'none' | 'me' | 'workspace'>('none');
  const inputFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setArchivedChatIds(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setArchivedChatIds([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archivedChatIds));
  }, [archivedChatIds]);

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setSessions([]);
      return;
    }

    const load = async () => {
      setIsLoadingSessions(true);

      try {
        const payload = await fetchWithSupabaseAuth('/api/chat-sessions');

        if (!payload.ok) {
          setSessions([]);
          return;
        }

        const parsed = (await payload.json()) as ChatSessionsPayload;
        setSessions(parsed.sessions ?? []);
      } catch {
        setSessions([]);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    void load();
  }, [auth.status]);

  const handleGoogleAuth = async () => {
    if (isAuthLoading) {
      return;
    }

    setIsAuthLoading(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось начать вход через Google';
      showToast(message);
      setIsAuthLoading(false);
    }
  };

  const handleSubmit = () => {
    if (auth.status !== 'authenticated') {
      showToast('Сначала войдите через Google.');
      return;
    }

    const trimmed = prompt.trim();

    if (!trimmed) {
      return;
    }

    const fileSuffix = attachedImages.length > 0 ? `\n\n[Вложения: ${attachedImages.map((file) => file.name).join(', ')}]` : '';
    onStartTask(`${trimmed}${fileSuffix}`);
    setPrompt('');
    setAttachedImages([]);
    showToast('Задача отправлена в Lite Agent');
  };

  const handleAttachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const images = files.filter((file) => file.type.startsWith('image/'));

    setAttachedImages(images);
    event.target.value = '';
  };

  const filteredSessions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return sessions;
    }

    return sessions.filter((session) => {
      const title = (session.title || 'Новый чат').toLowerCase();
      return title.includes(normalizedSearch);
    });
  }, [sessions, search]);

  const taskSessions = filteredSessions.filter((session) => !archivedChatIds.includes(session.id));
  const archivedSessions = filteredSessions.filter((session) => archivedChatIds.includes(session.id));

  const toggleArchive = (sessionId: string, shouldArchive: boolean) => {
    setArchivedChatIds((prev) => {
      if (shouldArchive) {
        return prev.includes(sessionId) ? prev : [...prev, sessionId];
      }

      return prev.filter((id) => id !== sessionId);
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-3 pb-20 pt-8 sm:px-4 md:pt-16">
      <h1 className="mb-8 text-center text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl md:mb-10 md:text-5xl">
        Что теперь будем
        <br />
        программировать?
      </h1>

      <Card elevation={3} className="mb-10 rounded-[calc(var(--radius-lg)+6px)]">
        <div className="px-5 pb-2 pt-4">
          <textarea
            className="ui-focus-ring min-h-[70px] w-full resize-none rounded-[var(--radius-md)] border border-transparent bg-transparent px-2 py-2 text-[16px] text-white outline-none placeholder-gray-500 disabled:bg-transparent disabled:text-gray-400 disabled:opacity-100 sm:text-lg"
            placeholder={auth.status === 'authenticated' ? 'Опишите задачу для Lite Agent' : 'Войдите через Google, чтобы начать работу'}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={auth.status !== 'authenticated'}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {attachedImages.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-5 pb-2">
            {attachedImages.map((file) => (
              <span
                key={file.name}
                className="rounded-[var(--radius-sm)] border border-white/12 bg-[rgba(255,255,255,0.06)] px-2 py-1 text-xs text-gray-200"
              >
                {file.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAttachImages}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => inputFileRef.current?.click()}
              disabled={auth.status !== 'authenticated'}
              aria-label="Добавить изображения"
            >
              +
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {auth.status === 'authenticated' ? (
              <Button
                type="button"
                variant="primary"
                size="icon"
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                aria-label="Send prompt"
              >
                <ArrowUp size={18} />
              </Button>
            ) : (
              <Button type="button" variant="primary" size="md" onClick={() => void handleGoogleAuth()} disabled={isAuthLoading}>
                {isAuthLoading ? 'Вход...' : 'Войти через Google'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="mb-6 flex items-center gap-1.5 overflow-x-auto border-b border-white/12 px-1 pb-1 sm:gap-2">
        <Button
          type="button"
          variant={activeTab === 'tasks' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('tasks')}
          className="rounded-b-none"
        >
          Задачи
        </Button>
        <Button
          type="button"
          variant={activeTab === 'review' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('review')}
          className="rounded-b-none"
        >
          Проверка кода
        </Button>
        <Button
          type="button"
          variant={activeTab === 'archive' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('archive')}
          className="rounded-b-none"
        >
          Архивировать
        </Button>
      </div>

      {activeTab === 'tasks' ? (
        <section className="space-y-4">
          <Card elevation={1} className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2">
            <Search size={16} className="text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по истории чатов"
              className="ui-focus-ring w-full rounded-[var(--radius-sm)] bg-transparent px-1 py-1 text-[16px] text-white outline-none placeholder-gray-500 sm:text-sm"
            />
          </Card>

          {auth.status !== 'authenticated' ? (
            <Card elevation={1} className="p-5 text-sm text-gray-300">
              История задач доступна после входа через Google.
            </Card>
          ) : null}

          {auth.status === 'authenticated' && isLoadingSessions ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={`skeleton-${index}`} elevation={1} className="space-y-3 p-4">
                  <div className="skeleton skeleton-line skeleton-line--lg w-1/2" />
                  <div className="skeleton skeleton-line w-4/5" />
                  <div className="skeleton skeleton-line w-2/5" />
                </Card>
              ))}
            </div>
          ) : null}

          {auth.status === 'authenticated' && !isLoadingSessions && taskSessions.length === 0 ? (
            <Card elevation={1} className="p-5 text-sm text-gray-300">
              Здесь хранится короткая история активных чатов с ИИ.
            </Card>
          ) : null}

          {taskSessions.map((session) => (
            <Card key={session.id} interactive elevation={2} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-white">{session.title?.trim() || 'Новый чат'}</h3>
                <p className="text-xs text-gray-400">
                  Сообщений: {session.messageCount} · Обновлено: {formatDate(session.lastMessageAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChatSession(session.id)}>
                  Открыть чат
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleArchive(session.id, true)}>
                  <Archive size={14} />
                  Перенести в архив
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {activeTab === 'review' ? (
        <section className="space-y-4">
          <Card elevation={2} className="p-5">
            <h2 className="mb-2 text-lg font-semibold text-white">Включить проверку кода</h2>
            <p className="mb-4 text-sm text-gray-300">Выявляйте критические ошибки до их выпуска.</p>

            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={reviewScope === 'me' ? 'primary' : 'secondary'}
                size="md"
                onClick={() => {
                  setReviewEnabled(true);
                  setReviewScope('me');
                }}
              >
                Включить для меня
              </Button>
              <Button
                type="button"
                variant={reviewScope === 'workspace' ? 'primary' : 'secondary'}
                size="md"
                onClick={() => {
                  setReviewEnabled(true);
                  setReviewScope('workspace');
                }}
              >
                Включить для моей рабочей области
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReviewEnabled(false);
                setReviewScope('none');
              }}
            >
              Отключить проверку
            </Button>
          </Card>

          {reviewEnabled ? (
            <Card elevation={2} className="flex items-start gap-3 border-[#2e6b5b] bg-[#1f322b]/85 p-4">
              <CheckCircle2 size={18} className="mt-0.5 text-[#24c48f]" />
              <div>
                <h3 className="text-sm font-medium text-white">Дополнительная проверка включена</h3>
                <p className="mt-1 text-xs text-gray-300">
                  Для каждого изменения агент запускает двойной проход анализа (2 проверки подряд) и поднимает найденные ошибки до публикации.
                </p>
              </div>
            </Card>
          ) : (
            <Card elevation={1} className="flex items-start gap-3 p-4">
              <ShieldAlert size={18} className="mt-0.5 text-amber-300" />
              <p className="text-xs text-gray-300">Проверка кода отключена. Рекомендуем включить хотя бы персональный режим.</p>
            </Card>
          )}
        </section>
      ) : null}

      {activeTab === 'archive' ? (
        <section className="space-y-4">
          {auth.status !== 'authenticated' ? (
            <Card elevation={1} className="p-5 text-sm text-gray-300">
              Архив завершенных чатов доступен после авторизации.
            </Card>
          ) : null}

          {auth.status === 'authenticated' && archivedSessions.length === 0 ? (
            <Card elevation={1} className="p-5 text-sm text-gray-300">
              Здесь будут завершенные чаты, где агент полностью завершил работу.
            </Card>
          ) : null}

          {archivedSessions.map((session) => (
            <Card key={session.id} interactive elevation={2} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-white">{session.title?.trim() || 'Завершенный чат'}</h3>
                <p className="text-xs text-gray-400">
                  Сообщений: {session.messageCount} · Завершен: {formatDate(session.lastMessageAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChatSession(session.id)}>
                  Открыть чат
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleArchive(session.id, false)}>
                  Вернуть в задачи
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
