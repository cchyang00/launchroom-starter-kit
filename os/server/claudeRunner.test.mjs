import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough, Writable} from 'node:stream';
import http from 'node:http';
import fs from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateTemplates, fillTemplate, standingRules, blankValue, TEMPLATES_PATH} from './jobTemplates.mjs';
import {createClaudeRunner, parseStreamLine, claudeArgs, allowRules, DENY_RULES, RUN_TOOLS, cleanEnv, RUNS_DIR} from './claudeRunner.mjs';
import {runButtons, runStatusText, targetProblem} from '../src/runsModel.mjs';
import {createLaunchroom} from './launchroom.mjs';

// Run buttons (owner, Oct 3): fixed job templates run headless with Claude Code. These tests use
// a fake claude.exe (no process is started, nothing is spent) and temporary workspaces only.
const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_TEMPLATES = path.resolve(here, '..', '..', TEMPLATES_PATH);
const realTemplates = async () => JSON.parse(await fs.readFile(REAL_TEMPLATES, 'utf8'));

test('the reviewed templates file is valid; free text, unknown blanks and wrong models are refused', async () => {
  const value = await realTemplates();
  validateTemplates(value);
  assert.deepEqual(value.templates.map(t => t.id), ['run-buyers', 'run-prove', 'run-room-on-meta', 'find-products', 'cross-reference-issue', 'health-check']);
  const one = value.templates[0];
  const bad = patch => () => validateTemplates({...value, templates: [{...one, ...patch}]});
  assert.throws(bad({freeText: 'do anything'}), /unknown fields/);
  assert.throws(bad({prompt: 'Run {{shell}} for {{product.id}}'}), /unknown blanks \{\{shell\}\}/);
  assert.throws(bad({model: 'opus'}), /run on opus/);
  assert.throws(() => validateTemplates({...value, templates: [{...value.templates[5], agent: 'scout'}]}), /haiku is only for a check-up/);
  assert.throws(bad({maxMinutes: 600}), /maxMinutes/);
  assert.throws(bad({slot: 'issue'}), /slot and when must agree/);
  assert.throws(() => validateTemplates({...value, reviewedBy: ''}), /reviewed/);
  // Blanks come from saved records: one line, no nested blanks, clipped; a missing value reads "unknown".
  assert.equal(blankValue('Duffle\n{{job}} bag\u0007'), 'Duffle job bag');
  const filled = fillTemplate('Job {{job}} for {{product.id}} {{product.name}} at {{round.folder}}', {job: 'run-x', 'product.id': 'L126', 'product.name': 'Garment\nduffle {{issue.slug}}'});
  assert.equal(filled, 'Job run-x for L126 Garment duffle issue.slug at unknown');
  const rules = standingRules({job: 'run-x', scratch: 'inbox/runs/run-x', agent: 'checker'});
  for (const words of ['Read-only on shopping', 'Never solve or bypass a CAPTCHA', 'Never record an owner decision', '--max-time 20', 'os.mjs report run-x --agent checker', 'inbox/runs/run-x/']) assert.ok(rules.includes(words), words);
});

