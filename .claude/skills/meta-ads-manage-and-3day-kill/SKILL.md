---
name: meta-ads-manage-and-3day-kill
shelf: copy
description: Manage Meta CBO launches (#/launch) and post-launch daily monitoring in Manage (#/manage — Daily Numbers, Ad Testing, Store & CRO, Scale or Cut), running live Meta Graph API v22.0 + Shopify syncs with 4 Data-Integrity Guards and enforcing the 3-Day Algorithm Priming & End-of-Day 3 Kill / Scale Rule.
---

# Meta Ads Launch, Live Sync & 3-Day Algorithm Priming / End-of-Day 3 Kill Playbook

This skill governs **Step 6 · `Launch` (`#/launch`)** and our top-level **`Manage` (`#/manage`)** workspace (`Daily Numbers`, `Ad Testing`, `Store & CRO`, and `Scale or Cut`). Every launched product is managed from Launchroom (`http://localhost:3000/p/merrivy/`) using reconciled Meta Graph API `v22.0` and Shopify Admin data—never partial snapshots, never intraday panic pauses, and never morning kill decisions.

---

## Step 1 — Pre-Launch Setup (`#/launch`)

Before any spend is authorized in `#/launch`, verify all 5 launch gates (`L1–L5` in `workflow/CHECKS.md`) and confirm the campaign structure:

1. **7/7 Pre-Launch Checklist Passed (`#/checklist`):**
   - Storefront mobile design (`375px`), copy angles, 2-Kit Only (`1-Kit` + `$7.99` shipping vs. `2-Kit` Save 15% + Free Tracked Shipping) + `$4.99` Shipping Protection math, layout QoL, Shopify Admin variants (`ndfdtc-br.myshopify.com`), category-isolated Meta Pixel, and supplier fulfillment (HyperSKU / CJ `<35%` landed cost verified first) must be `7/7`.
2. **`$50/day` Broad CBO Budget & Tier-1 Markets:**
   - Default first-test budget: **`$50/day` Broad CBO** (`OUTCOME_SALES`, `LOWEST_COST_WITHOUT_CAP`), open age (`18–65+`), open gender, Advantage+ Placements.
   - Target all 5 English tier-1 markets (`US`, `CA`, `GB`, `AU`, `NZ`) unless restricted by supplier shipping.
   - First-test loss limit: **`$50`** (owner rule in `os/data/rules.json`).
3. **Avatar Persona Page & Category-Isolated Meta Pixel:**
   - Bind the ad identity to the matching Avatar Persona Page (**`Olivia Scott`** for women's / home / beauty / wellness or **`Michael L`** for men's / gear / problem-solving).
   - Verify that the campaign optimizes for the product's **dedicated category-isolated Meta Pixel** (`1` Pixel per niche—never share a Pixel across unrelated audiences) and fires exactly **one** `Purchase` event (`L3`).
4. **Disciplined Day 1 Creative Pack (`1–3` Top Viral `.mp4` Videos + `4–5` DR Static Ads):**
   - Launch with the **top `1–3` proven viral `.mp4` creator videos** and **`4–5` photorealistic `4:5` DR static ads** (`3–7` word hook, `3` buyer-praised features from 4–5 star Amazon reviews, and `1st-person` avatar persona card).
   - Never dilute a `$50/day` CBO across 15–20 videos on Day 1.
5. **Shaunn's Breakeven & Target CPA Guardrails (`resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md`):**
   - Record `breakevenCpa` (`AOV - Landed COGS - Processing Fees`), `targetCpa` (`0.75 * breakevenCpa`), `breakevenRoas` (`AOV / breakevenCpa`), and `killFloorSpend` (`1.0x–1.5x` Target CPA with `0` ATC, or End-of-Day 3 review) in `os/data/meta-campaigns.json`.
   - Once the owner approves and launches in `#/launch`, run `python scripts/sync_pipeline_checks.py` so `experiment-plan` and `authorized-test` are verified and the product moves out of Build & Launch into **`Manage` (`#/manage`)**.

---

## Step 2 — Live Meta & Shopify Sync (`scripts/sync_meta_campaigns.py` & `POST /api/meta-campaigns { action: "sync" }`)

Launchroom automatically runs `scripts/sync_meta_campaigns.py` every 15 minutes in the background and on-demand whenever the owner clicks **`Sync Live Meta & Shopify Now`** in `#/manage` (`POST /api/meta-campaigns` with `{"action": "sync"}`).

### How the Sync Queries Live Data
- Queries **Meta Graph API `v22.0`** (`act_9818342388208988`, the owner's Cha Yang ad account) with **BOTH**:
  1. `date_preset(maximum)` — Full Product Age / Lifetime totals across every day the campaign has run.
  2. `time_increment=1` (`date_preset=maximum`) — Complete Day-by-Day breakdown (`dailyBreakdown[]` on the campaign and every ad).
- Queries **Shopify Admin API (`2025-01`)** on `ndfdtc-br.myshopify.com` for real non-test, non-cancelled orders, gross/net revenue, customer names, line items, and fulfillment status, matching orders back to each launched campaign via `orderKeywords`.

### The 4 Mandatory Data-Integrity Guards
Every sync enforces these 4 guards before writing `os/data/meta-campaigns.json`:
1. **Monotonic Lifetime Spend (`new_lifetime_spend >= old_lifetime_spend`):**
   - A campaign's lifetime spend can never decrease over time. If a partial or rate-limited API response returns less spend than already recorded for the same `campaignId`, the sync preserves the higher verified spend and logs an integrity warning.
2. **Daily Sum Reconciliation (`sum(dailyBreakdown.spend) == summaryLifetime.spend`):**
   - Reconciles `sum(dailyBreakdown[].spend)` against `summaryLifetime.spend` (tolerance `$0.05`). If `date_preset(maximum)` lags today's intraday spend or vice versa, the sync reconciles the lifetime summary to `max(lifetime_spend, sum(daily_spend))` so the lifetime KPI strip and the Day-by-Day table in `#/manage` never contradict each other.
3. **Purchase Event Priority (Zero Double-Counting):**
   - Extracts purchases in strict priority order: `omni_purchase` -> `purchase` -> `offsite_conversion.fb_pixel_purchase` (never summing multiple aliases of the same conversion event), and cross-checks against real Shopify orders.
4. **Duplicate Ad Name Aggregation Across Ad Sets:**
   - When the same creative (`name`) runs across multiple ad sets (e.g., `Ad Set 1` + `Ad Set 2`), aggregates `spend`, `impressions`, `clicks`, `atc`, `ic`, `purchases`, `purchaseValue`, and per-day `daily[]` slices under one combined creative row while tracking `adSetCount` and `liveActiveCount`.

---

## Step 3 — Daily Numbers & Ad Testing (`#/manage?tab=overview` & `#/manage?tab=ads`)

### 1. Daily Numbers (`#/manage?tab=overview`)
- Audit the **Day-by-Day Query Table** (`Day`, `Date`, `Spend`, `Shown`, `Clicks`, `CTR`, `CPC`, `ATC`, `Checkout`, `Orders`, `Revenue`, `CPA`, `ROAS`, and `Day Status`) alongside the **Day Window Switcher (`All Days / Day 1 / Day 2 / Day 3 / Day 4+`)**.
- Check each day against our baselines:
  - **Outbound CTR:** `>= 1.5%` (Day 1) / `>= 2.0%` (Day 2–3); `< 1.0%` is a hook/angle failure.
  - **CPC:** `< $1.50` (`< $0.80` strong).
  - **ATC Rate (`ATC / Clicks`):** `>= 6–8%`.
  - **CPA:** `<= Breakeven CPA` (green when `<= Target CPA`).

### 2. Ad Testing (`#/manage?tab=ads`)
- Ads are automatically ranked **`Best -> Worst`** across 4 tiers:
  1. **Sale Makers (`Purchases >= 1`)** — sorted by highest ROAS / lowest CPA.
  2. **Cart Builders (`ATC >= 1` or `IC >= 1`, `0` Purchases)** — sorted by highest ATC count, then CTR.
  3. **Hook Winners (`Clicks >= 1`, `0` ATC)** — sorted by highest CTR.
  4. **0-Click Bleeders (`0` Clicks, Spend `> $0`)** — sorted by highest wasted spend.
- **HARD RULE — Never Pause Intraday & Never Turn Off Yesterday's Winners:**
  - **Never pause an ad in the middle of the day.** Let the full day finish so late-afternoon and evening buyers are counted.
  - **Never turn off an ad that had good metrics the day before** (`Purchases >= 1`, `ATC >= 1`, `IC >= 1`, or strong `CTR >= 2.0%`). Keep every winning ad running untouched so Meta's delivery algorithm compounds on its social proof and pocket of buyers.
  - Cut only dead `0`-click / `0`-ATC bleeders *after* a full day closes, and add fresh creative evolutions alongside the untouched winners.

---

## Step 4 — The 3-Day Meta Algorithm Priming & End-of-Day 3 Kill / Scale Rule (`#/manage?tab=grow`)

Owner rule (Nov 5):
> *"Normally we will run ads on a product for at least 3 days. Each day should be hitting a baseline for metrics. At least 1 sale on the first day. Remember the first two days is priming the algorithm for Meta to find us buyers at the right time and who to push it to. Then the 3rd day is where we really critique the metrics when the algorithm has a good understanding of our product and creatives and website. If the metrics are bad on the 3rd day and we wait until the end of the 3rd day (not the beginning because buyers purchase at different times of the day) and it's still not good, we will most likely cut the product."*

| Day Window | Role & Budget | Expected Baseline | Required Action |
| --- | --- | --- | --- |
| **Day 1 · Algorithm Priming** | `$50/day` Broad CBO | **At least `1` sale** (or strong early `ATC >= 3–4` + `IC >= 1` with `CTR >= 1.5–2.0%` and `CPC < $1.50`). | Let all ads run untouched for the full 24 hours so the category Meta Pixel learns who clicks and carts. |
| **Day 2 · Compounding + Iteration** | `$50/day` Broad CBO | **Improved Day-over-Day CPA / ROAS / ATC** (`1–2+` sales or compounding ATC/IC velocity). | Keep **all** Day-1 ads with sales/ATC/strong CTR running untouched; cut only dead Day-1 `0`-click bleeders; deploy `store-builder` CRO fixes (`#/manage?tab=store`) if Clicks are high but ATC/Orders lag. |
| **Day 3 · Learned-Algorithm Critique (WAIT UNTIL END OF DAY 3)** | `$50/day` Broad CBO | **Profitable / Breakeven CPA (`<= Breakeven CPA`), `ROAS >= Breakeven ROAS`, consistent orders.** | **Never judge or kill in the morning of Day 3**—buyers purchase at different times of day. Evaluate at the **END of Day 3** (`11:59 PM` store time). If Day 3 still misses baseline or regresses, recommend **`Cancel & Wipe Product`**. |
| **Day 4+ · Scale & Custom Flow Veo AI Video Ads** | Surf-scale (`+20–30%` or `$50 -> $100/day`) | Consistent daily orders at or below Target CPA (`ROAS >= 1.8x–2.5x+`). | Scale winning CBO budgets and coordinate with `image-maker` to produce custom **Google Flow Veo 3.1 AI video ads** (`https://labs.google/fx/tools/flow` in Chrome, zero credit drain) for new hooks and avatars. |

### Cleanly Cancelling a Failed Product at the End of Day 3 (`Cancel & Wipe Product`)
When the owner confirms cutting a product after the End-of-Day 3 review:
1. Pause the Meta campaign in Ads Manager (or confirm it is `PAUSED`).
2. Trigger `POST /api/meta-campaigns` with `{"action": "cancel-product", "productId": "<P###-slug>", "campaignId": "<campaignId>", "reason": "End of Day 3 kill rule: ..."}` (or the **`Cancel & Wipe Product`** button in `#/manage?tab=grow`).
3. Verify that `cancelProductAndWipe()` archives the product out of `products/`, removes its active campaign from `os/data/meta-campaigns.json`, clears `workspace.json` (`activeProductId` / `build`), and resets `hydrogen-storefront/app/content/templates.ts` to `base-theme.json` so MiniOxygen (`localhost:3021`) stays healthy.
