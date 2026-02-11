import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowUp, Archive, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { fetchWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';
import { signInWithGoogle } from '~/lib/supabase/auth.client';
import type { Branch, Repository } from './types';

interface DashboardProps {
  onStartTask: (prompt: string) => void;
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

export function Dashboard({ onStartTask, showToast }: DashboardProps) {
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
    <div className="max-w-4xl mx-auto px-4 pt-10 pb-20 md:pt-24">
      <h1 className="text-3xl md:text-5xl font-medium text-center text-white mb-10 tracking-tight leading-tight">
        Что теперь будем
        <br />
        программировать?
      </h1>

      <div className="bg-[#252525] rounded-3xl border border-[#3e3e3e] shadow-2xl mb-10 transition-all overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <textarea
            className="w-full bg-transparent text-white text-lg placeholder-gray-500 resize-none outline-none min-h-[70px] disabled:opacity-50"
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
          <div className="px-5 pb-2 flex flex-wrap gap-2">
            {attachedImages.map((file) => (
              <span key={file.name} className="text-xs px-2 py-1 rounded-md bg-[#1f1f1f] border border-[#3e3e3e] text-gray-200">
                {file.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between px-3 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={inputFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAttachImages}
            />
            <button
              type="button"
              onClick={() => inputFileRef.current?.click()}
              disabled={auth.status !== 'authenticated'}
              className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Добавить изображения"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            {auth.status === 'authenticated' ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                className={`p-2 rounded-full transition-all duration-200 ${prompt.trim() ? 'bg-white text-black hover:bg-gray-200 shadow-lg' : 'bg-[#333] text-gray-500 cursor-not-allowed'}`}
                aria-label="Send prompt"
              >
                <ArrowUp size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleGoogleAuth()}
                disabled={isAuthLoading}
                className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                {isAuthLoading ? 'Вход...' : 'Войти через Google'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 border-b border-[#3e3e3e] mb-6 px-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'tasks' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
        >
          Задачи
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('review')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'review' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
        >
          Проверка кода
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'archive' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
        >
          Архивировать
        </button>
      </div>

      {activeTab === 'tasks' ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 bg-[#1f1f1f] border border-[#3e3e3e] rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по истории чатов"
              className="w-full bg-transparent text-sm text-white outline-none placeholder-gray-500"
            />
          </div>

          {auth.status !== 'authenticated' ? (
            <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-5 text-sm text-gray-300">
              История задач доступна после входа через Google.
            </div>
          ) : null}

          {auth.status === 'authenticated' && isLoadingSessions ? (
            <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-5 text-sm text-gray-300">Загружаем историю чатов...</div>
          ) : null}

          {auth.status === 'authenticated' && !isLoadingSessions && taskSessions.length === 0 ? (
            <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-5 text-sm text-gray-300">
              Здесь хранится короткая история активных чатов с ИИ.
            </div>
          ) : null}

          {taskSessions.map((session) => (
            <article key={session.id} className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-white truncate">{session.title?.trim() || 'Новый чат'}</h3>
                <p className="text-xs text-gray-400">
                  Сообщений: {session.messageCount} · Обновлено: {formatDate(session.lastMessageAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleArchive(session.id, true)}
                className="self-start sm:self-auto inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-[#3e3e3e] hover:bg-[#2f2f2f] transition-colors"
              >
                <Archive size={14} />
                Перенести в архив
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === 'review' ? (
        <section className="space-y-4">
          <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Включить проверку кода</h2>
            <p className="text-sm text-gray-300 mb-4">Выявляйте критические ошибки до их выпуска.</p>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setReviewEnabled(true);
                  setReviewScope('me');
                }}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${reviewScope === 'me' ? 'bg-[#10a37f] text-white' : 'bg-[#1f1f1f] border border-[#3e3e3e] text-gray-200 hover:bg-[#2a2a2a]'}`}
              >
                Включить для меня
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewEnabled(true);
                  setReviewScope('workspace');
                }}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${reviewScope === 'workspace' ? 'bg-[#10a37f] text-white' : 'bg-[#1f1f1f] border border-[#3e3e3e] text-gray-200 hover:bg-[#2a2a2a]'}`}
              >
                Включить для моей рабочей области
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setReviewEnabled(false);
                setReviewScope('none');
              }}
              className="text-xs text-gray-400 hover:text-white"
            >
              Отключить проверку
            </button>
          </div>

          {reviewEnabled ? (
            <div className="bg-[#1f322b] border border-[#2e6b5b] rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-[#24c48f] mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-white">Дополнительная проверка включена</h3>
                <p className="text-xs text-gray-300 mt-1">
                  Для каждого изменения агент запускает двойной проход анализа (2 проверки подряд) и поднимает найденные ошибки до публикации.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert size={18} className="text-amber-300 mt-0.5" />
              <p className="text-xs text-gray-300">Проверка кода отключена. Рекомендуем включить хотя бы персональный режим.</p>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'archive' ? (
        <section className="space-y-4">
          {auth.status !== 'authenticated' ? (
            <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-5 text-sm text-gray-300">
              Архив завершенных чатов доступен после авторизации.
            </div>
          ) : null}

          {auth.status === 'authenticated' && archivedSessions.length === 0 ? (
            <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-5 text-sm text-gray-300">
              Здесь будут завершенные чаты, где агент полностью завершил работу.
            </div>
          ) : null}

          {archivedSessions.map((session) => (
            <article key={session.id} className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-white truncate">{session.title?.trim() || 'Завершенный чат'}</h3>
                <p className="text-xs text-gray-400">
                  Сообщений: {session.messageCount} · Завершен: {formatDate(session.lastMessageAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleArchive(session.id, false)}
                className="self-start sm:self-auto text-xs px-3 py-1.5 rounded-md border border-[#3e3e3e] hover:bg-[#2f2f2f] transition-colors"
              >
                Вернуть в задачи
              </button>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
