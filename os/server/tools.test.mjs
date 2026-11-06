import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {createStore} from './store.mjs';
import {createApi} from './api.mjs';
import {emptyTools, updateTools, validateTools, toolsMarkdown, toolSource} from './tools.mjs';
import {agentBrief, emptyLessons, stepToolsMarkdown, BRIEF_TOOL_LIMIT} from './lessons.mjs';
import {currentStep} from '../src/theLine.mjs';
import {SECRET_MESSAGE, PAYMENT_MESSAGE, secretProblem, urlProblem, looksRandom, looksLikeCard, slugify, guessGroup, needsSignIn, toolsForStep, toolsByGroup, toolCounts, isThisApp, stepFrom} from '../src/toolsModel.mjs';

// Three tools copied from the owner's seed list (scratchpad tools-draft.json, Oct 1):
// their wording mentions passwords and API keys without holding any.
const kalodata = {id: 'kalodata', name: 'Kalodata', group: 'research', url: 'https://www.kalodata.com/product', opensIn: 'chrome', steps: ['discovery', 'validation'], agents: ['scout', 'checker'], purpose: 'Find products and check their TikTok Shop sales and trend by country and date.', signIn: "Owner's Google login in Chrome (trial account); the course also includes Kalodata through the Luxury app", limits: 'Trial allows about 10 searches and 10 detail visits a day, so spend them on a small batch; do not upgrade or buy a plan without approval.', source: 'agents/validation/references/TOOLS.md'};
const openrouter = {id: 'openrouter', name: 'OpenRouter (video generation)', group: 'creative', url: 'https://openrouter.ai/docs/guides/overview/multimodal/video-generation', opensIn: 'chrome', steps: ['creative'], agents: ['image-maker'], purpose: 'Paid image-to-video service for short store and ad clips through our generate-video script.', signIn: 'Owner adds the API key to their Windows environment themselves; never paste it in chat', limits: 'Paid and not set up yet: dry run by default, and any run needs owner approval, --confirm and --max-cost.', source: 'memory/START-HERE.md'};
const zoho = {id: 'zoho-mail', name: 'Zoho Mail (support inbox)', group: 'email', url: 'https://mail.zoho.com/zm/', opensIn: 'chrome', steps: ['testing'], agents: ['store-builder'], purpose: 'The support@merrivy.com mailbox for customer questions and Shopify sender verification.', signIn: 'Owner signs in once in Chrome (Mail Free plan, sender Merrivy Support)', limits: 'Do not send or reply to anyone without owner approval, and keep passwords and message contents out of records.', source: 'store/EMAIL.md'};
const trendtrack = {id: 'trendtrack', name: 'Trendtrack', group: 'research', url: 'https://app.trendtrack.io/en/workspace/w-shaunns-workspace-LBrRNoz/ads', opensIn: 'chrome', steps: ['validation', 'testing'], agents: ['checker'], purpose: 'Map competing Meta ads, shops and traffic for one product in one country.', signIn: 'Owner signs in once in Chrome; the saved workspace link sends you to sign-in if the session ended', limits: 'An empty search means limited visibility, not no competitors.'};
const metaAds = {id: 'meta-ads-manager', name: 'Meta Ads Manager (Cha Yang account)', group: 'ads', url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=9818342388208988', opensIn: 'chrome', steps: ['testing'], agents: ['checker'], purpose: 'Where ads for Merrivy will run and be read: ad account 9818342388208988 in portfolio Bm ads 223.', signIn: "Owner's Facebook login in Chrome; check the account picker shows Cha Yang under Bm ads 223"};
const osTool = {id: 'merrivy-os', name: 'Merrivy OS', group: 'local', url: 'http://localhost:3000', opensIn: 'local', steps: ['discovery', 'validation', 'sourcing', 'creative', 'shopify', 'testing'], purpose: 'Our shared work app.', signIn: 'No sign-in, local'};
const pipiads = {id: 'pipiads', name: 'Pipiads', group: 'research', url: 'https://www.pipiads.com/ad-library', opensIn: 'luxury-desktop', steps: ['discovery', 'validation'], agents: ['scout'], purpose: 'Cross-check a named product against TikTok and Meta ads.', signIn: 'Through the Luxury desktop app (brother\'s course access)'};
const now = new Date('2026-10-01T15:00:00Z');
const add = (registry, tool) => updateTools(registry, {revision: registry.revision, ...tool}, now);

test('the seed wording is accepted: mentioning a password or API key is not storing one', () => {
  let registry = emptyTools();
  for (const tool of [kalodata, openrouter, zoho, trendtrack, metaAds, osTool, pipiads]) registry = add(registry, tool);
  assert.equal(registry.tools.length, 7); assert.equal(registry.revision, 7);
  const saved = registry.tools.find(tool => tool.id === 'kalodata');
  // Steps saved with the old six-step ids (before Oct 2) are kept as the new ones: discovery is Product, validation is Prove it.
  assert.deepEqual(saved.steps, ['product', 'prove']); assert.equal(saved.retired, false); assert.equal(saved.signedInNoted, '');
  assert.equal(registry.tools.find(tool => tool.id === 'merrivy-os').url, 'http://localhost:3000/');
  assert.equal(registry.tools.find(tool => tool.id === 'meta-ads-manager').url, metaAds.url);
  assert.doesNotThrow(() => validateTools(registry));
});

test('passwords, keys, tokens, card numbers and sign-in links are refused with the plain message', () => {
  const refused = [
    {signIn: 'Password: hunter2'}, {signIn: 'password=Summer2026!'}, {limits: 'The password is hunter2.'}, {signIn: 'passcode: 4471'},
    {limits: 'api key: abcd1234efgh'}, {signIn: 'Use sk-or-v1-' + '0123456789abcdef0123456789abcdef'}, {purpose: 'Token = ghp_' + '0123456789abcdefABCDEF0123'},
    {signIn: 'Bearer eyJhbGciOiJIUzI1NiJ9.' + 'eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcd1234'}, {limits: 'secret: s3cr3t-value'}, {signIn: 'pin is 0000'},
    {limits: 'aZ3kP9qL0xT7mN2bV8cR5wY1'}, {limits: '0123456789abcdef0123456789abcdef'}, {signIn: 'shpat_' + '0123456789abcdef0123456789abcdef'},
    {url: 'https://owner:hunter2@www.kalodata.com/product'}, {url: 'https://www.kalodata.com/product?token=abc'}, {url: 'https://www.kalodata.com/#access_token=abc'},
    {url: 'https://example.com/report?id=aZ3kP9qL0xT7mN2bV8cR5wY1'}, {name: 'Kalodata password: hunter2'}, {source: 'https://example.com/?api_key=1'},
  ];
  for (const bad of refused) assert.throws(() => add(emptyTools(), {...kalodata, ...bad}), error => error.code === 'SECRET_REFUSED' && error.message === SECRET_MESSAGE, `refuses ${JSON.stringify(bad)}`);
  assert.throws(() => add(emptyTools(), {...kalodata, limits: 'Card 4111 1111 1111 1111 for the plan'}), error => error.code === 'SECRET_REFUSED' && error.message === PAYMENT_MESSAGE);
  // A login field, or any field outside the fixed set, is refused before anything is saved.
  for (const key of ['password', 'apiKey', 'token', 'login', 'username', 'email', 'cookie']) assert.throws(() => add(emptyTools(), {...kalodata, [key]: 'anything'}), error => error.code === 'SECRET_REFUSED' && error.message === SECRET_MESSAGE, key);
  assert.throws(() => add(emptyTools(), {...kalodata, colour: 'blue'}), error => error.code === 'UNKNOWN_FIELD');
  // Plain mentions and safe values pass.
  for (const fine of ['Password: owner signs in', 'token is required at sign-in', 'Never paste the API key here', 'ad account 9818342388208988', 'merrivy-storefront-2026-09-29-public-demo', 'TikTok video 7412345678901234567']) assert.equal(secretProblem(fine), '', fine);
  assert.equal(secretProblem('https://www.tiktok.com/@shop/video/7412345678901234567'), '');
});

test('fields are fixed: ids, groups, steps, links and dates', () => {
  const bad = [
    {id: 'Not Kebab'}, {id: 'trailing-'}, {group: 'misc'}, {opensIn: 'safari'}, {steps: []}, {steps: ['nowhere']}, {steps: ['discovery', 'nope']}, {steps: ['8']},
    {url: 'javascript:alert(1)'}, {url: 'file:///C:/secrets.txt'}, {url: 'ftp://x.com'}, {url: 'http://example.com'}, {url: 'not a link'}, {url: ''},
    {name: ''}, {name: 'x'.repeat(81)}, {purpose: ''}, {purpose: 'x'.repeat(241)}, {limits: 'x'.repeat(301)}, {agents: ['Not An Agent']},
    {retired: 'yes'}, {signedInNoted: '2026-02-30'}, {signedInNoted: '2099-01-01'}, {source: '../outside.md'}, {source: 'os/data/planner.json'}, {source: '.env'},
    {opensIn: 'local'}, {url: 'http://localhost:3001', opensIn: 'chrome'},
  ];
  for (const value of bad) assert.throws(() => add(emptyTools(), {...kalodata, ...value}), `rejects ${JSON.stringify(value).slice(0, 60)}`);
  assert.equal(urlProblem('http://localhost:3001'), ''); assert.equal(urlProblem('https://merrivy.com'), '');
  assert.equal(toolSource('hydrogen-storefront/README.md'), 'hydrogen-storefront/README.md');
  assert.equal(toolSource('.claude/skills/kalodata/SKILL.md'), '.claude/skills/kalodata/SKILL.md');
  assert.equal(add(emptyTools(), {...kalodata, signedInNoted: '2026-10-01'}).tools[0].signedInNoted, '2026-10-01');
});

test('create without an id names it from the name; edits keep fields; retire hides and nothing is deleted', () => {
  let registry = add(emptyTools(), kalodata);
  // The Add sheet sends four things: name, link, what for and one step. Group and opens-in are worked out.
  registry = updateTools(registry, {revision: registry.revision, name: 'Canva Pro', url: 'https://www.canva.com/', purpose: 'Quick ad image layouts.', steps: ['creative']}, now);
  const canva = registry.tools.at(-1);
  assert.equal(canva.id, 'canva-pro'); assert.equal(canva.group, 'creative'); assert.equal(canva.opensIn, 'chrome'); assert.equal(canva.signIn, '');
  assert.throws(() => updateTools(registry, {revision: registry.revision, name: 'Kalodata', url: 'https://kalodata.com', purpose: 'Again', steps: ['discovery']}, now), error => error.code === 'DUPLICATE_TOOL' && error.status === 409);
  assert.throws(() => updateTools(registry, {revision: registry.revision - 1, id: 'kalodata', limits: 'Changed'}, now), error => error.code === 'REVISION_CONFLICT');
  registry = updateTools(registry, {revision: registry.revision, id: 'kalodata', limits: 'Ten searches a day.'}, now);
  const edited = registry.tools.find(tool => tool.id === 'kalodata');
  assert.equal(edited.limits, 'Ten searches a day.'); assert.equal(edited.purpose, kalodata.purpose); assert.deepEqual(edited.agents, ['scout', 'checker']);
  registry = updateTools(registry, {revision: registry.revision, id: 'canva-pro', retired: true}, now);
  assert.equal(registry.tools.length, 2); assert.equal(registry.tools.find(tool => tool.id === 'canva-pro').retired, true);
  assert.equal(toolCounts(registry.tools).active, 1); assert.equal(toolCounts(registry.tools).retired, 1);
  assert.match(toolsMarkdown(registry), /## Retired[\s\S]*Canva Pro/);
  assert.equal(guessGroup({url: 'http://localhost:4000', steps: ['creative']}), 'local');
  assert.equal(guessGroup({url: 'https://www.aliexpress.com', steps: ['discovery']}), 'sourcing');
  assert.equal(guessGroup({url: 'https://example.com', steps: ['shopify']}), 'store');
  assert.equal(slugify('  Meta Ads Manager (Cha Yang)! '), 'meta-ads-manager-cha-yang');
});

test('step lists, groups and sign-in come from saved tools only', () => {
  let registry = emptyTools();
  for (const tool of [osTool, kalodata, pipiads, zoho, trendtrack]) registry = add(registry, tool);
  registry = updateTools(registry, {revision: registry.revision, id: 'trendtrack', retired: true}, now);
  const find = toolsForStep(registry.tools, 'product').map(tool => tool.id);
  assert.deepEqual(find, ['kalodata', 'pipiads'], 'the OS itself and retired tools never show as Open cards');
  assert.deepEqual(toolsForStep(registry.tools, 'discovery').map(tool => tool.id), find, 'an old step id still finds its step');
  assert.deepEqual(toolsForStep(registry.tools, 'prove').map(tool => tool.id), ['kalodata', 'pipiads'], 'validation and sourcing are Prove it now');
  assert.deepEqual(toolsForStep([{...kalodata, steps: ['validation', 'sourcing'], retired: false}], 'prove').map(tool => tool.id), ['kalodata'], 'tags saved before Oct 2 read as their new step');
  assert.deepEqual(toolsByGroup(registry.tools).map(group => group.group), ['research', 'email', 'local']);
  assert.equal(isThisApp(registry.tools[0]), true);
  assert.equal(needsSignIn(registry.tools.find(tool => tool.id === 'kalodata')), true);
  assert.equal(needsSignIn(registry.tools.find(tool => tool.id === 'merrivy-os')), false);
  assert.equal(stepFrom('find'), 'product'); assert.equal(stepFrom('4'), 'create'); assert.equal(stepFrom('shopify'), 'build'); assert.equal(stepFrom('Prove it'), 'prove'); assert.equal(stepFrom('7'), 'learn'); assert.equal(stepFrom('soon'), null);
  assert.ok(looksRandom('aZ3kP9qL0xT7mN2bV8cR5wY1')); assert.ok(!looksRandom('w-shaunns-workspace-LBrRNoz')); assert.ok(!looksRandom('9818342388208988'));
  assert.ok(looksLikeCard('4111-1111-1111-1111')); assert.ok(!looksLikeCard('9818342388208988'));
});

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-tools-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-tools-')); await fs.rm(root, {recursive: true, force: true}); });
  for (const file of ['agents/validation/references/TOOLS.md', 'memory/START-HERE.md', 'store/EMAIL.md']) {
    await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true}); await fs.writeFile(path.join(root, file), '# Fixture\n');
  }
  return root;
}

