import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHub } from './hub.mjs';

// Valid one-second 16x16 VP8/WebM transport fixture, generated with FFmpeg.
// It is written only into isolated test directories, never the actual library.
const WEBM_FIXTURE = Buffer.from('GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwH/////////EU2bdKtNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEj7AEAAAAAAABoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjMuMS4xMDBXQYxMYXZmNjMuMS4xMDBEiYhAj0AAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIORpVb7ZQeAecgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4Q7msoA4JCwgRC6gRCagQJVsIRVuYEBElTDZ9Zzc59jwIBnyJlFo4dFTkNPREVSRIeMTGF2ZjYzLjEuMTAwc3OxY8CLY8WIORpVb7ZQeAdnyKBFo4dFTkNPREVSRIeTTGF2YzYzLjEuMTAwIGxpYnZweB9DtnWo54EAo6OBAACAEAIAnQEqEAAQAABHCIWFiJmEiAICAAwNYAD+/6tQgA==', 'base64');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-hub-'));
  let middleware;
  const server = http.createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  middleware = await createHub({ workspaceRoot: root, port });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${port}`;
  async function request(route, method = 'GET', data, headers = {}) {
    const response = await fetch(`${origin}${route}`, { method, headers: { ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' }), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
    const bytes = Buffer.from(await response.arrayBuffer()); const text = bytes.toString('utf8'); let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body, headers: response.headers, bytes };
  }
  async function file(relative, contents) { const absolute = path.join(root, relative); await fs.mkdir(path.dirname(absolute), { recursive: true }); await fs.writeFile(absolute, contents); return absolute; }
  return { root, port, request, file, restart: async () => { middleware = await createHub({ workspaceRoot: root, port }); } };
}

test('hub separates production assets from reference media without cataloguing course frames or synthetic products', async t => {
  const f = await fixture(t);
  await f.file('products/P001/assets/hero.png', 'product');
  await f.file('store/assets/logo.png', 'store');
  await f.file('products/P001/discovery-screenshot.png', 'uncurated research');
  await f.file('products/P009-synthetic/os-product.json', JSON.stringify({ synthetic: true }));
  await f.file('products/P009-synthetic/assets/example.png', 'synthetic');
  await f.file('agents/image-generator/references/layouts/static_01.png', 'reference');
  await f.file('agents/image-generator/sandbox/trial/hero.webp', 'example');
  await f.file('agents/validation/skills/research-products/references/cases/demo.png', 'case');
  await f.file('resources/demonstrations/transport.webm', WEBM_FIXTURE);
  await f.file('guides/rippy-club/frames/frame.png', 'frame');
  await f.file('products/P001/notes.md', '# Notes');
  const result = await f.request('/api/hub');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.maps, []);
  assert.equal(result.body.assets.length, 2);
  assert.deepEqual(new Set(result.body.assets.map(a => a.category)), new Set(['Product assets', 'Store assets']));
  assert.equal(result.body.assets.find(a => a.scope === 'product').productId, 'P001');
  assert.equal(result.body.assets.find(a => a.scope === 'store').productId, undefined);
  assert.equal(result.body.resourceMedia.length, 4);
  assert.deepEqual(new Set(result.body.resourceMedia.map(a => a.category)), new Set(['Creative references', 'Layout examples', 'Research references', 'Shared resources']));
  assert.ok(result.body.resourceMedia.every(a => a.scope === 'resource' && a.productId === undefined));
  assert.equal(result.body.resourceMedia.find(a => a.name === 'transport.webm').kind, 'video');
  assert.ok(result.body.assets.every(a => a.kind === 'image'));
  assert.ok([...result.body.assets, ...result.body.resourceMedia].every(a => !a.path.startsWith('guides/') && !a.path.includes('P009-synthetic') && !a.path.includes('discovery-screenshot')));
  assert.ok(result.body.assets.every(a => a.size > 0 && Number.isFinite(Date.parse(a.modifiedAt))));
  assert.ok(result.body.folders.some(f => f.path === 'guides/rippy-club/INDEX.md'));
  await assert.rejects(fs.stat(path.join(f.root, 'os/data/maps.json')), { code: 'ENOENT' });
  const image = await f.request('/api/asset?path=guides%2Frippy-club%2Fframes%2Fframe.png');
  assert.equal(image.status, 200); assert.equal(image.body, 'frame');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.match(image.headers.get('content-disposition'), /frame.png/);
});

test('hub read routes require a local Host even when the connection reaches loopback', async t => {
  const f = await fixture(t);
  await f.file('resources/sample.png', 'sample');
  const requestWithHost = (route, host) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: f.port, path: route, method: 'GET', headers: { Host: host } }, res => {
      res.resume(); res.once('end', () => resolve(res.statusCode));
    });
    req.once('error', reject); req.end();
  });
  for (const route of ['/api/hub', '/api/maps', '/api/asset?path=resources/sample.png']) {
    assert.equal(await requestWithHost(route, `attacker.example:${f.port}`), 403, route);
    assert.equal(await requestWithHost(route, `localhost:${f.port}`), 200, route);
  }
});

test('media streaming serves exact bytes, HEAD and single open/suffix ranges for playable WebM files', async t => {
  const f = await fixture(t); await f.file('resources/video/clip.webm', WEBM_FIXTURE);
  const route = '/api/asset?path=resources/video/clip.webm';
  const full = await f.request(route); assert.equal(full.status, 200); assert.deepEqual(full.bytes, WEBM_FIXTURE);
  assert.equal(full.headers.get('content-type'), 'video/webm'); assert.equal(full.headers.get('accept-ranges'), 'bytes'); assert.equal(Number(full.headers.get('content-length')), WEBM_FIXTURE.length);
  const partial = await f.request(route, 'GET', undefined, { Range: 'bytes=0-15' });
  assert.equal(partial.status, 206); assert.deepEqual(partial.bytes, WEBM_FIXTURE.subarray(0, 16)); assert.equal(partial.headers.get('content-range'), `bytes 0-15/${WEBM_FIXTURE.length}`); assert.equal(partial.headers.get('content-length'), '16');
  const suffix = await f.request(route, 'GET', undefined, { Range: 'bytes=-10' }); assert.equal(suffix.status, 206); assert.deepEqual(suffix.bytes, WEBM_FIXTURE.subarray(-10));
  const open = await f.request(route, 'GET', undefined, { Range: 'bytes=100-' }); assert.equal(open.status, 206); assert.deepEqual(open.bytes, WEBM_FIXTURE.subarray(100));
  const head = await f.request(route, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.bytes.length, 0); assert.equal(Number(head.headers.get('content-length')), WEBM_FIXTURE.length);
  for (const range of ['bytes=999999-', 'bytes=10-5', 'bytes=-0', 'bytes=0-2,4-8', 'bytes=-', 'items=0-3']) {
    const rejected = await f.request(route, 'GET', undefined, { Range: range }); assert.equal(rejected.status, 416); assert.equal(rejected.headers.get('content-range'), `bytes */${WEBM_FIXTURE.length}`);
  }
});

test('video allowlist rejects traversal, unsupported files and oversize resources while keeping direct guide reads', async t => {
  const f = await fixture(t); await f.file('guides/rippy-club/evidence/clip.webm', WEBM_FIXTURE);
  const direct = await f.request('/api/asset?path=guides/rippy-club/evidence/clip.webm', 'GET', undefined, { Range: 'bytes=0-7' }); assert.equal(direct.status, 206); assert.deepEqual(direct.bytes, WEBM_FIXTURE.subarray(0, 8));
  for (const relative of ['resources/../private/clip.webm', 'resources/.. /private/clip.webm', 'resources\\clip.webm', '/resources/clip.webm']) assert.equal((await f.request(`/api/asset?path=${encodeURIComponent(relative)}`)).status, 400);
  for (const relative of ['os/data/log.webm', 'resources/secret.txt']) assert.equal((await f.request(`/api/asset?path=${encodeURIComponent(relative)}`)).status, 403);
  const huge = await f.file('resources/too-large.mp4', ''); await fs.truncate(huge, 250 * 1024 * 1024 + 1);
  assert.equal((await f.request('/api/asset?path=resources/too-large.mp4', 'HEAD')).status, 413);
  const listed = await f.request('/api/hub'); assert.equal(listed.body.assets.length, 0); assert.equal(listed.body.resourceMedia.length, 0);
});

test('asset allowlist rejects traversal, unsupported types, oversize and symlink escapes', async t => {
  const f = await fixture(t);
  await f.file('private/secret.png', 'private');
  await f.file('products/notes.md', 'secret');
  for (const relative of ['private/secret.png', 'products/notes.md']) assert.equal((await f.request(`/api/asset?path=${encodeURIComponent(relative)}`)).status, 403);
  for (const relative of ['products/../private/secret.png', 'products\\..\\private\\secret.png', '/products/hero.png', 'products/./hero.png']) assert.equal((await f.request(`/api/asset?path=${encodeURIComponent(relative)}`)).status, 400);
  const huge = await f.file('products/huge.png', ''); await fs.truncate(huge, 25 * 1024 * 1024 + 1);
  assert.equal((await f.request('/api/asset?path=products/huge.png')).status, 413);
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-outside-'));
  t.after(() => fs.rm(external, { recursive: true, force: true }));
  await fs.writeFile(path.join(external, 'secret.png'), 'outside');
  try { await fs.symlink(external, path.join(f.root, 'products/escape'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (e) { if (['EPERM', 'EACCES'].includes(e.code)) { t.diagnostic('Symlink unavailable in this environment.'); return; } throw e; }
  assert.equal((await f.request('/api/asset?path=products/escape/secret.png')).status, 403);
  assert.deepEqual((await f.request('/api/hub')).body.assets, []);
});

test('maps persist across middleware instances, enforce revisions and preserve edge identity', async t => {
  const f = await fixture(t);
  let response = await f.request('/api/maps', 'POST', { title: 'Research questions' });
  assert.equal(response.status, 201);
  let map = response.body; assert.equal(map.revision, 1); assert.deepEqual(map.nodes, []);
  const route = `/api/maps/${map.id}`;
  const update = async value => { const response = await f.request(route, 'PATCH', { revision: map.revision, ...value }); assert.equal(response.status, 200, JSON.stringify(response.body)); map = response.body; };
  await update({ node: { title: 'Who buys?', note: '', x: 0, y: 0, kind: 'question' } });
  const a = map.nodes[0].id;
  await update({ node: { title: 'Find evidence', x: 200, y: 100, kind: 'action', productId: 'P001' } });
  const b = map.nodes[1].id;
  await update({ edge: { from: a, to: b } });
  await update({ edge: { from: a, to: b } }); assert.equal(map.edges.length, 1);
  await update({ node: { id: a, title: 'Actual buyer situation', x: 20, y: 30, kind: 'idea' } });
  assert.equal(map.nodes.length, 2); assert.deepEqual(map.edges, [{ from: a, to: b }]);
  assert.equal((await f.request(route, 'PATCH', { revision: map.revision, edge: { from: a, to: 'missing' } })).status, 400);
  assert.equal((await f.request(route, 'PATCH', { revision: 1, title: 'Stale overwrite' })).status, 409);
  await f.restart(); assert.deepEqual((await f.request('/api/maps')).body.maps, [map]);
  await update({ removeEdge: { from: a, to: b } }); assert.deepEqual(map.edges, []);
  await update({ edge: { from: a, to: b } });
  await update({ removeNode: a }); assert.equal(map.nodes.length, 1); assert.deepEqual(map.edges, []);
});

test('serialized concurrent edits cannot both overwrite the same revision', async t => {
  const f = await fixture(t);
  const map = (await f.request('/api/maps', 'POST', { title: 'Concurrency' })).body;
  const results = await Promise.all(['A', 'B'].map(title => f.request(`/api/maps/${map.id}`, 'PATCH', { revision: 1, title })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await f.request('/api/maps')).body.maps[0].revision, 2);
});

test('mutations require local matching Origin and JSON; malformed saved data is preserved', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/maps', 'POST', { title: 'Bad' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request('/api/maps', 'POST', { title: 'Bad' }, { Origin: '' })).status, 403);
  assert.equal((await f.request('/api/maps', 'POST', { title: 'Bad' }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.request('/api/maps', 'POST', { title: 'a'.repeat(140000) })).status, 413);
  assert.equal((await f.request('/api/maps', 'POST', { title: '' })).status, 400);
  const filename = await f.file('os/data/maps.json', '{broken-json');
  const result = await f.request('/api/maps', 'POST', { title: 'Must not replace' });
  assert.equal(result.status, 500); assert.match(result.body.error, /malformed/);
  assert.equal(await fs.readFile(filename, 'utf8'), '{broken-json');
  await fs.writeFile(filename, JSON.stringify([{ id: 'bad', title: 'Corrupt schema' }]));
  assert.equal((await f.request('/api/maps')).status, 500);
});

test('map and node limits reject growth without changing saved data', async t => {
  const f = await fixture(t);
  const map = (await f.request('/api/maps', 'POST', { title: 'Limits' })).body;
  map.nodes = Array.from({ length: 100 }, (_, i) => ({ id: `node-${i}`, title: `Idea ${i}`, note: '', x: i, y: 0, kind: 'idea' }));
  const maps = Array.from({ length: 50 }, (_, i) => ({ ...map, id: `map-${i}` }));
  const filename = await f.file('os/data/maps.json', JSON.stringify(maps));
  const before = await fs.readFile(filename, 'utf8');
  assert.equal((await f.request('/api/maps', 'POST', { title: 'Extra' })).status, 409);
  assert.equal((await f.request('/api/maps/map-0', 'PATCH', { revision: 1, node: { title: 'Extra', x: 0, y: 0, kind: 'idea' } })).status, 409);
  assert.equal(await fs.readFile(filename, 'utf8'), before);
});

test('full graph replacement persists agent workflow annotations and positions without asserting evidence', async t => {
  const f = await fixture(t);
  const evidenceFile = await f.file('products/P001-item/os-product.json', '{"checks":{}}');
  const map = (await f.request('/api/maps', 'POST', { title: 'Working process' })).body;
  const nodes = [
    { id: 'agent-manager', title: 'Manager', kind: 'agent', status: 'in-progress', role: 'manager', reference: 'agents/manager/AGENTS.md', x: 0, y: 0 },
    { id: 'stage-research', title: 'Research', kind: 'stage', x: 250, y: 0 },
    { id: 'evidence-source', title: 'Exact source', kind: 'evidence', status: 'verified', reference: 'https://www.aliexpress.com/item/123.html', x: 500, y: -80 },
    { id: 'decision-park', title: 'Destination quote missing', kind: 'decision', status: 'blocked', role: 'validation', note: 'Map annotation only; obtain the actual supplier quote.', x: 500, y: 100 },
  ];
  const edges = [{ from: 'agent-manager', to: 'stage-research' }, { from: 'stage-research', to: 'evidence-source' }, { from: 'stage-research', to: 'decision-park' }];
  let saved = await f.request(`/api/maps/${map.id}`, 'PATCH', { revision: 1, nodes, edges });
  assert.equal(saved.status, 200, JSON.stringify(saved.body)); assert.equal(saved.body.revision, 2); assert.deepEqual(saved.body.edges, edges);
  assert.equal(saved.body.nodes[1].status, 'open'); assert.equal(saved.body.nodes[0].role, 'manager'); assert.equal(saved.body.nodes[2].status, 'verified');
  assert.equal(await fs.readFile(evidenceFile, 'utf8'), '{"checks":{}}');
  await f.restart(); assert.deepEqual((await f.request('/api/maps')).body.maps[0], saved.body);
  saved = await f.request(`/api/maps/${map.id}`, 'PATCH', { revision: 2, node: { id: 'agent-manager', x: 45, y: -50 } });
  assert.equal(saved.status, 200); assert.equal(saved.body.nodes[0].x, 45); assert.equal(saved.body.nodes[0].status, 'in-progress'); assert.equal(saved.body.nodes[0].reference, 'agents/manager/AGENTS.md');
});

test('invalid graph replacement is atomic and rejects unsafe references, duplicate IDs and dangling edges', async t => {
  const f = await fixture(t); const map = (await f.request('/api/maps', 'POST', { title: 'Safe graph' })).body;
  const route = `/api/maps/${map.id}`; const filename = path.join(f.root, 'os/data/maps.json');
  const node = { id: 'source', title: 'Source', kind: 'evidence', x: 0, y: 0 };
  const before = await fs.readFile(filename, 'utf8');
  const invalid = [
    { nodes: [node] },
    { nodes: [node], edges: [], node },
    { nodes: [node, node], edges: [] },
    { nodes: [{ ...node, id: undefined }], edges: [] },
    { nodes: [node], edges: [{ from: 'source', to: 'missing' }] },
    { nodes: [node], edges: [{ from: 'source', to: 'source' }] },
    { nodes: [node, { ...node, id: 'other' }], edges: [{ from: 'source', to: 'other' }, { from: 'source', to: 'other' }] },
    ...[{ status: 'completed' }, { kind: 'script' }, { role: 'external-agent' }, { x: 100001 }].map(change => ({ nodes: [{ ...node, ...change }], edges: [] })),
    ...['javascript:alert(1)', 'https://owner:secret@example.com', '../private.md', 'store/../AGENTS.md', 'store/screenshot.png', 'os/data/maps.json', 'store/.. /outside.md'].map(reference => ({ nodes: [{ ...node, reference }], edges: [] })),
  ];
  for (const graph of invalid) {
    const response = await f.request(route, 'PATCH', { revision: 1, title: 'Must not persist', ...graph });
    assert.equal(response.status, 400, JSON.stringify({ graph, response }));
    assert.equal(await fs.readFile(filename, 'utf8'), before);
  }
});

test('full graph replacement enforces limits and revision races without overwriting the winning graph', async t => {
  const f = await fixture(t); const map = (await f.request('/api/maps', 'POST', { title: 'Graph concurrency' })).body;
  const route = `/api/maps/${map.id}`; const node = index => ({ id: `node-${index}`, title: `Stage ${index}`, kind: 'stage', x: index * 5, y: 0 });
  assert.equal((await f.request(route, 'PATCH', { revision: 1, nodes: Array.from({ length: 101 }, (_, i) => node(i)), edges: [] })).status, 409);
  const manyEdges = [];
  for (let from = 0; from < 23; from++) for (let to = 0; to < 23; to++) if (from !== to && manyEdges.length < 501) manyEdges.push({ from: `node-${from}`, to: `node-${to}` });
  assert.equal((await f.request(route, 'PATCH', { revision: 1, nodes: Array.from({ length: 23 }, (_, i) => node(i)), edges: manyEdges })).status, 409);
  const edits = await Promise.all([1, 2].map(index => f.request(route, 'PATCH', { revision: 1, nodes: [node(index)], edges: [] })));
  assert.deepEqual(edits.map(edit => edit.status).sort(), [200, 409]);
  assert.deepEqual((await f.request('/api/maps')).body.maps[0], edits.find(edit => edit.status === 200).body);
});

test('legacy maps default annotation to open without a read migration and reject linked reference paths', async t => {
  const f = await fixture(t); const map = (await f.request('/api/maps', 'POST', { title: 'Legacy map' })).body;
  map.nodes = [{ id: 'legacy', title: 'Existing question', kind: 'question', note: '', x: 0, y: 0 }];
  const filename = await f.file('os/data/maps.json', JSON.stringify([map])); const before = await fs.readFile(filename, 'utf8');
  assert.equal((await f.request('/api/maps')).body.maps[0].nodes[0].status, 'open'); assert.equal(await fs.readFile(filename, 'utf8'), before);
  await f.file('store/source.md', '# Original'); await fs.mkdir(path.join(f.root, 'agents'), { recursive: true });
  try { await fs.symlink(path.join(f.root, 'store'), path.join(f.root, 'agents/linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.diagnostic('Symlink creation unavailable.'); return; } throw error; }
  const response = await f.request(`/api/maps/${map.id}`, 'PATCH', { revision: 1, node: { id: 'legacy', reference: 'agents/linked/source.md' } });
  assert.equal(response.status, 403); assert.equal(await fs.readFile(filename, 'utf8'), before);
});
