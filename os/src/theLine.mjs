// The seven-step line (owner, Oct 2, product first): Product, Buyers, Prove
// it, Create, Build, Launch, Learn. The issue files are a reference library.
// workflow/the-line.json is the owner's step guide: what each step is for,
// when it starts and ends, the owner's part, the agents who help and three
// copy-and-paste prompts. Every product has its own line (src/pipeline.mjs).
// `currentStep` is the ONE function that says where the pipeline's focus is:
// the building product, else what waits on the owner, else the earliest
// product, else "start a round". The server (briefs, START-HERE.md, /api/line,
// os.mjs step) and every screen call it with saved records, so they cannot
// disagree. Viewing a page, opening a stage or a finished agent run never moves it.
import {processState} from './processModel.mjs';
import {STEP_IDS, STEP_NAMES, STEP_COUNT} from './steps.mjs';
import {pipelineState, primaryMarket, agentFocus, whoName} from './pipeline.mjs';
import {findReady} from './researchView.mjs';

export {STEP_IDS, STEP_NAMES, STEP_COUNT};
export const LINE_PATH = 'workflow/the-line.json';
/** Each step's brief block stays this short (the guide's own words are about 110-120 of it). */
export const STEP_BLOCK_WORDS = 185;
/**
 * The pipeline block every brief opens with stays this short. It lists at most
 * PIPELINE_ROWS products (each clipped), so it holds with any number of products.
 */
export const PIPELINE_BLOCK_WORDS = 240;
export const PIPELINE_ROWS = 6;
const TEXT_FIELDS = ['purpose', 'startWhen', 'doneWhen', 'ownerPart', 'stopIf'];
const AGENT = /^[a-z][a-z0-9-]{0,59}$/;
const PLAYBOOK = /^workflow\/[A-Za-z0-9._/-]+\.md(?:#[a-z0-9-]+)?$/;

function lineError(message) {
  const error = new Error(`The step guide (${LINE_PATH}) ${message}`);
  error.code = 'MALFORMED_LINE';
  return error;
}
function words(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) throw lineError(`needs ${label} as text of at most ${max} characters.`);
  return value.trim();
}
function prompt(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw lineError(`has a ${label} that is not {label, text}.`);
  return {label: words(value.label, `${label} label`, 80), text: words(value.text, `${label} text`, 600)};
}

/** Validate and normalise the saved step guide. Throws a plain-language error on any problem. */
export function validateLine(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw lineError('must be a JSON object with steps and anytime prompts.');
  if (!Array.isArray(raw.steps) || raw.steps.length !== STEP_IDS.length) throw lineError(`must list exactly ${STEP_IDS.length} steps.`);
  const steps = raw.steps.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw lineError(`step ${index + 1} is not an object.`);
    if (step.id !== STEP_IDS[index]) throw lineError(`step ${index + 1} must have id "${STEP_IDS[index]}" (found "${step.id}"). Steps keep the order ${STEP_IDS.join(', ')}.`);
    const name = words(step.name, `a name for step ${index + 1}`, 40);
    const fields = Object.fromEntries(TEXT_FIELDS.map(key => [key, words(step[key], `"${key}" for ${name}`, 600)]));
    if (!Array.isArray(step.agents) || !step.agents.length || step.agents.length > 7 || step.agents.some(agent => typeof agent !== 'string' || !AGENT.test(agent))) throw lineError(`needs 1 to 7 team agent IDs in "agents" for ${name}.`);
    if (!Array.isArray(step.prompts) || step.prompts.length !== 3) throw lineError(`needs exactly 3 prompts for ${name}.`);
    if (typeof step.playbook !== 'string' || !PLAYBOOK.test(step.playbook)) throw lineError(`needs a workflow/*.md playbook link for ${name}.`);
    return {id: step.id, index, number: index + 1, name, ...fields, agents: [...new Set(step.agents)], prompts: step.prompts.map((item, i) => prompt(item, `${name} prompt ${i + 1}`)), playbook: step.playbook};
  });
  if (!Array.isArray(raw.anytime) || !raw.anytime.length || raw.anytime.length > 12) throw lineError('needs 1 to 12 "anytime" prompts.');
  const anytime = raw.anytime.map((item, i) => prompt(item, `anytime prompt ${i + 1}`));
  const updated = typeof raw.updated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.updated) ? raw.updated : '';
  return {about: typeof raw.about === 'string' ? raw.about.slice(0, 1000) : '', updated, steps, anytime};
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Counts of product cards by saved state. Every screen and brief reads the
 * eye-test count from here (Home once showed "1 wait" from a test copy where
 * one card had been saved; the saved card now shows next to the waiting one).
 */
