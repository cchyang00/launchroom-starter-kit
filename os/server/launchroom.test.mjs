import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createLaunchroom} from './launchroom.mjs';
import {createLaunchroomAuth} from './launchroomAuth.mjs';
import {createHub} from './hub.mjs';
import {createApi} from './api.mjs';

const ORIGIN = 'http://localhost:3000';
const password = () => `fixture-${randomBytes(18).toString('base64url')}`;
const sessionCookie = response => response.headers['set-cookie']?.[0]?.split(';')[0];
const endpoint = (project, route) => `/p/${project.id}${route}`;

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'launchroom-http-'));
  let server;
  t.after(async () => {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('launchroom-http-'));
    await fs.rm(root, {recursive: true, force: true});
  });
  const gateway = await createLaunchroom({workspaceRoot: root, port: 3000});
  const hub = await createHub({workspaceRoot: root, port: 3000});
  const api = createApi({workspaceRoot: root, storeMap: hub.storeMap});
  server = http.createServer((req, res) => {
    Promise.resolve(gateway(req, res, () => hub(req, res, () => api(req, res, () => {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end('<!doctype html><title>Isolated fixture shell</title>');
    })))).catch(() => {
      if (res.headersSent) res.destroy();
      else { res.writeHead(500); res.end('Fixture request failed.'); }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  function request(route, {method = 'GET', cookie, json, raw, browser = true, origin = true, headers = {}} = {}) {
    const data = json === undefined ? raw : JSON.stringify(json);
    const requestHeaders = {
      Host: 'localhost:3000',
      ...(browser ? {'Sec-Fetch-Site': 'same-origin'} : {}),
      ...(origin && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? {Origin: ORIGIN} : {}),
      ...(cookie ? {Cookie: cookie} : {}),
      ...(json === undefined ? {} : {'Content-Type': 'application/json'}),
      ...(data === undefined ? {} : {'Content-Length': Buffer.byteLength(data)}),
      ...headers,
    };
    return new Promise((resolve, reject) => {
      const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: requestHeaders, agent: false}, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.once('error', reject);
        res.once('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try { parsed = JSON.parse(text); } catch { parsed = null; }
          resolve({status: res.statusCode, headers: res.headers, body: parsed, text});
        });
      });
      req.setTimeout(15000, () => req.destroy(new Error('Fixture request timed out.')));
      req.once('error', reject);
      req.end(data);
    });
  }

  async function setup() {
    const secret = password();
    const response = await request('/api/launchroom/setup', {method: 'POST', json: {name: 'Fixture Admin', username: 'fixture-admin', password: secret}});
    assert.equal(response.status, 201, 'Initial setup should create the administrator and sign in');
    const cookie = sessionCookie(response);
    assert.equal(typeof cookie, 'string');
    return {cookie, user: response.body.user, password: secret};
  }

  async function member(admin, username = 'fixture-member') {
    const invite = await request('/api/launchroom/invites', {method: 'POST', cookie: admin.cookie, json: {name: 'Fixture Member', username, role: 'member'}});
    assert.equal(invite.status, 201);
    assert.equal(typeof invite.body.token, 'string');
    const secret = password();
    const accepted = await request('/api/launchroom/accept-invite', {method: 'POST', json: {token: invite.body.token, password: secret}});
    assert.equal(accepted.status, 201);
    const signedIn = await request('/api/launchroom/login', {method: 'POST', json: {username, password: secret}});
    assert.equal(signedIn.status, 200);
    return {cookie: sessionCookie(signedIn), user: signedIn.body.user, password: secret, invitation: invite.body.token};
  }

  async function project(actor, name) {
    const result = await request('/api/launchroom/projects', {method: 'POST', cookie: actor.cookie, json: {name}});
    assert.equal(result.status, 201);
    assert.equal(Object.hasOwn(result.body, 'root'), false);
    return result.body;
  }
  return {root, request, setup, member, project};
}

