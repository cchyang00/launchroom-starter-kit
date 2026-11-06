// Step 0 · the issue list (owner, Oct 3): parsing both gate formats (the new
// "I1 · Real: …" lines, I1-I7 since I6 Wants to buy and I7 Not owned on Meta,
// and the older five lines), status derivation
// (Candidate, Verified, Testing, Parked), the owner-only pick, the round rule,
// the doctor and the brief blocks. Parsers are tested on the real files too
// (LS-088); everything that writes runs in a temporary workspace.
import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs, existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {parseIssue, parseMethodGates, parseIssueListGate, gatesForStep, gateLabel, splitGateLine, olderLineCheck, geminiOnlyIssue, ISSUE_GATE_MIN, ISSUE_CHECKS, ISSUE_LIST_ANCHOR, CHECKS_PATH, BUYERS_ANCHOR} from '../src/issues.mjs';
import {issueStatus, issueEntries, issueCounts, filterIssues, sortIssues, testingHint, issueStation, pickProblem, roundIssueProblem, openChecks, dotsText, scoutIssuesMarkdown, researcherIssuesMarkdown, TESTING_SOFT_LIMIT, VERIFIED_QUIET_DAYS} from '../src/issueList.mjs';
import {headingAnchor} from '../src/documentPaths.mjs';
import {readIssues} from './issues.mjs';
import {updatePicks, validatePicks, emptyPicks} from './issuePicks.mjs';
import {updateRounds, emptyRounds, roundsMarkdown, ISSUE_RULE_FROM} from './rounds.mjs';
import {createApi} from './api.mjs';
import {doctorReport} from './doctor.mjs';
import {launchPanel} from '../src/launchTonight.mjs';
import {roundHeader, issueStationOf, issueGroups} from '../src/pipelineView.mjs';
import {issueRows} from '../src/pipeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const read = relative => fs.readFile(path.join(repo, relative), 'utf8');
const REAL = existsSync(path.join(repo, 'resources/issues')) ? (await fs.readdir(path.join(repo, 'resources/issues'), {withFileTypes: true})).filter(entry => entry.isDirectory() && existsSync(path.join(repo, 'resources/issues', entry.name, 'ISSUE.md'))).map(entry => entry.name) : [];

/** A new-format issue file: `open` lists the I-checks left unticked, `omit` the I-lines left out (a file written before I6 and I7). */
function newIssue(title, {open = [], omit = [], notes = {}, extra = ''} = {}) {
  const lines = ISSUE_CHECKS.filter(check => !omit.includes(check.id)).map(check => `- [${open.includes(check.id) ? ' ' : 'x'}] ${check.id} · ${check.name}: ${check.rule}${notes[check.id] ? `. (${notes[check.id]})` : ''}`);
  return [`# Issue: ${title}`, '', '*Researched 2026-10-03 by buyer-researcher.*', '', extra, '## Gate (I1–I7, all true before the owner can pick this issue to test)', '', ...lines, ''].join('\n');
}
const SEVEN = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'];
const OLDER = {
  // The Oct 1 shape: sleep, low-energy, brain-fog.
  a: ['15+ quotes from 3+ different sites, each dated within the last 24 months. *41 quotes*', '5+ avatars across 3+ life stages.', '5+ physical, never-eaten product types people mention or that fit a moment.', 'What it costs them is backed in at least 2 areas.', 'No usernames copied; quotes are for learning their words, never for fake reviews.'],
  // The Oct 3 set A shape: 10+ quotes and 2-3 product types.
  c: ['10+ quotes from 3+ different sites, each dated within 24 months. (36 quotes, 4 sites)', 'Every quote sorted into the words bank, and all four buckets hold quotes.', '2+ avatars with their moment, what they tried and where they talk.', '2-3 dropshippable product types with exact TikTok Shop and Amazon search terms.', 'No usernames copied; quotes are for learning their words, never for fake reviews.'],
};
const olderIssue = (shape, unchecked = []) => ['# Issue: Older file', '', '## Gate (all must be true before a round uses this issue)', '', ...OLDER[shape].map((line, index) => `- [${unchecked.includes(index) ? ' ' : 'x'}] ${line}`), ''].join('\n');
const states = issue => issue.checks.map(check => check.state);

test('the real issue files parse: a title, seven I-checks, quotes and sites; an older gate or a file without I6/I7 never reads Verified', {skip: !REAL.length}, async () => {
  for (const slug of REAL) {
    const issue = parseIssue(await read(`resources/issues/${slug}/ISSUE.md`), slug);
    assert.ok(issue.title.length > 5 && !issue.title.startsWith('Issue:'), slug);
    assert.equal(issue.path, `resources/issues/${slug}/ISSUE.md`);
    assert.deepEqual(issue.checks.map(check => check.id), SEVEN, slug);
    assert.ok(issue.checks.every(check => ['passed', 'partly', 'open'].includes(check.state)), slug);
    assert.equal(issue.verified, issue.checks.every(check => check.state === 'passed'), slug);
    assert.equal(issue.gatePassed, issue.verified);
    assert.ok(issue.gate.items.every(item => item.label && !/[*[\]]/.test(item.label)), `${slug}: plain labels`);
    // The older five lines never asked for Gemini's claims to be cross-referenced or the condition check (I5).
    if (issue.gate.format === 'older') assert.notEqual(issue.checks[4].state, 'passed', `${slug}: I5 needs the new line`);
    // I6 and I7 (owner, Oct 3): a file without their lines keeps them open, so it is a Candidate, honestly.
    for (const id of ['I6', 'I7']) {
      if (issue.gate.items.some(item => item.id === id)) continue;
      const check = issue.checks.find(item => item.id === id);
      assert.deepEqual([check.state, check.from], ['open', 'none'], `${slug}: ${id} has no line yet`);
      assert.equal(issue.verified, false, `${slug}: not Verified without ${id}`);
    }
    if (issue.quotes !== null) assert.ok(issue.quotes >= 1 && issue.sites >= 1, slug);
  }
  if (REAL.includes('sleep')) {
    const sleep = parseIssue(await read('resources/issues/sleep/ISSUE.md'), 'sleep');
    assert.equal(sleep.title, '"I can\'t sleep" (sleep that doesn\'t work)');
    // Rewritten as I-lines on Oct 3 (the older five lines read the same rule without the "I1 · Real:" mark).
    assert.match(sleep.gate.items[0].label, /^(?:I1 · Real: )?15\+ (?:verbatim )?quotes from 3\+ different sites, each dated within the last 24 months/);
    assert.equal(sleep.checks[0].state, 'passed');
    // Until its file has I6 and I7 lines ticked, sleep is a Candidate (owner, Oct 3: complaints alone are not buying).
    assert.equal(sleep.verified, ['I6', 'I7'].every(id => sleep.gate.items.some(item => item.id === id && item.checked)) && sleep.checks.slice(0, 5).every(check => check.state === 'passed'));
    assert.ok(sleep.quotes >= 40 && sleep.sites >= 3, `${sleep.quotes} quotes, ${sleep.sites} sites`);
    assert.ok(sleep.productTypes.length >= 3);
  }
});

