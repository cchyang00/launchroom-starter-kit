// The starting rules (os/data/rules.json, owner Oct 2): validation, the
// owner's numbers, a revision-checked change, the read API and the helper.
import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs, existsSync} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateRules, updateRules, emptyRules, ruleValue, rulesText, DEFAULT_RULES, RULES_PATH, RULE_GROUPS} from './rules.mjs';
import {createApi} from './api.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const helper = path.join(repo, '.claude/skills/merrivy-os/scripts/os.mjs');

test('the saved rules file is valid, says whose each number is and holds the owner\'s choices', {skip: !existsSync(path.join(repo, RULES_PATH))}, async () => {
  const saved = validateRules(JSON.parse(await fs.readFile(path.join(repo, RULES_PATH), 'utf8')));
  assert.ok(saved.revision >= 1);
  assert.deepEqual(saved.rules.map(rule => rule.id), DEFAULT_RULES.map(rule => rule.id), 'the file and the starting list name the same rules');
  for (const rule of saved.rules) { assert.ok(RULE_GROUPS.includes(rule.group)); assert.ok(rule.whose.length > 3, `${rule.id} says whose number it is`); }
  // The owner's own choices (memory/JOURNAL.md, Oct 2) are marked as the owner's.
  const owner = saved.rules.filter(rule => rule.by === 'owner').map(rule => rule.id);
  assert.ok(owner.includes('firstTestLossLimit') && owner.includes('killMultiple'));
  assert.equal(ruleValue(emptyRules(), 'firstTestLossLimit'), 50); assert.equal(ruleValue(emptyRules(), 'killMultiple'), 3);
  assert.equal(ruleValue(emptyRules(), 'targetCpaPercent'), 55); assert.equal(ruleValue(emptyRules(), 'scalePercent'), 20); assert.equal(ruleValue(emptyRules(), 'noEditHours'), 72);
  assert.ok(emptyRules().rules.filter(rule => rule.by === 'starting').every(rule => rule.whose !== 'owner'), 'starting rules are never passed off as the owner\'s');
});

test('rules are checked field by field; broken files fail plainly', () => {
  const base = emptyRules();
  assert.equal(validateRules(base).rules.length, DEFAULT_RULES.length);
  const broken = mutate => () => { const copy = structuredClone(base); mutate(copy); validateRules(copy); };
  assert.throws(broken(r => { r.revision = -1; }), e => e.code === 'MALFORMED_DATA');
  assert.throws(broken(r => { r.rules[0].value = 'fifty'; }), /value must be a number/);
  assert.throws(broken(r => { r.rules[0].by = 'agent'; }), /"by" must be owner or starting/);
  assert.throws(broken(r => { r.rules[0].group = 'money'; }), /group must be one of/);
  assert.throws(broken(r => { r.rules[1].id = r.rules[0].id; }), /twice/);
  assert.throws(broken(r => { r.rules[0].password = 'x'; }), /no field "password"/);
  assert.throws(broken(r => { r.rules[1].max = 1; }), /max is below the value/);
  assert.equal(ruleValue(null, 'killMultiple'), null);
  assert.match(rulesText(base), /Learn · kill, trim, keep, scale\n {2}Kill an ad: 3 x target cost per sale spent, no sale · owner/);
});

