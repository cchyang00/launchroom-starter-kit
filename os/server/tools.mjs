import {fail, object, text, assertRevision, sourceUrl} from './domain.mjs';
import {AGENT_ID} from './planner.mjs';
import {STEP_IDS, stepId} from '../src/steps.mjs';
import {TOOL_GROUPS, GROUP_LABELS, OPENS_IN, OPENS_LABELS, TOOL_FIELDS, TOOL_LIMIT, TOOL_ID, SECRET_MESSAGE, SECRET_FIELD, secretProblem, urlProblem, isLocalUrl, slugify, guessGroup, opensInFor, toolCounts, stepLabel} from '../src/toolsModel.mjs';

// The tool registry: every outside tool we use, with the one link the owner
// and Claude both open in the same signed-in browser. os/data/tools.json is
// authoritative; resources/TOOLS.md is the readable projection for any harness.
// No passwords, keys or tokens are ever stored (LS-064): every text field and
// link passes the shared credential guard, and unknown fields are refused.
export const TOOLS_PATH = 'os/data/tools.json';
export const TOOLS_DOC = 'resources/TOOLS.md';
export const emptyTools = () => ({revision: 0, tools: []});
export const toolsDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(at));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_FIELDS = [['name', 'Name', 80], ['purpose', 'What it is for', 240], ['signIn', 'How sign-in works', 240], ['limits', 'Limits', 300]];

