import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {doctorReport, createDoctor, startHereRevisions, whenText, DOCTOR_LIMITS} from './doctor.mjs';
import {codeStamp, srcStamp, writeBuildStamp, readBuildStamp, changedFiles} from './buildStamp.mjs';
import {createApi} from './api.mjs';
import {validateLine, currentStep, STEP_BLOCK_WORDS} from '../src/theLine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const realLine = async () => JSON.parse(await fs.readFile(path.resolve(here, '../../workflow/the-line.json'), 'utf8'));
const NOW = new Date('2026-10-01T15:00:00Z'); // 10:00 in Chicago
const daysAgo = n => new Date(NOW.getTime() - n * 86400000).toISOString();
const stamp = files => ({hash: Object.values(files).join('-'), files});

/** Facts for a healthy OS; each test breaks one thing. */
async function healthy(overrides = {}) {
  const line = validateLine(await realLine());
  return {
    now: NOW, today: '2026-10-01', errors: {},
    server: {mode: 'live', startedAt: daysAgo(0.1), loaded: stamp({'server/api.mjs': 'a1'}), disk: stamp({'server/api.mjs': 'a1'})},
    build: {stamp: {builtAt: daysAgo(0.05), srcHash: 's1', files: {'src/App.jsx': 's1'}}, src: {hash: 's1', files: {'src/App.jsx': 's1'}}},
    line, step: currentStep({line, leads: []}),
    issues: {gateMin: 5, problems: [], issues: [{slug: 'sleep', gate: {done: 5, total: 5}, gatePassed: true}], roundsWithoutIssue: []},
    startHere: 'Generated 2026-10-01T14:00:00.000Z; workspace revision 5; planner revision 3; lessons revision 2; tools revision 1. Journal timezone: America/Chicago.',
    nowPage: '# Now — Merrivy\n\nGenerated from workspace revision 5. The short page.',
    workspace: {revision: 5, handoff: {summary: 'We are on Find.', nextAction: 'Eye test.', blockers: ''}},
    planner: {revision: 3, tasks: [{id: 'T-1', title: 'Look at cards', status: 'todo', assignee: 'owner', date: '2026-10-01', focus: true, createdAt: daysAgo(1)}]},
    lessons: {revision: 2, lessons: [{id: 'LS-001', scope: 'everyone', status: 'proven', createdAt: daysAgo(10)}]},
    tools: {revision: 1, tools: [{id: 'kalodata', name: 'Kalodata', url: 'https://www.kalodata.com/', retired: false, signedInNoted: '2026-09-28'}]},
    library: {entries: [{id: 'K-001', title: 'Avatar research', status: 'learned', path: 'workflow/AVATAR.md'}]}, libraryMissing: [],
    activity: [{id: 'job-1', role: 'manager', agent: 'os-builder', status: 'running', updatedAt: daysAgo(0.1)}],
    assets: {counts: {filled: 3, slots: 3, empty: 0}, sections: [{label: 'Home banner', slots: [{status: 'in-store', file: 'a.png'}]}], problems: [], siteDemo: []},
    team: {agents: [{id: 'scout', installed: true}]}, agentFiles: ['scout'],
    ...overrides,
  };
}
const looks = report => report.checks.flatMap(check => check.findings.filter(item => item.status === 'look').map(item => ({...item, check: check.id})));
const lookIn = (report, id) => looks(report).filter(item => item.check === id);

