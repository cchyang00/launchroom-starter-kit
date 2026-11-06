/**
 * Locale for showing a price. The demo catalog is CAD (shown as "$30");
 * the real Merrivy store is USD, which en-CA would show as "US$30".
 */
export const moneyLocale = (currency: string) =>
  currency === 'CAD' ? 'en-CA' : 'en-US';
