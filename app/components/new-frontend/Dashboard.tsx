import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Archive, ArrowUp, CheckCircle2, FolderGit2, Layers3, Search, ShieldAlert, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';
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

type DashboardTab = 'tasks' | 'review' | 'archive';

const ARCHIVE_STORAGE_KEY = 'litecode_archived_chat_ids';
const TAB_OPTIONS: Array<{ id: DashboardTab; label: string }> = [
  { id: 'tasks', label: 'Active Tasks' },
  { id: 'review', label: 'Code Review' },
  { id: 'archive', label: 'Archive' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Dashboard({ onStartTask, onOpenChatSession, showToast, repositories, branches }: DashboardProps) {
  const auth = useStore(authStore);
  const reduceMotion = useReducedMotion();
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('tasks');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
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
    if (!isPanelOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPanelOpen]);

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

  const workspaceStats = useMemo(
    () => ({
      repoCount: repositories.length,
      branchCount: branches.length,
      activeChats: taskSessions.length,
      archivedChats: archivedSessions.length,
    }),
    [archivedSessions.length, branches.length, repositories.length, taskSessions.length],
  );

  const toggleArchive = (sessionId: string, shouldArchive: boolean) => {
    setArchivedChatIds((prev) => {
      if (shouldArchive) {
        return prev.includes(sessionId) ? prev : [...prev, sessionId];
      }

      return prev.filter((id) => id !== sessionId);
    });
  };

  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setIsPanelOpen(false);
  };

  const panelBody = (
    <>
      <div className="mb-2">
        <p className="ui-kicker mb-1">Workspace Map</p>
        <p className="font-[var(--font-display)] text-base font-semibold tracking-tight text-white">Navigation</p>
      </div>

      <div className="space-y-2">
        {TAB_OPTIONS.map((option) => {
          const count =
            option.id === 'tasks' ? taskSessions.length : option.id === 'archive' ? archivedSessions.length : reviewEnabled ? 1 : 0;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => selectTab(option.id)}
              className={`ui-focus-ring ui-interactive flex w-full items-center justify-between rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                activeTab === option.id
                  ? 'border-white/28 bg-white/[0.12] text-white'
                  : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:text-white'
              }`}
            >
              <span>{option.label}</span>
              <span className="rounded-full border border-white/16 bg-white/[0.08] px-2 py-0.5 text-[11px] text-gray-200">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Search Chats</label>
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-white/10 bg-white/[0.03] px-3 py-2">
          <Search size={15} className="text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Название чата"
            className="ui-focus-ring w-full rounded-md bg-transparent px-1 py-1 text-sm text-white outline-none placeholder-gray-500"
          />
        </div>
      </div>
    </>
  );

  const backdropVariants = reduceMotion ? motionVariants.modalReduced : motionVariants.modalBackdrop;
  const panelVariants = reduceMotion ? motionVariants.modalReduced : motionVariants.modalPanel;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 pb-20 pt-6 sm:px-4 sm:pt-8 lg:px-6 lg:pt-10">
      <section className="mb-7 flex items-start justify-between gap-3 sm:mb-8">
        <div className="max-w-4xl">
          <p className="ui-kicker mb-2">AI Shipping Console</p>
          <h1 className="ui-display">
            Build faster,
            <br />
            ship cleaner.
          </h1>
          <p className="ui-lede mt-4 max-w-2xl">
            Сформулируйте задачу одним брифом. Lite Agent разобьет работу на этапы, обновит файлы и покажет прогресс выполнения.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsPanelOpen(true)}
          className="mt-2 shrink-0 lg:hidden"
          aria-label="Открыть рабочую панель"
        >
          <SlidersHorizontal size={15} />
          Разделы
        </Button>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card elevation={2} className="space-y-1.5 border-white/10 bg-white/[0.03] px-4 py-3.5">
          <p className="ui-kicker">Repositories</p>
          <p className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-white">{workspaceStats.repoCount}</p>
        </Card>
        <Card elevation={2} className="space-y-1.5 border-white/10 bg-white/[0.03] px-4 py-3.5">
          <p className="ui-kicker">Branches</p>
          <p className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-white">{workspaceStats.branchCount}</p>
        </Card>
        <Card elevation={2} className="space-y-1.5 border-white/10 bg-white/[0.03] px-4 py-3.5">
          <p className="ui-kicker">Active Chats</p>
          <p className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-white">{workspaceStats.activeChats}</p>
        </Card>
        <Card elevation={2} className="space-y-1.5 border-white/10 bg-white/[0.03] px-4 py-3.5">
          <p className="ui-kicker">Archived</p>
          <p className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-white">{workspaceStats.archivedChats}</p>
        </Card>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="sticky top-[5.6rem] hidden lg:block">
          <Card elevation={3} className="border-white/10 bg-white/[0.03] p-3">
            {panelBody}
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <Card
            elevation={4}
            className="rounded-[calc(var(--radius-lg)+10px)] border border-white/12 bg-white/[0.03] p-3.5 sm:p-5 shadow-[0_30px_80px_rgba(2,6,23,0.52)]"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="ui-kicker mb-1">Task Brief</p>
                <h2 className="ui-title">Сформулируйте задачу для Lite Agent</h2>
              </div>
              <div className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-gray-300">
                {auth.status === 'authenticated' ? 'Ready' : 'Auth required'}
              </div>
            </div>

            <div className="relative rounded-[calc(var(--radius-lg)+2px)] border border-white/12 bg-black/20 transition-all duration-300 focus-within:border-white/24 focus-within:shadow-[0_0_0_1px_rgba(248,250,252,0.12),0_0_40px_rgba(56,189,248,0.18)]">
              <textarea
                className="ui-focus-ring min-h-[170px] w-full resize-none bg-transparent px-4 py-4 pb-16 pr-16 text-[16px] leading-relaxed text-white outline-none placeholder-gray-500 disabled:bg-transparent disabled:text-gray-400 disabled:opacity-100 sm:px-5"
                placeholder={auth.status === 'authenticated' ? 'Опишите задачу, ограничения и ожидаемый результат' : 'Войдите через Google, чтобы начать работу'}
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

              <div className="absolute bottom-3 left-3 flex items-center gap-2">
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
                  className="h-9 w-9 rounded-xl border border-white/12 bg-white/[0.04]"
                >
                  +
                </Button>

                {attachedImages.length > 0 ? (
                  <span className="rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-xs text-gray-300">
                    {attachedImages.length} файлов
                  </span>
                ) : null}
              </div>

              <div className="absolute bottom-3 right-3">
                {auth.status === 'authenticated' ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    onClick={handleSubmit}
                    disabled={!prompt.trim()}
                    aria-label="Send prompt"
                    className="h-10 w-10 rounded-xl"
                  >
                    <ArrowUp size={18} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleGoogleAuth()}
                    disabled={isAuthLoading}
                    className="rounded-xl border-white/16 bg-white/[0.08]"
                  >
                    {isAuthLoading ? 'Вход...' : 'Google'}
                  </Button>
                )}
              </div>
            </div>

            {attachedImages.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachedImages.map((file) => (
                  <span
                    key={file.name}
                    className="rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1 text-xs text-gray-300"
                  >
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>

          {activeTab === 'tasks' ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="ui-title">Active Task Sessions</h2>
                <span className="text-xs text-gray-400">{taskSessions.length} элементов</span>
              </div>

              {auth.status !== 'authenticated' ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300">
                  История задач доступна после входа через Google.
                </Card>
              ) : null}

              {auth.status === 'authenticated' && isLoadingSessions ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={`skeleton-${index}`} elevation={1} className="space-y-3 border-white/10 bg-white/[0.03] p-4">
                      <div className="skeleton skeleton-line skeleton-line--lg w-1/2" />
                      <div className="skeleton skeleton-line w-4/5" />
                      <div className="skeleton skeleton-line w-2/5" />
                    </Card>
                  ))}
                </div>
              ) : null}

              {auth.status === 'authenticated' && !isLoadingSessions && taskSessions.length === 0 ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300">
                  Здесь хранится короткая история активных чатов с ИИ.
                </Card>
              ) : null}

              {taskSessions.map((session) => (
                <Card
                  key={session.id}
                  interactive
                  elevation={2}
                  className="flex flex-col gap-3 border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="ui-kicker mb-1">Session</p>
                    <h3 className="truncate font-[var(--font-display)] text-lg font-semibold tracking-tight text-white">
                      {session.title?.trim() || 'Новый чат'}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">
                      Сообщений: {session.messageCount} · Обновлено: {formatDate(session.lastMessageAt)}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChatSession(session.id)} className="w-full sm:w-auto">
                      Открыть чат
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleArchive(session.id, true)} className="w-full sm:w-auto">
                      <Archive size={14} />
                      В архив
                    </Button>
                  </div>
                </Card>
              ))}
            </section>
          ) : null}

          {activeTab === 'review' ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="ui-title">Code Review Policy</h2>
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs text-gray-300">
                  {reviewEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <Card elevation={2} className="border-white/10 bg-white/[0.04] p-5">
                <h3 className="mb-2 font-[var(--font-display)] text-lg font-semibold tracking-tight text-white">Включить проверку кода</h3>
                <p className="mb-4 text-sm text-gray-300">Выявляйте критические ошибки до их выпуска с двойным проходом анализа.</p>

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
                    Для рабочей области
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
                <Card elevation={2} className="flex items-start gap-3 border-emerald-500/24 bg-emerald-900/20 p-4">
                  <CheckCircle2 size={18} className="mt-0.5 text-emerald-300" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Дополнительная проверка включена</h3>
                    <p className="mt-1 text-xs text-gray-300">
                      Для каждого изменения агент запускает двойной проход анализа и поднимает найденные ошибки до публикации.
                    </p>
                  </div>
                </Card>
              ) : (
                <Card elevation={1} className="flex items-start gap-3 border-white/10 bg-white/[0.03] p-4">
                  <ShieldAlert size={18} className="mt-0.5 text-amber-300" />
                  <p className="text-xs text-gray-300">Проверка кода отключена. Рекомендуем включить хотя бы персональный режим.</p>
                </Card>
              )}
            </section>
          ) : null}

          {activeTab === 'archive' ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="ui-title">Archived Sessions</h2>
                <span className="text-xs text-gray-400">{archivedSessions.length} элементов</span>
              </div>

              {auth.status !== 'authenticated' ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300">
                  Архив завершенных чатов доступен после авторизации.
                </Card>
              ) : null}

              {auth.status === 'authenticated' && archivedSessions.length === 0 ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300">
                  Здесь будут завершенные чаты, где агент полностью завершил работу.
                </Card>
              ) : null}

              {archivedSessions.map((session) => (
                <Card
                  key={session.id}
                  interactive
                  elevation={2}
                  className="flex flex-col gap-3 border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="ui-kicker mb-1">Archive</p>
                    <h3 className="truncate font-[var(--font-display)] text-lg font-semibold tracking-tight text-white">
                      {session.title?.trim() || 'Завершенный чат'}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">
                      Сообщений: {session.messageCount} · Завершен: {formatDate(session.lastMessageAt)}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChatSession(session.id)} className="w-full sm:w-auto">
                      Открыть чат
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleArchive(session.id, false)} className="w-full sm:w-auto">
                      Вернуть в задачи
                    </Button>
                  </div>
                </Card>
              ))}
            </section>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {isPanelOpen ? (
          <m.div
            key="dashboard-panel"
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 lg:hidden"
          >
            <button type="button" onClick={() => setIsPanelOpen(false)} className="overlay-backdrop absolute inset-0 border-none" />

            <m.aside
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="surface-card elevation-5 absolute bottom-3 left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 overflow-y-auto border-white/12 bg-[rgba(10,16,24,0.86)] p-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="ui-kicker mb-1">Workspace</p>
                  <h2 className="font-[var(--font-display)] text-base font-semibold tracking-tight text-white">Меню</h2>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setIsPanelOpen(false)} aria-label="Закрыть панель">
                  <X size={16} />
                </Button>
              </div>
              {panelBody}
            </m.aside>
          </m.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-7 hidden items-center justify-between rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-gray-400 lg:flex">
        <div className="flex items-center gap-2">
          <Sparkles size={14} />
          <span>Lite Agent follows plan-driven execution with status tracking.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <FolderGit2 size={14} /> {workspaceStats.repoCount} repos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Layers3 size={14} /> {workspaceStats.branchCount} branches
          </span>
        </div>
      </div>
    </div>
  );
}
