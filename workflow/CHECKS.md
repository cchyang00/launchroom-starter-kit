# The method: seven steps from a product to a decision

The one strict procedure for every Merrivy product. Owner, October 1, 2026: make Launchroom "simple but very, very strict: specifically, what things we need to do and research, and how to do that research." Owner, October 2: **yes** to the seven steps in [the Launchroom plan](../resources/research/2026-10-01-native-ads-workflow/LAUNCHROOM-PLAN.md), then, the same day, product first. October 3, the order settled: **the issue list first, then products to match**: "we want a list of deep real issues in life for many different avatars and angle. researching with gemini, and we do cross referencing and then once we got those issues down. it's all about choosing a couple from the list of what we're testing and finding products to match. it should be a very clean process to where we've streamlined the part of finding products because we've already done the hard part."

**The rules of the method:**
1. **No step starts until the step before it passes its gate.** A gate passes only with saved, dated evidence. "Unknown" never passes.
2. **Every step has the same six parts:** what we're after, what agents make, how to research it, where it's saved, one gate, and the owner's decision. If a job doesn't produce the "save", it isn't done.
3. **Agents never pick winners, but a failed check fails the product.** The owner's eye test, "Build this one" and the money decisions are the owner's. When a gate check fails with saved, dated evidence (for example P1 Saturated), the product leaves the line on its own, marked "Failed at <check>" with the reason; nobody has to click. The owner can reopen it with one tap (owner, October 3: "i shouldnt have to manually click through too. if the checks dont pass. you can fail the product"). A check that is only unknown or blocked (a CAPTCHA, a supplier page) never fails a product; it stays pending.
4. **Every number says whose it is.** Most testing numbers are someone's rule of thumb, not Meta's rules and not our results. The starting rules live in one file, [os/data/rules.json](../os/data/rules.json) (`os.mjs rules`), so the owner can change them.
5. **Where older lists disagree** (the 7-check screen, the 5 deep gates, the 23 product checks, the playbook, the old six steps), this page wins. [Where the old checks went](#where-the-old-checks-went) maps every old check onto the new gates.

**Whose number it is.** Each number carries a tag:
- **owner**: the owner's own choice;
- **ours**: our earlier method;
- **A**, **B**, **C**: the research reports in [the native-ads workflow folder](../resources/research/2026-10-01-native-ads-workflow/);
- **Gemini**: the Gemini Deep Research report there;
- or the vendor or agency named in those reports.

A tagged number is a starting rule, never a promise.

## The whole method on one screen

| # | Step | What we're after | Agents make | Gate | Owner decides |
| --- | --- | --- | --- | --- | --- |
| 0 | **The issue list & Keyword Bible** (always growing) | Deep, real life issues + 200-Keyword Q4 Macro-Trend Bible | Issue files + Gemini 3.1 Pro Deep Research Keyword Bible | I1–I7 | Pick verified issues/trends |
| 1 | **Product** (`#/find`) | Brute-force Numbers-First Reverse Engineering on Kalodata US (`>= 5` active US viral videos across `>= 3` US creators, rising 30d GMV) | Product cards with `.mp4` videos, all six checks and statistics | F1–F6 | Nothing here: agents scrape & filter; owner decides on Winners |
| 2 | **Buyers** (`#/verify`) | 4–5 star Amazon reviews FIRST (3 best features), avatars, trigger moments, 15+ quotes, and the angle gap | The buyers file and the card's buyers check | A1–A3 | Feeds Winners card, storefront & DR static ads |
| 3 | **Prove it** (`#/verify` -> `#/winners`) | 0–15 US Meta ads, exact 1-piece SKU on HyperSKU & CJ FIRST (`<35%` air-landed cost), `>= $22–$30` break-even CPA floor on 2-Kit + `$4.99` | The source record and 2-Kit money line | P1–P5 | "Approve & Build Store" or Reject on `#/winners` |
| 4 | **Create** (`#/create` & `#/assets`) | Top 1–3 viral `.mp4` videos + 4–5 `4:5` Unaware-Scroller DR static ads, enforcing the Website vs. Meta Ad Headline Split | 1–3 viral videos + 4–5 DR static ads (truth frames + `static_01..50.png`) | C1–C4 | Approve ad creatives in `#/create` |
| 5 | **Build** (`#/build` & `#/checklist`) | 5-section Grimoire page cloned from `base-theme.json`, 2 Kits Only (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection, `7/7` Checklist | The filled store packet (`localhost:3021`) and `7/7` Launch Checklist | B1–B5 | Preview live store & `7/7` Checklist |
| 6 | **Launch** (`#/launch`) | `$50/day` CBO budget, `$50` first-test loss limit, category-isolated Meta Pixel, and campaign launch | The test sheet and launch record; moves product to `#/manage` | L1–L5 | Approve budget & Launch campaign |
| 7 | **Learn** (`#/manage`) | 4-Day Meta Algorithm Priming, End-of-Day 3 Kill Gate (`Cancel & Wipe`), and Day 4+ Veo AI Video Scale | Live 15-min Meta/Shopify sync, Best->Worst ad rank, Store & CRO | R1–R3 | Scale, run CRO fix, or Cancel & Wipe |

**Numbers-First Reverse Engineering, then Hard Verification, then Winners** (owner, November 5: *"Instead of scrolling through, hoping you find a product that has millions of views organically coming through, we're going to brute force our way to reverse engineer and find the numbers first. Then it comes back with the videos that we see. Then we take a look at the videos and the products, and then we do the eye test... we attack what's profitable first. We attack what's strongest, which is the numbers."*). Steps 1–3 run automatically in `Product` (`#/find`) and `Verify` (`#/verify`) so only fully verified winners reach `#/winners`; Steps 4–6 build and launch one product at a time, and launched products move into the dedicated top-level **`Manage` (`#/manage`)** tab.

## Our strategy, in five lines

- **Numbers-First Reverse Engineering (Never Organic TikTok Scrolling).** We never scroll organic TikTok feeds hoping the algorithm feeds us a viral product. We start with our **200-Keyword Q4 Macro-Trend Bible** ([2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md](../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md)), brute-force query **Kalodata US (`country: "US"`, `pageSize: 100`)** for rising 30d GMV + **Multi-Video US Viral Density (`>= 5` active US videos across `>= 3` US creators)**, pull the winning `.mp4` videos, and run our hard checks before the owner ever does the eye test.
- **Real problems tied to Meta-proven broad categories.** Meta's algorithm already knows how to find buyers in proven problem categories (Emergency Blackout Lighting & Power, Off-Grid Water Filtration, Personal Thermal Heating, Joint/Sciatica Pain Recovery, Home Lockdown Security, Winter Roadside Survival, Holiday Kitchen Prep, and Low-Tox/Sleep Swaps).
- **Multi-Video Viral Proof (`>= 5` Active US Videos), Not Passive Marketplace Commodities.** A product with high TikTok Shop sales but 0–1 viral videos is just an Amazon-style search commodity. We only curate products being driven by **multiple active viral US videos/ads across multiple independent creators**.
- **Self-Serve `<35%` Air-Shipped Landed Cost on HyperSKU & CJ FIRST + 2-Kit Only Offer.** Before asking Amy on WhatsApp, `checker` verifies exact weight, box dimensions, and `<35%` air-shipped landed cost on **HyperSKU (`hypersku.com`) and CJ (`cjdropshipping.com`) first**, priced into **1-Kit (`+ $7.99` shipping)** vs. **2-Kit (`SAVE 15%` + Free Tracked Shipping)** + **`$4.99` Shipping Protection** (`>= $22–$30` break-even CPA floor).
- **Never a cure.** No supplements or anything eaten, no device that claims to treat a condition, and ad copy never says or implies the reader has a condition. Describe concrete physical situations instead. See [Hard limits and Meta policy](#hard-limits-and-meta-policy).

---

## Step 1 · Product: where the sales numbers are hitting

**What we're after:** unique, problem-solving products (`>= $45` ideal retail / `>= $24` floor) discovered by **Numbers-First Reverse Engineering**—where Kalodata US numbers prove rising 30-day sales AND **Multi-Video / Multi-Ad US Viral Density (`>= 5` active US viral videos across `>= 3` distinct US creators)**, backed by downloaded `.mp4` videos.

The owner, November 5: *"My brother mentions that the best way he's able to find products is through algorithm TikTok scrolling, but for me, that's too slow because my algorithm is messed up. I believe in our method more... Instead of scrolling through, hoping you find a product that has millions of views organically coming through, we're going to brute force our way to reverse engineer and find the numbers first. Then it comes back with the videos that we see. Then we take a look at the videos and the products, and then we do the eye test... The products we're looking for are the products that have good numbers and have multiple ads on TikTok that are going viral. That way we know, okay, this product is actually going viral off of videos not just because it's a TikTok Shop product."*

**The rule (owner):** a card without its statistics and downloaded US `.mp4` videos never reaches Winners, and every check carries linked, dated evidence the owner can verify.

**Agents make:** one card per product (`L###.md` plus the Launchroom card in `research/comparison.json`) with all six checks, its statistics, and downloaded `.mp4` creator videos (`research/<round>/videos/`). The scout leads.

**How to research it, in this order (Numbers-First Reverse Engineering):**
1. **Statistics & Multi-Video US Viral Density first (F1).** Never scroll organic TikTok feeds. Brute-force reverse-engineer from the numbers first ([daily arbitrage playbook](../resources/notes/2026-11-03-tiktok-to-meta-arbitrage-and-q4-product-finding.md) & [200-Keyword Q4 Bible](../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md)):
   - **Kalodata US API (`POST /overview/fullText/search` with `headers: {"country": "US", "currency": "USD"}` and `pageSize: 100`):**
     - Query exact 2–4 word hardware keywords from our 8 Meta-proven categories.
     - **HARD RULE — US Storefront & US Creator Filter:** Always pass `country: "US"` and `currency: "USD"` headers (omitting `country: "US"` returns Singapore/Malaysia/Indonesia creators) and filter out non-US `.sg`/`_sg`/`my` handles and non-ASCII titles.
     - **HARD RULE — Multi-Video / Multi-Ad US Viral Density (`>= 5` Active US Viral Videos Across `>= 3` Distinct US Creators):** A candidate MUST have **at least `5+` active revenue-generating US viral videos/ads across `>= 3` distinct US creators** in the last 30 days (`$20,000–$500,000+` 30d US video GMV, active in the last 7–14 days, zero downtrend) and **Creator Concentration `<55%`**. Never curate a product that only sells passively through TikTok Shop search without multiple viral videos.
     - **Download Real US `.mp4` Videos & Extract `3s`/`7s` Truth Frames:** Download the top converting US creator `.mp4` videos via `yt-dlp` and visually inspect the `3s` and `7s` frames to confirm the exact physical mechanism.
   - **Cross-Platform Spillover Convergence:**
     - **Amazon** as a cross-check: verify retail price (`$39–$89+`) and 4–5 star review velocity;
     - **Google Trends** 90-day US Shopping + 12-month curve on the root keyword: must show a rising slope or high evergreen/seasonal baseline.

   Launchroom works out the trend from the saved points: rising when the newest point is 15%+ above the oldest, falling when 15%+ below, else stable (`trendBandPercent` in `os/data/rules.json`).
2. **Dropshippable & Self-Serve `<35%` Air-Landed Cost Viable on HyperSKU & CJ FIRST (F2).** Check **HyperSKU (`hypersku.com`) and CJdropshipping (`cjdropshipping.com`) FIRST** to verify that the exact unbranded 1-piece SKU exists, weighs `<1 kg` (`<600g` ideal), and has a **verified air-shipped landed cost `<35%` of retail** (`<= $15.00` on a `$45` item), yielding a **`>= $22.00–$30.00+` break-even CPA floor** on our **2-Kit (`1-Kit` + `$7.99` shipping vs. `2-Kit` `SAVE 15%` + Free Shipping) + `$4.99` Shipping Protection** offer. Drop it immediately if it hits a [hard limit](#hard-limits-and-meta-policy):
   - earbuds, headphones and Bluetooth audio;
   - complex or app-paired electronics;
   - branded or patented items;
   - fragile items;
   - heavy or bulky items (over about 2 lb / 1 kg or oversized volumetric boxes);
   - high-return sized apparel/shoes;
   - heavy multi-battery sea-freight items where air shipping exceeds `35%` of retail.
3. **A good product with a WOW (F3).** It looks good in its real video truth frames (`3s` and `7s`): it must not look cheap, plastic or toy-like, and it must not be a commodity anyone can buy at Walmart/Target/Home Depot for `$12`. **Score the WOW, 1 point each:** (1) distinct mechanism or silhouette not sitting on a big-box shelf; (2) shows what it does in 3 seconds of video; (3) looks premium (`$45–$85+` perceived value) in real photos; (4) an emotional/crisis/relief payoff, not just commodity utility; (5) 3+ reasons to buy, each compared with an alternative. **Under 3 of 5 fails F3**, and the card never reaches Winners.
4. **Avatars and angles (F4).** At least 3 to target: the main audience plus 2+ other avatars or angles, each with their trigger problem and why they're underserved.
5. **Tie it to our issues (F5): the benefit ladder.** Climb the ladder from what the product does to why it matters (`functional -> emotional -> life`), and name the issue files it touches (`resources/issues/<slug>/ISSUE.md`).
6. **The angle gap (F6), last.** Check what competitors already say on TikTok, Amazon, and store pages, and write the angles and avatars nobody is speaking to.

**The six checks.** Only an all-pass product goes on to the hard test:

| # | Check | Pass when | Stop when | Save |
|---|---|---|---|---|
| F1 | **Statistics: rising or stable demand** | Real Kalodata US numbers (`country: "US"`, `>= 5` active US viral videos across `>= 3` US creators, rising 30d GMV) + downloaded `.mp4` videos, with Amazon/Google Trends cross-checks | No numbers, `<5` viral videos, falling trend, or passive marketplace-only sales | Each number with its link and date, US viral video count, creator count, and trend points |
| F2 | **Dropshippable** | The exact unbranded item is verified on CJdropshipping (or HyperSKU) with US tracked air shipping `<35%` of retail (`<1 kg`) | It hits a hard limit, or air-shipped landed cost exceeds `35%` of retail | The supplier listing link, US shipping yes or no, landed cost, and hard limits checked |
| F3 | **A good product with a WOW** | It looks premium in its real `3s`/`7s` video frames (`>= $45` ideal / `>= $24` floor, not a big-box commodity) and scores 3+ of 5 on the WOW score | Cheap-looking, a commodity, or a WOW score under 3 | The exact listing link whose frames were judged, the WOW score and one line why |
| F4 | **Several angles and avatars** | 3+ to target: the main audience plus 2+ other avatars or angles, each with their problem and why they're underserved | Only the audience already being sold to | Main audience and each avatar or angle |
| F5 | **Ties to our issues** | A benefit ladder (functional, emotional, life) to one or more of our issue files; related, not necessarily exact | No rung reaches a real problem we know | The ladder's three rungs and the issue files |
| F6 | **An angle gap** | Competitors checked on any channel, with a link, and the angles or avatars they don't speak to written down | They already speak to every angle we'd use | The link, what they say, the gap |

**The statistics shape** (for the card's statistics panel, a later job): Launchroom reads one block per card (`cardStats` in `os/src/researchView.mjs`): `demand[]` (each `{metric, value, url, observedAt}`; metrics `amazon-bought`, `amazon-reviews`, `google-trends`, `kalodata-units`, `tiktok-shop-units`, `other`), `trend[]` (the curve's `{date, value}` points, with `trendUrl`), the trend worked out from them, `competition{}` (link, `gap`, and any ad counts), `ladder{functional, emotional, life}`, `avatars[]` and `issues[]`. They are saved inside the checks (`PATCH /api/research`): F1's `demand`, `trend` and `trendUrl`; F2's supplier link and `usShipping`; F4's audiences; F5's `issues` and `ladder`; F6's link and `gap`. Optional, for the owner's Statistics panel: a `price` on a demand point, F1's `trendShot` (the saved Google Trends screenshot's workspace path), and F2's `suppliers` (more supplier links), `landedCost`, `sellPrice` and `flags` (such as "CJ verification pending", "MOQ 20"). The owner's Save stays closed until F1 passes.

**Saved in:** `research/<date>-<round>/BATCH.md` (searches, products looked at, drops by reason) plus one `L###.md` per card, registered in Launchroom with all six checks.

**Gate:** a card stays in the catalog (`#/find`) until its hard test starts, then runs the checks on Verify (`#/verify`). A failed check takes it off the line by itself; passing them all lands it on Winners.

**Owner decides:** nothing at this step (owner, November 5: "the product and the verify are more for the agents. The winners are more for me"). The owner approves or rejects a product on Winners. A reason that teaches us something goes into the hard limits or the searches the same day.

## Step 2 · Buyers: who buys this product, in their own words

**What we're after:** for a product the owner saved, the real people who buy it, the moment that sends them shopping and their exact words. The owner, October 2: "we should do product research first, then do issues research." So this research is about **this product's buyers**, not a topic in general.

**Agents make:** `research/<round>/buyers/L###.md`, using the sections of [templates/ISSUE.md](../templates/ISSUE.md), and one `buyers` check on the card (`PATCH /api/research`: `quotes`, `avatars[{who, trigger}]`, `angleGap`, with the file as its source). The write-up holds:
- 3+ avatars, each with its trigger moment;
- their exact words in the four buckets;
- objections;
- the benefit ladder (F5, sharpened);
- the angle nobody uses;
- the reasons a considered buyer compares.

The buyer researcher leads. New quotes that fit an issue file also go into it.

**How to research it** (method and sources: [the issue research method](../resources/research/2026-10-02-issue-method/REPORT.md); mostly practitioner opinion, so record what worked):
1. **Start from what we know.** Search the Library and the [issue library](#the-issue-list-the-hard-part-done-first) for leads. A quote there counts only if it is tied to this product or its category.
2. **Mine the best reviews first** (owner, October 3: "take all the reviews from amazon. get the best ones. really read the messaging and what it helps there. that's how we build our avatars, and our copywriting. because those are real validated emotions and real help that this product helped in"). On the top 3–5 Amazon listings of this product, read in the owner's Chrome (signed in, so every review page opens; strictly read-only), read the **4–5 star reviews**, the "most helpful" sort first, then the newest. Pull out, word for word:
   - **who** wrote it (their situation: a gift for a wife, a long-shift worker, a renter with a small tub…);
   - **the moment it helped** and **what changed** (before → after);
   - **the feeling** they name (relief, finally, treat, "I look forward to…");
   - **who they bought it for**, and what they compared it with.

   Group them into avatars by situation and count each group: those counts and words become the avatars, the hooks and the page copy, because they are validated emotions from people the product actually helped. Then the rest:
3. **Read this product's buyers, one source type at a time, about 20 minutes each:**
   - TikTok comments on its videos and its TikTok Shop listing;
   - 2–4 star reviews of the top 3 listings (TikTok Shop first, Amazon as a cross-check; Q&A too; Copyhackers: "where the reality lives");
   - forums and Reddit;
   - YouTube review comments.

   Phrase searches help: `site:reddit.com "<product type>" "wish there was"`, `"<job or hobby>" "<problem>" "any suggestions"`, "tried everything", "what finally helped". Use Reddit through old.reddit.com, signed out. Read only: never log in, post or vote. Gemini Deep Research (3.8 Flash, [templates/GEMINI-ISSUE-PROMPTS.md](../templates/GEMINI-ISSUE-PROMPTS.md)) is an optional lead generator; open and verify every quote it gives.
4. **Record exactly.** Word for word, with the link and the date (within 24 months), and no usernames. Tag each quote by intent: need, fit, price, compare, request, proof or where.
5. **Sort the quotes into the four buckets:**
   - **trigger moment:** when it hits;
   - **what they want:** the better day they describe;
   - **what failed them:** what they tried, and what makes them hesitate or stay put;
   - **their words:** phrases to echo in copy, never to fake as a review.
6. **Profile 3+ avatars.** For each: the trigger moment, their words, what they tried, what failed, where they gather and what current ads miss. Narrow the situation until the usual alternative visibly fails that group.
   - **Common and growing:** the same defect across listings, DIY workarounds, the same question asked again over months.
   - **Saturated:** every listing makes the same claim in the same words.
7. **Write the objections, the ladder and the gap.** The objections come from the hesitations and habits; they become objection and guarantee copy. Then sharpen the benefit ladder. The angle gap is what competitors on any channel never say to these avatars.
8. **Considered purchase or impulse?** Comparisons, fit questions and "I researched" mean considered: list 3+ reasons to buy and the alternative each is compared with. Each can be its own concept at Step 4. Pick the **awareness level** the first ads aim at (Schwartz, via Succession in A); start problem aware unless the evidence says otherwise.

**Saved in:** the buyers file, the card's buyers check and a Library entry; new quotes also go into a matching issue file.

**Gate (all true):**
- **A1 · About 15 verified quotes.** 15+ verbatim quotes with links and dates, tied to this product or its category, from 2+ source types (A: "15+ is plenty to start").
- **A2 · Two or more avatars.** Each with its trigger moment and its own words; 3+ is the aim.
- **A3 · An angle nobody uses.** What competitors say, with a link, and the angle and avatar they don't speak to.

**Owner decides:** reads the avatars and adds their own experience; nothing to approve here.

## Step 3 · Prove it: room on Meta, the item and the money

**What we're after:** for a product whose buyers we know, room on Meta for its strongest avatar (the ad auction for that avatar and angle isn't saturated), the exact item we can source and deliver honestly, the money line that says what a sale may cost, and a sample in hand. (This step merges the old Validate and Source; the avatar and fit work moved to Step 2 · Buyers on October 2.)

**Agents make:** the Meta competition note on the card, the source record in `products/P###-*/`, and the money line. The checker leads.

**How to research it:**
1. **Check the competition where we'll bid: Meta** (owner, October 3: "we're bidding essentially. if we're selling into a saturated market for that issue and avatar. we just won't be able to win"). This runs only after Steps 1–2 showed the product and the issue are real. In [Meta Ad Library](https://www.facebook.com/ads/library/) (United States + tier-1 markets CA/GB/AU/NZ, all ads, active; read-only, never sign in or touch an account), run the **3-Layer Meta Ad Library Search Syntax** across 4–6 searches:
   - **Layer A (Product, Issue & Avatar Keywords):** the product's common names, functional problem terms, and the issue/avatar words from Buyers' quotes;
   - **Layer B (Spoken-Audio Transcript Offer Strings):** query `"50% Off"`, `"60% Off"`, `"Free Shipping Today"`, `"Get Yours Now"`, `"Buy Now"` alongside the category term (Meta Ad Library automatically transcribes spoken video audio, catching UGC video ads even when the written primary text omits product keywords);
   - **Layer C (Competitor Page Transparency Drill-Down):** open discovered Shopify stores' linked Facebook Pages (`About -> Page Transparency -> Go to Ad Library`) to inspect their total active ad count and launch dates.

    Write down:
   - **Layer 1 — Direct Exact-SKU Competitors (`competitors[]`):** count unique independent stores selling our exact product separately from copies of the same ad. **0–15 active advertisers** (with 5–15 as the validated arbitrage sweet spot, or $<5$ when Stages 1–2 already proved TikTok/Shopify velocity) is healthy; **20+ identical advertisers** ripping the same creative indicates severe auction saturation. Record each competitor's store URL, Meta Ad Library URL, and retail price — and **flag Scam / Bait Stores** pricing near or below factory + air-shipping landed cost (`<= $39.99` on a `$22+` landed item) so we never anchor our retail price to a bait site;
   - **Layer 2 — Same-Category Alternative Mechanisms (`categoryCompetitors[]`, `>= 2` Required — Owner & Brother Hard Rule, November 5):** search the broader category keywords on Meta Ad Library (e.g., `"emergency water filter"`, `"survival water purifier"`) and record at least **2 same-category competitors selling older/different mechanisms** (e.g., Suction Straws like LifeStraw/PureFlow, Hunting Gravity Carry Bags like Sawyer, Manual Hand Pumps like Katadyn/Purewell), their price, their mechanism, and **why our mechanism wins** (e.g., 1-touch electric pump straight into a cup with zero sucking, zero tree-hanging, and zero hand-pumping fatigue);
   - **advertisers speaking to our avatar or our angle:** a count, with links to their strongest ads;
   - **ad age, variation scaling & collapse flags** of the strongest ones: 30–45 days likely profitable, 60+ a winner, 90+ a durable control; 8–12 active variations of the same core hook signals active budget scaling; **Competitor Ad Collapse** (e.g., a store dropping from 30 active ads down to 3) signals dying conversion or supply-chain failure;
   - **what they lead with:** their angles, offers and prices, plus which **Stage 3/4 Market Sophistication Pivot** we will use (*Beneficiary Pivot*, *Sub-Demographic / Anti-Category Positioning*, or *Seasonal Lifecycle Pivot*) so our concepts look and sound unmistakably different.

   Then give one verdict: **Open** (0–2 advertisers aim at our avatar and angle), **Crowded product, open lane** (many sell the product but none to our avatar or angle: name exactly how our ads will differ) or **Saturated** (3 or more advertisers already run ads 30+ days old to our avatar with our angle). Saturated fails P1: try the next avatar or angle from Buyers, or park the product. The 3-advertiser line is a starting rule the owner can change. Recheck F1 too: demand still stable or rising.
2. **Self-Serve Multi-Country Sourcing, CJDropshipping + Saved Image for Amy, & 4-Way Market Pricing Cross-Check (P2–P4 — Owner Hard Rule, November 5):**
   - **Why this is mandatory (The `$33.10` `P007` Solar Kit Lesson):** Never guess landed cost from a raw 1688 factory unit price (`~$8`) + a generic `$5` shipping assumption! On `P007` (2-Pack Split-Panel Solar Ceiling Light Kit), we assumed `$13.34` landed cost, when the real FlexFulfills quote was **`$33.10` for 1 Kit and `$64.30` for 2 Kits** because of `~1.45 kg` weight, volumetric box dimensions (`2× 180mm` domes), and dual 18650 lithium-ion battery air-freight surcharges (`~$21+/kit` air shipping, whereas TikTok Shop sellers import by ocean container).
   - **Stage 1 — Self-Serve Check + Saved Supplier Image During `Verify` (Do NOT message Amy for every candidate product!):**
     - Not every researched product is a winner, so we **never** spam Amy (`Cha Sourcing & Fulfillment(Amy)`) during early screening.
     - Instead, during `Verify` (`P2–P4`), the agent MUST:
       1. Find the **exact product listing URL** on **CJdropshipping (`cjdropshipping.com`) or HyperSKU** (never a `/search` or `SearchText=` URL) AND **save a clean white-background supplier product photo to `resources/sourcing/<ID>-supplier.png`** (`references` on the card).
       2. Record the **exact package weight (`grams`)**, **packed box dimensions (`L × W × H cm` for volumetric weight)**, and **cargo classification (`Ordinary Goods` vs. `Built-In / Pure Lithium Battery / Liquid / Sensitive`)**.
       3. Run the **4-Way Unbiased Market Pricing Cross-Check** across (a) **CJdropshipping** landed cost (`<35%` of retail), (b) **Amazon US** (`>= 2` exact `/dp/B0...` listings with price & monthly unit volume), (c) **Legitimate Shopify Competitors**, and (d) **Scam/Bait Store Detection** (`<= $39.99` bait stores flagged).
       4. **Automatic Fail Gate:** If the verified **1-unit air-shipped landed cost (`Item + 6–12d Tracked Air Shipping`) exceeds `35%` of the familiar Kalodata retail price** (e.g., `> $15.00` total landed on a `$35–$40` product, or any bulky `> 600g` / volumetric / multi-battery kit where TikTok Shop sellers rely on sea freight), **FAIL `P2/P4` immediately and drop the product out of the pipeline**!
   - **Stage 2 — Send Saved Supplier Image (`resources/sourcing/<ID>-supplier.png`) to Amy on WhatsApp (`Cha Sourcing & Fulfillment(Amy)`) Once Approved on `Winners`:**
     - Once a product passes **all** checks (`F1–F6`, `A1–A3`, `P1–P4`) and the owner approves it on `Winners` (`#/winners`) to build the store (`#/build`), we send the saved **`resources/sourcing/<ID>-supplier.png` image and exact CJ link to Amy on WhatsApp (`Cha Sourcing & Fulfillment(Amy)`)** to lock in her exact 1-pack & 2-pack landed quote (`USA + AU/UK/CA`) during the `Store` / `Checklist` phase.
3. **Work out the money line (2-Option Direct Response Pricing — No 3-Pack),** one currency, every cost written:
   - **Landed cost (`US` + `AU/UK/CA`)** = verified factory item + tracked air shipping + duties/tariffs (verified via CJ / HyperSKU in `Verify`, then confirmed with Amy once chosen as a winner).
   - **2-Option Pricing (`1-Pack` + `$7.99` Shipping vs. `2-Pack Bundle` + `FREE Tracked Shipping`, plus `$4.99` Digital Shipping Protection — NO 3-Pack, Owner Rule Nov 4):**
     - Customer's `$7.99` shipping fee on the `1-Pack` covers the actual shipping cost (e.g., on `P004` Witching Hour Planner, Amy's quote is `$7` item + `$7` shipping = `$14.00` total landed, so the customer's `$7.99` shipping fee pays 100% of our `$7.00` shipping!).
     - No separate physical companion add-ons in the cart drawer (100% single-SKU scaling: `1-Pack` vs `2-Pack` + `$4.99` digital shipping protection).
   - **Contribution per order** = total collected at checkout (including shipping & `$4.99` protection) − verified landed cost − card fee (about 3.2% on Shopify).
   - **Break-even cost per sale** = contribution per order: what one sale may cost in ads before we lose money. **Hard minimum:** Break-even CPA must be **`>= $22.00`** (and landed cost `<= $15.00` on a `$35–$40` item) or the product fails `P4`.
   - **Target cost per sale** = the lower of about **55% of the bundle order value** and break-even (`targetCpaPercent` in `os/data/rules.json`).
   - **Break-even ROAS** = order value ÷ contribution.
4. **List the claims we can back** (P5): each page and ad claim with its source, a supplier spec or a pattern in buyers' reviews of the same item type. No sample is bought.

**Saved in:** the card's source and profit checks, then `products/P###-*/` (SOURCE.md and the product record) once its record starts (`os.mjs product start L###`).

**Gate (all true):**
- **P1 · Room on Meta.** Demand is still stable or rising, and the Meta Ad Library check above is written down with its counts, links, ad ages and verdict. The verdict is Open or Crowded product, open lane; Saturated fails. Judge it at the avatar and angle level: category competition is fine, a crowded lane for our avatar is not.
- **P2 · Same item, safe to sell.** The exact unbranded 1-piece item is verified on CJdropshipping (or HyperSKU) with `<35%` air-shipped landed cost; variant, materials, what's in the box and photos match the card; nothing in Hard limits applies, and the recall and safety check is written down.
- **P3 · Delivery promise.** Processing plus shipping to the US is written from the supplier's route, with a ship-by date and who sends a delay notice. The FTC holds us, not the supplier, to the promise (C).
- **P4 · The money line.** Landed cost with duties (`<35%` of retail verified on HyperSKU/CJ first), prices for **1-Kit (`+ $7.99` shipping) and 2-Kit (`SAVE 15%` + Free Tracked Shipping) plus `$4.99` Shipping Protection (no 3-Kit, no companion add-ons)**, contribution per order, **break-even cost per sale (`>= $22–$30`)**, **target cost per sale** and **break-even ROAS**, all written down.
- **P5 · Claims we can back, with no sample.** We don't buy samples before a test (owner, October 3: "im not gonna buy a fkn sample, just to run ads for it and lose more money… this is dropshipping??"). Every product claim on the page and in the ads is backed by the supplier's listed specs (size, weight, materials, cup count, what's in the box) or by what many buyers of the same item type say in reviews ("the suction holds", "dries fast"); anything neither shows stays off the page. Customer orders become the real check: the first returns and support questions are read in Learn.

**Owner decides:** "Build this one" on Winners (`#/winners`); approves any supplier message before it is sent.

## Step 4 · Create: concepts, not tweaks (`#/create` & `#/assets`)

**What we're after:** top 1–3 viral creator `.mp4` video ads + 4–5 Direct-Response `4:5` static ads and page copy that harvest the top viral creators' exact "best-light reveal" language and 4–5 star Amazon review highlights—enforcing our **Website vs. Meta Ad Headline Split** and **Unaware-Scroller DR Static Ad Psychology**.

**Agents make:** the **Viral Video Hook & Caption Harvest Table**, **1–3 top viral `.mp4` video ads** + **4–5 Direct-Response `4:5` static ads** (each combining real product truth frames with one `static_01..50.png` reference layout; custom **Veo AI video ads** reserved for Day 4+ once a product proves traction), plus the 5-section Grimoire storefront copy. The copywriter and the image maker lead. Follow [the native ad kit](../templates/NATIVE-AD-KIT.md) and [the page copy formula](../templates/PRODUCT-PAGE-COPY.md).

**How to research it:**
0. **Harvest the top viral videos' hooks & 4–5 star Amazon reviews first (Owner Hard Rule, November 3–5):**
   - Extract the top viral videos' spoken 3-second opening hooks, on-screen captions, and descriptions (`kalodata_top20_manifest.json` / TikTok saves) plus the **3 best features praised in 4–5 star Amazon reviews** before writing any ad or storefront copy.
   - **Website vs. Meta Ad Headline Split:**
     - **In Meta Ads (`#/create`):** Use urgent, eye-catching reveal hooks (`"You Have to Get This 2027 Journal — Get Yours Now Today! 🌙"`) and concrete pain hooks.
     - **On the Website (`merrivy.com`):** **Never** repeat *"You have to get this..."* in `hero.headline` or `purchase.heading` (the ads already did that job). Use elevated, prestigious boutique/hardware titles on the site while weaving viral creator reveal phrasing into `purchase.hook` and the 3 creator demo video titles.
1. **Unaware-Scroller DR Static Ads (`4:5`):** Each static ad walks a cold scroller through the **concrete physical domino chain** and ends with a **self-interrogation question** (*"What will you do?"*), paired with a **3–7 word hook headline** (`<0.8s` scan), the **3 best buyer-praised features strip**, and a **1st-person Avatar Persona POV** (`Olivia Scott — Verified Buyer`).
2. **Concepts, not tweaks.** Each concept is a different situation, angle and picture combining real product truth photos with one `static_01..50.png` layout reference (zero Python PIL/Canvas cartoons).
3. **Run the compliance scan** on every line of copy and every word drawn on the image (below, and [Hard limits](#hard-limits-and-meta-policy)).

**Saved in:** the product's creative folder (`products/P###-*/creative/ads/`), synced to `os/data/meta-campaigns.json`.

**Gate (all true):**
- **C1 · Viral reveal hooks harvested & concepts built.** Top 1–3 viral videos + 4–5 DR static ads built; Meta Ads use urgent reveal/pain hooks while `hero.headline` / `purchase.heading` use elevated boutique/hardware titles (`purchase.hook` & video cards carry the viral reveal phrasing).
- **C2 · Compliance scan clean.** On the copy and on the image: no "you/your" next to a condition, body part or age, and no second-person symptom questions; no cure, treat, prevent, "clinically proven" or timed results; no before/after; no fake reviews, doctors, press logos or invented numbers.
- **C3 · Claims match the exact item.** Every claim names its source (listing line, photo, or 4–5 star review pattern), and says what the item physically does.
- **C4 · Phone first.** Videos in `9:16` and static ads in `4:5` (`1080x1350`), with 8K DSLR contrast and text readable on a phone.

**Owner decides:** approves the ad creatives on `#/create` and the store copy on `#/build`.

## Step 5 · Build: a phone-first page that sells (`#/build` & `#/checklist`)

**What we're after:** the product page in the Merrivy store (`http://localhost:3021`), cloned from `base-theme.json` + one of 52 palettes, with elevated boutique/hardware titles, 2-Kit pricing (`1-Kit` + `2-Kit`) + `$4.99` Shipping Protection, category-isolated Meta Pixel, and `7/7` Launch Checklist readiness.

**Agents make:** the filled store packet (`hydrogen-storefront/app/content/<handle>.json`) and verify all 7 items on `workflow/LAUNCH-CHECKLIST.md` (`#/checklist`). The store builder leads. Follow [the population guide](../store/HYDROGEN-POPULATION.md) and [the blueprint](../store/PAGE-BLUEPRINT.md).

**How to research it:** clone `base-theme.json` (`node scripts/packet-tools.mjs new <slug> --palette <palette-id> --live`), populate the 5 fixed sections + 3 vertical creator demo videos (`"sections": ["features", "comparison", "quotes", "guarantee", "faq"]`) with `.is-wftn-reviews` customer testimonials, and check the page at `375px` mobile width first.

**Saved in:** the store packet (`hydrogen-storefront/app/content/<packet>.json`) and `os/data/launch-checklists.json` (`7/7`).

**Gate (all true):**
- **B1 · The first phone screen holds it all.**
  - cloned from `base-theme.json` with 5 fixed sections (`features`, `comparison`, `quotes`, `guarantee`, `faq`) plus 3 creator demo videos;
  - an elevated boutique/hardware title (`hero.headline` and `purchase.heading` never repeat `"You have to get this..."`) and a viral-creator-inspired `purchase.hook`;
  - `6–7` 8K DSLR gallery images;
  - 2 Kits Only (`1-Kit` + `$7.99` shipping vs. `2-Kit` `SAVE 15%` + Free Tracked Shipping) + `$4.99` Shipping Protection in the Cart Drawer (no 3-Kit, no companion add-on bundles);
  - 4 benefit chips, Add to Bag button, and trust line.
- **B2 · No fake proof on the real store.**
- **B3 · Honest promises.** Delivery times and policies match P3's route.
- **B4 · Total cost and returns before checkout.** Shipping cost (`$7.99` on 1-Kit, Free on 2-Kit), `$4.99` Shipping Protection toggle, and 30-day guarantee shown clearly before checkout.
- **B5 · Checked on a phone (`7/7` Checklist passed).** No sideways scrolling at `375px`, Shopify Admin variants & descriptions synced, category-isolated Meta Pixel verified, and HyperSKU/CJ/Amy supplier fulfillment confirmed.

**Owner decides:** reviews the `7/7` Checklist (`#/checklist`) and live `375px` mobile preview.

## Step 6 · Launch: set budget, guardrails & launch (`#/launch` -> jumps to `#/manage`)

**What we're after:** setting the Daily CBO Budget (`$50/day`), Target Countries (`US / CA / UK / AU`), Break-Even / Target CPA guardrails, and First-Test Loss Limit (`$50`), and launching the campaign. Once launched, the product exits the Build & Launch queue and moves immediately into **`Manage` (`#/manage`)**.

**Agents make:** the **test sheet** and launch record, and verify one clean `Purchase` event on the product's dedicated category-isolated Meta Pixel.

**Gate (all true):**
- **L1 · Test sheet saved before any spend.** `$50/day` CBO budget, `$50` first-test loss limit, Break-Even & Target CPA guardrails, and 4-Day Priming / End-of-Day 3 Kill rules recorded.
- **L2 · Test order & checkout verified.**
- **L3 · One clean Purchase event on a category-isolated Meta Pixel.** Verified in Shopify Customer Events & Meta Events Manager with zero cross-niche pixel contamination and zero duplicates.
- **L4 · Taxes & Markets.** Active across `US / CA / UK / AU`.
- **L5 · Owner approved & launched.** Once launched, `experiment-plan` and `authorized-test` are verified and the product moves to `#/manage`.

**Owner decides:** approves the budget and launches the campaign on `#/launch`.

## Step 7 · Learn: Manage (`#/manage`), 4-Day Meta Algorithm Priming, End-of-Day 3 Kill Gate & Day 4+ Veo Scale

**What we're after:** managing every launched product in its dedicated top-level **`Manage` (`#/manage`)** workspace across 4 sub-tabs (**`Daily Numbers`**, **`Ad Testing`**, **`Store & CRO`**, **`Scale or Cut`**) against our Day 1–4 baselines so we prime the algorithm properly, cut losers cleanly at the end of Day 3, and scale winners on Day 4+.

**Agents make:** live 15-minute reconciled Meta & Shopify syncs (`scripts/sync_meta_campaigns.py`), `Best -> Worst` ad rankings, Store & CRO bottleneck diagnostics, and Day 1–4 Scale or Cut recommendations.

**How we manage every launched product (Owner Rules, November 5):**
1. **Daily Numbers (`#/manage?tab=overview`):**
   - Query and reconcile both **Lifetime (`date_preset=maximum`)** and **Day-by-Day (`time_increment=1`)** Meta & Shopify numbers (`Spend`, `Shown`, `Clicks`, `CTR`, `CPC`, `ATC`, `Checkout`, `Orders`, `Revenue`, `CPA`, `ROAS`, `Day Status`).
   - Compare against our baselines: **CTR `>= 2.0%`**, **CPC `<= $1.20`**, **ATC Rate `>= 6–8%`**, **Target CPA `<= $23.50`**, **Break-Even CPA `<= $30.69`**, **Target ROAS `>= 2.20x`**.
2. **Ad Testing (`#/manage?tab=ads`):**
   - Sort all ads **`Best Rank (Best -> Worst)`** (`Sale Makers -> High ATC -> Best CTR -> 0-Click Bleeders`) to see which creatives make sales vs. which bleed spend.
3. **Store & CRO (`#/manage?tab=store`):**
   - Inspect the live storefront alongside the **Storefront Bottleneck Diagnosis** (`Click -> ATC %`, `ATC -> Checkout %`, `Checkout -> Order %`). When clicks arrive with `0` ATC or `0` Orders, run targeted post-launch CRO experiments on the hero hook, 1-Kit/2-Kit + `$4.99` framing, first gallery slide, or trust/delivery block.
4. **Scale or Cut — The 4-Day Meta Algorithm Priming & End-of-Day 3 Kill Rule (`#/manage?tab=grow`):**
   - **Day 1 (Prime the Algorithm + Expect Day 1 Sales):** Let the `$50/day` CBO run the full day without touching ads intraday. With our hard verification, a workable product should generate initial sales (or strong `ATC >= 6%` + `CTR >= 2.0%`) on Day 1.
   - **Day 2 (Algorithm Priming + Consistency Check):** We should get sales just like Day 1. If sales drop or metrics look abnormal on Day 2, get stricter and deploy a Store & CRO tweak before Day 3.
   - **End of Day 3 (The Learned-Algorithm Kill Gate):** By Day 3 Meta's algorithm has learned who to push to and when buyers purchase. **Never kill at the start of Day 3—wait until the END of Day 3** (since buyers purchase at different times of day). If metrics at the end of Day 3 are still bad or regressing with no sales, **instant kill**: click **`Cancel & Wipe Product`** to archive/delete all product assets and start with a clean slate.
   - **Day 4+ (Improve Every Single Day — Custom Veo AI Video Ads or CBO Scale):** If profitable through Day 3, build **custom Veo AI video ads** (via `image-maker`) to beat the control creatives and scale winning CBO budgets `+20–30%`.

**Saved in:** the result card and decision log in the product's folder; what we learned to the Library and a proposed lesson; the cycle review in Launchroom (Learning), which frees the build slot.

**Gate (all true):**
- **R1 · Result card filled.** Every ad's numbers from Meta and Shopify, kept apart, with the date range.
- **R2 · A decision logged.** Kill, fix (which part, in the fix order) or scale, each with the number behind it.
- **R3 · Lessons saved.** What we learned is in the Library and proposed as a lesson; the cycle review is saved.

**Owner decides:** kill, fix or spend more; any refund or delay notice to a customer.

## The issue list: the hard part, done first

**What we're after:** a long, always-growing list of **deep, real issues in life** plus our **200-Keyword Q4 Macro-Trend Bible**, each for a specific avatar in a specific moment, across many different groups (workers, hobbies, life stages, crisis/seasonal preparedness), so finding products becomes quick: pick an issue or macro-trend pillar and run our Numbers-First Reverse Engineering sweep.

**Agents make:** one issue file per issue, `resources/issues/<issue>/ISSUE.md` from [templates/ISSUE.md](../templates/ISSUE.md), a row in [TOPICS.md](../resources/issues/TOPICS.md), and macro-trend Keyword Bibles in `resources/notes/`.

**How to research it:**
1. **Gemini Deep Research (`Gemini 3.1 Pro` + `Deep Research`) finds the candidates & macro-trend keywords** (one run at a time in the owner's signed-in session; see [prompts](../templates/GEMINI-ISSUE-PROMPTS.md)). Save every report in `resources/research/` or `resources/notes/` and register it in the Library (`os.mjs library add --kind research`).
2. **Cross-reference every claim** against real posts: open forums with their own community, product reviews (4–5 stars for praised features, 2–4 stars for friction), TikTok and YouTube comments. Each quote is copied verbatim from the saved page, with its link and date.
3. **Fill the issue file:** the avatars and their trigger moments (before → trigger → struggle), what it costs them, their words in four buckets, what they've tried and why it fails, and 3+ physical product types to search (never-sell list checked).

**Gate (I1–I7, all true, before the owner can pick it):**
- **I1 · Real:** 15+ verbatim quotes from 3+ sites, dated within the last 24 months, each with its link.
- **I2 · Deep:** a moment that keeps coming back and what it costs them (sleep, work, money, confidence, time with family), in their words; not a one-off annoyance.
- **I3 · Distinct avatars:** 2+ avatars, each with its own trigger moment.
- **I4 · Product-shaped:** 3+ physical product types that could help, with what fails them today; none on the never-sell list; and **at least one already sells on TikTok Shop** (a public sold count with its link and date). A product nobody buys yet can't pass F1, so the winning shape is the owner's knee brace: a proven product, sold to the avatar everyone ignores (October 3: the scout found the issue files' niche gap products, such as bunk organisers, leg pads and tilt platforms, sell almost nothing on TikTok Shop).
- **I5 · Clean:** the words bank is filled, Gemini's claims are cross-referenced, and no quote says or implies a condition we'd claim to treat.
- **I6 · Wants to buy** (owner, October 3: "those issues are real, but are they saturated and are they a real real concern where they want to actually buy something. where their reviews or issues say, 'i wish there was'. if a user is just complaining. it doesnt always mean they want to buy something"): **5+ verbatim quotes showing buying intent**, not just complaining: "I wish there was…", "I'd pay for…", "does anyone know a product that…", "where can I get…", "I've tried X and Y and…", a product they bought and returned, or one they compare. Complaints with no sign of buying don't count, and **at least 3 of the 5 must be for the product types the file names in section 6**; intent for other things (shoes, electronics, a $180 mouse) shows the group shops, not that it would buy what we'd sell. Tag each one in the words bank as `intent`.
- **I7 · Not owned on Meta:** a quick Meta Ad Library look (United States, active ads, read-only) using the group's own moment and avatar words: fewer than 3 advertisers already running 30+ day ads that speak to this group's moment. Save the searches, counts and links. A crowded moment fails I7; the full product-level check is still Prove it's P1.

**Owner decides:** which verified issues to **test**, a couple at a time. A tested issue starts a round (Step 1).

**After that it stays a reference:** Step 1 ties every card to its issues through the benefit ladder (F5), and Step 2 · Buyers adds new quotes and avatars back to the issue file. Launchroom shows the list on the Issues page (`#/issues`, `os.mjs issues`).

---

## Hard limits and Meta policy

**Never sell or advertise** ([the research](../resources/research/2026-10-01-product-filter/C-hard-limits-and-tools.md)):
- anything eaten, drunk or put on skin, and liquids and powders;
- weapons and adult products;
- devices that need FDA clearance (TENS, EMS) or claim to treat a condition;
- children's and baby products;
- loose magnets, power banks and loose batteries;
- recalled items and lookalikes of a named brand.

**Never dropship** (owner, October 2; F2 fails on these): earbuds, headphones and Bluetooth audio; complex or app-paired electronics; branded or patented items; fragile items; heavy or bulky items (over about 2 lb or oversized); high-return sized items; battery-core products. The same list is `hardLimits` in [os/data/rules.json](../os/data/rules.json) (`os.mjs rules`).

**Meta policy for a sleep, energy or focus product** (B; not legal advice: re-read the live policy pages before publishing):
- **Personal attributes.** Never "you/your" next to sleep, tiredness, anxiety, focus problems or age, and no second-person symptom questions ("Tired of waking up at 3am?" was reported flagged; B). Describe the situation or a third person: "The 3 a.m. scroll nobody plans for", "For late shifts". Naming a topic is allowed; saying the viewer has it is not (Meta's examples).
- **Health claims.** No cure, treat, prevent, "clinically proven", "doctor approved" or timed results. Say what the item physically does (blocks light, plays sound), not what happens to sleep. The FTC needs a reasonable basis for any claim, including on physical products.
- **Images.** No before/after of a person, no sleep-tracker screens or "my score went up", no generated faces posed as customers, no invented reviews or press logos. Image text is reviewed like copy.
- **AI images.** Expect an "AI info" label; avoid photoreal generated people; re-read every word a model drew on the image.
- **Audience.** Target 18+ and set the audience in Ads Manager, never by naming the viewer in the copy.

## Where the old checks went

Nothing was lost; saved evidence keeps its ids. A new gate line passes only when the saved checks under it pass **and** the old check asked for everything the new line asks. Where the new line asks for more (marked "part"), an old pass shows as "old check passed, new part open", never as a pass.

| New gate | Old checks it carries | Saved records it reads |
| --- | --- | --- |
| (issue library) | Step 1a's issue gate, then Step 1 · Issue (Oct 2, morning) | the issue list's gate, I1–I5 (Oct 3: the issue list comes first again) |
| F1 | Step 1b's F1 (Meta numbers; now statistics, so an Oct 1 Meta-only pass no longer counts) | the card's provenDemand check, with its demand and trend points |
| F2 | (new, Oct 2: dropshippable) | the card's dropshippable check |
| F3 | Step 1b's F2 "looks worth $30–60" | the card's looksWorth check |
| F4 | Step 1b's F4 "room for an avatar" (main + 2 others = 3) | the card's audienceRoom check |
| F5 | (new, Oct 2: the benefit ladder to our issues) | the card's bigIssue check |
| F6 | (new, Oct 2: the angle gap, any channel; Meta Ad Library optional) | the card's metaGap check |
| (earlier) | Step 1b's F3 "product does the work" and F5 "no brand" | kept on saved cards; brands and hard limits are now dropped at F2 |
| A1 | the old P1's quotes (V1; now 15 tied to this product: part) | card: buyers · product: community, country-demand |
| A2 | the old P1's avatar and fit (V2; now each avatar's trigger moment: part) | card: buyers · product: buyer-situation |
| A3 | (new, Oct 2: the angle nobody uses, per product) | card: buyers |
| (earlier) | the old P1's card checks | the card's community and fit deep checks stay on saved cards as history |
| P1 | V3, the deep demand check (was P2) | card: demand, competition · product: trend-history, trend-trajectory, competition |
| P2 | V4, S1 (was P3) | card: sourceMatch, sourcing · product: exact-product, exact-source, product-safety |
| P3 | S2 (was P4) | product: destination-route |
| P4 | S3, S4 (+ break-even ROAS and target cost per sale: part; was P5) | card: contribution · product: economics |
| P5 | (new; was P6; Oct 3: claims we can back, no sample) | product: sample (read as the claims list) |
| C1 | C1 (now concepts × formats: part) | product: angle-offer |
| C2 | C2 (now the image too: part) | product: claims-rights |
| C3 | C3 | product: claims-rights |
| C4 | C4 | product: creative-assets |
| B1 | B1 (now the 3 packs: part) | product: draft-page |
| B2 | B2 | product: draft-page |
| B3 | B3 | product: service-promise |
| B4 | (new) | product: checkout (part) |
| B5 | B4 | product: checkout |
| L1 | L3 (now a written test sheet: part) | product: experiment-plan |
| L2 | L1 | (no saved record yet) |
| L3 | L2 (now one Purchase, no duplicate: part) | product: tracking |
| L4 | L4 | (no saved record yet) |
| L5 | the owner's launch approval | product: authorized-test |
| R1 | (new) | product: result (part) |
| R2 | (new) | product: case-review (part) |
| R3 | (new) | product: case-review (part) |

Launchroom reads this map from `os/src/gates.mjs`; `os.mjs product <id>` prints each gate line's state.
