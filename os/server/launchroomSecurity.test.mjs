import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { Readable, Writable } from 'node:stream';
import http from 'node:http';
import { createServer as createVite } from 'vite';
import { createLaunchroom } from './launchroom.mjs';
import { createLaunchroomAuth } from './launchroomAuth.mjs';
import { createLaunchroomProjects } from './launchroomProjects.mjs';

const REMOTE = 'https://merrivy-home.netbird.cloud';
class Response extends Writable {
  constructor() { super(); this.headers = {}; this.chunks = []; this.statusCode = 200; this.headersSent = false; }
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; }
  writeHead(status, headers = {}) { this.statusCode = status; for (const [key, value] of Object.entries(headers)) this.setHeader(key, value); this.headersSent = true; }
  _write(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  value() { const raw = Buffer.concat(this.chunks).toString('utf8'); try { return JSON.parse(raw); } catch { return raw; } }
}
async function fixture(t, { development = false, initialize = true } = {}) {
  const tempRoot = await realpath(tmpdir());
  const base = await mkdtemp(path.join(tempRoot, 'launchroom-security-test-'));
  const root = path.join(base, 'workspace');
  await mkdir(path.join(root, 'workflow'), { recursive: true });
  await mkdir(path.join(root, 'resources'));
  await writeFile(path.join(root, 'resources', 'owner.md'), '# Owner-only fixture');
  t.after(async () => {
    assert.ok(base.startsWith(path.join(tempRoot, 'launchroom-security-test-')));
    await rm(base, { recursive: true, force: true });
  });
  const middleware = await createLaunchroom({ workspaceRoot: root, remoteOrigin: REMOTE, development });
  const dataDir = path.join(root, 'os', 'private', 'launchroom');
  const auth = await createLaunchroomAuth({ dataDir });
  const projects = await createLaunchroomProjects({ workspaceRoot: root, dataDir });
  // These are synthetic, temporary fixture credentials, never real accounts.
  const password = 'Temporary fixture password 2026';
  let owner, ownerSession, member, memberSession;
  if (initialize) {
    owner = await auth.setup({ name: 'Fixture owner', username: 'fixture-owner', password });
    ownerSession = await auth.login({ username: owner.username, password }, 'fixture');
    const invite = await auth.createInvite(owner, { name: 'Fixture member', username: 'fixture-member' });
    member = await auth.acceptInvite({ token: invite.token, password });
    memberSession = await auth.login({ username: member.username, password }, 'fixture');
  }
  async function request(url, { method = 'GET', actor = null, headers = {}, input, local = false, encrypted = !local } = {}) {
    const bytes = input === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(input));
    const req = Readable.from(bytes.length ? [bytes] : []);
    req.url = url; req.method = method;
    req.socket = { remoteAddress: local ? '127.0.0.1' : '100.95.75.187', encrypted };
    req.headers = { host: local && !encrypted ? 'localhost:3000' : new URL(REMOTE).host, ...headers };
    if (actor) req.headers.cookie = `${encrypted ? '__Host-launchroom' : 'launchroom-local'}=${actor === 'owner' ? ownerSession.token : memberSession.token}`;
    if (input !== undefined) req.headers['content-type'] = 'application/json';
    const res = new Response();
    let delegated = null;
    await middleware(req, res, () => { delegated = req.url; res.writeHead(299); res.end(JSON.stringify({ delegated })); });
    return { status: res.statusCode, headers: res.headers, body: res.value(), delegated };
  }
  return { request, root, auth, owner, member, password, projects, middleware };
}

