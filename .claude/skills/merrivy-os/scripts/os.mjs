#!/usr/bin/env node
// Launchroom helper (formerly "Merrivy OS"; the folder keeps its old name): read status and keep the shared Today planner and memory
// up to date through the OS's own APIs (never by editing os/data directly).
//
//   node os.mjs status                   (first line: the pipeline · round, products per step, build slot, focus)
//   node os.mjs doctor                   (health check: stale pages, old server code, overdue or stuck work, broken links;
//                                         read-only, each finding with a one-line fix; run it after status)
//   node os.mjs step                     (the pipeline block, the focus step block + its 3 prompts for the focus product)
//   node os.mjs prompts [1-7|product|buyers|prove|create|build|launch|learn]   (copy-and-paste prompts + anytime prompts)
//   node os.mjs rules                    (the starting rules: kill line, loss limit, target cost per sale…, each with whose number it is)
//
// Pipeline (every product has its own seven-step line: Product, Buyers, Prove it, Create, Build, Launch, Learn; owner, Oct 2):
//   node os.mjs pipeline [--all]         (the round, products per step, the build slot, what waits on the owner,
//                                         one row per product; --all also lists the ones out of the line)
//   node os.mjs product <L###|P###>      (one product's line, status, next move, its seven gates and its step's prompts, filled in)
//   node os.mjs product start <L###> [--name ..] [--country ..] [--variant ..]
//                                        (start the product record P### from a card the owner saved; one per card)
//   node os.mjs rounds                   (every round: focus, folders, cards, review)
//   node os.mjs rounds import <file.json> ({rounds: [{number, startedOn, focus, folders, review?}]}; skips saved ones)
//   node os.mjs issues [--status candidate|verified|testing|parked] [<slug>]
//                                        (step 0, the issue list: each issue's status and I1-I7 dots; with a slug, its checks and search list.
//                                         The owner picks on the Issues page; there is no helper for "Test this issue" or "Not now")
//   node os.mjs round start --issue <slug> --focus "..." --folder research/<batch>/ [--folder ...] [--on YYYY-MM-DD]
//                                        (owner, Oct 3: a round tests an issue the owner is Testing; refused with
//                                         ISSUE_MISSING / ISSUE_GATE_OPEN (Candidate) / ISSUE_NOT_PICKED (Verified) / ISSUE_PARKED.
//                                         A focus alone (no --issue) still works)
//   node os.mjs round review R04 --worked "..." --failed "..." --next "..." [--on YYYY-MM-DD]
//                                        (review: refused while the round still has cards at Product, Buyers or Prove it)
//   node os.mjs round focus R05 [--focus "..."] [--issue <slug>]
//                                        (an open round: change its focus, or link the issue it works from;
//                                         the owner must be Testing it, as for round start)
//   "Build this one" (the build slot) is the owner's pick on the product's page; there is no helper for it.
//   --product L###|P### on add, set and report names the product a task or report moves along.
//   node os.mjs todo [--all]
//   node os.mjs add "Title" [--date today|tomorrow|someday|YYYY-MM-DD] [--who owner|agent|shared]
//                           [--next "..."] [--notes "..."] [--ref path-or-url]... [--focus] [--status todo|doing|blocked]
//                           [--agent <team-agent-id>]   (hands the task to a team agent; see `team`)
//                           [--step product|buyers|prove|create|build|launch|learn|1-7|none]   (optional step tag; old words like validate or issue still work)
//                           (--focus: at most 3 open focus tasks per day; a 4th is refused with FOCUS_FULL)
//   node os.mjs set <task-id> [same flags as add, plus --title "..." and --log "..."]
//   node os.mjs done <task-id> [--log "what was finished"]
//   node os.mjs delete <task-id>         (off every list; restore brings it back. Only what the owner said to drop, or your own mistake)
//   node os.mjs restore <task-id>
//   --agents scout,checker on add or set puts several agents on one task; --who shared keeps the owner on it too
//   (--notes replaces a task's notes; --log appends a dated line; --ref appends a reference)
//   node os.mjs note "text" [--kind note|decision|lesson|preference] [--topic "..."] [--important] [--task <id>] [--ref ...]...
//   node os.mjs handoff --summary "..." --next "..." [--blockers "..."]
//   node os.mjs team                     (the agent roster and skills from agents/team.json)
//   node os.mjs inbox                    (dated agent tasks waiting for the manager to dispatch; someday ones are only a Parked count)
//   node os.mjs report <report-id> --agent <id> --status running|completed|blocked|failed --title "..." [--summary "..."]
//                           [--role <dept>] [--event "..."] [--product L###|P###] [--ref path]... [--by claude|codex]
//                           (a new report: --role comes from the agent's department, --summary defaults to --title)
//
// Memory (Now, Lessons, Diary):
//   node os.mjs brief [--agent <id>]     (the one page to read before a job; default: manager)
//   node os.mjs lessons [--for <scope>] [--all]
//   node os.mjs lesson propose "rule" --why "..." --for <scope> [--from "what happened"] [--by <agent>] [--ref ...]   (lesson --help: examples; --reason, --scope, --agent and --flag=value are read too)
//   node os.mjs lesson add "rule" --why "..." --for <scope> [--status trying|proven] [--source owner|job|review|seed] [--from ...] [--on YYYY-MM-DD]
//   node os.mjs lesson set LS-012 [--status trying|proven|retired] [--note "why"] [--rule ...] [--why ...] [--for ...]
//   node os.mjs lesson used LS-012 --helped yes|no [--by <agent>]
//   node os.mjs diary "one line: what happened" [--agent <id>] [--task <id>] [--ref ...]
//   node os.mjs review                   (weekly lesson review numbers)
//
// Hubs (what to read before a job; the same doors as the Hub home):
//   node os.mjs hub                      (every door)
//   node os.mjs hub copy|creatives|winners|research|store|team   (its files and pages, then its best Library entries)
//
// Library (all our knowledge; catalog in resources/LIBRARY.md):
//   node os.mjs library search "query"   (ranked: id, trust, title, path, what we learned)
//   node os.mjs library list [--topic t] [--for <agent>] [--kind k] [--all]   (--all includes outdated)
//   node os.mjs library read K-012       (the entry, then the full file)
//   node os.mjs library add --title "..." --learned "..." --kind research|method|guide|example|template|note
//                           --topics a,b --trust tested|sourced|idea --path file.md [--source x]... [--for a,b] [--lesson LS-012]...
//   node os.mjs library note --body "..." | --body-file file [--title ...] [--learned ...] [--topics a,b] [--kind note] [--trust idea]
//                           (writes a new resources/notes/ file; title, summary and topics are derived when left out)
//   node os.mjs library learn "what to learn, or a link" [--for <agent>]   (reading list + a planner task)
//   node os.mjs library done K-012 --learned "..." --path file.md [--trust sourced|tested|idea] [--topics a,b] [--kind k] [--source x]...
//   node os.mjs library set K-012 [--trust ...] [--title ...] [--learned ...] [--topics ...] [--for ...] [--lesson ...]...
//   Topics: product-research, buyer-angles, copywriting, images-ads, store, sourcing, testing, operations, tools.
//
// Tools (every outside tool, one link the owner and Claude both open; catalog in resources/TOOLS.md):
//   node os.mjs tools [--step product|buyers|prove|create|build|launch|learn|1-7] [--group research|sourcing|store|ads|creative|email|local] [--all]
//                           (no flags: the tools for the step we are on, then every tool by group; --all adds retired ones)
//   node os.mjs tool <id>                (one tool: its link, where it opens, sign-in and limits; then open the link in the browser pane)
//   node os.mjs tool <id> [--name ..] [--url ..] [--purpose ..] [--sign-in ..] [--limits ..] [--steps product,prove] [--group g]
//                           [--opens-in chrome|luxury-desktop|local] [--agents scout,checker] [--source path-or-link]
//                           [--signed-in yes|no] [--optional yes|no] [--retire] [--restore]   (edits; an unknown id with --name --url --purpose --steps creates it)
//   node os.mjs tools import <file.json> (adds every tool in {tools:[...]} whose id is not listed yet; existing ones are left alone)
//   No passwords, keys or tokens: the server refuses them. The owner signs in once in the browser; agents work in that session.
//
// Assets (the store page, picture by picture; read-only here):
//   node os.mjs assets [--packet <id>] [--needs]   (every place in page order with its status and file; --needs: only empty or missing places)
//   Remove and Restore are the owner's buttons on the Assets page: files move to a _removed bin beside them and are never deleted.
//
//   node os.mjs help                     (every command on one screen)
//
// <task-id> may be the full ID or any unique part of it (e.g. 22d1d860).
// MERRIVY_OS_PORT points at an isolated test server; the Host/Origin headers
// stay localhost:3000 because the API only accepts that local origin.
import http from 'node:http';
import {readFile} from 'node:fs/promises';

const PORT = Number(process.env.MERRIVY_OS_PORT || 3000);
const ORIGIN = 'http://localhost:3000';
const TZ = 'America/Chicago';

function request(method, path, body, {hub = false, timeout = 8000} = {}) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  // Hub routes (/api/assets) check the Host against the port they listen on.
  const headers = {host: hub ? `localhost:${PORT}` : 'localhost:3000', 'x-launchroom-local-agent':'1', ...(process.env.LAUNCHROOM_RUN_ID ? {'x-launchroom-run': String(process.env.LAUNCHROOM_RUN_ID).slice(0, 120)} : {})};
  if (payload !== undefined) Object.assign(headers, {origin: ORIGIN, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload)});
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port: PORT, path: process.env.LAUNCHROOM_PROJECT ? `/p/${encodeURIComponent(process.env.LAUNCHROOM_PROJECT)}${path}` : path, method, headers, timeout}, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data; try { data = JSON.parse(raw); } catch { data = raw; }
        if (res.statusCode >= 400) {
          const err = new Error(`${method} ${path} -> ${res.statusCode} ${data?.code || ''} ${data?.error || data?.message || raw}`.trim());
          err.status = res.statusCode; return reject(err);
        }
        resolve(data);
      });
    });
    req.on('timeout', () => req.destroy(new Error(`Timed out reaching localhost:${PORT}`)));
    req.on('error', (e) => reject(e.code === 'ECONNREFUSED' ? new Error(`Launchroom is not running on localhost:${PORT}. Start it (see SKILL.md "If Launchroom is down").`) : e));
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function parse(argv) {
  // `lists` keeps every value of a repeated flag (used by the library commands);
  // the single-value fields keep their existing last-value behavior.
  // Forgiving (Oct 2): --key=value works, --help/-h is a switch on any command,
  // and a switch given a value by mistake never swallows the next flag.
  const out = {_: [], ref: [], lists: {}};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help' || a === '-help') { out.help = true; continue; }
    if (!a.startsWith('--') || a === '--') { if (a !== '--') out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = (eq > 2 ? a.slice(2, eq) : a.slice(2)).toLowerCase();
    if (['all', 'focus', 'no-focus', 'important', 'retire', 'restore', 'needs', 'history'].includes(key)) { out[key] = true; continue; }
    const value = eq > 2 ? a.slice(eq + 1) : argv[++i];
    if (value === undefined || (eq <= 2 && /^--[a-z]/i.test(value))) throw new Error(`--${key} needs a value, e.g. --${key} "..."${value === undefined ? '' : ` (it was followed by ${value})`}. Run with --help for examples.`);
    (out.lists[key] ||= []).push(value);
    if (key === 'ref') out.ref.push(value); else out[key] = value;
  }
  return out;
}

const localDay = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).format(d);
};
function dateValue(v) {
  if (v === undefined) return undefined;
  if (v === 'today') return localDay();
  if (v === 'tomorrow') return localDay(1);
  if (v === 'someday' || v === '') return '';
  return v;
}

// Step tags: the seven step ids (os/src/steps.mjs, owner Oct 2: product first, then buyers), by id, name or number ("prove", "Prove it", "3");
// the old words still work ("find" and "discovery" are product; "issue" is buyers; "validate" and "source" are prove); "none" clears.
const STEP_IDS = ['product', 'buyers', 'prove', 'create', 'build', 'launch', 'learn'];
const STEP_NAMES = ['product', 'buyers', 'prove it', 'create', 'build', 'launch', 'learn'];
const OLD_STEPS = {issue: 'buyers', issues: 'buyers', buyer: 'buyers', discovery: 'product', find: 'product', validation: 'prove', validate: 'prove', sourcing: 'prove', source: 'prove', creative: 'create', shopify: 'build', testing: 'launch', 'prove-it': 'prove', learning: 'learn'};
function stepValue(v) {
  const key = String(v).trim().toLowerCase();
  if (key === '' || key === 'none') return '';
  if (STEP_IDS.includes(key)) return key;
  if (STEP_NAMES.includes(key)) return STEP_IDS[STEP_NAMES.indexOf(key)];
  if (OLD_STEPS[key]) return OLD_STEPS[key];
  if (/^[1-7]$/.test(key)) return STEP_IDS[Number(key) - 1];
  throw new Error(`--step takes one of ${STEP_IDS.join(', ')} (or 1-7, or none).`);
}
const stepLabel = (id) => STEP_NAMES[STEP_IDS.indexOf(OLD_STEPS[id] || id)] || '';
/** A tool's saved steps in the seven-step ids (tags saved before Oct 2 use the old six-step ids). */
const toolSteps = (tool) => [...new Set((tool.steps || []).map((s) => { try { return stepValue(s); } catch { return s; } }))];
const stepTitle = (id) => { const l = stepLabel(id); return l.charAt(0).toUpperCase() + l.slice(1); };

