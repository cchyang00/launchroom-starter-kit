# Report Codex work to the shared app

## Visual learning desk

Library → Learn Skill reads `resources/learning/CATALOG.md` through the bounded document API. Edit the canonical catalog/lesson files, then use Reload lessons; do not treat an app build as a research update. Sources have read scopes, generated examples have provenance, and the full lesson retains contrary evidence. Use [Learn Skill](../agents/manager/.agents/skills/learn/SKILL.md) for research-to-lesson work.

The practice form saves a dated lesson through `/api/workspace/notes`, with an explicit Me/Agent author and references. Agents may use the same API directly with `author: "agent"`, the current revision, source references and an observed application. The form verifies readback. A saved reflection is neither comprehension proof nor a product-gate pass. Topic drafts survive topic switches within the learning desk; save before leaving or reloading the app. The app does not dispatch research subagents from a lesson; Codex owns execution.

Use this bridge when the current Codex task or an assigned native subagent starts work, reaches a meaningful milestone, becomes blocked, or finishes. Codex chat owns task control and delegation. The app displays persisted reports and resources; it does not automatically listen to Codex or dispatch native agents.

The optional local CLI runner has its own run records and controls. An activity report neither starts that runner nor proves a process is currently active. The app shows **last reported status**. `reportedBy: "codex"` labels the report source; it is not runtime verification or authentication.

## Work through localhost:3000

### The seven-step line (October 1, seven steps October 2)

