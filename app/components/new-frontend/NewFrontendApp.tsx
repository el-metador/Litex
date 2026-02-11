import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Dashboard } from './Dashboard';
import { ChatInterface } from './ChatInterface';
import { Navbar } from './Navbar';
import { Settings } from './Settings';
import { Toast } from './Toast';
import type { Branch, Repository, ViewState } from './types';
import { authStore } from '~/lib/stores/auth';

interface NewFrontendAppProps {
  repositories: Repository[];
  branches: Branch[];
}

export function NewFrontendApp({ repositories, branches }: NewFrontendAppProps) {
  const auth = useStore(authStore);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [previousView, setPreviousView] = useState<ViewState>('dashboard');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStartTask = (prompt: string) => {
    if (auth.status !== 'authenticated') {
      showToast('Чтобы начать чат с агентом, войдите через Google.');
      setCurrentView('dashboard');
      return;
    }

    setInitialPrompt(prompt);
    setCurrentView('chat');
  };

  const handleOpenSettings = () => {
    if (currentView !== 'settings') {
      setPreviousView(currentView);
      setCurrentView('settings');
    }
  };

  const handleCloseSettings = () => {
    setCurrentView(previousView);
  };

  useEffect(() => {
    if (auth.status !== 'authenticated' && currentView === 'chat') {
      setCurrentView('dashboard');
    }
  }, [auth.status, currentView]);

  return (
    <div className="min-h-screen bg-[#191919] text-white selection:bg-[#10a37f] selection:text-white">
      <Navbar currentView={currentView} onNavigate={setCurrentView} onOpenSettings={handleOpenSettings} />

      <main>
        {currentView === 'dashboard' ? (
          <Dashboard onStartTask={handleStartTask} showToast={showToast} repositories={repositories} branches={branches} />
        ) : null}

        {currentView === 'chat' ? (
          <ChatInterface
            initialPrompt={initialPrompt}
            onBack={() => setCurrentView('dashboard')}
            onToast={showToast}
          />
        ) : null}

        {currentView === 'settings' ? <Settings onClose={handleCloseSettings} /> : null}
      </main>

      <Toast message={toastMessage || ''} isVisible={Boolean(toastMessage)} onClose={() => setToastMessage(null)} />
    </div>
  );
}
