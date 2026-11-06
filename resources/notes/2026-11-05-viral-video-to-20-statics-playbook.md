# Viral-Video-to-20-Statics Playbook: 10 Problem-Aware + 10 Solution-Aware Ads (`winning-statics` & `sbc-statics-2.0`)

**What we learned:** Winning static ads are never invented from scratch or chosen at random. They are systematically reverse-engineered from **already-winning viral creator videos** and **two-layer competitor research** into a **20-Static Ad Batch (`10 Problem-Aware` + `10 Solution-Aware`)** paired with the **`sbc-statics-2.0` Copy Pack (`Concept Ledger` + `5 Evergreen 250–400w Captions` + `5 Short 4–9w Headlines`)** and generated in **Google Flow (`https://labs.google/fx/tools/flow`)** in the owner's Chrome browser.

---

## 1. Why Statics Are Our Moat Against Lazy Video Rippers

### The Owner & Brother's Core Creative Doctrine (November 5, 2026)

> *"For me my brother says that when we build winning statics, it has to come from winning videos. What does that mean? It means that these winning videos already provide us with how and what we can make these statics, to be right. For example some of these videos will explain and say, 'There's a five-step filtration process that removes glass shards and minerals up to 0.1 micron,' something like that. Those winning videos will give you an idea of how you can build these static images."*
>
> *"The reason why static images are so important is because there's going to be a lot of rippers out there that are going to be downloading videos, just putting videos there and hoping. What we do differently is that we do the same thing as them but what we win on is that we have those static images. We're different because that allows us to win in the video ads department, and those guys are not running static images."*
>
> *"Those static images don't have to be created from scratch. They're inspired by the videos themselves that are already viral and already winning and we should probably do 20 image ads. It will probably be 10 problem-aware ads talking about the water and the need for it right now because of the grid collapse... We're going to go through, listen to the viral videos, understand why they're viral, and then build the static images from those viral videos. Instead of just building random ones, like, 'We should build this one, this one, this type,' we should probably have 10 problem-aware ads and 10 solution-aware ads. Those 10 solution-aware ads are from the competitor research we do, where we understand how our product is way better than theirs. And then the problem-aware ads are making them aware of the problem, making them aware of something that they never even knew existed."*

### Why This Beats Every Video Ripper on Meta
1. **Lazy Video Rippers Only Do Half the Job:** When a product breaks out on TikTok Shop, dozens of lazy dropshippers rip the same 2–3 viral `.mp4` clips, throw them into a Meta campaign with generic copy, and pray. Because they all bid on the exact same video-viewer pocket with identical footage, their CPMs spike and their auctions fatigue within days.
2. **We Run the Top 1–3 Viral Videos PLUS 20 Video-Derived Statics:** We download and run the **top 1–3 highest-converting viral `.mp4` videos** (so we capture the video conversion pocket), **AND** we surround them with **20 structured `4:5` (`1080x1350`) static ads** extracted directly from those viral videos' spoken mechanisms and our competitor teardowns.
3. **Meta Andromeda Rewards Format & Awareness Diversity:** Static image ads reach high-intent scrollers who read feed posts without sound, pre-frame the product's mechanism before the user ever watches our retargeting/CBO video, and unlock cheap impressions that video-only rippers never touch.

---

## 2. Step 1 — Listen to & Deconstruct the Winning Viral Videos (`ffmpeg` Audio Transcript + `3s`/`7s` Frames)

Never brainstorm static ad concepts in a vacuum. Every product that reaches **Step 4 · Creatives (`#/create`)** already has `3–5+` top US viral creator `.mp4` videos downloaded during `Product` / `Verify`.

Before writing a single prompt or headline, `copywriter` and `image-maker` deconstruct the winning viral videos:

1. **Extract Spoken Audio Transcript & On-Screen Text Overlays:**
   - Listen to the full audio track and read every on-screen caption across the top 3–5 viral `.mp4` videos.
   - Extract the **exact spoken mechanism and numbers** the creator uses to explain *why* the product works (e.g., *"There's a 5-step ultra-filtration process that removes glass shards, heavy metals, sediment, and bacteria down to 0.01 microns at the push of a button"*).