test('a change moves only numbers, marks them the owner\'s and checks the revision', () => {
  const at = new Date('2026-10-02T12:00:00Z');
  const saved = {...emptyRules(), revision: 1};
  const next = updateRules(saved, {revision: 1, changes: {killMultiple: {value: 2}, conceptsPerTest: {value: 4, max: 5}}}, at);
  assert.equal(next.revision, 2); assert.equal(ruleValue(next, 'killMultiple'), 2);
  const concepts = next.rules.find(rule => rule.id === 'conceptsPerTest');
  assert.deepEqual([concepts.value, concepts.max, concepts.by, concepts.setAt], [4, 5, 'owner', at.toISOString()]);
  assert.match(concepts.whose, /^Owner, changed 2026-10-02 \(was 3: /);
  assert.equal(next.rules.find(rule => rule.id === 'killMultiple').whose, saved.rules.find(rule => rule.id === 'killMultiple').whose, 'an owner rule keeps its source line');
  assert.equal(ruleValue(saved, 'killMultiple'), 3, 'the saved record is not changed in place');
  assert.throws(() => updateRules(saved, {revision: 0, changes: {killMultiple: {value: 2}}}, at), e => e.code === 'REVISION_CONFLICT' && e.status === 409);
  assert.throws(() => updateRules(saved, {revision: 1, changes: {}}, at), /at least one rule/);
  assert.throws(() => updateRules(saved, {revision: 1, changes: {ghost: {value: 1}}}, at), e => e.code === 'NOT_FOUND');
  assert.throws(() => updateRules(saved, {revision: 1, changes: {killMultiple: {label: 'Renamed'}}}, at), /only value and max/);
  assert.throws(() => updateRules(saved, {revision: 1, changes: {killMultiple: {value: -1}}}, at), /from 0/);
});

async function workspace(t, withFile = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-rules-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-rules-')); await fs.rm(root, {recursive: true, force: true}); });
  await fs.mkdir(path.join(root, 'os/data'), {recursive: true});
  if (withFile) await fs.writeFile(path.join(root, RULES_PATH), JSON.stringify({...emptyRules(), revision: 1}, null, 2));
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, method = 'GET', value, origin = 'http://localhost:3000') => new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: {Host: 'localhost:3000', ...(method === 'GET' ? {} : {...(origin ? {Origin: origin} : {}), 'Content-Type': 'application/json'})}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => { const body = Buffer.concat(chunks).toString('utf8'); resolve({status: res.statusCode, data: body ? JSON.parse(body) : null}); });
    });
    req.on('error', reject); req.end(value === undefined ? undefined : JSON.stringify(value));
  });
  return {root, request, port: server.address().port};
}

test('GET /api/rules reads the file (or the starting rules); POST changes a number with the revision on the local Origin only', async t => {
  const {root, request} = await workspace(t);
  const read = await request('/api/rules');
  assert.equal(read.status, 200); assert.equal(read.data.revision, 1); assert.equal(read.data.path, RULES_PATH);
  assert.deepEqual(read.data.groups.map(group => group.id), RULE_GROUPS); assert.deepEqual(read.data.owner, ['statsMinPoints', 'avatarsMinimum', 'maxWeightLb', 'firstTestLossLimit', 'killMultiple']);
  assert.deepEqual(read.data.hardLimits.slice(0, 2).map(item => item.id), ['audio', 'app-electronics'], 'the never-dropship list (owner, Oct 2)');
  assert.equal((await request('/api/rules', 'POST', {revision: 1, changes: {killMultiple: {value: 2}}}, 'http://evil.example')).status, 403);
  assert.equal((await request('/api/rules', 'POST', {revision: 0, changes: {killMultiple: {value: 2}}})).status, 409);
  const saved = await request('/api/rules', 'POST', {revision: 1, changes: {firstTestLossLimit: {value: 75}}});
  assert.equal(saved.status, 200); assert.equal(saved.data.revision, 2);
  const file = JSON.parse(await fs.readFile(path.join(root, RULES_PATH), 'utf8'));
  assert.equal(ruleValue(file, 'firstTestLossLimit'), 75); assert.equal(file.revision, 2);
  await fs.writeFile(path.join(root, RULES_PATH), '{broken');
  assert.equal((await request('/api/rules')).data.code, 'MALFORMED_DATA');
  // A project without the file reads the starting rules at revision 0; its first save writes the file.
  const fresh = await workspace(t, false);
  const empty = await fresh.request('/api/rules');
  assert.deepEqual([empty.status, empty.data.revision, empty.data.rules.length], [200, 0, DEFAULT_RULES.length]);
  assert.equal((await fresh.request('/api/rules', 'POST', {revision: 0, changes: {noEditHours: {value: 96}}})).data.revision, 1);
});

test('os.mjs rules prints each rule with whose number it is', {skip: !existsSync(helper)}, async t => {
  const {port} = await workspace(t);
  const out = await new Promise(resolve => execFile(process.execPath, [helper, 'rules'], {env: {...process.env, MERRIVY_OS_PORT: String(port), LAUNCHROOM_PROJECT: ''}}, (error, stdout, stderr) => resolve({code: error ? error.code || 1 : 0, stdout, stderr})));
  assert.equal(out.code, 0, out.stderr);
  assert.match(out.stdout, /^Starting rules \(os\/data\/rules\.json, revision 1\)/);
  assert.match(out.stdout, /Launch · the test sheet\n {2}First test loss limit: 50 usd {2}\[owner\] Owner, October 2/);
  assert.match(out.stdout, /Kill an ad: 3 x target cost per sale spent, no sale {2}\[owner\]/);
  assert.match(out.stdout, /Target cost per sale: 55 percent of bundle order value {2}\[starting\] Gemini \(Baker\)/);
});
