# Help chat and order tracking: where the keys go

*October 2, 2026. Job store-nav-chat-2026-10-02.*

merrivy.com has a help chat (bottom-right bubble) and a Track my order page (/track). The chat answers only from our own content: the product packet's FAQ, specs and guarantee, the Delivery and Returns terms, and support@merrivy.com. It never quotes discounts, delivery dates, health claims or order details. Order lookups never go through the AI.

Agents never see or type these values. **You paste them yourself** in two places:

1. **Shopify Oxygen** (the live site): Shopify admin → Sales channels → Hydrogen → the Merrivy storefront → Storefront settings → **Environment variables**. Add each one to the **Production** environment, then redeploy (the manager deploys).
2. **Your local `.env`** in `hydrogen-storefront/` (only if you want the chat on the :3001 dev server). `.env` is git-ignored; `.env.example` lists the names with empty values.

| Variable | What it does | Needed for |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Your OpenRouter key. **With it set, the chat is live.** Model `openai/gpt-6-luna`. | The chat |
| `MERRIVY_CHAT` | Optional kill switch. Set it to `off` to hide the chat without removing the key. Leave it unset otherwise. | Turning the chat off |
| `SHOPIFY_ADMIN_ORDERS_TOKEN` | A Shopify Admin API access token with **read_orders only**. Make it in Shopify admin → Settings → Apps and sales channels → Develop apps → Create an app → Configure Admin API scopes → tick `read_orders` only → Install → reveal the Admin API access token once. | Order tracking in the chat and on /track |
| `SHOPIFY_ADMIN_STORE_DOMAIN` | `ndfdtc-br.myshopify.com` (not a secret). | Order tracking |

**Until the two Shopify values are set,** the chat says "I can’t look that up right now — email support@merrivy.com." and /track says "Tracking lookup is coming online — email support@merrivy.com with your order number and we’ll reply within one business day." If lookups find orders but never match an email, the app may need protected customer data access for the order email (Develop apps → the app → API access → Protected customer data); until then every lookup safely returns "couldn't find an order".

## Sample catalog vs real store (changed October 2)

The site shows the sample catalog unless `MERRIVY_LIVE` is `true`. Deploys no longer need `--env-file .env.demo`: that file **replaced** Oxygen's variables, so the chat's key was dropped and the chat stayed off. Deploy with:

```
npx shopify hydrogen deploy --env production --force --metadata-description "..." --no-json-output
```

When the real store opens, add `MERRIVY_LIVE` = `true` to Production. `MERRIVY_DEMO` = `true` still forces the sample catalog.

## What keeps cost and abuse small

- Calls go from the server only; the browser never sees a key.
- 20 chat messages an hour per IP and per browser session; 5 order lookups per 15 minutes.
- 500 characters per message, the last 10 messages (4,000 characters) of history, 300-token replies, 20 shopper messages per conversation.
- Posts from other websites are refused.
- An order shows only when the email matches it. A wrong email and a missing order get the same reply, so nobody can probe order numbers.

## Editable copy

The support email, the reply time ("one business day") and the one-line brand promise live in `hydrogen-storefront/app/content/site.json` under `support`. "24/7 support" shows only while the chat is live; otherwise the site says "Fast, friendly support".

Code: `app/lib/help-chat.server.ts` (limits, model, lookup), `app/lib/help-chat-knowledge.ts` (what the chat knows), `app/components/HelpChat.tsx`, `app/routes/api.help-chat.tsx`, `app/routes/api.order-status.tsx`, `app/routes/track.tsx`. Tests: `npm run test:help-chat`.
