import type { Message } from 'ai';
import React, { type RefCallback } from 'react';
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
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'How do I center a div?' },
];

const TEXTAREA_MIN_HEIGHT = 76;

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
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

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
                <div className="mx-auto mb-4 w-fit rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-1 text-xs text-bolt-elements-textSecondary">
                  LiteCode • Handicrafters lab
                </div>
                <h1 className="text-4xl md:text-5xl text-center font-700 tracking-tight text-bolt-elements-textPrimary mb-2">
                  LiteCode Workspace
                </h1>
                <p className="mx-auto mb-4 max-w-2xl text-center text-bolt-elements-textSecondary">
                  Быстрое AI-пространство для кода: чистый чат, понятный workbench, быстрый деплой.
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
                    className="w-full pl-4 md:pl-5 pt-4 md:pt-5 pr-16 md:pr-18 focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent"
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
                    placeholder="How can LiteCode help you today?"
                    translate="no"
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
                      <label className="flex items-center gap-2 text-bolt-elements-textSecondary">
                        <span className="i-ph:cpu" />
                        <span>Model</span>
                        <select
                          value={selectedModel}
                          onChange={(event) => onModelChange?.(event.target.value as LlmModelId)}
                          className="min-w-[200px] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-borderColorActive"
                        >
                          {LLM_MODELS.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.label} ({getProviderLabel(model.provider)})
                            </option>
                          ))}
                        </select>
                      </label>
                      {input.length > 3 ? (
                        <div className="text-xs text-bolt-elements-textTertiary">
                          Shift + Enter для новой строки
                        </div>
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
                            <div className="ml-1.5">Improving prompt...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            {promptEnhanced && <div className="ml-1.5">Prompt improved</div>}
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
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);
