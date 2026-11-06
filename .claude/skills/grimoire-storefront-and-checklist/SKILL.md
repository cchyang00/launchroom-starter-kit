---
name: grimoire-storefront-and-checklist
shelf: store
description: Clone base-theme.json and 52 palettes in #/store, build the 5-section Grimoire Hydrogen storefront page on localhost:3021 (#/build) with 2 Kits Only (1-Kit + 2-Kit) and $4.99 Shipping Protection, configure Shopify Admin variants and category-isolated Meta Pixels, verify the 7/7 Launch Checklist (#/checklist), and run post-launch Store & CRO experiments (#/manage?tab=store).
---

# Grimoire Storefront, 2-Kit Setup & 7/7 Launch Checklist (`#/store`, `#/build`, `#/checklist`, `#/manage?tab=store`)

Owner Rules (November 3–5, 2026):
> *"What I love is what we have already 100%. It just needs to be a base theme with a dummy product and make it 10/10 with a bunch of different color palettes... that way, the agents just basically copy from that base build, and then build the product pages easily from that base build."*
> *"On the checklist remember, we're not going with the 3-kit anymore so it's only 2 kits, okay? We're not going with bundles anymore. It just becomes more of a headache dealing with add-ons. But yeah all the upsell stuff should be on the checklist for sure: Flawless mobile design, Strong high-converting copy angles, Making sure the shipping, the `$4.99`s, are on there correctly... And then of course the Shopify backend and checkout... making sure that the Shopify admin has the right product variants and descriptions on them and making sure that the Meta pixel is correct with Shopify."*

This skill encodes the complete operational workflow for **Step 3 · Store (`#/build`)**, **Step 5 · Checklist (`#/checklist`)**, and **Manage -> Store & CRO (`#/manage?tab=store`)**.

---

## 1. Step 1 — Clone `base-theme.json` + Select One of the 52 Color Palettes (`#/store` & `#/build`)

1. **Clone From the 10/10 Master Base Theme (`hydrogen-storefront/app/content/base-theme.json`):**
   - Run inside `hydrogen-storefront/`:
     ```powershell
     node scripts/packet-tools.mjs new <slug> --palette <palette-id> --live
     ```
     Or call `POST http://localhost:3000/api/store-editor/clone` with `{ "slug": "<slug>", "paletteId": "<palette-id>", "productId": "P###" }`.
   - **NEVER delete, rename, or overwrite `hydrogen-storefront/app/content/base-theme.json` with a blank or inferior file.** `app/content/templates.ts` uses `base-theme.json` as its permanent fallback so that when a failed product is wiped via `Cancel & Wipe Product` in `#/manage`, MiniOxygen (`http://localhost:3021`) never crashes.
   - **Our `10/10` Master Base Theme Floor (`base-theme.json` = `portable-water-purifier-pump.json`):** The **One-Touch Portable Electric Water Purifier (`portable-water-purifier-pump.json`)** IS our `base-theme.json` floor (replacing the older Grimoire planner). Every future store build must meet or exceed its image sharpness (`1024x1024` DSLR photography), Sacred Oak persuasion arc, and clean high-contrast typography.
2. **Pick the Product-Matched Palette from the 52 Palettes (`hydrogen-storefront/app/content/palettes.json`):**
   - Match the palette tokens (`theme`) to the product's niche and season (e.g., Warm Parchment & Espresso for Grimoire/Journals; Solar Amber & Obsidian Slate for Blackout/Hardware; Festive Crimson & Pine for Holiday Gifting; Eucalyptus Sage & Linen for Organic Sleep/Comfort).

---

## 2. Step 2 — Populate the Fixed 5-Section Grimoire Architecture (`<slug>.json`)

Every product packet in `hydrogen-storefront/app/content/<slug>.json` **MUST** keep the exact section array:
```json
"sections": ["features", "comparison", "quotes", "guarantee", "faq"]
```
*(Never add legacy sections `problem`, `whoFor`, `didYouKnow`, `howToUse`, `fitCheck`, `inTheBox`, `bundle`, or `promise`.)*

