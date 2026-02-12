import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/node';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { AuthBootstrap } from './components/auth/AuthBootstrap.client';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';
import { MotionProvider } from './components/ui/MotionProvider';
import { PageTransition } from './components/ui/PageTransition';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('litecode_theme') || localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = 'dark';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <AuthBootstrap />}</ClientOnly>
      {children}
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export default function App() {
  return (
    <MotionProvider>
      <PageTransition>
        <Outlet />
      </PageTransition>
    </MotionProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  console.error('Root route error', error);

  let title = 'Application Error';
  let message = 'An unexpected error occurred. Check browser console for details.';

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = typeof error.data === 'string' ? error.data : message;
  } else if (error instanceof Error) {
    message = error.message || message;
  }

  return (
    <main className="flex h-full w-full items-center justify-center bg-bolt-elements-background-depth-1 p-4">
      <section className="w-full max-w-2xl rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6 text-bolt-elements-textPrimary">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-bolt-elements-textSecondary">{message}</p>
        {import.meta.env.DEV && error instanceof Error && error.stack ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-bolt-elements-background-depth-1 p-3 text-xs">
            {error.stack}
          </pre>
        ) : null}
      </section>
    </main>
  );
}
