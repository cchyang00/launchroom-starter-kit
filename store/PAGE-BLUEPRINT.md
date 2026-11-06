# The Merrivy Product Page Blueprint (Hard Rules — Updated November 5, 2026)

**Owner (November 3–5):** *"what i love is what we have already 100%. it just needs to be a base theme with a dummy product and make it 10/10 with a bunch of different color palettes... that way, the agents just basically copy from that base build, and then build the product pages easily from that base build... On the checklist remember, we're not going with the 3-kit anymore so it's only 2 kits, okay? We're not going with bundles anymore. It just becomes more of a headache dealing with add-ons. But yeah all the upsell stuff should be on the checklist for sure: Flawless mobile design, Strong high-converting copy angles, Making sure the shipping, the `$4.99`s, are on there correctly."*

Every product page on `merrivy.com/products/<handle>` is cloned from **`hydrogen-storefront/app/content/base-theme.json`** (`★ 10/10 Master Base Theme`, built from **`portable-water-purifier-pump.json`** — the Military-Grade Water Purifier Floor, our minimum quality & copywriting standard for every store build) and paired with one of our **52 color palettes** (`hydrogen-storefront/app/content/palettes.json`). **Every product uses the exact same 5 sections below the hero + 3 vertical creator demo videos, in the same order.** Agents never add, drop, or reorder sections.

---

## 1. The Fixed 5-Section Storefront Architecture (`base-theme.json`)

| # | Section | Its One Job | Must Have | Packet Field |
| --- | --- | --- | --- | --- |
| `0` | **Hero** *(First Phone Screen, `375px` — Features Explained ONCE Here)* | Everything needed to buy on screen 1 | `6–7` 8K DSLR-grade gallery slides (`1:1` square, swipeable), **ONE short, clean H1 product title (`hero.headline`, `4–6` words — never repeating `navLabel` above it or repeating `"Military-Grade"` 3 times)**, **a 2-sentence urgency/hook paragraph (`hero.subhead`) right below the title**, **3–4 short checkmark bullets (`hero.benefits`, `4–7` words each with `✔` icons)**, **2-Kit Selector (`1-Kit` vs. `2-Kit` `SAVE 15%` + Free Tracked Shipping)**, Add to Bag button, and trust line | `hero`, `purchase`, `offer`, `catalog` |
| `0b` | **See It In Action** | Visual proof in motion | Short header (`"See It In Action"`) + **3 vertical (`9:16`) viral creator demo videos** showing the real product in action (3-across on `560px+` and a horizontal swipeable reel on phones — never a 2-column grid with an empty 4th slot) | `demonstrations` (`3` items) |
| `1` | **Direct Emotional Hook (`Situational Life Moments` — Never Repeat Features!)** | Why the product is made for the buyer's life & emergencies | **One Direct Emotional Hook Headline (`4–7` words: e.g., `"Don't Wait Until The Tap Runs Dry"` or `"Don't Get Caught In The Dark"`, with `eyebrow: ""` blank — NEVER add a redundant `"Why This Is For You"` title underneath!)** + **3 situational buyer-life cards paired with 3 distinct, high-contrast `1:1` situational photos (`why-1.webp`–`why-3.webp`)** showing real moments when the buyer needs this product | `features` |
| `2` | **Comparison (`Mechanism vs. Old-School Alternatives`)** | Why our mechanism beats generic alternatives | **Name the Mechanism vs. Old Alternative (`4–6` words: e.g., `"One-Touch Electric vs. Old-School Filters"` — NEVER use the weak word `"Us"`!)** + clean comparison table across 4–5 buyer-praised criteria | `comparison` |
| `3` | **Verified Buyer Customer Reviews (`.is-wftn-reviews`)** | Social proof from real buyer situations | **Simple, universal header: `"Look At What Our Customers Have To Say"`** (set in `pullQuotes.heading`, `quotes.heading`, and `reviews.heading`) + `.is-wftn-reviews` layout in `PdpSections.tsx`: `4.9 ★★★★★` summary header + 3 highlight score pills + **6 customer review cards** | `quotes`, `pullQuotes` |
| `4` | **Guarantee (`30-Day Risk-Free Trial`)** | Remove purchase risk | Short header (`"30-Day Risk-Free Trial"`) + clear 30-day risk-free guarantee and tracked US delivery promise | `guarantee` |
| `5` | **FAQ (`Frequently Asked Questions`)** | Crush the top buyer objections | Short header (`"Frequently Asked Questions"`) + 6–8 FAQ accordions answering top buyer questions | `faq` |
| `Cart` | **Slide-Out Cart Drawer (`Cart-Only Upsells`)** | Maximize AOV without cluttering the PDP | **1-Tap `1-Kit -> 2-Kit` Upgrade Banner** (`SAVE 15% + Unlock FREE Tracked Shipping`) + pre-checked **`$4.99` Shipping Protection / Priority Insured Delivery** toggle (`BagAddOns: []` — no multi-SKU companion add-on headaches) | `offer`, `BagAddOns` |

