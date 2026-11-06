import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createStore} from './store.mjs';
import {emptyLessons, updateLessons, agentBrief, lessonReview, LESSON_LIMITS} from './lessons.mjs';

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-lessons-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-lessons-')); await fs.rm(root, {recursive: true, force: true}); });
  await fs.mkdir(path.join(root, 'agents'), {recursive: true});
  await fs.mkdir(path.join(root, 'workflow'), {recursive: true});
  await fs.writeFile(path.join(root, 'workflow/GUIDE.md'), '# Guide\n');
  await fs.writeFile(path.join(root, 'agents/team.json'), JSON.stringify({agents: [{id: 'scout', role: 'validation', name: 'Product scout', summary: 'Finds products.'}, {id: 'copywriter', role: 'image-generator', name: 'Copywriter', summary: 'Writes copy.'}]}));
  return {root, store: createStore({workspaceRoot: root})};
}
const base = {rule: 'Skip cheap commodities even with big numbers.', why: 'The owner rejected them.', scope: 'scout'};

test('a lesson moves from proposed to trying to proven only with evidence', () => {
  let state = updateLessons(emptyLessons(), {revision: 0, ...base, proposedBy: 'scout', learnedOn: '2026-09-30'});
  const id = state.lessons[0].id;
  assert.equal(id, 'LS-001'); assert.equal(state.lessons[0].status, 'proposed');
  state = updateLessons(state, {revision: 1, id, status: 'trying'});
  assert.throws(() => updateLessons(state, {revision: 2, id, status: 'proven'}), /helped at least once/);
  state = updateLessons(state, {revision: 2, id, use: {helped: true, by: 'scout'}});
  assert.equal(state.lessons[0].uses, 1); assert.equal(state.lessons[0].helped, 1);
  state = updateLessons(state, {revision: 3, id, status: 'proven'});
  assert.equal(state.lessons[0].status, 'proven');
  assert.throws(() => updateLessons(state, {revision: 4, id, status: 'retired'}), /why the lesson is retired/);
  state = updateLessons(state, {revision: 4, id, status: 'retired', statusNote: 'Superseded by a broader rule.'});
  assert.throws(() => updateLessons(state, {revision: 5, id, use: {helped: true}}), /active lesson/);
  assert.throws(() => updateLessons(state, {revision: 4, id, rule: 'Stale'}), e => e.code === 'REVISION_CONFLICT');
  const owner = updateLessons(emptyLessons(), {revision: 0, ...base, source: 'owner', status: 'proven', proposedBy: 'owner'});
  assert.equal(owner.lessons[0].status, 'proven', 'owner corrections can start proven');
  for (const bad of [{rule: 'x'.repeat(201)}, {scope: 'Not a scope'}, {status: 'adopted'}, {source: 'guess'}, {references: ['../secret.md']}, {use: {helped: 'yes'}}])
    assert.throws(() => updateLessons(emptyLessons(), {revision: 0, ...base, ...bad}));
});

test('each list stays short: limits apply to active lessons only', () => {
  let state = emptyLessons();
  for (let i = 0; i < LESSON_LIMITS.scope; i++) state = updateLessons(state, {revision: state.revision, ...base, rule: `Rule ${i}`, status: 'trying'});
  assert.throws(() => updateLessons(state, {revision: state.revision, ...base, rule: 'One too many', status: 'trying'}), e => e.code === 'LESSON_LIMIT');
  state = updateLessons(state, {revision: state.revision, ...base, rule: 'Proposed waits', status: 'proposed'});
  const waiting = state.lessons.at(-1).id;
  assert.throws(() => updateLessons(state, {revision: state.revision, id: waiting, status: 'trying'}), e => e.code === 'LESSON_LIMIT');
  state = updateLessons(state, {revision: state.revision, id: 'LS-001', status: 'retired', statusNote: 'Merged into LS-002.'});
  state = updateLessons(state, {revision: state.revision, id: waiting, status: 'trying'});
  assert.equal(state.lessons.filter(l => l.scope === 'scout' && ['trying', 'proven'].includes(l.status)).length, LESSON_LIMITS.scope);
  for (let i = 0; i < LESSON_LIMITS.everyone; i++) state = updateLessons(state, {revision: state.revision, ...base, scope: 'everyone', rule: `Shared ${i}`, status: 'trying'});
  assert.throws(() => updateLessons(state, {revision: state.revision, ...base, scope: 'everyone', rule: 'Too many shared', status: 'trying'}), e => e.code === 'LESSON_LIMIT');
});