export function leadSummary(leads = []) {
  const count = state => leads.filter(lead => lead.state === state).length;
  // Only cards with all five Find checks passing wait for the eye test; the rest are still being checked.
  const ready = leads.filter(lead => lead.state === 'waiting' && findReady(lead.candidate)).length;
  return {waiting: ready, checking: count('waiting') - ready, saved: count('saved') + count('ready'), reviewed: count('reviewed'), total: leads.length};
}

/** Short plain-language status of the cards, e.g. "2 cards wait for your eye test · 1 saved card is being checked". */
export function leadStatus(summary) {
  const parts = [];
  if (summary.waiting) parts.push(`${plural(summary.waiting, 'card')} ${summary.waiting === 1 ? 'waits' : 'wait'} for your eye test`);
  if (summary.saved) parts.push(`${plural(summary.saved, 'saved card')} ${summary.saved === 1 ? 'is' : 'are'} being checked`);
  if (summary.reviewed) parts.push(`${plural(summary.reviewed, 'card')} finished ${summary.reviewed === 1 ? 'its' : 'their'} checks`);
  return parts.join(' · ') || 'No cards are waiting';
}

const BASIS = 'saved cards, products and rounds';

/**
 * Where the pipeline's focus is, from saved records only (pipelineState):
 * the product in the build slot first, then what waits on the owner, then the
 * earliest product on the line, else "start a round". It returns that step
 * (index, guide, status, next move) plus the whole `pipeline`, so older
 * callers that show "the step" keep working while every product keeps its own
 * line. `product`/`market` name the building product (the old active product).
 * `line` may be null (guide missing or broken); `lineError` carries the reason.
 */
export function currentStep({line = null, lineError: guideError = '', stages = [], checks = [], products = [], archivedProducts = [], reviews = [], buildProductId = null, activeProductId = null, leads = [], rounds = [], roundsRevision = null, roundsError = '', issues = null} = {}) {
  const slot = buildProductId || activeProductId || null;
  const pipeline = {...pipelineState({leads, products, archivedProducts, reviews, stages, checks, rounds, buildProductId: slot, issues}), roundsRevision, roundsError};
  const focus = pipeline.focus;
  const index = Math.max(0, Math.min(focus.stepIndex, STEP_IDS.length - 1));
  const cards = leadSummary(leads);
  const roundLabel = pipeline.round ? `Round ${pipeline.round.number}` : 'No round yet';
  const status = focus.kind === 'owner' && focus.move === 'eye-test' ? `${roundLabel} · ${leadStatus(cards)}` : `${roundLabel} · ${focus.text}`;
  const building = pipeline.building ? products.find(product => product.id === pipeline.building.productId) || null : null;
  const market = building ? primaryMarket(building) : null;
  let verified = 0, total = 0, complete = false, nextCheck = null;
  if (building) { const flow = processState(stages, checks, market); ({verified, total, complete} = flow); nextCheck = flow.next ? {id: flow.next.id, title: flow.next.title} : null; }
  const guide = line?.steps?.[index] || null;
  return {
    index, number: index + 1, id: STEP_IDS[index], name: guide?.name || STEP_NAMES[index],
    guide, lineError: guide ? '' : (guideError || 'The step guide is not loaded.'),
    product: building ? {id: building.id, name: building.name} : null,
    market: market ? {id: market.id, country: market.country} : null,
    parked: null,
    verified, total, complete, nextCheck, cards, status, next: focus.next, owner: focus.who === 'owner',
    basis: BASIS, focus, pipeline,
  };
}