2. **Inspect the `3s` Hook Frame & `7s` Mechanism Reveal Frame (`ffmpeg`):**
   - Extract high-resolution still frames at `0.5s`, `3.0s`, `5.0s`, `7.0s`, and `10.0s`:
     ```powershell
     ffmpeg -y -i video_1.mp4 -vf "fps=1/2,scale=1080:-1" frame_%02d.jpg
     ```
   - Identify the exact visual contrast that made the clip go viral (e.g., murky creek water in a jar next to a crystal-clear glass of filtered water; a dark powerless living room illuminated by a split-panel solar ceiling dome; a brass-spiral grimoire opening flat to a 2027 moon-phase spread).
3. **Fill Out the Viral Video Deconstruction Table in `products/P###-slug/creative/COPY-BRIEF.md`:**

| Video ID & Creator | 3-Second Spoken / Visual Hook | Spoken Mechanism & Exact Numbers | Hidden Problem / Threat Revealed | Visual Demo Moment to Turn Into a Static |
| --- | --- | --- | --- | --- |
| `V01` (`@creator1`) | *"If the grid goes down tonight, how long does your family have clean water?"* | `"5-stage 0.01-micron ultrafiltration + carbon block; 1-touch electric pump fills 1L in 60s"` | Municipal water plants lose pressure in blackouts; boil advisories & microplastics/glass shards in tap water | Murky water source -> 1-touch electric stream -> clear drinking glass (`F1` / `F2` / `F3`) |
| `V02` (`@creator2`) | *"Stop sucking muddy water through a plastic straw on your knees..."* | `"4,000L filter lifespan (= 8,000 plastic bottles) + USB-C rechargeable 5-day battery"` | Survival straws force you face-down in dirty water and can't fill pots or family cups | Side-by-side: 1-touch electric pump filling a family pitcher vs. kneeling with a straw (`F4`) |

---

## 3. Step 2 — The 20-Static Ad Formula (`10 Problem-Aware` + `10 Solution-Aware`)

Instead of making random static images (*"let's try one like this, one like that"*), every product's static ad bank is architected as **20 intentional `4:5` (`1080x1350`) ads** split into two 10-ad halves, mapped to the 9 Concept Families in `.claude/skills/winning-statics/SKILL.md` (`F1–F9`) and our 50 reference layouts (`agents/image-generator/references/layouts/static_01.png`–`static_50.png`).

### Part A: Ads `#1–#10` — 10 Problem-Aware / Unaware Ads (*"Making Them Aware of a Problem They Never Even Knew Existed"*)

Cold scrollers on Meta are not waking up searching for our SKU. Ads `#1–#10` stop the scroll by **exposing a hidden problem, threat, or daily drain they didn't even realize existed**, walking them through the **Unaware-Scroller Domino Chain**, and ending with `"What Will You Do?"` (or an emotional self-interrogation question).

