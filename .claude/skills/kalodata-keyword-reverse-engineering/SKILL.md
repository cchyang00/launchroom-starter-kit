---
name: kalodata-keyword-reverse-engineering
shelf: research
description: Execute Numbers-First Reverse Engineering across our 200-Keyword Q4 Macro-Trend Bible on Kalodata US (country US, pageSize 100), enforce Multi-Video US Viral Density (>= 5 active viral videos across >= 3 US creators), download viral .mp4 clips, extract 3s/7s truth frames, and stage candidates into #/find and #/verify.
---

# Kalodata Keyword Reverse Engineering (`#/find` -> `#/verify`)

This skill encodes our **Numbers-First Reverse-Engineering Method** for **Step 1 · Product (`#/find`)**. We **never** scroll organic TikTok feeds hoping the algorithm feeds us a viral winner. Instead, we start from our 200-Keyword Q4 Macro-Trend Bible, brute-force query Kalodata US for rising 30-day revenue waves backed by **Multi-Video US Viral Density (`>= 5` active US viral videos across `>= 3` distinct US creators)**, download the actual US `.mp4` creator videos, extract `3s`/`7s` truth frames, and stage clean candidates into `#/find` and `#/verify`.

## Canonical References
- **200-Keyword Q4 Macro-Trend Bible:** [resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md](../../../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md)
- **TikTok-to-Meta Arbitrage Playbook:** [resources/notes/2026-11-03-tiktok-to-meta-arbitrage-and-q4-product-finding.md](../../../resources/notes/2026-11-03-tiktok-to-meta-arbitrage-and-q4-product-finding.md)
- **Intake Filters & Verification Gates:** [os/src/productGates.mjs](../../../os/src/productGates.mjs) & [workflow/CHECKS.md](../../../workflow/CHECKS.md)
- **Starting Rules & Hard Limits:** [os/data/rules.json](../../../os/data/rules.json) (`node .claude/skills/merrivy-os/scripts/os.mjs rules`)

---

## Step-by-Step Operational Playbook

### Step 1 — Select Pillar Keywords from the 200-Keyword Q4 Macro-Trend Bible
1. Read [resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md](../../../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md) and select 2–4 word hardware/problem keywords from our 8 Meta-proven categories:
   - **Pillar 1:** Emergency Blackout Lighting, Home Backup Power & Off-Grid Radio
   - **Pillar 2:** Off-Grid Water Filtration, Countertop RO & Hard-Water Shower Filters
   - **Pillar 3:** Personal Thermal Heating, Graphene Wearables & Draft Insulation
   - **Pillar 4:** Sciatica, Decompression, Foot Neuropathy & At-Home Physical Recovery
   - **Pillar 5:** Home Lockdown Security, Travel Door Locks & RF/Privacy Defense
   - **Pillar 6:** Winter Roadside Survival, Jump Starters, Tire Inflators & De-Icing Tools
   - **Pillar 7:** Holiday Hosting, Precision Kitchen Prep & Food Preservation Hardware
   - **Pillar 8:** Low-Tox Kitchen Swaps, Tactile Sleep Mixers & Sensory Regulation Hardware
2. **Never Scroll Organic Feeds:** Every discovery run starts from explicit keyword queries where sales velocity and multi-video density can be measured quantitatively.

### Step 2 — Query Kalodata US API with Strict US Headers & Lock Onto Exact Product IDs
1. Query Kalodata's search endpoint inside the authenticated Chrome session (`localhost:9222`) or via authenticated request:
   - **Endpoint:** `POST https://www.kalodata.com/overview/fullText/search` (or `POST /product/queryList`)
   - **Mandatory Headers:**
     ```json
     {
       "content-type": "application/json",
       "country": "US",
       "currency": "USD"
     }
     ```
   - **Payload (`index: "product"` FIRST, then drill into exact `product_id`):**
     ```json
     {
       "keyword": "<pillar keyword>",
       "pageNo": 1,
       "pageSize": 100,
       "index": "product"
     }
     ```
