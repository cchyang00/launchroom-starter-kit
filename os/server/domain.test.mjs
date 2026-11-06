import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { CHECKS, STAGES, createProduct, updateProduct, presentProduct } from './domain.mjs';
import { createStore, parseChecklist, ACTIVITY_LIMITS } from './store.mjs';
import { createApi, MAX_BODY_BYTES } from './api.mjs';
import { taskScope } from '../src/taskScope.mjs';
import { processAssignment, processState } from '../src/processModel.mjs';
import { SCREEN_CHECKS, RESEARCH_GATES } from './research.mjs';
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};

test('process pointer follows the earliest missing proof even with later checks complete', () => {
  const market={verificationGate:{ready:true},checks:Object.fromEntries(CHECKS.map(c=>[c.id,{status:'verified'}]))};
  market.checks.community.status='blocked';
  const progress=processState(STAGES,CHECKS,market);
  assert.equal(progress.currentIndex,1);
  assert.equal(progress.next.id,'community');
  assert.equal(progress.complete,false);
  assert.equal(progress.verified,CHECKS.length-1);
  assert.equal(processState(STAGES,CHECKS,null).percent,0);
  market.checks.community.status='verified';
  assert.equal(processState(STAGES,CHECKS,market).complete,true);
});

test('product stage assignment names the open pre-verification screen before product proof', () => {
  const assigned=processAssignment({stageIndex:0,stage:STAGES[0],product:{id:'P002',name:'Exact item'},market:{id:'M1',country:'US',verificationGate:{ready:false}},check:CHECKS[0],currentIndex:0,next:CHECKS[0]});
  assert.match(assigned.brief,/resolve the seven checks, owner Save, exact listing and selling-country binding before recording any product verification/);
  assert.ok(assigned.references.includes('workflow/PRE-VERIFICATION-SCREEN.md'));
});

test('selected task scope cannot inherit an unrelated draft product or market', () => {
  const draft = { productId: 'P002', marketId: 'GB' };
  assert.deepEqual(taskScope({ productId: null, marketId: null }, draft), { productId: null, marketId: null });
  assert.deepEqual(taskScope({ productId: 'P001', marketId: 'US' }, draft), { productId: 'P001', marketId: 'US' });
  assert.deepEqual(taskScope(null, draft), draft);
});

const draft = () => createProduct({ name: 'Temporary test item', variant: 'Exact test variant', country: 'United States', discoveryCountry: 'United Kingdom' }, 'P001-test-item');
const proof = (id, extra = {}) => ({ id, status: 'verified', note: 'Direct evidence inspected for this exact variant and market.', source: 'https://example.com/evidence', evidenceType: id === 'result' ? 'our result' : 'observed', observedAt: '2026-01-01', window: '2025-12-01 to 2025-12-31', ...extra });
const patchCheck = (p, check, marketId = p.markets[0].id) => updateProduct(p, { revision: p.revision, marketId, check });
const screenedLead = (id = 'L101', source = 'https://example.com/exact-item') => ({ id, name: 'Exact test item', country: 'US', buyer: 'Observed buyer situation', decision: 'Continue preflight', nextAction: 'Inspect demand', references: ['research/evidence.md'], screen: { ownerDecision: 'saved', ownerReason: 'Owner saved the visual card', checks: Object.fromEntries(SCREEN_CHECKS.map(key => [key, { status: 'supported', note: 'Dated scoped preflight observation', source: key === 'productWorks' ? source : 'research/evidence.md', observedAt: '2026-09-15', country: 'US', evidenceType: 'observed', ...(FIND_EXTRA[key] || {}), ...(key === 'sourceMatch' ? { listingUrl: 'https://example.com/supplier-sku', variant: 'Exact test variant', destination: 'US', quantity: 1 } : {}), ...(key === 'contribution' ? { costs: { currency: 'USD', sellPrice: 50, itemCost: 10, shippingCost: 5, fees: 3, returnReserve: 2, acquisitionAllowance: 15 } } : {}) }])) }, gates: Object.fromEntries(RESEARCH_GATES.map(key => [key, { status: 'pending', note: '', source: '', observedAt: '', window: '' }])) });
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-os-test-')); await fs.mkdir(path.join(root, 'resources/issues/sleep'), {recursive: true}); await fs.writeFile(path.join(root, 'resources/issues/sleep/ISSUE.md'), '# Issue: Fixture sleep issue\n');
  t.after(async () => { assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('merrivy-os-test-')); await fs.rm(root, { recursive: true, force: true }); });
  await fs.mkdir(path.join(root, 'store'), { recursive: true });
  await fs.mkdir(path.join(root, 'research'), { recursive: true });
  await fs.writeFile(path.join(root, 'research', 'evidence.md'), '# Test research evidence\n');
  await fs.mkdir(path.join(root, 'products'), { recursive: true });
  await fs.writeFile(path.join(root, 'products', 'INDEX.md'), '# Existing index\n\nManual context must stay.\n');
  await fs.writeFile(path.join(root, 'store', 'LAUNCH-CHECKLIST.md'), '# Test checklist\n\n## Foundation\n\n- [x] **F01** Existing observed setup.\n- [ ] **F02** Pending review.\n  - Retain this manual note.\n\n## Launch\n- [ ] **L01** Pending launch.\n');
  return { root, store: createStore({ workspaceRoot: root }) };
}
async function apiFixture(t) {
  const f = await fixture(t); const handler = createApi({ workspaceRoot: f.root });
  const server = http.createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (route, { method = 'GET', value, raw, headers = {} } = {}) => new Promise((resolve, reject) => {
    const data = raw ?? (value === undefined ? undefined : JSON.stringify(value));
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: { host: 'localhost:3000', ...(method !== 'GET' ? { origin: 'http://localhost:3000', 'content-type': 'application/json' } : {}), ...headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => { const content = Buffer.concat(chunks).toString('utf8'); resolve({ status: res.statusCode, body: content ? JSON.parse(content) : null }); });
    });
    req.on('error', reject); req.end(data);
  });
  return { ...f, request };
}

