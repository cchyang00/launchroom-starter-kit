// The seven gates (workflow/CHECKS.md, owner Oct 2; product first, then its
// buyers) and where the old checks went. Every saved check keeps its id: the card's Find, preflight and deep
// checks (research/comparison.json) and the product record's checks
// (server/domain.mjs). A new gate line reads the saved checks under it:
//   passed   every one passed, and the old checks asked for everything the line asks
//   partly   every one passed, but the line asks for more than the old checks did
//            ("old check passed, new part open"), never shown as a pass
//   failed   one of them failed
//   pending  anything else, including a line with no saved record yet
// Step 2 · Buyers reads the card's one buyers check (A1-A3, its own rules);
// a started product's buyer checks sit under it with the new parts open.
// Nothing here writes a record or ticks a gate. Pure; tested in server/gates.test.mjs.
import {STEP_IDS, STEP_NAMES} from './steps.mjs';
import {checkPasses, effectiveResearchGateStatus, STEP2_RULE_FROM, SCREEN_CHECK_IDS, buyersQuotesMet, buyersAvatarsMet, buyersGapMet} from './researchView.mjs';
import {effectiveCheckStatus} from './processModel.mjs';

/**
 * Each step's gate lines. `card` and `product` name the saved checks a line
 * reads (card: screen check or deep check ids; product: product check ids);
 * `part` marks a line that asks for more than its old checks did, for
 * evidence observed before the seven-step method took effect (METHOD_FROM).
 */
export const GATES = {
  // Owner, Oct 2: product first, from sales numbers; the benefit ladder ties it to the issue library; the angle gap on any channel.
  product: [
    {id: 'F1', label: 'Statistics: rising or stable demand', card: ['provenDemand']},
    {id: 'F2', label: 'Dropshippable', card: ['dropshippable']},
    {id: 'F3', label: 'A good product', card: ['looksWorth']},
    {id: 'F4', label: 'Several angles and avatars', card: ['audienceRoom']},
    {id: 'F5', label: 'Ties to our issues', card: ['bigIssue']},
    {id: 'F6', label: 'An angle gap', card: ['metaGap']},
  ],
  // Owner, Oct 2: after the Save, this product's own buyers (TikTok comments, 2-4 star reviews, forums). The avatar and fit work moved here from Prove it.
  buyers: [
    {id: 'A1', label: 'About 15 verified quotes', buyers: buyersQuotesMet, product: ['community', 'country-demand'], part: '15 quotes tied to this product'},
    {id: 'A2', label: 'Two or more avatars', buyers: buyersAvatarsMet, product: ['buyer-situation'], part: 'each avatar\'s trigger moment'},
    {id: 'A3', label: 'An angle nobody uses', buyers: buyersGapMet},
  ],
  prove: [
    {id: 'P1', label: 'Room on Meta', card: ['demand', 'competition'], product: ['trend-history', 'trend-trajectory', 'competition']},
    {id: 'P2', label: 'Same item, safe to sell', card: ['sourceMatch', 'sourcing'], product: ['exact-product', 'exact-source', 'product-safety']},
    {id: 'P3', label: 'Delivery promise', card: ['sourcing'], product: ['destination-route']},
    {id: 'P4', label: 'The money line', card: ['contribution'], product: ['economics'], part: 'break-even ROAS and the target cost per sale'},
    // Owner, Oct 3: no samples. P5 is claims we can back (a supplier spec or a review pattern of the same item type); the check id stays 'sample'.
    {id: 'P5', label: 'Claims we can back', card: ['fit'], product: ['sample']},
  ],
  create: [
    {id: 'C1', label: 'Concepts, not tweaks', product: ['angle-offer'], part: '3-5 concepts in 2-3 formats'},
    {id: 'C2', label: 'Compliance scan clean', product: ['claims-rights'], part: 'the scan of words on the image'},
    {id: 'C3', label: 'Claims match the exact item', product: ['claims-rights']},
    {id: 'C4', label: 'Phone first', product: ['creative-assets']},
  ],
  build: [
    {id: 'B1', label: 'The first phone screen holds it all', product: ['draft-page'], part: 'the 1, 2 and 3-pack offer'},
    {id: 'B2', label: 'No fake proof on the real store', product: ['draft-page']},
    {id: 'B3', label: 'Honest promises', product: ['service-promise']},
    {id: 'B4', label: 'Total cost and returns before checkout', product: ['checkout'], part: 'shipping and returns shown before checkout'},
    {id: 'B5', label: 'Checked on a phone; the offer still pays', product: ['checkout']},
  ],
  launch: [
    {id: 'L1', label: 'Test sheet saved before any spend', product: ['experiment-plan'], part: 'the written test sheet'},
    {id: 'L2', label: 'Test order'},
    {id: 'L3', label: 'One Purchase event', product: ['tracking'], part: 'one Purchase with no duplicate'},
    {id: 'L4', label: 'Taxes'},
    {id: 'L5', label: 'Owner approved', product: ['authorized-test']},
  ],
  learn: [
    {id: 'R1', label: 'Result card filled', product: ['result'], part: 'the result card'},
    {id: 'R2', label: 'A decision logged', product: ['case-review'], part: 'the decision log'},
    {id: 'R3', label: 'Lessons saved', product: ['case-review'], part: 'the Library entry and lesson'},
  ],
};
/** The seven-step method (workflow/CHECKS.md) took effect on this day; evidence observed from it on was recorded under its gates. */
export const METHOD_FROM = STEP2_RULE_FROM;
export const GATE_STATES = ['passed', 'partly', 'failed', 'pending', 'none'];

