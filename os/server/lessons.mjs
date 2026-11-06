import {fail, object, text, assertRevision, evidenceSource} from './domain.mjs';
import {AGENT_ID} from './planner.mjs';
import {forAgent} from '../src/libraryModel.mjs';
import {briefBlocks} from '../src/theLine.mjs';
import {agentStepTools, OPENS_LABELS, OPTIONAL_LABEL} from '../src/toolsModel.mjs';
import {hasAgent, isParkedAgentTask, isDispatchable} from '../src/plannerRules.mjs';
import {idleWork, idleMarkdown} from '../src/idleWork.mjs';

// Lessons are the self-improvement part of memory: short rules learned from
// real work or owner corrections. Agents read the active ones (trying or
// proven) for their scope before every job. The list stays short on purpose.
export const LESSON_STATUSES = ['proposed', 'trying', 'proven', 'retired'];
export const ACTIVE = ['trying', 'proven'];
export const LESSON_SOURCES = ['owner', 'job', 'review', 'seed'];
export const LESSON_LIMITS = {everyone: 15, scope: 10};
export const NOW_WORD_TARGET = 250;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const tz = at => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(at));

export const emptyLessons = () => ({revision: 0, lessons: []});
export const capFor = scope => scope === 'everyone' ? LESSON_LIMITS.everyone : LESSON_LIMITS.scope;
export const isActive = lesson => ACTIVE.includes(lesson.status);
const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;

function scopeOf(value) {
  if (value === 'everyone' || value === 'manager' || (typeof value === 'string' && AGENT_ID.test(value))) return value;
  fail('Choose who the lesson is for: everyone, manager or a team agent ID.');
}
function day(value, label) {
  if (typeof value !== 'string' || !DAY.test(value) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${label} must be a real YYYY-MM-DD date.`);
  return value;
}
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a whole number.`);
  return value;
}

function fields(input, previous = {}) {
  const status = input.status ?? previous.status ?? 'proposed';
  if (!LESSON_STATUSES.includes(status)) fail('Lesson status must be proposed, trying, proven or retired.');
  const source = input.source ?? previous.source ?? 'job';
  if (!LESSON_SOURCES.includes(source)) fail('Lesson source must be owner, job, review or seed.');
  const refs = input.references ?? previous.references ?? [];
  if (!Array.isArray(refs) || refs.length > 6) fail('Use at most 6 lesson references.');
  const proposedBy = input.proposedBy ?? previous.proposedBy ?? 'manager';
  if (!['owner', 'manager'].includes(proposedBy) && !AGENT_ID.test(proposedBy)) fail('Proposed by must be owner, manager or a team agent ID.');
  return {
    rule: text(input.rule ?? previous.rule, 'Lesson rule', {required: true, max: 200}),
    why: text(input.why ?? previous.why, 'Why', {required: true, max: 240}),
    scope: scopeOf(input.scope ?? previous.scope ?? 'everyone'),
    status, source, proposedBy,
    learnedOn: day(input.learnedOn ?? previous.learnedOn ?? tz(new Date()), 'Learned on'),
    learnedFrom: text(input.learnedFrom ?? previous.learnedFrom ?? '', 'Learned from', {max: 300}),
    statusNote: text(input.statusNote ?? previous.statusNote ?? '', 'Status note', {max: 300}),
    references: [...new Set(refs.map(evidenceSource))],
    uses: count(previous.uses ?? 0, 'Uses'), helped: count(previous.helped ?? 0, 'Helped'),
    lastUsed: previous.lastUsed ?? '',
  };
}

export function validateLessons(raw) {
  object(raw);
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.lessons) || raw.lessons.length > 500) fail('Invalid saved lessons. Restore the record before editing.', 'MALFORMED_DATA', 500);
  const ids = new Set();
  for (const lesson of raw.lessons) {
    object(lesson); fields(lesson, lesson);
    if (typeof lesson.id !== 'string' || !/^LS-\d{3,}$/.test(lesson.id) || ids.has(lesson.id)) fail('Invalid or duplicate saved lesson ID.', 'MALFORMED_DATA', 500);
    if (lesson.helped > lesson.uses) fail('A lesson cannot have helped more often than it was used.', 'MALFORMED_DATA', 500);
    ids.add(lesson.id);
  }
  return raw;
}

/**
 * Create or edit one lesson. `use: {helped, by}` records that an agent applied
 * it. Moving a lesson into the active list respects the per-scope limit, and
 * "proven" needs evidence that it helped (or comes from the owner or an
 * already-adopted earlier lesson).
 */
