# The Launch Checklist (v3 — 7-Point Storefront, Shopify Backend & Supplier Check)

**Updated v3, November 4, 2026.** The owner streamlined the checklist on November 4:
> *"On the checklist remember, we're not going with the 3-kit anymore so it's only 2 kits, okay? We're not going with bundles anymore. It just becomes more of a headache dealing with add-ons. But yeah all the upsell stuff should be on the checklist for sure:*
> *- Flawless mobile design*
> *- Strong high-converting copy angles*
> *- Making sure the shipping, the $4.99s, are on there correctly*
> *- Just quality-of-life checks, like making sure everything's laid out correctly*
> *That's all. Other than that I think the storefront checklist here is strong enough. And then of course the Shopify backend and checkout. It's pretty much the most important thing: just making sure that the Shopify admin has the right product variants and descriptions on them and making sure that the Meta pixel is correct with Shopify. Honestly you don't even need the end-to-end checkout and payment verified because their payment is already set up naturally. As long as we set up the Shopify admin stuff correctly, the payment should go through correctly too. That's what I'm thinking. And then the supplier fulfillment: I just have to do a check with Amy or the supplier to see if it exists. Usually if it exists somewhere on Alibaba, then they can source it. We don't really need the storefront and backend sign-off because my sign-off is me going through there and checking each one so that's already the sign-off."*

The 7 items live in `os/server/launchChecklist.mjs` (the single source read by `#/checklist`) and this file together.

## The rule

A product moves from **Checklist** (`#/checklist`) to **Launch** (`#/launch`) when all **7/7** items are ticked. Checking off each item *is* the owner's sign-off (no separate 8th "owner sign-off" row).
- **Step 4 · Checklist (`#/checklist`):** Covers **Storefront Mobile Design, Strong Copy, 1-Kit / 2-Kit Upsells & `$4.99`s (no 3-Kit or add-on headaches), Layout QoL, Shopify Admin Variants/Descriptions + Meta Pixel, and Amy / CJ Supplier Check**, plus a live 375px mobile preview.
- **Step 5 · Launch (`#/launch`):** Covers the **Meta Ads Side of Launching** — configuring the Daily CBO Budget (`$/day`), target countries, Break-Even / Target CPA, First-Test Loss Limit (`$50`), and reviewing all 9:16 creator videos and 4:5 static ads brought from the Assets & Creatives Hub (`Keep` or `Cut`).
- Saved in: `os/data/launch-checklists.json`, one record per product (`P###`).
- An agent may tick an item **only with its evidence in the note** (what was checked and where the proof is saved). The server refuses a tick without one.

## The 7 items

| # | ID | Group | Item | What "done" means | Covers (CHECKS.md) |
| --- | --- | --- | --- | --- | --- |
| 1 | `phone` | 1 · Storefront, Copy & Upsells | **Flawless Mobile Design (375px)** | Mobile hero, sticky Add-to-Cart bar, gallery photos, and sections render cleanly on a 375px phone screen with zero cut-off text or visual bugs | B1, B2 |
| 2 | `copy` | 1 · Storefront, Copy & Upsells | **Strong, High-Converting Copy & Angles** | Above-the-fold reveal hook, benefit bullets, comparison table, FAQs, and customer reviews use strong, high-converting buyer angles that sell the transformation | B2, C2 |
| 3 | `cart` | 1 · Storefront, Copy & Upsells | **1-Kit / 2-Kit Upsell & `$4.99` Shipping/Protection Correct** | Only 1-Kit and 2-Kit options are active (no 3-Kit tier and no physical add-on headaches), and the `$4.99` shipping/protection items and cart drawer upsells are set up and displaying accurately | B4, B5 |
| 4 | `offer` | 1 · Storefront, Copy & Upsells | **Page Layout & Quality-of-Life Checks** | Everything on the page is laid out cleanly in the right order—spacing, badges, gallery slides, video players, reviews, and sticky bars work smoothly with zero friction | B1, B5 |
| 5 | `ads` | 2 · Shopify Backend & Meta Pixel | **Shopify Admin Product, Variants & Descriptions Correct** | Shopify Admin has the right product title, descriptions, photos, and active 1-Kit / 2-Kit variants and prices synced to the Online Store (Shopify payment runs naturally from this) | B1, B4 |
| 6 | `pixel` | 2 · Shopify Backend & Meta Pixel | **Meta Pixel Connected Correctly with Shopify** | Meta Pixel (`955359040485060`) and Shopify CAPI are connected and firing `ViewContent`, `AddToCart`, `InitiateCheckout`, and `Purchase` | L3 |
| 7 | `test-sheet` | 3 · Supplier Check | **Checked with Amy / Exists on CJ to Source** | Confirmed with Amy or verified the exact product exists on CJdropshipping so she or the supplier can source and fulfill it as orders come in | P2, P3 |
