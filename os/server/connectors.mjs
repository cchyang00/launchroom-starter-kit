// Serves the Connectors page (GET /api/connectors). Reads three things, each on its own
// so one broken file is one problem line:
//   - os/data/connectors.json: our list of connectors and the plan (written by the manager);
//   - the Claude Code config: which MCP servers are really added, by NAME only
//     (<root>/.mcp.json, and ~/.claude.json's own and this project's servers). Their
//     commands, headers, environment and keys are never read into the answer;
//   - .claude/agents/*.md: which servers each subagent lists in `mcpServers`.
// It never writes, connects or signs in. LAUNCHROOM_CLAUDE_CONFIG points the user
// config somewhere else (tests).
import {readFile, readdir, rename, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {agentServerNames, applyChecks, checkVerdict, checkableSites, cleanCatalog, decorateConnectors, markSignedIn, serverNames} from '../src/connectorsModel.mjs';

const CATALOG = 'os/data/connectors.json';
const MAX_CONFIG_BYTES = 8 * 1024 * 1024;

async function readJson(file, {limit = MAX_CONFIG_BYTES} = {}) {
  const text = await readFile(file, 'utf8');
  if (text.length > limit) throw new Error('too large to read');
  return JSON.parse(text);
}
const samePath = (a, b) => path.resolve(a).replace(/\\/g, '/').toLowerCase() === path.resolve(b).replace(/\\/g, '/').toLowerCase();

/** Configured MCP server names with where each was found (project, user or local). */
export async function configuredServers(root, {userConfig = process.env.LAUNCHROOM_CLAUDE_CONFIG || path.join(os.homedir(), '.claude.json')} = {}) {
  const found = [], problems = [];
  try {for (const name of serverNames(await readJson(path.join(root, '.mcp.json')))) found.push({name, scope: 'project'});}
  catch (error) {if (error.code !== 'ENOENT') problems.push(`.mcp.json could not be read (${error.message}).`);}
  try {
    const user = await readJson(userConfig);
    for (const name of serverNames(user)) found.push({name, scope: 'user'});
    for (const [key, project] of Object.entries(user?.projects || {})) if (samePath(key, root)) for (const name of serverNames(project)) found.push({name, scope: 'local'});
  } catch (error) {if (error.code !== 'ENOENT') problems.push(`Claude Code's settings could not be read (${error.message}).`);}
  return {servers: found, problems};
}

/** Each subagent's `mcpServers` names, by agent id. */
export async function agentServers(root) {
  const dir = path.join(root, '.claude', 'agents'), out = {};
  let files = [];
  try {files = (await readdir(dir)).filter(name => /^[\w-]+\.md$/.test(name));} catch {return out;}
  for (const file of files) {
    try {out[file.replace(/\.md$/, '')] = agentServerNames(await readFile(path.join(dir, file), 'utf8'));} catch {}
  }
  return out;
}

const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;};
let writing = Promise.resolve();
/**
 * Marks a site in the agent browser signed in (today's date) or not: the owner's tick, the
 * same as the Tools page. Revision-checked, so a stale page can't overwrite a newer list.
 */
export function saveSignedIn(root, {id, signedIn, revision} = {}) {
  const run = writing.then(async () => {
    const file = path.join(root, CATALOG);
    const record = await readJson(file);
    if (!Number.isInteger(revision)) throw Object.assign(new Error('A numeric revision is required.'), {status: 400, code: 'REVISION_REQUIRED'});
    if (revision !== record.revision) throw Object.assign(new Error('The connector list changed. Reload and try again.'), {status: 409, code: 'STALE_REVISION'});
    const next = {...markSignedIn(record, String(id || ''), !!signedIn, today()), updatedAt: new Date().toISOString()};
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`);
    await rename(temp, file);
    return readConnectors(root);
  });
  writing = run.catch(() => {});
  return run;
}

/**
 * Checks sign-ins in the agent browser (owner, Nov 5: "Once you sign in, the agent verifies
 * and turns on that connection"). Each site's check page is visited in a background tab and
 * judged only by where it landed (checkVerdict). The sites are visited first, then the list
 * is written once, under the same lock as the owner's tick, on a fresh read of the file.
 */
export async function checkConnectors(root, browser, {ids = []} = {}) {
  const file = path.join(root, CATALOG);
  const sites = checkableSites(cleanCatalog(await readJson(file)).connectors, ids);
  const results = [];
  for (const site of sites) {
    let verdict = 'unknown', landed = '';
    try {
      const url = await browser.visit(site.check.url);
      try {const at = new URL(url); landed = `${at.host}${at.pathname}`;} catch {}
      verdict = checkVerdict(url, site.check);
    } catch (error) {
      if (error.code === 'NOT_CONNECTED') throw error;
    }
    results.push({id: site.id, name: site.name, verdict, landed});
  }
  const run = writing.then(async () => {
    const record = await readJson(file);
    const next = {...applyChecks(record, results), updatedAt: new Date().toISOString()};
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`);
    await rename(temp, file);
  });
  writing = run.catch(() => {});
  await run;
  return {results, ...(await readConnectors(root))};
}

/** Everything the Connectors page shows. */
export async function readConnectors(root, options = {}) {
  const problems = [];
  let catalog = {revision: 0, connectors: [], problems: []};
  try {catalog = cleanCatalog(await readJson(path.join(root, CATALOG)));}
  catch (error) {problems.push(error.code === 'ENOENT' ? 'No connector list yet (os/data/connectors.json).' : `The connector list could not be read (${error.message}).`);}
  const [{servers, problems: configProblems}, byAgent] = await Promise.all([configuredServers(root, options), agentServers(root)]);
  const known = new Set(catalog.connectors.map(item => item.id));
  return {
    revision: catalog.revision,
    connectors: decorateConnectors(catalog.connectors, {configured: servers, agentServers: byAgent}),
    configured: servers,
    unlisted: servers.filter(server => !known.has(server.name)),
    agentServers: byAgent,
    problems: [...problems, ...catalog.problems, ...configProblems],
  };
}
