import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { createScripts } from './scripts.mjs';

async function fixture(t, options = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-scripts-')));
  const write = async (relative, text = '') => { const name = path.join(root, relative); await fs.mkdir(path.dirname(name), { recursive: true }); await fs.writeFile(name, text); return name; };
  await write('os/server/domain.test.mjs', '// fixture; never executed');
  await write('os/server/hub.test.mjs', '// fixture; never executed');
  await write('os/server/arbitrary.test.mjs', '// not allowlisted');
  await write('os/node_modules/vite/bin/vite.js', '// fixture; never executed');
  const children = [], calls = [];
  const spawnImpl = (...args) => {
    calls.push(args);
    if (options.throwSpawn) throw new Error('private implementation error');
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.killed = false;
    child.kill = () => { child.killed = true; return true; };
    children.push(child); return child;
  };
  let app;
  const server = http.createServer((req, res) => app.middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; const origin = `http://127.0.0.1:${port}`;
  app = await createScripts({ workspaceRoot: root, port, spawnImpl });
  t.after(async () => { await app.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const request = async (route = '/api/scripts', method = 'GET', value, headers = {}) => {
    const response = await fetch(`${origin}${route}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: value === undefined ? undefined : JSON.stringify(value) });
    return { status: response.status, body: await response.json() };
  };
  return { root, app, request, children, calls, write, restart: async () => { await app.close(); app = await createScripts({ workspaceRoot: root, port, spawnImpl }); } };
}

test('fixed script inventory and verification command use concrete allowlisted test paths without shell', async t => {
  const f = await fixture(t);
  const inventory = await f.request();
  assert.deepEqual(inventory.body.scripts.map(s => s.id), ['verify-app', 'build-app']);
  assert.equal(inventory.body.history, 'runtime-only'); assert.deepEqual(inventory.body.runs, []);
  const run = await f.request('/api/scripts/verify-app/run', 'POST', {});
  assert.equal(run.status, 202); assert.equal(run.body.run.status, 'running');
  const [executable, args, options] = f.calls[0];
  assert.equal(executable, process.execPath);
  assert.deepEqual(args, ['--test', path.join(f.root, 'os/server/domain.test.mjs'), path.join(f.root, 'os/server/hub.test.mjs')]);
  assert.equal(options.shell, false); assert.equal(options.windowsHide, true); assert.equal(options.cwd, path.join(f.root, 'os'));
  f.children[0].stdout.emit('data', Buffer.from('Tests passed\n'));
  f.children[0].emit('close', 0, null);
  const result = (await f.request()).body.runs[0];
  assert.equal(result.status, 'completed'); assert.equal(result.exitCode, 0); assert.equal(result.output, 'Tests passed\n'); assert.ok(result.finishedAt);
});

test('one active script blocks duplicates and other scripts; build starts after completion', async t => {
  const f = await fixture(t);
  const simultaneous = await Promise.all([f.request('/api/scripts/verify-app/run', 'POST', {}), f.request('/api/scripts/build-app/run', 'POST', {})]);
  assert.deepEqual(simultaneous.map(r => r.status).sort(), [202, 409]);
  assert.equal(f.calls.length, 1);
  f.children[0].emit('close', 0);
  assert.equal((await f.request('/api/scripts/build-app/run', 'POST', {})).status, 202);
  assert.deepEqual(f.calls[1][1], [path.join(f.root, 'os/node_modules/vite/bin/vite.js'), 'build']);
});

test('output is bounded, failure is reported, and restart clears runtime history', async t => {
  const f = await fixture(t);
  await f.request('/api/scripts/verify-app/run', 'POST', {});
  f.children[0].stdout.emit('data', 'x'.repeat(100000));
  f.children[0].stderr.emit('data', '\nTest failed');
  f.children[0].emit('close', 1);
  const run = (await f.request()).body.runs[0];
  assert.equal(run.status, 'failed'); assert.equal(run.exitCode, 1); assert.equal(run.output.length, 64000); assert.equal(run.outputTruncated, true); assert.match(run.output, /Test failed$/);
  await f.restart(); assert.deepEqual((await f.request()).body.runs, []);
  await assert.rejects(fs.stat(path.join(f.root, 'os/data/scripts-runs.json')), { code: 'ENOENT' });
});

test('untrusted mutation requests and arbitrary commands are rejected before process creation', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/scripts/verify-app/run', 'POST', {}, { Origin: 'https://external.test' })).status, 403);
  assert.equal((await f.request('/api/scripts/verify-app/run', 'POST', {}, { Origin: '' })).status, 403);
  assert.equal((await f.request('/api/scripts/verify-app/run', 'POST', {}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.request('/api/scripts/verify-app/run', 'POST', { args: ['--eval', 'evil'] })).status, 400);
  assert.equal((await f.request('/api/scripts/verify-app/run', 'POST', [])).status, 400);
  assert.equal((await f.request('/api/scripts/verify-app/run', 'POST', { command: 'x'.repeat(2000) })).status, 413);
  assert.equal((await f.request('/api/scripts/other-command/run', 'POST', {})).status, 404);
  assert.equal(f.calls.length, 0);
});

test('process errors and server shutdown end runs; closed runner rejects new work', async t => {
  const f = await fixture(t);
  await f.request('/api/scripts/build-app/run', 'POST', {});
  f.children[0].emit('error', new Error('ENOENT'));
  assert.equal((await f.request()).body.runs[0].status, 'failed');
  await f.request('/api/scripts/verify-app/run', 'POST', {});
  await f.app.close();
  assert.equal(f.children[1].killed, true);
  assert.equal((await f.request()).body.runs[0].status, 'cancelled');
  assert.equal((await f.request('/api/scripts/build-app/run', 'POST', {})).status, 503);
});

test('spawn throw records a failed run and missing dependencies never spawn', async t => {
  const f = await fixture(t, { throwSpawn: true });
  const result = await f.request('/api/scripts/build-app/run', 'POST', {});
  assert.equal(result.status, 202); assert.equal(result.body.run.status, 'failed');
  assert.doesNotMatch(result.body.run.error, /private/);
  await fs.unlink(path.join(f.root, 'os/node_modules/vite/bin/vite.js'));
  assert.equal((await f.request('/api/scripts/build-app/run', 'POST', {})).status, 409);
  assert.equal(f.calls.length, 1);
});

test('linked script entry cannot escape the app folder', async t => {
  const f = await fixture(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-script-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, 'domain.test.mjs'), '// outside');
  await fs.rm(path.join(f.root, 'os/server'), { recursive: true });
  try { await fs.symlink(outside, path.join(f.root, 'os/server'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (e) { if (['EPERM', 'EACCES'].includes(e.code)) { t.diagnostic('Symlink unavailable in this environment.'); return; } throw e; }
  assert.equal((await f.request('/api/scripts/verify-app/run', 'POST', {})).status, 400);
  assert.equal(f.calls.length, 0);
});
