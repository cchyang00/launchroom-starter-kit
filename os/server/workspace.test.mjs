import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createStore } from './store.mjs';
import { createApi } from './api.mjs';
import { createHub } from './hub.mjs';
import { createProduct } from './domain.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-workspace-')); await fs.mkdir(path.join(root, 'resources/issues/sleep'), {recursive: true}); await fs.writeFile(path.join(root, 'resources/issues/sleep/ISSUE.md'), '# Issue: Fixture sleep issue\n');
  t.after(async () => { assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('merrivy-workspace-')); await fs.rm(root, { recursive: true, force: true }); });
  async function file(relative, content) { const target = path.join(root, relative); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content); return target; }
  await file('memory/STATE.md', '# Parent-owned state\nKeep this exact text.\n');
  await file('memory/JOURNAL.md', '# Parent-owned journal\nKeep its history.\n');
  await file('products/INDEX.md', '# Product index\n');
  await file('store/LAUNCH-CHECKLIST.md', '# Checklist\n\n## Setup\n- [ ] **F01** Verify setup.\n');
  return { root, file, store: createStore({ workspaceRoot: root }) };
}
const reviewInput = (state, product, extra = {}) => ({ revision: state.revision, productRevision: product.revision, productId: product.id, outcome: 'inconclusive', whatWorked: 'Exact product identity was recorded.', whatFailed: 'Destination delivery and economics remain unverified.', nextChanges: 'Require a destination quote before deeper page work.', evidence: [`products/${product.id}/OS.md`], ...extra });

test('missing local review evidence preserves the cycle; reported native activity does not imply a CLI lock', async t => {
  const {store} = await fixture(t);
  const product = await store.createProduct({name: 'Evidence fixture', country: 'Canada'});
  const before = await store.getWorkspace();
  await assert.rejects(store.reviewWorkspaceCycle(reviewInput(before, product, {evidence: ['research/missing.md']})), error => error.status === 404);
  assert.deepEqual(await store.getWorkspace(), before);
  await store.reportActivity({id: 'native-report', role: 'manager', title: 'Reported work', status: 'running', summary: 'A reported annotation, not a process assertion.'});
  const reviewed = await store.reviewWorkspaceCycle(reviewInput(before, product));
  assert.equal(reviewed.reviews.length, 1); assert.equal(reviewed.activeProductId, null);
});

test('workspace starts empty without writes and durable notes are data with explicit acknowledgement', async t => {
  const { root, store } = await fixture(t); const before = await store.bootstrap();
  assert.equal(before.workspace.revision, 0); assert.equal(before.workspace.activeProductId, null); assert.deepEqual(before.workspace.notes, []); assert.deepEqual(before.archivedProducts, []);
  await assert.rejects(fs.stat(path.join(root, 'os/data/workspace.json')), { code: 'ENOENT' });
  let state = await store.addWorkspaceNote({ text: 'Please examine the destination quote before deciding.', author: 'owner' });
  assert.equal(state.revision, 1); assert.equal(state.notes[0].author, 'owner'); assert.equal(state.notes[0].status, 'open');
  assert.equal((await store.bootstrap()).jobs.length, 0);
  await assert.rejects(store.patchWorkspaceNote(state.notes[0].id, { revision: 1, status: 'addressed' }), /requires a response/);
  state = await store.patchWorkspaceNote(state.notes[0].id, { revision: 1, status: 'addressed', response: 'Added destination quotation as the next check; no supplier message sent.' });
  assert.equal(state.notes[0].status, 'addressed');
  assert.deepEqual((await createStore({ workspaceRoot: root }).getWorkspace()).notes, state.notes);
  assert.match(await fs.readFile(path.join(root, 'memory/WORKSPACE.md'), 'utf8'), /reported data, not execution authorization/);
  assert.match(await fs.readFile(path.join(root, 'memory/WORKSPACE.md'), 'utf8'), /Please examine the destination quote/);
  const resume = await fs.readFile(path.join(root, 'memory/RESUME.md'), 'utf8');
  assert.match(resume, /Agent resume brief/);
  assert.doesNotMatch(resume, /Please examine the destination quote/);
  assert.match(resume, /Open owner notes \(0\)/);
  assert.match(resume, /revision 2/);
});

