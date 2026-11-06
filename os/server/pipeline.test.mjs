import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipelineItems, pipelineState, roundOf, roundBlockers, findItem, agentFocus, lineLeadState, roundId, failedChecks, failedCheck, reopenCandidate, unreopenCandidate, FAIL_CHECKS} from '../src/pipeline.mjs';
import {updateResearch} from './research.mjs';
import {currentStep, pipelineMarkdown, briefBlocks, fillPrompt, itemStep, validateLine, PIPELINE_BLOCK_WORDS, PIPELINE_ROWS, STEP_BLOCK_WORDS} from '../src/theLine.mjs';
import {buildLeads} from '../src/workflowView.mjs';
import {STAGES, CHECKS} from './domain.mjs';
import {createStore} from './store.mjs';
import {createApi} from './api.mjs';
import {updateRounds, validateRounds, emptyRounds, roundsMarkdown} from './rounds.mjs';
import {doctorReport} from './doctor.mjs';
import {SCREEN_CHECKS, RESEARCH_GATES} from './research.mjs';
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};

// Every product has its own seven-step line (owner, Oct 1 and Oct 2). These tests build cards and
// products in memory or in a temporary workspace; never the live records.
const here = path.dirname(fileURLToPath(import.meta.url));
const realLine = async () => validateLine(JSON.parse(await fs.readFile(path.resolve(here, '../../workflow/the-line.json'), 'utf8')));
const words = text => String(text).split(/\s+/).filter(Boolean).length;
const DAY = '2026-09-20';
const PILOT = 'research/2026-09-26-pilot/';

/** A card: `screen` supported checks (in order), `gates` supported deep checks, optional failed ones. */
function card(id, {owner = 'unreviewed', decision = 'CURATED — UNVERIFIED', screen = owner === 'unreviewed' ? 6 : 0, failed = [], gates = 0, gateFailed = [], folder = PILOT, country = 'US', reason = 'Owner reason', buyers = false} = {}) {
  const checks = Object.fromEntries(SCREEN_CHECKS.map((key, i) => [key, i < screen
    ? {status: 'supported', note: 'Dated observation', source: ['productWorks', 'looksWorth'].includes(key) ? `https://example.com/item/${id}` : `${folder}evidence.md`, observedAt: DAY, country, evidenceType: 'observed',
      ...(FIND_EXTRA[key] || {}), ...(key === 'sourceMatch' ? {listingUrl: `https://example.com/supplier/${id}`, variant: `${id} variant`, destination: country, quantity: 1} : {}),
      ...(key === 'contribution' ? {costs: {currency: 'USD', sellPrice: 50, itemCost: 10, shippingCost: 5, fees: 3, returnReserve: 2, acquisitionAllowance: 15}} : {})}
    : failed.includes(key) ? {status: 'failed', note: 'Failed check', source: `${folder}evidence.md`, observedAt: DAY, country, evidenceType: 'observed'}
      : {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''}]));
  // Step 2 · Buyers (owner, Oct 2): the card's buyers check, 15 quotes, 2 avatars and the angle gap.
  if (buyers) checks.buyers = {status: 'supported', note: 'Buyers write-up', source: `${folder}evidence.md`, observedAt: DAY, country, evidenceType: 'observed', ...FIND_EXTRA.buyers};
  const g = Object.fromEntries(RESEARCH_GATES.map((key, i) => [key, i < gates ? {status: 'supported', note: 'Gate evidence', source: `${folder}evidence.md`, observedAt: '2026-09-22', window: '30 days'}
    : gateFailed.includes(key) ? {status: 'failed', note: 'Gate failed', source: `${folder}evidence.md`, observedAt: '2026-09-22', window: '30 days'} : {status: 'pending', note: '', source: '', observedAt: '', window: ''}]));
  return {id, name: `Card ${id}`, country, buyer: gates || gateFailed.length ? 'Observed buyer situation' : '', decision, nextAction: '', references: [`${folder}${id}.md`],
    screen: {ownerDecision: owner, ownerReason: owner === 'unreviewed' ? '' : reason, checks}, gates: g};
}
const leadsOf = candidates => buildLeads({candidates}, {batches: []});
const stageAt = id => STAGES.findIndex(stage => stage.id === id);
const upTo = stage => CHECKS.filter(check => stageAt(check.stage) <= stageAt(stage)).map(check => check.id);
const verified = ids => Object.fromEntries(ids.map(id => [id, {status: 'verified'}]));
const product = (id, lead, checks = {}, market = {}) => ({id, name: `Product ${id}`, updatedAt: '2026-09-30T12:00:00.000Z', markets: [{id: `m-${id}`, country: 'US', status: 'active', researchCandidateId: lead, verificationGate: {ready: true}, checks, ...market}]});
const pilotRound = {id: 'R04', number: 4, startedOn: '2026-09-26', focus: 'Kalodata image pilot', folders: [PILOT]};

test('each card sits on its own line by its saved state; out-of-line cards keep their reason', () => {
  const items = pipelineItems({stages: STAGES, checks: CHECKS, rounds: [pilotRound], leads: leadsOf([
    card('L101'), card('L102', {owner: 'saved', screen: 3}), card('L103', {owner: 'saved', screen: 4, failed: ['metaGap']}),
    card('L104', {owner: 'saved', screen: 8, gates: 2, buyers: true}), card('L105', {owner: 'saved', screen: 8, gates: 5, buyers: true}), card('L106', {owner: 'saved', screen: 8, gates: 4, gateFailed: ['fit'], buyers: true}),
    card('L107', {owner: 'passed', reason: 'Too generic'}), card('L108', {owner: 'rejected', reason: 'Branded'}), card('L109', {decision: 'PARK: declining trend'}),
    card('L110', {owner: 'saved', screen: 6, decision: 'PARK: no quantity-one source'}), card('L111', {decision: 'KILL: recall'}),
  ])});
  const by = id => items.find(item => item.id === id);
  assert.deepEqual([by('L101').stepName, by('L101').status, by('L101').who], ['Product', 'Waiting for your eye test', 'owner']);
  // Owner, Oct 2: product first. Step 1 is Product; the issue it links to (its benefit ladder) is a reference.
  assert.deepEqual(by('L101').line.map(step => step.state), ['current', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
  assert.deepEqual(by('L101').line.map(step => step.id), ['product', 'buyers', 'prove', 'create', 'build', 'launch', 'learn']);
  assert.equal(by('L101').issue, 'sleep');
  // The owner's Save moves a card to Step 2 · Buyers, pending; Product checks it still owes are shown, never assumed.
  assert.deepEqual([by('L102').stepName, by('L102').status, by('L102').who], ['Buyers', 'Buyers · pending · Find 3/6', 'buyer-researcher']);
  assert.match(by('L102').next, /read its buyers \(TikTok comments, 2-4 star reviews, forums\): 15\+ quotes, 2\+ avatars, the angle gap/);
  assert.deepEqual(by('L102').line.slice(0, 3).map(step => [step.state, step.done, step.total]), [['done', 3, 6], ['current', 0, 3], ['todo', 0, 7]]);
  // A failed check fails the product on its own (CHECKS.md rule 3, owner Oct 3): out of the line at that check, with its note.
  assert.deepEqual([by('L103').outcome.kind, by('L103').outcome.label, by('L103').outcome.reason, by('L103').stepName, by('L103').status], ['failed', 'Failed at F6 · An angle gap', 'Failed check', 'Product', 'Failed at F6']);
  // Prove it's next move comes only from the current gate, P1-P5 (Oct 3); the legacy community and fit gates never set it.
  assert.deepEqual([by('L104').status, by('L104').line[2].done], ['Prove it 0/5', 4]);
  assert.match(by('L104').next, /^Checker: P1 Room on Meta, from the prove file/);
  assert.equal(by('L105').status, 'Prove it 2/5'); assert.match(by('L105').next, /^Checker: P4 The money line \(new part open: break-even ROAS/);
  assert.equal(by('L106').status, 'Prove it 2/5', 'a failed legacy fit gate is not a gate line');
  for (const id of ['L104', 'L105', 'L106']) assert.doesNotMatch(by(id).next, /community|fit\b|deep check/);
  assert.deepEqual([by('L107').outcome.kind, by('L107').outcome.reason, by('L107').stepName, by('L107').line[0].state], ['passed', 'Too generic', 'Product', 'stopped']);
  assert.deepEqual([by('L108').outcome.kind, by('L108').outcome.reason], ['rejected', 'Branded']);
  assert.deepEqual([by('L109').outcome.kind, by('L109').stepName], ['parked', 'Product']);
  // A saved card an agent parked leaves the line where it was: Buyers until its buyers check passed (the board still counts it as saved).
  assert.deepEqual([lineLeadState(leadsOf([card('L110', {owner: 'saved', decision: 'PARK: x'})])[0]), by('L110').outcome.kind, by('L110').stepName, by('L110').line[1].state], ['parked', 'parked', 'Buyers', 'stopped']);
  const parkedLater = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([card('L112', {owner: 'saved', screen: 6, buyers: true, decision: 'PARK: no source'})])})[0];
  assert.deepEqual([parkedLater.stepName, parkedLater.line[1].state, parkedLater.line[2].state], ['Prove it', 'done', 'stopped']);
  assert.equal(by('L111').outcome.kind, 'killed');
  assert.ok(items.every(item => item.round === 4 && item.roundId === 'R04'));
});

test('P1 Room on Meta failed: the product fails at P1 on its own; reopened, the checker tries the next avatar, never the preflight', () => {
  // L101, Oct 3: Meta saturated for its main avatar. Owner: "if the checks dont pass. you can fail the product".
  const failedRoom = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([card('L120', {owner: 'saved', screen: 6, buyers: true, gates: 1, gateFailed: ['competition']})])})[0];
  assert.deepEqual([failedRoom.stepName, failedRoom.status, failedRoom.outcome.kind, failedRoom.outcome.label, failedRoom.who], ['Prove it', 'Failed at P1', 'failed', 'Failed at P1 · Room on Meta', '']);
  assert.deepEqual([failedRoom.line[1].state, failedRoom.line[2].state], ['done', 'stopped']);
  const reopened = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([reopenCandidate(card('L120', {owner: 'saved', screen: 6, buyers: true, gates: 1, gateFailed: ['competition']}), failedRoom.outcome.check.mark)])})[0];
  assert.deepEqual([reopened.outcome, reopened.stepName, reopened.status, reopened.who], [null, 'Prove it', 'Reopened · re-check P1', 'checker']);
  assert.match(reopened.next, /try the next avatar or angle from Buyers/);
  assert.doesNotMatch(reopened.next, /preflight/);
  // Without the failure, the checker's preflight is still next.
  const open = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([card('L121', {owner: 'saved', screen: 6, buyers: true, gates: 1})])})[0];
  assert.deepEqual([open.who, open.next], ['checker', 'Checker: the supplier and profit preflight (Source & profit).']);
  // Before the buyers check passes, the Meta check is not open yet, so a stray failure does not jump the line.
  const early = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([card('L122', {owner: 'saved', screen: 6, gateFailed: ['competition']})])})[0];
  assert.equal(early.stepName, 'Buyers');
});

