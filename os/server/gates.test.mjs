// The seven gates read from the saved checks (src/gates.mjs), the owner's Step 1
// (Oct 2, product first: statistics, dropshippable, a good product, 3+ avatars or
// angles, a benefit ladder to our issues and an angle gap) and the migration of old check
// states: nothing passes that the saved records do not, and an old pass of a
// line that now asks for more shows as "partly", never as a pass. In-memory only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GATES, itemGates, gateLine, gateLineText, cardCheckState, METHOD_FROM} from '../src/gates.mjs';
import {provenDemandMet, statsMet, statsTrend, checkView, checkPasses, cardStats, cardIdentity, dropshippableMet, metaGapMet, bigIssueMet, findReady, STEP2_RULE_FROM, FIND_CHECK_IDS} from '../src/researchView.mjs';
import {validateResearch, emptyResearch} from './research.mjs';
import {STEP_IDS} from '../src/steps.mjs';
import {CHECKS} from './domain.mjs';

const amazon = (observedAt, value) => ({metric: 'amazon-bought', value, url: 'https://www.amazon.com/dp/X1', observedAt});
const supported = (observedAt, extra = {}) => ({status: 'supported', note: 'Seen', source: 'https://example.com/item', observedAt, country: 'US', evidenceType: 'observed', ...extra});
const pending = () => ({status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''});
const meta = {advertisers: 4, longestActiveDays: 120, liveAds: 9};
const oct1 = () => ({provenDemand: supported('2026-10-01', {source: 'https://www.facebook.com/ads/library/?q=x', ...meta}), looksWorth: supported('2026-10-01'), productWorks: supported('2026-10-01'), noBrand: supported('2026-10-01'),
  audienceRoom: supported('2026-10-01', {mainAudience: 'Partners of snorers', audiences: [{who: 'Night-shift nurses', problem: 'Day sleep', why: 'Forums'}, {who: 'New parents', problem: 'Broken sleep', why: 'Forums'}]})});
const step2 = (day = '2026-10-02') => ({...oct1(),
  dropshippable: supported(day, {source: 'https://www.aliexpress.com/item/1.html', usShipping: true}),
  provenDemand: supported(day, {source: 'https://www.amazon.com/dp/X1', demand: [amazon('2026-08-02', 300), amazon('2026-10-02', 420)], trend: [{date: '2025-10', value: 40}, {date: '2026-09', value: 55}], trendUrl: 'https://trends.google.com/trends/explore?q=x'}),
  looksWorth: supported(day, {source: 'https://www.aliexpress.com/item/1.html'}),
  metaGap: supported(day, {source: 'https://www.facebook.com/ads/library/?q=x', ...meta, gap: 'Nobody speaks to night-shift nurses'}),
  bigIssue: supported(day, {issues: ['sleep'], ladder: {functional: 'Blocks a snorer\'s noise', emotional: 'Calm instead of resentful', life: 'Rested for work'}, note: 'Related to sleep'}),
});
const card = checks => ({id: 'L500', name: 'Card', country: 'US', buyer: '', decision: 'CURATED — UNVERIFIED', nextAction: '', references: [],
  screen: {ownerDecision: 'unreviewed', ownerReason: '', checks: {dropshippable: pending(), metaGap: pending(), bigIssue: pending(), sourceMatch: pending(), contribution: pending(), ...checks}},
  gates: Object.fromEntries(['demand', 'community', 'competition', 'sourcing', 'fit'].map(id => [id, {status: 'pending', note: '', source: '', observedAt: '', window: ''}]))});