export function updateLessons(raw, input, now = new Date()) {
  const current = validateLessons(raw); object(input); assertRevision(current.revision, input.revision);
  const next = structuredClone(current), at = now.toISOString();
  const previous = input.id ? next.lessons.find(lesson => lesson.id === input.id) : null;
  if (input.id && !previous) fail('Lesson not found. Refresh the lessons.', 'NOT_FOUND', 404);
  if (!previous && next.lessons.length >= 500) fail('Lesson storage is full. Retire and archive before adding more.', 'LESSONS_FULL', 409);
  const value = fields(input, previous || {});
  if (input.use !== undefined) {
    if (!previous) fail('Record a use on an existing lesson.');
    object(input.use, 'Lesson use');
    if (typeof input.use.helped !== 'boolean') fail('Say whether the lesson helped (true or false).');
    if (!isActive(previous)) fail('Only an active lesson can be used.');
    value.uses += 1; if (input.use.helped) value.helped += 1; value.lastUsed = tz(now);
  }
  if (value.status === 'retired' && previous?.status !== 'retired' && !value.statusNote) fail('Say why the lesson is retired or declined.');
  if (value.status === 'proven' && previous?.status !== 'proven' && !value.helped && !['owner', 'seed'].includes(value.source)) fail('A lesson becomes proven after it has helped at least once.');
  const becomesActive = ACTIVE.includes(value.status) && (!previous || !isActive(previous) || previous.scope !== value.scope);
  if (becomesActive) {
    const active = next.lessons.filter(lesson => lesson.scope === value.scope && isActive(lesson) && lesson.id !== previous?.id).length;
    if (active >= capFor(value.scope)) fail(`The ${value.scope} list already has ${capFor(value.scope)} active lessons. Merge or retire one first so the brief stays short.`, 'LESSON_LIMIT', 409);
  }
  const id = previous?.id || `LS-${String(next.lessons.reduce((max, lesson) => Math.max(max, Number(lesson.id.slice(3))), 0) + 1).padStart(3, '0')}`;
  const lesson = {...previous, ...value, id, createdAt: previous?.createdAt || at, updatedAt: at, ...(value.status !== previous?.status ? {statusChangedOn: tz(now)} : {})};
  if (previous) next.lessons[next.lessons.indexOf(previous)] = lesson; else next.lessons.push(lesson);
  next.revision++;
  if (JSON.stringify(next).length > 1_000_000) fail('Lesson storage limit reached.', 'LESSONS_FULL', 409);
  return next;
}

const one = value => String(value || '').replace(/[\r\n]+/g, ' ').trim();
const lessonLine = lesson => `- **${lesson.id}** ${one(lesson.rule)} — _${one(lesson.why)}_ (${lesson.status}, ${lesson.learnedOn}${lesson.uses ? `; used ${lesson.uses}, helped ${lesson.helped}` : ''})`;
const byRank = (a, b) => Number(b.status === 'proven') - Number(a.status === 'proven') || b.helped - a.helped || b.learnedOn.localeCompare(a.learnedOn);
export const activeFor = (lessons, scope) => lessons.filter(lesson => lesson.scope === scope && isActive(lesson)).sort(byRank);

export function nowMarkdown(state) {
  const h = state.handoff || {};
  return `## Now\n\n${one(h.summary) || 'Nothing saved yet.'}\n\n**Next:** ${one(h.nextAction) || 'Not recorded.'}\n\n**Blocked or waiting:** ${one(h.blockers) || 'Nothing recorded.'}\n`;
}

/**
 * Library entries picked for this agent (newest first, at most 6). `library`
 * undefined leaves the section out; null means the record could not be read.
 */
function librarySection(library, scope) {
  if (library === undefined) return {markdown: '', picked: []};
  if (library === null) return {markdown: '## From the library (read when relevant)\n\nThe library record needs repair (os/data/library.json). Ask the manager.\n\n', picked: []};
  const all = library.entries.filter(entry => entry.status === 'learned' && entry.trust !== 'outdated' && (entry.forAgents || []).includes(scope));
  const picked = forAgent(library.entries, scope, 6);
  const more = all.length - picked.length;
  const lines = picked.map(entry => `- ${entry.id} ${one(entry.title)} — ${entry.path} (${entry.trust})`).join('\n');
  return {picked, markdown: `## From the library (read when relevant)\n\n${lines || 'Nothing picked for you yet.'}${more > 0 ? `\n- …and ${more} more: \`os.mjs library list --for ${scope}\`` : ''}\nSearch everything we know: \`os.mjs library search "topic"\`.\n\n`};
}