test('the store saves tools with revisions and writes resources/TOOLS.md; a refused secret writes nothing', async t => {
  const root = await workspace(t); const store = createStore({workspaceRoot: root});
  assert.deepEqual(await store.getTools(), {revision: 0, tools: [], counts: toolCounts([])});
  let saved = await store.saveTool({revision: 0, ...kalodata});
  assert.equal(saved.saved, 'kalodata'); assert.equal(saved.revision, 1);
  saved = await store.saveTool({revision: 1, ...zoho});
  const doc = await fs.readFile(path.join(root, 'resources/TOOLS.md'), 'utf8');
  assert.match(doc, /No passwords here/); assert.match(doc, /\*\*Kalodata\*\* \(`kalodata`\)/); assert.match(doc, /## Email/);
  const before = await fs.readFile(path.join(root, 'os/data/tools.json'), 'utf8');
  await assert.rejects(store.saveTool({revision: 2, id: 'kalodata', signIn: 'password: hunter2'}), error => error.code === 'SECRET_REFUSED');
  await assert.rejects(store.saveTool({revision: 2, ...openrouter, id: 'openrouter-2', source: 'memory/MISSING.md'}), error => error.code === 'EVIDENCE_NOT_FOUND');
  assert.equal(await fs.readFile(path.join(root, 'os/data/tools.json'), 'utf8'), before);
  assert.doesNotMatch(await fs.readFile(path.join(root, 'resources/TOOLS.md'), 'utf8'), /hunter2/);
  await assert.rejects(store.saveTool({revision: 1, id: 'kalodata', limits: 'stale'}), error => error.status === 409);
  saved = await store.saveTool({revision: 2, id: 'kalodata', signedInNoted: '2026-10-01'});
  assert.equal(saved.tools.find(tool => tool.id === 'kalodata').signedInNoted, '2026-10-01');
  await fs.writeFile(path.join(root, 'os/data/tools.json'), '{broken');
  await assert.rejects(store.getTools(), error => error.code === 'MALFORMED_DATA');
});

test('GET and POST /api/tools keep the local Origin guard and return the plain refusal', async t => {
  const root = await workspace(t);
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, method = 'GET', data, origin = 'http://localhost:3000') => new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: {Host: 'localhost:3000', ...(origin ? {Origin: origin} : {}), 'Content-Type': 'application/json'}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    req.on('error', reject); req.end(data === undefined ? undefined : JSON.stringify(data));
  });
  assert.equal((await request('/api/tools')).data.revision, 0);
  assert.equal((await request('/api/tools', 'POST', {revision: 0, ...kalodata}, 'https://outside.example')).status, 403);
  assert.equal((await request('/api/tools', 'POST', {revision: 0, ...kalodata}, null)).status, 403);
  const refused = await request('/api/tools', 'POST', {revision: 0, ...kalodata, signIn: 'Password: hunter2'});
  assert.equal(refused.status, 400); assert.equal(refused.data.code, 'SECRET_REFUSED'); assert.equal(refused.data.error, SECRET_MESSAGE); assert.doesNotMatch(JSON.stringify(refused.data), /hunter2/);
  const created = await request('/api/tools', 'POST', {revision: 0, ...kalodata});
  assert.equal(created.status, 200); assert.equal(created.data.tools.length, 1); assert.equal(created.data.counts.byStep.product, 1); assert.equal(created.data.counts.byStep.prove, 1);
  assert.equal((await request('/api/tools', 'DELETE')).status, 404);
});