2. **NEVER Sum Broad Keyword Video Search Results Across Unrelated Products (`L374 / L376 / L379` Hard Rule):**
   - Searching a broad keyword on `/video/queryList` returns fuzzy matches for completely unrelated products (e.g., `"white noise mixer"` matched `$518k` KitchenAid stand mixers and `$574k` walking pads; `"heated shoulder"` matched `$115k` head shavers).
   - **You MUST lock onto a single 19-digit Kalodata Product ID (`https://www.kalodata.com/product/detail?id=<19-digit-id>`)** and pull **that exact product's** 30d GMV, Last-7-Days GMV (`sales/day`), daily trend curve, and **that exact product's** associated creator videos (`3–5+` real `@handle/video/<id>` links saved on the card, never just 1 video link with a text claim of "8 additional videos").
3. **Strict US Storefront & Creator Filtering:**
   - Omitting `country: "US"` returns Southeast Asia (`.sg`, `_sg`, `my`, `id`, `ph`) results whose links are dead or region-locked in the US.
   - Immediately strip any creator handle ending in `.sg`, `_sg`, `my`, `id`, `ph`, or containing non-ASCII characters, and reject any listing not denominated in `USD`.
4. **Zero Search-Query URLs Allowed (`os/src/winnerView.mjs` Exact-Link Rule):**
   - **Kalodata URL:** Must be `https://www.kalodata.com/product/detail?id=<19-digit-id>` (NEVER `https://www.kalodata.com/product?keyword=...`).
   - **TikTok Shop Listing:** Must be `https://www.tiktok.com/view/product/<19-digit-id>`.
   - **Viral Video Links:** Must save `3–5+` real `https://www.tiktok.com/@<handle>/video/<19-digit-id>` URLs in `references` and `rawVideos` (never just 1 video URL).
   - **Amazon Listing:** Must be an exact ASIN `https://www.amazon.com/dp/B0XXXXXXXX` (NEVER `https://www.amazon.com/s?k=...`).
   - **Supplier Listing:** Must be an exact 1-piece SKU URL on CJdropshipping (`/product/`) or HyperSKU (NEVER `https://www.alibaba.com/trade/search?SearchText=...`).

### Step 3 — Apply Intake Filters (`CATALOG_FILTERS` in `os/src/productGates.mjs`)
Every scraped product is evaluated against the 6 catalog intake filters (`price`, `quality`, `stores`, `videos`, `trend`, `limits`). Tally exact removal counts per filter ID for `POST /api/scraper-runs`:

1. **Multi-Video / Multi-Ad US Viral Density (`videos` filter — HARD RULE):**
   - Must have **`>= 5` active revenue-generating US viral videos/ads across `>= 3` distinct US creators** in the last 30 days.
   - At least **`2–3` distinct US videos** must each be generating **`$2,500–$100,000+` 30d video GMV**.
   - **Creator Concentration `< 55%`:** Reject any product where a single creator drives `>= 55–80%` of total 30d revenue, or where sales come passively from TikTok Shop marketplace search (`0–1` viral videos).
2. **Rising 30d/7d Trajectory (`trend` filter):**
   - Must show **`$20,000–$500,000+` 30d US GMV** (or an early breakout wave of `100–2,500` units sold and climbing) with active momentum in the last 7–14 days and **zero downtrend**.
   - Reject flat, plateaued, or post-peak decaying products.
3. **Retail Floor & Perceived Value (`price` & `quality` filters):**
   - Market price must be **`>= $24.00`** and the product must look substantial enough to command **`$45.00–$75.00+`** on our store with room for `<35%` air-landed cost and a `>= $22–$30` break-even CPA floor.
4. **Brick-and-Mortar Commodity Exclusion (`stores` filter):**
   - Reject generic items shoppers can grab at Walmart, Target, CVS/Walgreens, Home Depot, or Amazon Basics for `$12–$20` (e.g., basic knee wraps, plain humidifiers, generic flashlights).
   - Keep only products with a **distinctive physical mechanism** aimed at a specific audience and trigger problem.
