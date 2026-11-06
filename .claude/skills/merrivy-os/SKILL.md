---
name: merrivy-os
description: Working inside Launchroom, the owner's shared workspace app at localhost:3000/p/merrivy/ (and mobile NetBird HTTPS https://launchroom-home.eu1.netbird.services/), and managing its 8-agent specialist team. Use it whenever the owner mentions the OS, Launchroom, localhost:3000, the Hubs (Start here, Trends & Research, Subagents & Skills, Store & Theme, Assets & Creatives), the 6-step Pipeline (Product · Verify · Winners · Store · Creatives · Checklist · Launch), the dedicated top-level Manage tab (#/manage — Daily Numbers, Ad Testing, Store & CRO, Scale or Cut), the to-do list, memory, notes, the handoff, agents, delegating to subagents, skills, Library, Tools, or the linked Hydrogen storefront at localhost:3021.
---

# Launchroom (`http://localhost:3000/p/merrivy/`)

Launchroom at `http://localhost:3000/p/merrivy/` (and mobile NetBird HTTPS `https://launchroom-home.eu1.netbird.services/`) is the owner's and agents' shared operating system for the Merrivy dropshipping business. **It is not a side logging tool—it is the workflow.** Every step of the business, from finding a product to scaling ads in `Manage`, runs through it.

The source of truth is files: the business folders plus `os/data/*.json`. Launchroom is the visual layer and API over them.
Root `AGENTS.md` holds authority and business rules. [os/AGENT-BRIDGE.md](../../../os/AGENT-BRIDGE.md) is the full API contract.

---

## 1. Get oriented at the start of every conversation

```bash
node .claude/skills/merrivy-os/scripts/os.mjs status
```

This shows:
- on its first lines, **the pipeline**: the round, how many products are at each step, the build slot and the focus (the step the most important next move is on), worked out from saved records;
- whether Launchroom (`localhost:3000`) and the Hydrogen storefront (`localhost:3021`) are running;
- the saved handoff (next action and blockers);
- open owner notes;
- the to-do list, grouped as carried forward, today, upcoming and someday.

Then run the health check:

```bash
node .claude/skills/merrivy-os/scripts/os.mjs doctor
```

It lists, in plain words with a one-line fix each, anything stale, broken or waiting:
- the OS server running older code than the files on disk (it needs a restart), or a build (`os/dist`) older than `os/src`;
- the step guide broken, a step block or the pipeline block over its word cap (`185` / `240` words), and the pipeline not computable;
- a round with no cards left in Product or Prove it (review it), products ready to build while the build slot is empty (the owner picks), a product quiet for 7 days, or products not started from a card;
- `START-HERE.md` or `NOW.md` older than the saved records, or Now over about 300 words;
- lesson lists over their limit and proposals waiting more than 2 days;
- running reports with no update for 24 hours and blocked reports older than 7 days;
- overdue to-dos, owner to-dos waiting more than 3 days and more than 3 focus tasks on a day;
- Library entries whose file is missing and reading-list items older than 7 days;
- tools without a link and "Signed in?" notes older than 14 days;
- missing store pictures, empty places on the store page, or site pictures needing updates;
- agents on the roster (`agents/team.json`) without a `.claude/agents/<id>.md` file, and the other way round.