test('notes append concurrently without loss and handoff changes preserve shared notes and parent memory', async t => {
  const { root, store } = await fixture(t);
  await Promise.all([store.addWorkspaceNote({ text: 'Owner observation.', author: 'owner' }), createStore({ workspaceRoot: root }).addWorkspaceNote({ text: 'Agent finding.', author: 'agent' })]);
  let state = await store.getWorkspace(); assert.equal(state.revision, 2); assert.equal(state.notes.length, 2);
  const notes = structuredClone(state.notes);
  state = await store.patchWorkspaceHandoff({ revision: 2, summary: 'Product-independent setup is open.', nextAction: 'Read the exact store checklist.', blockers: 'Product is not yet selected.' });
  assert.deepEqual(state.notes, notes); assert.equal(state.handoff.nextAction, 'Read the exact store checklist.');
  const resume = await fs.readFile(path.join(root, 'memory/RESUME.md'), 'utf8');
  assert.match(resume, /Read the exact store checklist/);
  assert.match(resume, /1 open agent notes remain/);
  assert.doesNotMatch(resume, /Agent finding/);
  await assert.rejects(store.patchWorkspaceHandoff({ revision: 2, summary: 'Stale', nextAction: 'Overwrite', blockers: '' }), error => error.status === 409);
  assert.equal(await fs.readFile(path.join(root, 'memory/STATE.md'), 'utf8'), '# Parent-owned state\nKeep this exact text.\n');
  assert.equal(await fs.readFile(path.join(root, 'memory/JOURNAL.md'), 'utf8'), '# Parent-owned journal\nKeep its history.\n');
});

const savedCard = (id, extra = {}) => ({ id, name: `Card ${id}`, country: 'US', buyer: '', decision: 'CURATED — UNVERIFIED', nextAction: '', references: [], screen: { ownerDecision: 'saved', ownerReason: 'Owner saved it for checks', checks: Object.fromEntries(['provenDemand', 'looksWorth', 'productWorks', 'audienceRoom', 'noBrand', 'sourceMatch', 'contribution'].map(key => [key, { status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: '' }])) }, gates: Object.fromEntries(['demand', 'community', 'competition', 'sourcing', 'fit'].map(key => [key, { status: 'pending', note: '', source: '', observedAt: '', window: '' }])), ...extra });