test('HTTP setup signs in, issues a protected cookie, and login/logout persist the expected session state', async t => {
  const f = await fixture(t);
  const initial = await f.request('/api/launchroom/session');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.initialized, false);
  assert.equal(initial.body.user, null);
  assert.equal(initial.body.canSetup, true);
  const admin = await f.setup();
  assert.equal(admin.user.role, 'admin');
  assert.deepEqual(Object.keys(admin.user).sort(), ['disabled', 'id', 'name', 'role', 'username']);
  const session = await f.request('/api/launchroom/session', {cookie: admin.cookie});
  assert.equal(session.body.initialized, true);
  assert.equal(session.body.user.id, admin.user.id);
  const repeat = await f.request('/api/launchroom/setup', {method: 'POST', json: {name: 'Another Fixture', username: 'another-admin', password: password()}});
  assert.equal(repeat.status, 409);
  const invalid = await f.request('/api/launchroom/login', {method: 'POST', json: {username: admin.user.username, password: password()}});
  assert.equal(invalid.status, 401);
  assert.equal(invalid.headers['set-cookie'], undefined);
  const login = await f.request('/api/launchroom/login', {method: 'POST', json: {username: admin.user.username, password: admin.password}});
  assert.equal(login.status, 200);
  const header = login.headers['set-cookie'][0];
  assert.equal(header.startsWith('launchroom-local='), true);
  assert.equal(header.includes('; HttpOnly'), true);
  assert.equal(header.includes('; SameSite=Strict'), true);
  assert.equal(header.includes('; Path=/'), true);
  assert.equal(/Max-Age=[1-9]\d*/.test(header), true);
  const cookie = sessionCookie(login);
  const logout = await f.request('/api/launchroom/logout', {method: 'POST', cookie});
  assert.equal(logout.status, 200);
  assert.equal(logout.headers['set-cookie'][0].includes('Max-Age=0'), true);
  assert.equal((await f.request('/api/launchroom/session', {cookie})).body.user, null);
  assert.equal((await f.request('/api/launchroom/projects', {cookie})).status, 401);
});

test('HTTP gateway rejects unauthenticated API/file access and malicious Host/Origin or private-root requests', async t => {
  const f = await fixture(t);
  for (const route of [
    '/api/launchroom/projects', '/api/planner', '/api/doc?path=memory/NOW.md', '/api/asset?path=resources/fixture.png',
    '/p/merrivy/api/planner', '/p/merrivy/api/doc?path=memory/NOW.md', '/p/merrivy/api/asset?path=resources/fixture.png',
    '/p/merrivy/api/assets', '/p/merrivy/api/files', '/p/merrivy/api/files/download?path=fixture.txt', '/p/merrivy/',
  ]) assert.equal((await f.request(route)).status, 401, 'Workspace content must require sign-in');
  const admin = await f.setup();
  for (const headers of [
    {Host: 'attacker.example'},
    {Host: 'localhost:9999'},
    {Host: 'attacker.example', 'X-Forwarded-Host': 'localhost:3000', 'X-Forwarded-Proto': 'https'},
    {Origin: 'https://attacker.example'},
    {Origin: 'http://127.0.0.1:3000'},
    {'Sec-Fetch-Site': 'cross-site'},
  ]) assert.equal((await f.request('/api/launchroom/session', {cookie: admin.cookie, headers})).status, 403);
  assert.equal((await f.request('/api/launchroom/logout', {method: 'POST', cookie: admin.cookie, origin: false})).status, 403);
  assert.equal((await f.request('/api/launchroom/login', {method: 'POST', raw: '{}', headers: {'Content-Type': 'text/plain'}})).status, 415);
  for (const [route, status] of [
    ['/os/private', 404], ['/os/private/launchroom/auth/auth.json', 404],
    ['/%6fs/private/launchroom/auth/auth.json', 400], ['/assets/../os/private/launchroom/auth/auth.json', 400],
  ]) {
    assert.equal((await f.request(route, {cookie: admin.cookie})).status, status);
  }
  const deniedDocument = await f.request('/p/merrivy/api/doc?path=os/private/launchroom/auth/auth.json', {cookie: admin.cookie});
  assert.equal(deniedDocument.status, 400);
  const deniedAsset = await f.request('/p/merrivy/api/asset?path=os/private/launchroom/auth/auth.json', {cookie: admin.cookie});
  assert.equal(deniedAsset.status >= 400, true);
  assert.equal((await f.request('/', {cookie: admin.cookie})).status, 200);
});

