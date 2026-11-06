# Launchroom — Day-1 Dropshipping Starter Kit

**Launchroom** (`http://localhost:3000/p/merrivy/`) is a complete, agent-driven dropshipping operating system paired with a mobile-first **Shopify Hydrogen Storefront** (`http://localhost:3021`).

Everything is pre-configured for **Day 1** with **zero old products, zero old ad campaigns, and clean memory**, while preserving the entire workflow engine, 10 specialized subagents, 14 pipeline skills, 50 static ad reference templates, and the Master Base Theme (`base-theme.json`).

---

## ⚡ One-Line AI Agent Setup Prompt

Open this folder in **Antigravity**, **Claude Code**, or **Codex**, and paste this single prompt into your AI agent:

> `Read README.md and AGENTS.md, install dependencies for os/ and hydrogen-storefront/, start Launchroom on http://localhost:3000/p/merrivy/ and the Hydrogen storefront preview on http://localhost:3021, run os.mjs doctor, and walk me through the 7-Step Day-1 Onboarding Checklist in #/today starting with Connect (#/connect).`

---

## 🚀 Quick Start (Manual Commands)

### Prerequisites
- **Node.js 20+** (`node -v`)
- **Google Chrome** (used by Launchroom's built-in Agent Browser on CDP port `9222`)

### 1. Install Dependencies
```bash
cd os && npm install && cd ..
cd hydrogen-storefront && npm install && cd ..
```

### 2. Start Launchroom (`http://localhost:3000/p/merrivy/`)
```bash
npm --prefix os start
```
Then open **http://localhost:3000/p/merrivy/** in your browser.

### 3. Start the Live Hydrogen Storefront Preview (`http://localhost:3021`)
```bash
cd hydrogen-storefront
cp .env.example .env
npm run dev -- --port 3021
```

### 4. Run the Launchroom CLI Helper (`os.mjs`)
```bash
node .claude/skills/merrivy-os/scripts/os.mjs status
node .claude/skills/merrivy-os/scripts/os.mjs doctor
node .claude/skills/merrivy-os/scripts/os.mjs connect
```

---

## 🧭 Your 7-Step Day-1 Onboarding Flow (Pre-Loaded in `#/today`)

| Step | Launchroom Screen | What Happens |
| --- | --- | --- |
| **1. Connect (`#/connect`)** | `http://localhost:3000/p/merrivy/#/connect` | Click **Start Agent Browser**, sign into your 12 tools (**Kalodata, TikTok, TikTok Shop, Amazon US, CJdropshipping, Alibaba, AliExpress, Meta Ad Library, Meta Ads Manager, Shopify Admin, Gemini Deep Research, Google Flow**), and run `os.mjs connect check` until the sidebar badge turns green. |
| **2. Product (`#/find`)** | `http://localhost:3000/p/merrivy/#/find` | Agents query **Kalodata US** using the 200-Keyword Bible, save exact `/product/detail` links, and download the top `#1–#3` converting `.mp4` videos + `.jpg` thumbnails. |
| **3. Verify & Winners (`#/verify` -> `#/winners`)** | `http://localhost:3000/p/merrivy/#/winners` | Enforces the 5-Gate Hard Verification Funnel (`90%` kill rate): Two-Layer Meta Competitor & Mechanism check, 4-Way Unbiased Market Pricing (`<35%` landed cost on CJdropshipping), and saved supplier photo. You do the final human eye test on **Winners**. |
| **4. Store (`#/build`)** | `http://localhost:3000/p/merrivy/#/build` | Clones `base-theme.json`, populates the 5-section Grimoire copy, configures **2 Kits Only (`1-Kit` + `$7.99` shipping vs. `2-Kit` `SAVE 15%` + Free Shipping) + `$4.99` Shipping Protection**, and previews the live 375px store on the right. |
| **5. Creatives (`#/create`)** | `http://localhost:3000/p/merrivy/#/create` | Rips the `#1` top-revenue Kalodata video (`9:16`) and generates **20 `4:5` static ads** (`10 Problem-Aware` + `10 Solution-Aware`) using the 50 reference layouts in `agents/image-generator/references/` + `5x5` copy pack. |
| **6. Checklist (`#/checklist`)** | `http://localhost:3000/p/merrivy/#/checklist` | 7-point pre-launch gate (`7/7`) next to the live 375px mobile preview covering mobile design, copy angles, 2-Kit + `$4.99` protection, media QoL, Shopify variants, Meta Pixel/CAPI, and CJ/supplier fulfillment quote. |
| **7. Launch & Manage (`#/launch` -> `#/manage`)** | `http://localhost:3000/p/merrivy/#/manage` | Launch with a `$50/day` Meta CBO and `$50` first-test loss limit. Once launched, track 15-minute live Meta + Shopify sync in **Manage** across 4 sub-tabs (`Daily Numbers`, `Ad Testing`, `Store & CRO`, `Scale or Cut`). |

---

## 📦 What's Included in This Starter Kit

- **`os/`** — Full Launchroom web app & local API server (`http://localhost:3000/p/merrivy/`), pre-built in `os/dist/` and seeded with clean Day-1 JSON state in `os/data/`.
- **`hydrogen-storefront/`** — Complete Shopify Hydrogen storefront (`http://localhost:3021`) with the Master Base Theme (`base-theme.json`), 52 color palettes (`palettes.json`), 2-Kit + `$4.99` Shipping Protection cart logic, and `scripts/packet-tools.mjs`.
- **`.claude/skills/` & `.agents/skills/`** — All 14 dropshipping & Launchroom skills (`merrivy-os`, `product-discovery`, `prove-it`, `copywriting`, `ad-creative`, `sbc-statics-2.0`, `veo-video-production`, `store- readiness`, `launch-and-scale`, `daily-self-improvement`, `agent-browser`, plus the 3 workspace routing skills).
- **`.claude/agents/` & `agents/`** — All 10 specialized subagents (`scout`, `checker`, `buyer-researcher`, `deep-researcher`, `copywriter`, `image-maker`, `store-builder`, `ad-manager`, `customer-support`, `os-builder`) plus all 50 reference static ads (`static_01.png`–`static_50.png`).
- **`workflow/`, `store/`, `templates/`, `resources/`** — All verification gates (`CHECKS.md`, `LAUNCH-CHECKLIST.md`), storefront blueprints (`PAGE-BLUEPRINT.md`, `HYDROGEN-POPULATION.md`), the 24 researched buyer issue maps (`resources/issues/`), and the gold-standard playbooks (`resources/notes/`).
