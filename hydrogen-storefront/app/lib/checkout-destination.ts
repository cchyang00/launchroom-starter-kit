/** Keep mock carts local and only hand real carts to the configured checkout. */
export function checkoutDestination(
  storeDomain: string,
  checkoutDomain: string | null | undefined,
  checkoutUrl: string | null | undefined,
): string | null {
  const hostname = (value: string | null | undefined) => {
    if (!value) return '';
    try {
      return new URL(value.includes('://') ? value : `https://${value}`)
        .hostname;
    } catch {
      return '';
    }
  };
  const storeHost = hostname(storeDomain);
  if (storeHost === 'mock.shop' || storeHost.endsWith('.mock.shop')) {
    return '/checkout-preview';
  }
  if (!checkoutUrl || !storeHost) return null;
  try {
    const destination = new URL(checkoutUrl);
    const allowed = [
      storeHost,
      hostname(checkoutDomain),
      'merrivy.com',
      'www.merrivy.com',
      'checkout.merrivy.com',
      'shop.app',
    ].filter(Boolean);
    return destination.protocol === 'https:' &&
      allowed.includes(destination.hostname)
      ? destination.href
      : null;
  } catch {
    return null;
  }
}
