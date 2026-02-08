import { useStore } from '@nanostores/react';
import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { authStore } from '~/lib/stores/auth';
import { fetchJsonWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { deleteById, getAll, getPersistenceDatabase, chatId, type ChatHistoryItem } from '~/lib/persistence';
import { sidebarOpenStore, toggleSidebar } from '~/lib/stores/sidebar';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';

const menuVariants = {
  closed: {
    x: '-110%',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    x: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

interface ServerSessionSummary {
  id: string;
  title: string | null;
  lastMessageAt: string;
}

export function Menu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const auth = useStore(authStore);
  const sidebarOpen = useStore(sidebarOpenStore);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);

  const open = sidebarOpen || hoverOpen;

  const mapServerItem = (item: ServerSessionSummary): ChatHistoryItem => ({
    id: item.id,
    urlId: item.id,
    description: item.title ?? 'Untitled chat',
    messages: [],
    timestamp: item.lastMessageAt,
  });

  const loadEntries = useCallback(() => {
    if (auth.status === 'authenticated') {
      fetchJsonWithSupabaseAuth<{ sessions: ServerSessionSummary[] }>('/api/chat-sessions')
        .then((payload) => payload.sessions.map(mapServerItem).filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));

      return;
    }

    getPersistenceDatabase()
      .then((database) => {
        if (!database) {
          return [];
        }

        return getAll(database).then((entries) => entries.filter((item) => item.urlId && item.description));
      })
      .then(setList)
      .catch((error) => toast.error(error.message));
  }, [auth.status]);

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();

      if (auth.status === 'authenticated') {
        fetchJsonWithSupabaseAuth<{ ok: boolean }>(`/api/chat-sessions/${item.id}`, {
          method: 'DELETE',
        })
          .then(() => {
            loadEntries();

            if (chatId.get() === item.id) {
              window.location.pathname = '/';
            }
          })
          .catch((error) => {
            toast.error(error.message);
          });

        return;
      }

      getPersistenceDatabase()
        .then((database) => {
          if (!database) {
            return;
          }

          return deleteById(database, item.id).then(() => {
            loadEntries();

            if (chatId.get() === item.id) {
              // hard page navigation to clear the stores
              window.location.pathname = '/';
            }
          });
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    },
    [auth.status, loadEntries],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      const allowHover = window.matchMedia('(pointer:fine)').matches && window.innerWidth >= 1024;

      if (!allowHover || sidebarOpen) {
        return;
      }

      if (event.pageX < enterThreshold) {
        setHoverOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setHoverOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [sidebarOpen]);

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-[109] bg-black/25 md:hidden"
          aria-label="Close menu"
          onClick={() => toggleSidebar(false)}
        />
      )}
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        className="flex flex-col side-menu fixed top-0 left-0 w-[290px] md:w-[340px] h-full bg-bolt-elements-background-depth-2 border-r border-bolt-elements-borderColor z-sidebar shadow-xl shadow-bolt-elements-sidebar-dropdownShadow text-sm"
      >
        <div className="flex items-center h-[var(--header-height)] px-4 border-b border-bolt-elements-borderColor">
          <div className="text-bolt-elements-textPrimary font-semibold">Conversations</div>
          <IconButton icon="i-ph:x" className="ml-auto md:hidden" onClick={() => toggleSidebar(false)} />
        </div>
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4">
            <a
              href="/"
              onClick={() => toggleSidebar(false)}
              className="flex gap-2 items-center bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-lg p-2.5 transition-theme border border-transparent"
            >
              <span className="inline-block i-bolt:chat scale-110" />
              Start new workspace
            </a>
          </div>
          <div className="text-bolt-elements-textPrimary font-medium pl-6 pr-5 my-2">Your Chats</div>
          <div className="flex-1 overflow-scroll pl-4 pr-5 pb-5">
            {list.length === 0 && <div className="pl-2 text-bolt-elements-textTertiary">No previous conversations</div>}
            <DialogRoot open={dialogContent !== null}>
              {binDates(list).map(({ category, items }) => (
                <div key={category} className="mt-4 first:mt-0 space-y-1">
                  <div className="text-bolt-elements-textTertiary sticky top-0 z-1 bg-bolt-elements-background-depth-2 pl-2 pt-2 pb-1">
                    {category}
                  </div>
                  {items.map((item) => (
                    <HistoryItem
                      key={item.id}
                      item={item}
                      onDelete={() => setDialogContent({ type: 'delete', item })}
                      onNavigate={() => toggleSidebar(false)}
                    />
                  ))}
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <DialogTitle>Delete Chat?</DialogTitle>
                    <DialogDescription asChild>
                      <div>
                        <p>
                          You are about to delete <strong>{dialogContent.item.description}</strong>.
                        </p>
                        <p className="mt-1">Are you sure you want to delete this chat?</p>
                      </div>
                    </DialogDescription>
                    <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center border-t border-bolt-elements-borderColor p-4">
            <ThemeSwitch className="ml-auto" />
          </div>
        </div>
      </motion.div>
    </>
  );
}