| Order | Block / Section | JSON Field | Mandatory Content & Rules |
| --- | --- | --- | --- |
| `0` | **Hero & Above-the-Fold Buy Box (`375px` Mobile First — Features Explained ONCE Here)** | `hero`, `purchase`, `offer`, `catalog` | **1. Gallery (`hero.gallery` & `purchase.gallery`):** All `6–7` square `1:1` feature/infographic slides (`public/images/<slug>/hero-1.webp`–`hero-7.webp`) go here with the strongest static hero slide (`hero-1.webp`) FIRST so shoppers swipe through all product features right at the top.<br>**2. ONE Clean, Short Product Title (`hero.headline`, 4–6 words):** Never print `navLabel` above `hero.headline` (zero duplicate titles!) and **never repeat `"Military-Grade"` 3 times** across the image, eyebrow, title, and variant card. Keep `hero.headline` clean and direct (e.g., `"One-Touch Portable Electric Water Purifier"`).<br>**3. Short 2-Sentence Urgency/Hook Paragraph (`hero.subhead`, 25–35 words max):** Right below the title, hit the buyer's core pain point and use the power phrase (`"military-grade"`) **once** where it hits hardest (e.g., *"Don't wait until a boil-water alert or blackout leaves your family without drinking water. Get this military-grade 0.01-micron purifier now to turn any tap, creek, or rain barrel into pure drinking water with one touch."*).<br>**4. 3–4 Short Checkmark Bullets (`hero.benefits`, 4–7 words each, rendered with `✔` icons):** Scannable in 1 second (e.g., `✔ Pure Drinking Water With One Touch`, `✔ 793 Gallons Per Filter (6,000 Bottles)`, `✔ Zero Manual Pumping Or Straws`, `✔ Built-In USB-C Battery & SOS Light`). Never write 18-word spec sentences.<br>**5. Clean 2-Kit Selector (`1-Kit` vs `2-Kit`):** Short 1-line captions (`"1 Complete Purifier System · 793-Gallon Capacity"` vs `"Keep 1 at Home + 1 in Your Truck · You Save $40 + Free Shipping"`), crisp dark ink (`var(--ink)`), and uniform typography (zero grayed-out or multi-colored text). |
| `0b` | **See It In Action (Real Creator Demonstrations)** | `demonstrations` | Short 3–4 word heading (`"See It In Action"`) + **3 vertical (`9:16`) viral creator demo videos** (`public/videos/<slug>/demo-1.mp4`–`demo-3.mp4`) with posters and creator-reveal captions proving the product works in real life (rendered 3-across from `560px+` and as a horizontal swipeable reel on phones so there is never a 2-column grid with a missing 4th slot). |
| `1` | **Direct Emotional Hook (Situational Life Moments + 3 Distinct Photos — NEVER Repeat Features or Add `"Why This Is For You"` Bloat!)** | `features` | **CRITICAL OWNER RULE (Nov 5):** Because the Hero section already explains the product's features, **NEVER explain the technical features a second time below the fold!** And **NEVER put an eyebrow + `"Why This Is For You"` underneath it** — the emotional hook itself IS the headline:<br>- **One Direct Emotional Hook Headline (`features.heading`, `4–7` words, with `features.eyebrow: ""` blank):** e.g., **`"Don't Wait Until The Tap Runs Dry"`** or **`"Don't Get Caught In The Dark"`** (`navLabel: "Why It's For You"`).<br>- **3 Situational Buyer-Life Cards + 3 Distinct High-Contrast `1:1` Photos (`why-1.webp`–`why-3.webp`):** Each card names a concrete real-life situation when the buyer needs this product (e.g., *When Boil-Water Alerts Empty Store Shelves*, *When Your Family Needs Jugs — Not a Straw*, *When You're On the Highway or Off-Grid*) paired with a **distinct, high-contrast `1:1` situational photo (`item.image`)** with zero baked-in text. |
| `2` | **Comparison (`Mechanism vs. Old-School Alternatives` — Never Use Weak `"Us"`!)** | `comparison` | **Name the Mechanism vs. Old Alternative (`4–6` words: e.g., `"One-Touch Electric vs. Old-School Filters"` — NEVER write `"Us vs."`!)** + side-by-side table comparing our mechanism against cheap generic alternatives across 4–5 buyer-praised criteria. |
| `3` | **Verified Buyer Customer Reviews (`.is-wftn-reviews`)** | `quotes`, `pullQuotes` | **Simple, universal header: `"Look At What Our Customers Have To Say"`** (set in `pullQuotes.heading`, `quotes.heading`, and `reviews.heading`) + `.is-wftn-reviews` layout (`PdpSections.tsx`): `4.9 ★★★★★` summary header + 3 highlight score pills + **6 customer review cards** (`2–3` cols desktop, `1` col mobile) with candid avatars, `✓ Verified Buyer` badge, location/date, `★★★★★`, review photo thumbnail (`review-1.webp`–`review-6.webp`), bold title, verbatim quote, and `✓ Highlights:` pill. |
| `4` | **Guarantee (`30-Day Risk-Free Trial`)** | `guarantee` | Short header (`"30-Day Risk-Free Trial"`) + 30-day money-back promise and tracked US delivery window (`8–12` business days). |
| `5` | **FAQ (`Frequently Asked Questions`)** | `faq` | Short header (`"Frequently Asked Questions"`) + 6–8 FAQ accordions answering the exact setup, sizing, durability, shipping, and return objections mined from 2–4 star reviews. |