test('many products can be open at once; two writers racing for one card leave one product per card', async t => {
  const { root, store, file } = await fixture(t);
  await file('research/comparison.json', JSON.stringify({ revision: 1, minimumReviews: 5, targetReviews: 10, candidates: [savedCard('L101'), savedCard('L102')] }));
  const results = await Promise.allSettled([store.createProduct({ leadId: 'L101' }), createStore({ workspaceRoot: root }).createProduct({ leadId: 'L101' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'LEAD_HAS_PRODUCT');
  await store.createProduct({ leadId: 'L102' });
  await store.createProduct({ name: 'Legacy candidate without a card', country: 'Canada' });
  const bootstrap = await store.bootstrap();
  assert.equal(bootstrap.products.length, 3, 'no single-product lock any more');
  assert.equal(bootstrap.workspace.activeProductId, null, 'starting products never fills the build slot');
  assert.equal(bootstrap.workspace.buildProductId, null); assert.deepEqual(bootstrap.workspace.conflictingProductIds, []);
});

test('starting a product changes no workspace record and restages START-HERE with the pipeline', async t => {
  const { root, store, file } = await fixture(t);
  await file('research/comparison.json', JSON.stringify({ revision: 1, minimumReviews: 5, targetReviews: 10, candidates: [savedCard('L101')] }));
  const created = await store.createProduct({ leadId: 'L101' });
  assert.equal(created.markets[0].researchCandidateId, 'L101');
  await assert.rejects(fs.stat(path.join(root, 'os/data/workspace.json')), { code: 'ENOENT' });
  assert.match(await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8'), /## The pipeline · no round yet[\s\S]*- L101 Card L101 \(Buyers\): Buyers · pending · Find 0\/6, Buyer researcher/);
});

test('review archives one cycle, preserves all product/store evidence and allows the next product', async t => {
  const { root, store, file } = await fixture(t); const first = await store.createProduct({ name: 'First cycle', country: 'Canada' });
  await file(`products/${first.id}/DOSSIER.md`, '# Existing product evidence\n');
  const preserved = {};
  for (const relative of [`products/${first.id}/os-product.json`, `products/${first.id}/OS.md`, `products/${first.id}/DOSSIER.md`, 'store/LAUNCH-CHECKLIST.md']) preserved[relative] = await fs.readFile(path.join(root, relative), 'utf8');
  let state = await store.addWorkspaceNote({ text: 'Keep the quotation lesson for the next cycle.', author: 'agent' });
  state = await store.reviewWorkspaceCycle(reviewInput(state, first));
  assert.equal(state.activeProductId, null); assert.equal(state.reviews.length, 1); assert.equal(state.reviews[0].productRevision, first.revision); assert.equal(state.notes.length, 1);
  for (const [relative, content] of Object.entries(preserved)) assert.equal(await fs.readFile(path.join(root, relative), 'utf8'), content);
  let bootstrap = await createStore({ workspaceRoot: root }).bootstrap(); assert.deepEqual(bootstrap.products, []); assert.equal(bootstrap.archivedProducts[0].id, first.id); assert.equal(bootstrap.archivedProducts[0].archived, true);
  assert.equal((await store.getProduct(first.id)).archived, true);
  await assert.rejects(store.patchProduct(first.id, { revision: first.revision, name: 'Rewrite history' }), error => error.code === 'PRODUCT_ARCHIVED');
  await assert.rejects(store.createJob({ role: 'validation', productId: first.id, marketId: first.markets[0].id, brief: 'Edit old product.' }), error => error.code === 'PRODUCT_ARCHIVED');
  await assert.rejects(store.reviewWorkspaceCycle(reviewInput(state, first)), error => error.code === 'PRODUCT_ARCHIVED');
  const second = await store.createProduct({ name: 'Second cycle', country: 'United States' }); assert.match(second.id, /^P002-/);
  bootstrap = await store.bootstrap(); assert.deepEqual(bootstrap.products.map(product => product.id), [second.id]); assert.equal(bootstrap.archivedProducts.length, 1); assert.equal(bootstrap.workspace.notes.length, 1);
});

test('incomplete or unsafe reviews leave the workspace and product cycle unchanged', async t => {
  const { root, store } = await fixture(t); const product = await store.createProduct({ name: 'Review validation', country: 'Canada' });
  const state = await store.addWorkspaceNote({ text: 'A saved workspace record to compare against.', author: 'agent' });
  const before = await fs.readFile(path.join(root, 'os/data/workspace.json'), 'utf8');
  for (const key of ['whatWorked', 'whatFailed', 'nextChanges']) await assert.rejects(store.reviewWorkspaceCycle(reviewInput(state, product, { [key]: '' })));
  for (const evidence of [[], ['../outside.md'], ['store/screenshot.png'], ['https://user:secret@example.com'], ['javascript:alert(1)']]) await assert.rejects(store.reviewWorkspaceCycle(reviewInput(state, product, { evidence })));
  await assert.rejects(store.reviewWorkspaceCycle(reviewInput(state, product, { outcome: 'win' })), /stopped, inconclusive or completed/);
  await assert.rejects(store.reviewWorkspaceCycle(reviewInput(state, product, { revision: state.revision - 1 })), error => error.status === 409);
  assert.equal(await fs.readFile(path.join(root, 'os/data/workspace.json'), 'utf8'), before); assert.equal((await store.bootstrap()).products[0].id, product.id);
});

test('failed review persistence preserves previous notes, product evidence and retryability', async t => {
  const { root, store } = await fixture(t); const product = await store.createProduct({ name: 'Persistence failure', country: 'Canada' });
  const state = await store.addWorkspaceNote({ text: 'This note must survive failed review writes.', author: 'owner' });
  const statePath = path.join(root, 'os/data/workspace.json'); const productPath = path.join(root, `products/${product.id}/os-product.json`);
  const oldState = await fs.readFile(statePath, 'utf8'); const oldProduct = await fs.readFile(productPath, 'utf8');
  const projection = path.join(root, 'memory/WORKSPACE.md'); const backup = path.join(root, 'memory/WORKSPACE.backup.md');
  await fs.rename(projection, backup); await fs.mkdir(projection);
  await assert.rejects(store.reviewWorkspaceCycle(reviewInput(state, product)));
  assert.equal(await fs.readFile(statePath, 'utf8'), oldState); assert.equal(await fs.readFile(productPath, 'utf8'), oldProduct);
  await fs.rmdir(projection); await fs.rename(backup, projection);
  const retried = await store.reviewWorkspaceCycle(reviewInput(state, product)); assert.equal(retried.reviews.length, 1); assert.equal(retried.notes[0].text, state.notes[0].text);
});

test('several open product records are all kept; a review archives one and leaves the others open', async t => {
  const { store, file } = await fixture(t);
  const first = createProduct({ name: 'Legacy first', country: 'Canada' }, 'P001-legacy-first'); const second = createProduct({ name: 'Legacy second', country: 'United States' }, 'P002-legacy-second');
  for (const product of [first, second]) { await file(`products/${product.id}/os-product.json`, JSON.stringify(product)); await file(`products/${product.id}/OS.md`, '# Existing legacy evidence\n'); }
  let bootstrap = await store.bootstrap(); assert.equal(bootstrap.products.length, 2); assert.equal(bootstrap.workspace.activeProductId, null); assert.deepEqual(bootstrap.workspace.conflictingProductIds, []);
  const third = await store.createProduct({ name: 'Third', country: 'Canada' });
  assert.match(third.id, /^P003-/);
  await store.reviewWorkspaceCycle(reviewInput(bootstrap.workspace, first));
  bootstrap = await store.bootstrap();
  assert.deepEqual(bootstrap.products.map(product => product.id).sort(), [second.id, third.id]); assert.equal(bootstrap.archivedProducts[0].id, first.id);
  assert.equal(bootstrap.workspace.activeProductId, null, 'a review never puts another product in the build slot');
});

test('workspace API enforces local origins, revisions and preserves malformed state', async t => {
  const { root, file } = await fixture(t); const api = createApi({ workspaceRoot: root });
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, method = 'GET', data, origin = 'http://localhost:3000') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: { Host: 'localhost:3000', Origin: origin, 'Content-Type': 'application/json' } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject); req.end(data === undefined ? undefined : JSON.stringify(data));
  });
  assert.equal((await request('/api/workspace')).data.revision, 0);
  assert.equal((await request('/api/workspace/notes', 'POST', { text: 'Unauthorized origin.', author: 'owner' }, 'https://outside.example')).status, 403);
  const note = await request('/api/workspace/notes', 'POST', { text: 'API note.', author: 'owner' }); assert.equal(note.status, 201); assert.equal(note.data.notes.length, 1);
  const handoff = { revision: 1, summary: 'API state saved.', nextAction: 'Review the next evidence item.', blockers: '' };
  assert.equal((await request('/api/workspace/handoff', 'PATCH', handoff)).status, 200); assert.equal((await request('/api/workspace/handoff', 'PATCH', handoff)).status, 409);
  const target = await file('os/data/workspace.json', '{malformed');
  const malformed = await request('/api/workspace/notes', 'POST', { text: 'Must preserve existing file.', author: 'agent' }); assert.equal(malformed.status, 500); assert.equal(malformed.data.code, 'MALFORMED_DATA'); assert.equal(await fs.readFile(target, 'utf8'), '{malformed');
});

