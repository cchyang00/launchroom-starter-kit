import {redirect} from 'react-router';
import {resolveActiveProductPath, SHOP_URL} from '~/content/navigation';

/**
 * Every product on Merrivy lives at `/products/<handle>`.
 * Retired template routes (collections, search, blogs, journal, shop) redirect
 * to the shopper's active `/products/<handle>` page.
 */
export const SHOP_HOME = SHOP_URL;

/** Shopify policy handles and the Merrivy page that answers each. */
const POLICY_PAGES: Record<string, string> = {
  'privacy-policy': '/privacy',
  'shipping-policy': '/delivery',
  'refund-policy': '/returns',
  'terms-of-service': '/terms',
  'subscription-policy': '/terms',
  'legal-notice': '/terms',
  'contact-information': '/help#contact',
};

/** Common Shopify page handles and where they lead now. */
const SHOPIFY_PAGES: Record<string, string> = {
  contact: '/help#contact',
  'contact-us': '/help#contact',
  about: '/about',
  'about-us': '/about',
  'our-story': '/about',
  faq: '/help#faq',
  faqs: '/help#faq',
  help: '/help',
  shipping: '/delivery',
  delivery: '/delivery',
  returns: '/returns',
  refunds: '/returns',
  'returns-and-refunds': '/returns',
  privacy: '/privacy',
  terms: '/terms',
  'track-order': '/track',
};

/** Where a retired template path leads now; null for a path we never had. */
export function retiredTarget(pathname: string): string | null {
  const [, first = '', second = ''] = pathname.toLowerCase().split('/');
  switch (first) {
    case 'collections':
    case 'search':
    case 'blogs':
    case 'journal':
    case 'shop':
      return SHOP_HOME;
    case 'account':
      return '/help';
    case 'contact':
      return '/help#contact';
    case 'policies':
      return own(POLICY_PAGES, second) ?? '/help';
    case 'pages':
      return own(SHOPIFY_PAGES, second) ?? '/help';
    default:
      return null;
  }
}

/** A table's own entry only, never an inherited one such as __proto__. */
function own(table: Record<string, string>, key: string) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
}

/**
 * Redirect for a retired path. Moves to the shop resolve the shopper's active
 * `/products/<handle>` funnel and keep the query string, so ad parameters and
 * a chosen variant survive the hop.
 */
export function retire(request: Request, fallback = SHOP_HOME) {
  const url = new URL(request.url);
  const to = retiredTarget(url.pathname) ?? fallback;
  if (to === SHOP_HOME) {
    const activeProductPath = resolveActiveProductPath(request);
    return redirect(`${activeProductPath}${url.search}`, 302);
  }
  return redirect(to, 301);
}

