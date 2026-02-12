export type ActionType = 'file' | 'shell' | 'todo';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export type TodoActionStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoActionItem {
  id?: string;
  content: string;
  status: TodoActionStatus;
}

export interface TodoAction extends BaseAction {
  type: 'todo';
  title?: string;
  items?: TodoActionItem[];
}

export type BoltAction = FileAction | ShellAction | TodoAction;

export type BoltActionData = BoltAction | BaseAction;
