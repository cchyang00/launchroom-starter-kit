import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRunner } from './runner.mjs';
import { createStore } from './store.mjs';
import { withWorkspaceLock } from './workspace.mjs';

const job = {id: 'job-one', status: 'prepared', role: 'validation', brief: 'Read-only local test', prompt: 'Assess the recorded scope.', productId: null, marketId: null};
const cycleReview = (state, product) => ({revision: state.revision, productRevision: product.revision, productId: product.id, outcome: 'stopped', whatWorked: 'Identity recorded.', whatFailed: 'Quote absent.', nextChanges: 'Require a quote.', evidence: [`products/${product.id}/OS.md`]});
async function fixture(t, {jobs = [job], records = [], authenticated = true, spawnError = false} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'merrivy-runner-test-'));
  mkdirSync(path.join(root, 'os/data/runs'), {recursive: true});
  writeFileSync(path.join(root, 'os/data/jobs.json'), JSON.stringify({jobs}));
  for (const run of records) writeFileSync(path.join(root, `os/data/runs/${run.id}.json`), JSON.stringify(run));
  const calls = [], children = [];
  function fakeSpawn(executable, args, options) {
    calls.push({executable, args, options});
    if (args[0] === 'exec' && spawnError) throw new Error('secret credentials do not leak');
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.prompt = ''; child.stdin.on('data', chunk => { child.prompt += chunk; });
    child.kill = () => { child.killed = true; queueMicrotask(() => child.emit('close', null)); return true; };
    if (args[0] === 'login') queueMicrotask(() => { child.stderr.write(authenticated ? 'Logged in using ChatGPT' : 'Not logged in'); child.emit('close', authenticated ? 0 : 1); });
    else { child.args = args; children.push(child); }
    return child;
  }
  const runner = await createRunner({workspaceRoot: root, port: 3000, spawnImpl: fakeSpawn, resolveCli: async () => ({executable: '/verified/codex.exe', args: []})});
  const server = createServer((req, res) => runner.middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await runner.close(); await new Promise(resolve => server.close(resolve)); rmSync(root, {recursive: true, force: true}); });
  const url = `http://127.0.0.1:${server.address().port}`;
  async function request(route, {method = 'GET', body, headers = {}} = {}) {
    return new Promise((resolve, reject) => {
      const request = httpRequest(url + route, {method, headers: {host: 'localhost:3000', ...(body !== undefined ? {'content-type': 'application/json'} : {}), ...headers}}, response => {
        let text = ''; response.on('data', chunk => { text += chunk; });
        response.on('end', () => resolve({status: response.statusCode, value: JSON.parse(text)}));
      });
      request.on('error', reject);
      request.end(body !== undefined ? typeof body === 'string' ? body : JSON.stringify(body) : undefined);
    });
  }
  function complete(child, {code = 0, result = 'Recorded findings ready for review.'} = {}) {
    if (result !== null) writeFileSync(child.args[child.args.indexOf('-o') + 1], result);
    child.emit('close', code);
  }
  return {root, request, calls, children, complete, runner};
}

test('launch uses shell:false, stdin and fixed scope; concurrent and duplicate starts are refused', async t => {
  const f = await fixture(t);
  const attempts = await Promise.all([f.request('/api/runs', {method: 'POST', body: {jobId: job.id}}), f.request('/api/runs', {method: 'POST', body: {jobId: job.id}})]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [202, 409]);
  assert.equal(f.children.length, 1);
  const child = f.children[0], call = f.calls.find(call => call.args[0] === 'exec');
  assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true);
  assert.equal(call.args.includes(job.prompt), false);
  assert.equal(call.args[call.args.indexOf('-s') + 1], 'workspace-write');
  assert.equal(call.args.some(arg => /bypass|dangerously/.test(arg)), false);
  assert.match(child.prompt, /agents\/validation\/AGENTS.md/);
  assert.match(child.prompt, /Do not publish, deploy/);
  f.complete(child);
  const all = await f.request('/api/runs');
  assert.equal(all.value.runs[0].status, 'completed');
  assert.match(all.value.runs[0].events.at(-1).text, /human review/);
  assert.equal(JSON.parse(readFileSync(path.join(f.root, 'os/data/jobs.json'))).jobs[0].status, 'prepared');
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}})).status, 409);
});

