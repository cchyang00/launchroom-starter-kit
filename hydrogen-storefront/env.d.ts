/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

declare global {
  interface Env {
    MERRIVY_DEMO?: string;
    /** Optional kill switch: "off" hides the help chat even with a key. */
    MERRIVY_CHAT?: string;
    /** OpenRouter key: with it set the help chat is live. Server only, never logged. */
    OPENROUTER_API_KEY?: string;
    /** Shopify Admin API token with read_orders only, for order tracking. */
    SHOPIFY_ADMIN_ORDERS_TOKEN?: string;
    /** The store's myshopify.com domain for that token, e.g. ndfdtc-br.myshopify.com. */
    SHOPIFY_ADMIN_STORE_DOMAIN?: string;
  }
}
