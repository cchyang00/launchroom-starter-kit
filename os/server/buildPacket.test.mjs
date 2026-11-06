import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createStore } from './store.mjs';
import { createApi } from './api.mjs';
import { BUILD_SECTIONS, sameBuildCountry } from './buildPacket.mjs';
import { RESEARCH_GATES, SCREEN_CHECKS } from './research.mjs';
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};

const date = '2026-01-01';
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
const section = (id, extra = {}) => ({ id, content: 'Isolated test evidence; not a real product claim.', source: 'research/fixture.md', observedAt: date, status: 'reviewed', ...extra });
const candidate = (id, status = 'supported', country = 'US') => ({ id, name: 'Isolated research fixture', country, buyer: 'Fixture buyer evidence', decision: 'Fixture review', nextAction: '', references: [], screen:{ownerDecision:'saved',ownerReason:'Fixture owner choice',checks:Object.fromEntries(SCREEN_CHECKS.map(id=>[id,{status:'supported',note:'Fixture screen evidence only',source:id==='productWorks'?'https://example.com/exact-item':'research/fixture.md',observedAt:date,country,evidenceType:'observed',...(FIND_EXTRA[id] || {}), ...(id==='sourceMatch'?{variant:'Fixture variant',destination:country,quantity:1,listingUrl:'https://example.com/fixture-sku'}:{}),...(id==='contribution'?{costs:{currency:'USD',sellPrice:50,itemCost:10,shippingCost:5,fees:3,returnReserve:2,acquisitionAllowance:15}}:{})}]))}, gates: Object.fromEntries(RESEARCH_GATES.map(id => [id, { status, note: 'Fixture evidence only', source: 'research/fixture.md', observedAt: date, window: 'Fixture period' }])) });
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-build-packet-')); await fs.mkdir(path.join(root, 'resources/issues/sleep'), {recursive: true}); await fs.writeFile(path.join(root, 'resources/issues/sleep/ISSUE.md'), '# Issue: Fixture sleep issue\n');
  t.after(async () => { assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('merrivy-build-packet-')); await fs.rm(root, { recursive: true, force: true }); });
  const store = createStore({ workspaceRoot: root });
  await fs.mkdir(path.join(root, 'research'));
  for (const name of ['fixture.md', 'fixture-binding.md', 'other-binding.md']) await fs.writeFile(path.join(root, 'research', name), '# Isolated test evidence only\n');
  let product = await store.createProduct({ name: 'Build fixture', country: 'US', variant: 'Initial fixture variant', sourceUrl: 'https://example.com/exact-item' });
  product = await store.patchProduct(product.id, { revision: product.revision, marketId: product.markets[0].id, market: { researchCandidateId: 'L001' } });
  const assetPath = `products/${product.id}/assets/hero.png`;
  await fs.mkdir(path.join(root, `products/${product.id}/assets`), { recursive: true });
  await fs.writeFile(path.join(root, assetPath), tinyPng);
  const marketId = product.markets[0].id;
  const reviewedSection = id => section(id, id === 'assets' ? { files: [assetPath] } : {});
  const get = () => store.getBuildPacket(product.id, marketId);
  const patch = input => store.patchBuildPacket(product.id, marketId, input);
  async function researchReady() {
    let batch = await store.getResearch();
    for (let n = 1; n <= 5; n++) batch = await store.patchResearch({ revision: batch.revision, candidate: candidate(`L00${n}`) });
    return store.patchResearch({ revision: batch.revision, selectedId: 'L001', selectionReason: 'Fixture owner selection after five reviews.' });
  }
  async function prepare() {
    await researchReady();
    let result = await patch({ revision: 0, candidateId: 'L001', bindingSource: 'research/fixture-binding.md' });
    for (const definition of BUILD_SECTIONS) result = await patch({ revision: result.packet.revision, section: reviewedSection(definition.id) });
    return result;
  }
  return { root, store, product, marketId, assetPath, reviewedSection, get, patch, researchReady, prepare };
}

