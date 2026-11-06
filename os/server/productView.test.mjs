// One product's page: the figures it shows, its six steps and the warning when saved
// evidence looks copied from another product.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cardName, displaySteps, evidenceFlags, evidenceIndex, idList, markupOf, ruleName, rulesScore, trendInDoubt, viralCounts} from '../src/productView.mjs';

const series = values => ({metric: 'google-trends', points: values.map((value, i) => ({date: `2026-10-0${i + 1}`, value}))});
const product = (id, extra = {}) => ({id, leadId: id, validation: {series: series([24, 45, 68, 89, 100]), changePercent: 317, direction: 'rising', kalodata: {}, meta: {}, ...extra}});

test('card names lose their trailing note, and a name that is all note stays', () => {
  assert.equal(cardName("2-Pack Solar Lights ('NEED LIGHT' Kit)"), '2-Pack Solar Lights');
  assert.equal(cardName('Heated Wrap (with (nested) note)'), 'Heated Wrap');
  assert.equal(cardName('Plain name'), 'Plain name');
});

test('markup comes from the saved landed cost and margin, and is absent without them', () => {
  assert.equal(Number(markupOf({money: {landed: '$15.80'}, margin: {value: 44.19}}).toFixed(2)), 3.8);
  assert.equal(markupOf({money: {landed: ''}, margin: {value: 10}}), null);
  assert.equal(markupOf({money: {landed: '$10'}}), null);
  assert.equal(markupOf(null), null);
});

test('hard rules read plainly and only "good" counts as clear', () => {
  assert.equal(ruleName({id: 'wave', label: '3. Kalodata Wave Age'}), 'Wave age');
  assert.equal(ruleName({id: 'new', label: '6. Something New'}), 'Something New');
  assert.deepEqual(rulesScore([{state: 'good'}, {state: 'ok'}, {state: 'bad'}, {state: 'good'}]), {good: 2, total: 4});
  assert.deepEqual(rulesScore(undefined), {good: 0, total: 0});
});

test('viral counts read the saved wave line, and say how many videos were really saved', () => {
  const kalo = {waveLabel: '🚀 56 US Viral Videos · 43 Creators · ~3 US Meta Ads', rawVideos: [{handle: '@a'}, {handle: '@b'}, {handle: '@a'}]};
  assert.deepEqual(viralCounts(kalo), {videos: 56, creators: 43, saved: 3, savedCreators: 2});
  // No wave line: only what was saved counts, never a guess.
  assert.deepEqual(viralCounts({rawVideos: [{handle: '@a'}]}), {videos: 1, creators: 1, saved: 1, savedCreators: 1});
  assert.deepEqual(viralCounts({waveLabel: 'Evergreen High-Volume', rawVideos: [], creators: 14}), {videos: 0, creators: 14, saved: 0, savedCreators: 0});
  assert.deepEqual(viralCounts(undefined), {videos: 0, creators: 0, saved: 0, savedCreators: 0});
});

const line = states => Object.entries(states).map(([id, state]) => ({id, state, done: 0, total: 0}));