### Hard Rule: High-Contrast Uniform Typography & Zero Repetition (Owner Rule — Nov 5)
1. **Zero Triple Repetition:** Never repeat `"Military-Grade 6-Stage..."` three times across the hero image, eyebrow, H1 title, and variant card. State the feature visual on the hero image, keep the H1 title short (`4–6` words), and place `"military-grade"` once inside `hero.subhead` where it drives urgency.
2. **Short Section Headers (`3–6` Words Max):** Every section header (`See It In Action`, `Why This Is For You`, `Us vs. Old-School Filters`, `What Our Customers Say`, `30-Day Risk-Free Trial`, `Frequently Asked Questions`) must be short and scannable in half a second—never a full sentence.
3. **100% High-Contrast Dark Ink & Uniform Fonts:** Every line of body copy, checkmark benefit, variant selector caption, and card text must use solid high-contrast dark ink (`var(--ink)` / `#141B24`) and consistent sans-serif typography (`Bricolage Grotesque` for headings, `DM Sans` for body/UI—never random `Georgia` serif italics on `em`, never washed-out gray text on variant cards or body paragraphs).

Set `"status": "live"` (never leave `"status": "sample"` on a product preparing for launch, as `"sample"` displays the "Private store setup" screen on the connected domain).

---

## 3. Step 3 — Enforce 2 Kits Only (`1-Kit` + `2-Kit`) & `$4.99` Shipping Protection in Cart

1. **Strictly 2 Options in `purchase.offerChoices` and `catalog.variants` (Never a 3-Kit):**
   - **Option 1 — `1-Kit` (Standard Anchor):** Priced at the proven market anchor (`$34.99–$54.99`). **Never show `+$7.99 Shipping` on the hero selector card**—keep the hero selector clean; `$7.99` Standard Shipping applies in the Cart Drawer and Checkout.
   - **Option 2 — `2-Kit` (`★ MOST POPULAR · BEST VALUE`):** Priced at `15%` off (`round(2 * P * 0.85) - 0.01`, with `compareAtPrice: 2 * P`) + **`FREE Tracked Shipping`**. Keep the floating badge concise (`★ MOST POPULAR · BEST VALUE`, `white-space: nowrap`) so it never wraps or overlaps at `375px` mobile width.
2. **Cart-Drawer-Only Upsells (`$4.99` Shipping Protection + 1-Tap 2-Kit Upgrade, Zero Add-On Bundles):**
   - Set `offer.shippingProtection` to **`4.99`** (pre-checked `$4.99` Priority Insured Delivery & Package Protection toggle in `CartSummary.tsx`, excluded from the header `Bag (N)` item count).
   - Keep `addOnIds: []` / `BagAddOns: []`—never configure separate physical companion add-on SKUs.
   - Verify the 1-tap **`Upgrade to 2-Kit (SAVE 15% + FREE Tracked Shipping)`** banner triggers inside the slide-out Cart Drawer when `1-Kit` is added.

---

## 4. Step 4 — Configure Shopify Admin (`ndfdtc-br.myshopify.com`) & Category-Isolated Meta Pixel

