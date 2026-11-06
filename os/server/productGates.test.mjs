import test from 'node:test';
import assert from 'node:assert/strict';
import {VERIFY_CHECKS, CATALOG_FILTERS, verifyLine, killedAt, shortReason, gauntlet, browseCatalog, parseKeywordBible, normalizeRuns, runTotals, sellPrice} from '../src/productGates.mjs';
import {pipelineState, verifyStarted} from '../src/pipeline.mjs';
import {FIND_CHECK_IDS, UPFRONT_CHECK_IDS, RESEARCH_GATE_IDS, upfrontReady} from '../src/researchView.mjs';
import {buildLeads} from '../src/workflowView.mjs';
import {displayStations} from '../src/displayLine.mjs';
import {STAGES, CHECKS} from './domain.mjs';

// Nov 5: Product is the scraper's catalog, Verify the hard test. These cards live in memory only.
const DAY = '2026-11-04';
const src = 'https://example.com/source';
const passing = {
  provenDemand: {status: 'supported', source: src, observedAt: DAY, units: 800, demand: [{metric: 'kalodata-units', value: 300, url: src, observedAt: '2026-10-20'}, {metric: 'kalodata-units', value: 800, url: src, observedAt: DAY}]},
  dropshippable: {status: 'supported', source: 'https://www.alibaba.com/item', usShipping: true, observedAt: DAY},
  looksWorth: {status: 'supported', source: src, observedAt: DAY},
  audienceRoom: {status: 'supported', source: src, observedAt: DAY, mainAudience: 'Homeowners', audiences: [{who: 'A', problem: 'p', why: 'w'}, {who: 'B', problem: 'p', why: 'w'}]},
  bigIssue: {status: 'supported', source: src, observedAt: DAY, issues: ['sleep'], ladder: {functional: 'f', emotional: 'e', life: 'l'}},
  metaGap: {status: 'supported', source: src, observedAt: DAY, gap: 'Nobody speaks to renters'},
  sourceMatch: {status: 'supported', source: src, observedAt: DAY, listingUrl: src, variant: 'v', destination: 'US', quantity: 1},
  contribution: {status: 'supported', source: src, observedAt: DAY, costs: {currency: 'USD', sellPrice: 59, itemCost: 10, shippingCost: 5, fees: 3, returnReserve: 2, acquisitionAllowance: 15}},
  buyers: {status: 'supported', source: src, observedAt: DAY, quotes: 15, avatars: [{who: 'A', trigger: 't'}, {who: 'B', trigger: 't'}], angleGap: 'gap'},
};
const gatesOk = Object.fromEntries(RESEARCH_GATE_IDS.map(id => [id, {status: 'supported', note: '', source: src, observedAt: DAY}]));
const card = (id, {checks = {}, gates = {}, decision = 'CURATED — scraped', owner = 'unreviewed', keyword} = {}) => ({
  id, name: `Card ${id}`, country: 'US', buyer: 'Homeowners', decision, nextAction: '', references: [],
  screen: {ownerDecision: owner, ownerReason: '', checks}, gates, ...(keyword ? {keyword} : {}),
});
const light = {provenDemand: passing.provenDemand};
const state = cards => {
  const leads = buildLeads({candidates: cards}, {batches: []});
  return {leads, pipeline: pipelineState({stages: STAGES, checks: CHECKS, rounds: [], leads})};
};

test('the seven checks read exactly what a full pass needs, so a product passes all seven only when it is really verified', () => {
  const reads = VERIFY_CHECKS.flatMap(check => check.reads).sort();
  const needed = [...UPFRONT_CHECK_IDS.map(id => `screen:${id}`), ...RESEARCH_GATE_IDS.map(id => `gate:${id}`)].sort();
  assert.deepEqual(reads, needed);
  assert.equal(new Set(VERIFY_CHECKS.map(check => check.id)).size, VERIFY_CHECKS.length);
  assert.equal(new Set(CATALOG_FILTERS.map(filter => filter.id)).size, CATALOG_FILTERS.length);
  const winner = card('L1', {checks: passing, gates: gatesOk});
  assert.ok(upfrontReady(winner));
  assert.ok(verifyLine(winner).every(check => check.state === 'pass'));
});

test('one check: every saved check behind it to pass, a saved failure to fail, otherwise still open', () => {
  const line = verifyLine(card('L2', {checks: {...passing, metaGap: {status: 'failed', note: 'Saturated', source: src, observedAt: DAY}}, gates: {...gatesOk, sourcing: {status: 'pending'}}}));
  const at = id => line.find(check => check.id === id);
  assert.equal(at('meta').state, 'fail');
  assert.equal(at('meta').note, 'Saturated');
  assert.equal(at('factory').state, 'open', 'a pending gate leaves the check open');
  assert.equal(at('uptrend').state, 'pass');
  assert.deepEqual(verifyLine(null).map(check => check.state), VERIFY_CHECKS.map(() => 'open'));
});

