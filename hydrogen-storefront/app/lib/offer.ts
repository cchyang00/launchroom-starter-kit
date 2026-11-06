import {useEffect, useState} from 'react';

/**
 * Offer terms live in the product packet so copy, prices, cart and policy
 * pages all read one source. Rules that keep offers honest:
 * - a sale shows only while its configured end date is in the future;
 * - outside the demo, the "was" price must come from Shopify's compareAtPrice;
 * - the price a shopper pays is always the Shopify price the cart charges.
 */
export type OfferConfig = {
  status: 'demo' | 'live' | string;
  currency: string;
  freeShippingOver: number;
  shippingFee: number;
  announcements: string[];
  sale?: {label: string; percentOff: number; endsAt: string; note?: string};
  signup?: {
    eyebrow: string;
    heading: string;
    text: string;
    cta: string;
    success: string;
    fineprint: string;
  };
};

export type ThemeConfig = {
  paper: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  /** Readable shade of the accent for text on paper. */
  accentText?: string;
  /** Text colour on accent fills (buttons, deal bar). */
  onAccent?: string;
  highlight: string;
  shade: string;
};

export {fillOfferText, fillPacketText} from '~/content/templates';

export function saleActive(offer?: OfferConfig, now = Date.now()) {
  const sale = offer?.sale;
  if (!sale?.percentOff || sale.percentOff <= 0 || sale.percentOff >= 100)
    return false;
  const end = Date.parse(sale.endsAt);
  return Number.isFinite(end) && end > now;
}

/** Offers render on the demo, or once the owner marks them live in Shopify. */
export function offerVisible(offer: OfferConfig | undefined, isSample: boolean) {
  return Boolean(offer && (isSample || offer.status === 'live'));
}

/**
 * The reference ("was") price for one unit. Shopify's compareAtPrice wins.
 * The demo derives one from the configured sale so the page can be reviewed;
 * it is labeled as demo content and never used for a real store.
 */
export function compareAtFor({
  price,
  shopifyCompareAt,
  offer,
  isSample,
}: {
  price: number;
  shopifyCompareAt?: number | null;
  offer?: OfferConfig;
  isSample: boolean;
}) {
  if (shopifyCompareAt && shopifyCompareAt > price) return shopifyCompareAt;
  if (isSample && saleActive(offer) && offer?.sale)
    return Math.round((price / (1 - offer.sale.percentOff / 100)) * 100) / 100;
  return null;
}

export const percentSaved = (price: number, compareAt: number) =>
  Math.round((1 - price / compareAt) * 100);

export function themeStyle(theme?: Partial<ThemeConfig>) {
  if (!theme) return undefined;
  const map: Record<string, string | undefined> = {
    '--paper': theme.paper,
    '--ink': theme.ink,
    '--muted': theme.muted,
    '--line': theme.line,
    '--orange': theme.accent,
    '--accent-text': theme.accentText,
    '--on-accent': theme.onAccent,
    '--yellow': theme.highlight,
    '--shade': theme.shade,
  };
  return Object.fromEntries(
    Object.entries(map).filter(([, value]) => Boolean(value)),
  ) as React.CSSProperties;
}

/** Remaining time, rendered only after hydration so server and client agree. */
export function useCountdown(endsAt?: string) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!endsAt) return;
    const end = Date.parse(endsAt);
    if (!Number.isFinite(end)) return;
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) return setLabel('');
      const days = Math.floor(left / 86_400_000);
      const hours = Math.floor((left % 86_400_000) / 3_600_000);
      const minutes = Math.floor((left % 3_600_000) / 60_000);
      const seconds = Math.floor((left % 60_000) / 1000);
      setLabel(
        days > 0
          ? `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
          : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return label;
}
