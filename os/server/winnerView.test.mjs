import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNumbers, describeLink, offTopicSearch, sellingPacks, winnerLinks, winnerProof} from '../src/winnerView.mjs';
import {VERIFY_CHECKS} from '../src/productGates.mjs';

// Nov 5: Winners shows every link a product was checked with, and says plainly what each one is.
const card = {
  id: 'L379',
  name: '4-Blade Folding LED Telescopic Tripod Solar Camping Lantern',
  references: [
    'research/round/L379.md',
    'research/round/buyers/L379.md',
    'resources/tiktok-saves/clip.mp4',
    'resources/research-previews/L379-1.jpg',
    'https://www.tiktok.com/@maker/video/123',
    'https://www.alibaba.com/trade/search?SearchText=8-Zone%20Carbon-Fiber%20USB%20Heated',
    'https://www.alibaba.com/trade/search?SearchText=Folding%20Telescopic%20Lantern',
    'https://www.amazon.com/s?k=Telescopic%20Lantern',
    'https://www.amazon.com/dp/B000TEST',
    'https://www.kalodata.com/product/detail?id=1',
    'https://trends.google.com/trends/explore?q=camping%20lantern',
  ],
  screen: {checks: {
    provenDemand: {status: 'supported', source: 'https://www.tiktok.com/@maker/video/123', demand: [{url: 'https://www.kalodata.com/product/detail?id=1'}]},
    buyers: {status: 'supported', source: 'research/round/buyers/L379.md', quotes: 16, avatars: [{who: 'A', trigger: 'x'}, {who: 'B', trigger: 'y'}, {who: 'C', trigger: 'z'}], angleGap: 'Nobody says this'},
  }},
  gates: {competition: {status: 'supported', source: 'https://www.facebook.com/ads/library/?q=telescopic%20camping%20lantern'}},
};
const validation = {
  changePercent: 317, from: '2026-10-06', to: '2026-11-03',
  kalodata: {price: '$39.99', waveLabel: '56 US Viral Videos · 43 Creators', rawVideos: [{handle: '@maker', url: 'https://www.tiktok.com/@maker/video/123', gmv30d: 152000}]},
  meta: {advertisers: 1, liveAds: 3, broadAds: 38, query: 'telescopic camping lantern', url: 'https://www.facebook.com/ads/library/?q=8%20zone%20heated%20vest', competitors: []},
  money: {landed: '$15.80', sell: '$59.99', margin: '$44.19'},
  margin: {value: 44.19, percent: 74},
  tiers: [{qty: 1, baseProfit: 42.15, beCpa: 49.91, targetCpa: 40.16}, {qty: 2, baseProfit: 71.92}, {qty: 3, baseProfit: 101.69}],
};

test('a link says what it is, from its address alone', () => {
  assert.deepEqual(describeLink('https://www.tiktok.com/@maker/video/1'), {group: 'videos', label: '@maker', kind: 'exact', term: ''});
  assert.equal(describeLink('https://www.amazon.com/dp/B0').label, 'Amazon listing');
  assert.deepEqual(describeLink('https://www.amazon.com/s?k=lamp'), {group: 'listings', label: 'Amazon search', kind: 'search', term: 'lamp'});
  assert.equal(describeLink('https://www.alibaba.com/product-detail/x_1.html').label, 'Alibaba listing');
  assert.equal(describeLink('https://www.aliexpress.com/item/1.html').group, 'sourcing');
  assert.equal(describeLink('https://detail.1688.com/offer/1.html').label, '1688 listing');
  assert.equal(describeLink('https://www.kalodata.com/product/detail?id=1').label, 'Kalodata product');
  assert.equal(describeLink('https://www.kalodata.com/product?keyword=lamp').kind, 'search');
  assert.equal(describeLink('https://www.facebook.com/ads/library/?q=lamp').group, 'meta');
  assert.equal(describeLink('https://trends.google.com/trends/explore?q=lamp').group, 'trends');
  assert.equal(describeLink('research/round/L1.md').group, 'files');
  assert.equal(describeLink('resources/clip.mp4'), null, 'saved media stays in the player');
  assert.equal(describeLink('https://example.com/a').group, 'other');
});

