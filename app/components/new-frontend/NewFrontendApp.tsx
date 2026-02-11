import { useMemo, useState } from 'react';
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

  const availableRepositories = useMemo(() => {
    if (repositories.length > 0) {
      return repositories;
    }

    const fallbackOwner = auth.userId || 'workspace';

    return [
      {
        id: 'default-repo',
        owner: fallbackOwner,
        name: 'LiteCode',
      },
    ];
  }, [repositories, auth.userId]);

  const availableBranches = useMemo(() => {
    if (branches.length > 0) {
      return branches;
    }

    return [{ id: 'main', name: 'main' }];
  }, [branches]);

  const handleStartTask = (prompt: string) => {
    setInitialPrompt(prompt);
    setCurrentView('chat');
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
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

  return (
    <div className="min-h-screen bg-[#191919] text-white font-sans selection:bg-[#10a37f] selection:text-white">
      <Navbar currentView={currentView} onNavigate={setCurrentView} onOpenSettings={handleOpenSettings} />

      <main>
        {currentView === 'dashboard' ? (
          <Dashboard
            onStartTask={handleStartTask}
            showToast={showToast}
            repositories={availableRepositories}
            branches={availableBranches}
          />
        ) : null}

        {currentView === 'chat' ? (
          <ChatInterface initialPrompt={initialPrompt} onBack={() => setCurrentView('dashboard')} />
        ) : null}

        {currentView === 'settings' ? <Settings onClose={handleCloseSettings} /> : null}
      </main>

      <Toast message={toastMessage || ''} isVisible={Boolean(toastMessage)} onClose={() => setToastMessage(null)} />
    </div>
  );
}