test('seven steps: the seven saved ones group, Winners holds verified ready-to-choose products, and Launch splits by the Launch Checklist', () => {
  const states = item => displaySteps(item, {items: [{id: 'a'}], products: {P001: {items: {a: {done: true}}}}}).map(step => step.state);
  assert.deepEqual(states({id: 'L1', line: line({product: 'current', buyers: 'todo', prove: 'todo', create: 'todo', build: 'todo', launch: 'todo', learn: 'todo'})}), ['current', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
  // Verify holds Buyers and Prove it; it is done only when both are.
  assert.deepEqual(states({id: 'L2', line: line({product: 'done', buyers: 'done', prove: 'current', create: 'todo', build: 'todo', launch: 'todo', learn: 'todo'})}), ['done', 'current', 'todo', 'todo', 'todo', 'todo', 'todo']);
  // Passed Verify: sits at Winners (waiting to be chosen to build).
  assert.deepEqual(states({id: 'L3', line: line({product: 'done', buyers: 'done', prove: 'done', create: 'waiting', build: 'todo', launch: 'todo', learn: 'todo'})}), ['done', 'done', 'waiting', 'todo', 'todo', 'todo', 'todo']);
  // At Launch before checklist is complete it sits at Checklist; complete, it moves to Launch.
  assert.deepEqual(states({id: 'P002', productId: 'P002-x', line: line({product: 'done', buyers: 'done', prove: 'done', create: 'done', build: 'done', launch: 'current', learn: 'todo'})}), ['done', 'done', 'done', 'done', 'done', 'current', 'todo']);
  assert.deepEqual(states({id: 'P001', productId: 'P001-x', line: line({product: 'done', buyers: 'done', prove: 'done', create: 'done', build: 'done', launch: 'current', learn: 'todo'})}), ['done', 'done', 'done', 'done', 'done', 'done', 'current']);
  assert.deepEqual(states({id: 'L4', line: line({product: 'done', buyers: 'stopped', prove: 'todo', create: 'todo', build: 'todo', launch: 'todo', learn: 'todo'})}), ['done', 'stopped', 'todo', 'todo', 'todo', 'todo', 'todo']);
  assert.equal(displaySteps(null, null).length, 7);
});

test('evidence shared by different products is flagged, and unique evidence is not', () => {
  const shared = 'https://www.kalodata.com/product/detail?id=1';
  const items = [
    product('L1', {kalodata: {kalodataUrl: shared, tiktokUrl: 'https://tiktok.com/a'}, meta: {url: 'https://www.facebook.com/ads/library/?q=8%20zone%20heated%20vest'}}),
    product('L2', {kalodata: {kalodataUrl: shared, tiktokUrl: 'https://tiktok.com/a'}, meta: {url: 'https://www.facebook.com/ads/library/?q=8%20zone%20heated%20vest'}}),
    product('L3', {series: series([18, 36, 64, 89, 100]), changePercent: 456, kalodata: {kalodataUrl: 'https://www.kalodata.com/product/detail?id=3', tiktokUrl: 'https://tiktok.com/c'}, meta: {url: 'https://www.facebook.com/ads/library/?q=water'}}),
    {id: 'L4', validation: null},
  ];
  const index = evidenceIndex(items);
  assert.deepEqual(index.get('L1'), {curve: ['L2'], kalodata: ['L2'], tiktok: ['L2'], meta: ['L2']});
  assert.equal(index.has('L3'), false);
  assert.equal(index.has('L4'), false);
  assert.equal(evidenceIndex(items), index, 'worked out once per list');
  assert.equal(trendInDoubt(items[0], items), true);
  assert.equal(trendInDoubt(items[2], items), false);
  assert.equal(trendInDoubt(items[0], undefined), false);

  const flags = evidenceFlags(items[0], items, null);
  assert.deepEqual(flags.map(flag => flag.id), ['curve', 'kalodata', 'tiktok', 'meta']);
  assert.match(flags[0].text, /identical on L2/);
  assert.match(flags[0].text, /\+317%/);
  assert.match(flags[3].text, /searches "8 zone heated vest"/);
  assert.deepEqual(evidenceFlags(items[2], items, null), []);
});

test('a curve needs three points to count as copied: two short lines can match by chance', () => {
  const short = {metric: 'google-trends', points: [{date: '2026-10-01', value: 1}, {date: '2026-10-02', value: 2}]};
  const items = [product('L1', {series: short}), product('L2', {series: short})];
  assert.equal(trendInDoubt(items[0], items), false);
});

test('a buyers write-up saved under another card is flagged; its own is not', () => {
  const items = [product('L379')];
  const elsewhere = {screen: {checks: {buyers: {source: 'research/x/buyers/L313.md'}}}};
  const own = {screen: {checks: {buyers: {source: 'research/x/buyers/L379.md'}}}};
  assert.match(evidenceFlags(items[0], items, elsewhere)[0].text, /saved under L313/);
  assert.deepEqual(evidenceFlags(items[0], items, own), []);
});

test('long id lists say how many more', () => {
  assert.equal(idList(['L1', 'L2']), 'L1, L2');
  assert.equal(idList(['L1', 'L2', 'L3', 'L4', 'L5']), 'L1, L2, L3 and 2 more');
});