test('domain starts with no fabricated evidence or money and computes the earliest open gate', () => {
  const p = presentProduct(draft());
  // Seven stages since Oct 2: the measured result and the case review are Step 7 · Learn.
  assert.equal(STAGES.length, 7); assert.equal(CHECKS.length, 23);
  assert.deepEqual(CHECKS.filter(check => check.stage === 'learning').map(check => check.id), ['result', 'case-review']);
  assert.equal(p.markets[0].stageId, 'discovery'); assert.equal(p.markets[0].verifiedCount, 0);
  assert.equal(p.markets[0].economics.price, null); assert.deepEqual(p.markets[0].checks, {});
  assert.throws(() => createProduct({ name: 'Example', country: 'US', synthetic: true }, 'P001-demo'), /Synthetic/);
});
test('verified evidence needs all provenance fields, real dates, an allowed type and safe source', () => {
  for (const field of ['note', 'source', 'evidenceType', 'observedAt', 'window']) assert.throws(() => patchCheck(draft(), proof('exact-product', { [field]: '' })), /requires/);
  for (const observedAt of ['2026-02-31', '9999-01-01', 'January 2026']) assert.throws(() => patchCheck(draft(), proof('exact-product', { observedAt })), /date/);
  assert.throws(() => patchCheck(draft(), proof('exact-product', { evidenceType: 'hypothesis' })), /Verified evidence/);
  for (const source of ['javascript:alert(1)', '../private.md', 'C:/secrets.md', 'agents/../memory/STATE.md', 'agents/.. /private.md', 'store/CON.md', 'memory/secrets/key.md', 'https://user:pass@example.com/']) assert.throws(() => patchCheck(draft(), proof('exact-product', { source })));
  assert.throws(() => patchCheck(draft(), proof('exact-product', { country: 'Canada' })), /country/);
});
test('exact sourcing rejects lookalikes and accepts AliExpress or explicit local supplier confirmation', () => {
  assert.throws(() => patchCheck(draft(), proof('exact-source')), /AliExpress/);
  assert.throws(() => patchCheck(draft(), proof('exact-source', { source: 'https://aliexpress.com.attacker.example/item/1' })), /AliExpress/);
  assert.equal(patchCheck(draft(), proof('exact-source', { source: 'https://www.aliexpress.com/item/123.html' })).markets[0].checks['exact-source'].status, 'verified');
  // Owner (CHECKS.md P2): Alibaba or AliExpress is enough to source, CJ only last; lookalike hosts stay refused.
  assert.equal(patchCheck(draft(), proof('exact-source', { source: 'https://www.alibaba.com/product-detail/Convertible-Garment-Duffle_1601404449.html' })).markets[0].checks['exact-source'].status, 'verified');
  assert.throws(() => patchCheck(draft(), proof('exact-source', { source: 'https://alibaba.com.attacker.example/product-detail/1.html' })), /Alibaba or AliExpress/);
  assert.throws(() => patchCheck(draft(), proof('exact-source', { source: 'https://notalibaba.com/product-detail/1.html' })), /Alibaba or AliExpress/);
  assert.equal(patchCheck(draft(), proof('exact-source', { source: 'products/P001-test-item/supplier-evidence.md', evidenceType: 'supplier assertion', note: 'Supplier confirmed exact mechanism and variant in a dated response.' })).markets[0].checks['exact-source'].status, 'verified');
});
test('one market cannot inherit another country proof; country and offer changes reopen their gates', () => {
  let p = patchCheck(draft(), proof('exact-product'));
  p = updateProduct(p, { revision: p.revision, newMarket: { country: 'Canada' } });
  assert.deepEqual(p.markets[1].checks, {});
  p = updateProduct(p, { revision: p.revision, marketId: p.markets[0].id, market: { country: 'Australia' } });
  assert.equal(p.markets[0].checks['exact-product'].status, 'pending'); assert.equal(p.markets[0].checks['exact-product'].country, 'Australia');
  p = patchCheck(p, proof('competition'));
  p = updateProduct(p, { revision: p.revision, marketId: p.markets[0].id, market: { offer: 'Two-item bundle' } });
  assert.equal(p.markets[0].checks.competition.status, 'pending');
});
test('winner requires all 23 checks plus our result and is reopened when product scope changes', () => {
  let p = draft(); const chooseWinner = () => updateProduct(p, { revision: p.revision, marketId: p.markets[0].id, market: { status: 'winner' } });
  assert.throws(chooseWinner, /every evidence gate/);
  assert.throws(() => patchCheck(p, proof('result', { evidenceType: 'third-party estimate' })), /our result/);
  for (const c of CHECKS) p = patchCheck(p, proof(c.id, c.id === 'exact-source' ? { source: 'https://aliexpress.com/item/123.html' } : {}));
  p = chooseWinner(); assert.equal(p.markets[0].status, 'winner'); assert.equal(presentProduct(p).markets[0].verifiedCount, 23);
  p = updateProduct(p, { revision: p.revision, variant: 'Different mechanism' }); assert.equal(p.markets[0].status, 'active'); assert.equal(presentProduct(p).markets[0].verifiedCount, 0);
});
test('park/reject needs a reason; unknown economics stays null and unsafe numbers cannot save', () => {
  let p = draft(); const edit = market => updateProduct(p, { revision: p.revision, marketId: p.markets[0].id, market });
  assert.throws(() => edit({ status: 'parked' }), /reason/); assert.throws(() => edit({ status: 'rejected' }), /reason/);
  assert.equal(edit({ status: 'parked', reason: 'Missing destination quote; review when supplier evidence arrives.' }).markets[0].status, 'parked');
  for (const price of [-1, Infinity, '10']) assert.throws(() => edit({ economics: { price } }), /non-negative/);
  assert.throws(() => edit({ economics: JSON.parse('{"__proto__":{"polluted":true}}') }), /Unknown economics/);
  assert.equal({}.polluted, undefined);
});
test('read-only bootstrap does not seed files, reads checklist and omits synthetic candidates', async t => {
  const { root, store } = await fixture(t); const before = await fs.readFile(path.join(root, 'products', 'INDEX.md'), 'utf8');
  const bootstrap = await store.bootstrap(); assert.deepEqual(bootstrap.products, []); assert.deepEqual(bootstrap.jobs, []); assert.equal(bootstrap.storeChecklist.total, 3); assert.equal(bootstrap.storeChecklist.done, 1); assert.equal(bootstrap.agents.length, 4);
  assert.equal(bootstrap.storeChecklist.groups[0].items[0].proof.method, 'inherited from source checklist');
  await assert.rejects(fs.stat(path.join(root, 'os', 'data')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(root, 'products', 'INDEX.md'), 'utf8'), before);
  await fs.mkdir(path.join(root, 'products', 'P009-synthetic')); await fs.writeFile(path.join(root, 'products', 'P009-synthetic', 'os-product.json'), JSON.stringify({ synthetic: true }));
  assert.deepEqual((await store.bootstrap()).products, []);
});
test('persisted products survive a new store instance and preserve dossiers/index', async t => {
  const { root, store } = await fixture(t);
  const a = await store.createProduct({ name: 'First item', country: 'United States' });
  assert.ok(a.id.startsWith('P001-'));
  const dossier = path.join(root, 'products', a.id, 'DOSSIER.md'); await fs.writeFile(dossier, 'Preserve original dossier.');
  const changed = await store.patchProduct(a.id, { revision: a.revision, marketId: a.markets[0].id, check: { ...proof('exact-product'), status: 'pending' } });
  assert.equal((await createStore({ workspaceRoot: root }).getProduct(a.id)).revision, changed.revision);
  const index = await fs.readFile(path.join(root, 'products', 'INDEX.md'), 'utf8'); assert.match(index, /Manual context must stay/); assert.match(index, /P001-first-item\/OS.md/);
  assert.equal(await fs.readFile(dossier, 'utf8'), 'Preserve original dossier.'); assert.match(await fs.readFile(path.join(root, 'products', a.id, 'OS.md'), 'utf8'), /Direct evidence inspected/);
  assert.deepEqual((await fs.readdir(path.join(root, 'products', a.id))).filter(n => n.endsWith('.tmp')), []);
});
test('failed product projection or JSON commit leaves the product and index unchanged', async t => {
  const { root, store } = await fixture(t);
  const product = await store.createProduct({ name: 'Commit fixture', country: 'Canada' });
  const paths = [
    path.join(root, `products/${product.id}/OS.md`),
    path.join(root, 'products/INDEX.md'),
    path.join(root, `products/${product.id}/os-product.json`),
  ];
  const before = await Promise.all(paths.map(file => fs.readFile(file, 'utf8')));
  for (const blockedPath of paths) {
    const failing = createStore({ workspaceRoot: root, replaceFileImpl: async (source, target) => {
      if (target === blockedPath) throw new Error('Simulated write failure');
      await fs.rename(source, target);
    } });
    await assert.rejects(failing.patchProduct(product.id, { revision: product.revision, name: 'Must not commit' }), /Simulated write failure/);
    assert.deepEqual(await Promise.all(paths.map(file => fs.readFile(file, 'utf8'))), before);
    assert.equal((await failing.getProduct(product.id)).revision, product.revision);
  }
  const changed = await store.patchProduct(product.id, { revision: product.revision, name: 'Committed after retry' });
  assert.equal(changed.revision, product.revision + 1);
  assert.match(await fs.readFile(paths[1], 'utf8'), /Committed after retry/);
});
test('a failed first product commit does not create a readable product or advance the workspace', async t => {
  const { root, store } = await fixture(t);
  const indexPath = path.join(root, 'products/INDEX.md');
  const beforeIndex = await fs.readFile(indexPath, 'utf8');
  const failing = createStore({ workspaceRoot: root, replaceFileImpl: async (source, target) => {
    if (target.endsWith('os-product.json')) throw new Error('Simulated product JSON failure');
    await fs.rename(source, target);
  } });
  await assert.rejects(failing.createProduct({ name: 'First commit', country: 'US' }), /Simulated product JSON failure/);
  assert.equal(await fs.readFile(indexPath, 'utf8'), beforeIndex);
  assert.deepEqual((await failing.bootstrap()).products, []);
  assert.equal((await failing.getWorkspace()).revision, 0);
  const created = await store.createProduct({ name: 'First commit', country: 'US' });
  assert.equal(created.name, 'First commit');
  assert.equal((await store.getWorkspace()).activeProductId, null, 'a new product is not in the build slot');
});
test('two writers with the same revision cannot silently overwrite; malformed storage reports the file', async t => {
  const { root, store } = await fixture(t); const p = await store.createProduct({ name: 'Concurrency', country: 'Canada' });
  const results = await Promise.allSettled([store.patchProduct(p.id, { revision: 1, name: 'Writer one' }), createStore({ workspaceRoot: root }).patchProduct(p.id, { revision: 1, name: 'Writer two' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  await fs.writeFile(path.join(root, 'products', p.id, 'os-product.json'), '{broken');
  await assert.rejects(store.bootstrap(), e => e.code === 'MALFORMED_DATA' && e.message.includes(p.id));
});
test('jobs are prepared only and completion requires evidence; improvement adoption retains rollback and next check', async t => {
  const { store } = await fixture(t); const p = await store.createProduct({ name: 'Job product', country: 'United States' });
  const job = await store.createJob({ productId: p.id, marketId: p.markets[0].id, role: 'validation', brief: 'Inspect exact product evidence.' });
  assert.equal(job.status, 'prepared'); assert.match(job.prompt, /agents\/validation\/skills\/research-products\/SKILL.md/); assert.match(job.prompt, /resources\/LIBRARY.md/); assert.match(job.prompt, /does not authorize/);
  assert.doesNotMatch(job.prompt, /STATE\.md/, 'archived STATE files are not part of a new brief');
  assert.match(job.prompt, /Pre-verification at preparation:/);
  assert.match(job.prompt, /workflow\/PRE-VERIFICATION-SCREEN.md and GET \/api\/research again before product verification/);
  await assert.rejects(store.patchJob(job.id, { status: 'completed' }), /result evidence/);
  const complete = await store.patchJob(job.id, { status: 'completed', result: 'Reviewed sources in products/P001-job-product/OS.md; no external actions.' }); assert.equal(complete.completionMethod, 'manually recorded');
  const improvement = await store.createImprovement({ title: 'Record source variant', role: 'validation', observation: 'An exact mechanism was ambiguous.', proposal: 'Capture variant code alongside source.', source: 'agents/validation/WORKFLOW.md' });
  await assert.rejects(store.patchImprovement(improvement.id, { status: 'adopted' }), /previous text/);
  const adopted = await store.patchImprovement(improvement.id, { status: 'adopted', evidence: 'Two contrast cases checked.', previous: 'Old source wording.', nextCheck: 'Check next actual product review.' }); assert.equal(adopted.status, 'adopted'); assert.equal(adopted.previous, 'Old source wording.');
});
test('store checklist writes only the exact checkbox and records proof without claiming automation', async t => {
  const { root, store } = await fixture(t); const sourcePath = path.join(root, 'store', 'LAUNCH-CHECKLIST.md'); const before = await fs.readFile(sourcePath, 'utf8');
  await assert.rejects(store.patchStoreCheck('F02', { done: true }), /Review evidence/);
  await assert.rejects(store.patchStoreCheck('F02', { done: true, note: 'No local source exists.', source: 'store/SETUP.md', observedAt: '2026-01-01' }), { code: 'EVIDENCE_NOT_FOUND' });
  assert.equal(await fs.readFile(sourcePath, 'utf8'), before);
  await fs.writeFile(path.join(root, 'store', 'SETUP.md'), '# Isolated fixture setup evidence\n');
  const result = await store.patchStoreCheck('F02', { done: true, note: 'Inspected saved settings.', source: 'store/SETUP.md', observedAt: '2026-01-01' });
  assert.equal(result.proof.method, 'manually recorded review'); assert.equal(await fs.readFile(sourcePath, 'utf8'), before.replace('- [ ] **F02**', '- [x] **F02**'));
  assert.equal((await store.bootstrap()).storeChecklist.done, 2);
  await store.patchStoreCheck('F02', { done: false, revision: 1, note: 'Reopened for current review.' }); assert.equal((await store.bootstrap()).storeChecklist.done, 1);
  await assert.rejects(store.patchStoreCheck('F02', { done: false, revision: 1 }), e => e.status === 409);
  await fs.appendFile(sourcePath, '\n- [ ] **F02** Duplicate.\n');
  await assert.rejects(store.patchStoreCheck('F02', { done: false }), e => e.code === 'AMBIGUOUS_CHECK');
});
test('product-independent store and manager jobs work without creating a candidate', async t => {
  const { root, store } = await fixture(t);
  for (const role of ['manager', 'shopify-builder']) {
    const job = await store.createJob({ role, brief: 'Inspect the current store readiness checklist and identify the next unfinished check.' });
    assert.equal(job.productId, null); assert.equal(job.marketId, null); assert.match(job.prompt, /product-independent workspace/); assert.match(job.prompt, /store\/LAUNCH-CHECKLIST.md/);
    assert.match(job.prompt, /memory\/NOW.md/); assert.match(job.prompt, /store\/HYDROGEN-POPULATION.md/); assert.match(job.prompt, /workflow\/the-line.json/); assert.doesNotMatch(job.prompt, /STATE\.md|Atlas/);
  }
  for (const role of ['validation', 'image-generator']) await assert.rejects(store.createJob({ role, brief: 'Work without product evidence.' }), /requires a real product/);
  assert.deepEqual((await store.bootstrap()).products, []);
  assert.deepEqual(await fs.readdir(path.join(root, 'products')), ['INDEX.md']);
});
test('API rejects remote host/origin, malformed JSON, oversized bodies and document traversal', async t => {
  const { request } = await apiFixture(t);
  assert.equal((await request('/api/bootstrap')).status, 200);
  assert.equal((await request('/api/bootstrap', { headers: { host: 'attacker.example:3000' } })).status, 403);
  assert.equal((await request('/api/bootstrap', { headers: { origin: 'http://attacker.example' } })).status, 403);
  assert.equal((await request('/api/products', { method: 'POST', value: { name: 'Unsafe', country: 'US' }, headers: { origin: '' } })).status, 403);
  assert.equal((await request('/api/products', { method: 'POST', raw: '{broken' })).body.code, 'MALFORMED_JSON');
  assert.equal((await request('/api/products', { method: 'POST', raw: 'x'.repeat(MAX_BODY_BYTES + 1), headers: { 'content-length': String(MAX_BODY_BYTES + 1) } })).status, 413);
  for (const unsafe of ['../AGENTS.md', 'store/../../outside.md', 'store/EMAIL.json', 'memory/secrets/secret.md', 'C:/secret.md', 'store\\SETUP.md']) assert.equal((await request(`/api/doc?path=${encodeURIComponent(unsafe)}`)).status, 400);
  assert.equal((await request('/api/doc?path=store/LAUNCH-CHECKLIST.md')).status, 200);
});
test('API persists an explicit candidate and rejects stale revisions and foreign market edits', async t => {
  const { request } = await apiFixture(t);
  const response = await request('/api/products', { method: 'POST', value: { name: 'API item', country: 'Canada', sourceUrl: 'https://example.com/product' } }); assert.equal(response.status, 201);
  const p = response.body;
  const updated = await request(`/api/products/${p.id}`, { method: 'PATCH', value: { revision: 1, marketId: p.markets[0].id, check: { ...proof('exact-product'), status: 'pending' } } }); assert.equal(updated.status, 200); assert.equal(updated.body.markets[0].verifiedCount, 0);
  assert.equal((await request(`/api/products/${p.id}`, { method: 'PATCH', value: { revision: 1, name: 'Stale writer' } })).status, 409);
  assert.equal((await request(`/api/products/${p.id}`, { method: 'PATCH', value: { revision: 2, marketId: 'foreign-market', check: proof('exact-product') } })).status, 404);
});
test('product verification requires a saved seven-check card bound to the exact item and country', async t => {
  const { root, store } = await fixture(t);
  let p = await store.createProduct({ name: 'Exact test item', country: 'US', sourceUrl: 'https://example.com/exact-item' });
  const marketId = p.markets[0].id;
  await assert.rejects(store.patchProduct(p.id, { revision: p.revision, marketId, check: proof('exact-product') }), e => e.code === 'PRE_VERIFICATION_REQUIRED');
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, check: { ...proof('exact-product'), status: 'pending' } });
  assert.equal(p.markets[0].verifiedCount, 0);
  const lead = screenedLead();
  await store.patchResearch({ revision: 0, candidate: lead });
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, market: { researchCandidateId: lead.id } });
  await assert.rejects(store.patchProduct(p.id, { revision: p.revision, marketId, check: proof('exact-product', { source: 'research/missing-product-proof.md' }) }), { code: 'EVIDENCE_NOT_FOUND' });
  assert.equal((await store.getProduct(p.id)).revision, p.revision);
  await fs.writeFile(path.join(root, 'research', 'product-proof.md'), '# Isolated product proof\n');
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, check: proof('exact-product', { source: 'research/product-proof.md' }) });
  assert.equal(p.markets[0].verifiedCount, 1);
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, market: { country: 'CA' } });
  assert.equal(p.markets[0].verifiedCount, 0);
  await assert.rejects(store.patchProduct(p.id, { revision: p.revision, marketId, check: proof('exact-product') }), e => e.code === 'RESEARCH_COUNTRY_MISMATCH');
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, market: { country: 'US' } });
  p = await store.patchProduct(p.id, { revision: p.revision, sourceUrl: 'https://example.com/different-item' });
  await assert.rejects(store.patchProduct(p.id, { revision: p.revision, marketId, check: proof('exact-product') }), e => e.code === 'RESEARCH_IDENTITY_MISMATCH');
  p = await store.patchProduct(p.id, { revision: p.revision, sourceUrl: 'https://example.com/exact-item' });
  const incomplete = screenedLead('L102'); incomplete.screen.checks.contribution.status = 'pending';
  await store.patchResearch({ revision: 1, candidate: incomplete });
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, market: { researchCandidateId: 'L102' } });
  await assert.rejects(store.patchProduct(p.id, { revision: p.revision, marketId, check: proof('exact-product') }), e => e.code === 'PRE_VERIFICATION_REQUIRED');
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, market: { researchCandidateId: 'L101' } });
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, check: proof('exact-product') });
  assert.equal(p.markets[0].verifiedCount, 1);
  p = await store.patchProduct(p.id, { revision: p.revision, marketId, market: { researchCandidateId: '' } });
  assert.equal(p.markets[0].verifiedCount, 0);
});
test('missing research screen files withdraw current product readiness without deleting historical proofs', async t => {
  const { root, store } = await fixture(t);
  let product = await store.createProduct({ name: 'Exact test item', country: 'US', sourceUrl: 'https://example.com/exact-item' });
  const marketId = product.markets[0].id;
  await store.patchResearch({ revision: 0, candidate: screenedLead() });
  product = await store.patchProduct(product.id, { revision: product.revision, marketId, market: { researchCandidateId: 'L101' } });
  product = await store.patchProduct(product.id, { revision: product.revision, marketId, check: proof('exact-product') });
  assert.equal(product.markets[0].effectiveVerifiedCount, 1);
  await fs.rm(path.join(root, 'research', 'evidence.md'));
  const research = await store.getResearch();
  assert.equal(research.summary.readyForVerification, 0);
  assert.ok(research.candidates[0].missingEvidence.screen.includes('sourceMatch'));
  const shown = (await store.getProduct(product.id)).markets[0];
  assert.equal(shown.checks['exact-product'].status, 'verified');
  assert.equal(shown.effectiveVerifiedCount, 0);
  assert.equal(shown.verificationGate.code, 'RESEARCH_EVIDENCE_MISSING');
  await assert.rejects(store.patchProduct(product.id, { revision: product.revision, marketId, check: proof('buyer-situation') }), { code: 'RESEARCH_EVIDENCE_MISSING' });
  const unresolved = structuredClone(research.candidates[0]);
  unresolved.gates.demand = { status: 'supported', note: 'Fixture demand observation', source: 'https://example.com/demand', observedAt: '2026-09-15', window: '2026-09-01 to 2026-09-15' };
  await assert.rejects(store.patchResearch({ revision: research.revision, candidate: unresolved }), { code: 'RESEARCH_EVIDENCE_MISSING' });
  const continued = structuredClone(research.candidates[0]); continued.nextAction = 'Restore missing evidence.';
  const readback = await store.patchResearch({ revision: research.revision, candidate: continued });
  assert.ok(readback.candidates[0].missingEvidence.screen.includes('sourceMatch'));
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'research', 'comparison.json'), 'utf8')).candidates[0].screen.checks.sourceMatch.status, 'supported');
  assert.equal(Object.hasOwn(JSON.parse(await fs.readFile(path.join(root, 'research', 'comparison.json'), 'utf8')).candidates[0], 'missingEvidence'), false);
  await fs.writeFile(path.join(root, 'research', 'evidence.md'), '# Restored fixture source\n');
  assert.equal((await store.getProduct(product.id)).markets[0].effectiveVerifiedCount, 1);
});
test('historical verified proof stays readable but cannot gain another verification without the screen', async t => {
  const { root, store } = await fixture(t);
  const created = await store.createProduct({ name: 'Historical item', country: 'US', sourceUrl: 'https://example.com/exact-item' });
  const file = path.join(root, 'products', created.id, 'os-product.json');
  const historical = updateProduct(created, { revision: created.revision, marketId: created.markets[0].id, check: proof('exact-product') });
  delete historical.markets[0].researchCandidateId;
  await fs.writeFile(file, JSON.stringify(historical));
  const shown = (await store.getProduct(created.id)).markets[0];
  assert.equal(shown.verifiedCount, 1);
  assert.equal(shown.effectiveVerifiedCount, 0);
  assert.equal(shown.verificationGate.ready, false);
  assert.equal((await store.bootstrap()).products[0].markets[0].effectiveVerifiedCount, 0);
  await assert.rejects(store.patchProduct(created.id, { revision: historical.revision, marketId: historical.markets[0].id, check: proof('buyer-situation') }), e => e.code === 'PRE_VERIFICATION_REQUIRED');
  assert.equal((await store.getProduct(created.id)).markets[0].verifiedCount, 1);
});
test('document reader rejects linked files and linked directories', async t => {
  const { root, store } = await fixture(t); const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-os-outside-'));
  t.after(async () => { assert.equal(path.dirname(outside), os.tmpdir()); await fs.rm(outside, { recursive: true, force: true }); });
  await fs.writeFile(path.join(outside, 'secret.md'), 'Must never be read.');
  try { await fs.symlink(outside, path.join(root, 'store', 'linked'), 'junction'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('OS does not allow link creation in this test environment.'); return; } throw error; }
  await assert.rejects(store.readDocument('store/linked/secret.md'), e => e.code === 'UNSAFE_PATH');
});