5. **Hard Category Exclusions (`limits` filter — `os/data/rules.json`):**
   - Reject basic/sized apparel and shoes, generic beauty/cosmetics/topicals, supplements/ingestibles, children's/baby products, fragile glass, weapons, Complex app-paired Bluetooth audio/earbuds, and heavy multi-battery sea-freight items (`>1 kg`).

### Step 4 — Download Top `3–5+` Viral US `.mp4` Videos & Extract `3s`/`7s` High-Res Frames
For every candidate that survives Step 3:
1. Download the top `3–5+` converting US creator `.mp4` videos into `research/<round>/videos/<L###>/` (or `resources/exemplars/<L###>/`):
   - Verify each `.mp4` is a real playable video (`> 100 KB`, valid H.264/MP4 container).
2. Extract high-resolution `3s` and `7s` physical truth frames using `ffmpeg`:
   ```bash
   ffmpeg -y -ss 00:00:03 -i video_01.mp4 -frames:v 1 -q:v 2 frame_04.jpg
   ffmpeg -y -ss 00:00:07 -i video_01.mp4 -frames:v 1 -q:v 2 frame_05.jpg
   ffmpeg -y -ss 00:00:11 -i video_01.mp4 -frames:v 1 -q:v 2 frame_06.jpg
   ```
3. Visually inspect `frame_04.jpg`, `frame_05.jpg`, and `frame_06.jpg` to verify the exact physical hardware, controls, ports, and dimensions—and so `checker` and `image-maker` have verified visual truth.

### Step 5 — Stage into Launchroom (`POST /api/scraper-runs` & `PATCH /api/research`)
1. **Log the Scraper Telemetry Run (`POST /api/scraper-runs` / `research/scrape-runs.json`):**
   - Send exact, un-invented counts of `scraped`, `kept`, `keywords`, and `removed` (`price`, `quality`, `stores`, `videos`, `trend`, `limits`):
     ```json
     {
       "id": "S008",
       "at": "2026-11-05T22:00:00Z",
       "keywords": ["tactile sound mixer", "countertop ro filter"],
       "scraped": 400,
       "kept": 4,
       "removed": {
         "price": 142,
         "quality": 48,
         "stores": 96,
         "videos": 74,
         "trend": 28,
         "limits": 8
       },
       "note": "Kalodata US pillar scan (country: US, pageSize: 100)"
     }
     ```
2. **Stage Candidate Cards via `PATCH /api/research`:**
   - Write `research/<round>/BATCH.md` and `research/<round>/<L###>.md`.
   - Save each candidate card to `PATCH /api/research` with:
     - `decision`: `"CURATED — Staged from Kalodata US keyword scan into Verify"`
     - `keyword`: the exact pillar keyword that surfaced the product
     - `rawVideos`: array of `3–5+` real US viral videos (`title`, `creator`, `revenue`, `views`, `sales`, `duration`, `videoUrl`, `kalodataUrl`)
     - `rawProducts`: array of active US TikTok Shop stores selling the item (`id`, `title`, `price`, `revenue`, `sales`, `creators`, `launchDate`, `kalodataUrl`, `imageUrl`)
     - `screen.checks.provenDemand`: dated Kalodata US + Amazon + Google Trends demand points, real `trend` array (`{date, value}`), `creators` count (`>= 3`), and `liveAds` viral video count (`>= 5`).
   - **Zero Copied Data (`L313` Rule):** Never copy or reuse another card's `trend` array, `kalodataUrl`, `tiktokUrl`, `meta.url`, or `buyers.source`.

---

## Quality Gate Checklist Before Ending Any Scout Job
- [ ] All queries ran with `country: "US"`, `currency: "USD"`, `pageSize: 100`.
- [ ] Every staged card has `>= 5` active US viral videos across `>= 3` distinct US creators (`<55%` single-creator concentration).
- [ ] `3–5+` real `.mp4` videos and `3s`/`7s` truth frames (`frame_04.jpg`–`frame_06.jpg`) are saved on disk and linked on the card.
- [ ] `POST /api/scraper-runs` recorded the exact filter removal counts for `#/find`.
- [ ] Zero copied `trend` arrays or URLs (`evidenceFlags` is empty).