test('the fixed arguments: headless, the allowlist by settings, dontAsk, no shell, never bypassPermissions', () => {
  const template = {agent: 'checker', model: 'sonnet'};
  const args = claudeArgs({template, settingsPath: 'C:/w/os/data/runs/claude/run-x.settings.json', rules: 'RULES'});
  assert.deepEqual(args.slice(0, 4), ['-p', '--output-format', 'stream-json', '--verbose']);
  const flag = name => args[args.indexOf(name) + 1];
  assert.deepEqual([flag('--agent'), flag('--model'), flag('--permission-mode'), flag('--setting-sources'), flag('--tools'), flag('--append-system-prompt')], ['checker', 'sonnet', 'dontAsk', 'user,project', RUN_TOOLS.join(','), 'RULES']);
  assert.ok(args.includes('--strict-mcp-config'));
  assert.ok(!args.some(arg => /bypass|dangerously|--chrome/i.test(arg)), 'never bypassPermissions or Chrome');
  assert.ok(!claudeArgs({template: {agent: '', model: 'haiku'}, settingsPath: 's', rules: 'r'}).includes('--agent'));
  assert.deepEqual(RUN_TOOLS, ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Bash']);
  assert.deepEqual(allowRules('inbox/runs/run-x'), ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Bash(node .claude/skills/merrivy-os/scripts/os.mjs:*)', 'Bash(node inbox/runs/run-x/*)', 'Bash(curl:*)', 'Bash(cd:*)']);
  for (const rule of ['Bash(node .claude/skills/merrivy-os/scripts/os.mjs owner-said:*)', 'Bash(git:*)', 'Bash(npx:*)', 'Bash(npm:*)', 'Bash(shopify:*)', 'Bash(node -e:*)', 'Read(os/private/**)', 'Read(**/.env)', 'Write(os/**)', 'Edit(.claude/**)', 'Write(hydrogen-storefront/**)', 'Write(research/comparison.json)', 'Edit(AGENTS.md)']) assert.ok(DENY_RULES.includes(rule), rule);
  // The child never inherits the desktop app's session plumbing or an API key: it uses the CLI's own sign-in (the owner's plan).
  const env = cleanEnv({PATH: 'p', ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: 'u', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 's', CLAUDE_CODE_GIT_BASH_PATH: 'g'}, {LAUNCHROOM_RUN_ID: 'run-x'});
  assert.deepEqual(env, {PATH: 'p', CLAUDE_CODE_GIT_BASH_PATH: 'g', LAUNCHROOM_RUN_ID: 'run-x'});
});

const FIXTURE_STREAM = [
  {type: 'system', subtype: 'init', session_id: 'b1c2', model: 'claude-haiku-4-5', tools: ['Read', 'Bash'], agent: 'checker'},
  {type: 'assistant', message: {content: [{type: 'thinking', thinking: ''}, {type: 'text', text: 'Reading the card. token=sk-abcdefghijklmnop123'}]}},
  {type: 'assistant', message: {content: [{type: 'tool_use', name: 'Bash', input: {command: 'node .claude/skills/merrivy-os/scripts/os.mjs product L126'}}]}},
  {type: 'system', subtype: 'permission_denied'},
  {type: 'rate_limit_event', rate_limit_info: {status: 'allowed'}},
  {type: 'result', subtype: 'success', is_error: false, result: 'Saved research/x/prove/L126.md', total_cost_usd: 0.02811, num_turns: 3, duration_ms: 9000, permission_denials: [{tool_name: 'Bash', tool_input: {command: 'git push'}}]},
].map(line => JSON.stringify(line));

test('the stream becomes run events, redacted; the result keeps cost, turns and denials', () => {
  const parsed = FIXTURE_STREAM.map(parseStreamLine);
  assert.equal(parsed[0].session, 'b1c2');
  assert.match(parsed[0].events[0].text, /^Started: checker on claude-haiku-4-5, 2 tools\.$/);
  assert.deepEqual(parsed[1].events.map(e => e.type), ['message']);
  assert.ok(!parsed[1].events[0].text.includes('sk-abcdefghijklmnop123'), 'a key-like string is redacted');
  assert.deepEqual(parsed[2].events, [{type: 'tool', text: 'Bash node .claude/skills/merrivy-os/scripts/os.mjs product L126'}]);
  assert.equal(parsed[3].events[0].type, 'denied');
  assert.deepEqual(parsed[4].events, []);
  assert.deepEqual([parsed[5].result.ok, parsed[5].result.costUsd, parsed[5].result.turns, parsed[5].result.denials], [true, 0.0281, 3, ['Bash git push']]);
  assert.deepEqual(parseStreamLine('not json').events, []);
  assert.equal(parseStreamLine(JSON.stringify({type: 'rate_limit_event', rate_limit_info: {status: 'rejected', rateLimitType: 'five_hour'}})).events[0].type, 'error');
});

/** A fake claude.exe: records its arguments and stdin, and plays a stream when told. */
function fakeSpawn(calls) {
  return (cli, args, options) => {
    const child = new EventEmitter();
    child.pid = 4000 + calls.length;
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    let input = '';
    child.stdin = new Writable({write(chunk, enc, done) { input += chunk; done(); }});
    child.stdin.on('finish', () => { call.prompt = input; });
    child.kill = () => { child.killed = true; setImmediate(() => child.emit('close', null)); };
    const call = {cli, args, options, child, prompt: '', finish: async (lines = FIXTURE_STREAM, code = 0) => { for (const line of lines) child.stdout.write(line + '\n'); await new Promise(r => setImmediate(r)); child.emit('close', code); await new Promise(r => setTimeout(r, 20)); }};
    calls.push(call);
    return child;
  };
}

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-runs-'));
  await fs.mkdir(path.join(root, 'os/data'), {recursive: true});
  await fs.copyFile(REAL_TEMPLATES, path.join(root, TEMPLATES_PATH));
  return root;
}
/** A store stand-in with one product row and one issue, read-only. */
function fakeStore({card = {id: 'L126', screen: {ownerDecision: 'unreviewed'}}} = {}) {
  const line = [{done: 6, total: 6}, {done: 3, total: 3}, {done: 0, total: 7}];
  const item = (id, stepIndex, extra = {}) => ({id, leadId: id, name: `Card ${id}`, country: 'US', stepIndex, stepName: ['Product', 'Buyers', 'Prove it'][stepIndex], status: 'x', next: 'y', who: stepIndex === 0 ? 'owner' : 'checker', line, roundId: 'R09', outcome: null, ...extra});
  const items = {L126: item('L126', 0), L105: item('L105', 2), L099: item('L099', 1, {who: 'buyer-researcher'}), L101: item('L101', 2, {outcome: {label: 'Failed at P1 · Room on Meta'}})};
  const state = {card: structuredClone(card)};
  return {
    state,
    async getPipelineItem(id) { if (!items[id]) throw new Error('missing'); return {item: items[id], round: {folders: ['research/2026-10-03-tiktok-public/']}}; },
    async getIssues() { return {issues: [{slug: 'teachers', title: 'Teachers', status: 'candidate', checks: [{id: 'I6', name: 'Wants to buy', state: 'open'}]}, {slug: 'sleep', title: 'Sleep', status: 'testing', checks: []}]}; },
    async getResearch() { return {candidates: [state.card]}; },
    async getRounds() { return {rounds: []}; },
  };
}

test('a run fills its template from saved records, streams events, persists, and says when nothing was saved', async t => {
  const root = await workspace(t);
  const calls = [], store = fakeStore();
  const runner = await createClaudeRunner({workspaceRoot: root, spawnImpl: fakeSpawn(calls), resolveCli: () => 'C:/fake/claude.exe', store, killTree: async (pid, child) => { child.kill(); }});
  t.after(async () => { await runner.close(); await fs.rm(root, {recursive: true, force: true}); });
  const run = await runner.start({templateId: 'run-prove', target: 'L105'}, {user: {name: 'Owner'}});
  assert.equal(run.status, 'running');
  assert.match(run.id, /^run-run-prove-l105-\d{8}-\d{6}$/);
  const call = calls[0];
  assert.equal(call.cli, 'C:/fake/claude.exe');
  assert.equal(call.options.shell, false);
  assert.equal(call.options.cwd, realpathSync.native(root), 'the long path, never an 8.3 short name');
  assert.doesNotMatch(call.options.cwd, /~\d/);
  assert.equal(call.options.env.LAUNCHROOM_RUN_ID, run.id);
  await new Promise(r => setTimeout(r, 10));
  assert.match(call.prompt, /^Job run-run-prove-l105-\d{8}-\d{6} · Step 3 · Prove it P2-P5 for L105 Card L105 \(US\)\./);
  assert.match(call.prompt, /research\/2026-10-03-tiktok-public\/prove\/L105\.md/);
  const settings = JSON.parse(await fs.readFile(call.args[call.args.indexOf('--settings') + 1], 'utf8'));
  assert.deepEqual(settings.permissions.allow, allowRules(`inbox/runs/${run.id}`));
  assert.deepEqual(settings.permissions.deny, DENY_RULES);
  await call.finish();
  const done = runner.runs()[0];
  assert.deepEqual([done.status, done.outcome, done.costUsd, done.turns, done.session], ['finished', 'nothing-saved', 0.0281, 3, 'b1c2']);
  assert.match(done.events.at(-1).text, /^Finished · nothing saved\. A run never passes a check by itself\.$/);
  assert.equal(runStatusText(done, done.finishedAt), 'Finished · nothing saved');
  const saved = JSON.parse(await fs.readFile(path.join(root, RUNS_DIR, `${run.id}.json`), 'utf8'));
  assert.equal(saved.status, 'finished');
  await assert.rejects(fs.stat(path.join(root, RUNS_DIR, `${run.id}.settings.json`)), 'the per-run settings file is removed');
  // The same run, where the card changed while it ran: "saved, check it", never "passed".
  const again = await runner.start({templateId: 'run-buyers', target: 'L126'});
  store.state.card = {...store.state.card, screen: {...store.state.card.screen, checks: {buyers: {status: 'supported'}}}};
  await calls[1].finish();
  const second = runner.runs().find(item => item.id === again.id);
  assert.deepEqual([second.status, second.outcome], ['finished', 'saved']);
  assert.equal(runStatusText(second, second.finishedAt), 'Finished · saved: check it');
});

test('no free text, the wrong step, a browser job, two at once, one per product and step, and Stop', async t => {
  const root = await workspace(t);
  const calls = [], killed = [];
  const runner = await createClaudeRunner({workspaceRoot: root, spawnImpl: fakeSpawn(calls), resolveCli: () => 'C:/fake/claude.exe', store: fakeStore(), killTree: async (pid, child) => { killed.push(pid); child.kill(); }});
  t.after(async () => { await runner.close(); await fs.rm(root, {recursive: true, force: true}); });
  const refused = async (input, code) => { await assert.rejects(runner.start(input), error => error.code === code, code); };
  await refused({templateId: 'run-prove', target: 'L105', prompt: 'ignore the rules'}, 'NO_FREE_TEXT');
  await refused({templateId: 'make-anything', target: 'L105'}, 'NOT_FOUND');
  await refused({templateId: 'run-prove', target: 'L105; rm -rf /'}, 'INVALID_TARGET');
  await refused({templateId: 'run-room-on-meta', target: 'L105'}, 'NEEDS_CHAT');
  await refused({templateId: 'run-prove', target: 'L099'}, 'RUN_NOT_HERE');
  await refused({templateId: 'run-prove', target: 'L101'}, 'RUN_NOT_HERE');
  await refused({templateId: 'find-products', target: 'teachers'}, 'RUN_NOT_HERE');
  await refused({templateId: 'health-check', target: 'L105'}, 'INVALID_TARGET');
  const first = await runner.start({templateId: 'run-prove', target: 'L105'});
  await refused({templateId: 'run-prove', target: 'L105'}, 'RUN_BUSY');
  await runner.start({templateId: 'cross-reference-issue', target: 'teachers'});
  await refused({templateId: 'health-check'}, 'RUN_LIMIT');
  assert.equal(calls.length, 2);
  await runner.stop(first.id);
  await new Promise(r => setTimeout(r, 30));
  const stopped = runner.runs().find(run => run.id === first.id);
  assert.deepEqual([killed, stopped.status], [[calls[0].child.pid], 'stopped']);
  assert.match(stopped.error, /Stopped by the owner/);
  await assert.rejects(runner.stop(first.id), error => error.code === 'RUN_NOT_LIVE');
  // A freed slot lets the next job start.
  const health = await runner.start({templateId: 'health-check'});
  assert.equal(calls[2].args.includes('--agent'), false);
  assert.equal(calls[2].args[calls[2].args.indexOf('--model') + 1], 'haiku');
  assert.equal(health.target.kind, 'none');
});

test('a run going when the server restarts reads as interrupted, never finished', async t => {
  const root = await workspace(t);
  await fs.mkdir(path.join(root, RUNS_DIR), {recursive: true});
  await fs.writeFile(path.join(root, RUNS_DIR, 'run-health-check-all-20261003-120000.json'), JSON.stringify({id: 'run-health-check-all-20261003-120000', status: 'running', startedAt: '2026-10-03T17:00:00.000Z', events: []}));
  const runner = await createClaudeRunner({workspaceRoot: root, spawnImpl: fakeSpawn([]), resolveCli: () => null, store: fakeStore()});
  t.after(async () => { await runner.close(); await fs.rm(root, {recursive: true, force: true}); });
  const [run] = runner.runs();
  assert.deepEqual([run.status, Boolean(run.finishedAt)], ['interrupted', true]);
  await assert.rejects(runner.start({templateId: 'health-check'}), error => error.code === 'CLAUDE_MISSING');
});

test('Run buttons show what fits each product and issue, and why the others are off', async () => {
  const value = await realTemplates();
  const claude = {available: true, limit: 2, templates: value.templates.map(t => ({...t, needsChat: t.browser === 'required'}))};
  const line = [{done: 6, total: 6}, {done: 3, total: 3}, {done: 0, total: 7}];
  const prove = {id: 'L105', stepIndex: 2, stepName: 'Prove it', who: 'checker', line, outcome: null};
  assert.deepEqual(runButtons({claude, item: prove}).map(b => [b.template.id, b.state]), [['run-prove', 'ready'], ['run-room-on-meta', 'chat']]);
  const waiting = {id: 'L126', stepIndex: 0, stepName: 'Product', who: 'owner', line, outcome: null};
  assert.deepEqual(runButtons({claude, item: waiting}).map(b => b.template.id), ['run-buyers', 'run-prove', 'run-room-on-meta'], 'researched ahead before the Save');
  assert.deepEqual(runButtons({claude, item: {...prove, outcome: {label: 'Failed at P1'}}}), []);
  assert.deepEqual(runButtons({claude, issue: {slug: 'teachers', status: 'candidate'}}).map(b => b.template.id), ['cross-reference-issue']);
  assert.deepEqual(runButtons({claude, issue: {slug: 'sleep', status: 'testing'}}).map(b => b.template.id), ['find-products', 'cross-reference-issue']);
  assert.deepEqual(runButtons({claude}).map(b => b.template.id), ['health-check']);
  const live = [{id: 'r1', status: 'running', templateId: 'run-prove', target: {id: 'L105'}, key: 'prove:L105'}, {id: 'r2', status: 'running', templateId: 'run-buyers', target: {id: 'L126'}, key: 'buyers:L126'}];
  assert.deepEqual(runButtons({claude, runs: live, item: prove}).map(b => b.state), ['running', 'chat']);
  assert.deepEqual(runButtons({claude, runs: live}).map(b => b.state), ['full']);
  assert.deepEqual(runButtons({claude: {...claude, available: false, reason: 'not installed'}, item: prove}).map(b => b.state), ['off', 'chat']);
  assert.match(targetProblem({slot: 'issue', when: 'issue-pickable'}, {issue: {slug: 'x', status: 'parked'}}), /parked/);
});

const password = () => `fixture-${randomBytes(18).toString('base64url')}`;
async function gateway(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gateway-'));
  await fs.mkdir(path.join(root, 'os/data'), {recursive: true});
  await fs.copyFile(REAL_TEMPLATES, path.join(root, TEMPLATES_PATH));
  const calls = [];
  const launchroom = await createLaunchroom({workspaceRoot: root, port: 3000, claude: {spawnImpl: fakeSpawn(calls), resolveCli: () => 'C:/fake/claude.exe', killTree: async (pid, child) => child.kill()}});
  const server = http.createServer((req, res) => { Promise.resolve(launchroom(req, res, () => { res.writeHead(404); res.end('{}'); })).catch(() => { res.writeHead(500); res.end(); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await launchroom.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); await fs.rm(root, {recursive: true, force: true}); });
  const request = (route, {method = 'GET', cookie, json, headers = {}, browser = true} = {}) => new Promise((resolve, reject) => {
    const data = json === undefined ? undefined : JSON.stringify(json);
    const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, agent: false, headers: {Host: 'localhost:3000', ...(browser ? {'Sec-Fetch-Site': 'same-origin'} : {}), ...(method !== 'GET' ? {Origin: 'http://localhost:3000'} : {}), ...(cookie ? {Cookie: cookie} : {}), ...(data ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)} : {}), ...headers}}, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => { let body = null; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {} resolve({status: res.statusCode, body, headers: res.headers}); });
    });
    req.setTimeout(15000, () => req.destroy(new Error('timeout'))); req.once('error', reject); req.end(data);
  });
  const cookieOf = response => response.headers['set-cookie']?.[0]?.split(';')[0];
  const admin = await request('/api/launchroom/setup', {method: 'POST', json: {name: 'Fixture Owner', username: 'fixture-owner', password: password()}});
  const ownerCookie = cookieOf(admin);
  const invite = await request('/api/launchroom/invites', {method: 'POST', cookie: ownerCookie, json: {name: 'Fixture Brother', username: 'fixture-brother', role: 'member'}});
  const secret = password();
  await request('/api/launchroom/accept-invite', {method: 'POST', json: {token: invite.body.token, password: secret}});
  const login = await request('/api/launchroom/login', {method: 'POST', json: {username: 'fixture-brother', password: secret}});
  return {request, ownerCookie, memberCookie: cookieOf(login), memberId: login.body.user.id, calls};
}