test('the template has the seven I-lines, all open, and is a stub', async () => {
  const template = parseIssue(await read('templates/ISSUE.md'), 'template');
  assert.equal(template.gate.total, ISSUE_GATE_MIN);
  assert.equal(ISSUE_GATE_MIN, 7);
  assert.equal(template.gate.format, 'i1-i7');
  assert.deepEqual(template.checks.map(check => [check.id, check.name, check.state]), [['I1', 'Real', 'open'], ['I2', 'Deep', 'open'], ['I3', 'Distinct avatars', 'open'], ['I4', 'Product-shaped', 'open'], ['I5', 'Clean', 'open'], ['I6', 'Wants to buy', 'open'], ['I7', 'Not owned on Meta', 'open']]);
  // The template's own words name each check: the name before its colon is read as the name, never left in the rule.
  assert.ok(template.gate.items.every(item => !item.rule.startsWith(item.name)), 'template names match ISSUE_CHECKS');
  assert.match(template.gate.items[5].rule, /^5\+ verbatim buying-intent quotes/);
  assert.match(template.gate.items[6].rule, /^Meta Ad Library \(US, active\)/);
  assert.equal(template.verified, false);
  assert.equal(template.stub, true);
  assert.equal(template.title, 'Template', 'the placeholder title reads as the folder name');
  assert.equal(gateLabel(template), 'I1–I7 0/7');
});

test('parseIssue, new lines: all seven ticked is Verified; notes, bold ids and missing lines', () => {
  const all = parseIssue(newIssue('"my hands ache after a quilt session"', {notes: {I1: '29 quotes, 4 sites'}}), 'quilters');
  assert.equal(all.verified, true); assert.equal(gateLabel(all), 'I1–I7 7/7 ✓');
  assert.deepEqual(states(all), Array(7).fill('passed'));
  assert.equal(all.checks[0].note, '29 quotes, 4 sites');
  assert.equal(all.gate.items[0].label, 'I1 · Real: 15+ verbatim quotes from 3+ sites, dated within 24 months, each with its link');
  const one = parseIssue(newIssue('One open', {open: ['I2']}), 'one');
  assert.deepEqual(states(one), ['passed', 'open', 'passed', 'passed', 'passed', 'passed', 'passed']);
  assert.equal(one.verified, false);
  const bold = parseIssue(['# Issue: Bold', '', '## Gate', '', '- [x] **I1 · Real:** 17 quotes', '- [x] I2 · Deep: yes', '- [ ] I3 · Distinct avatars: one', ''].join('\n'), 'bold');
  assert.deepEqual(states(bold), ['passed', 'passed', 'open', 'open', 'open', 'open', 'open']);
  assert.equal(bold.checks[3].note, 'Not in the file\'s gate yet.');
  assert.equal(bold.checks[0].name, 'Real');
  assert.equal(parseIssue('# Dogs\n\nNo gate here.', 'dogs').checks.every(check => check.state === 'open' && check.note === 'No gate in the file yet.'), true);
});

test('I6 and I7 (owner, Oct 3): I1-I5 ticked with no I6/I7 lines is a Candidate; hand-written lines are read in any common format, anywhere in the Gate', () => {
  // A file written before Oct 3: everything it asked passes, and it is still a Candidate with I6 and I7 open.
  const five = parseIssue(newIssue('Five lines', {omit: ['I6', 'I7']}), 'five-lines');
  assert.equal(five.gate.format, 'i1-i7');
  assert.deepEqual(states(five), ['passed', 'passed', 'passed', 'passed', 'passed', 'open', 'open']);
  assert.deepEqual(five.checks.slice(5).map(check => [check.id, check.name, check.note, check.from]), [['I6', 'Wants to buy', 'Not in the file\'s gate yet.', 'none'], ['I7', 'Not owned on Meta', 'Not in the file\'s gate yet.', 'none']]);
  assert.equal(five.verified, false);
  assert.equal(gateLabel(five), 'I1–I7 5/7');
  const entry = issueEntries([five], {picks: emptyPicks()})[0];
  assert.equal(entry.status, 'candidate');
  assert.deepEqual(openChecks(entry).map(check => check.id), ['I6', 'I7']);
  assert.equal(dotsText(entry), 'I1✓ I2✓ I3✓ I4✓ I5✓ I6· I7·');
  // Tolerant: the formats agents type by hand, in any order, in a sub-heading of the Gate section.
  const base = ISSUE_CHECKS.slice(0, 5).map(check => `- [x] ${check.id} · ${check.name}: ${check.rule}`);
  const variants = [
    ['- [x] I6 · Wants to buy: 7 intent quotes in the words bank', '- [x] I7 · Not owned on Meta: 1 advertiser with 30+ day ads'],
    ['- [x] **I6** · Wants to buy: 7 intent quotes', '- [x] **I7 · Not owned on Meta:** 1 advertiser'],
    ['- [x] I6: 7 intent quotes', '- [x] I7: 1 advertiser'],
    ['- [x] I6 - Wants to buy - 7 quotes', '- [x] I7 – Not owned on Meta – 1 advertiser'],
    ['- [x]   **I6**   ·   Wants to buy:  7 quotes', '* [x] I7 — Not owned on Meta: 1 advertiser'],
    ['1. [x] i6. Wants to buy: 7 quotes', '2. [x] I7 Not owned on Meta: 1 advertiser'],
  ];
  for (const [i6, i7] of variants) {
    const parsed = parseIssue(['# Issue: Tolerant', '', '## Gate (I1–I7)', '', i7, ...base, '', '### Added by hand', '', i6, ''].join('\n'), 'tolerant');
    assert.deepEqual(states(parsed), Array(7).fill('passed'), `${i6} | ${i7}`);
    assert.equal(parsed.verified, true, `${i6} | ${i7}`);
    assert.deepEqual(parsed.checks.map(check => check.name), ISSUE_CHECKS.map(check => check.name));
  }
  // Words before a colon that are not the check's name stay in the rule; an unticked line is open.
  const worded = parseIssue(['# Issue: Worded', '', '## Gate', '', ...base, '- [ ] I7: Meta Ad Library: 4 advertisers with 30+ day ads', ''].join('\n'), 'worded');
  assert.deepEqual([worded.checks[6].name, worded.checks[6].state, worded.gate.items.at(-1).rule], ['Not owned on Meta', 'open', 'Meta Ad Library: 4 advertisers with 30+ day ads']);
  // A line outside the Gate section does not count; a check written twice passes only when every copy is ticked.
  const outside = parseIssue(['# Issue: Outside', '', '## 8. Words bank', '', '- [x] I6 · Wants to buy: tagged here', '', '## Gate', '', ...base, '- [x] I7 · Not owned on Meta: 2 advertisers', '- [x] I6 · Wants to buy: 6 quotes', '- [ ] I6 · Wants to buy: recount after the cross-check', ''].join('\n'), 'outside');
  assert.deepEqual(states(outside).slice(5), ['open', 'passed']);
  assert.equal(outside.checks[5].note, '');
  const outsideOnly = parseIssue(['# Issue: Outside only', '', '## 8. Words bank', '', '- [x] I6 · Wants to buy: tagged here', '', '## Gate', '', ...base, ''].join('\n'), 'outside-only');
  assert.equal(outsideOnly.checks[5].from, 'none');
  // An older file with I6 and I7 added by hand: the older lines still count only as far as they asked, so it is not Verified.
  const mixed = parseIssue(`${olderIssue('a')}- [x] I6 · Wants to buy: 6 intent quotes\n- [x] I7 · Not owned on Meta: 2 advertisers\n`, 'mixed');
  assert.equal(mixed.gate.format, 'mixed');
  assert.deepEqual(states(mixed), ['passed', 'partly', 'passed', 'passed', 'partly', 'passed', 'passed']);
  assert.equal(mixed.verified, false);
});