test('Step 1 (owner, Oct 2): statistics shown by 2+ dated points, dropshippable, an angle gap and a benefit ladder to our issues', () => {
  assert.equal(STEP2_RULE_FROM, '2026-10-02'); assert.equal(METHOD_FROM, STEP2_RULE_FROM);
  assert.deepEqual(FIND_CHECK_IDS, ['provenDemand', 'dropshippable', 'looksWorth', 'audienceRoom', 'bigIssue', 'metaGap']);
  // Statistics: a trend is shown, never claimed.
  assert.deepEqual(statsTrend({demand: [amazon('2026-08-02', 300)]}).direction, 'unknown', 'one point is not a trend');
  assert.deepEqual(statsTrend({demand: [amazon('2026-08-02', 300), amazon('2026-10-02', 420)]}), {direction: 'rising', metric: 'amazon-bought', points: 2, from: '2026-08-02', to: '2026-10-02', changePercent: 40});
  assert.equal(statsTrend({demand: [amazon('2026-08-02', 300), amazon('2026-10-02', 320)]}).direction, 'stable');
  assert.equal(statsTrend({demand: [amazon('2026-08-02', 300), amazon('2026-10-02', 200)]}).direction, 'falling');
  assert.equal(statsTrend({trend: [{date: '2025-10', value: 40}, {date: '2026-03', value: 42}, {date: '2026-09', value: 41}]}).direction, 'stable', 'a Google Trends curve is a series too');
  assert.equal(statsMet({demand: [amazon('2026-08-02', 300), amazon('2026-10-02', 200)]}), false, 'falling never passes');
  assert.equal(statsMet({trend: [{date: '2025-10', value: 40}, {date: '2026-09', value: 55}]}), false, 'a curve alone has no linked number');
  const fresh = step2().provenDemand;
  assert.equal(checkPasses('provenDemand', fresh), true);
  // The Oct 1 Meta-only demand check stays valid as saved evidence, but never passes the gate now.
  const old = oct1().provenDemand;
  assert.equal(provenDemandMet(old), true); assert.equal(checkPasses('provenDemand', old), false);
  assert.match(checkView('provenDemand', old).reason, /Marked as a pass, but it needs statistics with links: 2\+ dated points/);
  // F2 dropshippable, F6 angle gap (any channel), F5 the benefit ladder.
  assert.equal(dropshippableMet({source: 'https://cjdropshipping.com/product/x'}), true);
  assert.equal(dropshippableMet({source: 'https://www.aliexpress.com/item/1.html'}), false, 'AliExpress needs US dropship shipping');
  assert.equal(dropshippableMet({source: 'https://www.amazon.com/dp/X1', usShipping: true}), false, 'a marketplace listing is not a supplier');
  assert.equal(metaGapMet({source: 'https://www.amazon.com/s?k=x', gap: ''}), false, 'the gap must be written down');
  assert.equal(metaGapMet({source: 'https://www.amazon.com/s?k=x', gap: 'No listing speaks to night-shift nurses'}), true, 'any channel; Meta Ad Library is optional');
  const ladder = {functional: 'Walk without knee pain', emotional: 'Confident, not a burden', life: 'Can exercise'};
  assert.equal(bigIssueMet({issues: ['low-energy'], ladder}), true); assert.equal(bigIssueMet({issue: 'sleep', ladder}), true, 'one issue named the older way still counts');
  assert.equal(bigIssueMet({issues: ['sleep'], ladder: {functional: 'x', emotional: 'y'}}), false, 'all three rungs'); assert.equal(bigIssueMet({issues: ['../x'], ladder}), false);
  // The saved record validates: Oct 1 evidence by its rule, Oct 2 evidence by the new one.
  const research = {...emptyResearch(), candidates: [card(oct1())]};
  assert.doesNotThrow(() => validateResearch(research));
  assert.doesNotThrow(() => validateResearch({...research, candidates: [card(step2())]}));
  const bad = card(step2()); bad.screen.checks.provenDemand.demand = [amazon('2026-10-02', 420)]; bad.screen.checks.provenDemand.trend = [];
  assert.throws(() => validateResearch({...research, candidates: [bad]}), /"Statistics" passes only with a source link and date and statistics with links: 2\+ dated points/);
  const noLink = card(step2()); noLink.screen.checks.provenDemand.demand[0].url = '';
  assert.throws(() => validateResearch({...research, candidates: [noLink]}), /every demand point needs its link/);
  const looks = card(step2()); looks.screen.checks.looksWorth.source = 'research/notes.md';
  assert.throws(() => validateResearch({...research, candidates: [looks]}), /judged on the real photos: its source is the exact listing URL/);
  const drop = card(step2()); drop.screen.checks.dropshippable.usShipping = false;
  assert.throws(() => validateResearch({...research, candidates: [drop]}), /"Dropshippable" passes only with the supplier listing link/);
  // The eye test: only with all six.
  assert.equal(findReady(card(oct1())), false, 'an Oct 1 card without statistics never reaches the eye test');
  assert.equal(findReady(card(step2())), true);
});

