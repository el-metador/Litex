import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { resolveActor } from '~/lib/.server/node-layer';

export async function loader({ request }: LoaderFunctionArgs) {
  const actor = await resolveActor(request);

  return json({
    authenticated: !actor.isAnonymous,
    userId: actor.userId,
    email: actor.email ?? null,
    plan: actor.plan,
  });
}

