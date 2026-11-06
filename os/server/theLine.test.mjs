import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {validateLine, currentStep, leadSummary, leadStatus, stepMarkdown, stepPrompts, promptParts, lineMarkdown, STEP_IDS, STEP_BLOCK_WORDS, PIPELINE_BLOCK_WORDS} from '../src/theLine.mjs';
import {buildLeads, stageSignals, ownerDecisionCandidate} from '../src/workflowView.mjs';
import {RESEARCH_GATE_IDS} from '../src/researchView.mjs';
import {STAGES, CHECKS} from './domain.mjs';
import {createStore} from './store.mjs';
import {createApi} from './api.mjs';
import {emptyResearch} from './research.mjs';
const FIND_PASS = (country = 'US') => Object.fromEntries([['dropshippable', {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}], ['metaGap', {advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}], ['bigIssue', {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}], ['provenDemand', {advertisers: 5, longestActiveDays: 140, liveAds: 12, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}]}], ['looksWorth', {}], ['productWorks', {}], ['audienceRoom', {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain', why: 'Job forums complain'}, {who: 'Gardeners', problem: 'Sore knees', why: 'Related routine'}]}], ['noBrand', {}]].map(([id, extra]) => [id, {status: 'supported', note: 'Fixture Find check', source: 'https://example.com/fixture-find', observedAt: '2026-09-15', country, evidenceType: 'observed', ...extra}]));

const here = path.dirname(fileURLToPath(import.meta.url));
const realLinePath = path.resolve(here, '../../workflow/the-line.json');
const realLine = async () => JSON.parse(await fs.readFile(realLinePath, 'utf8'));
const words = text => text.split(/\s+/).filter(Boolean).length;
const gates = () => Object.fromEntries(RESEARCH_GATE_IDS.map(id => [id, {status: 'pending', note: '', source: '', observedAt: '', window: ''}]));
const card = id => ({id, name: `Card ${id}`, country: 'US', buyer: '', decision: 'CURATED - UNVERIFIED; owner unreviewed', nextAction: 'Await owner eye test', references: [], screen: {ownerDecision: 'unreviewed', ownerReason: '', checks: {...FIND_PASS(), sourceMatch: {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''}, contribution: {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''}}}, gates: gates()});
const passedIssue = slug => ({slug, title: `Issue ${slug}`, gatePassed: true, gate: {done: 5, total: 5, items: []}, rounds: []});

test('the saved step guide is valid and keeps the seven steps in order (owner, Oct 2)', async () => {
  const line = validateLine(await realLine());
  assert.deepEqual(line.steps.map(step => step.id), STEP_IDS);
  assert.deepEqual(STEP_IDS, ['product', 'buyers', 'prove', 'create', 'build', 'launch', 'learn']);
  assert.deepEqual(line.steps.map(step => step.name), ['Product', 'Buyers', 'Prove it', 'Create', 'Build', 'Launch', 'Learn']);
  for (const step of line.steps) { assert.equal(step.prompts.length, 3); assert.ok(step.agents.length >= 1); assert.match(step.playbook, /^workflow\/CHECKS\.md#step-\d--/); }
  assert.equal(line.anytime.length, 6);
  // Product first (owner, Oct 2), then its buyers after the Save; Prove it ends by waiting for the build slot the owner picks; Create starts from "Build this one".
  assert.match(line.steps[0].startWhen, /takes a focus/); assert.match(line.steps[0].doneWhen, /hard test starts on Verify/);
  assert.match(line.steps[1].purpose, /^For a product you saved/); assert.match(line.steps[1].startWhen, /pressed Save/); assert.match(line.steps[1].doneWhen, /^A1-A3 pass/); assert.deepEqual(line.steps[1].agents, ['buyer-researcher']);
  assert.match(line.steps[2].doneWhen, /^P1-P5 pass/); assert.deepEqual(line.steps[2].agents, ['checker']); assert.match(line.steps[3].startWhen, /Build this one/);
  assert.match(line.steps[2].purpose, /money line/); assert.match(line.steps[0].purpose, /sales numbers[\s\S]*dropship[\s\S]*our issues/); assert.match(line.steps[5].purpose, /test sheet before any spend/); assert.match(line.steps[6].purpose, /kill, fix or scale/);
  assert.match(lineMarkdown(line), /^# The seven-step line[\s\S]*## Step 7 · Learn[\s\S]*## Anytime prompts/);
});

test('a malformed step guide fails with a plain reason', async () => {
  const good = await realLine();
  const broken = mutate => { const copy = structuredClone(good); mutate(copy); return () => validateLine(copy); };
  assert.throws(() => validateLine(null), /must be a JSON object/);
  assert.throws(broken(l => l.steps.pop()), /exactly 7 steps/);
  assert.throws(broken(l => { [l.steps[0], l.steps[1]] = [l.steps[1], l.steps[0]]; }), /step 1 must have id "product"/);
  assert.throws(broken(l => { l.steps[2].prompts.pop(); }), /exactly 3 prompts for Prove it/);
  assert.throws(broken(l => { l.steps[3].doneWhen = ''; }), /"doneWhen" for Create/);
  assert.throws(broken(l => { l.steps[0].agents = ['Scout!']; }), /team agent IDs/);
  assert.throws(broken(l => { l.steps[4].playbook = 'https://example.com'; }), /playbook link/);
  assert.throws(broken(l => { l.anytime = []; }), /anytime/);
  assert.throws(broken(l => { l.steps[1].prompts[0] = {label: 'x'}; }), err => err.code === 'MALFORMED_LINE');
});

test('with nothing building, the focus is the eye test (Step 2 · Product), with the card counts from saved state', async () => {
  const line = validateLine(await realLine());
  const leads = buildLeads({candidates: [card('L095'), card('L096')]}, {batches: []});
  let step = currentStep({line, stages: STAGES, checks: CHECKS, products: [], leads});
  assert.equal(step.id, 'product'); assert.equal(step.number, 1); assert.equal(step.name, 'Product');
  assert.equal(step.status, 'No round yet · 2 cards wait for your eye test');
  assert.equal(step.owner, true); assert.match(step.next, /^Owner: eye test on 2 cards \(Find page\): L096, L095\.$/);
  assert.equal(step.pipeline.counts.product, 2); assert.equal(step.pipeline.focus.kind, 'owner');
  assert.equal(step.guide.purpose, line.steps[0].purpose);
  // Nothing on the line (owner, Oct 2): the scout starts a round where the sales numbers are hitting; the issue files are a reference library.
  step = currentStep({line, stages: STAGES, checks: CHECKS, leads: []});
  assert.equal(step.id, 'product'); assert.equal(step.number, 1);
  assert.match(step.next, /^Scout: start Round 1 where the sales numbers are hitting/); assert.equal(step.owner, false);
  step = currentStep({line, stages: STAGES, checks: CHECKS, leads: [], issues: [passedIssue('sleep')]});
  assert.equal(step.pipeline.counts.issue, undefined, 'the issue library is not a step'); assert.equal(step.pipeline.issues[0].slug, 'sleep');
  const missing = currentStep({line: null, lineError: 'The step guide is missing.', leads});
  assert.equal(missing.name, 'Product'); assert.equal(missing.guide, null); assert.equal(missing.lineError, 'The step guide is missing.');
  assert.match(stepMarkdown(missing), /Step guide:\*\* The step guide is missing/);
});

test('the Home wait count matches the saved cards (the "1 wait" report came from a copy where one card was saved)', () => {
  const two = buildLeads({candidates: [card('L095'), card('L096')]}, {batches: []});
  assert.deepEqual(leadSummary(two), {waiting: 2, checking: 0, saved: 0, reviewed: 0, total: 2});
  assert.equal(stageSignals({data: {}, research: {}, leads: two, hub: {}}).product.value, 2);
  assert.equal(stageSignals({data: {}, research: {}, leads: two, hub: {}}).product.label, 'wait for your eye test');
  const saved = ownerDecisionCandidate({id: 'L096', name: 'Card L096', candidate: card('L096')}, 'saved', 'Looks distinct');
  const one = buildLeads({candidates: [card('L095'), saved]}, {batches: []});
  const signal = stageSignals({data: {}, research: {}, leads: one, hub: {}}).product;
  assert.equal(signal.value, 1); assert.equal(signal.label, 'waits for your eye test');
  assert.equal(signal.detail, '1 saved for checks');
  assert.equal(leadStatus(leadSummary(one)), '1 card waits for your eye test · 1 saved card is being checked');
  assert.equal(currentStep({leads: one}).status, 'No round yet · 1 card waits for your eye test · 1 saved card is being checked');
  assert.equal(leadStatus(leadSummary([])), 'No cards are waiting');
});

test('a product\'s line comes from its own checks; only the product in the build slot moves past Prove it', () => {
  const verified = ids => Object.fromEntries(ids.map(id => [id, {status: 'verified'}]));
  const market = checks => ({id: 'm1', country: 'US', status: 'active', researchCandidateId: 'L009', verificationGate: {ready: true}, checks});
  const product = checks => ({id: 'P009-lamp', name: 'Lamp', updatedAt: '2026-10-01T00:00:00.000Z', markets: [market(checks)]});
  const upTo = stage => CHECKS.filter(c => STAGES.findIndex(s => s.id === c.stage) <= STAGES.findIndex(s => s.id === stage)).map(c => c.id);
  let step = currentStep({stages: STAGES, checks: CHECKS, products: [product(verified(upTo('validation')))]});
  let item = step.pipeline.items[0];
  assert.equal(step.id, 'prove'); assert.equal(item.stepName, 'Prove it'); assert.equal(item.status, 'Prove it · checks 7/12'); assert.equal(item.who, 'checker');
  assert.equal(item.unlinked, true, 'its card L009 is not in the research record');
  assert.equal(item.line[0].state, 'done', 'a product record starts from a saved card, so Product is behind it');
  assert.equal(item.line[1].state, 'todo', 'no card, so its buyers check is not shown as done');
  assert.equal(step.product, null, 'nothing is building');
  // Prove it done, slot empty: the owner picks.
  step = currentStep({stages: STAGES, checks: CHECKS, products: [product(verified(upTo('sourcing')))]});
  item = step.pipeline.items[0];
  assert.equal(item.readyToBuild, true); assert.equal(item.stepName, 'Prove it'); assert.equal(item.line[3].state, 'waiting');
  assert.equal(step.pipeline.focus.kind, 'owner'); assert.match(step.next, /^Owner: pick which product builds next: P009-lamp \("Build this one" on its page, with a reason\)\.$/); assert.equal(step.owner, true);
  // In the build slot: Create.
  step = currentStep({stages: STAGES, checks: CHECKS, products: [product(verified(upTo('sourcing')))], buildProductId: 'P009-lamp'});
  assert.equal(step.id, 'create'); assert.equal(step.product.name, 'Lamp'); assert.equal(step.market.country, 'US');
  assert.equal(step.status, 'No round yet · Lamp (US) is building: Building · Create 0/3 checks');
  assert.match(step.next, /^Copywriter: Claims, reviews & media rights\./);
  // Launch, then Learn: the measured result and the case review are Step 7.
  step = currentStep({stages: STAGES, checks: CHECKS, products: [product(verified(upTo('testing')))], buildProductId: 'P009-lamp'});
  assert.equal(step.id, 'learn'); assert.equal(step.pipeline.items[0].status, 'Building · Learn 0/2 checks'); assert.match(step.next, /^Claude: Measured commercial result\./);
  step = currentStep({stages: STAGES, checks: CHECKS, products: [product(verified(CHECKS.map(c => c.id)))], activeProductId: 'P009-lamp'});
  assert.equal(step.id, 'learn'); assert.equal(step.complete, true); assert.match(step.next, /review this cycle/);
  // A screen that is not ready keeps every check pending: the product record is still being recorded (Prove it).
  const gateOpen = {...product(verified(upTo('validation'))), markets: [{...market(verified(upTo('validation'))), verificationGate: {ready: false, reason: 'Link an owner-saved research card with all seven pre-verification checks supported.'}}]};
  step = currentStep({stages: STAGES, checks: CHECKS, products: [gateOpen]});
  assert.equal(step.id, 'prove'); assert.match(step.pipeline.items[0].status, /^Recording the product record \(0\/12\)/);
  assert.match(step.next, /^Checker: Link an owner-saved research card/);
  const parked = {id: 'P001-boots', name: 'Boots', markets: [{...market({}), status: 'parked', reason: 'Owner stopped the boots.'}]};
  step = currentStep({stages: STAGES, checks: CHECKS, products: [parked]});
  assert.equal(step.pipeline.items[0].outcome.kind, 'product-parked'); assert.equal(step.pipeline.items[0].outcome.reason, 'Owner stopped the boots.');
  assert.equal(step.pipeline.focus.kind, 'start-round');
});

test('the step block is short, complete and names the reader\'s part', async () => {
  const line = validateLine(await realLine());
  const at = new Date('2026-10-01T15:00:00Z');
  for (let i = 0; i < 7; i++) {
    const step = {...currentStep({line, leads: []}), index: i, number: i + 1, id: STEP_IDS[i], name: line.steps[i].name, guide: line.steps[i]};
    const block = stepMarkdown(step, {at});
    for (const label of ['Now', 'Next move', 'Start when', 'Done when', "Owner's part", 'Agents', 'Stop if']) assert.match(block, new RegExp(`\\*\\*${label}:\\*\\*`));
    assert.ok(words(block) <= STEP_BLOCK_WORDS, `${line.steps[i].name} block is ${words(block)} words`);
    // The worst case: Now and Next at their clipped lengths (a long product name and next move).
    const worst = stepMarkdown({...step, status: 'word '.repeat(40), next: 'word '.repeat(40)}, {at});
    assert.ok(words(worst) <= STEP_BLOCK_WORDS, `${line.steps[i].name} worst-case block is ${words(worst)} words`);
  }
  const product = currentStep({line, leads: buildLeads({candidates: [card('L095')]}, {batches: []})});
  assert.match(stepMarkdown(product, {at, agent: 'scout', names: {scout: 'Product scout'}}), /\*\*Agents:\*\* you \(scout\)\.\n/);
  assert.match(stepMarkdown(product, {at, agent: 'copywriter', names: {scout: 'Product scout'}}), /\*\*Agents:\*\* Product scout \(scout\)\. Not you: work only toward finishing this step\./);
  assert.match(stepMarkdown(product, {at}), /^## Step 1 of 7 · Product\n[\s\S]*From saved cards, products and rounds, 2026-10-01 10:00 Chicago/);
  assert.match(stepMarkdown(product, {at, title: 'Your step: Step 1 of 7 · Product'}), /^## Your step: Step 1 of 7 · Product\n/);
  assert.equal(stepPrompts(line, 'prove').step.id, 'prove');
  assert.equal(stepPrompts(line, 'prove it').step.name, 'Prove it');
  assert.equal(stepPrompts(line, '7').step.name, 'Learn');
  assert.equal(stepPrompts(line, '').prompts.length, 3);
  assert.deepEqual(promptParts('Find 15 for [country] now').map(p => p.blank), [false, true, false]);
});

async function workspace(t, {line = true} = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-line-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-line-')); await fs.rm(root, {recursive: true, force: true}); });
  for (const dir of ['workflow', 'research', 'agents']) await fs.mkdir(path.join(root, dir), {recursive: true});
  if (line) await fs.copyFile(realLinePath, path.join(root, 'workflow/the-line.json'));
  await fs.writeFile(path.join(root, 'research/comparison.json'), JSON.stringify({...emptyResearch(), candidates: [card('L095'), card('L096')]}));
  await fs.writeFile(path.join(root, 'agents/team.json'), JSON.stringify({agents: [{id: 'scout', role: 'validation', name: 'Product scout', summary: 'Finds products.'}, {id: 'copywriter', role: 'image-generator', name: 'Copywriter', summary: 'Writes copy.'}]}));
  return {root, store: createStore({workspaceRoot: root})};
}

test('every brief opens with the pipeline, and START-HERE follows eye-test decisions', async t => {
  const {root, store} = await workspace(t);
  const scout = await store.getBrief('scout');
  assert.match(scout.markdown, /^# Brief for Product scout\n\nGenerated [^\n]+\n\n## The pipeline · no round yet\n/);
  assert.match(scout.markdown, /Eye test on 2 cards/); assert.match(scout.markdown, /\*\*Yours\*\* \(Product\): L096, L095\./);
  assert.match(scout.markdown, /## Your step: Step 1 of 7 · Product[\s\S]*\*\*Agents:\*\* you \(scout\)/);
  assert.ok(scout.stepWords > 0 && scout.stepWords <= STEP_BLOCK_WORDS); assert.ok(scout.pipelineWords > 0 && scout.pipelineWords <= PIPELINE_BLOCK_WORDS);
  const manager = await store.getBrief('manager');
  assert.match(manager.markdown, /## The pipeline · no round yet[\s\S]*## Focus: Step 1 of 7 · Product/);
  await store.savePlannerTask({revision: 0, title: 'Look at the cards', assignee: 'owner'});
  let startHere = await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8');
  assert.match(startHere, /^# Start here — Merrivy\n\nGenerated [^\n]+\n\n## The pipeline · no round yet\n[\s\S]*## Focus: Step 1 of 7 · Product/);
  assert.match(startHere, /2 cards wait for your eye test/);
  const research = await store.getResearch();
  const lead = {id: 'L096', name: 'Card L096', candidate: research.candidates.find(c => c.id === 'L096')};
  await store.patchResearch({revision: research.revision, candidate: ownerDecisionCandidate(lead, 'saved', 'Looks distinct')});
  startHere = await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8');
  assert.match(startHere, /1 card waits for your eye test · 1 saved card is being checked/);
  const live = await store.getStep();
  assert.equal(live.current.id, 'product'); assert.equal(live.error, ''); assert.equal(live.line.steps.length, 7);
  assert.match(live.markdown, /1 saved card is being checked/);
  const doc = await store.readDocument('workflow/the-line.json');
  assert.match(doc.content, /^# The seven-step line/);
  await assert.rejects(store.readDocument('workflow/other.json'), e => e.code === 'UNSAFE_PATH');
});

test('a broken step guide shows its error everywhere and never blocks other writes', async t => {
  const {root, store} = await workspace(t);
  await fs.writeFile(path.join(root, 'workflow/the-line.json'), '{"steps": [');
  const boot = await store.bootstrap();
  assert.equal(boot.line, null); assert.match(boot.lineError, /not valid JSON/);
  await store.savePlannerTask({revision: 0, title: 'Still saves'});
  const startHere = await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8');
  assert.match(startHere, /Step 1 of 7 · Product[\s\S]*not valid JSON/);
  assert.match((await store.getBrief('scout')).markdown, /Ask the manager to repair workflow\/the-line\.json/);
  await fs.writeFile(path.join(root, 'workflow/the-line.json'), JSON.stringify({steps: []}));
  assert.match((await store.getStep()).error, /exactly 7 steps/);
  await fs.rm(path.join(root, 'workflow/the-line.json'));
  assert.match((await store.bootstrap()).lineError, /is missing/);
});

test('GET /api/line returns the live step on the local origin only', async t => {
  const {root} = await workspace(t);
  const api = createApi({workspaceRoot: root});
  const call = host => new Promise(resolve => {
    const res = {statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { resolve({status: this.statusCode, body: JSON.parse(body)}); }, writableEnded: false};
    api({method: 'GET', url: '/api/line', headers: {host}}, res);
  });
  const ok = await call('localhost:3000');
  assert.equal(ok.status, 200); assert.equal(ok.body.current.name, 'Product'); assert.equal(ok.body.line.anytime.length, 6);
  assert.equal(ok.body.pipeline.counts.product, 2); assert.equal(ok.body.current.pipeline.focus.kind, 'owner'); assert.match(ok.body.markdown, /^## The pipeline · no round yet[\s\S]*## Focus: Step 1 of 7 · Product/);
  assert.equal((await call('evil.test')).status, 403);
});