| Ad # | Awareness Sub-Angle | What the Static Shows & Says (Derived from Viral Videos) | `winning-statics` Family | Recommended `static_01..50.png` Reference |
| --- | --- | --- | --- | --- |
| **`#01`** | **The Domino-Chain Crisis Hook** | Spells out the exact physical domino chain (*"First the bottled water shelves empty. Next the power cuts out. Then tap pressure drops..."*) ending in `"What will you do?"` with our product as the lifeline. | `F8` Problem-Agitation Context | `static_01.png` / `static_11.png` |
| **`#02`** | **The Hidden Threat They Never Knew Existed** | Exposes the invisible contaminant or hidden daily failure mentioned in the viral video (e.g., microscopic glass shards, rust, minerals, and pipe sediment down to `0.1 micron`). | `F2` Illustrated Mechanism / Exposé | `static_31.png` (Flashlight Exposé) / `static_15.png` |
| **`#03`** | **The 5-Step Mechanism Diagram (From Viral Audio)** | Turns the viral video's spoken explanation (*"5-step filtration process that removes glass shards & minerals down to 0.01 micron"*) into a clean 3-to-5 stage visual cutaway. | `F2` Illustrated Mechanism | `static_42.png` / `static_21.png` |
| **`#04`** | **The Municipal / Grid Vulnerability Warning** | Editorial-style homeowner advisory explaining why aging infrastructure / winter storms / grid load leave households without safe water or power for 72+ hours. | `F7` Editorial / Insider Warning | `static_08.png` / `static_16.png` |
| **`#05`** | **The Store-Shelf Reality Check** | Contrasts a panicked empty supermarket water aisle (or recurring expensive disposable habit) against having a 4,000-liter self-reliant supply on your counter. | `F1` Photographic Before/After | `static_02.png` / `static_18.png` |
| **`#06`** | **The Visceral Before / After Demo Frame** | Recreates the viral video's peak visual proof frame: raw turbid water entering on the left vs. crystal-clear `0.01-micron` drinking water pouring into a glass on the right. | `F1` Photographic Before/After | `static_06.png` / `static_25.png` |
| **`#07`** | **The "Ask Me Anything" Unaware Confession** | Native Instagram AMA question box over a real-life dark/crisis or cozy routine scene (*"Wait—what happens to your tap water when the local substation loses power?"*). | `F8` + `F5` Native Story Hook | `static_14.png` / `static_35.png` |
| **`#08`** | **The Cost of Doing Nothing (Math Shock)** | Shows how fast the old way fails in an emergency (e.g., a family of 4 needs 12 gallons for 3 days = 96 plastic bottles vs. 1 palm-sized electric unit). | `F7` Editorial / Math Breakdown | `static_10.png` / `static_38.png` |
| **`#09`** | **The Specific Avatar Trigger Moment** | Targets Avatar #1's exact trigger moment from 4–5 star reviews (e.g., rural well-water homeowner during a winter freeze, or hurricane-zone parent). | `F8` Buyer Problem Context | `static_05.png` / `static_19.png` |
| **`#10`** | **The Homeowner Refusal Manifesto** | Bold editorial stance (*"Built for Homeowners Who Refuse to Let Their Family Depend on Empty Grocery Shelves"*), pairing emotion with 3 core survival/comfort pillars. | `F7` Editorial Manifesto | `static_27.png` / `static_40.png` |

---

### Part B: Ads `#11–#20` — 10 Solution-Aware / Competitor-Crushing Ads (*"How Our Product Is Way Better Than Theirs"*)

Once a shopper knows the problem—or has already seen cheap survival straws, gravity bags, or generic Amazon alternatives—Ads `#11–#20` use our **Two-Layer Competitor Research** (`Verify` Step 2) and **4–5 Star Amazon Review Mining** to prove why our exact mechanism is in a league of its own.

