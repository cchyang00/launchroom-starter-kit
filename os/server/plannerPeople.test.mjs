import test from 'node:test';
import assert from 'node:assert/strict';
import {deletePlannerTasks, emptyPlanner, restorePlannerTasks, updatePlanner, validatePlanner, DELETED_KEPT} from './planner.mjs';
import {MANAGER, OWNER, hasAgent, involves, peopleFields, taskAgents, taskPeople, togglePerson} from '../src/plannerRules.mjs';
import {teamBoard} from '../src/workflowView.mjs';

// Nov 5: "easily delete things. and checkmark things, and make it like an actual to-do and planner between me,
// and the agents, and maybe even multiple agents."
const add = (planner, input) => updatePlanner(planner, {revision: planner.revision, date: '2026-11-05', ...input});

test('a task can be between the owner and several agents, and old tasks still read', () => {
  const crew = {assignee: 'agent', agents: ['scout', 'checker']};
  assert.deepEqual(taskAgents(crew), ['scout', 'checker']);
  assert.deepEqual(taskPeople(crew), ['scout', 'checker']);
  assert.deepEqual(taskPeople({assignee: 'shared', agents: ['scout']}), [OWNER, 'scout']);
  assert.deepEqual(taskPeople({assignee: 'shared'}), [OWNER, MANAGER]);
  assert.deepEqual(taskPeople({assignee: 'owner'}), [OWNER]);
  assert.deepEqual(taskPeople({assignee: 'agent'}), [MANAGER]);
  assert.deepEqual(taskPeople({assignee: 'agent', agent: 'scout'}), ['scout'], 'a task saved before Nov 5 has only agent');
  assert.deepEqual(taskPeople({}), [OWNER, MANAGER], 'an unset task is together');
  assert.ok(hasAgent({agent: 'scout'}, 'scout'));
  assert.ok(involves({assignee: 'shared', agents: ['scout']}, OWNER));
  assert.ok(involves({assignee: 'shared', agents: ['scout']}, 'scout'));
  assert.equal(involves({assignee: 'owner'}, 'scout'), false);
  assert.ok(involves({assignee: 'owner'}, 'all'));
});

test('tapping people on and off keeps a task with someone, and Claude and named agents do not mix', () => {
  assert.deepEqual(togglePerson([OWNER], 'scout'), [OWNER, 'scout']);
  assert.deepEqual(togglePerson([MANAGER], 'scout'), ['scout']);
  assert.deepEqual(togglePerson(['scout', 'checker'], MANAGER), [MANAGER]);
  assert.deepEqual(togglePerson([OWNER, 'scout'], MANAGER), [OWNER, MANAGER]);
  assert.deepEqual(togglePerson(['scout'], OWNER), [OWNER, 'scout']);
  assert.deepEqual(togglePerson(['scout'], 'scout'), ['scout'], 'the last person stays');
  assert.deepEqual(peopleFields([OWNER]), {assignee: 'owner', agents: [], agent: ''});
  assert.deepEqual(peopleFields([MANAGER]), {assignee: 'agent', agents: [], agent: ''});
  assert.deepEqual(peopleFields([OWNER, MANAGER]), {assignee: 'shared', agents: [], agent: ''});
  assert.deepEqual(peopleFields(['scout', 'checker']), {assignee: 'agent', agents: ['scout', 'checker'], agent: 'scout'});
  assert.deepEqual(peopleFields([OWNER, 'scout']), {assignee: 'shared', agents: ['scout'], agent: 'scout'});
});

