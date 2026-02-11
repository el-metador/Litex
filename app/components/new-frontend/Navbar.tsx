import { useState } from 'react';
import { Menu, Settings, Shield, Terminal, X } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { signInWithGoogle } from '~/lib/supabase/auth.client';
import type { ViewState } from './types';

interface NavbarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onOpenSettings: () => void;
}

export function Navbar({ currentView, onNavigate, onOpenSettings }: NavbarProps) {
  const auth = useStore(authStore);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <nav className="flex items-center justify-between px-4 h-14 bg-[#191919] border-b border-[#252525] relative z-40">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            className="p-2 text-gray-400 hover:text-white md:hidden bg-transparent border-none appearance-none"
            aria-label="Open menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0 text-white min-w-0 appearance-none"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <Terminal size={18} className="text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight truncate">LiteCode</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {currentView === 'chat' ? (
            <div className="hidden md:flex items-center px-3 py-1.5 bg-[#252525] rounded-full text-xs text-gray-300 gap-2 border border-[#333]">
              <Shield size={12} />
              <span>Private Beta - Lite Agent</span>
            </div>
          ) : null}

          {auth.status === 'authenticated' ? (
            <div className="hidden sm:block text-xs text-gray-300 max-w-[220px] truncate">
              {auth.email || 'Авторизованный пользователь'}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleGoogleAuth()}
              disabled={isAuthLoading}
              className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors disabled:opacity-60 appearance-none border-none"
            >
              {isAuthLoading ? 'Вход...' : 'Войти через Google'}
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenSettings}
            className="hidden sm:inline-flex px-3 py-1.5 text-xs rounded-md border border-[#3e3e3e] text-gray-200 hover:bg-[#252525] transition-colors bg-transparent appearance-none"
          >
            Настройки
          </button>

          <button
            type="button"
            onClick={handleOpenSettings}
            className="p-2 text-gray-300 hover:text-white rounded-md hover:bg-[#252525] transition-colors bg-transparent border-none appearance-none"
            aria-label="Open settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </nav>

      {isMobileMenuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close mobile menu"
            className="fixed inset-0 bg-black/50 z-40 md:hidden border-none"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <aside className="fixed top-14 left-0 z-50 w-[260px] bg-[#1f1f1f] border-r border-[#333] shadow-2xl p-4 space-y-3 md:hidden">
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'dashboard' ? 'bg-[#2f2f2f] text-white' : 'text-gray-200 hover:bg-[#2a2a2a]'}`}
            >
              Дашборд
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('chat')}
              disabled={auth.status !== 'authenticated'}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'chat' ? 'bg-[#2f2f2f] text-white' : 'text-gray-200 hover:bg-[#2a2a2a]'} disabled:opacity-40`}
            >
              Чат
            </button>
            <button
              type="button"
              onClick={handleOpenSettings}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'settings' ? 'bg-[#2f2f2f] text-white' : 'text-gray-200 hover:bg-[#2a2a2a]'}`}
            >
              Настройки
            </button>
            {auth.status === 'authenticated' ? (
              <p className="pt-2 text-xs text-gray-400 border-t border-[#333] break-all">{auth.email || 'Авторизованный пользователь'}</p>
            ) : (
              <button
                type="button"
                onClick={() => void handleGoogleAuth()}
                disabled={isAuthLoading}
                className="w-full px-3 py-2 text-sm bg-white text-black rounded-md hover:bg-gray-200 transition-colors disabled:opacity-60 border-none appearance-none"
              >
                {isAuthLoading ? 'Вход...' : 'Войти через Google'}
              </button>
            )}
          </aside>
        </>
      ) : null}
    </>
  );
}
