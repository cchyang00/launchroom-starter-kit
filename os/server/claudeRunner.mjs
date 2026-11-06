// Headless Claude Code runs from Launchroom's Run buttons (owner, Oct 3: "are we
// able to set up headless claude in here? because talking to you directly and
// you spawning agents relies on you and your context").
//
// The owner presses Run on a product, an issue or the Agents tab. The browser
// sends only a reviewed template id and a target; this runner fills the
// template from saved records (server/jobTemplates.mjs), then spawns the
// resolved claude.exe with no shell:
//   claude -p --output-format stream-json --verbose --agent <agent> --model <model>
//          --tools <fixed list> --settings <per-run allow/deny> --permission-mode dontAsk
//          --setting-sources user,project --strict-mcp-config --append-system-prompt <rules>
// with the prompt on stdin and cwd = the workspace root. It parses the stream
// into run events (redacted), persists each run under os/data/runs/claude/,
// runs at most RUN_LIMIT at once and one per target and step, stops the owned
// process tree on Stop or at the template's time limit, and says plainly when
// a run finished without saving its record. A run never passes a check: only
// the saved records do. Who may start or stop a run is decided by the caller
// (`authorizeRun`, launchroom.mjs: the owner's own browser on this computer).
// Tested in server/claudeRunner.test.mjs.
import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {redact} from './runner.mjs';
import {TEMPLATES_PATH, validateTemplates, fillTemplate, standingRules} from './jobTemplates.mjs';
import {createStore} from './store.mjs';
import {targetProblem} from '../src/runsModel.mjs';
export {targetProblem};

export const RUN_LIMIT = 2;
export const RUNS_DIR = 'os/data/runs/claude';
export const SCRATCH_ROOT = 'inbox/runs';
/** The built-in tools a run has at all (--tools); everything else (sub-agents, cron, PowerShell, MCP) is absent. */
export const RUN_TOOLS = ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Bash'];
/** What a run may use without a prompt; anything else is denied (dontAsk). `scratch` is the run's own folder. */
export function allowRules(scratch) {
  return ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebFetch', 'WebSearch',
    'Bash(node .claude/skills/merrivy-os/scripts/os.mjs:*)', `Bash(node ${scratch}/*)`, 'Bash(curl:*)', 'Bash(cd:*)'];
}
/** Never, even if another settings file allowed it: pushing, deploying, package runners, secrets, and the app's own code and records. */
export const DENY_RULES = [
  'Bash(node .claude/skills/merrivy-os/scripts/os.mjs owner-said:*)', 'Bash(git:*)', 'Bash(npx:*)', 'Bash(npm:*)', 'Bash(pnpm:*)', 'Bash(yarn:*)', 'Bash(shopify:*)', 'Bash(gh:*)', 'Bash(claude:*)', 'Bash(codex:*)',
  'Bash(powershell:*)', 'Bash(pwsh:*)', 'Bash(cmd:*)', 'Bash(rm:*)', 'Bash(node -e:*)', 'Bash(node --eval:*)',
  'Read(os/private/**)', 'Read(private/**)', 'Read(**/.env)', 'Read(**/.env.*)', 'Read(~/.claude/**)', 'Read(~/.ssh/**)', 'Read(~/.codex/**)',
  ...['os/**', '.claude/**', 'hydrogen-storefront/**', 'memory/**', 'private/**', 'research/comparison.json', 'AGENTS.md', 'USER.md', 'MEMORY.md']
    .flatMap(rule => [`Write(${rule})`, `Edit(${rule})`]),
];
const STATUSES = ['starting', 'running', 'finished', 'failed', 'stopped', 'timed-out', 'interrupted'];
const LIVE = new Set(['starting', 'running']);
const ID = /^[a-z0-9][a-z0-9-]{2,100}$/;
const TARGET = {product: /^(?:L|P)\d{3,}(?:-[a-z0-9-]{1,80})?$/, issue: /^[a-z0-9][a-z0-9-]{0,60}$/};
const now = () => new Date().toISOString();
const apiError = (status, message, code) => Object.assign(new Error(message), {status, code});
const chicagoDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'}).format(at);
const stamp = (at = new Date()) => `${chicagoDay(at).replace(/-/g, '')}-${new Intl.DateTimeFormat('en-GB', {timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(at).replace(/:/g, '')}`;
const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);

/**
 * The installed claude.exe, never a shell wrapper: LAUNCHROOM_CLAUDE_CLI, the
 * WinGet package, ~/.local/bin, then PATH. Returns an absolute path or null.
 */
