import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { buildNewFrontendBootstrap } from '~/lib/new-frontend.server';
import IndexRoute from './_index';

export async function loader(args: LoaderFunctionArgs) {
  const { repositories, branches } = await buildNewFrontendBootstrap(args.request);

  return json({
    id: args.params.id,
    repositories,
    branches,
  });
}

export default IndexRoute;
