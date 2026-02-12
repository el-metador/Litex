import { useEffect, useState } from 'react';
import { Menu, Settings, Shield, Terminal, X } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';
import { authStore } from '~/lib/stores/auth';
import { signInWithGoogle } from '~/lib/supabase/auth.client';
import { Button } from '~/components/ui/Button';
import type { ViewState } from './types';

interface NavbarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onOpenSettings: () => void;
}

export function Navbar({ currentView, onNavigate, onOpenSettings }: NavbarProps) {
  const auth = useStore(authStore);
  const reduceMotion = useReducedMotion();
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const handleGoogleAuth = async () => {
    if (isAuthLoading) {
      return;
    }

    setIsAuthLoading(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setIsAuthLoading(false);
      const message = error instanceof Error ? error.message : 'Не удалось начать вход через Google';
      window.alert(message);
    }
  };

  const handleNavigate = (view: ViewState) => {
    onNavigate(view);
    setIsMobileMenuOpen(false);
  };

  const handleOpenSettings = () => {
    onOpenSettings();
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="mx-auto mt-2 flex h-[3.35rem] w-[calc(100%-1rem)] max-w-[1280px] items-center justify-between rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 elevation-2 sm:h-14 sm:px-4">
        <div className="min-w-0 flex items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            className="md:hidden"
            aria-label="Open menu"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>

          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="ui-focus-ring ui-interactive flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] bg-transparent p-1 text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/14 bg-white/10 shadow-[var(--shadow-sm)] sm:h-9 sm:w-9">
              <Terminal size={17} className="text-white" />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight sm:text-lg">LiteCode</span>
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          {currentView === 'chat' ? (
            <div className="hidden items-center gap-2 rounded-full border border-white/14 bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs text-gray-300 lg:flex elevation-1">
              <Shield size={12} />
              <span>Private Beta - Lite Agent</span>
            </div>
          ) : null}

          {auth.status === 'authenticated' ? (
            <div className="hidden max-w-[220px] truncate text-xs text-gray-300 lg:block">{auth.email || 'Авторизованный пользователь'}</div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleGoogleAuth()}
              disabled={isAuthLoading}
              className="hidden sm:inline-flex"
            >
              {isAuthLoading ? 'Вход...' : 'Войти через Google'}
            </Button>
          )}

          <Button type="button" variant="secondary" size="sm" onClick={handleOpenSettings} className="hidden lg:inline-flex">
            Настройки
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleOpenSettings}
            aria-label="Open settings"
            className="hidden md:inline-flex"
          >
            <Settings size={18} />
          </Button>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen ? (
          <m.div
            key="mobile-menu"
            variants={reduceMotion ? motionVariants.modalReduced : motionVariants.modalBackdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-40 md:hidden"
          >
            <button
              type="button"
              aria-label="Close mobile menu"
              className="overlay-backdrop absolute inset-0 border-none"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <m.aside
              variants={reduceMotion ? motionVariants.modalReduced : motionVariants.modalPanel}
              initial="initial"
              animate="animate"
              exit="exit"
              className="surface-card elevation-4 absolute bottom-3 left-3 right-3 top-[calc(env(safe-area-inset-top)+3.85rem)] z-50 overflow-y-auto space-y-2 rounded-[var(--radius-lg)] p-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
              <Button
                type="button"
                variant={currentView === 'dashboard' ? 'secondary' : 'ghost'}
                size="md"
                onClick={() => handleNavigate('dashboard')}
                className="w-full justify-start"
              >
                Дашборд
              </Button>
              <Button
                type="button"
                variant={currentView === 'chat' ? 'secondary' : 'ghost'}
                size="md"
                onClick={() => handleNavigate('chat')}
                disabled={auth.status !== 'authenticated'}
                className="w-full justify-start"
              >
                Чат
              </Button>
              <Button
                type="button"
                variant={currentView === 'settings' ? 'secondary' : 'ghost'}
                size="md"
                onClick={handleOpenSettings}
                className="w-full justify-start"
              >
                Настройки
              </Button>

              {auth.status === 'authenticated' ? (
                <p className="mt-2 break-all border-t border-white/10 pt-3 text-xs text-gray-400">
                  {auth.email || 'Авторизованный пользователь'}
                </p>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => void handleGoogleAuth()}
                  disabled={isAuthLoading}
                  className="mt-1 w-full"
                >
                  {isAuthLoading ? 'Вход...' : 'Войти через Google'}
                </Button>
              )}
            </m.aside>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