test('a healthy OS reads "All good": every check ok, notes are not counted', async () => {
  const report = doctorReport(await healthy());
  assert.equal(report.count, 0); assert.equal(report.ok, true); assert.equal(report.summary, 'All good');
  assert.deepEqual(report.checks.map(check => check.id), ['server', 'line', 'pipeline', 'issues', 'said', 'memory', 'lessons', 'reports', 'tasks', 'library', 'tools', 'assets', 'team']);
  assert.ok(report.checks.every(check => check.status === 'ok'), JSON.stringify(report.checks.filter(check => check.status !== 'ok')));
  assert.match(report.checks[1].findings[0].text, /The pipeline's focus is Step 1 · Product: [\s\S]*All seven step blocks are within/);
  assert.match(report.checks[2].findings[0].text, /No round yet · 0 products on the line · build slot empty · nothing stuck/);
  const noted = doctorReport(await healthy({assets: {counts: {filled: 2, slots: 3, empty: 1}, sections: [], problems: [], siteDemo: []}}));
  assert.equal(noted.count, 0, 'an empty store place before Build is a note, not a problem');
  assert.match(noted.checks.find(check => check.id === 'assets').findings.at(-1).text, /normal before Step 5 · Build/);
});

test('server: older code than on disk, an old server, a stopped server and a stale build are each one finding', async () => {
  let report = doctorReport(await healthy({server: {mode: 'live', startedAt: daysAgo(0.1), loaded: stamp({'server/api.mjs': 'a1', 'src/theLine.mjs': 't1'}), disk: stamp({'server/api.mjs': 'a2', 'src/theLine.mjs': 't1', 'server/doctor.mjs': 'd1'})}}));
  assert.equal(report.count, 1);
  assert.match(lookIn(report, 'server')[0].text, /older code than the files on disk: 2 files changed since it started at \d\d:\d\d \(server\/api\.mjs; server\/doctor\.mjs\)/);
  assert.match(lookIn(report, 'server')[0].fix, /GET \/api\/runtime/);
  report = doctorReport(await healthy({server: {mode: 'old'}}));
  assert.match(lookIn(report, 'server')[0].text, /from before this health check/);
  report = doctorReport(await healthy({server: {mode: 'down'}}));
  assert.match(lookIn(report, 'server')[0].text, /not running on localhost:3000/);
  report = doctorReport(await healthy({build: {stamp: null, src: {hash: 's1', files: {}}}}));
  assert.match(lookIn(report, 'server')[0].text, /no build stamp/);
  report = doctorReport(await healthy({build: {stamp: {builtAt: daysAgo(0.05), srcHash: 's1', files: {'src/App.jsx': 's1'}}, src: {hash: 's2', files: {'src/App.jsx': 's2', 'src/DoctorBadge.jsx': 'b1'}}}}));
  assert.match(lookIn(report, 'server')[0].text, /screens changed after the last build .*2 files differ \(src\/App\.jsx; src\/DoctorBadge\.jsx\)/);
  assert.match(lookIn(report, 'server')[0].fix, /npm run build/);
});

test('step guide: a broken guide, an over-long step block and an uncomputed step', async () => {
  let report = doctorReport(await healthy({line: null, lineError: 'workflow/the-line.json is not valid JSON.'}));
  assert.match(lookIn(report, 'line')[0].text, /step guide has a problem: .*not valid JSON/);
  const raw = await realLine();
  raw.steps[2].purpose = 'Word '.repeat(110).trim(); raw.steps[2].stopIf = 'Stop '.repeat(100).trim();
  report = doctorReport(await healthy({line: validateLine(raw)}));
  assert.match(lookIn(report, 'line')[0].text, new RegExp(`Step 3 · Prove it: its brief block is \\d+ words \\(limit ${STEP_BLOCK_WORDS}\\)`));
  // The starting rules (os/data/rules.json) unreadable: one finding with its fix.
  report = doctorReport(await healthy({errors: {rules: 'The starting rules (os/data/rules.json) are missing.'}}));
  assert.match(lookIn(report, 'line')[0].text, /starting rules could not be read: .*are missing/); assert.match(lookIn(report, 'line')[0].fix, /Restore os\/data\/rules\.json/);
  report = doctorReport(await healthy({step: null, stepError: 'Malformed product record products/P009/os-product.json'}));
  assert.match(lookIn(report, 'line')[0].text, /could not be worked out: Malformed product record/);
});

test('memory: START-HERE and NOW behind the saved records, missing, built by older code, and a long Now', async () => {
  assert.deepEqual(startHereRevisions('Generated x; workspace revision 5; planner revision 3; lessons revision 2. Journal'), {workspace: 5, planner: 3, lessons: 2, tools: null, rounds: null});
  assert.deepEqual(startHereRevisions('Generated x; workspace revision 5; planner revision 3; lessons revision 2; tools revision 4; rounds revision 6. Journal'), {workspace: 5, planner: 3, lessons: 2, tools: 4, rounds: 6});
  let report = doctorReport(await healthy({planner: {revision: 9, tasks: []}}));
  assert.match(lookIn(report, 'memory')[0].text, /START-HERE\.md is older than the saved records \(planner revision 3 on the page, 9 saved\)/);
  // A round start or review restages START-HERE (its pipeline block names the round).
  report = doctorReport(await healthy({rounds: {revision: 3, rounds: []}, startHere: 'Generated x; workspace revision 5; planner revision 3; lessons revision 2; tools revision 1; rounds revision 2. Journal'}));
  assert.match(lookIn(report, 'memory')[0].text, /rounds revision 2 on the page, 3 saved/);
  report = doctorReport(await healthy({rounds: {revision: 0, rounds: []}}));
  assert.match(lookIn(report, 'memory')[0].text, /built by older code: it does not open with the pipeline yet/);
  report = doctorReport(await healthy({startHere: 'Generated 2026-10-01; workspace revision 5; planner revision 3; lessons revision 2. Journal timezone'}));
  assert.match(lookIn(report, 'memory')[0].text, /built by older code: it does not list the tools/);
  report = doctorReport(await healthy({startHere: null, nowPage: null}));
  assert.equal(lookIn(report, 'memory').length, 2);
  report = doctorReport(await healthy({workspace: {revision: 7, handoff: {summary: 'word '.repeat(320), nextAction: '', blockers: ''}}, startHere: 'workspace revision 7; planner revision 3; lessons revision 2; tools revision 1.'}));
  const memory = lookIn(report, 'memory').map(item => item.text);
  assert.ok(memory.some(text => /NOW\.md is older than the saved Now \(revision 5 on the page, 7 saved\)/.test(text)));
  assert.ok(memory.some(text => new RegExp(`Now is 320 words; keep it to about 250 \\(at most ${DOCTOR_LIMITS.nowWords}\\)`).test(text)));
});

test('lessons: a list over its limit and proposals waiting more than 2 days; a full list is only a note', async () => {
  const active = n => Array.from({length: n}, (_, i) => ({id: `LS-${100 + i}`, scope: 'os-builder', status: 'trying', createdAt: daysAgo(5)}));
  let report = doctorReport(await healthy({lessons: {revision: 2, lessons: [...active(11), {id: 'LS-200', scope: 'scout', status: 'proposed', createdAt: daysAgo(3)}, {id: 'LS-201', scope: 'scout', status: 'proposed', createdAt: daysAgo(1)}]}}));
  const texts = lookIn(report, 'lessons').map(item => item.text);
  assert.deepEqual(texts, ['The os-builder lesson list has 11 active lessons (limit 10).', '1 lesson proposal has waited more than 2 days: LS-200 (scout).']);
  report = doctorReport(await healthy({lessons: {revision: 2, lessons: active(10)}}));
  assert.equal(report.count, 0); assert.match(report.checks.find(check => check.id === 'lessons').findings.at(-1).text, /Full lists .*os-builder 10\/10/);
});

test('reports: running with no update for 24 hours and blocked for more than 7 days', async () => {
  const report = doctorReport(await healthy({activity: [
    {id: 'scout-old', role: 'validation', agent: 'scout', status: 'running', updatedAt: daysAgo(2)},
    {id: 'store-stuck', role: 'shopify-builder', status: 'blocked', updatedAt: daysAgo(8)},
    {id: 'fresh-block', role: 'manager', status: 'blocked', updatedAt: daysAgo(2)},
    {id: 'done-long-ago', role: 'manager', status: 'completed', updatedAt: daysAgo(30)},
  ]}));
  assert.deepEqual(lookIn(report, 'reports').map(item => item.text.replace(/last update [^)]+/, 'last update …')), [
    '1 running report has had no update for 24 hours: scout-old (scout, last update …).',
    '1 blocked report is older than 7 days: store-stuck (shopify-builder, last update …).']);
});

