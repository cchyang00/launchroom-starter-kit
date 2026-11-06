import type {Route} from './+types/api.help-chat';
import {campaign} from '~/content/templates';
import {helpChatKnowledge} from '~/lib/help-chat-knowledge';
import {
  LIMITS,
  REPLIES,
  answerFromKnowledge,
  askOpenRouter,
  chatEnabled,
  cleanConversation,
  clientIp,
  createRateLimiter,
  sameOrigin,
  sessionAllows,
  type ChatEnv,
} from '~/lib/help-chat.server';
import {isSampleCatalog} from '~/lib/store-policies';

/**
 * POST /api/help-chat: one question to the help chat (see
 * app/lib/help-chat.server.ts). 404 while the chat is off.
 */
const HOUR = 60 * 60 * 1000;
const perIp = createRateLimiter(LIMITS.chatPerHour, HOUR);

export async function loader() {
  throw new Response('Not found', {status: 404});
}

export async function action({request, context}: Route.ActionArgs) {
  const env = context.env as Env & ChatEnv;
  if (!chatEnabled(env)) return Response.json({error: 'off'}, {status: 404});
  if (request.method !== 'POST' || !sameOrigin(request))
    return Response.json({reply: REPLIES.unavailable}, {status: 403});
  let body: {messages?: unknown};
  try {
    body = (await request.json()) as {messages?: unknown};
  } catch {
    return Response.json({reply: REPLIES.unavailable}, {status: 400});
  }
  const cleaned = cleanConversation(body?.messages);
  if (!cleaned.ok)
    return Response.json({reply: cleaned.reply}, {status: cleaned.status});
  if (
    !perIp.hit(clientIp(request)) ||
    !sessionAllows(context.session, 'helpChat', LIMITS.chatPerHour, HOUR)
  )
    return Response.json({reply: REPLIES.rateLimited}, {status: 429});
  const knowledge = helpChatKnowledge(
    campaign,
    isSampleCatalog(env.PUBLIC_STORE_DOMAIN),
  );
  const result = env.OPENROUTER_API_KEY?.trim()
    ? await askOpenRouter({
        apiKey: env.OPENROUTER_API_KEY as string,
        knowledge,
        messages: cleaned.messages,
        siteUrl: new URL(request.url).origin,
      })
    : answerFromKnowledge(cleaned.messages, knowledge);
  return Response.json(
    {reply: result.reply, track: result.kind === 'track'},
    {status: result.kind === 'error' ? 502 : 200},
  );
}
