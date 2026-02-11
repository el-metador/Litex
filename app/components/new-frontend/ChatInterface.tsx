import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '@nanostores/react';
import { useChat } from 'ai/react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import { diffLines } from 'diff';
import type { Message } from 'ai';
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
  const { initialMessages: historyMessages, ready: historyReady, sessionId, storeMessageHistory } = useChatHistory();

  const bootstrappedMessages = useMemo(() => {
    const prompt = initialPrompt.trim();

    if (!prompt || auth.status !== 'authenticated') {
      return [];
    }

    return [
      {
        id: `bootstrap-${prompt}`,
        role: 'user' as const,
        content: prompt,
      },
    ];
  }, [initialPrompt, auth.status]);

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
    initialMessages: bootstrappedMessages,
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

    if (
      lastMessage.role !== 'assistant' ||
      lastMessage.id === lastImportedAssistantMessageIdRef.current
    ) {
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
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#191919]">
      <div className="px-4 py-2 border-b border-[#3e3e3e] bg-[#191919]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <button
              onClick={onBack}
              type="button"
              className="text-gray-400 hover:text-white transition-colors shrink-0 bg-transparent border-none appearance-none"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-white truncate">{chatTitle}</span>
              <span className="text-xs text-gray-500 truncate">{modelLabel}</span>
            </div>
          </div>
          {auth.status !== 'authenticated' ? (
            <button
              type="button"
              onClick={() => void handleGoogleAuth()}
              disabled={isAuthLoading}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-60 border-none appearance-none"
            >
              {isAuthLoading ? 'Вход...' : 'Войти через Google'}
            </button>
          ) : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <div className="inline-flex gap-2 min-w-full sm:min-w-0">
            {PANEL_TITLES.map((panel) => (
              <button
                key={panel.id}
                type="button"
                onClick={() => setActivePanel(panel.id)}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors whitespace-nowrap appearance-none ${
                  activePanel === panel.id
                    ? 'bg-[#252525] text-white border border-[#3e3e3e]'
                    : 'bg-transparent text-gray-400 hover:text-white hover:bg-[#242424]'
                }`}
              >
                {panel.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activePanel === 'discussion' ? (
          <div className="space-y-6">
            {messages.map((message, index) => {
              const content = getMessageDisplayContent(message);
              const isPendingAssistantMessage = isLoading && message.role === 'assistant' && index === messages.length - 1 && !content;

              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${message.role === 'user' ? 'bg-[#2f2f2f] text-white' : 'text-gray-200 border border-[#2a2a2a]'}`}
                  >
                    {content ? content : !isPendingAssistantMessage ? <span className="text-gray-500">Ответ без текста.</span> : null}
                  </div>
                </div>
              );
            })}

            {auth.status !== 'authenticated' ? (
              <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4 text-sm text-gray-300">
                Основной чат доступен только авторизованным пользователям.
              </div>
            ) : null}

            {isAwaitingResponse ? (
              <div className="flex justify-start">
                <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl px-4 py-3 text-white min-w-[240px]">
                  <div className="text-xs text-gray-200">{responseStatusLabel}</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#10a37f] animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-[#10a37f] animate-pulse" style={{ animationDelay: '180ms' }} />
                    <span className="h-2 w-2 rounded-full bg-[#10a37f] animate-pulse" style={{ animationDelay: '360ms' }} />
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-[#10a37f] animate-pulse" />
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="text-sm text-red-300 bg-red-950/30 border border-red-800 rounded-lg p-3">
                {error.message}
              </div>
            ) : null}
          </div>
        ) : null}

        {activePanel === 'logs' ? (
          <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4 space-y-2">
            {logs.length === 0 ? <p className="text-sm text-gray-400">Журнал пока пуст. Отправьте запрос агенту.</p> : null}
            {logs.map((entry, index) => (
              <p key={`${entry}-${index}`} className="text-xs sm:text-sm text-gray-200 font-mono break-words">
                {entry}
              </p>
            ))}
          </div>
        ) : null}

        {activePanel === 'diff' ? (
          <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-medium text-white">Diff по файлу: {selectedFile}</h3>
              <button
                type="button"
                onClick={() => setBaselineFiles(workspaceFiles)}
                className="px-3 py-1.5 text-xs rounded-md border border-[#3e3e3e] hover:bg-[#2f2f2f] appearance-none bg-transparent"
              >
                Принять текущую версию как базу
              </button>
            </div>

            <pre className="text-xs leading-5 whitespace-pre-wrap overflow-x-auto">
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
          </div>
        ) : null}

        {activePanel === 'preview' ? (
          <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl overflow-hidden">
            <div className="flex flex-col md:flex-row min-h-[380px]">
              <aside className="md:w-64 border-b md:border-b-0 md:border-r border-[#3e3e3e] p-3 space-y-1">
                {Object.keys(workspaceFiles).map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setSelectedFile(path)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors appearance-none ${
                      selectedFile === path ? 'bg-[#1f1f1f] text-white border border-[#3e3e3e]' : 'text-gray-300 hover:bg-[#2f2f2f]'
                    }`}
                  >
                    {path}
                  </button>
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
                  className="w-full min-h-[320px] bg-[#191919] border border-[#3e3e3e] rounded-lg p-3 text-xs font-mono text-gray-200 outline-none resize-y appearance-none"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#191919] border-t border-[#252525]">
        <div className="max-w-4xl mx-auto bg-[#252525] rounded-2xl border border-[#3e3e3e] flex items-center p-2 gap-2 shadow-lg">
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
            className="px-3 py-2 text-sm rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 bg-transparent border-none appearance-none"
          >
            +
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={auth.status === 'authenticated' ? 'Запросить изменения или задать вопрос...' : 'Войдите через Google, чтобы писать в чат'}
            className="flex-1 bg-transparent text-white px-2 outline-none placeholder-gray-500 text-sm sm:text-base disabled:opacity-100 disabled:bg-transparent disabled:text-gray-400 appearance-none"
            disabled={auth.status !== 'authenticated'}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSend();
              }
            }}
          />

          {auth.status === 'authenticated' ? (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className={`p-2 rounded-full transition-all duration-200 border-none appearance-none ${canSend ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#333] text-gray-500 cursor-not-allowed'}`}
              aria-label="Send"
            >
              <ArrowUp size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleGoogleAuth()}
              disabled={isAuthLoading}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-60 border-none appearance-none"
            >
              {isAuthLoading ? 'Вход...' : 'Войти через Google'}
            </button>
          )}
        </div>

        {attachedImages.length > 0 ? (
          <div className="max-w-4xl mx-auto mt-2 flex flex-wrap gap-2">
            {attachedImages.map((file) => (
              <span key={file.name} className="text-xs px-2 py-1 rounded-md bg-[#1f1f1f] border border-[#3e3e3e] text-gray-200">
                {file.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="text-center mt-3">
          <span className="text-[11px] text-gray-500">Lite Agent может ошибаться. Проверяйте критичные изменения перед деплоем.</span>
        </div>
      </div>
    </div>
  );
}
