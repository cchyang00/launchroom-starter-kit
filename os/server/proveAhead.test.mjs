import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseProveFile, verdictState, aheadOf, waitReasons, PROVE_FILE, listWords} from '../src/proveAhead.mjs';
import {pipelineItems, findItem} from '../src/pipeline.mjs';
import {buildLeads} from '../src/workflowView.mjs';
import {STAGES, CHECKS} from './domain.mjs';
import {SCREEN_CHECKS, RESEARCH_GATES} from './research.mjs';
import {createStore} from './store.mjs';

// Work done ahead of the owner's Save (owner, Oct 3: "im on prove it and i literally dont see a spot to run those checks").
// Fixtures are in memory or a temporary workspace; the real prove files are only read.
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');

const FILE = `# Prove it: L900 Fixture duffle

*Checker, observed 2026-10-03, US.*

## Verdict in six lines

| Gate | Result | Why |
| --- | --- | --- |
| **P2 · Same item, safe to sell** | **OPEN, and weight is the problem** | CJ, Alibaba and AliExpress item pages are all behind verification. |
| **P3 · Delivery promise** | **DRAFTED, not confirmed** | Ships in 3 business days. |
| **P4 · The money line** | **WRITTEN; fails the owner's $20 flag at the single** | 1-pack breaks even at $16.37. |
| **P5 · Sample** | **Drafted, waiting on the owner** | Nothing ordered. |

## P2 · Same item, safe to sell

### Access, honestly

| Site | What the pane showed (2026-10-03) | Action |
| --- | --- | --- |
| CJdropshipping | Search page = "Human verification" | stopped, not bypassed |
| Alibaba | Item page = "Please slide to verify" | stopped, not bypassed |
| Made-in-China.com | loads, no wall | read |

## Room on Meta (P1), 2026-10-03

### Gate result

**P1 · Room on Meta: PASSES (Crowded product, open lane).** Demand is stable.
`;

test('a prove file reads as P1-P5 states, the P1 verdict and the supplier walls', () => {
  const parsed = parseProveFile(FILE);
  assert.deepEqual(parsed.lines.map(line => [line.id, line.state]), [['P1', 'passed'], ['P2', 'open'], ['P3', 'drafted'], ['P4', 'written'], ['P5', 'drafted']]);
  assert.equal(parsed.p1.result, 'Passes: Crowded product, open lane');
  assert.deepEqual(parsed.walls, ['CJ', 'Alibaba']);
  assert.equal(parsed.observed, '2026-10-03');
  assert.equal(parsed.roomOnMeta, true);
  // Older files: "P1 for L###: FAILED" and the table only; a missing line is unknown ("none"), never passed.
  const older = parseProveFile('## Verdict in six lines\n\n| Gate | Result | Why |\n| --- | --- | --- |\n| **P2 · Same item** | **OPEN (owner action)** | CJ shows human verification; AliExpress a reCAPTCHA. |\n\n## Room on Meta (P1), 2026-10-03\n\n**P1 for L101: FAILED on the main avatar (A1).** Try the next avatar.\n');
  assert.deepEqual(older.lines.map(line => line.state), ['failed', 'open', 'none', 'none', 'none']);
  assert.equal(older.p1.result, 'Fails: on the main avatar (A1)');
  assert.deepEqual(older.walls, ['CJ', 'Alibaba', 'AliExpress']);
  // A section that only mentions Room on Meta (superseded) is not the P1 verdict.
  const superseded = parseProveFile('## P1 · An opening (superseded by "Room on Meta (P1)" below)\n\n**P1 for L1: PASSES, any channel.**\n');
  assert.equal(superseded.p1.state, 'none');
  assert.deepEqual(parseProveFile('').lines.map(line => line.state), ['none', 'none', 'none', 'none', 'none']);
  assert.deepEqual(['PASS on avatar A', 'SATURATED', 'Plan written; waiting', 'OPEN', 'WRITTEN; flagged', 'maybe'].map(verdictState), ['passed', 'failed', 'drafted', 'open', 'written', 'open']);
  assert.ok(PROVE_FILE.test('research/2026-10-03-tiktok-public/prove/L126.md'));
  assert.ok(!PROVE_FILE.test('research/../os/data/prove/L126.md') && !PROVE_FILE.test('research/x/prove/L126.md.bak'));
  assert.equal(listWords(['CJ', 'Alibaba', 'AliExpress']), 'CJ, Alibaba and AliExpress');
});

