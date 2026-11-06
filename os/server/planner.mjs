import {randomUUID} from 'node:crypto';
import {object, text, fail, assertRevision, evidenceSource} from './domain.mjs';
import {FOCUS_LIMIT, TASK_STEPS, openFocus, stepId} from '../src/plannerRules.mjs';

export const emptyPlanner = () => ({revision: 0, tasks: []});
const statuses = ['todo', 'doing', 'blocked', 'done'];
export const AGENT_ID = /^[a-z][a-z0-9-]{0,59}$/;
export const MAX_TASK_AGENTS = 8;
/** How many deleted tasks stay restorable, newest first. */
export const DELETED_KEPT = 200;
/** A product on the pipeline: a card (L###) or a product record (P### or P###-name). The store checks it exists. */
export const PRODUCT_REF = /^(?:L\d{3,}|P\d{3,}(?:-[a-z0-9]+)*)$/;
function day(value) {
  if (value === '') return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('Choose a valid task date, or leave it unscheduled.');
  return value;
}
const dayLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
function fields(input, previous = {}) {
  const status = input.status ?? previous.status ?? 'todo';
  if (!statuses.includes(status)) fail('Unknown task status.');
  const refs = input.references ?? previous.references ?? [];
  if (!Array.isArray(refs) || refs.length > 12) fail('Use at most 12 task references.');
  const focus = input.focus ?? previous.focus ?? false;
  const assignee = input.assignee ?? previous.assignee ?? 'shared';
  if(!['owner','agent','shared'].includes(assignee)) fail('Choose owner, agent or shared responsibility.');
  if (typeof focus !== 'boolean') fail('Task focus must be true or false.');
  // Optional team members (agents/team.json IDs) the manager should dispatch this to. `agent` is the first of them.
  const named = input.agents ?? (input.agent !== undefined ? (input.agent === '' ? [] : [input.agent]) : previous.agents ?? (previous.agent ? [previous.agent] : []));
  if (!Array.isArray(named) || named.length > MAX_TASK_AGENTS || named.some(id => typeof id !== 'string' || !AGENT_ID.test(id))) fail('Choose team agents, or leave it unassigned.');
  const agents = [...new Set(named)], agent = agents[0] || '';
  if (agent && assignee === 'owner') fail('A task for a team agent cannot be the owner\'s task.');
  // Optional step tag: one of the seven step ids, or empty. Tags saved with the
  // old six-step ids (discovery, validation, sourcing, creative, shopify, testing) read as their new step.
  const rawStep = input.step ?? previous.step ?? '';
  const step = typeof rawStep === 'string' ? (stepId(rawStep) ?? rawStep) : rawStep;
  if (typeof step !== 'string' || (step && !TASK_STEPS.includes(step))) fail(`Choose one of the seven steps (${TASK_STEPS.join(', ')}), or leave the step empty.`);
  // Optional product the task moves along its line: a card (L###) or a product (P###).
  const product = input.product ?? previous.product ?? '';
  if (typeof product !== 'string' || (product && !PRODUCT_REF.test(product))) fail('Name the product as a card id (L###) or a product id (P###), or leave it empty.');
  return {
    title: text(input.title ?? previous.title, 'Task title', {required:true,max:180}),
    date: day(input.date ?? previous.date ?? ''), status, focus, assignee, agent, agents, step, product,
    nextAction:text(input.nextAction??previous.nextAction??'', 'Next action', {max:1500}),
    notes: text(input.notes ?? previous.notes ?? '', 'Task notes', {max:6000}),
    references: [...new Set(refs.map(value => evidenceSource(value)))],
  };
}
export function validatePlanner(raw) {
  object(raw);
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.tasks) || raw.tasks.length > 1000) fail('Invalid saved planner. Restore the record before editing.', 'MALFORMED_DATA', 500);
  const ids = new Set();
  for (const task of raw.tasks) {
    object(task); fields(task);
    if (typeof task.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(task.id) || ids.has(task.id)) fail('Invalid or duplicate saved task ID.', 'MALFORMED_DATA', 500);
    for (const key of ['createdAt','updatedAt']) if (!Number.isFinite(Date.parse(task[key]))) fail('Invalid saved task timestamp.', 'MALFORMED_DATA', 500);
    if (task.status === 'done' && !Number.isFinite(Date.parse(task.completedAt))) fail('Completed task has no completion time.', 'MALFORMED_DATA', 500);
    ids.add(task.id);
  }
  if (raw.deleted !== undefined && (!Array.isArray(raw.deleted) || raw.deleted.length > DELETED_KEPT || raw.deleted.some(task => typeof task?.id !== 'string' || !Number.isFinite(Date.parse(task?.deletedAt))))) fail('Invalid saved planner. Restore the record before editing.', 'MALFORMED_DATA', 500);
  return raw;
}
/**
 * The focus cap: flagging a task, or moving a flagged task to another day, is
 * refused when that day already has FOCUS_LIMIT open focus tasks. Days saved
 * before the cap keep their flags; editing such a task's other fields still works.
 */
