import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HUB_DOORS, KEYWORD_BIBLE_PATH, adLayouts, diagramFiles, entryDay, fileTitle, isGemini, isResearch, parseBibleMap, researchShelf, studiedAds} from '../src/hubDoors.mjs';
import {TOPIC_LABELS} from '../src/libraryModel.mjs';

// Nov 5: the Hubs are one library for the owner and the agents. The doors point at real files.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('every door has a unique id, a real Library shelf and files that exist', async () => {
  assert.equal(new Set(HUB_DOORS.map(door => door.id)).size, HUB_DOORS.length);
  for (const door of HUB_DOORS) {
    assert.ok(door.title && door.line && door.go, door.id);
    if (door.topic) assert.ok(TOPIC_LABELS[door.topic], `${door.id}: ${door.topic}`);
    for (const link of door.links) {
      assert.ok(link.label && (link.doc || link.go), `${door.id}: ${link.label}`);
      if (link.doc) await fs.access(path.join(root, link.doc));
    }
  }
});

test('no door starts work: a door only opens a page or a file', () => {
  const words = HUB_DOORS.flatMap(door => [door.title, door.line, ...door.links.map(link => link.label)]).join(' ');
  assert.doesNotMatch(words, /\b(run|launch|queue|send to|ask an? agent|start a job)\b/i);
});

test('the research shelf is research and Gemini reports, newest first, with search, topic and source filters', () => {
  const entries = [
    {id: 'K-1', title: 'A guide', kind: 'guide', topics: ['store'], updatedAt: '2026-11-05T00:00:00Z'},
    {id: 'K-2', title: 'Water demand', kind: 'research', topics: ['product-research'], learned: 'Shelves empty fast', learnedOn: '2026-10-01'},
    {id: 'K-3', title: 'Gemini Deep Research: blackout lights', kind: 'note', topics: ['product-research', 'copywriting'], updatedAt: '2026-11-04T00:00:00Z'},
    {id: 'K-4', title: 'Wanted', kind: 'research', status: 'to-learn', topics: ['store']},
    {id: 'K-5', title: 'From a report', kind: 'research', topics: ['store'], sources: ['resources/issues/x/gemini-report.md'], learnedOn: '2026-09-01'},
  ];
  assert.deepEqual(researchShelf(entries).map(entry => entry.id), ['K-3', 'K-2', 'K-5']);
  assert.deepEqual(researchShelf(entries, {topic: 'copywriting'}).map(entry => entry.id), ['K-3']);
  assert.deepEqual(researchShelf(entries, {gemini: true}).map(entry => entry.id), ['K-3', 'K-5']);
  assert.deepEqual(researchShelf(entries, {query: 'shelves'}).map(entry => entry.id), ['K-2']);
  assert.equal(isResearch(entries[3]), false, 'a reading-list item is not a saved report yet');
  assert.equal(isGemini(entries[1]), false);
  assert.equal(entryDay(entries[1]), '2026-10-01');
  assert.equal(entryDay({path: 'resources/issues/teachers/gemini-2026-10-03.md', learnedOn: '2026-11-05'}), '2026-10-03', 'a report filed later keeps its own day');
});

test('the real Keyword Bible reads as eight categories with winners, slop, hooks and keywords, and its hot keywords with sales', async () => {
  const {categories, hot} = parseBibleMap(await fs.readFile(path.join(root, KEYWORD_BIBLE_PATH), 'utf8'));
  assert.deepEqual(categories.map(row => row.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const row of categories) {
    assert.ok(row.name, row.number);
    assert.ok(row.winners.length >= 2 && row.slop.length >= 2, row.name);
    assert.ok(row.hook.length > 10, row.name);
    assert.ok(row.keywords.length >= 20, row.name);
    assert.ok(row.winners.every(item => !/[`(]/.test(item)), 'a winner reads short, without its bracketed detail');
  }
  assert.ok(hot.length >= 10);
  assert.ok(hot.every((row, index) => row.revenue > 0 && row.keyword && (!index || hot[index - 1].revenue >= row.revenue)));
  assert.equal(hot[0].keyword, 'infrared knee massager');
  assert.equal(hot[0].revenue, 528833);
  assert.equal(hot.find(row => row.keyword === 'graphene heating pad').days, 7);
});

test('parseBibleMap leaves out what a file does not say', () => {
  assert.deepEqual(parseBibleMap(''), {categories: [], hot: []});
  assert.deepEqual(parseBibleMap(undefined), {categories: [], hot: []});
  const {categories} = parseBibleMap('| **1. Only keywords** | `a b`, `c d` |');
  assert.deepEqual(categories, [{number: 1, name: 'Only keywords', winners: [], slop: [], hook: '', keywords: ['a b', 'c d']}]);
});

test('the walls show saved references and diagrams, never QA screenshots or scraped frames', () => {
  const file = (filePath, kind = 'image') => ({path: filePath, kind});
  const media = [
    file('resources/research-previews/kalodata-frames/a.jpg'),
    file('resources/research/2026-09-30-avatar-angle-os.png'),
    file('resources/research/notes.md', 'document'),
    file('resources/diagrams/keyword-map.svg'),
    file('resources/learning/offers.png'),
    file('resources/learning/desktop.png'),
    file('resources/learning/study-sheets/one.png'),
    file('agents/image-generator/references/layouts/static_10.png'),
    file('agents/image-generator/references/layouts/static_2.png'),
    file('resources/copywriting/tova/tova-ad.png'),
  ];
  assert.deepEqual(diagramFiles(media).map(entry => entry.path), ['resources/diagrams/keyword-map.svg', 'resources/learning/offers.png', 'resources/research/2026-09-30-avatar-angle-os.png']);
  assert.deepEqual(adLayouts(media).map(entry => entry.path.split('/').pop()), ['static_2.png', 'static_10.png']);
  assert.deepEqual(studiedAds(media).map(entry => entry.path.split('/').pop()), ['tova-ad.png']);
  assert.equal(fileTitle('resources/research/2026-09-30-avatar-angle-os.png'), 'Avatar angle os');
  assert.deepEqual(diagramFiles(), []);
});
