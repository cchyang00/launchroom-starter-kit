---
name: merrivy-shopify-workspace
description: Route Merrivy storefront building (`http://localhost:3021` Hydrogen storefront), 2-Kit + `$4.99` Shipping Protection setup, 7-Point Launch Checklist verification (`#/checklist`), and post-launch Store & CRO improvements (`#/manage?tab=store`) into the Shopify builder workspace.
---

# Merrivy Shopify Workspace (`Store -> Checklist -> Manage Store & CRO`)

Read [.claude/agents/store-builder.md](../../../.claude/agents/store-builder.md), then explicitly load:
1. [grimoire-storefront-and-checklist skill](../../../.claude/skills/grimoire-storefront-and-checklist/SKILL.md) — **MANDATORY**: end-to-end operational method for cloning `base-theme.json`, 52 palettes, 5-section Grimoire layout, 2-Kit + `$4.99` Shipping Protection, Shopify Admin sync, and `7/7` Launch Checklist verification
2. [viral-hook-and-dr-copywriting skill](../../../.claude/skills/viral-hook-and-dr-copywriting/SKILL.md) — **MANDATORY**: Website vs. Meta Ad Headline Split and 2-Kit offer copy
3. [browser-use skill](../../../.claude/skills/browser-use/SKILL.md) — automating the owner's signed-in Chrome browser over CDP (`port 9222` / `python -m scripts.automation.cli` / Chrome MCP `tabs_create_mcp`) for Shopify Admin (`ndfdtc-br.myshopify.com`) and `375px` mobile preview checks
4. [store/PAGE-BLUEPRINT.md](../../../store/PAGE-BLUEPRINT.md)
5. [store/HYDROGEN-POPULATION.md](../../../store/HYDROGEN-POPULATION.md)
6. [workflow/LAUNCH-CHECKLIST.md](../../../workflow/LAUNCH-CHECKLIST.md) (`7/7` pre-launch checklist)
7. [templates/PRODUCT-PAGE-COPY.md](../../../templates/PRODUCT-PAGE-COPY.md)
8. **Whenever creating or updating storefront gallery images or feature slides**, also load [google-flow-creative-studio](../../../.claude/skills/google-flow-creative-studio/SKILL.md), [merrivy-creative-workspace](../merrivy-creative-workspace/SKILL.md), and [REFERENCE-TO-AD.md](../../../agents/image-generator/references/REFERENCE-TO-AD.md).

**Hard Rules for Every Product Page (`merrivy.com/products/<handle>`, November 5):**
1. **Clone from the 10/10 Master Base Theme (`base-theme.json` = Military-Grade Water Purifier Floor) + 52 Color Palettes (`palettes.json`):** Start every new product page by running `node scripts/packet-tools.mjs new <slug> --palette <palette-id> --live` inside `hydrogen-storefront/`. **`base-theme.json` is built directly from `portable-water-purifier-pump.json` (our Military-Grade Water Purifier Floor — the minimum requirement for copywriting and image quality, replacing the old Grimoire planner).** Every page has strictly 5 sections below the hero + 3 vertical creator demo videos (`"sections": ["features", "comparison", "quotes", "guarantee", "faq"]`) with `.is-wftn-reviews` verified buyer testimonials. Never delete or downgrade `base-theme.json`.
2. **2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection (Zero 3-Kit, Zero Multi-SKU Add-On Bundles):**
   - **1-Kit:** Clean base retail price on the hero selector + **`$7.99` Standard Shipping** in the Cart Drawer & Checkout (never show `+$7.99 Shipping` on the hero selector).
   - **2-Kit (`★ MOST POPULAR · BEST VALUE`):** 2 units at `15%` off + **FREE Tracked Shipping** + 1-tap `1-Kit -> 2-Kit` upgrade inside the Cart Drawer.
   - **`$4.99` Shipping Protection:** Pre-checked `$4.99` toggle inside the slide-out Cart Drawer (`addOnIds: []` / `BagAddOns: []`—no companion add-on SKU headaches).
3. **Top-to-Bottom Persuasion Arc (Sacred Oak Formula — Features in Hero -> `"Why This Is For You"` Below, Zero Repetition):**
   - **Hero Section (`hero` + `purchase`):**
     - `6–7` swipeable gallery slides (`hero-1.webp`–`hero-7.webp`) visually explain what the product does and its features.
     - **1 Short, Clean Product Title (`hero.headline`, 4–6 words):** Never print `navLabel` above `hero.headline` (no duplicate title!) and never repeat `"Military-Grade"` 3 times across the image, eyebrow, title, and variant card.
     - **1 Short 2-Sentence Urgency/Hook Paragraph (`hero.subhead`, 25–35 words):** Hits the core emergency/daily pain point and uses the power phrase (`"military-grade"`) once where it carries maximum impact.
     - **3–4 Short Checkmark Bullets (`hero.benefits`, 4–7 words each with `✔` icons):** e.g., `✔ Pure Drinking Water With One Touch`, `✔ 793 Gallons Per Filter (6,000 Bottles)`, `✔ Zero Manual Pumping Or Straws`, `✔ Built-In USB-C Battery & SOS Light`.
     - **High-Contrast Uniform Typography:** All body copy, checkmarks, and 2-Kit selector cards use solid dark ink (`var(--ink)`) and uniform fonts (`Bricolage Grotesque` + `DM Sans`—never washed-out gray text or random `Georgia` serif italics).
   - **Below the Creator Videos (`features`, `comparison`, `quotes`):**
     - Once shoppers scroll past the Hero and `"See It In Action"` videos, **they already know the features—never explain the features a second time!**
     - **`features` (`#features`):** Use **one Direct Emotional Hook Headline (`4–7` words: e.g., `"Don't Wait Until The Tap Runs Dry"` or `"Don't Get Caught In The Dark"`, with `eyebrow: ""` blank — NEVER add a redundant `"Why This Is For You"` title underneath!)** and 3 situational buyer-life cards paired with **3 distinct, high-contrast `1:1` situational photos (`why-1.webp`–`why-3.webp`)** showing why the product is made for their home, family, and emergencies.
     - **`comparison` (`#comparison`):** Name the **Mechanism vs. Old Alternative** (`"One-Touch Electric vs. Old-School Filters"` — never use weak `"Us vs."`).
     - **`quotes` / `pullQuotes` (`#why-they-switch`):** Use the simple, universal header **`"Look At What Our Customers Have To Say"`** across `pullQuotes.heading`, `quotes.heading`, and `reviews.heading`.
4. **7-Point Launch Checklist (`workflow/LAUNCH-CHECKLIST.md`, `7/7`) & Category-Isolated Meta Pixels:** Verify mobile design, copy angles, 2-Kit + `$4.99` math, layout QoL, Shopify Admin variants/descriptions, category-isolated Meta Pixel + CAPI event match, and HyperSKU/CJ/Amy supplier check, then tick all 7 items on `POST /api/launch-checklists` + `PATCH /api/products/:id` so the product advances automatically to `#/launch`.