### How the Pipeline & Manage Work (Nov 5 Architecture)
- `os.mjs pipeline [--all]` lists every product's row: its line, step, status, next move and who; then ready to build and (with `--all`) the ones out of the line with their reason.
- `os.mjs product <L###|P###>` shows one product's line, next move, its step block and that step's prompts with the product's name, country and card filled in.
- `os.mjs product start <L###>` starts the product record (`P###`) from a verified winner card (`L###`).
- **The 6-Step Pipeline + Top-Level `Manage` Workspace (owner, Nov 5):**
  1. **Step 1 · Product (`#/find`, `CatalogPage.jsx`):** The scraper's catalog (`scout`). Numbers-First Reverse Engineering across our 200-Keyword Q4 Bible on Kalodata US (`country: "US"`, `pageSize: 100`), requiring Multi-Video US Viral Density (`>= 5` active US viral videos across `>= 3` distinct US creators) and `>= $24` retail floor (`>= $45` ideal).
  2. **Step 2 · Verify (`#/verify`, `VerifyPage.jsx` -> `#/winners`):** The 5-point hard verification funnel (`checker` + `buyer-researcher`) powered by `os/src/productGates.mjs`: unique non-commodity mechanism, rising 30d US sales wave, 4–5 star Amazon review mining FIRST (`3` best features + `15+` verbatim quotes + `3+` avatars), `0–2` Meta competitors (`<15` ads), and exact 1-piece SKU on HyperSKU/CJ (`<35%` air-landed cost, `>= $22–$30` break-even CPA floor). Passing cards land on **Winners (`#/winners`)** for the owner's decision (`Approve & Build Store` or `Reject`).
  3. **Step 3 · Store (`#/build`, `StoreEditor` in `mode="pipeline"`):** Build the store (`store-builder` + `copywriter` + `image-maker`) with 4 sub-tabs on the left (`Page Copy & Sections`, `Store Pictures & Gallery`, `Shopify Admin & Variants`, `Store Palette`) and the sticky live `375px` mobile / desktop Hydrogen storefront (`localhost:3021`, proxied via `/api/store-preview` on HTTPS) on the right. Enforces the 5-section Grimoire layout, Website vs. Ad Headline Split, and **2 Kits Only (`1-Kit` + `$7.99` shipping vs. `2-Kit` Save 15% + Free Shipping) + `$4.99` Shipping Protection**.
  4. **Step 4 · Creatives (`#/create`, `CreativesPage.jsx`):** Review and approve the product's ad pack (`copywriter` + `image-maker`): top `1–3` proven viral `.mp4` creator videos + `4–5` photorealistic `4:5` DR static ads generated in **Google Flow (`https://labs.google/fx/tools/flow`)** in Chrome (zero Antigravity credit drain).
  5. **Step 5 · Checklist (`#/checklist`, `7/7`):** The 7 mandatory pre-launch checks (`workflow/LAUNCH-CHECKLIST.md`, `os/server/launchChecklist.mjs`) next to the sticky `375px` mobile site preview: (1) Flawless 375px Mobile Design, (2) Strong High-Converting Copy Angles, (3) 2-Kit Pricing + `$7.99`/Free Shipping & `$4.99` Upsell Math, (4) Layout & QoL Polish, (5) Shopify Admin Variants & Descriptions, (6) Category-Isolated Meta Pixel & CAPI Match, (7) Supplier Fulfillment Check (HyperSKU/CJ `<35%` landed cost + Amy/CJ).
  6. **Step 6 · Launch (`#/launch`, `LaunchPage.jsx`):** Stage the **`$50/day` Broad CBO** across `US / CA / UK / AU`, set Break-Even / Target CPA guardrails and the `$50` first-test loss limit (`ad-manager` + `store-builder`), and launch. Once launched, `scripts/sync_pipeline_checks.py` marks `experiment-plan` and `authorized-test` verified and moves the product out of Build & Launch into **`Manage` (`#/manage`)**.
  7. **Top-Level `Manage` Workspace (`#/manage`, `ImprovePage.jsx` & `ManageParts.jsx`):** Dedicated post-launch workspace (`ad-manager` + `store-builder` + `image-maker`) with 4 sub-tabs:
     - **`Daily Numbers` (`?tab=overview`):** Reconciled Day-by-Day Query Table (`Spend`, `Shown`, `Clicks`, `CTR`, `CPC`, `ATC`, `Checkout`, `Orders`, `Revenue`, `CPA`, `ROAS`, `Day Status`) + Day Window Switcher (`All Days / Day 1 / Day 2 / Day 3 / Day 4+`).
     - **`Ad Testing` (`?tab=ads`):** Ranked `Best -> Worst` (`Sale Makers -> Cart Builders -> Hook Winners -> 0-Click Bleeders`). Never pause intraday; never turn off yesterday's winners.
     - **`Store & CRO` (`?tab=store`):** Live storefront preview + funnel drop-off diagnosis (`Click -> ATC -> Checkout -> Order`) + 5 CRO experiments.
     - **`Scale or Cut` (`?tab=grow`):** Enforces the **3-Day Meta Algorithm Priming & End-of-Day 3 Kill / Scale Rule** (Day 1–2 priming, wait until the **END of Day 3** before cutting via **`Cancel & Wipe Product`**, and Day 4+ surf-scaling + custom **Google Flow Veo 3.1 AI video ads**).

