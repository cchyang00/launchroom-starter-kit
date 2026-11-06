import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { recentChanges, CHANGE_ROOTS } from './changes.mjs';
import { createLaunchroom } from './launchroom.mjs';
import { createHub } from './hub.mjs';
import { createApi } from './api.mjs';

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-changes-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (relative, contents = 'x') => { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, contents); return file; };
  return { root, write };
}

test('recentChanges lists recent files in allowed folders only, newest first', async t => {
  const { root, write } = await workspace(t);
  await write('os/src/App.jsx');
  await write('memory/NOW.md');
  await write('.claude/agents/os-builder.md');
  const old = await write('workflow/OLD.md');
  const hour = new Date(Date.now() - 60 * 60000); await fs.utimes(old, hour, hour);
  const later = await write('products/P001-x/os-product.json');
  const soon = new Date(Date.now() + 1000); await fs.utimes(later, soon, soon);
  // Never shown: private, data, uploads, build output, secrets, dotfiles and anything outside the allowed folders.
  for (const relative of [
    'os/private/launchroom/auth/auth.json', 'os/data/planner.json', 'os/server/node_modules/pkg/index.js', 'os/dist/index.html',
    'os/src/.env', 'os/src/.env.local', 'hydrogen-storefront/.env', 'hydrogen-storefront/app/.env.production', '.git/HEAD', 'research/.git/config',
    'launchroom/projects/demo/inbox/uploads/file.txt', 'launchroom/shared/inbox/uploads/a.png', 'inbox/uploads/b.png', 'store/inbox/uploads/c.png',
    'resources/private/notes.md', 'store/assets/_removed/2026-10-01/x.png', 'hydrogen-storefront/node_modules/x.js', 'hydrogen-storefront/dist/a.js',
    'hydrogen-storefront/public/images/a.png', 'agents/keys/server.pem', 'guides/x.md', 'os/README.md', 'secret.txt',
  ]) await write(relative);
  const result = await recentChanges({ workspaceRoot: root, minutes: 30 });
  const paths = result.changes.map(c => c.path);
  assert.equal(paths[0], 'products/P001-x/os-product.json', 'newest first');
  assert.deepEqual([...paths].sort(), ['.claude/agents/os-builder.md', 'memory/NOW.md', 'os/src/App.jsx', 'products/P001-x/os-product.json']);
  assert.equal(result.total, 4);
  assert.equal(result.minutes, 30);
  assert.equal(result.truncated, false);
  for (const change of result.changes) {
    assert.ok(CHANGE_ROOTS.some(rootPath => change.path.startsWith(rootPath + '/')));
    assert.ok(!Number.isNaN(Date.parse(change.at)));
    assert.deepEqual(Object.keys(change).sort(), ['at', 'count', 'path']);
    assert.equal(change.count, 1);
  }
  const wide = await recentChanges({ workspaceRoot: root, minutes: 90 });
  assert.ok(wide.changes.some(c => c.path === 'workflow/OLD.md'));
});

test('recentChanges caps the window, the list and the walk', async t => {
  const { root, write } = await workspace(t);
  for (let i = 0; i < 30; i++) await write(`research/batch-${String(i).padStart(2, '0')}/file.md`);
  const capped = await recentChanges({ workspaceRoot: root, limit: 5 });
  assert.equal(capped.changes.length, 5);
  assert.equal(capped.total, 30);
  assert.equal((await recentChanges({ workspaceRoot: root, limit: 9999 })).changes.length, 30, 'limit at most 50');
  assert.equal((await recentChanges({ workspaceRoot: root })).changes.length, 12, 'default 12');
  assert.equal((await recentChanges({ workspaceRoot: root, minutes: 99999 })).minutes, 240);
  assert.equal((await recentChanges({ workspaceRoot: root, minutes: 'abc' })).minutes, 30);
  const walk = await recentChanges({ workspaceRoot: root, maxEntries: 10 });
  assert.equal(walk.truncated, true);
  assert.ok(walk.total <= 10);
  const timed = await recentChanges({ workspaceRoot: root, budgetMs: -1 });
  assert.equal(timed.truncated, true);
  assert.equal(timed.changes.length, 0);
});

