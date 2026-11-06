// The Merrivy pipeline (owner, Oct 1): "The line is not something that just
// exists; it exists from a product that we choose." Every product (a card
// L### and, once started, its product record P###) has its own seven-step
// line (owner, Oct 2, product first): Product, Buyers, Prove it, Create,
// Build, Launch, Learn. A round starts from a focus and sales numbers; many
// products move through Product, Buyers and Prove it at once; Create, Build,
// Launch and Learn take one product at a time (the build slot, picked by the
// owner). The issue files are a reference library, never a step.
//
// Everything here is derived from saved records only: the cards' eye-test
// decisions and checks (research/comparison.json), the product checks
// (products/P###/os-product.json, processState), the cycle reviews, the
// owner's build pick and the rounds (os/data/rounds.json). Viewing a page or a
// finished agent run never moves a product. Server briefs and screens both
// call these functions, so they cannot disagree.
import {STEP_IDS, STEP_NAMES, lineIndexOfStage} from './steps.mjs';
import {processState, effectiveCheckStatus} from './processModel.mjs';
import {statsSummary, validationSnapshot} from './statsPanel.mjs';
import {ownerReasonLine} from './eyeTest.mjs';
import {GATES, gateLine} from './gates.mjs';
import {FIND_CHECK_IDS, PREFLIGHT_CHECK_IDS, RESEARCH_GATE_IDS, screenReady, gateOpen, checkPasses, findReady, upfrontReady, earlyWaveRuleApplies, cardIssues, buyersQuotesMet, buyersAvatarsMet, buyersGapMet} from './researchView.mjs';

/**
 * Steps from this index on (Create, Build, Launch, Learn) need the build slot.
 * It is also the first product check stage after Source (server/domain.mjs
 * STAGES: discovery, validation, sourcing, creative, …), so one number serves both.
 */
export const BUILD_FROM = 3;
/** Line indexes of the steps (see src/steps.mjs). */
export const PRODUCT_STEP = 0, BUYERS_STEP = 1, PROVE_STEP = 2, LEARN_STEP = 6;
/** Step 2 · Buyers' gate lines (A1-A3: quotes, avatars, the angle gap), read from the card's buyers check. */
export const BUYERS_LINES = 3;
export const ROUNDS_PATH = 'os/data/rounds.json';
export const ROUNDS_DOC = 'memory/ROUNDS.md';
/** Which team agents work at which steps (their briefs list the products waiting there). */
export const AGENT_STEPS = {
  'buyer-researcher': ['buyers'],
  scout: ['product'],
  checker: ['prove'],
  copywriter: ['create'],
  'image-maker': ['create'],
  'store-builder': ['build', 'launch'],
};
export const WHO_NAMES = {owner: 'Owner', manager: 'Claude', scout: 'Scout', checker: 'Checker', 'buyer-researcher': 'Buyer researcher', copywriter: 'Copywriter', 'image-maker': 'Image maker', 'store-builder': 'Store builder'};
export const whoName = id => WHO_NAMES[id] || id || '';
export const OUT_LABELS = {passed: 'Passed for now', rejected: 'Rejected', parked: 'Parked', killed: 'Killed', failed: 'Failed', archived: 'Cycle reviewed', 'product-parked': 'Parked', 'product-rejected': 'Rejected'};
/** Who records each Create, Build, Launch and Learn check for the building product (LAUNCHROOM-PLAN: the manager writes the test sheet and reads the results). */
const CHECK_WHO = {'claims-rights': 'copywriter', 'creative-assets': 'image-maker', 'angle-offer': 'copywriter', 'experiment-plan': 'manager', 'authorized-test': 'owner', result: 'manager', 'case-review': 'manager'};
const STAGE_WHO = {creative: 'copywriter', shopify: 'store-builder', testing: 'manager', learning: 'manager'};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A card's first saved local file of a kind (never a web link, nor research/, which is not served as media). */
const savedMedia = (references, kind) => (Array.isArray(references) ? references : []).find(ref => typeof ref === 'string' && !/^https?:/i.test(ref) && !ref.startsWith('research/') && kind.test(ref)) || '';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const roundId = number => `R${String(number).padStart(2, '0')}`;
/** A round folder is research/<name>/ (the trailing slash is added when missing). */
export const roundFolder = value => {
  const clean = String(value ?? '').trim().replace(/\\/g, '/');
  return clean && !clean.endsWith('/') ? `${clean}/` : clean;
};

const activeMarket = market => ['active', 'winner'].includes(market?.status);
/** The market a product is judged by: its first active one, else its first. */
export const primaryMarket = product => product?.markets?.find(activeMarket) || product?.markets?.[0] || null;
/** The card (L###) a product was started from. */
export const productLead = product => primaryMarket(product)?.researchCandidateId || product?.markets?.find(market => market.researchCandidateId)?.researchCandidateId || '';

/** Every research path a card mentions: its batch file, card file, references and evidence sources. */
export function leadPaths(lead) {
  const candidate = lead?.candidate || {};
  const paths = [lead?.card?.batchPath, lead?.card?.sourcePath, lead?.sourcePath, ...(candidate.references || []),
    ...Object.values(candidate.gates || {}).map(gate => gate?.source), ...Object.values(candidate.screen?.checks || {}).map(check => check?.source)];
  return [...new Set(paths.filter(value => typeof value === 'string' && value.startsWith('research/')))];
}
/** The round a card belongs to: the earliest round whose folder its paths use, else null ("Earlier work"). */
export function roundOf(paths, rounds = []) {
  return [...rounds].sort((a, b) => a.number - b.number).find(round => (round.folders || []).some(folder => paths.some(file => file.startsWith(roundFolder(folder))))) || null;
}

/**
 * A card's state on the line. The eye test decides first (leadState); a saved
 * card whose decision text starts with PARK or KILL has been parked by an
 * agent with a reason and leaves the line.
 */