test('product cycle cannot archive during a running CLI job and archived jobs cannot retry', async t => {
  const f = await fixture(t); const store = createStore({workspaceRoot: f.root});
  const product = await store.createProduct({name: 'Isolated runner candidate', country: 'Canada'});
  writeFileSync(path.join(f.root, 'os/data/jobs.json'), JSON.stringify([{...job, productId: product.id}]));
  const started = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  assert.equal(started.status, 202);
  const state = await store.getWorkspace();
  await assert.rejects(store.reviewWorkspaceCycle(cycleReview(state, product)), error => error.code === 'PRODUCT_RUN_ACTIVE');
  assert.equal((await store.getWorkspace()).reviews.length, 0);
  f.complete(f.children[0], {code: 1, result: 'Partial findings.'});
  await store.reviewWorkspaceCycle(cycleReview(state, product));
  const retry = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  assert.equal(retry.status, 409); assert.match(retry.value.error, /archived/); assert.equal(f.children.length, 1);
});

test('queued CLI startup rereads archive state after the shared mutation lock releases', async t => {
  const f = await fixture(t); const store = createStore({workspaceRoot: f.root});
  const product = await store.createProduct({name: 'Queued isolated candidate', country: 'Canada'});
  writeFileSync(path.join(f.root, 'os/data/jobs.json'), JSON.stringify([{...job, productId: product.id}]));
  const state = await store.getWorkspace();
  let release; let entered;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const hold = withWorkspaceLock(f.root, async () => { entered(); await new Promise(resolve => { release = resolve; }); });
  await enteredPromise;
  const archive = store.reviewWorkspaceCycle(cycleReview(state, product));
  const launch = f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  release(); await hold; await archive;
  assert.equal((await launch).status, 409); assert.equal(f.children.length, 0);
});

test('exit zero without final output fails; failed job can retry and nonzero cannot become success', async t => {
  const f = await fixture(t);
  let response = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  f.complete(f.children[0], {result: null});
  let detail = await f.request(`/api/runs/${response.value.run.id}`);
  assert.equal(detail.value.run.status, 'failed');
  response = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  assert.equal(response.status, 202);
  f.complete(f.children[1], {code: 1, result: 'Partial artifact only'});
  detail = await f.request(`/api/runs/${response.value.run.id}`);
  assert.equal(detail.value.run.status, 'failed');
  assert.equal(detail.value.run.result, 'Partial artifact only');
});

test('restart marks prior running record interrupted and saves it', async t => {
  const previous = {id: 'previous-run', jobId: job.id, status: 'running', startedAt: '2026-09-15T00:00:00Z', events: [], result: ''};
  const f = await fixture(t, {records: [previous]});
  const detail = await f.request('/api/runs/previous-run');
  assert.equal(detail.value.run.status, 'interrupted');
  assert.match(detail.value.run.error, /restarted/);
  assert.equal(JSON.parse(readFileSync(path.join(f.root, 'os/data/runs/previous-run.json'))).status, 'interrupted');
});

test('progress ignores tool payloads, redacts messages and output, and is bounded', async t => {
  const f = await fixture(t);
  const response = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  const child = f.children[0];
  child.stdout.write(JSON.stringify({type: 'thread.started', thread_id: 'thread-safe'}) + '\n');
  child.stdout.write(JSON.stringify({type: 'item.completed', item: {type: 'command_execution', command: 'NEVER_EXPOSE_RAW_COMMAND', aggregated_output: 'secret raw tool response'}}) + '\n');
  for (let i = 0; i < 100; i++) child.stdout.write(JSON.stringify({type: 'item.completed', item: {type: 'agent_message', text: 'Progress sk-testsecretcredential123456789'}}) + '\n');
  f.complete(child, {result: 'Finding\nAuthorization: Bearer supersecret123\nNext step: review.'});
  const detail = (await f.request(`/api/runs/${response.value.run.id}`)).value.run;
  assert.ok(detail.events.length <= 80); assert.equal(detail.threadId, 'thread-safe');
  assert.doesNotMatch(JSON.stringify(detail), /supersecret|testsecretcredential|NEVER_EXPOSE_RAW/);
  assert.match(detail.result, /redacted/);
  assert.doesNotMatch(readFileSync(child.args[child.args.indexOf('-o') + 1], 'utf8'), /supersecret/);
});

