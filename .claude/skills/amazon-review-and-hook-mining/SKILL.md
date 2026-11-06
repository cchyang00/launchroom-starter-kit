---
name: amazon-review-and-hook-mining
shelf: research
description: Mine 4-5 star Amazon reviews FIRST (extracting the 3 best buyer-praised features, avatars, and trigger moments), cross-check 2-4 star objections and TikTok comments, collect 15+ verbatim dated quotes (A1-A3), and save Gemini Deep Research reports to the Trends & Research Hub.
---

# Amazon Review & Hook Mining (`A1–A3` · `#/verify` & `#/trends`)

This skill encodes our **Buyer Research & Review Mining Method** for **Step 2 · Verify (`#/verify`, `buyers` gate `A1–A3`)** and **Step 0 · Issues & Trends (`#/issues` & `#/trends`)**. By owner rule (Oct 3 & Nov 3–4), we always mine **4–5 star Amazon reviews FIRST** to capture validated emotional payoffs and the **top 3 buyer-praised features** before cross-checking 2–4 star reviews, TikTok comments, and Reddit/forums.

## Canonical References
- **Workflow Checks (`Step 0` & `Step 2 · Buyers`):** [workflow/CHECKS.md](../../../workflow/CHECKS.md)
- **Master Issue Topics & Quote Bank:** [resources/issues/TOPICS.md](../../../resources/issues/TOPICS.md) & [templates/ISSUE.md](../../../templates/ISSUE.md)
- **Gemini Deep Research Prompts:** [templates/GEMINI-ISSUE-PROMPTS.md](../../../templates/GEMINI-ISSUE-PROMPTS.md)

---

## Step-by-Step Operational Playbook

### Step 1 — Mine Top 4–5 Star Amazon Reviews FIRST (Owner Rule)
1. **Open the Top 3–5 Amazon Listings for the Exact or Closest Matching Mechanism:**
   - Use the owner's signed-in Chrome (`localhost:9222`, strictly **read-only**—never add to cart, vote, or post) so full review pagination opens cleanly.
   - Filter to **4-star and 5-star reviews**, sorting first by **Most Helpful** and then by **Most Recent**.
2. **Extract the Top 3 Buyer-Praised Features (Powers Static Ads & Storefront):**
   - Count which specific physical features, sensory details, or life improvements happy buyers praise most frequently.
   - Distill the **Top 3 Buyer-Praised Features** in crisp, concrete language:
     - These 3 features feed the **3-Feature Callout Strip** on our `4:5` Direct-Response static ads (`#create`).
     - These 3 features and buyer situations feed the `.is-wftn-reviews` customer review cards and feature blocks on our Hydrogen storefront (`#/build`).
3. **Pull Verbatim 4–5 Star Quotes (`Who + Trigger Moment + Before/After + Emotion`):**
   - Record word-for-word quotes (with exact review date within 24 months and direct URL, zero usernames) capturing:
     - **Who** bought it (e.g., night-shift nurse, daughter buying for an aging parent, rural homeowner on well water);
     - **The exact trigger moment** that made them order right then;
     - **What changed** (`before -> after`) and the exact emotional relief phrase they use.

### Step 2 — Cross-Check 2–4 Star Reviews, TikTok Video Comments & Forums
1. **2–4 Star Amazon & TikTok Shop Reviews ("Where the Reality Lives"):**
   - Identify recurring complaints, sizing/setup confusion, battery life limits, or packaging flaws.
   - Turn every fixable friction point into pre-emptive **Storefront FAQ / Guarantee copy** and a **Supplier Quality Check (`P2`/`P5`)**.
2. **Viral TikTok Video Comments & Spoken 3-Second Hooks:**
   - Inspect comments on the product's top `3–5+` US viral videos (`rawVideos`) to capture buyer questions (`"Where did you get this?"`, `"Does this work during a power outage?"`) and the creators' spoken 3-second opening reveal hooks.
3. **Reddit (`old.reddit.com`, signed out) & Niche Forums:**
   - Run targeted phrase searches (`site:reddit.com "<product mechanism>" "finally helped"`, `"tried everything"`, `"wish there was"`) to gather additional verbatim quotes across `2+` distinct source types.