| Ad # | Solution-Aware Sub-Angle | What the Static Shows & Says (From Competitor Research & Reviews) | `winning-statics` Family | Recommended `static_01..50.png` Reference |
| --- | --- | --- | --- | --- |
| **`#11`** | **Us vs. Category Substitute #1 (The Direct Mechanism Crush)** | Side-by-side table: **Ours** (1-Touch Electric Pump, `0.01μm` 5-stage, fills family pitchers) vs. **Plastic Survival Straws** (sucking on your knees in the mud, `0.2μm`, zero storage). | `F4` Us-vs-Them Comparison | `static_04.png` / `static_17.png` |
| **`#12`** | **Us vs. Category Substitute #2 (Speed & Convenience Crush)** | Contrasts our instant 1-button flow (`1L in 60 seconds`) against slow gravity bags or bulky $350 countertop tanks that fail when you're on the move. | `F4` Us-vs-Them Comparison | `static_09.png` / `static_23.png` |
| **`#13`** | **The 3 Buyer-Praised Features Callout Map** | Studio/in-hand hero of our exact SKU with **3 bold feature callouts** pulled verbatim from 4–5 star Amazon reviews (never 5+ tiny squinting boxes). | `F3` Annotated Product Callouts | `static_12.png` / `static_07.png` |
| **`#14`** | **The Ultra-Close-Up Hardware & Port Inspection** | Macro zoom on the physical build quality that cheap knockoffs lack (e.g., medical-grade `0.01μm` UF membrane window, USB-C sealed port, food-grade silicone tubing). | `F3` Annotated Product Callouts | `static_20.png` / `static_30.png` |
| **`#15`** | **1st-Person Verified Buyer Review Card (Avatar #1)** | Features `Michael L — Verified Buyer ★★★★★` (or `Olivia Scott`) quoting the exact review highlight that overcame skepticism and proved the product works. | `F5` Testimonials / Social Proof | `static_03.png` / `static_22.png` |
| **`#16`** | **Handwritten Post-It / Open-Spread Notes** | 3–4 authentic handwritten-style buyer callouts around the product explaining why they switched from the leading Amazon brand to ours. | `F5` + `F3` Handwritten Notes | `static_41.png` / `static_44.png` |
| **`#17`** | **The Objection-Crusher Checklist ("Why 98% Recommend")** | Directly answers the top 3 objections from 2–4 star competitor reviews (e.g., *"No clogging · No chemical aftertaste · No manual pumping fatigue"*). | `F9` Grid / Checklist | `static_36.png` / `static_48.png` |
| **`#18`** | **The Multi-Use Scenario Grid (Home + Truck + Trail)** | Shows 3 distinct real-world places buyers use the product (Kitchen Blackout Backup · Truck/Bug-Out Bag · Backcountry Camp) so buyers immediately see why they need 2. | `F9` Grid / Checklist | `static_24.png` / `static_33.png` |
| **`#19`** | **The Big-Claim Mechanism Hero** | Clean, high-contrast studio hero led by the single strongest quantified claim from the viral video (`"Filters 4,000 Liters Down to 0.01 Microns — With One Touch"`). | `F6` Product Hero | `static_13.png` / `static_34.png` |
| **`#20`** | **The 2-Kit "1 for Home + 1 for Truck/Family" Offer Hero** | Solution-aware offer static showcasing the **2-Kit Bundle (`★ MOST POPULAR · Save 15% + FREE Tracked Shipping` + `30-Day Guarantee`)** for shoppers ready to buy now. | `F6` Offer-First Pack Shot | `static_29.png` / `static_50.png` |

---

## 4. Step 3 — `sbc-statics-2.0` Copy Pack (`Concept Ledger` + `5 Evergreen Long-Form Captions` + `5 Short Headlines`)

Every 20-static batch saved in `products/P###-slug/creative/NATIVE-AD-KIT.md` MUST include the full **`sbc-statics-2.0` Copy Pack** so the statics and Meta ad copy work as one unified conversion system:

### A. The 4-Column Concept Ledger (`Feature -> Mechanism -> Benefit -> Real-Day Impact`)
Before writing captions or in-image text, translate every spoken video spec and 4–5 star review highlight through this 4-step chain (never stop at a raw spec):

| 1. Feature (Spoken in Viral Video) | 2. What It Actually Does (Mechanism) | 3. Practical Benefit | 4. Why It Matters in Their Day / Crisis |
| --- | --- | --- | --- |
| `5-stage 0.01-micron membrane` | Blocks microscopic glass shards, rust, bacteria, and sediment smaller than a red blood cell | Turns murky tap, rain, or creek water into clean drinking water immediately | When a boil-water advisory or grid failure hits at 10 PM, your kids still drink clean water without boiling a pot |
| `1-touch electric pump (1L/min)` | Draws water through a 5-foot hose into any pitcher or bottle automatically | Zero kneeling in mud, zero manual squeezing, and fills family cookware | Your spouse or aging parents can filter a full pitcher on the kitchen counter with one finger |

### B. 5 Distinct Evergreen Long-Form Primary Text Captions (`250–400 Words` Each)
Write **5 complete, evergreen long-form `Primary Text` (`Body`) captions** (`250–400` words each, zero lazy 1-line blurbs) spoken in 1st-person Avatar Persona POV (`Olivia Scott` or `Michael L`):
1. **Caption 1 — The Unaware Domino-Chain Wake-Up (Pairs with Problem-Aware Ads `#1–#5`):** Opens with the concrete physical domino chain, exposes the hidden problem most families overlook until it's too late, bridges to the viral video's 5-step mechanism, and ends with the 2-Kit Free Shipping CTA.
2. **Caption 2 — The 1st-Person Discovery & "Best-Light Reveal" Story (Pairs with Ads `#6–#10`):** Written like a real buyer telling a friend why they bought it, what happened the first time they tested it, and why they immediately ordered a second one.
3. **Caption 3 — The Competitor Teardown & Mechanism Superiority (Pairs with Solution-Aware Ads `#11–#14`):** Explains why traditional category options (e.g., plastic survival straws, slow gravity bags, or overpriced brand-name units) fail in real life, and walks through our 3 review-praised upgrades.
4. **Caption 4 — The Skeptic's Proof & Objection Crusher (Pairs with Ads `#15–#17`):** Tackles the #1 buyer doubt head-on using verified specs, real test numbers from the viral video, and our 30-day tried-item return promise.
5. **Caption 5 — The 2-Kit Family / Vehicle Readiness Stack (Pairs with Ads `#18–#20`):** Explains why one unit isn't enough when an outage or trip happens (1 for the kitchen emergency drawer + 1 for the truck/go-bag) and highlights the **2-Kit (`Save 15% + FREE Tracked Shipping`)** offer.

### C. 5 Short High-CTR Meta Ad Headlines (`4–9 Words` + Urgent Reveal CTA)
Write **5 punchy Meta Ad `Headline` options** (`4–9` words core hook + `"— Get Yours Now Today!"` where appropriate), strictly obeying the **Website vs. Meta Ad Headline Split**:
- **Headline 1 (Urgent Reveal):** `"You Have to See How Fast This Filters Water — Get Yours Now Today!"`
- **Headline 2 (Problem/Crisis Readiness):** `"Keep Your Family Supplied With Clean Water in Any Outage"`
- **Headline 3 (Mechanism Superiority):** `"5-Stage 0.01-Micron Filtration at the Push of One Button"`
- **Headline 4 (1st-Person Social Proof):** `"Why 98% of Homeowners Are Switching From Plastic Straws"`
- **Headline 5 (2-Kit Offer Hook):** `"Grab the 2-Kit Family Pack Today & Ship Both FREE"`

---

## 5. Step 4 — Execution in Google Flow (`https://labs.google/fx/tools/flow`) in Chrome (Zero Antigravity Credit Drain)

All 20 static ads (`1080x1350` `4:5`) and all store gallery images (`2048x2048` `1:1`) are generated by `image-maker` inside **Google Flow (`https://labs.google/fx/tools/flow`)** in the owner's signed-in Chrome browser:

1. **Open Google Flow in Chrome via `browser-use` (Never Call Antigravity `generate_image`):**
   ```powershell
   python -m scripts.automation.cli status
   python -m scripts.automation.cli open "https://labs.google/fx/tools/flow" --new-tab
   ```
   - **NEVER** call Antigravity's built-in `image-generator` (`generate_image`) / Gemini API tool (which drains Antigravity credits). Google Flow in the owner's Chrome is unlimited.
   - **NEVER** draw flat diagrams, callout boxes, or text overlays with Python PIL / Pillow / HTML Canvas / SVG.
2. **Upload Mandatory Dual Visual Inputs for Every Single Static (`#1–#20`):**
   - **Input A (Real Product Truth Photo):** Extracted viral video frame (`frame_04.jpg`–`frame_06.jpg`) or clean supplier SKU photo (`resources/sourcing/<ID>-supplier.png`) locking 100% physical truth (exact housing, buttons, ports, hose, digital display, colors).
   - **Input B (One `static_01..50.png` Reference Layout):** The specific reference PNG mapped in the 20-Static table above.
3. **Enforce `winning-statics` Generation Protocols (`REALISM`, `STRUCT-ONLY`, `LOC`):**
   - **`REALISM`:** 8K DSLR micro-contrast, natural studio or authentic residential lighting, tactile materials, zero plastic AI sheen.
   - **`STRUCT-ONLY`:** Borrow the visual hierarchy, callout placement, and composition from `static_XX.png` ONLY—strip all reference brand logos, unrelated products, and platform UI chrome.
   - **`LOC`:** US English spelling, USD `$` pricing where applicable, `>= 6%` safe edge margins so nothing clips in `4:5` (`1080x1350`), and `<= 3` concise callouts so Meta scrollers never squint at tiny text boxes (`P007 C02` Dwell-Time Spend Hog lesson).
4. **Full-Size QC & Structured Ad-Set Staging (`#/create` & `#/launch`):**
   - Inspect every downloaded static at full resolution with `read_file`.
   - Save all 20 statics under `products/P###-slug/creative/ads/ad-c01-*.jpg` through `ad-c20-*.jpg`, register them in `os/data/meta-campaigns.json`, and group them into capped ad sets (`3–5` ads per ad set) alongside the **top 1–3 viral `.mp4` videos**.