test('a card with a product record takes the product\'s own checks; only the build slot holder passes Prove it', () => {
  const reviewed = id => card(id, {owner: 'saved', screen: 8, gates: 5, buyers: true});
  const leads = leadsOf([reviewed('L201'), reviewed('L202'), reviewed('L203'), reviewed('L204'), reviewed('L205'), card('L206', {owner: 'saved', screen: 2}), reviewed('L207'), reviewed('L208')]);
  const products = [
    product('P001-recording', 'L201', verified(['exact-product', 'buyer-situation'])),
    product('P002-sourcing', 'L202', verified(upTo('validation'))),
    product('P003-ready', 'L203', verified(upTo('sourcing'))),
    product('P004-building', 'L204', verified([...upTo('sourcing'), 'claims-rights'])),
    product('P006-early', 'L206', {}, {verificationGate: {ready: false, reason: 'Link an owner-saved research card with all seven pre-verification checks supported.'}}),
    product('P007-parked', 'L207', verified(upTo('validation')), {status: 'parked', reason: 'Supplier stopped answering.'}),
  ];
  const archived = [product('P008-done', 'L208', verified(upTo('sourcing')))];
  const reviews = [{productId: 'P008-done', outcome: 'stopped', date: '2026-09-29T10:00:00.000Z', whatFailed: 'Delivery could not be promised.', nextChanges: 'Ask for a quote first.'}];
  const state = pipelineState({leads, products, archivedProducts: archived, reviews, stages: STAGES, checks: CHECKS, rounds: [pilotRound], buildProductId: 'P004-building'});
  const by = id => state.items.find(item => item.id === id);
  assert.deepEqual([by('L201').productId, by('L201').stepName, by('L201').status], ['P001-recording', 'Prove it', 'Recording the product record (2/12)']);
  assert.match(by('L201').next, /^Checker: record "Trend onset & product history"/);
  assert.deepEqual([by('L202').stepName, by('L202').status, by('L202').line[2].state, by('L202').line[1].state], ['Prove it', 'Prove it · checks 7/12', 'current', 'done']);
  assert.deepEqual([by('L203').readyToBuild, by('L203').who, by('L203').line[3].state], [true, 'manager', 'waiting']);
  assert.match(by('L203').next, /waits for the build slot \(Product P004-building is building\)/);
  assert.deepEqual([by('L204').building, by('L204').stepName, by('L204').status, by('L204').who], [true, 'Create', 'Building · Create 1/3 checks', 'image-maker']);
  assert.equal(by('L205').status, 'Prove it 2/5', 'no product yet: P4 still owes its new part');
  assert.deepEqual([by('L206').stepName, by('L206').status], ['Buyers', 'Buyers · pending · Find 2/6'], 'the card drives the line until its own checks are complete');
  assert.deepEqual([by('L207').outcome.kind, by('L207').outcome.reason], ['product-parked', 'Supplier stopped answering.']);
  assert.deepEqual([by('L208').outcome.kind, by('L208').outcome.label, by('L208').outcome.on], ['archived', 'Cycle reviewed · stopped', '2026-09-29']);
  assert.deepEqual(state.counts, {product: 0, buyers: 1, prove: 3, ready: 1, create: 1, build: 0, launch: 0, learn: 0, active: 6, out: 2, total: 8});
  assert.equal(state.building.id, 'L204'); assert.equal(state.buildProductId, 'P004-building');
  assert.deepEqual([state.focus.kind, state.focus.itemId, state.focus.stepIndex], ['building', 'L204', 3], 'the building product is the focus');
  assert.deepEqual(state.ownerMoves, [], 'a ready product waits while the slot is taken');
  assert.equal(findItem(state, 'P003').id, 'L203'); assert.equal(findItem(state, 'P003-ready').id, 'L203'); assert.equal(findItem(state, 'L999'), null);
});

