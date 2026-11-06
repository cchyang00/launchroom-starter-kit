---
name: merrivy-creative-workspace
description: Route Merrivy product-image, Shopify graphic and Meta static-ad work into the dedicated image-generator workspace. Use for creating or refining image assets and incorporating creative feedback in this dropshipping project.
---

# Merrivy Creative Workspace (`Store Gallery & Ad Creatives`)

Read [.claude/agents/image-maker.md](../../../.claude/agents/image-maker.md) and [.claude/agents/copywriter.md](../../../.claude/agents/copywriter.md), then explicitly load and follow **ALL** of these canonical skills and reference files before generating a single image or headline:
1. [winning-statics skill](../../../.claude/skills/winning-statics/SKILL.md) & [concept-library.md](../../../.claude/skills/winning-statics/references/concept-library.md) — **MANDATORY**: deconstruct the product's winning viral TikTok videos + competitor research first, map them to our 50 proven reference statics (`static_01.png`–`static_50.png` across families `F1–F9`) to build a **20-Static Ad Batch (`10 Problem-Aware` + `10 Solution-Aware`)**, and apply exact Swap/Preserve + `REALISM`/`LOC`/`STRUCT-ONLY`/`CLAIM` protocols.
2. [sbc-statics-2-0 skill](../../../.claude/skills/sbc-statics-2-0/SKILL.md) — **MANDATORY**: pre-generation 20-row Concept Ledger diversity audit, causal mechanism chain (`feature/stage -> what it actually does -> practical benefit -> why that matters in this person's day`), and automatic delivery of **5 long-form evergreen Facebook captions (`250–400 words each`) + 5 short reusable headlines (`4–9 words each`)**.
3. [google-flow-creative-studio skill](../../../.claude/skills/google-flow-creative-studio/SKILL.md) — **MANDATORY**: end-to-end Google Flow (`https://labs.google/fx/tools/flow`) image & Veo 3.1 video studio method in Chrome (zero Antigravity credit drain).
4. [viral-hook-and-dr-copywriting skill](../../../.claude/skills/viral-hook-and-dr-copywriting/SKILL.md) — **MANDATORY**: viral creator hook harvesting, Website vs. Meta Ad Headline Split, Unaware-Scroller domino-chain psychology, Avatar Persona POV, and 2-Kit + `$4.99` Shipping Protection copy.
5. [browser-use skill](../../../.claude/skills/browser-use/SKILL.md) — automating the owner's signed-in Chrome browser over CDP (`port 9222` / `python -m scripts.automation.cli` / Chrome MCP `tabs_create_mcp`).
6. [merrivy-images skill](../../../agents/image-generator/.agents/skills/merrivy-images/SKILL.md).
7. [REFERENCE-TO-AD.md](../../../agents/image-generator/references/REFERENCE-TO-AD.md) — **MANDATORY**: how to combine real product truth photos with an inspected layout reference PNG (`agents/image-generator/references/layouts/static_01.png`–`static_50.png`).
8. [CONCEPTS.md](../../../agents/image-generator/references/CONCEPTS.md) & [INDEX.md](../../../agents/image-generator/references/INDEX.md) — the 50 layout reference PNGs (`F1–F9` families + Batch A/Batch B mapping).
9. [WHATS-GOOD.md](../../../resources/copywriting/WHATS-GOOD.md), [2026-11-04-meta-ad-performance-and-urgency-playbook.md](../../../resources/notes/2026-11-04-meta-ad-performance-and-urgency-playbook.md) & [SACRED-OAK-STUDY.md](../../../resources/copywriting/native-ads/SACRED-OAK-STUDY.md) — Unaware-Scroller DR static ad psychology & visual native ad study.
10. [templates/NATIVE-AD-KIT.md](../../../templates/NATIVE-AD-KIT.md) & [templates/COPY-BRIEF.md](../../../templates/COPY-BRIEF.md).
11. **Gold-Standard Reference Benchmark:** Inspect `products/P004-witching-hour-2027-weekly-planner/creative/ads/` (`ad-c1` through `ad-c13` and `ad-t14` through `ad-t18`) for 8K DSLR contrast, typography, and layout quality.

**Hard Rules for All Image, Video & Ad Copy Generation (November 5):**
1. **Chat Is Dispatcher -> Spawn `image-maker` & `copywriter` Subagents:** Never run heavy creative production directly in the main chat; dispatch the `image-maker` and `copywriter` subagents.
2. **Winning Statics Come From Winning Viral Videos (`20-Static Ad Batch: 10 Problem-Aware + 10 Solution-Aware`):**
   - Never invent random static concepts from scratch. First, transcribe and deconstruct the product's winning viral TikTok videos (spoken hook, specific mechanism numbers like *"5-step filtration down to 0.1 micron"*, visual demo) + competitor research + 4–5 star Amazon reviews.
   - Build a **20-row Concept Ledger** (`sbc-statics-2-0`) split into **Batch A (`10 Problem-Aware / Unaware Statics` across `F8`, `F2`, `F7`, `F1`)** and **Batch B (`10 Solution-Aware / Competitor-Superiority Statics` across `F4`, `F3`, `F5`, `F6`, `F9`)** using 20 distinct reference PNGs from `concept-library.md`, accompanied by **5 long-form evergreen Facebook captions (`250–400 words`) + 5 short headlines (`4–9 words`)**.
3. **ALWAYS Use Google Flow (`https://labs.google/fx/tools/flow`) in the Owner's Signed-In Chrome Browser for ALL Image & Video Generation (Zero Antigravity Credit Drain):**
   - Open a **Google Flow tab (`https://labs.google/fx/tools/flow`)** in the owner's signed-in Chrome browser (via `browser-use` / Chrome CDP port `9222` or Chrome MCP) for every store gallery image (`#/build`), `4:5` static ad (`#/create` & `#/assets`), and `9:16` Veo 3.1 video ad.
   - **NEVER call Antigravity's built-in `image-generator` (`generate_image`) / Gemini API tool** (which eats up Antigravity credits), and **NEVER draw ads or product slides with Python PIL / Pillow / HTML Canvas / SVG**.
4. **Every Google Flow Generation Prompt MUST Supply BOTH (A) Real Product Truth Photos AND (B) One Specific Reference Layout PNG (`agents/image-generator/references/layouts/static_*.png`):**
   - Apply the entry's Swap/Preserve instructions and `REALISM` / `LOC` / `STRUCT-ONLY` / `CLAIM` protocols from `concept-library.md`. Require razor-sharp 8K DSLR contrast, zero fake/competitor brand logos on boxes or products, and `>= 6%` safe edge margins.
5. **Copywriting Split — Urgent Hooks & 5 Evergreen Captions in Meta Ads vs. Elevated Boutique Titles on Website:**
   - **In Meta Ads (`#/create`):** Deliver the 5 long-form evergreen captions (`250–400 words`) + 5 short headlines (`4–9 words`) in the 1st-person voice of our Avatar Persona (`Olivia Scott` or `Michael L`).
   - **On the Website (`merrivy.com`):** Never repeat *"You have to get this..."* in `hero.headline` or `purchase.heading`. Use elevated boutique/hardware titles on the site while weaving viral creator reveal phrasing into `purchase.hook` and the 3 video demo cards.
6. **Video + Static Cadence:** Pair the **top 1–3 viral creator `.mp4` videos** with our **20-Static Ad Pack (`10 Problem-Aware` + `10 Solution-Aware`)**; build custom **Google Flow Veo 3.1 AI video ads** on **Day 4+** once a product proves traction past the End-of-Day 3 Kill Gate.
