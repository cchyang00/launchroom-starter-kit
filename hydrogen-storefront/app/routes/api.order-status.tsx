import type {Route} from './+types/api.order-status';
import {
  LIMITS,
  REPLIES,
  chatEnabled,
  clientIp,
  createRateLimiter,
  lookupOrder,
  sameOrigin,
  sessionAllows,
  type ChatEnv,
} from '~/lib/help-chat.server';

/**
 * POST /api/order-status {orderNumber, email}: the help chat's order lookup.
 * Answers only when the email matches the order (see lookupOrder). Without
 * SHOPIFY_ADMIN_ORDERS_TOKEN it says it can't look orders up right now.
 * 404 while the chat is off.
 */
const WINDOW = 15 * 60 * 1000;
const perIp = createRateLimiter(LIMITS.lookupsPer15Min, WINDOW);

export async function loader() {
  throw new Response('Not found', {status: 404});
}

export async function action({request, context}: Route.ActionArgs) {
  const env = context.env as Env & ChatEnv;
  if (!chatEnabled(env)) return Response.json({error: 'off'}, {status: 404});
  if (request.method !== 'POST' || !sameOrigin(request))
    return Response.json({reply: REPLIES.lookupUnavailable}, {status: 403});
  let body: {orderNumber?: unknown; email?: unknown};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({reply: REPLIES.notFound}, {status: 400});
  }
  if (
    !perIp.hit(clientIp(request)) ||
    !sessionAllows(context.session, 'helpChatLookup', LIMITS.lookupsPer15Min, WINDOW)
  )
    return Response.json({reply: REPLIES.rateLimited}, {status: 429});
  const result = await lookupOrder({
    orderNumber: body?.orderNumber,
    email: body?.email,
    env,
  });
  return Response.json(
    result.kind === 'found'
      ? {reply: result.reply, tracking: result.tracking, statusUrl: result.statusUrl}
      : {reply: result.reply},
    {status: result.kind === 'unavailable' ? 503 : 200},
  );
}
