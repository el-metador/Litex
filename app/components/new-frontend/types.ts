export interface Repository {
  id: string;
  name: string;
  owner: string;
}

export interface Branch {
  id: string;
  name: string;
}

export type ViewState = 'dashboard' | 'chat' | 'settings';

export type SettingsTab =
  | 'general'
  | 'environments'
  | 'code_review'
  | 'connectors'
  | 'usage'
  | 'analytics'
  | 'data_controls'
  | 'documents';