test('the focus: the building product, then owner moves (build pick before eye test), then the earliest product, else start a round', () => {
  const base = {stages: STAGES, checks: CHECKS, rounds: [pilotRound]};
  const ready = leadsOf([card('L301', {owner: 'saved', screen: 8, gates: 5, buyers: true}), card('L302')]);
  let state = pipelineState({...base, leads: ready, products: [product('P001-ready', 'L301', verified(upTo('sourcing')))]});
  assert.deepEqual(state.ownerMoves.map(move => move.kind), ['build-pick', 'eye-test']);
  assert.deepEqual([state.focus.kind, state.focus.who, state.focus.stepIndex], ['owner', 'owner', 2]);
  assert.match(state.focus.next, /^Owner: pick which product builds next: L301 \("Build this one" on its page, with a reason\)\.$/);
  assert.match(state.ownerMoves[0].text, /^Pick which product builds next: L301 Product P001-ready \("Build this one", with a reason\)$/);
  state = pipelineState({...base, leads: leadsOf([card('L302')])});
  assert.match(state.focus.next, /^Owner: eye test on 1 card \(Find page\): L302\.$/);
  state = pipelineState({...base, leads: leadsOf([card('L303', {owner: 'saved', screen: 1}), card('L304', {owner: 'saved', screen: 8, gates: 5, buyers: true})]), products: [product('P002-src', 'L304', verified(upTo('validation')))]});
  assert.deepEqual([state.focus.kind, state.focus.itemId, state.focus.who, state.focus.stepIndex], ['item', 'L303', 'buyer-researcher', 1], 'the earliest product on the line: a saved card at Buyers');
  // Every card of the open round left the line: Claude reviews it, then the next round starts.
  state = pipelineState({...base, leads: leadsOf([card('L305', {owner: 'rejected'})])});
  assert.deepEqual([state.focus.kind, state.focus.who], ['review-round', 'manager']); assert.match(state.focus.next, /review Round 4 \(os\.mjs round review R04\), then start Round 5/);
  // An open round with no cards is being searched: never "start Round 5" (owner, Oct 1).
  state = pipelineState({...base, leads: []});
  assert.deepEqual([state.focus.kind, state.focus.who, state.focus.roundNumber], ['round-open', 'scout', 4]);
  assert.equal(state.focus.text, 'Round 4 is open: no cards yet'); assert.doesNotMatch(state.focus.next, /start Round/);
  // Only once the round is reviewed does the focus start the next one.
  // It starts from a passed issue (Step 1): Claude starts it; with no passed issue, the buyer researcher researches one first.
  const reviewedRound = [{...pilotRound, review: {reviewedOn: '2026-09-28', whatWorked: 'w', whatFailed: 'f', nextChanges: 'n'}}];
  // Owner, Oct 2: the next round starts where the sales numbers are hitting; it needs no issue.
  state = pipelineState({...base, rounds: reviewedRound, leads: leadsOf([card('L305', {owner: 'rejected'})])});
  assert.deepEqual([state.focus.kind, state.focus.who, state.focus.stepIndex], ['start-round', 'scout', 0]); assert.match(state.focus.next, /^Scout: start Round 5 where the sales numbers are hitting/);
  // Launch approval is the owner's move on the building product.
  const launch = {...verified(CHECKS.filter(check => check.id !== 'authorized-test' && check.id !== 'result' && check.id !== 'case-review').map(check => check.id))};
  state = pipelineState({...base, leads: leadsOf([card('L306', {owner: 'saved', screen: 8, gates: 5, buyers: true}), card('L307')]), products: [product('P003-live', 'L306', launch)], buildProductId: 'P003-live'});
  assert.deepEqual(state.ownerMoves.map(move => move.kind), ['launch', 'eye-test']);
  assert.equal(state.focus.kind, 'building'); assert.equal(state.building.who, 'owner'); assert.match(state.building.next, /^Owner: approve the test/);
});

test('rounds: a card belongs to the earliest round whose folder it uses; review waits until none are at Product or Prove it', () => {
  const r1 = {number: 1, startedOn: '2026-09-15', focus: 'First', folders: ['research/2026-09-15-first/', 'research/2026-09-15-more/']};
  const r2 = {number: 2, startedOn: '2026-09-16', focus: 'Second', folders: ['research/2026-09-16-wow/']};
  assert.equal(roundOf(['research/2026-09-16-wow/L010.md', 'research/2026-09-15-more/x.md'], [r2, r1]).number, 1);
  assert.equal(roundOf(['research/2026-09-30-other/L1.md'], [r1, r2]), null);
  assert.equal(roundOf(['research/2026-09-15-first-extra/L1.md'], [r1]), null, 'a folder matches whole, with its slash');
  const leads = leadsOf([card('L001', {folder: 'research/2026-09-15-first/', decision: 'PARK: old'}), card('L002', {folder: 'research/2026-09-16-wow/'}), card('L003', {folder: 'research/2026-09-30-other/', decision: 'KILL'})]);
  const state = pipelineState({leads, stages: STAGES, checks: CHECKS, rounds: [r1, r2]});
  assert.deepEqual(state.rounds.map(round => [round.id, round.cards, round.inProductProve, round.canReview, round.needsReview]), [['R01', 1, 0, true, true], ['R02', 1, 1, false, false]]);
  assert.equal(state.round.id, 'R02', 'the current round is the newest open one');
  assert.equal(state.earlier, 1);
  assert.deepEqual(roundBlockers(state.items, 2).map(item => item.id), ['L002']);
  assert.equal(roundId(7), 'R07'); assert.equal(roundId(12), 'R12');
});

