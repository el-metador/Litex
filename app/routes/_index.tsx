import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { NewFrontendApp } from '~/components/new-frontend/NewFrontendApp.client';
import { buildNewFrontendBootstrap } from '~/lib/new-frontend.server';

export const meta: MetaFunction = () => {
  return [
    { title: 'LiteCode - AI Workspace' },
    {
      name: 'description',
      content: 'LiteCode workspace with dashboard, chat, and settings for AI-assisted development.',
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { repositories, branches } = await buildNewFrontendBootstrap(request);

  return json({ repositories, branches });
}

export default function Index() {
  const data = useLoaderData<{
    repositories: Array<{ id: string; name: string; owner: string }>;
    branches: Array<{ id: string; name: string }>;
  }>();

  return <NewFrontendApp repositories={data.repositories} branches={data.branches} />;
}
