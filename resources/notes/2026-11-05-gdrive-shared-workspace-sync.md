# Google Drive Shared Workspace & Launchroom Cloud Sync (`gdrive:merrivy`)

- **Shared Google Drive Folder (`gdrive:merrivy`):** [https://drive.google.com/drive/folders/1z8Y2hTIbaXd-3x4zYi6N_VwFAQCVdEja](https://drive.google.com/drive/folders/1z8Y2hTIbaXd-3x4zYi6N_VwFAQCVdEja)
- **Folder ID:** `1z8Y2hTIbaXd-3x4zYi6N_VwFAQCVdEja`
- **Cloud Snapshot (Readable on Phone/Laptop When PC Is Off):** `LAUNCHROOM-SNAPSHOT.md` and `os/data/LAUNCHROOM-SNAPSHOT.md`

---

## 1. One-Command Sync for Owner, Brother & Subagents

| Command | NPM Shortcut | Purpose |
| --- | --- | --- |
| `node scripts/sync_gdrive.mjs push` | `npm --prefix os run gdrive:push` | Generates `LAUNCHROOM-SNAPSHOT.md` and syncs local workspace -> `gdrive:merrivy` (`--transfers=8 --checkers=16 --fast-list`) using `.rclone-filter.txt`. |
| `node scripts/sync_gdrive.mjs pull` | `npm --prefix os run gdrive:pull` | Pulls newest files from `gdrive:merrivy` -> local workspace (`--update`) without overwriting newer local files. |
| `node scripts/sync_gdrive.mjs status` | `npm --prefix os run gdrive:status` | Shows local vs. remote file counts, total size, clickable Drive folder link, and per-folder Google Drive links. |
| `node scripts/sync_gdrive.mjs watch` | `npm --prefix os run gdrive:watch` | Background daemon that auto-pushes updates to `gdrive:merrivy` every 5 minutes. |

---

## 2. What Is Synced vs. Excluded (`.rclone-filter.txt`)

### Synced to `gdrive:merrivy`:
- **Root Docs & Configs:** `AGENTS.md`, `USER.md`, `MEMORY.md`, `DESIGN.md`, `LAUNCHROOM-SNAPSHOT.md`, `.rclone-filter.txt`, `os/package.json`, `hydrogen-storefront/package.json`
- **Launchroom OS (`os/`):** `os/data/` (all canonical JSON databases + `LAUNCHROOM-SNAPSHOT.md`), `os/src/`, `os/server/`, `os/public/`
- **Product Discovery & Verification (`research/`):** `comparison.json`, `COMPARISON.md`, `CANDIDATES.md`, active verification batches, and buyer quote files (`buyers/L###.md`)
- **Built Products (`products/`):** `INDEX.md`, `P002`, `P004` (Witching Hour Planner), `P006` (Organic Infrared Heating Pad), `P007` (1-Touch Emergency Water Purifier Pump)
- **Shared Hubs & Resources (`resources/`):** `issues/`, `research/` (Gemini Deep Research reports), `copywriting/` (`WHATS-GOOD.md`), `notes/` (200-Keyword Bible, 20-Statics Playbook, Shaunn KPI Calculator), `learning/`, `sourcing/` (saved supplier images for Amy), and `tiktok-saves/` (viral `.mp4` videos + `.jpg` thumbnails)
- **Storefront & Blueprints (`store/` & `hydrogen-storefront/`):** `store/PAGE-BLUEPRINT.md`, `store/HYDROGEN-POPULATION.md`, `hydrogen-storefront/app/` (including `base-theme.json`, 52 palettes, and product packets), `hydrogen-storefront/public/`, `hydrogen-storefront/scripts/`
- **Workflow, Memory, Subagents & Skills:** `workflow/`, `templates/`, `memory/`, `agents/`, `.claude/agents/`, `.claude/skills/`, `.agents/skills/`, `scripts/`

### Strictly Excluded (Never Uploaded):
- `.env`, `.env.*`, `**/.env`, `**/.env.*`, `*.pem`, `*.key`
- `node_modules/**`, `**/node_modules/**`, `.git/**`
- `os/dist/**`, `os/data/runs/**`, `hydrogen-storefront/dist/**`, `hydrogen-storefront/build/**`, `hydrogen-storefront/.shopify/**`, `hydrogen-storefront/.react-router/**`
- `.claude/scheduled_tasks.lock`, `*.log`, `tmp/**`, `__pycache__/**`
