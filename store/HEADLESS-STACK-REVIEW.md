# Headless storefront stack review — 2026-09-28

**Status: owner selected a local Hydrogen + Oxygen trial on September 28.** The official stable starter is in `hydrogen-storefront/`, using Shopify sample data at localhost:3001. No headless channel, deployment, domain switch or public storefront was created. The owner rejected the current storefront appearance and asked to determine the stack before custom design. See [trial results](2026-09-28-HYDROGEN-TRIAL.md).

## Recommendation

**Continuation:** the owner subsequently requested the full visible storefront, which is now built locally. See [campaign page acceptance](2026-09-28-HYDROGEN-PAGE-ACCEPTANCE.md) and [content population guide](HYDROGEN-POPULATION.md). The old scaffold-only next actions are historical; preserve the complete reference.

Use **Shopify Hydrogen + Oxygen** for Merrivy’s first custom storefront. Current stable Hydrogen is a React Router storefront with Shopify product, cart, checkout and analytics patterns already integrated. Oxygen is Shopify’s hosting for it and is available at no additional hosting charge on the paid Basic plan that our September 26 Shopify readback reported. This does **not** make the store free: the Shopify plan, domain, existing Atlas subscription, transaction costs and any other apps remain separate. Verify the active plan in admin before connecting a storefront.

The existing VPS is a fallback, not the default. Self-hosting Hydrogen is supported, but requires a different runtime adapter, deployment and operations. A custom Next.js + Storefront API build gives full design control but makes us implement and maintain more of the cart, session, analytics, privacy/consent and checkout integration ourselves. Shopify's framework-agnostic Hydrogen SDK is currently a **developer preview**; use the stable Hydrogen path for a first launch.

| Decision factor | Hydrogen + Oxygen | Next.js + existing VPS |
| --- | --- | --- |
| Incremental hosting | Oxygen included with eligible paid Shopify plans | VPS already paid for; operations and capacity are ours |
| Shopify commerce integration | Official storefront patterns and CLI | Storefront API integration built and maintained by us |
| Design freedom | Full custom React UI | Full custom React UI |
| Analytics/consent | Hydrogen has documented Shopify integration | More custom integration and testing |
| First-launch risk | Lower integration burden | Higher integration/maintenance burden |

## Migration implications

- Shopify remains the product, inventory, order and checkout backend. Headless replaces the customer-facing theme storefront; the Ascendify sections and Atlas-generated theme pages do not become Hydrogen components automatically. Reuse verified copy/media and rebuild the visible page.
- The first product page should be a mobile-first campaign page driven by the exact verified item, buyer situation and offer. Product price, options and availability must come from Shopify; the cart must hand off to Shopify checkout.
- Review each theme-dependent app or feature, including reviews and Meta measurement, before assuming it works on a headless frontend. Test consent, pixel events, cart, checkout, policies, delivery and mobile rendering on the actual channel and domain.
- Keep the existing private theme intact until a full headless customer journey is verified. Publishing a product to a Hydrogen sales channel and changing the primary domain are separate launch steps.

## Work already started, then stopped

`storefront/` contains an **unapproved Next.js layout and API spike** made before the stack decision. It is local only, with a development-only synthetic practice page, no Shopify credentials, no selected product, and no deployment. Its port 3001 server is stopped. Treat it as disposable visual/code exploration, not the adopted architecture or storefront. The existing `localhost:3000` operations app is separate.

## Next implementation steps

1. Local Hydrogen trial is selected and scaffolded. Verify the store's current Oxygen eligibility before connecting it.
2. Define the first product page modules and real-content gates from a verified product packet. A private design fixture can exercise layout, never customer proof.
3. Resolve the starter dependency and browser compatibility issues recorded in the trial, then build and test the reference-led visual system locally. Connect the Shopify Hydrogen channel only when ready to test real published product/cart data and the requested permissions are clear.
4. Complete preview, mobile/desktop, checkout, policies, analytics/consent and domain cutover checks before public launch.

## Primary sources

- [Hydrogen and Oxygen fundamentals](https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals)
- [Hydrogen and Oxygen getting started](https://shopify.dev/docs/storefronts/headless/hydrogen/getting-started)
- [Shopify headless build options](https://shopify.dev/docs/storefronts/headless/getting-started/build-options)
- [Self-hosting Hydrogen](https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/self-hosting)
- [Hydrogen developer preview status](https://shopify.dev/docs/storefronts/headless/developer-preview)
- [Theme-to-Hydrogen migration](https://shopify.dev/docs/storefronts/headless/hydrogen/migrate)
- [Hydrogen analytics and consent](https://shopify.dev/docs/storefronts/headless/hydrogen/analytics/consent)