test('the planner saves several agents, keeps agent as the first, and each agent sees the task', () => {
  let planner = add(emptyPlanner(), {title: 'Build the page', assignee: 'agent', agents: ['store-builder', 'copywriter', 'copywriter']});
  const task = planner.tasks[0];
  assert.deepEqual(task.agents, ['store-builder', 'copywriter']);
  assert.equal(task.agent, 'store-builder');
  planner = updatePlanner(planner, {revision: planner.revision, id: task.id, status: 'doing'});
  assert.deepEqual(planner.tasks[0].agents, ['store-builder', 'copywriter'], 'another save keeps them');
  planner = updatePlanner(planner, {revision: planner.revision, id: task.id, agent: 'scout'});
  assert.deepEqual([planner.tasks[0].agent, planner.tasks[0].agents], ['scout', ['scout']], 'the helper\'s one agent replaces them');
  planner = updatePlanner(planner, {revision: planner.revision, id: task.id, agent: ''});
  assert.deepEqual([planner.tasks[0].agent, planner.tasks[0].agents], ['', []]);
  assert.throws(() => add(emptyPlanner(), {title: 'x', assignee: 'owner', agents: ['scout']}), /owner/);
  assert.throws(() => add(emptyPlanner(), {title: 'x', assignee: 'agent', agents: ['Bad ID']}), /team agents/);
  const board = teamBoard([{id: 'scout', skills: [], guides: []}, {id: 'checker', skills: [], guides: []}], [{id: 'T-1', title: 'Both', status: 'doing', assignee: 'agent', agent: 'scout', agents: ['scout', 'checker'], date: '2026-11-05'}], [], '2026-11-05');
  assert.equal(board.agents.find(agent => agent.id === 'checker').doing.length, 1, 'the second agent has it on their board too');
});

test('delete takes a task off the list, keeps it restorable, and Undo puts it back', () => {
  let planner = add(emptyPlanner(), {title: 'Stale job', assignee: 'agent', agent: 'scout'});
  planner = add(planner, {title: 'Keep', assignee: 'owner'});
  const id = planner.tasks[0].id;
  const before = planner.revision;
  planner = deletePlannerTasks(planner, {revision: planner.revision, ids: [id]}, {by: 'owner'});
  assert.deepEqual(planner.tasks.map(task => task.title), ['Keep']);
  assert.equal(planner.deleted[0].id, id);
  assert.equal(planner.deleted[0].deletedBy, 'owner');
  assert.equal(planner.revision, before + 1);
  validatePlanner(planner);
  assert.throws(() => deletePlannerTasks(planner, {revision: planner.revision, ids: [id]}), /not found/i, 'a second delete is refused');
  assert.throws(() => deletePlannerTasks(planner, {revision: 0, ids: [planner.tasks[0].id]}), /revision|changed/i);
  assert.throws(() => deletePlannerTasks(planner, {revision: planner.revision, ids: []}), /Choose/);
  planner = restorePlannerTasks(planner, {revision: planner.revision, ids: [id]});
  assert.deepEqual(planner.tasks.map(task => task.title).sort(), ['Keep', 'Stale job']);
  assert.equal(planner.deleted.length, 0);
  assert.equal(planner.tasks.find(task => task.id === id).deletedAt, undefined);
  validatePlanner(planner);
  assert.throws(() => restorePlannerTasks(planner, {revision: planner.revision, ids: [id]}), /no longer/);
});

test('a restored focus task keeps its flag only while the day has room, and the bin stays bounded', () => {
  let planner = add(emptyPlanner(), {title: 'One', focus: true, assignee: 'owner'});
  const id = planner.tasks[0].id;
  planner = deletePlannerTasks(planner, {revision: planner.revision, ids: [id]});
  for (const title of ['Two', 'Three', 'Four']) planner = add(planner, {title, focus: true, assignee: 'owner'});
  planner = restorePlannerTasks(planner, {revision: planner.revision, ids: [id]});
  assert.equal(planner.tasks.find(task => task.id === id).focus, false);
  let many = emptyPlanner();
  many.deleted = Array.from({length: DELETED_KEPT}, (_, index) => ({id: `T-${index}`, title: 'x', deletedAt: '2026-11-01T00:00:00Z'}));
  many = add(many, {title: 'New', assignee: 'owner'});
  many = deletePlannerTasks(many, {revision: many.revision, ids: [many.tasks[0].id]});
  assert.equal(many.deleted.length, DELETED_KEPT);
  assert.equal(many.deleted[0].title, 'New');
});