function taskFields(o) {
  const t = {};
  if (o.step !== undefined) t.step = stepValue(o.step);
  if (o.title !== undefined) t.title = o.title;
  if (o.date !== undefined) t.date = dateValue(o.date);
  if (o.who !== undefined) t.assignee = o.who;
  if (o.next !== undefined) t.nextAction = o.next;
  if (o.notes !== undefined) t.notes = o.notes;
  if (o.status !== undefined) t.status = o.status;
  if (o.agent !== undefined) {
    t.agent = o.agent === 'none' ? '' : o.agent;
    if (t.agent && o.who === undefined) t.assignee = 'agent';
  }
  if (o.agents !== undefined) {
    t.agents = String(o.agents).split(',').map((s) => s.trim()).filter(Boolean);
    if (t.agents.length && o.who === undefined) t.assignee = 'agent';
  }
  if (o.product !== undefined) t.product = o.product === 'none' ? '' : o.product;
  if (o.focus) t.focus = true;
  if (o['no-focus']) t.focus = false;
  return t;
}

function findTask(tasks, key) {
  if (!key) throw new Error('Give a task ID (or a unique part of it).');
  const exact = tasks.find((t) => t.id === key);
  if (exact) return exact;
  const hits = tasks.filter((t) => t.id.includes(key));
  if (hits.length === 1) return hits[0];
  throw new Error(hits.length ? `"${key}" matches ${hits.length} tasks; use more of the ID.` : `No task matches "${key}".`);
}

const short = (id) => id.replace(/^T-/, '').slice(0, 8);
const line = (t) => `${t.focus ? '*' : ' '} [${t.status.padEnd(7)}] ${(t.date || 'someday').padEnd(10)} ${(t.assignee || 'shared').padEnd(6)} ${short(t.id)}  ${t.title}${t.step ? `  #${stepLabel(t.step)}` : ''}${t.product ? `  [${t.product}]` : ''}${t.agent ? `  → ${t.agent}` : ''}`;

// The same rule as os/src/plannerRules.mjs agentInbox: a someday agent task
// (no date) is parked, never dispatched; it shows only as a count.
const isParked = (t) => Boolean(t.agent) && t.status === 'todo' && !t.date;
function printInbox(tasks) {
  const mine = tasks.filter((t) => t.agent && t.status !== 'done');
  const waiting = mine.filter((t) => t.status === 'todo' && t.date).sort((a, b) => a.date.localeCompare(b.date));
  const working = mine.filter((t) => t.status === 'doing'), stuck = mine.filter((t) => t.status === 'blocked'), parked = mine.filter(isParked);
  if (!mine.length) { console.log('\nAgent inbox: empty'); return; }
  console.log(`\nAgent inbox: ${waiting.length} waiting for dispatch · ${working.length} working · ${stuck.length} blocked${parked.length ? ` · ${parked.length} parked (someday)` : ''}`);
  for (const t of [...waiting, ...working, ...stuck]) {
    console.log(`  ${t.status === 'todo' ? 'DISPATCH' : t.status.toUpperCase().padEnd(8)} ${(t.agents?.length ? t.agents.join('+') : t.agent).padEnd(16)} ${short(t.id)}  ${t.title}`);
    if (t.status === 'todo' && t.nextAction) console.log(`           ${t.nextAction.slice(0, 220)}`);
  }
  if (parked.length) console.log(`  Parked: ${parked.length} someday job${parked.length === 1 ? '' : 's'}, not dispatched (give one a day to queue it: set <id> --date today). List them: todo`);
}

// A report's department, from the agent's id (agents/team.json "role"; .claude/agents files).
const ROLE_OF = {scout: 'validation', checker: 'validation', 'buyer-researcher': 'validation', copywriter: 'image-generator', 'image-maker': 'image-generator', 'store-builder': 'shopify-builder', 'os-builder': 'manager', manager: 'manager'};
const REPORT_EXAMPLE = 'os.mjs report scout-2026-10-02-sleep --agent scout --status running --title "Sleep cards from Meta Ad Library" --event "Plan: 1 search · 2 cards · 3 hand back"';
// lesson propose/add/set/used, made forgiving (Oct 2): agents tried --reason,
// --scope, --agent, --source <agent>, --help and --key=value. Common spellings
// are read as the real flags (with a note), the scope words are normalised, and
// every refusal says what to type instead.
const LESSON_HELP = `Lessons: short rules learned from real work. Agents propose; the manager checks them.

  Propose one (any agent, after a job):
    node .claude/skills/merrivy-os/scripts/os.mjs lesson propose "Rule in one line, 200 characters at most" --why "The reason, 240 at most" --for os-builder --by os-builder --from "What happened"

  Record a lesson that helped (or didn't):
    node .claude/skills/merrivy-os/scripts/os.mjs lesson used LS-058 --helped yes --by os-builder

  Manager only:
    lesson add "rule" --why ".." --for <scope> [--status trying|proven] [--source owner|job|review|seed]
    lesson set LS-012 [--status trying|proven|retired] [--note "why"] [--rule ..] [--why ..] [--for ..]

  Flags:
    --why "..."        why the rule matters (also read: --reason, --because)
    --for <scope>      who it is for: everyone, manager or one agent id (also read: --scope, --to)
    --by <agent>       who proposes it (also read: --agent, --proposed-by)
    --from "..."       what happened (also read: --learned-from, --context, --job)
    --ref <file|link>  evidence, repeatable, at most 6 (also read: --refs, --reference, --link)
    --flag=value works too. Lists: os.mjs lessons [--for <scope>]`;