---

## 2. Where things live

| Page | Address | What it is for | Backed by |
| --- | --- | --- | --- |
| **Home** | `#/` | Pipeline hero, active rows, and items needing owner decisions | `/api/bootstrap` (`pipelineState`) |
| **Start here (Hubs)** | `#/hubs` | Six shared knowledge doors for owner and agents (`os.mjs hub <door>`): `copy`, `creatives`, `winners`, `research`, `store`, `team` | `os/src/hubDoors.mjs` |
| **Trends & Research Hub** | `#/trends` (`?tab=research`, `keywords`, `diagrams`, `seasons`) | Gemini Deep Research reports (`resources/research/`), 200-Keyword Q4 Bible, diagrams (`resources/diagrams/`), and season windows | `os/data/library.json`, `resources/research/`, `resources/diagrams/` |
| **Subagents & Skills Hub** | `#/agents` (`?tab=team`, `skills`, `reports`, `desk`) | All 8 specialist subagents (`team.json` + `.claude/agents/*.md`), their workflow steps (`workflow/the-line.json`), and project + personal skills (`~/.claude/skills`) | `agents/team.json`, `.claude/agents/*.md`, `.claude/skills/` |
| **Store & Theme Hub** | `#/store` | Our Theme & Palette Vault: Master Base Theme (`base-theme.json`), all **52 color palettes** (`palettes.json`), and blueprint cloning (`StoreEditor` in `mode="hub"`) | `hydrogen-storefront/app/content/base-theme.json`, `palettes.json` |
| **Assets & Creatives Hub** | `#/assets` (`?tab=good-copy`, `good-ads`, `improve`, `studio`, `store`) | `Good copy`, `Good ads`, `Ways to improve` (`resources/copywriting/WHATS-GOOD.md`), `Ad studio`, and `Store pictures` | `resources/copywriting/WHATS-GOOD.md`, `os/data/meta-campaigns.json`, `os/data/assets.json` |
| **Product (Step 1)** | `#/find` (`CatalogPage.jsx`) | The scraper's catalog: keywords, intake filters, runs, and kept candidates (`scout`) | `research/comparison.json`, `research/scrape-runs.json` |
| **Verify (Step 2)** | `#/verify` (`VerifyPage.jsx`) | The 5-point hard verification funnel (`checker` + `buyer-researcher`) from `os/src/productGates.mjs` | `research/comparison.json` |
| **Winners** | `#/winners` | Products that passed all hard checks (`F1–F6`, `A1–A3`, `P1–P5`). Owner approves (`Approve & Build Store`) or rejects | `research/comparison.json` |
| **Store (Step 3)** | `#/build` (`StoreEditor` in `mode="pipeline"`) | 4 sub-tabs on the left (`Page Copy & Sections`, `Store Pictures & Gallery`, `Shopify Admin & Variants`, `Store Palette`) + live `localhost:3021` store on the right | `hydrogen-storefront/app/content/<slug>.json`, `/api/store-preview` |
| **Creatives (Step 4)** | `#/create` (`CreativesPage.jsx`) | Product's `9:16` viral videos and `4:5` DR static ads for owner review and approval | `products/P###-*/`, `os/data/meta-campaigns.json` |
| **Checklist (Step 5)** | `#/checklist` (`7/7`) | 7-Point Storefront, Copy, 2-Kit + `$4.99` Upsell, QoL, Shopify Admin, Meta Pixel & Supplier check next to `375px` preview | `os/data/launch-checklists.json`, `workflow/LAUNCH-CHECKLIST.md` |
| **Launch (Step 6)** | `#/launch` (`LaunchPage.jsx`) | Set `$50/day` CBO budget, tier-1 markets, Break-Even/Target CPA guardrails, and launch into `Manage` | `os/data/meta-campaigns.json`, `products/P###-*/` |
| **Manage (Top-Level)** | `#/manage` (`?tab=overview`, `ads`, `store`, `grow`) | Post-launch command center: `Daily Numbers`, `Ad Testing`, `Store & CRO`, and `Scale or Cut` (`Cancel & Wipe Product`) | `os/data/meta-campaigns.json`, `scripts/sync_meta_campaigns.py` |
| **To-do** | `#/today` | Shared planner: today's focus (up to 3), From earlier, You and Agent lanes | `os/data/planner.json` |
| **Memory** | `#/memory` (`?tab=lessons`, `diary`, `brief`) | `Now`, `Lessons`, `Diary`, and agent briefs | `os/data/workspace.json`, `os/data/lessons.json` |
| **Library & Tools** | `#/library`, `#/tools` | Indexed knowledge (`K-###`) and outside tools (`Kalodata`, `Google Flow`, `Shopify Admin`, `Meta Ads Manager`) | `os/data/library.json`, `os/data/tools.json` |