test('each agent gets the products waiting at its steps; the brief blocks stay within their word caps', async () => {
  const line = await realLine();
  const long = n => ({...card(`L${400 + n}`, {owner: n % 3 ? 'unreviewed' : 'saved', screen: 6}), name: `A very long product name for card number ${n} with many extra words in it`});
  const leads = buildLeads({candidates: Array.from({length: 30}, (_, n) => long(n))}, {batches: []});
  const step = currentStep({line, stages: STAGES, checks: CHECKS, leads, rounds: [{...pilotRound, focus: 'A long round focus '.repeat(12)}]});
  for (const agent of ['manager', 'scout', 'checker', 'buyer-researcher', 'copywriter', 'image-maker', 'store-builder']) {
    const blocks = briefBlocks(step, {agent, line, names: {scout: 'Product scout', checker: 'Product checker'}});
    assert.ok(words(blocks.pipeline) <= PIPELINE_BLOCK_WORDS, `${agent}: pipeline block is ${words(blocks.pipeline)} words`);
    assert.ok(words(blocks.step) <= STEP_BLOCK_WORDS, `${agent}: step block is ${words(blocks.step)} words`);
    assert.equal((blocks.pipeline.match(/^- L\d{3} /gm) || []).length, PIPELINE_ROWS);
  }
  // Saved cards wait at Step 2 · Buyers (owner, Oct 2): the buyer researcher's products; nothing is at Prove it yet.
  const researcher = briefBlocks(step, {agent: 'buyer-researcher', line});
  assert.match(researcher.pipeline, /\*\*Yours\*\* \(Buyers\): L427, L424, L421, L418, L415, L412 and 4 more\./);
  assert.match(researcher.pipeline, /- …and 24 more: `os\.mjs pipeline`/);
  assert.match(researcher.step, /^## Your step: Step 2 of 7 · Buyers\n/); assert.match(researcher.step, /- \*\*Now:\*\* L427 A very long product name for card numbe…: Buyers · pending./);
  const checker = briefBlocks(step, {agent: 'checker', line});
  assert.match(checker.pipeline, /\*\*Yours\*\* \(Prove it\): nothing waits at your steps right now\./);
  assert.match(checker.step, /^## Your step: Step 3 of 7 · Prove it\n[\s\S]*Nothing waits at Prove it for you right now/);
  const scout = briefBlocks(step, {agent: 'scout', line});
  assert.match(scout.step, /^## Your step: Step 1 of 7 · Product\n/); assert.equal(scout.view.item.who, 'owner');
  const copy = briefBlocks(step, {agent: 'copywriter', line});
  assert.match(copy.pipeline, /\*\*Yours\*\* \(Create\): nothing waits at your steps right now\./);
  assert.match(copy.step, /^## Your step: Step 4 of 7 · Create\n[\s\S]*Nothing waits at Create for you right now/);
  assert.equal(agentFocus(step.pipeline, 'checker').index, 2);
  assert.equal(agentFocus(step.pipeline, 'buyer-researcher').index, 1);
  assert.equal(agentFocus({active: []}, 'buyer-researcher').id, 'buyers', 'nothing waiting: the buyer researcher\'s step is still Buyers');
  const manager = pipelineMarkdown(step.pipeline, {line});
  assert.match(manager, /^## The pipeline · Round 4\n\n- \*\*Round 4\*\* \(started 2026-09-26\): A long round focus/);
  assert.match(manager, /- \*\*On the line:\*\* Product 20 · Buyers 10\. Out of the line: 0\./);
  assert.match(manager, /- \*\*Build slot:\*\* empty; nothing is building\./);
});

test('prompts fill [product], [country] and [L###] for one product and keep other blanks', async () => {
  const line = await realLine();
  assert.equal(fillPrompt('Check [L### cards] for [country]: [product] at [$ price].', {product: 'Story player', country: 'US', lead: 'L096'}), 'Check L096 for US: Story player at [$ price].');
  assert.equal(fillPrompt('Find [product]', {}), 'Find [product]');
  const item = pipelineItems({leads: leadsOf([card('L096', {owner: 'saved', screen: 6})]), stages: STAGES, checks: CHECKS})[0];
  const view = itemStep(item, line);
  assert.equal(view.name, 'Buyers'); assert.equal(view.status, 'L096 Card L096: Buyers · pending');
  assert.match(fillPrompt(view.guide.prompts[0].text, {product: item.name, country: item.country, lead: item.id}), /^Research the buyers of Card L096 \(L096\): its TikTok comments/);
});

test('rounds: start, review only when finished, import skips saved rounds and refuses an unfinished review', () => {
  const day = new Date('2026-10-01T15:00:00Z');
  const none = () => [];
  // Owner, Oct 3: a round that names an issue needs one the owner is Testing (step 0).
  const passedIssue = {slug: 'pets', title: 'Pets', status: 'testing', verified: true, gate: {items: [], done: 5, total: 5}, gatePassed: true};
  let {rounds: record, saved} = updateRounds(emptyRounds(), {revision: 0, action: 'start', issue: 'pets', focus: 'Pets for Canada', folders: ['research/2026-10-01-pets']}, {now: day, blockersFor: none, issues: [passedIssue]});
  assert.equal(saved.issue, 'pets');
  assert.deepEqual([saved.id, saved.number, saved.startedOn, saved.folders, record.revision], ['R01', 1, '2026-10-01', ['research/2026-10-01-pets/'], 1]);
  assert.throws(() => updateRounds(record, {revision: 1, action: 'start', issue: 'pets', focus: 'Again', folders: ['research/2026-10-01-pets/']}, {now: day, issues: [passedIssue]}), e => e.code === 'ROUND_FOLDER_TAKEN');
  assert.throws(() => updateRounds(record, {revision: 1, action: 'start', issue: 'pets', focus: 'Bad', folders: ['../etc/']}, {now: day, issues: [passedIssue]}), /research batch folder/);
  assert.throws(() => updateRounds(record, {revision: 0, action: 'start', focus: 'Stale', folders: ['research/x/']}, {now: day}), e => e.status === 409);
  const review = {revision: 1, action: 'review', id: 'R01', whatWorked: 'Real cards fast.', whatFailed: 'Few buyer reasons.', nextChanges: 'Start from a buyer situation.'};
  assert.throws(() => updateRounds(record, review, {now: day, blockersFor: () => [{id: 'L401'}, {id: 'L402'}]}), e => e.code === 'ROUND_NOT_FINISHED' && /L401, L402/.test(e.message) && e.details.blockers.length === 2);
  ({rounds: record} = updateRounds(record, review, {now: day, blockersFor: none}));
  assert.equal(record.rounds[0].review.reviewedOn, '2026-10-01');
  assert.throws(() => updateRounds(record, {...review, revision: 2}, {now: day}), e => e.code === 'ROUND_REVIEWED');
  const seed = [
    {number: 1, startedOn: '2026-09-15', focus: 'Taken', folders: ['research/2026-09-15-a/']},
    {number: 2, startedOn: '2026-09-16', focus: 'History', folders: ['research/2026-09-16-b/'], review: {reviewedOn: '2026-09-17', whatWorked: 'w', whatFailed: 'f', nextChanges: 'n'}},
    {number: 3, startedOn: '2026-09-26', focus: 'Open', folders: ['research/2026-09-26-c/']},
  ];
  const imported = updateRounds(record, {revision: 2, action: 'import', rounds: seed}, {now: day, blockersFor: none});
  assert.deepEqual([imported.imported, imported.skipped, imported.rounds.revision, imported.rounds.rounds.map(round => round.id)], [['R02', 'R03'], ['R01'], 3, ['R01', 'R02', 'R03']]);
  const again = updateRounds(imported.rounds, {revision: 3, action: 'import', rounds: seed}, {now: day});
  assert.deepEqual([again.imported, again.skipped, again.rounds.revision], [[], ['R01', 'R02', 'R03'], 3], 'nothing new, nothing written');
  assert.throws(() => updateRounds(record, {revision: 2, action: 'import', rounds: seed}, {now: day, blockersFor: (rounds, number) => number === 2 ? [{id: 'L777'}] : []}), e => e.code === 'ROUND_NOT_FINISHED');
  // An open round's focus can change (the owner changed the niche mid-round); a reviewed round keeps its focus.
  const open = imported.rounds.rounds.find(round => !round.review);
  const changed = updateRounds(imported.rounds, {revision: imported.rounds.revision, action: 'focus', id: open.id, focus: 'Sleep, energy and focus'}, {now: day});
  assert.deepEqual([changed.saved.id, changed.saved.focus, changed.rounds.revision], [open.id, 'Sleep, energy and focus', imported.rounds.revision + 1]);
  assert.deepEqual(changed.saved.folders, open.folders, 'only the focus changes');
  assert.throws(() => updateRounds(changed.rounds, {revision: imported.rounds.revision, action: 'focus', id: open.id, focus: 'Stale'}, {now: day}), e => e.status === 409, 'revision-checked');
  assert.throws(() => updateRounds(changed.rounds, {revision: changed.rounds.revision, action: 'focus', id: 'R01', focus: 'Rewrite history'}, {now: day}), e => e.code === 'ROUND_REVIEWED');
  assert.throws(() => updateRounds(changed.rounds, {revision: changed.rounds.revision, action: 'focus', id: open.id, focus: '  '}, {now: day}), /new focus or an issue/);
  assert.throws(() => updateRounds(changed.rounds, {revision: changed.rounds.revision, action: 'focus', id: 'R99', focus: 'x'}, {now: day}), e => e.code === 'NOT_FOUND');
  assert.throws(() => validateRounds({revision: 1, rounds: [seed[1], {...seed[2], folders: ['research/2026-09-16-b/']}].map(round => ({...round, id: roundId(round.number)}))}), /belongs to two rounds/);
  assert.match(roundsMarkdown(imported.rounds), /## R03 · Round 3 · started 2026-09-26\n\nOpen\n\nFolders: research\/2026-09-26-c\/\n\nOpen\./);
});

test('the doctor: round to review, owner pick, quiet products, one product per card, a quiet build, unlinked products', async () => {
  const line = await realLine();
  const facts = step => ({now: new Date('2026-10-01T15:00:00Z'), today: '2026-10-01', errors: {}, line, step, planner: {tasks: []}, activity: []});
  const look = report => report.checks.find(check => check.id === 'pipeline').findings.filter(item => item.status === 'look').map(item => item.text);
  const done = {number: 1, startedOn: '2026-09-15', focus: 'Old', folders: ['research/2026-09-15-old/']};
  const quiet = {number: 2, startedOn: '2026-09-20', focus: 'Quiet', folders: ['research/2026-09-20-quiet/']};
  const leads = leadsOf([card('L001', {folder: 'research/2026-09-15-old/', decision: 'PARK: x'}), card('L002', {folder: 'research/2026-09-20-quiet/', owner: 'saved'}),
    card('L003', {owner: 'saved', screen: 8, gates: 5, buyers: true}), card('L004', {owner: 'saved', screen: 8, gates: 5, buyers: true})]);
  const products = [product('P001-ready', 'L003', verified(upTo('sourcing'))), product('P002-unlinked', '', {}), product('P005-dupe', 'L004', verified(upTo('validation'))), product('P006-dupe', 'L004', {})];
  let report = doctorReport(facts(currentStep({line, stages: STAGES, checks: CHECKS, leads, products, rounds: [done, quiet]})));
  const texts = look(report);
  assert.ok(texts.some(text => /^R01 \(Round 1\) has no cards left at Product, Buyers or Prove it/.test(text)), texts.join('\n'));
  assert.ok(texts.some(text => /1 product is ready to build and the build slot is empty: L003 Product P001-ready/.test(text)));
  assert.ok(texts.some(text => /1 product at Product, Buyers or Prove it has no recorded activity for 7 days: L002 \(Buyers, last Sep 20 /.test(text)));
  assert.ok(texts.some(text => /L004 is linked to 2 products; there is one product per card/.test(text)));
  assert.ok(texts.some(text => /1 product was not started from a card, so its checks cannot count: P002-unlinked/.test(text)));
  assert.match(report.checks.find(check => check.id === 'pipeline').findings.find(item => /round review R01/.test(item.fix || '')).fix, /--worked/);
  // A task naming the quiet product counts as activity; a quiet building product is flagged.
  const fresh = {...facts(currentStep({line, stages: STAGES, checks: CHECKS, leads: leadsOf([card('L002', {folder: 'research/2026-09-20-quiet/', owner: 'saved'})]), rounds: [quiet]})), planner: {tasks: [{id: 'T-1', product: 'L002', updatedAt: '2026-09-30T12:00:00.000Z'}]}};
  assert.deepEqual(look(doctorReport(fresh)), []);
  const building = currentStep({line, stages: STAGES, checks: CHECKS, leads: leadsOf([card('L003', {owner: 'saved', screen: 8, gates: 5, buyers: true})]), products: [{...product('P001-ready', 'L003', verified(upTo('sourcing'))), updatedAt: '2026-09-10T12:00:00.000Z'}], buildProductId: 'P001-ready'});
  assert.ok(look(doctorReport(facts(building))).some(text => /P001-ready has been building with no update for 7 days/.test(text)));
  report = doctorReport(facts(currentStep({line, stages: STAGES, checks: CHECKS, leads: leadsOf([card('L010')]), rounds: [pilotRound]})));
  assert.deepEqual(look(report), []);
  assert.match(report.checks.find(check => check.id === 'pipeline').findings[0].text, /^Round 4 · 1 product on the line · build slot empty · nothing stuck\.$/);
});

/* ---------- Through the store and the API, in a temporary workspace ---------- */

async function workspace(t, candidates = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-pipeline-')); await fs.mkdir(path.join(root, 'resources/issues/sleep'), {recursive: true}); await fs.writeFile(path.join(root, 'resources/issues/sleep/ISSUE.md'), '# Issue: Fixture sleep issue\n');
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-pipeline-')); await fs.rm(root, {recursive: true, force: true}); });
  for (const dir of ['workflow', 'research/2026-09-26-pilot', 'products', 'store']) await fs.mkdir(path.join(root, dir), {recursive: true});
  await fs.copyFile(path.resolve(here, '../../workflow/the-line.json'), path.join(root, 'workflow/the-line.json'));
  await fs.writeFile(path.join(root, `${PILOT}evidence.md`), '# Isolated fixture evidence, not product proof\n');
  await fs.writeFile(path.join(root, 'products/INDEX.md'), '# Isolated products\n');
  await fs.mkdir(path.join(root, 'agents'), {recursive: true});
  await fs.writeFile(path.join(root, 'agents/team.json'), JSON.stringify({agents: ['scout', 'checker', 'copywriter', 'image-maker', 'store-builder'].map(id => ({id, role: 'validation', name: id, summary: 'Fixture agent.'}))}));
  await fs.writeFile(path.join(root, 'research/comparison.json'), JSON.stringify({revision: 1, minimumReviews: 5, targetReviews: 10, candidates}));
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, method = 'GET', value, origin = 'http://localhost:3000') => new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: {Host: 'localhost:3000', ...(method === 'GET' ? {} : {...(origin ? {Origin: origin} : {}), 'Content-Type': 'application/json'})}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => { const body = Buffer.concat(chunks).toString('utf8'); resolve({status: res.statusCode, data: body ? JSON.parse(body) : null}); });
    });
    req.on('error', reject); req.end(value === undefined ? undefined : JSON.stringify(value));
  });
  return {root, store: createStore({workspaceRoot: root}), request, port: server.address().port};
}
const proof = id => ({id, status: 'verified', note: 'Isolated fixture observation for this exact item.', source: id === 'exact-source' ? 'https://www.aliexpress.com/item/1.html' : 'https://example.com/evidence', evidenceType: id === 'result' ? 'our result' : 'observed', observedAt: '2026-09-25', window: '2026-09-01 to 2026-09-25'});
async function verify(store, id, ids) {
  let record = await store.getProduct(id);
  for (const check of ids) record = await store.patchProduct(id, {revision: record.revision, marketId: record.markets[0].id, check: proof(check)});
  return record;
}

test('product start: only from a card the owner saved, one product per card, bound to the card\'s listing and country', async t => {
  const {store, root} = await workspace(t, [card('L501'), card('L502', {owner: 'saved', screen: 8, gates: 5, country: 'Canada', buyers: true}), card('L503', {owner: 'saved', screen: 6, decision: 'PARK: no source'}), card('L504', {owner: 'passed'})]);
  await assert.rejects(store.createProduct({leadId: 'L999'}), e => e.code === 'NOT_FOUND');
  await assert.rejects(store.createProduct({leadId: 'L501'}), e => e.code === 'LEAD_NOT_SAVED' && /eye test is the owner/.test(e.message));
  await assert.rejects(store.createProduct({leadId: 'L504'}), e => e.code === 'LEAD_NOT_SAVED' && /passed/.test(e.message));
  await assert.rejects(store.createProduct({leadId: 'L503'}), e => e.code === 'LEAD_OUT_OF_LINE');
  await assert.rejects(store.createProduct({leadId: 'bad'}), e => e.code === 'INVALID_RESEARCH_BINDING');
  const created = await store.createProduct({leadId: 'L502'});
  assert.match(created.id, /^P001-card-l502$/);
  assert.deepEqual([created.markets[0].researchCandidateId, created.markets[0].country, created.sourceUrl, created.variant], ['L502', 'Canada', 'https://example.com/item/L502', 'L502 variant']);
  assert.equal(created.markets[0].verificationGate.ready, true, 'its checks can be recorded from the card');
  assert.equal(created.markets[0].verifiedCount, 0, 'nothing is copied as verified');
  await assert.rejects(store.createProduct({leadId: 'L502'}), e => e.code === 'LEAD_HAS_PRODUCT' && e.details.productId === created.id);
  const other = await store.createProduct({name: 'Unlinked legacy', country: 'US'});
  await assert.rejects(store.patchProduct(other.id, {revision: other.revision, marketId: other.markets[0].id, market: {researchCandidateId: 'L502'}}), e => e.code === 'LEAD_HAS_PRODUCT');
  const pipeline = (await store.getPipeline()).pipeline;
  assert.equal(findItem(pipeline, 'L502').productId, created.id);
  assert.equal(findItem(pipeline, other.id).unlinked, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, `products/${created.id}/os-product.json`), 'utf8')).activity.at(-1).type, 'started-from-card');
});

