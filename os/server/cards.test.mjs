// The card screens' numbers (owner, Nov 4: "cards instead of text"): Home and Improve add
// up the same saved Meta records, and each step tile shows the products really at that step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCampaignMetrics, firstImageAd, portfolioTotals, cpaGauge } from '../src/campaignView.mjs';
import { stationItems, displayStations, DISPLAY_LINE } from '../src/displayLine.mjs';

const campaign = (spend, revenue, purchases, breakEvenCpa, ads = []) => ({ breakEvenCpa, ads, summaryToday: { spend, revenue, purchases, clicks: 50, impressions: 1000 } });

test('a campaign works out its return and whether its cost per sale beats break-even', () => {
  const good = computeCampaignMetrics(campaign(91.78, 248.9, 5, 26.83));
  assert.equal(Number(good.roas.toFixed(2)), 2.71);
  assert.equal(Number(good.cpa.toFixed(2)), 18.36);
  assert.equal(good.isProfitable, true);
  const bad = computeCampaignMetrics(campaign(50, 59.98, 1, 36.63));
  assert.equal(bad.cpa, 50);
  assert.equal(bad.isProfitable, false);
});

test('the cost gauge fills toward break-even and stops at the end', () => {
  assert.equal(cpaGauge({ cpa: 18.36, breakEvenCpa: 26.83 }), 68);
  assert.equal(cpaGauge({ cpa: 50, breakEvenCpa: 36.63 }), 100);
  assert.equal(cpaGauge({ cpa: 10, breakEvenCpa: 0 }), 0);
});

test('the money row adds every campaign up, and an empty list is all zeros', () => {
  const totals = portfolioTotals([campaign(91.78, 248.9, 5, 26.83), campaign(50, 59.98, 1, 36.63)]);
  assert.equal(Number(totals.spend.toFixed(2)), 141.78);
  assert.equal(Number(totals.revenue.toFixed(2)), 308.88);
  assert.equal(Number(totals.roas.toFixed(2)), 2.18);
  assert.equal(totals.purchases, 6);
  assert.equal(totals.ctr, 5);
  assert.equal(totals.profitable, 1);
  assert.deepEqual(portfolioTotals([]), { spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0, roas: 0, ctr: 0, profitable: 0 });
  assert.deepEqual(portfolioTotals(undefined), portfolioTotals([]));
});

test('a campaign is pictured by a static ad that is running, else any static ad, never a video', () => {
  const video = { format: 'video', status: 'ACTIVE', mediaPath: 'v.mp4' };
  const paused = { format: 'static', status: 'PAUSED', mediaPath: 'paused.jpg' };
  const running = { format: 'static', status: 'ACTIVE', mediaPath: 'running.jpg' };
  assert.equal(firstImageAd({ ads: [video, paused, running] }), 'running.jpg');
  assert.equal(firstImageAd({ ads: [video, paused] }), 'paused.jpg');
  assert.equal(firstImageAd({ ads: [video] }), '');
  assert.equal(firstImageAd(null), '');
});

test('each step tile lists the products at that step, the same as its count', () => {
  const item = (id, stepIndex, extra = {}) => ({ id, stepIndex, readyToBuild: false, ...extra });
  const checklists = { items: [{ id: 'a' }], products: { P002: { items: { a: { done: true } } } } };
  const pipeline = {
    counts: {}, ownerMoves: [],
    active: [item('L1', 0), item('L2', 1), item('L3', 2, { readyToBuild: true }), item('P001', 3, { productId: 'P001-x' }), item('P002', 5, { productId: 'P002-y' }), item('P003', 5, { productId: 'P003-z' })],
  };
  const ids = station => stationItems(pipeline, checklists, station).map(entry => entry.id);
  assert.deepEqual(ids('product'), ['L1']);
  assert.deepEqual(ids('verify'), ['L2']);
  assert.deepEqual(ids('winners'), ['L3']);
  assert.deepEqual(ids('creatives'), ['P001']);
  assert.deepEqual(ids('build'), []);
  // Launch splits by the saved checklist: incomplete waits at Checklist, complete moves to Launch.
  assert.deepEqual(ids('checklist'), ['P003']);
  assert.deepEqual(ids('launch'), ['P002']);
  assert.deepEqual(ids('nope'), []);
  assert.equal(displayStations(pipeline, checklists).length, DISPLAY_LINE.length);
  assert.deepEqual(stationItems(null, checklists, 'product'), []);
});

test('picking a day shows that day; an unknown day falls back to all days', () => {
  const record = {breakEvenCpa: 30, summaryLifetime: {spend: 225.4, purchases: 5, revenue: 248.9}, dailyBreakdown: [
    {date: '2026-11-03', label: 'Day 1', spend: 131.68, purchases: 5, revenue: 248.9},
    {date: '2026-11-04', label: 'Day 2', spend: 93.72, purchases: 0, revenue: 0},
  ]};
  assert.equal(computeCampaignMetrics(record).spend, 225.4);
  assert.equal(computeCampaignMetrics(record, '2026-11-04').spend, 93.72);
  assert.equal(computeCampaignMetrics(record, '2026-11-04').purchases, 0);
  assert.equal(computeCampaignMetrics(record, '2026-12-25').spend, 225.4);
});
