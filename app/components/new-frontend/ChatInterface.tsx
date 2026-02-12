import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '@nanostores/react';
import { useChat } from 'ai/react';
import { ArrowLeft, ArrowUp, Bot, CheckCircle2, Circle, CircleDashed, User2 } from 'lucide-react';
import { diffLines } from 'diff';
import type { Message } from 'ai';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { buildAutoTodoPlanFromPrompt, parseTodoPlanContent, type TodoPlanItem } from '~/lib/runtime/todo-plan';
import { authStore } from '~/lib/stores/auth';
import { chatStore } from '~/lib/stores/chat';
import { fetchWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';
import { signInWithGoogle } from '~/lib/supabase/auth.client';
import { getLlmModelDefinition } from '~/lib/llm/models';
import { useChatHistory } from '~/lib/persistence/useChatHistory';

interface ChatInterfaceProps {
  initialPrompt: string;
  onConsumeInitialPrompt: () => void;
  onBack: () => void;
  onToast: (message: string) => void;
}

type ChatPanel = 'discussion' | 'plan' | 'logs' | 'diff' | 'preview';

const PANEL_TITLES: Array<{ id: ChatPanel; label: string }> = [
  { id: 'discussion', label: 'Обсуждение' },
  { id: 'plan', label: 'План' },
  { id: 'logs', label: 'Журнал' },
  { id: 'diff', label: 'Разница' },
  { id: 'preview', label: 'Предварительный просмотр' },
];

const TODO_STATUS_LABEL: Record<TodoPlanItem['status'], string> = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  completed: 'Готово',
};

const DEFAULT_WORKSPACE_FILES: Record<string, string> = {
  'app/routes/_index.tsx': `export default function Index() {\n  return <main>Welcome</main>;\n}\n`,
  'app/components/Button.tsx': `export function Button() {\n  return <button>Click</button>;\n}\n`,
  'app/styles/app.css': `.page {\n  min-height: 100vh;\n  background: #191919;\n}\n`,
};

