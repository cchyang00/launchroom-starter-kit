# Merrivy — Daily 1% Improvement & Meta Ad Learning Log

> **Core Philosophy (Owner, Nov 4, 2026):**
> *"Every day, right now, when we're starting dropshipping, our money is being used to try to get profit, yes, but we're also at the learning points because every day we want to get better, right? That means that we have to almost have a document too, where we document things on how we can improve, right? What we learned today, how to improve, right? The next day, we try something new, and we keep getting this data constantly. If we're just improving by 1% every day, that's already better than nothing."*

---

## Daily Operating Loop (How We Compound 1% Every Day)

Every evening / morning review follows four concrete steps:
1. **Capture the Numbers (Ad Spend $\rightarrow$ Funnel $\rightarrow$ Profit):**
   - Record each active campaign's **Spend, Impressions, CPM, Outbound CTR, Cost Per Link Click (CPC), ViewContent (VC), AddToCart (ATC), InitiateCheckout (IC), Purchases, Revenue, and Net Profit/Loss**.
2. **Creative Winner vs. Loser Diagnosis:**
   - Identify which **Direct Response (DR) Native Static Ads** vs. **Viral Videos** get the lion's share of Meta's spend, highest CTR, and lowest Cost Per ATC/Purchase.
   - Ask *why*: What emotional trigger, concrete domino-chain fact, or self-interrogation question stopped the unaware scroller?
3. **Storefront & Cart Funnel Diagnosis:**
   - Check conversion drop-offs:
     - **Click $\rightarrow$ ATC Rate** (Target: $\ge 6\%–8\%$) — Is the Front-Page Hero clean, mobile-friendly, and priced at a familiar market anchor?
     - **ATC $\rightarrow$ Checkout / Purchase Rate & AOV** — How many buyers took **Option 1 (`2-Pack Bundle`)** vs. **Option 2 (`Companion Add-Ons`)** to hit the **`$60+` Free Shipping threshold**? How many kept **`$4.99` Shipping Protection** and paid **`$7.99` shipping**?
