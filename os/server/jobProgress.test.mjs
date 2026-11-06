import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, parseStep, formatDuration, sinceText, jobProgress, QUIET_AFTER } from '../src/jobProgress.mjs';

const T0 = Date.parse('2026-10-01T15:00:00Z');
const at = minutes => new Date(T0 + minutes * 60000).toISOString();

test('parsePlan reads numbered steps split by middots, bars or commas', () => {
  assert.deepEqual(parsePlan('Plan: 1 read · 2 server route · 3 screens · 4 tests · 5 check · 6 hand back'), ['read', 'server route', 'screens', 'tests', 'check', 'hand back']);
  assert.deepEqual(parsePlan('plan: 1. read | 2) build | 3 check'), ['read', 'build', 'check']);
  assert.deepEqual(parsePlan('Plan: read, build, check'), ['read', 'build', 'check']);
  assert.equal(parsePlan('Planning the work'), null);
  assert.equal(parsePlan('running: Plan: inside a summary'), null);
  assert.equal(parsePlan('Plan:   '), null);
});

test('parseStep reads "Step N/M" and "Step N of M", and refuses impossible numbers', () => {
  assert.deepEqual(parseStep('Step 4/6: tests 241/285 passing'), { n: 4, of: 6, text: 'tests 241/285 passing' });
  assert.deepEqual(parseStep('step 2 of 3 - build'), { n: 2, of: 3, text: 'build' });
  assert.equal(parseStep('Step 7/6: too far'), null);
  assert.equal(parseStep('Step 0/6'), null);
  assert.equal(parseStep('Tests: step 4/6'), null);
});

test('durations read as plain words', () => {
  assert.equal(formatDuration(30000), 'under a minute');
  assert.equal(formatDuration(32 * 60000), '32 min');
  assert.equal(formatDuration(65 * 60000), '1 h 5 min');
  assert.equal(formatDuration(120 * 60000), '2 h');
  assert.equal(formatDuration(27 * 3600000), '1 d 3 h');
  assert.equal(sinceText(10000), 'just now');
  assert.equal(sinceText(14 * 60000), '14 min ago');
});

test('jobProgress: elapsed, last update, latest event and plan progress from the saved report', () => {
  const report = { status: 'running', startedAt: at(0), updatedAt: at(20), events: [
    { at: at(0), text: 'running: started' },
    { at: at(1), text: 'Plan: 1 read · 2 server route · 3 screens · 4 tests · 5 check · 6 hand back' },
    { at: at(10), text: 'Step 2/6: route written' },
    { at: at(20), text: 'Step 4/6: tests 241/285 passing' },
  ] };
  const p = jobProgress(report, T0 + 32 * 60000);
  assert.equal(p.elapsed, '32 min');
  assert.equal(p.lastUpdate, '12 min ago');
  assert.equal(p.quiet, true, 'quiet after 10 minutes without an update');
  assert.equal(p.latest, 'Step 4/6: tests 241/285 passing');
  assert.equal(p.plan.total, 6);
  assert.equal(p.plan.current, 4);
  assert.equal(p.plan.done, 3);
  assert.equal(p.plan.percent, 50);
  assert.deepEqual(p.plan.steps.map(s => s.state), ['done', 'done', 'done', 'current', 'todo', 'todo']);
  assert.equal(p.plan.steps[3].label, 'tests');
  const fresh = jobProgress(report, T0 + 25 * 60000);
  assert.equal(fresh.quiet, false);
  assert.equal(jobProgress(report, T0 + 20 * 60000 + QUIET_AFTER).quiet, false, 'exactly 10 minutes is not yet quiet');
});

test('jobProgress: a plan with no step yet shows nothing done; the plan is never the latest event', () => {
  const p = jobProgress({ status: 'running', startedAt: at(0), updatedAt: at(1), events: [
    { at: at(0), text: 'running: started' }, { at: at(1), text: 'Plan: a · b · c' }] }, T0 + 2 * 60000);
  assert.equal(p.plan.done, 0);
  assert.equal(p.plan.current, null);
  assert.deepEqual(p.plan.steps.map(s => s.state), ['todo', 'todo', 'todo']);
  assert.equal(p.latest, 'running: started');
});

test('jobProgress: steps before a newer plan are ignored; Step events alone give numbered steps', () => {
  const replanned = jobProgress({ status: 'running', startedAt: at(0), updatedAt: at(3), events: [
    { at: at(1), text: 'Step 3/3: old plan' }, { at: at(2), text: 'Plan: x · y' }] }, T0 + 4 * 60000);
  assert.equal(replanned.plan.total, 2);
  assert.equal(replanned.plan.done, 0);
  const bare = jobProgress({ status: 'running', startedAt: at(0), updatedAt: at(1), events: [{ at: at(1), text: 'Step 2/5: two' }] }, T0 + 2 * 60000);
  assert.equal(bare.plan.named, false);
  assert.equal(bare.plan.total, 5);
  assert.equal(bare.plan.current, 2);
  assert.equal(bare.plan.steps[0].label, 'Step 1');
});

test('jobProgress: a completed job shows every step done and is never quiet; no events is safe', () => {
  const p = jobProgress({ status: 'completed', startedAt: at(0), updatedAt: at(5), events: [
    { at: at(1), text: 'Plan: a · b · c' }, { at: at(2), text: 'Step 2/3: b' }] }, T0 + 90 * 60000);
  assert.equal(p.plan.done, 3);
  assert.equal(p.plan.percent, 100);
  assert.equal(p.quiet, false);
  const empty = jobProgress({ status: 'running' }, T0);
  assert.equal(empty.plan, null);
  assert.equal(empty.latest, '');
  assert.equal(empty.quiet, false);
});