function guard(value, label) {
  const problem = secretProblem(value);
  if (problem) fail(problem, 'SECRET_REFUSED', 400, {field: label});
  return value;
}
function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) fail(`${label} must be one of: ${allowed.join(', ')}.`);
  return value;
}
function list(value, label, max) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be a list of at most ${max}.`);
  return value;
}
/** Where we noted the tool: a link or a workspace file. Only a pointer, never read through this record. */
export function toolSource(value) {
  const clean = text(value ?? '', 'Where it was noted', {max: 300});
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return guard(sourceUrl(clean), 'source');
  const [file, anchor] = clean.split('#');
  if (anchor !== undefined && !/^[a-z0-9-]{1,80}$/.test(anchor)) fail('Where it was noted must be a link or a workspace file path.');
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(file) || file.split('/').some(part => part === '..' || part === '.' || /^\./.test(part) && !['.claude', '.agents'].includes(part))
    || /^os\/data(?:\/|$)/.test(file) || file.split('/').some(part => /^(?:\.env.*|\.git|node_modules|credentials?|secrets?|tokens?|private|sessions?|cookies?|auth)$/i.test(part)))
    fail('Where it was noted must be a link or a workspace file path (not os/data or a secrets folder).', 'UNSAFE_PATH');
  return clean;
}
function day(value, today) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value !== 'string' || !DAY.test(value) || new Date(value).toISOString().slice(0, 10) !== value) fail('Signed in on must be a real YYYY-MM-DD date, or empty.');
  if (today && value > today) fail('Signed in on cannot be in the future.');
  return value;
}

/** Validate one tool's fields; omitted fields keep `previous`. Throws plain-language errors. */
export function toolFields(input, previous = {}, today) {
  for (const key of Object.keys(input)) {
    if (key === 'revision' || TOOL_FIELDS.includes(key)) continue;
    if (SECRET_FIELD.test(key)) fail(SECRET_MESSAGE, 'SECRET_REFUSED', 400, {field: key});
    fail(`A tool holds only: ${TOOL_FIELDS.join(', ')}. "${String(key).slice(0, 40)}" is not one of them.`, 'UNKNOWN_FIELD');
  }
  const value = {};
  for (const [key, label, max] of TEXT_FIELDS) {
    const raw = input[key] ?? previous[key] ?? '';
    if (typeof raw !== 'string') fail(`${label} must be text.`);
    value[key] = guard(text(raw.replace(/[\r\n]+/g, ' '), label, {required: key === 'name' || key === 'purpose', max}), key);
  }
  const rawUrl = input.url ?? previous.url;
  const urlIssue = urlProblem(rawUrl);
  if (urlIssue) fail(urlIssue, urlIssue === SECRET_MESSAGE ? 'SECRET_REFUSED' : 'INVALID_URL', 400, {field: 'url'});
  value.url = guard(new URL(rawUrl.trim()).href, 'url');
  if (value.url.length > 2000) fail('The link is too long (2,000 characters at most).');
  // Old six-step ids (saved before Oct 2) map to their new step; validation and sourcing both become prove.
  const steps = [...new Set(list(input.steps ?? previous.steps, 'Steps', STEP_IDS.length).map(step => oneOf(typeof step === 'string' ? stepId(step) || step : step, STEP_IDS, 'Each step')))];
  if (!steps.length) fail('Pick at least one step that uses this tool.');
  value.steps = STEP_IDS.filter(step => steps.includes(step));
  value.group = oneOf(input.group ?? previous.group ?? guessGroup({url: value.url, steps: value.steps, name: value.name, purpose: value.purpose}), TOOL_GROUPS, 'Group');
  value.opensIn = oneOf(input.opensIn ?? previous.opensIn ?? opensInFor(value.url), OPENS_IN, 'Opens in');
  if (value.opensIn === 'local' && !isLocalUrl(value.url)) fail('A tool that opens on this computer needs a localhost link.');
  if (value.opensIn !== 'local' && isLocalUrl(value.url)) fail('A localhost link opens on this computer: set opens in to local.');
  value.agents = [...new Set(list(input.agents ?? previous.agents, 'Agents', 12).map(id => {
    if (typeof id !== 'string' || !AGENT_ID.test(id)) fail('Agents must be team agent IDs like scout or checker.');
    return id;
  }))];
  value.source = toolSource(input.source ?? previous.source ?? '');
  const retired = input.retired ?? previous.retired ?? false;
  if (typeof retired !== 'boolean') fail('Retired must be true or false.');
  value.retired = retired;
  value.signedInNoted = day(input.signedInNoted ?? previous.signedInNoted ?? '', today);
  // Optional: a cross-check outside the live method (workflow/CHECKS.md); listed after the method's own tools.
  const optional = input.optional ?? previous.optional ?? false;
  if (typeof optional !== 'boolean') fail('Optional must be true or false.');
  value.optional = optional;
  return value;
}

export function validateTools(raw) {
  object(raw);
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.tools) || raw.tools.length > TOOL_LIMIT) fail(`Invalid saved tools. Restore ${TOOLS_PATH} before editing.`, 'MALFORMED_DATA', 500);
  const ids = new Set();
  for (const tool of raw.tools) {
    try {
      object(tool, 'Tool');
      if (typeof tool.id !== 'string' || !TOOL_ID.test(tool.id) || tool.id.length > 60 || ids.has(tool.id)) throw new Error('invalid or duplicate ID');
      const {id, createdAt, updatedAt, ...rest} = tool;
      toolFields(rest, {}, null);
      for (const at of [createdAt, updatedAt]) if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) throw new Error('invalid timestamp');
      ids.add(id);
    } catch (error) { fail(`Invalid saved tool ${typeof tool?.id === 'string' ? tool.id : ''}: ${error.message}`, 'MALFORMED_DATA', 500); }
  }
  return raw;
}

/**
 * Create or edit one tool. Without `id` it creates, with an ID made from the
 * name; with an `id` it edits that tool, or creates one with that ID when it is
 * new. Omitted fields keep their value. `retired: true` hides a tool; nothing
 * is ever deleted.
 */
export function updateTools(raw, input, now = new Date()) {
  const current = validateTools(raw); object(input); assertRevision(current.revision, input.revision);
  const next = structuredClone(current), at = now.toISOString(), today = toolsDay(now);
  if (input.id !== undefined && (typeof input.id !== 'string' || !TOOL_ID.test(input.id) || input.id.length > 60)) fail('Tool IDs are lowercase words joined by hyphens, like trend-track.');
  const previous = input.id ? next.tools.find(tool => tool.id === input.id) : null;
  let id = previous?.id || input.id;
  if (!id) {
    id = slugify(typeof input.name === 'string' ? input.name : '');
    if (!id) fail('Give the tool a name with letters or numbers.');
    const twin = next.tools.find(tool => tool.id === id);
    if (twin) fail(`${twin.name} is already a tool (${twin.id}). Edit it instead.`, 'DUPLICATE_TOOL', 409, {id: twin.id});
  }
  if (!previous && next.tools.length >= TOOL_LIMIT) fail(`The tool list holds ${TOOL_LIMIT} tools. Retire old ones first.`, 'TOOLS_FULL', 409);
  const {revision, id: _ignored, ...fields} = input;
  const value = toolFields(fields, previous || {}, today);
  const tool = {id, ...value, createdAt: previous?.createdAt || at, updatedAt: at};
  if (previous) next.tools[next.tools.indexOf(previous)] = tool; else next.tools.push(tool);
  next.revision++;
  return next;
}

export const presentTools = registry => ({revision: registry.revision, tools: registry.tools, counts: toolCounts(registry.tools)});

const cell = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|').trim();
/** The readable catalog any harness can open. It lists links and notes only, never credentials. */
export function toolsMarkdown(registry) {
  const active = registry.tools.filter(tool => !tool.retired), retired = registry.tools.filter(tool => tool.retired);
  const row = tool => `| **${cell(tool.name)}** (\`${tool.id}\`)${tool.optional ? ' · optional cross-check' : ''} | ${cell(tool.purpose)} | ${tool.steps.map(stepLabel).join(', ')} | ${OPENS_LABELS[tool.opensIn]} | ${cell(tool.signIn) || 'Not noted yet'}${tool.signedInNoted ? ` · owner noted signed in ${tool.signedInNoted}` : ''} | ${cell(tool.limits) || '—'} | <${tool.url}> |`;
  const groups = TOOL_GROUPS.map(group => {
    const items = active.filter(tool => tool.group === group);
    if (!items.length) return '';
    return `## ${GROUP_LABELS[group]}\n\n| Tool | What for | Steps | Opens in | How sign-in works | Limits | Link |\n| --- | --- | --- | --- | --- | --- | --- |\n${items.map(row).join('\n')}\n`;
  }).filter(Boolean).join('\n');
  const luxury = active.filter(tool => tool.opensIn === 'luxury-desktop');
  return `# Tools\n\nGenerated by Launchroom from \`${TOOLS_PATH}\` (revision ${registry.revision}). Edit through the Tools page (localhost:3000/#/tools) or \`os.mjs tool\`, not here.\n\n**No passwords here.** The owner signs in once in the shared browser (the Claude desktop app's browser pane or their own Chrome); agents work in that signed-in session and never type credentials. When a tool shows a sign-in wall, stop and ask the owner to sign in again; never type a password.\n\nClaude Code: \`node .claude/skills/merrivy-os/scripts/os.mjs tools --step find\` lists the tools for a step; \`os.mjs tool <id>\` prints one tool's link and notes, then open that link in the browser pane.\n${luxury.length ? `\n${luxury.map(tool => `**${cell(tool.name)}** opens only in the Luxury desktop app; its link is only the vendor or catalog page.`).join(' ')}\n` : ''}\n${groups || '_No tools recorded yet._\n'}${retired.length ? `\n## Retired\n\nKept for history; do not use.\n\n${retired.map(tool => `- ${cell(tool.name)} (\`${tool.id}\`) · <${tool.url}>`).join('\n')}\n` : ''}${active.some(tool => tool.source) ? `\n## Where each tool was noted\n\n${active.filter(tool => tool.source).map(tool => `- ${cell(tool.name)}: ${tool.source}`).join('\n')}\n` : ''}`;
}
