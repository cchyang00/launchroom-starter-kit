import test from 'node:test';
import assert from 'node:assert/strict';
import {compactNumber, demandFigures, trendSeries, sparkPoints, trendShot, dropshipView, gateMissing, gateList, saveBlockReason, statsPanel, statsSummary, GATE_NUMBERS} from '../src/statsPanel.mjs';
import {cardStats} from '../src/researchView.mjs';
import {emptyResearch, updateResearch, SCREEN_CHECKS, RESEARCH_GATES} from './research.mjs';

// The product card's Statistics panel (owner, Oct 2): agents collect the
// numbers, the owner verifies them. Built on cards shaped like L100 (full
// statistics), L102 (refused: no numbers) and a one-point card.
const seen = {status: 'supported', observedAt: '2026-10-02', country: 'US', evidenceType: 'observed', note: 'Fixture.'};
const pending = {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''};
const L100 = () => ({
  id: 'L100', name: 'Folding cane', country: 'US', buyer: 'Seniors', decision: 'CURATED', nextAction: 'Eye test',
  references: ['research/2026-10-02-numbers-first/L100.md', 'resources/research-previews/2026-10-02-numbers-first/L100-cane-1.jpg', 'resources/research-previews/2026-10-02-numbers-first/trends-walking-cane.jpg', 'https://www.amazon.com/dp/B0BG8DPFN1'],
  gates: Object.fromEntries(RESEARCH_GATES.map(id => [id, {status: 'pending', note: '', source: '', observedAt: '', window: ''}])),
  screen: {ownerDecision: 'unreviewed', ownerReason: '', checks: {
    provenDemand: {...seen, note: 'Badge, reviews and the Trends curve.', source: 'https://www.amazon.com/s?k=folding+walking+cane',
      demand: [{metric: 'amazon-bought', value: 7000, url: 'https://www.amazon.com/dp/B0BG8DPFN1', observedAt: '2026-10-02', note: 'Best Seller, $29.99.'}, {metric: 'amazon-reviews', value: 12908, url: 'https://www.amazon.com/dp/B0BG8DPFN1', observedAt: '2026-10-02'}],
      trend: [{date: '2025-09-28', value: 55}, {date: '2026-02-15', value: 60}, {date: '2026-04-12', value: 100}, {date: '2026-07-05', value: 60}, {date: '2026-09-20', value: 56}],
      trendUrl: 'https://trends.google.com/trends/explore?geo=US&q=walking%20cane'},
    dropshippable: {...seen, note: 'AliExpress US delivery. Alibaba $1.80-$3.95 MOQ 1-2. CJ unread: human verification.', source: 'https://www.aliexpress.us/w/wholesale-folding-walking-cane.html', usShipping: true},
    looksWorth: {...seen, note: 'Finished cane. Flag: big-box.', source: 'https://www.amazon.com/dp/B0BG8DPFN1'},
    audienceRoom: {...seen, source: 'research/x.md', mainAudience: 'Seniors', audiences: [{who: 'The 45-65 not a cane person yet', problem: 'Skips walks', why: 'Nobody speaks to them'}, {who: 'Adult child', problem: 'Parent refuses', why: 'Titles skip the gift-giver'}, {who: 'Traveller', problem: 'Flare-up day', why: 'Sold as hospital gear'}]},
    bigIssue: {...seen, source: 'research/x.md', issues: ['low-energy'], ladder: {functional: 'Steadier steps', emotional: 'Confidence', life: 'Keeps walking'}},
    metaGap: {...seen, source: 'https://www.amazon.com/s?k=folding+walking+cane', gap: 'Sellers say "for Seniors". Ignored: the person who is not old. Opening: a cane you chose.'},
    sourceMatch: pending, contribution: pending, productWorks: pending, noBrand: pending,
  }},
});
const L102 = () => { const c = L100(); c.id = 'L102'; c.references = ['resources/research-previews/2026-10-02-numbers-first/trends-acupressure-mat.jpg']; c.screen.checks.provenDemand = {...pending, note: 'Numbers in the card file.', observedAt: '2026-10-02', country: 'US', evidenceType: 'observed'}; c.screen.checks.dropshippable = pending; c.screen.checks.metaGap = pending; return c; };

test('compactNumber: Amazon-style figures', () => {
  assert.equal(compactNumber(7000), '7K'); assert.equal(compactNumber(10000), '10K'); assert.equal(compactNumber(12500), '12.5K');
  assert.equal(compactNumber(1200000), '1.2M'); assert.equal(compactNumber(950), '950'); assert.equal(compactNumber(1234), '1,234');
});

