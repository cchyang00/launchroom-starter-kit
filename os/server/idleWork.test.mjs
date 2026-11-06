import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseTopics, idleWork, idleMarkdown, IDLE_BLOCK_WORDS, IDLE_LINES, TOPICS_PATH} from '../src/idleWork.mjs';
import {issueLane} from '../src/issues.mjs';
import {agentInbox, isParkedAgentTask, isDispatchable} from '../src/plannerRules.mjs';
import {agentBrief, emptyLessons} from './lessons.mjs';
import {currentStep, pipelineMarkdown, PIPELINE_BLOCK_WORDS} from '../src/theLine.mjs';

// Cold-start test fixes (Oct 1): idle briefs, parked someday jobs and Step 1a as a lane.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;
// Step 0 (owner, Oct 3): issues carry their status and seven I-checks (I1-I7).
const checks = open => ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'].map(id => ({id, name: id, state: open.includes(id) ? 'open' : 'passed'}));
const passed = (slug, rounds = [], status = 'verified') => ({slug, title: slug, path: `resources/issues/${slug}/ISSUE.md`, gate: {done: 7, total: 7}, verified: true, gatePassed: true, status, checks: checks([]), rounds});
const issues = [passed('sleep', [{id: 'R05', number: 5, open: true}], 'testing'), passed('low-energy'), {slug: 'pets', path: 'resources/issues/pets/ISSUE.md', gate: {done: 5, total: 7}, verified: false, gatePassed: false, status: 'candidate', checks: checks(['I2', 'I5']), rounds: []}];
const topics = [{number: 3, issue: 'I keep forgetting things', status: 'Researched', next: false}, {number: 4, issue: 'My phone keeps me up and eats my day', status: 'Next to research', next: true}];
const pipe = (extra = {}) => ({active: [], round: {number: 5, id: 'R05', open: true, issue: 'sleep'}, building: null, ...extra});

