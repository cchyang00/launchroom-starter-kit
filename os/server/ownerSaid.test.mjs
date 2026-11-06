import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {quoteProblem, ownerSaidCandidate, undoSaidCandidate, saidOf, saidProblem, OWNER_SAID_ACTIONS, eyeTestCandidate} from '../src/eyeTest.mjs';
import {pipelineItems} from '../src/pipeline.mjs';
import {buildLeads} from '../src/workflowView.mjs';
import {STAGES, CHECKS} from './domain.mjs';
import {emptyResearch, updateResearch, RESEARCH_GATES} from './research.mjs';
import {saidDecisions} from './doctor.mjs';
import {createApi} from './api.mjs';

// Owner decisions said in chat (owner, Oct 3: "if you cant run the pipeline by yourself and i have
// to manual this process all the time. clearly something is wrong"). The manager records them with
// the owner's own words; the quote is required; Launchroom labels them; Undo works; agents still can't decide.
const seen = {status: 'supported', observedAt: '2026-10-02', country: 'US', evidenceType: 'observed', note: 'Fixture.'};
const pending = {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''};
const card = (id, owner = 'unreviewed') => ({
  id, name: `Card ${id}`, country: 'US', buyer: 'Fixture buyer', decision: 'CURATED', nextAction: 'Eye test', references: [],
  gates: Object.fromEntries(RESEARCH_GATES.map(g => [g, {status: 'pending', note: '', source: '', observedAt: '', window: ''}])),
  screen: {ownerDecision: owner, ownerReason: '', checks: {
    provenDemand: {...seen, source: 'https://www.amazon.com/s?k=fixture', demand: [{metric: 'amazon-bought', value: 7000, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-10-02'}], trend: [{date: '2025-10-01', value: 50}, {date: '2026-04-01', value: 60}, {date: '2026-09-20', value: 58}], trendUrl: 'https://trends.google.com/trends/explore?q=fixture'},
    dropshippable: pending, looksWorth: pending, audienceRoom: pending, bigIssue: pending, metaGap: pending,
    sourceMatch: pending, contribution: pending, productWorks: pending, noBrand: pending,
  }},
});
const batch = (...cards) => ({...emptyResearch(), candidates: cards});
const QUOTE = 'lets take the 4d air-mesh bath pillow through the entire pipeline';

test('the quote is required, and a chat decision keeps who said it, when and what came before', () => {
  assert.match(quoteProblem(''), /exact words/);
  assert.match(quoteProblem('  '), /exact words/);
  assert.match(quoteProblem(undefined), /exact words/);
  assert.match(quoteProblem('ok'), /too short/);
  assert.equal(quoteProblem(QUOTE), '');
  assert.deepEqual(OWNER_SAID_ACTIONS, ['save', 'pass', 'reject', 'build', 'test-issue', 'park-issue', 'approve']);
  assert.throws(() => ownerSaidCandidate(card('L105'), 'saved', ''), /exact words/);
  const made = ownerSaidCandidate(card('L105'), 'saved', `  ${QUOTE} `, new Date('2026-10-03T18:00:00Z'));
  assert.deepEqual([made.screen.ownerDecision, made.screen.ownerReason, made.screen.reasonTags], ['saved', QUOTE, []]);
  assert.deepEqual(saidOf(made.screen), {recordedBy: 'manager', source: 'owner-chat', quote: QUOTE, at: '2026-10-03T18:00:00.000Z', before: {ownerDecision: 'unreviewed', ownerReason: '', reasonTags: []}});
  assert.equal(saidProblem(made.screen.said), '');
  assert.match(saidProblem({...made.screen.said, recordedBy: 'scout'}), /recorded by the manager/);
  assert.match(saidProblem({...made.screen.said, quote: ''}), /exact words/);
  // Undo: the decision before comes back and the chat record goes.
  const undone = undoSaidCandidate(made);
  assert.deepEqual([undone.screen.ownerDecision, undone.screen.ownerReason, undone.screen.said], ['unreviewed', '', undefined]);
  // The owner's own tap replaces a chat decision.
  assert.equal(eyeTestCandidate({id: 'L105', candidate: made}, 'passed', {}).screen.said, undefined);
});

test('only the owner-said path writes a chat decision; agents and plain writes cannot; the owner can undo it', () => {
  const at = new Date('2026-10-03T18:00:00Z');
  const base = batch(card('L105'));
  const said = ownerSaidCandidate(card('L105'), 'saved', QUOTE, at);
  // An agent write is refused, as for any decision; a plain owner write may not forge the chat record.
  assert.throws(() => updateResearch(base, {revision: 0, candidate: said}, {agent: true}), error => error.code === 'OWNER_DECISION_ONLY');
  assert.throws(() => updateResearch(base, {revision: 0, candidate: said}), error => error.code === 'OWNER_SAID_ONLY');
  // The owner-said path needs the record (the quote).
  assert.throws(() => updateResearch(base, {revision: 0, candidate: eyeTestCandidate({id: 'L105', candidate: card('L105')}, 'saved', {})}, {ownerSaid: true}), error => error.code === 'QUOTE_REQUIRED');
  const saved = updateResearch(base, {revision: 0, candidate: said}, {ownerSaid: true, at});
  assert.deepEqual([saved.candidates[0].screen.ownerDecision, saved.candidates[0].screen.said.quote, saved.candidates[0].screen.decidedAt], ['saved', QUOTE, '2026-10-03T18:00:00.000Z']);
  // Saying the same thing again records nothing.
  assert.throws(() => updateResearch(saved, {revision: 1, candidate: ownerSaidCandidate(saved.candidates[0], 'saved', QUOTE, at)}, {ownerSaid: true}), error => error.code === 'SAME_DECISION');
  // An agent's later evidence write keeps the chat record; it may not drop it.
  const evidence = structuredClone(saved.candidates[0]); delete evidence.screen.said; evidence.screen.checks.metaGap = {...evidence.screen.checks.metaGap, note: 'Recheck'};
  assert.equal(updateResearch(saved, {revision: 1, candidate: evidence}, {agent: true}).candidates[0].screen.said.quote, QUOTE);
  assert.throws(() => updateResearch(saved, {revision: 1, candidate: {...evidence, screen: {...evidence.screen, said: {...saved.candidates[0].screen.said, quote: 'different words'}}}}, {agent: true}), error => error.code === 'OWNER_DECISION_ONLY');
  // The owner's one-tap Undo on the page.
  const undone = updateResearch(saved, {revision: 1, candidate: undoSaidCandidate(saved.candidates[0])});
  assert.deepEqual([undone.candidates[0].screen.ownerDecision, undone.candidates[0].screen.said], ['unreviewed', undefined]);
  // A chat Pass is labelled on the pipeline's out-of-line row.
  const passed = updateResearch(base, {revision: 0, candidate: ownerSaidCandidate(card('L105'), 'passed', 'not this one, the pillow is too basic', at)}, {ownerSaid: true});
  const row = pipelineItems({stages: STAGES, checks: CHECKS, leads: buildLeads(passed, {batches: []})})[0];
  assert.deepEqual([row.outcome.kind, row.outcome.label, row.outcome.reason], ['passed', 'Passed for now · said in chat', 'not this one, the pillow is too basic']);
  // The doctor lists the last 7 days of chat decisions for audit.
  const list = saidDecisions({now: new Date('2026-10-04T12:00:00Z').getTime(), research: saved, workspace: {build: {productId: 'P012-pillow', reason: QUOTE, pickedAt: '2026-10-03T19:00:00.000Z', by: 'owner', override: true, recordedBy: 'manager', source: 'owner-chat'}}, issues: {issues: [{slug: 'teachers', pick: {pick: 'testing', at: '2026-09-20T10:00:00.000Z', recordedBy: 'manager', source: 'owner-chat', quote: 'test teachers'}}]}});
  assert.deepEqual(list.map(item => item.what), ['P012 build (launched early)', 'L105 saved'], 'older than 7 days is left out');
});

function call(api, method, url, input, headers = {}) {
  return new Promise(resolve => {
    const req = Object.assign(Readable.from(input === undefined ? [] : [Buffer.from(JSON.stringify(input))]), {method, url, headers: {host: 'localhost:3000', ...(input === undefined ? {} : {origin: 'http://localhost:3000', 'content-type': 'application/json'}), ...headers}});
    const res = {statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { resolve({status: this.statusCode, body: body ? JSON.parse(body) : null}); }, writableEnded: false};
    api(req, res);
  });
}

test('POST /api/owner-said: refused without a quote and from a headless run; records save with the quote; agents still cannot pick what builds', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-ownersaid-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  await fs.mkdir(path.join(root, 'research'), {recursive: true});
  await fs.writeFile(path.join(root, 'research/comparison.json'), JSON.stringify(batch(card('L105'), card('L106')), null, 2));
  const api = createApi({workspaceRoot: root});
  const agent = {'x-launchroom-local-agent': '1'};
  const noQuote = await call(api, 'POST', '/api/owner-said', {action: 'save', target: 'L105', quote: ''}, agent);
  assert.deepEqual([noQuote.status, noQuote.body.code], [400, 'QUOTE_REQUIRED']);
  const missing = await call(api, 'POST', '/api/owner-said', {action: 'save', target: 'L105'}, agent);
  assert.deepEqual([missing.status, missing.body.code], [400, 'QUOTE_REQUIRED']);
  const extra = await call(api, 'POST', '/api/owner-said', {action: 'save', target: 'L105', quote: QUOTE, reason: 'x'}, agent);
  assert.equal(extra.body.code, 'INVALID_INPUT');
  const fromRun = await call(api, 'POST', '/api/owner-said', {action: 'save', target: 'L105', quote: QUOTE}, {...agent, 'x-launchroom-run': 'run-buyers-l105-20261003-120000'});
  assert.deepEqual([fromRun.status, fromRun.body.code], [403, 'OWNER_DECISION_ONLY']);
  const unknown = await call(api, 'POST', '/api/owner-said', {action: 'launch', target: 'L105', quote: QUOTE}, agent);
  assert.equal(unknown.body.code, 'UNKNOWN_ACTION');
  const ok = await call(api, 'POST', '/api/owner-said', {action: 'save', target: 'L105', quote: QUOTE}, agent);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.decision, ok.body.quote, ok.body.source], ['saved', QUOTE, 'owner-chat']);
  const research = (await call(api, 'GET', '/api/research')).body;
  const saved = research.candidates.find(item => item.id === 'L105');
  assert.deepEqual([saved.screen.ownerDecision, saved.screen.ownerReason, saved.screen.said.recordedBy, saved.screen.said.source], ['saved', QUOTE, 'manager', 'owner-chat']);
  // A plain agent write of a decision still gets OWNER_DECISION_ONLY.
  const plain = await call(api, 'PATCH', '/api/research', {revision: research.revision, candidate: {...research.candidates[1], screen: {...research.candidates[1].screen, ownerDecision: 'rejected'}}}, agent);
  assert.deepEqual([plain.status, plain.body.code], [403, 'OWNER_DECISION_ONLY']);
  // "Build this one" from an agent's write is refused; only owner-said build (with the quote) may record it.
  const build = await call(api, 'POST', '/api/workspace/build', {revision: 0, leadId: 'L105', reason: 'x', override: true}, agent);
  assert.deepEqual([build.status, build.body.code], [403, 'OWNER_DECISION_ONLY']);
  // The owner's Undo on the page (a plain owner write) puts it back.
  const undo = await call(api, 'PATCH', '/api/research', {revision: research.revision, candidate: undoSaidCandidate(saved)});
  assert.equal(undo.status, 200, JSON.stringify(undo.body));
  const after = undo.body.candidates.find(item => item.id === 'L105');
  assert.deepEqual([after.screen.ownerDecision, after.screen.said], ['unreviewed', undefined]);
  // "Build this one" said in chat: it takes the slot while Prove it is open (launch early), the quote as the reason.
  assert.equal((await call(api, 'POST', '/api/owner-said', {action: 'save', target: 'L105', quote: QUOTE}, agent)).status, 200);
  const buildNoQuote = await call(api, 'POST', '/api/owner-said', {action: 'build', target: 'L105', quote: ''}, agent);
  assert.equal(buildNoQuote.body.code, 'QUOTE_REQUIRED');
  const built = await call(api, 'POST', '/api/owner-said', {action: 'build', target: 'L105', quote: QUOTE}, agent);
  assert.equal(built.status, 200, JSON.stringify(built.body));
  assert.deepEqual([built.body.build.override, built.body.build.reason, built.body.build.recordedBy, built.body.build.source, built.body.build.by], [true, QUOTE, 'manager', 'owner-chat', 'owner']);
  assert.ok(built.body.build.missing.length > 0, 'the open Prove it checks stay listed');
  const workspace = (await call(api, 'GET', '/api/workspace')).body;
  assert.equal(workspace.build.source, 'owner-chat');
});
