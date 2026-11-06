import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { DISPLAY_LINE, PIPELINE_STEP_SKILLS, displayStations, displayIdOfStep, checklistScore, shortProductId } from '../src/displayLine.mjs';
import { createLaunchChecklists, LAUNCH_CHECKLIST } from './launchChecklist.mjs';

const item = (id, stepIndex, extra = {}) => ({ id, stepIndex, readyToBuild: false, ...extra });
const pipeline = {
  counts: { product: 3, buyers: 1, prove: 2, create: 1, build: 0, launch: 2, learn: 1, ready: 1 },
  ownerMoves: [{ kind: 'eye-test', step: 0, count: 3 }],
  active: [item('L1', 0), item('L2', 0), item('L3', 0), item('L4', 1), item('L5', 2), item('L6', 2), item('P001', 3), item('P002', 5, { productId: 'P002-solar' }), item('P003', 5), item('P004', 6)],
};

test('the owner sees seven pipeline steps in order: Product, Verify, Winners, Store, Creatives, Checklist, Launch', () => {
  assert.deepEqual(DISPLAY_LINE.map(s => s.short), ['Product', 'Verify', 'Winners', 'Store', 'Creatives', 'Checklist', 'Launch']);
  assert.deepEqual(['product', 'buyers', 'prove', 'create', 'build', 'launch', 'learn'].map(displayIdOfStep), ['product', 'verify', 'verify', 'creatives', 'build', 'checklist', 'launch']);
  assert.equal(shortProductId('P007-2-pack-split'), 'P007');
  for (const stepId of ['product', 'verify', 'winners', 'build', 'creatives', 'checklist', 'launch', 'manage']) {
    assert.ok(PIPELINE_STEP_SKILLS[stepId]?.skills?.length > 0, `expected enforced skills for ${stepId}`);
    assert.ok(PIPELINE_STEP_SKILLS[stepId]?.agents?.length > 0, `expected enforced subagents for ${stepId}`);
  }
});

test('stations group the saved steps; verified winners sit at Winners and a product moves from Checklist to Launch only when all checks are ticked', () => {
  const none = { items: LAUNCH_CHECKLIST, products: {} };
  const by = list => Object.fromEntries(displayStations(pipeline, list).map(s => [s.id, s]));
  let s = by(none);
  assert.deepEqual([s.product.count, s.verify.count, s.winners.ready, s.product.ready, s.build.count, s.creatives.count, s.checklist.count, s.launch.count], [3, 3, 1, 0, 0, 1, 2, 1]);
  assert.equal(s.product.owner, true, 'the eye test waits on the owner');
  assert.equal(s.winners.target, 'winners');
  assert.equal(s.build.target, 'build');
  assert.equal(s.creatives.target, 'create');
  const partial = Object.fromEntries(LAUNCH_CHECKLIST.slice(0, LAUNCH_CHECKLIST.length - 1).map(i => [i.id, { done: true }]));
  s = by({ items: LAUNCH_CHECKLIST, products: { P002: { items: partial } } });
  assert.deepEqual([s.checklist.count, s.launch.count], [2, 1], 'incomplete checklist stays at Checklist');
  const all = Object.fromEntries(LAUNCH_CHECKLIST.map(i => [i.id, { done: true }]));
  s = by({ items: LAUNCH_CHECKLIST, products: { P002: { items: all } } });
  assert.deepEqual([s.checklist.count, s.launch.count, s.launch.owner], [1, 2, true]);
  assert.deepEqual(checklistScore({ items: LAUNCH_CHECKLIST, products: { P002: { items: all } } }, 'P002-solar').complete, true);
});

test('the checklist saves ticks; agents need evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lr-checklist-'));
  const lists = createLaunchChecklists({ root });
  assert.equal((await lists.view()).items.length, 7);
  let view = await lists.save({ productId: 'P007', itemId: 'phone', done: true });
  assert.equal(checklistScore(view, 'P007').done, 1);
  await assert.rejects(lists.save({ productId: 'P007', itemId: 'cart', done: true }, { agent: true }), { code: 'EVIDENCE_REQUIRED' });
  view = await lists.save({ productId: 'P007', itemId: 'cart', done: true, note: 'Tested on 375px, video in products/P007/qa/' }, { agent: true });
  assert.equal(view.products.P007.items.cart.by, 'agent');
  await assert.rejects(lists.save({ productId: 'nope', itemId: 'phone', done: true }));
  await assert.rejects(lists.save({ productId: 'P007', itemId: 'made-up', done: true }));
  view = await lists.save({ productId: 'P007', packet: 'split-solar-blackout-kit.json' });
  assert.equal(view.products.P007.packet, 'split-solar-blackout-kit.json');
  await fs.rm(root, { recursive: true, force: true });
});
