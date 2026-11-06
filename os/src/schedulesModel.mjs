// Scheduled jobs on Connect (owner, Nov 5: "The scheduled task, I guess, can be in the connect.
// Whenever we spawn a scheduled task from any agent, it would just pop up there."). Pure, shared
// by server/schedules.mjs and the Connect page; tested in server/schedules.test.mjs.
// Two sources: os/data/schedules.json (every agent adds its schedule there with
// `os.mjs schedule add`, whichever tool runs it) and what Launchroom finds by itself (its own
// timers, and the Claude app's scheduled tasks, titles and timing only, never their prompts).
import {secretProblem} from './toolsModel.mjs';

export const SCHEDULE_TOOLS = {'claude-app': 'Claude app', codex: 'Codex', antigravity: 'Antigravity', launchroom: 'Launchroom', windows: 'Windows', other: 'Another tool'};
const FIELDS = ['id', 'name', 'what', 'agent', 'runsIn', 'when', 'cron', 'sites', 'reportId', 'enabled', 'addedBy', 'addedAt'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One schedule's problem in plain words, or ''. */
export function scheduleProblem(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'A schedule must be an object.';
  const extra = Object.keys(entry).filter(key => !FIELDS.includes(key));
  if (extra.length) return `Unknown field: ${extra.join(', ')}.`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id || '')) return 'The id must be lowercase words joined by dashes.';
  if (typeof entry.name !== 'string' || !entry.name.trim()) return 'A schedule needs a name.';
  if (!SCHEDULE_TOOLS[entry.runsIn]) return `runsIn is one of: ${Object.keys(SCHEDULE_TOOLS).join(', ')}.`;
  if (typeof entry.when !== 'string' || !entry.when.trim()) return 'Say when it runs, in words (for example "Every day at 8:00").';
  for (const key of ['what', 'agent', 'cron', 'reportId', 'addedBy', 'addedAt']) if (entry[key] !== undefined && typeof entry[key] !== 'string') return `${key} must be text.`;
  if (entry.sites !== undefined && (!Array.isArray(entry.sites) || entry.sites.some(site => typeof site !== 'string'))) return 'sites must be a list of Connect site ids.';
  if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') return 'enabled is true or false.';
  for (const value of [entry.name, entry.what, entry.when, entry.cron]) {const problem = secretProblem(value || ''); if (problem) return problem;}
  return '';
}

/** The saved list, cleaned, with a problem line for each entry left out. */
export function cleanSchedules(record) {
  const list = Array.isArray(record?.schedules) ? record.schedules : [];
  const seen = new Set(), schedules = [], problems = [];
  for (const entry of list) {
    const problem = scheduleProblem(entry) || (seen.has(entry.id) ? 'This id is used twice.' : '');
    if (problem) {problems.push(`${entry?.id || 'A schedule'}: ${problem}`); continue;}
    seen.add(entry.id); schedules.push({enabled: true, sites: [], what: '', agent: '', cron: '', reportId: '', ...entry});
  }
  return {revision: Number.isInteger(record?.revision) ? record.revision : 0, schedules, problems};
}

const two = n => String(n).padStart(2, '0');
const at = (h, m) => `${Number(h)}:${two(m)}`;
/** A cron line in plain words, for the common shapes; anything else comes back as the cron itself. */
export function cronWords(cron) {
  const parts = String(cron || '').trim().split(/\s+/);
  if (parts.length !== 5) return String(cron || '');
  const [m, h, dom, mon, dow] = parts;
  const num = value => /^\d+$/.test(value);
  if (/^\*\/\d+$/.test(m) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `Every ${m.slice(2)} minutes`;
  if (num(m) && /^\*\/\d+$/.test(h) && dom === '*' && mon === '*' && dow === '*') return `Every ${h.slice(2)} hours`;
  if (num(m) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `Every hour at :${two(m)}`;
  if (num(m) && num(h) && dom === '*' && mon === '*') {
    if (dow === '*') return `Every day at ${at(h, m)}`;
    if (dow === '1-5') return `Weekdays at ${at(h, m)}`;
    if (/^\d$/.test(dow)) return `Every ${DAYS[Number(dow) % 7]} at ${at(h, m)}`;
  }
  return String(cron);
}

/**
 * The Claude app's scheduled tasks (its scheduled-tasks.json), as Connect entries. Only the
 * title, timing and on/off come through; the prompt never does. Field names vary by app
 * version, so each is read from the names the app has used.
 */
export function claudeAppTasks(json) {
  const list = Array.isArray(json?.scheduledTasks) ? json.scheduledTasks : Array.isArray(json) ? json : [];
  return list.filter(task => task && typeof task === 'object').map(task => {
    const id = String(task.taskId || task.id || task.name || '').trim();
    const cron = String(task.cronExpression || task.cron || '').trim();
    const fireAt = task.fireAt || task.runAt || '';
    const name = String(task.title || task.name || id || 'Scheduled task').slice(0, 120);
    return {
      id: `claude-app-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'task'}`,
      name, what: '', agent: '', runsIn: 'claude-app', cron, sites: [], reportId: '',
      when: cron ? cronWords(cron) : fireAt ? `Once, ${String(fireAt).replace('T', ' ').slice(0, 16)}` : String(task.schedule || 'Scheduled'),
      enabled: task.enabled !== false && task.paused !== true,
      lastRunAt: task.lastRunAt || '', nextRunAt: task.nextRunAt || fireAt || '',
      found: true,
    };
  });
}

/** The latest job report a schedule wrote (its id, or the reportId it reports under), if any. */
export function lastRun(schedule, activity = []) {
  const key = schedule.reportId || schedule.id;
  const reports = (Array.isArray(activity) ? activity : []).filter(report => String(report.id || '').startsWith(key));
  const latest = reports.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
  return latest ? {at: latest.updatedAt, status: latest.status, title: latest.title, id: latest.id} : null;
}

/** Everything on the Scheduled tab: the ones agents added, then the ones found, without repeats. */
export function mergeSchedules(own = [], found = []) {
  const ids = new Set(own.map(item => item.id));
  return [...own.map(item => ({...item, found: false})), ...found.filter(item => !ids.has(item.id))];
}
