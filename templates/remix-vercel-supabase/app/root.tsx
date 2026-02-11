import stylesheet from '~/styles/global.css?url';
import { json, type LinksFunction, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from '@remix-run/react';
import { getSessionUser } from '~/lib/auth.server';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: stylesheet }];

export const meta: MetaFunction = () => {
  return [
    { title: 'Remix + Supabase' },
    { name: 'description', content: 'Generated Remix app with Supabase SSR auth and Vercel deploy target.' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, headers } = await getSessionUser(request);

  return json(
    {
      user: user ? { id: user.id, email: user.email ?? null } : null,
    },
    { headers },
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="app-header">
          <div className="container">
            <strong>Generated Remix App</strong>
            <span>{data.user ? `Signed in: ${data.user.email ?? data.user.id}` : 'Anonymous session'}</span>
          </div>
        </header>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