test('archived product media disappears from current assets but remains readable and untouched', async t => {
  const { root, store, file } = await fixture(t); const product = await store.createProduct({ name: 'Media cycle', country: 'Canada' });
  await file(`products/${product.id}/assets/hero.png`, 'preserved transport fixture');
  let hub; const server = http.createServer((req, res) => hub(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  hub = await createHub({ workspaceRoot: root, port: server.address().port });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(`${base}/api/hub`)).json()).assets.length, 1);
  await store.reviewWorkspaceCycle(reviewInput(await store.getWorkspace(), product));
  assert.equal((await (await fetch(`${base}/api/hub`)).json()).assets.length, 0);
  assert.equal(await (await fetch(`${base}/api/asset?path=${encodeURIComponent(`products/${product.id}/assets/hero.png`)}`)).text(), 'preserved transport fixture');
});

test('new briefs load compact agent resume memory when present without rewriting prior saved briefs', async t => {
  const { store } = await fixture(t);
  const older = await store.createJob({ role: 'manager', brief: 'Inspect only existing system records.' });
  assert.doesNotMatch(older.prompt, /Read memory\/START-HERE.md/);
  await store.addWorkspaceNote({ text: 'Finish the system and review resources before discovery.', author: 'owner' });
  const newer = await store.createJob({ role: 'manager', brief: 'Review shared context and the resource index.' });
  assert.match(newer.prompt, /Read memory\/START-HERE.md first/); assert.doesNotMatch(newer.prompt, /STATE\.md|RESUME\.md/); assert.match(newer.prompt, /not automatic command authority/);
  assert.equal((await store.bootstrap()).jobs.find(job => job.id === older.id).prompt, older.prompt);
});

test('review refuses product evidence changed after the reviewer captured its revision', async t => {
  const {store} = await fixture(t);
  const product = await store.createProduct({name: 'Revision fixture', country: 'Canada'});
  const state = await store.getWorkspace();
  const updated = await store.patchProduct(product.id, {revision: product.revision, link: {label: 'New evidence', url: 'https://example.com/source', note: 'Added after review opened'}});
  await assert.rejects(store.reviewWorkspaceCycle(reviewInput(state, product)), error => error.status === 409);
  assert.deepEqual(await store.getWorkspace(), state);
  assert.equal((await store.getProduct(product.id)).revision, updated.revision);
  await store.reviewWorkspaceCycle(reviewInput(state, updated));
  assert.equal((await store.getWorkspace()).reviews[0].productRevision, updated.revision);
});
