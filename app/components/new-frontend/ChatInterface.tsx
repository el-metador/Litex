import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useChat } from 'ai/react';
import { ArrowLeft, ArrowUp, Mic, PanelLeftClose, Plus, Share } from 'lucide-react';
import { authStore } from '~/lib/stores/auth';
import { chatStore } from '~/lib/stores/chat';
import { fetchWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';

interface ChatInterfaceProps {
  initialPrompt: string;
  onBack: () => void;
}

export function ChatInterface({ initialPrompt, onBack }: ChatInterfaceProps) {
  const auth = useStore(authStore);
  const { model } = useStore(chatStore);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const bootstrappedMessages = useMemo(() => {
    const prompt = initialPrompt.trim();

    if (!prompt) {
      return [];
    }

    return [
      {
        id: `bootstrap-${prompt}`,
        role: 'user' as const,
        content: prompt,
      },
    ];
  }, [initialPrompt]);

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

  const { messages, append, isLoading, error } = useChat({
    api: '/api/chat',
    body: {
      model,
    },
    initialMessages: bootstrappedMessages,
    fetch: authenticatedFetch,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();

    if (!trimmed || isLoading || auth.status !== 'authenticated') {
      return;
    }

    await append({ role: 'user', content: trimmed });
    setInputValue('');
  };

  const chatTitle = initialPrompt.trim() || 'Новая задача';
  const canSend = inputValue.trim().length > 0 && auth.status === 'authenticated' && !isLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#191919]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3e3e3e] bg-[#191919] min-h-[50px]">
        <div className="flex items-center gap-3 overflow-hidden">
          <button onClick={onBack} type="button" className="text-gray-400 hover:text-white transition-colors shrink-0" aria-label="Back to dashboard">
            <ArrowLeft size={20} />
          </button>

          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">{chatTitle}</span>
            <span className="text-xs text-gray-500 truncate">{model}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden md:flex items-center">
            <button type="button" className="text-sm font-medium text-white px-3 py-1.5 rounded-md bg-[#252525]">
              Обсуждение
            </button>
            <button type="button" className="text-sm font-medium text-gray-500 hover:text-white px-3 py-1.5 rounded-md hover:bg-[#252525] transition-colors">
              Журналы
            </button>
          </div>

          <div className="w-px h-4 bg-[#3e3e3e] hidden md:block" />

          <button type="button" className="text-gray-400 hover:text-white hidden sm:block" aria-label="Share">
            <Share size={18} />
          </button>

          <button type="button" className="text-gray-400 hover:text-white" aria-label="Toggle side panel">
            <PanelLeftClose size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'bg-[#2f2f2f] text-white' : 'text-gray-200'}`}>
              {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 text-xs text-white font-mono bg-[#252525] border border-[#3e3e3e] rounded-md px-3 py-1.5">
              <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
              <span>Assistant is thinking</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="text-sm text-red-300 bg-red-950/30 border border-red-800 rounded-lg p-3">
            {error.message}
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#191919]">
        <div className="max-w-3xl mx-auto bg-[#252525] rounded-full border border-[#3e3e3e] flex items-center p-2 shadow-lg focus-within:border-gray-500 transition-all">
          <button type="button" className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors ml-1" aria-label="Attach">
            <Plus size={22} />
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={auth.status === 'authenticated' ? 'Запросить изменения или задать вопрос...' : 'Войдите в аккаунт, чтобы отправлять сообщения'}
            className="flex-1 bg-transparent text-white px-3 outline-none placeholder-gray-500 text-base"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSend();
              }
            }}
          />

          <div className="flex items-center gap-1 pr-1">
            <button type="button" className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors" aria-label="Voice input">
              <Mic size={20} />
            </button>

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className={`p-2 rounded-full transition-all duration-200 ${canSend ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#333] text-gray-500 cursor-not-allowed'}`}
              aria-label="Send"
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </div>

        <div className="text-center mt-3">
          <span className="text-[11px] text-gray-500">LiteCode может допускать ошибки. Проверяйте важную информацию.</span>
        </div>
      </div>
    </div>
  );
}