test('to-dos: overdue, owner tasks waiting more than 3 days and focus over the daily cap', async () => {
  const task = (id, extra) => ({id, title: `Task ${id}`, status: 'todo', assignee: 'agent', date: '2026-10-01', focus: false, createdAt: daysAgo(1), ...extra});
  const report = doctorReport(await healthy({planner: {revision: 3, tasks: [
    task('a', {date: '2026-09-29'}), task('b', {date: '2026-09-30', status: 'done'}),
    task('c', {assignee: 'owner', createdAt: daysAgo(4), date: ''}),
    ...['f1', 'f2', 'f3', 'f4'].map(id => task(id, {focus: true, date: '2026-10-02'})),
  ]}}));
  assert.deepEqual(lookIn(report, 'tasks').map(item => item.text), [
    '1 open to-do is dated before today: Task a (2026-09-29).',
    '1 owner to-do has waited more than 3 days: Task c.',
    '2026-10-02 has 4 open focus tasks (limit 3).']);
});

test('library and tools: missing files, an old reading list, links and old sign-in notes', async () => {
  const report = doctorReport(await healthy({
    library: {entries: [{id: 'K-001', status: 'learned', path: 'gone.md', title: 'Gone'}, {id: 'K-002', status: 'to-learn', title: 'Gift arrival dates', requestedOn: '2026-09-20'}, {id: 'K-003', status: 'to-learn', title: 'Fresh', requestedOn: '2026-09-28'}]},
    libraryMissing: [{id: 'K-001', path: 'gone.md'}],
    tools: {revision: 1, tools: [{id: 'a', name: 'Kalodata', url: 'https://www.kalodata.com/', signedInNoted: '2026-09-10'}, {id: 'b', name: 'Broken', url: ''}, {id: 'c', name: 'Old retired', url: '', retired: true, signedInNoted: '2026-08-01'}]},
  }));
  assert.deepEqual(lookIn(report, 'library').map(item => item.text), ['1 library entry points at a file that is missing: K-001 (gone.md).', '1 reading-list item is older than 7 days: K-002 Gift arrival dates.']);
  assert.deepEqual(lookIn(report, 'tools').map(item => item.text), ['1 tool has no working link: Broken.', '1 tool has a "Signed in?" note older than 14 days: Kalodata (2026-09-10).']);
  assert.doesNotMatch(lookIn(report, 'tools').at(-1).fix, /password:/);
});

