import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs, existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createApi} from './api.mjs';
const FIND_PASS = (country = 'US') => Object.fromEntries([['dropshippable', {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}], ['metaGap', {advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}], ['bigIssue', {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}], ['provenDemand', {advertisers: 5, longestActiveDays: 140, liveAds: 12, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}]}], ['looksWorth', {}], ['productWorks', {}], ['audienceRoom', {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain', why: 'Job forums complain'}, {who: 'Gardeners', problem: 'Sore knees', why: 'Related routine'}]}], ['noBrand', {}]].map(([id, extra]) => [id, {status: 'supported', note: 'Fixture Find check', source: 'https://example.com/fixture-find', observedAt: '2026-09-15', country, evidenceType: 'observed', ...extra}]));

// The Claude Code helper (.claude/skills/merrivy-os/scripts/os.mjs) run as a
// real process: `help` works offline, and the Tools commands go through the
// same API as the app, against a temporary workspace (never the live records).
const helper = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/merrivy-os/scripts/os.mjs');
const run = (args, env = {}) => new Promise(resolve => execFile(process.execPath, [helper, ...args], {env: {...process.env, ...env}, timeout: 20000}, (error, stdout, stderr) => resolve({code: error ? error.code ?? 1 : 0, stdout, stderr})));

test('os.mjs help lists every command group and exits 0; an unknown command prints the same help', {skip: !existsSync(helper)}, async () => {
  const help = await run(['help']);
  assert.equal(help.code, 0, help.stderr);
  for (const group of ['Start', 'To-dos', 'Team', 'Memory', 'Library', 'Tools']) assert.match(help.stdout, new RegExp(`^${group}\\s`, 'm'), group);
  for (const command of ['status', 'doctor', 'step', 'prompts', 'brief', 'todo', 'add', 'set', 'done', 'team', 'inbox', 'report', 'note', 'handoff', 'diary', 'lessons', 'lesson', 'review', 'library', 'tools', 'tool']) assert.match(help.stdout, new RegExp(`\\b${command}\\b`), command);
  const unknown = await run(['nonsense']);
  assert.equal(unknown.code, 1); assert.match(unknown.stderr, /Unknown command "nonsense"/); assert.match(unknown.stdout, /^Tools\s/m);
});

test('os.mjs tools import, tools, tool and edits work through the API and refuse secrets', {skip: !existsSync(helper)}, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-helper-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-helper-')); await fs.rm(root, {recursive: true, force: true}); });
  await fs.mkdir(path.join(root, 'store'), {recursive: true}); await fs.writeFile(path.join(root, 'store/EMAIL.md'), '# Email\n');
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const env = {MERRIVY_OS_PORT: String(server.address().port)};
  const seed = path.join(root, 'seed.json');
  await fs.writeFile(seed, JSON.stringify({tools: [
    {id: 'kalodata', name: 'Kalodata', group: 'research', url: 'https://www.kalodata.com/product', opensIn: 'chrome', steps: ['discovery', 'validation'], agents: ['scout'], purpose: 'Find products.', signIn: "Owner's Google login in Chrome", limits: 'About 10 searches a day.'},
    {id: 'pipiads', name: 'Pipiads', group: 'research', url: 'https://www.pipiads.com/ad-library', opensIn: 'luxury-desktop', steps: ['discovery'], purpose: 'Cross-check ads.', signIn: 'Through the Luxury desktop app'},
    {id: 'zoho-mail', name: 'Zoho Mail', group: 'email', url: 'https://mail.zoho.com/zm/', opensIn: 'chrome', steps: ['testing'], purpose: 'Support inbox.', signIn: 'Owner signs in once in Chrome', source: 'store/EMAIL.md'},
    {id: 'leaky', name: 'Leaky', group: 'research', url: 'https://example.com', opensIn: 'chrome', steps: ['discovery'], purpose: 'Has a secret.', signIn: 'password: hunter2'},
  ]}));
  const imported = await run(['tools', 'import', seed], env);
  assert.equal(imported.code, 1, 'one refused tool makes the import exit 1');
  assert.match(imported.stdout, /3 added · 0 already listed · 1 failed/);
  assert.match(imported.stdout, /FAILED leaky: .*Don't store passwords here/); assert.doesNotMatch(imported.stdout, /hunter2/);
  const again = await run(['tools', 'import', seed], env);
  assert.match(again.stdout, /0 added · 3 already listed · 1 failed/);
  const list = await run(['tools', '--step', 'find'], env);
  assert.equal(list.code, 0, list.stderr); assert.match(list.stdout, /1 tool for Product/); assert.doesNotMatch(list.stdout, /pipiads/, 'agents are never offered Luxury-app tools for a step');
  assert.match((await run(['tools'], env)).stdout, /Research\n[\s\S]*pipiads[\s\S]*open the Luxury desktop app/, 'it stays on the full list');
  const optional = await run(['tool', 'kalodata', '--optional', 'yes'], env);
  assert.equal(optional.code, 0, optional.stderr);
  assert.match((await run(['tools', '--step', 'find'], env)).stdout, /kalodata +Kalodata {2}\[Browser\] {2}\(optional cross-check\)/);
  assert.match((await run(['tool', 'kalodata'], env)).stdout, /^Kalodata \(kalodata\) · optional cross-check/);
  assert.equal((await run(['tool', 'kalodata', '--optional', 'maybe'], env)).code, 1);
  const one = await run(['tool', 'kalodata'], env);
  assert.match(one.stdout, /Open: https:\/\/www\.kalodata\.com\/product/); assert.match(one.stdout, /expect a sign-in wall/);
  const noted = await run(['tool', 'kalodata', '--signed-in', 'yes'], env);
  assert.equal(noted.code, 0, noted.stderr); assert.match(noted.stdout, /signed in noted \d{4}-\d{2}-\d{2}/);
  const refused = await run(['tool', 'kalodata', '--limits', 'api key: abcd1234efgh'], env);
  assert.equal(refused.code, 1); assert.match(refused.stderr, /Don't store passwords here/);
  const retired = await run(['tool', 'zoho-mail', '--retire'], env);
  assert.match(retired.stdout, /saved zoho-mail .*\(retired\)/);
  assert.doesNotMatch((await run(['tools', '--group', 'email'], env)).stdout, /zoho-mail/);
  assert.match((await run(['tools', '--group', 'email', '--all'], env)).stdout, /zoho-mail .*\(retired\)/);
  assert.match(await fs.readFile(path.join(root, 'resources/TOOLS.md'), 'utf8'), /## Retired[\s\S]*Zoho Mail/);
});

test('os.mjs rounds import, pipeline, product, product start, round and --product work through the API', {skip: !existsSync(helper)}, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-helper-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-helper-')); await fs.rm(root, {recursive: true, force: true}); });
  for (const dir of ['workflow', 'products', 'research']) await fs.mkdir(path.join(root, dir), {recursive: true});
  await fs.copyFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../workflow/the-line.json'), path.join(root, 'workflow/the-line.json'));
  const pending = keys => Object.fromEntries(keys.map(key => [key, {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''}]));
  const card = (id, folder, owner, decision) => ({id, name: `Card ${id}`, country: 'US', buyer: '', decision, nextAction: '', references: [`research/${folder}/${id}.md`],
    screen: {ownerDecision: owner, ownerReason: owner === 'unreviewed' ? '' : 'Looks distinct', checks: {...pending(['provenDemand', 'looksWorth', 'productWorks', 'audienceRoom', 'noBrand', 'sourceMatch', 'contribution']), ...(/CURATED/.test(decision) && owner === 'unreviewed' ? FIND_PASS() : {})}},
    gates: Object.fromEntries(['demand', 'community', 'competition', 'sourcing', 'fit'].map(key => [key, {status: 'pending', note: '', source: '', observedAt: '', window: ''}]))});
  await fs.writeFile(path.join(root, 'research/comparison.json'), JSON.stringify({revision: 1, minimumReviews: 5, targetReviews: 10, candidates: [
    card('L001', '2026-09-15-first-discovery', 'unreviewed', 'PARK. Revisit later'), card('L095', '2026-09-26-kalodata-image-pilot', 'unreviewed', 'CURATED - UNVERIFIED'), card('L096', '2026-09-26-kalodata-image-pilot', 'saved', 'CURATED - UNVERIFIED')]}));
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const env = {MERRIVY_OS_PORT: String(server.address().port)};
  // The manager's seed shape: a note, then rounds with number, startedOn, focus, folders and an optional review.
  const seed = path.join(root, 'rounds-seed.json');
  await fs.writeFile(seed, JSON.stringify({note: 'Seed from the batch folders.', rounds: [
    {number: 1, startedOn: '2026-09-15', focus: 'First discovery', folders: ['research/2026-09-15-first-discovery/'], review: {reviewedOn: '2026-09-17', whatWorked: 'Checks caught weak leads.', whatFailed: 'Slow before the eye test.', nextChanges: 'Curate first.'}},
    {number: 4, startedOn: '2026-09-26', focus: 'Kalodata image-led pilot', folders: ['research/2026-09-26-kalodata-image-pilot/']}]}));
  const imported = await run(['rounds', 'import', seed], env);
  assert.equal(imported.code, 0, imported.stderr); assert.match(imported.stdout, /^2 imported \(R01, R04\) · 0 already saved \(none\) · rounds revision 1/);
  assert.match((await run(['rounds', 'import', seed], env)).stdout, /^0 imported \(none\) · 2 already saved \(R01, R04\) · rounds revision 1/);
  const listed = await run(['rounds'], env);
  assert.match(listed.stdout, /^R04 {2}started 2026-09-26 {2}OPEN · 2 cards \(2 on the line, 2 at Product to Prove it\)[\s\S]*R01 {2}started 2026-09-15 {2}reviewed 2026-09-17 · 1 card \(0 on the line\)/);
  const pipeline = await run(['pipeline'], env);
  assert.equal(pipeline.code, 0, pipeline.stderr);
  assert.match(pipeline.stdout, /^The pipeline · Round 4 · started 2026-09-26: Kalodata image-led pilot\nIssues \(step 0\): none yet; the buyer researcher starts one \(templates\/ISSUE\.md\)\.\nOn the line: Product 1 · Buyers 1 · Prove it 0 · Ready to build 0 · Create 0/);
  assert.match(pipeline.stdout, /Build slot: empty/); assert.match(pipeline.stdout, /Needs the owner: Eye test on 1 card: L095 Card L095/);
  // Owner, Oct 2: product first, then its buyers. A saved card waits at Step 2 · Buyers; the Product checks it still owes are shown.
  assert.match(pipeline.stdout, /L096 {3}Card L096 +Buyers +Buyers · pending · Find 0\/6 {2}· Buyer researcher {2}· R04\n {9}Product\[x 0\/6\] Buyers\[> 0\/3\] Prove it\[  0\/7\]/);
  assert.match(pipeline.stdout, /Out of the line: 1 \(R01 1\)/);
  assert.match((await run(['pipeline', '--all'], env)).stdout, /L001 +Card L001 +Parked +R01 +PARK\. Revisit later/);
  const one = await run(['product', 'L096'], env);
  assert.match(one.stdout, /^L096 · Card L096 \(US\) · Round 4\nLine: Product\[x 0\/6\] Buyers\[> 0\/3\] Prove it\[  0\/7\]/);
  assert.match(one.stdout, /Step 2 of 7 · Buyers: Buyers · pending · Find 0\/6\nNext: Buyer researcher: read its buyers \(TikTok comments, 2-4 star reviews, forums\): 15\+ quotes, 2\+ avatars, the angle gap\./);
  // Its seven gates from the saved checks: nothing passes that the card has not recorded.
  assert.match(one.stdout, /Gates \(workflow\/CHECKS\.md; from saved records only\):\n {2}1 Product +0\/6 {2}F1 open · F2 open[\s\S]*\n {2}2 Buyers +0\/3 {2}A1 open · A2 open · A3 open\n {2}3 Prove it +0\/5 {2}P1 open · P2 open/);
  assert.match(one.stdout, /Prompts for Step 2 · Buyers, filled in for L096:\n {2}1\. Research its buyers\n {5}Research the buyers of Card L096 \(L096\): its TikTok comments/);
  const refused = await run(['product', 'start', 'L095'], env);
  assert.equal(refused.code, 1); assert.match(refused.stderr, /LEAD_NOT_SAVED/);
  const started = await run(['product', 'start', 'L096'], env);
  assert.equal(started.code, 0, started.stderr); assert.match(started.stdout, /^started P001-card-l096 from L096 · Card L096 · US · revision 1/);
  assert.equal((await run(['product', 'start', 'L096'], env)).code, 1, 'one product per card');
  const review = await run(['round', 'review', 'R04', '--worked', 'Fast cards', '--failed', 'Few reasons', '--next', 'Buyer first'], env);
  assert.equal(review.code, 1); assert.match(review.stderr, /ROUND_NOT_FINISHED.*L096, L095|ROUND_NOT_FINISHED.*L095, L096/);
  // A round needs a focus and a folder; a named issue must be one the owner is Testing (step 0, owner Oct 3).
  const noFocus = await run(['round', 'start', '--folder', 'research/2026-10-02-pets/'], env);
  assert.equal(noFocus.code, 1); assert.match(noFocus.stderr, /round start needs --focus/);
  await fs.mkdir(path.join(root, 'resources/issues/sleep'), {recursive: true});
  await fs.writeFile(path.join(root, 'resources/issues/sleep/ISSUE.md'), ['# Issue: "I cannot sleep" (fixture)', '', '## Gate', '', ...['I1 · Real: 15+ quotes', 'I2 · Deep: a moment', 'I3 · Distinct avatars: 2+', 'I4 · Product-shaped: 3+ types', 'I5 · Clean: words bank', 'I6 · Wants to buy: 5+ intent quotes', 'I7 · Not owned on Meta: 2 advertisers'].map(line => `- [x] ${line}`), ''].join('\n'));
  await fs.mkdir(path.join(root, 'resources/issues/pets'), {recursive: true});
  // An older five-line gate: it never reads Verified (I2 and I5 were asked less; I6 and I7 not at all).
  await fs.writeFile(path.join(root, 'resources/issues/pets/ISSUE.md'), ['# Issue: my dog chews everything', '', '## Gate (all must be true before Find uses this issue)', '', '- [x] 15+ quotes from 3+ sites', '- [ ] 5+ avatars', '- [x] 5+ product types', '- [x] Costs in 2 areas', '- [x] No usernames', ''].join('\n'));
  const open = await run(['round', 'start', '--issue', 'pets', '--focus', 'Pets for Canada', '--folder', 'research/2026-10-02-pets/'], env);
  assert.equal(open.code, 1); assert.match(open.stderr, /ISSUE_GATE_OPEN.*pets is a Candidate: I2 Deep, I3 Distinct avatars, I5 Clean, I6 Wants to buy, I7 Not owned on Meta still open/);
  assert.match((await run(['round', 'start', '--issue', 'nope', '--focus', 'x', '--folder', 'research/2026-10-02-pets/'], env)).stderr, /ISSUE_MISSING/);
  const notPicked = await run(['round', 'start', '--issue', 'sleep', '--focus', 'Pets for Canada', '--folder', 'research/2026-10-02-pets/'], env);
  assert.equal(notPicked.code, 1); assert.match(notPicked.stderr, /ISSUE_NOT_PICKED.*sleep is Verified, but the owner has not picked it/);
  const listedIssues = await run(['issues'], env);
  assert.equal(listedIssues.code, 0, listedIssues.stderr);
  assert.match(listedIssues.stdout, /^Step 0 · the issue list: 2 issues · 0 testing · 1 verified · 1 candidates · 0 parked\n/);
  assert.match(listedIssues.stdout, /\nVerified {2}sleep {16}I1✓ I2✓ I3✓ I4✓ I5✓ I6✓ I7✓ {2}0q\/0s {2}"I cannot sleep" \(fixture\)\nCandidate pets {17}I1✓ I2~ I3· I4✓ I5~ I6· I7· {2}/);
  // There is no helper for the owner's pick; the owner's screen saves it (here, the file the screen writes).
  await fs.mkdir(path.join(root, 'os/data'), {recursive: true});
  await fs.writeFile(path.join(root, 'os/data/issue-picks.json'), JSON.stringify({revision: 1, picks: {sleep: {pick: 'testing', at: '2026-10-03T12:00:00.000Z'}}}));
  const begun = await run(['round', 'start', '--issue', 'sleep', '--focus', 'Pets for Canada', '--folder', 'research/2026-10-02-pets/'], env);
  assert.equal(begun.code, 0, begun.stderr); assert.match(begun.stdout, /^started R05 · rounds revision 2[\s\S]*issue: sleep/);
  assert.match((await run(['issues', '--status', 'testing'], env)).stdout, /\nTesting {3}sleep {16}I1✓[^\n]*\n {31}rounds: R05 \(open\)/);
  const oneIssue = await run(['issues', 'sleep'], env);
  assert.match(oneIssue.stdout, /^sleep · Testing \(owner, 2026-10-03\) · I1✓ I2✓ I3✓ I4✓ I5✓ I6✓ I7✓\n[\s\S]*\[x\] I1 · Real[\s\S]*\[x\] I6 · Wants to buy[\s\S]*\[x\] I7 · Not owned on Meta[\s\S]*Rounds: R05 \(open\)/);
  assert.equal((await run(['issues', '--status', 'maybe'], env)).code, 1);
  const task = await run(['add', 'Check the supplier', '--product', 'L096', '--agent', 'checker'], env);
  assert.equal(task.code, 0, task.stderr); assert.match(task.stdout, /Check the supplier {2}\[L096\] {2}→ checker/);
  assert.equal((await run(['add', 'Ghost', '--product', 'L404'], env)).code, 1);
  const status = await run(['status'], env);
  assert.match(status.stdout, /^The pipeline · Round 5 · started \d{4}-\d{2}-\d{2} · issue: sleep: Pets for Canada\n {2}Issues \(step 0\): 2 · testing sleep · os\.mjs issues\n {2}Product 1 · Buyers 1 · Prove it 0/);
  // An open round links a Testing issue (round focus --issue); a Candidate is refused.
  const gateOpen = await run(['round', 'focus', 'R04', '--issue', 'pets'], env);
  assert.equal(gateOpen.code, 1); assert.match(gateOpen.stderr, /ISSUE_GATE_OPEN/);
  const linked = await run(['round', 'focus', 'R04', '--issue', 'sleep'], env);
  assert.equal(linked.code, 0, linked.stderr); assert.match(linked.stdout, /^issue linked to R04 · rounds revision 3[\s\S]*issue: sleep/);
  assert.match((await run(['issues', 'sleep'], env)).stdout, /Rounds: R04 \(open\), R05 \(open\)/);
  assert.match((await run(['pipeline'], env)).stdout, /Issues \(step 0\): 2 · testing sleep/);
  // A focus alone still starts a round, with a note pointing at the Testing issues.
  const plain = await run(['round', 'start', '--focus', 'Desk comfort', '--folder', 'research/2026-10-03-desk/'], env);
  assert.equal(plain.code, 0, plain.stderr); assert.match(plain.stdout, /^Note: no --issue\. Rounds start from an issue the owner is Testing/);
  assert.match(await fs.readFile(path.join(root, 'memory/ROUNDS.md'), 'utf8'), /## R05 · Round 5/);
});

test('os.mjs doctor prints the health check from the server, or from the files when the OS is down', {skip: !existsSync(helper)}, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-helper-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-helper-')); await fs.rm(root, {recursive: true, force: true}); });
  await fs.mkdir(path.join(root, 'workflow'), {recursive: true});
  await fs.copyFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../workflow/the-line.json'), path.join(root, 'workflow/the-line.json'));
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const live = await run(['doctor'], {MERRIVY_OS_PORT: String(server.address().port)});
  assert.equal(live.code, 0, live.stderr);
  assert.match(live.stdout, /^OS health check: (All good|\d+ things? to look at) \(\d{4}-\d{2}-\d{2} \d\d:\d\d Chicago, from the running server\)/);
  assert.match(live.stdout, /LOOK {2}Start page and Now\n {6}memory\/START-HERE\.md is missing[\s\S]*\n {6}Fix: /);
  assert.match(live.stdout, /ok {4}Step guide and current step: The pipeline's focus is Step 1 · Product/);
  assert.doesNotMatch(live.stdout, /starting rules could not be read/, 'a project without os/data/rules.json uses the starting rules');
  assert.match(live.stdout, /never changes a record/);
  // Nothing listens on this port: the same rules run from the files (read-only).
  const spare = http.createServer(); await new Promise(resolve => spare.listen(0, '127.0.0.1', resolve));
  const closed = spare.address().port; await new Promise(resolve => spare.close(resolve));
  const down = await run(['doctor'], {MERRIVY_OS_PORT: String(closed), MERRIVY_WORKSPACE_ROOT: root});
  assert.equal(down.code, 0, down.stderr);
  assert.match(down.stdout, /read from the files: the OS is not running\)/);
  assert.match(down.stdout, /LOOK {2}OS server and app build\n {6}The OS is not running on localhost:3000/);
});

test('os.mjs report infers the department and summary; inbox parks someday jobs (cold-start test)', {skip: !existsSync(helper)}, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-helper-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-helper-')); await fs.rm(root, {recursive: true, force: true}); });
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const env = {MERRIVY_OS_PORT: String(server.address().port)};
  // A new report with only --agent, --status and --title: role from the agent, summary from the title.
  const started = await run(['report', 'scout-test', '--agent', 'scout', '--status', 'running', '--title', 'Sleep cards', '--event', 'Plan: 1 search · 2 cards'], env);
  assert.equal(started.code, 0, started.stderr); assert.match(started.stdout, /^report scout-test · running · revision 1 · scout/);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'os/data/activity.json'), 'utf8'));
  const report = (saved.activity || saved).find(item => item.id === 'scout-test');
  assert.deepEqual([report.role, report.summary], ['validation', 'Sleep cards']);
  for (const [agent, role] of [['copywriter', 'image-generator'], ['store-builder', 'shopify-builder'], ['os-builder', 'manager']]) {
    assert.equal((await run(['report', `${agent}-test`, '--agent', agent, '--status', 'running', '--title', 'x'], env)).code, 0);
    const list = JSON.parse(await fs.readFile(path.join(root, 'os/data/activity.json'), 'utf8'));
    assert.equal((list.activity || list).find(item => item.id === `${agent}-test`).role, role, agent);
  }
  // What remains missing is named, with a working example.
  const missing = await run(['report', 'nothing-yet', '--status', 'running'], env);
  assert.equal(missing.code, 1); assert.match(missing.stderr, /A new report needs --agent, --title\. Example:\n {2}os\.mjs report scout-2026-10-02-sleep --agent scout --status running --title/);
  assert.match((await run(['report', 'who', '--agent', 'stranger', '--status', 'running', '--title', 'x'], env)).stderr, /no department known for "stranger"/);
  // An existing report updates with just --event.
  assert.match((await run(['report', 'scout-test', '--event', 'Step 1/2: searching'], env)).stdout, /revision 2/);
  // Someday agent jobs are parked: not DISPATCH, only a count.
  assert.equal((await run(['add', 'Old Kalodata job', '--agent', 'scout', '--date', 'someday'], env)).code, 0);
  assert.equal((await run(['add', 'Sleep cards', '--agent', 'scout', '--date', 'today'], env)).code, 0);
  const inbox = await run(['inbox'], env);
  assert.match(inbox.stdout, /Agent inbox: 1 waiting for dispatch · 0 working · 0 blocked · 1 parked \(someday\)/);
  assert.match(inbox.stdout, /DISPATCH scout +\w+ {2}Sleep cards/); assert.doesNotMatch(inbox.stdout, /DISPATCH[^\n]*Old Kalodata job/);
  assert.match(inbox.stdout, /Parked: 1 someday job, not dispatched/);
});