const LESSON_ALIASES = {why: ['reason', 'because', 'rationale'], for: ['scope', 'to', 'audience', 'target'], by: ['agent', 'proposed-by', 'proposer', 'author', 'from-agent'], from: ['learned-from', 'context', 'job', 'situation', 'what-happened'], rule: ['text', 'title'], ref: ['refs', 'reference', 'references', 'link', 'evidence']};
const LESSON_FLAGS = new Set(['why', 'for', 'by', 'from', 'rule', 'ref', 'on', 'note', 'status', 'source', 'helped', 'lesson', 'task']);
const SCOPE_WORDS = {all: 'everyone', team: 'everyone', everybody: 'everyone', agents: 'everyone', 'all-agents': 'everyone', claude: 'manager', main: 'manager', lead: 'manager'};
const AGENT_LIKE = /^[a-z][a-z0-9-]{0,59}$/;
/** Reads the spellings agents tried as the real flags; returns plain notes for what it changed. */
function lessonFlags(o, action) {
  const notes = [];
  for (const [real, aliases] of Object.entries(LESSON_ALIASES)) for (const alias of aliases) {
    if (o[alias] === undefined || alias === real) continue;
    if (real === 'ref') { for (const value of o.lists[alias] || [o[alias]]) o.ref.push(value); notes.push(`--${alias} read as --ref`); }
    else if (o[real] === undefined) { o[real] = o[alias]; notes.push(`--${alias} read as --${real}`); }
    delete o[alias];
  }
  if (o.lesson !== undefined && o.rule === undefined && (action === 'propose' || action === 'add')) { o.rule = o.lesson; notes.push('--lesson read as the rule'); }
  if (o.for !== undefined) {
    const scope = String(o.for).trim().toLowerCase();
    if (/[,\s]/.test(scope)) throw new Error(`A lesson is for one scope (everyone, manager or one agent id), not "${o.for}". Use --for everyone, or propose it once per agent.`);
    o.for = SCOPE_WORDS[scope] || scope;
  }
  if (o.by !== undefined) o.by = String(o.by).trim().toLowerCase();
  if (o.source !== undefined && !['owner', 'job', 'review', 'seed'].includes(String(o.source).toLowerCase())) {
    const value = String(o.source);
    if (/^https?:\/\/|\//.test(value)) { o.ref.push(value); notes.push(`--source ${value} read as --ref (source is owner, job, review or seed)`); }
    else if (AGENT_LIKE.test(value.toLowerCase())) { if (o.by === undefined) o.by = value.toLowerCase(); notes.push(`--source ${value} read as --by ${value.toLowerCase()} (source is owner, job, review or seed)`); }
    else throw new Error(`--source is owner, job, review or seed (or leave it out), not "${value}".`);
    delete o.source;
  } else if (o.source !== undefined) o.source = String(o.source).toLowerCase();
  if (action === 'propose' && o.status !== undefined && o.status !== 'proposed') { notes.push(`--status ${o.status} ignored: a proposal starts as proposed; the manager moves it`); delete o.status; }
  if (o.task !== undefined && o.from === undefined) { o.from = `task ${o.task}`; notes.push('--task read as --from'); }
  const unknown = Object.keys(o).filter((key) => !['_', 'ref', 'lists', 'help', ...LESSON_FLAGS].includes(key) && typeof o[key] !== 'boolean');
  for (const key of unknown) { notes.push(`--${key} is not a lesson flag and was ignored (see --help)`); delete o[key]; }
  return notes;
}
/** Plain length checks before the server: what to shorten and where the detail can go. */
function lessonLengths(input) {
  const over = [['rule', input.rule, 200, 'Keep the rule to one short line; put the detail in --why (240) or --from (300).'], ['why', input.why, 240, 'Shorten --why; put the story in --from (300).'], ['from', input.learnedFrom, 300, 'Shorten --from.']]
    .filter(([, value, max]) => typeof value === 'string' && value.length > max);
  if (over.length) throw new Error(over.map(([name, value, max, tip]) => `The ${name === 'rule' ? 'rule' : `--${name}`} is ${value.length} characters; the limit is ${max}. ${tip}`).join('\n'));
}
/** LS-58, ls-058 and 58 all mean LS-058. */
const lessonId = (value) => { const m = String(value || '').trim().match(/^(?:ls-?)?(\d{1,5})$/i); return m ? `LS-${m[1].padStart(3, '0')}` : String(value || '').trim().toUpperCase(); };
/** Server refusals in plain words with what to type instead (by the exact sentence, LS-073). */
function lessonError(message) {
  if (/Choose who the lesson is for/.test(message)) return 'Who is the lesson for? Use --for everyone, --for manager or one agent id such as --for scout.';
  if (/Proposed by must be/.test(message)) return 'Who proposes it? Use --by with your agent id, such as --by os-builder.';
  if (/Lesson source must be/.test(message)) return '--source is owner, job, review or seed (or leave it out).';
  if (/LESSON_LIMIT/.test(message)) return `${message.replace(/^.*LESSON_LIMIT\s*/, '')} (Proposals never hit this limit; it applies when a lesson becomes trying or proven.)`;
  if (/Use at most 6 lesson references/.test(message)) return 'Use at most 6 --ref values.';
  return message;
}

async function roleFor(agent) {
  if (!agent) return '';
  if (ROLE_OF[agent]) return ROLE_OF[agent];
  try { const {team} = await request('GET', '/api/bootstrap'); return team?.agents?.find((a) => a.id === agent)?.role || ''; } catch { return ''; }
}

function printTasks(tasks, all) {
  const today = localDay();
  const list = tasks.filter((t) => all || t.status !== 'done');
  const groups = [
    ['Overdue / carried forward', (t) => t.status !== 'done' && t.date && t.date < today],
    ['Today', (t) => t.date === today],
    ['Upcoming', (t) => t.date && t.date > today],
    ['Someday', (t) => !t.date],
    ['Done earlier', (t) => t.status === 'done' && t.date && t.date < today],
  ];
  for (const [label, test] of groups) {
    const rows = list.filter(test).sort((a, b) => (a.date || '').localeCompare(b.date || '') || Number(b.focus) - Number(a.focus));
    if (!rows.length) continue;
    console.log(`\n${label}`);
    for (const t of rows) {
      console.log(line(t));
      if (t.status !== 'done' && t.nextAction) console.log(`      next: ${t.nextAction}`);
    }
  }
}

// Copy-and-paste prompts from workflow/the-line.json. [Brackets] are blanks to fill in.
function printPrompts(step, anytime, withAnytime, isCurrent = true) {
  console.log(`\nPrompts for Step ${step.number} · ${step.name}${isCurrent ? ' (the step we are on)' : ''}:`);
  step.prompts.forEach((p, i) => console.log(`  ${i + 1}. ${p.label}\n     ${p.text}`));
  if (!withAnytime) { console.log('\nAnytime prompts: `os.mjs prompts`.'); return; }
  console.log('\nAnytime:');
  anytime.forEach((p) => console.log(`  - ${p.label}\n     ${p.text}`));
}

async function savePlanner(input) {
  const {revision} = await request('GET', '/api/planner');
  const saved = await request('POST', '/api/planner/tasks', {revision, ...input});
  const id = input.id || saved.tasks.at(-1).id;
  const task = saved.tasks.find((t) => t.id === id);
  // Read back from a fresh GET so the caller sees what was actually persisted.
  const check = (await request('GET', '/api/planner')).tasks.find((t) => t.id === id);
  if (!check || JSON.stringify(check) !== JSON.stringify(task)) throw new Error('Saved, but readback did not match. Re-read the planner.');
  console.log(`saved (planner revision ${saved.revision})`);
  console.log(line(check));
  if (check.status !== 'done' && check.nextAction) console.log(`      next: ${check.nextAction}`);
  return check;
}

/* ---------- Library ---------- */
const TOPICS = ['product-research', 'buyer-angles', 'copywriting', 'images-ads', 'store', 'sourcing', 'testing', 'operations', 'tools'];
const commaList = (value) => value === undefined ? undefined : String(value).split(',').map((s) => s.trim()).filter(Boolean);
const oneLine = (value, max = 200) => { const s = String(value || '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const entryLine = (e) => `${e.id.padEnd(6)} [${(e.status === 'to-learn' ? 'to-learn' : e.trust).padEnd(8)}] ${e.title}${e.path ? `  — ${e.path}` : ''}`;
const newestFirst = (a, b) => String(b.learnedOn || b.requestedOn).localeCompare(String(a.learnedOn || a.requestedOn)) || b.id.localeCompare(a.id);

async function findEntry(id) {
  if (!/^K-\d{3,}$/.test(id || '')) throw new Error('Give a library ID like K-012 (see `library search` or `library list`).');
  const {entries} = await request('GET', '/api/library');
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error(`No library entry ${id}.`);
  return entry;
}

function entryFields(o, previous) {
  const input = {};
  for (const key of ['title', 'learned', 'kind', 'trust', 'path']) if (o[key] !== undefined) input[key] = o[key];
  if (o.topics !== undefined) input.topics = commaList(o.topics);
  if (o.for !== undefined) input.forAgents = commaList(o.for);
  if (o.by !== undefined) input.askedBy = o.by;
  // Repeated --source and --lesson add to what the entry already has.
  if (o.lists.source) input.sources = [...new Set([...(previous?.sources || []), ...o.lists.source])];
  if (o.lists.lesson) input.lessons = [...new Set([...(previous?.lessons || []), ...o.lists.lesson])];
  return input;
}

async function noteBodyFrom(o) {
  if (o['body-file']) return readFile(o['body-file'], 'utf8');
  return o.body;
}

async function saveLibrary(input, verb) {
  const {revision} = await request('GET', '/api/library');
  const saved = await request('POST', '/api/library', {revision, ...input});
  const id = input.id || saved.entries.at(-1).id;
  const entry = saved.entries.find((e) => e.id === id);
  // Read back from a fresh GET so the caller sees what was actually persisted.
  const check = (await request('GET', '/api/library')).entries.find((e) => e.id === id);
  if (!check || JSON.stringify(check) !== JSON.stringify(entry)) throw new Error('Saved, but readback did not match. Re-read /api/library.');
  console.log(`${verb} ${check.id} [${check.status === 'to-learn' ? 'reading list' : `${check.kind} · ${check.trust}`}] ${check.title}${check.path ? ` — ${check.path}` : ''} · library revision ${saved.revision}`);
  if (check.status === 'learned' && !check.topics.length) console.log(`  No topics yet. Sort it with: library set ${check.id} --topics ${TOPICS.slice(0, 2).join(',')}`);
  return check;
}

async function hub(o) {
  const {HUB_DOORS} = await import(new URL('../../../../os/src/hubDoors.mjs', import.meta.url));
  const id = o._[0];
  if (!id) {
    console.log('Hubs: what to read before a job. Open one with: hub <door>\n');
    for (const door of HUB_DOORS) console.log(`  ${door.id.padEnd(10)} ${door.title}: ${door.line}`);
    return;
  }
  const door = HUB_DOORS.find(entry => entry.id === id);
  if (!door) throw new Error(`No door "${id}". Doors: ${HUB_DOORS.map(entry => entry.id).join(', ')}.`);
  console.log(`${door.title}: ${door.line}`);
  if (door.agent) console.log(`Subagent for this work: ${door.agent}`);
  console.log(`Page: #/${door.go}`);
  for (const link of door.links) console.log(`  ${link.label}: ${link.doc || `#/${link.go}`}`);
  if (door.id === 'team') {
    const {team} = await request('GET', '/api/bootstrap');
    for (const agent of team?.agents || []) console.log(`  ${agent.id.padEnd(18)} ${agent.summary || agent.name}`);
    return;
  }
  const {entries} = await request('GET', '/api/library');
  const RANK = {tested: 0, sourced: 1, idea: 2, outdated: 3};
  const shelf = entries.filter(entry => entry.status !== 'to-learn' && entry.trust !== 'outdated' && (entry.topics || []).includes(door.topic))
    .sort((a, b) => (RANK[a.trust] ?? 9) - (RANK[b.trust] ?? 9) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  console.log(`\nLibrary (${shelf.length}; read one with: library read K-###):`);
  for (const entry of shelf.slice(0, 8)) console.log(`  ${entry.id} [${entry.trust}] ${entry.title}`);
}

async function library(o) {
  const sub = o._[0];
  switch (sub) {
    case 'search': {
      const q = o._.slice(1).join(' ').trim();
      if (!q) throw new Error('library search needs words, e.g. library search "ad hooks".');
      const hits = await request('GET', `/api/library/search?q=${encodeURIComponent(q)}`);
      if (!hits.length) { console.log(`Nothing matches "${q}". Try other words, or put it on the reading list: library learn "${q}"`); break; }
      // Nothing matched exactly: the server sends the closest entries, each marked closest.
      const closest = hits.every((h) => h.closest);
      if (closest) console.log(`Nothing matched exactly; closest:`);
      for (const h of hits) {
        console.log(entryLine(h));
        console.log(`         ${oneLine(h.learned, 180)}`);
        if (closest && h.near?.length) console.log(`         close to: ${h.near.slice(0, 3).join(', ')}`);
        if (h.snippet) console.log(`         "${oneLine(h.snippet, 180)}"`);
      }
      console.log(closest ? `\nRead one with: library read <id>. None fits? library learn "${q}"` : `\n${hits.length} match${hits.length === 1 ? '' : 'es'} · read one with: library read <id>`);
      break;
    }
    case 'list': {
      const {entries, counts} = await request('GET', '/api/library');
      const shown = entries.filter((e) => e.status === 'learned' && (o.all || e.trust !== 'outdated') && (!o.topic || e.topics.includes(o.topic)) && (!o.for || e.forAgents.includes(o.for)) && (!o.kind || e.kind === o.kind)).sort(newestFirst);
      for (const topic of [...TOPICS, '']) {
        const rows = shown.filter((e) => (e.topics[0] || '') === topic);
        if (!rows.length) continue;
        console.log(`\n${topic || '(not sorted yet)'}`);
        for (const e of rows) console.log(`  ${entryLine(e)}`);
      }
      const waiting = entries.filter((e) => e.status === 'to-learn' && (!o.for || e.forAgents.includes(o.for)));
      if (waiting.length && !o.topic && !o.kind) {
        console.log(`\nOn the reading list (${waiting.length})`);
        for (const e of waiting) console.log(`  ${e.id.padEnd(6)} ${e.title}  (asked by ${e.askedBy} ${e.requestedOn}${e.forAgents.length ? `; for ${e.forAgents.join(', ')}` : ''})`);
      }
      console.log(`\n${shown.length} shown · ${counts.learned} learned (${counts.byTrust.tested} tested, ${counts.byTrust.sourced} sourced, ${counts.byTrust.idea} idea${counts.byTrust.idea === 1 ? '' : 's'}, ${counts.byTrust.outdated} outdated) · ${counts.toLearn} on the reading list`);
      break;
    }
    case 'read': {
      const e = await findEntry(o._[1]);
      console.log(`${e.id} · ${e.title}`);
      console.log(`${e.status === 'to-learn' ? 'Want to learn' : 'What we learned'}: ${e.learned}`);
      console.log(`${e.kind} · ${e.status === 'to-learn' ? 'on the reading list' : e.trust} · topics: ${e.topics.join(', ') || 'not sorted yet'} · ${e.status === 'to-learn' ? `asked ${e.requestedOn}` : `learned ${e.learnedOn}`} by ${e.askedBy}`);
      if (e.forAgents.length) console.log(`For: ${e.forAgents.join(', ')}`);
      if (e.sources.length) console.log(`Sources: ${e.sources.join(', ')}`);
      if (e.lessons.length) console.log(`Lessons: ${e.lessons.join(', ')}`);
      if (!e.path) { console.log('\nNot learned yet: it is on the reading list. Answer it with `library done`.'); break; }
      const doc = await request('GET', `/api/doc?path=${encodeURIComponent(e.path)}`);
      console.log(`File: ${e.path}\n${'-'.repeat(72)}\n${doc.content}`);
      break;
    }
    case 'add': {
      const input = {...entryFields(o), status: 'learned'};
      for (const key of ['title', 'learned', 'path']) if (!input[key]) throw new Error(`library add needs --${key}. Use \`library note\` to write a new file instead.`);
      if (!input.topics?.length && (input.kind || 'note') !== 'note') throw new Error(`library add needs --topics (1 to 3 of: ${TOPICS.join(', ')}).`);
      await saveLibrary(input, 'added');
      break;
    }
    case 'note': {
      const body = await noteBodyFrom(o);
      if (!body && !o.learned) throw new Error('library note needs --body "..." (or --body-file file.md).');
      if (o.path) throw new Error('library note writes a new file; to catalog an existing file use `library add --path`.');
      await saveLibrary({...entryFields(o), note: {body: body || ''}}, 'written down as');
      break;
    }
    case 'learn': {
      const what = o._.slice(1).join(' ').trim();
      if (!what) throw new Error('library learn needs what to learn, e.g. library learn "How do stores word free-shipping offers?"');
      if (what.length > 400) throw new Error('Keep the request under 400 characters; put a link to longer material.');
      const link = what.match(/https?:\/\/[^\s<>()"']+/i)?.[0]?.replace(/[.,;:!?]+$/, '');
      const agents = commaList(o.for) || [];
      const entry = await saveLibrary({...entryFields(o), learned: what, status: 'to-learn', kind: o.kind || 'research', trust: 'idea', forAgents: agents, ...(link ? {sources: [link]} : {})}, 'on the reading list:');
      await savePlanner({title: `Learn: ${oneLine(what, 80)}`, date: localDay(), status: 'todo', assignee: 'agent', agent: agents[0] || '', focus: false,
        nextAction: `Research this, then write what we learned to the library (os.mjs library done ${entry.id} --learned "..." --path file.md --topics a,b)`, notes: `${entry.id} on the library reading list.`, references: ['resources/LIBRARY.md']});
      break;
    }
    case 'done': {
      const e = await findEntry(o._[1]);
      if (e.status === 'learned') throw new Error(`${e.id} is already learned. Use \`library set ${e.id}\` to change it.`);
      const body = await noteBodyFrom(o);
      if (!o.learned) throw new Error('library done needs --learned "what we learned, in one or two sentences".');
      if (!o.path && !body) throw new Error('library done needs --path file.md (the write-up), or --body "..." to write a new note.');
      const input = {id: e.id, status: 'learned', ...entryFields(o, e), ...(o.path ? {} : {note: {body}})};
      if (!input.topics?.length && !e.topics.length && (input.kind || e.kind) !== 'note') throw new Error(`Add --topics (1 to 3 of: ${TOPICS.join(', ')}).`);
      await saveLibrary(input, 'learned');
      const {tasks} = await request('GET', '/api/planner');
      for (const t of tasks.filter((t) => t.status !== 'done' && (t.nextAction || '').includes(`library done ${e.id}`))) console.log(`Linked to-do still open: ${short(t.id)} ${t.title}. The manager closes it after checking.`);
      break;
    }
    case 'set': {
      const e = await findEntry(o._[1]);
      const input = {id: e.id, ...entryFields(o, e)};
      if (Object.keys(input).length === 1) throw new Error('Nothing to change.');
      await saveLibrary(input, 'saved');
      break;
    }
    default:
      throw new Error('Use library search, list, read, add, note, learn, done or set.');
  }
}

/* ---------- Tools ---------- */
const TOOL_GROUPS = ['research', 'sourcing', 'store', 'ads', 'creative', 'email', 'local'];
const GROUP_NAMES = {research: 'Research', sourcing: 'Sourcing', store: 'Store', ads: 'Ads', creative: 'Creative', email: 'Email', local: 'On this computer'};
const OPENS = {chrome: 'Browser', 'luxury-desktop': 'Luxury app', local: 'This computer'};
const sortForStep = (list) => [...list].sort((a, b) => Number(Boolean(a.optional)) - Number(Boolean(b.optional)) || TOOL_GROUPS.indexOf(a.group) - TOOL_GROUPS.indexOf(b.group));
const isOs = (tool) => /^http:\/\/(?:localhost|127\.0\.0\.1):3000\//.test(tool.url);

async function toolRegistry() {
  try { return await request('GET', '/api/tools'); }
  catch (e) { if (e.status === 404) throw new Error('This OS server has no Tools API yet. Restart it after updating (see SKILL.md "If Launchroom is down").'); throw e; }
}
function printTool(tool, {indent = '  ', full = false} = {}) {
  const where = tool.opensIn === 'luxury-desktop' ? 'open the Luxury desktop app (the link is only the vendor page)' : tool.url;
  console.log(`${indent}${tool.id.padEnd(24)} ${tool.name}  [${OPENS[tool.opensIn]}]${tool.optional ? '  (optional cross-check)' : ''}${tool.retired ? '  (retired)' : ''}`);
  console.log(`${indent}${''.padEnd(24)} ${where}`);
  console.log(`${indent}${''.padEnd(24)} sign-in: ${tool.signIn || 'not noted yet'}${tool.signedInNoted ? ` (owner noted signed in ${tool.signedInNoted}; sessions can expire)` : ''}`);
  if (full) {
    console.log(`${indent}${''.padEnd(24)} for: ${tool.purpose}`);
    if (tool.limits) console.log(`${indent}${''.padEnd(24)} limits: ${tool.limits}`);
  }
}
function stepList(value) {
  return String(value).split(',').map((s) => s.trim()).filter(Boolean).map(stepValue).filter(Boolean);
}
async function tools(o) {
  if (o._[0] === 'import') {
    const file = o._[1];
    if (!file) throw new Error('tools import needs a JSON file with {"tools": [...]}.');
    const raw = JSON.parse(await readFile(file, 'utf8'));
    const incoming = Array.isArray(raw) ? raw : raw.tools;
    if (!Array.isArray(incoming)) throw new Error('The file needs {"tools": [...]} or a list of tools.');
    let registry = await toolRegistry();
    const have = new Set(registry.tools.map((t) => t.id));
    let added = 0, skipped = 0, failed = 0;
    for (const tool of incoming) {
      if (tool?.id && have.has(tool.id)) { skipped++; console.log(`  skip   ${tool.id} (already listed)`); continue; }
      try {
        registry = await request('POST', '/api/tools', {revision: registry.revision, ...tool});
        have.add(registry.saved); added++; console.log(`  added  ${registry.saved}`);
      } catch (e) {
        failed++; console.log(`  FAILED ${tool?.id || tool?.name || '?'}: ${e.message.replace(/^POST \/api\/tools -> /, '')}`);
        registry = await toolRegistry();
      }
    }
    console.log(`\n${added} added · ${skipped} already listed · ${failed} failed · tools revision ${registry.revision}. Catalog: resources/TOOLS.md`);
    if (failed) process.exitCode = 1;
    return;
  }
  const registry = await toolRegistry();
  const shown = registry.tools.filter((t) => o.all || !t.retired);
  if (o.group && !TOOL_GROUPS.includes(o.group)) throw new Error(`--group takes one of ${TOOL_GROUPS.join(', ')}.`);
  if (o.step !== undefined || o.group) {
    const step = o.step !== undefined ? stepValue(o.step) : '';
    // For a step: the method's tools first, optional cross-checks last; no Luxury-app tools (agents can't use Luxury's DICloak browser).
    const list = sortForStep(shown.filter((t) => (!step || toolSteps(t).includes(step)) && (!o.group || t.group === o.group) && !(step && (isOs(t) || t.opensIn === 'luxury-desktop'))));
    console.log(`${list.length} tool${list.length === 1 ? '' : 's'}${step ? ` for ${stepTitle(step)}` : ''}${o.group ? ` in ${GROUP_NAMES[o.group]}` : ''}:`);
    for (const t of list) printTool(t);
  } else {
    try {
      const {current} = await request('GET', '/api/line');
      const here = sortForStep(shown.filter((t) => !t.retired && toolSteps(t).includes(current.id) && !isOs(t) && t.opensIn !== 'luxury-desktop'));
      console.log(`Tools for Step ${current.number} · ${current.name} (the step we are on):`);
      for (const t of here) printTool(t);
      console.log('');
    } catch { /* older server without /api/line */ }
    for (const group of TOOL_GROUPS) {
      const list = shown.filter((t) => t.group === group);
      if (!list.length) continue;
      console.log(`${GROUP_NAMES[group]}`);
      for (const t of list) printTool(t);
    }
  }
  console.log(`\nNo passwords here: the owner signs in once in the browser; agents work in that session. One tool: os.mjs tool <id>`);
}
// Connect (owner, Nov 5): agents need the agent browser before any work. `connect` shows it,
// `connect check [site...]` has Launchroom check the sign-ins and turn connections on, and
// `connect open <site|url>` opens a working tab. Drive the tab with any CDP tool on port 9333.
async function connect(o) {
  const sub = o._[0] || 'status';
  const line = (site) => `  ${site.status.id === 'connected' ? '●' : '○'} ${site.id.padEnd(18)} ${site.status.label.padEnd(18)} ${site.url}`;
  if (sub === 'status') {
    const [browser, list] = await Promise.all([request('GET', '/api/agent-browser').catch((e) => ({error: e.message})), request('GET', '/api/connectors')]);
    const sites = (list.connectors || []).filter((site) => site.how === 'browser');
    console.log(browser.error ? `Connect: unknown (${browser.error})` : browser.running ? `Connect: CONNECTED · agent browser on 127.0.0.1:${browser.port} · ${browser.tabs.length} tabs` : 'Connect: NOT CONNECTED · ask the owner to press Connect in Launchroom (#/connect), or run: os.mjs connect start');
    console.log(`Sites (${sites.filter((s) => s.status.id === 'connected').length} of ${sites.length} connected):`);
    for (const site of sites) console.log(line(site));
    if (browser.running) for (const tab of browser.tabs) console.log(`  tab ${tab.id.slice(0, 8)}  ${tab.host || 'new tab'}  ${tab.title.slice(0, 60)}`);
    console.log('Drive a tab with: python -m scripts.automation.cli --port 9333 (from Documents\\gemini), or any CDP tool on http://127.0.0.1:9333.');
    return;
  }
  if (sub === 'start') {const res = await request('POST', '/api/agent-browser/start', {}); console.log(`Agent browser running on port ${res.port} with ${res.tabs.length} tabs.`); return;}
  if (sub === 'check') {
    const res = await requestSlow('POST', '/api/connectors/check', {ids: o._.slice(1)});
    for (const result of res.results) console.log(`  ${result.verdict === 'in' ? '● connected  ' : result.verdict === 'out' ? '○ signed out ' : '? unclear    '} ${result.id.padEnd(18)} landed on ${result.landed || '—'}`);
    if (!res.results.length) console.log('No site to check.');
    return;
  }
  if (sub === 'open') {
    const what = o._[1];
    if (!what) throw new Error('connect open needs a site id (os.mjs connect lists them) or a full https:// link.');
    const list = await request('GET', '/api/connectors');
    const site = (list.connectors || []).find((item) => item.id === what);
    const url = site ? site.url : what;
    const res = await request('POST', '/api/agent-browser/open', {url});
    const tab = res.tabs.find((item) => url.startsWith(item.url)) || res.tabs[0];
    console.log(`Opened ${site ? site.name : url} in the agent browser${tab ? ` (tab ${tab.id.slice(0, 8)})` : ''}.`);
    if (site && site.status.id !== 'connected') console.log(`${site.name} is not connected yet: the owner signs in, then run os.mjs connect check ${site.id}.`);
    return;
  }
  throw new Error('connect takes: status (default), start, check [site...], open <site|url>.');
}
async function requestSlow(method, path, body) {
  // A round of sign-in checks visits each site in turn, so it may take longer than one request.
  return request(method, path, body, {timeout: 180000});
}

// Scheduled jobs on Connect (owner, Nov 5: "Whenever we spawn a scheduled task from any agent, it
// would just pop up there"). Whatever tool runs the job (Claude app, Codex, Antigravity, Windows),
// the agent that sets it up adds it here the same turn, and each run reports under its id.
async function schedule(o) {
  const sub = o._[0] || 'list';
  if (sub === 'list') {
    const res = await request('GET', '/api/schedules');
    const jobs = [...(res.schedules || []), ...(res.found || []).filter((f) => !(res.schedules || []).some((s) => s.id === f.id))];
    if (!jobs.length) {console.log('Nothing scheduled yet.'); return;}
    for (const job of jobs) console.log(`  ${job.enabled === false ? '‖' : '●'} ${job.id.padEnd(26)} ${job.when.padEnd(28)} ${job.runsIn.padEnd(12)} ${job.name}${job.found ? '  (found by Launchroom)' : ''}`);
    for (const problem of res.problems || []) console.log(`  ! ${problem}`);
    return;
  }
  if (sub === 'add') {
    const id = o._[1];
    if (!id) throw new Error('schedule add needs an id, e.g. os.mjs schedule add morning-meta --name "Morning Meta numbers" --runs-in claude-app --when "Every day at 8:00" [--cron "0 8 * * *"] [--agent ad-manager] [--what ".."] [--sites meta-ads-manager,shopify-admin] [--report-id morning-meta] [--paused]');
    const input = {id, name: o.name, what: o.what, agent: o.agent, runsIn: o['runs-in'], when: o.when, cron: o.cron, reportId: o['report-id'], addedBy: o.by || o.agent || 'manager'};
    if (o.sites !== undefined) input.sites = String(o.sites).split(',').map((x) => x.trim()).filter(Boolean);
    if (o.paused) input.enabled = false; else if (o.on) input.enabled = true;
    for (const key of Object.keys(input)) if (input[key] === undefined || input[key] === true && key !== 'enabled') delete input[key];
    const res = await request('POST', '/api/schedules', input);
    console.log(`Scheduled job ${id} is on Connect (${res.schedules.length} added by agents).`);
    return;
  }
  if (sub === 'remove') {
    const id = o._[1];
    if (!id) throw new Error('schedule remove needs the id (os.mjs schedule lists them). It only takes it off Connect: stop the job in its own tool too.');
    await request('POST', '/api/schedules/remove', {id});
    console.log(`Took ${id} off Connect. Stop it in its own tool too if it still runs there.`);
    return;
  }
  throw new Error('schedule takes: list (default), add <id> ..., remove <id>.');
}

async function tool(o) {
  const id = o._[0];
  if (!id) throw new Error('tool needs an id, e.g. os.mjs tool kalodata (os.mjs tools lists them).');
  const registry = await toolRegistry();
  const existing = registry.tools.find((t) => t.id === id);
  const input = {};
  for (const [flag, key] of [['name', 'name'], ['url', 'url'], ['purpose', 'purpose'], ['sign-in', 'signIn'], ['limits', 'limits'], ['group', 'group'], ['opens-in', 'opensIn'], ['source', 'source']]) if (o[flag] !== undefined) input[key] = o[flag];
  if (o.steps !== undefined || o.step !== undefined) input.steps = stepList(o.steps ?? o.step);
  if (o.agents !== undefined) input.agents = String(o.agents).split(',').map((s) => s.trim()).filter(Boolean);
  if (o['signed-in'] !== undefined) {
    if (!['yes', 'no'].includes(o['signed-in'])) throw new Error('--signed-in takes yes or no.');
    input.signedInNoted = o['signed-in'] === 'yes' ? localDay() : '';
  }
  if (o.optional !== undefined) {
    if (!['yes', 'no'].includes(o.optional)) throw new Error('--optional takes yes (a cross-check outside the method) or no.');
    input.optional = o.optional === 'yes';
  }
  if (o.retire) input.retired = true;
  if (o.restore) input.retired = false;
  if (!Object.keys(input).length) {
    if (!existing) {
      const near = registry.tools.filter((t) => t.id.includes(id) || t.name.toLowerCase().includes(id.toLowerCase())).map((t) => t.id);
      throw new Error(`No tool "${id}".${near.length ? ` Did you mean: ${near.join(', ')}?` : ' os.mjs tools lists them.'}`);
    }
    const t = existing;
    console.log(`${t.name} (${t.id})${t.retired ? ' · RETIRED, do not use' : ''}${t.optional ? " · optional cross-check (the method's own tools come first)" : ''}`);
    if (t.opensIn === 'luxury-desktop') console.log(`Opens in: the Luxury desktop app on this computer. Start Luxury, then choose ${t.name}.\nVendor page only: ${t.url}`);
    else console.log(`Open: ${t.url}\nOpens in: ${OPENS[t.opensIn]}${t.opensIn === 'chrome' ? ' (navigate the shared browser pane, or the owner\'s Chrome, to this link)' : ''}`);
    console.log(`For: ${t.purpose}`);
    console.log(`Steps: ${t.steps.map(stepTitle).join(', ')} · group ${GROUP_NAMES[t.group]}${t.agents.length ? ` · agents ${t.agents.join(', ')}` : ''}`);
    console.log(`Sign-in: ${t.signIn || 'not noted yet'}`);
    console.log(t.signedInNoted ? `Owner noted signed in on ${t.signedInNoted} (sessions can expire).` : 'No signed-in note: expect a sign-in wall; if one appears, stop and ask the owner to sign in. Never type a password.');
    if (t.limits) console.log(`Limits: ${t.limits}`);
    if (t.source) console.log(`Noted in: ${t.source}`);
    return;
  }
  const saved = await request('POST', '/api/tools', {revision: registry.revision, id, ...input});
  const t = saved.tools.find((x) => x.id === id);
  console.log(`${existing ? 'saved' : 'added'} ${t.id} · ${t.name}${t.retired ? ' (retired)' : ''}${t.signedInNoted ? ` · signed in noted ${t.signedInNoted}` : ''} · tools revision ${saved.revision}`);
}

const PLACE_STATUS = {'in-store': 'in store', draft: 'draft', missing: 'MISSING FILE', empty: 'needs a picture', optional: 'optional', online: 'online file'};
async function assets(o) {
  let map;
  try { map = await request('GET', `/api/assets${o.packet ? `?packet=${encodeURIComponent(o.packet)}` : ''}`, undefined, {hub: true}); }
  catch (e) { if (e.status === 404) throw new Error('This OS server has no store map yet. Restart it after updating (see SKILL.md "If Launchroom is down").'); throw e; }
  const packet = map.packets.find((p) => p.id === map.packet);
  const c = map.counts;
  console.log(`Store map: ${packet ? `${packet.label}${packet.status === 'sample' ? ' (demo)' : ''} · ${map.active ? 'live on the local store' : 'draft, not in the store'} · ${packet.file}` : 'no product packet'}`);
  console.log(`${c.filled} filled · ${c.empty} empty · ${c.missing} missing · ${c.removed} in the bin${map.packets.length > 1 ? ` · other packets: ${map.packets.filter((p) => p.id !== map.packet).map((p) => p.id).join(', ')}` : ''}`);
  for (const problem of map.problems) console.log(`! ${problem}`);
  const pad = (n) => String(n).padStart(2, '0');
  const line = (section, slot) => `  ${pad(section.number)} ${`${section.label}${section.slots.length > 1 ? ` · ${slot.label}` : ''}`.padEnd(40)} ${(slot.status === 'empty' && slot.kind === 'video' ? 'needs a video' : PLACE_STATUS[slot.status] || slot.status).padEnd(15)} ${slot.file || slot.src || ''}${slot.source === 'code' ? `  (page code: ${section.codeFile})` : slot.source === 'site' ? `  (site.json ${slot.key})` : slot.key ? `  (${slot.key})` : ''}${slot.derived ? '  repeats gallery picture 1' : ''}`;
  if (o.needs) {
    const needs = map.sections.flatMap((s) => s.slots.filter((x) => !x.derived && !x.optional && ['empty', 'missing'].includes(x.status)).map((x) => [s, x]));
    console.log(needs.length ? '\nPlaces that need a picture:' : '\nEvery place has a picture.');
    for (const [s, x] of needs) console.log(line(s, x));
  } else {
    for (const page of map.pages) {
      const list = map.sections.filter((s) => s.page === page.id);
      if (!list.length) continue;
      console.log(`\n${page.label}`);
      for (const s of list) for (const x of s.slots) console.log(line(s, x));
    }
    console.log(`\nNot on the page: ${c.brand} brand · ${c.ads} ads · ${c.notPlaced} not placed · ${c.removed} in the bin`);
  }
  console.log('\nStore page files are changed by the store builder in hydrogen-storefront; the app never moves them. Open: localhost:3000/#/assets');
}

/* ---------- Health check ---------- */
// GET /api/doctor from the running server. When the server is older than the
// check (404) or not running, the same rules run here from the files, read-only.
async function doctorReport() {
  try { return await request('GET', '/api/doctor'); }
  catch (e) {
    if (process.env.LAUNCHROOM_PROJECT) throw new Error(`Project ${process.env.LAUNCHROOM_PROJECT} health check is unavailable. Start the OS and retry; another project's records were not used.`);
    const mode = e.status === 404 ? 'old' : /is not running/.test(e.message) ? 'down' : '';
    if (!mode) throw e;
    const {fileURLToPath} = await import('node:url');
    const root = process.env.MERRIVY_WORKSPACE_ROOT || fileURLToPath(new URL('../../../../', import.meta.url));
    const code = (file) => new URL(`../../../../os/server/${file}`, import.meta.url).href;
    const [{createStore}, {createHub}, {gatherFacts, doctorReport: rules}] = await Promise.all([import(code('store.mjs')), import(code('hub.mjs')), import(code('doctor.mjs'))]);
    const hub = await createHub({workspaceRoot: root, port: 0});
    return rules(await gatherFacts({workspaceRoot: root, store: createStore({workspaceRoot: root}), storeMap: hub.storeMap, server: {mode}}));
  }
}
function printDoctor(report) {
  const at = new Date(report.computedAt);
  const when = `${new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).format(at)} ${new Intl.DateTimeFormat('en-GB', {timeZone: TZ, hour: '2-digit', minute: '2-digit'}).format(at)} Chicago`;
  const source = {live: 'from the running server', old: 'read from the files: the running server is older than this check', down: 'read from the files: the OS is not running'}[report.mode] || 'read from the files';
  console.log(`OS health check: ${report.summary} (${when}, ${source})`);
  const rows = report.checks.flatMap((check) => check.findings.map((finding) => ({...finding, label: check.label})));
  const looks = rows.filter((row) => row.status === 'look');
  if (looks.length) console.log('');
  for (const row of looks) console.log(`LOOK  ${row.label}\n      ${row.text}\n      Fix: ${row.fix}`);
  console.log('');
  for (const row of rows.filter((r) => r.status === 'ok')) console.log(`ok    ${row.label}: ${row.text}`);
  for (const row of rows.filter((r) => r.status === 'note')) console.log(`note  ${row.label}: ${row.text}`);
  console.log('\nThe check only reads; it never changes a record. Fix what it lists with the usual commands, then run it again.');
}

/* ---------- Pipeline, products and rounds ---------- */
// Every product has its own seven-step line (os/src/pipeline.mjs, from saved
// records only). These commands read it; only `product start` and `round`
// write, through the same API as the app. The owner's eye test and "Build this
// one" stay owner-only on the screens.
const MARK = {done: 'x', current: '>', todo: ' ', stopped: '-', waiting: '.', early: '~'};
const lineText = (item) => item.line.map((s) => `${s.name}[${MARK[s.state] || ' '}${s.state === 'done' && s.total <= 1 ? '' : ` ${s.done}/${s.total}`}]`).join(' ');
const whoText = (who) => ({owner: 'Owner', manager: 'Claude', scout: 'Scout', checker: 'Checker', 'buyer-researcher': 'Buyer researcher', copywriter: 'Copywriter', 'image-maker': 'Image maker', 'store-builder': 'Store builder'}[who] || who || '');
const COUNT_ORDER = [['product', 'Product'], ['buyers', 'Buyers'], ['prove', 'Prove it'], ['ready', 'Ready to build'], ['create', 'Create'], ['build', 'Build'], ['launch', 'Launch'], ['learn', 'Learn']];
const countsText = (counts) => COUNT_ORDER.map(([id, name]) => `${name} ${counts[id] || 0}`).join(' · ');

async function pipelineData() {
  try { return await request('GET', '/api/pipeline'); }
  catch (e) { if (e.status === 404) throw new Error('This OS server has no pipeline yet. Restart it after updating (see SKILL.md "If Launchroom is down").'); throw e; }
}
function pipelineHeader(p) {
  const r = p.round;
  const issue = r?.issue ? ` · issue: ${r.issue}` : '';
  return r ? `The pipeline · Round ${r.number}${r.open ? '' : ' (reviewed)'} · started ${r.startedOn}${issue}: ${oneLine(r.focus, 140)}` : `The pipeline · no round yet (start Round ${p.nextNumber} with: round start --issue <slug> --focus "..." --folder research/<batch>/)`;
}
/** Step 0, the issue list (owner, Oct 3): every issue with its status (null when the server has no /api/issues). */
async function issuesLane() {
  try { return await request('GET', '/api/issues'); } catch { return null; }
}
const ISSUE_ORDER = {testing: 0, verified: 1, candidate: 2, parked: 3};
const STATUS_WORD = {candidate: 'Candidate', verified: 'Verified', testing: 'Testing', parked: 'Parked'};
const statusOf = (i) => i.status || (i.verified ?? i.gatePassed ? 'verified' : 'candidate');
/** "I1✓ I2· I3✓ I4~ I5· I6· I7·": passed, open, or only partly met under an older gate (the server sends the seven checks). */
const issueDots = (i) => (i.checks || []).map((c) => `${c.id}${c.state === 'passed' ? '✓' : c.state === 'partly' ? '~' : '·'}`).join(' ') || 'no checks read';
function issuesLaneText(data) {
  if (!data) return '';
  if (!data.issues.length) return 'Issues (step 0): none yet; the buyer researcher starts one (templates/ISSUE.md).';
  const testing = data.issues.filter((i) => statusOf(i) === 'testing').map((i) => i.slug);
  const verified = data.issues.filter((i) => statusOf(i) === 'verified').length;
  return `Issues (step 0): ${data.issues.length} · ${testing.length ? `testing ${testing.join(', ')}` : verified ? `${verified} Verified, waiting for the owner's pick` : 'none Verified yet'} · os.mjs issues`;
}
function printPipeline({pipeline: p, focus}, all = false, lane = null) {
  console.log(pipelineHeader(p));
  if (lane) console.log(issuesLaneText(lane));
  console.log(`On the line: ${countsText(p.counts)} · out of the line ${p.counts.out}`);
  console.log(`Build slot: ${p.building ? `${p.building.productId} ${p.building.name}${p.building.country ? ` (${p.building.country})` : ''} · ${p.building.stepName}` : 'empty (the owner picks the next one with "Build this one")'}`);
  console.log(`Needs the owner: ${p.ownerMoves.length ? p.ownerMoves.map((m) => m.text).join('; ') : 'nothing right now'}`);
  console.log(`Focus: Step ${focus.number} · ${focus.name} — ${p.focus.next}`);
  for (const round of p.rounds.filter((r) => r.needsReview)) console.log(`Round review due: ${round.id} (no cards left at Product, Buyers or Prove it) → round review ${round.id} --worked .. --failed .. --next ..`);
  if (p.roundsError) console.log(`! ${p.roundsError}`);
  const row = (item) => {
    console.log(`  ${item.id.padEnd(6)} ${oneLine(item.name, 44).padEnd(44)} ${(item.readyToBuild ? 'Ready to build' : item.stepName).padEnd(14)} ${oneLine(item.status, 56)}${item.who ? `  · ${whoText(item.who)}` : ''}${item.round ? `  · R${String(item.round).padStart(2, '0')}` : ''}`);
    console.log(`         ${lineText(item)}${item.productId && item.productId !== item.id ? `  (${item.productId})` : ''}${item.unlinked ? '  NOT STARTED FROM A CARD' : ''}`);
  };
  const building = p.active.filter((i) => i.building), ready = p.active.filter((i) => i.readyToBuild), rest = p.active.filter((i) => !i.building && !i.readyToBuild);
  if (building.length) { console.log('\nBuilding now'); building.forEach(row); }
  if (ready.length) { console.log('\nReady to build'); ready.forEach(row); }
  console.log(`\nOn the line (${rest.length})`);
  if (!rest.length) console.log('  none');
  rest.forEach(row);
  const out = p.out;
  if (all) {
    console.log(`\nOut of the line (${out.length})`);
    for (const item of out) console.log(`  ${item.id.padEnd(6)} ${oneLine(item.name, 44).padEnd(44)} ${item.outcome.label.padEnd(16)} ${item.roundId || 'earlier'}  ${oneLine(item.outcome.reason, 70)}`);
  } else if (out.length) {
    const byRound = {};
    for (const item of out) byRound[item.roundId || 'earlier work'] = (byRound[item.roundId || 'earlier work'] || 0) + 1;
    console.log(`\nOut of the line: ${out.length} (${Object.entries(byRound).map(([r, n]) => `${r} ${n}`).join(', ')}) · list them with: pipeline --all`);
  }
  console.log('\nOne product: product <L###|P###>. Status comes from saved records only; nothing here moves a product.');
}

async function product(o) {
  if (o._[0] === 'start') {
    const leadId = o._[1];
    if (!/^L\d{3,}$/.test(leadId || '')) throw new Error('product start needs a card id, e.g. product start L096 (the owner must have saved it for checks).');
    const input = {leadId};
    for (const key of ['name', 'country', 'variant']) if (o[key] !== undefined) input[key] = o[key];
    const saved = await request('POST', '/api/products', input);
    const check = await request('GET', `/api/products/${encodeURIComponent(saved.id)}`);
    if (check.revision !== saved.revision || check.markets[0].researchCandidateId !== leadId) throw new Error('Saved, but readback did not match. Re-read /api/products.');
    const m = check.markets[0];
    console.log(`started ${check.id} from ${leadId} · ${check.name} · ${m.country} · revision ${check.revision}`);
    console.log(`Card binding: ${m.verificationGate?.ready ? 'ready (checks can be recorded from the card\'s evidence)' : m.verificationGate?.reason || 'not ready yet'}`);
    console.log(`Next: record its checks from the card's evidence; nothing is copied as verified. Its line: product ${leadId}`);
    return;
  }
  const id = o._[0];
  if (!id) throw new Error('product needs an id: product L096, product P012, or product start L096.');
  let data;
  try { data = await request('GET', `/api/pipeline/item?id=${encodeURIComponent(id)}`); }
  catch (e) { if (e.status === 404 && /route not found/i.test(e.message)) throw new Error('This OS server has no pipeline yet. Restart it after updating.'); throw e; }
  const item = data.item;
  console.log(`${item.id}${item.productId && item.productId !== item.id ? ` · ${item.productId}` : ''} · ${item.name}${item.country ? ` (${item.country})` : ''} · ${item.roundId ? `Round ${item.round}` : 'earlier work'}`);
  console.log(`Line: ${lineText(item)}`);
  if (item.outcome) console.log(`Out of the line: ${item.outcome.label}${item.outcome.on ? ` (${item.outcome.on})` : ''} — ${item.outcome.reason || 'no reason saved'}`);
  else {
    console.log(`Step ${data.step.number} of 7 · ${data.step.name}${item.readyToBuild ? ' · ready to build' : ''}${item.building ? ' · in the build slot' : ''}: ${item.status}`);
    console.log(`Next: ${item.next}`);
    console.log(`Product record: ${item.productId || `not started (once its checks are complete: product start ${item.leadId || item.id})`}`);
  }
  if (item.unlinked) console.log('! Not started from a card: its checks cannot count until it is linked to its owner-saved card.');
  if (Array.isArray(data.gates)) {
    // The seven gates from the saved checks (os/src/gates.mjs): "partly" = old check passed, new part open.
    const WORD = {passed: 'passed', partly: 'partly', failed: 'FAILED', pending: 'open'};
    console.log('\nGates (workflow/CHECKS.md; from saved records only):');
    for (const g of data.gates) console.log(`  ${g.number} ${g.name.padEnd(9)} ${g.passed}/${g.total}  ${g.lines.map((l) => `${l.id} ${WORD[l.state] || l.state}${l.state === 'partly' ? ` (new: ${l.open})` : ''}`).join(' · ')}`);
  }
  console.log(`\n${data.markdown.trim()}`);
  if (data.prompts.length) {
    console.log(`\nPrompts for Step ${data.step.number} · ${data.step.name}, filled in for ${item.id}:`);
    data.prompts.forEach((p, i) => console.log(`  ${i + 1}. ${p.label}\n     ${p.text}`));
  }
}

const roundLine = (r) => `${r.id}  started ${r.startedOn}  ${r.open ? (r.needsReview ? 'OPEN · ready for review' : 'OPEN') : `reviewed ${r.review.reviewedOn}`} · ${r.cards ?? 0} card${r.cards === 1 ? '' : 's'} (${r.active ?? 0} on the line${r.inProductProve ? `, ${r.inProductProve} at Product to Prove it` : ''})\n      ${oneLine(r.focus, 160)}\n      issue: ${r.issue || 'none (legacy round)'}\n      folders: ${r.folders.join(', ')}`;
/**
 * Step 0, the issue list (owner, Oct 3): each issue's status (Candidate,
 * Verified, Testing, Parked) and its I1-I7 dots, Testing first. --status
 * narrows the list; a slug prints that issue's checks and search list.
 * Read-only: the owner picks on the Issues page.
 */
async function issues(o = {_: []}) {
  let data;
  try { data = await request('GET', '/api/issues'); }
  catch (e) { if (e.status === 404) throw new Error('This OS server has no /api/issues yet. Restart it after updating.'); throw e; }
  const want = typeof o.status === 'string' ? o.status.toLowerCase() : '';
  if (want && !STATUS_WORD[want]) throw new Error('--status is candidate, verified, testing or parked.');
  const slug = o._[0] ? String(o._[0]).toLowerCase() : '';
  if (slug) {
    const i = data.issues.find((x) => x.slug === slug);
    if (!i) throw new Error(`No issue "${slug}". List them with os.mjs issues.`);
    console.log(`${i.slug} · ${STATUS_WORD[statusOf(i)]}${i.pick ? ` (owner, ${i.pick.at.slice(0, 10)}${i.pick.undone ? ', after an undo' : ''})` : ''} · ${issueDots(i)}`);
    console.log(`  ${oneLine(i.title, 160)}`);
    if (i.group) console.log(`  Avatars: ${oneLine(i.group, 160)}`);
    console.log(`  Evidence: ${i.quotes ?? 0} quotes from ${i.sites ?? 0} sites${i.siteNames?.length ? ` (${i.siteNames.slice(0, 6).join(', ')})` : ''}`);
    for (const c of i.checks || []) console.log(`  [${c.state === 'passed' ? 'x' : c.state === 'partly' ? '~' : ' '}] ${c.id} · ${c.name}${c.note ? `: ${oneLine(c.note, 130)}` : ''}`);
    if (i.productTypes?.length) console.log(`  Product types: ${i.productTypes.join('; ')}`);
    if (i.searchTerms?.length) console.log(`  TikTok Shop search: ${i.searchTerms.map((s) => `"${s}"`).join(', ')}`);
    if (i.failing?.length) console.log(`  What fails them today: ${i.failing.join('; ')}`);
    else if (i.tried?.length) console.log(`  Already tried: ${i.tried.map((x) => x.fix).join('; ')}`);
    console.log(`  Rounds: ${i.rounds.map((r) => `${r.id}${r.open ? ' (open)' : ''}`).join(', ') || 'none yet'} · ${i.missingFile ? `${data.root}/${i.slug}/ (Gemini report only)` : i.path}${i.gemini?.length ? ` · Gemini: ${i.gemini.join(', ')}` : ''}`);
    return;
  }
  const counts = data.counts || {};
  console.log(`Step 0 · the issue list: ${data.issues.length} issue${data.issues.length === 1 ? '' : 's'} · ${counts.testing || 0} testing · ${counts.verified || 0} verified · ${counts.candidate || 0} candidates · ${counts.parked || 0} parked`);
  console.log('Dots: ✓ passed · ~ checked under the older gate (asked less) · · open. The owner picks on the Issues page (#/issues).');
  if (!data.issues.length) console.log(`No issues yet. The buyer researcher starts one in ${data.root}/<slug>/ from a Gemini report and templates/ISSUE.md.`);
  const list = [...data.issues].filter((i) => !want || statusOf(i) === want).sort((a, b) => (ISSUE_ORDER[statusOf(a)] ?? 9) - (ISSUE_ORDER[statusOf(b)] ?? 9) || a.slug.localeCompare(b.slug));
  for (const i of list) {
    console.log(`${STATUS_WORD[statusOf(i)].padEnd(9)} ${i.slug.padEnd(20)} ${issueDots(i)}  ${i.quotes ?? 0}q/${i.sites ?? 0}s  ${oneLine(i.title, 64)}`);
    if (statusOf(i) === 'testing') console.log(`${' '.repeat(31)}rounds: ${i.rounds.map((r) => `${r.id}${r.open ? ' (open)' : ''}`).join(', ') || 'none yet: start one with round start --issue ' + i.slug}`);
  }
  if (want && !list.length) console.log(`No ${STATUS_WORD[want]} issues.`);
  if (data.hint) console.log(`\nNote: ${data.hint}`);
  if (data.picks?.error) console.log(`\n! The owner's picks need repair: ${data.picks.error}`);
  for (const p of data.problems) console.log(`! ${p.text}`);
  console.log('\nOne issue: os.mjs issues <slug>');
}
async function roundsData() {
  try { return await request('GET', '/api/rounds'); }
  catch (e) { if (e.status === 404) throw new Error('This OS server has no rounds yet. Restart it after updating.'); throw e; }
}
async function rounds(o) {
  if (o._[0] === 'import') {
    const file = o._[1];
    if (!file) throw new Error('rounds import needs a JSON file with {"rounds": [...]}.');
    const raw = JSON.parse(await readFile(file, 'utf8'));
    const list = (Array.isArray(raw) ? raw : raw.rounds || []).map(({number, startedOn, focus, folders, review, id}) => ({number, startedOn, focus, folders, ...(id ? {id} : {}), ...(review ? {review} : {})}));
    const {revision} = await roundsData();
    const saved = await request('POST', '/api/rounds', {revision, action: 'import', rounds: list});
    const check = await roundsData();
    if (check.revision !== saved.revision || saved.imported.some((id) => !check.rounds.some((r) => r.id === id))) throw new Error('Saved, but readback did not match. Re-read /api/rounds.');
    console.log(`${saved.imported.length} imported (${saved.imported.join(', ') || 'none'}) · ${saved.skipped.length} already saved (${saved.skipped.join(', ') || 'none'}) · rounds revision ${check.revision}`);
    for (const r of check.summary.filter((s) => saved.imported.includes(s.id))) console.log(roundLine(r));
    return;
  }
  const data = await roundsData();
  if (!data.summary.length) { console.log('No rounds yet. Start one where the sales numbers are hitting: round start --focus "..." --folder research/<batch>/'); return; }
  for (const r of [...data.summary].reverse()) console.log(roundLine(r));
  console.log(`\n${data.summary.length} rounds · rounds revision ${data.revision} · page: memory/ROUNDS.md`);
}
async function round(o) {
  const action = o._[0];
  const {revision} = await roundsData();
  let input;
  if (action === 'start') {
    const folders = o.lists.folder || [];
    // --focus is also the to-do focus switch, so its words arrive as plain arguments.
    const focus = typeof o.focus === 'string' ? o.focus : o._.slice(1).join(' ').trim();
    // Owner, Oct 3: a round tests an issue the owner is Testing (--issue <slug>); a focus alone still works.
    if (!focus || !folders.length) throw new Error('round start needs --focus "..." and at least one --folder research/<batch>/, plus --issue <slug> for an issue the owner is Testing (os.mjs issues --status testing).');
    if (!o.issue) console.log('Note: no --issue. Rounds start from an issue the owner is Testing (step 0); see os.mjs issues --status testing.');
    input = {revision, action: 'start', ...(o.issue ? {issue: o.issue} : {}), focus, folders, ...(o.on ? {startedOn: o.on} : {})};
  } else if (action === 'review') {
    const id = o._[1];
    if (!id) throw new Error('round review needs the round id, e.g. round review R04 --worked "..." --failed "..." --next "...".');
    if (!o.worked || !o.failed || !o.next) throw new Error('round review needs --worked, --failed and --next.');
    input = {revision, action: 'review', id, whatWorked: o.worked, whatFailed: o.failed, nextChanges: o.next, ...(o.on ? {reviewedOn: o.on} : {})};
  } else if (action === 'focus') {
    const id = o._[1];
    // --focus is also the to-do focus switch, so its words may arrive as plain arguments.
    const focus = typeof o.focus === 'string' ? o.focus : o._.slice(2).join(' ').trim();
    if (!id || (!focus && !o.issue)) throw new Error('round focus needs the round id and a new --focus and/or --issue, e.g.\n  round focus R05 --issue sleep            (link the issue an open round works from; the owner must be Testing it)\n  round focus R05 --focus "Sleep, energy and focus products"');
    input = {revision, action: 'focus', id, ...(focus ? {focus} : {}), ...(o.issue ? {issue: o.issue} : {})};
  } else throw new Error('Use round start, round review or round focus (and rounds to list them).');
  const saved = await request('POST', '/api/rounds', input);
  const check = await roundsData();
  const r = check.summary.find((s) => s.id === saved.saved);
  if (!r || check.revision !== saved.revision) throw new Error('Saved, but readback did not match. Re-read /api/rounds.');
  if (action === 'focus' && input.issue && r.issue !== String(input.issue).trim().toLowerCase()) throw new Error('Saved, but readback did not show the issue. Re-read /api/rounds.');
  console.log(`${action === 'start' ? 'started' : action === 'focus' ? (input.issue && !input.focus ? 'issue linked to' : 'updated') : 'reviewed'} ${r.id} · rounds revision ${check.revision}`);
  console.log(roundLine(r));
}

const HELP = `Launchroom helper: node .claude/skills/merrivy-os/scripts/os.mjs <command>

Start      status                     the pipeline, handoff, owner notes, to-dos
           doctor                     health check: anything stale, broken or waiting, each with its fix
           step                       the pipeline block, the focus step block and its 3 prompts
           prompts [1-7|buyers|...]   copy-and-paste prompts for a step, plus anytime prompts
           rules                      the starting rules (kill line, loss limit, target cost per sale) and whose they are
           brief [--agent <id>]       the one page to read before a job
Pipeline   pipeline [--all]           every product's own line: round, steps, build slot, owner moves
           product <L###|P###>        one product's line, next move and prompts filled in
           product start <L###>       start the product record from a card the owner saved
           rounds [import <file>]     every round (import adds rounds not saved yet)
           issues [--status ..] [<slug>]  step 0, the issue list: status and I1-I7 dots (one issue: its search list)
           round start --issue <slug> --focus .. --folder research/<batch>/  start the next round from a Testing issue
           round review R## --worked .. --failed .. --next ..  review a finished round
           round focus R## [--focus ".."] [--issue <slug>]     change an open round's focus, or link its issue
Owner said owner-said <save|pass|reject|build|test-issue|park-issue|approve> <L###|P###|issue> --quote "<the owner's exact words>"
                                      the MANAGER only: record a decision the owner gave in chat, with their words (shows as "Said in chat"; the owner can undo it)
To-dos     todo [--all]               the shared Today planner
           add "Title" [--date ..] [--who owner|agent|shared] [--agent <id>] [--next ..] [--step ..] [--product L###|P###] [--focus]
           set <task-id> [flags]      change a task (--status, --next, --log "...", --ref ...)
           done <task-id> [--log ..]  mark a task done after the work is checked
Team       team                       the agent roster and skills
           inbox                      agent tasks waiting for the manager to dispatch
           report <id> --status ..    start, update or finish an Agents-tab report (--product L###|P###)
Memory     note "text"                a note or decision for the diary
           handoff --summary .. --next ..   rewrite the Now page
           diary "one line"           what happened (--agent <id> --task <id>)
           lessons [--for <scope>]    the short rules
           lesson propose|add|set|used ...   (lesson --help: a working example)
           review                     weekly lesson review numbers
Library    library search|list|read|add|note|learn|done|set ...   all our knowledge
Connect    connect [start|check [site..]|open <site|url>]   the agent browser: is it on, which sites are connected; check sign-ins; open a working tab
Schedule   schedule [add <id> --name .. --runs-in .. --when ..|remove <id>]   every job set to run on its own, on Connect
Tools      tools [--step ..] [--group ..]   every outside tool and its link (tools import <file>)
           tool <id>                  one tool's link, sign-in and limits (edit with flags)
Assets     assets [--packet ..] [--needs]   the store page, picture by picture (read-only)
Store      store [--packet ..] [--history]   the owner's Store editor edits to keep, and any publish request

Flags and details: the comment at the top of this file, and .claude/skills/merrivy-os/SKILL.md.
MERRIVY_OS_PORT=<port> points at an isolated test server.`;

async function storeEdits(o) {
  // The Store editor (owner, Oct 2): what the owner changed, so agents build on it and never overwrite it blindly.
  let view;
  try { view = await request('GET', `/api/store-editor${o.packet ? `?packet=${encodeURIComponent(o.packet)}` : ''}`); }
  catch (e) { if (e.status === 404) throw new Error('This OS server has no Store editor yet. Restart it after updating (see SKILL.md "If Launchroom is down").'); throw e; }
  if (!view.packet) { console.log('No product packet in hydrogen-storefront/app/content.'); return; }
  const text = (value) => (value && typeof value === 'object' ? (value.name ? `${value.name} palette` : JSON.stringify(value)) : String(value ?? '')).replace(/\s+/g, ' ').trim().slice(0, 90);
  console.log(`Store editor: ${view.packet.file}${view.packet.active ? ' (in the store)' : ''}${view.packet.status === 'sample' ? ' · demo' : ''}`);
  const mine = view.ownerEdits || [];
  console.log(`\nOwner edits to keep (${mine.length}). Build on them; never overwrite one without asking the owner.`);
  for (const edit of mine) console.log(`  ${edit.section} · ${edit.label}  (${edit.path})\n    "${text(edit.after)}"  · ${edit.at.slice(0, 16).replace('T', ' ')}${edit.kept ? '' : `\n    CHANGED SINCE: now "${text(edit.current)}"; check with the owner`}`);
  if (!mine.length) console.log('  none');
  const p = view.publish || {};
  console.log(`\nPublish: ${p.pending ? `REQUESTED ${p.pending.at.slice(0, 16).replace('T', ' ')} (owner note ${p.pending.noteId}): deploy merrivy.com, then answer that note` : 'no request waiting'} · ${p.changes?.length || 0} change(s) since the last request`);
  if (o.history) for (const save of view.history || []) console.log(`  ${save.at.slice(0, 16).replace('T', ' ')} ${save.by}${save.undoOf ? ' (undo)' : ''}${save.undoneAt ? ' [undone]' : ''}: ${save.changes.map((c) => c.label).join(', ')}`);
  if (view.problems?.length) console.log(`\nStore check notes already open: ${view.problems.length}\n${view.problems.map((p) => `  - ${p.plain}`).join('\n')}`);
}

async function main() {
  const [cmd = 'status', ...rest] = process.argv.slice(2);
  if (['help', '--help', '-h'].includes(cmd)) { console.log(rest[0] === 'lesson' || rest[0] === 'lessons' ? LESSON_HELP : HELP); return; }
  // --help anywhere prints help and changes nothing (the lesson commands have their own page).
  if (rest.some((a) => ['-h', '--help', '-help'].includes(a))) { console.log(['lesson', 'lessons'].includes(cmd) ? LESSON_HELP : HELP); return; }
  const o = parse(rest);
  switch (cmd) {
    case 'status': {
      // First lines: the pipeline (every product's own line), worked out by the OS from saved records.
      try {
        const data = await request('GET', '/api/pipeline');
        const p = data.pipeline;
        const lane = issuesLaneText(await issuesLane());
        console.log(`${pipelineHeader(p)}${lane ? `\n  ${lane}` : ''}\n  ${countsText(p.counts)} · build slot ${p.building ? `${p.building.productId} (${p.building.stepName})` : 'empty'}`);
        console.log(`  Focus: Step ${data.focus.number} of 7 · ${data.focus.name}: ${data.focus.status}. Next: ${data.focus.next}${data.error ? `\n  Step guide problem: ${data.error}` : ''}`);
        console.log('  Rows: os.mjs pipeline · one product: os.mjs product <id>');
      } catch {
        try {
          const {current, error} = await request('GET', '/api/line');
          console.log(`Step ${current.number} of 7 · ${current.name}: ${current.status}. Next: ${current.next}${error ? `\n  Step guide problem: ${error}` : ''}`);
        } catch { console.log('Step: unknown (this OS server has no /api/line yet; restart it after updating).'); }
      }
      const [planner, ws] = await Promise.all([request('GET', '/api/planner'), request('GET', '/api/workspace')]);
      // Hydrogen dev may listen on IPv6 only ([::1]), so try both loopback addresses.
      const probe = (host) => new Promise((r) => {
        const req = http.get({host, port: 3001, path: '/', timeout: 4000}, (res) => { res.resume(); r(`up (${res.statusCode})`); });
        req.on('timeout', () => req.destroy()); req.on('error', () => r(null));
      });
      const store = (await probe('127.0.0.1')) || (await probe('::1')) || 'not running';
      console.log(`OS localhost:${PORT}: up · planner rev ${planner.revision} · workspace rev ${ws.revision}`);
      console.log(`Store localhost:3001: ${store}`);
      const h = ws.handoff || {};
      if (h.nextAction) console.log(`\nHandoff next action (${(h.updatedAt || '').slice(0, 10)}):\n  ${h.nextAction.slice(0, 600)}${h.nextAction.length > 600 ? '…' : ''}`);
      if (h.blockers) console.log(`Blockers: ${h.blockers.slice(0, 300)}`);
      const ownerNotes = (ws.notes || []).filter((n) => n.author === 'owner' && n.status === 'open');
      if (ownerNotes.length) {
        console.log(`\nOpen owner notes (${ownerNotes.length}):`);
        for (const n of ownerNotes.slice(-5)) console.log(`  ${n.id.slice(0, 10)} ${n.text.replace(/\s+/g, ' ').slice(0, 160)}`);
      }
      printInbox(planner.tasks);
      try {
        const {review} = await request('GET', '/api/lessons');
        console.log(`\nLessons: ${review.active} active · ${review.proposed} proposed waiting for your check${review.readyToProve.length ? ` · ${review.readyToProve.length} ready to mark proven` : ''} (run \`brief\` before work, \`review\` weekly)`);
      } catch { /* older server without lessons */ }
      printTasks(planner.tasks, false);
      break;
    }
    case 'inbox':
      printInbox((await request('GET', '/api/planner')).tasks);
      break;
    case 'doctor':
      printDoctor(await doctorReport());
      break;
    case 'step': {
      const {current, line, error, markdown} = await request('GET', '/api/line');
      console.log(markdown.trim());
      const STEP_SKILLS_MAP = {
        product: ['product-discovery', 'kalodata-scraper', 'merrivy-research-workspace'],
        buyers: ['product-verification', 'merrivy-research-workspace'],
        prove: ['product-verification', 'merrivy-research-workspace'],
        create: ['ad-creative-studio', 'merrivy-creative-workspace'],
        build: ['store-builder', 'merrivy-shopify-workspace'],
        launch: ['launch-checklist', 'merrivy-os'],
        learn: ['meta-ads-manager', 'merrivy-os'],
      };
      const enforcedSkills = STEP_SKILLS_MAP[current?.id] || [];
      if (enforcedSkills.length) {
        console.log(`\n## Mandatory Step Skills (Must Read Before Working)\n${enforcedSkills.map((s) => `- .claude/skills/${s}/SKILL.md`).join('\n')}`);
      }
      if (error) console.log(`\nStep guide problem: ${error}`);
      if (line) {
        // The focus product's name, country and card fill the prompts' blanks.
        const item = current.pipeline?.items?.find((i) => i.id === current.focus?.itemId);
        const step = line.steps[current.index];
        const fill = (text) => !item ? text : text.replace(/\[([^\]\n]{1,80})\]/g, (all, key) => { const k = key.trim().toLowerCase(); return k === 'product' && item.name ? item.name : k === 'country' && item.country ? item.country : /^l###/.test(k) && item.leadId ? item.leadId : all; });
        printPrompts({...step, prompts: step.prompts.map((p) => ({...p, text: fill(p.text)}))}, line.anytime, false);
      }
      break;
    }
    case 'pipeline': {
      const [data, lane] = await Promise.all([pipelineData(), issuesLane()]);
      printPipeline(data, o.all, lane);
      break;
    }
    case 'product':
      await product(o);
      break;
    case 'rounds':
      await rounds(o);
      break;
    case 'round':
      await round(o);
      break;
    case 'issues':
      await issues(o);
      break;
    case 'owner-said': {
      // Owner decisions said in chat (owner, Oct 3): the manager records them with the owner's own words.
      // Agents never decide; the server refuses a missing quote and any headless run.
      const [action, target] = o._;
      if (!action || !target) throw new Error('Usage: owner-said <save|pass|reject|build|test-issue|park-issue|approve> <L###|P###|issue> --quote "<the owner\'s exact words>"');
      const out = await request('POST', '/api/owner-said', {action, target, quote: typeof o.quote === 'string' ? o.quote : ''});
      const what = out.decision ? `${out.target} ${out.decision}` : out.build ? `${out.build.productId} is in the build slot${out.build.override ? ' (launched early; the open Prove it checks stay listed on its page)' : ''}` : out.pick ? `${out.target} → ${out.pick.pick || 'no pick'}` : `${out.target} approved for its test`;
      console.log(`Recorded, said in chat: ${what}\n  "${out.quote}"\n  Launchroom labels it "Said in chat"; the owner can undo it on the page.`);
      break;
    }
    case 'rules': {
      // The starting rules (os/data/rules.json): read-only here; the owner changes values on the Settings page.
      let data;
      try { data = await request('GET', '/api/rules'); }
      catch (e) { if (e.status === 404) throw new Error('This OS server has no /api/rules yet. Restart it after updating.'); throw e; }
      console.log(`Starting rules (${data.path}, revision ${data.revision}). owner = the owner's choice; starting = a rule of thumb from the research, never a promise.`);
      for (const group of data.groups) {
        const rules = data.rules.filter((r) => r.group === group.id);
        if (!rules.length) continue;
        console.log(`\n${group.name}`);
        for (const r of rules) console.log(`  ${r.label}: ${r.value}${r.max !== undefined ? `-${r.max}` : ''} ${r.unit}  [${r.by}] ${r.whose}${r.note ? `\n      ${r.note}` : ''}`);
      }
      console.log('\nThese feed the money line (Prove it), the test sheet (Launch) and the kill, trim and scale lines (Learn). Agents never change an owner number.');
      break;
    }
    case 'prompts': {
      const {current, line, error} = await request('GET', '/api/line');
      if (!line) throw new Error(error || 'The step guide is not loaded.');
      const raw = (o._.join(' ') || '').toLowerCase();
      let key = '';
      try { key = raw ? stepValue(raw) : ''; } catch { key = raw; }
      const step = !key ? line.steps[current.index] : line.steps.find((s) => s.id === key || s.name.toLowerCase() === key || String(s.number) === key);
      if (!step) throw new Error(`No step "${raw}". Use 1-7, a name (product, buyers, prove, create, build, launch, learn) or leave it out for the current step.`);
      printPrompts(step, line.anytime, true, step.index === current.index);
      break;
    }
    case 'team': {
      const {team} = await request('GET', '/api/bootstrap');
      if (!team) throw new Error('This OS server does not provide the team roster yet (restart it after updating).');
      if (team.error || team.missing) console.log(team.error || `No roster at ${team.source}.`);
      if (team.manager) console.log(`Manager (main chat): ${team.manager.summary}\n`);
      for (const a of team.agents) {
        console.log(`${a.id.padEnd(17)} ${a.name.padEnd(17)} [${a.role}] ${a.installed ? '' : '(no .claude/agents file) '}${a.summary}`);
        if (a.skills.length) console.log(`${''.padEnd(18)}skills: ${a.skills.join(', ')}${a.missingSkills.length ? ` (missing: ${a.missingSkills.join(', ')})` : ''}`);
      }
      console.log(`\n${team.skills.length} skills found; unused by the team: ${team.skills.filter((s) => !s.usedBy.length).map((s) => s.name).join(', ') || 'none'}`);
      break;
    }
    case 'report': {
      const id = o._[0];
      if (!id) throw new Error(`report needs a stable report ID first. Example:\n  ${REPORT_EXAMPLE}`);
      const {activity} = await request('GET', '/api/activity');
      const previous = activity.find((r) => r.id === id);
      const input = {id, revision: previous?.revision ?? 0, reportedBy: o.by || 'claude'};
      for (const [flag, key] of [['title', 'title'], ['role', 'role'], ['agent', 'agent'], ['status', 'status'], ['summary', 'summary'], ['event', 'event'], ['product', 'product']]) if (o[flag] !== undefined) input[key] = o[flag] === 'none' && flag === 'product' ? '' : o[flag];
      if (o.ref.length) input.references = [...new Set([...(previous?.references || []), ...o.ref])];
      if (!previous) {
        // A new report: the department comes from the agent, the summary from the title.
        if (!input.role) input.role = await roleFor(input.agent);
        if (!input.summary && input.title) input.summary = input.title;
        const missing = [['agent', !input.agent && !input.role], ['status', !input.status], ['title', !input.title], ['role', input.agent && !input.role]].filter(([, gap]) => gap).map(([flag]) => `--${flag}`);
        if (missing.length) throw new Error(`A new report needs ${missing.join(', ')}${missing.includes('--role') ? ` (no department known for "${input.agent}"; add --role manager|validation|image-generator|shopify-builder)` : ''}. Example:\n  ${REPORT_EXAMPLE}`);
      }
      const saved = await request('POST', '/api/activity', input);
      const check = (await request('GET', '/api/activity')).activity.find((r) => r.id === id);
      if (!check || check.revision !== saved.revision) throw new Error('Saved, but readback did not match. Re-read /api/activity.');
      console.log(`report ${id} · ${check.status} · revision ${check.revision}${check.agent ? ` · ${check.agent}` : ''}${check.product ? ` · ${check.product}` : ''}`);
      break;
    }
    case 'todo':
    case 'list':
      printTasks((await request('GET', '/api/planner')).tasks, o.all);
      break;
    case 'add': {
      const title = o.title ?? o._.join(' ');
      if (!title) throw new Error('add needs a title.');
      const t = {status: 'todo', date: localDay(), assignee: 'shared', focus: false, ...taskFields({...o, title}), references: o.ref};
      await savePlanner(t);
      break;
    }
    case 'delete': {
      const planner = await request('GET', '/api/planner');
      const task = findTask(planner.tasks, o._[0]);
      await request('POST', '/api/planner/delete', {revision: planner.revision, ids: [task.id]});
      console.log(`deleted ${short(task.id)}  ${task.title}. Bring it back with: restore ${short(task.id)}`);
      break;
    }
    case 'restore': {
      const planner = await request('GET', '/api/planner');
      const task = findTask(planner.deleted || [], o._[0]);
      await request('POST', '/api/planner/restore', {revision: planner.revision, ids: [task.id]});
      console.log(`restored ${short(task.id)}  ${task.title}`);
      break;
    }
    case 'set':
    case 'done': {
      const {tasks} = await request('GET', '/api/planner');
      const task = findTask(tasks, o._[0]);
      const t = {id: task.id, ...taskFields(o)};
      if (cmd === 'done') t.status = 'done';
      // --log keeps the existing notes and appends a dated line.
      if (o.log) t.notes = [t.notes ?? task.notes, `${localDay()}: ${o.log}`].filter(Boolean).join('\n\n');
      if (o.ref.length) t.references = [...new Set([...(task.references || []), ...o.ref])];
      if (Object.keys(t).length === 1) throw new Error('Nothing to change.');
      await savePlanner(t);
      break;
    }
    case 'note': {
      const text = o._.join(' ');
      if (!text) throw new Error('note needs text.');
      const {revision} = await request('GET', '/api/workspace');
      const input = {revision, text, author: 'agent', day: localDay(), kind: o.kind || 'note', important: Boolean(o.important), references: o.ref};
      if (o.topic) input.topic = o.topic;
      if (o.task) input.taskId = findTask((await request('GET', '/api/planner')).tasks, o.task).id;
      const saved = await request('POST', '/api/workspace/notes', input);
      const note = saved.notes.at(-1);
      console.log(`saved note ${note.id} (${note.kind}${note.important ? ', important' : ''}) · workspace revision ${saved.revision}`);
      break;
    }
    case 'handoff': {
      if (!o.summary || !o.next) throw new Error('handoff needs --summary and --next.');
      const {revision} = await request('GET', '/api/workspace');
      const saved = await request('PATCH', '/api/workspace/handoff', {revision, summary: o.summary, nextAction: o.next, blockers: o.blockers || ''});
      console.log(`saved handoff · workspace revision ${saved.revision}`);
      break;
    }
    case 'brief': {
      const brief = await request('GET', `/api/memory/brief?agent=${encodeURIComponent(o.agent || 'manager')}`);
      console.log(brief.markdown);
      console.log(`(${brief.words} words · Now ${brief.nowWords} words)`);
      break;
    }
    case 'lessons': {
      const {lessons, review} = await request('GET', '/api/lessons');
      const shown = lessons.filter((l) => (o.all || ['trying', 'proven', 'proposed'].includes(l.status)) && (!o.for || l.scope === o.for));
      for (const scope of [...new Set(shown.map((l) => l.scope))]) {
        console.log(`\n${scope}`);
        for (const l of shown.filter((x) => x.scope === scope)) console.log(`  ${l.id} [${l.status.padEnd(8)}] ${l.rule}${l.uses ? `  (used ${l.uses}, helped ${l.helped})` : ''}`);
      }
      console.log(`\n${review.active} active (${review.proven} proven, ${review.trying} trying) · ${review.proposed} proposed waiting`);
      break;
    }
    case 'lesson': {
      const action = String(o._[0] || '').toLowerCase();
      if (!['propose', 'add', 'set', 'used'].includes(action)) throw new Error(`Use lesson propose, add, set or used.\n\n${LESSON_HELP}`);
      const notes = lessonFlags(o, action);
      for (const line of notes) console.error(`note: ${line}`);
      const {revision, lessons} = await request('GET', '/api/lessons');
      const input = {revision};
      if (o.why !== undefined) input.why = o.why;
      if (o.for !== undefined) input.scope = o.for;
      if (o.from !== undefined) input.learnedFrom = o.from;
      if (o.on !== undefined) input.learnedOn = o.on;
      if (o.note !== undefined) input.statusNote = o.note;
      if (o.ref.length) input.references = o.ref;
      if (action === 'propose' || action === 'add') {
        input.rule = (o.rule ?? o._.slice(1).join(' ')).trim();
        const missing = [!input.rule && 'the rule (in quotes right after "lesson propose")', !input.why && '--why "the reason"'].filter(Boolean);
        if (missing.length) throw new Error(`lesson ${action} needs ${missing.join(' and ')}.\n\n${LESSON_HELP}`);
        lessonLengths(input);
        input.scope = input.scope || 'everyone';
        input.status = action === 'propose' ? 'proposed' : o.status || 'trying';
        input.source = o.source || (action === 'propose' ? 'job' : 'review');
        input.proposedBy = o.by || (action === 'propose' ? 'manager' : 'manager');
      } else if (action === 'set' || action === 'used') {
        const wanted = lessonId(o._[1]);
        const lesson = lessons.find((l) => l.id === wanted);
        if (!lesson) throw new Error(`No lesson ${o._[1] || ''}. Use an ID like LS-012 (os.mjs lessons lists them).`);
        input.id = lesson.id;
        if (action === 'used') {
          const helped = String(o.helped ?? '').toLowerCase();
          const yes = ['yes', 'y', 'true', '1'].includes(helped), no = ['no', 'n', 'false', '0'].includes(helped);
          if (!yes && !no) throw new Error(`lesson used needs --helped yes or --helped no, e.g. os.mjs lesson used ${lesson.id} --helped yes --by os-builder`);
          input.use = {helped: yes, by: o.by || 'manager'};
        } else {
          if (o.status !== undefined) input.status = o.status;
          if (o.rule !== undefined) input.rule = o.rule;
          if (o.ref.length) input.references = [...new Set([...(lesson.references || []), ...o.ref])];
        }
      }
      const saved = await request('POST', '/api/lessons', input).catch((e) => { throw new Error(lessonError(e.message)); });
      const l = input.id ? saved.lessons.find((x) => x.id === input.id) : saved.lessons.at(-1);
      console.log(`saved ${l.id} [${l.scope} · ${l.status}] ${l.rule}${l.uses ? ` (used ${l.uses}, helped ${l.helped})` : ''} · lessons revision ${saved.revision}`);
      break;
    }
    case 'diary': {
      const text = o._.join(' ');
      if (!text) throw new Error('diary needs one line: what happened.');
      const {revision} = await request('GET', '/api/workspace');
      const input = {revision, text, author: 'agent', day: localDay(), kind: 'note', topic: o.agent || 'manager', references: o.ref};
      if (o.task) input.taskId = findTask((await request('GET', '/api/planner')).tasks, o.task).id;
      const saved = await request('POST', '/api/workspace/notes', input);
      console.log(`diary ${saved.notes.at(-1).id} · ${o.agent || 'manager'} · workspace revision ${saved.revision}`);
      break;
    }
    case 'review': {
      const {review, lessons} = await request('GET', '/api/lessons');
      const name = (ids) => ids.map((id) => `${id} ${lessons.find((l) => l.id === id)?.rule.slice(0, 70) || ''}`).join('\n    ') || 'none';
      console.log(`Lessons: ${review.active} active (${review.proven} proven, ${review.trying} trying), ${review.proposed} proposed waiting`);
      console.log(`This week: ${review.usedThisWeek} used, ${review.newThisWeek} new, ${review.retiredThisWeek} retired`);
      console.log(`Ready to mark proven (helped twice or more):\n    ${name(review.readyToProve)}`);
      console.log(`Not helping (helped under half the time):\n    ${name(review.notHelping)}`);
      console.log(`Never used after 30 days:\n    ${name(review.unused30)}`);
      break;
    }
    case 'hub':
    case 'hubs':
      await hub(o);
      break;
    case 'library':
      await library(o);
      break;
    case 'tools':
      await tools(o);
      break;
    case 'tool':
      await tool(o);
      break;
    case 'connect':
      await connect(o);
      break;
    case 'schedule':
    case 'schedules':
      await schedule(o);
      break;
    case 'assets':
      await assets(o);
      break;
    case 'store':
      await storeEdits(o);
      break;
    default:
      console.error(`Unknown command "${cmd}".\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
