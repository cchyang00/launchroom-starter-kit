import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {agentConnectors, agentServerNames, applyChecks, checkVerdict, checkableSites, cleanCatalog, connectPlan, connectState, connectionQueue, connectorActivity, connectorCounts, connectorProblem, connectorStatus, decorateConnectors, groupConnectors, markSignedIn, serverNames} from '../src/connectorsModel.mjs';
import {checkConnectors, readConnectors, saveSignedIn} from './connectors.mjs';

const base = (over = {}) => ({id: 'meta-ads-manager', name: 'Meta', provider: 'Ads Manager', how: 'browser', url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=9818342388208988', group: 'ads', kind: 'official', plan: 'next', order: 1, line: 'Our campaigns.', does: ['Reads numbers'], agents: ['ad-manager'], steps: ['launch'], where: 'A tab in the agent browser', signIn: 'Your Facebook login', cost: 'Free', setup: [{who: 'owner', text: 'Sign in'}], watch: '', source: '', signedInNoted: '', ...over});
const mcp = (over = {}) => base({id: 'meta-ads', how: 'mcp', url: '', ...over});

test('the real connector list is clean', async () => {
  const record = JSON.parse(await readFile(new URL('../data/connectors.json', import.meta.url), 'utf8'));
  const clean = cleanCatalog(record);
  assert.deepEqual(clean.problems, []);
  assert.equal(clean.connectors.length, record.connectors.length);
  assert.equal(clean.connectors.filter(item => item.plan === 'next').length, 1, 'exactly one site is next');
  assert.ok(clean.connectors.some(item => item.id === 'meta-ads-manager' && item.how === 'browser'));
  assert.ok(clean.connectors.some(item => item.id === 'shopify-admin' && item.how === 'browser'));
});

test('a connector refuses unknown fields, bad ids, missing links and anything that looks like a key', () => {
  assert.equal(connectorProblem(base()), '');
  assert.match(connectorProblem(base({token: 'x'})), /Unknown field/);
  assert.match(connectorProblem(base({id: 'Meta Ads'})), /lowercase/);
  assert.match(connectorProblem(base({how: 'magic'})), /way to connect/);
  assert.match(connectorProblem(base({url: ''})), /link to sign in/);
  assert.match(connectorProblem(base({url: 'http://example.com'})), /https/);
  assert.match(connectorProblem(base({steps: ['learn']})), /Unknown step/);
  assert.match(connectorProblem(base({setup: [{who: 'agent', text: 'x'}]})), /who/);
  assert.notEqual(connectorProblem(base({url: 'https://mcp.example.com/?access_token=abc123def456ghi789jkl'})), '');
  assert.notEqual(connectorProblem(base({line: 'key sk-live-4f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c'})), '');
});

test('cleanCatalog drops bad and repeated connectors with a reason', () => {
  const clean = cleanCatalog({revision: 3, connectors: [base(), base(), base({id: 'x', group: 'nope'})]});
  assert.equal(clean.connectors.length, 1);
  assert.equal(clean.problems.length, 2);
});

test('server names come from the config, never their settings', () => {
  assert.deepEqual(serverNames({mcpServers: {'meta-ads': {headers: {Authorization: 'secret'}}, apify: {}}}), ['meta-ads', 'apify']);
  assert.deepEqual(serverNames({}), []);
  assert.deepEqual(serverNames(null), []);
});

test('a subagent file lists its servers by name, inline definitions included', () => {
  const md = '---\nname: ad-manager\nmcpServers:\n  - meta-ads\n  - playwright:\n      type: stdio\n      command: npx\nmodel: opus\n---\nBody\n  - not-a-server';
  assert.deepEqual(agentServerNames(md), ['meta-ads', 'playwright']);
  assert.deepEqual(agentServerNames('---\nname: x\nmcpServers: [apify, "shopify-dev"]\n---\n'), ['apify', 'shopify-dev']);
  assert.deepEqual(agentServerNames('---\nname: x\n---\n'), []);
  assert.deepEqual(agentServerNames('no front matter'), []);
});

test('a browser site is signed in by its saved date; an MCP server by the real config', () => {
  assert.equal(connectorStatus(base()).id, 'next');
  assert.equal(connectorStatus(base({plan: 'planned'})).label, 'Not signed in');
  assert.equal(connectorStatus(base({plan: 'idea'})).id, 'idea');
  assert.equal(connectorStatus(base({signedInNoted: '2026-11-06'})).label, 'Signed in');
  assert.equal(connectorStatus(base({how: 'built-in', plan: 'built-in', url: ''})).id, 'built-in');
  const configured = [{name: 'meta-ads', scope: 'project'}];
  assert.equal(connectorStatus(mcp()).id, 'next');
  assert.equal(connectorStatus(mcp(), {configured}).id, 'sign-in');
  assert.equal(connectorStatus(mcp({signedInNoted: '2026-11-06'}), {configured}).id, 'connected');
  assert.equal(connectorStatus(mcp({signIn: 'None'}), {configured}).id, 'connected');
});

test('marking signed in saves only a date and only for a browser site', () => {
  const record = {revision: 4, connectors: [base(), mcp()]};
  const next = markSignedIn(record, 'meta-ads-manager', true, '2026-11-06');
  assert.equal(next.revision, 5);
  assert.equal(next.connectors[0].signedInNoted, '2026-11-06');
  assert.equal(markSignedIn(next, 'meta-ads-manager', false).connectors[0].signedInNoted, '');
  assert.throws(() => markSignedIn(record, 'meta-ads', true, '2026-11-06'), /agent browser/);
  assert.throws(() => markSignedIn(record, 'nope', true, '2026-11-06'), /Unknown/);
});

test('an added MCP server names the subagents that do not list it yet', () => {
  const [item] = decorateConnectors([mcp({agents: ['ad-manager', 'store-builder']})], {configured: [{name: 'meta-ads'}], agentServers: {'ad-manager': ['meta-ads']}});
  assert.deepEqual(item.missingOn, ['store-builder']);
  const [site] = decorateConnectors([base()], {});
  assert.deepEqual(site.missingOn, []);
});

test('counts, queue, groups and a subagent’s connectors', () => {
  const list = decorateConnectors([base(), base({id: 'kalodata', name: 'Kalodata', group: 'research', plan: 'planned', order: 2, agents: ['scout']}), base({id: 'claude-in-chrome', name: 'Claude in Chrome', how: 'built-in', url: '', group: 'built-in', kind: 'built-in', plan: 'built-in', order: 0})]);
  assert.deepEqual(connectorCounts(list), {connected: 0, signIn: 0, next: 1, planned: 1, idea: 0, builtIn: 1});
  assert.deepEqual(connectionQueue(list).map(item => item.id), ['meta-ads-manager', 'kalodata']);
  assert.deepEqual(groupConnectors(list).map(group => group.id), ['ads', 'research', 'built-in']);
  assert.deepEqual(groupConnectors(list, {query: 'kalodata'}).map(group => group.items.map(item => item.id)), [['kalodata']]);
  assert.deepEqual(groupConnectors(list, {group: 'ads'}).map(group => group.id), ['ads']);
  assert.deepEqual(agentConnectors('scout', list).map(item => item.id), ['kalodata']);
});

test('activity counts only lines that start with a connector id and a colon', () => {
  const list = decorateConnectors([base(), base({id: 'kalodata', name: 'Kalodata', plan: 'planned', order: 2})]);
  const activity = [{id: 'r1', events: [
    {at: '2026-11-06T10:00:00Z', text: 'meta-ads-manager: daily budget $50 -> $75 on CBO 123'},
    {at: '2026-11-06T09:00:00Z', text: 'Checked Meta Ads Manager by hand'},
    {at: '2026-11-06T08:00:00Z', text: 'Mined kalodata for heated vests'},
    {at: '2026-11-06T11:00:00Z', text: 'kalodata: searched "posture brace", 100 rows'},
  ]}];
  const rows = connectorActivity(activity, list);
  assert.deepEqual(rows.map(row => row.connector.id), ['kalodata', 'meta-ads-manager']);
});

test('Connect opens the signed-in sites and Gemini, never a tab that is already open', () => {
  const list = decorateConnectors([
    base({id: 'claude-in-chrome', name: 'Claude in Chrome', url: 'https://claude.ai', group: 'built-in', plan: 'next', order: 1}),
    base({plan: 'planned', order: 2}),
    base({id: 'shopify-admin', name: 'Shopify', url: 'https://admin.shopify.com/store/x', group: 'store', plan: 'planned', order: 3, signedInNoted: '2026-11-06'}),
    base({id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', group: 'research', plan: 'planned', order: 4}),
  ]);
  assert.deepEqual(connectPlan(list, []).map(item => item.id), ['shopify-admin', 'gemini']);
  assert.deepEqual(connectPlan(list, [{host: 'gemini.google.com'}]).map(item => item.id), ['shopify-admin']);
  const fresh = decorateConnectors([base({plan: 'planned', order: 2}), base({id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', group: 'research', plan: 'planned', order: 3})]);
  assert.deepEqual(connectPlan(fresh, []).map(item => item.id), ['gemini', 'meta-ads-manager'], 'with nothing signed in, the next site opens too');
});

test('the sidebar says Connected only while the agent browser runs', () => {
  const list = decorateConnectors([base({signedInNoted: '2026-11-06'}), base({id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', plan: 'planned', order: 2})]);
  assert.equal(connectState({running: true, tabs: []}, list).label, 'Connected');
  assert.equal(connectState({running: true, tabs: []}, list).line, '1 of 2 sites signed in');
  assert.equal(connectState({running: false}, list).label, 'Not connected');
  assert.equal(connectState({error: 'remote'}, list).id, 'remote');
  assert.equal(connectState(null, list).id, 'unknown');
});

test('a check visit judges only where the tab landed', () => {
  const meta = {url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1', signedOut: ['/login', 'loginpage']};
  assert.equal(checkVerdict('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1', meta), 'in');
  assert.equal(checkVerdict('https://www.facebook.com/login/?next=https%3A%2F%2Fadsmanager', meta), 'out');
  assert.equal(checkVerdict('https://www.facebook.com/checkpoint/block', meta), 'unknown', 'a checkpoint is never a yes or a no');
  assert.equal(checkVerdict('https://www.amazon.com/errors/validateCaptcha', {url: 'https://www.amazon.com/gp/css/homepage.html', signedOut: ['/ap/signin']}), 'unknown');
  assert.equal(checkVerdict('https://accounts.google.com/v3/signin/identifier', {url: 'https://myaccount.google.com/', signedOut: ['accounts.google.com']}), 'out');
  assert.equal(checkVerdict('https://myaccount.google.com/', {url: 'https://myaccount.google.com/', signedOut: ['accounts.google.com']}), 'in');
  assert.equal(checkVerdict('https://elsewhere.example/', meta), 'unknown');
  assert.equal(checkVerdict('', meta), 'unknown');
});

test('checks turn a connection on or off, and an unsure check keeps what was there', () => {
  const record = {revision: 2, connectors: [base({check: {url: 'https://a.com/', signedOut: ['/login']}}), base({id: 'kalodata', signedInNoted: '2026-11-01', signedInBy: 'owner'}), base({id: 'amazon', signedInNoted: '2026-11-01', signedInBy: 'check'})]};
  const now = new Date('2026-11-06T10:00:00');
  const next = applyChecks(record, [{id: 'meta-ads-manager', verdict: 'in'}, {id: 'kalodata', verdict: 'unknown'}, {id: 'amazon', verdict: 'out'}], now);
  assert.equal(next.revision, 3);
  assert.equal(next.connectors[0].signedInNoted, '2026-11-06');
  assert.equal(next.connectors[0].signedInBy, 'check');
  assert.equal(next.connectors[1].signedInNoted, '2026-11-01');
  assert.equal(next.connectors[2].signedInNoted, '');
  const [checked] = decorateConnectors([next.connectors[0]]);
  assert.equal(checked.status.label, 'Connected');
  const [out] = decorateConnectors([{...next.connectors[2], plan: 'planned', check: {url: 'https://a.com/', signedOut: ['/login']}}]);
  assert.equal(out.status.label, 'Not signed in yet');
  assert.deepEqual(checkableSites(decorateConnectors(next.connectors)).map(item => item.id), ['meta-ads-manager']);
});

test('checkConnectors visits each site, writes once, and needs the browser on', async () => {
  const root = await workspace();
  const check = signedOut => ({url: 'https://x.example/', signedOut});
  await writeFile(path.join(root, 'os', 'data', 'connectors.json'), JSON.stringify({revision: 1, connectors: [base({check: check(['/login'])}), base({id: 'amazon', name: 'Amazon', check: check(['/ap/signin']), plan: 'planned', order: 2})]}));
  const landed = {'meta-ads-manager': 'https://x.example/home', amazon: 'https://x.example/ap/signin?return=1'};
  let current = '';
  const browser = {visit: async url => landed[current]};
  const ids = ['meta-ads-manager', 'amazon'];
  const results = [];
  for (const id of ids) {current = id; results.push(await checkConnectors(root, {visit: async () => landed[id]}, {ids: [id]}));}
  const last = results.at(-1);
  assert.equal(last.connectors.find(item => item.id === 'meta-ads-manager').status.label, 'Connected');
  assert.equal(last.connectors.find(item => item.id === 'amazon').status.label, 'Not signed in yet');
  assert.equal(last.results[0].landed, 'x.example/ap/signin', 'the query never comes back');
  await assert.rejects(checkConnectors(root, {visit: async () => {throw Object.assign(new Error('off'), {code: 'NOT_CONNECTED'});}}), /off/);
  assert.ok(browser);
});

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lr-connectors-'));
  await mkdir(path.join(root, 'os', 'data'), {recursive: true});
  await mkdir(path.join(root, '.claude', 'agents'), {recursive: true});
  return root;
}

test('readConnectors reads names only from every config, plus each subagent’s servers', async () => {
  const root = await workspace();
  await writeFile(path.join(root, 'os', 'data', 'connectors.json'), JSON.stringify({revision: 1, connectors: [mcp(), mcp({id: 'apify', name: 'Apify', plan: 'planned', order: 2, signIn: 'None', agents: ['checker']}), base({order: 3, plan: 'planned'})]}));
  await writeFile(path.join(root, '.mcp.json'), JSON.stringify({mcpServers: {'meta-ads': {type: 'http', url: 'https://mcp.facebook.com/ads', headers: {Authorization: 'Bearer SECRETSECRETSECRET'}}}}));
  const userConfig = path.join(root, 'user.json');
  await writeFile(userConfig, JSON.stringify({mcpServers: {extra: {command: 'x', env: {KEY: 'SECRET'}}}, projects: {[root.replace(/\\/g, '/')]: {mcpServers: {apify: {}}}}}));
  await writeFile(path.join(root, '.claude', 'agents', 'ad-manager.md'), '---\nname: ad-manager\nmcpServers:\n  - meta-ads\n---\n');
  const result = await readConnectors(root, {userConfig});
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.configured.map(server => `${server.name}:${server.scope}`).sort(), ['apify:local', 'extra:user', 'meta-ads:project']);
  assert.deepEqual(result.unlisted.map(server => server.name), ['extra']);
  assert.equal(result.connectors.find(item => item.id === 'meta-ads').status.id, 'sign-in');
  assert.equal(result.connectors.find(item => item.id === 'apify').status.id, 'connected');
  assert.deepEqual(result.connectors.find(item => item.id === 'apify').missingOn, ['checker']);
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
});

test('saveSignedIn writes the date and refuses a stale revision', async () => {
  const root = await workspace();
  await writeFile(path.join(root, 'os', 'data', 'connectors.json'), JSON.stringify({revision: 7, connectors: [base()]}));
  await assert.rejects(saveSignedIn(root, {id: 'meta-ads-manager', signedIn: true, revision: 6}), /changed/);
  const result = await saveSignedIn(root, {id: 'meta-ads-manager', signedIn: true, revision: 7});
  assert.equal(result.revision, 8);
  assert.equal(result.connectors[0].status.label, 'Signed in');
});

test('readConnectors reports a broken list without failing', async () => {
  const root = await workspace();
  await writeFile(path.join(root, 'os', 'data', 'connectors.json'), '{ broken');
  const result = await readConnectors(root, {userConfig: path.join(root, 'none.json')});
  assert.equal(result.connectors.length, 0);
  assert.match(result.problems[0], /could not be read/);
});
