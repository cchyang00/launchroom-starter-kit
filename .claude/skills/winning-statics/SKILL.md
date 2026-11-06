---
name: winning-statics
shelf: images
description: Recreate proven, high-converting static image ads at scale (20-static batch: 10 Problem-Aware + 10 Solution-Aware) by first deconstructing the product's winning viral TikTok videos + competitor research, mapping them to our 50 reference statics (static_01..50.png in concept-library.md), and generating them in Google Flow (https://labs.google/fx/tools/flow) in Chrome with zero Antigravity credit drain.
---

# Winning-Statics — Proven Viral-Video-to-Static Ad Recreation at Scale

Owner Doctrine (November 5, 2026):
> *"Lazy dropshippers ('rippers') just download viral TikTok videos, throw them into Meta, and hope. We run the top 1–3 viral videos too, AND we win because we pair them with 20 high-converting Static Image Ads (10 Problem-Aware + 10 Solution-Aware) extracted directly from those winning viral videos + our competitor research."*
> *"How do you find a good static? Listen to the viral video! If the viral video says 'There's a 5-step filtration process that removes glass shards and minerals down to 0.1 micron,' that's why the video went viral—turn that exact mechanism and problem into your statics!"*

You recreate high-performing static image ads by combining **why the product's top viral videos went viral** with the proven structural psychology of our **50 winning reference statics (`agents/image-generator/references/layouts/static_01.png`–`static_50.png`)**. You never invent ad concepts from scratch, and you never generate images via paid API keys or Antigravity's built-in `generate_image` tool—every static is generated inside **Google Flow (`https://labs.google/fx/tools/flow`)** in the owner's signed-in Chrome browser.

**Read [references/concept-library.md](references/concept-library.md) and [sbc-statics-2-0](../sbc-statics-2-0/SKILL.md) before selecting references.**
`references/concept-library.md` is the brain (9 concept families `F1–F9`, per-reference mechanisms, Swap vs. Preserve rules, and handling flags); the 50 PNG files in `agents/image-generator/references/layouts/static_01.png`–`static_50.png` are the eyes. Google Flow must **SEE** both the reference layout PNG and the real product truth photo on every generation.

---

## Phase 1 — Deconstruct the Winning Viral Videos & Competitor Research First

Never write static ad concepts from a blank page or generic assumptions. Before picking a single reference layout:

