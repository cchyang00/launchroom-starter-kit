import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApi } from './api.mjs';
import { BUILD_SECTIONS } from './buildPacket.mjs';
import { RESEARCH_GATES, SCREEN_CHECKS } from './research.mjs';
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};

const today = new Date().toISOString().slice(0, 10);
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
const listing = id => `https://example.com/product/${id}`;
const researchSource = 'research/synthetic-evidence.md';
const packetSource = 'research/synthetic-packet.md';
const productSource = 'research/synthetic-product.md';
const pendingGate = () => ({ status: 'pending', note: '', source: '', observedAt: '', window: '' });
const supportedGate = id => ({ status: 'supported', note: `Synthetic ${id} evidence reviewed for this fixture only.`, source: researchSource, observedAt: today, window: `30 days ending ${today}` });

function candidate(id, { ownerDecision = 'saved', preflight = true, deep = true } = {}) {
  const checks = Object.fromEntries(SCREEN_CHECKS.map(checkId => [checkId, {
    status: 'supported', note: `Synthetic ${checkId} observation for ${id}.`, source: ['productWorks', 'looksWorth'].includes(checkId) ? listing(id) : researchSource,
    observedAt: today, country: 'US', evidenceType: 'observed',
    ...(FIND_EXTRA[checkId] || {}), ...(checkId === 'sourceMatch' ? { listingUrl: `https://example.com/supplier/${id}`, variant: `${id} synthetic variant`, destination: 'US', quantity: 1 } : {}),
    ...(checkId === 'contribution' ? { costs: { currency: 'USD', sellPrice: 50, itemCost: 10, shippingCost: 5, fees: 3, returnReserve: 2, acquisitionAllowance: 15 } } : {}),
  }]));
  if (!preflight) for (const id of ['sourceMatch', 'contribution']) checks[id].status = 'pending';
  return {
    id, name: `Synthetic ${id}`, country: 'US', buyer: 'Synthetic buyer situation; no real claim.', decision: 'Fixture only', nextAction: 'Check next gate.', references: [researchSource],
    screen: { ownerDecision, ownerReason: ownerDecision === 'saved' ? 'Synthetic owner-decision fixture.' : '', checks },
    gates: Object.fromEntries(RESEARCH_GATES.map(gateId => [gateId, deep ? supportedGate(gateId) : pendingGate()])),
  };
}

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-workflow-journey-')); await fs.mkdir(path.join(root, 'resources/issues/sleep'), {recursive: true}); await fs.writeFile(path.join(root, 'resources/issues/sleep/ISSUE.md'), '# Issue: Fixture sleep issue\n');
  await fs.mkdir(path.join(root, 'research'), { recursive: true });
  await fs.mkdir(path.join(root, 'products'), { recursive: true });
  await fs.writeFile(path.join(root, 'products', 'INDEX.md'), '# Isolated test products\n');
  for (const source of [researchSource, packetSource, productSource]) await fs.writeFile(path.join(root, source), '# Synthetic fixture evidence, not product proof\n');
  const handler = createApi({ workspaceRoot: root });
  const server = http.createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), os.tmpdir());
    assert.ok(path.basename(root).startsWith('merrivy-workflow-journey-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const request = (route, method = 'GET', value) => new Promise((resolve, reject) => {
    const data = value === undefined ? undefined : JSON.stringify(value);
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: { Host: 'localhost:3000', ...(method === 'GET' ? {} : { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }) } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: content ? JSON.parse(content) : null });
      });
    });
    req.on('error', reject); req.end(data);
  });
  return { root, request };
}

