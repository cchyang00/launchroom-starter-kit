import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MORE_GUIDES,MORE_PAGES,headlineRule,latest,lessonCounts,oldRecords,ruleFigure,ruleGroups,toolCounts} from '../src/moreView.mjs';

test('More keeps every page that used to sit in the sidebar list', () => {
  assert.deepEqual(MORE_PAGES, ['memory', 'tools', 'files', 'learning', 'issues', 'maps']);
});

test('latest picks the newest date and ignores junk', () => {
  assert.equal(latest(['2026-09-15T10:00:00Z', 'not a date', '2026-09-28T05:00:00Z', '']), '2026-09-28T05:00:00Z');
  assert.equal(latest([]), '');
});

test('lesson counts split in use, proposed and retired', () => {
  const counts = lessonCounts([{status: 'trying'}, {status: 'proven'}, {status: 'proposed'}, {status: 'retired'}, {status: 'retired'}]);
  assert.deepEqual(counts, {inUse: 2, proposed: 1, retired: 2});
  assert.deepEqual(lessonCounts(null), {inUse: 0, proposed: 0, retired: 0});
});

test('tool counts leave retired tools out', () => {
  assert.deepEqual(toolCounts([{id: 'a', signedInNoted: '2026-10-01'}, {id: 'b'}, {id: 'c', retired: true, signedInNoted: '2026-10-01'}]), {live: 2, signedIn: 1});
});

test('a rule reads as one big figure', () => {
  assert.deepEqual(ruleFigure({value: 50, unit: 'usd'}), {big: '$50', small: ''});
  assert.deepEqual(ruleFigure({value: 55, unit: 'percent of bundle order value'}), {big: '55%', small: 'of bundle order value'});
  assert.deepEqual(ruleFigure({value: 3, unit: 'x target cost per sale spent, no sale'}), {big: '3×', small: 'target cost per sale spent, no sale'});
  assert.deepEqual(ruleFigure({value: 72, unit: 'hours'}), {big: '72 h', small: ''});
  assert.deepEqual(ruleFigure({value: 3, max: 5, unit: 'concepts'}), {big: '3–5', small: 'concepts'});
});

test('rules group owner numbers first, starting numbers by step, then never-sell', () => {
  const record = {rules: [
    {id: 'firstTestLossLimit', group: 'launch', by: 'owner', value: 50, unit: 'usd', label: 'First test loss limit'},
    {id: 'targetCpaPercent', group: 'prove', by: 'starting', value: 55, unit: 'percent', label: 'Target cost per sale'},
    {id: 'odd', group: 'somewhere', by: 'starting', value: 1, unit: 'thing', label: 'Odd'},
  ], hardLimits: [{id: 'audio', label: 'Earbuds'}, {id: 'blank'}]};
  const groups = ruleGroups(record);
  assert.deepEqual(groups.yours.map(rule => rule.id), ['firstTestLossLimit']);
  assert.deepEqual(groups.starting.map(step => [step.label, step.rules.length]), [['Verify', 1], ['Other', 1]]);
  assert.equal(groups.startingCount, 2);
  assert.deepEqual(groups.never.map(limit => limit.id), ['audio']);
  assert.equal(headlineRule(record).id, 'firstTestLossLimit');
  assert.equal(headlineRule({}), null);
});

test('the real rules file sorts without losing a rule', async () => {
  const record = JSON.parse(await readFile(new URL('../data/rules.json', import.meta.url), 'utf8'));
  const groups = ruleGroups(record);
  const shown = groups.yours.length + groups.starting.reduce((sum, step) => sum + step.rules.length, 0);
  assert.equal(shown, record.rules.length);
});

test('older records count what they hold and when they last changed', () => {
  const rows = oldRecords({
    issues: [{researched: '2026-10-03'}, {researched: '2026-10-01'}],
    improvements: [{createdAt: '2026-09-15T00:00:00Z'}, {createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-28T00:00:00Z'}],
    maps: null,
  });
  assert.deepEqual(rows.map(row => [row.id, row.count, row.last]), [['issues', 2, '2026-10-03'], ['learning', 2, '2026-09-28T00:00:00Z'], ['maps', 0, '']]);
});

test('every guide on the More page points at a real file', async () => {
  for (const guide of MORE_GUIDES) await readFile(new URL(`../../${guide.path}`, import.meta.url));
});