test('GET has no write side effect; exports remain draft with complete blockers', async t => {
  const f = await fixture(t); const result = await f.get();
  assert.equal(result.packet.revision, 0); assert.equal(result.packet.candidateId, null);
  assert.equal(result.readiness.assetFileChecksSupported, true);
  assert.equal(result.readiness.briefReady, false); assert.equal(result.readiness.atlasReady, false);
  assert.equal(result.readiness.productChecks.sample.status, 'pending');
  assert.equal(result.sectionDefinitions.length, 7); assert.equal(result.readiness.missingSections.length, 6);
  assert.match(result.exports.atlasResearch.content, /^# DRAFT/); assert.match(result.exports.buildPacket.content, /all five research gates/);
  await assert.rejects(fs.stat(path.join(f.root, `products/${f.product.id}/build`)), { code: 'ENOENT' });
});

test('packet conflict detection works across store instances and preserves independent product checks', async t => {
  const f = await fixture(t); const second = createStore({ workspaceRoot: f.root });
  const before = await f.store.getProduct(f.product.id);
  const writes = await Promise.allSettled([f.patch({ revision: 0, section: section('buyer') }), second.patchBuildPacket(f.product.id, f.marketId, { revision: 0, section: section('offer') })]);
  assert.equal(writes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(writes.find(r => r.status === 'rejected').reason.code, 'REVISION_CONFLICT');
  assert.equal((await f.get()).packet.revision, 1); assert.deepEqual(await f.store.getProduct(f.product.id), before);
  assert.equal((await second.getBuildPacket(f.product.id, f.marketId)).packet.revision, 1);
  for (const value of Object.values((await f.get()).exports)) assert.match(await fs.readFile(path.join(f.root, value.path), 'utf8'), /^# DRAFT/);
});

test('review requires content, safe source, real date, fixed section ID and bounded content', async t => {
  const f = await fixture(t);
  for (const invalid of [section('buyer', { content: '' }), section('buyer', { source: '' }), section('buyer', { observedAt: '' }), section('buyer', { observedAt: '2026-02-30' }), section('buyer', { observedAt: '2999-01-01' }), section('buyer', { source: 'https://name:password@example.com' }), section('buyer', { source: '../secret' }), section('unknown'), section('buyer', { content: 'x'.repeat(12001) }), section('buyer', { status: 'approved' })]) {
    await assert.rejects(f.patch({ revision: 0, section: invalid }));
  }
  const result = await f.patch({ revision: 0, section: section('buyer', { status: 'draft', source: '', observedAt: '', content: '' }) });
  assert.equal(result.packet.revision, 1); assert.equal(result.readiness.briefReady, false);
  await assert.rejects(f.patch({ revision: 1, section: section('buyer', { source: 'research/missing.md' }) }), { code: 'EVIDENCE_NOT_FOUND' });
});

test('binding requires exact existing candidate, matching country and explicit identity source', async t => {
  const f = await fixture(t); await f.researchReady();
  await assert.rejects(f.patch({ revision: 0, candidateId: 'L099', bindingSource: 'research/fixture.md' }), { code: 'CANDIDATE_NOT_FOUND' });
  await assert.rejects(f.patch({ revision: 0, candidateId: 'L001' }), /Evidence source/);
  let batch = await f.store.getResearch(); await f.store.patchResearch({ revision: batch.revision, candidate: candidate('L006', 'supported', 'Canada') });
  await assert.rejects(f.patch({ revision: 0, candidateId: 'L006', bindingSource: 'research/fixture.md' }), { code: 'COUNTRY_MISMATCH' });
  let result = await f.patch({ revision: 0, candidateId: 'L001', bindingSource: 'research/fixture.md', section: section('buyer') });
  result = await f.patch({ revision: result.packet.revision, candidateId: 'L002', bindingSource: 'research/other-binding.md' });
  assert.equal(result.packet.sections.buyer.status, 'draft'); assert.equal(result.readiness.ownerSelected, false);
  assert.equal(result.readiness.bindingValid, false, 'another complete candidate cannot stand in for the product-linked card');
  assert.match(result.packet.sections.buyer.content, /test evidence/);
});

test('Atlas handoff rechecks the product card, exact listing and country before scope review', async t => {
  const f = await fixture(t); let result = await f.prepare();
  assert.equal(result.readiness.atlasReady, true);
  let product = await f.store.getProduct(f.product.id);
  product = await f.store.patchProduct(product.id, { revision: product.revision, marketId: f.marketId, market: { researchCandidateId: 'L002' } });
  result = await f.get(); assert.equal(result.readiness.bindingValid, false); assert.equal(result.readiness.atlasReady, false);
  await assert.rejects(f.patch({ revision: result.packet.revision, revalidate: true }), { code: 'PRE_VERIFICATION_REQUIRED' });
  product = await f.store.patchProduct(product.id, { revision: product.revision, marketId: f.marketId, market: { researchCandidateId: 'L001' } });
  product = await f.store.patchProduct(product.id, { revision: product.revision, sourceUrl: 'https://example.com/different-item' });
  result = await f.get(); assert.equal(result.readiness.bindingValid, false);
  await assert.rejects(f.patch({ revision: result.packet.revision, revalidate: true }), { code: 'RESEARCH_IDENTITY_MISMATCH' });
  product = await f.store.patchProduct(product.id, { revision: product.revision, sourceUrl: 'https://example.com/exact-item' });
  result = await f.patch({ revision: result.packet.revision, revalidate: true });
  assert.equal(result.readiness.atlasReady, true, 'restored exact identity still requires an explicit scope review');
});

test('all research support, selection and six reviews precede brief; assets are a separate review', async t => {
  const f = await fixture(t); await f.researchReady();
  let result = await f.patch({ revision: 0, candidateId: 'L001', bindingSource: 'research/fixture.md' });
  for (const definition of BUILD_SECTIONS.filter(s => s.id !== 'assets')) result = await f.patch({ revision: result.packet.revision, section: section(definition.id) });
  assert.equal(result.readiness.briefReady, true); assert.equal(result.readiness.atlasReady, false);
  assert.equal(result.readiness.productChecks.sample.status, 'pending');
  result = await f.patch({ revision: result.packet.revision, section: f.reviewedSection('assets') });
  assert.equal(result.readiness.atlasReady, true);
  let batch = await f.store.getResearch();
  const failed = candidate('L001'); failed.gates.competition.status = 'failed';
  await f.store.patchResearch({ revision: batch.revision, selectedId: null, candidate: failed });
  result = await f.patch({ revision: result.packet.revision, revalidate: true });
  assert.equal(result.readiness.revisionsCurrent, true); assert.equal(result.readiness.researchSupported, false); assert.equal(result.readiness.atlasReady, false);
});

test('reviewed asset handoff requires listed final product files and loses readiness if one disappears', async t => {
  const f = await fixture(t);
  await assert.rejects(f.patch({ revision: 0, section: section('assets') }), /at least one final product asset file/);
  await assert.rejects(f.patch({ revision: 0, section: section('assets', { files: [`products/${f.product.id}/creative/hero.png`] }) }), { code: 'UNSAFE_PATH' });
  await assert.rejects(f.patch({ revision: 0, section: section('assets', { files: [f.assetPath, f.assetPath] }) }), /must not be duplicated/);
  await assert.rejects(f.patch({ revision: 0, section: section('assets', { files: [`products/${f.product.id}/assets/missing.png`] }) }), { code: 'EVIDENCE_NOT_FOUND' });
  const wrongContent = `products/${f.product.id}/assets/wrong.png`;
  await fs.writeFile(path.join(f.root, wrongContent), 'Plain text renamed as PNG.');
  await assert.rejects(f.patch({ revision: 0, section: section('assets', { files: [wrongContent] }) }), { code: 'INVALID_ASSET_CONTENT' });
  const ready = await f.prepare();
  assert.equal(ready.readiness.assetsReviewed, true);
  assert.ok(ready.exports.buildPacket.content.includes(f.assetPath));
  await fs.rm(path.join(f.root, f.assetPath));
  const after = await f.get();
  assert.equal(after.readiness.assetsReviewed, false);
  assert.equal(after.readiness.atlasReady, false);
  assert.deepEqual(after.readiness.missingEvidence, [f.assetPath]);
});

test('replacing a reviewed image with wrong bytes closes Atlas readiness on readback', async t => {
  const f = await fixture(t); const ready = await f.prepare();
  await fs.writeFile(path.join(f.root, f.assetPath), 'Plain text renamed as PNG.');
  const readback = await f.get();
  assert.equal(readback.packet.revision, ready.packet.revision);
  assert.equal(readback.readiness.briefReady, true, 'the reviewed research brief can still guide asset repair');
  assert.equal(readback.readiness.assetsReviewed, false);
  assert.equal(readback.readiness.atlasReady, false);
  assert.deepEqual(readback.readiness.invalidAssets, [f.assetPath]);
  assert.match(readback.readiness.atlasBlockers.join(' '), /content does not match its file type/);
  await assert.rejects(f.patch({ revision: ready.packet.revision, section: section('copy') }), { code: 'INVALID_ASSET_CONTENT' });
  await fs.writeFile(path.join(f.root, f.assetPath), tinyPng);
  assert.equal((await f.get()).readiness.atlasReady, true);
});

test('a missing research-only file withdraws Atlas readiness while preserving saved research and packet', async t => {
  const f = await fixture(t); let ready = await f.prepare();
  for (const definition of BUILD_SECTIONS) ready = await f.patch({ revision: ready.packet.revision, section: section(definition.id, { source: 'research/other-binding.md', ...(definition.id === 'assets' ? { files: [f.assetPath] } : {}) }) });
  assert.equal(ready.readiness.atlasReady, true);
  await fs.rm(path.join(f.root, 'research', 'fixture.md'));
  const readback = await f.get();
  assert.equal(readback.packet.revision, ready.packet.revision);
  assert.deepEqual(readback.readiness.missingEvidence, [], 'packet files still exist');
  assert.equal(readback.readiness.researchSupported, false);
  assert.equal(readback.readiness.atlasReady, false);
  assert.match(readback.readiness.atlasBlockers.join(' '), /Research evidence files are unavailable/);
  assert.equal((await f.store.getResearch()).summary.eligible, 0);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.root, 'research/comparison.json'), 'utf8')).candidates[0].gates.demand.status, 'supported');
});

