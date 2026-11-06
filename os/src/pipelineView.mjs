// What the pipeline screens show, derived from pipelineState (src/pipeline.mjs)
// and saved tasks and reports only. Rows, groups, counts and a product's own
// step never come from where something sits on screen, and nothing here moves
// a product: the owner's eye test and "Build this one" are separate, recorded
// writes with a reason.
import {STEP_IDS, STEP_NAMES, STEP_STAGES} from './steps.mjs';
import {BUILD_FROM, PRODUCT_STEP, PROVE_STEP, AGENT_STEPS, findItem, whoName} from './pipeline.mjs';
import {fillPrompt} from './theLine.mjs';
import {issueStation} from './issueList.mjs';

/** The product check stages (server/domain.mjs) under each step of a product's line (src/steps.mjs). Product and Buyers have none. */
export {STEP_STAGES};

const clip = (value, max) => { const s = String(value || '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const day = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';

/** Does a task's or report's `product` field (L### or the full P###-slug) name this row? */
export const namesItem = (item, value) => Boolean(item && value) && [item.id, item.leadId, item.productId].filter(Boolean).includes(value);

/** "L096 Children's disc story player" for a `product` field, or the bare value when it names nothing on the pipeline. */
export function productLabel(pipeline, value, max = 34) {
  if (!value) return '';
  const item = findItem(pipeline, value);
  return item ? `${item.id} ${clip(item.name, max)}` : value;
}

/** The round a group of rows belongs to, as a short label. */
const roundLabel = round => round ? `Round ${round.number}` : 'Earlier work';

/**
 * The Pipeline page's groups: the product in the build slot, the products
 * ready to build, the other rows on the line by round (the current round
 * first, then newer rounds, then "Earlier work"), and the rows out of the line
 * by round (newest first). Rows keep pipelineState's order inside a group.
 */
export function pipelineGroups(pipeline) {
  const active = pipeline?.active || [], out = pipeline?.out || [];
  const rounds = new Map((pipeline?.rounds || []).map(round => [round.number, round]));
  const current = pipeline?.round?.number ?? null;
  const byRound = (items, currentFirst) => {
    const keys = [...new Set(items.map(item => item.round ?? null))];
    keys.sort((a, b) => (a === null) - (b === null) || (currentFirst ? (b === current) - (a === current) : 0) || (b ?? 0) - (a ?? 0));
    return keys.map(number => {
      const round = number === null ? null : rounds.get(number) || {number, id: `R${String(number).padStart(2, '0')}`};
      return {key: number === null ? 'earlier' : `R${number}`, number, round, label: roundLabel(round), current: number !== null && number === current, items: items.filter(item => (item.round ?? null) === number)};
    });
  };
  const building = active.find(item => item.building) || null;
  const ready = active.filter(item => item.readyToBuild);
  const rest = active.filter(item => !item.building && !item.readyToBuild);
  return {building, ready, rounds: byRound(rest, true), out: byRound(out, false), outCount: out.length};
}

/**
 * The round header: "Round N · focus · started date", its state (open, ready
 * to review, reviewed) and the per-step counts of the whole pipeline.
 */
export function roundHeader(pipeline) {
  const r = pipeline?.round || null;
  const stations = stepStations(pipeline);
  if (!r) return {round: null, label: 'No round yet', focus: '', started: '', issue: '', state: 'none', stateLabel: `Start Round ${pipeline?.nextNumber || 1}`, stations};
  const state = !r.open ? 'reviewed' : r.needsReview ? 'review' : 'open';
  const stateLabel = state === 'reviewed' ? `Reviewed ${day(r.review?.reviewedOn)}`.trim()
    : state === 'review' ? 'Ready to review'
      : r.inProductProve ? `Open · ${plural(r.inProductProve, 'card')} on Find` : 'Open';
  return {round: r, label: `Round ${r.number}`, focus: r.focus || '', started: r.startedOn || '', issue: r.issue || '', state, stateLabel, stations};
}

/**
 * Seven stations: how many products sit at each step (building products at
 * their own step), the ready-to-build count on Prove it, and whether a move of
 * the owner's waits there (eye test on Product, build pick on Prove it, launch
 * approval on the building product's step). Step 0 (the issue list) is not a
 * product step: issueStationOf gives its station.
 */
export function stepStations(pipeline) {
  const counts = pipeline?.counts || {};
  const moves = pipeline?.ownerMoves || [];
  const ownerAt = new Set(moves.map(move => move.step));
  return STEP_IDS.map((id, index) => {
    const count = counts[id] || 0, ready = (index === PROVE_STEP || index === PRODUCT_STEP) ? counts.ready || 0 : 0;
    const owner = ownerAt.has(index) || (index === PRODUCT_STEP && ownerAt.has(PROVE_STEP));
    const unit = 'product';
    const label = ready ? `${count} · ${ready} ready to build` : count ? plural(count, unit) : 'none';
    return {id, index, number: index + 1, name: STEP_NAMES[index], count, ready, owner, label, unit};
  });
}

/** The 5 visible stations (Product, Create, Build, Launch, Learn — Buyers & Prove it are completed upfront inside Product). */
export function visibleStations(pipeline) {
  return stepStations(pipeline)
    .filter(station => station.id !== 'buyers' && station.id !== 'prove')
    .map((station, idx) => ({...station, number: idx + 1}));
}

/**
 * The rows a step page shows. Product, Buyers and Prove it: the products whose line
 * is at that step (Product and Prove it also return the ones ready to build). Create,
 * Build, Launch and Learn: the building product when it is at that step, plus
 * the building product itself so the page can say where it is.
 */
export function stepRows(pipeline, stepId) {
  const index = STEP_IDS.indexOf(stepId);
  const active = pipeline?.active || [];
  const building = active.find(item => item.building) || null;
  const items = active.filter(item => item.stepIndex === index && !item.readyToBuild);
  const ready = (index === PROVE_STEP || index === PRODUCT_STEP) ? active.filter(item => item.readyToBuild) : [];
  return {index, items, ready, building, buildStep: index >= BUILD_FROM};
}

/** One product's step prompts with [product], [country] and [L###] filled in; other blanks stay. */
export function itemPrompts(item, line) {
  const guide = item ? line?.steps?.[item.stepIndex] : null;
  if (!guide) return [];
  const values = {product: item.name, country: item.country, lead: item.leadId};
  return guide.prompts.map(prompt => ({label: prompt.label, text: fillPrompt(prompt.text, values), original: prompt.text}));
}

const newest = (a, b) => String(b.at ?? b.updatedAt ?? '').localeCompare(String(a.at ?? a.updatedAt ?? ''));
const TASK_ORDER = {doing: 0, blocked: 1, todo: 2, done: 3};

/**
 * Everything saved about one product: the planner tasks and activity reports
 * whose `product` names it, the latest report events (newest first) and its
 * last update (product record, newest dated evidence, task or report).
 */
export function itemActivity(item, {tasks = [], activity = [], limit = 8} = {}) {
  if (!item) return {tasks: [], reports: [], events: [], last: ''};
  const mine = record => namesItem(item, record.product);
  const taskList = tasks.filter(mine).sort((a, b) => (TASK_ORDER[a.status] ?? 2) - (TASK_ORDER[b.status] ?? 2) || newest(a, b));
  const reports = activity.filter(mine).sort(newest);
  const events = reports.flatMap(report => (report.events || []).map(event => ({at: event.at, text: event.text, reportId: report.id, title: report.title, agent: report.agent || '', role: report.role})))
    .filter(event => event.at).sort(newest).slice(0, limit);
  return {tasks: taskList, reports, events, last: lastTouch(item, {tasks: taskList, activity: reports})};
}

/** The newest saved date touching a product: its record, its newest evidence, a task or a report naming it. */
export function lastTouch(item, {tasks = [], activity = []} = {}) {
  const dates = [item?.updatedAt, item?.evidenceOn, ...tasks.filter(task => namesItem(item, task.product)).map(task => task.updatedAt), ...activity.filter(report => namesItem(item, report.product)).map(report => report.updatedAt)];
  return dates.filter(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)).sort().at(-1) || '';
}

const MOVE_TITLES = {'eye-test': 'Eye test', 'build-pick': 'Pick what builds next', launch: 'Approve the test'};
/**
 * Step 0 · the issue list on the sidebar, Home and the Pipeline (owner, Oct 3):
 * how many issues, how many the owner is testing and how many Verified wait
 * for a pick. From the saved statuses only (pipeline.issues).
 */
export function issueStationOf(pipeline) {
  return issueStation(pipeline?.issues || []);
}

/**
 * The cards at Product grouped by their round's issue (owner, Oct 3: rounds
 * start from tested issues): {key, slug, title, status, items}. Issues the
 * owner is testing first, rounds without an issue last.
 */
export function issueGroups(pipeline, items = []) {
  const roundIssue = new Map((pipeline?.rounds || []).map(round => [round.number, round.issue || '']));
  const issues = new Map((pipeline?.issues || []).map(row => [row.slug, row]));
  const groups = new Map();
  for (const item of items) {
    const slug = item.round !== null && item.round !== undefined ? roundIssue.get(item.round) || '' : '';
    if (!groups.has(slug)) {
      const row = slug ? issues.get(slug) : null;
      groups.set(slug, {key: slug || 'none', slug, title: row?.title || slug, status: row?.status || (slug ? 'candidate' : ''), items: []});
    }
    groups.get(slug).items.push(item);
  }
  const order = {testing: 0, verified: 1, candidate: 2, parked: 3, '': 9};
  return [...groups.values()].sort((a, b) => (order[a.status] ?? 8) - (order[b.status] ?? 8) || a.slug.localeCompare(b.slug));
}

/**
 * What waits on the owner across products (the pipeline's owner moves, with
 * their rows): eye tests, the build pick and launch approval, in the
 * pipeline's order.
 */
export function needsYou(pipeline) {
  const items = pipeline?.items || [];
  return (pipeline?.ownerMoves || []).map(move => ({...move, title: MOVE_TITLES[move.kind] || move.kind, items: move.ids.map(id => items.find(item => item.id === id)).filter(Boolean)}));
}

/**
 * "Round 4 · Owner: eye test on 1 card (Find page): L096." for the Today chip
 * and banners. With the live work (liveWork) and an open round without cards,
 * it says who is searching: "Scout is searching for Round 5 cards · <latest>".
 */
export function focusLine(pipeline, live = null) {
  const round = pipeline?.round ? `Round ${pipeline.round.number}` : 'No round yet';
  let next = pipeline?.focus?.next || '';
  const who = pipeline?.focus?.who || '';
  let searching = null;
  if (pipeline?.focus?.kind === 'round-open') {
    searching = (live?.steps?.[PRODUCT_STEP] || []).find(entry => entry.agent === 'scout') || null;
    next = searching ? `Scout is searching for ${round} cards · ${clip(searching.latest, 110)}` : `${round} is open: no cards yet.`;
  }
  return {round, next, who, owner: who === 'owner', searching, text: `${round} · ${next || 'nothing on the line'}`};
}

/** A running report quiet for 24 hours is stale, not live work (workflowView reportFreshness). */
const LIVE_FOR = 24 * 60 * 60 * 1000;
const isLive = (report, now) => report?.status === 'running' && Number.isFinite(Date.parse(report.updatedAt)) && now - Date.parse(report.updatedAt) <= LIVE_FOR;

/**
 * Who is working on the line right now, from saved activity reports only:
 * every live running report (status running, updated in the last 24 hours)
 * placed on a step by the product it names (L### or P###), else by its
 * agent's step (buyer researcher Buyers; scout Product; checker
 * Prove it; copywriter and image maker Create; store builder Build or Launch;
 * the first of its steps where a product waits). Reports of Claude or the OS builder with no product are
 * not on any step. `items` maps a row id to its reports.
 */
export function liveWork(pipeline, activity = [], now = Date.now()) {
  const at = typeof now === 'number' ? now : Date.parse(now);
  const steps = STEP_IDS.map(() => []), items = {};
  const active = pipeline?.active || [];
  const waitingAt = index => active.some(item => item.stepIndex === index && !item.readyToBuild);
  const reports = activity.filter(report => isLive(report, at)).sort(newest);
  for (const report of reports) {
    const events = (report.events || []).filter(event => event?.at).sort(newest);
    const entry = {reportId: report.id, agent: report.agent || '', name: whoName(report.agent) || report.agent || 'Agent', title: report.title || '', latest: events[0]?.text || report.summary || report.title || '', at: events[0]?.at || report.updatedAt, product: report.product || ''};
    const item = report.product ? findItem(pipeline, report.product) : null;
    let index = item && !item.outcome ? item.stepIndex : -1;
    if (index < 0) {
      const own = (AGENT_STEPS[report.agent] || []).map(id => STEP_IDS.indexOf(id)).filter(i => i >= 0);
      index = own.find(waitingAt) ?? own[0] ?? -1;
    }
    if (item) (items[item.id] ||= []).push({...entry, stepIndex: index});
    if (index >= 0) steps[index].push({...entry, stepIndex: index});
  }
  return {steps, items, count: reports.length, onLine: steps.reduce((sum, list) => sum + list.length, 0)};
}

/** Who moves next, for a chip: the owner, Claude (manager) or a team agent. */
export const whoLabel = who => who === 'owner' ? 'You' : whoName(who);

/** A next move without its leading "Owner: " or "Checker: " (the who chip shows it), first letter capitalised. */
export function moveText(next) {
  const text = String(next || '').replace(/^(?:Owner|Claude|Scout|Checker|Buyer researcher|Copywriter|Image maker|Store builder|OS builder|Manager):\s+/, '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/**
 * One step's product checks for a step page, from processState's per-stage
 * steps (server/domain.mjs stages): Prove it joins discovery, validation and
 * sourcing; Product and Buyers have none (their gates are the card's six
 * checks and its buyers check). `firstOpen` is the stage an assignment starts from.
 */
const STEP_OWNERS = ['validation', 'validation', 'validation', 'image-generator', 'shopify-builder', 'manager', 'manager'];
export function lineStepChecks(flow, index) {
  const ids = STEP_STAGES[index] || [];
  const parts = (flow?.steps || []).filter(step => ids.includes(step.id));
  const items = parts.flatMap(step => step.items);
  return {items, done: parts.reduce((sum, step) => sum + step.done, 0), total: items.length, owner: STEP_OWNERS[index] || parts[0]?.owner || 'manager',
    stages: parts, firstOpen: parts.find(step => step.done < step.total) || parts[0] || null};
}