export function resolveClaudeCli({env = process.env, platform = process.platform} = {}) {
  const exe = platform === 'win32' ? 'claude.exe' : 'claude';
  const candidates = [];
  if (env.LAUNCHROOM_CLAUDE_CLI) candidates.push(env.LAUNCHROOM_CLAUDE_CLI);
  if (env.LOCALAPPDATA) {
    const packages = path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
    try { for (const name of fs.readdirSync(packages)) if (/^Anthropic\.ClaudeCode/i.test(name)) candidates.push(path.join(packages, name, exe)); } catch { /* No WinGet packages. */ }
  }
  const home = env.USERPROFILE || env.HOME;
  if (home) candidates.push(path.join(home, '.local', 'bin', exe));
  for (const dir of String(env.PATH || '').split(path.delimiter).filter(Boolean)) candidates.push(path.join(dir, exe));
  for (const file of candidates) {
    try { if (path.isAbsolute(file) && fs.statSync(file).isFile()) return fs.realpathSync(file); } catch { /* Next. */ }
  }
  return null;
}

/**
 * The child's environment: the server's, without the desktop app's session
 * plumbing (so the CLI uses its own stored sign-in, the owner's Claude plan)
 * and without API keys that would bill an API account instead.
 */
export function cleanEnv(env = process.env, extra = {}) {
  const next = {};
  for (const [key, value] of Object.entries(env)) {
    if (/^(ANTHROPIC_BASE_URL|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDECODE|CLAUDE_AGENT_SDK_VERSION|CLAUDE_EFFORT|CLAUDE_PID|CLAUDE_PREVIEW_CLASSIFIER_FLOOR)$/i.test(key)) continue;
    if (/^CLAUDE_CODE_/i.test(key) && !/^CLAUDE_CODE_GIT_BASH_PATH$/i.test(key)) continue;
    next[key] = value;
  }
  return {...next, ...extra};
}

/** The fixed argument list for one run (no shell, no free text from the browser). */
export function claudeArgs({template, settingsPath, rules}) {
  return ['-p', '--output-format', 'stream-json', '--verbose',
    ...(template.agent ? ['--agent', template.agent] : []), '--model', template.model,
    '--tools', RUN_TOOLS.join(','), '--settings', settingsPath, '--permission-mode', 'dontAsk',
    '--setting-sources', 'user,project', '--strict-mcp-config', '--append-system-prompt', rules];
}

