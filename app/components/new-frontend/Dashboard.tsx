import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowUp, Archive, CheckCircle2, Search, ShieldAlert, SlidersHorizontal, X } from 'lucide-react';
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
  { id: 'tasks', label: 'Задачи' },
  { id: 'review', label: 'Проверка кода' },
  { id: 'archive', label: 'Архив' },
];

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
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">Workspace</div>
      <div className="space-y-2">
        {TAB_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={activeTab === option.id ? 'secondary' : 'ghost'}
            size="md"
            onClick={() => selectTab(option.id)}
            className="w-full justify-start"
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">Поиск чатов</label>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
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
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-8">
        <h1 className="text-[clamp(2.25rem,8vw,4.8rem)] font-semibold leading-[1.02] tracking-tight text-white">
          Что теперь будем
          <br />
          программировать?
        </h1>

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
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
        <aside className="sticky top-[5.2rem] hidden lg:block">
          <Card elevation={2} className="border-white/10 bg-white/[0.04] p-3 backdrop-blur-2xl">
            {panelBody}
          </Card>
        </aside>

        <div className="min-w-0">
          <Card
            elevation={4}
            className="mb-8 rounded-[calc(var(--radius-lg)+8px)] border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.58)]"
          >
            <div className="p-3 sm:p-4">
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] transition-all duration-300 focus-within:border-[#6366f1]/75 focus-within:shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_0_36px_rgba(99,102,241,0.28)]">
                <textarea
                  className="ui-focus-ring min-h-[148px] w-full resize-none bg-transparent px-4 py-4 pb-16 pr-16 text-[16px] leading-relaxed text-white outline-none placeholder-gray-500 disabled:bg-transparent disabled:text-gray-400 disabled:opacity-100 sm:px-5 sm:py-5"
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
                    className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.04]"
                  >
                    +
                  </Button>

                  {attachedImages.length > 0 ? (
                    <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-gray-300">
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
                      className="h-10 w-10 rounded-xl border border-[#7b82ff]/55 bg-[#6366f1]/90 text-white shadow-[0_0_24px_rgba(99,102,241,0.45)]"
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
            </div>
          </Card>

          {activeTab === 'tasks' ? (
            <section className="space-y-4">
              {auth.status !== 'authenticated' ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300 backdrop-blur-xl">
                  История задач доступна после входа через Google.
                </Card>
              ) : null}

              {auth.status === 'authenticated' && isLoadingSessions ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={`skeleton-${index}`} elevation={1} className="space-y-3 border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
                      <div className="skeleton skeleton-line skeleton-line--lg w-1/2" />
                      <div className="skeleton skeleton-line w-4/5" />
                      <div className="skeleton skeleton-line w-2/5" />
                    </Card>
                  ))}
                </div>
              ) : null}

              {auth.status === 'authenticated' && !isLoadingSessions && taskSessions.length === 0 ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300 backdrop-blur-xl">
                  Здесь хранится короткая история активных чатов с ИИ.
                </Card>
              ) : null}

              {taskSessions.map((session) => (
                <Card
                  key={session.id}
                  interactive
                  elevation={2}
                  className="flex flex-col gap-3 border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-white">{session.title?.trim() || 'Новый чат'}</h3>
                    <p className="text-xs text-gray-400">
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
              <Card elevation={2} className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
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
                    Включить для рабочей области
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
                <Card elevation={2} className="flex items-start gap-3 border-[#2e6b5b] bg-[#1f322b]/70 p-4 backdrop-blur-xl">
                  <CheckCircle2 size={18} className="mt-0.5 text-[#24c48f]" />
                  <div>
                    <h3 className="text-sm font-medium text-white">Дополнительная проверка включена</h3>
                    <p className="mt-1 text-xs text-gray-300">
                      Для каждого изменения агент запускает двойной проход анализа (2 проверки подряд) и поднимает найденные ошибки до публикации.
                    </p>
                  </div>
                </Card>
              ) : (
                <Card elevation={1} className="flex items-start gap-3 border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
                  <ShieldAlert size={18} className="mt-0.5 text-amber-300" />
                  <p className="text-xs text-gray-300">Проверка кода отключена. Рекомендуем включить хотя бы персональный режим.</p>
                </Card>
              )}
            </section>
          ) : null}

          {activeTab === 'archive' ? (
            <section className="space-y-4">
              {auth.status !== 'authenticated' ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300 backdrop-blur-xl">
                  Архив завершенных чатов доступен после авторизации.
                </Card>
              ) : null}

              {auth.status === 'authenticated' && archivedSessions.length === 0 ? (
                <Card elevation={1} className="border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300 backdrop-blur-xl">
                  Здесь будут завершенные чаты, где агент полностью завершил работу.
                </Card>
              ) : null}

              {archivedSessions.map((session) => (
                <Card
                  key={session.id}
                  interactive
                  elevation={2}
                  className="flex flex-col gap-3 border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-white">{session.title?.trim() || 'Завершенный чат'}</h3>
                    <p className="text-xs text-gray-400">
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
              className="surface-card elevation-5 absolute bottom-3 left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 overflow-y-auto border-white/12 bg-[rgba(14,14,18,0.82)] p-3 backdrop-blur-2xl"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/80">Меню</h2>
                <Button type="button" variant="ghost" size="icon" onClick={() => setIsPanelOpen(false)} aria-label="Закрыть панель">
                  <X size={16} />
                </Button>
              </div>
              {panelBody}
            </m.aside>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
