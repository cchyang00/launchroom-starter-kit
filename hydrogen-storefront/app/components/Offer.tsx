import {useEffect, useId, useState} from 'react';
import {useLocation} from 'react-router';
import {campaign} from '~/content/templates';
import {packetForPathname, useActiveProduct} from '~/content/navigation';
import {
  compareAtFor,
  offerVisible,
  percentSaved,
  saleActive,
  useCountdown,
  type OfferConfig,
} from '~/lib/offer';
import {Icon} from './Icons';
import {fillSupport, useSupportFlags} from './SupportCenter';
import {moneyLocale} from '~/lib/money';

const offerOf = (pathname = '/') =>
  (packetForPathname(pathname).offer ?? campaign.offer) as OfferConfig | undefined;

function useActiveOffer(productPath?: string) {
  const {activePacket} = useActiveProduct();
  if (productPath) return offerOf(productPath);
  return (activePacket.offer ?? campaign.offer) as OfferConfig | undefined;
}
const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat(moneyLocale(currency), {style: 'currency', currency}).format(value);

/** Rotating announcement bar. Pauses on hover/focus; static for reduced motion. */
export function OfferBar({
  isSample,
  productPath,
}: {
  isSample: boolean;
  productPath?: string;
}) {
  const {chat} = useSupportFlags();
  const offer = useActiveOffer(productPath);
  const messages = offer?.announcements ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const countdown = useCountdown(
    saleActive(offer) ? offer?.sale?.endsAt : undefined,
  );
  useEffect(() => {
    if (paused || messages.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(
      () => setIndex((value) => (value + 1) % messages.length),
      4500,
    );
    return () => clearInterval(timer);
  }, [paused, messages.length]);
  if (!offerVisible(offer, isSample) || !messages.length) return null;
  // A sale message is dropped once its end date passes.
  const live = messages.filter(
    (text) => saleActive(offer) || !/%|off\b/i.test(text),
  );
  if (!live.length) return null;
  const current = fillSupport(live[index % live.length], chat);
  return (
    <section
      className="offer-bar"
      aria-label="Current offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {live.length > 1 && (
        <button
          type="button"
          aria-label="Previous offer"
          onClick={() =>
            setIndex((value) => (value - 1 + live.length) % live.length)
          }
        >
          <Icon name="chevron-left" size={14} />
        </button>
      )}
      <p key={current} className="offer-bar-message">
        {current}
        {countdown && /%|off\b/i.test(current) && (
          <span className="offer-bar-timer">Ends in {countdown}</span>
        )}
      </p>
      {live.length > 1 && (
        <button
          type="button"
          aria-label="Next offer"
          onClick={() => setIndex((value) => (value + 1) % live.length)}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      )}
    </section>
  );
}

/** Price with reference price, savings badge and a real-deadline countdown. */
export function SalePrice({
  amount,
  currency,
  shopifyCompareAt,
  isSample,
  size = 'large',
}: {
  amount: number;
  currency: string;
  shopifyCompareAt?: number | null;
  isSample: boolean;
  size?: 'large' | 'small';
}) {
  const offer = useActiveOffer();
  const compareAt = compareAtFor({
    price: amount,
    shopifyCompareAt,
    offer: offerVisible(offer, isSample) ? offer : undefined,
    isSample,
  });
  const fromSale = Boolean(compareAt && !shopifyCompareAt);
  const countdown = useCountdown(fromSale ? offer?.sale?.endsAt : undefined);
  return (
    <span className={`sale-price is-${size}`}>
      <strong>{formatMoney(amount, currency)}</strong>
      {compareAt && (
        <>
          <s aria-label={`Was ${formatMoney(compareAt, currency)}`}>
            {formatMoney(compareAt, currency)}
          </s>
          <em className="sale-badge">
            Save {percentSaved(amount, compareAt)}%
          </em>
        </>
      )}
      {size === 'large' && fromSale && offer?.sale && (
        <span className="sale-deadline">
          <Icon name="clock" size={14} />
          {offer.sale.label}
          {countdown ? <b>Ends in {countdown}</b> : null}
        </span>
      )}
    </span>
  );
}

/** Progress toward the configured free-shipping threshold. */
export function FreeShippingMeter({
  subtotal,
  currency,
  isSample,
  unlocked,
  thresholdOverride,
}: {
  subtotal: number;
  currency: string;
  isSample: boolean;
  unlocked?: boolean;
  thresholdOverride?: number;
}) {
  const offer = useActiveOffer();
  if (!offerVisible(offer, isSample) || offer?.freeShippingOver === undefined)
    return null;
  const threshold = thresholdOverride ?? Math.max(offer.freeShippingOver, 60);
  const isUnlocked =
    unlocked !== undefined
      ? unlocked
      : threshold <= 0 || subtotal >= threshold;
  const left = isUnlocked ? 0 : Math.max(0.01, threshold - subtotal);
  const isAlmostThere = !isUnlocked && left <= 15;
  const ratio = isUnlocked
    ? 1
    : Math.min(0.92, Math.max(0.18, subtotal / threshold));
  return (
    <div
      className={`free-ship-meter ${isUnlocked ? 'is-unlocked' : ''} ${isAlmostThere ? 'is-almost-there' : ''}`}
    >
      <p>
        <Icon name="truck" size={16} />
        {isUnlocked ? (
          <span>
            <strong>
              🎉 You&rsquo;ve unlocked FREE Tracked Shipping (Saved $7.99)!
            </strong>
          </span>
        ) : isAlmostThere ? (
          <span>
            <strong>
              🔥 Almost there! You&rsquo;re only {formatMoney(left, currency)}{' '}
              away from FREE Shipping
            </strong>{' '}
            · add 1 more item below (so you don&rsquo;t pay $7.99 for shipping)
            and your whole order ships FREE!
          </span>
        ) : (
          <span>
            <strong>
              🚚 You&rsquo;re {formatMoney(left, currency)} away from FREE
              Tracked Shipping (Save $7.99)!
            </strong>
          </span>
        )}
      </p>
      {!isUnlocked && !isAlmostThere && (
        <small className="free-ship-sub">
          Don&rsquo;t waste $7.99 on shipping · upgrade to the{' '}
          <strong>2-Pack Bundle</strong> OR add{' '}
          <strong>companion items below</strong> to ship your entire order FREE:
        </small>
      )}
      <span
        className="free-ship-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label="Progress to free shipping"
      >
        <i style={{width: `${ratio * 100}%`}} />
      </span>
    </div>
  );
}

