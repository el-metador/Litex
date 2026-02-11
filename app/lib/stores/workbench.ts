import { atom, map, type MapStore, type WritableAtom } from 'nanostores';
import type { BoltAction } from '~/types/actions';
import type { ITerminal } from '~/types/terminal';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { diffFiles } from '~/utils/diff';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  actions: Record<string, LiteActionState>;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code';

export type LiteActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type LiteActionState = BoltAction & {
  id: string;
  status: LiteActionStatus;
  executed: boolean;
  error?: string;
};

interface EditorSnapshot {
  filePath: string;
  content: string;
  syncedContent: string;
}

interface FileModification {
  type: 'diff' | 'file';
  content: string;
}

type FileModifications = Record<string, FileModification>;

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

const DEFAULT_FILE_PATH = '/home/project/src/main.ts';
const DEFAULT_EDITOR_CODE = `export function liteAgentMessage() {
  return 'Lite Agent is ready';
}
`;

export class WorkbenchStore {
  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(false);
  previews: WritableAtom<PreviewInfo[]> = import.meta.hot?.data.previews ?? atom([]);

  editor: WritableAtom<EditorSnapshot> =
    import.meta.hot?.data.editor ??
    atom({
      filePath: DEFAULT_FILE_PATH,
      content: DEFAULT_EDITOR_CODE,
      syncedContent: DEFAULT_EDITOR_CODE,
    });

  artifactIdList: string[] = [];

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.showTerminal = this.showTerminal;
      import.meta.hot.data.previews = this.previews;
      import.meta.hot.data.editor = this.editor;
    }
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get currentCode() {
    return this.editor.get().content;
  }

  get currentFilePath() {
    return this.editor.get().filePath;
  }

  setEditorContent(content: string) {
    const snapshot = this.editor.get();

    this.editor.set({
      ...snapshot,
      content,
    });
  }

  setGeneratedCode(content: string, filePath = DEFAULT_FILE_PATH) {
    const normalizedPath = filePath.trim() || DEFAULT_FILE_PATH;

    this.editor.set({
      filePath: normalizedPath,
      content,
      syncedContent: content,
    });
    this.showWorkbench.set(true);
  }

  setEditorFilePath(filePath: string) {
    const snapshot = this.editor.get();
    const normalizedPath = filePath.trim() || DEFAULT_FILE_PATH;

    this.editor.set({
      ...snapshot,
      filePath: normalizedPath,
    });
  }

  getDiffStats() {
    const snapshot = this.editor.get();
    const diff = diffFiles(snapshot.filePath, snapshot.syncedContent, snapshot.content);

    if (!diff) {
      return { added: 0, removed: 0 };
    }

    let added = 0;
    let removed = 0;

    for (const line of diff.split('\n')) {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
        continue;
      }

      if (line.startsWith('+')) {
        added++;
      } else if (line.startsWith('-')) {
        removed++;
      }
    }

    return { added, removed };
  }

  async saveAllFiles() {
    return Promise.resolve();
  }

  getFileModifcations(): FileModifications | undefined {
    const snapshot = this.editor.get();
    const unifiedDiff = diffFiles(snapshot.filePath, snapshot.syncedContent, snapshot.content);

    if (!unifiedDiff) {
      return undefined;
    }

    if (unifiedDiff.length > snapshot.content.length) {
      return {
        [snapshot.filePath]: {
          type: 'file',
          content: snapshot.content,
        },
      };
    }

    return {
      [snapshot.filePath]: {
        type: 'diff',
        content: unifiedDiff,
      },
    };
  }

  resetAllFileModifications() {
    const snapshot = this.editor.get();
    this.editor.set({
      ...snapshot,
      syncedContent: snapshot.content,
    });
  }

  abortAllActions() {
    const artifacts = this.artifacts.get();

    for (const [messageId, artifact] of Object.entries(artifacts)) {
      const actions = Object.values(artifact.actions).reduce<Record<string, LiteActionState>>((result, action) => {
        result[action.id] = {
          ...action,
          status: action.status === 'running' ? 'aborted' : action.status,
        };
        return result;
      }, {});

      this.artifacts.setKey(messageId, {
        ...artifact,
        actions,
      });
    }
  }

  toggleTerminal(value?: boolean) {
    if (typeof value === 'boolean') {
      this.showTerminal.set(value);
      return;
    }

    this.showTerminal.set(!this.showTerminal.get());
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  attachTerminal(_terminal: ITerminal) {
    // webcontainer terminal removed in lite agent mode
  }

  onTerminalResize(_cols: number, _rows: number) {
    // webcontainer terminal removed in lite agent mode
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      actions: {},
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId, actionId, action } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    const actions = {
      ...artifact.actions,
      [actionId]: {
        ...action,
        id: actionId,
        status: 'pending',
        executed: false,
      },
    } satisfies Record<string, LiteActionState>;

    this.artifacts.setKey(messageId, {
      ...artifact,
      actions,
    });
  }

  async runAction(data: ActionCallbackData) {
    const { messageId, actionId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    const action = artifact.actions[actionId];

    if (!action) {
      return;
    }

    const runningAction: LiteActionState = {
      ...action,
      status: 'running',
      executed: true,
    };

    this.artifacts.setKey(messageId, {
      ...artifact,
      actions: {
        ...artifact.actions,
        [actionId]: runningAction,
      },
    });

    if (runningAction.type === 'file') {
      this.setGeneratedCode(runningAction.content, runningAction.filePath);
    }

    this.artifacts.setKey(messageId, {
      ...artifact,
      actions: {
        ...artifact.actions,
        [actionId]: {
          ...runningAction,
          status: 'complete',
        },
      },
    });
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }
}

export const workbenchStore = new WorkbenchStore();