test('parseIssue, older lines: each maps to the I-check it covers and asks less, so it is never Verified', () => {
  const a = parseIssue(olderIssue('a'), 'a');
  assert.equal(a.gate.format, 'older');
  assert.deepEqual(states(a), ['passed', 'partly', 'passed', 'passed', 'partly', 'open', 'open']);
  assert.match(a.checks[1].note, /older gate, which asked less\. Still owed: a moment that keeps coming back/);
  assert.equal(a.checks[0].note, '41 quotes');
  assert.deepEqual(a.checks.slice(5).map(check => [check.note, check.from]), [['The older gate did not ask this.', 'none'], ['The older gate did not ask this.', 'none']]);
  const c = parseIssue(olderIssue('c'), 'c');
  assert.deepEqual(states(c), ['partly', 'open', 'passed', 'partly', 'partly', 'open', 'open']);
  assert.equal(c.checks[1].note, 'The older gate did not ask this.');
  const unticked = parseIssue(olderIssue('c', [0]), 'c');
  assert.equal(unticked.checks[0].state, 'open');
  assert.equal(a.verified || c.verified, false);
  assert.deepEqual(['15+ quotes from 3+ sites', 'Every quote sorted into the words bank', 'nothing here'].map(line => olderLineCheck(line)?.id || ''), ['I1', 'I5', '']);
  assert.deepEqual(splitGateLine('No usernames copied; quotes are for learning.'), {label: 'No usernames copied; quotes are for learning', note: ''});
});

test('parseIssue reads the avatar group, quotes and sites, product types, TikTok terms and what they tried', () => {
  const extra = ['**Group:** long-hours crafters who feel the hours in their hands. Cross-stitchers are thin.', '', '## 5. What they\'ve tried', '', '| Kind of fix | How often | Physical? | What people say |', '| --- | --- | --- | --- |', '| Ergonomic hooks (Clover) | Many | Yes | Crowded aisle |', '',
    '## 6. Product opportunities', '', '| # | Product type | Avatars | Search terms: TikTok Shop | What fails them today |', '| --- | --- | --- | --- | --- |', '| P1 | **Tilt platform** (ABS) | B | `sewing machine tilt`; `quilt riser` | Wedges slip |', '| P2 | **Lap pillow** | A | lap pillow crochet; arm rest pillow | Gaming pillows only |', '| 3 | Fallback (crowded): gloves | A | gloves | — |', '',
    '## 9. Sources', '', '| # | Quote | Site | Link | Date |', '| --- | --- | --- | --- | --- |', '| 1 | "a" | Rokslide, post #1 | x | 2025 |', '| 2 | "b" | Rokslide, post #4 | x | 2025 |', '| S3 | "c" | KnittingHelp (forum) | x | 2025 |', '| 4 | "d" | n/a | x | 2025 |', '| note | not a quote | x | x | x |', ''].join('\n');
  const issue = parseIssue(newIssue('Crafters', {extra}), 'crafters');
  assert.equal(issue.group, 'long-hours crafters who feel the hours in their hands');
  assert.deepEqual([issue.quotes, issue.sites, issue.siteNames], [4, 2, ['Rokslide', 'KnittingHelp']]);
  assert.deepEqual(issue.productTypes, ['Tilt platform', 'Lap pillow']);
  assert.deepEqual(issue.searchTerms, ['sewing machine tilt', 'quilt riser', 'lap pillow crochet', 'arm rest pillow']);
  assert.deepEqual(issue.failing, ['Tilt platform: Wedges slip', 'Lap pillow: Gaming pillows only']);
  assert.deepEqual(issue.tried, [{fix: 'Ergonomic hooks', says: 'Crowded aisle'}]);
  assert.equal(issue.stub, false);
  // A bold numbered list instead of a table still gives product types and the TikTok terms.
  const list = parseIssue(['# Issue: Crew', '', '## 6. Product opportunities', '', '**Honest first line:** crowded.', '', '**1. Layover day-sleep kit** (door hanger).', "- TikTok Shop: 'portable blackout curtain travel'. Amazon: 'other'.", '2. **Lumbar roll with a strap**', ''].join('\n'), 'crew');
  assert.deepEqual([list.productTypes, list.searchTerms], [['Layover day-sleep kit', 'Lumbar roll with a strap'], ['portable blackout curtain travel']]);
});