test('document reader opens only approved root routing skills and retains path boundaries', async t => {
  const { root, store } = await fixture(t);
  const routes = ['merrivy-research-workspace', 'merrivy-creative-workspace', 'merrivy-shopify-workspace'];
  for (const route of routes) {
    const file = `.agents/skills/${route}/SKILL.md`;
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), `# ${route}`);
    assert.equal((await store.readDocument(file)).content, `# ${route}`);
  }
  const paths = (await store.bootstrap()).documents.map(doc => doc.path);
  for (const route of routes) assert.ok(paths.includes(`.agents/skills/${route}/SKILL.md`));
  for (const denied of [
    '.agents/secrets.md', '.agents/credentials/token.md', '.agents/skills/unapproved/SKILL.md',
    '.agents/skills/merrivy-research-workspace/secrets.md', '.agents/skills/merrivy-research-workspace/.env',
    '.agents/skills/merrivy-research-workspace/SKILL.json', '.agents/skills/merrivy-research-workspace/SKILL.md:secret',
    '.agents/skills/merrivy-research-workspace/../merrivy-shopify-workspace/SKILL.md',
    '.agents/skills/merrivy-research-workspace/.. /merrivy-shopify-workspace/SKILL.md',
    '.agents/skills/merrivy-research-workspace/%2e%2e/secrets.md',
  ]) await assert.rejects(store.readDocument(denied), e => e.code === 'UNSAFE_PATH', denied);

  // A junction to an ordinary workspace directory is unsafe too, even if the
  // requested leaf is otherwise allowlisted and stays inside the workspace.
  await fs.writeFile(path.join(root, 'store/SKILL.md'), '# Must not be exposed');
  const skillDir = path.join(root, '.agents/skills/merrivy-research-workspace');
  await fs.rm(skillDir, { recursive: true });
  try { await fs.symlink(path.join(root, 'store'), skillDir, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.diagnostic('OS does not allow link creation.'); return; } throw error; }
  await assert.rejects(store.readDocument('.agents/skills/merrivy-research-workspace/SKILL.md'), e => e.code === 'UNSAFE_PATH');
  assert.ok(!(await store.bootstrap()).documents.some(doc => doc.path === '.agents/skills/merrivy-research-workspace/SKILL.md'));
});
test('checklist parser retains all real groups without counting explanatory notes', () => {
  const result = parseChecklist('# Checklist\n## A\n- [x] **F01** Done\n  - Not a check\n## Empty\nText\n## B\n- [ ] **L01** Pending');
  assert.equal(result.groups.length, 2); assert.equal(result.total, 2); assert.equal(result.done, 1);
});
test('resource hub discovers nested business Markdown and approved root/OS documents without widening data access', async t => {
  const { root, store } = await fixture(t);
  const documents = {
    'AGENTS.md': '# Root operating instructions',
    'USER.md': '# Who the owner is',
    'MEMORY.md': '# Day by day',
    'PRODUCT.md': '# Product specification',
    'DESIGN.md': '# Design direction',
    'os/README.md': '# OS setup',
    'os/AGENTS.md': '# OS development instructions',
    'os/AGENT-BRIDGE.md': '# Native agent activity bridge',
    'agents/validation/references/nested/case.md': '# Nested product case',
    'templates/markets/review.md': '# Country review template',
    'inbox/research/owner-notes.md': '# Owner research notes',
    'store/LAUNCH-CHECKLIST.md': '# Readiness board',
  };
  for (const [file, content] of Object.entries(documents)) { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), content); }
  for (const excluded of ['OTHER.md', 'os/data/private.md', 'os/server/internal.md', 'agents/node_modules/package/README.md', 'guides/rippy-club/frames/raw/frame.md', 'inbox/secrets/password.md']) {
    await fs.mkdir(path.dirname(path.join(root, excluded)), { recursive: true }); await fs.writeFile(path.join(root, excluded), '# Excluded');
  }
  const catalog = (await store.bootstrap()).documents; const paths = catalog.map(d => d.path);
  for (const file of Object.keys(documents)) { assert.ok(paths.includes(file), `Missing ${file}`); assert.equal((await store.readDocument(file)).content, documents[file]); }
  assert.equal(new Set(paths).size, paths.length); assert.equal(paths.filter(p => p === 'store/LAUNCH-CHECKLIST.md').length, 1);
  assert.ok(paths.indexOf('store/LAUNCH-CHECKLIST.md') < paths.indexOf('agents/validation/references/nested/case.md'));
  assert.equal(catalog.find(d => d.path === 'templates/markets/review.md').category, 'Templates');
  assert.equal(catalog.find(d => d.path === 'agents/validation/references/nested/case.md').title, 'Nested product case');
  for (const denied of ['OTHER.md', 'os/data/private.md', 'os/server/internal.md', 'agents/node_modules/package/README.md', 'inbox/secrets/password.md']) {
    assert.ok(!paths.includes(denied)); await assert.rejects(store.readDocument(denied), e => e.code === 'UNSAFE_PATH');
  }
  assert.ok(!paths.includes('guides/rippy-club/frames/raw/frame.md'));
  assert.ok(paths.length <= 1000);
});
test('source links add, update and remove without changing sourceUrl or country evidence', () => {
  let p = patchCheck(draft(), proof('exact-product')); p.sourceUrl = 'https://example.com/original';
  const evidence = structuredClone(p.markets[0].checks);
  p = updateProduct(p, { revision: p.revision, link: { label: 'Pipiads exact ad', url: 'https://www.pipiads.com/ad/123', note: 'Exact observed ad ID.' } });
  assert.equal(p.links.length, 1); const id = p.links[0].id; assert.match(id, /^L-/);
  assert.deepEqual(p.markets[0].checks, evidence); assert.equal(p.sourceUrl, 'https://example.com/original');
  p = updateProduct(p, { revision: p.revision, link: { id, label: 'Pipiads product ad', url: 'https://www.pipiads.com/ad/456', note: 'Corrected exact ad reference.' } });
  assert.equal(p.links.length, 1); assert.equal(p.links[0].id, id); assert.match(p.links[0].url, /456$/);
  assert.equal(p.activity.filter(e => e.type === 'source-link-updated').length, 1);
  p = updateProduct(p, { revision: p.revision, removeLink: id });
  assert.deepEqual(p.links, []); assert.deepEqual(p.markets[0].checks, evidence); assert.ok(p.activity.some(e => e.type === 'source-link-removed'));
  assert.throws(() => updateProduct(p, { revision: p.revision, removeLink: id }), e => e.code === 'LINK_NOT_FOUND');
});
test('source links enforce bounded fields, safe URLs, unique IDs and 100-item limit', () => {
  let p = draft(); const add = link => updateProduct(p, { revision: p.revision, link });
  for (const url of ['', 'javascript:alert(1)', 'file:///private.md', 'https://owner:password@example.com/item', 'not a URL']) assert.throws(() => add({ label: 'Unsafe', url }));
  assert.throws(() => add({ label: 'x'.repeat(121), url: 'https://example.com' }), /120/);
  assert.throws(() => add({ label: 'Source', url: 'https://example.com', note: 'x'.repeat(3001) }), /3000/);
  assert.throws(() => add({ id: '../bad', label: 'Source', url: 'https://example.com' }), /Link ID/);
  p.links = Array.from({ length: 100 }, (_, index) => ({ id: `L-${index}`, label: `Source ${index}`, url: `https://example.com/${index}`, note: '' }));
  assert.throws(() => add({ label: 'Overflow', url: 'https://example.com/extra' }), /100 source links/);
  assert.equal(add({ id: 'L-0', label: 'Updated at capacity', url: 'https://example.com/update' }).links.length, 100);
  p.links[1].id = p.links[0].id; assert.throws(() => presentProduct(p), /unique/);
});
test('source links persist through restart, project into OS.md and keep revision conflicts safe', async t => {
  const { root, store } = await fixture(t); let p = await store.createProduct({ name: 'Link register', country: 'Canada' });
  assert.deepEqual(p.links, []);
  p = await store.patchProduct(p.id, { revision: p.revision, link: { label: 'Kalodata exact product', url: 'https://www.kalodata.com/product/detail?id=123', note: 'Discovery market Canada.' } });
  const id = p.links[0].id;
  const restarted = createStore({ workspaceRoot: root }); assert.deepEqual((await restarted.getProduct(p.id)).links, p.links);
  assert.match(await fs.readFile(path.join(root, 'products', p.id, 'OS.md'), 'utf8'), /Kalodata exact product/);
  await assert.rejects(store.patchProduct(p.id, { revision: 1, removeLink: id }), e => e.status === 409);
  const recordPath = path.join(root, 'products', p.id, 'os-product.json'); const older = JSON.parse(await fs.readFile(recordPath, 'utf8')); delete older.links; await fs.writeFile(recordPath, JSON.stringify(older));
  assert.deepEqual((await restarted.getProduct(p.id)).links, []);
  assert.equal(JSON.parse(await fs.readFile(recordPath, 'utf8')).links, undefined, 'Read should not migrate files by writing them.');
  older.links = [{ id: 'L-bad', label: 'Invalid record', url: 'javascript:alert(1)', note: '' }]; await fs.writeFile(recordPath, JSON.stringify(older));
  await assert.rejects(restarted.getProduct(p.id), e => e.code === 'MALFORMED_DATA' && e.message.includes(p.id));
});
test('Codex activity persists meaningful updates, preserves start time and does not imply runtime state', async t => {
  const { root, store } = await fixture(t);
  assert.deepEqual((await store.getActivity()).activity, []);
  await assert.rejects(fs.stat(path.join(root, 'os', 'data', 'activity.json')), { code: 'ENOENT' });
  const initial = { id: 'codex-store-review', title: 'Review store foundation', role: 'shopify-builder', status: 'running', summary: 'Inspecting the saved launch checklist.', references: ['store/LAUNCH-CHECKLIST.md'], event: 'Read the existing checklist and scoped remaining checks.' };
  const { record: first, created } = await store.reportActivity(initial);
  assert.equal(created, true); assert.equal(first.reportedBy, 'codex'); assert.equal(first.revision, 1); assert.equal(first.events.length, 1); assert.equal(first.pid, undefined);
  const repeat = await store.reportActivity({ ...initial, revision: 1 }); assert.deepEqual(repeat.record, first);
  const { record: complete } = await store.reportActivity({ id: first.id, revision: 1, status: 'completed', summary: 'Recorded remaining store dependencies.', event: 'Checked the source records; actual checkout remains open.' });
  assert.equal(complete.revision, 2); assert.equal(complete.startedAt, first.startedAt); assert.equal(complete.events.length, 2); assert.deepEqual(complete.references, initial.references);
  assert.deepEqual((await createStore({ workspaceRoot: root }).getActivity()).activity[0], complete);
  await assert.rejects(store.reportActivity({ id: first.id, revision: 1, status: 'failed' }), e => e.status === 409);
  assert.deepEqual((await store.bootstrap()).products, []);
});
test('Codex activity bounds events and records, validates references and exposes malformed storage clearly', async t => {
  const { root, store } = await fixture(t);
  const initial = { title: 'Validation report', role: 'validation', status: 'blocked', summary: 'Waiting for exact product evidence.' };
  for (const references of [['../outside.md'], ['os/data/secret.json'], ['https://example.com'], ['inbox/secrets/key.md'], ['store/.. /private.md']]) await assert.rejects(store.reportActivity({ ...initial, references }), e => e.code === 'UNSAFE_PATH');
  await assert.rejects(store.reportActivity({ ...initial, status: 'active' }), /Activity status/);
  await assert.rejects(store.reportActivity({ ...initial, role: 'unknown-agent' }), /Unknown activity role/);
  await assert.rejects(store.reportActivity({ ...initial, events: [{ at: 'invented', text: 'Fake event' }] }), /one event/);
  await assert.rejects(store.reportActivity({ ...initial, event: 'x'.repeat(1001) }), /1000/);
  let { record } = await store.reportActivity({ ...initial, id: 'bounded-report' });
  for (let i = 0; i < 22; i++) ({ record } = await store.reportActivity({ id: record.id, revision: record.revision, event: `Distinct observed step ${i}` }));
  assert.equal(record.events.length, ACTIVITY_LIMITS.eventsPerRecord); assert.equal(record.events.at(-1).text, 'Distinct observed step 21');
  const activityPath = path.join(root, 'os', 'data', 'activity.json');
  const fullFeed = Array.from({ length: ACTIVITY_LIMITS.records }, (_, index) => ({ ...record, id: `older-${index}` }));
  await fs.writeFile(activityPath, JSON.stringify(fullFeed));
  const newest = await store.reportActivity({ ...initial, id: 'newest-report' });
  const retained = (await store.getActivity()).activity; assert.equal(retained.length, ACTIVITY_LIMITS.records); assert.equal(retained[0].id, newest.record.id);
  assert.ok((await fs.stat(activityPath)).size <= ACTIVITY_LIMITS.maxBytes);
  await fs.writeFile(activityPath, '[{"id":"broken","revision":1}]');
  await assert.rejects(store.getActivity(), e => e.code === 'MALFORMED_DATA' && e.message.includes('activity.json'));
});
test('activity API requires local origin on writes and returns reported status after restart', async t => {
  const { root, request } = await apiFixture(t);
  const payload = { id: 'api-codex-report', title: 'API implementation', role: 'manager', status: 'running', summary: 'Implementing local observability.', references: ['os/README.md'] };
  assert.equal((await request('/api/activity')).body.activity.length, 0);
  assert.equal((await request('/api/activity', { method: 'POST', value: payload, headers: { origin: 'http://outside.example' } })).status, 403);
  const created = await request('/api/activity', { method: 'POST', value: payload }); assert.equal(created.status, 201); assert.equal(created.body.reportedBy, 'codex');
  const completed = await request('/api/activity', { method: 'POST', value: { id: payload.id, revision: 1, status: 'completed', summary: 'Local implementation verified.' } }); assert.equal(completed.status, 200);
  const listed = await request('/api/activity'); assert.equal(listed.body.activity[0].status, 'completed');
  assert.equal((await createStore({ workspaceRoot: root }).getActivity()).activity[0].revision, 2);
  assert.equal((await request('/api/activity', { method: 'POST', value: { ...payload, revision: 1 } })).status, 409);
});

