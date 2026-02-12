import type { ReactNode } from 'react';

interface AppLayoutProps {
  navbar: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
  toast?: ReactNode;
}

export function AppLayout({ navbar, children, overlays, toast }: AppLayoutProps) {
  return (
    <div className="litecode-app app-shell min-h-screen text-white selection:bg-[#10a37f] selection:text-white">
      {navbar}
      <main className="app-shell__content pb-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.25rem)' }}>
        {children}
      </main>
      {overlays}
      {toast}
    </div>
  );
}