test('TLS requests delivered from loopback cannot obtain local-agent or first-account setup privileges', async t => {
  const f = await fixture(t, { initialize: false });
  const forgedHeaders = {
    'x-launchroom-local-agent': '1',
    'x-forwarded-for': '127.0.0.1',
    'x-forwarded-host': 'localhost:3000',
    'x-forwarded-proto': 'http',
  };
  const session = await f.request('/api/launchroom/session', { local: true, encrypted: true, headers: forgedHeaders });
  assert.equal(session.status, 200);
  assert.equal(session.body.initialized, false);
  assert.equal(session.body.canSetup, false);
  assert.equal(session.body.user, null);
  for (const route of ['/api/bootstrap', '/api/launchroom/projects', '/p/shared/api/files']) {
    const result = await f.request(route, { local: true, encrypted: true, headers: forgedHeaders });
    assert.equal(result.status, 401);
    assert.equal(result.delegated, null);
  }
  const deniedSetup = await f.request('/api/launchroom/setup', {
    local: true, encrypted: true, method: 'POST', headers: { ...forgedHeaders, origin: REMOTE },
    input: { name: 'Fixture owner', username: 'fixture-owner', password: f.password },
  });
  assert.equal(deniedSetup.status, 403);
  assert.equal((await f.auth.status()).initialized, false);
  const localSession = await f.request('/api/launchroom/session', { local: true });
  assert.equal(localSession.status, 200);
  assert.equal(localSession.body.canSetup, true);
  const setup = await f.request('/api/launchroom/setup', {
    local: true, method: 'POST', headers: { origin: 'http://localhost:3000' },
    input: { name: 'Fixture owner', username: 'fixture-owner', password: f.password },
  });
  assert.equal(setup.status, 201);
  assert.equal(setup.body.user.role, 'admin');
});

