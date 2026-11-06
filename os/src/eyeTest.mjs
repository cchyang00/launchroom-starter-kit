// The owner's eye test (Oct 3): "i dont want to always put in descriptions why i
// didnt choose the product." One tap decides; 0-2 quick-reason chips and a short
// note are optional and saved with the decision. Pure rules shared by the
// server (research.mjs, the scout's brief) and the screens.

export const REASON_TAGS = ['Looks cheap', 'Too saturated', 'Weak numbers', "Can't dropship", 'Not our niche', 'Too basic', 'Love it', 'Great angle'];
export const REASON_TAG_LIMIT = 2;
export const OWNER_NOTE_MAX = 2000;
export const UNDO_MS = 5000;
export const DECIDED = ['saved', 'passed', 'rejected'];
export const DECISION_WORDS = {saved: 'saved for checks', passed: 'passed for now', rejected: 'rejected'};

/** '' when the tags are fine, else the plain reason. */
export function reasonTagsProblem(tags) {
  if (tags === undefined) return '';
  if (!Array.isArray(tags)) return 'Quick reasons are a list.';
  if (tags.length > REASON_TAG_LIMIT) return `Pick at most ${REASON_TAG_LIMIT} quick reasons.`;
  if (tags.some(tag => !REASON_TAGS.includes(tag))) return `Quick reasons are: ${REASON_TAGS.join(', ')}.`;
  if (new Set(tags).size !== tags.length) return 'Pick each quick reason once.';
  return '';
}

/** Tap a chip: on or off; a third chip drops the oldest, so a tap always does something. */
export function toggleReasonTag(tags = [], tag) {
  if (!REASON_TAGS.includes(tag)) return tags;
  if (tags.includes(tag)) return tags.filter(item => item !== tag);
  return [...tags, tag].slice(-REASON_TAG_LIMIT);
}

/** The decision part of a card's screen, normalized (missing fields read as empty). */
export function decisionOf(screen) {
  return {
    ownerDecision: screen?.ownerDecision || 'unreviewed',
    ownerReason: typeof screen?.ownerReason === 'string' ? screen.ownerReason : '',
    reasonTags: Array.isArray(screen?.reasonTags) ? screen.reasonTags : [],
  };
}
export const sameDecision = (a, b) => JSON.stringify(decisionOf(a)) === JSON.stringify(decisionOf(b));

/** What the owner said, as one line: chips first, then the note ('' when nothing was given). */
export function ownerReasonLine(screen) {
  const {reasonTags, ownerReason} = decisionOf(screen);
  return [reasonTags.join(' · '), ownerReason.trim()].filter(Boolean).join(' — ');
}

/**
 * The candidate the owner's tap writes: the decision plus optional chips and
 * note. An empty reason stays empty; nothing is made up.
 */
export function eyeTestCandidate(lead, decision, {tags = [], note = ''} = {}, emptyCard) {
  if (!DECIDED.includes(decision)) throw new Error('Choose save, pass or reject.');
  const problem = reasonTagsProblem(tags);
  if (problem) throw new Error(problem);
  const why = String(note || '').trim();
  if (why.length > OWNER_NOTE_MAX) throw new Error(`Keep the note under ${OWNER_NOTE_MAX} characters.`);
  const next = lead.candidate ? structuredClone(lead.candidate) : emptyCard(lead);
  delete next.missingEvidence;
  next.screen = {...next.screen, ownerDecision: decision, ownerReason: why, reasonTags: [...tags]};
  delete next.screen.said; // the owner's own tap replaces a decision said in chat
  delete next.screen.decidedAt; // the server stamps it
  return next;
}

/** Undo: the latest saved card with its earlier decision put back. */
export function undoCandidate(current, before) {
  const next = structuredClone(current);
  delete next.missingEvidence;
  const was = decisionOf(before);
  next.screen = {...next.screen, ...was};
  delete next.screen.decidedAt;
  return next;
}

/**
 * The owner's recent reason chips, for the scout: counts across the last
 * `limit` decided cards (newest first by decidedAt; undated ones count as oldest).
 */