test('owned stop interrupts the active process and cannot stop historical records', async t => {
  const f = await fixture(t);
  const response = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  const route = `/api/runs/${response.value.run.id}/stop`;
  assert.equal((await f.request(route, {method: 'POST', body: {}})).status, 200);
  assert.equal(f.children[0].killed, true);
  assert.equal((await f.request(`/api/runs/${response.value.run.id}`)).value.run.status, 'interrupted');
  assert.equal((await f.request(route, {method: 'POST', body: {}})).status, 409);
});

test('host/origin/content/body checks reject remote and freeform execution inputs', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/runtime', {headers: {host: 'evil.test:3000'}})).status, 403);
  assert.equal((await f.request('/api/runtime', {headers: {origin: 'https://evil.test'}})).status, 403);
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}, headers: {'content-type': 'text/plain'}})).status, 415);
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: job.id, prompt: 'unapproved'}})).status, 400);
  assert.equal((await f.request('/api/runs', {method: 'POST', body: '{invalid'})).status, 400);
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: 'a'.repeat(10000)}})).status, 413);
  assert.equal(f.children.length, 0);
});

test('unregistered role and poisoned status cannot launch', async t => {
  const f = await fixture(t, {jobs: [{...job, role: '../../malicious'}, {...job, id: 'bad-status', status: 'approved'}]});
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}})).status, 409);
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: 'bad-status'}})).status, 409);
  assert.equal(f.children.length, 0);
});

test('product-independent manager and Shopify prepared jobs launch without product or market IDs', async t => {
  const {productId, marketId, ...independent} = job;
  const f = await fixture(t, {jobs: [{...independent, id: 'manager-independent', role: 'manager'}, {...independent, id: 'shopify-independent', role: 'shopify-builder'}]});
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: 'manager-independent'}})).status, 202);
  assert.match(f.children[0].prompt, /Product: none\nMarket: none/);
  f.complete(f.children[0]);
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: 'shopify-independent'}})).status, 202);
  assert.match(f.children[1].prompt, /agents\/shopify-builder\/AGENTS.md/);
  f.complete(f.children[1]);
});

test('authentication failure stays explicit; read-only login probe is cached', async t => {
  const f = await fixture(t, {authenticated: false});
  const runtime = (await f.request('/api/runtime')).value;
  assert.equal(runtime.available, true); assert.equal(runtime.authenticated, false);
  assert.match(runtime.detail, /not wired/);
  assert.equal((await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}})).status, 503);
  assert.equal(f.calls.length, 1); assert.equal(f.children.length, 0);
});

test('synchronous spawn failure is a persisted failed run, not completion', async t => {
  const f = await fixture(t, {spawnError: true});
  const response = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  assert.equal(response.value.run.status, 'failed');
  assert.doesNotMatch(JSON.stringify(response), /credentials/);
});

test('reported provider error defeats exit zero and remains actionable', async t => {
  const f = await fixture(t);
  const response = await f.request('/api/runs', {method: 'POST', body: {jobId: job.id}});
  f.children[0].stdout.write(JSON.stringify({type: 'turn.failed', error: {message: 'Configured model requires a newer version of Codex.'}}) + '\n');
  f.complete(f.children[0]);
  const run = (await f.request(`/api/runs/${response.value.run.id}`)).value.run;
  assert.equal(run.status, 'failed'); assert.match(run.error, /newer version/);
});

test('symlinked application data cannot escape workspace', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'merrivy-link-test-'));
  const outside = mkdtempSync(path.join(tmpdir(), 'merrivy-link-outside-'));
  mkdirSync(path.join(root, 'os'));
  t.after(() => { rmSync(root, {recursive: true, force: true}); rmSync(outside, {recursive: true, force: true}); });
  symlinkSync(outside, path.join(root, 'os/data'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createRunner({workspaceRoot: root}), /Linked application data/);
});
