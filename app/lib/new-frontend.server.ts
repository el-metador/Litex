import { resolveActor } from '~/lib/.server/node-layer';
import type { Branch, Repository } from '~/components/new-frontend/types';

export interface NewFrontendBootstrap {
  repositories: Repository[];
  branches: Branch[];
}

export async function buildNewFrontendBootstrap(request: Request): Promise<NewFrontendBootstrap> {
  const actor = await resolveActor(request);

  const owner = actor.email?.split('@')[0] || actor.userId || 'workspace';
  const repositoryName = process.env.VERCEL_GIT_REPO_SLUG || 'LiteCode';
  const activeBranch = process.env.VERCEL_GIT_COMMIT_REF || 'main';

  return {
    repositories: [
      {
        id: `${owner}-${repositoryName}`,
        owner,
        name: repositoryName,
      },
    ],
    branches: [
      {
        id: activeBranch,
        name: activeBranch,
      },
    ],
  };
}
