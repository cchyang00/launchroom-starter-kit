---
name: google-flow-creative-studio
shelf: images
description: Generate 8K DSLR-grade product gallery photos (#/build), 20-Static Ad Packs (10 Problem-Aware + 10 Solution-Aware extracted from winning viral videos & competitor research for #/create & #/assets), and Day 4+ custom 9:16 Veo 3.1 AI video ads using Google Flow (https://labs.google/fx/tools/flow) in the owner's signed-in Chrome browser (zero Antigravity credit drain) by combining real product truth frames with static_01..50.png reference layouts.
---

# Google Flow Creative Studio (`#/build`, `#/create`, `#/assets`)

Owner Rules (November 5, 2026):
> *"What I want to do for image generation, video, or anything related to ads or creatives: we're going to use Flow. When we're using Gemini in here to generate those images, it actually eats up credit. If you actually go and open up a Flow tab and use Flow to generate those images, it's pretty much unlimited, and it doesn't eat up the usage in anti-gravity. That's a preferred way to do it. For now and in the future, unless something changes, we're going to use Flow."*
> *"Lazy dropshippers ('rippers') just download viral TikTok videos, throw them into Meta, and hope. We run the top 1–3 viral videos too, AND we win because we pair them with 20 high-converting Static Image Ads (10 Problem-Aware + 10 Solution-Aware) extracted directly from those winning viral videos + our competitor research."*

This skill encodes the end-to-end operational method for generating all Merrivy product gallery slides (`2048x2048` `1:1`), our **20-Static Ad Batch (`10 Problem-Aware` + `10 Solution-Aware` at `1080x1350` `4:5`)**, and Day 4+ custom `9:16` Veo 3.1 video ads inside **Google Flow (`https://labs.google/fx/tools/flow`)**.

Always load and follow our companion static & copy skills alongside this skill:
- **[winning-statics](../winning-statics/SKILL.md)** & **[concept-library.md](../winning-statics/references/concept-library.md)** (`F1–F9` families, `static_01.png`–`static_50.png` Swap/Preserve rules, and `REALISM` / `LOC` / `STRUCT-ONLY` / `CLAIM` protocols).
- **[sbc-statics-2-0](../sbc-statics-2-0/SKILL.md)** (20-row Concept Ledger diversity audit, causal mechanism chain, and **5 long-form evergreen captions `250–400 words` + 5 short headlines `4–9 words`**).
- **[viral-hook-and-dr-copywriting](../viral-hook-and-dr-copywriting/SKILL.md)** (viral video hook harvesting, Website vs. Ad Headline Split, Unaware-Scroller domino chain, Avatar Persona POV).

---

## 1. Hard Rule 1 — Always Use Google Flow (`https://labs.google/fx/tools/flow`) in Chrome (Zero Antigravity Credit Drain)

1. **Mandatory Generation Engine:**
   - Open a dedicated **Google Flow tab (`https://labs.google/fx/tools/flow`)** in the owner's signed-in Chrome browser over CDP (`http://127.0.0.1:9222` via `python -m scripts.automation.cli` or Chrome MCP `tabs_create_mcp` — see [browser-use](../browser-use/SKILL.md)).
   - **NEVER call Antigravity's built-in `image-generator` (`generate_image`) / Gemini API tool**—doing so burns Antigravity usage credits. Google Flow in the owner's signed-in Chrome session is unlimited and has zero Antigravity credit drain.
   - **NEVER draw ads, product callouts, or comparison graphics with Python PIL / Pillow / HTML Canvas / SVG.** Flat vector overlays and Python-drawn boxes fail the `P004` Witching Hour 8K DSLR benchmark and cause "dwell-time spend hog" traps on Meta (`STATIC_P007_C02` ate `$6.98` with `0` Landing Page Views because small boxes made users squint without clicking).

2. **Browser Session Hygiene:**
   - Always open your own temporary Flow tab (`tabs_create_mcp` or `python -m scripts.automation.cli open "https://labs.google/fx/tools/flow" --new-tab`), pass your `tabId` / `--url-match "labs.google"` on every step, download full-resolution outputs, and close your temporary tab when the job finishes.

---

## 2. Hard Rule 2 — Mandatory Dual Visual Inputs in Google Flow (`winning-statics` Protocol)

Every single image generation in Google Flow **MUST** upload and combine **two visual inputs** simultaneously ([REFERENCE-TO-AD.md](../../../agents/image-generator/references/REFERENCE-TO-AD.md) & [concept-library.md](../winning-statics/references/concept-library.md)):

1. **Input A — Real Product Truth Photos (Physical Accuracy Lock):**
   - Upload `1–3` high-resolution extracted frames from the product's viral creator videos (`frame_04.jpg`, `frame_05.jpg`, `frame_06.jpg`) or verified clean supplier SKU photos (`products/P###-slug/assets/truth/`).
   - The generated output must preserve 100% fidelity to the shipped hardware: exact housing geometry, ports, buttons, stitching, weave, cord length, and colorway. Never invent features or alter what the customer receives in the box.
2. **Input B — One Specific Reference Layout PNG (`static_01.png`–`static_50.png`):**
   - First, deconstruct the product's **winning viral TikTok videos** (spoken hook, mechanism numbers like *"5-step filtration down to 0.1 micron"*, visual demo) + competitor research + 4–5 star Amazon reviews.
   - Inspect [concept-library.md](../winning-statics/references/concept-library.md) ([CONCEPTS.md](../../../agents/image-generator/references/CONCEPTS.md) / [INDEX.md](../../../agents/image-generator/references/INDEX.md)) and select **20 distinct reference PNGs** from `agents/image-generator/references/layouts/static_01.png` through `static_50.png` split across two 10-static batches:
     - **Batch A — `10 Problem-Aware / Unaware Statics`:** Expose a scary hidden problem or urgent crisis domino chain pulled from the viral video's hook, mapped to **`F8` Problem-Agitation** (`static_07`, `static_09`, `static_22`, `static_27`, `static_31`, `static_49`), **`F2` Illustrated Mechanism Diagrams** (`static_01`, `static_05`, `static_10`, `static_44`, `static_45`), **`F7` Editorial Notes** (`static_03`, `static_06`), and **`F1` Before/After & Crisis Arc** (`static_11`, `static_15`, `static_30`).
     - **Batch B — `10 Solution-Aware / Competitor-Superiority Statics`:** Prove why our product's mechanism beats competitors and cheap alternatives using the viral video's proof + 4–5 star reviews, mapped to **`F4` Us-vs-Them Comparison** (`static_04`, `static_24`, `static_33`, `static_38`, `static_41`, `static_48`), **`F3` Annotated Product Callouts** (`static_12`, `static_32`, `static_42`), **`F5` Testimonials, Post-Its & IG Story AMA** (`static_14`, `static_17`, `static_19`, `static_25`, `static_40`, `static_46`), and **`F6`/`F9` Big-Claim Hero & Checklists** (`static_02`, `static_08`, `static_18`, `static_28`, `static_34`, `static_35`, `static_39`, `static_47`, `static_50`).
   - Upload the chosen `static_XX.png` alongside the product truth photo(s) in Google Flow and apply the entry's **Swap**, **Preserve**, and **`REALISM` / `LOC` / `STRUCT-ONLY` / `CLAIM`** flags from `concept-library.md`.

---

## 3. Hard Rule 3 — `4:5` Direct-Response Static Ad Anatomy (`1080x1350`)

Every `4:5` static ad generated for **Step 4 · Creatives (`#/create`)** and the **Assets & Creatives Hub (`#/assets`)** must follow our proven Meta Andromeda conversion rules ([2026-11-04-meta-ad-performance-and-urgency-playbook.md](../../../resources/notes/2026-11-04-meta-ad-performance-and-urgency-playbook.md), [WHATS-GOOD.md](../../../resources/copywriting/WHATS-GOOD.md), & [sbc-statics-2-0](../sbc-statics-2-0/SKILL.md)):

1. **Viral-Video Mechanism + Unaware-Scroller Domino Chain (`"What Will You Do?"`):**
   - Ground every static in the exact mechanism/problem demonstrated in the winning viral videos (`feature/stage -> what it actually does -> practical benefit -> why that matters in this person's day`).
   - For Batch A (`10 Problem-Aware`), visualize the concrete physical domino chain (e.g., *grid fails -> fridge warms -> phone dies -> pitch-black house -> family looks at you*; or *municipal line breaks -> clear water hides 0.1-micron glass shards & heavy metals*) and force the self-interrogation question (*"What will you do?"*).
2. **`3–7` Word Hook Headline (`<0.8s` Scan Time) & Verbatim Quoted Strings:**
   - Keep the primary top-of-image hook between **3 and 7 words** (`"When the grid fails tonight"`, `"Built for Homeowners Who Refuse Darkness"`, `"Every time I open this in a coffee shop..."`). Specify every text string verbatim inside quotation marks (`"..."`) in the Google Flow prompt.
3. **`3` Best Buyer-Praised Features Strip or Us-vs-Them Comparison Table (Batch B):**
   - Pull the **top 3 features praised in 4–5 star Amazon & TikTok Shop reviews** (plus the viral video's exact mechanism numbers) and display them as a clean callout strip (`F3`/`F6`) or 2-column Us-vs-Them comparison (`F4`) so the scroller is sold before clicking.
4. **1st-Person Avatar Persona Card on Testimonial Layouts (`F5`):**
   - When using testimonial/Post-It/AMA layouts (`static_14`, `static_17`, `static_19`, `static_25`, `static_40`, `static_46`), include a 1st-person verified-buyer quote card matching our active Meta Avatar Persona Page:
     - **`Olivia Scott — Verified Buyer ★★★★★`** (for female-skewed / lifestyle / journal / comfort products).
     - **`Michael L — Verified Buyer ★★★★★`** (for male / homeowner / preparedness / hardware products).
5. **8K DSLR Micro-Contrast (`P004` Witching Hour Benchmark) & `>= 6%` Safe Margins:**
   - Benchmark every output against `products/P004-witching-hour-2027-weekly-planner/creative/ads/` (`ad-c1`–`ad-c13`, `ad-dr25`).
   - Require tack-sharp 8K DSLR lighting, natural skin/hand textures (`REALISM` protocol), **zero fake or competitor brand logos** (`STRUCT-ONLY` protocol), zero coupon-code boxes painted onto the image, and **`>= 6%` safe edge margins** so text is never clipped on Instagram/Facebook feeds.

---

## 4. Hard Rule 4 — Store Gallery Slides (`2048x2048` `1:1`) & Video + Static Ad Cadence

### A. Storefront Hero Carousel Slides (`6–7` Square `1:1` Slides at `2048x2048` for `#/build`) vs. Website Body vs. Meta Ads (`#/create`)
> **Owner Hard Rule (November 5, 2026):** *"In the hero section it should be putting those images into the hero section, with the strongest static image as the hero, and then they can slide through and see all those images. I feel like the site itself shouldn't have those static images [in the lower body]... And I actually want those to be used as the ads, right?"*

1. **Where Gallery Slides Go (`hero.gallery` & `purchase.gallery` ONLY — NEVER in `features.items[]`):**
   - Put all `6–7` slides (`hero-1.webp` through `hero-7.webp`) inside **`hero.gallery` and `purchase.gallery`** so shoppers swipe through every slide right in the **Hero Section Carousel**, starting with the strongest high-conviction authority static image as **`hero-1.webp`** (e.g. `"MILITARY-GRADE 6-STAGE 0.01-MICRON FILTRATION · Turn Any Water Into Pure Drinking Water With One Touch"` — always check grammar: `"With One Touch"`, never `"At One Touch"`).
   - **NEVER put static images inside `features.items[]` in the website body!** Every item in `features.items[]` must keep `"image": ""` and `"alt": ""` so the lower body of the website renders clean `.is-text-only` numbered icon cards (`01`–`04`).
   - Also export the high-converting static callout/comparison/infographic images directly to **`products/P###-slug/creative/ads/`** and register them in **Step 4 · Creatives (`#/create`)** so they are used as **Meta Static Ads**.
2. **Slide Sequence in `public/images/<slug>/hero-1.webp`–`hero-7.webp`:**
   - **`hero-1.webp` (Slide #1 — Strongest Authority Static Hero):** High-conviction power-word headline (e.g. `Military-Grade`, `Medical-Grade 0.01-Micron`, `99.9999% Filtration`) + tack-sharp product hero shot in action.
   - **`hero-2.webp` (Slide #2 — Mechanism Cutaway / Stage Breakdown):** Detailed X-ray or anatomical breakdown of the internal mechanism.
   - **`hero-3.webp` (Slide #3 — Capacity / Value Math Equivalence):** Visual proof of output or value (e.g., `1 Filter = 793 Gallons = 150 Plastic Cases`).
   - **`hero-4.webp` (Slide #4 — 4 Reasons It Beats Old-School Alternatives):** Numbered callout breakdown of key advantages.
   - **`hero-5.webp` (Slide #5 — Us vs. Cheap Alternatives Comparison):** Side-by-side split showing why our mechanism crushes cheap manual alternatives.
   - **`hero-6.webp` (Slide #6 — Real-World Crisis / Use-Case Utility):** Multi-function utility in real-world action.
   - **`hero-7.webp` (Slide #7 — Complete Kit Flat-Lay):** Clean breakdown of every component included in each kit.

### B. Full Creative Pack: Top 1–3 Viral Videos + 20-Static Ad Batch (`10 Problem-Aware` + `10 Solution-Aware`) + Day 4+ Veo 3.1
1. **Viral Video + 20-Static Creative Pack (`#/create` & `#/launch`):**
   - Curate the **top 1–3 highest-converting viral creator `.mp4` videos** (`9:16` `1080x1920`, downloaded from Kalodata US with proven 3-second reveal hooks) and extract their spoken mechanism/problem hooks.
   - Build the **20-Static Ad Batch (`10 Problem-Aware` + `10 Solution-Aware`)** in Google Flow using `winning-statics` + `sbc-statics-2-0`, accompanied by **5 long-form evergreen Facebook captions (`250–400 words`)** and **5 short reusable headlines (`4–9 words`)**.
2. **Day 4+ Custom `9:16` Veo 3.1 AI Video Ads (`#/manage?tab=grow`):**
   - Once a launched product survives the **End-of-Day 3 Learned-Algorithm Kill Gate** with proven sales/ROAS, open **Google Flow (`https://labs.google/fx/tools/flow`)** in Chrome, switch to **Veo 3.1 (`9:16` vertical video mode)**, upload our verified start/end product truth frames, and generate custom 3-second physical hook clips and B-roll sequences to beat public TikTok creatives and scale daily conversions on Day 4+.

---

## 5. Step-by-Step Execution & Verification Checklist

1. **Before Generating:**
   - Read [WHATS-GOOD.md](../../../resources/copywriting/WHATS-GOOD.md), [REFERENCE-TO-AD.md](../../../agents/image-generator/references/REFERENCE-TO-AD.md), [winning-statics/SKILL.md](../winning-statics/SKILL.md), [concept-library.md](../winning-statics/references/concept-library.md), and [sbc-statics-2-0/SKILL.md](../sbc-statics-2-0/SKILL.md).
   - Deconstruct the product's viral videos + competitor research and write the 20-row Concept Ledger (`10 Problem-Aware` + `10 Solution-Aware`) + 5 evergreen captions + 5 short headlines in `products/P###-slug/creative/COPY-BRIEF.md`.
2. **Generate in Google Flow via Chrome CDP (`port 9222`):**
   ```powershell
   python -m scripts.automation.cli open "https://labs.google/fx/tools/flow" --new-tab
   python -m scripts.automation.cli --url-match "labs.google" inspect --limit 60
   ```
   - Upload the real product truth photo(s) + one `static_XX.png` reference layout per ad, submit the structured Swap/Preserve prompt, and download full-resolution outputs.
3. **Full-Size Visual QC & Save:**
   - Inspect every downloaded image/video at full resolution (`read_file` on the saved image path).
   - Reject and regenerate inside Flow if any text is misspelled/clipped, if product geometry drifted from the truth photo, or if a fake logo appeared.
   - Save store gallery slides to `hydrogen-storefront/public/images/<slug>/` and ad creatives to `products/P###-slug/creative/ads/`, then register them in `os/data/meta-campaigns.json` and `PATCH /api/products/:id` (`creative-assets`, `claims-rights`).