test('a killed product is counted once, at the first check that stopped it; a failure without evidence never kills', () => {
  const twoFails = card('L3', {checks: {...passing, looksWorth: {status: 'failed', note: 'Looks cheap', source: src, observedAt: DAY}, metaGap: {status: 'failed', note: 'Saturated', source: src, observedAt: DAY}}});
  assert.equal(killedAt(twoFails).checkId, 'value');
  assert.equal(killedAt(twoFails).note, 'Looks cheap');
  assert.equal(killedAt(card('L4', {checks: {...passing, looksWorth: {status: 'failed', note: 'No evidence'}}})), null);
  assert.equal(killedAt(null), null);
  // A failed check can keep its earlier, positive note: the words that say why win, from the check or else the card's decision.
  const stale = {status: 'failed', note: 'OEM factory verified on Alibaba', source: src, observedAt: DAY};
  assert.equal(killedAt(card('L5', {checks: {...passing, dropshippable: stale}, decision: 'HARD VERIFIER FAIL — Too heavy for air freight'})).note, 'HARD VERIFIER FAIL — Too heavy for air freight');
  assert.equal(killedAt(card('L6', {checks: {...passing, dropshippable: stale}, decision: 'CURATED — looks good'})).note, 'OEM factory verified on Alibaba');
});

test('a reason loses its shouted lead-in and keeps the words that matter', () => {
  assert.equal(shortReason('HARD VERIFIER FAIL — Heavy steel stove'), 'Heavy steel stove');
  assert.equal(shortReason('HARD FAIL (Brand & Price Floor): Logo on the strap'), 'Logo on the strap');
  assert.equal(shortReason('REJECTED — FAILED Live Audit (2026-11-03): Fallback clip'), 'Fallback clip');
  assert.equal(shortReason('PARK: declining trend'), 'declining trend');
  assert.equal(shortReason('Only 4 quotes after three forums.'), 'Only 4 quotes after three forums.');
  assert.equal(shortReason(null), '');
});

test('a card moves by its saved checks alone: catalog, Verify, then Winners with no Save; a failure takes it off', () => {
  const {pipeline, leads} = state([
    card('L10', {checks: light}),
    card('L11', {checks: {...light, buyers: passing.buyers}}),
    card('L12', {checks: passing, gates: gatesOk}),
    card('L13', {checks: {...passing, metaGap: {status: 'failed', note: 'Saturated', source: src, observedAt: DAY}}}),
    card('L14', {owner: 'rejected', checks: passing, gates: gatesOk}),
    card('L15', {decision: 'PARK: older round'}),
  ]);
  const by = id => pipeline.items.find(item => item.id === id);
  assert.deepEqual([by('L10').stepName, by('L10').who], ['Product', 'scout']);
  assert.deepEqual([by('L11').stepName, by('L11').status, by('L11').who], ['Prove it', 'Being verified', 'checker']);
  assert.deepEqual([by('L12').readyToBuild, by('L12').who], [true, 'owner']);
  assert.equal(by('L13').outcome.kind, 'failed');
  assert.equal(by('L14').outcome.kind, 'rejected', 'the owner\'s Reject still wins');
  assert.equal(pipeline.ownerMoves.some(move => move.kind === 'eye-test'), false, 'nothing waits for an eye test on these two pages');
  assert.equal(pipeline.ownerMoves.find(move => move.kind === 'build-pick').go, 'winners');

  const view = gauntlet(pipeline.items, leads);
  assert.deepEqual(view.catalog.map(entry => entry.item.id), ['L10']);
  assert.deepEqual(view.testing.map(entry => entry.item.id), ['L11']);
  assert.deepEqual(view.winners.map(entry => entry.item.id), ['L12']);
  assert.deepEqual(view.killed.map(entry => entry.item.id), ['L13']);
  assert.deepEqual(view.setAside.map(entry => entry.item.id).sort(), ['L14', 'L15']);
  assert.equal(view.testing[0].at.id, 'uptrend', 'testing sits at its first open check');
  // The funnel adds up: tested = killed + testing + winners, and it ends where the kills leave it.
  assert.equal(view.tested, 3);
  assert.equal(view.killRate, 33);
  const meta = view.rows.find(row => row.id === 'meta');
  assert.deepEqual([meta.entered, meta.killed.length, meta.left], [3, 1, 2]);
  assert.equal(view.rows.at(-1).left, view.testing.length + view.through);

  const stations = Object.fromEntries(displayStations(pipeline, {items: [], products: {}}).map(station => [station.id, station]));
  assert.equal(stations.product.owner, false, 'Product never waits on the owner');
  assert.equal(stations.verify.owner, false, 'Verify never waits on the owner');
  assert.equal(stations.winners.owner, true);
});

