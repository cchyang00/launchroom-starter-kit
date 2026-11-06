import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from './store.mjs';
import {splitCurationBatches} from '../src/curationView.mjs';

test('the newest dated research batch becomes current when another pilot is added', () => {
  const batches=[
    {path:'research/2026-09-26-kalodata/BATCH.md'},
    {path:'research/2026-09-27-second-pass/BATCH.md'},
    {path:'research/2026-09-17-curation-live/BATCH.md'}
  ];
  const {current,earlier}=splitCurationBatches(batches);
  assert.deepEqual(current.map(batch=>batch.path),['research/2026-09-27-second-pass/BATCH.md']);
  assert.deepEqual(earlier.map(batch=>batch.path),[batches[0].path,batches[2].path]);
});

test('visual curation reads real card files without turning agent dispositions into owner choices', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-curation-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (relative, content) => { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
  await write('research/CURATION-QUEUE.md', '| Batch / canonical visual cards | Country |\n| --- | --- |\n| [Current batch](2026-09-26-kalodata/BATCH.md) | US |\n');
  await write('research/2026-09-26-kalodata/BATCH.md', '### L039 — distinctive lamp — CURATED / PARK\n\n![Actual lamp](../../resources/research-previews/lamp.jpg)\n\n[Pipiads link](https://pipiads.com/example)\n');
  await write('research/2026-09-26-kalodata/L039.md', '# L039 — distinctive lamp\n\n**CURATED — UNVERIFIED · PARK · owner unreviewed**\n\nThe detail record keeps the source decision.\n');
  await write('research/2026-09-26-kalodata/L040.md', '# L040 — maker kit\n\n**CURATED — UNVERIFIED · owner unreviewed**\n\n![Actual kit](../../resources/research-previews/kit.jpg)\n\n[Listing](https://example.com/kit)\n');
  await write('resources/research-previews/lamp.jpg', 'fixture image');
  await write('resources/research-previews/kit.jpg', 'fixture image');
  const result = await createStore({ workspaceRoot: root }).getCuration();
  assert.equal(result.totalCards, 2);
  assert.equal(result.batches[0].cards[0].id, 'L040');
  const lamp = result.batches[0].cards[1];
  assert.equal(lamp.sourcePath, 'research/2026-09-26-kalodata/L039.md');
  assert.equal(lamp.imagePath, 'resources/research-previews/lamp.jpg');
  assert.equal(lamp.disposition, 'PARK');
  assert.equal(lamp.ownerDecision, 'unreviewed');
});

test('an access-only current batch stays visible without inventing a product card', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-curation-access-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'research', '2026-09-26-kalodata');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(root, 'research', 'CURATION-QUEUE.md'), '| Batch / canonical visual cards | Country |\n| --- | --- |\n| [Current Kalodata batch](2026-09-26-kalodata/BATCH.md) | unknown |\n');
  await fs.writeFile(path.join(folder, 'BATCH.md'), '# Access preflight\n\n**Status:** Awaiting authenticated data.\n\n**Access:** Session expired at sign-in.\n\n**Viewing coverage:** 0 product images; no search run.\n');
  const result = await createStore({ workspaceRoot: root }).getCuration();
  assert.equal(result.totalCards, 0);
  assert.equal(result.batches.length, 1);
  assert.equal(result.batches[0].status, 'Awaiting authenticated data.');
  assert.equal(result.batches[0].access, 'Session expired at sign-in.');
  assert.equal(result.batches[0].viewingCoverage, '0 product images; no search run.');
  assert.deepEqual(result.batches[0].cards, []);
});