test('a search for some other product is marked, and words any gadget has do not count as a match', () => {
  const about = 'Folding LED Telescopic Tripod Solar & USB-C Rechargeable Lantern';
  assert.equal(offTopicSearch('8-Zone Carbon-Fiber USB Heated', about), true);
  assert.equal(offTopicSearch('8 zone heated vest', about), true);
  assert.equal(offTopicSearch('telescopic lantern', about), false);
  assert.equal(offTopicSearch('solar lanterns', about), false, 'a plural still matches');
  assert.equal(offTopicSearch('', about), false, 'no search words, nothing to say');
});

test('every saved link shows once, in its group, with real listings first and the marked ones last', () => {
  const groups = winnerLinks(card, validation, {trendUrl: '', gapUrl: '', dropship: {suppliers: []}});
  const group = id => groups.find(entry => entry.id === id);
  assert.deepEqual(group('videos').links.map(link => link.label), ['@maker']);
  assert.equal(group('videos').links[0].note, '$152K in 30 days');
  assert.deepEqual(group('listings').links.map(link => link.label), ['Amazon listing', 'Amazon search']);
  assert.deepEqual(group('sourcing').links.map(link => [link.term, link.offTopic]), [['Folding Telescopic Lantern', false], ['8-Zone Carbon-Fiber USB Heated', true]]);
  assert.equal(group('meta').links.find(link => link.term === '8 zone heated vest').offTopic, true);
  assert.equal(group('meta').links.find(link => link.term === 'telescopic camping lantern').offTopic, false);
  assert.deepEqual(group('files').links.map(link => link.label), ['Product file, L379', 'Buyers file, L379']);
  const copied = winnerLinks({id: 'L379', references: ['research/round/buyers/L313.md', 'research/round/L379.md']}, null, null).find(entry => entry.id === 'files').links;
  assert.deepEqual(copied.map(link => [link.label, link.offTopic]), [['Product file, L379', false], ['Buyers file, L313', true]], 'a file saved under another card is marked and listed last');
  const urls = groups.flatMap(entry => entry.links.map(link => link.url));
  assert.equal(new Set(urls).size, urls.length);
  assert.deepEqual(winnerLinks(null, null, null), []);
});

test('the proof is the seven agreed checks, each with its one number, and it never invents one', () => {
  const proof = winnerProof(card, validation, {});
  assert.deepEqual(proof.map(check => check.id), VERIFY_CHECKS.map(check => check.id));
  const fact = id => proof.find(check => check.id === id).fact;
  assert.equal(fact('uptrend').big, '+317%');
  assert.equal(fact('viral').big, '56 videos');
  assert.equal(fact('factory').big, '$15.80');
  assert.equal(fact('profit').big, '$42');
  assert.match(fact('profit').small, /\$72 on 2/);
  assert.equal(fact('buyers').big, '16 quotes');
  assert.equal(fact('meta').big, '3 ads');
  assert.ok(proof.find(check => check.id === 'buyers').links.every(link => /buyers/.test(link.url)), 'the buyers card opens the buyers file, not the product file');
  for (const check of winnerProof({name: 'Empty'}, null, null)) {
    assert.equal(check.state, 'open');
    assert.equal(check.fact.big, '', check.id);
  }
});

test('we only sell a 1-pack and a 2-pack, and a build starts from the saved 1-pack numbers', () => {
  assert.deepEqual(sellingPacks(validation.tiers).map(tier => tier.qty), [1, 2]);
  assert.deepEqual(sellingPacks(undefined), []);
  assert.deepEqual(buildNumbers(validation), {breakEvenCpa: 49.91, targetCpa: 40.16});
  assert.deepEqual(buildNumbers({margin: {value: 20}}), {breakEvenCpa: 20, targetCpa: 0});
  assert.deepEqual(buildNumbers(null), {breakEvenCpa: 0, targetCpa: 0});
});
