# Product page copy — the Merrivy formula

Status: adopted for the September 30 product-page rebuild; conversion effect untested. Use with [the copy brief](COPY-BRIEF.md): the brief finds the buyer, situation and supported claims; this file turns them into the page, slot by slot. Every slot below maps to a field in the Hydrogen content packet (`hydrogen-storefront/app/content/<product>.json`).

## Why the old copy failed (September 30 audit)

The owner judged the hoodie demo copy "not good at all". The specific failures, so they are not repeated:

1. **Mood without meaning.** "A little more everyday joy", "Less rush. More you.", "The little things, spelled out." Nothing a shopper can picture, believe or act on.
2. **Hedging inside the sales voice.** "The catalog describes a cotton construction…". Honesty belongs in a clear label, not in apologetic sentences.
3. **No buyer, no moment.** Nobody specific was being spoken to, so every line had to stay generic.
4. **Repetition.** Hood, pocket and cuffs were re-explained in three sections.
5. **No reason to act.** Packs cost the same per item and said so; nothing rewarded a decision.

## The rules

- **HARD RULE — Website vs. Meta Ad Headline Split + Viral Video Hook Harvesting (Owner, November 3–5):**
  - **In Meta Ads (`#/create`):** Use urgent, eye-catching reveal hooks (`"You Have to Get This 2027 Journal — Get Yours Now Today! 🌙"`) and concrete pain hooks harvested from the top-converting viral creator videos.
  - **On the Website (`merrivy.com` — `hero.headline` & `purchase.heading`):** **NEVER** repeat *"You have to get this..."* in `hero.headline` or `purchase.heading` on the website! The Meta ad already did that job, so repeating it on the landing page looks redundant and amateurish. On the website, use an **elevated, prestigious boutique or hardware title** (e.g., `"The Witching Hour 2027 Grimoire Planner"`, `"The Split-Panel Solar Indoor & Outdoor Ceiling Light Kit (2-Pack)"`) while weaving the viral creator's "best-light reveal" phrasing into **`purchase.hook`**, **`hero.subheadline`**, and the **3 creator demo video titles (`demonstrations`)**.
  - **Strictly 2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection:** Every product page offers strictly **1-Kit (`+ $7.99` Standard Shipping)** and **2-Kit (`MOST POPULAR · SAVE 15%` + FREE Tracked Shipping)** + **`$4.99` Shipping Protection** inside the slide-out Cart Drawer (`BagAddOns: []`—zero 3-Kit and zero companion add-on SKU headaches).
- **One buyer, one moment.** Write to a person in a specific situation. Every section should make that moment easier to picture.
- **Say it the way the top viral creator says it to a friend.** Short, excited, conversational sentences that reveal the product in its best light.
- **Every factual claim is traceable.** Only product data, verified supplier specs, configured offers and real service terms. Opinions and scenes are fine; invented specs, ratings, scarcity, "best-seller" and discounts are not.
- **Reward the decision honestly.** Use real mechanics (free-shipping thresholds, genuine bundle savings, real return windows), not fake urgency.
- **Label, don't hedge.** Demo, sample or illustrative content gets one clear label; the copy itself stays confident.
- **One job per section.** Strictly follow the Grimoire Universal Storefront Template (`"sections": ["features", "comparison", "quotes", "guarantee", "faq"]` preceded by the 3 creator videos in `DemonstrationSection`).

## The page, slot by slot

