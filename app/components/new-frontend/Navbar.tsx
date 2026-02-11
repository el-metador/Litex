import { useState } from 'react';
import { Menu, Settings, Shield, Terminal } from 'lucide-react';
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

  return (
    <nav className="flex items-center justify-between px-4 h-14 bg-[#191919] border-b border-[#252525] relative z-40">
      <div className="flex items-center gap-4 min-w-0">
        <button type="button" className="p-2 text-gray-400 hover:text-white md:hidden" aria-label="Open menu">
          <Menu size={20} />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0 text-white min-w-0"
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
            className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors disabled:opacity-60"
          >
            {isAuthLoading ? 'Вход...' : 'Войти через Google'}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-gray-300 hover:text-white rounded-md hover:bg-[#252525] transition-colors"
          aria-label="Open settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </nav>
  );
}