test('product/research changes invalidate readiness until explicit scope revalidation', async t => {
  const f = await fixture(t); let result = await f.prepare(); assert.equal(result.readiness.atlasReady, true);
  let product = await f.store.patchProduct(f.product.id, { revision: f.product.revision, variant: 'Changed fixture variant' });
  result = await f.get(); assert.equal(result.readiness.revisionsCurrent, false); assert.equal(result.readiness.atlasReady, false);
  result = await f.patch({ revision: result.packet.revision, section: section('copy') });
  assert.equal(result.readiness.revisionsCurrent, false, 'ordinary saves cannot silently revalidate stale scope');
  result = await f.patch({ revision: result.packet.revision, revalidate: true }); assert.equal(result.readiness.atlasReady, true);
  const batch = await f.store.getResearch(); await f.store.patchResearch({ revision: batch.revision, candidate: candidate('L006') });
  result = await f.get(); assert.equal(result.readiness.revisionsCurrent, false);
  product = await f.store.patchProduct(f.product.id, { revision: product.revision, marketId: f.marketId, market: { country: 'Canada' } });
  result = await f.get(); assert.equal(result.readiness.bindingValid, false);
  await assert.rejects(f.patch({ revision: result.packet.revision, revalidate: true }), { code: 'COUNTRY_MISMATCH' });
});

