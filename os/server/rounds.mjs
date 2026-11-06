// Rounds (owner, Oct 1): each new Find batch starts a numbered round. When a
// round's cards have all left Product and Prove it, a short review is saved and
// the next round starts. Old rounds stay as history. os/data/rounds.json is
// authoritative (revision-checked); memory/ROUNDS.md is its reading page.
// A card belongs to the earliest round whose folder its paths use (pipeline.mjs).
import {fail, object, text, assertRevision} from './domain.mjs';
import {roundId, roundFolder, ROUNDS_PATH, ROUNDS_DOC} from '../src/pipeline.mjs';
import {ISSUE_SLUG, issuePath} from '../src/issues.mjs';
import {roundIssueProblem} from '../src/issueList.mjs';

export {ROUNDS_PATH, ROUNDS_DOC};
export const ROUND_LIMITS = {rounds: 500, folders: 20, focus: 300, review: 2000};
const FOLDER = /^research\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\/$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const emptyRounds = () => ({revision: 0, rounds: []});
/**
 * Owner, Oct 3: the issue list comes first; "it's all about choosing a couple
 * from the list of what we're testing and finding products to match." A round
 * that names an issue needs one the owner is Testing (step 0). A round may
 * still start from a focus alone. (Oct 1 to Oct 2 rounds had to name a passed
 * issue; ISSUE_RULE_FROM stays for that history.)
 */
export const ISSUE_RULE_FROM = '2026-10-02';
const chicagoDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(at));