test('verifyStarted: only a deep record starts the hard test', () => {
  assert.equal(verifyStarted(card('L20', {checks: light})), false);
  assert.equal(verifyStarted(card('L21', {checks: Object.fromEntries(FIND_CHECK_IDS.map(id => [id, passing[id]]))})), false);
  assert.equal(verifyStarted(card('L22', {checks: {...light, contribution: {status: 'failed'}}})), true);
  assert.equal(verifyStarted(card('L23', {checks: light, gates: {competition: {status: 'supported'}}})), true);
  assert.equal(verifyStarted(null), false);
});

test('the catalog sorts and filters on saved numbers; a product missing the number goes last', () => {
  const entry = (id, validation, extra = {}) => ({item: {id, name: `Name ${id}`, validation, ...extra}, candidate: {keyword: extra.keyword}});
  const list = [
    entry('L1', {changePercent: 5, kalodata: {units: 900}, money: {sell: '$30.00'}, direction: 'stable', meta: {liveAds: 40}}),
    entry('L3', {changePercent: 200, kalodata: {units: 100}, money: {sell: '$59.99'}, direction: 'rising', meta: {liveAds: 3}}, {video: 'a.mp4', keyword: 'graphene heating pad'}),
    entry('L2', null),
  ];
  const ids = options => browseCatalog(list, options).map(row => row.item.id);
  assert.deepEqual(ids({}), ['L3', 'L2', 'L1']);
  assert.deepEqual(ids({sort: 'trend'}), ['L3', 'L1', 'L2']);
  assert.deepEqual(ids({sort: 'sold'}), ['L1', 'L3', 'L2']);
  assert.deepEqual(ids({chips: ['rising', 'price', 'meta', 'video']}), ['L3']);
  assert.deepEqual(ids({query: 'name l1'}), ['L1']);
  assert.deepEqual(ids({query: 'graphene'}), ['L3']);
  assert.deepEqual(ids({group: {keywords: ['graphene heating pad']}}), ['L3']);
  assert.equal(sellPrice(list[1].item), 59.99);
  assert.equal(sellPrice(list[2].item), null);
});

test('the keyword list comes from the Keyword Bible\'s table only', () => {
  const groups = parseKeywordBible([
    '| # | Meta-Proven Category | Winner |',
    '| **1** | **Emergency Lighting** | `not a keyword` |',
    '| Category | 25 Exact Keywords |',
    '| **1. Emergency Blackout** | `Solar Ceiling Light`, `power outage light` |',
    '| **Pain & Recovery** | `infrared knee massager` | `769` |',
    '| **2. Water** | `water storage bladder` |',
  ].join('\r\n'));
  assert.deepEqual(groups, [{name: 'Emergency Blackout', keywords: ['solar ceiling light', 'power outage light']}, {name: 'Water', keywords: ['water storage bladder']}]);
  assert.deepEqual(parseKeywordBible(''), []);
  assert.deepEqual(parseKeywordBible(undefined), []);
});

test('scraper runs: bad rows are dropped, never guessed, and the totals add up', () => {
  const runs = normalizeRuns({runs: [
    {id: 'S1', at: '2026-11-05T01:00:00Z', keywords: ['A', ' ', 5], scraped: 1000, kept: 40, removed: {price: 700, stores: 260, junk: 'x', neg: -1}},
    {id: 'S2', at: '2026-11-05T09:00:00Z', scraped: 200, kept: 10, removed: {price: 190}, note: 'Second pass'},
    {at: 'not a date', scraped: 99},
    'nope',
  ]});
  assert.deepEqual(runs.map(run => run.id), ['S2', 'S1']);
  assert.deepEqual(runs[1].keywords, ['a']);
  assert.deepEqual(runs[1].removed, {price: 700, stores: 260});
  const totals = runTotals(runs);
  assert.deepEqual([totals.count, totals.scraped, totals.kept, totals.filteredOut, totals.latest.id], [2, 1200, 50, 1150, 'S2']);
  assert.deepEqual(totals.removed, {price: 890, stores: 260});
  assert.deepEqual(normalizeRuns(null), []);
  assert.deepEqual(runTotals([]).count, 0);
});
