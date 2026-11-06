# Gemini Deep Research prompts for Macro-Trend Keyword Bibles, Hard Verifier Frameworks & Issue Research

For [workflow/CHECKS.md](../workflow/CHECKS.md) Step 0 & Step 1, and the **Trends & Research Hub (`#/trends`)**. Updated November 5, 2026.

**How to use them:**
1. Open Google Gemini (`https://gemini.google.com/app`) in the owner's signed-in Chrome session, select **`Gemini 3.1 Pro`**, and click **`Deep Research`** in the Tools menu.
2. Paste one prompt below and click **`Start research`** once the research plan appears.
3. Save the completed report under `resources/research/` or `resources/notes/` and register it in Launchroom Library (`node .claude/skills/merrivy-os/scripts/os.mjs library add --kind research --title "Gemini Deep Research: ..." --path ...`) so it automatically appears in the **Trends & Research Hub (`#/trends`)**.
4. Feed the resulting 2–4 word hardware keywords directly into our **Numbers-First Reverse-Engineering Sweep** on Kalodata US (`POST /overview/fullText/search` with `country: "US"`, `currency: "USD"`, `pageSize: 100`, requiring `>= 5` active US viral videos across `>= 3` distinct US creators).

## Prompt 0 · Macro-Trend, Seasonal & Crisis 200-Keyword Bible (`Numbers-First Reverse Engineering`)

```text
Run a rigorous, quantitative Deep Research report on current US household macro-trends, seasonal Q4/Winter buyer psychology, and urgent problem-solving product categories for TikTok-to-Meta e-commerce arbitrage. Structure the report into:
1. Macro World Events & Crisis Anxieties Driving Urgent US Buying Right Now: federal power-grid reliability & rolling blackout warnings (NERC/FERC), winter home heating bill shock (EIA/NEADA), municipal tap-water & bottled-water shortage fears, and home perimeter/evacuation security.
2. Seasonal Emotional & Physical Triggers: 5 PM sunset circadian crash & sleep architecture, winter cold-snap joint/sciatica/neuropathy flare-ups, holiday hosting & kitchen prep bottlenecks, and high-utility practical gifting.
3. 8 Meta-Proven Broad Problem Categories: for each category, contrast High-Value Dropship Winners ($45–$85+ retail, >=3x margin, <1kg weight, unique mechanism) against Commodity "Slop" to avoid (Walmart/Target/Amazon Prime basics, clothing, liquids, fragile glass).
4. Master 200-Keyword Kalodata & Meta Ad Library Search Bible: 25 exact 2–4 word concrete hardware search keywords per category (200 total) designed to uncover products with rising 30-day US sales and multiple viral creator videos.
```

## Short prompt · Overlooked groups inside a crowded category

```text
I run a small US online store. For the everyday product type "[PRODUCT TYPE]", find 5 specific groups of buyers whose situation the usual product ads and listings do not speak to. Use real discussions from the last 24 months (forums, Reddit, YouTube comments, 2-3 star Amazon reviews). For each group give: the situation in one line, the moment it hits, 2 verbatim quotes with the thread link and date, what they use instead (a workaround counts), and what the current listings miss. Table only. If you cannot find a real quote with a link, say so instead of filling the gap.
```

## Prompt 1 · Sleep that doesn't work

```text
I run a small US online store and I'm researching an everyday problem to deeply understand the people who live with it. I need real voices, not medical advice.

THE PROBLEM: sleep that doesn't work — people who can't fall asleep, wake at 3 am and can't get back to sleep, sleep but wake up exhausted, or can't sleep because of a snoring partner, noise, light, a baby or shift work.

Research real discussions from the last 24 months: Reddit, forums (Mumsnet, Quora, AARP and patient communities), YouTube comments and 1-3 star product reviews on Amazon and Walmart. Focus on the US.

Write the report in these sections:
1. The problem in one line, in their own words.
2. What it feels like: the emotions, each with 2 verbatim quotes.
3. What it costs them: relationships, work or school, daily life and health, money. Verbatim quotes for each.
4. At least 6 avatars across at least 3 life stages (for example students, new parents, shift workers, people in their 40s-50s, people going through menopause, retirees, partners of snorers). For each: age and life stage, the exact moment it hits, a verbatim quote, what they've tried, what failed and why, and where they talk online.
5. What they've tried, with how often each comes up: products, habits, apps, supplements and medication.
6. Physical products that are never eaten or drunk, which people use, love, complain about or wish existed. For each: which avatars, and the moment it helps.
7. One native-ad angle per avatar, written as a situation (for example "for the nurse who has to sleep while the street wakes up"). Never write "do you have…" or "your [condition]".
8. Their exact phrases: the words they use again and again.
9. A sources table listing every quote: the verbatim quote, the exact URL of the thread or review, and its date.

Rules: quotes must be word for word, with a working link to where they appear. Never present a paraphrase as a quote. No usernames. If you can't find something, say so instead of filling the gap.
```

