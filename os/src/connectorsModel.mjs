// Connectors: how our subagents reach the apps we use. Pure, shared by the server
// (server/connectors.mjs) and the Connectors page; tested in server/connectors.test.mjs.
// The owner, Nov 5: the agents work in "our in-browser ... it allows you to sign in once
// only and then it lives in that browser as your google chrome profile basically." So a
// connector is, by default, a site signed in once in the agent browser (its own Chrome
// profile). An MCP server is still possible (how: 'mcp'), read from the Claude Code config
// by name only. The list lives in os/data/connectors.json. Nothing here signs in or starts
// agent work: the owner signs in, and work is given in chat.
import {secretProblem} from './toolsModel.mjs';

export const CONNECTOR_GROUPS = [['ads', 'Ads & Meta'], ['store', 'Store & Shopify'], ['research', 'Product research'], ['buyers', 'Buyer research'], ['sourcing', 'Sourcing'], ['creative', 'Creatives'], ['built-in', 'How agents drive it']];
export const CONNECTOR_KINDS = {official: 'Official site', community: 'Community', vendor: 'Third party', 'built-in': 'Built in'};
export const CONNECTOR_PLANS = ['next', 'planned', 'idea', 'built-in'];
/** How a connector reaches its app: a signed-in tab in the agent browser (the default), an MCP server, or built in. */
export const CONNECTOR_HOWS = ['browser', 'mcp', 'built-in'];
/** Where a connector is used, by the sidebar's step names, and the page each opens. */
export const CONNECTOR_STEPS = {product: ['Product', 'find'], verify: ['Verify', 'verify'], store: ['Store', 'build'], creatives: ['Creatives', 'create'], checklist: ['Checklist', 'checklist'], launch: ['Launch', 'launch'], manage: ['Manage', 'manage']};
/** The owner's rules for the agent browser and every connector (AGENTS.md, Connectors). */
export const CONNECTOR_RULES = [
  {id: 'profile', title: 'Its own Chrome', line: 'The agent browser is a separate Chrome profile. Your personal Chrome stays yours.'},
  {id: 'you', title: 'You sign in once', line: 'You do every sign-in and password. Launchroom checks it and turns the connection on.'},
  {id: 'full', title: 'Full control', line: 'Agents can do the whole job in a signed-in site. Never read-only.'},
  {id: 'spend', title: 'Money waits for you', line: 'Spend, budgets, publishing, orders, payments and messages wait for your yes in chat.'},
  {id: 'yours', title: 'Your accounts only', line: 'Meta works in ad account 9818342388208988, never your brother’s.'},
  {id: 'one', title: 'One at a time', line: 'Sign in one site, test it on real work with one subagent, then the next.'},
];

const FIELDS = ['id', 'name', 'provider', 'how', 'url', 'group', 'kind', 'plan', 'order', 'line', 'does', 'agents', 'steps', 'where', 'signIn', 'cost', 'setup', 'watch', 'source', 'signedInNoted', 'check', 'checkedAt', 'signedInBy'];
const GROUP_IDS = new Set(CONNECTOR_GROUPS.map(([id]) => id));
const isText = value => typeof value === 'string';
const textList = value => Array.isArray(value) && value.every(isText);