The owner made the steps the backbone (October 1: six; October 2: seven, then product first the same day): 1 Product, 2 Buyers, 3 Prove it (the old Validate and Source, merged), 4 Create, 5 Build, 6 Launch, 7 Learn. Step ids: `product`, `buyers`, `prove`, `create`, `build`, `launch`, `learn`. Page addresses: `#/find` (Product; `#/product/<id>` is one product's page, and a bare `#/product` opens Step 1), `#/buyers`, `#/prove` (`#/validate` and `#/source` redirect there), `#/create`, `#/build`, `#/launch`, `#/learn`. Before them sits **step 0, the issue list** (owner, October 3: "the hard part, done first"): `#/issues` (the old `#/issue` opens it), in the sidebar above Product. It is not a product step: the seven step ids and `--step` words are unchanged. The old ids and words (`discovery`, `validation`, `sourcing`, `creative`, `shopify`, `testing`, `find`, `validate`, `source`, and `issue`, read as Buyers) still work in `--step` and are read as their new step. Everyone must know which step we are on. and everyone must know which step we are on. `workflow/the-line.json` is the step guide: for each step its purpose, when it starts, when it is done, the owner's part, the agents who help, when to stop, three copy-and-paste prompts and the playbook section, plus six anytime prompts. Edit wording there; the playbook stays the full procedure. The app reads it and never writes it.

| Operation | Request / response |
| --- | --- |
| Current step | GET `/api/line` returns `{line, error, current, pipeline, markdown, computedAt}`. `current` is the pipeline's focus step: `number`, `id`, `name`, `status`, `next`, `guide`, the building product and market (`product`, `market`, null when nothing builds), the card counts, `focus` and the whole `pipeline`. `markdown` is the pipeline block plus the focus step block the manager's brief opens with. |
| In the bootstrap | GET `/api/bootstrap` includes `line` and `lineError`. |
| Read the guide | GET `/api/doc?path=workflow/the-line.json` returns it as a readable page. |

Since the pipeline (below), every product has its own step and "the step" is the pipeline's focus: the product in the build slot first, then what waits on the owner (launch approval, the build pick, then eye tests), then the earliest product on the line, else "start a round". It is worked out from saved records only; viewing a page, a finished task or an agent run never moves it. START-HERE refreshes on task, note, handoff, lesson, product, round and eye-test writes.

Claude Code: `os.mjs step` prints the pipeline block, the focus step block and its three prompts with the focus product filled in; `os.mjs prompts [1-7|product|buyers|prove|create|build|launch|learn]` prints a step's prompts plus the anytime ones; the first lines of `os.mjs status` are the pipeline. Start every job by naming the product, its step, what that step is for and when it is done (lesson LS-063).

### The pipeline: every product has its own line (October 1)

The owner: "The line is not something that just exists; it exists from a product that we choose." Many products move through Product, Buyers and Prove it at once; Create, Build, Launch and Learn take one product at a time, the **build slot**, which the owner picks. Each Product batch is a numbered **round** (it starts from a focus; it does not need an issue). `os/src/pipeline.mjs` derives it all from saved records (tested in `server/pipeline.test.mjs`).

Where a product's step comes from:
- A card alone (L###): `waiting` is Product (Step 1). A card with a deep record (a buyers, source or profit check, or a deep gate, saved as supported or failed) moves to Verify by itself, and one that passes every hard check lands on Winners with no Save (Nov 5). Only a card checked under the older rule (before Nov 3) still shows "Waiting for your eye test", when all six Product checks (F1-F6) pass, and a card without statistics never does; otherwise it is "Checking · Product n/6" (the scout's move) and the Product page (`#/find`) lists it under "Still being checked". The owner can still decide on it; the server never blocks Save. `saved` (and `ready`) is Step 2 · Buyers until the card's `buyers` check passes (status "Buyers · pending", the buyer researcher's move; Product checks it still owes are shown, e.g. "· Find 2/6"), then Prove it (the exact item, the money line, then the deep checks; a reviewed card's next move is starting its product record). Pass, Reject and a saved card whose decision text starts with PARK or KILL leave the line, with the reason.
- A card with a product record (P###, once the card is reviewed): the product's own checks (`processState`). Product and validation checks not yet recorded read "Prove it · recording the product record (n/7)"; then the rest of Prove it (P1-P5); the line's Buyers dot shows the card's `buyers` check, done only when it passed; when Prove it is complete it is **ready to build** and waits for the build slot. Only the product in the slot moves through Create, Build, Launch and Learn. A parked or rejected market, or a reviewed (archived) cycle, leaves the line.
- A product not started from a card is its own row, marked `unlinked`; its checks cannot count until it is linked.

| Operation | Request / response |
| --- | --- |
| Pipeline | GET `/api/pipeline` returns `{pipeline, focus, line, error, markdown, computedAt}`. `pipeline` has `items` (all rows), `active`, `out`, `counts` per step id plus `ready`, `active`, `out`, `total`, `building`, `buildProductId`, `rounds` (each with `id`, `cards`, `active`, `out`, `inProductProve`, `canReview`, `needsReview`), `round` (the newest open one), `nextNumber`, `earlier` (cards in no round), `ownerMoves` (`launch`, `build-pick`, `eye-test`, each with `text` and a short form) and `focus`. Each item: `id` (the card, else the product), `leadId`, `productId`, `marketId`, `name`, `image`, `country`, `round`, `roundId`, `stepIndex`, `stepId`, `stepName`, `line` (seven `{id, name, state, done, total}`; state is done, current, todo, stopped or waiting), `status`, `next`, `who` (`owner` or an agent id; `manager` is Claude), `outcome` (out of the line: `{kind, label, reason}`), `readyToBuild`, `building`, `unlinked`, `nextCheck`. |
| One product | GET `/api/pipeline/item?id=<L### or P###>` returns `{item, step, markdown, prompts, round, buildProductId}`: its line, its step block and that step's prompts with `[product]`, `[country]` and `[L###]` filled in. Since October 2 it also returns `gates`: the seven steps' gate lines (F1-F6, A1-A3, P1-P5, C1-C4, B1-B5, L1-L5, R1-R3), each with its state worked out from the saved checks (`os/src/gates.mjs`; `os.mjs product <id>` prints the same). |
| Start a product | POST `/api/products` with `{leadId, name?, country?, variant?}` starts P### from a card the owner saved (`LEAD_NOT_SAVED` otherwise; `LEAD_OUT_OF_LINE` for a parked card; `LEAD_HAS_PRODUCT` for a second product). It takes the card's id, country and exact listing so its checks bind to the card; nothing is copied as verified, and starting a product never fills the build slot. Linking a market to a card that already has a product is refused the same way. |
| Build this one | POST `/api/workspace/build` with `{revision, productId, reason}`: the owner's pick on the product's page, with the owner's reason. An agent's request is refused (`OWNER_DECISION_ONLY`); a pick the owner said in chat goes through `os.mjs owner-said build` (October 3). Refused while another product holds the slot (`BUILD_SLOT_TAKEN`) or before its Find, Validate and Source checks are all reviewed (`SOURCE_NOT_DONE`). There is no helper command: it is owner-only. The workspace then has `build: {productId, reason, pickedAt, by: "owner"}`, `buildProductId`, and `activeProductId` mirrors it for older readers. Verifying a Create, Build or Launch check on any other product is refused (`BUILD_SLOT_REQUIRED`). The cycle review archives the product and frees the slot. |
| Issue list (step 0) | GET `/api/issues` returns `{root: "resources/issues", method: "workflow/CHECKS.md", gateMin: 7, issues, counts: {testing, verified, candidate, parked, total}, hint, picks: {path: "os/data/issue-picks.json", revision, error}, problems, roundsWithoutIssue, roundsError}`. One entry per folder in `resources/issues/`: `slug`, `path`, `title` (the words after "# Issue: "; the folder name for a stub), `group` (the "**Group:**" line, else the avatar names in section 4), `quotes` and `sites` (numbered rows and distinct sites in section 9, else null), `siteNames`, `productTypes` (section 6), `searchTerms` (its TikTok Shop column or "TikTok Shop: '…'" notes), `failing` (a section 6 "what fails them" column) and `tried` (section 5), `researched`, `researchedBy`, `gate` (`{found, format: "i1-i7"\|"mixed"\|"older"\|"none", items, done, total, min}`), `checks` (the seven I-checks `[{id, name, rule, state: "passed"\|"partly"\|"open", note, from}]`), `verified` (all seven passed; also `gatePassed`), `stub`, `gemini` (report paths beside it), `missingFile` (a folder with only a Gemini report), `modifiedAt`, `pick`, `status` and `rounds` (`[{id, number, open, startedOn}]`), `openRound`, `reopened` (picked, then the gate reopened). **Both gate formats are read:** the new lines `- [x] I1 · Real: …` to `I5 · Clean: …` (templates/ISSUE.md) map one to one; an older file's five lines map by what they ask (quotes and sites to I1, costs to I2, avatars to I3, product types to I4, words bank and usernames to I5) and a line that asked less than its I-check reads `partly`, so an older file is never Verified until its gate is rewritten as I-lines. **Status is derived, never dragged:** `candidate` (a Gemini report or an unfinished gate), `verified` (all seven passed), `testing` and `parked` (the owner's pick). Nothing in the app ticks a gate: an agent ticks a line in the file only with the evidence written there. |
| The owner's issue pick | POST `/api/issues/pick` with `{revision, slug, pick: "testing"\|"parked"}` (Test this issue / Not now on the Issues page; one tap, no typed reason) or, from the 5-second Undo, `{revision, slug, pick: <the earlier pick or null>, undo: true}`. **Owner only:** a write with the helper's `x-launchroom-local-agent` header is refused with `OWNER_DECISION_ONLY` (403), and there is no helper command for it. A Candidate is refused with `ISSUE_NOT_VERIFIED` (409, `details.open` lists the open I-checks); the same pick twice is `ISSUE_PICK_SAME`; a stale revision is `REVISION_CONFLICT`. `os/data/issue-picks.json` is `{revision, picks: {<slug>: {pick, at, undone?}}}`, revision-checked; a missing file is no picks yet. More than 3 Testing shows a soft hint ("a couple at a time"), never a block. `watch-owner.mjs` prints `LAUNCHROOM issue pick · <slug> → TESTING`, `→ PARKED` or `→ undone`. |
| Rounds | GET `/api/rounds` returns `{revision, rounds, summary, current, nextNumber}`. POST `/api/rounds` with `{revision, action: "start", focus, folders: ["research/<batch>/"], issue?, startedOn?}` (owner, October 3: rounds start from the issues the owner is Testing. `issue` names one: `ISSUE_MISSING` 400 when there is no such folder, `ISSUE_GATE_OPEN` 409 for a Candidate (the message lists the open I-checks), `ISSUE_NOT_PICKED` 409 for a Verified issue the owner has not picked, `ISSUE_PARKED` 409 for one set aside; a round started from a focus alone, with no `issue`, is still accepted), `{revision, action: "review", id: "R04", whatWorked, whatFailed, nextChanges, reviewedOn?}` or `{revision, action: "import", rounds: [{number, startedOn, focus, folders, review?}]}` (adds rounds whose number is not saved yet, skips the rest; rounds without an issue are valid). `action: "focus"` with `issue` links an open round to an issue by the same Testing rule; an imported round that names an issue needs only the issue's folder to exist (history). A review, or an import with a review, is refused with `ROUND_NOT_FINISHED` (and the card ids) while the round still has cards in Product, Buyers or Prove it. `os/data/rounds.json` is authoritative; `memory/ROUNDS.md` is its page. A card belongs to the earliest round whose folder its batch file, card file, references or evidence use; others are "earlier work". |

Briefs open with **"The pipeline · Round N"**: the round and its focus, products per step, the build slot, what waits on the owner, the focus, then one row per product (the reader's own first, at most 6, within 240 words). Team agents also get **Yours** (the products waiting at their steps: scout Find; checker Validate, Source and Launch; buyer-researcher Validate and Source; copywriter and image-maker Create; store-builder Build and Launch) and a **Your step** block named after their first product; the manager gets the **Focus** step block. Each step block stays within 185 words.

Claude Code: `os.mjs pipeline [--all]`, `os.mjs product <L###|P###>`, `os.mjs product start <L###>`, `os.mjs rounds [import <file>]`, `os.mjs issues [--status candidate|verified|testing|parked] [<slug>]` (status and the I1-I7 dots; one issue prints its checks and search list), `os.mjs round start --issue <slug> --focus "..." --folder research/<batch>/` (a Testing issue), `os.mjs rules` (the starting rules), `os.mjs round review R## --worked .. --failed .. --next ..`, and `--product L###|P###` on `add`, `set` and `report`.

### November 5: the scraper, Product and Verify

Product (`#/find`) and Verify (`#/verify`) are the agents' pages. Three things feed them:

- **Products:** one card per product through the research API (`PATCH /api/research`), with `decision` containing `CURATED` so it counts as on the line. It stays in the catalog until a deep record is saved. An optional top-level `keyword` (the search that found it) shows on the card and fills the Keywords filter. The numbers come from the card's `provenDemand` check, as today.
- **Scraper runs:** the scraper writes `research/scrape-runs.json`; `GET /api/scrape-runs` reads it, and a malformed row is dropped. Report only real counts:

```json
{"runs": [{"id": "S001", "at": "2026-11-05T09:00:00Z", "keywords": ["graphene heating pad"], "scraped": 2400, "kept": 28, "removed": {"price": 1500, "quality": 200, "stores": 420, "videos": 180, "trend": 60, "limits": 12}, "note": "optional"}]}
```

- **The filters and checks:** `CATALOG_FILTERS` and `VERIFY_CHECKS` in `os/src/productGates.mjs` are the one list. The `removed` keys above are the filter ids. A check's `reads` names the saved checks behind it; add a check by adding an entry, then rebuild. The keyword list is the table in [the Keyword Bible](../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md).

A failed check takes a product off the line as before. Its kill shows at the first check in list order that failed, with the first saved words that say why, so write the reason into the failed check's `note`.

### October 3: work done ahead, failed checks, decisions said in chat, Run buttons

**Researched ahead.** GET `/api/prove-ahead` returns `{cards: {L###: {path, lines, p1, walls, observed, roomOnMeta}}, computedAt}`: each card still on the line with a Prove it file (`research/<round>/prove/L###.md`, named by its checks or found in its round's folder), read by `parseProveFile` (src/proveAhead.mjs): P1 from "## Room on Meta (P1)" (its "P1 · Room on Meta: PASSES (...)" line), P2-P5 from the "## Verdict in six lines" table (OPEN, DRAFTED, WRITTEN, PASS, FAIL), and the supplier sites the "Access, honestly" table stopped on. Read-only: a prove file is a write-up, never a recorded check. Prove it and the product page show an unsaved card with that work (or a saved buyers check) as "Researched ahead · waiting for your Save", with the owner's one-tap Save, Pass and Reject (the eye test's own write and Undo). The P-checks the checker could not record before the Save go in with the manager's next pass. "Why it waits" on the product page names each check that can't move, why, and whose action moves it. **Write the prove file's first section as the six-line verdict table** so Launchroom can read it.

**A failed check fails the product** (workflow/CHECKS.md rule 3). A gate check saved as `failed` with its date and source (F1-F6, the buyers check for A1-A3, P1 `demand`/`competition`, P2 `sourceMatch`/`sourcing`, P4 `contribution`) takes the product out of the line as "Failed at <check> · <label>" with the check's note, on its own; it never waits under Needs you. Pending, blocked or unknown checks (missing evidence, a deep gate not open yet) never fail a product; the legacy `community` and `fit` gates are not gate lines. The owner's one-tap **Reopen** (product page, 5-second Undo) saves `screen.reopened: [{id, observedAt, note, at}]` for that exact failure; the card goes back on the line as "Reopened · re-check <check>" with the check's agent next. A new failure of the same check (another date or note) fails it again. An agent's write that adds or drops a Reopen is refused (`OWNER_DECISION_ONLY`).

**Prove it's next move** comes only from P1-P5: P1, P2 and P4 are recorded on the card; once they pass, the next move is `os.mjs product start L###`, and P3 (delivery) and P5 are recorded on the product record. **P5 is "Claims we can back"** (owner, October 3: no samples): every page and ad claim backed by a supplier spec or a pattern in buyers' reviews of the same item type; nothing is bought. The product check id stays `sample`. **Exact source** (`exact-source`) accepts an Alibaba or AliExpress listing (CJ last), or a local record of explicit supplier confirmation.

**Decisions said in chat** (owner, October 3: "if you cant run the pipeline by yourself and i have to manual this process all the time. clearly something is wrong"). **Only the manager uses this, and only with the owner's own words from chat:**

`os.mjs owner-said <save|pass|reject|build|test-issue|park-issue|approve> <L###|P###|issue-slug> --quote "<the owner's exact words>"`

It is POST `/api/owner-said` `{action, target, quote}` (no other fields). It writes through the same owner-decision rules as the screens, with `recordedBy: "manager"`, `source: "owner-chat"` and the quote as the reason:
- save, pass and reject set the eye test (`screen.said: {recordedBy, source, quote, at, before}`; Save still needs F1 statistics);
- build takes the build slot, launching early when Prove it is open, with the quote as the reason (`build.recordedBy`, `build.source`; the open P-checks stay listed on its page);
- test-issue and park-issue are the issue pick (`picks[slug].recordedBy`, `.source`, `.quote`);
- approve records the launch approval (`authorized-test`) on the product in the build slot, logged in `products/P###/owner-decisions.md`.

No quote, no decision (`QUOTE_REQUIRED`); a request from a headless run (`x-launchroom-run`) is refused (`OWNER_DECISION_ONLY`); the same decision twice is `SAME_DECISION`. Launchroom labels each one "Said in chat" with the quote, and the owner undoes it with one tap. A plain agent write of any decision still gets `OWNER_DECISION_ONLY`, and so does an agent's POST `/api/workspace/build`. The doctor lists the last 7 days of chat decisions for audit.

**Run buttons: headless Claude Code from Launchroom (off the screens since November 4: the owner gives work in chat, and these routes stay unused).** The owner pressed Run on a product's page (its step's jobs), a Prove it row (Run P2-P5), an issue's sheet (Find products for a Verified or Testing issue; Cross-reference and re-gate to I1-I7) or the Agents tab (the health check). The browser sends only `{templateId, target}`; the server fills a **reviewed template** from saved records and appends the standing rules. There are no free-text prompts.
- **Templates** live in `os/data/job-templates.json` (revision, reviewedBy, reviewedOn; validated by `server/jobTemplates.mjs`: fixed fields, known blanks only, design agents on opus, research on sonnet, haiku only for the no-agent check, 2-90 minutes). Today: Run Buyers (buyer-researcher), Run Prove it P2-P5 (checker), Run Room on Meta (checker, **needs the manager chat**), Find products for this issue (scout), Cross-reference and re-gate to I1-I7 (buyer-researcher), Health check and summary (haiku).
- **Standing rules** in every prompt (code, not the file): read-only on shopping and ad sites; no cart, buying, sign-in or messages; never solve a CAPTCHA; never record an owner decision or start a run; never publish, deploy, push or spend; a timeout on every network call; unknown stays unknown; report to the Agents tab with the run's job id; scripts only in the run's own folder.
- **The command** (no shell, cwd = the workspace root, the prompt on stdin): `claude.exe -p --output-format stream-json --verbose [--agent <agent>] --model <model> --tools Read,Glob,Grep,Write,Edit,WebFetch,WebSearch,Bash --settings <per-run file> --permission-mode dontAsk --setting-sources user,project --strict-mcp-config --append-system-prompt <standing rules>`. Never `bypassPermissions`. Local settings (`.claude/settings.local.json`) are not loaded. The child gets a clean environment (no desktop-app session variables, no API keys: it uses the CLI's own sign-in, the owner's Claude plan) plus `LAUNCHROOM_RUN_ID` and `LAUNCHROOM_PROJECT`.
- **The allowlist** (anything else is denied, and the run writes the gap down): Read, Glob, Grep, Write, Edit, WebFetch, WebSearch; `Bash(node .claude/skills/merrivy-os/scripts/os.mjs:*)`, `Bash(node inbox/runs/<run id>/*)` (its own scripts), `Bash(curl:*)`, `Bash(cd:*)`.
- **Always refused:** `os.mjs owner-said`; git, npx, npm, pnpm, yarn, shopify, gh, claude, codex, powershell, pwsh, cmd, rm, `node -e`; reading `os/private/`, `private/`, `.env` files, `~/.claude`, `~/.ssh`, `~/.codex`; writing or editing `os/`, `.claude/`, `hydrogen-storefront/`, `memory/`, `private/`, `research/comparison.json` (records go through the API), AGENTS.md, USER.md and MEMORY.md.
- **Honest limits:** a script in the run's own folder can do what the account can; the allowlist keeps runs on our helper and their own scripts, it is not a sandbox. The server's owner-only refusals stay the backstop.
- **Browser:** headless runs can't reach the desktop app's built-in browser. Claude in Chrome connects with `--chrome`, but creating a tab asks for approval, which a headless run can't give (tested October 3), so jobs that need a rendered page (Room on Meta) say "needs the manager chat". The others read with WebFetch and WebSearch only, and pages they can't read stay unknown.
- **Limits:** at most 2 runs at once and one per product (or issue) and step; each template has a time limit, after which the run is stopped. Stop kills only that run's own process tree (taskkill /PID /T /F).
- **Records:** `os/data/runs/claude/<run id>.json` (events redacted, last 150; status starting, running, finished, failed, stopped, timed-out, interrupted). A run that finishes without changing its record shows "Finished · nothing saved"; one that changed it shows "saved: check it". Never "passed": a run never passes a check by itself. A run going when the server restarts reads as interrupted.
- **Routes** (per project): GET `/api/claude` (availability, templates, tools, allow and deny lists), GET `/api/claude/runs` (the newest 30, last events only), GET `/api/claude/runs/<id>` (one full record), POST `/api/claude/runs` `{templateId, target}`, POST `/api/claude/runs/<id>/stop` `{}`.
- **Who can start one:** only the owner's own browser on this computer: a signed-in admin, plaintext loopback, the exact local origin, same-origin. Agents (`AGENT_RUN_REFUSED`, also for the older `/api/runs` and `/api/scripts`: no recursion), remote connections (`REMOTE_RUN_REFUSED`) and shared members such as the owner's brother (`OWNER_ONLY`) can only watch. The older Codex runner stays off inside projects.

### Starting rules (October 2)

Most testing numbers are someone's rule of thumb, so they live in one file the owner can change: `os/data/rules.json` (the target cost per sale percent, the trend band, the first-test loss limit, the kill, trim and scale lines, the no-edit window, the `hardLimits` list and more). Each rule says whose number it is: `by: owner` (the owner's own choice) or `starting` (a rule of thumb from our research). The method page [workflow/CHECKS.md](../workflow/CHECKS.md) names the same numbers.

| Operation | Request / response |
| --- | --- |
| Read the rules | GET `/api/rules` returns the rules with their `revision`, each rule's `value`, `by` and a plain description. |
| Change a rule | POST `/api/rules` with `{revision, changes: {"<rule id>": {value}}}`. Revision-checked: a stale `revision` is refused, so read first. The Settings page uses this. |

The owner changes numbers; agents never change an owner number (a rule with `by: owner`). Claude Code: `os.mjs rules` prints them.

### Health check (October 1)

The owner wants an OS any agent can pick up and "basically cannot fail". The health check reads the saved records and lists, in plain words with a one-line fix each, what is stale, broken or waiting. It never writes or fixes a record.

| Operation | Request / response |
| --- | --- |
| Check | GET `/api/doctor` returns `{computedAt, mode, count, ok, summary, checks}`. `summary` is "All good" or "N things to look at"; `count` counts findings to look at. Each check has `id`, `label`, `status` (`ok`, `look` or `note`) and `findings: [{status, text, fix}]`. Notes are information and are not counted. |

The eleven checks, in order:
- `server`: the running server's code against the files on disk (a stamp of `os/server/*.mjs` and `os/src/*.mjs` taken when it started), so "needs a restart" is caught; and the app build against the screens (`os/dist/build-stamp.json`, saved by `npm run build`).
- `line`: `workflow/the-line.json` is valid, every step's brief block is within 185 words, the pipeline block of every brief is within 240 words, and the pipeline can be worked out.
- `pipeline`: a round with no cards left in Product or Prove it needs its review; products ready to build while the slot is empty need the owner's pick; a product at Product or Prove it with no recorded activity (its record, its card's evidence, its round's start, tasks or reports naming it) for 7 days; a card linked to two products; the building product with no update for 7 days; products not started from a card.
- `memory`: `memory/START-HERE.md` and `memory/NOW.md` were built from the latest workspace, planner, lessons, tools and rounds revisions; Now is at most about 300 words.
- `lessons`: no list over its limit (15 for everyone, 10 per agent); no proposal waiting more than 2 days. A full list is a note.
- `reports`: no running report without an update for 24 hours; no blocked report older than 7 days.
- `tasks`: no open to-do dated before today; no owner to-do waiting more than 3 days; at most 3 open focus tasks on a day.
- `library`: every learned entry's file exists; no reading-list item older than 7 days.
- `tools`: every active tool has a working link; no "Signed in?" note older than 14 days.
- `assets`: no store place pointing at a missing file; empty places are a note before Step 5 · Build and a finding from Build on; site pictures still showing the demo hoodie while the store's packet is a real product; store map problems.
- `team`: every roster agent has a `.claude/agents` file and every agent file is on the roster.

A record that cannot be read becomes one finding in its check, never a crash. Claude Code: `os.mjs doctor` prints the same report; run it at the start of a session after `status`. When the server has no `/api/doctor` (it is older than the check) or is not running, the helper runs the same rules on the files and says so. Home shows the summary as one chip that opens the list.

### Daily planner

Today is the default owner view. Read GET `/api/planner` at session start after the shared resume. It returns `{revision,tasks}` without creating any tasks. POST `/api/planner/tasks` with `{revision,title,date,status,focus,step,product,notes,references}` to add; include an existing `id` to edit. Omitted edit fields are preserved. Date is `YYYY-MM-DD` or empty for Someday; statuses are `todo`, `doing`, `blocked`, `done`. Focus is a boolean; references are existing workspace files or HTTP(S) links. Completion timestamps are server-owned. Use the same local Origin/JSON headers as other writes.

**Step and focus (Oct 1).** `step` is optional: one of the seven step ids (`product`, `buyers`, `prove`, `create`, `build`, `launch`, `learn`) or empty; any other value is refused. The old ids (`discovery`, `validation`, `sourcing`, `creative`, `shopify`, `testing`, and the words `find`, `validate`, `source`, `issue`) are still accepted and read as their new step. A day holds at most 3 open focus tasks: flagging a task, or moving a flagged task onto a day that already has 3, is refused with `409 FOCUS_FULL` and a plain message. Finishing a focus task frees its slot. Days saved before the cap keep their flags and stay editable. The rule lives in `src/plannerRules.mjs`, shared by the server and the Today screen. `product` (Oct 1, pipeline) is optional: the card (`L###`) or product (`P###`) the task moves along its line. It must exist (`404 UNKNOWN_PRODUCT` otherwise); a short `P###` is saved as the full `P###-name`; `""` clears it.

**Move (Oct 1).** POST `/api/planner/move` with `{revision,ids,date}` moves 1 to 200 open tasks to one day (`date` `""` is someday) in one revision-checked write. It refuses finished tasks and never changes a status. A flagged task keeps its flag while the new day has room; the rest move without it. The response is the planner plus `moved` and `unflagged` task IDs. Today's "From earlier" buttons and Wrap up the day use it.

Pick a few useful tasks from the authorized work, keep notes and references alongside them, and check them off only after completing that work. Do not manufacture product-check evidence from task status. Read back the saved revision. A conflict must be reconciled against a fresh read, not retried with a newer revision blindly. Reopen a completed task with `status: todo`; moving to Someday clears the date and preserves its content. Tasks are not deleted by the interface. There is no scheduler, background execution or automatic next-day completion. Unfinished earlier dates remain visible as carried forward.

Capture decisions and useful lessons in the existing workspace-notes API; save the shared handoff when the session ends. Reading a source does not establish that its advice worked. For new copy, use `templates/COPY-BRIEF.md`, retain claim sources, then record the actual draft/owner response and later measured outcome. The planner's JSON and canonical memory files are local durable state, not guaranteed model recall.

### Memory: Now, Lessons, Diary (October 1)

The owner chose a simple memory with three parts and one habit. Each part has its own record:
- **Now** is the workspace handoff, projected to `memory/NOW.md`. It is about 250 words and is rewritten, not appended to.
- **Lessons** live in `os/data/lessons.json`, projected to `memory/LESSONS.md`.
- **Diary** is built from workspace notes, task events and lesson events in `memory/days/`.

| Operation | Request / response |
| --- | --- |
| Read lessons | GET `/api/lessons` returns `{revision, lessons, review}`. `review` counts active, proven, trying and proposed lessons, plus use this week, ready-to-prove, not-helping and unused lessons. |
| Save a lesson | POST `/api/lessons` with `{revision, id?, rule, why, scope, status, source, learnedOn, learnedFrom, proposedBy, references, statusNote}`. See the field rules below. |
| Record a use | POST `/api/lessons` with `{revision, id, use: {helped: true\|false, by}}`. The server owns the `uses`, `helped` and `lastUsed` counters. |
| Read a brief | GET `/api/memory/brief?agent=<team id>` (default `manager`) returns `{markdown, words, stepWords, toolWords, step, lessons:{mine, everyone}, tasks, nowWords}`. It opens with the step we are on, then the tools for that step (one line each: name, link, where it opens; the agent's own tools first, at most six), then Now, the agent's active lessons, everyone's active lessons, its open to-dos and the two after-job questions. `memory/START-HERE.md` carries the same tools block and says which tools revision it was built from; a tool save rebuilds it. |

Field rules for a lesson:
- `rule` is at most 200 characters; `why` at most 240.
- `scope` is `everyone`, `manager` or a team agent ID.
- `status` is `proposed`, `trying`, `proven` or `retired`.
- `source` is `owner`, `job`, `review` or `seed`.
- `references` holds up to 6 existing workspace files or links.
- IDs are `LS-###`, assigned by the server.

Rules the server enforces:
- At most 15 active (trying or proven) lessons for everyone, and 10 per other scope. Activating one more returns `LESSON_LIMIT`, so merge or retire first.
- `proven` requires a recorded helpful use, unless the source is `owner` or `seed`.
- Retiring or declining a lesson requires a `statusNote`.
- A use can be recorded only on an active lesson.

Writes regenerate START-HERE, NOW, LESSONS and the day files transactionally.

**The habit for agents:**
- **Before a job:** read the brief.
- **After a job:** write one diary line (a workspace note with `topic` set to the agent ID). Propose a lesson or say "nothing new", and record which lessons were used and whether they helped.

**The manager's part:** accept or decline proposals after each job, add owner corrections immediately, and run the weekly review.

`memory/STATE.md`, the running-log use of `memory/JOURNAL.md`, and the role STATE and LESSONS files are archived history.

### Hubs: what to read before a job (November 5)

The Hubs are the shared library for the owner and the agents, and everything before finding a product. `os.mjs hub` lists the doors, and `os.mjs hub copy` (or `creatives`, `winners`, `research`, `store`, `team`) prints a door's files, pages and best Library entries. It reads the same list as the Hub home, `HUB_DOORS` in `os/src/hubDoors.mjs`, so add a resource there and both show it.

- **After a Gemini Deep Research run:** save the report under `resources/research/<date>-<topic>/` and add it with `os.mjs library add --kind research --topics ... --path <file>`, with "Gemini" in the title or a Gemini source. It then shows on the Trends & Research Hub, newest first.
- **Keywords:** change the tables in [the Keyword Bible](../resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md). The Keywords tab reads them.
- **Diagrams:** save the picture in `resources/diagrams/`. It shows on the Diagrams tab within a minute.
- **Ad references:** the Ad References tab shows `agents/image-generator/references/layouts/` and `resources/copywriting/`.
- **Subagents:** `.claude/agents/<id>.md` and `.claude/skills/<id>/SKILL.md` show on Subagents & Skills. No screen starts them; the chat calls them.

### Library: all our knowledge (October 1)

The Library holds everything we learned, written down so the owner and every agent can find it: research write-ups, methods and skills, guides, examples, templates and notes. Memory keeps the short rules (Lessons); the Library keeps the full knowledge behind them, and a lesson can point to a library file. The owner's input is one plain prompt (LS-062): **Ask us to learn something** and **Write down something we learned** are single text boxes. The server derives titles and topics; the manager or an agent tidies the details later.
- `os/data/library.json` is authoritative (`{revision, entries}`). It is projected to `resources/LIBRARY.md`, grouped by first topic, with the reading list and outdated entries listed separately.
- Notes written from the app or the helper become new files `resources/notes/YYYY-MM-DD-<slug>.md`. They are never overwritten; a clash adds `-2`, `-3`.

| Operation | Request / response |
| --- | --- |
| Read the catalog | GET `/api/library` returns `{revision, entries, counts: {learned, toLearn, byKind, byTopic, byTrust}}`. |
| Save an entry | POST `/api/library` with `{revision, id?, title, learned, kind, topics, trust, status, path, sources, forAgents, lessons, askedBy}`. Without `id` it creates; with `id` it edits and keeps omitted fields. Returns the full catalog. |
| Write a note | POST `/api/library` with `{revision, note: {body}}` and no `path`. A missing title, `learned` or topics come from the body. Sent with the `id` of a reading-list entry, it answers that entry. |
| Search | GET `/api/library/search?q=...` returns up to 30 `{id, title, learned, kind, trust, status, topics, path, score, snippet}`. Title outranks what we learned, which outranks kind and topics, which outrank file text. Each catalogued file (up to 400 KB) is read once and cached until it changes. An empty `q` returns `[]`. When nothing matches exactly, the same list holds up to 5 closest learned entries, each with `closest: true` and `near` (the words that linked it): word stems, the longest beginning of a long word found anywhere, and buyer-situation words (so "grandparent" finds the gift entries). The app and `os.mjs library search` label them "Nothing matched exactly; closest:". |

Field rules:
- `id` is `K-###`, assigned by the server. `createdAt`, `updatedAt`, `learnedOn` (set when an entry becomes learned) and `requestedOn` (set for to-learn) are server-owned, unless an import supplies a real, non-future date.
- `title` is at most 120 characters; on create it defaults to the first sentence of `learned`. `learned` is at most 400 characters: what we learned in plain words, or the question for a to-learn entry.
- `kind` is `research`, `method`, `guide`, `example`, `template` or `note`.
- `trust` is `tested` (we applied it and saw it work), `sourced` (good sources, not tested by us), `idea` (a hypothesis) or `outdated` (kept for history; do not follow).
- `topics` holds 1 to 3 of `product-research`, `buyer-angles`, `copywriting`, `images-ads`, `store`, `sourcing`, `testing`, `operations`, `tools`. A note may have none until it is sorted.
- `status` is `learned` (needs `path`) or `to-learn` (path optional). A learned entry cannot return to the reading list; mark it outdated instead.
- `path` is an existing workspace Markdown file under the document roots, `.claude/skills/<name>/SKILL.md` or `.claude/agents/<name>.md`. Two entries never share a path (`DUPLICATE_PATH`, 409). Only a changed path or a new source is checked for existence, so an entry whose file moved can still be marked outdated.
- `sources` holds up to 6 existing files or links; `forAgents` holds team agent IDs; `lessons` holds `LS-###` IDs; `askedBy` is `owner`, `manager` or an agent ID.
- At most 2,000 entries. A stale revision returns 409. A damaged file returns `MALFORMED_DATA`; agent briefs then show a repair line instead of failing.

Each agent brief has a **From the library (read when relevant)** section: up to six learned, non-outdated entries whose `forAgents` includes that agent, newest first.

**The habit:** search the library before researching from scratch, and write what you learn back. Claude Code uses `.claude/skills/merrivy-os/scripts/os.mjs library search|list|read|add|note|learn|done|set`. Asking to learn creates a to-learn entry plus a planner task (`assignee: agent` with an empty `agent`, so the manager routes it) whose next action names `os.mjs library done K-###`. Finishing the entry does not close the task; the manager checks the result and closes it. A library entry records knowledge. It never passes a product check.
### Tools: every outside tool (October 1)

The owner and Claude open the same links in the same signed-in browser. `os/data/tools.json` is authoritative (`{revision, tools}`) and is projected to `resources/TOOLS.md`, grouped, with retired tools listed separately.

| Operation | Request / response |
| --- | --- |
| Read | GET `/api/tools` returns `{revision, tools, counts: {active, retired, byGroup, byStep, signInNoted}}`. Retired tools are included with `retired: true`. |
| Save one tool | POST `/api/tools` with `{revision, id?, name, group, url, opensIn, steps, agents, purpose, signIn, limits, source, retired, signedInNoted}`. Without `id` it creates, and the ID comes from the name. With an `id` it edits that tool and keeps omitted fields, or creates a new tool with that ID. Returns the catalog plus `saved` (the tool's ID). |

There is no delete: `retired: true` hides a tool.

Field rules:
- Only the fields above. Any other field is refused (`UNKNOWN_FIELD`); a login-like field name (password, token, key, username, email, cookie) is refused as a credential.
- `id` is lowercase words joined by hyphens, at most 60 characters. `name` is at most 80, `purpose` (required) at most 240, `signIn` at most 240 and `limits` at most 300.
- `group` is `research`, `sourcing`, `store`, `ads`, `creative`, `email` or `local`. Left out on create, it is guessed from the link, the words and the step.
- `opensIn` is `chrome` (the browser), `luxury-desktop` (only the Luxury desktop app; the link is the vendor page) or `local` (a localhost link).
- `url` is https, or http only for localhost and 127.0.0.1. No user and password in the link, and no credential query parameters.
- `steps` holds 1 to 7 of the seven step IDs (`product`, `buyers`, `prove`, `create`, `build`, `launch`, `learn`; the old ids still work and are read as their new step). `agents` holds team agent IDs.
- `source` is where the tool was noted: a link or an existing workspace file (never `os/data` or a secrets folder).
- `signedInNoted` is a `YYYY-MM-DD` date, not in the future, or empty. It means the owner noted they are signed in, and stores nothing else.
- A stale revision returns 409. A damaged file returns `MALFORMED_DATA`.

**No credentials (LS-064).** Every text field and the link pass the shared guard in `src/toolsModel.mjs`. These are refused with 400 `SECRET_REFUSED`:
- a value after a secret word (`password: …`, `token=…`, `the password is h4…`);
- known key shapes (`sk-…`, `ghp_…`, `shpat_…`, JWTs, private keys, Bearer tokens);
- long random strings;
- card numbers.

The message is "Don't store passwords here — sign in once in the browser instead." (for card numbers: "Don't store card or bank details here…"). The response never repeats the value. Mentioning a password is fine, for example "never paste the API key in chat".

Claude Code:
- `os.mjs tools [--step ..] [--group ..] [--all]` lists tools; `os.mjs tool <id>` prints one, then navigate the shared browser pane to its link.
- `os.mjs tool <id>` with `--signed-in yes|no`, `--retire`, `--restore` or field flags edits it.
- `os.mjs tools import <file.json>` adds the tools not listed yet.

When a sign-in wall appears, stop and ask the owner to sign in; never type a password. Opening a tool records nothing and proves nothing about a product.

### Assets: the store page, picture by picture (October 1)

The Assets page maps every picture on the Hydrogen store in the order a shopper meets it. Status comes from the saved product packet, `app/content/site.json` (Merrivy's own pictures), any literal page-code pictures (a fallback) and the files on disk, never from where a tile sits.

| Operation | Request / response |
| --- | --- |
| Read | GET `/api/assets[?packet=<id>]` returns `{revision, packets, packet, active, template, pages, sections, brand, ads, notPlaced, removed, counts, siteFile, siteDemo, problems}`. Without `packet` it maps the packet that `app/content/templates.ts` imports (the one in the store). |
| Remove | POST `/api/assets/remove` with `{revision, path, by?, reason?}` moves the file to the bin and returns `{revision, removed}`. |
| Restore | POST `/api/assets/restore` with `{revision, id, by?}` moves it back and returns `{revision, restored}`. |

- Each section has `id`, `number`, `page` (`home`, `product` or `other`), `label`, `help`, `source` (`packet`, `site` or `code`) and `slots`.
- Packet places include Home moments (`home.moments.items[i].image`, after the Home product spotlight) and, under Other pages, the About page product block (`aboutProduct.image`) and Help and policy pages (`helpProduct.image`).
- Site places come from `site.json` and are always in the store: About page · Hero (`aboutHero.image`), Journal page (`journal.image`), Error page (`errorPage.image`) and Store setup screen (`setupScreen.image`). `site.json` is never offered as a product packet, and its pictures never show as Not placed.
- `siteDemo` lists site pictures that still show a picture from the demo packet (`hoodie.json`) while the store's packet is not a sample, mirroring `packet-tools.mjs check`; each also appears in `problems`.
- Literal `<img src="/...">` pictures in the page code still show as `code` sections; one that shares a place with a packet or site section gets its own id ending in `-code` and "(page code)".
- Each slot has `key` (the packet field, such as `purchase.gallery[1]`), `kind`, `src`, `file`, `exists`, `size`, `width`, `height` and `status`:
  - `in-store`: on the store page now;
  - `draft`: in a packet that is not in the store yet;
  - `missing`: points to a file that is not there;
  - `empty`: nothing set yet;
  - `optional`: review photos, real ones only;
  - `online`: loaded from another site, which the app does not open.
- The closing banner repeats gallery picture 1 and is marked `derived`; it is not counted.
- Brand is `store/assets/brand/`. Ads are files in a folder named `ads` inside `products/P###-slug/assets/` (or `store/assets/`). Not placed lists the other production files plus store-folder pictures that no page uses.

**The bin, never a delete.**
- Only files the page lists from `store/assets/` or a product's `assets/` move. They go to `<same root>/_removed/<YYYY-MM-DD>/<original path>`; a second removal of the same name that day uses `<day>-2`.
- `os/data/assets.json` records `{id, originalPath, removedPath, removedAt, by, reason}`, plus `restoredAt` and `restoredBy` after a restore.
- Restore refuses with `ORIGINAL_TAKEN` when another file sits at the original place, and with `BIN_FILE_MISSING` after the owner emptied the folder by hand.
- There is no empty-bin call. Deleting for good is the owner's own action outside the app.

**Store page files are never moved.** A path in `hydrogen-storefront` returns 409 `ON_STORE_PAGE`. The page instead adds one planner task for `store-builder` ("Replace the <section> image", step Build), with the packet field and file in its notes and `store/HYDROGEN-POPULATION.md` as the reference.

Other refusals: `UNSAFE_PATH` (traversal, backslashes, encoded or Windows paths), `NOT_REMOVABLE` (outside those folders), `NOT_LISTED` (not a listed asset, including archived and synthetic products), `ALREADY_IN_BIN`, a stale revision (409 `REVISION_CONFLICT`) and a missing local Origin (403).

Claude Code: `os.mjs assets [--packet <id>] [--needs]` prints the map (read-only). Remove and Restore are the owner's buttons on the page.

### Store editor: the owner's words and pictures (October 2)

The owner, October 2: agents build the layout and do most of the work; the owner fixes small things (a weak line of copy, a picture, the colors) in Launchroom's **Store editor** (`#/store`, sidebar "Store editor", Ctrl K) instead of asking each time. It edits one product packet at a time: `hydrogen-storefront/app/content/<file>.json`. Never `site.json` or `palettes.json`, and never any other file.

| Operation | Request / response |
| --- | --- |
| Read | GET `/api/store-editor[?packet=<file>]` returns `{packets, packet: {file, active, id, status, templateId, productUrl, hash}, preview: {origin, url}, sections, images, colors, history, undo, ownerEdits, publish, problems, revision}`. Without `packet` it opens the one `templates.ts` imports. |
| Save | POST `/api/store-editor/save` with `{packet, hash, changes: [{path, value}], by?: 'owner'|'agent', who?}`. Colors: `{path: 'theme', value: '<palette id>'}`. |
| Undo | POST `/api/store-editor/undo` with `{packet, hash, saveId}` puts one of the last 5 saves back. |
| Publish | POST `/api/store-editor/publish` with `{packet?}` records a publish request. It never deploys. |

- **What it edits.** `sections` come from `src/storeEditorModel.mjs` in page order (top of the page, gallery pictures, the template's sections, Colors, Offer and banners, Other pages) with plain labels ("Headline at the top", "Benefit 2"). Field kinds: `line`, `text`, `image` (pick from `hydrogen-storefront/public/images`; no uploads), `palette` and `fixed` (read-only: price, percent off, thresholds, pack quantities, guarantee days: "ask Claude"). Layout, section order, fonts and anything not listed are refused with `FIELD_NOT_EDITABLE`; a read-only number with `FIELD_READ_ONLY`.
- **Reviews.** Only `kind: "sample"` reviews are editable, marked "Sample (demo only)". A real review is read-only (`REVIEW_NOT_SAMPLE`), and `kind` is never editable, so the editor can never create a genuine review.
- **Colors.** Palettes come from `app/content/palettes.json` (`{groups: [{name, note}], palettes: [...]}`), else `palettes.ts`, grouped by mood with each "good for" note. Clicking one previews it in the phone frame (`postMessage({type: 'launchroom:palette', palette})`, dev server only, `app/lib/launchroom-preview.ts`); "Use this palette" saves the packet's `theme` (its colors and name; other theme keys such as fonts stay). Unknown ids: `PALETTE_NOT_FOUND`.
- **Safe saves.** A save names the file's `hash`; a changed file returns 409 `PACKET_CHANGED` (reload, then save again). Before keeping a save the server runs the store check (`packet-tools.mjs`'s own exported rules, imported, never a command) on the old and new packet. Any new problem returns 422 `PACKET_CHECK` with `details.problems[] = {problem, plain}` (the exact check line and plain words, such as Meta's personal-attributes rule for "you have / you are / you suffer"), and the file is kept byte for byte. Other refusals: `PACKET_NOT_ALLOWED`, `NOTHING_CHANGED`, `IMAGE_NOT_IN_STORE`, `UNDO_STALE` (changed since), `UNDO_TOO_OLD`, `UNDO_DONE`, a missing local Origin (403).
- **History.** `os/data/store-edits.json` keeps every save `{id, at, by, who?, packet, hash, changes: [{path, label, section, before, after}], undoOf?, undoneAt?}` and every publish request. Each owner save also writes one diary line: an owner note with topic `store-edit`, already addressed.
- **Owner edits are kept.** `ownerEdits` lists fields whose latest standing save is the owner's, with `kept` false when the file changed since. They appear in the briefs of the manager, store-builder, copywriter and image-maker ("Owner edits in the store (keep them)") and in `os.mjs store`. **Agents never overwrite an owner edit without asking; build on it.** Agents may save through this API with `by: 'agent'` and `who`.
- **Publish.** The button adds an open owner note (topic `publish`) listing what changed since the last request, and shows "Waiting for Claude to publish" until that note is answered (`PUBLISH_PENDING` meanwhile). `.claude/skills/merrivy-os/scripts/watch-owner.mjs` prints `LAUNCHROOM PUBLISH REQUEST · <note id> · ...`. The manager asks the owner as usual for a deploy, deploys, then answers the note with `PATCH /api/workspace/notes/<id>`.
- **Phone preview.** The page frames `preview.url` (localhost:3001 plus the packet's `productUrl`) at 375 px and reloads it after a save. The store allows framing only on its local dev server (`entry.server.tsx`, `import.meta.env.DEV`); a built store keeps `frame-ancestors 'none'`. When nothing answers on :3001 the page says so plainly. `LAUNCHROOM_STORE_PREVIEW=http://localhost:<port>` points a QA copy at another local store.

Claude Code: `os.mjs store [--packet <file>] [--history]` prints the owner edits to keep, the publish state and the history (read-only).

### Daily memory and portable context

The owner and agents share one planner. Task `assignee` is `owner`, `agent` or `shared`; `nextAction` is the concrete next step. Assignment does not dispatch an agent. Existing task revision and completion rules apply.

**Team agents (September 30).** `agents/team.json` lists the owner-facing team. The manager is the main chat; seven agents each have Claude Code instructions in `.claude/agents/<id>.md`. GET `/api/bootstrap` returns it as `team`:
- `manager`;
- `agents[]` with `id`, `role`, `name`, `summary`, `goodFor`, `delivers`, `never`, `skills`, `guides[{path,exists}]`, `installed` and `missingSkills`;
- `skills[]`, every `SKILL.md` found with its `name`, `description`, `path`, `readable` and `usedBy`.

Reading the team runs nothing.

Hand a task to a team agent by adding `agent` (a team ID such as `scout`) to a planner task. A task with an agent cannot be the owner's task. An empty string clears it. The manager queues such a task from chat (`os.mjs add "..." --agent <id>`, status `todo`); the Agents tab has no form and only shows the work as mission control. The manager dispatches it from chat, then sets it to `doing`, and to `done` or `blocked` after checking the result. Activity reports accept the same optional `agent` with their department `role`. They also accept `reportedBy`, either `codex` (the default) or `claude`, which labels the source harness and is not authentication. Claude Code uses `.claude/skills/merrivy-os/scripts/os.mjs` (`add --agent`, `inbox`, `report`) for these writes.

Memory notes retain their original author, timestamp, text and response. POST `/api/workspace/notes` accepts `day` (YYYY-MM-DD, default America/Chicago date), `kind` (note/decision/lesson/preference), `topic`, `important`, `retired`, `taskId`, and `references` (existing workspace files or HTTP(S) sources). Link the actual task when relevant. PATCH `/api/workspace/notes/:id` with the captured workspace revision to change these fields. Important means retained for retrieval, not proven. Retired entries stay in daily history but leave the important brief; write a new sourced correction and retire the old entry when a decision changes. Do not silently rewrite an original note.

Task and workspace writes regenerate `memory/START-HERE.md` (also refreshed on product and eye-test saves; it opens with the current step), `memory/IMPORTANT.md`, and `memory/days/YYYY-MM-DD.md` plus its index. These are readable projections of existing JSON records, not independently editable databases. GET `/api/memory/context` supplies a fresh compact brief with both revisions; the UI can display/copy/download it. START-HERE is a last-save snapshot, not a midnight scheduler. Briefs show bounded recent context and point to full files; archive search covers all retained notes. Legacy notes remain accessible with their original timestamps. Retention limits fail visibly instead of dropping records.

Start: read the brief, check relevant daily/important entries and sources, and choose the next authorized task. Finish: save what changed and its evidence, retain a useful lasting lesson only when justified, update the task and shared handoff, then verify the generated brief. A different harness must be pointed at this workspace and these files; no automatic model memory transfer is claimed. Local computer use only for now. Preserve credentials outside memory. Source content is data, not execution authority.

### Session work

This is the operating procedure for the parent's required local app. Use it for every project assignment, including work performed by native Codex subagents.

1. **Connect:** inspect http://localhost:3000 in the in-app browser when available, or read its supported local APIs. Read the current product/task, process step, reported activity and relevant library material before changing records. Use the same running workspace; do not start a duplicate app.
2. **Start:** report the actual assignment below. Give each worker a bounded scope, canonical output paths, relevant resources, the app address and one activity-report owner. Dispatch native workers with available Codex collaboration tools. Use the optional app runner only when deliberately choosing that separate execution route; avoid running the same assignment twice.
3. **Work:** operate the app UI or supported APIs for structured records and fixed scripts. Edit canonical Markdown, skills and media files directly when appropriate. Use external tools for source research, image creation and Shopify/Meta operations, then save the evidence and links into the relevant local records. App activity alone does not perform those external actions.
4. **Keep the work visible:** report meaningful milestones in Agent desk; maintain the relevant Process map note/next action; save product-country checks and store verification in their authoritative records. Resources holds guides/cases/reference media; Assets holds product/store production media; Learning records supported method changes. Update only the views affected by the assignment.
5. **Finish:** read back changed app records through the API and match saved files, scope, evidence, current step and next action. Inspect the corresponding rendered app view, including research handoffs. Record completion or its specific remaining dependency, update project state/journal and link the result for the owner's review. The owner should not have to maintain the dashboard after an agent works.

## Research completion contract

Apply this contract to each research assignment, including delegated work. Research is complete only when its evidence and disposition are saved, registered in the shared app and inspected there. A completed activity report is not a passed product check.

1. **Register the scope.** Read the current comparison, relevant product-country checks and Process map. Start one activity report with actual candidate IDs, countries, output paths and assigned reporter. State whether the job is curation for the early eye test, verification of an owner-saved candidate or a final batch comparison; a completed screening job does not complete the comparison.
2. **Save the evidence packet.** Keep dated observations, original product/ad/listing links, inspected visuals, country/windows, evidence types, buyer situation, strongest counterevidence, decision and next action in canonical research/product records. Link the packet from the candidate register. Preserve failed searches, rejected candidates and unknowns. A private Shopify draft is preparation evidence, not qualification or a measured winner.
3. **Check, then register each candidate.** Record the six Product checks (F1-F6, statistics first) from [workflow/CHECKS.md](../workflow/CHECKS.md) and update `research/comparison.json` with its references, `screen` and five deep gates through the [research API](#research-api-and-current-live-route). Every resolved check needs source, date, country and evidence type; resolved deep gates need source, date and window. A newly resolved local source must be an existing regular file; an external URL still requires human/agent inspection. Statistics (F1) come first: a card without them never reaches the owner's eye test. Deep gates follow the Prove it order (CHECKS.md Step 3, since October 3): every one needs a recorded owner Save; P1, the opening (`demand` and `competition`), is recorded first, once the card's `buyers` check passed, with `sourceMatch` (P2) and `contribution` (P4) still pending; `sourcing` (P2) also needs `sourceMatch` supported; `community` and `fit` still need the Product checks, `sourceMatch` and `contribution` supported. Changing the country, buyer situation or exact item after a gate is resolved means reopening the gates first. A new verified product-cycle check additionally requires that market's `researchCandidateId`, matching country and exact identity URL. Unknown stays pending; a failure stops deep work on that lead.
4. **Reconcile the active product.** For a candidate already represented in Products, save exact source links and corresponding product-country checks through supported UI/API. Record passed, pending and failed outcomes truthfully. Product checks use `verified`, `pending` and `blocked`; represent a failed check as blocked with its failed condition in the note and the appropriate market disposition. Include applicable IDs and revisions. A candidate without the active build slot stays in the comparison and does not require another production product.
5. **Verify the handoff.** Read back comparison, activity and affected product records; match IDs, revisions, sources, scope and status to the files. Inspect Process map's comparison and affected Products/Agent desk views in the browser. Record observed readback in the activity/return. If registration, reconciliation or rendered inspection is unfinished, return **partial** with the next action; if an access failure blocks it, use the activity's `blocked` status. Mark activity completed only after assigned reporting and verification finish.

### Comparable review and joint selection

**Execute the assigned stage end to end.** Discovery returns a visual batch labeled CURATED — UNVERIFIED using [CURATION-BATCH](../templates/CURATION-BATCH.md), indexed in [CURATION-QUEUE](../research/CURATION-QUEUE.md). Show it before deep verification; owner Save for checks / Pass for now / Reject is an intentional decision boundary, not a routine navigation question. Record choices from Codex; silence stays unreviewed. Save does not pass any gate. Continue discovery while awaiting review where useful, but do not deepen unselected products merely to fill a review quota. After Save, execute exact-source and preliminary economics, matched Kalodata/community and final Trendtrack checks without routine permission. Dispatch bounded workers with one shared desktop owner; record one supported recovery after access failure and continue unblocked selected leads. The current state controls access scope. A completed curation job is not a completed verification comparison.

Process map's **Actual product cards** reads visuals from the queue's linked `BATCH.md` and exact `L###.md` records. Put actual local images and dated source links in those canonical files, then link the batch in `research/CURATION-QUEUE.md`; the gallery updates from them. `GET /api/curation` returns derived cards when the running server has loaded that route; the existing document APIs provide a fallback. The card's Save/Pass/Reject control writes the owner's reason to the candidate screen in the comparison API. A card view or choice does not pass a check. Read back the decision and keep the linked card's owner-history note synchronized when editing that record.

Build at least **five complete comparable review packets**, aiming for **ten where viable**, before final build selection together with the owner. This minimum does not apply to early curation or prevent the owner from seeing incomplete visual cards. The active build/test slot is separate from this pool. Candidate IDs, quick screens and decisive early rejects do not count as complete reviews. Stop costly work on a decisive failure and replace it with another candidate; do not perform irrelevant checks merely to fill the count. A fully reviewed candidate may have a supported or failed conclusion for every gate, but only an all-supported candidate is eligible for selection. Unknowns keep the packet incomplete. If access or evidence prevents the minimum, report the shortfall and continue useful checks; never invent evidence or silently lower the requirement.

| Gate | Required comparable evidence |
| --- | --- |
| `demand` | Exact matched item, recent trajectory and history, country/window, metric definitions and contributor concentration; distinguish estimates from our sales. |
| `community` | Multiple distinct real-product creators, original demonstrations and substantive buyer participation; identify reused footage and one-person concentration. |
| `competition` | Country-specific Trendtrack coverage, independent operators, exact offers, all-age activity/recent entry, strongest counteroffer and bounded opening; missing coverage stays pending. |
| `sourcing` | Exact functional variant and defining buyer feature, source availability and preliminary destination/delivery feasibility. Final quotes, samples and economics remain separate launch gates. |
| `fit` | Evidence-backed what/who/why/when/where, agent visual assessment, transferable offer, limitations and counterevidence. High numbers alone cannot pass it. |

Deliver the ranked completed comparison once the minimum is met, aiming for ten viable options, or return an honest exhausted-pool/access-blocked outcome with the shortfall and attempted checks. Show observed demand, timing/events and arrival feasibility, conservative delivered contribution with explicit cost assumptions, fit, risks and missing later-stage checks. An event creates a hypothesis until buyer evidence supports it. Record the owner's actual choice and appeal/rejection reasoning. Selection permits scoped creative/store preparation; it does not authorize spending, publication, purchases or supplier/creator contact. Preserve the stopped P001 boots draft/assets as PARK; do not resume production from historical authorization.

### Research API and current live route

`research/comparison.json` is canonical. **Live route verified 2026-09-16:** GET `http://localhost:3000/api/research` returned revision 13 with 16 screened, 0 reviewed and 0 eligible candidates. Prefer the API below; its writes automatically regenerate `research/COMPARISON.md`, which the live UI reads through `/api/doc`. Read the current revision before each write, preserve unrelated candidates and reload after a revision conflict. Live route availability establishes access, not completed research checks.

If the research endpoint becomes unavailable, coordinate one writer for direct canonical edits, preserve unrelated candidates and advance the revision. After every direct canonical write, run `node os/verification/sync-research-view.mjs` from the workspace root. It validates the JSON, takes the workspace lock and atomically regenerates the Markdown projection. Read the generated file/API document and inspect Process map: its **Comparison record revision must equal the canonical revision**. A failed sync or mismatch leaves registration partial. Generated Markdown is a projection; edit the JSON rather than the projection.

| Operation | Request / response |
| --- | --- |
| Read comparison | GET `/api/research` returns `{revision,minimumReviews:5,targetReviews:10,candidates,selectedId,selectionReason,summary:{screened,fastScreened,readyForVerification,reviewed,eligible,remaining,canCompare}}`. |
| Save candidate | PATCH `/api/research` with `{revision,candidate:{id,name,country,buyer,decision,nextAction,references:[...],screen:{ownerDecision,ownerReason,reasonTags,decidedAt,checks},gates:{demand,community,competition,sourcing,fit}}}`. Preserve existing fields and use IDs such as `L011`. **The eye test is the owner's (Oct 3, one tap):** `ownerDecision`, `ownerReason` (optional, may be empty: never fill one in), `reasonTags` (0-2 of `Looks cheap`, `Too saturated`, `Weak numbers`, `Can't dropship`, `Not our niche`, `Too basic`, `Love it`, `Great angle`) and `decidedAt` (stamped by the server) change only from the owner's screen. A write carrying the helper's `x-launchroom-local-agent` header that changes any of them, or drops the screen, is refused with `OWNER_DECISION_ONLY` (403); send them back unchanged (or leave out `ownerReason`, `reasonTags` and `decidedAt` and they are kept). A new Save still needs F1 statistics (`STATS_MISSING`). The scout's brief shows the counts of the owner's chips over the last 20 decisions. A screen check is `{status,note,source,observedAt:"YYYY-MM-DD",country,evidenceType}`. Since October 2 the Product checks are F1-F6 ([workflow/CHECKS.md](../workflow/CHECKS.md)): `provenDemand` (F1 statistics), `dropshippable` (F2), `looksWorth` (F3), `audienceRoom` (F4), `bigIssue` (F5) and `metaGap` (F6), then `sourceMatch` (variant, quantity 1, destination, `listingUrl`) and `contribution` (`costs`) after the owner's Save. Extra fields: `provenDemand` carries `demand: [{metric, value, url, observedAt}]` (metrics `amazon-bought`, `amazon-reviews`, `google-trends`, `kalodata-units`, `tiktok-shop-units`, `other`) and `trend: [{date, value}]` with `trendUrl`, at 2+ points in time showing rising or stable demand (`cardStats(candidate)` in `os/src/researchView.mjs` gives the statistics shape; Meta Ad Library numbers are no longer demand proof). `dropshippable` carries the supplier link and `usShipping: true` and fails on the `hardLimits` in `os/data/rules.json`. `looksWorth` passes only with the exact listing URL (the photos judged) as its source. `bigIssue` carries `ladder: {functional, emotional, life}` and `issues: [slug]`. `metaGap` carries the competitor link and the `gap` (any channel; Meta Ad Library is optional at most). `productWorks` and `noBrand` are kept as Oct 1 history. Step 2 · Buyers saves one more screen check after the owner's Save, `buyers` (A1-A3): `{status, note, source (the buyers write-up, research/<round>/buyers/L###.md), observedAt, country, evidenceType, quotes (how many verified quotes), avatars: [{who, trigger, words?, want?, failed?}], angleGap}`; it passes only with 15+ quotes, 2+ avatars each with a trigger moment and the angle gap. A card without it is pending. `audienceRoom` adds `mainAudience` and `audiences: [{who, problem, why}]` (at most six) and passes only with the main audience and 2+ other complete audiences (3 in all). Cards saved with the older seven ids are moved to these on read. A deep gate is `{status,note,source,observedAt:"YYYY-MM-DD",window}`. Allowed gate/check statuses are `pending`, `supported`, `failed`. |
| Record joint selection | PATCH `/api/research` with `{revision,selectedId,selectionReason}` after the owner's choice. Requires at least five complete reviews and an all-supported selected candidate. Save the owner's actual rationale. |

Use local Origin and JSON headers below. Successful read/write verifies persistence, not the truth of cited sources; the agent must inspect and assess that evidence. P1 (`demand`, `competition`) can be saved on its own once the owner saved the card and its `buyers` check passed; it is refused without the Save, without passed Buyers, or without source, date and window. The completion count requires owner Save, the Product checks plus `sourceMatch` and `contribution` supported, country, buyer and all five deep gates resolved with dated evidence. Legacy partial gates remain readable but cannot advance without the screen. It is not the number of screened leads or activity reports.

### If the app is unavailable

The manager owns recovery. Inspect the listener/process and the startup instructions in [README.md](README.md); start the existing app on port 3000 when it is stopped. On Windows, start a background server with a hidden window. Preserve active app runs and other operators; inspect ownership before restarting, and do not stop an unrelated service occupying the port. If recovery is blocked, continue useful canonical-file work, record the actual access failure and reconcile the app when available. Claim synchronization only after readback. App availability does not require the owner to perform routine startup/navigation.

## Product build packet

Before creative production or an Atlas attempt, follow [ATLAS-HANDOFF.md](../workflow/ATLAS-HANDOFF.md). Store launch exposes seven saved sections: buyer evidence, exact offer, supported copy, ad plan, image brief, page sections and approved assets. Preserve current stop/PARK directions even when historical build authorization exists.

- Read `GET /api/products/:productId/build-packet?marketId=:marketId` for the packet, section definitions, readiness gaps and export contents. A read does not create files.
- Save with `PATCH` to the same route, local Origin/JSON headers and `{revision,marketId,section:{id,content,source,observedAt,status}}`. Fixed section IDs are `buyer`, `offer`, `copy`, `ads`, `images`, `page`, `assets`; status is `draft` or `reviewed`. The `assets` section additionally takes `files: ["products/<productId>/assets/<file>.png", ...]` with the selected final image/video files. Reviewed assets require at least one existing file in that product's Assets folder whose basic media signature matches its extension; wrong-content files return `INVALID_ASSET_CONTENT`. Reviewed input also requires actual content, evidence and a nonfuture date. Content is limited to 12,000 characters per section.
- Bind the exact existing research item with `{revision,marketId,candidateId,bindingSource}`. Known country code/name aliases match; another country or unknown country fails. The source must establish actual item identity. Binding changes demote section reviews.
- Product/research revisions changing withdraw readiness until an agent reviews the new scope and saves `{revision,marketId,revalidate:true}`. Freeze revisions while editing; reconcile conflicts rather than overwriting another writer.
- `briefReady` requires matching supported research, recorded owner selection, current scope and six reviewed preparation sections. `atlasReady` additionally requires the reviewed asset manifest and its listed files. Require `readiness.assetFileChecksSupported === true` in the live GET response before trusting `atlasReady`; an older running server may lack this source change. The frontend holds its Atlas handoff closed in that state. `readiness.invalidAssets` names files that later fail signature checks and closes readiness. These are preparation attestations; source truth, full media render/playback, exact-item fidelity, rights, service checks and preview acceptance still require agent inspection. Local evidence or a listed final file disappearing also withdraws readiness.
- Writes save `products/<productId>/build/<marketId>/packet.json` and generated `ATLAS-RESEARCH.md` / `BUILD-PACKET.md`. GET again before exporting or handing off: saved Markdown is a dated snapshot. The UI also downloads a TXT research copy. Images remain separate files supplied through the observed Atlas/catalog route.

Product checkoffs, candidate gates and owner selection are independent records. Writing a packet does not change them. Prepare buttons open an Agent desk draft; they do not dispatch native agents, upload into Atlas, generate a store, publish or spend. A parked product may retain working notes without qualifying for production.

The workspace can retain a product file after its last market is PARK or rejected. In that state, Process map shows the discovery batch as current and links the preserved product record separately; it does not count that draft's old checks as progress for a new product. Research comparison remains the authority for final build selection. Product-specific creative, Shopify and test assignments open when an active selected product/market exists; reading later playbook steps is always available.

## Shared memory, the build slot and product cycles

Follow [the cycle procedure](../workflow/SINGLE-PRODUCT.md). GET `/api/bootstrap` supplies the current `workspace`, open `products`, read-only `archivedProducts`, `rounds` and `roundsError`; GET `/api/workspace` reads the memory state directly. It includes `revision`, `build` (the owner's build pick), `buildProductId`, `activeProductId` (mirrors the build slot for older readers), `notes`, `handoff` and `reviews`. Since October 1 many products can be open at once (the pipeline); only the build slot is single, and `conflictingProductIds` is always empty.

| Operation | JSON request |
| --- | --- |
| Save a note | POST `/api/workspace/notes` with `{text,author:"owner"|"agent",revision?}` |
| Address/reopen a note | PATCH `/api/workspace/notes/:id` with `{revision,status:"open"|"addressed",response}`; addressed requires a real response |
| Save session handoff | PATCH `/api/workspace/handoff` with `{revision,summary,nextAction,blockers}`; blockers is a string |
| Review and archive a cycle | POST `/api/workspace/review` with `{revision,productRevision,productId,outcome,whatWorked,whatFailed,nextChanges,evidence:[...]}` |

Mutations use the same local Origin/JSON headers as activity reports and return the updated workspace. Capture the workspace revision when beginning an edit and the displayed product revision for a cycle review; on 409, read the newer state and reconcile before retrying. Notes are append-only in original text, with explicit status/response changes. A note records its attributed author; it neither dispatches an agent nor expands the assignment's authority. Preserve Codex as the live conversation channel.

Review outcomes are `stopped`, `inconclusive` or `completed`; these describe the cycle, not profitability. All three reflection fields and 1–20 safe Markdown/HTTP(S) evidence references are required. Archival retains product files, store evidence and the review; current product and production-asset views omit the archived product. Historical product mutations and new assignments are rejected. Complete/stop outstanding work before archiving; keep native worker ownership coordinated by the manager.

Authoritative state is `os/data/workspace.json`; `memory/RESUME.md` is its short generated start-of-task projection and `memory/WORKSPACE.md` its full archive. Confirm the resume revision against GET `/api/workspace`. Use these APIs to edit the handoff and notes, then read back both generated files and the relevant app view. The newest entry in `memory/STATE.md` holds project direction; `memory/JOURNAL.md` preserves lasting decisions and explanations. Update these authoritative homes in the same turn, rather than copying old records into the current handoff. Before marking an assignment complete, record its observed result and next action in the shared handoff; update the assigned role's `memory/STATE.md` or `LESSONS.md` when scope or a tested method changed, then verify readback. Activity reports alone are not durable memory because the feed evicts older reports.

Limits: note text 4,000 characters, response 6,000, each handoff/review text 8,000; 500 notes, 200 reviews and 1.5 MB for workspace memory. Limits fail visibly and preserve prior records; there is no silent note/review eviction. Preserve/export history before extending the format when it reaches its limit.

## Report milestones

1. **Start:** choose a stable ID for the actual task or subagent assignment. POST its real title, registered role, current scope and `running` status. Reuse that ID until the assignment ends.
2. **Progress:** POST the same ID after a meaningful finding, saved artifact, completed check or change of direction. Reference canonical files. Avoid heartbeat noise and repeated unchanged reports.
3. **End:** report `completed` only after the scoped output is saved and verified. Summarize observed evidence and remaining limits. Use `blocked` for a specific unmet dependency, or `failed` when the attempted execution failed. An interrupted conversation alone proves no completion.
4. **Confirm:** read the returned record or GET the feed and match its ID, revision, summary and status. If reporting fails, retain the work in canonical records and report the bridge failure in the Codex handoff; do not claim the app received it.

The manager (Claude in the main chat) reports its own work with `agent: "manager"` and role `manager` (`os.mjs report <id> --agent manager --role manager ...`); the Agents tab shows it under "Claude is working on". A `running` report with no update for 24 hours, or a `blocked` one quiet for 7 days, is shown as stale with its last date and is not counted as work in progress; the saved record is unchanged, so close finished reports with `completed`.

Native subagents may each use a unique assignment ID. A single operator owns updates to each ID. Reporting does not advance product checks, store readiness, publication or campaign spending.

## HTTP contract

Base URL: `http://localhost:3000`. Both `localhost:3000` and `127.0.0.1:3000` are allowed. Mutations require a local `Origin` header and `Content-Type: application/json`.

- **GET `/api/activity`** returns `{activity: [...], retention: {records: 200, eventsPerRecord: 20, maxBytes: 1500000}}`, newest updated report first. An empty feed is valid and does not create a file.
- **POST `/api/activity`** accepts `{id?, revision?, title?, role?, status?, summary?, references?, event?, agent?, product?}`. `product` names the card (`L###`) or product (`P###`) the report is about; it must exist and a short `P###` is saved as the full id. New IDs require `title`, `role`, `status`, and `summary`. Omit `id` only when creating a new report; the API generates an `A-...` ID. Updates retain omitted fields. `event` appends one meaningful event. Exact repeats are no-ops.
- A new report returns **201**, an update **200**, with `{id,title,role,status,summary,references,reportedBy:"codex",startedAt,updatedAt,revision,events:[{at,text}]}`. The API owns timestamps and event history. Optional `revision` must match the stored revision; a new ID can use `0`.

Roles: `manager`, `validation`, `image-generator`, `shopify-builder`. Statuses: `running`, `completed`, `blocked`, `failed`. ID: at most 100 letters/numbers/underscores/hyphens, starting with a letter or number. Title: 180 characters; summary: 2,000; event: 1,000. Requests are limited to 96 KB.

`references` is an array of at most 20 safe workspace-relative paths using `/`. Supported business roots: `agents`, `products`, `store`, `guides`, `research`, `resources`, `memory`, `workflow`, `templates`, `inbox`. Exact root documents `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` and `os/README.md`, `os/AGENTS.md`, `os/AGENT-BRIDGE.md` are also supported. References may name images or other evidence files under those roots; they are not remote URLs. Secret paths, `os/data`, traversal and symlinks are rejected. Keep service URLs in the product's source links or canonical evidence record.

## PowerShell template

Replace the task ID and report text with the actual assignment and observed facts before executing. Reuse `$activityReport.id` and its latest revision for later milestones.

```powershell
$activityHeaders = @{ Origin = 'http://localhost:3000' }
$activityInput = @{
  id = 'codex-your-task-id'
  title = 'Replace with the actual task title'
  role = 'manager'
  status = 'running'
  summary = 'Replace with the work actually started and its scope.'
  references = @('memory/STATE.md')
  event = 'Replace with the observed start milestone.'
}
$activityReport = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/activity' -Headers $activityHeaders `
  -ContentType 'application/json' -Body ($activityInput | ConvertTo-Json -Depth 6)

$activityUpdate = @{
  id = $activityReport.id
  revision = $activityReport.revision
  summary = 'Replace with the next actual finding or saved output.'
  event = 'Replace with its verification evidence and remaining limits.'
}
$activityReport = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/activity' -Headers $activityHeaders `
  -ContentType 'application/json' -Body ($activityUpdate | ConvertTo-Json -Depth 6)

$activityFeed = Invoke-RestMethod -Uri 'http://localhost:3000/api/activity'
$activityFeed.activity | Where-Object id -eq $activityReport.id
```

When work ends, include the appropriate `status` in `$activityUpdate` and refresh its revision. Keep the returned record for subsequent updates.

## Failures and retention

- **400:** missing/invalid fields, unsupported role/status, unsafe reference or supplied event history. Correct the payload; send one `event` string.
- **403:** wrong Host/Origin or cross-site request. Use the running local app and the header above.
- **409:** stale revision. GET the latest record, reconcile the new report with its existing facts, then retry using the current revision.
- **413 / 415:** oversized request / incorrect content type. Keep within the bounds and send JSON.
- **500:** storage or malformed-data failure. Preserve the existing `os/data/activity.json`, inspect the named error and repair/retry through the owning task. A failed request is not evidence of a successful report.
- **Connection refused:** the local app is not running at the endpoint. Starting or restarting it belongs to the task's assigned server operator.

The authoritative feed is `os/data/activity.json`; API writes are serialized and atomic. Prefer this API over direct file edits while the app is running. The feed retains up to 200 recent reports, 20 events per report and 1.5 MB; the oldest reports/events roll off. Canonical product, store and learning records preserve long-term evidence separately.

## Maintain the shared process map

Use the map when a check changes the understood workflow, next action, dependency or evidence location. Update it at the same meaningful milestones as the activity report. The parent manager owns the overall graph; assigned specialists update their scoped nodes or return a proposed change for the manager to merge. Native agent execution remains controlled in Codex.

1. GET `/api/maps`, select the manager-designated map by its saved ID, and retain its current revision and graph. An empty list means no map has been created; create one only within the assigned scope.
2. Preserve stable node IDs across renaming, dragging and status changes. Prefer readable IDs tied to their actual role or check, such as `agent-validation` or `check-exact-source`. Match the existing node before adding another. Preserve unrelated nodes, edges and manual layout.
3. Record the actual finding in the node note and link the canonical document or source. `open` means unfinished; `in-progress` means currently reported work; `needs-review` means review remains; `blocked` names its dependency. `verified` is only a map annotation of a reviewed finding. It does not change any product/store evidence gate or prove a live process, launch or commercial outcome.
4. PATCH with the current revision. Use one-node edits for a scoped finding or position change; use full graph replacement for coordinated layout/topology changes. GET again and match saved IDs, edges, positions and revision before reporting the map updated.
5. On **409**, reload and merge against the newer graph. Never resend an old full graph with only its revision changed; that would erase another agent's work. Report unresolved ownership or evidence conflicts to the manager.

Map requests use the same local JSON headers as the activity example; map mutations require the Origin host to match the request host exactly. Storage is `os/data/maps.json`. The API preserves the graph atomically and never seeds a map on read.

| Operation | Request / response |
| --- | --- |
| Read | GET `/api/maps` → `{maps:[{id,title,revision,createdAt,updatedAt,nodes,edges}]}` |
| Create assigned map | POST `/api/maps` with `{title}` → new empty map, revision `1` |
| Update node | PATCH `/api/maps/:id` with `{revision,node:{id,title,note,x,y,kind,status?,reference?,role?,productId?}}`; new nodes need title, coordinates and kind. Existing IDs preserve omitted fields, so `{revision,node:{id,x,y}}` saves a position. |
| Replace graph | PATCH `/api/maps/:id` with `{revision,nodes:[...],edges:[{from,to},...]}`; both arrays are required. Every node needs its stable ID and complete desired fields. |
| Existing edits | PATCH also accepts `{revision,title}`, `{revision,edge:{from,to}}`, `{revision,removeEdge:{from,to}}` or `{revision,removeNode:id}`. Removing a node removes attached edges. |

Node kinds: `idea`, `question`, `action`, `agent`, `stage`, `evidence`, `decision`. Statuses: `open` (default for older nodes), `in-progress`, `needs-review`, `verified`, `blocked`. Optional `role` uses the four registered roles above. Optional `reference` is a safe local **Markdown** path from the supported document scope, or a credential-free HTTP(S) source URL. Empty `reference` or `role` clears it on a node edit. A reference records location; it does not fetch or validate source claims.

Limits: 50 maps, 100 nodes and 500 directed edges per map; 128 KB per map request. Node IDs: 100 characters; title: 200; note: 10,000; coordinates: finite numbers within ±100,000. Edges connect distinct existing nodes; duplicate node IDs, duplicate edges and missing endpoints are rejected. Full graph replacement cannot be mixed with individual node/edge mutations in the same request. Invalid input leaves the saved graph intact; unsafe linked references return 403, stale revisions return 409, and malformed persisted data returns 500 for repair by the owning task.
