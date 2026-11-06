import {useEffect, useState} from 'react';
import {useLocation, useRouteLoaderData} from 'react-router';
import {
  campaign,
  featureItems,
  getPacketByHandle,
  howToUseSteps,
  pullQuotesContent,
  reviewCards,
  type CampaignPacket,
} from './templates';

export type NavItem = {to: string; label: string};

/**
 * Where "Shop" and every product link go by default: always `/products/<handle>`,
 * never bare `/`.
 */
export const SHOP_URL = '/products/the-witching-hour-2027-weekly-planner';

export const ACTIVE_PRODUCT_COOKIE = 'merrivy_active_product';

/** Normalize a candidate path or handle to `/products/<handle>` when it matches a valid packet. */
export function normalizeProductPath(candidate?: string | null): string {
  if (!candidate) return '';
  const raw = decodeURIComponent(candidate.trim());
  const match = raw.match(/^\/products\/([^/?#]+)/i);
  const handle = match?.[1]
    ? match[1]
    : raw.replace(/^\/+/, '').split(/[/?#]/)[0];
  if (!handle) return '';
  const found = getPacketByHandle(handle);
  if (!found) return '';
  return found.productUrl?.startsWith('/products/')
    ? found.productUrl
    : `/products/${handle}`;
}

/** Read `merrivy_active_product` from a Cookie header string. */
export function parseActiveProductCookie(cookieHeader?: string | null): string {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === ACTIVE_PRODUCT_COOKIE) {
      const value = rest.join('=').trim();
      const normalized = normalizeProductPath(value);
      if (normalized) return normalized;
    }
  }
  return '';
}

/**
 * Resolve the active `/products/<handle>` path on the server from:
 * 1. Current URL `/products/<handle>`
 * 2. Current URL `?product=<handle>`
 * 3. `Referer` header `/products/<handle>` or `?product=<handle>`
 * 4. `merrivy_active_product` cookie
 * 5. Fallback `SHOP_URL` (`/products/the-witching-hour-2027-weekly-planner`)
 */
export function resolveActiveProductPath(request: Request): string {
  try {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/products/')) {
      const fromPath = normalizeProductPath(url.pathname);
      if (fromPath) return fromPath;
    }
    const queryProduct = url.searchParams.get('product');
    if (queryProduct) {
      const fromQuery = normalizeProductPath(queryProduct);
      if (fromQuery) return fromQuery;
    }
    const referer = request.headers.get('Referer') || request.headers.get('referer');
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.pathname.startsWith('/products/')) {
          const fromRefPath = normalizeProductPath(refUrl.pathname);
          if (fromRefPath) return fromRefPath;
        }
        const refQueryProduct = refUrl.searchParams.get('product');
        if (refQueryProduct) {
          const fromRefQuery = normalizeProductPath(refQueryProduct);
          if (fromRefQuery) return fromRefQuery;
        }
      } catch {}
    }
    const fromCookie = parseActiveProductCookie(
      request.headers.get('Cookie') || request.headers.get('cookie'),
    );
    if (fromCookie) return fromCookie;
  } catch {}
  return SHOP_URL;
}

/** Build the `Set-Cookie` header value that locks the active product for 30 days. */
export function buildActiveProductCookie(productPathOrHandle: string): string {
  const normalized = normalizeProductPath(productPathOrHandle) || SHOP_URL;
  return `${ACTIVE_PRODUCT_COOKIE}=${encodeURIComponent(normalized)}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

/** Resolve the active packet for the current URL pathname or handle. */
export function packetForPathname(pathnameOrHandle: string): CampaignPacket {
  const match = pathnameOrHandle.match(/^\/products\/([^/?#]+)/i);
  const candidate = match?.[1]
    ? decodeURIComponent(match[1])
    : pathnameOrHandle.replace(/^\/+/, '').split(/[/?#]/)[0];
  if (candidate) {
    const found = getPacketByHandle(candidate);
    if (found) return found;
  }
  return campaign;
}

/** Extract the product handle from a `/products/<handle>` path. */
export function handleFromProductPath(productPath: string): string {
  const match = productPath.match(/^\/products\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

/**
 * Append `?product=<handle>` to any support/policy link (`/help`, `/delivery`,
 * `/returns`, `/track`, `/privacy`, `/terms`) when the shopper is viewing a
 * `/products/<handle>` funnel, so every support tab stays locked to that exact
 * product even on SSR or in a new tab.
 */
export function withProductParam(to: string, productPath: string): string {
  const handle = handleFromProductPath(productPath);
  if (!handle || !to.startsWith('/') || to.startsWith('/products/')) return to;
  const [pathAndQuery, hash] = to.split('#');
  const [path, existingQuery] = pathAndQuery.split('?');
  const params = new URLSearchParams(existingQuery || '');
  if (!params.has('product')) {
    params.set('product', handle);
  }
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`;
}

/**
 * React hook that locks the entire storefront (Header, Footer, Help Center,
 * Delivery, Returns, Track Order, Theme Palette) to whichever product page the
 * shopper landed on (`/products/<handle>`, `?product=<handle>`, SSR cookie
 * `activeProductPath`, or `sessionStorage.merrivy_active_product`).
 */
