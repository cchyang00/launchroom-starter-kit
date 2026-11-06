// Scheduled jobs for Connect's Scheduled tab (GET /api/schedules, POST /api/schedules,
// POST /api/schedules/remove). The owner, Nov 5: "Whenever we spawn a scheduled task from any
// agent, it would just pop up there." Agents add theirs to os/data/schedules.json
// (`os.mjs schedule add`); Launchroom also finds its own Meta sync timer and the Claude app's
// scheduled tasks (titles and timing only). It never starts, stops or edits a job in another tool.
import {readFile, readdir, rename, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {claudeAppTasks, cleanSchedules, scheduleProblem} from '../src/schedulesModel.mjs';

const FILE = 'os/data/schedules.json';
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const exists = async file => {try {await stat(file); return true;} catch {return false;}};

/** The Claude app's scheduled-tasks.json files (one per account folder). */
async function claudeAppFiles(appData) {
  const files = [];
  for (const kind of ['claude-code-sessions', 'local-agent-mode-sessions']) {
    const base = path.join(appData, 'Claude', kind);
    let orgs = []; try {orgs = await readdir(base);} catch {continue;}
    for (const org of orgs.slice(0, 20)) {
      let accounts = []; try {accounts = await readdir(path.join(base, org));} catch {continue;}
      for (const account of accounts.slice(0, 20)) {
        const file = path.join(base, org, account, 'scheduled-tasks.json');
        if (await exists(file)) files.push(file);
      }
    }
  }
  return files;
}

/** What Launchroom finds by itself. */
export async function foundSchedules(root, {appData = process.env.LAUNCHROOM_APPDATA || process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')} = {}) {
  const found = [], problems = [];
  // Launchroom's own timer: hub.mjs runs the Meta and Shopify sync every 15 minutes when the script is there.
  if (await exists(path.join(root, 'scripts', 'sync_meta_campaigns.py'))) {
    // Its last run is when it last saved the numbers Manage reads.
    let lastRunAt = '';
    try {lastRunAt = (await stat(path.join(root, 'os', 'data', 'meta-campaigns.json'))).mtime.toISOString();} catch {}
    found.push({id: 'launchroom-meta-sync', name: 'Meta and Shopify numbers', what: 'Pulls spend, sales and orders into Manage', agent: 'ad-manager', runsIn: 'launchroom', when: 'Every 15 minutes while Launchroom runs', cron: '*/15 * * * *', sites: ['meta-ads-manager', 'shopify-admin'], reportId: '', enabled: true, lastRunAt, found: true});
  }
  const seen = new Set();
  for (const file of await claudeAppFiles(appData)) {
    try {
      for (const task of claudeAppTasks(await readJson(file))) if (!seen.has(task.id)) {seen.add(task.id); found.push(task);}
    } catch {problems.push('One of the Claude app\'s scheduled-task files could not be read.');}
  }
  return {found, problems};
}

export async function readSchedules(root, options = {}) {
  const problems = [];
  let own = {revision: 0, schedules: [], problems: []};
  try {own = cleanSchedules(await readJson(path.join(root, FILE)));}
  catch (error) {if (error.code !== 'ENOENT') problems.push(`The schedule list could not be read (${error.message}).`);}
  const {found, problems: foundProblems} = await foundSchedules(root, options);
  return {revision: own.revision, schedules: own.schedules, found, problems: [...problems, ...own.problems, ...foundProblems]};
}

let writing = Promise.resolve();
function write(root, change) {
  const run = writing.then(async () => {
    const file = path.join(root, FILE);
    let record = {revision: 0, schedules: []};
    try {record = await readJson(file);} catch (error) {if (error.code !== 'ENOENT') throw error;}
    const next = change(record);
    next.revision = (record.revision || 0) + 1;
    next.updatedAt = new Date().toISOString();
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`);
    await rename(temp, file);
    return readSchedules(root);
  });
  writing = run.catch(() => {});
  return run;
}

/** Adds a schedule, or updates the one with the same id. */
export function saveSchedule(root, input = {}) {
  const entry = {...input, addedAt: input.addedAt || new Date().toISOString()};
  for (const key of Object.keys(entry)) if (entry[key] === undefined) delete entry[key];
  const problem = scheduleProblem(entry);
  if (problem) return Promise.reject(Object.assign(new Error(problem), {status: 400, code: 'INVALID_SCHEDULE'}));
  return write(root, record => {
    const list = Array.isArray(record.schedules) ? record.schedules : [];
    const at = list.findIndex(item => item.id === entry.id);
    return {...record, schedules: at >= 0 ? list.map((item, i) => i === at ? {...item, ...entry} : item) : [...list, entry]};
  });
}

/** Takes a schedule off the list (only the list: the job in its own tool is stopped there). */
export function removeSchedule(root, {id} = {}) {
  return write(root, record => {
    const list = Array.isArray(record.schedules) ? record.schedules : [];
    if (!list.some(item => item.id === id)) throw Object.assign(new Error('No schedule with that id.'), {status: 404});
    return {...record, schedules: list.filter(item => item.id !== id)};
  });
}
