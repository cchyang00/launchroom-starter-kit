# Merrivy connected to Oxygen — September 28, 2026

Status: **real Shopify connection and private Oxygen deployment verified**. No product selected, no real purchase test, no production deployment or domain cutover.

Owner approved the prepared setup after the explanation of persistent API access. Created **Merrivy local storefront**, Hydrogen ID `1000181179`, in the existing `ndfdtc-br.myshopify.com` store with manual deployment selected. Local project linked successfully using the installed Shopify CLI 3.93.2.

- [Hydrogen admin](https://admin.shopify.com/store/ndfdtc-br/hydrogen/1000181179)
- [Private preview](https://01m3n00ev2rwcjkesa3sbxyk3w-faece38b0857a4949865.myshopify.dev/)
- [Deployment details](https://admin.shopify.com/store/ndfdtc-br/hydrogen/1000181179/deployments/5224767)
- Deployment record `5224767`, display number `5613454`, Preview environment, **Complete / Ready**. Admin explicitly shows **No Production deployments yet**.

## What was verified

1. Storefront API request returned HTTP 200, shop name Merrivy, primary domain https://merrivy.com and USD currency. First-product query returned zero products available to this storefront. Drafts were not activated or published.
2. Preview environment settings were pulled locally. Real credentials are in ignored `hydrogen-storefront/.env.shopify`; original sample settings are preserved in ignored `.env` and `.env.mock`. `git check-ignore` verified all three plus `.shopify/env-pull.log`. No credentials are in this record.
3. The official CLI built and deployed the current working directory using `hydrogen deploy --preview --env-file .env.shopify --force --metadata-description 'Private connected preview; product selection and checkout tests pending' --no-json-output`. Force acknowledges the existing uncommitted design; it is not a Git reset or commit. No source-map exposure or auth-bypass token flag was used.
4. Opening the preview in Chrome required Shopify sign-in; the existing owner account successfully opened the rendered page. Storefront name comes from the real Shopify header query. Screenshot review showed the styled connected-state page and loaded image.
5. The real connection renders an explicit setup state rather than binding sample hoodie claims to arbitrary real merchandise. `app/root.tsx` deliberately keeps the real-store campaign closed until a future product population change. This gate must be replaced during selected-product implementation, not by merely publishing a product. The full local sample still renders after reload on port 3001; OS stays on 3000.
6. TypeScript and full ESLint passed. Production build/deployment succeeded with the known CLI bundle-report warning. Shopify toolkit validation rejected the whole root file with an implicit-return diagnostic while skipping custom components; project TypeScript did not reproduce that diagnostic. Do not treat the toolkit as a clean validation result.

Build identity: existing Git base `ef7a6a3` plus local uncommitted work, not a clean commit deployment. SHA256 root.tsx `4F7C33FFC2B05AAE9F6F0A848D4549A085628FC4D8ACCBD47708806569713DA9`; server bundle `5993C85329E1F99B8FBBE5E878014FEB937A011EEFDCCA28726F33F26CC1469D`.

## Reuse and remaining work

- `hydrogen env pull --env-file` failed when the target did not exist: Node interpreted the flag and reported missing file. Preserved original .env as .env.mock, pulled Preview into default .env with --force, copied the real result to .env.shopify, then restored .env. Deployment with the existing .env.shopify succeeded. Keep output private because environment diffs may contain secrets.
- The project is linked; CLI dev can inject linked variables. Local .env currently retains the sample and was browser-rechecked. For explicit real-store work use the real environment file deliberately; verify the rendered store after any server restart.
- Choose a product, populate the existing design from its evidence packet, expose only that intended catalog offer to Hydrogen, then test product/cart/Shopify checkout and any real bundle/subscription flows. Verify the checkout hostname and Customer Account callbacks/scopes for the chosen URL. Do not reuse the unrelated magnesium plan.
- Minnesota registration/collection, supplier-backed shipping, real checkout, customer management, tracking/consent and public launch gates remain open per [commerce readiness](2026-09-28-COMMERCE-READINESS.md). Connection does not pass those checks. Existing dependency/hydration issues remain in the trial record for production review.
- No recurring GitHub deployment configured, no production URL made public, no changes to merrivy.com routing, no payment/order or ad spend. Next business action is product discovery, not more generic design.

Official references: [link](https://shopify.dev/docs/api/shopify-cli/hydrogen/hydrogen-link), [deploy](https://shopify.dev/docs/api/shopify-cli/hydrogen/hydrogen-deploy), [environments and privacy](https://shopify.dev/docs/storefronts/headless/hydrogen/environments).
