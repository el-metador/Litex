import { atom } from 'nanostores';

export const sidebarOpenStore = atom(false);

export function toggleSidebar(force?: boolean) {
  if (typeof force === 'boolean') {
    sidebarOpenStore.set(force);
    return;
  }

  sidebarOpenStore.set(!sidebarOpenStore.get());
}