export function reasonTagCounts(candidates = [], limit = 20) {
  const decided = candidates.map((c, index) => ({c, index})).filter(({c}) => DECIDED.includes(c?.screen?.ownerDecision))
    .sort((a, b) => String(b.c.screen.decidedAt || '').localeCompare(String(a.c.screen.decidedAt || '')) || b.index - a.index)
    .slice(0, limit);
  const counts = new Map();
  for (const {c} of decided) for (const tag of decisionOf(c.screen).reasonTags) if (REASON_TAGS.includes(tag)) counts.set(tag, (counts.get(tag) || 0) + 1);
  return {decisions: decided.length, counts: [...counts].sort((a, b) => b[1] - a[1] || REASON_TAGS.indexOf(a[0]) - REASON_TAGS.indexOf(b[0]))};
}

/** One compact brief line for the scout, or '' while no chips were tapped. */
export function reasonTagsMarkdown(candidates, limit = 20) {
  const {decisions, counts} = reasonTagCounts(candidates, limit);
  if (!counts.length) return '';
  return `## What the owner says on the eye test\n\nOwner's last ${decisions} decisions: ${counts.map(([tag, n]) => `${tag} ×${n}`).join(', ')}. Find more of what they like; filter harder on what they turn down.\n`;
}

// Owner decisions said in chat (owner, Oct 3: "if you cant run the pipeline by
// yourself and i have to manual this process all the time. clearly something is
// wrong"). The manager records a decision the owner gave in chat through one
// path, `os.mjs owner-said`, always with the owner's own words. The record says
// so (`said`), Launchroom labels it "Said in chat" with the quote, and the
// owner can undo it with one tap. Agents still never decide.
export const SAID_SOURCE = 'owner-chat';
export const SAID_BY = 'manager';
export const OWNER_SAID_ACTIONS = ['save', 'pass', 'reject', 'build', 'test-issue', 'park-issue', 'approve'];
export const SAID_DECISIONS = {save: 'saved', pass: 'passed', reject: 'rejected'};
export const QUOTE_MIN = 3, QUOTE_MAX = 1000;
const SAID_ISO = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** '' when the owner's quote is usable, else why not. The quote is required: no quote, no decision. */
export function quoteProblem(quote) {
  const text = typeof quote === 'string' ? quote.trim() : '';
  if (!text) return "Give the owner's exact words from chat with --quote. Without them nothing is recorded.";
  if (text.length < QUOTE_MIN) return "The quote is too short to show the owner's own words.";
  if (text.length > QUOTE_MAX) return `Keep the quote under ${QUOTE_MAX} characters.`;
  return '';
}

/** The chat record on a card's screen, or null. */
export const saidOf = screen => screen?.said && typeof screen.said === 'object' ? screen.said : null;

/** '' when a saved `said` record has the right shape, else the problem. */
export function saidProblem(said) {
  if (said === undefined || said === null) return '';
  if (typeof said !== 'object' || Array.isArray(said)) return 'A chat decision record is an object.';
  const extra = Object.keys(said).filter(key => !['recordedBy', 'source', 'quote', 'at', 'before'].includes(key));
  if (extra.length) return `A chat decision record has unknown fields: ${extra.join(', ')}.`;
  if (said.recordedBy !== SAID_BY || said.source !== SAID_SOURCE) return 'A chat decision is recorded by the manager from the owner\'s chat.';
  const problem = quoteProblem(said.quote);
  if (problem) return problem;
  if (!SAID_ISO(said.at)) return 'A chat decision says when it was recorded.';
  if (!said.before || typeof said.before !== 'object' || !['unreviewed', ...DECIDED].includes(said.before.ownerDecision)) return 'A chat decision keeps the decision before it, for Undo.';
  return '';
}

/** The card after a chat decision: the decision, the quote as its reason, and the record of who said it. */
export function ownerSaidCandidate(candidate, decision, quote, at = new Date()) {
  if (!DECIDED.includes(decision)) throw new Error('Choose save, pass or reject.');
  const problem = quoteProblem(quote);
  if (problem) throw new Error(problem);
  const next = structuredClone(candidate);
  delete next.missingEvidence;
  const words = quote.trim();
  next.screen = {...next.screen, ownerDecision: decision, ownerReason: words, reasonTags: [],
    said: {recordedBy: SAID_BY, source: SAID_SOURCE, quote: words, at: new Date(at).toISOString(), before: decisionOf(candidate.screen)}};
  delete next.screen.decidedAt;
  return next;
}

/** Undo a chat decision: the decision before it comes back and the chat record goes. */
export function undoSaidCandidate(current) {
  const said = saidOf(current?.screen);
  const next = undoCandidate(current, said?.before || {ownerDecision: 'unreviewed'});
  delete next.screen.said;
  return next;
}