### Step 3 — Organize into the 4 Quote Buckets & 3+ Avatars (`research/<round>/buyers/L###.md`)
Write `research/<round>/buyers/L###.md` following [templates/ISSUE.md](../../../templates/ISSUE.md):
1. **Top 3 Buyer-Praised Features Table:** Feature name, %/count of reviews praising it, verbatim buyer phrase, and how we show it in ads/storefront.
2. **3+ Distinct Buyer Avatars (`A2`):**
   - For each avatar: specific demographic/life situation, **exact trigger moment**, what they tried before that failed, their verbatim words, and why current competitor ads miss them.
3. **The 4 Verbatim Quote Buckets (`A1` — `15+` Verified Dated Quotes from `2+` Source Types):**
   - **Trigger Moment:** when the pain or urgency peaks;
   - **What They Want:** the concrete better day they describe;
   - **What Failed Them:** Big-box or Amazon alternatives that broke, leaked, or disappointed;
   - **Their Exact Words:** vivid phrases to echo in headlines and hooks (never faked as invented testimonials).
4. **Objections, 3-Rung Benefit Ladder & The Angle Gap (`A3`):**
   - Document top buyer hesitations, sharpen the `functional -> emotional -> life` ladder (`F5`), and define the **Angle Gap** (`A3`)—the specific avatar and angle no Meta or TikTok competitor is addressing.

### Step 4 — Patch `/api/research` (`A1–A3`) & Update Issue Files
1. **Patch the Card's `buyers` Check (`PATCH /api/research`):**
   - Update `screen.checks.buyers`, `screen.checks.audienceRoom`, `screen.checks.bigIssue`, and `gates.fit`:
     ```json
     {
       "status": "passed",
       "observedAt": "2026-11-05",
       "source": "research/<round>/buyers/L###.md",
       "quotes": 18,
       "avatars": [
         {"who": "Avatar 1 name", "trigger": "Specific trigger moment"},
         {"who": "Avatar 2 name", "trigger": "Specific trigger moment"},
         {"who": "Avatar 3 name", "trigger": "Specific trigger moment"}
       ],
       "angleGap": "Exact angle and avatar competitors miss",
       "note": "18 verbatim dated quotes across Amazon 4-5* reviews, TikTok Shop, and Reddit; top 3 praised features extracted."
     }
     ```
2. **Append Reusable Quotes to `resources/issues/<slug>/ISSUE.md`:**
   - Add newly verified verbatim quotes to the matching issue dossier and ensure `resources/issues/TOPICS.md` stays synced.

### Step 5 — Save Gemini Deep Research Reports to the Trends & Research Hub (`#/trends`)
Whenever a Gemini Deep Research run completes (for an issue, macro-trend, or buyer study):
1. Save the full markdown report under `resources/research/<YYYY-MM-DD>-<topic-slug>/REPORT.md` (or inside `resources/issues/<slug>/`).
2. Register it in the Launchroom Library with `"Gemini"` in the title so it automatically populates the **Trends & Research Hub (`#/trends?tab=research`)**:
   ```bash
   node .claude/skills/merrivy-os/scripts/os.mjs library add \
     --title "Gemini Deep Research: <Topic Name>" \
     --kind research \
     --topics buyer-angles,product-research \
     --path resources/research/<YYYY-MM-DD>-<topic-slug>/REPORT.md \
     --learned "Summary of key findings, avatars, and high-intent keywords"
   ```

---

## Quality Gate Checklist (`A1–A3`)
- [ ] **4–5 Star Amazon Reviews Mined First:** Top 3 buyer-praised features explicitly documented for static ads and storefront copy.
- [ ] **`A1` (`15+` Verbatim Quotes):** Every quote is word-for-word, dated within 24 months, linked to its source URL, and spans `2+` source types (zero usernames, zero paraphrased fabrications).
- [ ] **`A2` (`3+` Avatars):** Each avatar has a concrete situation, trigger moment, failed alternatives, and verbatim phrases.
- [ ] **`A3` (Angle Gap):** Competitor messaging is linked and the untapped avatar/angle gap is written down.
- [ ] **`PATCH /api/research` Saved:** `research/<round>/buyers/L###.md` exists on disk and `screen.checks.buyers` + `gates.fit` pass on the card.