test('a brief holds Now, my lessons, everyone\'s lessons and my to-dos, and nothing proposed or retired', () => {
  let lessons = emptyLessons();
  for (const input of [{...base, status: 'trying'}, {...base, rule: 'Copy rule', scope: 'copywriter', status: 'trying'}, {...base, rule: 'Shared rule', scope: 'everyone', status: 'proven', source: 'owner'}, {...base, rule: 'Waiting rule', status: 'proposed'}])
    lessons = updateLessons(lessons, {revision: lessons.revision, ...input});
  const state = {handoff: {summary: 'No product selected yet.', nextAction: 'Curate a batch.', blockers: ''}};
  // Dated: a someday (undated) agent task is parked and left out of the to-dos (cold-start test, Oct 1).
  const planner = {tasks: [{id: 'T-1', title: 'Find pet products', status: 'todo', agent: 'scout', date: '2026-10-01'}, {id: 'T-2', title: 'Write ads', status: 'todo', agent: 'copywriter', date: '2026-10-01'}]};
  const brief = agentBrief({state, planner, lessons, agent: 'scout', name: 'Product scout'});
  assert.match(brief.markdown, /No product selected yet/); assert.match(brief.markdown, /Skip cheap commodities/); assert.match(brief.markdown, /Shared rule/); assert.match(brief.markdown, /Find pet products/);
  assert.doesNotMatch(brief.markdown, /Copy rule|Waiting rule|Write ads/);
  assert.ok(brief.words < 400, `brief stays short (${brief.words} words)`);
  const review = lessonReview(lessons, '2026-10-01');
  assert.equal(review.active, 3); assert.equal(review.proposed, 1);
});

test('lessons persist through the API store, regenerate memory pages and check sources', async t => {
  const {root, store} = await setup(t);
  assert.deepEqual((await store.getLessons()).lessons, []);
  await assert.rejects(store.saveLesson({revision: 0, ...base, references: ['workflow/MISSING.md']}));
  let saved = await store.saveLesson({revision: 0, ...base, status: 'trying', learnedOn: '2026-09-30', references: ['workflow/GUIDE.md']});
  saved = await store.saveLesson({revision: saved.revision, rule: 'Write OS records through Node.', why: 'PowerShell garbles symbols.', scope: 'everyone', status: 'proven', source: 'owner', learnedOn: '2026-09-30'});
  assert.equal(saved.review.active, 2);
  const read = file => fs.readFile(path.join(root, file), 'utf8');
  assert.match(await read('memory/LESSONS.md'), /## scout \(1\/10\)[\s\S]*Skip cheap commodities/);
  assert.match(await read('memory/START-HERE.md'), /Lessons for everyone \(1\)[\s\S]*Write OS records through Node/);
  assert.doesNotMatch(await read('memory/START-HERE.md'), /Skip cheap commodities/, 'the manager page carries everyone and manager lessons only');
  assert.match(await read('memory/days/2026-09-30.md'), /Lessons learned or retired this day[\s\S]*LS-001/);
  await store.patchWorkspaceHandoff({revision: 0, summary: 'Store is a demo.', nextAction: 'Seed lessons.', blockers: ''});
  assert.match(await read('memory/NOW.md'), /Store is a demo/);
  const brief = await store.getBrief('scout');
  assert.match(brief.markdown, /Brief for Product scout[\s\S]*Store is a demo[\s\S]*Skip cheap commodities[\s\S]*Write OS records/);
  await assert.rejects(store.getBrief('nobody'), e => e.status === 404);
  await assert.rejects(store.getBrief('../x'));
  assert.match((await store.getBrief()).markdown, /Brief for the manager/);
  await fs.writeFile(path.join(root, 'os/data/lessons.json'), '{broken');
  await assert.rejects(store.getLessons(), e => e.code === 'MALFORMED_DATA');
});