test('status: Candidate, Verified, Testing, Parked from the files and the owner\'s picks only', () => {
  const verified = parseIssue(newIssue('Verified one'), 'verified-one');
  const candidate = parseIssue(newIssue('Candidate one', {open: ['I1', 'I5']}), 'candidate-one');
  const picked = parseIssue(newIssue('Picked one'), 'picked-one');
  const parked = parseIssue(newIssue('Parked one'), 'parked-one');
  const reopened = parseIssue(newIssue('Reopened one', {open: ['I3']}), 'reopened-one');
  const picks = {revision: 4, picks: {'picked-one': {pick: 'testing', at: '2026-10-03T12:00:00.000Z'}, 'parked-one': {pick: 'parked', at: '2026-10-03T12:00:00.000Z'}, 'reopened-one': {pick: 'testing', at: '2026-10-02T12:00:00.000Z'}}};
  const rounds = [{id: 'R10', number: 10, startedOn: '2026-10-03', issue: 'picked-one', focus: 'x', folders: ['research/x/']}];
  const entries = issueEntries([verified, candidate, picked, parked, reopened], {rounds, picks});
  assert.deepEqual(entries.map(entry => [entry.slug, entry.status]), [['verified-one', 'verified'], ['candidate-one', 'candidate'], ['picked-one', 'testing'], ['parked-one', 'parked'], ['reopened-one', 'testing']]);
  assert.equal(issueStatus(candidate, {pick: 'nonsense'}), 'candidate');
  assert.deepEqual(entries.find(entry => entry.slug === 'picked-one').rounds, [{id: 'R10', number: 10, open: true, startedOn: '2026-10-03'}]);
  assert.equal(entries.find(entry => entry.slug === 'picked-one').openRound, true);
  assert.equal(entries.find(entry => entry.slug === 'reopened-one').reopened, true, 'a picked issue whose gate reopened keeps the pick, flagged');
  assert.deepEqual(issueCounts(entries), {testing: 2, verified: 1, candidate: 1, parked: 1, total: 5});
  assert.deepEqual(sortIssues(entries).map(entry => entry.status), ['testing', 'testing', 'verified', 'candidate', 'parked']);
  assert.deepEqual(filterIssues(entries, {status: 'candidate'}).map(entry => entry.slug), ['candidate-one']);
  assert.deepEqual(filterIssues(entries, {query: 'parked ONE'}).map(entry => entry.slug), ['parked-one']);
  assert.deepEqual(openChecks(candidate).map(check => check.id), ['I1', 'I5']);
  assert.equal(dotsText(candidate), 'I1· I2✓ I3✓ I4✓ I5· I6✓ I7✓');
  // "A couple at a time": a soft hint above TESTING_SOFT_LIMIT, never a block.
  assert.equal(testingHint(entries), '');
  const many = Array.from({length: TESTING_SOFT_LIMIT + 1}, (_, i) => ({...verified, slug: `t${i}`, status: 'testing'}));
  assert.match(testingHint(many), /^4 issues are Testing\. The method says a couple at a time/);
  // Step 0 at a glance; the owner's move is a pick while nothing is tested.
  assert.deepEqual(issueStation(entries), {id: 'issues', number: 0, name: 'Issues', count: 5, testing: 2, verified: 1, candidate: 1, parked: 1, owner: false, label: '2 testing', testingSlugs: ['picked-one', 'reopened-one'], text: '5 · 2 testing'});
  const waiting = issueStation(issueEntries([verified, candidate], {picks: emptyPicks()}));
  assert.deepEqual([waiting.owner, waiting.label, waiting.text], [true, '1 to pick', '2 · 1 to pick']);
  assert.equal(issueStation([]).text, 'no issues yet');
  // The pipeline rows keep the saved status; an older server's five-line gate never reads Verified.
  const rows = issueRows([{slug: 'old', title: 'Old', gatePassed: true, gate: {done: 5, total: 5}}, ...entries]);
  assert.equal(rows.find(row => row.slug === 'old').status, 'candidate');
  assert.deepEqual(rows.slice(0, 2).map(row => row.status), ['testing', 'testing']);
  assert.equal(issueStationOf({issues: rows}).testing, 2);
});

test('the owner\'s pick: agents refused, a Candidate cannot be picked, Undo restores, revisions checked', () => {
  const entries = issueEntries([parseIssue(newIssue('V'), 'v'), parseIssue(newIssue('C', {open: ['I4']}), 'c')], {picks: emptyPicks()});
  const at = new Date('2026-10-03T15:00:00Z');
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: 'v', pick: 'testing'}, {entries, agent: true}), e => e.code === 'OWNER_DECISION_ONLY' && e.status === 403);
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: 'c', pick: 'testing'}, {entries}), e => e.code === 'ISSUE_NOT_VERIFIED' && e.status === 409 && e.details.open.join() === 'I4' && /I4 Product-shaped still open/.test(e.message));
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: 'c', pick: 'parked'}, {entries}), e => e.code === 'ISSUE_NOT_VERIFIED');
  // I1-I5 and I7 ticked, no I6 line (owner, Oct 3: complaining is not wanting to buy): still a Candidate, so it cannot be tested.
  const noI6 = issueEntries([parseIssue(newIssue('No I6', {omit: ['I6']}), 'no-i6')], {picks: emptyPicks()});
  assert.equal(noI6[0].status, 'candidate');
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: 'no-i6', pick: 'testing'}, {entries: noI6}), e => e.code === 'ISSUE_NOT_VERIFIED' && e.status === 409 && e.details.open.join() === 'I6' && /no-i6 is a Candidate: I6 Wants to buy still open\. Only a Verified issue \(all of I1-I7\) can be tested\./.test(e.message));
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: 'ghost', pick: 'testing'}, {entries}), e => e.code === 'ISSUE_MISSING' && e.status === 404);
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: '../x', pick: 'testing'}, {entries}), e => e.code === 'ISSUE_MISSING');
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: 'v', pick: 'maybe'}, {entries}), /Pick "testing" or "parked"/);
  assert.throws(() => updatePicks(emptyPicks(), {revision: 0, slug: 'v', pick: null}, {entries}), /Only Undo clears a pick/);
  assert.throws(() => updatePicks(emptyPicks(), {revision: 3, slug: 'v', pick: 'testing'}, {entries}), e => e.code === 'REVISION_CONFLICT');
  // No typed reason: one tap saves.
  const tested = updatePicks(emptyPicks(), {revision: 0, slug: 'v', pick: 'testing'}, {entries, now: at});
  assert.deepEqual([tested.picks.revision, tested.picks.picks.v, tested.saved], [1, {pick: 'testing', at: '2026-10-03T15:00:00.000Z'}, {slug: 'v', pick: 'testing', before: null, undo: false}]);
  const after = issueEntries([parseIssue(newIssue('V'), 'v')], {picks: tested.picks});
  assert.throws(() => updatePicks(tested.picks, {revision: 1, slug: 'v', pick: 'testing'}, {entries: after}), e => e.code === 'ISSUE_PICK_SAME');
  const parked = updatePicks(tested.picks, {revision: 1, slug: 'v', pick: 'parked'}, {entries: after, now: at});
  assert.equal(parked.saved.before, 'testing');
  // Undo within 5 seconds puts the earlier pick back (or none at all).
  const back = updatePicks(parked.picks, {revision: 2, slug: 'v', pick: 'testing', undo: true}, {entries: after, now: at});
  assert.deepEqual(back.picks.picks.v, {pick: 'testing', at: '2026-10-03T15:00:00.000Z', undone: true});
  const cleared = updatePicks(tested.picks, {revision: 1, slug: 'v', pick: null, undo: true}, {entries: after});
  assert.deepEqual(cleared.picks, {revision: 2, picks: {}});
  assert.throws(() => validatePicks({revision: 1, picks: {v: {pick: 'maybe', at: 'x'}}}), e => e.code === 'MALFORMED_DATA');
  assert.throws(() => validatePicks({revision: -1, picks: {}}), e => e.code === 'MALFORMED_DATA');
  assert.equal(pickProblem(after[0], 'parked'), null);
});