/** One connector's problem in plain words, or ''. */
export function connectorProblem(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'A connector must be an object.';
  const extra = Object.keys(entry).filter(key => !FIELDS.includes(key));
  if (extra.length) return `Unknown field: ${extra.join(', ')}.`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id || '')) return 'The id must be lowercase words joined by dashes.';
  for (const key of ['name', 'provider', 'url', 'line', 'where', 'signIn', 'cost', 'watch', 'source', 'signedInNoted']) if (!isText(entry[key])) return `${key} must be text.`;
  if (!entry.name.trim() || !entry.line.trim()) return 'A connector needs a name and a line.';
  if (!CONNECTOR_HOWS.includes(entry.how)) return `Unknown way to connect: ${entry.how}.`;
  if (entry.url && !/^https:\/\//.test(entry.url)) return 'url must be an https link.';
  if (entry.how === 'browser' && !entry.url) return 'A browser connector needs the link to sign in at.';
  if (!GROUP_IDS.has(entry.group)) return `Unknown group: ${entry.group}.`;
  if (!CONNECTOR_KINDS[entry.kind]) return `Unknown kind: ${entry.kind}.`;
  if (!CONNECTOR_PLANS.includes(entry.plan)) return `Unknown plan: ${entry.plan}.`;
  if (!Number.isInteger(entry.order) || entry.order < 0) return 'order must be a whole number, 0 or more.';
  if (!textList(entry.does) || !textList(entry.agents) || !textList(entry.steps)) return 'does, agents and steps must be lists of text.';
  if (entry.steps.some(step => !CONNECTOR_STEPS[step])) return `Unknown step in ${entry.steps.join(', ')}.`;
  if (!Array.isArray(entry.setup) || entry.setup.some(step => !step || !['owner', 'claude'].includes(step.who) || !isText(step.text))) return 'Each setup step needs who (owner or claude) and text.';
  if (entry.source && !/^https:\/\//.test(entry.source)) return 'source must be an https link.';
  if (entry.signedInNoted && !/^\d{4}-\d{2}-\d{2}/.test(entry.signedInNoted)) return 'signedInNoted must be a date.';
  if (entry.check !== undefined) {
    if (!entry.check || typeof entry.check !== 'object' || !/^https:\/\//.test(entry.check.url || '') || !textList(entry.check.signedOut) || !entry.check.signedOut.length) return 'check needs an https url and the signedOut places a signed-out visit lands on.';
  }
  if (entry.checkedAt !== undefined && entry.checkedAt !== '' && Number.isNaN(Date.parse(entry.checkedAt))) return 'checkedAt must be a time.';
  if (entry.signedInBy !== undefined && !['', 'check', 'owner'].includes(entry.signedInBy)) return 'signedInBy is check or owner.';
  const words = [entry.name, entry.provider, entry.url, entry.line, entry.where, entry.signIn, entry.cost, entry.watch, entry.source, ...entry.does, ...entry.setup.map(step => step.text)];
  for (const value of words) {const problem = secretProblem(value); if (problem) return problem;}
  return '';
}

/** The saved list, cleaned: good connectors, plus a problem line for each one left out. */
export function cleanCatalog(record) {
  const list = Array.isArray(record?.connectors) ? record.connectors : [];
  const seen = new Set(), connectors = [], problems = [];
  for (const entry of list) {
    const problem = connectorProblem(entry) || (seen.has(entry.id) ? 'This id is used twice.' : '');
    if (problem) {problems.push(`${entry?.id || 'A connector'}: ${problem}`); continue;}
    seen.add(entry.id); connectors.push(entry);
  }
  return {revision: Number.isInteger(record?.revision) ? record.revision : 0, connectors, problems};
}

/** Server names in an MCP config object ({mcpServers: {name: {...}}}); never their settings. */
export function serverNames(config) {
  const servers = config && typeof config === 'object' ? config.mcpServers : null;
  return servers && typeof servers === 'object' && !Array.isArray(servers) ? Object.keys(servers).filter(name => /^[\w.-]{1,80}$/.test(name)) : [];
}

/**
 * The MCP servers a subagent file lists in its front matter (`mcpServers:` as a YAML
 * list of names or of `name:` inline definitions). Only names come back.
 */
export function agentServerNames(markdown) {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(markdown || ''));
  if (!head) return [];
  const lines = head[1].split(/\r?\n/), names = [];
  const start = lines.findIndex(line => /^mcpServers\s*:/.test(line));
  if (start < 0) return [];
  const inline = /^mcpServers\s*:\s*\[(.*)\]\s*$/.exec(lines[start]);
  if (inline) return inline[1].split(',').map(name => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const item = /^\s*-\s*["']?([\w.-]+)["']?\s*(:)?/.exec(line);
    if (item) names.push(item[1]);
  }
  return [...new Set(names)];
}

/** A connector's status: built in; a browser site by its saved sign-in; an MCP server by the real config. */
export function connectorStatus(connector, {configured = []} = {}) {
  if (connector.plan === 'built-in' || connector.how === 'built-in') return {id: 'built-in', label: 'Built in', tone: 'done'};
  if (connector.how === 'mcp' && configured.some(server => server.name === connector.id)) {
    const needsSignIn = !/^none$/i.test(connector.signIn.trim()) && !connector.signedInNoted;
    return needsSignIn ? {id: 'sign-in', label: 'Added · needs sign-in', tone: 'owner'} : {id: 'connected', label: 'Connected', tone: 'done'};
  }
  if (connector.how === 'browser' && connector.signedInNoted) return {id: 'connected', label: connector.signedInBy === 'check' ? 'Connected' : 'Signed in', tone: 'done'};
  if (connector.how === 'browser' && connector.checkedAt && connector.check) return {id: connector.plan === 'next' ? 'next' : 'signed-out', label: 'Not signed in yet', tone: connector.plan === 'next' ? 'accent' : 'owner'};
  if (connector.plan === 'next') return {id: 'next', label: 'Sign in next', tone: 'accent'};
  if (connector.plan === 'planned') return {id: 'planned', label: 'Not signed in', tone: 'plain'};
  return {id: 'idea', label: 'Later', tone: 'muted'};
}

/**
 * The record with one browser connector marked signed in (that day) or not. A plain date
 * is all that is saved, the same as the Tools page; nothing about the login itself.
 */
export function markSignedIn(record, id, signedIn, day) {
  const list = Array.isArray(record?.connectors) ? record.connectors : [];
  const target = list.find(item => item.id === id);
  if (!target) throw Object.assign(new Error('Unknown connector.'), {status: 404});
  if (target.how !== 'browser') throw Object.assign(new Error('Only a site in the agent browser is marked signed in here.'), {status: 400});
  if (signedIn && !/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw Object.assign(new Error('A date is needed.'), {status: 400});
  return {...record, revision: (record.revision || 0) + 1, connectors: list.map(item => item.id === id ? {...item, signedInNoted: signedIn ? day : '', signedInBy: signedIn ? 'owner' : ''} : item)};
}

const UNSURE = /captcha|challenge|checkpoint|verif|robot|blocked/i;
const baseDomain = host => String(host || '').toLowerCase().replace(/^www\./, '').split('.').slice(-2).join('.');
/**
 * What a check visit tells us (owner, Nov 5: "Once you sign in, the agent verifies and
 * turns on that connection"). The agent browser opens the site's check page; a signed-out
 * visit lands on its sign-in page. Only where the tab ended up is read, never cookies or
 * the page itself. 'in', 'out', or 'unknown' (a CAPTCHA, a timeout, another site).
 */
export function checkVerdict(finalUrl, check) {
  let url, start;
  try {url = new URL(finalUrl); start = new URL(check?.url);} catch {return 'unknown';}
  const place = `${url.host}${url.pathname}`.toLowerCase();
  if (UNSURE.test(place)) return 'unknown';
  if ((check.signedOut || []).some(pattern => place.includes(String(pattern).toLowerCase()))) return 'out';
  if (/^(about|chrome|data):/.test(url.protocol)) return 'unknown';
  return baseDomain(url.host) === baseDomain(start.host) ? 'in' : 'unknown';
}

/**
 * The record after a round of checks: 'in' turns the connection on (today, by the check),
 * 'out' turns it off, 'unknown' only notes the time and keeps what was there.
 */
export function applyChecks(record, results = [], now = new Date()) {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const byId = new Map(results.map(result => [result.id, result.verdict]));
  const list = Array.isArray(record?.connectors) ? record.connectors : [];
  return {...record, revision: (record.revision || 0) + 1, connectors: list.map(item => {
    const verdict = byId.get(item.id);
    if (!verdict) return item;
    if (verdict === 'in') return {...item, signedInNoted: day, signedInBy: 'check', checkedAt: now.toISOString()};
    if (verdict === 'out') return {...item, signedInNoted: '', signedInBy: '', checkedAt: now.toISOString()};
    return {...item, checkedAt: now.toISOString()};
  })};
}

/** The sites a check can verify by itself. */
export function checkableSites(list = [], ids = []) {
  const want = new Set((Array.isArray(ids) ? ids : []).filter(Boolean));
  return list.filter(item => item.how === 'browser' && item.check && (!want.size || want.has(item.id)));
}

/** Every connector with its status, and (for an MCP server) the subagents that don't list it yet. */
export function decorateConnectors(connectors = [], {configured = [], agentServers = {}} = {}) {
  return connectors.map(connector => {
    const status = connectorStatus(connector, {configured});
    const added = connector.how === 'mcp' && ['sign-in', 'connected'].includes(status.id);
    const missingOn = added ? connector.agents.filter(id => !(agentServers[id] || []).includes(connector.id)) : [];
    return {...connector, status, missingOn};
  });
}

const hostOf = value => {try {return new URL(value).host.replace(/^www\./, '');} catch {return '';}};

/**
 * What one tap on Connect opens in the agent browser (owner, Nov 5: "Connect can connect
 * everything. It should even be able to just open up, straight up open Gemini"): every
 * site already signed in, plus Gemini, the deep research agent; with nothing signed in yet,
 * the next site to sign in too. Sites already open in a tab are left alone.
 */
export function connectPlan(list = [], tabs = []) {
  const open = new Set((Array.isArray(tabs) ? tabs : []).map(tab => tab.host).filter(Boolean));
  const sites = list.filter(item => item.how === 'browser' && item.group !== 'built-in');
  const signed = sites.filter(item => item.status?.id === 'connected');
  const pick = [...signed, ...sites.filter(item => item.id === 'gemini')];
  if (!signed.length) {const next = connectionQueue(list).find(item => item.how === 'browser' && item.status?.id !== 'connected'); if (next) pick.push(next);}
  const seen = new Set();
  return pick.filter(item => {const host = hostOf(item.url); if (!host || open.has(host) || seen.has(host)) return false; seen.add(host); return true;});
}

/** The one word the sidebar shows: connected (green) once the agent browser is running. */
export function connectState(browser, list = []) {
  const sites = list.filter(item => item.how === 'browser');
  const signedIn = sites.filter(item => item.status?.id === 'connected').length;
  if (!browser) return {id: 'unknown', label: 'Connect', line: 'Start here', signedIn, sites: sites.length};
  if (browser.error) return {id: 'remote', label: 'Connect', line: 'On the home computer', signedIn, sites: sites.length};
  if (!browser.running) return {id: 'off', label: 'Not connected', line: 'Start the agent browser', signedIn, sites: sites.length};
  return {id: 'on', label: 'Connected', line: `${signedIn} of ${sites.length} sites signed in`, signedIn, sites: sites.length};
}

/** How many connectors are in each state. */
export function connectorCounts(list = []) {
  const count = id => list.filter(item => item.status?.id === id).length;
  return {connected: count('connected'), signIn: count('sign-in'), next: count('next'), planned: count('planned'), idea: count('idea'), builtIn: count('built-in')};
}

/** The sign-in order: everything we plan to connect, first to last. */
export function connectionQueue(list = []) {
  return list.filter(item => item.order > 0).sort((a, b) => a.order - b.order);
}

/** Connectors in their groups, filtered by group and words. */
export function groupConnectors(list = [], {group = '', query = ''} = {}) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const hit = item => words.every(word => [item.name, item.provider, item.line, ...item.does, ...item.agents].join(' ').toLowerCase().includes(word));
  return CONNECTOR_GROUPS.filter(([id]) => !group || id === group)
    .map(([id, label]) => ({id, label, items: list.filter(item => item.group === id && hit(item)).sort((a, b) => (a.order || 99) - (b.order || 99))}))
    .filter(entry => entry.items.length);
}

/** One subagent's connectors, in sign-in order, built-in ones last. */
export function agentConnectors(agentId, list = []) {
  return list.filter(item => item.agents.includes(agentId)).sort((a, b) => (a.order || 99) - (b.order || 99));
}

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Job report events that start a line with a connector's id and a colon, the way agents
 * log what they changed ("meta-ads-manager: daily budget $50 -> $75"), newest first.
 * A site's plain name alone appears in plenty of older work, so it doesn't count.
 */
export function connectorActivity(activity = [], list = [], limit = 30) {
  const named = list.filter(item => item.plan !== 'built-in').map(item => ({item, pattern: new RegExp(`(^|[^\\w-])${escape(item.id)}\\s*:`, 'i')}));
  const rows = [];
  for (const report of Array.isArray(activity) ? activity : []) {
    for (const event of Array.isArray(report.events) ? report.events : []) {
      const match = named.find(({pattern}) => pattern.test(event.text || ''));
      if (match) rows.push({connector: match.item, report, text: event.text, at: event.at});
    }
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}
