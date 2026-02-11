import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '@nanostores/react';
import { useChat } from 'ai/react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import { diffLines } from 'diff';
import type { Message } from 'ai';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { authStore } from '~/lib/stores/auth';
import { chatStore } from '~/lib/stores/chat';
import { fetchWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';
import { signInWithGoogle } from '~/lib/supabase/auth.client';
import { getLlmModelDefinition } from '~/lib/llm/models';
import { useChatHistory } from '~/lib/persistence/useChatHistory';

interface ChatInterfaceProps {
  initialPrompt: string;
  onBack: () => void;
  onToast: (message: string) => void;
}

type ChatPanel = 'discussion' | 'logs' | 'diff' | 'preview';

const PANEL_TITLES: Array<{ id: ChatPanel; label: string }> = [
  { id: 'discussion', label: 'Обсуждение' },
  { id: 'logs', label: 'Журнал' },
  { id: 'diff', label: 'Разница' },
  { id: 'preview', label: 'Предварительный просмотр' },
];

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

export function ChatInterface({ initialPrompt, onBack, onToast }: ChatInterfaceProps) {
  const auth = useStore(authStore);
  const { model } = useStore(chatStore);
  const [activePanel, setActivePanel] = useState<ChatPanel>('discussion');
  const [inputValue, setInputValue] = useState('');
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, string>>(DEFAULT_WORKSPACE_FILES);
  const [baselineFiles, setBaselineFiles] = useState<Record<string, string>>(DEFAULT_WORKSPACE_FILES);
  const [selectedFile, setSelectedFile] = useState<string>(Object.keys(DEFAULT_WORKSPACE_FILES)[0]);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const lastImportedAssistantMessageIdRef = useRef<string | null>(null);
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
    setLogs((prev) => [...prev, `[${timestamp()}] Переносим задачу из дашборда в чат`]);

    void append({ role: 'user', content: prompt }).catch((initialError) => {
      const message = initialError instanceof Error ? initialError.message : 'Не удалось отправить стартовый запрос';
      setLogs((prev) => [...prev, `[${timestamp()}] Ошибка стартового запроса: ${message}`]);
      onToast(message);
    });
  }, [append, auth.status, historyMessages.length, historyReady, initialPrompt, isLoading, messages.length, onToast]);

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
    const boltFileActions = extractBoltFileActions(plainText);

    if (boltFileActions.length > 0) {
      lastImportedAssistantMessageIdRef.current = lastMessage.id;

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
      return;
    }

    const extractedCode = extractFirstCodeBlock(plainText);

    if (!extractedCode) {
      return;
    }

    lastImportedAssistantMessageIdRef.current = lastMessage.id;

    setWorkspaceFiles((prev) => ({
      ...prev,
      [selectedFile]: extractedCode,
    }));

    setLogs((prev) => [...prev, `[${timestamp()}] Код обновлен в файле ${selectedFile}`]);
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

  const chatTitle = initialPrompt.trim() || 'Новая задача';
  const modelLabel = getLlmModelDefinition(model)?.label || 'Lite Agent';
  const canSend = inputValue.trim().length > 0 && auth.status === 'authenticated' && !isLoading;
  const isAwaitingResponse = auth.status === 'authenticated' && (status === 'submitted' || status === 'streaming');
  const responseStatusLabel = status === 'submitted' ? 'Lite Agent получил ваш запрос' : 'Lite Agent формирует ответ';

  const diffOutput = useMemo(() => {
    const before = baselineFiles[selectedFile] ?? '';
    const after = workspaceFiles[selectedFile] ?? '';

    return diffLines(before, after);
  }, [baselineFiles, workspaceFiles, selectedFile]);

  return (
    <div className="mx-2 mt-2 flex h-[calc(100vh-84px)] flex-col rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-base)] elevation-2">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <Button onClick={onBack} type="button" variant="ghost" size="icon" aria-label="Back to dashboard">
              <ArrowLeft size={20} />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{chatTitle}</div>
              <div className="truncate text-xs text-gray-400">{modelLabel}</div>
            </div>
          </div>
          {auth.status !== 'authenticated' ? (
            <Button type="button" variant="primary" size="sm" onClick={() => void handleGoogleAuth()} disabled={isAuthLoading}>
              {isAuthLoading ? 'Вход...' : 'Войти через Google'}
            </Button>
          ) : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 sm:min-w-0">
            {PANEL_TITLES.map((panel) => (
              <Button
                key={panel.id}
                type="button"
                variant={activePanel === panel.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActivePanel(panel.id)}
                className="whitespace-nowrap"
              >
                {panel.label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activePanel === 'discussion' ? (
          <div className="space-y-5">
            {messages.map((message, index) => {
              const content = getMessageDisplayContent(message);
              const isPendingAssistantMessage = isLoading && message.role === 'assistant' && index === messages.length - 1 && !content;

              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap rounded-[var(--radius-lg)] border px-5 py-3 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'border-white/16 bg-white/12 text-white elevation-2'
                        : 'border-white/10 bg-[rgba(0,0,0,0.14)] text-gray-100 elevation-1'
                    }`}
                  >
                    {content ? content : !isPendingAssistantMessage ? <span className="text-gray-500">Ответ без текста.</span> : null}
                  </div>
                </div>
              );
            })}

            {auth.status !== 'authenticated' ? (
              <Card elevation={1} className="p-4 text-sm text-gray-300">
                Основной чат доступен только авторизованным пользователям.
              </Card>
            ) : null}

            {isAwaitingResponse ? (
              <Card elevation={2} className="min-w-[240px] max-w-[420px] p-4">
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

        {activePanel === 'logs' ? (
          <Card elevation={1} className="space-y-2 p-4">
            {logs.length === 0 ? <p className="text-sm text-gray-400">Журнал пока пуст. Отправьте запрос агенту.</p> : null}
            {logs.map((entry, index) => (
              <p key={`${entry}-${index}`} className="break-words font-mono text-xs text-gray-200 sm:text-sm">
                {entry}
              </p>
            ))}
          </Card>
        ) : null}

        {activePanel === 'diff' ? (
          <Card elevation={1} className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-white">Diff по файлу: {selectedFile}</h3>
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
          <Card elevation={1} className="overflow-hidden">
            <div className="flex min-h-[380px] flex-col md:flex-row">
              <aside className="space-y-1 border-b border-white/10 p-3 md:w-64 md:border-b-0 md:border-r">
                {Object.keys(workspaceFiles).map((path) => (
                  <Button
                    key={path}
                    type="button"
                    variant={selectedFile === path ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedFile(path)}
                    className="w-full justify-start text-left"
                  >
                    {path}
                  </Button>
                ))}
              </aside>

              <div className="flex-1 p-3">
                <textarea
                  value={workspaceFiles[selectedFile] || ''}
                  onChange={(event) =>
                    setWorkspaceFiles((prev) => ({
                      ...prev,
                      [selectedFile]: event.target.value,
                    }))
                  }
                  className="ui-focus-ring min-h-[320px] w-full resize-y rounded-[var(--radius-md)] border border-white/10 bg-[rgba(0,0,0,0.25)] p-3 font-mono text-xs text-gray-200 outline-none"
                />
              </div>
            </div>
          </Card>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <footer className="border-t border-white/10 p-4">
        <Card elevation={2} className="mx-auto flex max-w-4xl items-center gap-2 p-2">
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
            className="ui-focus-ring flex-1 rounded-[var(--radius-md)] border border-transparent bg-transparent px-2 py-2 text-sm text-white outline-none placeholder-gray-500 disabled:bg-transparent disabled:text-gray-400 disabled:opacity-100 sm:text-base"
            disabled={auth.status !== 'authenticated'}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSend();
              }
            }}
          />

          {auth.status === 'authenticated' ? (
            <Button type="button" variant="primary" size="icon" onClick={() => void handleSend()} disabled={!canSend} aria-label="Send">
              <ArrowUp size={20} />
            </Button>
          ) : (
            <Button type="button" variant="primary" size="md" onClick={() => void handleGoogleAuth()} disabled={isAuthLoading}>
              {isAuthLoading ? 'Вход...' : 'Войти через Google'}
            </Button>
          )}
        </Card>

        {attachedImages.length > 0 ? (
          <div className="mx-auto mt-2 flex max-w-4xl flex-wrap gap-2">
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
