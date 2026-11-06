// The OS health check (owner goal, Oct 1: an OS any agent can pick up and
// "basically cannot fail"). One read-only pass over the saved records that says
// in plain words what needs a look, with the fix in one line. It never fixes or
// writes anything: agents act on it with the usual helper commands.
//
//   gatherFacts()   reads the records (read-only), each source on its own so one
//                   broken file becomes one finding instead of a crash;
//   doctorReport()  pure rules over those facts (tested in doctor.test.mjs);
//   createDoctor()  what GET /api/doctor runs: it remembers the code the server
//                   started with, so "the server needs a restart" is caught.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {OS_DIR, codeStamp, srcStamp, readBuildStamp, changedFiles} from './buildStamp.mjs';
import {readTeam} from './team.mjs';
import {capFor, isActive} from './lessons.mjs';
import {LINE_PATH, STEP_IDS, STEP_BLOCK_WORDS, PIPELINE_BLOCK_WORDS, validateLine, stepMarkdown, pipelineMarkdown} from '../src/theLine.mjs';
import {AGENT_STEPS} from '../src/pipeline.mjs';
import {reportFreshness} from '../src/workflowView.mjs';
import {FOCUS_LIMIT, openFocus} from '../src/plannerRules.mjs';
import {urlProblem} from '../src/toolsModel.mjs';
import {VERIFIED_QUIET_DAYS, STATUS_LABELS, openChecks, openChecksText} from '../src/issueList.mjs';