/** Savings against the reference price, shown in the bag. */
export function CartSavings({
  subtotal,
  currency,
  isSample,
}: {
  subtotal: number;
  currency: string;
  isSample: boolean;
}) {
  const offer = useActiveOffer();
  if (!isSample || !saleActive(offer) || !offer?.sale || subtotal <= 0)
    return null;
  const saved =
    subtotal / (1 - offer.sale.percentOff / 100) - subtotal;
  return (
    <p className="cart-savings">
      <Icon name="check" size={15} />
      {offer.sale.label} price · you save{' '}
      <strong>{formatMoney(saved, currency)}</strong>
    </p>
  );
}

/**
 * Email signup with a welcome incentive. The sample-catalog build never
 * sends or stores the address, and says so when the form is sent. A live store needs a connected list (Shopify Email, Klaviyo) and
 * a real discount before this is switched on.
 */
export function SignupOffer({
  isSample,
  variant,
}: {
  isSample: boolean;
  variant: 'band' | 'popup';
}) {
  const offer = useActiveOffer();
  const signup = offer?.signup;
  const visible = offerVisible(offer, isSample);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);
  const id = useId();
  // Never on first load: the card waits until the shopper has scrolled past
  // the first screen (the hero's Add to bag is out of view and the sticky
  // bar, which the card sits above, has taken over). After it is closed or
  // used it stays away for a week.
  useEffect(() => {
    if (variant !== 'popup' || !visible || !signup) return;
    if (recentlySeen()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      if (document.querySelector('dialog[open]')) return;
      if (window.scrollY < window.innerHeight) return;
      setOpen(true);
      cleanup();
    };
    const onScroll = () => {
      const depth =
        window.scrollY / Math.max(1, document.body.scrollHeight - innerHeight);
      if (depth > 0.45) show();
    };
    // After 25 seconds, show now or at the next scroll past the first screen.
    timer = setTimeout(() => {
      timer = undefined;
      show();
      window.addEventListener('scroll', show, {passive: true});
    }, 25000);
    window.addEventListener('scroll', onScroll, {passive: true});
    function cleanup() {
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', show);
    }
    return cleanup;
  }, [variant, visible, signup]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!open || !sent) return;
    const timer = setTimeout(() => setOpen(false), 4000);
    return () => clearTimeout(timer);
  }, [open, sent]);
  if (!signup || !visible) return null;
  function dismiss() {
    setOpen(false);
    rememberSeen();
  }
  const form = (
    <form
      className="signup-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
        if (variant === 'popup') rememberSeen();
      }}
    >
      {sent ? (
        <p className="signup-success" role="status">
          <Icon name="check" size={16} />
          {signup.success || 'You’re on the list! Watch your inbox for our next release.'}
        </p>
      ) : (
        <>
          <label className="sr-only" htmlFor={id}>
            Email address
          </label>
          <input
            id={id}
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
          <button className="button-primary" type="submit">
            {signup.cta}
          </button>
        </>
      )}
      <small>
        {signup.fineprint}
      </small>
      {variant === 'popup' && !sent && (
        <button type="button" className="signup-no-thanks" onClick={dismiss}>
          No thanks
        </button>
      )}
    </form>
  );
  if (variant === 'band')
    return (
      <section className="signup-band" aria-labelledby={`${id}-title`}>
        <div>
          <span className="eyebrow">{signup.eyebrow}</span>
          <h2 id={`${id}-title`}>{signup.heading}</h2>
          <p>{signup.text}</p>
        </div>
        {form}
      </section>
    );
  if (!open) return null;
  return (
    <aside
      className="signup-pop"
      aria-labelledby={`${id}-pop`}
      role="dialog"
      aria-modal="false"
    >
      <button
        type="button"
        className="signup-close"
        aria-label="Close offer"
        onClick={dismiss}
      >
        <Icon name="close" size={16} />
      </button>
      <span className="eyebrow">{signup.eyebrow}</span>
      <h2 id={`${id}-pop`}>{signup.heading}</h2>
      <p>{signup.text}</p>
      {form}
    </aside>
  );
}

const SIGNUP_SEEN_KEY = 'merrivy.signup.dismissed';
const SIGNUP_QUIET_DAYS = 7;

/** True when the pop-up was closed or used within the last week. */
function recentlySeen() {
  try {
    const saved = localStorage.getItem(SIGNUP_SEEN_KEY);
    if (!saved) return false;
    const at = Number(saved);
    // Older builds saved '1': treat that as just seen.
    if (!Number.isFinite(at) || at < 1e12) return true;
    return Date.now() - at < SIGNUP_QUIET_DAYS * 86400000;
  } catch {
    // Storage blocked: at most once per page view.
    return false;
  }
}

function rememberSeen() {
  try {
    localStorage.setItem(SIGNUP_SEEN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