const SCREEN_IDS = new Set(SCREEN_CHECK_IDS);
/** One saved card check: passed, failed or pending (the Step 1 checks by their Oct 2 rules). */
export function cardCheckState(candidate, id) {
  if (!candidate) return 'pending';
  if (SCREEN_IDS.has(id)) {
    const check = candidate.screen?.checks?.[id];
    return checkPasses(id, check) ? 'passed' : check?.status === 'failed' ? 'failed' : 'pending';
  }
  const status = effectiveResearchGateStatus(candidate, id);
  return status === 'supported' ? 'passed' : status === 'failed' ? 'failed' : 'pending';
}
/** One saved product check: passed when reviewed (verified), else pending. */
export const productCheckState = (market, id) => market && effectiveCheckStatus(market, id) === 'verified' ? 'passed' : 'pending';

/** A Buyers line (A1-A3) from the card's one buyers check: failed, passed by its own rule, else pending. */
export function buyersLineState(candidate, test) {
  const check = candidate?.screen?.checks?.buyers;
  return check?.status === 'failed' ? 'failed' : check?.status === 'supported' && test(check) ? 'passed' : 'pending';
}

/** A gate line from the saved checks under it (see the states above). */
export function gateLine(line, {candidate = null, market = null} = {}) {
  const useProduct = Boolean(market && line.product?.length);
  if (line.buyers && !useProduct) {
    const state = buyersLineState(candidate, line.buyers);
    return {id: line.id, label: line.label, state, from: [{id: 'buyers', kind: 'card', state, observedAt: candidate?.screen?.checks?.buyers?.observedAt || ''}], open: ''};
  }
  const refs = useProduct ? line.product.map(id => ({id, kind: 'product', state: productCheckState(market, id), observedAt: market?.checks?.[id]?.observedAt || ''}))
    : line.card?.length ? line.card.map(id => ({id, kind: 'card', state: cardCheckState(candidate, id), observedAt: candidate?.screen?.checks?.[id]?.observedAt || candidate?.gates?.[id]?.observedAt || ''})) : [];
  const states = refs.map(ref => ref.state);
  // A line that asks for more than before: partly, unless every check under it was observed under the new rule.
  const older = Boolean(line.part) && refs.some(ref => !ref.observedAt || ref.observedAt < METHOD_FROM);
  const state = !refs.length ? 'pending' : states.includes('failed') ? 'failed' : states.every(value => value === 'passed') ? (older ? 'partly' : 'passed') : 'pending';
  return {id: line.id, label: line.label, state, from: refs, open: state === 'partly' ? line.part : ''};
}

/**
 * Every step's gate for one pipeline row: `candidate` the card, `market` the
 * product record's primary market (null before it starts). The issue library
 * is a reference, never a gate (owner, Oct 2).
 */
export function itemGates({candidate = null, market = null} = {}) {
  return STEP_IDS.map((step, index) => {
    const lines = GATES[step].map(line => gateLine(line, {candidate, market: step === 'product' ? null : market}));
    const passed = lines.filter(line => line.state === 'passed').length;
    return {step, index, number: index + 1, name: STEP_NAMES[index], lines, passed, total: lines.length, open: lines.length - passed};
  });
}

/** "P4 The money line: old check passed, new part open: break-even ROAS and the target cost per sale". */
export function gateLineText(line) {
  const words = {passed: 'passed', partly: `old check passed, new part open: ${line.open}`, failed: 'failed', pending: 'not yet'};
  return `${line.id} ${line.label}: ${words[line.state] || line.state}`;
}
