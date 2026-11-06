import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {claudeAppTasks, cleanSchedules, cronWords, lastRun, mergeSchedules, scheduleProblem} from '../src/schedulesModel.mjs';
import {readSchedules, removeSchedule, saveSchedule} from './schedules.mjs';

const entry = (over = {}) => ({id: 'morning-meta', name: 'Morning Meta numbers', runsIn: 'claude-app', when: 'Every day at 8:00', ...over});

test('a schedule needs an id, a name, a tool and when it runs, and no secrets', () => {
  assert.equal(scheduleProblem(entry()), '');
  assert.match(scheduleProblem(entry({id: 'Morning Meta'})), /lowercase/);
  assert.match(scheduleProblem(entry({runsIn: 'cron'})), /runsIn/);
  assert.match(scheduleProblem(entry({when: ''})), /when it runs/);
  assert.match(scheduleProblem(entry({prompt: 'x'})), /Unknown field/);
  assert.notEqual(scheduleProblem(entry({what: 'uses key sk-live-4f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c'})), '');
});

test('cleanSchedules fills the defaults and drops bad entries with a reason', () => {
  const clean = cleanSchedules({revision: 3, schedules: [entry(), entry(), entry({id: 'x', runsIn: 'nope'})]});
  assert.equal(clean.schedules.length, 1);
  assert.equal(clean.schedules[0].enabled, true);
  assert.deepEqual(clean.schedules[0].sites, []);
  assert.equal(clean.problems.length, 2);
});

test('cron lines read as plain words', () => {
  assert.equal(cronWords('*/15 * * * *'), 'Every 15 minutes');
  assert.equal(cronWords('0 */6 * * *'), 'Every 6 hours');
  assert.equal(cronWords('5 * * * *'), 'Every hour at :05');
  assert.equal(cronWords('0 8 * * *'), 'Every day at 8:00');
  assert.equal(cronWords('30 9 * * 1-5'), 'Weekdays at 9:30');
  assert.equal(cronWords('0 7 * * 1'), 'Every Monday at 7:00');
  assert.equal(cronWords('0 7 1 * *'), '0 7 1 * *');
});

test('the Claude app’s tasks come through by title and timing, never the prompt', () => {
  const tasks = claudeAppTasks({scheduledTasks: [
    {taskId: 'Morning Brief', title: 'Morning brief', cronExpression: '0 8 * * 1-5', enabled: true, prompt: 'secret instructions', lastRunAt: '2026-11-05T13:00:00Z'},
    {id: 'one-off', fireAt: '2026-11-07T15:00:00Z', enabled: false},
  ]});
  assert.deepEqual(tasks.map(task => [task.id, task.name, task.when, task.enabled]), [['claude-app-morning-brief', 'Morning brief', 'Weekdays at 8:00', true], ['claude-app-one-off', 'one-off', 'Once, 2026-11-07 15:00', false]]);
  assert.doesNotMatch(JSON.stringify(tasks), /secret instructions/);
  assert.deepEqual(claudeAppTasks({scheduledTasks: []}), []);
});

test('a schedule’s last run is its newest job report', () => {
  const activity = [{id: 'morning-meta-2026-11-04', updatedAt: '2026-11-04T13:00:00Z', status: 'completed'}, {id: 'morning-meta-2026-11-05', updatedAt: '2026-11-05T13:00:00Z', status: 'failed'}, {id: 'other', updatedAt: '2026-11-06T13:00:00Z'}];
  assert.equal(lastRun(entry(), activity).status, 'failed');
  assert.equal(lastRun(entry({reportId: 'nope'}), activity), null);
});

test('found jobs never repeat one an agent added', () => {
  const merged = mergeSchedules([entry({id: 'claude-app-morning-brief'})], [{id: 'claude-app-morning-brief', found: true}, {id: 'launchroom-meta-sync', found: true}]);
  assert.deepEqual(merged.map(item => [item.id, item.found]), [['claude-app-morning-brief', false], ['launchroom-meta-sync', true]]);
});

test('read, add, update and remove through the server module', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lr-schedules-'));
  const appData = path.join(root, 'appdata');
  await mkdir(path.join(root, 'os', 'data'), {recursive: true});
  await mkdir(path.join(root, 'scripts'), {recursive: true});
  await writeFile(path.join(root, 'scripts', 'sync_meta_campaigns.py'), '# stub');
  await mkdir(path.join(appData, 'Claude', 'claude-code-sessions', 'org', 'acct'), {recursive: true});
  await writeFile(path.join(appData, 'Claude', 'claude-code-sessions', 'org', 'acct', 'scheduled-tasks.json'), JSON.stringify({scheduledTasks: [{taskId: 'brief', title: 'Morning brief', cronExpression: '0 8 * * *'}]}));
  process.env.LAUNCHROOM_APPDATA = appData;
  try {
    let result = await readSchedules(root);
    assert.deepEqual(result.found.map(item => item.id), ['launchroom-meta-sync', 'claude-app-brief']);
    result = await saveSchedule(root, entry({agent: 'ad-manager', sites: ['meta-ads-manager']}));
    assert.equal(result.schedules.length, 1);
    result = await saveSchedule(root, entry({when: 'Every day at 9:00'}));
    assert.equal(result.schedules[0].when, 'Every day at 9:00');
    assert.equal(result.schedules[0].agent, 'ad-manager', 'an update keeps the other fields');
    await assert.rejects(saveSchedule(root, entry({runsIn: 'nope'})), /runsIn/);
    result = await removeSchedule(root, {id: 'morning-meta'});
    assert.equal(result.schedules.length, 0);
    await assert.rejects(removeSchedule(root, {id: 'morning-meta'}), /No schedule/);
  } finally {delete process.env.LAUNCHROOM_APPDATA;}
});