---

## 3. The to-do list (`#/today`)

Never edit `os/data/planner.json` by hand while the app is running. Use `os.mjs`:

```bash
node .claude/skills/merrivy-os/scripts/os.mjs todo
node .claude/skills/merrivy-os/scripts/os.mjs add "Build the store packet and gallery" --agents store-builder,image-maker --next "Clone base-theme.json on localhost:3021, then generate 8K gallery in Flow" --date today --focus
node .claude/skills/merrivy-os/scripts/os.mjs set 22d1d860 --status doing --next "Verify 7/7 Launch Checklist"
node .claude/skills/merrivy-os/scripts/os.mjs done 22d1d860 --log "Verified 7/7 checklist items and staged $50/day CBO"
```

Flags:
- `--date`: `today`, `tomorrow`, `someday` or `YYYY-MM-DD` (America/Chicago).
- `--who`: `owner`, `agent` or `shared`.
- `--status`: `todo`, `doing`, `blocked` or `done`.
- `--focus` / `--no-focus`: at most 3 open focus tasks per day (`FOCUS_FULL` on a 4th).
- `--product L###|P###`: links the task to a candidate or product.
- `--step`: `product`, `buyers`, `prove`, `create`, `build`, `launch`, `learn`.
- `--log`: appends a dated progress line to notes.

---

## 4. Memory (`Now`, `Lessons`, `Diary`) & The Library

| Part | What it holds | Command |
| --- | --- | --- |
| **Now** | What's true today, what's next, what's blocked (~250 words, max 300) | `os.mjs handoff --summary "..." --next "..." --blockers "..."` |
| **Lessons** | Short rules (`everyone` cap 15, per-agent cap 10) | `os.mjs lesson propose\|add\|set\|used` |
| **Diary** | Dated log lines per job | `os.mjs diary "one line" --agent <id> --task <id>` |
| **Hubs** | Open any of the 6 shared Hub doors from CLI | `os.mjs hub copy\|creatives\|winners\|research\|store\|team` |
| **Library** | Search and save research, notes, and playbooks (`K-###`) | `os.mjs library search "topic"` · `os.mjs library add --kind research ...` |

---

## 5. The Team: Main Chat = Dispatcher -> 8 Specialist Subagents

**CRITICAL OPERATING RULE (Nov 5):** The main conversation acts strictly as the **Manager / Dispatcher**. Whenever the owner asks for product scouting, verification, buyer review mining, copywriting, Google Flow image/video generation, storefront building, Meta Ads / Manage syncs, or Launchroom UI work, **do NOT execute the heavy job inline in the main chat**—spawn the specialist subagent(s) (`invoke_subagent`) to execute the job and verify their output.

