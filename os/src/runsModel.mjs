// Run buttons (owner, Oct 3): which fixed jobs a product or issue can run now,
// and what a run's saved record says, in plain words. Pure; shared by the
// server's runner (server/claudeRunner.mjs) and the screens. A run never passes
// a check: "Finished" says whether its record changed, never "passed".
import {PRODUCT_STEP, BUYERS_STEP, PROVE_STEP} from './pipeline.mjs';

export const LIVE_RUN = ['starting', 'running'];
export const isLiveRun = run => LIVE_RUN.includes(run?.status);

/** Does this template's Run fit this product row or issue right now? '' when it does, else the plain reason. */
export function targetProblem(template, {item = null, issue = null} = {}) {
  if (template.slot === 'product') {
    if (!item) return 'No such product on the pipeline.';
    if (item.outcome) return `${item.id} is out of the line (${item.outcome.label}). Reopen it first.`;
    const buyers = item.line?.[BUYERS_STEP];
    const buyersDone = Boolean(buyers && buyers.total && buyers.done === buyers.total);
    const waitingSave = item.stepIndex === PRODUCT_STEP && item.who === 'owner';
    if (template.when === 'buyers' && !(item.stepIndex === BUYERS_STEP || waitingSave)) return `Buyers runs on a product at Buyers, or ahead on one waiting for your Save; ${item.id} is at ${item.stepName}.`;
    if (template.when === 'prove' && !((item.stepIndex === PROVE_STEP && !item.readyToBuild && !item.building) || (waitingSave && buyersDone))) return `Prove it runs on a product at Prove it, or ahead once Buyers passed; ${item.id} is at ${item.stepName}.`;
    if (template.when === 'product' && item.stepIndex !== PRODUCT_STEP) return `${item.id} is not at Product.`;
    return '';
  }
  if (template.slot === 'issue') {
    if (!issue) return 'No such issue folder.';
    if (issue.status === 'parked') return `${issue.slug} is parked.`;
    if (template.when === 'issue-pickable' && !['testing', 'verified'].includes(issue.status)) return `Finding products needs a Verified or Testing issue; ${issue.slug} is ${issue.status}.`;
    return '';
  }
  return '';
}

/**
 * The Run buttons for one product row, one issue, or the Agents tab (no target):
 * [{template, state, reason, run}] where state is ready, running (this target's
 * run is going), full (the run limit is reached), chat (needs a real browser:
 * the manager chat) or off (Claude Code is not available).
 */
export function runButtons({claude = null, runs = [], item = null, issue = null, slot = item ? 'product' : issue ? 'issue' : 'none'} = {}) {
  const templates = (claude?.templates || []).filter(template => template.slot === slot);
  const live = runs.filter(isLiveRun);
  const targetId = item?.id || issue?.slug || '';
  return templates.filter(template => slot === 'none' || !targetProblem(template, {item, issue})).map(template => {
    const mine = live.find(run => run.templateId === template.id && (run.target?.id || '') === targetId) || null;
    if (mine) return {template, state: 'running', reason: `${template.label} is running.`, run: mine};
    if (template.needsChat || template.browser === 'required') return {template, state: 'chat', reason: 'Needs a real browser, which headless runs can\'t open yet. Ask Claude in chat.', run: null};
    const sameStep = live.find(run => run.key === `${template.step}:${targetId || template.id}`) || null;
    if (sameStep) return {template, state: 'busy', reason: `${sameStep.label} is already running for ${targetId || 'this'}; one run per product and step.`, run: sameStep};
    if (claude && !claude.available) return {template, state: 'off', reason: claude.reason || 'Claude Code is not available on this computer.', run: null};
    if (live.length >= (claude?.limit || 2)) return {template, state: 'full', reason: `${live.length} runs are going. Wait for one to finish or stop one.`, run: null};
    return {template, state: 'ready', reason: template.summary, run: null};
  });
}

const minutes = (from, to) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
/** A run in plain words: "Running · 4 min", "Finished · saved, check it", "Finished · nothing saved", "Stopped", "Timed out", "Failed". */
export function runStatusText(run, now = new Date().toISOString()) {
  if (!run) return '';
  const took = run.finishedAt ? minutes(run.startedAt, run.finishedAt) : minutes(run.startedAt, now);
  if (isLiveRun(run)) return `Running · ${took} min`;
  const outcome = run.outcome === 'saved' ? 'saved: check it' : run.outcome === 'nothing-saved' ? 'nothing saved' : '';
  const word = {finished: 'Finished', stopped: 'Stopped', 'timed-out': 'Timed out', failed: 'Failed', interrupted: 'Interrupted'}[run.status] || run.status;
  return `${word}${outcome ? ` · ${outcome}` : ''}${took ? ` · ${took} min` : ''}`;
}
/** The tone of a run's chip: active while live, done when it saved, warn when it finished with nothing saved, bad otherwise. */
export function runTone(run) {
  if (isLiveRun(run)) return 'active';
  if (run?.status === 'finished') return run.outcome === 'nothing-saved' ? 'warn' : 'done';
  return 'bad';
}
/** The newest event worth showing (a message or a tool step), newest first. */
export const latestEvent = run => [...(run?.events || [])].reverse().find(event => ['message', 'tool', 'done', 'error', 'denied', 'progress'].includes(event.type)) || null;
/** The runs for one target (product id or issue slug), newest first. */
export const runsFor = (runs, id) => (runs || []).filter(run => run.target?.id && run.target.id === id).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