Using the owner's signed-in Chrome browser ([browser-use](../browser-use/SKILL.md)):
1. **Shopify Admin Product & Variants (`https://admin.shopify.com/store/ndfdtc-br`):**
   - Create or update the product with the exact handle (`<slug>`), elevated boutique title, clean HTML description, gallery images, and active **`1-Kit`** and **`2-Kit`** variants (with exact prices, compare-at prices, SKU codes, unit COGS, and inventory tracking).
   - Confirm all 5 tier-1 English markets (`US`, `CA`, `GB`, `AU`, `NZ`) are active in Shopify Markets and that `$7.99` Standard Shipping (`1-Kit`) and Free Shipping (`2-Kit` / orders `>= $60`) calculate accurately.
2. **Category-Isolated Meta Pixel & Shopify CAPI:**
   - Ensure the product niche uses its **dedicated, category-isolated Meta Pixel & CAPI Dataset** (never cross-contaminate pixel algorithms across unrelated audiences like Gothic Stationery vs. Emergency Solar Hardware).
   - Verify `ViewContent`, `AddToCart`, `InitiateCheckout`, and `Purchase` events fire cleanly with zero duplicate events.

---

## 5. Step 5 — Verify Packet, `375px` Mobile Preview & Tick All `7/7` Launch Checklist Items (`#/checklist` -> `#/launch`)

1. **Run the Automated Packet & Build Check:**
   ```powershell
   cd "c:\Users\Cha Yang\Documents\dropshipping\hydrogen-storefront"
   node scripts/packet-tools.mjs check app/content/<slug>.json
   ```
2. **Inspect the Live `375px` Mobile Preview (`http://localhost:3021/products/<slug>?packet=<slug>.json`):**
   - Check in `#/build` and `#/checklist` (`/api/store-preview`) that the mobile hero, gallery swipe, 2-Kit cards, sticky Add to Bag bar, 3 creator demo videos, `.is-wftn-reviews` cards, and slide-out Cart Drawer render with zero horizontal overflow or cut-off text.
3. **Auto-Advance the Pipeline to `#/launch` via Launchroom APIs:**
   - Tick all 7 items on `POST http://localhost:3000/api/launch-checklists` (`phone`, `copy`, `cart`, `offer`, `ads`, `pixel`, `test-sheet`), supplying the concrete verification note and file/screenshot proof for each item ([workflow/LAUNCH-CHECKLIST.md](../../../workflow/LAUNCH-CHECKLIST.md)).
   - Update `PATCH http://localhost:3000/api/products/:id` to mark `claims-rights`, `creative-assets`, `angle-offer`, `draft-page`, `service-promise`, `checkout`, and `tracking` as `"passed"` with saved evidence so the product moves automatically to **Step 6 · Launch (`#/launch`)**.

---

## 6. Step 6 — Post-Launch `Store & CRO` Diagnostics & Experiments (`#/manage?tab=store`)

When a launched product in `#/manage?tab=store` has healthy ad engagement (`Link CTR >= 2.0%`) on Day 1–3 but low conversion (`ATC < 6%` or `0` Purchases):
1. **Diagnose the Exact Funnel Bottleneck (`scripts/sync_meta_campaigns.py`):**
   - **High Clicks -> Low Add-to-Cart (`Click -> ATC < 5%`):** Hero hook mismatch, weak first gallery slide (`hero-1.webp`), or perceived price friction on the 1-Kit/2-Kit selector.
   - **High Add-to-Cart -> Low Checkout (`ATC -> IC < 40%`):** Cart Drawer friction or unclear Free Shipping threshold.
   - **High Checkout -> Low Purchase (`IC -> PUR < 25%`):** Delivery date hesitation, missing guarantee reassurance, or shipping fee surprise on `1-Kit`.
2. **Deploy Targeted Store & CRO Tweaks Before Day 3:**
   - Log and deploy one focused CRO change in `#/manage?tab=store` (e.g., Hero Hook & `purchase.hook` alignment with the top-spending ad creative, First Gallery Slide swap, 2-Kit badge framing, or FAQ/Guarantee delivery reassurance) so Day 3 runs with maximum conversion efficiency before the End-of-Day 3 Kill Gate.