export function lineLeadState(lead) {
  const state = lead?.state || 'parked';
  if (['saved', 'ready', 'reviewed'].includes(state)) {
    const text = lead.candidate?.decision || '';
    if (/^\s*KILL\b/i.test(text)) return 'killed';
    if (/^\s*PARK\b/i.test(text)) return 'parked';
  }
  // A failed gate check fails the product (CHECKS.md rule 3, owner Oct 3): it leaves the eye-test queue and the line.
  if (['waiting', 'checking', 'saved', 'ready', 'reviewed'].includes(state) && failedCheck(lead?.candidate)) return 'failed';
  return state;
}

/**
 * A card's checks: the six Product checks (workflow/CHECKS.md F1-F6, before
 * the eye test), the Buyers check's three lines (A1-A3, after the owner's
 * Save), then at Prove it the source-and-profit preflight and, once the screen
 * is complete, the five deep checks. `done`/`total` are Prove it's.
 */
export function cardChecks(candidate) {
  const checks = candidate?.screen?.checks || {};
  const passed = ids => ids.filter(id => checkPasses(id, checks[id])).length;
  const failedOf = ids => ids.filter(id => checks[id]?.status === 'failed').length;
  const find = passed(FIND_CHECK_IDS), findFailed = failedOf(FIND_CHECK_IDS);
  const preflight = passed(PREFLIGHT_CHECK_IDS), preflightFailed = failedOf(PREFLIGHT_CHECK_IDS);
  const ready = Boolean(candidate && screenReady(candidate));
  // A deep gate counts once it is open (P1 after Buyers, Oct 3), not only after the full preflight.
  const gates = candidate ? RESEARCH_GATE_IDS.filter(id => gateOpen(candidate, id) && ['supported', 'failed'].includes(candidate.gates?.[id]?.status)).length : 0;
  const gatesFailed = candidate ? RESEARCH_GATE_IDS.filter(id => gateOpen(candidate, id) && candidate.gates?.[id]?.status === 'failed').length : 0;
  const b = checks.buyers, bOk = b?.status === 'supported';
  const buyers = bOk ? [buyersQuotesMet(b), buyersAvatarsMet(b), buyersGapMet(b)].filter(Boolean).length : 0;
  return {find, findFailed, buyers, buyersPassed: checkPasses('buyers', b), buyersFailed: b?.status === 'failed', buyersStarted: Boolean(b && (b.status !== 'pending' || b.source || b.note)), preflight, preflightFailed, screen: find + preflight, screenFailed: findFailed + preflightFailed, ready, gates, gatesFailed,
    done: preflight + gates, total: PREFLIGHT_CHECK_IDS.length + RESEARCH_GATE_IDS.length};
}
/** Plain progress words for a saved card: "Find checks 3/5" while any Find check is missing, then "Source & profit 1/2". */
export function checkCounts(val) {
  return val.find < FIND_CHECK_IDS.length ? `Find checks ${val.find}/${FIND_CHECK_IDS.length}` : `Source & profit ${val.preflight}/${PREFLIGHT_CHECK_IDS.length}`;
}
/** The newest dated evidence on a card (screen checks and deep checks). */
function evidenceOn(candidate) {
  const dates = [...Object.values(candidate?.screen?.checks || {}), ...Object.values(candidate?.gates || {})].map(item => item?.observedAt).filter(value => typeof value === 'string' && DAY.test(value));
  return dates.sort().at(-1) || '';
}

const STAGE_OF_STEP = {create: 'creative', build: 'shopify', launch: 'testing', learn: 'learning'};
function blankLine(checks) {
  const count = stage => checks.filter(check => check.stage === stage).length;
  const totals = {product: FIND_CHECK_IDS.length, buyers: BUYERS_LINES, prove: PREFLIGHT_CHECK_IDS.length + RESEARCH_GATE_IDS.length};
  return STEP_IDS.map((id, index) => ({id, name: STEP_NAMES[index], state: 'todo', done: 0, total: totals[id] ?? count(STAGE_OF_STEP[id])}));
}
/** Steps before `index` done, `index` in `state`, later ones left as they are. */
function markLine(line, index, state) {
  line.forEach((step, i) => { if (i < index && step.state === 'todo') step.state = 'done'; });
  line[index].state = state;
  return line;
}
/**
 * The issue library files a product links to (reference only, never a step):
 * the card's benefit ladder (F5), else the issue its round worked from.
 */
export function linkedIssues(round, candidate = null) {
  const ladder = candidate?.screen?.checks?.bigIssue;
  const linked = ladder ? cardIssues(ladder) : [];
  return linked.length ? linked.join(', ') : round?.issue || '';
}
/** P1 failed (Meta saturated for the avatar and angle) after the owner reopened it: the checker tries the next avatar or angle. */
export const ROOM_ON_META_FAILED = 'Checker: Room on Meta failed for the main avatar; try the next avatar or angle from Buyers (you reopened it).';

/**
 * The card checks under the gate lines (workflow/CHECKS.md rule 3, owner Oct 3:
 * "if the checks dont pass. you can fail the product"): F1-F6, the Buyers check
 * (A1-A3) and Prove it's card checks (P1 demand/competition, P2 sourceMatch/
 * sourcing, P4 contribution). The Oct 1 checks and the legacy community and fit
 * gates are not gate lines, so they never fail a product here.
 */