test('synthetic A-to-Z OS journey preserves each decision gate and stops Atlas when evidence disappears', async t => {
  const { root, request } = await fixture(t);
  let response = await request('/api/bootstrap');
  assert.equal(response.status, 200);
  assert.equal(response.body.products.length, 0);
  let batch = (await request('/api/research')).body;
  assert.equal(batch.summary.readyForVerification, 0);

  let first = candidate('L001', { ownerDecision: 'unreviewed', preflight: false, deep: false });
  response = await request('/api/research', 'PATCH', { revision: batch.revision, candidate: first });
  assert.equal(response.status, 200); batch = response.body;
  assert.equal(batch.summary.fastScreened, 1);
  assert.equal(batch.summary.readyForVerification, 0);
  let attempt = structuredClone(first); attempt.gates.demand = supportedGate('demand');
  assert.equal((await request('/api/research', 'PATCH', { revision: batch.revision, candidate: attempt })).status, 400, 'deep research waits for owner Save');
  first.screen.ownerDecision = 'saved'; first.screen.ownerReason = 'Synthetic owner-decision fixture; no human selection asserted.';
  response = await request('/api/research', 'PATCH', { revision: batch.revision, candidate: first });
  assert.equal(response.status, 200); batch = response.body;
  attempt = structuredClone(first); attempt.gates.fit = supportedGate('fit');
  assert.equal((await request('/api/research', 'PATCH', { revision: batch.revision, candidate: attempt })).status, 400, 'owner Save alone does not bypass exact source and contribution for the later deep checks (P1 alone opens after Buyers, Oct 3)');
  first.screen.checks.sourceMatch = candidate('L001').screen.checks.sourceMatch;
  first.screen.checks.contribution = candidate('L001').screen.checks.contribution;
  response = await request('/api/research', 'PATCH', { revision: batch.revision, candidate: first });
  assert.equal(response.status, 200); batch = response.body;
  assert.equal(batch.summary.readyForVerification, 1);
  first.gates = candidate('L001').gates;
  response = await request('/api/research', 'PATCH', { revision: batch.revision, candidate: first });
  assert.equal(response.status, 200); batch = response.body;
  assert.equal(batch.summary.reviewed, 1);
  assert.equal((await request('/api/research', 'PATCH', { revision: batch.revision, selectedId: 'L001', selectionReason: 'Synthetic final choice.' })).status, 400, 'one review cannot replace the five-comparison minimum');
  for (let n = 2; n <= 5; n++) {
    response = await request('/api/research', 'PATCH', { revision: batch.revision, candidate: candidate(`L00${n}`) });
    assert.equal(response.status, 200); batch = response.body;
  }
  assert.equal(batch.summary.reviewed, 5);
  response = await request('/api/research', 'PATCH', { revision: batch.revision, selectedId: 'L001', selectionReason: 'Synthetic comparison fixture; not an actual owner choice.' });
  assert.equal(response.status, 200); batch = response.body;
  assert.equal(batch.selectedId, 'L001');

  response = await request('/api/products', 'POST', { name: 'Synthetic exact item', country: 'US', sourceUrl: listing('L001'), variant: 'L001 synthetic variant' });
  assert.equal(response.status, 201); let product = response.body;
  const marketId = product.markets[0].id;
  const check = id => ({ id, status: 'verified', note: `Synthetic ${id} finding only.`, source: productSource, evidenceType: 'observed', observedAt: today, window: `30 days ending ${today}` });
  assert.equal((await request(`/api/products/${product.id}`, 'PATCH', { revision: product.revision, marketId, check: check('exact-product') })).status, 409, 'product proof waits for exact card binding');
  response = await request(`/api/products/${product.id}`, 'PATCH', { revision: product.revision, marketId, market: { researchCandidateId: 'L001' } });
  assert.equal(response.status, 200); product = response.body;
  assert.equal(product.markets[0].verificationGate.ready, true);
  assert.equal((await request(`/api/products/${product.id}`, 'PATCH', { revision: product.revision, marketId, check: { ...check('exact-product'), source: 'research/missing-proof.md' } })).status, 404, 'nonexistent local proof cannot turn a check green');
  for (const id of ['exact-product', 'buyer-situation']) {
    response = await request(`/api/products/${product.id}`, 'PATCH', { revision: product.revision, marketId, check: check(id) });
    assert.equal(response.status, 200); product = response.body;
  }
  assert.equal(product.markets[0].effectiveVerifiedCount, 2);
  assert.equal(product.markets[0].status, 'active');

  const endpoint = `/api/products/${product.id}/build-packet?marketId=${marketId}`;
  let packet = (await request(endpoint)).body;
  assert.equal(packet.readiness.briefReady, false);
  assert.equal(packet.readiness.atlasReady, false);
  response = await request(endpoint, 'PATCH', { revision: packet.packet.revision, candidateId: 'L001', bindingSource: packetSource });
  assert.equal(response.status, 200); packet = response.body;
  for (const section of BUILD_SECTIONS.filter(section => section.id !== 'assets')) {
    response = await request(endpoint, 'PATCH', { revision: packet.packet.revision, section: { id: section.id, status: 'reviewed', content: `Synthetic ${section.title} handoff, no real claims.`, source: packetSource, observedAt: today } });
    assert.equal(response.status, 200); packet = response.body;
  }
  assert.equal(packet.readiness.briefReady, true);
  assert.equal(packet.readiness.atlasReady, false, 'asset production is a separate handoff');
  const assetPath = `products/${product.id}/assets/hero.png`;
  await fs.mkdir(path.join(root, 'products', product.id, 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, assetPath), tinyPng);
  response = await request(endpoint, 'PATCH', { revision: packet.packet.revision, section: { id: 'assets', status: 'reviewed', content: 'Synthetic slot-to-file mapping and rights review fixture.', source: packetSource, observedAt: today, files: [assetPath] } });
  assert.equal(response.status, 200); packet = response.body;
  assert.equal(packet.readiness.atlasReady, true);
  assert.equal(packet.readiness.productChecks.sample.status, 'pending', 'packet readiness does not imply launch or sample verification');
  assert.match(packet.exports.atlasResearch.content, /Synthetic Buyer evidence handoff/);
  assert.match(packet.exports.buildPacket.content, new RegExp(assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  await fs.rm(path.join(root, researchSource));
  const paused = (await request(endpoint)).body;
  assert.equal(paused.readiness.atlasReady, false);
  assert.deepEqual(paused.readiness.missingEvidence, [], 'packet evidence still exists; research is the blocker');
  assert.match(paused.readiness.atlasBlockers.join(' '), /Research evidence files are unavailable/);
  const researchAfter = (await request('/api/research')).body;
  assert.equal(researchAfter.summary.readyForVerification, 0);
  assert.equal(researchAfter.summary.reviewed, 0);
  assert.equal((await request(`/api/products/${product.id}`)).body.markets[0].effectiveVerifiedCount, 0);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'research', 'comparison.json'), 'utf8')).candidates[0].screen.checks.sourceMatch.status, 'supported', 'historical evidence remains intact');
  await fs.writeFile(path.join(root, researchSource), '# Restored synthetic fixture evidence\n');
  assert.equal((await request(endpoint)).body.readiness.atlasReady, true);
  await fs.writeFile(path.join(root, assetPath), 'This is not a PNG.');
  const corruptAsset = (await request(endpoint)).body;
  assert.equal(corruptAsset.readiness.atlasReady, false);
  assert.deepEqual(corruptAsset.readiness.invalidAssets, [assetPath]);
  await fs.writeFile(path.join(root, assetPath), tinyPng);
  assert.equal((await request(endpoint)).body.readiness.atlasReady, true);
  await fs.rm(path.join(root, assetPath));
  assert.equal((await request(endpoint)).body.readiness.atlasReady, false, 'missing final media closes the Atlas handoff');
});
