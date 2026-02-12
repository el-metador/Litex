import type { ReactNode } from 'react';

interface AppLayoutProps {
  navbar: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
  toast?: ReactNode;
}

export function AppLayout({ navbar, children, overlays, toast }: AppLayoutProps) {
  return (
    <div className="litecode-app app-shell min-h-[100dvh] text-white selection:bg-[#10a37f] selection:text-white">
      <div aria-hidden="true" className="app-shell__bg">
        <span className="app-shell__bg-grid" />
        <span className="app-shell__bg-orb app-shell__bg-orb--a" />
        <span className="app-shell__bg-orb app-shell__bg-orb--b" />
        <span className="app-shell__bg-orb app-shell__bg-orb--c" />
        <span className="app-shell__bg-vignette" />
      </div>
      {navbar}
      <main className="app-shell__content pb-3 sm:pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
        {children}
      </main>
      {overlays}
      {toast}
    </div>
  );
}
