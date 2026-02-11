import { useEffect, useRef, useState } from 'react';
import { Check, Clock, LogOut, Menu, Settings, Shield, Terminal, User } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import type { ViewState } from './types';

interface NavbarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onOpenSettings: () => void;
}

export function Navbar({ currentView, onNavigate, onOpenSettings }: NavbarProps) {
  const auth = useStore(authStore);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSettingsClick = () => {
    setIsProfileOpen(false);
    onOpenSettings();
  };

  const accountLabel = auth.email?.trim() || 'Личный аккаунт';
  const planLabel = auth.plan ? auth.plan.toUpperCase() : 'FREE';

  return (
    <nav className="flex items-center justify-between px-4 h-14 bg-[#191919] border-b border-[#252525] relative z-40">
      <div className="flex items-center gap-4">
        <button type="button" className="p-2 text-gray-400 hover:text-white md:hidden" aria-label="Open menu">
          <Menu size={20} />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0 text-white"
        >
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Terminal size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">LiteCode</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {currentView === 'chat' ? (
          <div className="hidden md:flex items-center px-3 py-1.5 bg-[#252525] rounded-full text-xs text-gray-400 gap-2 border border-[#333]">
            <Shield size={12} />
            <span>Private Beta · {planLabel}</span>
          </div>
        ) : null}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen((open) => !open)}
            type="button"
            className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xs font-bold ring-2 ring-transparent hover:ring-white/20 transition-all text-white shadow-lg"
            aria-label="Open profile menu"
          >
            LC
          </button>

          {isProfileOpen ? (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#252525] border border-[#3e3e3e] rounded-xl shadow-2xl z-50 overflow-hidden text-sm">
              <div className="p-3 border-b border-[#3e3e3e]">
                <div className="text-gray-400 text-xs mb-2 px-1">АККАУНТ</div>

                <div className="flex items-center justify-between px-2 py-1.5 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-white">U</div>
                    <span className="text-gray-300 truncate max-w-[150px]">{accountLabel}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-2 py-1.5 rounded-md mt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Terminal size={10} className="text-white" />
                    </div>
                    <span className="text-gray-300">{planLabel}</span>
                  </div>
                  <Check size={14} className="text-white" />
                </div>

                <div className="flex items-center justify-between px-2 py-1.5 rounded-md mt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <User size={10} className="text-white" />
                    </div>
                    <span className="text-gray-300">Статус: {auth.status === 'authenticated' ? 'Авторизован' : 'Гость'}</span>
                  </div>
                </div>
              </div>

              <div className="py-2 border-b border-[#3e3e3e]">
                <button
                  type="button"
                  onClick={handleSettingsClick}
                  className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-[#2f2f2f] hover:text-white flex items-center gap-3"
                >
                  <Settings size={16} /> Настройки LiteCode
                </button>
                <button type="button" className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-[#2f2f2f] hover:text-white flex items-center gap-3">
                  <Clock size={16} /> Журнал изменений
                </button>
              </div>

              <div className="py-2">
                <button type="button" className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-[#2f2f2f] hover:text-white flex items-center gap-3">
                  <LogOut size={16} /> Выйти
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