test('the build slot: the owner picks one ready product with a reason; Create checks need the slot; the review frees it', async t => {
  const {store, request} = await workspace(t, [card('L601', {owner: 'saved', screen: 8, gates: 5, buyers: true}), card('L602', {owner: 'saved', screen: 8, gates: 5, buyers: true})]);
  const first = await store.createProduct({leadId: 'L601'}), second = await store.createProduct({leadId: 'L602'});
  const sourceDone = upTo('sourcing');
  let ws = await store.getWorkspace();
  await assert.rejects(store.pickBuild({revision: ws.revision, productId: first.id, reason: 'Best margin'}), e => e.code === 'SOURCE_NOT_DONE');
  let a = await verify(store, first.id, sourceDone);
  await verify(store, second.id, sourceDone);
  await assert.rejects(store.patchProduct(first.id, {revision: a.revision, marketId: a.markets[0].id, check: proof('claims-rights')}), e => e.code === 'BUILD_SLOT_REQUIRED' && /slot is empty/.test(e.message));
  let pipe = (await store.getPipeline()).pipeline;
  assert.deepEqual(pipe.ownerMoves.map(move => move.kind), ['build-pick']); assert.equal(pipe.counts.ready, 2);
  await assert.rejects(store.pickBuild({revision: ws.revision, productId: first.id, reason: '  '}), /reason/);
  assert.equal((await request('/api/workspace/build', 'POST', {revision: ws.revision, productId: first.id, reason: 'Best margin'}, '')).status, 403, 'local Origin only');
  const picked = await request('/api/workspace/build', 'POST', {revision: ws.revision, productId: first.id, reason: 'Best margin and a clear buyer'});
  assert.equal(picked.status, 200);
  assert.deepEqual([picked.data.buildProductId, picked.data.activeProductId, picked.data.build.reason, picked.data.build.by], [first.id, first.id, 'Best margin and a clear buyer', 'owner']);
  ws = await store.getWorkspace();
  await assert.rejects(store.pickBuild({revision: ws.revision, productId: second.id, reason: 'Also good'}), e => e.code === 'BUILD_SLOT_TAKEN' && e.details.productId === first.id);
  a = await store.getProduct(first.id);
  a = await store.patchProduct(first.id, {revision: a.revision, marketId: a.markets[0].id, check: proof('claims-rights')});
  const b = await store.getProduct(second.id);
  await assert.rejects(store.patchProduct(second.id, {revision: b.revision, marketId: b.markets[0].id, check: proof('claims-rights')}), e => e.code === 'BUILD_SLOT_REQUIRED' && new RegExp(`${first.id} is building now`).test(e.message));
  const step = await store.getStep();
  assert.deepEqual([step.current.id, step.current.product.id, step.pipeline.building.status], ['create', first.id, 'Building · Create 1/3 checks']);
  assert.match(step.markdown, /- \*\*Build slot:\*\* P001-card-l601 Card L601 \(US\) · Create\./);
  assert.match((await store.getBrief('copywriter')).markdown, /\*\*Yours\*\* \(Create\): L601\./);
  const reviewed = await store.reviewWorkspaceCycle({revision: ws.revision, productRevision: a.revision, productId: first.id, outcome: 'stopped', whatWorked: 'Fixture.', whatFailed: 'Fixture stop.', nextChanges: 'Pick the next ready one.', evidence: [`products/${first.id}/OS.md`]});
  assert.deepEqual([reviewed.buildProductId, reviewed.activeProductId, reviewed.build], [null, null, null]);
  pipe = (await store.getPipeline()).pipeline;
  assert.equal(findItem(pipe, 'L601').outcome.kind, 'archived'); assert.deepEqual(pipe.ownerMoves.map(move => move.kind), ['build-pick']);
});

