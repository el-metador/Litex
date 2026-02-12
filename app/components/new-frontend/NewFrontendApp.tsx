import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useLocation, useNavigate } from '@remix-run/react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';
import { authStore } from '~/lib/stores/auth';
import { AppLayout } from './AppLayout';
import { Dashboard } from './Dashboard';
import { ChatInterface } from './ChatInterface';
import { Navbar } from './Navbar';
import { Settings } from './Settings';
import { Toast } from './Toast';
import type { Branch, Repository, ViewState } from './types';

interface NewFrontendAppProps {
  repositories: Repository[];
  branches: Branch[];
}

export function NewFrontendApp({ repositories, branches }: NewFrontendAppProps) {
  const auth = useStore(authStore);
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const isChatRoute = location.pathname.startsWith('/chat/');
  const [currentView, setCurrentView] = useState<ViewState>(isChatRoute ? 'chat' : 'dashboard');
  const [previousView, setPreviousView] = useState<ViewState>(isChatRoute ? 'chat' : 'dashboard');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeView = currentView === 'settings' ? previousView : currentView;

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
    navigate('/', { replace: true });
  };

  const handleOpenChatSession = (sessionId: string) => {
    if (!sessionId.trim()) {
      return;
    }

    setInitialPrompt('');
    setCurrentView('chat');
    navigate(`/chat/${sessionId}`);
  };

  const handleOpenSettings = () => {
    if (currentView === 'settings') {
      return;
    }

    setPreviousView(activeView);
    setCurrentView('settings');
  };

  const handleCloseSettings = () => {
    setCurrentView(previousView);
  };

  const handleNavigate = (view: ViewState) => {
    if (view === 'settings') {
      handleOpenSettings();
      return;
    }

    setCurrentView(view);

    if (view === 'chat' && isChatRoute) {
      return;
    }

    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (isChatRoute && activeView !== 'chat') {
      if (currentView === 'settings') {
        setPreviousView('chat');
      } else {
        setCurrentView('chat');
      }
    }

    if (auth.status !== 'authenticated' && activeView === 'chat') {
      if (currentView === 'settings') {
        setPreviousView('dashboard');
      } else {
        setCurrentView('dashboard');
      }

      navigate('/', { replace: true });
    }
  }, [activeView, auth.status, currentView, isChatRoute, navigate]);

  const viewVariants = reduceMotion ? motionVariants.pageReduced : motionVariants.page;

  return (
    <AppLayout
      navbar={<Navbar currentView={activeView} onNavigate={handleNavigate} onOpenSettings={handleOpenSettings} />}
      overlays={
        <AnimatePresence initial={false} mode="wait">
          {currentView === 'settings' ? <Settings key="settings" onClose={handleCloseSettings} /> : null}
        </AnimatePresence>
      }
      toast={<Toast message={toastMessage || ''} isVisible={Boolean(toastMessage)} onClose={() => setToastMessage(null)} />}
    >
      <AnimatePresence initial={false} mode="wait">
        {activeView === 'dashboard' ? (
          <m.section
            key="dashboard"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="ui-motion-layer"
          >
            <Dashboard
              onStartTask={handleStartTask}
              onOpenChatSession={handleOpenChatSession}
              showToast={showToast}
              repositories={repositories}
              branches={branches}
            />
          </m.section>
        ) : (
          <m.section
            key={`chat-${location.pathname}`}
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="ui-motion-layer"
          >
            <ChatInterface
              initialPrompt={initialPrompt}
              onConsumeInitialPrompt={() => setInitialPrompt('')}
              onBack={() => {
                setInitialPrompt('');
                setCurrentView('dashboard');
                navigate('/', { replace: true });
              }}
              onToast={showToast}
            />
          </m.section>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
