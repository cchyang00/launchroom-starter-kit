/**
 * The sample catalog (mock.shop: local dev and any preview deploy) versus the
 * real Shopify store. Policy pages are Merrivy's own (/delivery, /returns,
 * /privacy, /terms) on both; Shopify's /policies/* URLs move to them (see
 * single-product.ts). Before launch, the policies saved in Shopify admin,
 * which checkout shows, must say the same as these pages.
 */
export function isSampleCatalog(domain: string) {
  const hostname = domain.trim().toLowerCase();
  return hostname === 'mock.shop' || hostname.endsWith('.mock.shop');
}
