/**
 * Isolate the sample catalog from the linked store's real credentials.
 *
 * The sample catalog is the default: the store only uses its real Shopify
 * credentials when MERRIVY_LIVE is "true" (and MERRIVY_DEMO isn't "true").
 * This lets Production run on Oxygen's own variables (including the help
 * chat's key) without a deploy-time env file, which replaced them.
 */
export function isLiveStore(env: Env): boolean {
  const record = env as unknown as Record<string, string | undefined>;
  return record.MERRIVY_LIVE === 'true' && record.MERRIVY_DEMO !== 'true';
}

export function resolveStoreEnvironment(env: Env): Env {
  if (isLiveStore(env)) return env;
  return {
    ...env,
    PUBLIC_STORE_DOMAIN: 'mock.shop',
    PUBLIC_CHECKOUT_DOMAIN: 'mock.shop',
    PUBLIC_STOREFRONT_API_TOKEN: '',
    PRIVATE_STOREFRONT_API_TOKEN: '',
    PUBLIC_STOREFRONT_ID: '',
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: '',
    PUBLIC_CUSTOMER_ACCOUNT_API_URL: '',
    SHOP_ID: '',
  };
}