/** Thresholds, in plain numbers. */
export const DOCTOR_LIMITS = {nowWords: 300, proposalDays: 2, ownerWaitDays: 3, readingDays: 7, signInDays: 14, buildStep: 4, listed: 4, quietDays: 7};
const DAY_MS = 86400000;
const TZ = 'America/Chicago';
export const chicagoDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(at));
const clockOf = at => new Intl.DateTimeFormat('en-GB', {timeZone: TZ, hour: '2-digit', minute: '2-digit'}).format(new Date(at));
/** "14:05" today, "Sep 30 14:05" on another day. */
export function whenText(at, today) {
  const d = new Date(at);
  if (!Number.isFinite(d.getTime())) return 'an unknown time';
  const day = chicagoDay(d);
  return day === today ? clockOf(d) : `${new Intl.DateTimeFormat('en-US', {timeZone: TZ, month: 'short', day: 'numeric'}).format(d)} ${clockOf(d)}`;
}
const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const one = value => String(value || '').replace(/\s+/g, ' ').trim();
const clip = (value, max = 60) => { const s = one(value); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
/** At most four names, then "and N more". */
function listOf(items, max = DOCTOR_LIMITS.listed) {
  const shown = items.slice(0, max).join('; ');
  return items.length > max ? `${shown}; and ${items.length - max} more` : shown;
}
const daysBetween = (from, to) => (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS;

export const FIXES = {
  restart: 'Restart the OS server: first check GET /api/runtime for a running Codex job, then stop the node process on port 3000 and run node os/server/start.mjs from the workspace root.',
  build: 'Run npm run build in os/. The server serves os/dist, so screen-only changes need no restart.',
  rebuildPages: 'Make any save through the OS (for example os.mjs set <task> --log "..."); that rebuilds the page. If it stays old, the server runs old code.',
};

/* ---------- Rules (pure) ---------- */

function serverCheck(f) {
  const out = [];
  const s = f.server || {mode: 'offline'};
  if (s.mode === 'down') out.push({status: 'look', text: 'The OS is not running on localhost:3000, so these results come from the files only.', fix: 'Start it: see the merrivy-os skill, "If the OS is down".'});
  else if (s.mode === 'old') out.push({status: 'look', text: 'The OS server on localhost:3000 runs code from before this health check (it has no /api/doctor), so it needs a restart.', fix: FIXES.restart});
  else if (s.mode === 'live' && s.loaded && s.disk) {
    const changed = changedFiles(s.loaded, s.disk);
    out.push(changed.length
      ? {status: 'look', text: `The OS server runs older code than the files on disk: ${plural(changed.length, 'file')} changed since it started at ${whenText(s.startedAt, f.today)} (${listOf(changed)}).`, fix: FIXES.restart}
      : {status: 'ok', text: `The OS server runs the current code (started ${whenText(s.startedAt, f.today)}).`});
  }
  const b = f.build || {};
  if (b.src) {
    if (!b.stamp) out.push({status: 'look', text: 'The app build has no build stamp, so nobody can tell whether the screens are current.', fix: `${FIXES.build} It saves dist/build-stamp.json.`});
    else if (b.stamp.srcHash !== b.src.hash) {
      const changed = changedFiles({files: b.stamp.files}, b.src);
      out.push({status: 'look', text: `The screens changed after the last build (built ${whenText(b.stamp.builtAt, f.today)}): ${plural(changed.length, 'file')} differ (${listOf(changed)}).`, fix: FIXES.build});
    } else out.push({status: 'ok', text: `The app build matches the screens (built ${whenText(b.stamp.builtAt, f.today)}).`});
  }
  return {id: 'server', label: 'OS server and app build', findings: out};
}

function lineCheck(f) {
  const out = [];
  if (f.lineError) out.push({status: 'look', text: `The step guide has a problem: ${f.lineError}`, fix: `Repair ${LINE_PATH} (the manager owns it); the app only reads it.`});
  else if (f.line) {
    const base = f.step || {status: '', next: '', basis: 'saved product cards'};
    for (let i = 0; i < f.line.steps.length; i++) {
      const guide = f.line.steps[i];
      const block = stepMarkdown({...base, index: i, number: i + 1, id: STEP_IDS[i], name: guide.name, guide}, {at: f.now});
      const count = words(block);
      if (count > STEP_BLOCK_WORDS) out.push({status: 'look', text: `Step ${i + 1} · ${guide.name}: its brief block is ${count} words (limit ${STEP_BLOCK_WORDS}).`, fix: `Shorten that step's wording in ${LINE_PATH}.`});
    }
  }
  // The pipeline block every brief opens with (the manager's and each team agent's).
  if (f.step?.pipeline) {
    const readers = ['manager', ...Object.keys(AGENT_STEPS)];
    const over = readers.map(agent => [agent, words(pipelineMarkdown(f.step.pipeline, {at: f.now, agent, line: f.line}))]).filter(([, count]) => count > PIPELINE_BLOCK_WORDS);
    if (over.length) out.push({status: 'look', text: `The pipeline block is over ${PIPELINE_BLOCK_WORDS} words in ${listOf(over.map(([agent, count]) => `${agent}'s brief (${count})`))}.`, fix: 'Report it to the OS builder: pipelineMarkdown (os/src/theLine.mjs) clips rows; the round focus or owner move text may be too long.'});
  }
  if (f.stepError) out.push({status: 'look', text: `The pipeline could not be worked out: ${f.stepError}`, fix: 'Run os.mjs pipeline to see the error; usually a product record, research/comparison.json or os/data/rounds.json needs repair.'});
  else if (f.step) out.push({status: out.length ? 'note' : 'ok', text: `The pipeline's focus is Step ${f.step.number} · ${f.step.name}: ${f.step.status}.${f.line && !out.length ? ` All seven step blocks are within ${STEP_BLOCK_WORDS} words and the pipeline block within ${PIPELINE_BLOCK_WORDS}.` : ''}`});
  // The starting rules the money line, test sheet and Learn step read (os/data/rules.json).
  if (f.errors?.rules) out.push({status: 'look', text: `The starting rules could not be read: ${f.errors.rules}`, fix: 'Restore os/data/rules.json (the kill line, the loss limit and the other starting rules); change values only through Settings or POST /api/rules.'});
  return {id: 'line', label: 'Step guide and current step', findings: out};
}

const dayMs = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? Date.parse(`${value}T12:00:00Z`) : Date.parse(value);
/** The last recorded activity on one product: its record, its card's evidence, its round's start, and tasks or reports naming it. */
export function lastActivity(item, f) {
  const named = record => record.product && (record.product === item.leadId || record.product === item.productId || record.product === item.id);
  const round = (f.step?.pipeline?.rounds || []).find(r => r.number === item.round);
  const times = [item.updatedAt, item.evidenceOn, round?.startedOn,
    ...(f.planner?.tasks || []).filter(named).map(task => task.updatedAt), ...(f.activity || []).filter(named).map(report => report.updatedAt)].map(dayMs).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

/** The pipeline: rounds to review, the build slot, products that went quiet, one product per card. */
function pipelineCheck(f) {
  const out = [];
  const p = f.step?.pipeline;
  if (!p) return {id: 'pipeline', label: 'Pipeline and rounds', findings: [{status: 'note', text: 'The pipeline was not worked out here (see the step check).'}]};
  const quiet = DOCTOR_LIMITS.quietDays * DAY_MS;
  for (const round of p.rounds.filter(item => item.needsReview)) out.push({status: 'look', text: `${round.id} (Round ${round.number}) has no cards left at Product, Buyers or Prove it, so it is ready for its review.`, fix: `os.mjs round review ${round.id} --worked "..." --failed "..." --next "..." (products past Prove it carry on by themselves).`});
  const ready = p.active.filter(item => item.readyToBuild);
  if (ready.length && !p.building) out.push({status: 'look', text: `${plural(ready.length, 'product')} ${ready.length === 1 ? 'is' : 'are'} ready to build and the build slot is empty: ${listOf(ready.map(item => `${item.id} ${clip(item.name, 40)}`))}.`, fix: 'Owner: open the product and press "Build this one" with a reason. Agents never pick.'});
  const stale = p.active.filter(item => !item.readyToBuild && !item.building && (item.stepIndex === 1 || item.stepIndex === 2 || (item.stepIndex === 0 && item.who !== 'owner'))).map(item => [item, lastActivity(item, f)]).filter(([, at]) => at !== null && f.now - at > quiet);
  if (stale.length) out.push({status: 'look', text: `${plural(stale.length, 'product')} at Product, Buyers or Prove it ${stale.length === 1 ? 'has' : 'have'} no recorded activity for ${DOCTOR_LIMITS.quietDays} days: ${listOf(stale.map(([item, at]) => `${item.id} (${item.stepName}, last ${whenText(new Date(at), f.today)})`))}.`, fix: 'Move each on (its agent records the next check, with --product on the task or report) or park it with the reason.'});
  for (const duplicate of p.duplicates) out.push({status: 'look', text: `${duplicate.leadId} is linked to ${duplicate.count} products; there is one product per card.`, fix: 'Keep one: review the other product\'s cycle, or clear its market researchCandidateId.'});
  if (p.building) {
    const at = lastActivity(p.building, f);
    if (at !== null && f.now - at > quiet) out.push({status: 'look', text: `${p.building.productId} has been building with no update for ${DOCTOR_LIMITS.quietDays} days (last ${whenText(new Date(at), f.today)}).`, fix: 'Record its next check or post progress (os.mjs report <id> --product P###); if it has stopped, review its cycle to free the build slot.'});
  }
  const unlinked = p.active.filter(item => item.unlinked);
  if (unlinked.length) out.push({status: 'look', text: `${plural(unlinked.length, 'product')} ${unlinked.length === 1 ? 'was' : 'were'} not started from a card, so ${unlinked.length === 1 ? 'its' : 'their'} checks cannot count: ${listOf(unlinked.map(item => `${item.productId} ${clip(item.name, 40)}`))}.`, fix: 'Link each to its owner-saved card (market researchCandidateId), or review its cycle. New products start with os.mjs product start L###.'});
  if (!out.length) out.push({status: 'ok', text: `${p.round ? `Round ${p.round.number}${p.round.open ? '' : ' (reviewed)'}` : 'No round yet'} · ${plural(p.counts.active, 'product')} on the line · build slot ${p.building ? p.building.productId : 'empty'} · nothing stuck.`});
  return {id: 'pipeline', label: 'Pipeline and rounds', findings: out};
}

/**
 * The issue list (step 0, owner Oct 3: the hard part, done first). Looks at:
 * a Testing issue with no open round (the scout has nothing to search for it),
 * a Verified issue nobody picked or parked for VERIFIED_QUIET_DAYS, and a
 * broken picks file. Notes (not counted): Candidates still being
 * cross-referenced, a picked issue whose gate reopened, the "a couple at a
 * time" hint and odd folders.
 */
function issuesCheck(f) {
  const out = [];
  const label = 'Issues (step 0)';
  const data = f.issues;
  if (!data) return {id: 'issues', label, findings: [{status: 'note', text: 'The issue files were not read here.'}]};
  const issues = data.issues || [];
  if (data.picks?.error) out.push({status: 'look', text: `The owner's issue picks need repair: ${clip(data.picks.error, 140)}`, fix: 'Restore os/data/issue-picks.json (revision and picks); until then every issue reads Candidate or Verified from its file.'});
  for (const issue of issues.filter(item => item.status === 'testing' && !item.openRound)) {
    out.push({status: 'look', text: `${issue.slug} is Testing, but no open round works from it, so nobody is searching for its products.`, fix: `Start one: os.mjs round start --issue ${issue.slug} --focus "..." --folder research/<date>-${issue.slug}/ (or the owner presses Not now on the Issues page).`});
  }
  for (const issue of issues.filter(item => item.status === 'verified' && item.modifiedAt && f.now - new Date(item.modifiedAt) > VERIFIED_QUIET_DAYS * DAY_MS)) {
    out.push({status: 'look', text: `${issue.slug} has been Verified with no pick for ${VERIFIED_QUIET_DAYS}+ days (last change ${whenText(issue.modifiedAt, f.today)}).`, fix: 'Owner: Test this issue or Not now on the Issues page (#/issues).'});
  }
  for (const issue of issues.filter(item => item.reopened)) {
    out.push({status: 'note', text: `${issue.slug} is ${STATUS_LABELS[issue.status]}, but its gate reopened (${openChecksText(issue)} open).`, fix: `Re-check the open lines in ${issue.path || issue.slug}; the owner's pick stays.`});
  }
  const candidates = issues.filter(item => item.status === 'candidate');
  if (candidates.length) out.push({status: 'note', text: `${plural(candidates.length, 'Candidate')} still being cross-referenced: ${listOf(candidates.map(item => `${item.slug} (open ${openChecks(item).map(check => check.id).join(', ')})`))}.`, fix: 'The buyer researcher cross-references them (its brief lists the open I-checks); a line is ticked only with the evidence in the file.'});
  if (data.hint) out.push({status: 'note', text: data.hint, fix: 'Owner: Not now on the ones to leave for later (a hint, never a block).'});
  for (const problem of data.problems || []) out.push({status: 'note', text: problem.text, fix: 'Each issue folder holds an ISSUE.md filled from templates/ISSUE.md, or a Gemini report to start one.'});
  const counts = data.counts || {};
  if (!out.length) out.push({status: 'ok', text: issues.length ? `${plural(issues.length, 'issue')}: ${counts.testing || 0} testing, ${counts.verified || 0} verified, ${counts.candidate || 0} candidates, ${counts.parked || 0} parked.` : 'No issues yet: the buyer researcher starts one from a Gemini report and templates/ISSUE.md.'});
  return {id: 'issues', label, findings: out};
}

/** The revisions START-HERE.md says it was built from. */
export function startHereRevisions(text) {
  const m = String(text || '').match(/workspace revision (\d+); planner revision (\d+); lessons revision (\d+)(?:; tools revision (\d+))?(?:; rounds revision (\d+))?/);
  return m ? {workspace: Number(m[1]), planner: Number(m[2]), lessons: Number(m[3]), tools: m[4] === undefined ? null : Number(m[4]), rounds: m[5] === undefined ? null : Number(m[5])} : null;
}

function memoryCheck(f) {
  const out = [];
  const saved = {workspace: f.workspace?.revision, planner: f.planner?.revision, lessons: f.lessons?.revision, tools: f.tools?.revision, rounds: f.rounds?.revision};
  if (f.startHere === null || f.startHere === undefined) out.push({status: 'look', text: 'memory/START-HERE.md is missing, so the manager has no start page.', fix: FIXES.rebuildPages});
  else {
    const page = startHereRevisions(f.startHere);
    if (!page) out.push({status: 'look', text: 'memory/START-HERE.md has no revision line, so its age is unknown.', fix: FIXES.rebuildPages});
    else {
      const behind = ['workspace', 'planner', 'lessons', 'tools', 'rounds'].filter(key => Number.isInteger(saved[key]) && Number.isInteger(page[key]) && saved[key] > page[key]).map(key => `${key} revision ${page[key]} on the page, ${saved[key]} saved`);
      if (behind.length) out.push({status: 'look', text: `memory/START-HERE.md is older than the saved records (${behind.join('; ')}).`, fix: FIXES.rebuildPages});
      else if (page.tools === null && Number.isInteger(saved.tools) && saved.tools > 0) out.push({status: 'look', text: 'memory/START-HERE.md was built by older code: it does not list the tools for the step yet.', fix: FIXES.rebuildPages});
      else if (page.rounds === null && Number.isInteger(saved.rounds)) out.push({status: 'look', text: 'memory/START-HERE.md was built by older code: it does not open with the pipeline yet.', fix: FIXES.rebuildPages});
    }
  }
  if (f.nowPage === null || f.nowPage === undefined) out.push({status: 'look', text: 'memory/NOW.md is missing.', fix: FIXES.rebuildPages});
  else {
    const rev = Number(String(f.nowPage).match(/Generated from workspace revision (\d+)/)?.[1]);
    if (!Number.isInteger(rev)) out.push({status: 'look', text: 'memory/NOW.md has no revision line, so its age is unknown.', fix: FIXES.rebuildPages});
    else if (Number.isInteger(saved.workspace) && saved.workspace > rev) out.push({status: 'look', text: `memory/NOW.md is older than the saved Now (revision ${rev} on the page, ${saved.workspace} saved).`, fix: FIXES.rebuildPages});
  }
  const h = f.workspace?.handoff;
  const nowWords = h ? words(`${h.summary || ''} ${h.nextAction || ''} ${h.blockers || ''}`) : 0;
  if (h && nowWords > DOCTOR_LIMITS.nowWords) out.push({status: 'look', text: `Now is ${nowWords} words; keep it to about 250 (at most ${DOCTOR_LIMITS.nowWords}).`, fix: 'Rewrite it shorter with os.mjs handoff --summary "..." --next "..." (it replaces the page).'});
  if (!out.length) out.push({status: 'ok', text: `START-HERE and Now match the saved records; Now is ${nowWords} words.`});
  return {id: 'memory', label: 'Start page and Now', findings: out};
}

function lessonsCheck(f) {
  const out = [];
  const list = f.lessons?.lessons || [];
  const scopes = [...new Set(list.map(lesson => lesson.scope))];
  const full = [];
  for (const scope of scopes) {
    const active = list.filter(lesson => lesson.scope === scope && isActive(lesson)).length, cap = capFor(scope);
    if (active > cap) out.push({status: 'look', text: `The ${scope} lesson list has ${active} active lessons (limit ${cap}).`, fix: 'Merge or retire one: os.mjs lesson set LS-### --status retired --note "why".'});
    else if (active === cap) full.push(`${scope} ${active}/${cap}`);
  }
  const waiting = list.filter(lesson => lesson.status === 'proposed' && f.now - Date.parse(lesson.createdAt) > DOCTOR_LIMITS.proposalDays * DAY_MS);
  if (waiting.length) out.push({status: 'look', text: `${plural(waiting.length, 'lesson proposal')} ${waiting.length === 1 ? 'has' : 'have'} waited more than ${DOCTOR_LIMITS.proposalDays} days: ${listOf(waiting.map(lesson => `${lesson.id} (${lesson.scope})`))}.`, fix: 'Manager: accept with os.mjs lesson set LS-### --status trying, or decline with --status retired --note "why".'});
  if (!out.length) out.push({status: 'ok', text: `Every lesson list is within its limit; no proposal has waited more than ${DOCTOR_LIMITS.proposalDays} days.`});
  if (full.length) out.push({status: 'note', text: `Full lists (merge or retire before adding): ${full.join(', ')}.`});
  return {id: 'lessons', label: 'Lessons', findings: out};
}

function reportsCheck(f) {
  const out = [];
  const list = f.activity || [];
  const stale = status => list.filter(report => report.status === status && reportFreshness(report, f.now) === 'stale');
  const name = report => `${report.id} (${report.agent || report.role}, last update ${whenText(report.updatedAt, f.today)})`;
  const running = stale('running'), blocked = stale('blocked');
  if (running.length) out.push({status: 'look', text: `${plural(running.length, 'running report')} ${running.length === 1 ? 'has' : 'have'} had no update for 24 hours: ${listOf(running.map(name))}.`, fix: 'Finish each with os.mjs report <id> --status completed (or blocked), or post an update with --event.'});
  if (blocked.length) out.push({status: 'look', text: `${plural(blocked.length, 'blocked report')} ${blocked.length === 1 ? 'is' : 'are'} older than 7 days: ${listOf(blocked.map(name))}.`, fix: 'Re-check each blocker, then close the report or post a fresh update.'});
  if (!out.length) {
    const live = list.filter(report => report.status === 'running' && reportFreshness(report, f.now) === 'live').length;
    out.push({status: 'ok', text: `${plural(live, 'running report')}, all updated within 24 hours; no blocked report older than 7 days.`});
  }
  return {id: 'reports', label: 'Agent reports', findings: out};
}

function tasksCheck(f) {
  const out = [];
  const open = (f.planner?.tasks || []).filter(task => task.status !== 'done');
  const overdue = open.filter(task => task.date && task.date < f.today);
  if (overdue.length) out.push({status: 'look', text: `${plural(overdue.length, 'open to-do')} ${overdue.length === 1 ? 'is' : 'are'} dated before today: ${listOf(overdue.map(task => `${clip(task.title)} (${task.date})`))}.`, fix: 'On Today, move them under From earlier (Today, Tomorrow or Someday), or finish them.'});
  const waiting = open.filter(task => task.assignee === 'owner' && f.now - Date.parse(task.createdAt) > DOCTOR_LIMITS.ownerWaitDays * DAY_MS);
  if (waiting.length) out.push({status: 'look', text: `${plural(waiting.length, 'owner to-do')} ${waiting.length === 1 ? 'has' : 'have'} waited more than ${DOCTOR_LIMITS.ownerWaitDays} days: ${listOf(waiting.map(task => clip(task.title)))}.`, fix: 'Ask the owner in chat, or move it to Someday if it can wait (os.mjs set <id> --date someday).'});
  for (const date of [...new Set(open.filter(task => task.focus && task.date).map(task => task.date))].sort()) {
    const focus = openFocus(open, date);
    if (focus.length > FOCUS_LIMIT) out.push({status: 'look', text: `${date} has ${focus.length} open focus tasks (limit ${FOCUS_LIMIT}).`, fix: 'Unflag the extra ones: os.mjs set <id> --no-focus.'});
  }
  if (!out.length) out.push({status: 'ok', text: `${plural(open.length, 'open to-do')}; none overdue, no owner to-do waiting more than ${DOCTOR_LIMITS.ownerWaitDays} days, focus within ${FOCUS_LIMIT} a day.`});
  return {id: 'tasks', label: 'To-dos', findings: out};
}

function libraryCheck(f) {
  const out = [];
  const entries = f.library?.entries || [];
  const missing = f.libraryMissing || [];
  if (missing.length) out.push({status: 'look', text: `${plural(missing.length, 'library entry', 'library entries')} ${missing.length === 1 ? 'points' : 'point'} at a file that is missing: ${listOf(missing.map(entry => `${entry.id} (${entry.path})`))}.`, fix: 'Point it at the right file with os.mjs library set K-### --path ..., or mark it outdated with --trust outdated.'});
  const old = entries.filter(entry => entry.status === 'to-learn' && entry.requestedOn && daysBetween(entry.requestedOn, f.today) > DOCTOR_LIMITS.readingDays);
  if (old.length) out.push({status: 'look', text: `${plural(old.length, 'reading-list item')} ${old.length === 1 ? 'is' : 'are'} older than ${DOCTOR_LIMITS.readingDays} days: ${listOf(old.map(entry => `${entry.id} ${clip(entry.title, 40)}`))}.`, fix: 'Research it and write the answer with os.mjs library done K-###, or mark it outdated.'});
  if (!out.length) out.push({status: 'ok', text: `${plural(entries.filter(entry => entry.status === 'learned').length, 'entry', 'entries')}, every file is there; the reading list is under ${DOCTOR_LIMITS.readingDays} days old.`});
  return {id: 'library', label: 'Library', findings: out};
}

function toolsCheck(f) {
  const out = [];
  const tools = (f.tools?.tools || []).filter(tool => !tool.retired);
  const noLink = tools.filter(tool => urlProblem(tool.url));
  if (noLink.length) out.push({status: 'look', text: `${plural(noLink.length, 'tool')} ${noLink.length === 1 ? 'has' : 'have'} no working link: ${listOf(noLink.map(tool => tool.name || tool.id))}.`, fix: 'Add the link with os.mjs tool <id> --url https://...'});
  const old = tools.filter(tool => tool.signedInNoted && daysBetween(tool.signedInNoted, f.today) > DOCTOR_LIMITS.signInDays);
  if (old.length) out.push({status: 'look', text: `${plural(old.length, 'tool')} ${old.length === 1 ? 'has' : 'have'} a "Signed in?" note older than ${DOCTOR_LIMITS.signInDays} days: ${listOf(old.map(tool => `${tool.name} (${tool.signedInNoted})`))}.`, fix: 'Owner: open each tool, sign in again if asked, then tick Signed in? on the Tools page. Never type a password for the owner.'});
  if (!out.length) out.push({status: 'ok', text: `${plural(tools.length, 'tool')}, each with a link; no "Signed in?" note older than ${DOCTOR_LIMITS.signInDays} days.`});
  return {id: 'tools', label: 'Tools', findings: out};
}

function assetsCheck(f) {
  const out = [];
  const map = f.assets;
  if (!map) return {id: 'assets', label: 'Store pictures', findings: [{status: 'note', text: 'Store pictures were not checked here (no store map).'}]};
  const demo = map.siteDemo || [];
  if (demo.length) out.push({status: 'look', text: `${plural(demo.length, 'site picture')} on Merrivy's own pages still ${demo.length === 1 ? 'shows' : 'show'} a demo hoodie picture while the store's packet is a real product: ${listOf(demo.map(item => `${item.label} (${item.src})`))}.`, fix: 'Ask the store builder to give site.json its own pictures: os.mjs add "Replace demo pictures on Merrivy\'s own pages" --agent store-builder --step build.'});
  for (const problem of (map.problems || []).filter(text => !/still shows a demo hoodie picture/.test(text))) out.push({status: 'look', text: problem, fix: 'Ask the store builder to repair the packet or templates.ts; the Assets page shows the same note.'});
  const slots = (map.sections || []).flatMap(section => section.slots.filter(slot => !slot.derived && !slot.optional).map(slot => ({section, slot})));
  const missing = slots.filter(({slot}) => slot.status === 'missing');
  if (missing.length) out.push({status: 'look', text: `${plural(missing.length, 'place')} on the store page ${missing.length === 1 ? 'points' : 'point'} at a file that is missing: ${listOf(missing.map(({section, slot}) => `${section.label}${section.slots.length > 1 ? ` · ${slot.label}` : ''} (${slot.file || slot.src})`))}.`, fix: 'Ask the store builder from the Assets page, or list them with os.mjs assets --needs.'});
  const empty = map.counts?.empty || 0, atBuild = (f.step?.index ?? 0) >= DOCTOR_LIMITS.buildStep;
  if (empty) out.push(atBuild
    ? {status: 'look', text: `${plural(empty, 'place')} on the store page still ${empty === 1 ? 'needs' : 'need'} a picture.`, fix: 'The store builder fills them from the build packet; os.mjs assets --needs lists them.'}
    : {status: 'note', text: `${plural(empty, 'place')} on the store page ${empty === 1 ? 'is' : 'are'} empty; that is normal before Step 5 · Build.`});
  if (!out.some(item => item.status === 'look')) out.unshift({status: 'ok', text: `${map.counts?.filled ?? 0} of ${map.counts?.slots ?? 0} places on the store page are filled; no missing files.`});
  return {id: 'assets', label: 'Store pictures', findings: out};
}

function teamCheck(f) {
  const out = [];
  const team = f.team || {};
  if (team.error) out.push({status: 'look', text: team.error, fix: 'Repair agents/team.json (the manager owns it).'});
  else if (team.missing) out.push({status: 'look', text: 'agents/team.json is missing, so there is no team roster.', fix: 'Restore agents/team.json.'});
  else {
    const roster = (team.agents || []).map(agent => agent.id);
    const noFile = (team.agents || []).filter(agent => !agent.installed).map(agent => agent.id);
    const notListed = (f.agentFiles || []).filter(id => !roster.includes(id));
    if (noFile.length) out.push({status: 'look', text: `On the roster but no .claude/agents file: ${noFile.join(', ')}.`, fix: 'Add .claude/agents/<id>.md (start from an existing agent file), or take it off agents/team.json.'});
    if (notListed.length) out.push({status: 'look', text: `Agent files not on the roster: ${notListed.join(', ')}.`, fix: 'Add them to agents/team.json, or remove the file if it is no longer used.'});
    if (!out.length) out.push({status: 'ok', text: `${plural(roster.length, 'agent')} on the roster, each with its .claude/agents file.`});
  }
  return {id: 'team', label: 'Team roster', findings: out};
}

/** A source that could not be read is one finding, never a crash. */
/**
 * Decisions said in chat (owner, Oct 3): every decision the manager recorded
 * from the owner's chat in the last 7 days (eye test, build pick, issue pick),
 * listed for audit with the owner's words. Information only; the owner can undo any.
 */
export function saidDecisions(f, days = 7) {
  const since = f.now - days * DAY_MS;
  const recent = at => Number.isFinite(Date.parse(at)) && Date.parse(at) >= since;
  const out = [];
  for (const card of f.research?.candidates || []) {
    const said = card.screen?.said;
    if (said?.source === 'owner-chat' && recent(said.at)) out.push({at: said.at, what: `${card.id} ${card.screen.ownerDecision}`, quote: said.quote});
  }
  const build = f.workspace?.build;
  if (build?.source === 'owner-chat' && recent(build.pickedAt)) out.push({at: build.pickedAt, what: `${String(build.productId).split('-')[0]} build${build.override ? ' (launched early)' : ''}`, quote: build.reason});
  for (const issue of f.issues?.issues || []) {
    const pick = issue.pick;
    if (pick?.source === 'owner-chat' && recent(pick.at)) out.push({at: pick.at, what: `${issue.slug} ${pick.pick}`, quote: pick.quote});
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function saidCheck(f) {
  const label = 'Decisions said in chat';
  const list = saidDecisions(f);
  if (!list.length) return {id: 'said', label, findings: [{status: 'ok', text: 'No owner decision was recorded from chat in the last 7 days.'}]};
  return {id: 'said', label, findings: [{status: 'note', text: `${plural(list.length, 'decision')} recorded from the owner's chat in the last 7 days: ${list.slice(0, 6).map(item => `${item.what} (${whenText(item.at, f.today)}) "${clip(item.quote, 70)}"`).join('; ')}${list.length > 6 ? ` and ${list.length - 6} more` : ''}.`, fix: 'For audit. Each shows as "Said in chat" with the quote; the owner can undo it on its page. Only the manager records these, with os.mjs owner-said and the owner\'s words.'}]};
}

const readProblem = (label, file, error) => ({status: 'look', text: `${file} could not be read: ${error}`, fix: `Repair or restore ${file}; ${label} checks are skipped until then.`});

/**
 * The report from gathered facts. `count` is the number of things to look at;
 * notes are information only and are not counted.
 */
export function doctorReport(f) {
  const checks = [serverCheck(f), lineCheck(f), pipelineCheck(f), issuesCheck(f), saidCheck(f), memoryCheck(f), lessonsCheck(f), reportsCheck(f), tasksCheck(f), libraryCheck(f), toolsCheck(f), assetsCheck(f), teamCheck(f)];
  const sources = {pipeline: [['rounds', 'os/data/rounds.json']], issues: [['issues', 'resources/issues/']], memory: [['workspace', 'os/data/workspace.json']], lessons: [['lessons', 'os/data/lessons.json']], reports: [['activity', 'os/data/activity.json']], tasks: [['planner', 'os/data/planner.json']], library: [['library', 'os/data/library.json']], tools: [['tools', 'os/data/tools.json']], assets: [['assets', 'the store map']], team: [['team', 'agents/team.json']]};
  for (const check of checks) {
    const broken = (sources[check.id] || []).filter(([key]) => f.errors?.[key]);
    if (broken.length) check.findings = [...broken.map(([key, file]) => readProblem(check.label.toLowerCase(), file, f.errors[key])), ...check.findings.filter(item => item.status !== 'ok')];
    check.status = check.findings.some(item => item.status === 'look') ? 'look' : check.findings.some(item => item.status === 'ok') ? 'ok' : 'note';
  }
  const count = checks.reduce((sum, check) => sum + check.findings.filter(item => item.status === 'look').length, 0);
  return {
    computedAt: new Date(f.now).toISOString(), mode: f.server?.mode || 'offline', count, ok: count === 0,
    summary: count ? `${plural(count, 'thing')} to look at` : 'All good',
    checks,
  };
}

/* ---------- Gathering (read-only) ---------- */

async function readText(root, relative) {
  try { return await fs.readFile(path.join(root, ...relative.split('/')), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function exists(root, relative) {
  try { return (await fs.stat(path.join(root, ...relative.split('/')))).isFile(); }
  catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false; throw error; }
}

/**
 * Read everything the rules need. `store` is createStore() (read methods only);
 * `storeMap` is the hub's read-only store map, when available.
 */
export async function gatherFacts({workspaceRoot, store, storeMap = null, server = {mode: 'offline'}, now = new Date(), osDir = OS_DIR}) {
  const root = path.resolve(workspaceRoot);
  const f = {now: new Date(now), today: chicagoDay(now), server, errors: {}};
  const take = async (key, read) => { try { return await read(); } catch (error) { f.errors[key] = error.message || String(error); return null; } };
  const [build, lineText, step, workspace, planner, lessons, tools, library, activity, startHere, nowPage, team, agentDir, assets, rounds, issues, rules, research] = await Promise.all([
    Promise.all([readBuildStamp(osDir), srcStamp(osDir)]).then(([stamp, src]) => ({stamp, src})).catch(() => ({})),
    readText(root, LINE_PATH).catch(error => ({error: error.message})),
    store.getStep().then(value => value.current).catch(error => { f.stepError = error.message; return null; }),
    take('workspace', () => store.getWorkspace()), take('planner', () => store.getPlanner()), take('lessons', () => store.getLessons()),
    take('tools', () => store.getTools()), take('library', () => store.getLibrary()), take('activity', async () => (await store.getActivity()).activity),
    readText(root, 'memory/START-HERE.md'), readText(root, 'memory/NOW.md'),
    take('team', () => readTeam(root)),
    fs.readdir(path.join(root, '.claude', 'agents')).catch(() => []),
    storeMap ? take('assets', () => storeMap('')) : Promise.resolve(null),
    store.getRounds ? take('rounds', () => store.getRounds()) : Promise.resolve(null),
    store.getIssues ? take('issues', () => store.getIssues()) : Promise.resolve(null),
    store.getRules ? take('rules', () => store.getRules()) : Promise.resolve(null),
    store.getResearch ? take('research', () => store.getResearch()) : Promise.resolve(null),
  ]);
  Object.assign(f, {build, step, workspace, planner, lessons, tools, library, activity, startHere, nowPage, team, assets, rounds, issues, rules, research});
  if (lineText === null) f.lineError = `${LINE_PATH} is missing.`;
  else if (typeof lineText === 'object') f.lineError = `${LINE_PATH} could not be read: ${lineText.error}`;
  else { try { f.line = validateLine(JSON.parse(lineText)); } catch (error) { f.lineError = error instanceof SyntaxError ? `${LINE_PATH} is not valid JSON.` : error.message; } }
  f.agentFiles = agentDir.filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)).sort();
  f.libraryMissing = [];
  for (const entry of (library?.entries || []).filter(item => item.status === 'learned' && item.path)) {
    if (!(await exists(root, entry.path).catch(() => false))) f.libraryMissing.push({id: entry.id, path: entry.path, title: entry.title});
  }
  return f;
}

/**
 * The doctor GET /api/doctor runs. It remembers the code the server started
 * with, so a later change on disk shows as "needs a restart".
 */
export function createDoctor({workspaceRoot, store, storeMap = null, osDir = OS_DIR}) {
  const startedAt = new Date().toISOString();
  const loaded = codeStamp(osDir).catch(() => null);
  return {
    startedAt,
    async run({now = new Date()} = {}) {
      const [start, disk] = await Promise.all([loaded, codeStamp(osDir).catch(() => null)]);
      return doctorReport(await gatherFacts({workspaceRoot, store, storeMap, now, osDir, server: {mode: 'live', startedAt, loaded: start, disk}}));
    },
  };
}