test('the statistics shape the product card panel reads (cardStats) and the card identity', () => {
  const stats = cardStats(card(step2()));
  assert.deepEqual(Object.keys(stats), ['demand', 'trend', 'trendUrl', 'direction', 'competition', 'ladder', 'avatars', 'issues']);
  assert.deepEqual(stats.demand.map(point => [point.label, point.value, point.observedAt]), [['Amazon bought in past month', 300, '2026-08-02'], ['Amazon bought in past month', 420, '2026-10-02']]);
  assert.equal(stats.direction.direction, 'rising'); assert.equal(stats.trend.length, 2);
  assert.deepEqual([stats.competition.liveAds, stats.competition.gap], [9, 'Nobody speaks to night-shift nurses']);
  assert.deepEqual(stats.avatars.map(avatar => avatar.who), ['Partners of snorers', 'Night-shift nurses', 'New parents']);
  assert.deepEqual(stats.issues, ['sleep']); assert.equal(stats.ladder.emotional, 'Calm instead of resentful');
  assert.deepEqual(cardStats(null).demand, []);
  assert.equal(cardIdentity(card(step2())), 'https://example.com/item', 'the Oct 1 exact-listing check wins when present');
  const fresh = card(step2()); fresh.screen.checks.productWorks = pending();
  assert.equal(cardIdentity(fresh), 'https://www.aliexpress.com/item/1.html');
});

test('the gate lines for a card: Product\'s six lines, Buyers\' three from its buyers check, nothing past Product without evidence', () => {
  const legacy = itemGates({candidate: card(oct1())});
  assert.deepEqual(legacy.map(gate => gate.step), STEP_IDS);
  assert.deepEqual(STEP_IDS, ['product', 'buyers', 'prove', 'create', 'build', 'launch', 'learn'], 'product first, then its buyers (owner, Oct 2)');
  assert.deepEqual(Object.fromEntries(legacy[0].lines.map(line => [line.id, line.state])), {F1: 'pending', F2: 'pending', F3: 'passed', F4: 'passed', F5: 'pending', F6: 'pending'});
  assert.equal(gateLineText(legacy[0].lines[0]), 'F1 Statistics: rising or stable demand: not yet');
  assert.ok(legacy.slice(1).every(gate => gate.lines.every(line => line.state === 'pending')), 'nothing past Product without saved evidence');
  const full = itemGates({candidate: card(step2())});
  assert.deepEqual(full.slice(0, 2).map(gate => gate.lines.map(line => line.state)), [['passed', 'passed', 'passed', 'passed', 'passed', 'passed'], ['pending', 'pending', 'pending']]);
  // Step 2 · Buyers: this product's own buyers, each line by its own rule (A1 15+ quotes, A2 2+ avatars with a trigger, A3 the angle gap).
  const avatars = [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}];
  const withBuyers = extra => card({...step2(), buyers: supported('2026-10-02', {source: 'https://example.com/buyers-write-up', quotes: 15, avatars, angleGap: 'Nobody speaks to night-shift nurses', ...extra})});
  assert.deepEqual(GATES.buyers.map(line => line.id), ['A1', 'A2', 'A3']);
  assert.deepEqual(itemGates({candidate: withBuyers()})[1].lines.map(line => line.state), ['passed', 'passed', 'passed']);
  assert.equal(checkPasses('buyers', withBuyers().screen.checks.buyers), true);
  const thin = {...withBuyers().screen.checks.buyers, status: 'pending', quotes: 9, avatars: [avatars[0], {who: 'Gardeners', trigger: ''}], angleGap: ''};
  assert.deepEqual(GATES.buyers.map(line => gateLine(line, {candidate: card({...step2(), buyers: {...thin, status: 'supported'}})}).state), ['pending', 'pending', 'pending'], 'too few quotes, an avatar without its trigger, no gap');
  assert.deepEqual(itemGates({candidate: withBuyers({status: 'failed'})})[1].lines.map(line => line.state), ['failed', 'failed', 'failed']);
  const research = {...emptyResearch(), candidates: [withBuyers()]};
  assert.doesNotThrow(() => validateResearch(research));
  assert.throws(() => validateResearch({...research, candidates: [withBuyers({quotes: 9})]}), /"Buyers" passes only with 15\+ verified quotes tied to this product/);
  assert.throws(() => validateResearch({...research, candidates: [withBuyers({quotes: 2.5})]}), /quotes is how many verified quotes/);
  assert.doesNotThrow(() => validateResearch({...research, candidates: [card(step2())]}), 'a card saved before Buyers has no buyers check: it is simply pending');
  const failed = card(step2()); failed.screen.checks.metaGap = {...failed.screen.checks.metaGap, status: 'failed'};
  assert.equal(cardCheckState(failed, 'metaGap'), 'failed');
  assert.equal(cardCheckState(null, 'bigIssue'), 'pending');
  assert.deepEqual(GATES.product.map(line => [line.id, line.card[0]]), [['F1', 'provenDemand'], ['F2', 'dropshippable'], ['F3', 'looksWorth'], ['F4', 'audienceRoom'], ['F5', 'bigIssue'], ['F6', 'metaGap']]);
});