test('L100: big figures with source, date, link, and the price read from the note', () => {
  const f = demandFigures(cardStats(L100()));
  assert.equal(f.lead.big, '7K+'); assert.equal(f.lead.label, 'bought in past month'); assert.equal(f.lead.source, 'Amazon');
  assert.equal(f.lead.url, 'https://www.amazon.com/dp/B0BG8DPFN1'); assert.equal(f.lead.observedAt, '2026-10-02');
  assert.equal(f.others[0].big, '12,908'); assert.equal(f.others[0].label, 'reviews');
  assert.deepEqual(f.price, {value: 29.99, text: '$29.99', fromNote: true});
  const saved = L100(); saved.screen.checks.provenDemand.demand[0].price = 34.5;
  assert.deepEqual(demandFigures(cardStats(saved)).price, {value: 34.5, text: '$34.50', fromNote: false});
});

test('trend: the Trends curve is drawn, stable worked out, the screenshot found by name or trendShot', () => {
  const card = L100(), p = statsPanel(card);
  assert.equal(p.direction.direction, 'stable'); assert.equal(p.series.metric, 'google-trends'); assert.equal(p.series.points.length, 5);
  assert.equal(p.trendShot, 'resources/research-previews/2026-10-02-numbers-first/trends-walking-cane.jpg');
  card.screen.checks.provenDemand.trendShot = 'resources/research-previews/x/curve.png';
  assert.equal(trendShot(card), 'resources/research-previews/x/curve.png');
  // Two Amazon dates and no curve: the dated points are drawn.
  const two = {demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/X', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 600, url: 'https://www.amazon.com/dp/X', observedAt: '2026-09-15'}]};
  assert.deepEqual(trendSeries(two), {metric: 'amazon-bought', points: [{date: '2026-08-15', value: 400}, {date: '2026-09-15', value: 600}]});
});

test('sparkPoints: evenly timed, highest value at the top, stays inside the box', () => {
  const pts = sparkPoints([{date: '2026-01-01', value: 0}, {date: '2026-07-01', value: 100}, {date: '2026-12-31', value: 50}], 200, 48, 6);
  assert.equal(pts[0].x, 6); assert.equal(pts[2].x, 194); assert.equal(pts[1].y, 6); assert.equal(pts[0].y, 42);
  assert.ok(pts.every(p => p.x >= 6 && p.x <= 194 && p.y >= 6 && p.y <= 42));
  assert.deepEqual(sparkPoints([]), []);
});

test('dropshippable: supplier links, flags from the saved note, money line only from saved numbers', () => {
  const d = dropshipView(L100());
  assert.deepEqual(d.suppliers.map(s => s.name), ['AliExpress']);
  assert.ok(d.flags.includes('CJ not checked yet (human verification)')); assert.ok(d.flags.includes('MOQ 1-2'));
  assert.equal(d.margin, null, 'no cost is invented');
  const priced = L100(); Object.assign(priced.screen.checks.dropshippable, {landedCost: 9.5, sellPrice: 39, flags: ['Foam bulk may raise shipping'], suppliers: ['https://www.alibaba.com/product-detail/x.html']});
  const p = dropshipView(priced);
  assert.deepEqual(p.margin, {value: 29.5, percent: 76}); assert.equal(p.money.landed, '$9.50'); assert.equal(p.money.sell, '$39');
  assert.deepEqual(p.suppliers.map(s => s.name), ['AliExpress', 'Alibaba']); assert.equal(p.flags[0], 'Foam bulk may raise shipping');
  const noShip = L100(); delete noShip.screen.checks.dropshippable.usShipping;
  assert.ok(dropshipView(noShip).flags.includes('US shipping not confirmed'));
});

test('gate checklist F1-F6: L100 all green; L102 says exactly what is missing', () => {
  assert.deepEqual(Object.values(GATE_NUMBERS), ['F1', 'F2', 'F3', 'F4', 'F5', 'F6']);
  assert.ok(gateList(L100()).every(g => g.state === 'pass'));
  const gates = gateList(L102());
  assert.deepEqual(gates.map(g => g.state), ['open', 'open', 'pass', 'pass', 'pass', 'open']);
  assert.match(gates[0].line, /^Missing: a demand number with its link and date.*a second dated point or the Google Trends curve; a source link\.$/);
  assert.match(gates[1].line, /supplier listing link on CJ, Alibaba or AliExpress/);
  assert.match(gates[5].line, /link to the competitors checked; the gap/);
});

test('F1 messages: one point only, falling, a link on the wrong site', () => {
  const one = {...seen, source: 'https://www.amazon.com/s?k=x', demand: [{metric: 'amazon-bought', value: 2000, url: 'https://www.amazon.com/dp/X', observedAt: '2026-10-02'}]};
  assert.match(gateMissing('provenDemand', one), /a second dated point or the Google Trends curve \(only one point so far\)/);
  const falling = {...one, trend: [{date: '2025-10-01', value: 80}, {date: '2026-09-01', value: 40}]};
  assert.match(gateMissing('provenDemand', falling), /^Demand is falling \(-50% from 2025-10-01 to 2026-09-01\)\.$/);
  assert.match(gateMissing('dropshippable', {...seen, source: 'https://www.temu.com/x'}), /^The link is on temu\.com, not CJ, Alibaba or AliExpress\.$/);
  assert.match(gateMissing('provenDemand', {...pending, status: 'failed', note: 'Falling on every source.'}), /^Failed: Falling on every source\.$/);
});

test('Save is closed with a plain reason until F1 passes; the summary is null without numbers', () => {
  assert.equal(saveBlockReason(L100()), '');
  assert.match(saveBlockReason(L102()), /^Save opens when F1 Statistics passes\. Missing: a demand number/);
  assert.deepEqual(statsSummary(L100()), {top: '7K+ bought/mo', source: 'Amazon', direction: 'stable', word: 'Stable', passed: true});
  assert.equal(statsSummary(L102()), null);
});

test('server: a new Save needs F1 passed (STATS_MISSING); Pass and Reject always work; earlier Saves stay', () => {
  const batch = {...emptyResearch(), candidates: [L102(), L100()]};
  const save = c => ({...c, screen: {...c.screen, ownerDecision: 'saved', ownerReason: 'Looks good'}});
  assert.throws(() => updateResearch(batch, {revision: 0, candidate: save(L102())}), err => err.code === 'STATS_MISSING' && /Save opens when F1 Statistics passes/.test(err.message));
  for (const decision of ['passed', 'rejected']) assert.equal(updateResearch(batch, {revision: 0, candidate: {...L102(), screen: {...L102().screen, ownerDecision: decision, ownerReason: 'Not now'}}}).candidates[0].screen.ownerDecision, decision);
  const saved = updateResearch(batch, {revision: 0, candidate: save(L100())});
  assert.equal(saved.candidates[1].screen.ownerDecision, 'saved');
  // A card saved before the rule keeps its Save when agents add evidence.
  const old = {...emptyResearch(), candidates: [save(L102())]};
  const edited = save(L102()); edited.screen.checks.looksWorth = {...edited.screen.checks.looksWorth, note: 'Second look.'};
  assert.equal(updateResearch(old, {revision: 0, candidate: edited}).candidates[0].screen.ownerDecision, 'saved');
});

test('server: the optional panel fields are checked (trendShot path, price, suppliers, money, flags)', () => {
  const batch = {...emptyResearch(), candidates: [L100()]};
  const withField = (check, extra) => { const c = L100(); Object.assign(c.screen.checks[check], extra); return c; };
  assert.ok(updateResearch(batch, {revision: 0, candidate: withField('provenDemand', {trendShot: 'resources/research-previews/x/trends.jpg'})}));
  assert.throws(() => updateResearch(batch, {revision: 0, candidate: withField('provenDemand', {trendShot: 'https://example.com/a.jpg'})}), /trendShot is the saved screenshot/);
  assert.ok(updateResearch(batch, {revision: 0, candidate: withField('dropshippable', {landedCost: 9.5, sellPrice: 39, flags: ['MOQ 20'], suppliers: ['https://www.alibaba.com/x']})}));
  assert.throws(() => updateResearch(batch, {revision: 0, candidate: withField('dropshippable', {landedCost: 'cheap'})}), /landedCost is a number/);
  assert.throws(() => updateResearch(batch, {revision: 0, candidate: withField('dropshippable', {suppliers: ['not a link']})}), /each supplier is a link/);
  const priced = L100(); priced.screen.checks.provenDemand.demand[0].price = 'about 30';
  assert.throws(() => updateResearch(batch, {revision: 0, candidate: priced}), /price is a number/);
  assert.ok(SCREEN_CHECKS.includes('provenDemand'));
});
