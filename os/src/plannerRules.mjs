// Planner rules shared by the server (server/planner.mjs) and the Today screen,
// so the focus cap and the step tags cannot drift apart.
import {STEP_IDS, stepId as stepIdOf, stepName as nameOf} from './steps.mjs';

/** At most this many open focus tasks on one day ("If only these get done, today was a win"). */
export const FOCUS_LIMIT = 3;

/**
 * Who a task is between (owner, Nov 5: "an actual to-do and planner between me, and the agents, and maybe even
 * multiple agents"). A task names any team agents in `agents`; `agent` stays as the first of them, so everything
 * that reads one doer keeps working. Claude is `manager`: the chat, who also hands work to the named agents.
 */
export const OWNER = 'owner', MANAGER = 'manager';
export const taskAgents = task => (Array.isArray(task?.agents) && task.agents.length ? task.agents : task?.agent ? [task.agent] : []);
export const hasAgent = (task, id) => taskAgents(task).includes(id);
/** The people on a task, you first: owner, then the named agents, or Claude when no agent is named. */
export function taskPeople(task) {
  const assignee = task?.assignee || 'shared', agents = taskAgents(task);
  if (assignee === 'owner') return [OWNER];
  return [...(assignee === 'shared' ? [OWNER] : []), ...(agents.length ? agents : [MANAGER])];
}
export const involves = (task, person) => person === 'all' || taskPeople(task).includes(person);
/** Tap a person on or off. Claude and named agents don't mix (Claude hands work to them), and a task always keeps someone. */
export function togglePerson(people = [], person) {
  const on = people.includes(person);
  if (on) { const left = people.filter(id => id !== person); return left.length ? left : people; }
  if (person === OWNER) return [OWNER, ...people];
  if (person === MANAGER) return [...people.filter(id => id === OWNER), MANAGER];
  return [...people.filter(id => id !== MANAGER), person];
}
/** The saved fields for a set of people. */
export function peopleFields(people = []) {
  const owner = people.includes(OWNER), agents = people.filter(id => id !== OWNER && id !== MANAGER), claude = people.includes(MANAGER);
  return {assignee: owner ? (agents.length || claude ? 'shared' : 'owner') : 'agent', agents, agent: agents[0] || ''};
}

/** Planner tasks may carry one of the seven step ids (or none). Tags saved with the old six-step ids read as their new step. */
export const TASK_STEPS = STEP_IDS;
export const stepName = id => nameOf(id);

/**
 * A step id from an id, a name, an old six-step word or a number ("product",
 * "find", "Prove it", "validate", "3"). Returns '' for none/empty and null when
 * the word is not a step (src/steps.mjs).
 */
export const stepId = value => stepIdOf(value);

/** Open focus tasks scheduled on `date` (someday tasks have no cap), leaving out `exceptId`. */
export function openFocus(tasks = [], date = '', exceptId = '') {
  if (!date) return [];
  return tasks.filter(task => task.id !== exceptId && task.focus && task.date === date && task.status !== 'done');
}

/** How many more tasks can be flagged on `date`. */
export const focusRoom = (tasks, date, exceptId) => date ? Math.max(0, FOCUS_LIMIT - openFocus(tasks, date, exceptId).length) : Infinity;

/**
 * Agent jobs the manager may dispatch: a team agent's open "todo" task with a
 * date. A someday task (no date) is parked: it is never dispatched and shows at
 * most as a "Parked" count (cold-start test, Oct 1: stale Kalodata jobs dated
 * someday were listed as DISPATCH).
 */
export const isParkedAgentTask = task => Boolean(task?.agent) && task.status === 'todo' && !task.date;
export const isDispatchable = task => Boolean(task?.agent) && task.status === 'todo' && Boolean(task.date);
/** The agent inbox from saved tasks: waiting (dispatchable), working, blocked and parked (someday). */
export function agentInbox(tasks = []) {
  const mine = tasks.filter(task => task.agent && task.status !== 'done');
  const byDate = (a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999'));
  return {
    waiting: mine.filter(isDispatchable).sort(byDate),
    working: mine.filter(task => task.status === 'doing'),
    blocked: mine.filter(task => task.status === 'blocked'),
    parked: mine.filter(isParkedAgentTask),
  };
}
