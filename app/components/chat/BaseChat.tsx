import type { Message } from 'ai';
import React, { type RefCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { LLM_MODELS, type LlmModelId } from '~/lib/llm/models';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';

import styles from './BaseChat.module.scss';

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  selectedModel?: LlmModelId;
  onModelChange?: (model: LlmModelId) => void;
}

const EXAMPLE_PROMPTS = [
  { text: "Let's build MVP website for a startup in 1 day" },
  { text: 'Create full-stack auth flow with Supabase and Remix' },
  { text: 'Refactor this component for better performance and clarity' },
  { text: 'Generate a clean API contract for user billing service' },
  { text: 'Build a mobile-first landing page with animations' },
];

const TEXTAREA_MIN_HEIGHT = 76;
const PRIMARY_AGENT_NAME = 'Lite Agent';
const TYPEWRITER_PHRASES = [
  "Let's build MVP website…",
  'Ship production-ready React code…',
  'Refactor backend without breaking API…',
  'Design mobile UI with strong hierarchy…',
];

function getProviderLabel(provider: 'gemini' | 'openrouter') {
  if (provider === 'gemini') {
    return 'Gemini API';
  }

  return 'OpenRouter';
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
      selectedModel = 'gemini-cheap',
      onModelChange,
    },
    ref,
  ) => {
    const [agentMenuOpen, setAgentMenuOpen] = useState(false);
    const [typingState, setTypingState] = useState({
      phraseIndex: 0,
      charIndex: 0,
      deleting: false,
      text: '',
    });
    const modelMenuRef = useRef<HTMLDivElement>(null);
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const selectedModelDefinition = useMemo(
      () => LLM_MODELS.find((model) => model.id === selectedModel) ?? LLM_MODELS[0],
      [selectedModel],
    );
    const typedPromptPreview = typingState.text || TYPEWRITER_PHRASES[0];

    useEffect(() => {
      let timeout: number | undefined;

      if (!chatStarted) {
        const phrase = TYPEWRITER_PHRASES[typingState.phraseIndex];
        let nextPhraseIndex = typingState.phraseIndex;
        let nextCharIndex = typingState.charIndex;
        let nextDeleting = typingState.deleting;
        let nextDelay = typingState.deleting ? 26 : 46;

        if (!typingState.deleting && typingState.charIndex < phrase.length) {
          nextCharIndex = typingState.charIndex + 1;
        } else if (!typingState.deleting && typingState.charIndex >= phrase.length) {
          nextDeleting = true;
          nextDelay = 900;
        } else if (typingState.deleting && typingState.charIndex > 0) {
          nextCharIndex = typingState.charIndex - 1;
        } else if (typingState.deleting && typingState.charIndex === 0) {
          nextDeleting = false;
          nextPhraseIndex = (typingState.phraseIndex + 1) % TYPEWRITER_PHRASES.length;
          nextDelay = 260;
        }

        const nextPhrase = TYPEWRITER_PHRASES[nextPhraseIndex];
        timeout = window.setTimeout(() => {
          setTypingState({
            phraseIndex: nextPhraseIndex,
            charIndex: nextCharIndex,
            deleting: nextDeleting,
            text: nextPhrase.slice(0, nextCharIndex),
          });
        }, nextDelay);
      }

      return () => {
        if (timeout) {
          window.clearTimeout(timeout);
        }
      };
    }, [chatStarted, typingState]);

    useEffect(() => {
      if (agentMenuOpen) {
        const onPointerDown = (event: PointerEvent) => {
          if (!modelMenuRef.current?.contains(event.target as Node)) {
            setAgentMenuOpen(false);
          }
        };

        window.addEventListener('pointerdown', onPointerDown);

        return () => {
          window.removeEventListener('pointerdown', onPointerDown);
        };
      }

      return undefined;
    }, [agentMenuOpen]);

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex w-full h-full overflow-y-auto">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-0 w-full h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[20vh] md:mt-[24vh] max-w-chat mx-auto px-5">
                <div className="mx-auto mb-4 w-fit rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-1 text-xs text-bolt-elements-textSecondary shadow-[0_0_24px_rgba(255,255,255,0.08)]">
                  {PRIMARY_AGENT_NAME} • Handicrafters lab
                </div>
                <h1 className="text-4xl md:text-5xl text-center font-700 tracking-tight text-bolt-elements-textPrimary mb-2">
                  Codex-like Workspace
                </h1>
                <p className="mx-auto mb-3 max-w-2xl text-center text-bolt-elements-textSecondary">
                  Один основной агент для разработки: быстрое проектирование, генерация и правка кода.
                </p>
                <p className="mx-auto mb-4 max-w-xl text-center text-sm md:text-base text-bolt-elements-textPrimary">
                  <span className="opacity-85">{typedPromptPreview}</span>
                  <span className="ml-0.5 inline-block h-[1em] w-[1px] bg-bolt-elements-textPrimary animate-pulse" />
                </p>
              </div>
            )}
            <div
              className={classNames('px-3 md:px-6 pt-4 md:pt-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-1 md:px-4 pb-4 md:pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                <div
                  className={classNames(
                    'shadow-lg shadow-alpha-accent-10 border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-2xl overflow-hidden',
                  )}
                >
                  <textarea
                    ref={textareaRef}
                    className="w-full pl-4 md:pl-5 pt-4 md:pt-5 pr-16 md:pr-18 resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        if (event.shiftKey) {
                          return;
                        }

                        event.preventDefault();

                        sendMessage?.(event);
                      }
                    }}
                    value={input}
                    onChange={(event) => {
                      handleInputChange?.(event);
                    }}
                    style={{
                      minHeight: TEXTAREA_MIN_HEIGHT,
                      maxHeight: TEXTAREA_MAX_HEIGHT,
                    }}
                    placeholder="How can Lite Agent help you today…"
                    translate="no"
                    aria-label="Chat prompt"
                    name="chat-prompt"
                    autoComplete="off"
                  />
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || isStreaming}
                        isStreaming={isStreaming}
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          sendMessage?.(event);
                        }}
                      />
                    )}
                  </ClientOnly>
                  <div className="flex flex-col gap-3 border-t border-bolt-elements-borderColor p-3 md:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div ref={modelMenuRef} className="relative">
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3"
                          onClick={() => setAgentMenuOpen((open) => !open)}
                        >
                          <span className="i-ph:cpu" />
                          <span>{PRIMARY_AGENT_NAME}</span>
                          <span className="rounded bg-bolt-elements-item-backgroundAccent px-1.5 py-0.5 text-[11px] text-bolt-elements-item-contentAccent">
                            Locked
                          </span>
                          <span className="text-bolt-elements-textSecondary">{selectedModelDefinition.label}</span>
                          <span className={agentMenuOpen ? 'i-ph:caret-up' : 'i-ph:caret-down'} />
                        </button>
                        {agentMenuOpen && (
                          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-10 min-w-[300px] rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2 shadow-xl shadow-black/20">
                            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-bolt-elements-textTertiary">
                              AI Engine (frontend choice)
                            </div>
                            {LLM_MODELS.map((model) => {
                              const isActive = model.id === selectedModel;

                              return (
                                <button
                                  key={model.id}
                                  className={classNames(
                                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                                    {
                                      'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                                        isActive,
                                      'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary':
                                        !isActive,
                                    },
                                  )}
                                  onClick={() => {
                                    onModelChange?.(model.id as LlmModelId);
                                    setAgentMenuOpen(false);
                                  }}
                                >
                                  <span className={isActive ? 'i-ph:check-bold' : 'i-ph:circle'} />
                                  <span className="flex-1">
                                    {model.label}{' '}
                                    <span className="text-xs opacity-70">({getProviderLabel(model.provider)})</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {input.length > 3 ? (
                        <div className="text-xs text-bolt-elements-textTertiary">Shift + Enter для новой строки</div>
                      ) : null}
                    </div>
                    <div className="flex gap-1 items-center">
                      <IconButton
                        title="Enhance prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          'opacity-100!': enhancingPrompt,
                          'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!':
                            promptEnhanced,
                        })}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl"></div>
                            <div className="ml-1.5">Improving prompt…</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            <div className="ml-1.5">{promptEnhanced ? 'Prompt improved' : 'AI pre-prompt'}</div>
                          </>
                        )}
                      </IconButton>
                    </div>
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-4 md:pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div id="examples" className="relative w-full max-w-xl px-5 mx-auto mt-7 md:mt-8 flex justify-center">
                <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                  {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                    return (
                      <button
                        key={index}
                        onClick={(event) => {
                          sendMessage?.(event, examplePrompt.text);
                        }}
                        className="group flex items-center w-full gap-2 justify-center rounded-lg border border-transparent bg-transparent px-3 py-1.5 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-2 transition-theme"
                      >
                        {examplePrompt.text}
                        <div className="i-ph:arrow-bend-down-left" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} />}</ClientOnly>
        </div>
      </div>
    );
  },
);