test('the real topic map parses, and its first "Next to research" row is the buyer researcher\'s next issue', async () => {
  const text = await fs.readFile(path.join(repo, TOPICS_PATH), 'utf8').catch(() => null);
  if (text === null) return;
  const rows = parseTopics(text);
  assert.ok(rows.length >= 3);
  assert.ok(rows.every(row => Number.isInteger(row.number) && row.issue && !/^["“*]/.test(row.issue)));
  const next = rows.filter(row => row.next);
  assert.ok(next.length > 0, 'at least one issue is marked Next to research');
  assert.deepEqual(parseTopics('| 1 | **"I can\'t sleep"** | a | b | **Next to research** |'), [{number: 1, issue: "I can't sleep", status: 'Next to research', next: true}]);
  assert.deepEqual(parseTopics('| # | Issue |\n|---|---|\nno table'), []);
});

test('idle work: each agent gets a useful next move from the saved pipeline, issues and topics', () => {
  // Scout (owner, Oct 2): product first, where the sales numbers are hitting; a round needs no issue.
  assert.match(idleWork({agent: 'scout', pipeline: pipe(), issues, topics})[0], /Find more Round 5 cards where the sales numbers are hitting[\s\S]*its issue: sleep/);
  assert.doesNotMatch(idleWork({agent: 'scout', pipeline: pipe({round: {number: 5, id: 'R05', open: true}}), issues, topics})[0], /its issue|names no issue/);
  // With no open round, a round starts from a Testing issue; with none tested, the owner picks first.
  assert.match(idleWork({agent: 'scout', pipeline: pipe({round: null}), issues, topics})[0], /start a round from a Testing issue \(sleep\): `os\.mjs round start --issue <slug>/);
  assert.match(idleWork({agent: 'scout', pipeline: pipe({round: null}), issues: issues.slice(1), topics})[0], /^No issue is being tested yet: the owner picks a couple of Verified issues on the Issues page/);
  // Buyer researcher (owner, Oct 2): saved cards at Step 2 · Buyers first; with none, add to the issue library (a reference).
  const atValidate = pipe({active: [{id: 'L097', stepId: 'prove'}, {id: 'L098', stepId: 'product'}, {id: 'L099', stepId: 'buyers'}]});
  const buyer = idleWork({agent: 'buyer-researcher', pipeline: atValidate, issues, topics});
  assert.match(buyer[0], /Research the buyers of L099 at Step 2 · Buyers: TikTok comments, 2-4 star reviews and forums/);
  // Nothing at Buyers: cross-reference a Candidate issue (step 0), else start the next one from the topic map.
  assert.match(idleWork({agent: 'buyer-researcher', pipeline: pipe(), issues, topics})[0], /Nothing waits at Buyers\. Cross-reference a Candidate issue \(step 0\): pets \(open I2, I5\), resources\/issues\/pets\/ISSUE\.md/);
  assert.match(idleWork({agent: 'buyer-researcher', pipeline: pipe(), issues: issues.slice(0, 2), topics})[0], /Nothing waits at Buyers\. Start a new issue \(step 0\): #4 "My phone keeps me up and eats my day" \(resources\/issues\/TOPICS\.md, Next to research\)/);
  assert.match(idleWork({agent: 'buyer-researcher', pipeline: pipe(), issues: issues.slice(0, 2), topics: []})[0], /Nothing waits at Buyers: the owner's eye test \(Save\) comes first/);
  // Checker: saved cards at Prove it, else nothing until the eye test.
  assert.match(idleWork({agent: 'checker', pipeline: atValidate, issues, topics})[0], /Prove it on L097: opening, exact item, delivery, money line and sample \(P1-P5\)/);
  assert.match(idleWork({agent: 'checker', pipeline: pipe(), issues, topics})[0], /the owner's Save and Step 2 · Buyers come first/);
  // Makers wait for the build slot; with one, they work on it.
  assert.match(idleWork({agent: 'copywriter', pipeline: pipe(), issues, topics})[0], /Build this one/);
  assert.match(idleWork({agent: 'image-maker', pipeline: pipe({building: {productId: 'P002', stepId: 'create', stepName: 'Create'}}), issues, topics})[0], /Create for P002 in the build slot/);
  assert.match(idleWork({agent: 'store-builder', pipeline: pipe({building: {productId: 'P002', stepId: 'build', stepName: 'Build'}}), issues, topics})[0], /P002 holds the build slot at Build/);
  assert.deepEqual(idleWork({agent: 'os-builder', pipeline: pipe()}), ['Run `os.mjs doctor` and fix what it lists; ask the manager for Launchroom bugs.']);
  assert.deepEqual(idleWork({agent: 'manager', pipeline: pipe()}), []);
  // Short: at most IDLE_LINES lines and IDLE_BLOCK_WORDS words for every agent.
  for (const agent of ['scout', 'checker', 'buyer-researcher', 'copywriter', 'image-maker', 'store-builder', 'os-builder']) {
    const lines = idleWork({agent, pipeline: atValidate, issues, topics});
    assert.ok(lines.length >= 1 && lines.length <= IDLE_LINES, agent);
    assert.ok(words(idleMarkdown(lines)) <= IDLE_BLOCK_WORDS, `${agent}: ${words(idleMarkdown(lines))} words`);
  }
  assert.equal(idleMarkdown([]), '');
});

test('someday agent tasks are parked: never dispatched, shown as a count', () => {
  const tasks = [
    {id: 'a', agent: 'scout', status: 'todo', date: '2026-10-02'},
    {id: 'b', agent: 'scout', status: 'todo', date: ''},
    {id: 'c', agent: 'checker', status: 'doing', date: ''},
    {id: 'd', agent: 'checker', status: 'blocked', date: '2026-10-01'},
    {id: 'e', agent: 'scout', status: 'done', date: ''},
    {id: 'f', status: 'todo', date: '', assignee: 'owner'},
  ];
  const inbox = agentInbox(tasks);
  assert.deepEqual(Object.fromEntries(Object.entries(inbox).map(([key, list]) => [key, list.map(task => task.id)])), {waiting: ['a'], working: ['c'], blocked: ['d'], parked: ['b']});
  assert.deepEqual(tasks.filter(isParkedAgentTask).map(task => task.id), ['b']);
  assert.deepEqual(tasks.filter(isDispatchable).map(task => task.id), ['a']);
});

test('briefs: parked jobs are a count, an idle agent gets "Nothing assigned? Useful now", the round names its issue', () => {
  const find = currentStep({leads: []});
  const step = {...find, pipeline: {...find.pipeline, round: {number: 5, id: 'R05', open: true, startedOn: '2026-10-01', focus: 'Sleep, energy and focus', issue: 'sleep'}}};
  const state = {handoff: {summary: 'Find.', nextAction: 'Eye test.', blockers: ''}};
  const planner = {tasks: [
    {id: 'T-stale-1', title: 'Curate Kalodata products', agent: 'scout', status: 'todo', date: '', nextAction: 'Kalodata'},
    {id: 'T-stale-2', title: 'Learn: Kalodata Canada', agent: 'scout', status: 'todo', date: ''},
    {id: 'T-live', title: 'Fix the brief', agent: 'os-builder', status: 'doing', date: '2026-10-01'},
  ]};
  const scout = agentBrief({state, planner, lessons: emptyLessons(), agent: 'scout', step, issues, topics});
  assert.doesNotMatch(scout.markdown, /Curate Kalodata products|Learn: Kalodata Canada/, 'parked jobs are not listed as to-dos');
  assert.match(scout.markdown, /## Your open to-dos\n\nNone\.\n\nParked \(someday, not to start\): 2\./);
  assert.match(scout.markdown, /## Nothing assigned\? Useful now\n\n- Find more Round 5 cards where the sales numbers are hitting/);
  assert.equal(scout.parked, 2); assert.ok(scout.idleWords > 0 && scout.idleWords <= IDLE_BLOCK_WORDS);
  assert.match(scout.markdown, /- \*\*Round 5\*\* \(started 2026-10-01; issue sleep\): Sleep, energy and focus/);
  // An agent with work assigned gets no idle block.
  const builder = agentBrief({state, planner, lessons: emptyLessons(), agent: 'os-builder', step, issues, topics});
  assert.doesNotMatch(builder.markdown, /Nothing assigned/); assert.match(builder.markdown, /- Fix the brief/);
  // The manager's inbox counts only dispatchable jobs.
  const manager = agentBrief({state, planner, lessons: emptyLessons(), agent: 'manager', step});
  assert.match(manager.markdown, /## Open to-dos \(agent inbox: 0 waiting\)/);
  assert.doesNotMatch(manager.markdown, /Nothing assigned/);
  // A legacy round's line says how to link its issue, within the pipeline block's cap.
  const legacy = pipelineMarkdown({...step.pipeline, round: {...step.pipeline.round, issue: undefined}}, {agent: 'scout'});
  assert.doesNotMatch(legacy, /no issue yet/, 'a round needs no issue (owner, Oct 2)');
  assert.ok(words(legacy) <= PIPELINE_BLOCK_WORDS);
});

test('the issue list for the helper: Testing first, then Verified and Candidates, legacy rounds named', () => {
  const lane = issueLane({issues: [issues[2], issues[1], issues[0]], roundsWithoutIssue: [{id: 'R04', number: 4, open: false}, {id: 'R05', number: 5, open: true}]});
  assert.deepEqual(lane.entries.map(entry => [entry.slug, entry.status, entry.gate, entry.passed, entry.roundText]), [['sleep', 'testing', '7/7', true, 'R05'], ['low-energy', 'verified', '7/7', true, 'No round yet'], ['pets', 'candidate', '5/7', false, 'No round yet']]);
  assert.deepEqual([lane.passed, lane.testing, lane.total, lane.legacy], [2, 1, 3, ['R05']]);
  assert.deepEqual(issueLane(null), {entries: [], passed: 0, testing: 0, total: 0, legacy: []});
});