export const BRIEF_TOOL_LIMIT = 6;
/**
 * The tools for the step we are on, one compact line each: name, link and
 * where it opens. The reader's own tools come first; at most six are listed.
 * `tools` undefined leaves the section out; null means the record needs repair.
 */
export function stepToolsMarkdown(tools, step, agent = '') {
  if (tools === undefined || !step) return '';
  if (tools === null) return `## Tools for Step ${step.number} · ${step.name}\n\nThe tool list needs repair (os/data/tools.json). Ask the manager; \`os.mjs tools\` shows what loads.\n\n`;
  // The live method's tools first (optional cross-checks last), the reader's own first within each; no Luxury-app tools (agents can't use them).
  const list = agentStepTools(tools, step.id);
  const own = tool => Boolean(agent && agent !== 'manager' && tool.agents.includes(agent));
  const mine = [...list].sort((a, b) => Number(Boolean(a.optional)) - Number(Boolean(b.optional)) || Number(own(b)) - Number(own(a)));
  const shown = mine.slice(0, BRIEF_TOOL_LIMIT), more = mine.length - shown.length;
  const where = tool => tool.opensIn === 'luxury-desktop' ? 'Luxury app (start Luxury, then pick it; the link is the vendor page)' : OPENS_LABELS[tool.opensIn];
  const lines = shown.map(tool => `- ${one(tool.name)}${tool.optional ? ` (${OPTIONAL_LABEL})` : ''} · ${tool.url} · ${where(tool)}`).join('\n');
  return `## Tools for Step ${step.number} · ${step.name}\n\n${lines || 'None listed for this step yet.'}${more > 0 ? `\n- …and ${more} more: \`os.mjs tools --step ${step.id}\`` : ''}\nNo passwords: on a sign-in wall, stop and ask the owner to sign in. One tool's notes: \`os.mjs tool <id>\`.\n\n`;
}

/**
 * The one page an agent reads before every job. It opens with the pipeline
 * (`step` = currentStep() from saved records: every product's own line and the
 * products waiting at this agent's steps), then the reader's step block (the
 * manager: the focus step; `line` is the step guide; `names` maps agent IDs to
 * names), then the tools for that step (`tools` = the saved tool list).
 * Someday agent tasks are parked: left out of the to-dos and the inbox count,
 * shown as one count. A team agent with nothing assigned gets "Nothing
 * assigned? Useful now" from the pipeline, `issues` and `topics` (idleWork).
 */
export function agentBrief({state, planner, lessons, library, agent = 'manager', name, at = new Date(), step = null, names = {}, tools, line = null, issues = [], topics = [], storeEdits = '', ownerTaste = '', issueBlock = '', skills = []}) {
  const scope = agent || 'manager';
  const mine = scope === 'everyone' ? [] : activeFor(lessons.lessons, scope), shared = activeFor(lessons.lessons, 'everyone');
  const parked = planner.tasks.filter(task => isParkedAgentTask(task) && (scope === 'manager' || hasAgent(task, scope)));
  const open = planner.tasks.filter(task => task.status !== 'done' && !isParkedAgentTask(task) && (scope === 'manager' ? true : hasAgent(task, scope)))
    .sort((a, b) => Number(b.focus) - Number(a.focus) || (a.date || '9999').localeCompare(b.date || '9999')).slice(0, scope === 'manager' ? 8 : 6);
  const inbox = planner.tasks.filter(isDispatchable).length;
  const idle = scope !== 'manager' && !open.length ? idleMarkdown(idleWork({agent: scope, pipeline: step?.pipeline || null, issues, topics})) : '';
  const parkedLine = parked.length ? `\n\nParked (someday, not to start): ${parked.length}. They wait until the manager gives them a day.` : '';
  const reading = librarySection(library, scope);
  const blocks = step ? briefBlocks(step, {at, agent: scope, names, line}) : null;
  const stepBlock = blocks ? `${blocks.pipeline}\n${blocks.step}\n` : '';
  const toolBlock = stepToolsMarkdown(tools, blocks?.view || step, scope);
  const skillsList = Array.isArray(skills) ? skills.map(s => typeof s === 'string' ? s : s?.name).filter(Boolean) : [];
  const skillsBlock = skillsList.length
    ? `## Mandatory Skills (Must Read Before Working)\n\n${skillsList.map(s => `- \`.claude/skills/${s}/SKILL.md\``).join('\n')}\n\n`
    : '';
  const markdown = `# Brief for ${name || scope}\n\nGenerated ${new Date(at).toISOString()} · read this before every job. Rules from root AGENTS.md still apply.\n\n${stepBlock}${toolBlock}${skillsBlock}${issueBlock ? `${issueBlock.trimEnd()}\n\n` : ''}${ownerTaste ?`${ownerTaste.trimEnd()}\n\n` : ''}${nowMarkdown(state)}${storeEdits ? `\n${storeEdits.trimEnd()}\n` : ''}\n## Your lessons (${mine.length})\n\n${mine.map(lessonLine).join('\n') || 'None yet.'}\n\n## Everyone's lessons (${shared.length})\n\n${shared.map(lessonLine).join('\n') || 'None yet.'}\n\n${reading.markdown}## ${scope === 'manager' ? `Open to-dos (agent inbox: ${inbox} waiting)` : 'Your open to-dos'}\n\n${open.map(task => `- ${one(task.title)} (${task.id}; ${task.status}${task.agent && scope === 'manager' ? `; → ${task.agent}` : ''})${task.nextAction ? `\n  Next: ${one(task.nextAction)}` : ''}`).join('\n') || 'None.'}${parkedLine}\n\n${idle}## After the job, answer two questions\n\n1. What happened? One line for the diary.\n2. What should we do differently next time? Propose a lesson, or say "nothing new". Also say which lessons above you used and whether they helped.\n`;
  return {agent: scope, markdown, words: words(markdown), stepWords: words(blocks?.step || ''), pipelineWords: words(blocks?.pipeline || ''), toolWords: words(toolBlock), tasteWords: words(ownerTaste), issueWords: words(issueBlock), idleWords: words(idle), parked: parked.length, step, skills: skillsList, lessons: {mine, everyone: shared}, library: reading.picked, tasks: open, nowWords: words(`${state.handoff?.summary || ''} ${state.handoff?.nextAction || ''} ${state.handoff?.blockers || ''}`)};
}

