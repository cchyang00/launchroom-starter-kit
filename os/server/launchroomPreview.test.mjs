// Inline file preview (Launchroom UI, Oct 1): membership, types, paths, ranges and the
// recovery bin. Isolated temporary workspaces only; test passwords are random per run.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createLaunchroom, byteRange} from './launchroom.mjs';
import {LAUNCHROOM_TEXT_PREVIEW} from './launchroomProjects.mjs';

const ORIGIN = 'http://localhost:3000';
const password = () => `fixture-${randomBytes(18).toString('base64url')}`;
const sessionCookie = response => response.headers['set-cookie']?.[0]?.split(';')[0];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY5sAAAAASUVORK5CYII=', 'base64');
// The smallest box the upload signature check accepts as MP4 (size, then "ftyp").
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(12), Buffer.from('fixture-video-bytes-0123456789')]);
const PDF = Buffer.from('%PDF-1.4\n%fixture\n');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'launchroom-preview-'));
  let server;
  t.after(async () => {
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    assert.ok(path.basename(root).startsWith('launchroom-preview-'));
    await fs.rm(root, {recursive: true, force: true});
  });
  const gateway = await createLaunchroom({workspaceRoot: root, port: 3000});
  server = http.createServer((req, res) => {
    Promise.resolve(gateway(req, res, () => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<!doctype html><title>shell</title>'); }))
      .catch(() => { if (res.headersSent) res.destroy(); else { res.writeHead(500); res.end(); } });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  function request(route, {method = 'GET', cookie, json, raw, headers = {}} = {}) {
    const data = json === undefined ? raw : JSON.stringify(json);
    const h = {Host: 'localhost:3000', 'Sec-Fetch-Site': 'same-origin', ...(method === 'POST' ? {Origin: ORIGIN} : {}), ...(cookie ? {Cookie: cookie} : {}),
      ...(json === undefined ? {} : {'Content-Type': 'application/json'}), ...(data === undefined ? {} : {'Content-Length': Buffer.byteLength(data)}), ...headers};
    return new Promise((resolve, reject) => {
      const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: h, agent: false}, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.once('end', () => { const buf = Buffer.concat(chunks); let body = null; try { body = JSON.parse(buf.toString('utf8')); } catch {} resolve({status: res.statusCode, headers: res.headers, body, buf}); });
      });
      req.once('error', reject);
      req.end(data);
    });
  }
  const secret = password();
  const setup = await request('/api/launchroom/setup', {method: 'POST', json: {name: 'Fixture Owner', username: 'fixture-owner', password: secret}});
  assert.equal(setup.status, 201);
  const owner = {cookie: sessionCookie(setup), user: setup.body.user};
  async function member(username) {
    const invite = await request('/api/launchroom/invites', {method: 'POST', cookie: owner.cookie, json: {name: `Fixture ${username}`, username}});
    const memberSecret = password();
    const accepted = await request('/api/launchroom/accept-invite', {method: 'POST', json: {token: invite.body.token, password: memberSecret}});
    assert.equal(accepted.status, 201);
    assert.equal(accepted.body.username, username, 'Accepting an invitation returns the new username for the sign-in screen');
    const login = await request('/api/launchroom/login', {method: 'POST', json: {username, password: memberSecret}});
    return {cookie: sessionCookie(login), user: login.body.user};
  }
  async function upload(project, actor, name, body, folder = '') {
    const r = await request(`/p/${project}/api/files/upload?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, {method: 'POST', cookie: actor.cookie, raw: body, headers: {'Content-Type': 'application/octet-stream'}});
    assert.equal(r.status, 201, `upload ${name}: ${JSON.stringify(r.body)}`);
    return r.body;
  }
  const preview = (project, actor, query, headers) => request(`/p/${project}/api/files/preview?${query}`, {cookie: actor?.cookie, headers});
  return {root, request, owner, member, upload, preview};
}

test('byteRange reads one simple range and refuses what cannot be satisfied', () => {
  assert.deepEqual(byteRange('bytes=0-9', 100), {start: 0, end: 9});
  assert.deepEqual(byteRange('bytes=90-', 100), {start: 90, end: 99});
  assert.deepEqual(byteRange('bytes=-10', 100), {start: 90, end: 99});
  assert.deepEqual(byteRange('bytes=50-500', 100), {start: 50, end: 99});
  assert.equal(byteRange('bytes=100-', 100), 'unsatisfiable');
  assert.equal(byteRange('bytes=-0', 100), 'unsatisfiable');
  for (const ignored of [undefined, '', 'bytes=0-1,4-5', 'items=0-1', 'bytes=-', 'bytes=a-b']) assert.equal(byteRange(ignored, 100), null);
});

test('preview serves members images and videos inline with safe headers and byte ranges', async t => {
  const f = await fixture(t);
  const alice = await f.member('alice-fixture');
  const bob = await f.member('bob-fixture');
  const alpha = (await f.request('/api/launchroom/projects', {method: 'POST', cookie: alice.cookie, json: {name: 'Alpha preview'}})).body;
  const image = await f.upload(alpha.id, alice, 'Mood board.png', PNG);
  const video = await f.upload(alpha.id, alice, 'Clip.mp4', MP4);

  const shown = await f.preview(alpha.id, alice, `path=${encodeURIComponent(image.path)}`);
  assert.equal(shown.status, 200);
  assert.equal(shown.headers['content-type'], 'image/png');
  assert.equal(shown.headers['x-content-type-options'], 'nosniff');
  assert.equal(shown.headers['content-security-policy'], "sandbox; default-src 'none'");
  assert.match(shown.headers['cache-control'], /^private/);
  assert.match(shown.headers['content-disposition'], /^inline;/);
  assert.ok(shown.buf.equals(PNG));
  const head = await f.request(`/p/${alpha.id}/api/files/preview?path=${encodeURIComponent(image.path)}`, {method: 'HEAD', cookie: alice.cookie});
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers['content-length']), PNG.length);

  const full = await f.preview(alpha.id, alice, `path=${encodeURIComponent(video.path)}`);
  assert.equal(full.status, 200);
  assert.equal(full.headers['content-type'], 'video/mp4');
  assert.equal(full.headers['accept-ranges'], 'bytes');
  const part = await f.preview(alpha.id, alice, `path=${encodeURIComponent(video.path)}`, {Range: 'bytes=4-11'});
  assert.equal(part.status, 206);
  assert.equal(part.headers['content-range'], `bytes 4-11/${MP4.length}`);
  assert.equal(part.buf.toString('ascii'), 'ftypisom');
  const beyond = await f.preview(alpha.id, alice, `path=${encodeURIComponent(video.path)}`, {Range: `bytes=${MP4.length}-`});
  assert.equal(beyond.status, 416);
  assert.equal(beyond.headers['content-range'], `bytes */${MP4.length}`);

  // Signed out, a non-member and the shared library's rules.
  assert.equal((await f.preview(alpha.id, null, `path=${encodeURIComponent(image.path)}`)).status, 401);
  const denied = await f.preview(alpha.id, bob, `path=${encodeURIComponent(image.path)}`);
  assert.equal(denied.status, 404);
  assert.equal(denied.buf.includes(PNG), false);
  const shared = await f.upload('shared', alice, 'Shared look.png', PNG);
  assert.equal((await f.preview('shared', bob, `path=${encodeURIComponent(shared.path)}`)).status, 200, 'Every signed-in member may preview the shared library');
});

test('preview returns text files as bounded JSON text and refuses download-only types', async t => {
  const f = await fixture(t);
  const notes = await f.upload('merrivy', f.owner, 'Call notes.md', '# Notes\n\n<b>not html</b> and an emoji \u{1F4E6}\n');
  const csv = await f.upload('merrivy', f.owner, 'Costs.csv', 'item,cost\nboots,18.40\n');
  const long = await f.upload('merrivy', f.owner, 'Long.txt', `${'é'.repeat(LAUNCHROOM_TEXT_PREVIEW)}tail`);
  const pdf = await f.upload('merrivy', f.owner, 'Guide.pdf', PDF);

  const md = await f.preview('merrivy', f.owner, `path=${encodeURIComponent(notes.path)}`);
  assert.equal(md.status, 200);
  assert.match(md.headers['content-type'], /^application\/json/);
  assert.equal(md.body.text, '# Notes\n\n<b>not html</b> and an emoji \u{1F4E6}\n');
  assert.equal(md.body.truncated, false);
  assert.equal(md.body.name, 'Call notes.md');
  assert.equal((await f.preview('merrivy', f.owner, `path=${encodeURIComponent(csv.path)}`)).body.text, 'item,cost\nboots,18.40\n');
  const cut = await f.preview('merrivy', f.owner, `path=${encodeURIComponent(long.path)}`);
  assert.equal(cut.body.truncated, true);
  assert.ok(Buffer.byteLength(cut.body.text) <= LAUNCHROOM_TEXT_PREVIEW);
  assert.equal(cut.body.text.includes('�'), false, 'A character cut by the limit is held back, not garbled');

  const refused = await f.preview('merrivy', f.owner, `path=${encodeURIComponent(pdf.path)}`);
  assert.equal(refused.status, 415);
  assert.equal(refused.body.code, 'NOT_PREVIEWABLE');
  const download = await f.request(`/p/merrivy/api/files/download?path=${encodeURIComponent(pdf.path)}`, {cookie: f.owner.cookie});
  assert.equal(download.status, 200, 'Download-only types still download');
});

test('preview refuses traversal, encoded, private and unknown paths', async t => {
  const f = await fixture(t);
  await f.upload('merrivy', f.owner, 'Kept.png', PNG);
  await fs.mkdir(path.join(f.root, 'resources'), {recursive: true});
  await fs.writeFile(path.join(f.root, 'resources', 'outside.txt'), 'outside the upload registry');
  for (const query of [
    'path=..%2F..%2Fos%2Fprivate%2Flaunchroom%2Fauth%2Fauth.json',
    'path=os%2Fprivate%2Flaunchroom%2Fauth%2Fauth.json',
    'path=..%2Fresources%2Foutside.txt',
    'path=%2E%2E%2F%2E%2E%2Fresources%2Foutside.txt',
    'path=resources%5Coutside.txt',
    'path=C%3A%5CWindows%5Cwin.ini',
    'path=%2Fetc%2Fpasswd',
    'path=Kept.png%3A%3A%24DATA',
    'path=',
    '',
    'path=x&removed=not-a-uuid',
    'removed=11111111-1111-4111-8111-111111111111',
  ]) {
    const r = await f.preview('merrivy', f.owner, query);
    assert.ok([400, 404].includes(r.status), `${query} -> ${r.status}`);
    assert.equal(r.buf.toString('utf8').includes('outside the upload registry'), false);
    assert.equal(r.buf.toString('utf8').includes('"sessions"'), false);
  }
  assert.equal((await f.request('/p/merrivy/api/files/preview%2F..%2Fdownload', {cookie: f.owner.cookie})).status, 400, 'Encoded route paths are refused before routing');
  assert.equal((await f.request('/p/merrivy/api/files/preview', {method: 'POST', cookie: f.owner.cookie, json: {}})).status !== 200, true);
});

test('a removed file previews only from the Removed view, and restore brings its path back', async t => {
  const f = await fixture(t);
  const viewer = await f.member('viewer-fixture');
  const kept = await f.upload('merrivy', f.owner, 'Kept.png', PNG);
  const removed = await f.request('/p/merrivy/api/files/remove', {method: 'POST', cookie: f.owner.cookie, json: {path: kept.path}});
  assert.equal(removed.status, 200);
  assert.equal((await f.preview('merrivy', f.owner, `path=${encodeURIComponent(kept.path)}`)).status, 404, 'A removed path is not previewable');
  const fromBin = await f.preview('merrivy', f.owner, `removed=${kept.id}`);
  assert.equal(fromBin.status, 200);
  assert.ok(fromBin.buf.equals(PNG));
  assert.equal((await f.preview('merrivy', viewer, `removed=${kept.id}`)).status, 404, 'A non-member cannot open the bin');
  assert.equal((await f.preview('merrivy', f.owner, `removed=${kept.id}&path=${encodeURIComponent(kept.path)}`)).status, 400);
  const restored = await f.request('/p/merrivy/api/files/restore', {method: 'POST', cookie: f.owner.cookie, json: {id: kept.id}});
  assert.equal(restored.status, 200);
  assert.equal((await f.preview('merrivy', f.owner, `removed=${kept.id}`)).status, 404);
  assert.equal((await f.preview('merrivy', f.owner, `path=${encodeURIComponent(kept.path)}`)).status, 200);
});
