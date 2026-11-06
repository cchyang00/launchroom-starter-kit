import {Form, Link, useActionData, useLoaderData, useNavigation} from 'react-router';
import type {Route} from './+types/track';
import {SupportShell} from '~/components/SupportShell';
import {TrustSignals} from '~/components/SupportCenter';
import {useActiveProduct, withProductParam} from '~/content/navigation';
import {SUPPORT_EMAIL, SUPPORT_REPLY_TIME} from '~/content/site';
import {
  LIMITS,
  REPLIES,
  clientIp,
  createRateLimiter,
  lookupOrder,
  sameOrigin,
  sessionAllows,
  trackingConfigured,
  type ChatEnv,
  type Tracking,
} from '~/lib/help-chat.server';

/**
 * Track my order (October 2). The same server lookup as the help chat:
 * order number plus the email used at checkout, answered only when the email
 * matches (lookupOrder). Until SHOPIFY_ADMIN_ORDERS_TOKEN and
 * SHOPIFY_ADMIN_STORE_DOMAIN are set, it says the lookup is coming online and
 * points to support@merrivy.com. Works without JavaScript (a plain form post).
 */
export const meta = () => [{title: 'Track my order | Merrivy'}];

const WINDOW = 15 * 60 * 1000;
const perIp = createRateLimiter(LIMITS.lookupsPer15Min, WINDOW);

function comingOnline() {
  return `Tracking lookup is coming online — email ${SUPPORT_EMAIL} with your order number and we’ll reply within ${SUPPORT_REPLY_TIME}.`;
}

export async function loader({context}: Route.LoaderArgs) {
  return {ready: trackingConfigured(context.env as Env & ChatEnv)};
}

type TrackResult = {
  kind: 'found' | 'not-found' | 'unavailable' | 'limited';
  reply: string;
  order?: string;
  tracking?: Tracking[];
  statusUrl?: string | null;
};

export async function action({request, context}: Route.ActionArgs) {
  const env = context.env as Env & ChatEnv;
  if (!sameOrigin(request))
    return {kind: 'unavailable', reply: REPLIES.lookupUnavailable} as TrackResult;
  if (!trackingConfigured(env))
    return {kind: 'unavailable', reply: comingOnline()} as TrackResult;
  const form = await request.formData();
  if (
    !perIp.hit(clientIp(request)) ||
    !sessionAllows(context.session, 'trackLookup', LIMITS.lookupsPer15Min, WINDOW)
  )
    return {
      kind: 'limited',
      reply: `That’s a lot of lookups in a short time. Please try again in a few minutes, or email ${SUPPORT_EMAIL}.`,
    } as TrackResult;
  const result = await lookupOrder({
    orderNumber: form.get('order'),
    email: form.get('email'),
    env,
  });
  return (
    result.kind === 'found'
      ? {
          kind: 'found',
          reply: result.reply,
          order: result.order,
          tracking: result.tracking,
          statusUrl: result.statusUrl,
        }
      : {kind: result.kind, reply: result.reply}
  ) as TrackResult;
}

export default function TrackPage() {
  const {ready} = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>() as TrackResult | undefined;
  const busy = useNavigation().state === 'submitting';
  const {productPath} = useActiveProduct();
  return (
    <SupportShell
      eyebrow="Track my order"
      title={
        <>
          Where’s my
          <br />
          <em>order?</em>
        </>
      }
      intro="Enter your order number and the email you used at checkout."
    >
      {!ready && (
        <p className="track-notice" role="status">
          {comingOnline()}
        </p>
      )}
      <Form method="post" className="track-form" replace>
        <label>
          Order number
          <input
            name="order"
            required
            maxLength={24}
            placeholder="#1001"
            autoComplete="off"
            defaultValue={result?.order ?? ''}
          />
        </label>
        <label>
          Email used at checkout
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            inputMode="email"
            autoComplete="email"
          />
        </label>
        <button type="submit" className="button-primary" disabled={busy}>
          {busy ? 'Looking it up…' : 'Track my order'}
        </button>
      </Form>
      {/* Before the lookup is live, the note above already says it all. */}
      {result && (ready || result.kind !== 'unavailable') && (
        <section
          className={`track-result is-${result.kind}`}
          role="status"
          aria-live="polite"
        >
          <p>{result.reply}</p>
          {result.tracking?.length ? (
            <ul>
              {result.tracking.map((t) => (
                <li key={`${t.number}-${t.url}`}>
                  <span>{[t.company, t.number].filter(Boolean).join(' · ')}</span>
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noopener noreferrer">
                      Follow the parcel ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {result.statusUrl && (
            <a
              className="text-link"
              href={result.statusUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              See your full order status on Shopify ↗
            </a>
          )}
        </section>
      )}
      <section className="track-help">
        <h2>Good to know.</h2>
        <p>
          Your order confirmation email has a <strong>View your order</strong>{' '}
          button. It opens Shopify’s order status page for your order, with
          tracking once it ships.
        </p>
        <p>
          When your order ships, we email you its tracking link. Allow up to two
          business days for the carrier’s first scan.{' '}
          <Link to={withProductParam('/delivery', productPath)}>
            Delivery details ↗
          </Link>
        </p>
        <p>
          Still stuck? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your order
          number. We reply within {SUPPORT_REPLY_TIME}.
        </p>
      </section>
      <TrustSignals />
    </SupportShell>
  );
}