test('known country aliases bind and revalidate without accepting another or unknown country', async t => {
  const f = await fixture(t); await f.researchReady();
  let product = await f.store.patchProduct(f.product.id, { revision: f.product.revision, marketId: f.marketId, market: { country: 'United States' } });
  let result = await f.patch({ revision: 0, candidateId: 'L001', bindingSource: 'research/fixture-binding.md' });
  assert.equal(result.readiness.bindingValid, true, 'US research matches United States product');
  assert.equal(result.readiness.researchSupported, true);
  for (const definition of BUILD_SECTIONS) result = await f.patch({ revision: result.packet.revision, section: f.reviewedSection(definition.id) });
  assert.equal(result.readiness.atlasReady, true);
  product = await f.store.patchProduct(f.product.id, { revision: product.revision, marketId: f.marketId, market: { country: 'USA' } });
  result = await f.get(); assert.equal(result.readiness.revisionsCurrent, false);
  result = await f.patch({ revision: result.packet.revision, revalidate: true });
  assert.equal(result.readiness.atlasReady, true, 'revalidation uses the same alias rule as binding and GET');
  product = await f.store.patchProduct(f.product.id, { revision: product.revision, marketId: f.marketId, market: { country: 'Canada' } });
  assert.equal((await f.get()).readiness.bindingValid, false);
  await assert.rejects(f.patch({ revision: result.packet.revision, revalidate: true }), { code: 'COUNTRY_MISMATCH' });
  assert.equal(sameBuildCountry(' uk ', 'United Kingdom'), true);
  assert.equal(sameBuildCountry('US', 'United Kingdom'), false);
  assert.equal(sameBuildCountry('', ''), false);
  assert.equal(sameBuildCountry('Unknown', 'Unknown'), false);
  assert.equal(sameBuildCountry('Worldwide', 'Worldwide'), false);
});