test('launched early: a building product before Prove it is done works at Create; its earlier steps stay open', () => {
  const base = {stages: STAGES, checks: CHECKS, rounds: [pilotRound]};
  let state = pipelineState({...base, leads: leadsOf([card('L320', {owner: 'saved', screen: 3})]), products: [product('P020-fast', 'L320', verified(upTo('validation')))], buildProductId: 'P020-fast'});
  const item = findItem(state, 'L320');
  assert.deepEqual([item.building, item.early, item.stepName, item.readyToBuild], [true, true, 'Create', false]);
  assert.deepEqual(item.line.map(step => step.state), ['done', 'early', 'early', 'current', 'todo', 'todo', 'todo'], 'its card has no buyers check yet: Buyers stays open (launched early)');
  assert.match(item.status, /^Building early · Create 0\/\d+$/); assert.ok(item.status.length <= 40, 'short status (LS-085)');
  assert.equal(state.focus.kind, 'building'); assert.equal(state.counts.create, 1);
  // A product with nothing recorded yet: Prove it stays open (the card's Product step is behind it, with its real count).
  state = pipelineState({...base, leads: leadsOf([card('L321', {owner: 'saved', screen: 1})]), products: [product('P021-fresh', 'L321')], buildProductId: 'P021-fresh'});
  assert.deepEqual(findItem(state, 'L321').line.map(step => step.state).slice(0, 4), ['done', 'early', 'early', 'current']);
  assert.deepEqual([findItem(state, 'L321').line[0].done, findItem(state, 'L321').line[0].total], [1, 6], 'never assumed 6/6');
  // Without the slot the same product waits at Buyers for its card's buyers check, not building.
  state = pipelineState({...base, leads: leadsOf([card('L320', {owner: 'saved', screen: 3})]), products: [product('P020-fast', 'L320', verified(upTo('validation')))]});
  assert.deepEqual([findItem(state, 'L320').early, findItem(state, 'L320').stepName, findItem(state, 'L320').building], [false, 'Buyers', false], 'its card has no buyers check yet');
});

test('fast launch through the API: the owner builds a saved card early with a reason; open checks are saved with the pick', async t => {
  const {store, request} = await workspace(t, [card('L801', {owner: 'saved', screen: 3}), card('L802'), card('L803', {owner: 'saved', screen: 2})]);
  let ws = await store.getWorkspace();
  const pick = (body) => request('/api/workspace/build', 'POST', {revision: ws.revision, reason: 'Launch tonight', ...body});
  let res = await pick({leadId: 'L801'});
  assert.deepEqual([res.status, res.data.code], [409, 'SOURCE_NOT_DONE'], 'no override: Prove it must be done');
  res = await pick({leadId: 'L802', override: true});
  assert.deepEqual([res.status, res.data.code], [409, 'LEAD_NOT_SAVED'], 'never without the owner Save');
  res = await pick({leadId: 'L801', override: true, reason: ' '});
  assert.equal(res.status, 400, 'a reason is required');
  assert.equal((await request('/api/workspace/build', 'POST', {revision: ws.revision, leadId: 'L801', override: true, reason: 'x'}, 'http://evil.example')).status, 403, 'local Origin only');
  assert.equal((await store.getPipeline()).pipeline.items.filter(item => item.productId).length, 0, 'refused picks start nothing');
  res = await pick({leadId: 'L801', override: true});
  assert.equal(res.status, 200);
  const build = res.data.build;
  assert.deepEqual([build.override, build.reason, build.by], [true, 'Launch tonight', 'owner']);
  assert.ok(build.missing.length > 0 && build.missing.every(id => CHECKS.some(check => check.id === id && stageAt(check.stage) < 3)), 'the open Find, Validate and Source checks');
  const item = findItem((await store.getPipeline()).pipeline, 'L801');
  assert.deepEqual([item.building, item.early, item.stepName, item.productId], [true, true, 'Create', build.productId]);
  ws = await store.getWorkspace();
  res = await pick({leadId: 'L803', override: true});
  assert.deepEqual([res.status, res.data.code], [409, 'BUILD_SLOT_TAKEN'], 'still one build slot');
  assert.equal(findItem((await store.getPipeline()).pipeline, 'L803').productId, '', 'no product started for a refused pick');
});