test('resource documents and case previews retain actual status and safe linked local images', async t => {
  const { root, store } = await fixture(t);
  const write = async (file, content) => { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), content); };
  await write('resources/INDEX.md', '# Shared resource index');
  await write('resources/methods/review.md', '# Review method');
  const imagePath = 'guides/rippy-club/evidence/frame one.png'; await write(imagePath, 'isolated image transport fixture');
  const absolute = path.join(root, imagePath).split(path.sep).join('/');
  const caseFolder = 'agents/validation/skills/research-products/references/cases';
  await write(`${caseFolder}/first.md`, `# Course case\n\nStatus: **EXTERNAL REFERENCE — outcome unverified.** No own experiment.\n\n![Actual recorded frame](<${absolute}>)`);
  await write(`${caseFolder}/encoded.md`, `# Encoded source\n\n**Status:** EXTERNAL COMPARISON.\n\n![Frame](${absolute.replaceAll(' ', '%20')})`);
  await write(`${caseFolder}/explicit.md`, '# Explicit source label\n\n**EXTERNAL REFERENCE.** Reviewed on a recorded date; no own experiment.');
  await write(`${caseFolder}/remote.md`, '# Remote source\n\n![Remote](https://example.com/image.png)');
  await write(`${caseFolder}/unsafe.md`, '# Unsafe source\n\n![Not permitted](../../../../../../../../outside.png)');
  await write(`${caseFolder}/bad-encoding.md`, '# Invalid image location\n\n![Bad](resources/%broken.png)');
  const docs = (await store.bootstrap()).documents;
  assert.equal((await store.readDocument('resources/methods/review.md')).content, '# Review method');
  assert.equal(docs[0].path, 'resources/INDEX.md');
  const first = docs.find(doc => doc.path === `${caseFolder}/first.md`);
  assert.equal(first.category, 'Product cases'); assert.equal(first.previewPath, imagePath); assert.equal(first.evidenceStatus, 'EXTERNAL REFERENCE — outcome unverified. No own experiment.');
  assert.equal(docs.find(doc => doc.path === `${caseFolder}/encoded.md`).previewPath, imagePath);
  assert.equal(docs.find(doc => doc.path === `${caseFolder}/encoded.md`).evidenceStatus, 'EXTERNAL COMPARISON.');
  assert.equal(docs.find(doc => doc.path === `${caseFolder}/explicit.md`).evidenceStatus, 'EXTERNAL REFERENCE. Reviewed on a recorded date; no own experiment.');
  for (const file of ['remote', 'unsafe', 'bad-encoding']) { const doc = docs.find(doc => doc.path === `${caseFolder}/${file}.md`); assert.equal(doc.previewPath, undefined); assert.equal(doc.evidenceStatus, undefined); }
});