test('a burst of files saved together in one folder is one row with a count', async t => {
  const { root, write } = await workspace(t);
  for (let i = 1; i <= 5; i++) await write(`memory/days/2026-09-0${i}.md`);
  const earlier = await write('memory/days/2026-08-01.md');
  const minuteAgo = new Date(Date.now() - 60000); await fs.utimes(earlier, minuteAgo, minuteAgo);
  await write('memory/NOW.md');
  const result = await recentChanges({ workspaceRoot: root });
  assert.equal(result.total, 7);
  const days = result.changes.filter(c => c.path.startsWith('memory/days/'));
  assert.deepEqual(days.map(c => c.count), [5, 1], 'the burst is one row; a file saved a minute earlier stays its own row');
  assert.equal(result.changes.find(c => c.path === 'memory/NOW.md').count, 1);
  assert.equal(result.more, false);
});

test('recentChanges never follows symbolic links or junctions', async t => {
  const { root, write } = await workspace(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, 'secret.md'), 'x');
  await write('research/real.md');
  let linked = 0;
  for (const [target, link] of [[outside, path.join(root, 'research', 'linked')], [outside, path.join(root, 'memory')]]) {
    try { await fs.symlink(target, link, 'junction'); linked++; } catch { /* links may need permission on this machine */ }
  }
  const result = await recentChanges({ workspaceRoot: root });
  assert.deepEqual(result.changes.map(c => c.path), ['research/real.md']);
  if (!linked) t.diagnostic('symlinks unavailable here; link checks were skipped');
});

test('GET /api/changes is denied without a Launchroom session and works for a signed-in member of the project', async t => {
  const { root, write } = await workspace(t);
  await write('memory/NOW.md');
  await write('research/merrivy-only.md');
  await write('os/private/launchroom/x.txt');
  const gateway = await createLaunchroom({ workspaceRoot: root, port: 3000 });
  const hub = await createHub({ workspaceRoot: root, port: 3000 });
  const api = createApi({ workspaceRoot: root, storeMap: hub.storeMap });
  const server = http.createServer((req, res) => { Promise.resolve(gateway(req, res, () => hub(req, res, () => api(req, res, () => { res.writeHead(404); res.end(); })))).catch(() => { if (!res.headersSent) { res.writeHead(500); res.end(); } }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, { method = 'GET', cookie, json } = {}) => new Promise((resolve, reject) => {
    const data = json === undefined ? undefined : JSON.stringify(json);
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method, agent: false, headers: { Host: 'localhost:3000', 'Sec-Fetch-Site': 'same-origin', ...(method === 'POST' ? { Origin: 'http://localhost:3000' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => { let body = null; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {} resolve({ status: res.statusCode, body, headers: res.headers }); });
    });
    req.once('error', reject); req.end(data);
  });
  assert.equal((await request('/api/changes')).status, 401);
  assert.equal((await request('/p/merrivy/api/changes')).status, 401);
  const setup = await request('/api/launchroom/setup', { method: 'POST', json: { name: 'Fixture Admin', username: 'fixture-admin', password: `fixture-${randomBytes(18).toString('base64url')}` } });
  assert.equal(setup.status, 201);
  const cookie = setup.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request('/api/changes', { cookie })).status, 403, 'unscoped API needs a project');
  const scoped = await request('/p/merrivy/api/changes?minutes=30', { cookie });
  assert.equal(scoped.status, 200);
  assert.deepEqual(scoped.body.changes.map(c => c.path).sort(), ['memory/NOW.md', 'research/merrivy-only.md']);
  const created = await request('/api/launchroom/projects', { method: 'POST', cookie, json: { name: 'Side project' } });
  assert.equal(created.status, 201);
  const other = await request(`/p/${created.body.id}/api/changes`, { cookie });
  assert.equal(other.status, 200);
  const otherPaths = other.body.changes.map(c => c.path);
  assert.ok(otherPaths.includes('products/INDEX.md'), 'a new project walks its own root');
  assert.ok(!otherPaths.includes('research/merrivy-only.md'), 'never Merrivy files');
});