/** A step block's view of one product: its step, its status and its next move. */
export function itemStep(item, line, {lineError: guideError = ''} = {}) {
  const index = item.stepIndex;
  const guide = line?.steps?.[index] || null;
  return {index, number: index + 1, id: STEP_IDS[index], name: guide?.name || STEP_NAMES[index], guide, lineError: guide ? '' : (guideError || 'The step guide is not loaded.'),
    status: `${item.id} ${clipText(item.name, 40)}: ${item.status}`, next: item.next || 'Nothing to do here now; it is out of the line.', owner: item.who === 'owner', basis: BASIS, item};
}

/** Fill a prompt's [product], [country] and [L###] blanks for one product; other blanks stay. */
export function fillPrompt(text, values = {}) {
  return String(text ?? '').replace(/\[([^\]\n]{1,80})\]/g, (all, key) => {
    const k = key.trim().toLowerCase();
    if (k === 'product' && values.product) return values.product;
    if (k === 'country' && values.country) return values.country;
    if (/^l###/.test(k) && values.lead) return values.lead;
    return all;
  });
}

const clock = at => {
  const d = new Date(at);
  return Number.isFinite(d.getTime()) ? `${new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'}).format(d)} ${new Intl.DateTimeFormat('en-GB', {timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit'}).format(d)} Chicago` : '';
};

/**
 * One step's block: what it is for, now, next move, start and done, the
 * owner's part, the agents and when to stop. `agent` marks the reader's part;
 * `names` maps agent IDs to display names; `title` replaces the heading.
 */
export function stepMarkdown(step, {at = new Date(), agent = '', names = {}, title = ''} = {}) {
  if (!step) return '';
  const g = step.guide;
  const head = `## ${title || `Step ${step.number} of ${STEP_COUNT} · ${step.name}`}`;
  const footer = `_From ${step.basis}, ${clock(at)}. Live: \`os.mjs step\`._`;
  // Now and Next name a product, so they are clipped to keep the block within STEP_BLOCK_WORDS.
  const now = `- **Now:** ${clipText(step.status, 120)}.\n- **Next move:** ${clipText(step.next, 150)}`;
  if (!g) return `${head}\n\n${now}\n- **Step guide:** ${step.lineError} Ask the manager to repair ${LINE_PATH}.\n\n${footer}\n`;
  const helpers = g.agents.map(id => id === agent ? `you (${id})` : names[id] ? `${names[id]} (${id})` : id).join(', ');
  const yours = agent && agent !== 'manager' && !g.agents.includes(agent) ? ' Not you: work only toward finishing this step.' : '';
  return `${head}\n\n${g.purpose}\n\n${now}\n- **Start when:** ${g.startWhen}\n- **Done when:** ${g.doneWhen}\n- **Owner's part:** ${g.ownerPart}\n- **Agents:** ${helpers}.${yours}\n- **Stop if:** ${g.stopIf}\n\n${footer}\n`;
}