test('store pictures: missing files, empty places at Build, demo pictures on site pages and map problems', async () => {
  const sections = [{label: 'Home banner', slots: [{status: 'missing', file: 'hydrogen-storefront/public/images/gone.webp'}]}, {label: 'Product gallery', slots: [{status: 'in-store', label: 'Front'}, {status: 'empty', label: 'Side'}]}];
  const map = {counts: {filled: 1, slots: 3, empty: 1}, sections, problems: ['templates.ts could not be read, so the default section order is shown.', 'site.json aboutHero.image (About page · Hero) still shows a demo hoodie picture (/images/hoodie.webp) while the store\'s packet is a real product.'], siteDemo: [{key: 'aboutHero.image', label: 'About page · Hero', src: '/images/hoodie.webp'}]};
  const line = validateLine(await realLine());
  const build = {...currentStep({line, leads: []}), index: 4, number: 5, name: 'Build'};
  const report = doctorReport(await healthy({assets: map, step: build}));
  assert.deepEqual(lookIn(report, 'assets').map(item => item.text), [
    '1 site picture on Merrivy\'s own pages still shows a demo hoodie picture while the store\'s packet is a real product: About page · Hero (/images/hoodie.webp).',
    'templates.ts could not be read, so the default section order is shown.',
    '1 place on the store page points at a file that is missing: Home banner (hydrogen-storefront/public/images/gone.webp).',
    '1 place on the store page still needs a picture.']);
  assert.match(lookIn(report, 'assets')[0].fix, /--agent store-builder/);
  const unchecked = doctorReport(await healthy({assets: null}));
  assert.equal(unchecked.count, 0); assert.equal(unchecked.checks.find(check => check.id === 'assets').status, 'note');
});

test('team roster and unreadable records each become one plain finding', async () => {
  let report = doctorReport(await healthy({team: {agents: [{id: 'scout', installed: true}, {id: 'ghost', installed: false}]}, agentFiles: ['scout', 'stray']}));
  assert.deepEqual(lookIn(report, 'team').map(item => item.text), ['On the roster but no .claude/agents file: ghost.', 'Agent files not on the roster: stray.']);
  report = doctorReport(await healthy({team: {error: 'Team file needs repair: bad JSON'}}));
  assert.match(lookIn(report, 'team')[0].text, /Team file needs repair/);
  report = doctorReport(await healthy({planner: null, errors: {planner: 'Malformed JSON in os/data/planner.json.'}}));
  assert.match(lookIn(report, 'tasks')[0].text, /os\/data\/planner\.json could not be read: Malformed JSON/);
  assert.match(whenText('2026-09-17T23:39:00Z', '2026-10-01'), /^Sep 17 18:39$/);
});