export function useActiveProduct(): {
  activePacket: CampaignPacket;
  productPath: string;
} {
  const {pathname, search} = useLocation();
  const rootData = useRouteLoaderData('root') as
    | {activeProductPath?: string}
    | undefined;
  const queryProduct = new URLSearchParams(search).get('product')?.trim() || '';
  const urlProductPath = pathname.startsWith('/products/')
    ? normalizeProductPath(pathname) || pathname
    : queryProduct
      ? normalizeProductPath(queryProduct) || `/products/${queryProduct}`
      : '';
  const serverProductPath = normalizeProductPath(rootData?.activeProductPath);
  const initialPath = urlProductPath || serverProductPath || '';
  const [rememberedPath, setRememberedPath] = useState<string>(initialPath);

  useEffect(() => {
    try {
      const persist = (p: string) => {
        sessionStorage.setItem(ACTIVE_PRODUCT_COOKIE, p);
        localStorage.setItem(ACTIVE_PRODUCT_COOKIE, p);
        document.cookie = `${ACTIVE_PRODUCT_COOKIE}=${encodeURIComponent(p)}; Path=/; Max-Age=2592000; SameSite=Lax`;
        setRememberedPath(p);
      };
      if (urlProductPath.startsWith('/products/')) {
        persist(urlProductPath);
      } else {
        const saved =
          sessionStorage.getItem(ACTIVE_PRODUCT_COOKIE) ||
          localStorage.getItem(ACTIVE_PRODUCT_COOKIE) ||
          serverProductPath ||
          '';
        if (saved.startsWith('/products/')) {
          persist(saved);
        }
      }
    } catch {}
  }, [urlProductPath, serverProductPath]);

  const effectivePath =
    urlProductPath || rememberedPath || serverProductPath || SHOP_URL;
  return {
    activePacket: packetForPathname(effectivePath),
    productPath: effectivePath,
  };
}

/**
 * Navigation for any product campaign page (/products/<handle>):
 * jumps scroll to the sections on the current product page so a shopper on
 * /products/holiday-tartan-bow-dress never gets sent to a different product.
 */
export function primaryNavigation(
  isSample: boolean,
  packet: CampaignPacket = campaign,
  pathname = SHOP_URL,
): NavItem[] {
  const activePacket = pathname.startsWith('/products/')
    ? packetForPathname(pathname)
    : packet;
  const basePath = pathname.startsWith('/products/')
    ? pathname
    : activePacket.productUrl?.startsWith('/products/')
      ? activePacket.productUrl
      : SHOP_URL;
  const hasSection = (id: string) =>
    !activePacket.sections?.length || activePacket.sections.includes(id as never);
  const items: NavItem[] = [{to: basePath, label: 'Overview'}];
  if (hasSection('howToUse') && howToUseSteps(activePacket).length)
    items.push({to: `${basePath}#how-to-use`, label: 'How it works'});
  else if (hasSection('features') && featureItems(activePacket).length)
    items.push({to: `${basePath}#features`, label: 'Features'});
  if (hasSection('proof') && reviewCards(activePacket, isSample).items.length)
    items.push({to: `${basePath}#reviews`, label: 'Reviews'});
  else if (
    activePacket.sections?.length &&
    hasSection('quotes') &&
    pullQuotesContent(activePacket)
  )
    items.push({to: `${basePath}#why-they-switch`, label: 'Reviews'});
  if (hasSection('faq') && activePacket.faq?.items?.length)
    items.push({to: `${basePath}#questions`, label: 'FAQ'});
  return items;
}

export const storeNavigation = {
  /** The menu's "Here to help" links (100% product-agnostic support & policies). */
  support: [
    {to: '/track', label: 'Track my order'},
    {to: '/delivery', label: 'Shipping & delivery'},
    {to: '/returns', label: 'Returns & refunds'},
    {to: '/help', label: 'Help & FAQ'},
  ],
  /** The footer's support block. */
  footerSupport: [
    {to: '/track', label: 'Track my order'},
    {to: '/delivery', label: 'Shipping & delivery'},
    {to: '/returns', label: 'Returns & refunds'},
    {to: '/help', label: 'Help center'},
    {to: '/help#contact', label: 'Contact us'},
    {to: '/privacy', label: 'Privacy'},
    {to: '/terms', label: 'Terms'},
  ],
};

/**
 * Pages that render a full product experience: `/` or any `/products/<handle>`.
 */
export function showsProduct(pathname: string, packet: CampaignPacket = campaign) {
  return (
    pathname === SHOP_URL ||
    pathname.startsWith('/products/') ||
    packet.productHandles.some((handle) => pathname === `/products/${handle}`)
  );
}

/**
 * On a page that already shows a product, a jump to one of its sections
 * stays on that exact product page.
 */
export function localHref(to: string, pathname: string, packet: CampaignPacket = campaign) {
  const [path, hash] = to.split('#');
  return hash && (path === SHOP_URL || path === pathname) && showsProduct(pathname, packet)
    ? `#${hash}`
    : to;
}