test('briefs list the tools for the current step, one compact line each, the reader\'s own first', () => {
  let registry = emptyTools();
  const extra = n => ({id: `finder-${n}`, name: `Finder ${n}`, group: 'research', url: `https://finder${n}.example.com/`, opensIn: 'chrome', steps: ['discovery'], agents: [], purpose: 'Find products.'});
  for (const tool of [kalodata, openrouter, zoho, trendtrack, metaAds, osTool, pipiads, extra(1), extra(2), extra(3), extra(4)]) registry = add(registry, tool);
  registry = updateTools(registry, {revision: registry.revision, id: 'finder-4', retired: true}, now);
  // The step a brief is about: Step 1 · Product (no cards are needed to test the tools list).
  const find = {...currentStep({leads: []}), index: 0, number: 1, id: 'product', name: 'Product'};
  const block = stepToolsMarkdown(registry.tools, find, 'scout');
  assert.match(block, /^## Tools for Step 1 · Product\n\n- Kalodata · https:\/\/www\.kalodata\.com\/product · Browser\n- Finder 1 · /);
  assert.doesNotMatch(block, /Merrivy OS|Finder 4|Zoho|OpenRouter/, 'the OS itself, retired tools and other steps are left out');
  assert.doesNotMatch(block, /Pipiads|Luxury/, 'agents cannot use Luxury-app tools, so briefs never offer them');
  assert.equal(block.match(/^- (?!…)/gm).length, 4); assert.doesNotMatch(block, /…and/, 'four tools fit');
  assert.match(block, /No passwords: on a sign-in wall, stop and ask the owner/);
  // The reader's own tools first; more than six end with a pointer.
  for (const n of [5, 6, 7]) registry = add(registry, extra(n));
  const longer = stepToolsMarkdown(registry.tools, find, 'copywriter');
  assert.equal(longer.match(/^- (?!…)/gm).length, BRIEF_TOOL_LIMIT); assert.match(longer, /- …and 1 more: `os\.mjs tools --step product`/);
  // An optional cross-check goes after the method's own tools and says so.
  const optional = updateTools(registry, {revision: registry.revision, id: 'kalodata', optional: true}, now);
  assert.doesNotMatch(stepToolsMarkdown(optional.tools, find, 'scout'), /Kalodata/, 'the optional tool falls past the six shown');
  const few = stepToolsMarkdown(optional.tools.filter(tool => !/^finder-[4-7]$/.test(tool.id)), find, 'scout');
  assert.match(few, /^## Tools for Step 1 · Product\n\n- Finder 1 · /);
  assert.match(few, /- Finder 3 · [^\n]+\n- Kalodata \(optional cross-check\) · https:\/\/www\.kalodata\.com\/product · Browser\n/);
  assert.throws(() => updateTools(registry, {revision: registry.revision, id: 'kalodata', optional: 'yes'}, now), /Optional must be true or false/);
  const state = {handoff: {summary: 'Find step.', nextAction: 'Curate.', blockers: ''}};
  const brief = agentBrief({state, planner: {tasks: []}, lessons: emptyLessons(), agent: 'scout', name: 'Product scout', step: find, tools: registry.tools});
  assert.match(brief.markdown, /## The pipeline · no round yet[\s\S]*## Your step: Step 1 of 7 · Product[\s\S]*## Tools for Step 1 · Product[\s\S]*## Now/);
  assert.ok(brief.toolWords > 0 && brief.toolWords <= 90, `the tools block stays small (${brief.toolWords} words)`);
  assert.doesNotMatch(agentBrief({state, planner: {tasks: []}, lessons: emptyLessons(), agent: 'scout', step: find}).markdown, /## Tools for/, 'no tool list given, no section');
  assert.match(stepToolsMarkdown(null, find), /tool list needs repair/);
});

test('START-HERE lists the step\'s tools, follows tool changes and survives a broken tool list', async t => {
  const root = await workspace(t);
  const store = createStore({workspaceRoot: root});
  // Nothing on the line: START-HERE is on Step 1 · Product and lists that step's tools.
  let saved = await store.saveTool({revision: 0, ...kalodata, steps: ['issue', 'discovery']});
  let startHere = await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8');
  assert.match(startHere, /tools revision 1[.;]/); assert.match(startHere, /## Tools for Step 1 · Product\n\n- Kalodata · https:\/\/www\.kalodata\.com\/product · Browser/);
  saved = await store.saveTool({revision: saved.revision, ...pipiads});
  startHere = await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8');
  assert.match(startHere, /tools revision 2[.;]/); assert.doesNotMatch(startHere, /- Pipiads/, 'a Luxury-app tool is never offered for a step');
  saved = await store.saveTool({revision: saved.revision, id: 'kalodata', optional: true});
  saved = await store.saveTool({revision: saved.revision, id: 'meta-ad-library', name: 'Meta Ad Library', group: 'research', url: 'https://www.facebook.com/ads/library', opensIn: 'chrome', steps: ['issue', 'product'], agents: ['scout'], purpose: 'Find products stable or rising on Meta.'});
  startHere = await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8');
  assert.match(startHere, /tools revision 4[.;]/); assert.match(startHere, /## Tools for Step 1 · Product\n\n- Meta Ad Library · https:\/\/www\.facebook\.com\/ads\/library · Browser\n- Kalodata \(optional cross-check\) · /);
  assert.match((await store.getBrief('manager')).markdown, /## Tools for Step 1 · Product\n\n- Meta Ad Library/);
  await fs.writeFile(path.join(root, 'os/data/tools.json'), '{broken');
  await store.savePlannerTask({revision: 0, title: 'Still saves', assignee: 'owner'});
  assert.match(await fs.readFile(path.join(root, 'memory/START-HERE.md'), 'utf8'), /tool list needs repair/);
  assert.match((await store.getBrief('manager')).markdown, /tool list needs repair/);
});