### The 8 Specialist Subagents (`agents/team.json` & `.claude/agents/*.md`)
1. **`scout`** (`validation`, `.claude/agents/scout.md`) — Step 1 · `Product` (`#/find`): Numbers-First Reverse Engineering across the 200-Keyword Q4 Bible on Kalodata US (`>= 5` viral videos across `>= 3` US creators).
2. **`checker`** (`validation`, `.claude/agents/checker.md`) — Step 2 · `Verify` (`#/verify` -> `#/winners`): 5-point hard verification funnel (`F1–F6`, `P1–P5`), HyperSKU/CJ `<35%` air-landed cost check first, and 2-Kit unit economics.
3. **`buyer-researcher`** (`validation`, `.claude/agents/buyer-researcher.md`) — Step 2 · `Verify` (`#/verify`) & Step 0 · `Issues` (`#/issues`): Mines 4–5 star Amazon reviews FIRST (`3` best features), `2–4` star objections, and `15+` verbatim quotes.
4. **`copywriter`** (`image-generator`, `.claude/agents/copywriter.md`) — Step 3 · `Store` (`#/build`) & Step 4 · `Creatives` (`#/create`): Website vs. Ad Headline Split, Unaware-Scroller DR static copy, and 2-Kit + `$4.99` Shipping Protection copy.
5. **`image-maker`** (`image-generator`, `.claude/agents/image-maker.md`) — Step 3 · `Store` (`#/build`), Step 4 · `Creatives` (`#/create`) & `#/assets`: Uses **Google Flow (`https://labs.google/fx/tools/flow`)** in the owner's signed-in Chrome browser (zero Antigravity credit drain; never `generate_image` or Python PIL) for 8K store gallery photos, `4:5` DR static ads, and Day 4+ custom **Flow Veo 3.1 AI video ads**.
6. **`store-builder`** (`shopify-builder`, `.claude/agents/store-builder.md`) — Step 3 · `Store` (`#/build`), Step 5 · `Checklist` (`#/checklist`) & `#/manage?tab=store`: Clones `base-theme.json` + **52 palettes** on `localhost:3021`, configures 2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection, sets up Shopify Admin variants & category-isolated Meta Pixels, verifies `7/7` Checklist, and runs Store & CRO experiments.
7. **`ad-manager`** (`manager`, `.claude/agents/ad-manager.md`) — Step 6 · `Launch` (`#/launch`) & Top-Level `Manage` (`#/manage` — `Daily Numbers`, `Ad Testing`, `Store & CRO`, `Scale or Cut`): Stages `$50/day` Broad CBO launches, runs live Meta Graph API `v22.0` + Shopify syncs (`scripts/sync_meta_campaigns.py`) with the 4 Data-Integrity Guards, ranks ads `Best -> Worst`, and enforces the **3-Day Algorithm Priming & End-of-Day 3 Kill / Scale Rule**.
8. **`os-builder`** (`manager`, `.claude/agents/os-builder.md`) — Launchroom OS (`http://localhost:3000/p/merrivy/` & `https://launchroom-home.eu1.netbird.services/`): Maintains the Hubs, the 6-step Pipeline, the 4-sub-tab `Manage` workspace, `/api/store-preview`, and `os.mjs doctor`.

### Model & Dispatch Rules
- All subagent definitions in `.claude/agents/*.md` use `model: opus` and are invoked with `Model: "inherit"` (unless the owner explicitly requests a different model).
- Every subagent job reports its start and completion to Launchroom:
  ```bash
  node .claude/skills/merrivy-os/scripts/os.mjs report <job-id> --agent <agent-id> --status running --title "..." --event "Plan: 1 ... · 2 ..."
  ```
- **Owner decisions said in chat:** Record with `os.mjs owner-said <save|pass|reject|build|test-issue|park-issue|approve> <L###|P###|issue> --quote "<their exact words>"`. Never invent a decision the owner did not say.

---

## 6. Changing Launchroom (`os/`)