test('TLS loopback sessions keep Secure cookies and exact public Host/Origin checks', async t => {
  const f = await fixture(t);
  for (const headers of [{ host: 'localhost:3000' }, { origin: 'http://localhost:3000' }]) {
    assert.equal((await f.request('/api/launchroom/session', { local: true, encrypted: true, headers })).status, 403);
  }
  const login = await f.request('/api/launchroom/login', {
    local: true, encrypted: true, method: 'POST', headers: { origin: REMOTE },
    input: { username: f.owner.username, password: f.password },
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers['set-cookie'];
  assert.equal(setCookie.startsWith('__Host-launchroom='), true);
  for (const attribute of ['; Secure', '; HttpOnly', '; SameSite=Strict', '; Path=/']) assert.equal(setCookie.includes(attribute), true);
  const session = await f.request('/api/launchroom/session', { local: true, encrypted: true, actor: 'owner' });
  assert.equal(session.body.user.id, f.owner.id);
  assert.equal(session.body.canSetup, false);
  assert.equal((await f.request('/api/bootstrap', { local: true, encrypted: true, actor: 'owner', headers: { 'x-launchroom-local-agent': '1' } })).status, 403);
});

test('Launchroom security boundary rejects unauthenticated and forged-local requests before delegation', async t => {
  const f = await fixture(t);
  for (const route of ['/api/bootstrap', '/api/scripts', '/api/runtime', '/p/merrivy/api/doc?path=resources/owner.md', '/p/shared/api/files', '/p/shared/']) {
    const result = await f.request(route);
    assert.equal(result.status, 401, route);
    assert.equal(result.delegated, null, route);
  }
  for (const headers of [
    { 'x-launchroom-local-agent': '1' },
    { 'x-launchroom-local-agent': '1', 'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': 'localhost:3000', 'x-forwarded-proto': 'http' },
  ]) assert.equal((await f.request('/api/bootstrap', { headers })).status, 401);
  assert.equal((await f.request('/api/bootstrap', { local: true, headers: { 'x-launchroom-local-agent': '1', 'sec-fetch-site': 'same-origin' } })).status, 401);
  assert.equal((await f.request('/api/bootstrap', { local: true, headers: { 'x-launchroom-local-agent': '1' } })).status, 299);
  assert.equal((await f.request('/api/bootstrap', { actor: 'owner' })).status, 403);
});

test('Launchroom validates original Host and Origin for remote read and mutation routes', async t => {
  const f = await fixture(t);
  for (const headers of [{ host: 'attacker.invalid' }, { host: 'localhost:3000' }, { origin: 'https://attacker.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await f.request('/api/launchroom/projects', { actor: 'owner', headers })).status, 403);
  }
  assert.equal((await f.request('/api/launchroom/projects', { actor: 'owner', encrypted: false })).status, 403);
  assert.equal((await f.request('/p/shared/api/maps', { actor: 'member', method: 'POST', input: { title: 'Denied' } })).status, 403);
  assert.equal((await f.request('/api/launchroom/setup', { method: 'POST', input: {}, headers: { origin: REMOTE } })).status, 403);
  assert.equal((await f.request('/p/shared/api/maps', { actor: 'member', method: 'POST', input: { title: 'Allowed' }, headers: { origin: REMOTE } })).status, 201);
});

test('cross-site top-level entry navigation reaches the login shell while APIs and mutations remain blocked', async t => {
  const f = await fixture(t);
  const navigation = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
  for (const method of ['GET', 'HEAD']) {
    for (const route of ['/', '/?from=external-link']) {
      const result = await f.request(route, { method, headers: navigation });
      assert.equal(result.status, 299);
      assert.equal(result.delegated, route);
    }
    for (const route of ['/api/launchroom/session', '/api/launchroom/projects', '/api/bootstrap', '/p/shared/api/files', '/p/shared/api/maps']) {
      const result = await f.request(route, { method, actor: 'owner', headers: navigation });
      assert.equal(result.status, 403);
      assert.equal(result.delegated, null);
    }
  }
  for (const headers of [
    { ...navigation, host: 'attacker.invalid' },
    { ...navigation, origin: 'https://attacker.invalid' },
    { ...navigation, 'sec-fetch-mode': 'cors' },
    { ...navigation, 'sec-fetch-dest': 'iframe' },
    { 'sec-fetch-site': 'cross-site' },
  ]) assert.equal((await f.request('/', { headers })).status, 403);
  for (const [route, input] of [
    ['/', {}],
    ['/api/launchroom/login', { username: f.owner.username, password: f.password }],
    ['/p/shared/api/maps', { title: 'Must not be created' }],
  ]) {
    const result = await f.request(route, { method: 'POST', actor: 'owner', headers: { ...navigation, origin: REMOTE }, input });
    assert.equal(result.status, 403);
    assert.equal(result.delegated, null);
  }
  const maps = await f.request('/p/shared/api/maps', { actor: 'member' });
  assert.equal(maps.status, 200);
  assert.deepEqual(maps.body.maps, []);
});

test('cross-site project entry navigation preserves sessions, membership and local-agent restrictions', async t => {
  const f = await fixture(t);
  const navigation = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
  assert.equal((await f.request('/p/merrivy/', { headers: navigation })).status, 401);
  assert.equal((await f.request('/p/merrivy/', { actor: 'member', headers: navigation })).status, 404);
  assert.equal((await f.request('/p/merrivy/', { actor: 'owner', headers: navigation })).status, 299);
  assert.equal((await f.request('/p/shared/', { actor: 'member', headers: navigation })).status, 299);
  for (const route of ['/p/merrivy', '/p/merrivy/api/planner', '/p/merrivy//', '/p/merrivy/%2e%2e/']) {
    const result = await f.request(route, { actor: 'owner', headers: navigation });
    assert.ok(result.status >= 400);
    assert.equal(result.delegated, null);
  }
  await f.projects.setMembers(f.owner, 'merrivy', [f.member.id]);
  assert.equal((await f.request('/p/merrivy/', { actor: 'member', headers: navigation })).status, 299);
  await f.projects.setMembers(f.owner, 'merrivy', []);
  assert.equal((await f.request('/p/merrivy/', { actor: 'member', headers: navigation })).status, 404);
  const localHeader = { ...navigation, 'x-launchroom-local-agent': '1' };
  assert.equal((await f.request('/p/shared/', { local: true, headers: localHeader })).status, 401);
  assert.equal((await f.request('/p/shared/', { local: true, encrypted: true, headers: localHeader })).status, 401);
});

test('project delegation preserves membership and blocks private files and process execution', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/p/merrivy/api/doc?path=resources/owner.md', { actor: 'member' })).status, 404);
  assert.equal((await f.request('/p/merrivy/api/doc?path=resources/owner.md', { actor: 'owner' })).status, 200);
  for (const target of ['os/private/launchroom/auth/auth.json', 'resources/../os/private/launchroom/auth/auth.json', 'resources/.. /os/private/launchroom/auth/auth.json', 'resources/owner.md:secret']) {
    const result = await f.request('/p/merrivy/api/doc?path=' + encodeURIComponent(target), { actor: 'owner' });
    assert.ok(result.status >= 400, target);
  }
  for (const route of ['/p/shared/api/scripts', '/p/shared/api/scripts/build/run', '/p/shared/api/runs/run-id', '/p/shared/api/runs']) {
    const result = await f.request(route, { actor: 'member', method: 'POST', input: {}, headers: { origin: REMOTE } });
    assert.equal(result.status, 403, route);
    assert.equal(result.delegated, null, route);
  }
  for (const route of ['/p/shared/api/../api/scripts', '/p/shared/api/%2e%2e/api/scripts', '/p/shared/api/runs%2fprobe', '/p/shared/api/scripts%5cprobe']) {
    const result = await f.request(route, { actor: 'member' });
    assert.ok(result.status >= 400, route);
    assert.equal(result.delegated, null, route);
  }
  await f.projects.setMembers(f.owner, 'merrivy', [f.member.id]);
  assert.equal((await f.request('/p/merrivy/api/doc?path=resources/owner.md', { actor: 'member' })).status, 200);
  await f.projects.setMembers(f.owner, 'merrivy', []);
  assert.equal((await f.request('/p/merrivy/api/doc?path=resources/owner.md', { actor: 'member' })).status, 404);
});

test('malformed or normalized request paths cannot reach unscoped APIs without authentication', async t => {
  const f = await fixture(t);
  for (const route of ['/assets/../api/scripts', '/assets/%2e%2e/api/scripts', '/assets/..\\api/scripts', '//localhost/api/scripts', 'http://localhost/api/scripts', '/p/shared/../../api/scripts', '/p/shared/%2e%2e/%2e%2e/api/scripts', '/api', '/os/private/launchroom/auth/auth.json']) {
    const result = await f.request(route);
    assert.ok(result.status >= 400, route);
    assert.equal(result.delegated, null, route);
  }
});

test('encoded static paths cannot expose private files through the Vite development fallback', async t => {
  const f = await fixture(t, { development: true });
  await mkdir(path.join(f.root, 'os', 'src'));
  await writeFile(path.join(f.root, 'os', 'index.html'), '<!doctype html><html><head><title>Fixture setup</title></head><body><script type="module" src="/src/main.jsx"></script></body></html>');
  await writeFile(path.join(f.root, 'os', 'src', 'main.jsx'), 'document.documentElement.dataset.fixture = "setup-ui";');
  const vite = await createVite({ root: path.join(f.root, 'os'), configFile: false, optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, watch: null, hmr: false, fs: { strict: true, allow: [path.join(f.root, 'os')] } }, plugins: [{ name: 'launchroom-security-fixture', configureServer(server) { server.middlewares.use(f.middleware); } }] });
  const server = http.createServer(vite.middlewares);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await vite.close(); });
  const get = requestPath => new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: server.address().port, path: requestPath, headers: { host: 'localhost:3000' } }, res => {
      let content = ''; res.on('data', chunk => { content += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, exposedFixtureIdentity: content.includes('fixture-owner'), hasVite: content.includes('/@vite/client'), hasEntry: content.includes('/src/main.jsx'), hasSetup: content.includes('setup-ui') }));
    });
    req.on('error', reject);
  });
  for (const requestPath of ['/assets/..%2fprivate/launchroom/auth/auth.json', '/assets/..%5cprivate/launchroom/auth/auth.json', '/assets/%2e%2e%5cprivate/launchroom/auth/auth.json', '/assets/..%255cprivate/launchroom/auth/auth.json', '/src/..%5cprivate/launchroom/auth/auth.json', '/private/launchroom/auth/auth.json', '/server/launchroom.mjs']) {
    const result = await get(requestPath);
    assert.equal(result.exposedFixtureIdentity, false, requestPath + ': Vite must not serve the authentication store after decoding an allowed static-path prefix.');
    assert.ok(result.status >= 400, requestPath);
  }
  const html = await get('/');
  assert.equal(html.status, 200);
  assert.equal(html.hasVite, true);
  assert.equal(html.hasEntry, true);
  const entry = await get('/src/main.jsx');
  assert.equal(entry.status, 200);
  assert.equal(entry.hasSetup, true);
  for (const requestPath of ['/@vite/client', '/@react-refresh', '/src/main.jsx', '/node_modules/.vite/deps/react.js?v=fixture', '/node_modules/vite/dist/client/env.mjs']) {
    assert.equal((await f.request(requestPath, { local: true })).status, 299, requestPath);
    assert.equal((await f.request(requestPath)).status, 404, requestPath + ' is local-development-only');
  }
});