test('parked and rejected markets block preparation despite complete selected research and reviews', async t => {
  const f = await fixture(t); let result = await f.prepare();
  assert.equal(result.readiness.atlasReady, true);
  let product = await f.store.getProduct(f.product.id);
  for (const status of ['parked', 'rejected']) {
    product = await f.store.patchProduct(f.product.id, { revision: product.revision, marketId: f.marketId, market: { status, reason: 'Fixture decision must be resolved.' } });
    result = await f.patch({ revision: result.packet.revision, revalidate: true, section: section('copy') });
    assert.equal(result.readiness.revisionsCurrent, true);
    assert.equal(result.readiness.researchSupported, true);
    assert.equal(result.readiness.ownerSelected, true);
    assert.equal(result.readiness.marketBlocked, true);
    assert.equal(result.readiness.marketStatus, status);
    assert.equal(result.readiness.briefReady, false);
    assert.equal(result.readiness.atlasReady, false);
    assert.match(result.exports.buildPacket.content, new RegExp(`Product market is ${status}`));
    assert.match(await fs.readFile(path.join(f.root, result.exports.atlasResearch.path), 'utf8'), /^# DRAFT/);
    assert.deepEqual((await f.store.getProduct(f.product.id)).markets[0].checks, product.markets[0].checks);
  }
  product = await f.store.patchProduct(f.product.id, { revision: product.revision, marketId: f.marketId, market: { status: 'active', reason: 'Fixture decision resolved.' } });
  result = await f.get();
  assert.equal(result.readiness.marketBlocked, false);
  assert.equal(result.readiness.revisionsCurrent, false);
  assert.equal(result.readiness.atlasReady, false, 'reactivation alone cannot refresh stale packet review');
  result = await f.patch({ revision: result.packet.revision, revalidate: true });
  assert.equal(result.readiness.briefReady, true);
  assert.equal(result.readiness.atlasReady, true);
});

test('unsafe and foreign market paths and linked storage are rejected without creating packet files', async t => {
  const f = await fixture(t);
  for (const id of ['../escape', 'M%2fescape', 'M\\escape', 'CON', '/tmp', 'M:alternate']) await assert.rejects(f.store.getBuildPacket(f.product.id, id), { code: 'UNSAFE_PATH' });
  await assert.rejects(f.store.getBuildPacket(f.product.id, 'M-foreign'), { code: 'MARKET_NOT_FOUND' });
  await assert.rejects(f.patch({ revision: 0, marketId: 'M-foreign', section: section('buyer') }), { code: 'MARKET_MISMATCH' });
  const linked = path.join(f.root, 'linked-target'); await fs.mkdir(linked);
  await fs.symlink(linked, path.join(f.root, `products/${f.product.id}/build`), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.patch({ revision: 0, section: section('buyer') }), { code: 'UNSAFE_PATH' });
  assert.deepEqual(await fs.readdir(linked), []);
});

test('archived cycles remain readable but cannot mutate or claim readiness', async t => {
  const f = await fixture(t); await f.prepare(); const state = await f.store.getWorkspace();
  await f.store.reviewWorkspaceCycle({ revision: state.revision, productRevision: f.product.revision, productId: f.product.id, outcome: 'inconclusive', whatWorked: 'Fixture review', whatFailed: 'No actual launch', nextChanges: 'New isolated cycle', evidence: [`products/${f.product.id}/OS.md`] });
  const result = await f.get(); assert.equal(result.readiness.archived, true); assert.equal(result.readiness.atlasReady, false);
  await assert.rejects(f.patch({ revision: result.packet.revision, revalidate: true }), { code: 'PRODUCT_ARCHIVED' });
});

test('malformed persisted packet fails visibly instead of being replaced', async t => {
  const f = await fixture(t); const result = await f.patch({ revision: 0, section: section('buyer') });
  const file = path.join(f.root, `products/${f.product.id}/build/${f.marketId}/packet.json`);
  const damaged = { ...result.packet, sections: {} }; await fs.writeFile(file, JSON.stringify(damaged));
  await assert.rejects(f.get(), { code: 'MALFORMED_DATA' });
  await assert.rejects(f.patch({ revision: 1, section: section('offer') }), { code: 'MALFORMED_DATA' });
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), damaged);
});

