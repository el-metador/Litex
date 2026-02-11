import { useStore } from '@nanostores/react';
import { motion, type Variants } from 'framer-motion';
import { memo, useMemo } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { diffFiles } from '~/utils/diff';

interface WorkspaceProps {
  chatStarted?: boolean;
}

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const Workbench = memo(({ chatStarted }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const editor = useStore(workbenchStore.editor);

  const diffStats = useMemo(() => {
    const unifiedDiff = diffFiles(editor.filePath, editor.syncedContent, editor.content);

    if (!unifiedDiff) {
      return { added: 0, removed: 0 };
    }

    let added = 0;
    let removed = 0;

    for (const line of unifiedDiff.split('\n')) {
      if (line.startsWith('@@')) {
        continue;
      }

      if (line.startsWith('+')) {
        added++;
      } else if (line.startsWith('-')) {
        removed++;
      }
    }

    return { added, removed };
  }, [editor.filePath, editor.syncedContent, editor.content]);

  const hasUnsavedChanges = diffStats.added > 0 || diffStats.removed > 0;

  const downloadCode = () => {
    if (!editor.content.trim()) {
      return;
    }

    const fallbackName = 'lite-agent-output.txt';
    const baseName = editor.filePath.split('/').pop() || fallbackName;
    const safeName = baseName.replace(/[^\w.-]/g, '_') || fallbackName;
    const blob = new Blob([editor.content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = safeName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <div
          className={classNames(
            'fixed top-[calc(var(--header-height)+0.75rem)] md:top-[calc(var(--header-height)+1.5rem)] bottom-3 md:bottom-6 w-[var(--workbench-inner-width)] mr-2 md:mr-4 z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
            {
              'left-[var(--workbench-left)]': showWorkbench,
              'left-[100%]': !showWorkbench,
            },
          )}
        >
          <div className="absolute inset-0 px-2 md:px-6">
            <div className="h-full flex flex-col rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl shadow-black/30 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-bolt-elements-borderColor px-3 py-2.5 md:px-4">
                <div className="rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 px-2 py-1 text-xs font-medium text-bolt-elements-textSecondary">
                  Lite Agent Editor
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <DiffBadge label="Added" value={diffStats.added} kind="added" />
                  <DiffBadge label="Removed" value={diffStats.removed} kind="removed" />
                  <button
                    className="rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 px-2 py-1 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                    onClick={() => workbenchStore.resetAllFileModifications()}
                  >
                    {hasUnsavedChanges ? 'Mark Synced' : 'Synced'}
                  </button>
                  <button
                    className="rounded-md border border-bolt-elements-borderColor bg-bolt-elements-item-backgroundAccent px-2 py-1 text-xs text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3"
                    onClick={downloadCode}
                  >
                    Download
                  </button>
                </div>
                <IconButton
                  icon="i-ph:x-circle"
                  className="-mr-1"
                  size="xl"
                  title="Close editor"
                  onClick={() => {
                    workbenchStore.showWorkbench.set(false);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 border-b border-bolt-elements-borderColor px-3 py-2 md:px-4">
                <div className="i-ph:file-code text-bolt-elements-textSecondary" />
                <input
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-bolt-elements-textSecondary focus:border-bolt-elements-borderColor"
                  value={editor.filePath}
                  name="lite-agent-file-path"
                  autoComplete="off"
                  aria-label="Generated file path"
                  onChange={(event) => {
                    workbenchStore.setEditorFilePath(event.target.value);
                  }}
                />
              </div>
              <div className="relative flex-1 bg-bolt-elements-actions-code-background">
                <textarea
                  className="h-full w-full resize-none border-none bg-transparent px-3 py-3 font-mono text-xs leading-5 text-[#e6edf3] md:px-4 md:py-4 md:text-sm"
                  value={editor.content}
                  onChange={(event) => {
                    workbenchStore.setEditorContent(event.target.value);
                  }}
                  spellCheck={false}
                  aria-label="Lite Agent code editor"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  );
});

interface DiffBadgeProps {
  label: string;
  value: number;
  kind: 'added' | 'removed';
}

function DiffBadge({ label, value, kind }: DiffBadgeProps) {
  const isAdded = kind === 'added';

  return (
    <div
      className={classNames('rounded-md border px-2 py-1 text-xs font-medium', {
        'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.22)]': isAdded,
        'border-rose-500/50 bg-rose-500/10 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.2)]': !isAdded,
      })}
      title={label}
    >
      {isAdded ? '+' : '-'}
      {value}
    </div>
  );
}
