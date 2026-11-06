# Shaunn's KPI Calculator & Day 1–2 Scaling Playbook (2026-11-03)

Source files from owner's Google Drive (`gdrive:`):
- `Shaunn's KPI Calculator.xlsx` / `Shaunn's KPI Calculator.pdf`
- `DAY 1-2 TESTING ON TT.docx`

---

## 1. Shaunn's KPI Calculator Formulas

Given inputs:
- **AOV (`B2`):** Average Order Value (`$`)
- **Fees (`B3`):** Payment processing fee (`2.9%`)
- **COGS (`B4`):** Landed product + shipping cost (`$`)
- **Gross Profit % (`B5`):** `(AOV - COGS) / AOV`
- **Profit Target % (`B6`):** Target net margin after ad spend (`20%`)
- **Return % (`B7`):** Refund/return rate (`0.1%` – `3.0%`)
- **Funnel Conversion Rates (`B10:B12`):**
  - `Add to Cart Rate (B10)`: `10%` – `12%`
  - `Reached Checkout Rate (B11)`: `6%` – `8%`
  - `Purchased / CVR (B12)`: `3%` – `4%`

### A. Breakeven KPIs (No Profit, No Loss)
- **Breakeven Cost Per Purchase (`CPP_BE`):**
  $$\text{CPP}_{\text{BE}} = \left(\text{AOV} \times \left(1 - \frac{\text{Fees}}{100}\right) \times \left(1 - \frac{\text{COGS}}{\text{AOV}} \times \frac{\text{Return\%}}{100}\right)\right) - \text{COGS}$$
- **Breakeven Cost Per Initiate Checkout (`CPIC_BE`):**
  $$\text{CPIC}_{\text{BE}} = \text{CPP}_{\text{BE}} \times \frac{\text{Purchased\%}}{\text{ReachedCheckout\%}}$$
- **Breakeven Cost Per Add to Cart (`CPATC_BE`):**
  $$\text{CPATC}_{\text{BE}} = \text{CPP}_{\text{BE}} \times \frac{\text{Purchased\%}}{\text{AddToCart\%}}$$
- **Breakeven Cost Per View Content (`CPVC_BE`):**
  $$\text{CPVC}_{\text{BE}} = \text{CPP}_{\text{BE}} \times \frac{\text{Purchased\%}}{100}$$
- **Breakeven ROAS (`ROAS_BE`):**
  $$\text{ROAS}_{\text{BE}} = \frac{\text{AOV}}{\text{CPP}_{\text{BE}}}$$

### B. 20% Profit Target KPIs (When to Scale Budget)
- **Profit Target Cost Per Purchase (`CPP_Target`):**
  $$\text{CPP}_{\text{Target}} = \text{CPP}_{\text{BE}} - \left(\text{AOV} \times \frac{\text{ProfitTarget\%}}{100}\right)$$
- **Profit Target Cost Per Initiate Checkout (`CPIC_Target`):**
  $$\text{CPIC}_{\text{Target}} = \text{CPP}_{\text{Target}} \times \frac{\text{Purchased\%}}{\text{ReachedCheckout\%}}$$
- **Profit Target Cost Per Add to Cart (`CPATC_Target`):**
  $$\text{CPATC}_{\text{Target}} = \text{CPP}_{\text{Target}} \times \frac{\text{Purchased\%}}{\text{AddToCart\%}}$$
- **Profit Target Cost Per View Content (`CPVC_Target`):**
  $$\text{CPVC}_{\text{Target}} = \text{CPP}_{\text{Target}} \times \frac{\text{Purchased\%}}{100}$$
- **Profit Target ROAS (`ROAS_Target`):**
  $$\text{ROAS}_{\text{Target}} = \frac{\text{AOV}}{\text{CPP}_{\text{Target}}}$$

---

## 2. Benchmark Table for P004 (Witching Hour 2027 Weekly Planner)