test('only the owner\'s own browser on this computer starts runs: agents, shared members and cross-site requests cannot', async t => {
  const g = await gateway(t);
  const body = {templateId: 'health-check'};
  const agent = await g.request('/p/merrivy/api/claude/runs', {method: 'POST', json: body, browser: false, headers: {'x-launchroom-local-agent': '1'}});
  assert.deepEqual([agent.status, agent.body.code], [403, 'AGENT_RUN_REFUSED']);
  const agentCodex = await g.request('/api/runs', {method: 'POST', json: {jobId: 'x'}, browser: false, headers: {'x-launchroom-local-agent': '1'}});
  assert.deepEqual([agentCodex.status, agentCodex.body.code], [403, 'AGENT_RUN_REFUSED'], 'no recursion through the old Codex runner either');
  const agentClaude = await g.request('/api/claude/runs', {method: 'POST', json: body, browser: false, headers: {'x-launchroom-local-agent': '1'}});
  assert.equal(agentClaude.status, 403);
  const crossSite = await g.request('/p/merrivy/api/claude/runs', {method: 'POST', cookie: g.ownerCookie, json: body, headers: {'Sec-Fetch-Site': 'same-site'}});
  assert.deepEqual([crossSite.status, crossSite.body.code], [403, 'REMOTE_RUN_REFUSED']);
  const signedOut = await g.request('/p/merrivy/api/claude/runs', {method: 'POST', json: body});
  assert.equal(signedOut.status, 401);
  // The brother's shared access: he can watch, never start.
  const share = await g.request('/api/launchroom/projects/merrivy/members', {method: 'POST', cookie: g.ownerCookie, json: {userIds: [g.memberId]}});
  assert.equal(share.status, 200, JSON.stringify(share.body));
  const member = await g.request('/p/merrivy/api/claude/runs', {method: 'POST', cookie: g.memberCookie, json: body});
  assert.deepEqual([member.status, member.body.code], [403, 'OWNER_ONLY']);
  assert.equal((await g.request('/p/merrivy/api/claude/runs', {cookie: g.memberCookie})).status, 200);
  assert.equal(g.calls.length, 0, 'nothing started');
  // The owner, in the browser on this computer.
  const owner = await g.request('/p/merrivy/api/claude/runs', {method: 'POST', cookie: g.ownerCookie, json: body});
  assert.equal(owner.status, 202, JSON.stringify(owner.body));
  assert.equal(g.calls.length, 1);
  assert.deepEqual([g.calls[0].options.env.LAUNCHROOM_PROJECT, g.calls[0].options.env.LAUNCHROOM_RUN_ID], ['merrivy', owner.body.run.id], 'the helper calls of a run stay in its own project');
  const free = await g.request('/p/merrivy/api/claude/runs', {method: 'POST', cookie: g.ownerCookie, json: {templateId: 'health-check', prompt: 'do something else'}});
  assert.deepEqual([free.status, free.body.code], [400, 'NO_FREE_TEXT']);
  const memberStop = await g.request(`/p/merrivy/api/claude/runs/${owner.body.run.id}/stop`, {method: 'POST', cookie: g.memberCookie, json: {}});
  assert.equal(memberStop.status, 403);
  const stop = await g.request(`/p/merrivy/api/claude/runs/${owner.body.run.id}/stop`, {method: 'POST', cookie: g.ownerCookie, json: {}});
  assert.equal(stop.status, 200);
  const view = await g.request('/p/merrivy/api/claude', {cookie: g.ownerCookie});
  assert.deepEqual([view.body.available, view.body.limit, view.body.note], [true, 2, 'Runs use your Claude plan.']);
  assert.ok(view.body.deny.includes('Bash(git:*)'));
});