## Prompt 2 · Brain fog, focus and forgetting

```text
I run a small US online store and I'm researching an everyday problem to deeply understand the people who live with it. I need real voices, not medical advice.

THE PROBLEM: brain fog, not being able to focus, and constantly forgetting things — losing keys and phones, forgetting why you walked into a room, the afternoon fog at work, screen overload, losing your train of thought.

Research real discussions from the last 24 months: Reddit, forums (Mumsnet, Quora, AARP and patient communities), YouTube comments and 1-3 star product reviews on Amazon and Walmart. Focus on the US.

Write the report in these sections:
1. The problem in one line, in their own words.
2. What it feels like: the emotions, each with 2 verbatim quotes.
3. What it costs them: relationships, work or school, daily life and health, money. Verbatim quotes for each.
4. At least 6 avatars across at least 3 life stages (for example students, remote workers with long screen days, new parents, people going through perimenopause or menopause, adults with ADHD traits, older adults worried about memory, caregivers). For each: age and life stage, the exact moment it hits, a verbatim quote, what they've tried, what failed and why, and where they talk online.
5. What they've tried, with how often each comes up: products, habits, apps, supplements and medication.
6. Physical products that are never eaten or drunk, which people use, love, complain about or wish existed (for example item finders, timers, planners, lighting, desk setups). For each: which avatars, and the moment it helps.
7. One native-ad angle per avatar, written as a situation. Never write "do you have…" or "your [condition]", and never promise better memory.
8. Their exact phrases: the words they use again and again.
9. A sources table listing every quote: the verbatim quote, the exact URL of the thread or review, and its date.

Rules: quotes must be word for word, with a working link to where they appear. Never present a paraphrase as a quote. No usernames. If you can't find something, say so instead of filling the gap.
```

## Prompt 3 · No energy, no motivation

```text
I run a small US online store and I'm researching an everyday problem to deeply understand the people who live with it. I need real voices, not medical advice.

THE PROBLEM: no energy and no motivation in everyday life — can't get out of bed, dark winter mornings, burned out after work, no drive for things you used to enjoy, days that drag. Keep it at the everyday level; where people mention depression, note it as context only.

Research real discussions from the last 24 months: Reddit, forums (Mumsnet, Quora, AARP and patient communities), YouTube comments and 1-3 star product reviews on Amazon and Walmart. Focus on the US.

Write the report in these sections:
1. The problem in one line, in their own words.
2. What it feels like: the emotions, each with 2 verbatim quotes.
3. What it costs them: relationships, work or school, daily life and health, money. Verbatim quotes for each.
4. At least 6 avatars across at least 3 life stages (for example students, young professionals with burnout, new parents, shift workers, people in dark-winter places, people in midlife, retirees who lost their routine). For each: age and life stage, the exact moment it hits, a verbatim quote, what they've tried, what failed and why, and where they talk online.
5. What they've tried, with how often each comes up: products, habits, apps, supplements, medication and therapy.
6. Physical products that are never eaten or drunk, which people use, love, complain about or wish existed (for example sunrise alarms, light lamps, routine tools, walking pads). For each: which avatars, and the moment it helps.
7. One native-ad angle per avatar, written as a situation. Never write "do you have…" or "your [condition]", and never claim to treat mood or depression.
8. Their exact phrases: the words they use again and again.
9. A sources table listing every quote: the verbatim quote, the exact URL of the thread or review, and its date.

Rules: quotes must be word for word, with a working link to where they appear. Never present a paraphrase as a quote. No usernames. If you can't find something, say so instead of filling the gap.
```

## Prompt 4 · After you pick an issue: proven products for it

```text
For the problem "[ISSUE]", find physical products (never eaten or drunk, not medical devices) that are currently selling well to US consumers through Facebook and Instagram ads or single-product online stores.

For each product: what it is, the typical selling price, who the ads currently target, 2-3 online stores selling it (with links), any sign it has sold steadily for months (long-running ads, review counts, repeated sellers), and which kinds of people with this problem are NOT being targeted by the current ads. Leave out branded or patented items, children's products, supplements and anything claiming to treat a medical condition. Give links for every claim, and say when you're unsure.
```
