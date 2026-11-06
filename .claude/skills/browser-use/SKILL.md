---
name: browser-use
shelf: build
description: Automate the owner's signed-in Chrome browser over CDP (port 9222) using python -m scripts.automation.cli or Chrome MCP for Google Flow image/video generation, Kalodata US queries, Amazon review mining, HyperSKU/CJ checks, and Shopify Admin setup without headless logins.
---

# Browser Automation in the Owner's Signed-In Chrome (`port 9222` / Chrome MCP)

> **The agent browser (port 9333) comes first (owner, Nov 5, 2026):** every tool is signed in once in Launchroom's agent browser (Connect, `#/connect`). Run `os.mjs connect` to see it, `os.mjs connect open <site>` for a working tab, and add `--port 9333` to every `python -m scripts.automation.cli` command below. Port 9222 is the owner's personal Chrome: leave it alone. No Claude in Chrome extension for Shopify and dropshipping work.

Owner Rules (October 3 & November 5, 2026):
> *"Subagents can use my chrome browser so the work can be done with multiple subagents."*
> *"If you actually go and open up a Flow tab and use Flow to generate those images, it's pretty much unlimited, and it doesn't eat up the usage in anti-gravity. That's a preferred way to do it."*
> *"Go ahead and add the product please. This is part of the workflow. If it's not documented, then please do so. You have the chrome tabs where you can work out off."*

This skill connects subagents directly to the owner's active, authenticated Chrome browser on `http://127.0.0.1:9222` via Chrome DevTools Protocol (`python -m scripts.automation.cli`) or Claude-in-Chrome MCP (`mcp__claude-in-chrome__*`), preserving all signed-in sessions across Google Flow, Kalodata US, Amazon US, HyperSKU, CJdropshipping, Shopify Admin, and Meta Ads Manager.

---

## 1. Two Supported Connection Paths (`CDP CLI` & `Chrome MCP`)

### A. Python CDP CLI (`python -m scripts.automation.cli` on `127.0.0.1:9222`)
Run from `c:\Users\Cha Yang\Documents\gemini` (or invoke via full module path) against the active Chrome session on port `9222`:

```powershell
# 1. Verify Chrome CDP connection or launch with a target URL
python -m scripts.automation.cli status
python -m scripts.automation.cli open "https://labs.google/fx/tools/flow" --new-tab

# 2. List open tabs & inspect interactive DOM selectors before acting
python -m scripts.automation.cli tabs
python -m scripts.automation.cli --url-match "labs.google" inspect --limit 60

# 3. Upload truth frames + layout reference PNGs, fill prompts, and click in Google Flow
python -m scripts.automation.cli --url-match "flow" upload "C:\Users\Cha Yang\Documents\dropshipping\products\P007\assets\frame_04.jpg" --trigger "button[aria-label*='Upload']"
python -m scripts.automation.cli --url-match "flow" upload "C:\Users\Cha Yang\Documents\dropshipping\agents\image-generator\references\layouts\static_07.png" --trigger "button[aria-label*='Upload']"
python -m scripts.automation.cli --url-match "flow" fill "textarea" "Prompt text here" --enter
python -m scripts.automation.cli --url-match "flow" click --text "Generate"

# 4. Download generated high-res images/videos (supports blob: and authenticated URLs) or capture screenshots
python -m scripts.automation.cli --url-match "flow" download-assets ".\scratch\outputs" --selector "img,video" --prefix "flow_asset"
python -m scripts.automation.cli --url-match "ndfdtc-br.myshopify.com" screenshot ".\scratch\shopify_admin.png"
```

### B. Claude-in-Chrome MCP (`mcp__claude-in-chrome__*`)
1. Load `mcp__claude-in-chrome__*` tools via ToolSearch.
2. Call `tabs_context_mcp` to inspect existing tabs, then call **`tabs_create_mcp`** to open a **dedicated tab** for your subagent job.
3. Pass your `tabId` on every subsequent browser call (`navigate`, `read_page`, `find`, `form_input`, `computer`, `javascript_tool`).
4. Close **only your own temporary tab** when your job is complete—never close the owner's existing tabs or terminate the browser process.

---

## 2. Primary Workflows in the Owner's Chrome

| Workflow | Target URL | What Agents Are Authorized to Do |
| --- | --- | --- |
| **1. Google Flow Image & Veo 3.1 Video Studio** | `https://labs.google/fx/tools/flow` | Open a dedicated Flow tab, upload real product truth frames + `static_01..50.png` layout reference PNGs, generate 8K product gallery slides (`1:1`), `4:5` DR static ads, and Day 4+ `9:16` Veo 3.1 video ads, and download outputs (zero Antigravity credit drain). |
| **2. Shopify Admin Product, 2-Kit & Pixel Setup** | `https://admin.shopify.com/store/ndfdtc-br` (`ndfdtc-br.myshopify.com`) | Create/update the product, set exact handle, upload gallery media, configure **1-Kit** (`+$7.99` shipping) and **2-Kit** (`Save 15% + Free Shipping`) variants, compare-at prices, unit COGS, `$4.99` Shipping Protection, and verify category-isolated Meta Pixel + CAPI event match (`#5` & `#6` on `#/checklist`). |
| **3. Kalodata US Keyword & Viral Video Mining** | `https://www.kalodata.com` | Execute US API/page queries (`country: "US"`, `currency: "USD"`, `pageSize: 100`), verify rising 7d/30d revenue velocity and `>= 5` viral US videos across `>= 3` US creators, and download top creator `.mp4` videos. |
| **4. Amazon US 4–5 Star & 2–4 Star Review Mining** | `https://www.amazon.com` | Read 4–5 star reviews (for top 3 praised features, trigger moments, verbatim quotes) and 2–4 star reviews (for FAQ objection crushing). Strictly read-only. |
| **5. CJdropshipping & HyperSKU Checks** | `https://www.hypersku.com`, `https://www.alibaba.com`, `https://www.aliexpress.com` | Verify exact hardware match, `<1 kg` weight, `8–12d` US DDP delivery, and `<35%` (`>= 3x`) landed cost (1-unit vs 2-Kit consolidated shipping). Strictly read-only. |
| **6. US Meta Ad Library Competition Check** | `https://www.facebook.com/ads/library` | Filter `country=US`, `active_status=active`, and count direct product competitors (`0–12` for Sleeper Winners, `0–5` for Crazy-Volume Blind-Spot) vs. broad problem-category proof (`2–30+` active ads). |

---

## 3. Hard Safety & Read-Only Guardrails (Never Violate)

1. **Inspect Before Acting:** Always run `inspect` or `read_page` on your target tab first to get real DOM selectors (`#id`, `[aria-label=...]`, `[data-testid=...]`) instead of guessing coordinates.
2. **Strictly Read-Only on Shopping & Supplier Marketplaces (Amazon, HyperSKU, CJ, TikTok):**
   - **NEVER** click "Add to Cart", "Buy Now", "Place Order", "Start Order", "Contact Supplier", or "Chat Now".
   - **NEVER** send messages to suppliers, creators, or customers without explicit owner approval.
3. **Never Touch Brother's Meta Assets or Spend Money Without Approval:**
   - In Meta Business Portfolio `Bm ads 223` (`1126750452473545`), keep the brother's campaigns and assets 100% untouched.
   - Never publish a live paid campaign or change live ad budgets without the owner's explicit yes.
4. **Stop Immediately on CAPTCHAs, Logins, or Payment/Identity Screens:**
   - Never type, store, or print passwords, API keys, 2FA codes, tax IDs, or bank details. If a page presents a CAPTCHA or login wall, pause and report it (or move to the next supplier tab).
