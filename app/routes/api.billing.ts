import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { getBillingSnapshot, resolveActor } from '~/lib/.server/node-layer';

export async function loader({ request }: LoaderFunctionArgs) {
  const actor = await resolveActor(request);
  const billing = await getBillingSnapshot(actor);

  return json({
    authenticated: !actor.isAnonymous,
    userId: actor.userId,
    billing,
  });
}