4. **Tomorrow's 1% Test (One Clear Hypothesis Per Day):**
   - Pick **1–2 concrete improvements** to ship for the next day (e.g., 3 new DR static variations off the #1 winning hook, a cleaner mobile hero badge, or a sharper Cart Free-Shipping nudge). Never pause ads mid-day while a daily budget is still pacing.

---

## Day-by-Day Log

### 📅 Day 1–2 Baseline & System Overhaul — November 3–4, 2026

#### 1. Live Store & Orders Snapshot (Before Pixel Separation & DR Overhaul)
- **Total Real Customer Orders Collected (`#1001`–`#1006`):** **`6` Paid Orders (`$308.88` Gross Revenue)**
  - **Product 1 — `P004: Waiting for the Night — The Witching Hour 2027 Grimoire Planner` (`5` Orders — `$248.90` Revenue):**
    - `#1001` (Nov 3): `1 Planner` — **`$39.99`**
    - `#1002` (Nov 3): `1 Planner` — **`$39.99`**
    - `#1003` (Nov 3): `2-Planner Bundle` — **`$69.98`** *(Proved buyers naturally upgrade to a 2-Pack Gift Pair!)*
    - `#1004` (Nov 4): `1 Planner` + `$4.99` Transit Protection + `$7.99` Shipping — **`$42.97`** *(Proved buyers happily keep `$4.99` protection + `$7.99` shipping!)*
    - `#1005` (Nov 4): `1 Planner` + `Witch's Broomstick Pencils Add-On` + `$4.99` Transit Protection — **`$55.97`** *(Proved buyers add niche companion add-ons in the cart!)*
  - **Product 2 — `P007: The Split-Panel Solar Indoor & Outdoor Ceiling Light Kit (2-Pack)` (`1` Order — `$59.98` Revenue):**
    - `#1006` (Nov 4): `1 Solar Kit` + `$4.99` Transit Protection + Shipping — **`$59.98`** *(Profitable on Day 1 even before pixel separation and new DR static ads!)*

#### 2. Key Lessons We Learned Today (Nov 4, 2026)
1. **Unaware-Scroller Direct Response (DR) Native Static Ads Beat Generic Feature Videos on Meta:**
   - **What we saw:** Random feature-explainer videos waste spend on Meta because Facebook/Instagram users (especially older demographics who read feeds) don't sit through a 30-second feature video unless they are already hooked. Meanwhile, one strong DR static image hits all their emotions and curiosity in 1.5 seconds.
   - **What we learned about hooks:**
     - **Never be vague** (*"With everything happening in the government..."* makes an unaware scroller ask *"Wait, what's happening?"* and scroll past).
     - **Spell out the Concrete Domino Chain or Specific Fact first, then force a Self-Interrogation Question (`"What Will You Do?"`):**
       - *Solar (`P007`):* `"First the bottled water at the store is gone. Then the food shelves empty. Next go the power, gas pumps, and running water. When night falls on your street, what will you do?"` (`DR27`, `DR29`) and `"FBI & Dept. of Energy warned foreign malware is inside U.S. power grids—and damaged transformers take 12+ months to replace"` (`DR28`) + `"You Have 42 Hours"` (`DR24`).
       - *Planner (`P004`):* Turn a non-emotional stationery item into an urgent emotional trigger: `"How much of this past year did you already forget—and what do you have right now to keep 2027 from blurring away too?"` (`DR26`), `"When you spend all day holding your thoughts inside, where do you go at night to finally express who you really are?"` (`DR27`), and `"11:47 PM: Your body is exhausted, your phone is burning your eyes, and 14 unfinished tabs are still racing through your head"` (`DR28`).
     - **Never sound desperate on the image:** Removed pushy coupon boxes (`SECRET5`) from ad images so the native editorial/story message carries 100% of the psychological pressure.
     - **Only keep 2–3 truly viral creator videos per ad set** (`V01` & `V03` on Solar; `V01`, `V02`, `V07` on Planner) and pause filler videos.
2. **Isolated Pixels Per Product Category (Meta + WeTracked.io):**
   - Running a gothic stationery planner and an emergency solar blackout kit on the same pixel mixes two completely different buyer profiles.
   - **Fix shipped:** Isolated **Pixel `#1` (`1003355539496617`)** exclusively for the Planner (`$100/day`) and **Pixel `#2` (`1656598869345569`)** exclusively for the Solar Blackout Kit (`$50/day`), both connected in WeTracked.io and firing `trackSingle` on `merrivy.com`.
3. **2-Option Bundle Selector (`1-Pack` vs `2-Pack`), Clean Front-Page Hero, & Storewide `$60+` Free Shipping Gamification:**
   - **Why 2 options beats 3:** Shoppers rarely buy a 3-pack on cold traffic (`#1003` proved the `2-Pack` is the real sweet spot). Removing the 3-pack eliminates decision fatigue.
   - **Why we removed `+$7.99 Shipping` from the front-page hero:** Showing shipping fees on the product hero adds premature friction before the buyer clicks `Add to bag`.
   - **Why we fixed the mobile `MOST POPULAR` ribbon:** On mobile (~375px wide), a 55-character ribbon wrapped onto 2 lines and slightly blocked the 2-Pack offer title. Shortening it to a single-line pill (`★ MOST POPULAR · BEST VALUE`) and stacking the `SAVE 50%` / `SHIPS FREE` tags on their own sub-row made the mobile hero 100% clean.
   - **Why `$60+` is our Storewide Default for Free Shipping (instead of `$50+`):**
     - At `$50`, a `1-Pack` (`$34.99–$39.99`) + `$4.99` protection + `$7.99` shipping is already `$47.97–$52.97`—creating an annoying "$2–$3 short" bummer moment or confusion on Solar (`$52.97`), while barely leaving profit if free shipping triggers at `$50`.
     - At **`$60+`**, a single unit is `$20–$25` away from Free Shipping, creating a real incentive to use our **2-Path Cart Free-Shipping System**:
       - **Option 1:** 1-Tap upgrade to the **`2-Pack Bundle`** (`$54.98` Planner 2-Pack or `$63.98` Solar 2-Pack — effectively only `$12–$16` more after saving `$7.99` shipping!).
       - **Option 2:** Add our 2 verified companion add-ons (`$11.99 + $13.99` on Solar = `$65.97` total; `$13.99 + $14.99` on Planner = `$63.97` total) via the **1-Tap `"⚡ Add Both Companion Extras & Ship Order FREE"`** button—or add 1 item to trigger the `"🔥 Almost there! Only $6–$10 away from FREE Shipping!"` progress bar nudge.
4. **Supplier & Fulfillment Bottleneck Watch:**
   - Having unfulfilled orders sit for 24+ hours (`Flexfulfills` / `Zhang Alan` — `flexfulfills@gmail.com`) is an operational risk as we scale. We must enforce same-day/next-day PayPal invoicing and tracking upload from our fulfillment collaborator, and always keep a backup fulfillment agent (e.g., CJdropshipping / HyperSKU / private WeChat/WhatsApp line) ready if a collaborator lags.
5. **2-Stage Browse-to-Cart & Cart-to-Checkout Recovery System (Keeping `$60+` Free Shipping):**
   - Removed the old random scroll-triggered `$5 off` popup that had stale pricing.
   - **Stage 1 (Visitor on page for 32s with 0 items in cart):** Friendly helper prompt invites them to reserve their 2-Pack Bundle (`FREE Shipping`) or 1-Unit (`+$7.99` shipping). If they click *"Not right now — I'm hesitating over the $7.99 shipping / price"*, it escalates to a **Courtesy Free Tracked Shipping Pass (`FREESHIPVIP` — Saves `$7.99` at checkout)** or `$5.00 Off 2-Pack (`SECRET5`)**.
   - **Stage 2 (Shopper added to cart, then either removes the product OR hesitates 18s without checking out):**
     - Removing the product from the cart automatically wipes any applied promo codes and leftover shipping protection so stale deals never linger—and immediately shows a **Cart Removal Recovery Deal Card** inside the Cart Drawer (`Restore 1-Unit + FREE Shipping` or `Restore 2-Pack + $5.00 Off`).
     - Sitting in the Cart Drawer for 18s without clicking Checkout surfaces a 1-tap **Courtesy Free Shipping Pass (`FREESHIPVIP`)** (or `+$5.00` Credit `SECRET5` if Free Shipping is already unlocked) right above the Checkout button.
6. **Day-2 Creative Evolution Formula (Owner & Brother Feedback, Nov 4, 4:46 PM CST — Build on Today's Best Performers Tonight):**
   - **What our Day-1 static ads did well vs. what was missing:** Our Day-1 static ads brought strong story, real-world issue awareness, and urgency, **but** (a) several headlines were too long (`14–20` words) instead of grabbing attention in `0.5` seconds, and (b) some crisis-focused ads didn't immediately display a quick, punchy sentence/strip of **our 3 best product features** right on the ad.
   - **The Complete 4-Step Conversion Flow (`Ad -> Site -> Checkout`):**
     1. **Shorter, Instant-Grab Headline (`3–7 words` max):** Hook an unaware scroller immediately in under a second (e.g., *"When the Power Grid Dies Tonight"*, *"48 Hours With Zero Electricity"*, *"Why 92% Quit Their Planner"*).
     2. **Issue Awareness & Urgency:** Make an unaware viewer instantly aware of the problem and feel urgent to act now.
     3. **One Quick Sentence / Strip of the 3 Best Features Instantly:** Right after urgency, show the 3 killer hardware/product features so **they are already 100% sold on the product before they even click to the site**:
        - *Solar (`P007`):* `"16.5ft Split Cord (Solar Panel Outside, Ceiling Light Inside) · Lights 2 Full Rooms 16 Hrs · $0 Gas, $0 Wiring, Remote Controlled"`
        - *Planner (`P004`):* `"120gsm Zero-Bleed Vintage Paper · Monthly Potion Habit & Reading Trackers · 4 Free Gothic Sticker Sheets + Bookmark"`
     4. **Site Closes the Deal Effortlessly:** Once they land already sold on the product, our clean pricing, 2-Pack bundle (`Free Shipping`), and guided cart flow convert them into a buyer.
   - **Execution Rule:** Do **not** touch today's active ads mid-day. At the end of the day, identify today's top-performing winners (`C11`, `DR18`, `DR27`, `DR25`, `DR20`, `V01`) and build Day-2 evolved variations directly on top of those winners with **shorter punchy headlines + the 3-best-features strip**.
7. **Avatar Persona Page ("Whitelisting" Identity) + 1st-Person Lived-Experience POV Beats Store-Page Ads (Owner & Brother Feedback, Nov 4, 4:52 PM CST):**
   - **Why `Merrivy` (Store Page) triggers ad blindness:** When scrollers see a corporate/store name (`Merrivy`) posting an ad, their brain immediately flags it as a store trying to sell them something.
   - **Why Avatar Persona Pages + 1st-Person POV convert way higher:**
     - **Page Identity:** Post ads from a **Persona / Avatar Facebook Page** (e.g., a real-looking homeowner/dad blog page like *"David Miller"* / *"Everyday Family Preparedness"* for `P007` Solar, and a cozy bookish/dark-academia creator persona page like *"Elena Vance"* / *"Late Night Reads & Journals"* for `P004` Planner) with a candid human profile photo.
     - **Creative & Copy POV:** Both the primary text and the image itself must speak from **1st-person lived experience (`"I bought this..."`, `"Here's how I set mine up..."`, `"The 3 features that sold me:"`)** rather than a store pitching its own product.
     - **Data proof already happening in our account today:** Our #1 highest-CTR Planner static ad today (`DR25_Coffee_Shop_Antique_Book_Curiosity` at **`9.52%` Outbound CTR**) and #2 (`C11_AMA_Confession` at **`3.26%` CTR**) are both written in **1st-person avatar POV** (*"Every time I open this in a coffee shop..."* / *"Where did you find this? This one right here..."*)!
8. **Always Include Feature Comparison & Mine Real Amazon/TikTok Shop Customer Reviews as the Copywriting Foundation (Owner & Brother Feedback, Nov 4, 4:59 PM CST):**
   - **Stop Guessing — Build Every Ad From Verbatim Amazon & TikTok Shop Reviews:** Real customer reviews tell us *who* bought the product, *what trigger moment* made them buy, *which specific features* surprised and delighted them, and *what problem it already solves* in their exact words. By pulling our hooks, stories, and feature callouts directly from verified Amazon & TikTok Shop buyer reviews, we never guess what our audience cares about.
   - **Every Ad Must Put the Product in the Best Light With Clear Features / Feature Comparison:**
     - The **headline and image** deliver the **story, emotion, and urgency** from the avatar's POV.
     - Right alongside that urgency, **every ad (and primary copy) MUST display the specific features or a side-by-side Feature Comparison** showing *why* this product is great and *how* it helps the viewer in that exact situation (e.g., `16.5ft Split Waterproof Cord so the panel charges outside while the 60-LED dome hangs indoors` vs. `1-piece solar lights that can't charge inside & dead AA flashlights`).
9. **Never Turn Off Yesterday's Actual Meta Sales, ATC & Click Winners (Owner Correction, Nov 4, 6:00 PM CST):**
   - **What went wrong earlier today:** When trimming the Planner video ads down to 3 (`V01`, `V02`, `V07`), we looked at Kalodata video views instead of checking **yesterday's (`Nov 3`) actual Meta Purchases, AddToCarts, and Clicks**—and accidentally paused `VID_V11_chaoslilith_1080p` (`$33.52` spend, `794` impr, `38` clicks, `4.79%` CTR, `$42.21` CPM, `4` ATC, `5` IC, **`1` Purchase**), `VID_V18_chaoslilith_1080p` (`16.67%` CTR, **`1` Purchase**), `VID_V10_shopwithzara555_1080p` (`8.82%` CTR today + `1` ATC/`1` IC yesterday), and `STATIC_C10_Open_Grimoire_5_Notes` (`8.62%` CTR).
   - **Why that hurt today's metrics:** Turning off the #1 top-spending, purchase-producing creative forced Meta's algorithm to re-learn from scratch, spiked CPM from `$54.64` $\rightarrow$ `$68.38`, and cut visitor volume in half.
   - **Hard Rule Going Forward:** Every single day, before touching any ad, check **Yesterday's & Last 3 Days' actual Meta Purchases, AddToCarts, Checkouts, and Clicks**. **NEVER pause an ad that drove Purchases, high ATC/IC, or top CTR the day before**—keep every winning ad active so the algorithm compounds on its existing data, and only build new ads alongside them.
   - **Immediate Fix Applied at 6:00 PM CST:** Re-enabled `VID_V11_chaoslilith_1080p`, `VID_V18_chaoslilith_1080p`, `VID_V10_shopwithzara555_1080p`, and `STATIC_C10_Open_Grimoire_5_Notes` back to `ACTIVE` (`task-9738`).

---

## 📊 Active Test Sheet to Monitor (Nov 4–5, 2026)

| Campaign | Daily Budget | Pixel ID | Breakeven CPA (`1-Pack` / `2-Pack`) | Active Creative Mix to Watch | What We Will Measure Tomorrow |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`P007` Split-Panel Solar Blackout Kit** (`120258967576870197`) | **`$50.00/day`** | `1656598869345569` | **`$26.65`** (1-Kit w/ ship & prot: **`$39.63`**) · **`$42.76`** (2-Kit Bundle) | **13 DR Statics** (`DR27` Domino Chain, `DR28` Pentagon/FBI Grid Warning, `DR29` Livelihood Stripped, `DR24` 42-Hr Countdown, `DR26` What's In Your House, `DR20–DR23`, `DR18–DR19`, `C11–C12`) + **2 Viral Videos** (`V01`, `V03`) | 1. Which DR static gets the highest CTR & lowest CPC/ATC?<br>2. Do Domino-Chain (`DR27`/`DR29`) & Federal Fact (`DR28`) outperform the 42-Hr Countdown (`DR24`)?<br>3. What % of buyers upgrade to the 2-Kit Bundle or add the 2 Solar accessories in the new `$60+` Cart Drawer? |
| **`P004` Witching Hour 2027 Grimoire Planner** (`120258950696210197`) | **`$100.00/day`** | `1003355539496617` | **`$15.85`** (1-Pack w/ ship & prot: **`$28.83`**) · **`$28.05`** (2-Pack Gift Pair) | **9 DR Statics** (`DR26` Memories Slipping Away, `DR27` Nowhere to Express Yourself, `DR28` Racing Mind at 11 PM, `DR23–DR25`, `DR20`, `DR22`, `C11`) + **3 Viral Videos** (`V01`, `V02`, `V07`) | 1. How do the 3 new emotional self-interrogation triggers (`DR26` Memory, `DR27` Self-Expression, `DR28` Racing Mind) perform vs. `V01`/`V02` videos?<br>2. Does the new `$60+` Cart Drawer lift 2-Planner Gift Pair (`$54.98`) and dual add-on (`+$28.98`) take rates? |

---

### 🕑 2:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$32.65`** *(+$2.80 last hr)* | `569` | **`23`** (**`4.04%` Outbound CTR**) | `$0.93` CPC · `$57.38` CPM | `15` LPV / **`16` VC** | `1` ATC (Pixel #2 raw) · `1` Purchase (`#1006` `$59.98` earlier today) | **Ad Hook = A+ (`4.04%` Outbound CTR):** `STATIC_P007_C11_Federal_Grid_Target_Warning` (`5.66%` CTR on active ad set, `4` VCs on `$6.82`), `STATIC_P007_C13_Night_3_Blackout_Comparison` (`20.00%` CTR, `2` clicks on `10` impr), `STATIC_P007_C15_AMA_War_Cyber_Grid_Prep` (`5.88%` CTR), and `VID_P007_V01` (`8.33%` CTR) are stopping the scroll well. New Domino-Chain (`DR27`) just got its first impression.<br>**Bottleneck to Watch = `VC -> ATC`:** `16` ViewContents have only produced `1` ATC so far (`6.25%` ATC rate). The new 32s Friendly Browse Helper + `FREESHIPVIP` pass deployed at `1:35 PM` is now active for all afternoon/evening traffic. |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$29.68`** *(+$2.33 last hr)* | `496` | **`18`** (**`3.63%` Outbound CTR**) | `$1.14` CPC · `$59.84` CPM | `16` LPV / **`17` VC** | `0` ATC · `0` Purchase today *(3 orders `#1003–#1005` previously)* | **Ad Hook = Strong (`3.63%` Outbound CTR):** `VID_V01_mommmmmy.issues` (`$9.89` spend, `3.41%` CTR, `6` VCs), `STATIC_C11_AMA_Confession` (`$3.97` spend, `3.37%` CTR, `3` VCs), and `STATIC_P004_DR20_Why_92Pct_Abandon_Planners` (`$0.58` spend, `5.26%` CTR, `1` VC) are driving qualified visitors (`94%` click-to-ViewContent retention: `17` VCs from `18` outbound clicks).<br>**Watch item:** `STATIC_P004_DR22_Graveyard_Of_Unfinished_Planners` has spent `$2.00` (`15` impr, `0` clicks). Keep watching through tonight; if it hits `$5–$8` with `0` clicks while `DR20` and `DR26–DR28` get traction, we will cut `DR22` at end-of-day review. |
| **Supplier (`flexfulfills@gmail.com`)** | — | — | — | — | — | `6` unfulfilled orders (`#1001–#1006`) | Checked Zoho Mail Inbox (`support@merrivy.com`) at `2:01 PM CST` — no reply yet from `flexfulfills@gmail.com` (Note: `2:00 PM CST` is **`4:00 AM` China Standard Time**, so Zhang Alan's team will wake up and see our urgent email around `7:00–9:00 PM CST` tonight). |

---

### 🕒 3:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$35.61`** *(+$2.96 vs 2 PM)* | `620` *(+51)* | **`25`** *(+2 clicks)* (**`4.03%` Outbound CTR**) | `$0.96` CPC · `$57.44` CPM | `15` LPV / **`16` VC** | `1` ATC (Pixel `#2`) · `1` Purchase (`#1006` `$59.98`) | **Pacing & Hook:** Outbound CTR remains above `4.0%` (`4.03%`). `STATIC_P007_C11_Federal_Grid_Target_Warning` picked up `+2` more outbound clicks (`5` clicks on the active ad set / `11` total today) and `VID_P007_V01_CowboyGadgets` is at `6.25%` CTR. Pacing is `~$2.96/hr` as CBO saves the remaining `$14.39` budget for evening peak hours. |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$32.10`** *(+$2.42 vs 2 PM)* | `540` *(+44)* | **`21`** *(+3 clicks)* (**`3.89%` Outbound CTR**) | `$1.00` CPC · `$59.44` CPM | `16` LPV / **`17` VC** | `0` ATC today *(3 orders `#1003–#1005` previously)* | **Hook Improving (`3.63%` $\rightarrow$ `3.89%` Outbound CTR, CPC down from `$1.14` $\rightarrow$ `$1.00`):**<br>- `VID_V01_mommmmmy.issues` picked up another click (`7` clicks on `182` impr = **`3.85%` CTR**).<br>- `STATIC_P004_DR25_Coffee_Shop_Antique_Book_Curiosity` is at **`7.14%` CTR** (`1` click on `14` impr, `$0.71` spend).<br>- `STATIC_P004_DR20_Why_92Pct_Abandon_Planners` is at **`2.86%` CTR** (`1` click on `35` impr, `$1.23` spend).<br>- `STATIC_P004_DR22_Graveyard_Of_Unfinished_Planners` is at `$2.09` (`19` impr, `0` clicks) — still #1 candidate to cut tonight if it doesn't convert during evening peak. |

---

### 🕓 4:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$37.63`** *(+$2.02 vs 3 PM)* | `657` *(+37)* | **`26`** *(+1 click)* (**`3.96%` Outbound CTR**) | `$0.94` CPC · `$57.28` CPM | `15` LPV / **`16` VC** | `1` ATC (Pixel `#2`) · `1` Purchase (`#1006` `$59.98`) | **New DR Statics Entering Rotation:** `STATIC_P007_DR18_48Hr_Blackout_Timeline` just served its first impression (`$0.14`) alongside `DR27` (`Water/Food/Power Domino`) and `DR23` (`72Hr Outage Alert`). `C11` (`$14.08` spend, `272` impr, `6` clicks on active ad set / `12` total today) continues to anchor delivery while CBO saves `$12.37` for evening peak hours. |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$38.62`** *(+$6.52 vs 3 PM)* | `657` *(+117)* | **`24`** *(+3 clicks)* (**`3.65%` Outbound CTR**) | `$1.02` CPC · `$58.78` CPM | **`19` LPV** *(+3)* / **`20` VC** *(+3)* | `0` ATC today *(3 orders `#1003–#1005` previously)* | **Clear Creative Winner Emerging (`STATIC_P004_DR25_Coffee_Shop_Antique_Book_Curiosity`):**<br>- `DR25` surged from `14` $\rightarrow$ **`42` impressions (`$2.60` spend)** with **`4` outbound link clicks (`9.52%` Outbound CTR, `$0.65` CPC)** and **`3` `ViewContent`s** (`75%` LPV retention).<br>- `VID_V01_mommmmmy.issues` is at **`7` clicks / `7` `ViewContent`s (`100%` click-to-VC retention)** on `$12.07` spend.<br>- `STATIC_P004_DR24_Stop_Buying_4_Separate_Notebooks` (`12` impr, `$0.59`) and `DR27_Holding_Thoughts_Inside` (`12` impr, `$0.22`) are now actively getting evening impressions.<br>- `DR22_Graveyard_Of_Unfinished_Planners` (`$2.55` spend, `24` impr, `0` clicks) remains at `0.00%` CTR — confirmed cut candidate for tonight's end-of-day review. |

---

### 🕔 5:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$38.90`** *(+$1.27 vs 4 PM)* | `685` *(+28)* | **`26`** (**`3.80%` Outbound CTR**) | `$0.97` CPC · `$56.79` CPM | **`18` LPV** *(+3)* / **`19` VC** *(+3)* | `1` ATC (Pixel `#2`) · `1` Purchase (`#1006` `$59.98`) | **Evening Traffic Entering PDP (`+3` LPV / `+3` VC):**<br>- `STATIC_P007_C11_Federal_Grid_Target_Warning` (`$14.71`, `293` impr, `6` clicks on active ad set / `12` total today, `6` VCs on active ad set) and `VID_P007_V01_CowboyGadgets` (`$1.40`, `19` impr, `1` click, **`5.26%` CTR**, `1` VC) continue driving steady evening views.<br>- Feature-comparison static `STATIC_P007_DR21_Why_99Pct_Solar_Useless_Indoors` (`1-Piece Solar vs. 16.5ft Split Cord`) just entered live impressions alongside `DR18`, `DR23`, and `DR27`. |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$57.31`** *(+$18.69 vs 4 PM)* | `891` *(+234)* | **`33`** *(+9 clicks)* (**`3.70%` Outbound CTR**) | `$1.01` CPC · `$64.32` CPM | **`23` LPV** *(+4)* / **`27` VC** *(+7)* | **`1` Attributed `ATC` on Pixel `#1`!** | **Evening Peak Acceleration (`+$18.69` spend, `+9` clicks, `+7` VCs, First Attributed `AddToCart` on Pixel `#1`):**<br>- **`VID_V01_mommmmmy.issues_1080p`** surged to `$24.45` spend, `357` impr, **`13` outbound clicks (`3.64%` CTR)**, **`11` `ViewContent`s**, and **drove our first attributed `AddToCart` (`1` ATC) on isolated Pixel `#1`!**<br>- **`STATIC_P004_DR25_Coffee_Shop_Antique_Book_Curiosity` (1st-Person Avatar POV)** scaled from `$2.60` $\rightarrow$ **`$7.17` spend (`75` impr, `5` clicks, `6.67%` Outbound CTR, `4` VCs)**—proving 1st-person avatar POV scales cleanly with budget.<br>- **`STATIC_P004_DR24_Stop_Buying_4_Separate_Notebooks` (Feature-Consolidation Comparison)** picked up its first click (`28` impr, `1` click, **`3.57%` CTR**).<br>- Even `STATIC_P004_DR22_Graveyard_Of_Unfinished_Planners` converted an evening click + VC (`31` impr, `1` click, **`3.23%` CTR**, `1` VC)—validating our decision not to pause ads mid-day! |

---

### 🕕 6:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$41.21`** *(+$2.31 vs 5 PM)* | `710` *(+25)* | **`27`** *(+1 click)* (**`3.80%` Outbound CTR**) | `$1.01` CPC · `$58.04` CPM | **`19` LPV** *(+1)* / **`20` VC** *(+1)* | `1` ATC (Pixel `#2`) · `1` Purchase (`#1006` `$59.98`) | `C11` (`$16.37` on active ad set, `310` impr, `7` clicks / `13` total today) and `V01` (`$1.92`, `24` impr, `1` click) continue steady evening delivery; `DR28_FBI_DOE_Malware_Transformer_12Months` just got its first impression alongside `DR27`, `DR23`, `DR21`, and `DR18`. |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$71.61`** *(+$14.30 vs 5 PM)* | `1,054` *(+163)* | **`41`** *(+8 clicks)* (**`3.89%` Outbound CTR**) | `$1.04` CPC · `$67.94` CPM | **`31` LPV** *(+8)* / **`37` VC** *(+10)* | **`3` `ATC`** *(+2 vs 5 PM)* · **`3` `IC` (Checkouts)** *(+3 vs 5 PM!)* | **3 Shoppers Reached Checkout (`3` ATC $\rightarrow$ `3` IC) & Yesterday's Winners Restored:**<br>- Between 5 PM and 6 PM, `VID_V01_mommmmmy.issues` jumped from `1` ATC $\rightarrow$ **`3` `AddToCart`s and `3` `InitiateCheckout`s** (`$33.95` spend, `474` impr, `19` clicks, `4.01%` CTR, `19` VCs), and `DR25_Coffee_Shop_Antique_Book_Curiosity` reached `$10.87` spend (`102` impr, `7` clicks, **`6.86%` CTR**, `6` VCs).<br>- **Restored Yesterday's Proven Winners at 6:00 PM CST:** Turned `VID_V11_chaoslilith_1080p` (`1` sale, `38` clicks, `$42` CPM yesterday), `VID_V18_chaoslilith_1080p` (`1` sale, `16.67%` CTR yesterday), `VID_V10_shopwithzara555_1080p` (`8.82%` CTR), and `STATIC_C10_Open_Grimoire_5_Notes` (`8.62%` CTR) back to `ACTIVE` for tonight's 6 PM–11 PM peak. |

---

## 🎯 Tonight's Midnight Review & Tomorrow's Game Plan (Nov 5 — "Perfect Before Launch, Prove or Kill")

> **Owner Direction (Nov 4, 6:14 PM CST):**
> *"Let everything run until midnight and pretty much learn from today... take a note at the end of today, then make a goal for tomorrow of what we should do, and do it right for tomorrow. Tomorrow should be the last day we run it. If we don't see any significant changes, then we kill the product... However the other product with the sales is very profitable. We just need to make better ads for it by the end of today and then set it out tomorrow. We have to perfect every ad before we launch them. Before we launch those ads they have to be perfected because the algorithm has to learn."*

### 1. Tonight (`6:15 PM – Midnight CST`): Observe & Prepare (Zero Mid-Flight Edits)
- Let both campaigns finish running out today's budget completely untouched through midnight.
- Continue hourly live snapshots (`7:00 PM`, `8:00 PM`, `9:00 PM`, `10:00 PM`, `11:00 PM`, `Midnight`) to capture final Day-1/Day-2 data.

### 2. End-of-Day Build Tonight (Perfect Every Ad *Before* Launching for Tomorrow)
Before midnight / tomorrow's run, we will craft and visually verify our **perfected Day-2/Day-3 Native Ads** so zero changes are needed once tomorrow starts:
1. **Built 100% From Real Amazon & TikTok Shop Buyer Reviews:** Use verbatim customer quotes, trigger moments, and top-praised features.
2. **Short, Instant-Grab Headline (`3–7 words` max):** Stop the scroll in `0.5s`.
3. **Emotion + Urgency + 3 Best Features / Side-by-Side Feature Comparison on Every Image:** Make the viewer aware, make them feel urgent, and immediately hand them the 3 killer features (or comparison table) so they arrive on `merrivy.com` already sold.
4. **Posted From Avatar Persona Pages (`Olivia Scott` for `P004` Planner · `Michael L` for `P007` Solar) in 1st-Person POV (`"I..."`):** Bypass store-ad blindness.
5. **Clean Ad-Set Structure (`3–5` Perfected Ads Max Per Ad Set + Proven Winning Videos Kept Active):** Keep `V11_chaoslilith`, `V18_chaoslilith`, `V01_mommmmmy.issues`, `V02_althespongegal`, `C10`, and `DR25` active on Planner, and `C11` + `V01_CowboyGadgets` active on Solar, while placing the perfected new static ads in a clean `3–5` ad structure so Meta actually spends on them.

### 3. Tomorrow's Hard Gate (`Nov 5`): Final Test Day to Pop Off or Kill
- Run tomorrow's full day completely untouched from start to finish with the perfected ads in place.
- **Hard Decision at End of Tomorrow (`Nov 5`):** Any campaign/product that does not show significant sales & metric improvement tomorrow gets **killed cleanly** (no throwing money into the gutter after a broken algorithm), while the profitable winner gets scaled.

---

### 🕖 7:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$44.81`** *(+$3.60 vs 6 PM)* | `753` *(+43)* | **`31`** *(+4 clicks)* (**`4.12%` Outbound CTR** 🔥) | **`$0.93` CPC** · `$59.51` CPM | **`23` LPV** *(+4)* / **`23` VC** *(+3)* | `1` ATC (Pixel `#2`) · `1` Purchase (`#1006` `$59.98`) | **`VID_P007_V01_CowboyGadgets_Full_Reveal` Surging (`9.30%` CTR):**<br>- Between 6 PM and 7 PM, `V01_CowboyGadgets` jumped from `$1.92` $\rightarrow$ **`$4.29` spend (`43` impr, `4` outbound clicks = `9.30%` Outbound CTR, `3` VCs)**.<br>- `STATIC_P007_C11_Federal_Grid_Target_Warning` added another click (`$17.42` spend, `329` impr, `8` clicks on active ad set / `14` total today, `8` VCs).<br>- Outbound CTR climbed back above `4%` (**`4.12%`**) and CPC dropped to **`$0.93`** (`$5.19` remaining in today's `$50` budget). |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$79.21`** *(+$7.60 vs 6 PM)* | `1,159` *(+105)* | **`43`** *(+2 clicks)* (**`3.71%` Outbound CTR**) | `$1.12` CPC · `$68.34` CPM | **`34` LPV** *(+3)* / **`40` VC** *(+3)* | **`3` `ATC`** · **`3` `IC` (Checkouts)** | **Restored Winner `VID_V10_shopwithzara555_1080p` Immediate Pickup (`10.53%` CTR):**<br>- Right after being re-enabled at 6 PM, `VID_V10_shopwithzara555_1080p` picked up another click (`$2.03` spend, `38` impr, **`4` clicks = `10.53%` Outbound CTR**, `3` VCs).<br>- `VID_V01_mommmmmy.issues` is at `$38.75` spend (`549` impr, `20` clicks, `21` VCs, `3` ATCs, `3` ICs), and `DR25_Coffee_Shop_Antique_Book_Curiosity` is at `$12.19` spend (`113` impr, `7` clicks = **`6.19%` CTR**, `7` VCs).<br>- `$20.79` remaining in today's `$100` budget heading into the `8:00 PM – 10:30 PM` peak window. |
| **Supplier (`flexfulfills@gmail.com`)** | — | — | — | — | — | `6` unfulfilled orders (`#1001–#1006`) | Checked Zoho Mail Inbox (`support@merrivy.com`) at `7:00 PM CST` (`9:00 AM` China time) — no reply yet; watching closely this evening. |

---

### 🕗 8:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$47.53`** *(+$2.72 vs 7 PM)* | `792` *(+39)* | **`34`** *(+3 clicks)* (**`4.29%` Outbound CTR** 🔥) | **`$0.97` CPC** · `$60.01` CPM | **`26` LPV** *(+3)* / **`26` VC** *(+3)* | `1` ATC (Pixel `#2`) · `1` Purchase (`#1006` `$59.98`) | **`VID_P007_V01_CowboyGadgets_Full_Reveal` Hits `11.11%` Outbound CTR:**<br>- `V01_CowboyGadgets` jumped from `$4.29` $\rightarrow$ **`$5.89` spend (`54` impr, `6` outbound clicks = `11.11%` Outbound CTR, `5` VCs)** (`+2` clicks, `+2` VCs this hour).<br>- `STATIC_P007_C11_Federal_Grid_Target_Warning` added another click + VC (`$18.29` spend, `352` impr, `9` clicks on active ad set / `15` total today, `9` VCs).<br>- Campaign Outbound CTR rose to **`4.29%`** (`$2.47` remaining in today's `$50` budget). |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$86.25`** *(+$7.04 vs 7 PM)* | `1,273` *(+114)* | **`47`** *(+4 clicks)* (**`3.69%` Outbound CTR**) | `$1.08` CPC · `$67.75` CPM | **`37` LPV** *(+3)* / **`44` VC** *(+4)* | **`3` `ATC`** · **`3` `IC` (Checkouts)** | **Entering the 8:00 PM – 10:30 PM Evening Window (`$13.75` Budget Left):**<br>- `VID_V01_mommmmmy.issues` added `+3` clicks and `+3` VCs (`$43.95` spend, `623` impr, `23` clicks = `3.69%` CTR, `24` VCs, `3` ATCs, `3` ICs).<br>- `STATIC_P004_DR25_Coffee_Shop_Antique_Book_Curiosity` added `+1` click (`$13.19` spend, `131` impr, `8` clicks = **`6.11%` CTR**, `7` VCs).<br>- `VID_V10_shopwithzara555_1080p` added `+1` VC (`$2.63` spend, `51` impr, `4` clicks = **`7.84%` CTR**, `4` VCs). |
| **Supplier (`flexfulfills@gmail.com`)** | — | — | — | — | — | `6` unfulfilled orders (`#1001–#1006`) | Checked Zoho Mail Inbox (`support@merrivy.com`) at `8:00 PM CST` (`10:00 AM` China time) — no reply yet. |

---

### 🕘 9:00 PM CST Hourly Snapshot & Hard-Critic Funnel Review (Nov 4, 2026)

| Campaign | Today's Spend | Impr | Outbound Link Clicks (`CTR`) | Avg CPC / CPM | `LPV` / `ViewContent` | `ATC` / `IC` / `Purchases` Today | Hard-Critic Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`P007` Split-Panel Solar Blackout Kit (`$50/d`)** | **`$50.00`** *(+$2.47 vs 8 PM — Full Daily Budget Completed)* | `830` *(+38)* | **`34`** (**`4.10%` Outbound CTR**) | `$1.02` CPC · `$60.24` CPM | **`26` LPV** / **`26` VC** | `1` ATC (Pixel `#2`) · **`1` Purchase (`#1006` `$59.98`)** | **Completed Full `$50.00` Day-1 Budget Profitably (`1.20x` ROAS on `$50.00` spend, `+$9.98` gross above ad spend):**<br>- Finished Day 1 at **`4.10%` Outbound CTR (`34` outbound clicks, `$1.02` CPC, `26` `ViewContent`s, `1` Purchase `#1006` `$59.98`)**.<br>- Top 2 proven winners on Solar: `STATIC_P007_C11_Federal_Grid_Target_Warning` (`$18.59` on active ad set / `$25.65` total today, `15` total clicks, `12` VCs) and `VID_P007_V01_CowboyGadgets_Full_Reveal` (`$7.38` spend, `79` impr, **`6` clicks = `7.59%` CTR**, `5` VCs).<br>- Feature-comparison static `STATIC_P007_DR21_Why_99Pct_Solar_Useless_Indoors` picked up `11` impressions (`$0.42`) in the final stretch before hitting the `$50.00` cap. |
| **`P004` Witching Hour 2027 Planner (`$100/d`)** | **`$91.78`** *(+$5.53 vs 8 PM)* | `1,352` *(+79)* | **`52`** *(+5 clicks)* (**`3.85%` Outbound CTR** 🔥) | **`$1.04` CPC** · `$67.88` CPM | **`40` LPV** *(+3)* / **`47` VC** *(+3)* | **`3` `ATC`** · **`3` `IC` (Checkouts)** | **CTR Climbing (`3.69%` $\rightarrow$ `3.85%`), CPC Dropping (`$1.08` $\rightarrow$ `$1.04`):**<br>- `VID_V01_mommmmmy.issues` added `+5` outbound clicks in the 8–9 PM hour (`$48.40` spend, `680` impr, **`28` clicks = `4.12%` CTR**, `26` VCs, `3` ATCs, `3` ICs).<br>- `STATIC_P004_DR25_Coffee_Shop_Antique_Book_Curiosity` added another `ViewContent` (`$13.97` spend, `146` impr, `8` clicks = **`5.48%` CTR**, `8` VCs = `100%` click-to-VC retention!).<br>- `$8.22` remaining in today's `$100.00` daily budget for the `9:00 PM – Midnight` stretch. |
| **Supplier (`flexfulfills@gmail.com`)** | — | — | — | — | — | `6` unfulfilled orders (`#1001–#1006`) | Checked Zoho Mail Inbox (`support@merrivy.com`) at `9:00 PM CST` (`11:00 AM` China time) — no reply yet. |

---

### 🛑 9:08 PM CST — All Campaigns Paused (`Off`) & Final 2-Day Scoreboard (Nov 3–4, 2026)

- **Screenshot Proof:** `meta_campaigns_paused_proof.png` — All 4 campaigns in `act_9818342388208988` verified `Off` (`PAUSED`) at `9:08 PM CST` so zero additional budget renews at midnight.
- **Final Today (`Nov 4`) Spend:**
  - `P007` Split-Panel Solar Blackout Kit: **`$50.07`** (`830` impr · `34` outbound clicks · `4.10%` CTR · `26` VCs · `1` Purchase `#1006` `$59.98`)
  - `P004` Witching Hour 2027 Planner: **`$93.05`** (`1,365` impr · `52` outbound clicks · `3.85%` CTR · `47` VCs · `3` ATCs · `3` ICs)
  - **Total Today (`Nov 4`) Ad Spend:** **`$143.12`**
- **Final 2-Day Combined Scoreboard (`Nov 3–4`):**
  - **Total Paid Shopify Orders (`#1001–#1006`):** **`6` Orders = `$308.88` Gross Revenue** (`5` Planner orders = `$248.90`; `1` Solar Kit order = `$59.98`)
  - **Total Meta Ad Spend (`P004` + `P007` across Nov 3–4):** `$131.68` (Nov 3 Planner) + `$143.12` (Nov 4 Planner + Solar) = **`$274.80`**
  - **Gross Margin Before COGS:** **`+$34.08`** (roughly break-even / small learning cost after supplier COGS)
- **What Must Happen Before Any Next Ad Dollar Is Spent:**
  1. Receive PayPal invoice & tracking numbers from `flexfulfills@gmail.com` (`Zhang Alan`) for pending Orders `#1001–#1006` (or switch to a responsive backup fulfillment agent if they lag).
  2. Build and visually approve 100% perfected ads **before** launch (Avatar Persona Pages `Olivia Scott` / `Michael L` + 1st-person POV + short `3–7` word hook + urgency + 3 best features / feature comparison built from real Amazon/TikTok reviews + max `3–5` ads per ad set + isolated pixels already connected from Day 1 with zero mid-day edits).



---

### 📅 Day 3 System Evolution & Manage Architecture — November 5, 2026

1. **2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection (Permanent Offer Standard):**
   - Permanently retired the 3-Kit and multi-SKU companion add-on bundles (`BagAddOns: []`) across all products so every storefront runs strictly **1-Kit (`+ $7.99` shipping)** and **2-Kit (`SAVE 15%` + Free Tracked Shipping)** + **`$4.99` Shipping Protection** with zero multi-SKU fulfillment headaches.
2. **Self-Serve `<35%` Air-Shipped Landed Cost Check on HyperSKU & CJ FIRST (`P007` `$33.10` Air-Freight Lesson):**
   - On `P007` (Split-Panel Solar Ceiling Light Kit), the real air-shipped landed quote came back at `$33.10` for 1 Kit (`$64.30` for 2 Kits) due to `~1.45 kg` weight, volumetric dome box dimensions, and dual 18650 lithium battery air-freight surcharges.
   - Going forward, `checker` verifies exact package weight, box dimensions, and battery surcharges on **HyperSKU (`hypersku.com`) and CJ (`cjdropshipping.com`) FIRST** during `Verify` (`#/verify`), automatically failing any item whose air-shipped landed cost exceeds `35%` of retail before asking Amy on WhatsApp.
3. **4-Day Meta Algorithm Priming, End-of-Day 3 Kill Gate & `Cancel & Wipe Product` (`#/manage`):**
   - Cut and wiped `P005` and `P007` via `Cancel & Wipe Product` in `#/manage?tab=grow`.
   - Upgraded all 4 `Manage` sub-tabs:
     - **`Daily Numbers` (`#/manage?tab=overview`):** Day-by-Day Query & Reconciliation Table + Day 1 / Day 2 / Day 3 / Day 4+ baselines.
     - **`Ad Testing` (`#/manage?tab=ads`):** Ranked `Best -> Worst` (`Sale Makers -> High ATC -> Best CTR -> 0-Click Bleeders`).
     - **`Store & CRO` (`#/manage?tab=store`):** Live storefront preview (`base-theme.json` fallback in `templates.ts`) + Day Window Switcher + Storefront Bottleneck Diagnosis + 5 Post-Launch CRO Experiments.
     - **`Scale or Cut` (`#/manage?tab=grow`):** Day 1 & Day 2 prime the algorithm; wait until the **END of Day 3** when Meta's algorithm is learned to execute an instant kill (`Cancel & Wipe Product`), or move into **Day 4+ custom Veo AI video ads & CBO scaling**.