| Metric | Sheet Benchmark (`$48` AOV, `$14` COGS) | P004 1-Pack (`$39.99` AOV, `$14.70` COGS) | P004 w/ `$2.99` Protection + Upsells (`~$46` Blended AOV) | **P004 Live Day-1 Morning Actuals (`$14.34` Spend)** |
| :--- | :--- | :--- | :--- | :--- |
| **Breakeven CPP** | `$32.20` | `$23.75` | `$29.60` | **`$7.17` (`2` Sales)** |
| **20% Profit Target CPP** | **`$22.60`** | **`$15.75`** | **`$20.40`** | **`$7.17` (Beats target by 2.2×)** |
| **Breakeven CPIC** | `$16.10` | `$11.88` | `$14.80` | **`$4.78` (`3` Checkouts)** |
| **20% Profit Target CPIC** | **`$11.30`** | **`$7.88`** | **`$10.20`** | **`$4.78` (Beats target by 1.65×)** |
| **Breakeven CPATC** | `$10.73` | `$7.92` | `$9.87` | **`$4.78–$7.17`** |
| **20% Profit Target CPATC** | **`$7.53`** | **`$5.25`** | **`$6.80`** | **`$4.78–$7.17`** |
| **Breakeven ROAS** | `1.49×` | `1.68×` | `1.55×` | **`5.58×` (`$79.98` Rev)** |
| **20% Profit Target ROAS** | **`2.12×`** | **`2.54×`** | **`2.25×`** | **`5.58×` (Beats target by 2.2×)** |

---

## 3. Budget Scaling & Optimization Rules

1. **Never Pause Ads or Cut Budget Intraday (Full-Day Run Rule — Owner, Nov 3):**
   - *"Dont pause any ads though please. Just let it run for the whole day. Only up the budget if the numbers and sales are increasingly high and we can scale. If not, still just let the budget fully run through the day. You never know. It might hit later even if it doesnt now. Thats why its imprtant to keep it running."*
   - Leave all active video and static ads running untouched for the full 24-hour cycle so Meta's auction can convert late-afternoon and evening buyers without resetting delivery.
2. **Same-Day Surf Scaling (When Numbers & Sales Are Increasingly High):**
   - When an active CBO captures `2+` purchases and beats **Profit Target CPP & ROAS** (`CPP < $15.75–$22.60`, `ROAS > 2.12×–2.54×`, `CPIC < $7.88–$11.30`), surf-scale the CBO campaign budget upward (`$50/day -> $100/day -> $150/day+` as sales climb) before peak afternoon/evening shopping hours (`11 AM – 10 PM`) so Meta does not throttle delivery.
3. **The 4-Day Meta Algorithm Priming, End-of-Day 3 Kill Gate & Day 4+ Veo Scale (`#/manage?tab=grow` — Updated Nov 5):**
   - **Day 1 (Algorithm Priming + Expect Day 1 Sales):** Let the `$50/day` CBO run 24 hours untouched; expect `>= 1` sale or `ATC >= 6–8%` + `CTR >= 2.0%`.
   - **Day 2 (Algorithm Priming + Consistency Check):** Expect consistent sales (`CPA <= $30.69` Break-Even). If conversions stall on clicks, run a Store & CRO bottleneck tweak (`#/manage?tab=store`).
   - **End of Day 3 (Learned-Algorithm Kill Gate):** By Day 3 Meta's algorithm has learned who to push to. **Never kill at the start of Day 3—wait until the END of Day 3** (since buyers purchase at different times of day). If metrics at the end of Day 3 are still below break-even or regressing with no sales, execute an **instant kill (`Cancel & Wipe Product`)**.
   - **Day 4+ (Daily Improvement — Custom Veo AI Video Ads & CBO Scale):** For products profitable through Day 3, build **custom Veo AI video ads** on Day 4+ and scale winning CBO budgets (`+20–30%` or horizontal CBO duplication).
4. **2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection (Owner Rule, Nov 4 — Zero 3-Kit, Zero Companion Add-On Headaches):**
   - **1-Kit (Standard):** Base retail price + **`$7.99` Standard Shipping** (customer's `$7.99` shipping fee covers our actual `$7.00` shipping cost).
   - **2-Kit (`MOST POPULAR · SAVE 15%`):** 2 units at `15%` off + **FREE Tracked Shipping** + 1-Tap `1-Kit -> 2-Kit` upgrade inside the slide-out Cart Drawer.
   - **`$4.99` Shipping Protection:** Pre-checked `$4.99` pure-margin toggle inside the Cart Drawer (`BagAddOns: []` — no 3-Kit and no multi-SKU companion add-on headaches).
