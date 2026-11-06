import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {REASON_TAGS, REASON_TAG_LIMIT, reasonTagsProblem, toggleReasonTag, decisionOf, sameDecision, ownerReasonLine, eyeTestCandidate, undoCandidate, reasonTagCounts, reasonTagsMarkdown} from '../src/eyeTest.mjs';
import {ownerDecisionCandidate} from '../src/workflowView.mjs';
import {emptyResearch, updateResearch, validateResearch, RESEARCH_GATES} from './research.mjs';
import {agentBrief, emptyLessons} from './lessons.mjs';
import {createApi} from './api.mjs';

// The owner's one-tap eye test (Oct 3): "i dont want to always put in descriptions
// why i didnt choose the product." Reason optional, 0-2 chips, undo, agents refused.
const seen = {status: 'supported', observedAt: '2026-10-02', country: 'US', evidenceType: 'observed', note: 'Fixture.'};
const pending = {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''};
const card = (id, stats = true) => ({
  id, name: `Card ${id}`, country: 'US', buyer: 'Fixture buyer', decision: 'CURATED', nextAction: 'Eye test', references: [],
  gates: Object.fromEntries(RESEARCH_GATES.map(g => [g, {status: 'pending', note: '', source: '', observedAt: '', window: ''}])),
  screen: {ownerDecision: 'unreviewed', ownerReason: '', checks: {
    provenDemand: stats ? {...seen, source: 'https://www.amazon.com/s?k=fixture', demand: [{metric: 'amazon-bought', value: 7000, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-10-02'}], trend: [{date: '2025-10-01', value: 50}, {date: '2026-04-01', value: 60}, {date: '2026-09-20', value: 58}], trendUrl: 'https://trends.google.com/trends/explore?q=fixture'} : pending,
    dropshippable: pending, looksWorth: pending, audienceRoom: pending, bigIssue: pending, metaGap: pending,
    sourceMatch: pending, contribution: pending, productWorks: pending, noBrand: pending,
  }},
});
const batch = (...cards) => ({...emptyResearch(), candidates: cards});
const lead = c => ({id: c.id, name: c.name, candidate: c});

test('chips: 8 fixed reasons, at most 2; a third tap drops the oldest; unknown or repeated refused', () => {
  assert.deepEqual(REASON_TAGS, ['Looks cheap', 'Too saturated', 'Weak numbers', "Can't dropship", 'Not our niche', 'Too basic', 'Love it', 'Great angle']);
  assert.equal(REASON_TAG_LIMIT, 2);
  let tags = toggleReasonTag([], 'Too basic'); tags = toggleReasonTag(tags, 'Looks cheap'); tags = toggleReasonTag(tags, 'Weak numbers');
  assert.deepEqual(tags, ['Looks cheap', 'Weak numbers']);
  assert.deepEqual(toggleReasonTag(tags, 'Looks cheap'), ['Weak numbers']);
  assert.deepEqual(toggleReasonTag(tags, 'Made up'), tags);
  assert.equal(reasonTagsProblem(undefined), ''); assert.equal(reasonTagsProblem([]), '');
  assert.match(reasonTagsProblem(['Too basic', 'Looks cheap', 'Love it']), /at most 2/);
  assert.match(reasonTagsProblem(['Ugly']), /Quick reasons are/);
  assert.match(reasonTagsProblem(['Love it', 'Love it']), /once/);
  assert.match(reasonTagsProblem('Love it'), /list/);
});

test('one tap: a decision with no reason is a valid candidate; an empty reason stays empty', () => {
  const made = eyeTestCandidate(lead(card('L104')), 'rejected', {}, () => assert.fail('not needed'));
  assert.equal(made.screen.ownerDecision, 'rejected'); assert.equal(made.screen.ownerReason, ''); assert.deepEqual(made.screen.reasonTags, []);
  const tagged = ownerDecisionCandidate(lead(card('L104')), 'passed', '  Seen it everywhere ', ['Too saturated']);
  assert.equal(tagged.screen.ownerReason, 'Seen it everywhere'); assert.deepEqual(tagged.screen.reasonTags, ['Too saturated']);
  assert.throws(() => ownerDecisionCandidate(lead(card('L104')), 'verified'), /save, pass or reject/);
  assert.throws(() => ownerDecisionCandidate(lead(card('L104')), 'passed', '', ['Too basic', 'Looks cheap', 'Love it']), /at most 2/);
  assert.equal(ownerReasonLine(tagged.screen), 'Too saturated — Seen it everywhere');
  assert.equal(ownerReasonLine({ownerDecision: 'rejected', ownerReason: ''}), '');
  assert.equal(ownerReasonLine({ownerDecision: 'rejected', ownerReason: 'Typed before Oct 3'}), 'Typed before Oct 3');
});

test('server: no reason accepted, tags saved, decidedAt stamped; bad tags refused', () => {
  const at = new Date('2026-10-03T12:00:00Z');
  const one = updateResearch(batch(card('L104')), {revision: 0, candidate: ownerDecisionCandidate(lead(card('L104')), 'rejected', '', ['Too basic', 'Looks cheap'])}, {at});
  const s = one.candidates[0].screen;
  assert.equal(s.ownerDecision, 'rejected'); assert.equal(s.ownerReason, ''); assert.deepEqual(s.reasonTags, ['Too basic', 'Looks cheap']); assert.equal(s.decidedAt, at.toISOString());
  // Older records (a typed reason, no tags) stay valid.
  const old = card('L095'); old.screen.ownerDecision = 'rejected'; old.screen.ownerReason = 'Looks cheap and generic';
  assert.doesNotThrow(() => validateResearch(batch(old)));
  const bad = ownerDecisionCandidate(lead(card('L104')), 'passed'); bad.screen.reasonTags = ['Ugly'];
  assert.throws(() => updateResearch(batch(card('L104')), {revision: 0, candidate: bad}), err => err.code === 'REASON_TAGS');
  // An agent's later evidence edit keeps the owner's decision and its time.
  const edited = structuredClone(one.candidates[0]); edited.screen.checks.looksWorth = {...seen, source: 'https://www.amazon.com/dp/FIXTURE'};
  delete edited.screen.reasonTags; delete edited.screen.decidedAt;
  const kept = updateResearch(one, {revision: 1, candidate: edited}, {agent: true}).candidates[0].screen;
  assert.deepEqual(kept.reasonTags, ['Too basic', 'Looks cheap']); assert.equal(kept.decidedAt, at.toISOString()); assert.equal(kept.checks.looksWorth.status, 'supported');
});

test('server: agents still cannot write the eye test, in any form', () => {
  const waiting = batch(card('L104'));
  const refused = err => err.code === 'OWNER_DECISION_ONLY' && err.status === 403;
  assert.throws(() => updateResearch(waiting, {revision: 0, candidate: ownerDecisionCandidate(lead(card('L104')), 'passed')}, {agent: true}), refused);
  assert.throws(() => updateResearch(batch(), {revision: 0, candidate: ownerDecisionCandidate(lead(card('L200')), 'rejected')}, {agent: true}), refused);
  const decided = updateResearch(waiting, {revision: 0, candidate: ownerDecisionCandidate(lead(card('L104')), 'passed', '', ['Too basic'])});
  for (const change of [s => { s.reasonTags = ['Love it']; }, s => { s.ownerReason = 'Agent words'; }, s => { s.ownerDecision = 'unreviewed'; s.reasonTags = []; }]) {
    const next = structuredClone(decided.candidates[0]); change(next.screen);
    assert.throws(() => updateResearch(decided, {revision: 1, candidate: next}, {agent: true}), refused);
  }
  const noScreen = structuredClone(decided.candidates[0]); delete noScreen.screen;
  assert.throws(() => updateResearch(decided, {revision: 1, candidate: noScreen}, {agent: true}), refused);
  // A new card from the scout, unreviewed, is fine.
  assert.equal(updateResearch(batch(), {revision: 0, candidate: card('L201')}, {agent: true}).candidates.length, 1);
});

test('server: Save is still blocked without statistics; Pass and Reject with no reason work', () => {
  const noStats = batch(card('L102', false));
  assert.throws(() => updateResearch(noStats, {revision: 0, candidate: ownerDecisionCandidate(lead(card('L102', false)), 'saved')}), err => err.code === 'STATS_MISSING');
  for (const decision of ['passed', 'rejected']) assert.equal(updateResearch(noStats, {revision: 0, candidate: ownerDecisionCandidate(lead(card('L102', false)), decision)}).candidates[0].screen.ownerDecision, decision);
  assert.equal(updateResearch(batch(card('L100')), {revision: 0, candidate: ownerDecisionCandidate(lead(card('L100')), 'saved')}).candidates[0].screen.ownerDecision, 'saved');
});

test('undo: the earlier decision comes back on the latest record; unreviewed drops decidedAt', () => {
  const start = batch(card('L104'));
  const before = decisionOf(start.candidates[0].screen);
  const decided = updateResearch(start, {revision: 0, candidate: ownerDecisionCandidate(lead(card('L104')), 'rejected', '', ['Looks cheap'])});
  const latest = {...structuredClone(decided.candidates[0]), missingEvidence: {screen: []}};
  const undone = updateResearch(decided, {revision: 1, candidate: undoCandidate(latest, before)});
  const s = undone.candidates[0].screen;
  assert.equal(s.ownerDecision, 'unreviewed'); assert.equal(s.ownerReason, ''); assert.deepEqual(s.reasonTags, []); assert.equal(s.decidedAt, undefined);
  assert.ok(sameDecision(s, start.candidates[0].screen));
  // Undo back to an earlier Pass with a note.
  const passed = updateResearch(start, {revision: 0, candidate: ownerDecisionCandidate(lead(card('L104')), 'passed', 'Maybe in spring')});
  const wasPassed = decisionOf(passed.candidates[0].screen);
  const rejected = updateResearch(passed, {revision: 1, candidate: ownerDecisionCandidate(lead(passed.candidates[0]), 'rejected')});
  const back = updateResearch(rejected, {revision: 2, candidate: undoCandidate(rejected.candidates[0], wasPassed)}).candidates[0].screen;
  assert.equal(back.ownerDecision, 'passed'); assert.equal(back.ownerReason, 'Maybe in spring');
});

test("scout's brief: counts of the owner's recent chips, compact; nothing while no chips", () => {
  const decided = (id, tags, at) => { const c = card(id); c.screen = {...c.screen, ownerDecision: 'rejected', reasonTags: tags, ...(at ? {decidedAt: at} : {})}; return c; };
  const cards = [decided('L001', ['Love it']), ...Array.from({length: 20}, (_, i) => decided(`L1${String(i).padStart(2, '0')}`, i % 2 ? ['Too basic'] : ['Too basic', 'Looks cheap'], `2026-10-03T0${i % 10}:${String(i).padStart(2, '0')}:00Z`)), card('L300')];
  const counts = reasonTagCounts(cards);
  assert.equal(counts.decisions, 20);
  assert.deepEqual(counts.counts, [['Too basic', 20], ['Looks cheap', 10]]); // the undated, oldest "Love it" falls outside the last 20
  const md = reasonTagsMarkdown(cards);
  assert.match(md, /Owner's last 20 decisions: Too basic ×20, Looks cheap ×10\./);
  assert.ok(md.split(/\s+/).length <= 40, `taste block is ${md.split(/\s+/).length} words`);
  assert.equal(reasonTagsMarkdown([card('L1'), decided('L2', [])]), '');
  const brief = agentBrief({state: {}, planner: {tasks: []}, lessons: emptyLessons(), library: null, agent: 'scout', name: 'Product scout', ownerTaste: md});
  assert.match(brief.markdown, /## What the owner says on the eye test\n\nOwner's last 20 decisions/);
  assert.ok(brief.tasteWords <= 40);
  assert.doesNotMatch(agentBrief({state: {}, planner: {tasks: []}, lessons: emptyLessons(), library: null, agent: 'checker'}).markdown, /What the owner says/);
});

test('API: PATCH /api/research refuses an eye-test write from an agent (local-agent header) and takes the owner\'s one tap', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-eyetest-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  await fs.mkdir(path.join(root, 'research'), {recursive: true});
  await fs.writeFile(path.join(root, 'research/comparison.json'), JSON.stringify(batch(card('L104')), null, 2));
  const api = createApi({workspaceRoot: root});
  const call = (input, headers = {}) => new Promise(resolve => {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(input))]), {method: 'PATCH', url: '/api/research', headers: {host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers}});
    const res = {statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { resolve({status: this.statusCode, body: JSON.parse(body)}); }, writableEnded: false};
    api(req, res);
  });
  const tap = ownerDecisionCandidate(lead(card('L104')), 'rejected', '', ['Too basic']);
  const agent = await call({revision: 0, candidate: tap}, {'x-launchroom-local-agent': '1'});
  assert.equal(agent.status, 403); assert.equal(agent.body.code, 'OWNER_DECISION_ONLY');
  const owner = await call({revision: 0, candidate: tap});
  assert.equal(owner.status, 200);
  const saved = owner.body.candidates.find(c => c.id === 'L104').screen;
  assert.equal(saved.ownerDecision, 'rejected'); assert.equal(saved.ownerReason, ''); assert.deepEqual(saved.reasonTags, ['Too basic']);
  const file = JSON.parse(await fs.readFile(path.join(root, 'research/comparison.json'), 'utf8'));
  assert.deepEqual(file.candidates[0].screen.reasonTags, ['Too basic']);
});