test('removing reviewed local evidence withdraws readiness without rewriting the packet', async t => {
  const f = await fixture(t); const ready = await f.prepare();
  await fs.rm(path.join(f.root, 'research/fixture.md'));
  const readback = await f.get();
  assert.equal(readback.packet.revision, ready.packet.revision);
  assert.equal(readback.readiness.atlasReady, false);
  assert.deepEqual(readback.readiness.missingEvidence, ['research/fixture.md']);
  assert.match(readback.exports.atlasResearch.content, /Local reviewed evidence is unavailable/);
});

test('HTTP route enforces local mutation policy and packet revision', async t => {
  const f = await fixture(t); const api = createApi({ workspaceRoot: f.root });
  const server = http.createServer(api); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = `/api/products/${f.product.id}/build-packet?marketId=${f.marketId}`;
  const request = (method, payload, origin) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: endpoint, method, headers: { Host: 'localhost:3000', 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks)) }));
    }); req.on('error', reject); req.end(payload ? JSON.stringify(payload) : undefined);
  });
  let response = await request('GET'); assert.equal(response.status, 200); assert.equal(response.data.packet.revision, 0);
  const payload = { revision: 0, marketId: f.marketId, section: section('buyer') };
  response = await request('PATCH', payload); assert.equal(response.status, 403);
  response = await request('PATCH', payload, 'http://localhost:3000'); assert.equal(response.status, 200);
  response = await request('PATCH', payload, 'http://localhost:3000'); assert.equal(response.status, 409);
});
