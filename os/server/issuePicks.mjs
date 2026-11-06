// The owner's issue picks (owner, Oct 3: "choosing a couple from the list of
// what we're testing"). os/data/issue-picks.json is authoritative and
// revision-checked: {revision, picks: {<slug>: {pick, at, undone?}}}. Only the
// owner's screen writes it; a write from an agent (the helper's local-agent
// header) is refused with OWNER_DECISION_ONLY. No typed reason, a 5-second
// Undo on the screen (the same pattern as the eye test).
import {fail, object, assertRevision} from './domain.mjs';
import {ISSUE_SLUG} from '../src/issues.mjs';
import {ISSUE_PICKS_PATH, PICKS, emptyPicks, pickProblem} from '../src/issueList.mjs';

export {ISSUE_PICKS_PATH, emptyPicks};
export const PICK_LIMITS = {issues: 500};
const ISO = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function validatePicks(raw) {
  object(raw, 'Issue picks');
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !raw.picks || typeof raw.picks !== 'object' || Array.isArray(raw.picks)) fail('Invalid saved issue picks. Restore os/data/issue-picks.json before picking.', 'MALFORMED_DATA', 500);
  const entries = Object.entries(raw.picks);
  if (entries.length > PICK_LIMITS.issues) fail('Too many saved issue picks.', 'MALFORMED_DATA', 500);
  for (const [slug, value] of entries) {
    if (value && (value.recordedBy !== undefined || value.source !== undefined || value.quote !== undefined) && (value.recordedBy !== 'manager' || value.source !== 'owner-chat' || typeof value.quote !== 'string' || !value.quote.trim() || value.quote.length > 1000)) fail(`The saved pick for "${slug}" says it was said in chat but its record is broken. Restore os/data/issue-picks.json.`, 'MALFORMED_DATA', 500);
    if (!ISSUE_SLUG.test(slug) || !value || typeof value !== 'object' || !PICKS.includes(value.pick) || !ISO(value.at) || (value.undone !== undefined && typeof value.undone !== 'boolean')) fail(`The saved pick for "${slug}" is broken. Restore os/data/issue-picks.json before picking.`, 'MALFORMED_DATA', 500);
  }
  return raw;
}

/**
 * The owner picks one issue: {revision, slug, pick: 'testing'|'parked'} or,
 * from Undo only, {revision, slug, pick: <the earlier pick or null>, undo: true}.
 * `entries` are the issue list entries (src/issueList.mjs issueEntries), so the
 * pick is judged on the issue's saved status. Returns {picks, saved}.
 */
export function updatePicks(raw, input, {entries = [], agent = false, now = new Date(), said = null} = {}) {
  // The pick is the owner's, like the eye test: agents read it, never write it.
  if (agent) fail('Only the owner picks which issues to test, on the Issues page (Test this issue or Not now).', 'OWNER_DECISION_ONLY', 403);
  const current = validatePicks(raw); object(input); assertRevision(current.revision, input.revision);
  const slug = String(input.slug ?? '').trim().toLowerCase();
  if (!ISSUE_SLUG.test(slug)) fail('Name the issue by its folder in resources/issues/.', 'ISSUE_MISSING', 404);
  const undo = input.undo === true;
  if (input.undo !== undefined && typeof input.undo !== 'boolean') fail('undo is true or left out.');
  const pick = input.pick === null || input.pick === undefined || input.pick === 'none' ? null : input.pick;
  const entry = entries.find(item => item.slug === slug) || null;
  const problem = pickProblem(entry, pick, {undo});
  if (problem) fail(problem.message, problem.code, problem.status, {issue: slug, ...(problem.open ? {open: problem.open} : {})});
  const next = structuredClone(current);
  const before = current.picks[slug]?.pick || null;
  if (pick === null) delete next.picks[slug];
  else next.picks[slug] = {pick, at: new Date(now).toISOString(), ...(undo ? {undone: true} : {}), ...(said ? {recordedBy: 'manager', source: 'owner-chat', quote: String(said.quote).trim().slice(0, 1000)} : {})};
  next.revision++;
  validatePicks(next);
  return {picks: next, saved: {slug, pick, before, undo}};
}