test('CHECKS.md: the seven steps keep their "## Step" gates; the issue list is step 0 with I1-I7', async () => {
  const text = await read(CHECKS_PATH);
  const method = parseMethodGates(text);
  assert.deepEqual(method.map(section => section.id), ['1', '2', '3', '4', '5', '6', '7']);
  assert.deepEqual(method.map(section => section.name), ['Product', 'Buyers', 'Prove it', 'Create', 'Build', 'Launch', 'Learn']);
  for (const section of method) {
    assert.ok(section.items.length >= 3, `${section.id} has its gate lines`);
    assert.equal(section.anchor, headingAnchor(section.heading), 'the document reader heading id');
    assert.ok(section.items.every(item => !/\*\*|\[|\]\(/.test(`${item.label} ${item.text}`)), `${section.id}: plain text`);
  }
  const [product, buyers, prove, create, build, launch, learn] = method;
  assert.equal(product.anchor, 'step-1--product-where-the-sales-numbers-are-hitting');
  assert.equal(buyers.anchor, BUYERS_ANCHOR);
  assert.deepEqual(buyers.items.map(item => [item.id, item.label]), [['A1', 'About 15 verified quotes'], ['A2', 'Two or more avatars'], ['A3', 'An angle nobody uses']]);
  assert.ok(!method.some(section => /issue/i.test(section.name)), 'the issue list is not a "## Step" heading');
  assert.equal(product.fromTable, true);
  assert.deepEqual(product.items.map(item => item.id), ['F1', 'F2', 'F3', 'F4', 'F5', 'F6']);
  assert.deepEqual(prove.items.map(item => [item.id, item.label]), [['P1', 'Room on Meta'], ['P2', 'Same item, safe to sell'], ['P3', 'Delivery promise'], ['P4', 'The money line'], ['P5', 'Claims we can back, with no sample']]);
  assert.deepEqual(create.items.map(item => item.id), ['C1', 'C2', 'C3', 'C4']);
  assert.equal(build.items[0].label, 'The first phone screen holds it all'); assert.ok(build.items[0].children.length >= 5, 'nested bullets');
  assert.deepEqual(launch.items.map(item => item.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(learn.items.map(item => item.id), ['R1', 'R2', 'R3']);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(index => gatesForStep(method, index).map(section => section.id)), [['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7']]);
  // Step 0: the method's own words for I1-I7, matching the template's names.
  const list = parseIssueListGate(text);
  assert.equal(list.anchor, ISSUE_LIST_ANCHOR);
  assert.equal(ISSUE_LIST_ANCHOR, 'the-issue-list-the-hard-part-done-first');
  assert.equal(list.items.length, 7);
  assert.deepEqual(list.items.map(item => [item.id, item.label]), ISSUE_CHECKS.map(check => [check.id, check.name]));
  assert.match(list.items[0].text, /^15\+ verbatim quotes from 3\+ sites/);
  assert.match(list.items[5].text, /5\+ verbatim quotes showing buying intent/);
  assert.match(list.items[6].text, /fewer than 3 advertisers already running 30\+ day ads/);
  assert.ok(list.items.every(item => !/\*\*/.test(`${item.label} ${item.text}`)), 'plain text');
});

test('rounds: a named issue must be Testing (ISSUE_GATE_OPEN, ISSUE_NOT_PICKED, ISSUE_PARKED); a focus alone works; imports need the issue to exist', () => {
  const day = new Date('2026-10-03T15:00:00Z');
  const picks = {revision: 2, picks: {sleep: {pick: 'testing', at: '2026-10-03T12:00:00.000Z'}, old: {pick: 'parked', at: '2026-10-03T12:00:00.000Z'}}};
  const issues = issueEntries([parseIssue(newIssue('Sleep'), 'sleep'), parseIssue(newIssue('Pets', {open: ['I2']}), 'pets'), parseIssue(newIssue('Ready'), 'ready'), parseIssue(newIssue('Old'), 'old')], {picks});
  const start = extra => ({revision: 0, action: 'start', focus: 'Sleep products', folders: ['research/2026-10-03-sleep/'], ...extra});
  assert.equal(updateRounds(emptyRounds(), start({}), {now: day, issues}).saved.issue || '', '', 'a focus alone still starts a round');
  assert.throws(() => updateRounds(emptyRounds(), start({issue: 'ghosts'}), {now: day, issues}), e => e.code === 'ISSUE_MISSING' && e.status === 400 && /resources\/issues\/ghosts\/ISSUE\.md/.test(e.message));
  assert.throws(() => updateRounds(emptyRounds(), start({issue: '../x'}), {now: day, issues}), e => e.code === 'ISSUE_MISSING');
  assert.throws(() => updateRounds(emptyRounds(), start({issue: 'pets'}), {now: day, issues}), e => e.code === 'ISSUE_GATE_OPEN' && e.status === 409 && e.details.issue === 'pets' && /pets is a Candidate: I2 Deep still open \(I1✓ I2· I3✓ I4✓ I5✓ I6✓ I7✓\)/.test(e.message));
  assert.throws(() => updateRounds(emptyRounds(), start({issue: 'ready'}), {now: day, issues}), e => e.code === 'ISSUE_NOT_PICKED' && e.status === 409 && /Verified, but the owner has not picked it to test/.test(e.message));
  assert.throws(() => updateRounds(emptyRounds(), start({issue: 'old'}), {now: day, issues}), e => e.code === 'ISSUE_PARKED' && /set old aside/.test(e.message));
  const {rounds, saved} = updateRounds(emptyRounds(), start({issue: 'Sleep'}), {now: day, issues});
  assert.deepEqual([saved.id, saved.issue, rounds.revision], ['R01', 'sleep', 1]);
  assert.match(roundsMarkdown(rounds), /## R01 · Round 1 · started 2026-10-03\n\nSleep products\n\nIssue: sleep \(resources\/issues\/sleep\/ISSUE\.md\)/);
  assert.match(roundsMarkdown(rounds), /from an issue the owner is Testing with `os\.mjs round start --issue <slug>/);
  // Linking an issue to an open round follows the same rule.
  const plain = updateRounds(emptyRounds(), start({}), {now: day, issues}).rounds;
  assert.throws(() => updateRounds(plain, {revision: 1, action: 'focus', id: 'R01', issue: 'ready'}, {now: day, issues}), e => e.code === 'ISSUE_NOT_PICKED');
  assert.equal(updateRounds(plain, {revision: 1, action: 'focus', id: 'R01', issue: 'sleep'}, {now: day, issues}).saved.issue, 'sleep');
  // History: an imported round needs only its issue to exist.
  const history = {number: 5, startedOn: '2026-10-01', focus: 'Old open round', folders: ['research/2026-10-01-r5/'], issue: 'pets'};
  assert.deepEqual(updateRounds(rounds, {revision: 1, action: 'import', rounds: [history]}, {now: day, issues}).imported, ['R05']);
  assert.throws(() => updateRounds(rounds, {revision: 1, action: 'import', rounds: [{...history, issue: 'ghosts'}]}, {now: day, issues}), e => e.code === 'ISSUE_MISSING');
  assert.equal(ISSUE_RULE_FROM, '2026-10-02');
  assert.equal(roundIssueProblem(issues.find(entry => entry.slug === 'sleep')), null);
  // The round shows its issue; the Product page groups its cards by it.
  assert.equal(roundHeader({round: {...saved, open: true}, counts: {}}).issue, 'sleep');
  const groups = issueGroups({rounds: [{...saved, open: true}, {id: 'R02', number: 2}], issues: issueRows(issues)}, [{id: 'L1', round: 1}, {id: 'L2', round: 2}, {id: 'L3', round: null}, {id: 'L4', round: 1}]);
  assert.deepEqual(groups.map(group => [group.slug, group.status, group.items.map(item => item.id).join()]), [['sleep', 'testing', 'L1,L4'], ['', '', 'L2,L3']]);
});

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-issues-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-issues-')); await fs.rm(root, {recursive: true, force: true}); });
  for (const dir of ['workflow', 'products', 'research', 'agents', 'resources/issues/crafters', 'resources/issues/pets', 'resources/issues/ready', 'resources/issues/hunters', 'resources/issues/empty', 'resources/issues/Bad Name']) await fs.mkdir(path.join(root, dir), {recursive: true});
  await fs.copyFile(path.join(repo, 'workflow/the-line.json'), path.join(root, 'workflow/the-line.json'));
  await fs.copyFile(path.join(repo, 'agents/team.json'), path.join(root, 'agents/team.json'));
  const extra = ['**Group:** long-hours crafters.', '', '## 6. Product opportunities', '', '| Product type | Search terms: TikTok Shop | What fails them today |', '| --- | --- | --- |', '| **Tilt platform** | `sewing machine tilt` | Wedges slip |', ''].join('\n');
  await fs.writeFile(path.join(root, 'resources/issues/crafters/ISSUE.md'), newIssue('"sick of my back and hands hurting after a quilt session"', {extra}));
  await fs.writeFile(path.join(root, 'resources/issues/pets/ISSUE.md'), newIssue('my dog chews everything', {open: ['I1', 'I3']}));
  await fs.writeFile(path.join(root, 'resources/issues/ready/ISSUE.md'), newIssue('ready to pick'));
  await fs.writeFile(path.join(root, 'resources/issues/hunters/gemini-2026-10-03.md'), '# Gemini report: cold feet in a treestand\n\nLeads only.\n');
  await fs.writeFile(path.join(root, 'research/comparison.json'), JSON.stringify({revision: 1, minimumReviews: 5, targetReviews: 10, candidates: []}));
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, method = 'GET', value, {agent = false} = {}) => new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: {Host: 'localhost:3000', ...(agent ? {'x-launchroom-local-agent': '1'} : {}), ...(method === 'GET' ? {} : {Origin: 'http://localhost:3000', 'Content-Type': 'application/json'})}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => { const body = Buffer.concat(chunks).toString('utf8'); resolve({status: res.statusCode, data: body ? JSON.parse(body) : null}); });
    });
    req.on('error', reject); req.end(value === undefined ? undefined : JSON.stringify(value));
  });
  return {root, request};
}

test('GET /api/issues and POST /api/issues/pick: statuses, the owner-only pick, rounds from Testing issues, briefs', async t => {
  const {root, request} = await workspace(t);
  const {issues, problems} = await readIssues({workspaceRoot: root});
  assert.deepEqual(issues.map(issue => [issue.slug, issue.verified, Boolean(issue.missingFile)]), [['crafters', true, false], ['hunters', false, true], ['pets', false, false], ['ready', true, false]]);
  assert.deepEqual(issues.find(issue => issue.slug === 'hunters').gemini, ['resources/issues/hunters/gemini-2026-10-03.md']);
  assert.equal(issues.find(issue => issue.slug === 'hunters').title, 'cold feet in a treestand');
  assert.deepEqual(problems.map(problem => problem.slug).sort(), ['Bad Name', 'empty']);
  assert.deepEqual(await readIssues({workspaceRoot: path.join(root, 'missing')}), {issues: [], problems: []});
  assert.equal(geminiOnlyIssue('x', '').title, 'X');

  let list = await request('/api/issues');
  assert.equal(list.status, 200);
  assert.deepEqual([list.data.root, list.data.method, list.data.picks.revision, list.data.hint], ['resources/issues', 'workflow/CHECKS.md', 0, '']);
  assert.deepEqual(list.data.counts, {testing: 0, verified: 2, candidate: 2, parked: 0, total: 4});
  // Agents read the list; only the owner's screen picks (no local-agent header).
  let res = await request('/api/issues/pick', 'POST', {revision: 0, slug: 'crafters', pick: 'testing'}, {agent: true});
  assert.deepEqual([res.status, res.data.code], [403, 'OWNER_DECISION_ONLY']);
  assert.equal(existsSync(path.join(root, 'os/data/issue-picks.json')), false, 'nothing written');
  res = await request('/api/issues/pick', 'POST', {revision: 0, slug: 'pets', pick: 'testing'});
  assert.deepEqual([res.status, res.data.code, res.data.details.open], [409, 'ISSUE_NOT_VERIFIED', ['I1', 'I3']]);
  // A round cannot start from an issue the owner has not picked.
  res = await request('/api/rounds', 'POST', {revision: 0, action: 'start', issue: 'crafters', focus: 'Crafters', folders: ['research/2026-10-03-crafters/']});
  assert.deepEqual([res.status, res.data.code], [409, 'ISSUE_NOT_PICKED']);
  res = await request('/api/rounds', 'POST', {revision: 0, action: 'start', issue: 'pets', focus: 'Pets', folders: ['research/2026-10-03-pets/']});
  assert.deepEqual([res.status, res.data.code], [409, 'ISSUE_GATE_OPEN']);
  // One tap: crafters is Testing.
  res = await request('/api/issues/pick', 'POST', {revision: 0, slug: 'crafters', pick: 'testing'});
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.deepEqual([res.data.saved, res.data.picks.revision, res.data.issues.find(issue => issue.slug === 'crafters').status], [{slug: 'crafters', pick: 'testing', before: null, undo: false}, 1, 'testing']);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'os/data/issue-picks.json'), 'utf8')).picks.crafters.pick, 'testing');
  res = await request('/api/issues/pick', 'POST', {revision: 0, slug: 'ready', pick: 'parked'});
  assert.deepEqual([res.status, res.data.code], [409, 'REVISION_CONFLICT']);
  res = await request('/api/issues/pick', 'POST', {revision: 1, slug: 'ready', pick: 'parked'});
  assert.equal(res.status, 200);
  res = await request('/api/rounds', 'POST', {revision: 0, action: 'start', issue: 'ready', focus: 'Ready', folders: ['research/2026-10-03-ready/']});
  assert.deepEqual([res.status, res.data.code], [409, 'ISSUE_PARKED']);

  // The scout's brief lists the Testing issue as its search list; the researcher's lists Candidates with their open checks.
  const scout = (await request('/api/memory/brief?agent=scout')).data.markdown;
  assert.match(scout, /## Issues being tested \(step 0\): your search list[\s\S]*- \*\*crafters\*\*: "sick of my back and hands hurting after a quilt session" \(long-hours crafters\.\) · no open round yet\n {2}Search for: Tilt platform\. TikTok Shop: "sewing machine tilt"\. What fails them today: Tilt platform: Wedges slip\./);
  const researcher = (await request('/api/memory/brief?agent=buyer-researcher')).data.markdown;
  assert.match(researcher, /## Issues to cross-reference \(step 0\)\n\n2 Candidates:[\s\S]*- \*\*pets\*\* \(stub\): open I1, I3 ·[\s\S]*- \*\*hunters\*\* \(Gemini report only: write ISSUE\.md from templates\/ISSUE\.md\): open I1, I2, I3, I4, I5, I6, I7 ·/);
  assert.match(researcher, /I1-I7 in workflow\/CHECKS\.md[^\n]*I6 Wants to buy: 5\+ verbatim buying-intent quotes[^\n]*I7 Not owned on Meta/);
  assert.doesNotMatch((await request('/api/memory/brief?agent=checker')).data.markdown, /Issues being tested|Issues to cross-reference/);

  // The doctor: a Testing issue with no open round is a finding.
  let doctor = (await request('/api/doctor')).data.checks.find(check => check.id === 'issues');
  assert.ok(doctor.findings.some(finding => finding.status === 'look' && /crafters is Testing, but no open round works from it/.test(finding.text)), JSON.stringify(doctor.findings));
  res = await request('/api/rounds', 'POST', {revision: 0, action: 'start', issue: 'crafters', focus: 'Crafters', folders: ['research/2026-10-03-crafters/']});
  assert.equal(res.status, 200, JSON.stringify(res.data));
  list = await request('/api/issues');
  assert.deepEqual(list.data.issues.find(issue => issue.slug === 'crafters').rounds.map(round => [round.id, round.open]), [['R01', true]]);
  assert.equal((await request('/api/pipeline')).data.pipeline.round.issue, 'crafters');
  doctor = (await request('/api/doctor')).data.checks.find(check => check.id === 'issues');
  assert.ok(!doctor.findings.some(finding => /crafters is Testing/.test(finding.text)));
  // Undo puts the earlier pick back.
  res = await request('/api/issues/pick', 'POST', {revision: 2, slug: 'ready', pick: null, undo: true});
  assert.deepEqual([res.status, res.data.issues.find(issue => issue.slug === 'ready').status], [200, 'verified']);
  assert.equal((await request('/api/issues', 'PATCH', {revision: 0})).status, 404);
  // A file with I1-I5 ticked and no I6/I7 lines (written before Oct 3) is a Candidate; its pick is refused.
  await fs.mkdir(path.join(root, 'resources/issues/fives'), {recursive: true});
  await fs.writeFile(path.join(root, 'resources/issues/fives/ISSUE.md'), newIssue('only the first five', {omit: ['I6', 'I7']}));
  list = await request('/api/issues');
  const fives = list.data.issues.find(issue => issue.slug === 'fives');
  assert.deepEqual([fives.status, fives.verified, fives.checks.map(check => check.state).join()], ['candidate', false, 'passed,passed,passed,passed,passed,open,open']);
  res = await request('/api/issues/pick', 'POST', {revision: list.data.picks.revision, slug: 'fives', pick: 'testing'});
  assert.deepEqual([res.status, res.data.code, res.data.details.open], [409, 'ISSUE_NOT_VERIFIED', ['I6', 'I7']]);
});

test('the doctor: a Testing issue with no open round and a Verified issue untouched for 14 days are looks; Candidates a note', () => {
  const facts = issues => ({now: new Date('2026-10-20T15:00:00Z'), today: '2026-10-20', errors: {}, issues});
  const check = report => report.checks.find(item => item.id === 'issues');
  const entry = (slug, status, extra = {}) => ({slug, status, path: `resources/issues/${slug}/ISSUE.md`, checks: ISSUE_CHECKS.map(c => ({...c, state: status === 'candidate' ? 'open' : 'passed'})), rounds: [], openRound: false, modifiedAt: '2026-10-19T12:00:00.000Z', ...extra});
  const report = check(doctorReport(facts({issues: [entry('crafters', 'testing'), entry('ready', 'verified', {modifiedAt: '2026-10-01T12:00:00.000Z'}), entry('fresh', 'verified'), entry('pets', 'candidate'), entry('done', 'testing', {openRound: true})], counts: {}, problems: [], picks: {revision: 3, error: ''}, hint: ''})));
  assert.equal(report.label, 'Issues (step 0)');
  assert.deepEqual(report.findings.filter(finding => finding.status === 'look').map(finding => finding.text), [
    'crafters is Testing, but no open round works from it, so nobody is searching for its products.',
    `ready has been Verified with no pick for ${VERIFIED_QUIET_DAYS}+ days (last change Oct 1 07:00).`,
  ]);
  assert.match(report.findings.find(finding => finding.status === 'note').text, /^1 Candidate still being cross-referenced: pets \(open I1, I2, I3, I4, I5, I6, I7\)\.$/);
  assert.match(report.findings[0].fix, /os\.mjs round start --issue crafters/);
  const broken = check(doctorReport(facts({issues: [], counts: {}, problems: [], picks: {revision: null, error: 'Invalid saved issue picks.'}})));
  assert.equal(broken.findings[0].status, 'look');
  const clean = check(doctorReport(facts({issues: [entry('done', 'testing', {openRound: true})], counts: {testing: 1, verified: 0, candidate: 0, parked: 0, total: 1}, problems: [], picks: {revision: 1, error: ''}, hint: ''})));
  assert.deepEqual([clean.status, clean.findings[0].text], ['ok', '1 issue: 1 testing, 0 verified, 0 candidates, 0 parked.']);
  assert.equal(check(doctorReport(facts(null))).status, 'note');
});

test('brief blocks: the scout\'s search list and the researcher\'s Candidates, short and from saved records', () => {
  const testing = {...parseIssue(newIssue('cold feet in the stand', {extra: '**Group:** treestand hunters.\n\n## 6. Product opportunities\n\n| Product type | Search terms: TikTok Shop |\n| --- | --- |\n| **Foot pad** | `treestand foot pad` |\n'}), 'cold'), status: 'testing', rounds: [{id: 'R10', number: 10, open: true}], openRound: true};
  const md = scoutIssuesMarkdown([testing]);
  assert.match(md, /^## Issues being tested \(step 0\): your search list\n/);
  assert.match(md, /- \*\*cold\*\*: cold feet in the stand \(treestand hunters\.\) · Round 10 open\n {2}Search for: Foot pad\. TikTok Shop: "treestand foot pad"\./);
  assert.match(scoutIssuesMarkdown([{...testing, status: 'verified'}]), /None yet: 1 Verified issue waits for the owner's pick/);
  assert.equal(researcherIssuesMarkdown([testing]), '');
  const many = Array.from({length: 7}, (_, i) => ({...parseIssue(newIssue(`c${i}`, {open: ['I2']}), `c${i}`), status: 'candidate'}));
  const research = researcherIssuesMarkdown(many);
  assert.match(research, /7 Candidates/); assert.match(research, /…and 2 more: `os\.mjs issues --status candidate`/);
  assert.ok(research.split(/\s+/).length < 220, 'stays short');
  assert.doesNotMatch(research, /I6 Wants to buy:/, 'I6 and I7 are explained only while a Candidate owes them');
  const owes = researcherIssuesMarkdown([many[0], {...parseIssue(newIssue('five lines', {omit: ['I6', 'I7']}), 'five'), status: 'candidate'}]);
  assert.match(owes, /- \*\*c0\*\* \(stub\): open I2 · [\s\S]*- \*\*five\*\* \(stub\): open I6, I7 · /);
  assert.match(owes, /I6 Wants to buy: 5\+ verbatim buying-intent quotes \("I wish there was", "I'd pay for"\), tagged intent; complaints alone don't count\. I7 Not owned on Meta: Meta Ad Library \(US, active\)/);
  assert.ok(owes.split(/\s+/).length < 220, 'still short');
  // A Gemini-only folder below the cut is still named, so new leads are never lost.
  const gemini = {...geminiOnlyIssue('gem-x', '# Gemini report: x'), status: 'candidate'};
  assert.match(researcherIssuesMarkdown([...many, gemini]), /\n- Gemini reports waiting for an ISSUE\.md: gem-x \(resources\/issues\/<slug>\/\)\n\n$/);
  assert.doesNotMatch(researcherIssuesMarkdown([gemini]), /Gemini reports waiting/, 'not repeated when it is already listed');
});

test('Home shows the Launch plan only while a product holds the build slot', () => {
  assert.deepEqual(launchPanel({buildProductId: null, planExists: true}), {show: false, eyebrow: 'Launch plan', title: 'Launch plan'});
  assert.equal(launchPanel({buildProductId: 'P002-lamp', planExists: false}).show, false);
  assert.deepEqual(launchPanel({buildProductId: 'P002-lamp', buildingName: 'Sunrise lamp', planExists: true}), {show: true, eyebrow: 'Launch plan', title: 'Launch plan · Sunrise lamp'});
});