*(Never include legacy sections `problem`, `whoFor`, `didYouKnow`, `howToUse`, `fitCheck`, `inTheBox`, `bundle`, or `promise` in `"sections": [...]`.)*

---

## 2. Hard Rules for Every Product Page

1. **Headline Split — Elevated Boutique/Hardware Titles on Website vs. Urgent Reveal Hooks in Meta Ads (Nov 3–5):**
   - **In Meta Ads (`#/create`):** Use urgent testimonial reveal hooks (`"You Have to Get This 2027 Journal — Get Yours Now Today! 🌙"`) and concrete pain hooks.
   - **On the Website (`merrivy.com`):** **Never** repeat *"You have to get this..."* in `hero.headline` or `purchase.heading` (the ad already did that job). Use elevated, prestigious boutique/hardware titles on the site while weaving viral creator reveal phrasing into `purchase.hook` and the 3 creator demo video cards.
2. **2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection (Nov 4):**
   - **1-Kit:** Base retail price + **`$7.99` Standard Shipping** (`3–5` Business Days).
   - **2-Kit (`MOST POPULAR · SAVE 15%`):** 2 units at `15%` off + **FREE Tracked Shipping**.
   - **No 3-Kit & No Multi-SKU Add-On Bundles:** Never configure a 3-Kit option or separate physical companion add-ons (`BagAddOns: []`). All upsell friction stays zero: just the 1-Kit/2-Kit selector + `$4.99` Shipping Protection in the Cart Drawer.
3. **8K DSLR-Grade Gallery Images (Zero Python PIL/Canvas, Zero Competitor Logos):**
   - Every gallery image (`hero-1.webp` through `hero-7.webp`) is generated by `image-maker` using **BOTH** real product truth frames and one layout reference (`agents/image-generator/references/layouts/static_01.png`–`static_50.png`).
   - Never use raw supplier listing images, never draw flat diagrams with Python PIL/Canvas, and never bake competitor trademarks onto boxes or products.
4. **Phone First (`375px` Mobile Preview in `#/build`, `#/checklist`, and `#/manage?tab=store`):**
   - 95–99% of Meta traffic is on phones. Check every page in the `375px` mobile preview first: zero horizontal overflow, clean 1-line kit cards, and above-the-fold Add to Bag visibility.

---

## 3. Pre-Launch Verification (`workflow/LAUNCH-CHECKLIST.md` — `7/7`)

Before any product moves from **Checklist (`#/checklist`)** to **Launch (`#/launch`)**, all 7 checks must be verified:
1. **Flawless Mobile Design (`375px`)**
2. **Strong High-Converting Copy Angles**
3. **2-Kit Pricing (`1-Kit` + `2-Kit`, No 3-Kit), `$7.99`/Free Shipping & `$4.99` Upsell Math**
4. **Page Layout & Quality-of-Life (QoL) Polish**
5. **Shopify Admin Variants, Pricing & Descriptions (`ndfdtc-br.myshopify.com`)**
6. **Meta Pixel & CAPI Event Match in Shopify** *(dedicated category-isolated Meta Pixel per product niche)*
7. **Supplier Fulfillment Check (Amy / CJ / HyperSKU `<35%` Landed Cost)**