export const FAIL_CHECKS = [
  {id: 'provenDemand', line: 'F1', label: 'Statistics', kind: 'screen', who: 'scout'},
  {id: 'dropshippable', line: 'F2', label: 'Dropshippable', kind: 'screen', who: 'scout'},
  {id: 'looksWorth', line: 'F3', label: 'A good product', kind: 'screen', who: 'scout'},
  {id: 'audienceRoom', line: 'F4', label: 'Several angles and avatars', kind: 'screen', who: 'scout'},
  {id: 'bigIssue', line: 'F5', label: 'Ties to our issues', kind: 'screen', who: 'scout'},
  {id: 'metaGap', line: 'F6', label: 'An angle gap', kind: 'screen', who: 'scout'},
  {id: 'buyers', line: 'A1-A3', label: 'Buyers', kind: 'screen', who: 'buyer-researcher'},
  {id: 'demand', line: 'P1', label: 'Room on Meta', kind: 'gate', who: 'checker'},
  {id: 'competition', line: 'P1', label: 'Room on Meta', kind: 'gate', who: 'checker'},
  {id: 'sourceMatch', line: 'P2', label: 'Same item, safe to sell', kind: 'screen', who: 'checker'},
  {id: 'sourcing', line: 'P2', label: 'Same item, safe to sell', kind: 'gate', who: 'checker'},
  {id: 'contribution', line: 'P4', label: 'The money line', kind: 'screen', who: 'checker'},
];
const REOPEN_NOTE = 200;
/** What the owner's Reopen remembers about one failure: the check, its date and the start of its note. A new failure (other date or note) fails it again. */
export const reopenMark = (id, check) => ({id, observedAt: String(check?.observedAt || ''), note: String(check?.note || '').replace(/\s+/g, ' ').trim().slice(0, REOPEN_NOTE)});
const sameMark = (mark, other) => mark?.id === other.id && mark.observedAt === other.observedAt && mark.note === other.note;
/**
 * The card's failed gate checks, in gate order, from saved records only: a
 * check saved as failed with its date and source. Pending, blocked or unknown
 * checks (missing evidence, a deep gate not open yet) never count. Each says
 * whether the owner reopened that exact failure (`screen.reopened`).
 */
export function failedChecks(candidate) {
  if (!candidate) return [];
  const missing = new Set([...(candidate.missingEvidence?.screen || []), ...(candidate.missingEvidence?.gates || [])]);
  const reopened = Array.isArray(candidate.screen?.reopened) ? candidate.screen.reopened : [];
  const out = [];
  for (const spec of FAIL_CHECKS) {
    const check = spec.kind === 'screen' ? candidate.screen?.checks?.[spec.id] : candidate.gates?.[spec.id];
    if (check?.status !== 'failed' || !check.observedAt || !check.source || missing.has(spec.id)) continue;
    if (spec.kind === 'gate' && !gateOpen(candidate, spec.id)) continue;
    const mark = reopenMark(spec.id, check);
    out.push({...spec, note: String(check.note || ''), observedAt: check.observedAt, source: check.source, mark, reopened: reopened.some(item => sameMark(item, mark))});
  }
  return out;
}
/** The owner's one-tap Reopen: the card with this failure's mark added to `screen.reopened` (nothing else changes). */
export function reopenCandidate(candidate, mark, at = new Date()) {
  const next = structuredClone(candidate);
  const list = Array.isArray(next.screen?.reopened) ? next.screen.reopened.filter(item => !sameMark(item, mark)) : [];
  next.screen = {...next.screen, reopened: [...list, {id: mark.id, observedAt: mark.observedAt, note: mark.note, at: new Date(at).toISOString()}].slice(-20)};
  return next;
}
/** Undo a Reopen: the card without that mark. */
export function unreopenCandidate(candidate, mark) {
  const next = structuredClone(candidate);
  const list = (Array.isArray(next.screen?.reopened) ? next.screen.reopened : []).filter(item => !sameMark(item, mark));
  next.screen = {...next.screen};
  if (list.length) next.screen.reopened = list; else delete next.screen.reopened;
  return next;
}
/** The first failed gate check that still fails the product (not reopened by the owner), or null. */
export const failedCheck = candidate => failedChecks(candidate).find(item => !item.reopened) || null;
/** Where a failed check stops the line: F at Product, A at Buyers, P at Prove it. */
const failStep = line => line.startsWith('F') ? PRODUCT_STEP : line.startsWith('A') ? BUYERS_STEP : PROVE_STEP;
const BUYERS_NEXT = 'Buyer researcher: read its buyers (TikTok comments, 2-4 star reviews, forums): 15+ quotes, 2+ avatars, the angle gap.';