test('the gate lines for a product record: every product check sits under one line; new parts stay open on old evidence', () => {
  const used = new Set(Object.values(GATES).flat().flatMap(line => line.product || []));
  assert.deepEqual(CHECKS.map(check => check.id).filter(id => !used.has(id)), [], 'no saved product check is lost');
  const verified = (ids, observedAt) => Object.fromEntries(ids.map(id => [id, {status: 'verified', observedAt}]));
  const market = (checks, ready = true) => ({id: 'm1', country: 'US', status: 'active', verificationGate: {ready}, checks});
  const all = CHECKS.map(check => check.id);
  const oldRecord = itemGates({market: market(verified(all, '2026-09-20'))});
  assert.deepEqual(Object.fromEntries(oldRecord[1].lines.map(line => [line.id, line.state])), {A1: 'partly', A2: 'partly', A3: 'pending'}, 'the old buyer checks did not ask for 15 product quotes, trigger moments or the angle gap');
  assert.deepEqual(Object.fromEntries(oldRecord[2].lines.map(line => [line.id, line.state])), {P1: 'passed', P2: 'passed', P3: 'passed', P4: 'partly', P5: 'passed'}, 'the money line was not asked in full before Oct 2');
  assert.equal(gateLineText(oldRecord[2].lines[3]), 'P4 The money line: old check passed, new part open: break-even ROAS and the target cost per sale');
  assert.deepEqual(oldRecord[5].lines.map(line => line.state), ['partly', 'pending', 'partly', 'pending', 'passed'], 'no saved record for the test order or taxes: open');
  const newRecord = itemGates({market: market(verified(all, '2026-10-05'))});
  assert.deepEqual(newRecord[1].lines.map(line => line.state), ['passed', 'passed', 'pending'], 'the angle gap is read from the card');
  assert.deepEqual(newRecord[2].lines.map(line => line.state), ['passed', 'passed', 'passed', 'passed', 'passed']);
  assert.ok(itemGates({market: market(verified(all, '2026-10-05'), false)})[2].lines.every(line => line.state === 'pending'), 'an open card binding keeps every product check pending');
  assert.equal(gateLine({id: 'X1', label: 'Nothing saved'}, {}).state, 'pending');
});