| # | Slot (packet field) | Shopper's question | Formula | Example (`P004` Grimoire / `P007` Solar Kit) |
| --- | --- | --- | --- | --- |
| 1 | `hero.eyebrow` / `purchase.eyebrow` | What vibe / moment is this? | Urgent seasonal, problem, or identity callout, 3–6 words | `LIMITED 2027 COVEN EDITION · 4 FREE STICKER SHEETS` |
| 2 | `hero.headline` / `purchase.heading` (5–10 words max) | What is this boutique/hardware item? | **Elevated boutique or hardware product title (NEVER repeat "You have to get this..." from the Meta ad!)** | `The Witching Hour 2027 Grimoire Planner` / `Split-Panel Solar Indoor & Outdoor Ceiling Light Kit` |
| 3 | `purchase.hook` / `hero.subheadline` | Why is everyone obsessed with it? | **Combine top viral creator's best-light reveal description with our offer (never a dry feature list)** | `Every week opens like an illustrated Book of Shadows — with moon phases, Sabbats & 360° brass spiral binding.` |
| 4 | `purchase.description` | What do I get when it arrives? | Best-light reveal + the 2 facts that matter + our included bonus/shipping | Full 2027 dated weekly & monthly spreads, moon phases, Sabbats + 4 free sticker sheets. |
| 5 | `hero.benefits` / `purchase.benefits` (4 chips) | Quick proof it's worth it | 4 punchy reveal chips sourced from 4–5★ Amazon reviews (max 7 words each) | `Full Jan–Dec 2027 Dated Spreads` · `4 Free Witchy Sticker Sheets` |
| 6 | `purchase.offerChoices` (**Strictly 2 Kits**) | How many should I grab? | **Strictly 2 Kits (`1-Kit` + `$7.99` shipping vs. `2-Kit` `SAVE 15%` + Free Tracked Shipping; NEVER a 3-Kit)** | `1 Kit (Standard)` vs. `2 Kits (Most Popular · Save 15% + Free Tracked Shipping)` |
| 7 | `hero.trustRow` + `hero.shipping` | Is it safe? When does it arrive? | Real terms only, as short labels; computed date range | `Free Tracked Shipping` · `30-Day Money-Back Guarantee` |
| 8 | `demonstrations` (3 vertical creator videos) | What does it look like in real life? | Harvest the exact viral creator hook as each video's `title` and `quote` | `"You have to get this 2027 planner — wait until you see the inside spreads"` |
| 9 | `features` (3–4 cards) | Why does it feel so special? | Best-light reveal headline + concrete detail + real product photo | `Opens Like an Illustrated Book of Shadows` |
| 10 | `comparison` (4–5 rows) | Why this instead of a plain store-bought one? | Specific contrast (`Us` vs `Standard Option`) | `Full-color botanical & lunar artwork on every spread` vs `Blank gray corporate boxes` |
| 11 | `pullQuotes` / `quotes` (`.is-wftn-reviews`) | What are real buyers saying? | 6 verified buyer cards in the Grimoire `.is-wftn-reviews` layout with verbatim quotes | `"My witchy girlfriend told me she wanted this for Christmas and she literally gasped"` |
| 12 | `guarantee` | What if it's not for me? | Real 30-day return promise in warm, confident words | `30-Day Coven & Comfort Guarantee` |
| 13 | `faq` (6–8 items) | Remaining doubts | Buyer questions phrased naturally + clear factual answers | `"Is it a real dated 2027 weekly and monthly planner?"` |
| 14 | `finale` & `helpProduct` | Ready to grab yours? | Repeat the viral reveal hook (`"You have to get this 2027 planner before New Year's"`) + 1-tap CTA | `You Have to Get This 2027 Planner Before January.` |

## Deals, offers and copy tokens

Added October 1 to match the code as built on September 30 (`app/components/Offer.tsx`, `app/lib/offer.ts`, `app/content/templates.ts`). Offer terms live once, in the packet's `offer` block (`status`, `currency`, `freeShippingOver`, `shippingFee`, `announcements`, `sale` with `label`, `percentOff`, `endsAt`, `note`, and `signup`). Copy refers to them with tokens so the words can never drift from the configured terms.

### Tokens

| Token | Filled with | Example (demo) | Write it as |
| --- | --- | --- | --- |
| `{freeShipping}` | `offer.freeShippingOver`, formatted in `offer.currency` (no decimals when whole) | $25 | Free shipping over {freeShipping} |
| `{shippingFee}` | `offer.shippingFee`, same format | $10 | Shipping is {shippingFee} |
| `{percentOff}` | `offer.sale.percentOff` **with the percent sign** | 50% | {percentOff} off, never {percentOff}% off |
| `{saleLabel}` | `offer.sale.label` | Launch week | {saleLabel}: {percentOff} off |