test('rounds through the API: ROUNDS.md, START-HERE names the round, review refused while cards wait', async t => {
  const {store, request, root} = await workspace(t, [card('L701'), card('L702', {folder: 'research/2026-09-15-old/', decision: 'PARK: old'})]);
  let saved = await request('/api/rounds', 'POST', {revision: 0, action: 'import', rounds: [{number: 1, startedOn: '2026-09-15', focus: 'Old round', folders: ['research/2026-09-15-old/'], review: {reviewedOn: '2026-09-17', whatWorked: 'w', whatFailed: 'f', nextChanges: 'n'}}, {number: 4, startedOn: '2026-09-26', focus: 'Pilot', folders: [PILOT]}]});
  assert.equal(saved.status, 200); assert.deepEqual(saved.data.imported, ['R01', 'R04']);
  assert.equal((await request('/api/rounds', 'POST', {revision: 1, action: 'start', focus: 'x', folders: ['research/y/']}, 'http://evil.example')).status, 403);
  const blocked = await request('/api/rounds', 'POST', {revision: 1, action: 'review', id: 'R04', whatWorked: 'w', whatFailed: 'f', nextChanges: 'n'});
  assert.equal(blocked.status, 409); assert.equal(blocked.data.code, 'ROUND_NOT_FINISHED'); assert.match(blocked.data.error, /L701/);
  const list = await request('/api/rounds');
  assert.deepEqual(list.data.summary.map(round => [round.id, round.cards, round.open]), [['R01', 1, false], ['R04', 1, true]]);
  const startHere = await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8');
  assert.match(startHere, /; rounds revision 1\. Journal timezone/); assert.match(startHere, /## The pipeline · Round 4\n\n- \*\*Round 4\*\* \(started 2026-09-26\): Pilot/);
  assert.match(await fs.readFile(path.join(root, 'memory/ROUNDS.md'), 'utf8'), /## R04 · Round 4 · started 2026-09-26[\s\S]*Cards: 1 \(1 on the line, 0 out of the line, 1 still at Product, Buyers or Prove it\)\.\n\nOpen\./);
  // The owner rejects L701: the round can be reviewed.
  const research = await store.getResearch();
  const rejected = structuredClone(research.candidates.find(c => c.id === 'L701')); rejected.screen.ownerDecision = 'rejected'; rejected.screen.ownerReason = 'Generic';
  await store.patchResearch({revision: research.revision, candidate: rejected});
  saved = await request('/api/rounds', 'POST', {revision: 1, action: 'review', id: 'R04', whatWorked: 'Fast cards.', whatFailed: 'Generic picks.', nextChanges: 'Start from a buyer situation.'});
  assert.equal(saved.status, 200); assert.equal(saved.data.saved, 'R04');
  const pipeline = await request('/api/pipeline');
  assert.equal(pipeline.data.pipeline.round.id, 'R04'); assert.equal(pipeline.data.pipeline.round.open, false); assert.equal(pipeline.data.focus.name, 'Product', 'nothing on the line: the scout starts the next round from sales numbers');
  const item = await request('/api/pipeline/item?id=L701');
  assert.equal(item.data.item.outcome.kind, 'rejected'); assert.match(item.data.markdown, /^## Step 1 of 7 · Product · L701 Card L701/);
  assert.deepEqual(item.data.gates.map(gate => gate.name), ['Product', 'Buyers', 'Prove it', 'Create', 'Build', 'Launch', 'Learn']);
  assert.equal((await request('/api/pipeline/item?id=L999')).status, 404);
  const reviewed = await request('/api/rounds', 'POST', {revision: 2, action: 'focus', id: 'R04', focus: 'Changed'});
  assert.deepEqual([reviewed.status, reviewed.data.code], [409, 'ROUND_REVIEWED']);
  await fs.mkdir(path.join(root, 'resources/issues/sleep'), {recursive: true});
  // A Verified issue (all of I1-I7) the owner is Testing: the only kind a round may name (owner, Oct 3).
  await fs.writeFile(path.join(root, 'resources/issues/sleep/ISSUE.md'), ['# Issue: "I cannot sleep" (fixture)', '', '## Gate', '', ...['I1 · Real: 15+ quotes', 'I2 · Deep: a moment', 'I3 · Distinct avatars: 2+', 'I4 · Product-shaped: 3+ types', 'I5 · Clean: words bank', 'I6 · Wants to buy: 5+ intent quotes', 'I7 · Not owned on Meta: 2 advertisers'].map(line => `- [x] ${line}`), ''].join('\n'));
  await fs.mkdir(path.join(root, 'os/data'), {recursive: true});
  await fs.writeFile(path.join(root, 'os/data/issue-picks.json'), JSON.stringify({revision: 1, picks: {sleep: {pick: 'testing', at: '2026-10-03T12:00:00.000Z'}}}));
  const started = await request('/api/rounds', 'POST', {revision: 2, action: 'start', issue: 'sleep', focus: 'Launch today', folders: ['research/2026-10-01-r5/']});
  assert.equal(started.status, 200, JSON.stringify(started.data));
  const focused = await request('/api/rounds', 'POST', {revision: started.data.revision, action: 'focus', id: 'R05', focus: 'Sleep, energy and focus'});
  assert.deepEqual([focused.status, focused.data.saved], [200, 'R05']);
  assert.equal((await request('/api/pipeline')).data.pipeline.round.focus, 'Sleep, energy and focus');
  assert.match(await fs.readFile(path.join(root, 'memory/ROUNDS.md'), 'utf8'), /## R05 · Round 5 · started [\d-]+\n\nSleep, energy and focus/);
});

test('tasks and reports can name a product; it must exist and P### is saved as the full id', async t => {
  const {store} = await workspace(t, [card('L801', {owner: 'saved'})]);
  const created = await store.createProduct({leadId: 'L801'});
  let planner = await store.savePlannerTask({revision: 0, title: 'Check the supplier', product: 'L801'});
  assert.equal(planner.tasks[0].product, 'L801');
  planner = await store.savePlannerTask({revision: planner.revision, id: planner.tasks[0].id, product: 'P001'});
  assert.equal(planner.tasks[0].product, created.id);
  await assert.rejects(store.savePlannerTask({revision: planner.revision, title: 'Ghost', product: 'L999'}), e => e.code === 'UNKNOWN_PRODUCT');
  await assert.rejects(store.savePlannerTask({revision: planner.revision, title: 'Bad', product: 'lamp'}), /card id \(L###\)/);
  planner = await store.savePlannerTask({revision: planner.revision, id: planner.tasks[0].id, product: ''});
  assert.equal(planner.tasks[0].product, '');
  const {record} = await store.reportActivity({id: 'check-l801', role: 'validation', agent: 'checker', status: 'running', title: 'Checking L801', summary: 'Supplier preflight', product: 'P001'});
  assert.equal(record.product, created.id);
  await assert.rejects(store.reportActivity({id: 'ghost', role: 'validation', status: 'running', title: 'x', summary: 'y', product: 'P404'}), e => e.code === 'UNKNOWN_PRODUCT');
});

test('a waiting card reaches the eye test only when all six Step 1 checks pass; the rest show as Checking', () => {
  const state = pipelineState({stages: STAGES, checks: CHECKS, rounds: [pilotRound], leads: leadsOf([card('L131', {screen: 3}), card('L132'), card('L133', {screen: 4, failed: ['metaGap']})])});
  const by = id => state.items.find(item => item.id === id);
  assert.deepEqual([by('L131').stepName, by('L131').status, by('L131').who], ['Product', 'Checking · Find 3/6', 'scout']);
  assert.deepEqual([by('L132').status, by('L132').who], ['Waiting for your eye test', 'owner']);
  assert.deepEqual([by('L133').status, by('L133').outcome.kind], ['Failed at F6', 'failed'], 'a failed Find check takes the card out of the eye test and the line');
  // Owner, Oct 2: a card without its statistics never reaches the eye test.
  const noStats = pipelineState({stages: STAGES, checks: CHECKS, rounds: [pilotRound], leads: leadsOf([card('L134', {screen: 0})])}).items[0];
  assert.deepEqual([noStats.status, noStats.who], ['Checking · Find 0/6 · no stats', 'scout']);
  assert.deepEqual(state.ownerMoves.find(move => move.kind === 'eye-test').ids, ['L132']);
  assert.deepEqual(by('L131').line.slice(0, 1).map(step => [step.state, step.done, step.total]), [['current', 3, 6]]);
});

test('the reorder (owner, Oct 2): Product, Buyers, Prove it; old words and pages map over; cards migrate from their saved state only', async () => {
  const {stepId, normalizeSteps, STEP_IDS, STEP_SLUGS, OLD_SLUGS, OLD_LIBRARY_SLUGS, ISSUE_LIBRARY_SLUG} = await import('../src/steps.mjs');
  assert.deepEqual(STEP_IDS, ['product', 'buyers', 'prove', 'create', 'build', 'launch', 'learn']);
  assert.deepEqual(['1', '2', '3', 'issue', 'find', 'validate', 'Buyers'].map(stepId), ['product', 'buyers', 'prove', 'buyers', 'product', 'prove', 'buyers'], 'an old "issue" tag reads as Buyers research');
  assert.deepEqual(normalizeSteps(['issue', 'discovery', 'validate', 'nonsense']), ['product', 'buyers', 'prove']);
  assert.deepEqual([STEP_SLUGS.product, STEP_SLUGS.buyers, OLD_SLUGS.product, OLD_SLUGS.validate, ISSUE_LIBRARY_SLUG, OLD_LIBRARY_SLUGS], ['find', 'buyers', 'product', 'prove', 'issues', ['issue']]);
  // The migration is derived, never written: unreviewed cards stay at Product, saved ones wait at Buyers, rejected and passed stay out.
  const state = pipelineState({stages: STAGES, checks: CHECKS, rounds: [{...pilotRound, issue: undefined}], leads: leadsOf([
    card('L991'), card('L992', {screen: 2}), card('L993', {owner: 'saved', screen: 2}), card('L994', {owner: 'saved', screen: 6}),
    card('L995', {owner: 'rejected', reason: 'Cheap'}), card('L996', {owner: 'passed', reason: 'Later'}), card('L997', {owner: 'saved', screen: 6, buyers: true})])});
  const at = id => { const item = findItem(state, id); return item.outcome ? `out:${item.outcome.kind}` : item.stepId; };
  assert.deepEqual(['L991', 'L992', 'L993', 'L994', 'L995', 'L996', 'L997'].map(at), ['product', 'product', 'buyers', 'buyers', 'out:rejected', 'out:passed', 'prove']);
  assert.deepEqual([findItem(state, 'L994').status, findItem(state, 'L994').who], ['Buyers · pending', 'buyer-researcher']);
  assert.deepEqual(state.counts.buyers, 2); assert.equal(state.counts.issue, undefined, 'the issue library is not a step');
  assert.equal(state.round.issue, undefined); assert.equal(state.round.open, true, 'a round works without an issue');
  assert.deepEqual(state.ownerMoves.map(move => [move.kind, move.step]), [['eye-test', 0]], 'the eye test sits on Step 1 · Product');
});

test('a failed check fails the product with no owner click (CHECKS.md rule 3, owner Oct 3); pending or unknown never fails; Reopen is the owner\'s', () => {
  // L128, L129, L131 (Oct 3): F3 failed (a WOW score under 3) while waiting for the eye test.
  const wow = card('L140', {screen: 6}); wow.screen.checks.looksWorth = {status: 'failed', note: 'WOW 1 of 5: a plain tote.', source: 'https://example.com/item/L140', observedAt: DAY, country: 'US', evidenceType: 'observed'};
  const unknown = card('L141', {screen: 2});
  const missing = card('L142', {screen: 6}); missing.screen.checks.metaGap = {...missing.screen.checks.metaGap, status: 'failed', note: 'Gap gone', observedAt: DAY, source: `${PILOT}evidence.md`};
  missing.missingEvidence = {screen: ['metaGap'], gates: [], paths: [`${PILOT}evidence.md`]};
  const buyersFailed = card('L143', {owner: 'saved', screen: 6}); buyersFailed.screen.checks.buyers = {status: 'failed', note: 'Only 4 quotes after three forums.', source: `${PILOT}evidence.md`, observedAt: DAY, country: 'US', evidenceType: 'observed'};
  const legacyFit = card('L144', {owner: 'saved', screen: 8, gates: 4, gateFailed: ['fit'], buyers: true});
  const leads = leadsOf([wow, unknown, missing, buyersFailed, legacyFit, card('L145')]);
  const state = pipelineState({stages: STAGES, checks: CHECKS, rounds: [pilotRound], leads});
  const at = id => findItem(state, id);
  assert.deepEqual([at('L140').outcome.kind, at('L140').outcome.label, at('L140').outcome.reason, at('L140').stepName, at('L140').line[0].state], ['failed', 'Failed at F3 · A good product', 'WOW 1 of 5: a plain tote.', 'Product', 'stopped']);
  assert.equal(lineLeadState(leads.find(lead => lead.id === 'L140')), 'failed', 'the Find board takes it out of the eye-test queue too');
  // It never waits under "Needs you": the eye test lists only L145.
  assert.deepEqual(state.ownerMoves.find(move => move.kind === 'eye-test').ids, ['L145']);
  assert.ok(state.out.some(item => item.id === 'L140') && !state.active.some(item => item.id === 'L140'));
  // Pending checks never fail; a failure whose evidence file is missing is unknown, not failed.
  assert.equal(at('L141').outcome, null); assert.equal(at('L142').outcome, null);
  assert.deepEqual(failedChecks(missing), []);
  // Buyers failed: out at Buyers; the legacy fit gate is not a gate line, so it never fails a product here.
  assert.deepEqual([at('L143').outcome.label, at('L143').stepName], ['Failed at A1-A3 · Buyers', 'Buyers']);
  assert.equal(at('L144').outcome, null);
  assert.deepEqual(FAIL_CHECKS.map(spec => spec.line), ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'A1-A3', 'P1', 'P1', 'P2', 'P2', 'P4']);
  // Reopen: that exact failure goes back on the line; the scout re-checks F3. Undo fails it again.
  const mark = at('L140').outcome.check.mark;
  const back = reopenCandidate(wow, mark, new Date('2026-10-03T18:00:00Z'));
  assert.deepEqual(back.screen.reopened, [{id: 'looksWorth', observedAt: DAY, note: 'WOW 1 of 5: a plain tote.', at: '2026-10-03T18:00:00.000Z'}]);
  assert.equal(failedCheck(back), null);
  const line = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([back])})[0];
  assert.deepEqual([line.outcome, line.status, line.who], [null, 'Reopened · re-check F3', 'scout']);
  assert.ok(line.status.length <= 40, 'status stays short (LS-085)');
  assert.equal(failedCheck(unreopenCandidate(back, mark)).id, 'looksWorth');
  assert.equal(unreopenCandidate(back, mark).screen.reopened, undefined);
  // A new failure of the same check (another date or note) fails it again.
  const again = structuredClone(back); again.screen.checks.looksWorth = {...again.screen.checks.looksWorth, note: 'WOW 0 of 5 after the recheck.'};
  assert.equal(failedCheck(again).id, 'looksWorth');
});

test('only the owner reopens: an agent write that adds or drops a Reopen is refused (OWNER_DECISION_ONLY); an agent write keeps it', () => {
  const base = card('L150', {screen: 6}); base.screen.checks.looksWorth = {status: 'failed', note: 'WOW 1 of 5.', source: 'https://example.com/item/L150', observedAt: DAY, country: 'US', evidenceType: 'observed'};
  const research = {revision: 3, minimumReviews: 5, targetReviews: 10, selectedId: null, selectionReason: '', candidates: [base]};
  const mark = failedChecks(base)[0].mark;
  const reopened = reopenCandidate(base, mark);
  assert.throws(() => updateResearch(research, {revision: 3, candidate: reopened}, {agent: true}), error => error.code === 'OWNER_DECISION_ONLY');
  const saved = updateResearch(research, {revision: 3, candidate: reopened});
  assert.equal(saved.candidates[0].screen.reopened.length, 1);
  // An agent's later write without the field keeps the owner's Reopen; dropping it explicitly is refused.
  const agentWrite = structuredClone(base); agentWrite.screen.checks.metaGap = {...agentWrite.screen.checks.metaGap, note: 'Recheck note'}; delete agentWrite.screen.reopened;
  assert.equal(updateResearch(saved, {revision: 4, candidate: agentWrite}, {agent: true}).candidates[0].screen.reopened.length, 1);
  assert.throws(() => updateResearch(saved, {revision: 4, candidate: {...agentWrite, screen: {...agentWrite.screen, reopened: []}}}, {agent: true}), error => error.code === 'OWNER_DECISION_ONLY');
  // The shape is checked: a reopened entry names a card check and keeps only its date, note and when.
  assert.throws(() => updateResearch(research, {revision: 3, candidate: {...base, screen: {...base.screen, reopened: [{id: 'nope', observedAt: DAY, note: ''}]}}}), error => error.code === 'REOPENED');
  assert.throws(() => updateResearch(research, {revision: 3, candidate: {...base, screen: {...base.screen, reopened: [{...mark, extra: 1}]}}}), error => error.code === 'REOPENED');
});

test('when P1, P2 and P4 pass on the card, the next move is the product record, where P3 and P5 are recorded (os.mjs product L105)', () => {
  const done = card('L160', {owner: 'saved', screen: 8, gates: 5, buyers: true});
  done.screen.checks.contribution.observedAt = '2026-10-03';
  for (const id of ['demand', 'competition', 'sourcing']) done.gates[id].observedAt = '2026-10-03';
  const item = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([done])})[0];
  assert.deepEqual([item.stepName, item.status, item.who], ['Prove it', 'Prove it 3/5 · start its record', 'checker']);
  assert.equal(item.next, 'Checker: start its product record (os.mjs product start L160); P3 delivery promise and P5 claims we can back are recorded on it.');
  assert.ok(item.status.length <= 40, 'status stays short (LS-085)');
});

test('a card without a chosen photo shows its first saved picture and video, never a web link', () => {
  const saved = card('L130', {screen: 6});
  saved.references = ['https://www.kalodata.com/a.jpg', 'research/x/L130.md', 'research/x/images/L130-tiktok-1.jpg', 'resources/saves/L130.mp4', 'resources/previews/L130-1.jpg', 'resources/previews/L130-2.jpg'];
  const bare = card('L131', {screen: 6});
  const items = pipelineItems({stages: STAGES, checks: CHECKS, leads: leadsOf([saved, bare])});
  const one = items.find(item => item.id === 'L130'), two = items.find(item => item.id === 'L131');
  assert.equal(one.image, 'resources/previews/L130-1.jpg');
  assert.equal(one.video, 'resources/saves/L130.mp4');
  assert.equal(two.image, '');
  assert.equal(two.video, '');
});