function assertFocusRoom(tasks, task, previous) {
  const enters = task.focus && task.date && task.status !== 'done' && (!previous || !previous.focus || previous.date !== task.date);
  if (enters && openFocus(tasks, task.date, task.id).length >= FOCUS_LIMIT) fail(`${dayLabel(task.date)} already has ${FOCUS_LIMIT} focus tasks, the most for one day. Finish or unflag one first, or save this one without the flag.`, 'FOCUS_FULL', 409);
}
export function updatePlanner(raw, input) {
  const current = validatePlanner(raw); object(input); assertRevision(current.revision, input.revision);
  const next = structuredClone(current), now = new Date().toISOString();
  const id = input.id ?? `T-${randomUUID()}`;
  const previous = next.tasks.find(task => task.id === id);
  if (input.id && !previous) fail('Task not found. Refresh the planner.', 'NOT_FOUND', 404);
  if (!previous && next.tasks.length >= 1000) fail('Planner task limit reached. Preserve an archive before adding more.', 'PLANNER_FULL', 409);
  const value = fields(input, previous);
  const task = {...previous, ...value, id, createdAt:previous?.createdAt || now, updatedAt:now,
    completedAt:value.status === 'done' ? previous?.completedAt || now : null};
  assertFocusRoom(next.tasks, task, previous);
  if (previous) next.tasks[next.tasks.indexOf(previous)] = task; else next.tasks.push(task);
  next.revision++;
  if (JSON.stringify(next).length > 1_500_000) fail('Planner storage limit reached.', 'PLANNER_FULL', 409);
  return next;
}
const chooseIds = input => {
  const ids = input.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) fail('Choose 1 to 200 different tasks.');
  return ids;
};
/**
 * Delete tasks (owner, Nov 5: "we should be able to easily delete things"). They leave every list and every
 * brief at once, but stay in `deleted` so Undo and Recently deleted can bring them back. Oldest fall off at DELETED_KEPT.
 */
export function deletePlannerTasks(raw, input, {by = 'owner'} = {}) {
  const current = validatePlanner(raw); object(input); assertRevision(current.revision, input.revision);
  const ids = chooseIds(input);
  const next = structuredClone(current), now = new Date().toISOString();
  const gone = ids.map(id => {
    const task = next.tasks.find(item => item.id === id);
    if (!task) fail('Task not found. Refresh the planner.', 'NOT_FOUND', 404);
    return {...task, deletedAt: now, deletedBy: by};
  });
  next.tasks = next.tasks.filter(task => !ids.includes(task.id));
  next.deleted = [...gone, ...(next.deleted || [])].slice(0, DELETED_KEPT);
  next.revision++;
  return next;
}
/** Put deleted tasks back. A flagged task keeps its flag while its day has room. */
export function restorePlannerTasks(raw, input) {
  const current = validatePlanner(raw); object(input); assertRevision(current.revision, input.revision);
  const ids = chooseIds(input);
  const next = structuredClone(current);
  for (const id of ids) {
    const task = (next.deleted || []).find(item => item.id === id);
    if (!task) fail('That task is no longer in Recently deleted.', 'NOT_FOUND', 404);
    if (next.tasks.length >= 1000) fail('Planner task limit reached. Preserve an archive before adding more.', 'PLANNER_FULL', 409);
    const {deletedAt, deletedBy, ...saved} = task;
    if (saved.focus && openFocus(next.tasks, saved.date, saved.id).length >= FOCUS_LIMIT) saved.focus = false;
    next.tasks.push(saved);
  }
  next.deleted = next.deleted.filter(task => !ids.includes(task.id));
  next.revision++;
  return next;
}

/**
 * Move open tasks to one day (or someday with date ''), in one revision-checked
 * write: the "From earlier" buttons and Wrap up the day. It never marks anything
 * done and refuses finished tasks. A flagged task keeps its flag while the new
 * day has room; the rest move without it and are listed in `unflagged`.
 */
export function movePlannerTasks(raw, input) {
  const current = validatePlanner(raw); object(input); assertRevision(current.revision, input.revision);
  const ids = input.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) fail('Choose 1 to 200 different tasks to move.');
  if (typeof input.date !== 'string') fail('Choose the day to move the tasks to, or "" for someday.');
  const date = day(input.date);
  const next = structuredClone(current), now = new Date().toISOString();
  const moved = [], unflagged = [];
  for (const id of ids) {
    const task = next.tasks.find(item => item.id === id);
    if (!task) fail('Task not found. Refresh the planner.', 'NOT_FOUND', 404);
    if (task.status === 'done') fail(`"${task.title}" is finished, so it stays on the day it was done. Move only open tasks.`);
    if (task.date === date) continue;
    task.date = date; task.updatedAt = now;
    if (task.focus && openFocus(next.tasks, date, task.id).length >= FOCUS_LIMIT) { task.focus = false; unflagged.push(id); }
    moved.push(id);
  }
  if (!moved.length) return {planner: current, moved, unflagged};
  next.revision++;
  return {planner: next, moved, unflagged};
}