const clip = (value, max) => { const s = String(value || '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };

/**
 * A card on its line. A failure the owner reopened keeps the card on the line
 * with "Reopened · re-check F3" and the agent who owns that check next.
 */
function leadItem(lead, state, checks) {
  const item = leadLine(lead, state, checks);
  if (item.outcome) return item;
  const again = failedChecks(lead.candidate).find(entry => entry.reopened);
  if (!again) return item;
  const next = again.line === 'P1' ? ROOM_ON_META_FAILED : `${whoName(again.who)}: re-check ${again.line} ${again.label}; you reopened it after it failed.`;
  return {...item, status: `Reopened · re-check ${again.line}`, next, who: again.who};
}

/** Whether a card's hard test has started: a saved buyers, source or profit check, or a deep gate. Only its sales numbers and light checks don't count. */
export const verifyStarted = candidate => ['buyers', ...PREFLIGHT_CHECK_IDS].some(id => ['supported', 'failed'].includes(candidate?.screen?.checks?.[id]?.status))
  || RESEARCH_GATE_IDS.some(id => ['supported', 'failed'].includes(candidate?.gates?.[id]?.status));

function leadLine(lead, state, checks) {
  const candidate = lead.candidate;
  const line = blankLine(checks);
  const val = cardChecks(candidate);
  line[PRODUCT_STEP].done = val.find;
  line[BUYERS_STEP].done = val.buyers;
  line[PROVE_STEP].done = val.done;
  const base = {stepIndex: PRODUCT_STEP, status: '', next: '', who: '', outcome: null};
  if (['passed', 'rejected'].includes(state)) {
    markLine(line, PRODUCT_STEP, 'stopped');
    const chat = candidate?.screen?.said?.source === 'owner-chat' ? ' · said in chat' : '';
    return {...base, line, status: OUT_LABELS[state], outcome: {kind: state, label: `${OUT_LABELS[state]}${chat}`, reason: clip(ownerReasonLine(candidate?.screen), 300)}};
  }
  if (['parked', 'killed'].includes(state)) {
    const at = candidate?.screen?.ownerDecision !== 'saved' ? PRODUCT_STEP : val.buyersPassed ? PROVE_STEP : BUYERS_STEP;
    markLine(line, at, 'stopped');
    return {...base, stepIndex: at, line, status: OUT_LABELS[state], outcome: {kind: state, label: OUT_LABELS[state], reason: clip(candidate?.decision || lead.card?.disposition, 300)}};
  }
  // A failed gate check fails the product on its own (workflow/CHECKS.md rule 3, owner Oct 3):
  // out of the line as "Failed at <check>" with the check's note; never a "Needs you" move. The owner can reopen it.
  const failure = failedCheck(candidate);
  if (failure) {
    const natural = candidate?.screen?.ownerDecision !== 'saved' ? PRODUCT_STEP : val.buyersPassed ? PROVE_STEP : BUYERS_STEP;
    const at = Math.min(natural, failStep(failure.line));
    markLine(line, at, 'stopped');
    const label = `Failed at ${failure.line}`;
    return {...base, stepIndex: at, line, status: label, outcome: {kind: 'failed', label: `${label} · ${failure.label}`, reason: clip(failure.note, 300), on: String(failure.observedAt).slice(0, 10),
      check: {id: failure.id, line: failure.line, label: failure.label, source: failure.source, mark: failure.mark}}};
  }
  // Owner, Oct 2: a card without its statistics never reaches the eye test
  // (Step 1, F1-F6). The owner's Save moves it to Step 2 Buyers; Prove it starts
  // once its buyers check passes (A1-A3).
  const noStats = checkPasses('provenDemand', candidate?.screen?.checks?.provenDemand) ? '' : ' · no stats';
  // Owner, Nov 5: "the product and the verify are more for the agents. The winners are more for me." A card that
  // passes every hard check (Nov 3 rule on) lands on Winners with no Save; the owner approves or rejects it there.
  const passedAll = upfrontReady(candidate) && (state !== 'waiting' || earlyWaveRuleApplies(candidate?.screen?.checks?.provenDemand));
  if (['saved', 'ready', 'reviewed', 'waiting'].includes(state) && passedAll) {
    line[PRODUCT_STEP].state = 'done';
    line[BUYERS_STEP].state = 'done';
    line[PROVE_STEP].state = 'done';
    line[BUILD_FROM].state = 'waiting';
    return {...base, stepIndex: PROVE_STEP, line, readyToBuild: true, status: 'Ready to build', next: 'Owner: approve it or reject it on Winners.', who: 'owner'};
  }
  if (state === 'waiting') {
    if (!findReady(candidate)) {
      // The hard test has started once a deep record is saved; until then it sits in the catalog.
      if (verifyStarted(candidate)) {
        markLine(line, PROVE_STEP, 'current');
        return {...base, stepIndex: PROVE_STEP, line, status: 'Being verified', next: 'Checker: finish the hard checks. A failed one takes it off the line; passing them all sends it to Winners.', who: 'checker'};
      }
      markLine(line, PRODUCT_STEP, 'current');
      return {...base, line, status: `Checking · Find ${val.find}/${FIND_CHECK_IDS.length} · Buyers ${val.buyers}/${BUYERS_LINES} · Gates ${val.gates}/${RESEARCH_GATE_IDS.length}${noStats}`, next: 'Scout: finish the light checks; the hard test runs on Verify.', who: 'scout'};
    }
    // Only a card checked under the older rule (before Nov 3) still reaches this.
    markLine(line, PRODUCT_STEP, 'current');
    return {...base, line, status: 'Waiting for your eye test', next: 'Owner: eye test — Save to build, Pass for now or Reject (Find page).', who: 'owner'};
  }
  // Saved (owner, Oct 2): Step 2 Buyers until its buyers check passes. A card
  // saved before the Product checks were complete still owes them (shown).
  if (['saved', 'ready'].includes(state) && !val.buyersPassed) {
    markLine(line, BUYERS_STEP, 'current');
    const owes = val.find < FIND_CHECK_IDS.length ? ` · Find ${val.find}/${FIND_CHECK_IDS.length}` : '';
    if (val.findFailed) return {...base, stepIndex: BUYERS_STEP, line, status: `Buyers · Find ${val.find}/${FIND_CHECK_IDS.length} · ${val.findFailed} failed`, next: 'Scout: a Product check failed. Park it with the reason (decision PARK: …) or fix the evidence.', who: 'scout'};
    const status = val.buyersFailed ? 'Buyers · failed' : val.buyersStarted ? `Buyers ${val.buyers}/${BUYERS_LINES}${owes}` : `Buyers · pending${owes}`;
    const next = val.buyersFailed ? 'Buyer researcher: its buyers check failed. Park it with the reason (decision PARK: …) or fix the evidence.' : BUYERS_NEXT;
    return {...base, stepIndex: BUYERS_STEP, line, status, next, who: 'buyer-researcher'};
  }
  markLine(line, PROVE_STEP, 'current');
  // P1 · Room on Meta comes first in Prove it (owner, Oct 3: "we're bidding"): a failed Meta check fails the
  // product above; once the owner reopens it, the supplier and profit work still waits while the checker tries the next avatar.
  if (gateOpen(candidate, 'competition') && candidate?.gates?.competition?.status === 'failed') {
    return {...base, stepIndex: PROVE_STEP, line, status: 'Room on Meta failed', next: ROOM_ON_META_FAILED, who: 'checker'};
  }
  if (state === 'saved') {
    const failed = val.screenFailed ? ` · ${val.screenFailed} failed` : '';
    const findOpen = val.find < FIND_CHECK_IDS.length, profitOpen = val.preflight < PREFLIGHT_CHECK_IDS.length;
    const next = val.screenFailed ? 'Checker: a check failed. Park it with the reason (decision PARK: …) or fix the evidence.'
      : profitOpen && findOpen ? 'Checker: supplier and profit preflight, then the missing Find checks.'
        : profitOpen ? 'Checker: the supplier and profit preflight (Source & profit).'
          : 'Checker: record the missing Find checks (workflow/CHECKS.md).';
    return {...base, stepIndex: PROVE_STEP, line, status: `Saved · ${checkCounts(val)}${failed}`, next, who: 'checker'};
  }
  // Ready or reviewed (the card's preflight is in): the next move comes only from the current gate, P1-P5
  // (workflow/CHECKS.md Step 3; Oct 3). The legacy community and fit gates never set a next move.
  // P1, P2 and P4 are recorded on the card; P3 (delivery) and P5 (claims we can back; no sample, owner Oct 3) on the product record.
  const prove = GATES.prove.map(gate => gateLine(gate, {candidate}));
  const passedLines = prove.filter(gate => gate.state === 'passed').length;
  const cardOpen = prove.filter(gate => CARD_PROVE_LINES.includes(gate.id) && gate.state !== 'passed');
  if (cardOpen.length) {
    const gate = cardOpen[0];
    return {...base, stepIndex: PROVE_STEP, line, status: `Prove it ${passedLines}/${prove.length}`, next: `Checker: ${gate.id} ${gate.label}${gate.state === 'partly' ? ` (new part open: ${gate.open})` : ''}, from the prove file and CHECKS.md Step 3.`, who: 'checker'};
  }
  return {...base, stepIndex: PROVE_STEP, line, status: `Prove it ${passedLines}/${prove.length} · start its record`, next: `Checker: start its product record (os.mjs product start ${lead.id}); P3 delivery promise and P5 claims we can back are recorded on it.`, who: 'checker'};
}
/** The Prove it lines a card itself records (P1 room on Meta, P2 the exact source, P4 the money line). */
const CARD_PROVE_LINES = ['P1', 'P2', 'P4'];

/**
 * A started product (P###) on its line. Its product checks (server/domain.mjs)
 * sit under the steps: discovery, validation and sourcing under Prove it, then
 * one stage each for Create, Build, Launch and Learn (lineIndexOfStage).
 */
function productItem(product, {stages, checks, buildProductId, building, archived, review}) {
  const market = primaryMarket(product);
  const flow = processState(stages, checks, market);
  const line = blankLine(checks);
  const early = flow.steps.slice(0, BUILD_FROM), recorded = early.reduce((sum, step) => sum + step.done, 0), recordTotal = early.reduce((sum, step) => sum + step.total, 0);
  // A product record starts only from a card the owner saved, so Step 1 is behind it. Its count is the
  // card's own Find checks and Step 2's its buyers check (filled in pipelineItems), never assumed.
  line[PRODUCT_STEP] = {...line[PRODUCT_STEP], done: 0, state: 'done'};
  line[PROVE_STEP] = {...line[PROVE_STEP], done: recorded, total: recordTotal, state: flow.currentIndex < BUILD_FROM ? 'todo' : 'done'};
  for (let i = BUILD_FROM; i < STEP_IDS.length; i++) line[i] = {...line[i], done: flow.steps[i]?.done || 0, total: flow.steps[i]?.total || 0, state: flow.steps[i]?.state === 'complete' ? 'done' : 'todo'};
  const at = flow.complete ? STEP_IDS.length - 1 : Math.max(PROVE_STEP, Math.min(lineIndexOfStage(flow.currentIndex), STEP_IDS.length - 1));
  const base = {stepIndex: at, status: '', next: '', who: '', outcome: null, flow, market, readyToBuild: false, building: false};
  if (archived) {
    if (!(review?.outcome === 'completed' && flow.complete)) line[at].state = 'stopped';
    const label = `${OUT_LABELS.archived}${review?.outcome ? ` · ${review.outcome}` : ''}`;
    return {...base, line, status: label, outcome: {kind: 'archived', label, reason: clip(review?.whatFailed || review?.nextChanges, 300), on: String(review?.date || '').slice(0, 10)}};
  }
  if (['parked', 'rejected'].includes(market?.status)) {
    const kind = `product-${market.status}`;
    line[at].state = 'stopped';
    return {...base, line, status: OUT_LABELS[kind], outcome: {kind, label: OUT_LABELS[kind], reason: clip(market.reason, 300)}};
  }
  const isBuilding = product.id === buildProductId;
  const stage = (i, title) => `${title} ${line[i].done}/${line[i].total}`;
  // Launched early (owner, Oct 1): the owner put it in the build slot before
  // Prove it was complete. It works at its first unfinished build step; the
  // earlier checks stay visibly open ("still open, launched early").
  if (isBuilding && flow.currentIndex < BUILD_FROM) return earlyItem({base, line, flow, market});
  if (flow.currentIndex < BUILD_FROM) {
    line[PROVE_STEP].state = 'current';
    const gate = market?.verificationGate;
    const next = gate && gate.ready !== true ? `Checker: ${gate.reason || 'link this product to its owner-saved card.'}` : `Checker: record "${flow.next?.title}" from the card's evidence.`;
    const status = flow.currentIndex <= 1 ? `Recording the product record (${recorded}/${recordTotal})` : `Prove it · checks ${recorded}/${recordTotal}`;
    return {...base, stepIndex: PROVE_STEP, line, status: `${isBuilding ? 'Building · ' : ''}${status}`, next, who: 'checker', building: isBuilding};
  }
  if (!isBuilding) {
    line[BUILD_FROM].state = 'waiting';
    return {...base, stepIndex: PROVE_STEP, line, readyToBuild: true, status: 'Ready to build',
      next: building ? `Claude: it waits for the build slot (${building.name} is building).` : 'Owner: pick which product builds next — "Build this one" on its page, with a reason.',
      who: building ? 'manager' : 'owner'};
  }
  if (flow.complete) {
    line.forEach((step, i) => { if (i > 0) step.state = 'done'; });
    return {...base, stepIndex: STEP_IDS.length - 1, line, building: true, status: 'Building · every check reviewed', next: 'Claude: review this cycle in Learning and save what we learned; that frees the build slot.', who: 'manager'};
  }
  line[at].state = 'current';
  const who = CHECK_WHO[flow.next?.id] || STAGE_WHO[flow.next?.stage] || 'checker';
  const next = who === 'owner' ? 'Owner: approve the test (going public, the budget and the max loss) before anything runs.' : `${whoName(who)}: ${flow.next.title}.`;
  return {...base, stepIndex: at, line, building: true, status: `Building · ${stage(at, STEP_NAMES[at])} checks`, next, who};
}

/** The checks of the steps before Create that are not reviewed: what a product launched early still owes. */
export function openBeforeBuild(stages, checks, market) {
  const early = new Set(stages.slice(0, BUILD_FROM).map(stage => stage.id));
  return checks.filter(check => early.has(check.stage) && effectiveCheckStatus(market, check.id) !== 'verified').map(check => ({id: check.id, title: check.title, stage: check.stage}));
}

function earlyItem({base, line, flow, market}) {
  // Prove it stays visibly open; Product is behind it (the owner saved the card); Buyers is set from the card.
  for (let i = PROVE_STEP; i < BUILD_FROM; i++) if (line[i].state !== 'done' || line[i].done < line[i].total) line[i].state = 'early';
  const step = flow.steps.slice(BUILD_FROM).find(item => item.state !== 'complete');
  if (!step) {
    for (let i = BUILD_FROM; i < STEP_IDS.length; i++) line[i].state = 'done';
    return {...base, stepIndex: STEP_IDS.length - 1, line, building: true, early: true, status: 'Built early · earlier checks open', next: 'Checker: record the checks still open from before the build (launched early).', who: 'checker'};
  }
  const at = step.index;
  line[at].state = 'current';
  const check = step.items.find(item => effectiveCheckStatus(market, item.id) !== 'verified');
  const who = CHECK_WHO[check?.id] || STAGE_WHO[step.id] || 'checker';
  const next = who === 'owner' ? 'Owner: approve the test (going public, the budget and the max loss) before anything runs.' : `${whoName(who)}: ${check?.title || STEP_NAMES[at]}.`;
  return {...base, stepIndex: at, line, building: true, early: true, status: `Building early · ${STEP_NAMES[at]} ${line[at].done}/${line[at].total}`, next, who};
}

/**
 * One row per product on the pipeline. A card alone (L###) is placed by its
 * eye-test and check state; a card with a started product record (P###) by the
 * product's own checks. Parked, passed, rejected, killed and reviewed items are
 * "out of the line" with their reason. Products not started from a card are
 * rows of their own, marked `unlinked`.
 */
export function pipelineItems({leads = [], products = [], archivedProducts = [], reviews = [], stages = [], checks = [], rounds = [], buildProductId = null, issues = null} = {}) {
  const reviewOf = new Map(reviews.map(review => [review.productId, review]));
  const entries = [...products.map(product => ({product, archived: false})), ...archivedProducts.map(product => ({product, archived: true}))];
  const byLead = new Map();
  for (const entry of entries) { const id = productLead(entry.product); if (id) byLead.set(id, [...(byLead.get(id) || []), entry]); }
  const known = new Set(leads.map(lead => lead.id));
  const building = buildProductId ? products.find(product => product.id === buildProductId) || null : null;
  const context = {stages, checks, buildProductId: building ? building.id : null, building};
  const items = [];
  const finish = (fields, {lead = null, product = null, round = null, linkedCount = 0}) => {
    const market = fields.market || (product ? primaryMarket(product) : null);
    const step = fields.stepIndex;
    if (product && lead) {
      const val = cardChecks(lead.candidate);
      fields.line[PRODUCT_STEP] = {...fields.line[PRODUCT_STEP], done: val.find};
      // A product past Buyers shows its card's buyers check honestly: done only when it passed.
      const buyersState = val.buyersPassed ? 'done' : fields.early ? 'early' : fields.line[BUYERS_STEP].state === 'stopped' ? 'stopped' : 'todo';
      fields.line[BUYERS_STEP] = {...fields.line[BUYERS_STEP], done: val.buyers, state: buyersState};
    }
    const item = {
      id: lead?.id || product.id, leadId: lead?.id || (product ? productLead(product) : '') || '', productId: product?.id || '', marketId: market?.id || '',
      // No chosen photo yet: the card's first saved picture (its video frames), so the owner sees the product, not its id.
      name: product?.name || lead?.name || lead?.id, image: lead?.image || savedMedia(lead?.candidate?.references, /\.(png|jpe?g|webp|avif)$/i), video: savedMedia(lead?.candidate?.references, /\.(mp4|webm)$/i), country: market?.country || lead?.candidate?.country || '',
      round: round?.number ?? null, roundId: round ? roundId(round.number) : '', issue: linkedIssues(round, lead?.candidate),
      stepIndex: step, stepId: STEP_IDS[step], stepName: STEP_NAMES[step], line: fields.line,
      status: fields.status, next: fields.next, who: fields.who, owner: fields.who === 'owner',
      outcome: fields.outcome, readyToBuild: Boolean(fields.readyToBuild), building: Boolean(fields.building) && !fields.outcome, early: Boolean(fields.early) && !fields.outcome,
      unlinked: Boolean(product && (!lead || !productLead(product))), linkedProducts: linkedCount,
      nextCheck: fields.flow?.next && !fields.outcome ? {id: fields.flow.next.id, title: fields.flow.next.title} : null,
      updatedAt: product?.updatedAt || '', evidenceOn: evidenceOn(lead?.candidate), sourcePath: lead?.sourcePath || '',
      // F1 at a glance for rows (top number + direction), from the saved card only; null without numbers.
      stats: lead?.candidate ? statsSummary(lead.candidate) : null,
      validation: lead?.candidate ? validationSnapshot(lead.candidate) : null,
    };
    items.push(item);
  };
  for (const lead of leads) {
    const linked = byLead.get(lead.id) || [];
    const entry = linked.find(item => !item.archived) || [...linked].sort((a, b) => String(b.product.updatedAt).localeCompare(String(a.product.updatedAt)))[0] || null;
    const round = roundOf(leadPaths(lead), rounds);
    const state = lineLeadState(lead);
    const options = {lead, product: entry?.product || null, round, linkedCount: linked.length};
    if (entry?.archived) finish(productItem(entry.product, {...context, archived: true, review: reviewOf.get(entry.product.id)}), options);
    // The product in the build slot follows its own checks even while its card is still being checked (launched early).
    else if (entry && entry.product.id === context.buildProductId && !['passed', 'rejected', 'parked', 'killed'].includes(state)) finish(productItem(entry.product, context), options);
    else if (['passed', 'rejected', 'parked', 'killed', 'failed', 'waiting', 'saved', 'ready'].includes(state) || !entry) finish(leadItem(lead, state, checks), options);
    else finish(productItem(entry.product, context), options);
  }
  for (const entry of entries) {
    if (known.has(productLead(entry.product))) continue;
    finish(productItem(entry.product, {...context, archived: entry.archived, review: reviewOf.get(entry.product.id)}), {product: entry.product});
  }
  return items;
}

/** Cards of a round that are still at Product, Buyers or Prove it, not yet ready to build (they block its review). */
export const roundBlockers = (items, number) => items.filter(item => item.round === number && !item.outcome && !item.readyToBuild && item.stepIndex <= PROVE_STEP);

const rowOrder = (a, b) => Number(b.building) - Number(a.building) || Number(b.readyToBuild) - Number(a.readyToBuild) || b.stepIndex - a.stepIndex || (b.round ?? 0) - (a.round ?? 0) || Number(String(b.id).slice(1, 4)) - Number(String(a.id).slice(1, 4)) || String(a.id).localeCompare(String(b.id));

/**
 * The whole pipeline: rows, counts per step, the rounds, the build slot, what
 * waits on the owner and the single most important next move (`focus`): the
 * building product first, then owner moves, then the earliest active item,
 * else "start a round".
 */
export function pipelineState(input = {}) {
  const items = pipelineItems(input).sort(rowOrder);
  const active = items.filter(item => !item.outcome), out = items.filter(item => item.outcome);
  const counts = Object.fromEntries(STEP_IDS.map(id => [id, 0]));
  counts.ready = 0;
  for (const item of active) { if (item.readyToBuild) counts.ready++; else counts[item.stepId]++; }
  Object.assign(counts, {active: active.length, out: out.length, total: items.length});
  // The issue library (GET /api/issues): a reference the Buyers step reads and adds to, never a step.
  const issues = issueRows(input.issues);
  const building = active.find(item => item.building) || null;
  const sorted = [...(input.rounds || [])].sort((a, b) => a.number - b.number);
  const rounds = sorted.map(round => {
    const mine = items.filter(item => item.round === round.number);
    const blockers = roundBlockers(items, round.number);
    const open = !round.review;
    return {...round, id: roundId(round.number), open, cards: mine.length, active: mine.filter(item => !item.outcome).length, out: mine.filter(item => item.outcome).length,
      inProductProve: blockers.length, blockerIds: blockers.map(item => item.id), canReview: open && !blockers.length, needsReview: open && !blockers.length && mine.length > 0};
  });
  const round = [...rounds].reverse().find(item => item.open) || rounds.at(-1) || null;
  const nextNumber = (sorted.at(-1)?.number || 0) + 1;
  const names = list => list.slice(0, 4).map(item => `${item.id} ${clip(item.name, 32)}`).join(', ') + (list.length > 4 ? ` and ${list.length - 4} more` : '');
  const ids = list => list.slice(0, 4).map(item => item.id).join(', ') + (list.length > 4 ? ` and ${list.length - 4} more` : '');
  // Each owner move has a full text (with names) and a short one (ids only) for the focus line.
  const ownerMoves = [];
  const launch = active.filter(item => item.building && item.who === 'owner');
  if (launch.length) ownerMoves.push({kind: 'launch', ids: launch.map(item => item.id), count: launch.length, step: launch[0].stepIndex, go: 'launch', text: `Approve the test for ${clip(launch[0].name, 40)}: going public, the budget and the max loss`, short: `approve the test for ${launch[0].id} (going public, the budget and the max loss)`});
  const ready = active.filter(item => item.readyToBuild);
  if (ready.length && !building) ownerMoves.push({kind: 'build-pick', ids: ready.map(item => item.id), count: ready.length, step: PROVE_STEP, go: 'winners', text: `Pick which product builds next: ${names(ready)} ("Build this one", with a reason)`, short: `pick which product builds next: ${ids(ready)} ("Build this one" on its page, with a reason)`});
  const eye = active.filter(item => item.stepIndex === PRODUCT_STEP && item.who === 'owner');
  if (eye.length) ownerMoves.push({kind: 'eye-test', ids: eye.map(item => item.id), count: eye.length, step: PRODUCT_STEP, go: 'find', text: `Eye test on ${plural(eye.length, 'card')}: ${names(eye)}`, short: `eye test on ${plural(eye.length, 'card')} (Find page): ${ids(eye)}`});
  let focus;
  if (building) focus = {kind: 'building', itemId: building.id, stepIndex: building.stepIndex, who: building.who, text: `${building.name}${building.country ? ` (${building.country})` : ''} is building: ${building.status}`, next: building.next};
  else if (ownerMoves.length) { const move = ownerMoves[0]; focus = {kind: 'owner', move: move.kind, itemId: move.ids[0], stepIndex: move.step, who: 'owner', text: move.text, next: `Owner: ${move.short}.`}; }
  else if (active.length) {
    // Earliest first: the lowest step; inside Prove it a card still being checked comes before a started product record.
    const first = [...active].sort((a, b) => (a.stepIndex + (a.readyToBuild ? 0.5 : 0)) - (b.stepIndex + (b.readyToBuild ? 0.5 : 0)) || Number(Boolean(a.productId)) - Number(Boolean(b.productId)) || (b.round ?? 0) - (a.round ?? 0))[0];
    focus = {kind: 'item', itemId: first.id, stepIndex: first.stepIndex, who: first.who, text: `${first.name}: ${first.status}`, next: first.next};
  } else if (round?.open && round.needsReview) focus = {kind: 'review-round', itemId: '', stepIndex: PRODUCT_STEP, who: 'manager', text: `Round ${round.number} is ready to review`, next: `Claude: review Round ${round.number} (os.mjs round review ${round.id}), then start Round ${nextNumber}.`};
  // An open round with no cards on the line is being searched: never "start the next round" (owner, Oct 1).
  else if (round?.open) focus = {kind: 'round-open', itemId: '', stepIndex: PRODUCT_STEP, who: 'scout', roundNumber: round.number, text: `Round ${round.number} is open: no cards yet`, next: `Scout: find Round ${round.number} picture cards for your eye test.`};
  // Nothing on the line (owner, Oct 3): a new round starts from an issue the owner is testing (step 0), then sales numbers.
  else focus = {kind: 'start-round', itemId: '', stepIndex: PRODUCT_STEP, who: 'scout', text: 'Nothing is on the line', next: `Scout: start Round ${nextNumber} where the sales numbers are hitting, from an issue the owner is testing (os.mjs round start --issue <slug> --focus "...").`};
  const duplicates = [];
  for (const item of items) if (item.linkedProducts > 1) duplicates.push({leadId: item.leadId, count: item.linkedProducts});
  return {items, active, out, counts, issues, building, buildProductId: building?.productId || null, rounds, round, nextNumber,
    earlier: items.filter(item => item.round === null).length, ownerMoves, focus, duplicates};
}

/**
 * The issue list's rows (step 0, owner Oct 3): one per issue (GET /api/issues
 * shape: slug, title, status, checks, rounds). `status` is the saved one
 * (Candidate, Verified, Testing, Parked; src/issueList.mjs); a list without it
 * (an older server) reads Verified from the file's gate. A missing list is an
 * empty one, never invented issues. Testing first.
 */
const ISSUE_ROW_ORDER = {testing: 0, verified: 1, candidate: 2, parked: 3};
export function issueRows(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.filter(issue => issue && issue.slug).map(issue => {
    const rounds = Array.isArray(issue.rounds) ? issue.rounds : [];
    const checks = Array.isArray(issue.checks) ? issue.checks : [];
    // Verified needs the seven I-checks (I1-I7, Oct 3); an older server's five-line gate never makes an issue Verified.
    const passed = issue.status ? ['verified', 'testing', 'parked'].includes(issue.status) && Boolean(issue.verified ?? true) : checks.length ? Boolean(issue.verified ?? issue.gatePassed) : false;
    return {slug: issue.slug, title: issue.title || issue.slug, path: issue.path || `resources/issues/${issue.slug}/ISSUE.md`, passed,
      status: issue.status || (passed ? 'verified' : 'candidate'), group: issue.group || '', productTypes: issue.productTypes || [],
      checks: checks.map(check => ({id: check.id, name: check.name, state: check.state})),
      gate: `${checks.filter(check => check.state === 'passed').length}/7`, rounds: rounds.map(round => round.id || round), open: rounds.some(round => round.open)};
  }).sort((a, b) => (ISSUE_ROW_ORDER[a.status] ?? 9) - (ISSUE_ROW_ORDER[b.status] ?? 9) || Number(b.open) - Number(a.open) || a.slug.localeCompare(b.slug));
}

/** Find one row by its card (L###) or product (P### or the full P###-slug) id. */
export function findItem(pipeline, key) {
  const id = String(key || '').trim();
  if (!id) return null;
  const items = pipeline?.items || [];
  return items.find(item => item.id === id || item.leadId === id || item.productId === id)
    || items.find(item => item.productId && /^P\d{3,}$/.test(id) && item.productId.startsWith(`${id}-`)) || null;
}

/** The step an agent works on now: the first of its steps with a product waiting, else its first step. */
export function agentFocus(pipeline, agent, line = null) {
  const steps = AGENT_STEPS[agent] || (line?.steps || []).filter(step => step.agents.includes(agent)).map(step => step.id);
  if (!steps.length) return null;
  const items = (pipeline?.active || []).filter(item => steps.includes(item.stepId) && !item.readyToBuild);
  // Products whose next move is this agent's come first.
  items.sort((a, b) => Number(b.who === agent) - Number(a.who === agent) || a.stepIndex - b.stepIndex);
  const first = items[0]?.stepId || steps[0];
  return {index: STEP_IDS.indexOf(first), id: first, steps, items, item: items.find(item => item.stepId === first) || null};
}
