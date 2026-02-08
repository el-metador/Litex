import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { toggleSidebar } from '~/lib/stores/sidebar';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { AuthControls } from './AuthControls.client';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames(
        'flex items-center bg-bolt-elements-background-depth-1 px-3 md:px-5 border-b h-[var(--header-height)] sticky top-0 z-header backdrop-blur-sm',
        {
          'border-transparent': !chat.started,
          'border-bolt-elements-borderColor': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-theme"
          aria-label="Toggle menu"
          onClick={() => toggleSidebar()}
        >
          <div className="i-ph:sidebar-simple-duotone text-xl" />
        </button>
        <a href="/" className="text-base md:text-lg font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
          <span className="i-bolt:logo w-5 h-5 inline-block text-accent-700" />
          <span>LiteCode</span>
          <span className="hidden md:block text-xs text-bolt-elements-textTertiary font-medium">Handicrafters lab</span>
        </a>
      </div>
      <span className="flex-1 px-3 md:px-4 truncate text-center text-bolt-elements-textPrimary text-sm md:text-base">
        <ClientOnly>{() => <ChatDescription />}</ClientOnly>
      </span>
      <ClientOnly>
        {() => (
          <div className="mr-2">
            <AuthControls />
          </div>
        )}
      </ClientOnly>
      {chat.started && (
        <ClientOnly>
          {() => (
            <div className="mr-1">
              <HeaderActionButtons />
            </div>
          )}
        </ClientOnly>
      )}
    </header>
  );
}