test('code and build stamps notice a change on disk; the server keeps the stamp it started with', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-doctor-os-'));
  t.after(async () => { assert.ok(path.basename(dir).startsWith('merrivy-doctor-os-')); await fs.rm(dir, {recursive: true, force: true}); });
  for (const [file, text] of [['server/api.mjs', 'export const a = 1;\n'], ['server/api.test.mjs', 'test\n'], ['src/theLine.mjs', 'export const b = 1;\n'], ['src/App.jsx', 'export default 1;\n'], ['index.html', '<div id="root"></div>\n']]) {
    await fs.mkdir(path.dirname(path.join(dir, file)), {recursive: true}); await fs.writeFile(path.join(dir, file), text);
  }
  const code = await codeStamp(dir);
  assert.deepEqual(Object.keys(code.files), ['server/api.mjs', 'src/theLine.mjs'], 'tests and screens are not server code');
  assert.deepEqual(Object.keys((await srcStamp(dir)).files), ['src/App.jsx', 'src/theLine.mjs', 'index.html']);
  assert.equal(await readBuildStamp(dir), null);
  const built = await writeBuildStamp(dir, NOW);
  assert.equal((await readBuildStamp(dir)).srcHash, built.srcHash);
  await fs.writeFile(path.join(dir, 'src/App.jsx'), 'export default 2;\n');
  assert.deepEqual(changedFiles({files: built.files}, await srcStamp(dir)), ['src/App.jsx']);

  // A workspace for the API; the doctor reads it and the temporary code folder.
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-doctor-ws-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-doctor-ws-')); await fs.rm(root, {recursive: true, force: true}); });
  await fs.mkdir(path.join(root, 'workflow'), {recursive: true});
  await fs.copyFile(path.resolve(here, '../../workflow/the-line.json'), path.join(root, 'workflow/the-line.json'));
  const {createStore} = await import('./store.mjs');
  const store = createStore({workspaceRoot: root});
  const doctor = createDoctor({workspaceRoot: root, store, osDir: dir});
  let report = await doctor.run({now: NOW});
  assert.ok(!lookIn(report, 'server').some(item => /older code/.test(item.text)), 'nothing changed since it started');
  assert.ok(lookIn(report, 'server').some(item => /screens changed after the last build/.test(item.text)));
  await fs.writeFile(path.join(dir, 'server/api.mjs'), 'export const a = 2;\n');
  report = await doctor.run({now: NOW});
  assert.match(lookIn(report, 'server')[0].text, /older code than the files on disk: 1 file changed .*\(server\/api\.mjs\)/);
  assert.ok(report.checks.find(check => check.id === 'memory').findings.some(item => /START-HERE\.md is missing/.test(item.text)));
});

test('GET /api/doctor answers on the local origin only and never writes a record', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-doctor-api-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-doctor-api-')); await fs.rm(root, {recursive: true, force: true}); });
  await fs.mkdir(path.join(root, 'workflow'), {recursive: true});
  await fs.copyFile(path.resolve(here, '../../workflow/the-line.json'), path.join(root, 'workflow/the-line.json'));
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const get = (host = 'localhost:3000') => new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: '/api/doctor', headers: {Host: host}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    req.on('error', reject); req.end();
  });
  const before = (await fs.readdir(root, {recursive: true})).sort();
  const ok = await get();
  assert.equal(ok.status, 200); assert.equal(ok.data.mode, 'live'); assert.equal(typeof ok.data.count, 'number');
  assert.equal(ok.data.checks.length, 13); assert.match(ok.data.summary, /^(All good|\d+ things? to look at)$/);
  assert.equal(ok.data.checks.find(check => check.id === 'assets').status, 'note', 'no store map in this API: not checked');
  assert.equal((await get('evil.example')).status, 403);
  assert.deepEqual((await fs.readdir(root, {recursive: true})).sort(), before, 'the check wrote nothing');
});