function day(value, label, today) {
  if (typeof value !== 'string' || !DAY.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${label} must be a real YYYY-MM-DD date.`);
  if (today && value > today) fail(`${label} cannot be in the future.`);
  return value;
}
function folders(value) {
  if (!Array.isArray(value) || !value.length || value.length > ROUND_LIMITS.folders) fail(`A round needs 1 to ${ROUND_LIMITS.folders} research batch folders, such as research/2026-10-02-pet-batch/.`);
  const list = value.map(item => {
    const folder = roundFolder(text(item, 'Round folder', {required: true, max: 140}));
    if (!FOLDER.test(folder) || folder.includes('..')) fail(`Use a research batch folder such as research/2026-10-02-pet-batch/ (got "${item}").`);
    return folder;
  });
  if (new Set(list).size !== list.length) fail('A round lists each folder once.');
  return list;
}
function issueSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase();
  if (!ISSUE_SLUG.test(slug)) fail(`"${value}" is not an issue name. Use the folder name in resources/issues/, such as sleep.`, 'ISSUE_MISSING');
  return slug;
}
/**
 * Refuse a round whose issue the owner is not Testing: missing (ISSUE_MISSING),
 * a Candidate (ISSUE_GATE_OPEN), Verified but not picked (ISSUE_NOT_PICKED) or
 * set aside (ISSUE_PARKED). `issues` are issue list entries with their status.
 */
function requireTestingIssue(slug, issues) {
  const issue = slug ? issues.find(item => item.slug === slug) || null : null;
  const problem = roundIssueProblem(issue, slug || '');
  if (problem) fail(problem.message, problem.code, problem.code === 'ISSUE_MISSING' ? 400 : 409, {issue: slug || '', path: slug ? issuePath(slug) : ''});
}
/** History (import): a round that names an issue needs only the issue's folder to exist. */
function requireKnownIssue(slug, issues) {
  if (!issues.some(item => item.slug === slug)) fail(`No issue at ${issuePath(slug)} for an imported round. Import it without the issue, or add the issue first.`, 'ISSUE_MISSING', 400, {issue: slug, path: issuePath(slug)});
}
function review(value, today) {
  object(value, 'Round review');
  return {
    reviewedOn: day(value.reviewedOn ?? today, 'Reviewed on', today),
    whatWorked: text(value.whatWorked, 'What worked', {required: true, max: ROUND_LIMITS.review}),
    whatFailed: text(value.whatFailed, 'What failed', {required: true, max: ROUND_LIMITS.review}),
    nextChanges: text(value.nextChanges, 'Next changes', {required: true, max: ROUND_LIMITS.review}),
  };
}
/** One round in its saved shape; the id is always R + the two-digit number. */
function roundFields(value, today) {
  object(value, 'Round');
  if (!Number.isSafeInteger(value.number) || value.number < 1 || value.number > 999) fail('A round number is a whole number from 1 to 999.');
  if (value.id !== undefined && value.id !== roundId(value.number)) fail(`Round ${value.number} has the id ${roundId(value.number)}.`);
  return {
    id: roundId(value.number), number: value.number,
    startedOn: day(value.startedOn, 'Started on', today),
    focus: text(value.focus, 'Round focus', {required: true, max: ROUND_LIMITS.focus}),
    folders: folders(value.folders),
    ...(value.issue !== undefined && value.issue !== '' ? {issue: issueSlug(value.issue)} : {}),
    ...(value.review ? {review: review(value.review, today)} : {}),
  };
}

export function validateRounds(raw) {
  object(raw, 'Rounds');
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.rounds) || raw.rounds.length > ROUND_LIMITS.rounds) fail('Invalid saved rounds. Restore the record before editing.', 'MALFORMED_DATA', 500);
  const numbers = new Set(), seen = new Set();
  for (const round of raw.rounds) {
    roundFields(round);
    if (round.id !== roundId(round.number)) fail('A saved round has the wrong id.', 'MALFORMED_DATA', 500);
    if (numbers.has(round.number)) fail(`Round ${round.number} is saved twice.`, 'MALFORMED_DATA', 500);
    numbers.add(round.number);
    for (const folder of round.folders) { if (seen.has(folder)) fail(`${folder} belongs to two rounds.`, 'MALFORMED_DATA', 500); seen.add(folder); }
  }
  return raw;
}

/**
 * Start, review or import rounds (one revision-checked write).
 * - start: {focus, folders, startedOn?} becomes the next number.
 * - review: {id, whatWorked, whatFailed, nextChanges, reviewedOn?} once none of
 *   its cards are at Product, Buyers or Prove it.
 * - focus: {id, focus?, issue?} rewrites an open round's focus (the owner
 *   changed the niche mid-round) and/or links the issue it works from (a
 *   legacy round started before the issue rule); the issue's gate must have
 *   passed. A reviewed round keeps its focus and issue as history.
 * - import: {rounds: [...]} adds the rounds whose number is not saved yet and
 *   skips the rest; a round imported with a review must already be finished.
 * `blockersFor(rounds, number)` returns the round's cards still in Find or
 * Validate, worked out with the proposed rounds (pipeline.mjs roundBlockers).
 */
export function updateRounds(raw, input, {blockersFor = () => [], now = new Date(), issues = []} = {}) {
  const current = validateRounds(raw); object(input); assertRevision(current.revision, input.revision);
  const today = chicagoDay(now);
  const next = structuredClone(current);
  const taken = folder => next.rounds.find(round => round.folders.includes(folder));
  const unfinished = (rounds, round) => {
    const blockers = blockersFor(rounds, round.number);
    if (blockers.length) fail(`${round.id} still has ${blockers.length} card${blockers.length === 1 ? '' : 's'} at Product, Buyers or Prove it (${blockers.slice(0, 6).map(item => item.id || item).join(', ')}${blockers.length > 6 ? ', …' : ''}). Review it once they have moved on or left the line.`, 'ROUND_NOT_FINISHED', 409, {round: round.id, blockers: blockers.map(item => item.id || item)});
  };
  let imported = [], skipped = [], saved = null;
  if (input.action === 'start') {
    const number = next.rounds.reduce((max, round) => Math.max(max, round.number), 0) + 1;
    // A round that names an issue tests it: the owner must be Testing it (owner, Oct 3). A focus alone still works.
    const slug = input.issue === undefined || input.issue === null || String(input.issue).trim() === '' ? '' : issueSlug(input.issue);
    if (slug) requireTestingIssue(slug, issues);
    saved = roundFields({number, startedOn: input.startedOn ?? today, focus: input.focus, folders: input.folders, issue: slug}, today);
    for (const folder of saved.folders) { const owner = taken(folder); if (owner) fail(`${folder} already belongs to ${owner.id}.`, 'ROUND_FOLDER_TAKEN', 409); }
    next.rounds.push(saved);
  } else if (input.action === 'review') {
    const key = String(input.id ?? '').trim().toUpperCase();
    const round = next.rounds.find(item => item.id === key || String(item.number) === key.replace(/^R0*/, ''));
    if (!round) fail(`No round ${input.id ?? ''}. List them with os.mjs rounds.`, 'NOT_FOUND', 404);
    if (round.review) fail(`${round.id} was already reviewed on ${round.review.reviewedOn}.`, 'ROUND_REVIEWED', 409);
    round.review = review(input, today);
    unfinished(next.rounds, round);
    saved = round;
  } else if (input.action === 'focus') {
    const key = String(input.id ?? '').trim().toUpperCase();
    const round = next.rounds.find(item => item.id === key || String(item.number) === key.replace(/^R0*/, ''));
    if (!round) fail(`No round ${input.id ?? ''}. List them with os.mjs rounds.`, 'NOT_FOUND', 404);
    if (round.review) fail(`${round.id} was reviewed on ${round.review.reviewedOn}; only an open round's focus or issue can change.`, 'ROUND_REVIEWED', 409);
    const hasFocus = input.focus !== undefined && input.focus !== null && String(input.focus).trim() !== '';
    const hasIssue = input.issue !== undefined && input.issue !== null && String(input.issue).trim() !== '';
    if (!hasFocus && !hasIssue) fail(`Give ${round.id} a new focus or an issue (os.mjs round focus ${round.id} --issue <slug>).`);
    const focus = hasFocus ? text(input.focus, 'Round focus', {required: true, max: ROUND_LIMITS.focus}) : round.focus;
    // Linking an issue to an open round: the owner must be Testing it, as for a new round.
    const slug = hasIssue ? issueSlug(input.issue) : round.issue || '';
    if (hasIssue) requireTestingIssue(slug, issues);
    if (focus === round.focus && slug === (round.issue || '')) fail(hasIssue && !hasFocus ? `${round.id} already works from the ${slug} issue.` : `${round.id} already has that focus.`, 'ROUND_FOCUS_SAME', 409);
    round.focus = focus;
    if (slug) round.issue = slug;
    saved = round;
  } else if (input.action === 'import') {
    if (!Array.isArray(input.rounds) || !input.rounds.length || input.rounds.length > 100) fail('Import 1 to 100 rounds: {rounds: [{number, startedOn, focus, folders, review?}]}.');
    for (const value of input.rounds) {
      const round = roundFields(value, today);
      if (next.rounds.some(item => item.number === round.number)) { skipped.push(round.id); continue; }
      // History: a round that names an issue needs only the issue to exist.
      if (round.issue) requireKnownIssue(round.issue, issues);
      for (const folder of round.folders) { const owner = taken(folder); if (owner) fail(`${folder} already belongs to ${owner.id}.`, 'ROUND_FOLDER_TAKEN', 409); }
      next.rounds.push(round); imported.push(round.id);
    }
    next.rounds.sort((a, b) => a.number - b.number);
    for (const id of imported) { const round = next.rounds.find(item => item.id === id); if (round.review) unfinished(next.rounds, round); }
  } else fail('Choose a round action: start, review, focus or import.');
  if (imported.length || saved) next.revision++;
  validateRounds(next);
  return {rounds: next, imported, skipped, saved};
}