function timestamp() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function extractFirstCodeBlock(content: string) {
  const match = content.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

interface BoltFileAction {
  filePath: string;
  content: string;
}

interface BoltTodoAction {
  title?: string;
  items: TodoPlanItem[];
}

function extractBoltFileActions(content: string): BoltFileAction[] {
  const actions: BoltFileAction[] = [];
  const actionRegex = /<boltAction\b([^>]*)>([\s\S]*?)<\/boltAction>/gi;
  let actionMatch: RegExpExecArray | null;

  while ((actionMatch = actionRegex.exec(content)) !== null) {
    const attributes = actionMatch[1] ?? '';
    const typeMatch = attributes.match(/\btype=(['"])(.*?)\1/i);

    if (!typeMatch || typeMatch[2] !== 'file') {
      continue;
    }

    const filePathMatch = attributes.match(/\bfilePath=(['"])(.*?)\1/i);

    if (!filePathMatch || !filePathMatch[2]) {
      continue;
    }

    actions.push({
      filePath: filePathMatch[2],
      content: (actionMatch[2] ?? '').trim(),
    });
  }

  return actions;
}

function extractBoltTodoAction(content: string): BoltTodoAction | null {
  const actionRegex = /<boltAction\b([^>]*)>([\s\S]*?)<\/boltAction>/gi;
  let actionMatch: RegExpExecArray | null;

  let latestTodo: BoltTodoAction | null = null;

  while ((actionMatch = actionRegex.exec(content)) !== null) {
    const attributes = actionMatch[1] ?? '';
    const typeMatch = attributes.match(/\btype=(['"])(.*?)\1/i);

    if (!typeMatch || typeMatch[2] !== 'todo') {
      continue;
    }

    const titleMatch = attributes.match(/\btitle=(['"])(.*?)\1/i);
    const parsedPlan = parseTodoPlanContent((actionMatch[2] ?? '').trim());

    if (!parsedPlan || parsedPlan.items.length === 0) {
      continue;
    }

    latestTodo = {
      title: titleMatch?.[2]?.trim() || parsedPlan.title,
      items: parsedPlan.items,
    };
  }

  return latestTodo;
}

function extractTextFromMessageParts(parts: unknown) {
  if (!Array.isArray(parts)) {
    return '';
  }

  const textParts: string[] = [];

  for (const part of parts) {
    if (!part || typeof part !== 'object') {
      continue;
    }

    const type = (part as { type?: unknown }).type;

    if (type !== 'text') {
      continue;
    }

    const text = (part as { text?: unknown }).text;

    if (typeof text !== 'string') {
      continue;
    }

    textParts.push(text);
  }

  return textParts.join('').trim();
}

function getMessageDisplayContent(message: { content?: unknown; parts?: unknown }) {
  if (typeof message.content === 'string' && message.content.trim().length > 0) {
    return message.content;
  }

  const fromParts = extractTextFromMessageParts(message.parts);

  if (fromParts) {
    return fromParts;
  }

  if (Array.isArray(message.content)) {
    const fromContentParts = extractTextFromMessageParts(message.content);

    if (fromContentParts) {
      return fromContentParts;
    }
  }

  return typeof message.content === 'string' ? message.content : '';
}

function todoStatusIcon(status: TodoPlanItem['status']) {
  if (status === 'completed') {
    return <CheckCircle2 size={14} className="text-emerald-300" />;
  }

  if (status === 'in_progress') {
    return <CircleDashed size={14} className="text-cyan-300" />;
  }

  return <Circle size={14} className="text-gray-400" />;
}

function todoStatusBadgeClass(status: TodoPlanItem['status']) {
  if (status === 'completed') {
    return 'border-emerald-400/30 bg-emerald-500/16 text-emerald-200';
  }

  if (status === 'in_progress') {
    return 'border-cyan-400/30 bg-cyan-500/16 text-cyan-200';
  }

  return 'border-white/14 bg-white/10 text-gray-200';
}

function messageRoleMeta(role: Message['role']) {
  if (role === 'user') {
    return {
      label: 'Вы',
      icon: <User2 size={12} />,
      wrapperClass: 'border-white/18 bg-white/12 text-white',
      metaClass: 'text-white/80',
    };
  }

  return {
    label: 'Lite Agent',
    icon: <Bot size={12} />,
    wrapperClass: 'border-white/10 bg-[rgba(11,17,25,0.72)] text-gray-100',
    metaClass: 'text-gray-300',
  };
}

export function ChatInterface({ initialPrompt, onConsumeInitialPrompt, onBack, onToast }: ChatInterfaceProps) {
  const auth = useStore(authStore);
  const { model } = useStore(chatStore);
  const [activePanel, setActivePanel] = useState<ChatPanel>('discussion');
  const [inputValue, setInputValue] = useState('');
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [todoTitle, setTodoTitle] = useState('План выполнения');
  const [todoItems, setTodoItems] = useState<TodoPlanItem[]>([]);
  const [todoUpdatedAt, setTodoUpdatedAt] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, string>>(DEFAULT_WORKSPACE_FILES);
  const [baselineFiles, setBaselineFiles] = useState<Record<string, string>>(DEFAULT_WORKSPACE_FILES);
  const [selectedFile, setSelectedFile] = useState<string>(Object.keys(DEFAULT_WORKSPACE_FILES)[0]);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const lastImportedAssistantMessageIdRef = useRef<string | null>(null);
  const lastImportedTodoMessageIdRef = useRef<string | null>(null);
  const hasRealtimeTodoRef = useRef(false);
  const autoPlanSeededRef = useRef(false);
  const prevAwaitingResponseRef = useRef(false);
  const lastStoredSignatureRef = useRef<string>('');
  const initialPromptRequestRef = useRef<string>('');
  const { initialMessages: historyMessages, ready: historyReady, sessionId, storeMessageHistory } = useChatHistory();

  const authenticatedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetchWithSupabaseAuth(input, init);

    if (response.ok) {
      return response;
    }

    let errorMessage = `Request failed (${response.status})`;

    try {
      const payload = (await response.json()) as { error?: string; requestId?: string };

      if (payload.error) {
        errorMessage = payload.error;
      }

      if (payload.requestId) {
        errorMessage = `${errorMessage} [requestId: ${payload.requestId}]`;
      }
    } catch {
      // noop
    }

    throw new Error(errorMessage);
  };

  const { messages, append, isLoading, error, status, setMessages } = useChat({
    api: '/api/chat',
    body: {
      model,
      sessionId,
    },
    initialMessages: [],
    fetch: authenticatedFetch,
    onResponse: (response) => {
      const requestId = response.headers.get('x-litecode-request-id');

      if (!requestId) {
        return;
      }

      setLogs((prev) => [...prev, `[${timestamp()}] Lite Agent получил запрос [requestId: ${requestId}]`]);
    },
    onFinish: (_message, { finishReason }) => {
      setLogs((prev) => [...prev, `[${timestamp()}] Lite Agent завершил ответ (${finishReason})`]);
    },
  });

  const firstUserMessageContent = useMemo(() => {
    const firstUserMessage = messages.find((message) => message.role === 'user');
    return firstUserMessage ? getMessageDisplayContent(firstUserMessage).trim() : '';
  }, [messages]);
  const isAwaitingResponse = auth.status === 'authenticated' && (status === 'submitted' || status === 'streaming');

  useEffect(() => {
    if (!historyReady || historyMessages.length === 0) {
      return;
    }

    setMessages(historyMessages);
  }, [historyReady, historyMessages, setMessages]);

  useEffect(() => {
    const prompt = initialPrompt.trim();

    if (
      !historyReady ||
      auth.status !== 'authenticated' ||
      isLoading ||
      !prompt ||
      historyMessages.length > 0 ||
      messages.length > 0 ||
      initialPromptRequestRef.current === prompt
    ) {
      return;
    }

    initialPromptRequestRef.current = prompt;
    onConsumeInitialPrompt();
    setLogs((prev) => [...prev, `[${timestamp()}] Переносим задачу из дашборда в чат`]);

    void append({ role: 'user', content: prompt }).catch((initialError) => {
      const message = initialError instanceof Error ? initialError.message : 'Не удалось отправить стартовый запрос';
      setLogs((prev) => [...prev, `[${timestamp()}] Ошибка стартового запроса: ${message}`]);
      onToast(message);
    });
  }, [append, auth.status, historyMessages.length, historyReady, initialPrompt, isLoading, messages.length, onConsumeInitialPrompt, onToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activePanel]);

  useEffect(() => {
    if (!isLoading || auth.status !== 'authenticated') {
      return;
    }

    const steps = [
      'Агент анализирует контекст задачи',
      'Запускает проверку кода и зависимостей',
      'Готовит план изменений по файлам',
      'Формирует патч и валидацию',
    ];
    let step = 0;

    const timer = window.setInterval(() => {
      const nextStep = steps[step];

      if (!nextStep) {
        window.clearInterval(timer);
        return;
      }

      setLogs((prev) => [...prev, `[${timestamp()}] ${nextStep}`]);
      step += 1;
    }, 900);

    return () => window.clearInterval(timer);
  }, [isLoading, auth.status]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const errorMessage = error.message || 'Неизвестная ошибка';
    setLogs((prev) => [...prev, `[${timestamp()}] Ошибка: ${errorMessage}`]);
  }, [error]);

  useEffect(() => {
    if (isLoading || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== 'assistant' || lastMessage.id === lastImportedAssistantMessageIdRef.current) {
      return;
    }

    const plainText = getMessageDisplayContent(lastMessage);
    const todoAction = extractBoltTodoAction(plainText);

    if (todoAction && lastImportedTodoMessageIdRef.current !== lastMessage.id) {
      hasRealtimeTodoRef.current = true;
      setTodoItems(todoAction.items);
      setTodoTitle(todoAction.title || 'План выполнения');
      setTodoUpdatedAt(timestamp());
      setLogs((prev) => [...prev, `[${timestamp()}] Получен и обновлен план задач (${todoAction.items.length})`]);
      lastImportedTodoMessageIdRef.current = lastMessage.id;
    }

    const boltFileActions = extractBoltFileActions(plainText);

    if (boltFileActions.length > 0) {
      setWorkspaceFiles((prev) => {
        const nextFiles = { ...prev };

        for (const action of boltFileActions) {
          nextFiles[action.filePath] = action.content;
        }

        return nextFiles;
      });

      setSelectedFile((current) => {
        if (boltFileActions.some((action) => action.filePath === current)) {
          return current;
        }

        return boltFileActions[0].filePath;
      });

      setLogs((prev) => [...prev, `[${timestamp()}] Обновлены файлы из ответа агента (${boltFileActions.length})`]);
      lastImportedAssistantMessageIdRef.current = lastMessage.id;
      return;
    }

    const extractedCode = extractFirstCodeBlock(plainText);

    if (!extractedCode) {
      lastImportedAssistantMessageIdRef.current = lastMessage.id;
      return;
    }

    setWorkspaceFiles((prev) => ({
      ...prev,
      [selectedFile]: extractedCode,
    }));

    setLogs((prev) => [...prev, `[${timestamp()}] Код обновлен в файле ${selectedFile}`]);
    lastImportedAssistantMessageIdRef.current = lastMessage.id;
  }, [messages, isLoading, selectedFile]);

  useEffect(() => {
    if (auth.status !== 'authenticated' || isLoading || messages.length === 0) {
      return;
    }

    const signature = messages.map((message) => `${message.id}:${message.role}:${getMessageDisplayContent(message)}`).join('|');

    if (!signature || signature === lastStoredSignatureRef.current) {
      return;
    }

    lastStoredSignatureRef.current = signature;

    void storeMessageHistory(messages as unknown as Message[]).catch((storeError) => {
      const message = storeError instanceof Error ? storeError.message : 'Не удалось сохранить историю чата';
      setLogs((prev) => [...prev, `[${timestamp()}] Ошибка сохранения истории: ${message}`]);
    });
  }, [auth.status, isLoading, messages, storeMessageHistory]);

  useEffect(() => {
    if (autoPlanSeededRef.current || hasRealtimeTodoRef.current || !firstUserMessageContent) {
      return;
    }

    if (todoItems.length > 0) {
      autoPlanSeededRef.current = true;
      return;
    }

    const generatedPlan = buildAutoTodoPlanFromPrompt(firstUserMessageContent);

    if (generatedPlan.items.length === 0) {
      return;
    }

    autoPlanSeededRef.current = true;
    setTodoTitle(generatedPlan.title || 'Стартовый план');
    setTodoItems(generatedPlan.items);
    setTodoUpdatedAt(timestamp());
    setLogs((prev) => [...prev, `[${timestamp()}] Сформирован стартовый план (${generatedPlan.items.length})`]);
  }, [firstUserMessageContent, todoItems.length]);

  useEffect(() => {
    const wasAwaiting = prevAwaitingResponseRef.current;
    prevAwaitingResponseRef.current = isAwaitingResponse;

    if (hasRealtimeTodoRef.current || !autoPlanSeededRef.current || todoItems.length === 0) {
      return;
    }

    if (!wasAwaiting && isAwaitingResponse) {
      const hasInProgress = todoItems.some((item) => item.status === 'in_progress');

      if (hasInProgress) {
        return;
      }

      const nextPendingIndex = todoItems.findIndex((item) => item.status === 'pending');

      if (nextPendingIndex === -1) {
        return;
      }

      const nextItems = todoItems.map((item, index) =>
        index === nextPendingIndex
          ? {
              ...item,
              status: 'in_progress' as const,
            }
          : item,
      );

      setTodoItems(nextItems);
      setTodoUpdatedAt(timestamp());
      setLogs((prev) => [...prev, `[${timestamp()}] Авто-план: начата задача ${nextPendingIndex + 1}`]);
      return;
    }

    if (wasAwaiting && !isAwaitingResponse) {
      const currentIndex = todoItems.findIndex((item) => item.status === 'in_progress');

      if (currentIndex === -1) {
        return;
      }

      const completedItems = todoItems.map((item, index) =>
        index === currentIndex
          ? {
              ...item,
              status: 'completed' as const,
            }
          : item,
      );

      const nextPendingIndex = completedItems.findIndex((item) => item.status === 'pending');
      const nextItems =
        nextPendingIndex === -1
          ? completedItems
          : completedItems.map((item, index) =>
              index === nextPendingIndex
                ? {
                    ...item,
                    status: 'in_progress' as const,
                  }
                : item,
            );

      setTodoItems(nextItems);
      setTodoUpdatedAt(timestamp());
      setLogs((prev) => [...prev, `[${timestamp()}] Авто-план: обновлены статусы задач`]);
    }
  }, [isAwaitingResponse, todoItems]);

  const handleGoogleAuth = async () => {
    if (isAuthLoading) {
      return;
    }

    setIsAuthLoading(true);

    try {
      await signInWithGoogle();
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Не удалось начать вход через Google';
      onToast(message);
      setIsAuthLoading(false);
    }
  };

  const handleAttachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const images = files.filter((file) => file.type.startsWith('image/'));
    setAttachedImages(images);
    event.target.value = '';
  };

  const handleSend = async () => {
    if (auth.status !== 'authenticated') {
      onToast('Чат доступен только после входа через Google.');
      return;
    }

    const trimmed = inputValue.trim();

    if (!trimmed || isLoading) {
      return;
    }

    const fileSuffix = attachedImages.length > 0 ? `\n\n[Изображения: ${attachedImages.map((file) => file.name).join(', ')}]` : '';
    const message = `${trimmed}${fileSuffix}`;

    setLogs((prev) => [...prev, `[${timestamp()}] Пользователь отправил запрос`]);

    try {
      await append({ role: 'user', content: message });
      setInputValue('');
      setAttachedImages([]);
    } catch (appendError) {
      const errorMessage = appendError instanceof Error ? appendError.message : 'Не удалось отправить сообщение в чат';
      setLogs((prev) => [...prev, `[${timestamp()}] Ошибка отправки: ${errorMessage}`]);
      onToast(errorMessage);
    }
  };

  const chatTitle = firstUserMessageContent.slice(0, 80) || initialPrompt.trim() || 'Новая задача';
  const modelLabel = getLlmModelDefinition(model)?.label || 'Lite Agent';
  const canSend = inputValue.trim().length > 0 && auth.status === 'authenticated' && !isLoading;
  const responseStatusLabel = status === 'submitted' ? 'Lite Agent получил ваш запрос' : 'Lite Agent формирует ответ';

  const diffOutput = useMemo(() => {
    const before = baselineFiles[selectedFile] ?? '';
    const after = workspaceFiles[selectedFile] ?? '';

    return diffLines(before, after);
  }, [baselineFiles, workspaceFiles, selectedFile]);

  const todoStats = useMemo(() => {
    const stats = {
      pending: 0,
      in_progress: 0,
      completed: 0,
    } satisfies Record<TodoPlanItem['status'], number>;

    for (const item of todoItems) {
      stats[item.status] += 1;
    }

    return stats;
  }, [todoItems]);

  const todoProgressPercent = todoItems.length > 0 ? Math.round((todoStats.completed / todoItems.length) * 100) : 0;

  return (
    <div className="mx-auto mt-2 flex h-[calc(100dvh-4.4rem)] w-[calc(100%-1rem)] max-w-[1320px] flex-col overflow-hidden rounded-[calc(var(--radius-lg)+6px)] border border-[var(--surface-border)] bg-[var(--surface-base)] elevation-3 sm:h-[calc(100dvh-4.9rem)]">
      <header className="border-b border-white/10 px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <Button onClick={onBack} type="button" variant="ghost" size="icon" aria-label="Back to dashboard" className="mt-0.5">
              <ArrowLeft size={20} />
            </Button>
            <div className="min-w-0">
              <p className="ui-kicker mb-1">Agent Session</p>
              <h1 className="truncate font-[var(--font-display)] text-xl font-semibold tracking-tight text-white sm:text-2xl">{chatTitle}</h1>
              <p className="truncate text-xs text-gray-400">{modelLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] text-gray-300 sm:inline-flex">
              {auth.status === 'authenticated' ? 'Connected' : 'Guest mode'}
            </span>
            {auth.status !== 'authenticated' ? (
              <Button type="button" variant="primary" size="sm" onClick={() => void handleGoogleAuth()} disabled={isAuthLoading}>
                {isAuthLoading ? 'Вход...' : 'Войти'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <div className="inline-flex min-w-full gap-1.5 sm:min-w-0 sm:gap-2">
            {PANEL_TITLES.map((panel) => (
              <button
                key={panel.id}
                type="button"
                onClick={() => setActivePanel(panel.id)}
                className={`ui-focus-ring ui-interactive min-w-max whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
                  activePanel === panel.id
                    ? 'border-white/24 bg-white/[0.12] text-white'
                    : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/18 hover:text-white'
                }`}
              >
                {panel.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        {activePanel === 'discussion' ? (
          <div className="space-y-4 sm:space-y-5">
            {messages.map((message, index) => {
              const content = getMessageDisplayContent(message);
              const isPendingAssistantMessage = isLoading && message.role === 'assistant' && index === messages.length - 1 && !content;
              const roleMeta = messageRoleMeta(message.role);

              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[94%] rounded-[var(--radius-lg)] border px-4 py-3 sm:max-w-[88%] sm:px-5 ${roleMeta.wrapperClass}`}
                  >
                    <div className={`mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium ${roleMeta.metaClass}`}>
                      {roleMeta.icon}
                      <span>{roleMeta.label}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {content ? content : !isPendingAssistantMessage ? <span className="text-gray-500">Ответ без текста.</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {todoItems.length > 0 ? (
              <Card elevation={2} className="space-y-3 border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="ui-kicker mb-1">Execution Plan</p>
                    <div className="font-[var(--font-display)] text-base font-semibold tracking-tight text-white">{todoTitle}</div>
                    {todoUpdatedAt ? <div className="text-xs text-gray-400">Обновлено: {todoUpdatedAt}</div> : null}
                  </div>
                  <div className="text-xs text-gray-300">{todoProgressPercent}% выполнено</div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${todoProgressPercent}%` }} />
                </div>
              </Card>
            ) : null}

            {auth.status !== 'authenticated' ? (
              <Card elevation={1} className="p-4 text-sm text-gray-300">
                Основной чат доступен только авторизованным пользователям.
              </Card>
            ) : null}

            {isAwaitingResponse ? (
              <Card elevation={2} className="w-full max-w-[440px] border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs text-gray-200">{responseStatusLabel}</div>
                <div className="mt-3 space-y-2">
                  <div className="skeleton skeleton-line w-4/5" />
                  <div className="skeleton skeleton-line w-3/5" />
                  <div className="skeleton skeleton-line w-2/5" />
                </div>
              </Card>
            ) : null}

            {error ? (
              <Card elevation={1} className="border-red-800 bg-red-950/30 p-3 text-sm text-red-300">
                {error.message}
              </Card>
            ) : null}
          </div>
        ) : null}

        {activePanel === 'plan' ? (
          <Card elevation={2} className="space-y-4 border-white/10 bg-white/[0.03] p-4">
            {todoItems.length === 0 ? (
              <p className="text-sm text-gray-400">
                План задач пока не получен. Агент может прислать его в формате
                {' '}
                <code className="kdb">{'<boltAction type="todo">[...]</boltAction>'}</code>
                .
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="ui-kicker mb-1">Execution Plan</p>
                    <h3 className="font-[var(--font-display)] text-xl font-semibold tracking-tight text-white">{todoTitle}</h3>
                    {todoUpdatedAt ? <p className="text-xs text-gray-400">Последнее обновление: {todoUpdatedAt}</p> : null}
                  </div>
                  <div className="text-xs text-gray-300">{todoProgressPercent}% выполнено</div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${todoProgressPercent}%` }} />
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/12 bg-[rgba(255,255,255,0.08)] px-2.5 py-1 text-gray-200">
                    Ожидает: {todoStats.pending}
                  </span>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/16 px-2.5 py-1 text-cyan-200">
                    В работе: {todoStats.in_progress}
                  </span>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/16 px-2.5 py-1 text-emerald-200">
                    Готово: {todoStats.completed}
                  </span>
                </div>

                <div className="space-y-2">
                  {todoItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-white/10 bg-white/[0.05] px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 shrink-0">{todoStatusIcon(item.status)}</span>
                        <span className="text-sm leading-relaxed text-gray-100">{item.content}</span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${todoStatusBadgeClass(item.status)}`}
                      >
                        {TODO_STATUS_LABEL[item.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        ) : null}

        {activePanel === 'logs' ? (
          <Card elevation={1} className="space-y-2 border-white/10 bg-white/[0.03] p-4">
            {logs.length === 0 ? <p className="text-sm text-gray-400">Журнал пока пуст. Отправьте запрос агенту.</p> : null}
            {logs.map((entry, index) => (
              <p key={`${entry}-${index}`} className="break-words font-mono text-xs leading-relaxed text-gray-200 sm:text-sm">
                {entry}
              </p>
            ))}
          </Card>
        ) : null}

        {activePanel === 'diff' ? (
          <Card elevation={1} className="border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="ui-kicker mb-1">Code Delta</p>
                <h3 className="font-[var(--font-display)] text-base font-semibold tracking-tight text-white">Diff: {selectedFile}</h3>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setBaselineFiles(workspaceFiles)}>
                Принять текущую версию как базу
              </Button>
            </div>

            <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5">
              {diffOutput.map((part, index) => {
                const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                const className = part.added ? 'text-green-300' : part.removed ? 'text-red-300' : 'text-gray-300';

                return (
                  <span key={`${prefix}-${index}`} className={className}>
                    {part.value
                      .split('\n')
                      .filter(Boolean)
                      .map((line, lineIndex) => (
                        <span key={`${index}-${lineIndex}`} className="block">
                          {prefix}
                          {line}
                        </span>
                      ))}
                  </span>
                );
              })}
            </pre>
          </Card>
        ) : null}

        {activePanel === 'preview' ? (
          <Card elevation={1} className="overflow-hidden border-white/10 bg-white/[0.03]">
            <div className="flex min-h-[380px] flex-col md:flex-row">
              <aside className="border-b border-white/10 p-2 md:w-64 md:border-b-0 md:border-r md:p-3">
                <div className="flex gap-1 overflow-x-auto md:block md:space-y-1">
                  {Object.keys(workspaceFiles).map((path) => (
                    <Button
                      key={path}
                      type="button"
                      variant={selectedFile === path ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setSelectedFile(path)}
                      className="min-w-max justify-start text-left md:w-full"
                    >
                      {path}
                    </Button>
                  ))}
                </div>
              </aside>

              <div className="flex-1 p-2.5 sm:p-3">
                <textarea
                  value={workspaceFiles[selectedFile] || ''}
                  onChange={(event) =>
                    setWorkspaceFiles((prev) => ({
                      ...prev,
                      [selectedFile]: event.target.value,
                    }))
                  }
                  className="ui-focus-ring min-h-[260px] w-full resize-y rounded-[var(--radius-md)] border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-gray-200 outline-none sm:min-h-[320px] sm:text-xs"
                />
              </div>
            </div>
          </Card>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <footer className="border-t border-white/10 p-2.5 sm:p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
        <Card elevation={2} className="mx-auto w-full max-w-5xl border-white/10 bg-white/[0.03] p-2.5">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="ui-kicker">Prompt Composer</p>
            <span className="text-[11px] text-gray-500">{attachedImages.length > 0 ? `${attachedImages.length} files` : 'No attachments'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
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
            aria-label="Прикрепить изображение"
            className="shrink-0"
          >
            +
          </Button>

          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={
              auth.status === 'authenticated'
                ? 'Запросить изменения или задать вопрос...'
                : 'Войдите через Google, чтобы писать в чат'
            }
            className="ui-focus-ring order-2 min-w-0 flex-1 rounded-[var(--radius-md)] border border-transparent bg-transparent px-2 py-2 text-[16px] text-white outline-none placeholder-gray-500 disabled:bg-transparent disabled:text-gray-400 disabled:opacity-100 sm:order-none sm:text-base"
            disabled={auth.status !== 'authenticated'}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSend();
              }
            }}
          />

          {auth.status === 'authenticated' ? (
            <Button
              type="button"
              variant="primary"
              size="icon"
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label="Send"
              className="order-3 shrink-0"
            >
              <ArrowUp size={20} />
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void handleGoogleAuth()}
              disabled={isAuthLoading}
              className="order-3 w-full justify-center sm:w-auto"
            >
              {isAuthLoading ? 'Вход...' : 'Войти через Google'}
            </Button>
          )}
          </div>
        </Card>

        {attachedImages.length > 0 ? (
          <div className="mx-auto mt-2 flex max-w-5xl flex-wrap gap-2">
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

        <div className="mt-3 text-center">
          <span className="text-[11px] text-gray-500">Lite Agent может ошибаться. Проверяйте критичные изменения перед деплоем.</span>
        </div>
      </footer>
    </div>
  );
}
