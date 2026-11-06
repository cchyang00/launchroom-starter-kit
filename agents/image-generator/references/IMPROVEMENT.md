# Improve the workflow from evidence

Use the [shared improvement lifecycle](../../manager/references/IMPROVEMENT.md) for change authority, status vocabulary, rollback and next-job reuse. These image-specific checks supplement it. This loop is part of every job under the owner's standing instruction; it updates instructions and references during active work.

1. **Observe:** record the actual failed image/tool result, owner correction or measured successful fix in the job. Include product/asset, skill version, prompt revision and evidence path. Separate aesthetic preference from factual defect and marketing performance.
2. **Diagnose:** identify the smallest likely cause. Distinguish bad input, wrong angle/reference, prompt ambiguity, image-model limitation, tool access and page placement. An outage does not justify changing the product strategy.
3. **Propose locally:** when the evidence supports a useful correction, stage old wording, proposed wording, reason and affected scope in LESSONS. An unexplained failure or service outage can warrant no rule change. Keep proposed edits out of active guidance until checked. Explicit owner preferences apply immediately within their scope; record their performance impact as untested if needed. Preserve source PNGs.
4. **Check:** for an inferred method fix, re-evaluate the failure and one contrasting case so the fix does not become an overbroad rule. Explicit owner directions apply within scope immediately; verify implementation without treating a new experiment as a prerequisite to following that direction. A prompt-only check is labeled simulated; a reviewed rendered result is labeled rendered; a live campaign result needs its experiment evidence. Use available source assets and stay inside the authorized job scope.
5. **Promote or revert:** use the shared statuses proposed, trialed, adopted or reverted with the evidence type. Adopt supported changes in the relevant prompt guidance, concept selection or handoff procedure; update AGENTS only for recurring role behavior. Keep one authoritative instruction. Bump the local skill patch version for an adopted behavior fix; a substantial workflow change merits a minor version. Follow the shared rollback rule: restore compatible prior implementation while preserving current owner instructions. A rejected proposal stays in the lesson without changing active guidance. Historical entries labeled checked retain their original evidence; use the shared vocabulary for new entries.
6. **Handoff:** update local STATE and report reusable findings to the manager for parent integration. A worker edits only its assigned workspace/job; shared accounts, strategy, product truth and authority remain parent-owned.

Capture generation time, correction time, attempts and acceptance when available. Judge speed by time to a usable handoff. Do not generate extra batches just to create evidence. After five completed jobs or a repeated material failure, review lessons for duplicates/stale rules and prune them. There is no requirement to rewrite a working workflow after every job.

## Lesson entry

```text
ID / date / scope / status:
Observation and evidence path:
Diagnosis (including uncertainty):
Prior wording / version:
Change / new version:
Failure-case check:
Contrasting-case check:
Result / time impact / remaining uncertainty:
Adopt, retain as proposal, or revert:
Manager handoff / next check:
```
