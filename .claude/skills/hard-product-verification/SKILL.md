---
name: hard-product-verification
shelf: research
description: Run the 5-point hard verification funnel in Verify (#/verify -> #/winners) across F1-F6 and P1-P5: unique non-commodity mechanism, rising 30d US uptrend, active shops + viral videos, 0-2 US Meta Ad Library competitors, exact 1-piece SKU on HyperSKU/CJ (<35% air-landed cost), and 2-Kit + $4.99 unit economics.
---

# Hard Product Verification Funnel (`#/verify` -> `#/winners`)

This skill encodes our **5-Point Hard Verification Funnel** for **Step 2 · Verify (`#/verify`)**, mapping directly to the 7 gauntlet rows in `os/src/productGates.mjs` (`uptrend`, `viral`, `value`, `factory`, `profit`, `buyers`, `meta`) across `F1–F6`, `A1–A3`, and `P1–P5`. Over ~90% of scraped candidates are meant to die here so only genuine, fully verified winners with self-serve `<35%` air-shipped unit economics reach **Winners (`#/winners`)** for the owner's eye test.

## Canonical References
- **10-Point Hard Verifier Stress Test & Break-Even Floor:** [resources/notes/2026-11-04-hard-verifier-stress-test-and-breakeven-floor.md](../../../resources/notes/2026-11-04-hard-verifier-stress-test-and-breakeven-floor.md)
- **Shaunn's KPI Calculator & Scaling Rules:** [resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md](../../../resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md)
- **Verification Funnel Gates:** [os/src/productGates.mjs](../../../os/src/productGates.mjs) & [workflow/CHECKS.md](../../../workflow/CHECKS.md)

---

## The 5-Point Hard Verification Funnel

### Gate 1 — Uniqueness & Specific Audience Eye Test (`F3 looksWorth` & `F4 audienceRoom` · `value`)
1. **Inspect `3s` and `7s` Video Truth Frames (`frame_04.jpg`, `frame_05.jpg`, `frame_06.jpg`):**
   - Score the **5-Point WOW Test** (`1 point each`, `>= 3/5` required to pass `F3`):
     1. Distinct physical mechanism or silhouette not sitting on a big-box shelf;
     2. Demonstrates what it physically does within 3 seconds of video;
     3. Looks worth `$45–$85+` in real creator footage (never flimsy `$5` plastic);
     4. Delivers an immediate emotional, crisis-preparedness, or physical relief payoff;
     5. Has `3+` concrete reasons to buy compared against named alternatives.
2. **Instant Commodity Kill Rule:**
   - **FAIL immediately** if shoppers can buy an equivalent item at Walmart, Target, CVS/Walgreens, Home Depot, or Amazon Prime for `$12–$25`, or if the audience is vague (e.g., a generic knee wrap where the only answer is *"I guess old people"*).
3. **Specific Audience & Benefit Ladder (`F4 audienceRoom` & `F5 bigIssue`):**
   - Document `3+` distinct buyer avatars with specific trigger moments and tie the 3-rung benefit ladder (`functional -> emotional -> life`) to a verified issue in `resources/issues/<slug>/ISSUE.md`.

### Gate 2 — Rising 7d/30d US Uptrend Wave, Exact Kalodata Product ID & Multi-Video US Viral Density (`F1 provenDemand` · `uptrend` & `viral`)
1. **Verify Real 30d & Last-7-Days US Revenue Trajectory on the Exact Kalodata Product ID (`https://www.kalodata.com/product/detail?id=<19-digit-id>`):**
   - **FAIL immediately** if the card's GMV was inflated by summing a broad keyword search across unrelated products (`L374 / L376 / L379` rule), if `kalodataUrl` is a generic search link (`kalodata.com/product?keyword=...`), or if the sales came from 90-day-old dead videos that are no longer selling in the **Last 7 Days**.
   - Open the exact 19-digit Kalodata Product Detail ID (`country: "US"`, `currency: "USD"`) in Chrome and check **Last 7 Days vs. Last 30 Days**: confirm strong active velocity in the **Last 7 Days** (`sales/day` climbing, mostly Video Revenue rather than Livestreams, zero downtrend or post-peak decay).
2. **Enforce Multi-Video US Viral Density from the Exact Kalodata Product Page (`gate:community`):**
   - Pull the **exact Top Videos table from that Kalodata Product Detail page** for the last 7–30 days (never hallucinate creator handles or GMV numbers).
   - Require **`>= 3–5` active revenue-generating US viral videos across `>= 3` distinct US creators** for **this exact product ID**, ordered `#1` to `#6` by real sales (`gmv30d`).
   - **Save `3–6+` Real Video URLs:** Every card MUST save `3–6+` real `https://www.tiktok.com/@<handle>/video/<video_id>` links in `references` and `rawVideos` (enforced programmatically in `os/src/researchView.mjs` via `hasVerifiedVideos`).
3. **Zero Copied Data & 100% Browser-Verified Direct Links Rule (`os/src/researchView.mjs` & `winnerView.mjs`):**
   - Verify `evidenceFlags` is empty (`[]`) and `trendInDoubt` is `false`.
   - **Every single link saved on the card MUST be opened in Chrome CDP and verified to load the exact item/video (`kind: 'exact'`):**
     - Kalodata Product: `https://www.kalodata.com/product/detail?id=<19-digit-id>`
     - Kalodata Videos: `https://www.kalodata.com/video/detail?id=<19-digit-id>`
     - TikTok Videos: `https://www.tiktok.com/@<handle>/video/<19-digit-id>`
     - TikTok Shop: `https://www.tiktok.com/view/product/<19-digit-id>`
     - Amazon: `https://www.amazon.com/dp/<10-char-ASIN>` (verified in `div[data-component-type="s-search-result"]`, never cart sidebar items or unverified web-search ASINs)
     - Competitor Shopify Stores: `https://<domain>/products/<handle>`
     - Supplier: `https://cjdropshipping.com/product/...`
     - **ZERO `?SearchText=`, `?keyword=`, `/trade/search`, or `/s?k=` links allowed on sourcing, Amazon, or Kalodata.**

### Gate 3 — H.264 `.mp4` Videos + Individual `.jpg` Frame Thumbnails (`rawVideos` & `MediaStage`)
1. Download the top `3–6` viral videos from the Kalodata table using `yt-dlp`, ordered strictly `#1` to `#6` by sales.
2. **Transcode Every `.mp4` to Universal `H.264 (libx264) + yuv420p + faststart`:** TikTok's default `bytevc1` (HEVC) stream renders as a black screen in Chrome `<video>`. Always transcode with `ffmpeg -c:v libx264 -pix_fmt yuv420p -movflags +faststart`.
3. **Generate Each Video's Own `.jpg` Frame Thumbnail (`<video_filename>.jpg` at `t=0.5s`):** So every thumbnail button `#1`–`#6` under the video player in `#/winners` displays that exact video's real frame (never sharing a single static photo across different videos).

### Gate 4 — Two-Layer US Meta Ad Library Competition & Mechanism Superiority (`P1 competition` & `F6 metaGap` · `meta`)
1. **Layer 1 — Direct Twin Competitors (Same Exact Product on Meta):**
   - Search the US Meta Ad Library (`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US`) using the product's exact name and its #1 viral video hook phrase (e.g., `"793 gallons"`).
   - Pass when **`0–4` early-mover stores** are running **`0–15` active US ads** for this exact hardware/mechanism. **FAIL immediately** if `8–20+` advertisers saturate the auction.
   - Open every direct competitor's `/products/<handle>` page to record their exact retail price and launch date.
2. **Layer 2 — Category Competitors & Mechanism Superiority (`categoryCompetitors` — Required in `os/src/researchView.mjs`):**
   - Search the broader niche/problem category on Meta Ad Library (e.g., `"survival water filter"`, `"emergency water purifier"`).
   - Document `2–3+` established **Category Competitor Types** (`categoryCompetitors: [{ type, theyDo, howWeWin }]`): what other products in this category sell (e.g., suction straws you have to suck dirty water through with your mouth, or bulky 6L hunting gravity bags you have to hang from a tree) and **why our product's physical mechanism is fundamentally different and wins** (e.g., 1-touch electric pump that pours crystal-clear `0.01-micron` water straight into any drinking glass or pot).

### Gate 5 — 4-Way Unbiased Market Pricing Cross-Check, Scam-Store Filtering & CJDropshipping + Saved Image for Amy (`F2`, `P2`, `P3`, `P4` · `factory` & `profit`)
1. **Check CJdropshipping (`cjdropshipping.com/product/...`) for the Exact Item + Save a Clean Supplier Image (`resources/sourcing/<ID>-supplier.png`):**
   - Verify an **exact product URL** (never a search URL) whose housing, ports, and specs match the viral videos 1:1.
   - Save a **clean supplier product image in `resources/sourcing/<ID>-supplier.png`** and add it to `c.references` (enforced programmatically in `os/src/researchView.mjs` via `hasSavedVideoAndSupplierImg`).
   - **Amy WhatsApp Handoff Rule:** Once all checks pass and the owner clicks **Approve and build the store** on `#/winners`, send that saved `resources/sourcing/<ID>-supplier.png` image to **Amy** on WhatsApp (`Cha Sourcing & Fulfillment(Amy)`) for her exact landed quote.
2. **4-Way Unbiased Market Pricing Cross-Check & Scam-Store Filtering:**
   - Line up **4 real verified prices** side by side:
     1. **Supplier Cost + Battery/Weight Shipping Reality** (`< 1 kg`, ordinary vs. pure battery air line)
     2. **TikTok Shop Exact Listing Price** (`tiktok.com/view/product/...`)
     3. **Amazon Exact & Peer Listing Prices** (`amazon.com/dp/...`)
     4. **Meta Competitor Shopify Store Prices** (`<store>/products/...`)
   - **Flag Fake/Scam Bait Stores:** Any Meta competitor pricing near or below landed cost (e.g., `$39.99` when landed cost is `$27.50` and TikTok/Amazon sell it at `$68.29–$74.98`) is a non-shipping bait/scam store—flag it explicitly (`⚠️ Fake/Scam Price Below Cost`) and set our true unbiased retail price against legitimate market sellers (`$64.99–$99.98`), Amazon, and TikTok Shop.
3. **2-Kit Only + `$4.99` Shipping Protection Math (`P4 economics`):**
   - Calculate unit economics using our **2-Kit Only Architecture** (`1-Kit + $7.99 shipping` vs. `2-Kit Save 15% + Free Shipping` + `$4.99` Shipping Protection; zero 3-Kit, zero multi-SKU bundles). Require **`>= $30.00+` Break-Even CPA** and `>= $18–$25+` base profit per order (`2-Pack total profit > 1-Pack total profit`).

---

## Auto-Fail vs. Winners Promotion (`PATCH /api/research`)

- **When ANY Gate Fails on Saved Evidence:**
  - Immediately call `PATCH /api/research` with `status: "failed"` on the failing screen check (`provenDemand`, `dropshippable`, `looksWorth`, `audienceRoom`, `bigIssue`, `metaGap`, `buyers`, `sourceMatch`, or `contribution`) or deep gate (`demand`, `community`, `sourcing`, `fit`, `competition`), including `observedAt: "YYYY-MM-DD"`, `source` URL/file, and a clear `note` starting with `"HARD VERIFIER FAIL — ..."`.
  - Set `decision: "REJECTED — HARD VERIFIER FAIL: <concise reason>"`.
  - The product automatically exits the active pipeline into `#/verify` -> **Killed by the checks** without requiring any owner click.
- **When ALL Gates Pass (`F1–F6`, `A1–A3`, `P1–P5`):**
  - Save `research/<round>/prove/L###.md` with the 6-line verdict table at the top.
  - Patch all `screen.checks` (`provenDemand`, `dropshippable`, `looksWorth`, `audienceRoom`, `bigIssue`, `metaGap`, `buyers`, `sourceMatch`, `contribution`) as passing and all `gates` (`demand`, `community`, `fit`, `competition`, `sourcing`) as `"supported"` with dated, linked evidence.
  - Ensure `evidenceFlags` is `[]` and **never invent fake pre-launch ad spend, ROAS, or Shopify revenue stats**.
  - The card automatically surfaces on **Winners (`#/winners`)** for the owner's `Approve & Build Store` or `Reject` decision.