test('HTTP project writes stay isolated and membership gates records, documents, assets and downloads', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const first = await f.member(admin, 'first-member');
  const second = await f.member(admin, 'second-member');
  const alpha = await f.project(first, 'Alpha fixture');
  const beta = await f.project(second, 'Beta fixture');
  for (const [actor, project, title] of [[first, alpha, 'Only Alpha'], [second, beta, 'Only Beta']]) {
    const blank = await f.request(endpoint(project, '/api/planner'), {cookie: actor.cookie});
    assert.equal(blank.status, 200);
    assert.deepEqual(blank.body, {revision: 0, tasks: []});
    const saved = await f.request(endpoint(project, '/api/planner/tasks'), {method: 'POST', cookie: actor.cookie, json: {revision: 0, title}});
    assert.equal(saved.status, 200);
    assert.equal(saved.body.tasks.length, 1);
    assert.equal(saved.body.tasks[0].title, title);
    const bootstrap = await f.request(endpoint(project, '/api/bootstrap'), {cookie: actor.cookie});
    assert.equal(bootstrap.status, 200);
    assert.deepEqual(bootstrap.body.products, []);
    assert.deepEqual(bootstrap.body.jobs, []);
  }
  assert.equal((await f.request(endpoint(alpha, '/api/planner'), {cookie: first.cookie})).body.tasks[0].title, 'Only Alpha');
  assert.equal((await f.request(endpoint(beta, '/api/planner'), {cookie: second.cookie})).body.tasks[0].title, 'Only Beta');
  const rootPlanner = path.join(f.root, 'os/data/planner.json');
  await assert.rejects(fs.stat(rootPlanner), error => error.code === 'ENOENT');

  const alphaRoot = path.join(f.root, 'launchroom/projects', alpha.id);
  await fs.writeFile(path.join(alphaRoot, 'resources/fixture.md'), '# Alpha only\n');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY5sAAAAASUVORK5CYII=', 'base64');
  await fs.writeFile(path.join(alphaRoot, 'resources/fixture.png'), image);
  const uploaded = await f.request(endpoint(alpha, '/api/files/upload?name=alpha.txt'), {method: 'POST', cookie: first.cookie, raw: 'Alpha fixture upload', headers: {'Content-Type': 'text/plain'}});
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.uploadedBy, first.user.id);
  const downloadRoute = `/api/files/download?path=${encodeURIComponent(uploaded.body.path)}`;
  const successfulDownload = await f.request(endpoint(alpha, downloadRoute), {cookie: first.cookie});
  assert.equal(successfulDownload.status, 200);
  assert.equal(successfulDownload.text, 'Alpha fixture upload');
  assert.equal(successfulDownload.headers['content-disposition'].startsWith('attachment;'), true);
  assert.equal(successfulDownload.headers['x-content-type-options'], 'nosniff');
  assert.equal(successfulDownload.headers['content-security-policy'].includes('sandbox'), true);
  assert.equal((await f.request(endpoint(alpha, '/api/doc?path=resources/fixture.md'), {cookie: first.cookie})).status, 200);
  assert.equal((await f.request(endpoint(alpha, '/api/asset?path=resources/fixture.png'), {cookie: first.cookie})).status, 200);
  for (const route of ['/api/planner', '/api/bootstrap', '/api/doc?path=resources/fixture.md', '/api/asset?path=resources/fixture.png', '/api/assets', '/api/files', downloadRoute]) {
    assert.equal((await f.request(endpoint(alpha, route), {cookie: second.cookie})).status, 404, 'Other project content must remain inaccessible');
  }
  const forbiddenWrite = await f.request(endpoint(alpha, '/api/planner/tasks'), {method: 'POST', cookie: second.cookie, json: {revision: 1, title: 'Must never save'}});
  assert.equal(forbiddenWrite.status, 404);
  assert.equal((await f.request(endpoint(alpha, '/api/planner'), {cookie: first.cookie})).body.tasks.length, 1);
  const listed = await f.request('/api/launchroom/projects', {cookie: second.cookie});
  assert.equal(listed.body.projects.some(project => project.id === alpha.id), false);
  assert.equal(listed.body.projects.every(project => !Object.hasOwn(project, 'root')), true);
  assert.equal(listed.body.projects.some(project => project.id === 'shared'), true);

  const sharing = await f.request(`/api/launchroom/projects/${alpha.id}/members`, {method: 'POST', cookie: admin.cookie, json: {userIds: [first.user.id, second.user.id]}});
  assert.equal(sharing.status, 200);
  assert.equal((await f.request(endpoint(alpha, '/api/planner'), {cookie: second.cookie})).status, 200);
  const unshared = await f.request(`/api/launchroom/projects/${alpha.id}/members`, {method: 'POST', cookie: admin.cookie, json: {userIds: [first.user.id]}});
  assert.equal(unshared.status, 200);
  assert.equal((await f.request(endpoint(alpha, downloadRoute), {cookie: second.cookie})).status, 404);
  const sharedUpload = await f.request('/p/shared/api/files/upload?name=shared.txt', {method: 'POST', cookie: first.cookie, raw: 'Shared fixture upload', headers: {'Content-Type': 'text/plain'}});
  assert.equal(sharedUpload.status, 201);
  const sharedFiles = await f.request('/p/shared/api/files', {cookie: second.cookie});
  assert.equal(sharedFiles.status, 200);
  assert.equal(sharedFiles.body.files[0].uploadedBy, first.user.id);
  const sharedDownload = await f.request(`/p/shared/api/files/download?path=${encodeURIComponent(sharedUpload.body.path)}`, {cookie: second.cookie});
  assert.equal(sharedDownload.status, 200);
  assert.equal(sharedDownload.text, 'Shared fixture upload');
});

