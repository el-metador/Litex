import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

type ErudaApi = {
  init: () => void;
};

type LitecodeWindow = Window & {
  __litecodeErrorHandlers?: boolean;
  __litecodeErudaLoaded?: boolean;
  eruda?: ErudaApi;
};

if (typeof window !== 'undefined') {
  const runtimeWindow = window as LitecodeWindow;

  if (!runtimeWindow.__litecodeErrorHandlers) {
    window.addEventListener('error', (event) => {
      console.error('[GlobalError]', event.error ?? event.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[UnhandledRejection]', event.reason);
    });

    runtimeWindow.__litecodeErrorHandlers = true;
  }

  initEruda(runtimeWindow);
}

function initEruda(runtimeWindow: LitecodeWindow) {
  try {
    const params = new URLSearchParams(window.location.search);
    const erudaFromQuery = params.get('eruda');

    if (erudaFromQuery === '1') {
      localStorage.setItem('litecode_eruda', '1');
    } else if (erudaFromQuery === '0') {
      localStorage.removeItem('litecode_eruda');
    }

    const erudaEnabled = erudaFromQuery === '1' || localStorage.getItem('litecode_eruda') === '1';

    if (!erudaEnabled || runtimeWindow.__litecodeErudaLoaded) {
      return;
    }

    runtimeWindow.__litecodeErudaLoaded = true;

    if (runtimeWindow.eruda) {
      runtimeWindow.eruda.init();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.async = true;
    script.onload = () => {
      try {
        runtimeWindow.eruda?.init();
      } catch (error) {
        console.error('[Eruda] init failed', error);
      }
    };
    script.onerror = () => {
      runtimeWindow.__litecodeErudaLoaded = false;
      console.error('[Eruda] script load failed');
    };

    document.head.appendChild(script);
  } catch (error) {
    console.error('[Eruda] bootstrap failed', error);
  }
}

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});
