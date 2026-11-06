import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, STAGES } from './domain.mjs';
import { SCREEN_CHECKS } from './research.mjs';
import { projectProductResearch, researchBinding } from './productResearch.mjs';
import { effectiveCheckStatus, effectiveVerifiedCount, processState } from '../src/processModel.mjs';
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};

const screen = () => ({ id: 'L095', country: 'US', screen: { ownerDecision: 'saved', checks: Object.fromEntries(SCREEN_CHECKS.map(id => [id, { status: 'supported', source: id === 'productWorks' ? 'https://example.com/item' : '', ...(FIND_EXTRA[id] || {}) }])) } });
const product = () => ({ id: 'P002-test', sourceUrl: 'https://example.com/item', markets: [{ id: 'M1', country: 'United States', researchCandidateId: 'L095', status: 'active', checks: { 'exact-product': { status: 'verified', source: 'https://example.com/item' } }, verifiedCount: 1, stageId: 'validation' }] });

test('current screen counts existing product proof without altering its saved status', () => {
  const item = projectProductResearch(product(), { candidates: [screen()] });
  const market = item.markets[0];
  assert.equal(market.verificationGate.ready, true);
  assert.equal(market.effectiveVerifiedCount, 1);
  assert.equal(effectiveCheckStatus(market, 'exact-product'), 'verified');
  assert.equal(processState(STAGES, CHECKS, market).verified, 1);
});

test('revoked or missing screen hides historical proof from current workflow progress', () => {
  const original = product();
  const revoked = screen(); revoked.screen.ownerDecision = 'passed';
  for (const research of [{ candidates: [] }, { candidates: [revoked] }]) {
    const item = projectProductResearch(original, research);
    const market = item.markets[0];
    assert.equal(market.verificationGate.ready, false);
    assert.equal(market.verifiedCount, 1, 'historical evidence is preserved');
    assert.equal(effectiveVerifiedCount(market), 0);
    assert.equal(effectiveCheckStatus(market, 'exact-product'), 'pending');
    assert.equal(processState(STAGES, CHECKS, market).verified, 0);
    assert.equal(processState(STAGES, CHECKS, market).currentIndex, 0);
  }
  assert.equal(original.markets[0].checks['exact-product'].status, 'verified');
});

test('research binding requires the same selling country and exact listing', () => {
  const item = product(); const research = { candidates: [screen()] };
  item.markets[0].country = 'GB';
  assert.equal(researchBinding(item, item.markets[0], research).code, 'RESEARCH_COUNTRY_MISMATCH');
  item.markets[0].country = 'US'; item.sourceUrl = 'https://example.com/other';
  assert.equal(researchBinding(item, item.markets[0], research).code, 'RESEARCH_IDENTITY_MISMATCH');
  item.markets[0].researchCandidateId = '';
  assert.equal(researchBinding(item, item.markets[0], research).code, 'PRE_VERIFICATION_REQUIRED');
});