const one = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
/** memory/ROUNDS.md: every round, newest first, with its cards when the pipeline is known. */
export function roundsMarkdown(record, summary = []) {
  const info = new Map(summary.map(round => [round.number, round]));
  const rounds = [...record.rounds].sort((a, b) => b.number - a.number);
  return `# Rounds\n\nGenerated from ${ROUNDS_PATH} revision ${record.revision}. Each Find batch starts a numbered round; a round is reviewed once none of its cards are at Product, Buyers or Prove it. Start one from an issue the owner is Testing with \`os.mjs round start --issue <slug> --focus "..." --folder research/<batch>/\` (step 0, the issue list; a focus alone still works; workflow/CHECKS.md, Step 1); review it with \`os.mjs round review R## --worked ... --failed ... --next ...\`. Products already past Prove it continue on their own line.\n\n${rounds.map(round => {
    const s = info.get(round.number);
    const cards = s ? `\n\nCards: ${s.cards} (${s.active} on the line, ${s.out} out of the line${s.inProductProve ? `, ${s.inProductProve} still at Product, Buyers or Prove it` : ''}).` : '';
    const body = round.review ? `\n\nReviewed ${round.review.reviewedOn}.\n\n- What worked: ${one(round.review.whatWorked)}\n- What failed: ${one(round.review.whatFailed)}\n- Next changes: ${one(round.review.nextChanges)}` : '\n\nOpen.';
    return `## ${round.id} · Round ${round.number} · started ${round.startedOn}\n\n${one(round.focus)}\n\n${round.issue ? `Issue: ${round.issue} (${issuePath(round.issue)})\n\n` : ''}Folders: ${round.folders.join(', ')}${cards}${body}\n`;
  }).join('\n') || 'No rounds yet.\n'}`;
}