- Every string in the packet is filled **once, when the packet loads** (`fillPacketText` in `templates.ts`), not per visitor and not from Shopify. Use the tokens anywhere in the packet: announcements, purchase trust labels, promise, FAQ, finale footnote.
- With no `sale` block, `{percentOff}` becomes "0%" and `{saleLabel}` becomes "Offer", so only use them where a sale exists.
- Tokens are replaced whether or not the sale has ended. **Only put `{percentOff}` and `{saleLabel}` in announcement-bar lines** (the bar drops them after the end date, below). Evergreen copy such as the FAQ or promise should use `{freeShipping}` and `{shippingFee}` only.
- The money format follows the locale: a CAD packet prints "$25", not "CA$25". Some hard-coded service pages still write "CA$"; keep the wording consistent when you fill a real packet.

### Honesty rules for deals

1. **A sale shows only before its `endsAt`.** `saleActive()` is true only when `percentOff` is above 0 and below 100 and `endsAt` is a valid date in the future. The announcement bar, the countdown, the derived "was" price and the bag's savings line all stop at that moment, and the bar drops any line containing "%" or the word "off" (so do not put a non-sale message like "10% off your first order" in `announcements` and expect it to survive). Use a real deadline with a UTC offset, for example `2026-10-07T23:59:00-05:00`.
2. **On the live store the struck-out price comes from Shopify's compare-at price.** `compareAtFor()` returns Shopify's `compareAtPrice` whenever it is higher than the price. It builds a "was" price from the packet's sale only on the demo catalog (mock.shop). Set the compare-at price on the variant in Shopify; do not try to fake it in the packet.
3. **Offers render on the demo, or when `offer.status` is `live`.** On a real store with `status: "demo"` the announcement bar, free-shipping meter and packet-derived sale lines stay hidden (a compare-at price set in Shopify still shows struck out). Switch to `live` only once the terms are real and the owner has approved.
4. **Demo offers are labeled.** The demo shows a "Demo offer" tag on the announcement bar, the sale price and the bag savings line, and the whole site carries the "Demo store · Fictional product, reviews & terms · No real orders" banner. Keep the labels on anything that is not a real, configured Shopify offer.
5. **The paid price always equals the bag price.** The price on the page is the Shopify variant price, pack totals are that unit price times the quantity, and the bag and checkout charge the same Shopify price. A "was" price, "Save N%" badge or countdown is display only; no code in the storefront changes what is charged.
6. **The demo signup collects nothing.** It is rendered only on the demo, shows "Demo preview: no email was sent or saved." and "Demo: nothing is collected." Do not say "your code is on its way" (the packet's `signup.success` text is not shown on the demo). A live store needs a connected list (Shopify Email or Klaviyo) and a real Shopify discount code before any "10% off your first order" claim is made.
7. **Check the numbers by hand.** The packet's `sale.percentOff` is typed in; nothing compares it with Shopify's price and compare-at price, and no script (`packet-tools.mjs check` or the verification suites) validates the `offer` block. Confirm that the percentage shown equals the real discount before the page is shown to the owner or goes live.

## Checks before the owner sees it

- Read the page top to bottom out loud. Cut any sentence you would not say to a friend.
- Point at each factual claim and name its source. If you can't, rewrite or remove it.
- Could a competitor paste this copy onto their product unchanged? Then it is not specific enough.
- Does each section answer a different question from the table above?
- Is the one reason to act now real (threshold, bundle, delivery date)?
- Does every offer line use a token, a real end date and, on the demo, a "Demo offer" label?

Record the draft, the owner's reaction and later measured results in the product folder and the Learning log. Promote changes to this formula only after they help on real work.