test('os.mjs lesson propose is forgiving: --help, the spellings agents tried, --flag=value, plain refusals', {skip: !existsSync(helper)}, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-helper-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-helper-')); await fs.rm(root, {recursive: true, force: true}); });
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const env = {MERRIVY_OS_PORT: String(server.address().port)};
  for (const args of [['lesson', 'propose', '--help'], ['lesson', '--help'], ['help', 'lesson'], ['lesson', 'propose', '"x"', '-h']]) {
    const help = await run(args, env);
    assert.equal(help.code, 0, `${args.join(' ')}: ${help.stderr}`); assert.match(help.stdout, /lesson propose "Rule in one line[^\n]*--why "[^"]+" --for os-builder --by os-builder/);
  }
  assert.equal(existsSync(path.join(root, 'os/data/lessons.json')), false, '--help writes nothing');
  const tried = await run(['lesson', 'propose', 'Check the drawer at 390px before handing back', '--reason', 'A long name pushed the drawer sideways', '--scope', 'OS-Builder', '--source', 'os-builder', '--context=Stats panel QA'], env);
  assert.equal(tried.code, 0, tried.stderr);
  assert.match(tried.stdout, /saved LS-001 \[os-builder · proposed\] Check the drawer at 390px/);
  assert.match(tried.stderr, /--reason read as --why/); assert.match(tried.stderr, /--scope read as --for/); assert.match(tried.stderr, /--source os-builder read as --by os-builder/);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'os/data/lessons.json'), 'utf8')).lessons[0];
  assert.equal(saved.proposedBy, 'os-builder'); assert.equal(saved.source, 'job'); assert.equal(saved.learnedFrom, 'Stats panel QA'); assert.equal(saved.why, 'A long name pushed the drawer sideways');
  const agentFlag = await run(['lesson', 'propose', '--rule=Search the Library first', '--because=We re-researched a known topic', '--for=all', '--agent=scout'], env);
  assert.equal(agentFlag.code, 0, agentFlag.stderr); assert.match(agentFlag.stdout, /saved LS-002 \[everyone · proposed\] Search the Library first/);
  const long = await run(['lesson', 'propose', 'x'.repeat(230), '--why', 'Because'], env);
  assert.equal(long.code, 1); assert.match(long.stderr, /The rule is 230 characters; the limit is 200\. Keep the rule to one short line/);
  const noWhy = await run(['lesson', 'propose', 'A rule with no reason'], env);
  assert.equal(noWhy.code, 1); assert.match(noWhy.stderr, /lesson propose needs --why "the reason"/); assert.match(noWhy.stderr, /Propose one/);
  const two = await run(['lesson', 'propose', 'Rule', '--why', 'Why', '--for', 'scout,checker'], env);
  assert.equal(two.code, 1); assert.match(two.stderr, /A lesson is for one scope/);
  const dangling = await run(['lesson', 'propose', 'Rule', '--why'], env);
  assert.equal(dangling.code, 1); assert.match(dangling.stderr, /--why needs a value, e\.g\. --why "\.\.\."/);
  const retired = await run(['lesson', 'set', 'ls-1', '--status', 'retired', '--note', 'Merged into LS-002'], env);
  assert.equal(retired.code, 0, retired.stderr); assert.match(retired.stdout, /saved LS-001 \[os-builder · retired\]/);
});