const clip = (value, max) => { const s = String(value ?? '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
/** One tool call as a short, redacted line: "Read research/x/L126.md", "Bash node .claude/…/os.mjs report …". */
function toolLine(block) {
  const input = block.input || {};
  const what = input.command ?? input.file_path ?? input.path ?? input.url ?? input.query ?? input.pattern ?? '';
  return redact(clip(`${block.name} ${what}`, 220), 240);
}
/**
 * One stream-json line to run events and facts: {events: [{type, text}],
 * session, result}. Unknown lines give nothing. Text is redacted and clipped.
 */
export function parseStreamLine(line) {
  let event; try { event = JSON.parse(line); } catch { return {events: []}; }
  if (!event || typeof event !== 'object') return {events: []};
  if (event.type === 'system' && event.subtype === 'init') return {events: [{type: 'progress', text: `Started: ${event.agent || 'Claude'} on ${clip(event.model, 60)}, ${(event.tools || []).length} tools.`}], session: typeof event.session_id === 'string' ? event.session_id : ''};
  if (event.type === 'system' && event.subtype === 'permission_denied') return {events: [{type: 'denied', text: 'A tool call outside the allowlist was denied.'}]};
  if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
    const events = [];
    for (const block of event.message.content) {
      if (block?.type === 'text' && block.text?.trim()) events.push({type: 'message', text: redact(clip(block.text, 700), 720)});
      else if (block?.type === 'tool_use') events.push({type: 'tool', text: toolLine(block)});
    }
    return {events};
  }
  if (event.type === 'rate_limit_event' && event.rate_limit_info?.status && event.rate_limit_info.status !== 'allowed') return {events: [{type: 'error', text: `Your Claude plan's limit was reached (${clip(event.rate_limit_info.rateLimitType, 40)}).`}]};
  if (event.type === 'result') {
    const denials = Array.isArray(event.permission_denials) ? event.permission_denials.slice(0, 20).map(item => redact(clip(`${item.tool_name} ${item.tool_input?.command ?? item.tool_input?.file_path ?? item.tool_input?.url ?? ''}`, 160), 180)) : [];
    return {events: [], result: {ok: event.subtype === 'success' && !event.is_error, subtype: clip(event.subtype, 40), text: redact(String(event.result ?? ''), 12000), costUsd: Number.isFinite(event.total_cost_usd) ? Math.round(event.total_cost_usd * 10000) / 10000 : null, turns: Number.isInteger(event.num_turns) ? event.num_turns : null, durationMs: Number.isFinite(event.duration_ms) ? event.duration_ms : null, denials}};
  }
  return {events: []};
}

/** Async factory; mount `middleware` for one project's /api/claude routes. */
export async function createClaudeRunner({workspaceRoot, project = '', spawnImpl = spawn, resolveCli = resolveClaudeCli, authorizeRun = () => { throw apiError(403, 'Runs start only from the owner\'s browser on this computer.', 'RUN_NOT_ALLOWED'); }, store = null, limit = RUN_LIMIT, killTree = null, clock = () => new Date(), env = process.env} = {}) {
  if (!workspaceRoot) throw new Error('workspaceRoot is required');
  // The long path, never an 8.3 short name (Claude Code treats C:\\Users\\NAME~1 as a suspicious path and asks, which a headless run can't answer).
  const root = fs.realpathSync.native(workspaceRoot);
  const records = store || createStore({workspaceRoot: root});
  const runs = new Map(), owned = new Map();
  let closed = false;

  // No symlinks or junctions anywhere on an application-data path (the Codex runner's rule).
  function safe(relative) {
    const target = path.resolve(root, relative);
    const rel = path.relative(root, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw apiError(400, 'Path outside workspace', 'UNSAFE_PATH');
    let cursor = root;
    for (const piece of rel.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, piece);
      try { if (fs.lstatSync(cursor).isSymbolicLink()) throw apiError(400, 'Linked application data is not allowed', 'UNSAFE_PATH'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return target;
  }
  for (const dir of ['os', 'os/data', 'os/data/runs', RUNS_DIR]) {
    const target = safe(dir);
    if (!fs.existsSync(target)) fs.mkdirSync(target);
    if (!fs.statSync(target).isDirectory()) throw new Error('Run data path is not a directory');
  }
  function persist(run) {
    const temporary = safe(`${RUNS_DIR}/${run.id}.${randomUUID()}.tmp`);
    fs.writeFileSync(temporary, JSON.stringify(run, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    fs.renameSync(temporary, safe(`${RUNS_DIR}/${run.id}.json`));
  }
  for (const name of fs.readdirSync(safe(RUNS_DIR))) {
    if (!name.endsWith('.json') || name.endsWith('.settings.json') || !ID.test(name.slice(0, -5))) continue;
    try {
      const file = safe(`${RUNS_DIR}/${name}`);
      if (fs.statSync(file).size > 600000) continue;
      const run = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (run.id !== name.slice(0, -5) || !STATUSES.includes(run.status)) continue;
      if (LIVE.has(run.status)) {
        run.status = 'interrupted'; run.finishedAt = now();
        run.error = 'The server restarted while this run was going. Nothing it did is verified; check what it saved before running it again.';
        persist(run);
      }
      runs.set(run.id, run);
    } catch (error) { if (error.status) throw error; /* A broken record never becomes a finished run. */ }
  }

  function templates() {
    const file = safe(TEMPLATES_PATH);
    let value;
    try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw apiError(500, `The job templates file (${TEMPLATES_PATH}) is missing or not JSON.`, 'TEMPLATES_BROKEN'); }
    try { return validateTemplates(value); } catch (error) { throw apiError(500, `The job templates file needs repair: ${error.message}`, 'TEMPLATES_BROKEN'); }
  }
  let probe = null;
  function availability() {
    if (probe && Date.now() - probe.at < 60000) return probe;
    const cli = resolveCli({env});
    probe = {at: Date.now(), cli, available: Boolean(cli), reason: cli ? '' : 'Claude Code is not installed on this computer (claude.exe was not found).'};
    return probe;
  }
  const live = () => [...runs.values()].filter(run => LIVE.has(run.status));
  function addEvent(run, type, text) {
    run.events.push({at: now(), type, text: redact(clip(text, 900), 920)});
    run.events = run.events.slice(-150);
    run.updatedAt = now();
    persist(run);
  }

  async function resolveTarget(template, target) {
    if (template.slot === 'none') {
      if (target) throw apiError(400, 'This job takes no target.', 'INVALID_TARGET');
      return {kind: 'none', id: '', name: '', values: {}};
    }
    if (typeof target !== 'string' || !TARGET[template.slot].test(target)) throw apiError(400, template.slot === 'product' ? 'Name a product such as L126.' : 'Name an issue folder such as teachers.', 'INVALID_TARGET');
    if (template.slot === 'product') {
      let view;
      try { view = await records.getPipelineItem(target); } catch { throw apiError(404, `No card or product ${target} on the pipeline.`, 'NOT_FOUND'); }
      const item = view.item;
      const problem = targetProblem(template, {item});
      if (problem) throw apiError(409, problem, 'RUN_NOT_HERE');
      const folder = view.round?.folders?.[0] || (item.sourcePath ? `${path.posix.dirname(item.sourcePath)}/` : 'research/');
      return {kind: 'product', id: item.id, name: item.name, leadId: item.leadId, values: {'product.id': item.id, 'product.name': item.name, 'product.country': item.country, 'product.step': item.stepName, 'product.status': item.status, 'product.next': item.next, 'round.id': item.roundId, 'round.folder': folder.endsWith('/') ? folder : `${folder}/`}};
    }
    const list = await records.getIssues();
    const issue = (list.entries || list.issues || []).find(row => row.slug === target) || null;
    const problem = targetProblem(template, {issue});
    if (problem) throw apiError(issue ? 409 : 404, problem, issue ? 'RUN_NOT_HERE' : 'NOT_FOUND');
    const open = (issue.checks || []).filter(check => check.state !== 'passed').map(check => `${check.id} ${check.name}`).join(', ') || 'none';
    return {kind: 'issue', id: issue.slug, name: issue.title || issue.slug, values: {'issue.slug': issue.slug, 'issue.title': issue.title || issue.slug, 'issue.status': issue.status, 'issue.open': open}};
  }
  /** What the run should leave saved, read before and after: the card, the issue file, the card and round counts, or nothing. */
  async function fingerprint(saves, target) {
    try {
      if (saves === 'card') { const research = await records.getResearch(); const card = research.candidates.find(item => item.id === target.leadId); if (!card) return ''; const {missingEvidence, ...rest} = card; return hash(JSON.stringify(rest)); }
      if (saves === 'issue') return hash(fs.readFileSync(safe(`resources/issues/${target.id}/ISSUE.md`), 'utf8'));
      if (saves === 'cards') { const research = await records.getResearch(); const rounds = await records.getRounds(); return `${research.candidates.length}:${(rounds.rounds || []).length}`; }
    } catch { /* Unknown stays unknown. */ }
    return '';
  }

  async function start(input = {}, {user = null} = {}) {
    if (closed) throw apiError(503, 'Launchroom is shutting down.', 'RUNNER_CLOSED');
    const keys = Object.keys(input);
    if (keys.some(key => !['templateId', 'target'].includes(key))) throw apiError(400, 'A run takes only a template and a target; no other text.', 'NO_FREE_TEXT');
    const set = templates();
    const template = set.templates.find(item => item.id === input.templateId);
    if (!template) throw apiError(404, 'No such job template.', 'NOT_FOUND');
    if (template.browser === 'required') throw apiError(409, `${template.label} needs a real browser, and headless runs can't reach the built-in browser. Ask Claude in chat for this one.`, 'NEEDS_CHAT');
    const state = availability();
    if (!state.available) throw apiError(503, state.reason, 'CLAUDE_MISSING');
    const target = await resolveTarget(template, input.target || '');
    const key = `${template.step}:${target.id || template.id}`;
    if (live().some(run => run.key === key)) throw apiError(409, `A ${template.step} run is already going for ${target.id || template.label}. Wait for it or stop it.`, 'RUN_BUSY');
    if (live().length >= limit) throw apiError(409, `${limit} runs are going. Wait for one to finish or stop one.`, 'RUN_LIMIT');
    const at = clock();
    const id = `run-${template.id}-${(target.id || 'all').toLowerCase()}-${stamp(at)}`.slice(0, 100).replace(/-+$/, '');
    if (runs.has(id)) throw apiError(409, 'A run with this id was just started. Try again in a second.', 'RUN_BUSY');
    const scratch = `${SCRATCH_ROOT}/${id}`;
    const values = {...target.values, job: id, today: chicagoDay(at), scratch};
    const prompt = fillTemplate(template.prompt, values);
    const rules = standingRules({job: id, scratch, agent: template.agent});
    const run = {id, kind: 'claude', templateId: template.id, label: template.label, agent: template.agent, model: template.model, step: template.step, key,
      target: {kind: target.kind, id: target.id, name: clip(target.name, 160)}, saves: template.saves, browser: template.browser, maxMinutes: template.maxMinutes,
      status: 'starting', outcome: null, startedAt: at.toISOString(), updatedAt: at.toISOString(), finishedAt: null, startedBy: clip(user?.name || user?.username || 'Owner', 60),
      templatesRevision: set.revision, events: [], result: '', error: null, costUsd: null, turns: null, denials: [], session: ''};
    runs.set(id, run);
    persist(run);
    const before = await fingerprint(template.saves, target);
    const settingsPath = safe(`${RUNS_DIR}/${id}.settings.json`);
    fs.writeFileSync(settingsPath, JSON.stringify({permissions: {allow: allowRules(scratch), deny: DENY_RULES}}, null, 2) + '\n', {mode: 0o600});
    let child;
    try {
      child = spawnImpl(availability().cli, claudeArgs({template, settingsPath, rules}), {cwd: root, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: cleanEnv(env, {LAUNCHROOM_RUN_ID: id, ...(project ? {LAUNCHROOM_PROJECT: project} : {})})});
    } catch {
      run.status = 'failed'; run.finishedAt = now(); run.error = 'Claude Code could not be started.'; persist(run); return run;
    }
    run.status = 'running';
    addEvent(run, 'progress', `${run.startedBy} pressed ${template.label}${target.id ? ` for ${target.id}` : ''}. ${template.agent || 'Claude'} on ${template.model}; at most ${template.maxMinutes} minutes.`);
    let settle;
    const job = {run, child, finished: false, stopReason: '', result: null, timer: null, done: new Promise(resolve => { settle = resolve; })};
    owned.set(id, job);
    let buffer = '', overflow = false;
    const ingest = line => {
      if (!line.trim()) return;
      const parsed = parseStreamLine(line);
      if (parsed.session && !run.session) run.session = parsed.session;
      for (const event of parsed.events) addEvent(run, event.type, event.text);
      if (parsed.result) job.result = parsed.result;
    };
    child.stdout?.on('data', chunk => {
      for (const part of chunk.toString().split(/(?<=\n)/)) {
        if (!overflow) buffer += part;
        if (buffer.length > 512000) { buffer = ''; overflow = true; }
        if (part.endsWith('\n')) { if (!overflow) ingest(buffer); buffer = ''; overflow = false; }
      }
    });
    child.stderr?.on('data', () => {}); // Raw diagnostics can carry credentials; never stored.
    const finish = async code => {
      if (job.finished) return;
      job.finished = true; clearTimeout(job.timer); owned.delete(id);
      if (buffer && !overflow) ingest(buffer);
      const result = job.result;
      run.finishedAt = now();
      if (result) { run.result = result.text; run.costUsd = result.costUsd; run.turns = result.turns; run.denials = result.denials; }
      run.status = job.stopReason === 'timeout' ? 'timed-out' : job.stopReason ? 'stopped' : result?.ok && code === 0 ? 'finished' : 'failed';
      const after = await fingerprint(template.saves, target);
      run.outcome = template.saves === 'none' ? 'none' : before && after && before !== after ? 'saved' : 'nothing-saved';
      run.error = run.status === 'finished' ? null : run.status === 'stopped' ? 'Stopped by the owner. Check what it saved before running it again.' : run.status === 'timed-out' ? `Stopped at its ${template.maxMinutes}-minute limit.` : redact(result?.subtype ? `Claude ended with ${result.subtype}.` : `Claude exited${Number.isInteger(code) ? ` with code ${code}` : ''} without a result.`, 400);
      const outcome = run.outcome === 'saved' ? 'its record changed: check it on the page' : run.outcome === 'nothing-saved' ? 'nothing saved' : '';
      addEvent(run, run.status === 'finished' ? 'done' : 'error', `${run.status === 'finished' ? 'Finished' : run.status === 'timed-out' ? 'Timed out' : run.status === 'stopped' ? 'Stopped' : 'Failed'}${outcome ? ` · ${outcome}` : ''}. A run never passes a check by itself.`);
      try { fs.rmSync(settingsPath, {force: true}); } catch { /* The record stays authoritative. */ }
      settle();
    };
    child.once('error', () => { finish(null).catch(() => settle()); });
    child.once('close', code => { finish(code).catch(() => settle()); });
    child.stdin?.on('error', () => {});
    try { child.stdin.end(prompt); } catch { /* The close handler reports the failure. */ }
    job.timer = setTimeout(() => { stop(id, 'timeout').catch(() => {}); }, template.maxMinutes * 60000);
    job.timer.unref?.();
    return run;
  }

  async function stop(id, reason = 'owner') {
    const job = owned.get(id);
    if (!job) throw apiError(409, 'This run is not going in this server.', 'RUN_NOT_LIVE');
    job.stopReason = reason;
    const pid = job.child.pid;
    if (killTree) await killTree(pid, job.child);
    else if (process.platform === 'win32' && spawnImpl === spawn && Number.isInteger(pid)) {
      // Only this run's own process tree; never by name and never a global scan.
      await new Promise(resolve => {
        const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(pid), '/T', '/F'], {shell: false, windowsHide: true, stdio: 'ignore'});
        const timer = setTimeout(() => { try { killer.kill(); } catch {} resolve(); }, 10000);
        killer.once('error', () => { clearTimeout(timer); job.child.kill(); resolve(); });
        killer.once('close', () => { clearTimeout(timer); resolve(); });
      });
    } else job.child.kill();
    if (!job.finished) addEvent(job.run, 'progress', reason === 'timeout' ? `Reached its ${job.run.maxMinutes}-minute limit; stopping it.` : 'Stop pressed; stopping the run.');
    return job.run;
  }

  const publicTemplates = () => templates().templates.map(({prompt, ...rest}) => ({...rest, prompt, needsChat: rest.browser === 'required'}));
  const send = (res, status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.end(JSON.stringify(value)); };
  async function body(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw apiError(415, 'Send JSON.', 'JSON_REQUIRED');
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 4096) throw apiError(413, 'A run request is a template id and a target only.', 'BODY_TOO_LARGE'); chunks.push(chunk); }
    let value; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw apiError(400, 'Invalid JSON.', 'MALFORMED_JSON'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw apiError(400, 'Send a JSON object.', 'MALFORMED_JSON');
    return value;
  }
  // The list the screens poll stays small: the last few events and the start of the result; one run's full record is GET /api/claude/runs/<id>.
  const list = () => [...runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 30).map(run => ({...run, events: run.events.slice(-6), result: clip(run.result, 600)}));
  async function middleware(req, res, next) {
    let pathname; try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { return next?.(); }
    if (pathname !== '/api/claude' && !pathname.startsWith('/api/claude/')) return next?.();
    try {
      if (req.method === 'GET' && pathname === '/api/claude') {
        const state = availability();
        return send(res, 200, {available: state.available, reason: state.reason, limit, live: live().length, templates: publicTemplates(), tools: RUN_TOOLS, allow: allowRules(`${SCRATCH_ROOT}/<run id>`), deny: DENY_RULES, note: 'Runs use your Claude plan.'});
      }
      if (req.method === 'GET' && pathname === '/api/claude/runs') return send(res, 200, {runs: list(), limit, live: live().length});
      if (req.method === 'POST' && pathname === '/api/claude/runs') {
        const user = authorizeRun(req);
        return send(res, 202, {run: await start(await body(req), {user})});
      }
      const match = pathname.match(/^\/api\/claude\/runs\/([a-z0-9-]+)(\/stop)?$/);
      if (match && req.method === 'GET' && !match[2]) { const run = runs.get(match[1]); if (!run) throw apiError(404, 'No such run.', 'NOT_FOUND'); return send(res, 200, {run}); }
      if (match && req.method === 'POST' && match[2]) {
        authorizeRun(req);
        const value = await body(req);
        if (Object.keys(value).length) throw apiError(400, 'Stop takes an empty JSON object.', 'NO_FREE_TEXT');
        if (!runs.has(match[1])) throw apiError(404, 'No such run.', 'NOT_FOUND');
        return send(res, 200, {run: await stop(match[1])});
      }
      throw apiError(405, 'Method not allowed.', 'METHOD');
    } catch (error) {
      if (!res.writableEnded) send(res, error.status || 500, {error: error.status ? error.message : 'The run could not start. Nothing ran.', code: error.code || 'RUN_FAILED'});
    }
  }
  // Shutting down stops this runner's own runs and waits (at most 10 s) for each to save its record.
  async function close() {
    closed = true;
    const jobs = [...owned.values()];
    for (const job of jobs) await stop(job.run.id, 'owner').catch(() => {});
    await Promise.race([Promise.all(jobs.map(job => job.done)), new Promise(resolve => setTimeout(resolve, 10000).unref?.())]);
  }
  return {middleware, start, stop, runs: list, close};
}
