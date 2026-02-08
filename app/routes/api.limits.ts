import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { checkUsageLimit, resolveActor } from '~/lib/.server/node-layer';

export async function loader({ request }: LoaderFunctionArgs) {
  const actor = await resolveActor(request);
  const [chat, enhancer] = await Promise.all([checkUsageLimit(actor, 'chat'), checkUsageLimit(actor, 'enhancer')]);

  return json({
    authenticated: !actor.isAnonymous,
    userId: actor.userId,
    plan: actor.plan,
    limits: {
      chat,
      enhancer,
    },
  });
}

