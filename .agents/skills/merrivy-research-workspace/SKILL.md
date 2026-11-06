---
name: merrivy-research-workspace
description: Run Merrivy product discovery (`#/find`), hard verification (`#/verify` -> `#/winners`), 4–5 star Amazon review mining, HyperSKU/CJ `<35%` landed cost checks, and Meta Ad Library competition checks.
---

# Merrivy Research Workspace (`Product -> Verify -> Winners`)

Load and follow these canonical subagent playbooks and modular operational skills before running product discovery, buyer review mining, or hard verification:

## 1. Subagent Playbooks (`.claude/agents/`)
1. **[.claude/agents/scout.md](../../../.claude/agents/scout.md)** — **Step 1 · Product (`#/find` — Numbers-First Reverse Engineering, Never Organic TikTok Scrolling)**: Brute-force keyword-targeted discovery using our [200-Keyword Q4 Macro-Trend Bible](../../../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md) against **Kalodata US (`POST /overview/fullText/search` with `country: "US"`, `currency: "USD"`, `pageSize: 100`)**, requiring **Multi-Video US Viral Density (`>= 5` active US viral videos across `>= 3` distinct US creators)**, `>= $45` ideal retail (`>= $24` floor), zero basic apparel/commodity slop, rising 30d demand wave, and downloaded US `.mp4` videos + `3s`/`7s` truth frames.
2. **[.claude/agents/checker.md](../../../.claude/agents/checker.md)** — **Step 2 · Verify (`#/verify` -> `#/winners`)**: Runs the 5-point hard verification funnel (`F1–F6`, `P1–P5`):
   - Unique mechanism for a specific audience/pain point (reject Walmart/Target/Amazon commodities).
   - Rising **Last-7-Days / 30d** US uptrend wave on the **exact Kalodata Product Detail ID (`kalodata.com/product/detail?id=...`)** + `>= 3–5` active US viral videos from the real Kalodata Video & Ad table (zero dead 90-day waves, zero hallucinated GMV, zero search links).
   - Multiple downloaded US `.mp4` videos transcoded to **universal `H.264 (libx264) + yuv420p + faststart`** with **individual `.jpg` frame thumbnails (`#1`–`#6` ranked by real sales)** and active TikTok Shop stores (`rawProducts`).
   - **Two-Layer US Meta Ad Library Competition & Mechanism Superiority:**
     1. **Layer 1 (Direct Twins):** `0–4` early-mover stores (`0–15` active ads) for this exact item (reject `8–20+` saturated auctions).
     2. **Layer 2 (`categoryCompetitors` — Required):** Search the broader category on Meta and document `2–3+` Category Competitor Types (`type`, `theyDo`, `howWeWin`) proving why our product's physical mechanism is different and beats the category.
   - **4-Way Unbiased Market Pricing Cross-Check, Scam-Store Filtering & CJDropshipping + Saved Image for Amy:**
     - Line up Supplier FOB/Shipping vs. TikTok Shop vs. Amazon (`/dp/...`) vs. Meta Stores (`<store>/products/...`), explicitly flagging fake/non-shipping scam stores pricing near/below landed cost.
     - Save the **exact CJDropshipping / Alibaba listing link** (never a search URL) + a **clean supplier product image (`resources/sourcing/<ID>-supplier.png`)** in `references` (enforced programmatically in `os/src/researchView.mjs`). Once the owner clicks **Approve and build the store** on `#/winners`, send that saved image to **Amy on WhatsApp** (`Cha Sourcing & Fulfillment(Amy)`) for her exact quote.
3. **[.claude/agents/buyer-researcher.md](../../../.claude/agents/buyer-researcher.md)** — Mines **4–5 star Amazon reviews FIRST** (plus 2–4 star reviews, TikTok comments, and forums) to extract `3+` avatars, trigger moments, `15+` verbatim dated quotes (`A1–A3`), and the **3 best buyer-praised features** for static ads and `.is-wftn-reviews` storefront sections.

## 2. Modular Operational Skills (`.claude/skills/`)
1. **[.claude/skills/kalodata-keyword-reverse-engineering/SKILL.md](../../../.claude/skills/kalodata-keyword-reverse-engineering/SKILL.md)** (`shelf: research`) — Step-by-step execution of Numbers-First Reverse Engineering across the 200-Keyword Q4 Macro-Trend Bible on Kalodata US (`country: "US"`, `pageSize: 100`), Multi-Video US Viral Density filtering, `.mp4` + `3s`/`7s` truth frame extraction, `POST /api/scraper-runs`, and `PATCH /api/research`.
2. **[.claude/skills/hard-product-verification/SKILL.md](../../../.claude/skills/hard-product-verification/SKILL.md)** (`shelf: research`) — Complete 5-gate hard verification funnel (`#/verify` -> `#/winners`) across `F1–F6` and `P1–P5`, US Meta Ad Library 3-layer search syntax, HyperSKU/CJ `<35%` air-landed cost & 1-piece SKU verification, 2-Kit + `$4.99` unit economics (`>= $22–$30` break-even CPA floor), and automatic fail/promotion rules.
3. **[.claude/skills/amazon-review-and-hook-mining/SKILL.md](../../../.claude/skills/amazon-review-and-hook-mining/SKILL.md)** (`shelf: research`) — Step-by-step 4–5 star Amazon review mining (extracting top 3 buyer-praised features first), 2–4 star objection & TikTok comment cross-checking, `research/<round>/buyers/L###.md` creation, `PATCH /api/research` (`A1–A3`), and filing Gemini Deep Research reports to the Trends & Research Hub (`#/trends`).

## 3. Core Workflow & Rules
- **[workflow/CHECKS.md](../../../workflow/CHECKS.md)** & **[os/src/productGates.mjs](../../../os/src/productGates.mjs)**
- **[resources/notes/2026-11-04-hard-verifier-stress-test-and-breakeven-floor.md](../../../resources/notes/2026-11-04-hard-verifier-stress-test-and-breakeven-floor.md)**
- **[resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md](../../../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md)**