- Read `os/AGENTS.md` and `DESIGN.md` first.
  - Frontend: `os/src/` (React 19 + Vite). All colors must use CSS tokens in `os/src/tokens.css` (literal hex/rgb colors outside `tokens.css` fail `theme.test.mjs`).
  - Server: `os/server/` (native Node HTTP server in `hub.mjs` and `api.mjs`).
- **Rebuild & Test After Every Change:**
  1. Run `npm --prefix os test` to verify all unit tests pass.
  2. Run `npm --prefix os run build` so `os/dist` and `os/dist/build-stamp.json` match `os/src`.
  3. If `os/server/*` or `os/src/*.mjs` changed, restart port `3000` (`node os/server/start.mjs`) and run `node .claude/skills/merrivy-os/scripts/os.mjs doctor` until `OS server and app build` reads `ok`.

---

## 7. The Hydrogen Storefront at `localhost:3021` (`hydrogen-storefront/`)

The Merrivy storefront runs on port **`3021`** (`http://localhost:3021`, proxied inside Launchroom over HTTPS via `/api/store-preview`). To add or edit a product storefront, follow `store/HYDROGEN-POPULATION.md` and `store/PAGE-BLUEPRINT.md`.

- **Master Base Theme (`base-theme.json`) & 52 Color Palettes (`palettes.json`):**
  - Every new product packet is cloned from `hydrogen-storefront/app/content/base-theme.json` (`node scripts/packet-tools.mjs new <slug> --palette <palette-id> --live` inside `hydrogen-storefront/`).
  - **Never delete or overwrite `base-theme.json`**—it is our permanent master template and the fallback when `Cancel & Wipe Product` resets `app/content/templates.ts`.
  - `hydrogen-storefront/app/content/palettes.json` holds **52 curated color palettes** previewed and applied in `#/store` and `#/build`.
- **2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection:**
  - Every product page uses strictly **1-Kit** (`+ $7.99` shipping) and **2-Kit** (`MOST POPULAR · SAVE 15% + FREE Tracked Shipping`) plus the **`$4.99` Shipping Protection** toggle in the slide-out Cart Drawer. Never add a 3-Kit tier or multi-SKU physical add-on bundles.
- **Google Flow Creative Studio (`https://labs.google/fx/tools/flow`):**
  - All store gallery images, `4:5` DR static ads, and Day 4+ custom **Veo 3.1 AI video ads** are generated in the owner's signed-in Chrome browser via **Google Flow** (zero Antigravity credit drain, no paid OpenRouter video scripts).
- **Checks:** Run `node scripts/packet-tools.mjs check app/content/<slug>.json` inside `hydrogen-storefront/`.

---

## 8. If Launchroom or the Storefront is down

1. Check port `3000` (`Launchroom`) and port `3021` (`Hydrogen storefront`) with `Get-NetTCPConnection -LocalPort 3000,3021 -State Listen`.
2. If Launchroom (`3000`) is down, run `npm --prefix os run build` and start `node os/server/start.mjs`.
3. If the Hydrogen storefront (`3021`) is down, start `npm --prefix hydrogen-storefront run dev -- --port 3021`.
4. Confirm with `node .claude/skills/merrivy-os/scripts/os.mjs status` and `os.mjs doctor`.

---

## 9. What needs the owner

- **Go ahead without asking:** local edits, Kalodata/Amazon/Meta research, records, Launchroom improvements, `os/dist` builds, live Meta/Shopify read syncs (`scripts/sync_meta_campaigns.py`), drafts, and to-do/memory upkeep.
- **Ask first:**
  - commit or push;
  - deploying `merrivy.com` to production;
  - publishing or unpausing Meta campaigns, changing ad budgets, or triggering `Cancel & Wipe Product`;
  - any purchases or paid spend;
  - messages to suppliers, creators, or customers.
- **Owner only:**
  - Winners approval (`Approve & Build Store` / `Reject`);
  - typing any password, API key, or payment detail;
  - CAPTCHAs and human verification pages.