const clipText = (value, max) => { const s = String(value || '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const shortDay = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';
/** One product row: id, name, step, status and who moves next. */
export const pipelineRow = item => `- ${item.id} ${clipText(item.name, 30)} (${item.readyToBuild ? 'ready to build' : item.stepName}): ${clipText(item.status, 40)}${item.who ? `, ${whoName(item.who)}` : ''}`;
const OWNER_FOCUS = {'eye-test': 'the eye test above', 'build-pick': 'pick which product builds (above)', launch: 'approve the test (above)'};
const COUNT_ORDER = [...STEP_IDS.slice(0, 3).map((id, i) => [id, STEP_NAMES[i]]), ['ready', 'Ready to build'], ...STEP_IDS.slice(3).map((id, i) => [id, STEP_NAMES[i + 3]])];
/** Products per step, the empty steps left out: "Product 2 · Buyers 1 · Prove it 1 · Ready to build 1". */
export const pipelineCounts = counts => COUNT_ORDER.filter(([id]) => counts[id]).map(([id, name]) => `${name} ${counts[id]}`).join(' · ') || 'nothing yet';

/**
 * "The pipeline · Round N", the block every brief opens with: the round and its
 * focus, products per step, the build slot, what waits on the owner, the focus,
 * then one row per product on the line (the reader's own first, at most
 * PIPELINE_ROWS). Team agents also get the products waiting at their steps.
 */
export function pipelineMarkdown(pipeline, {at = new Date(), agent = 'manager', line = null} = {}) {
  if (!pipeline) return '';
  const r = pipeline.round;
  const head = `## The pipeline · ${r ? `Round ${r.number}` : 'no round yet'}`;
  const lines = [];
  // Step 0 (owner, Oct 3): the issue list comes first; a round tests one issue the owner picked.
  const issue = r?.issue ? `issue ${r.issue}` : '';
  lines.push(r ? `- **Round ${r.number}** (started ${r.startedOn}${r.open ? '' : `, reviewed ${shortDay(r.review?.reviewedOn)}`}${issue ? `; ${issue}` : ''}): ${clipText(r.focus, 80)}` :`- **No round yet:** start Round ${pipeline.nextNumber} with \`os.mjs round start --issue <slug>\`.`);
  const issues = pipeline.issues || [];
  if (issues.length) {
    const testing = issues.filter(row => row.status === 'testing').map(row => row.slug);
    const verified = issues.filter(row => row.status === 'verified').length;
    lines.push(`- **Issues (step 0):** ${issues.length}; ${testing.length ? `testing ${clipText(testing.join(', '), 60)}` : verified ? `${verified} Verified, waiting for the owner's pick` : 'none Verified yet'}.`);
  }
  lines.push(`- **On the line:** ${pipelineCounts(pipeline.counts)}. Out of the line: ${pipeline.counts.out}.`);
  const b = pipeline.building;
  lines.push(b ? `- **Build slot:** ${b.productId} ${clipText(b.name, 32)}${b.country ? ` (${b.country})` : ''} · ${b.stepName}.` : '- **Build slot:** empty; nothing is building.');
  lines.push(`- **Needs the owner:** ${pipeline.ownerMoves.length ? clipText(pipeline.ownerMoves.map(move => move.text).join('; '), 110) : 'nothing right now'}.`);
  const f = pipeline.focus;
  lines.push(`- **Focus:** ${f.kind === 'owner' ? `Owner: ${OWNER_FOCUS[f.move] || 'the move above'}.` : clipText(f.next, 120)}`);
  const review = (pipeline.rounds || []).filter(round => round.needsReview);
  if (review.length) lines.push(`- **Round review due:** ${review.map(round => round.id).join(', ')} (no cards left at Product, Buyers or Prove it).`);
  if (pipeline.roundsError) lines.push(`- **Rounds:** ${clipText(pipeline.roundsError, 140)} Ask the manager.`);
  const mine = agent && agent !== 'manager' ? agentFocus(pipeline, agent, line) : null;
  const ownIds = new Set((mine?.items || []).map(item => item.id));
  const rows = [...(mine?.items || []), ...pipeline.active.filter(item => !ownIds.has(item.id))];
  const shown = rows.slice(0, PIPELINE_ROWS), more = rows.length - shown.length;
  const list = `**Products on the line (${pipeline.active.length})**\n\n${shown.map(pipelineRow).join('\n') || '- None yet.'}${more > 0 ? `\n- …and ${more} more: \`os.mjs pipeline\`` : ''}`;
  const yours = mine ? `\n\n**Yours** (${mine.steps.map(id => STEP_NAMES[STEP_IDS.indexOf(id)]).join(', ')}): ${mine.items.length ? mine.items.slice(0, 6).map(item => item.id).join(', ') + (mine.items.length > 6 ? ` and ${mine.items.length - 6} more` : '') : 'nothing waits at your steps right now'}.` : '';
  const footer = `_From saved records, ${clock(at)}. Live: \`os.mjs pipeline\`, \`os.mjs product <id>\`._`;
  return `${head}\n\n${lines.join('\n')}\n\n${list}${yours}\n\n${footer}\n`;
}

/**
 * The two blocks a brief opens with: the pipeline, then the step block for the
 * reader (the manager: the focus step; a team agent: the step where its
 * products wait, named after the first one). `step` is currentStep().
 */
export function briefBlocks(step, {at = new Date(), agent = 'manager', names = {}, line = null} = {}) {
  if (!step) return {pipeline: '', step: '', view: null};
  const pipeline = pipelineMarkdown(step.pipeline, {at, agent, line});
  let view = step, title = `Focus: Step ${step.number} of ${STEP_COUNT} · ${step.name}`;
  if (agent && agent !== 'manager') {
    const mine = agentFocus(step.pipeline, agent, line);
    if (mine) {
      const guide = line?.steps?.[mine.index] || (mine.index === step.index ? step.guide : null);
      view = mine.item ? itemStep(mine.item, line, {lineError: step.lineError}) : {...step, index: mine.index, number: mine.index + 1, id: STEP_IDS[mine.index], name: guide?.name || STEP_NAMES[mine.index], guide, lineError: guide ? '' : step.lineError || 'The step guide is not loaded.', status: `Nothing waits at ${STEP_NAMES[mine.index]} for you right now`, next: step.next};
      if (!view.guide && guide) view = {...view, guide, lineError: ''};
      title = `Your step: Step ${view.number} of ${STEP_COUNT} · ${view.name}`;
    }
  }
  return {pipeline, step: stepMarkdown(view, {at, agent, names, title}), view};
}

/** Prompts for one step (by id, name or number) or the current one, plus the anytime prompts. */
export function stepPrompts(line, which, fallbackIndex = 0) {
  if (!line) return {step: null, prompts: [], anytime: []};
  const key = String(which ?? '').trim().toLowerCase();
  const step = !key ? line.steps[fallbackIndex] : line.steps.find(s => s.id === key || s.name.toLowerCase() === key || String(s.number) === key);
  return {step: step || null, prompts: step?.prompts || [], anytime: line.anytime};
}

/** A readable page of the whole guide for the document reader (the JSON stays the source). */
export function lineMarkdown(line) {
  const steps = line.steps.map(s => `## Step ${s.number} · ${s.name}\n\n${s.purpose}\n\n- **Start when:** ${s.startWhen}\n- **Done when:** ${s.doneWhen}\n- **Owner's part:** ${s.ownerPart}\n- **Agents who help:** ${s.agents.join(', ')}\n- **Stop if:** ${s.stopIf}\n- **Full method:** [${s.playbook.replace(/^workflow\//, '')}](${s.playbook.replace(/^workflow\//, '')})\n\n**Prompts to paste in chat**\n\n${s.prompts.map((p, i) => `${i + 1}. **${p.label}:** ${p.text}`).join('\n')}`).join('\n\n');
  return `# The seven-step line\n\n${line.about}\n\n_Source: ${LINE_PATH}${line.updated ? `, updated ${line.updated}` : ''}. Words in [brackets] are blanks to fill in._\n\n${steps}\n\n## Anytime prompts\n\n${line.anytime.map(p => `- **${p.label}:** ${p.text}`).join('\n')}\n`;
}

/** Split prompt text into plain parts and [blanks] to fill in. */
export function promptParts(text = '') {
  return String(text).split(/(\[[^\]\n]{1,80}\])/).filter(Boolean).map(part => ({text: part, blank: /^\[[^\]]+\]$/.test(part)}));
}