1. **Transcribe & Inspect the Downloaded Winning Viral Videos (`products/P###-slug/assets/` / `kalodata_top20_manifest.json`):**
   - Extract the **spoken audio transcript** (first 3-second hook, middle mechanism explanation, and closing payoff) and **key visual demonstration frames** (`frame_01.jpg`–`frame_06.jpg`) from the product's top viral TikTok videos.
   - Pinpoint the exact **Viral Mechanism & Numbers** spoken or demonstrated in the video (e.g., *"5-step filtration process that removes glass shards, heavy metals, and microplastics down to 0.1 micron"*; *"Split-panel 16.4ft waterproof cord charges outside while lighting up the indoor ceiling dome for 12 hours"*).
   - Pinpoint the **Scary Hidden Problem / Trigger Moment** the video exposes (what the viewer didn't realize was happening in their home, water, body, or daily routine).
2. **Cross-Reference Competitor Research & 4–5 Star Amazon Reviews (`research/<round>/buyers/L###.md`):**
   - Extract the **top 3 features buyers rave about** in 4–5 star reviews.
   - Extract **why ordinary store-bought alternatives or cheap knockoffs fail** (from 2–4 star competitor reviews and Meta Ad Library competitor gaps).
3. **Establish the Causal Chain (`sbc-statics-2-0`):**
   - Map every claim as: **`feature / stage (from viral video) -> what it actually does -> practical benefit -> why that matters in this person's day`**.

---

## Phase 2 — Plan the 20-Static Concept Ledger (`10 Problem-Aware` + `10 Solution-Aware`)

Open [references/concept-library.md](references/concept-library.md) and construct a 20-row **Concept Ledger** in `products/P###-slug/creative/COPY-BRIEF.md` (or `JOB.md`) split into two 10-ad batches:

### Batch A — `10 Problem-Aware / Unaware Statics` (Ads `01–10`)
- **Goal:** Stop the cold scroller who isn't shopping by making them aware of a scary hidden problem they never knew existed or walking them through a concrete physical domino chain ending in *"What will you do?"*—pulled directly from the viral video's problem hook and demonstration.
- **Reference Families & Pool:**
  - **`F8` Problem-Agitation (`static_07`, `static_09`, `static_22`, `static_27`, `static_31`, `static_49`):** Visceral problem visualization, flashlight-on-label exposé, pattern-interrupt photography, or anatomy/system breakdown (product small or absent).
  - **`F2` Illustrated Mechanism Diagrams (`static_01`, `static_05`, `static_10`, `static_44`, `static_45`):** Step-by-step illustrated filtration/process stages, timeline silhouettes, or condition contrast showing *why* the problem happens and how the mechanism fixes it.
  - **`F7` Editorial / Insider Authority Notes (`static_03`, `static_06`):** Serif editorial story or numbered notebook notes exposing a hidden truth.
  - **`F1` Photographic Before/After & Crisis Arc (`static_11`, `static_15`, `static_30`):** Documented 3-panel `Problem -> Fix -> Result` sequence or unretouched side-by-side transformation.

### Batch B — `10 Solution-Aware / Competitor-Superiority Statics` (Ads `11–20`)
- **Goal:** Convert viewers who now understand the problem by proving why our product's mechanism (from the viral video + 4–5 star reviews) crushes ordinary alternatives and cheap copycats.
- **Reference Families & Pool:**
  - **`F4` Us-vs-Them Comparison (`static_04`, `static_24`, `static_33`, `static_38`, `static_41`, `static_48`):** Month-1 vs. Month-6 durability matrix (`static_24`), "Tested 5 / 4 Scams" exposé (`static_33`), expert whiteboard X/✓ table (`static_38`), two-column complement table (`static_41`), or factory-part vs. upgraded-part split (`static_48`).
  - **`F3` Annotated Product Callouts (`static_12`, `static_32`, `static_42`):** Exact product truth hero with 3–5 callout lines pointing to the viral video's key engineering stages + trust bar.
  - **`F5` Testimonials, Post-Its & IG Story AMA (`static_14`, `static_17`, `static_19`, `static_25`, `static_40`, `static_46`):** Handwritten Post-It note under casual product shot (`static_14`), warm lifestyle scene with 1st-person quote (`static_25`), portrait testimonial (`static_19`), or native IG Story AMA box (`static_46`) using verified review language and our Avatar Persona POV (`Olivia Scott — Verified Buyer` or `Michael L — Verified Buyer`).
  - **`F6` & `F9` Big-Claim Hero & Checklists (`static_02`, `static_08`, `static_18`, `static_21`, `static_28`, `static_34`, `static_35`, `static_39`, `static_47`, `static_50`):** Faucet/action hero + 3-stat strip (`static_02`), hand-press flex demo (`static_28`), 4-avatar identity grid (`static_35`), price-integrity breakdown (`static_47`), or 4-check benefit rail (`static_50`).

**Selection Guardrails:**
- Assign **20 distinct reference PNGs** across the 20 ads (1 reference per ad).
- **Never** place both `VARIANT-OF` siblings (`static_10` and `static_26`) in the same batch.
- Ensure every row in the Concept Ledger has a distinct **meaning/hook**, **real-life moment**, and **visual structure** (see `sbc-statics-2-0`).

---

## Phase 3 — Construct Per-Image Prompts (Swap / Preserve + Flag Protocols)

Build one complete, self-contained generation prompt per static ad combining:
1. **Reference Static (`agents/image-generator/references/layouts/static_XX.png`):** Replicate its layout skeleton, reading path, text placement zones, and visual hierarchy 1:1. (Ignore any external screenshot chrome or URL bars captured on `static_12`/`static_24`.)
2. **Real Product Truth Photo (`products/P###-slug/assets/truth/` or viral video frame):** Preserve 100% physical fidelity—exact housing geometry, label text, colorway, ports, stitching, and proportions.
3. **Swap Instructions (from `concept-library.md`):**
   - Brand palette matched to the product's storefront theme (`palettes.json`).
   - Top hook headline (`3–7` words where layout permits) + callout labels written from the viral video's exact mechanism and 4–5 star reviews.
   - Strictly 2-Kit / Free Tracked Shipping / 30-Day Guarantee offer badges (never 3-Kit or coupon-code boxes painted onto the image).
4. **Preserve Instructions (from `concept-library.md`):**
   - Keep the reference's exact composition, callout arrow geometry, split-screen ratio, and typographic contrast.
5. **Explicit Verbatim Quoted Text:**
   - Enclose every single text string to be rendered on the image inside exact quotation marks (`"..."`) with its exact zone placement (`Top headline:`, `Left column header:`, `Callout badge 1:`, etc.), demanding **`>= 6%` safe edge margins**.

### Flag Protocols (Inject Automatically When Flagged in `concept-library.md`)
- **`REALISM` Flag ON (`F1`, `static_04`, `static_08`, `static_11`, `static_15`, `static_17`, `static_18`, `static_19`, `static_27`, `static_28`, `static_30`, `static_34`, `static_35`, `static_37`, `static_38`, `static_46`, `static_50`):**
  > *"Photorealistic candid 8K DSLR photography. Natural skin texture with visible pores and fine lines. Realistic subsurface skin tones. Imperfect ambient lighting. No beauty-filter smoothing, no plastic AI sheen, no idealized symmetry. Match the unretouched realism of the reference image."*
  - For Before/After (`F1` / `static_11`, `static_15`, `static_30`): protect the before-state (do not beautify it) and lock identity across panels (same person, camera angle, and lighting environment).
- **`LOC` Flag ON (`static_01`, `static_02`, `static_03`, `static_05`, `static_12`, `static_16`, `static_23`, `static_32`, `static_37`, `static_41`, `static_43`, `static_48`):**
  - Localize spelling, currency (`$`), units (`ft`, `oz`, `micron`), and seasonal references to our target markets (`US / CA / UK / AU`).
  - Never invent a regulator logo or medical certification (`GPHC`, `FDA`, etc.)—swap regulator badges to our verified review rating (`★★★★★ 4.9/5`) or `30-Day Money-Back Guarantee`.
- **`STRUCT-ONLY` Flag ON (`static_04`, `static_06`, `static_33`, `static_34`, `static_42`):**
  - Replicate the visual structure only; strip borrowed third-party authority. Replace press logos with verified capability chips, replace named endorsers with real buyer persona proof, and genericize rival products in `static_33` into unbranded ordinary lookalikes (never render competitor trademarks).
- **`CLAIM` Flag ON:**
  - Verify the copy passes Meta's Personal Attributes & Acceptable Business Practices scan (`C3` / `claims-rights`: no *"Do you suffer from..."* or medical cure claims). Include a one-line platform note in the batch summary for aggressive visual contrast layouts.

---

## Phase 4 — Generate in Google Flow (`https://labs.google/fx/tools/flow`) in Chrome

**Hard Rule — Zero Antigravity Credit Drain & Zero Python PIL:**
- **ALWAYS generate inside Google Flow (`https://labs.google/fx/tools/flow`)** in the owner's signed-in Chrome browser over CDP (`port 9222` via `python -m scripts.automation.cli` or Chrome MCP `tabs_create_mcp` — see [google-flow-creative-studio](../google-flow-creative-studio/SKILL.md) and [browser-use](../browser-use/SKILL.md)).
- **NEVER** run `scripts/generate.py` with a paid `$GEMINI_API_KEY`, **NEVER** call Antigravity's built-in `generate_image` tool, and **NEVER** draw static ads or callouts with Python PIL / Pillow / HTML Canvas / SVG.

### Per-Image Google Flow Execution Loop:
1. Open a dedicated temporary tab in Chrome at `https://labs.google/fx/tools/flow` and select `4:5` (`1080x1350`) or `1:1` (`2048x2048`) aspect ratio.
2. Upload **both**:
   - **Input A:** The product's real truth image (`products/P###-slug/assets/truth/...`).
   - **Input B:** The selected reference layout PNG (`agents/image-generator/references/layouts/static_XX.png`).
3. Submit the constructed Phase 3 prompt, wait for rendering to complete, and download the full-resolution image to `products/P###-slug/creative/ads/`.

---

## Phase 5 — Full-Size & Mobile-Feed QC + Pair With `sbc-statics-2-0` Copy

Inspect every downloaded static image via `read_file` before marking it complete:
1. **Product Fidelity:** Exact housing/label geometry preserved from the truth photo; zero fake/competitor brand logos; zero hallucinated ports or parts.
2. **Text & Margins:** Every quoted headline, callout, and badge is spelled 100% correctly, legible at mobile-feed size, with `>= 6%` safe margins from all edges.
3. **Structural Fidelity:** Matches the chosen `static_XX.png` skeleton, hierarchy, and `REALISM` / `STRUCT-ONLY` / `LOC` rules.
4. **Regenerate Failures:** If any text is garbled/clipped or the product drifted, refine the prompt and regenerate inside Google Flow before delivery.
5. **Deliver With 5 Evergreen Captions & 5 Short Headlines (`sbc-statics-2-0`):**
   - Pair the completed 20-static batch (`10 Problem-Aware` + `10 Solution-Aware`) with the **5 long-form evergreen Facebook captions (`250–400 words`)** and **5 short reusable headlines (`4–9 words`)** defined in [sbc-statics-2-0](../sbc-statics-2-0/SKILL.md).