test('the real prove files parse (L126, L130 pass P1; L101 fails it)', async () => {
  const read = file => fs.readFile(path.join(ROOT, file), 'utf8').catch(() => null);
  const files = {L126: 'research/2026-10-03-tiktok-public/prove/L126.md', L130: 'research/2026-10-03-verified-issues/prove/L130.md', L101: 'research/2026-10-02-numbers-first/prove/L101.md'};
  for (const [id, file] of Object.entries(files)) {
    const text = await read(file);
    if (text === null) continue;
    const parsed = parseProveFile(text);
    assert.equal(parsed.p1.state, id === 'L101' ? 'failed' : 'passed', `${id} P1`);
    assert.ok(parsed.lines.slice(1).every(line => line.state !== 'none'), `${id} P2-P5 are all written`);
    assert.ok(parsed.walls.includes('CJ'), `${id} names the CJ wall`);
  }
});

const DAY = '2026-10-03';
const supported = (extra = {}) => ({status: 'supported', note: 'Dated observation', source: 'research/r/evidence.md', observedAt: DAY, country: 'US', evidenceType: 'observed', ...extra});
const pending = () => ({status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''});
function fixtureCard(id, {owner = 'unreviewed', buyers = true, failed = null} = {}) {
  const checks = Object.fromEntries(SCREEN_CHECKS.map(key => [key, pending()]));
  checks.provenDemand = supported({demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/X', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/X', observedAt: DAY}], source: 'https://www.amazon.com/dp/X'});
  if (buyers) checks.buyers = supported({quotes: 18, avatars: [{who: 'Suit traveler', trigger: 'Wedding trip'}, {who: 'Crew', trigger: 'Layover'}], angleGap: 'Real inside size'});
  if (failed) checks[failed] = {status: 'failed', note: 'WOW 1 of 5: a plain tote.', source: 'https://example.com/x', observedAt: DAY, country: 'US', evidenceType: 'observed'};
  return {id, name: `Card ${id}`, country: 'US', buyer: '', decision: 'CURATED — UNVERIFIED', nextAction: '', references: [`research/r/${id}.md`],
    screen: {ownerDecision: owner, ownerReason: '', checks}, gates: Object.fromEntries(RESEARCH_GATES.map(key => [key, {status: 'pending', note: '', source: '', observedAt: '', window: ''}]))};
}

test('researched ahead: only an unsaved card with a prove file or a saved buyers check; nothing waits on a Save (owner, Nov 5)', () => {
  const cards = [fixtureCard('L900'), fixtureCard('L901', {buyers: false}), fixtureCard('L902', {owner: 'saved'}), fixtureCard('L903', {owner: 'passed'}), fixtureCard('L904', {failed: 'looksWorth'})];
  const items = pipelineItems({stages: STAGES, checks: CHECKS, leads: buildLeads({candidates: cards}, {batches: []})});
  const prove = {path: 'research/r/prove/L900.md', ...parseProveFile(FILE)};
  const by = id => ({item: items.find(item => item.id === id), candidate: cards.find(card => card.id === id)});
  const a = by('L900');
  const ahead = aheadOf(a.item, a.candidate, prove);
  assert.deepEqual([ahead.buyers.state, ahead.buyers.passed, ahead.buyers.quotes, ahead.buyers.avatars], ['passed', 3, 18, 2]);
  assert.deepEqual(ahead.pendingWrites, ['P1', 'P2', 'P3', 'P4', 'P5']);
  assert.equal(ahead.file, 'research/r/prove/L900.md');
  // Buyers alone is enough to be ahead; nothing at all is not.
  assert.ok(aheadOf(a.item, a.candidate, null));
  assert.equal(aheadOf(by('L901').item, by('L901').candidate, null), null);
  assert.ok(aheadOf(by('L901').item, by('L901').candidate, prove), 'a prove file alone is ahead');
  // A Save, a Pass or a failed check is never "ahead".
  assert.equal(aheadOf(by('L902').item, by('L902').candidate, prove), null);
  assert.equal(aheadOf(by('L903').item, by('L903').candidate, prove), null);
  assert.equal(by('L904').item.outcome?.kind, 'failed');
  assert.equal(aheadOf(by('L904').item, by('L904').candidate, prove), null);
  // Why it waits: what the checker still has to record, the open Product checks, the supplier walls, P3 and P5, each with the action and whose it is.
  const reasons = waitReasons({item: a.item, candidate: a.candidate, prove, ahead});
  assert.deepEqual(reasons.map(reason => [reason.id, reason.who]), [['record', 'checker'], ['find', 'scout'], ['walls', 'owner'], ['p3', 'checker'], ['p5', 'checker']]);
  assert.match(reasons.find(reason => reason.id === 'walls').text, /^P2 waits for supplier pages: CJ and Alibaba showed a verification page/);
  assert.match(reasons.find(reason => reason.id === 'walls').action, /Clear the CJ and Alibaba verification once in the browser/);
  assert.match(reasons[0].text, /written in the prove file, not on the card yet/);
  // A saved card at Buyers with nothing saved says so; nothing is ever a silent empty state.
  const saved = pipelineItems({stages: STAGES, checks: CHECKS, leads: buildLeads({candidates: [fixtureCard('L905', {owner: 'saved', buyers: false})]}, {batches: []})})[0];
  assert.deepEqual(waitReasons({item: saved, candidate: fixtureCard('L905', {owner: 'saved', buyers: false})}).map(reason => reason.id), ['buyers']);
  assert.deepEqual(waitReasons({item: {...a.item, outcome: {kind: 'failed'}}}), []);
});