test('HTTP admin invitation and revocation controls cannot be replaced by client-supplied authority', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const member = await f.member(admin);
  assert.equal(member.user.role, 'member');
  const users = await f.request('/api/launchroom/users', {cookie: admin.cookie});
  assert.equal(users.status, 200);
  assert.equal(users.body.users.length, 2);
  assert.equal(users.text.includes('password'), false);
  assert.equal(users.text.includes(member.password), false);
  const attribution = await createLaunchroomAuth({dataDir: path.join(f.root, 'os/private/launchroom')});
  const names = await attribution.displayNames([member.user.id, '11111111-1111-4111-8111-111111111111']);
  assert.deepEqual(Object.keys(names), [member.user.id]);
  assert.equal(names[member.user.id], member.user.name);
  await assert.rejects(attribution.displayNames(['not-a-user-id']), error => error.code === 'INVALID_INPUT');
  for (const [route, json] of [
    ['/api/launchroom/invites', {name: 'Unauthorized', username: 'unauthorized', role: 'admin', actor: admin.user}],
    ['/api/launchroom/users/revoke', {userId: admin.user.id, actor: admin.user}],
    ['/api/launchroom/projects/merrivy/members', {userIds: [member.user.id], actor: admin.user}],
  ]) assert.equal((await f.request(route, {method: 'POST', cookie: member.cookie, json})).status, 403);
  assert.equal((await f.request('/api/launchroom/users', {cookie: member.cookie})).status, 403);
  const replay = await f.request('/api/launchroom/accept-invite', {method: 'POST', json: {token: member.invitation, password: password()}});
  assert.equal(replay.status, 400);
  const badInvite = await f.request('/api/launchroom/accept-invite', {method: 'POST', json: {token: randomBytes(32).toString('base64url'), password: password()}});
  assert.equal(badInvite.status, 400);
  const lastAdmin = await f.request('/api/launchroom/users/revoke', {method: 'POST', cookie: admin.cookie, json: {userId: admin.user.id}});
  assert.equal(lastAdmin.status, 409);
  const revoked = await f.request('/api/launchroom/users/revoke', {method: 'POST', cookie: admin.cookie, json: {userId: member.user.id}});
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.disabled, true);
  assert.equal((await attribution.displayNames([member.user.id]))[member.user.id], member.user.name, 'Historical upload attribution survives revocation');
  assert.equal((await f.request('/api/launchroom/session', {cookie: member.cookie})).body.user, null);
  assert.equal((await f.request('/api/launchroom/projects', {cookie: member.cookie})).status, 401);
  assert.equal((await f.request('/p/shared/api/files', {cookie: member.cookie})).status, 401);
  assert.equal((await f.request('/api/launchroom/login', {method: 'POST', json: {username: member.user.username, password: member.password}})).status, 401);
});

test('HTTP root APIs require the explicit local-agent request and scoped process execution remains disabled', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const agent = {'X-Launchroom-Local-Agent': '1'};
  assert.equal((await f.request('/api/planner', {browser: false})).status, 401);
  assert.equal((await f.request('/api/planner', {cookie: admin.cookie})).status, 403);
  assert.equal((await f.request('/api/planner', {cookie: admin.cookie, browser: false, headers: agent})).status, 403);
  assert.equal((await f.request('/api/planner', {headers: agent})).status, 401);
  const allowed = await f.request('/api/planner', {browser: false, headers: agent});
  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.body, {revision: 0, tasks: []});
  const written = await f.request('/api/planner/tasks', {method: 'POST', browser: false, headers: agent, json: {revision: 0, title: 'Local agent fixture task'}});
  assert.equal(written.status, 200);
  assert.equal(written.body.tasks[0].title, 'Local agent fixture task');
  const missingOrigin = await f.request('/api/planner/tasks', {method: 'POST', browser: false, origin: false, headers: agent, json: {revision: 1, title: 'Must not save'}});
  assert.equal(missingOrigin.status, 403);
  const invite = await f.request('/api/launchroom/invites', {method: 'POST', browser: false, headers: agent, json: {name: 'Agent-created user', username: 'agent-created'}});
  assert.equal(invite.status, 403);
  for (const [route, method] of [['/api/runs', 'POST'], ['/api/runs/fixture', 'GET'], ['/api/runs/fixture/stop', 'POST'], ['/api/scripts', 'GET'], ['/api/scripts/test', 'POST']]) {
    const response = await f.request(`/p/merrivy${route}`, {method, cookie: admin.cookie, ...(method === 'POST' ? {json: {}} : {})});
    assert.equal(response.status, 403);
  }
  const runtime = await f.request('/p/merrivy/api/runtime', {cookie: admin.cookie});
  assert.equal(runtime.status, 200);
  assert.equal(runtime.body.available, false);
  assert.deepEqual((await f.request('/p/merrivy/api/runs', {cookie: admin.cookie})).body, {runs: []});
});