export function lessonsMarkdown(lessons) {
  const all = lessons.lessons;
  const scopes = [...new Set(['everyone', 'manager', ...all.map(lesson => lesson.scope)])];
  const proposed = all.filter(lesson => lesson.status === 'proposed'), retired = all.filter(lesson => lesson.status === 'retired');
  return `# Lessons\n\nGenerated from lessons revision ${lessons.revision} (os/data/lessons.json; edit through localhost:3000 Memory or the merrivy-os helper). Active lessons are trying or proven; each agent reads its own plus everyone's before every job. Limits: ${LESSON_LIMITS.everyone} for everyone, ${LESSON_LIMITS.scope} per agent.\n\n${scopes.map(scope => {const list = activeFor(all, scope);return `## ${scope} (${list.length}/${capFor(scope)})\n\n${list.map(lesson => `${lessonLine(lesson)}\n  Learned from: ${one(lesson.learnedFrom) || 'Not recorded'}${lesson.references.length ? `\n  Sources: ${lesson.references.join(', ')}` : ''}`).join('\n') || 'None yet.'}\n`;}).join('\n')}\n## Proposed, waiting for the manager (${proposed.length})\n\n${proposed.map(lesson => `- ${lesson.id} [${lesson.scope}, by ${lesson.proposedBy}] ${one(lesson.rule)} — ${one(lesson.why)}`).join('\n') || 'None.'}\n\n## Retired (${retired.length})\n\n${retired.map(lesson => `- ${lesson.id} [${lesson.scope}] ${one(lesson.rule)} — retired ${lesson.statusChangedOn || lesson.updatedAt.slice(0, 10)}: ${one(lesson.statusNote)}`).join('\n') || 'None.'}\n`;
}

/** Weekly review numbers for the manager and the Memory page. */
export function lessonReview(lessons, day, days = 7) {
  const since = new Date(new Date(`${day}T12:00:00`).getTime() - days * 86400000).toISOString().slice(0, 10);
  const all = lessons.lessons, active = all.filter(isActive);
  return {
    active: active.length, proven: active.filter(l => l.status === 'proven').length, trying: active.filter(l => l.status === 'trying').length,
    proposed: all.filter(l => l.status === 'proposed').length,
    usedThisWeek: active.filter(l => l.lastUsed && l.lastUsed >= since).length,
    newThisWeek: all.filter(l => l.createdAt.slice(0, 10) >= since && l.status !== 'retired').length,
    retiredThisWeek: all.filter(l => l.status === 'retired' && (l.statusChangedOn || '') >= since).length,
    readyToProve: active.filter(l => l.status === 'trying' && l.helped >= 2).map(l => l.id),
    notHelping: active.filter(l => l.uses >= 3 && l.helped / l.uses < 0.5).map(l => l.id),
    unused30: active.filter(l => !l.lastUsed && l.learnedOn < new Date(new Date(`${day}T12:00:00`).getTime() - 30 * 86400000).toISOString().slice(0, 10)).map(l => l.id),
  };
}