test('GET /api/prove-ahead finds each card\'s prove file by its checks or its round folder, read-only', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prove-ahead-'));
  try {
    const folder = 'research/2026-10-03-fixture/';
    await fs.mkdir(path.join(root, folder, 'prove'), {recursive: true});
    await fs.mkdir(path.join(root, 'os/data'), {recursive: true});
    await fs.writeFile(path.join(root, folder, 'prove/L900.md'), FILE);
    await fs.writeFile(path.join(root, folder, 'prove/L901.md'), FILE.replace('PASSES (Crowded', 'FAILS (Saturated'));
    await fs.writeFile(path.join(root, folder, 'L900.md'), '# card');
    const cards = [fixtureCard('L900'), fixtureCard('L901'), fixtureCard('L903', {owner: 'rejected'})].map(card => ({...card, references: [`${folder}${card.id}.md`]}));
    cards[1].screen.checks.sourceMatch = {...cards[1].screen.checks.sourceMatch, source: `${folder}prove/L901.md`};
    for (const card of cards) for (const check of Object.values(card.screen.checks)) if (check.status !== 'pending') check.source = check.source.startsWith('http') ? check.source : `${folder}L900.md`;
    await fs.writeFile(path.join(root, 'research/comparison.json'), JSON.stringify({revision: 1, minimumReviews: 5, targetReviews: 10, selectedId: null, selectionReason: '', candidates: cards}, null, 2));
    await fs.writeFile(path.join(root, 'os/data/rounds.json'), JSON.stringify({revision: 1, rounds: [{id: 'R01', number: 1, startedOn: '2026-10-03', focus: 'Fixture', folders: [folder]}]}, null, 2));
    const before = await fs.readFile(path.join(root, 'research/comparison.json'), 'utf8');
    const result = await createStore({workspaceRoot: root}).getProveAhead();
    assert.deepEqual(Object.keys(result.cards).sort(), ['L900', 'L901']);
    assert.equal(result.cards.L900.path, `${folder}prove/L900.md`);
    assert.equal(result.cards.L901.p1.state, 'failed');
    assert.equal(await fs.readFile(path.join(root, 'research/comparison.json'), 'utf8'), before, 'nothing is written');
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

test('no samples (owner, Oct 3): P5 is Claims we can back; an old sample plan never waits on the owner', async () => {
  const {GATES} = await import('../src/gates.mjs');
  const {CHECKS} = await import('./domain.mjs');
  assert.equal(GATES.prove.find(line => line.id === 'P5').label, 'Claims we can back');
  assert.equal(CHECKS.find(check => check.id === 'sample').title, 'Claims we can back');
  assert.doesNotMatch(CHECKS.find(check => check.id === 'sample').description, /physical sample/i);
  const line = JSON.parse(await fs.readFile(path.join(ROOT, 'workflow/the-line.json'), 'utf8')).steps.find(step => step.id === 'prove');
  assert.doesNotMatch(`${line.ownerPart} ${line.prompts.map(p => p.label).join(' ')}`, /sample/i, 'no "approve the sample" for the owner');
  const old = parseProveFile(FILE);
  const item = {id: 'L900', stepIndex: 2, outcome: null};
  const p5 = waitReasons({item, prove: old}).find(reason => reason.id === 'p5');
  assert.deepEqual([p5.check, p5.who], ['P5', 'checker']);
  assert.match(p5.text, /Claims we can back \(no sample is bought\)/);
});
