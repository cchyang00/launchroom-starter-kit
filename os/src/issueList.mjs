// Step 0 · the issue list (owner, Oct 3): "it's all about choosing a couple
// from the list of what we're testing and finding products to match. it should
// be a very clean process to where we've streamlined the part of finding
// products because we've already done the hard part."
//
// Pure rules shared by the server, the helper and the screens. An issue's
// status is derived from saved records only, never from where it sits on screen:
//   Candidate  a Gemini report or an unfinished gate (I1-I7 not all passed;
//              a file without the I6 and I7 lines stays here)
//   Verified   all seven checks passed in the file
//   Testing    the owner picked it to test (os/data/issue-picks.json)
//   Parked     the owner set it aside ("Not now")
// Only the owner picks; agents read. Rounds start from Testing issues.
import {ISSUE_CHECKS, ISSUE_SLUG, ISSUES_ROOT, ISSUE_FILE, issuePath} from './issues.mjs';

export const ISSUE_PICKS_PATH = 'os/data/issue-picks.json';
export const ISSUE_STATUSES = ['testing', 'verified', 'candidate', 'parked'];
export const STATUS_LABELS = {candidate: 'Candidate', verified: 'Verified', testing: 'Testing', parked: 'Parked'};
export const STATUS_HINTS = {
  candidate: 'Still being checked: Gemini found it or the gate is unfinished.',
  verified: 'All seven checks pass. The owner can pick it to test.',
  testing: 'The owner is testing it. Rounds start from it.',
  parked: 'The owner set it aside for now.',
};
export const PICKS = ['testing', 'parked'];
/** The checks added on Oct 3 (owner: "if a user is just complaining. it doesnt always mean they want to buy something"). */
export const NEW_CHECKS = ['I6', 'I7'];
/** "A couple at a time" (owner): a soft hint above this many, never a block. */
export const TESTING_SOFT_LIMIT = 3;
/** A Verified issue nobody picked or parked for this long is flagged by the doctor. */
export const VERIFIED_QUIET_DAYS = 14;
export const PICK_WORDS = {testing: 'is now Testing', parked: 'is set aside (Not now)', none: 'is back to Verified'};

const clip = (value, max) => { const s = String(value ?? '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s; };
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const emptyPicks = () => ({revision: 0, picks: {}});

/** The status of one parsed issue with its saved pick (or none). */
export function issueStatus(issue, pick = null) {
  if (pick?.pick === 'testing') return 'testing';
  if (pick?.pick === 'parked') return 'parked';
  return issue?.verified ? 'verified' : 'candidate';
}

/** The I-checks still open (or only partly met), as ids. */
export const openChecks = issue => (issue?.checks || ISSUE_CHECKS.map(check => ({...check, state: 'open'}))).filter(check => check.state !== 'passed');
/** "I2 Deep, I6 Wants to buy" for messages (every open check by default). */
export const openChecksText = (issue, max = ISSUE_CHECKS.length) => { const open = openChecks(issue); return open.slice(0, max).map(check => `${check.id} ${check.name}`).join(', ') + (open.length > max ? ', …' : ''); };
/** The seven dots as text for the helper: "I1✓ I2· I3✓ I4~ I5· I6· I7·". */
export const dotsText = issue => (issue?.checks || []).map(check => `${check.id}${check.state === 'passed' ? '✓' : check.state === 'partly' ? '~' : '·'}`).join(' ');

/**
 * Each parsed issue as a list entry: its status, its saved pick, the rounds
 * that name it (oldest first) and whether one is open. `rounds` are the saved
 * rounds; `picks` the saved picks record.
 */
export function issueEntries(issues = [], {rounds = [], picks = null} = {}) {
  const saved = picks?.picks || {};
  return issues.map(issue => {
    const pick = saved[issue.slug] || null;
    const mine = rounds.filter(round => round.issue === issue.slug).sort((a, b) => a.number - b.number).map(round => ({id: round.id, number: round.number, open: !round.review, startedOn: round.startedOn}));
    const status = issueStatus(issue, pick);
    const passed = (issue.checks || []).filter(check => check.state === 'passed').length;
    return {...issue, rounds: mine, openRound: mine.some(round => round.open), pick, status, passedChecks: passed, reopened: Boolean(pick) && !issue.verified};
  });
}

/** How many issues have each status, plus the total. */
export function issueCounts(entries = []) {
  const counts = Object.fromEntries(ISSUE_STATUSES.map(status => [status, 0]));
  for (const entry of entries) counts[entry.status] = (counts[entry.status] || 0) + 1;
  return {...counts, total: entries.length};
}

const ORDER = Object.fromEntries(ISSUE_STATUSES.map((status, index) => [status, index]));
/** Testing first, then Verified, Candidate, Parked; within each, more checks passed first, then the title. */
export function sortIssues(entries = []) {
  return [...entries].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || (b.passedChecks || 0) - (a.passedChecks || 0) || String(a.title).localeCompare(String(b.title)));
}

/** The list the page shows: one status (or all) and a search over title, group, products and slug. */
export function filterIssues(entries = [], {status = 'all', query = ''} = {}) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  return sortIssues(entries).filter(entry => (status === 'all' || entry.status === status)
    && words.every(word => [entry.title, entry.group, entry.slug, ...(entry.productTypes || []), ...(entry.searchTerms || [])].join(' ').toLowerCase().includes(word)));
}

/** The soft hint when more than a couple are being tested (never a block). */
export function testingHint(entries = []) {
  const testing = entries.filter(entry => entry.status === 'testing').length;
  return testing > TESTING_SOFT_LIMIT ? `${testing} issues are Testing. The method says a couple at a time, so the scout can go deep on each.` : '';
}

/**
 * Why the owner's pick cannot be saved, or null. `pick` is 'testing',
 * 'parked' or null (back to Verified, which only Undo sends). A Candidate
 * cannot be picked; a picked issue can always switch or be set aside.
 */
export function pickProblem(entry, pick, {undo = false} = {}) {
  if (!entry) return {code: 'ISSUE_MISSING', status: 404, message: 'No such issue in resources/issues/.'};
  if (pick !== null && !PICKS.includes(pick)) return {code: 'VALIDATION_ERROR', status: 400, message: 'Pick "testing" or "parked".'};
  if (undo) return null;
  if (pick === null) return {code: 'VALIDATION_ERROR', status: 400, message: 'Only Undo clears a pick.'};
  if ((entry.pick?.pick || null) === pick) return {code: 'ISSUE_PICK_SAME', status: 409, message: `${entry.slug} ${pick === 'testing' ? 'is already Testing' : 'is already set aside'}.`};
  if (pick === 'testing' && !entry.verified) return {code: 'ISSUE_NOT_VERIFIED', status: 409, message: `${entry.slug} is a Candidate: ${openChecksText(entry)} still open. Only a Verified issue (all of I1-I7) can be tested.`, open: openChecks(entry).map(check => check.id)};
  if (pick === 'parked' && !entry.verified && !entry.pick) return {code: 'ISSUE_NOT_VERIFIED', status: 409, message: `${entry.slug} is a Candidate: ${openChecksText(entry)} still open. Only a Verified issue can be set aside.`, open: openChecks(entry).map(check => check.id)};
  return null;
}

/**
 * Why a new round may not start from this issue, or null when it may (it is
 * Testing). The codes are what the API, the helper and the screens read (LS-073).
 */
export function roundIssueProblem(entry, slug = entry?.slug || '') {
  if (!slug) return {code: 'ISSUE_MISSING', message: `Name the issue the round tests: --issue <slug> for a Testing issue in ${ISSUES_ROOT}/ (workflow/CHECKS.md, the issue list).`};
  if (!ISSUE_SLUG.test(slug)) return {code: 'ISSUE_MISSING', message: `"${slug}" is not an issue name. Use the folder name in ${ISSUES_ROOT}/, such as crafters.`};
  if (!entry) return {code: 'ISSUE_MISSING', message: `No issue at ${issuePath(slug)}. Fill templates/ISSUE.md there first (workflow/CHECKS.md, the issue list).`};
  const status = entry.status || issueStatus(entry, entry.pick);
  if (status === 'testing') return null;
  if (status === 'verified') return {code: 'ISSUE_NOT_PICKED', message: `${slug} is Verified, but the owner has not picked it to test. Rounds start from Testing issues: the owner presses "Test this issue" on the Issues page (#/issues?issue=${slug}).`};
  if (status === 'parked') return {code: 'ISSUE_PARKED', message: `The owner set ${slug} aside ("Not now"). Start the round from a Testing issue, or ask the owner to test this one.`};
  const dots = dotsText(entry);
  return {code: 'ISSUE_GATE_OPEN', message: `${slug} is a Candidate: ${openChecksText(entry)} still open${dots ? ` (${dots})` : ''}. Finish its research and cross-referencing first; then the owner can pick it (workflow/CHECKS.md, the issue list).`};
}

/**
 * Step 0 at a glance for the sidebar, Home and the Pipeline: how many issues,
 * how many the owner is testing, how many are Verified and waiting for a pick
 * (the owner's move when nothing is being tested).
 */
export function issueStation(entries = []) {
  const counts = issueCounts(entries);
  const testing = entries.filter(entry => entry.status === 'testing');
  const waiting = counts.verified;
  const owner = waiting > 0 && !testing.length;
  const label = !counts.total ? 'no issues yet' : testing.length ? `${testing.length} testing` : waiting ? `${waiting} to pick` : 'none verified yet';
  return {id: 'issues', number: 0, name: 'Issues', count: counts.total, testing: testing.length, verified: waiting, candidate: counts.candidate, parked: counts.parked, owner, label,
    testingSlugs: testing.map(entry => entry.slug), text: counts.total ? `${counts.total} · ${label}` : label};
}

/** One issue's search line for the scout: its product types, TikTok terms and what fails them today. */
function searchLine(entry) {
  const types = (entry.productTypes || []).slice(0, 4).join('; ') || 'none listed';
  const terms = (entry.searchTerms || []).slice(0, 4).map(term => `"${term}"`).join(', ');
  const fails = entry.failing?.length ? entry.failing.slice(0, 2).join('; ') : (entry.tried || []).slice(0, 3).map(item => item.fix).join('; ');
  return `  Search for: ${clip(types, 160)}${terms ? `. TikTok Shop: ${clip(terms, 140)}` : ''}${fails ? `. What fails them today: ${clip(fails, 140)}` : ''}.`;
}

/**
 * The scout's brief block: the Testing issues, each with the products to
 * search and what fails them today (the search list). Empty when nothing is tested.
 */
export function scoutIssuesMarkdown(entries = []) {
  const testing = sortIssues(entries.filter(entry => entry.status === 'testing'));
  const counts = issueCounts(entries);
  if (!testing.length) return `## Issues being tested (step 0)\n\nNone yet: ${counts.verified ? `${plural(counts.verified, 'Verified issue')} wait${counts.verified === 1 ? 's' : ''} for the owner's pick` : 'no issue is Verified yet'} (#/issues). Until one is tested, work the open round's focus.\n\n`;
  return `## Issues being tested (step 0): your search list\n\nFind products that match these. A round starts from one (\`os.mjs round start --issue <slug>\`); every card still needs F1-F6.\n\n${testing.slice(0, 4).map(entry => `- **${entry.slug}**: ${clip(entry.title, 90)}${entry.group ? ` (${clip(entry.group, 70)})` : ''}${entry.openRound ? ` · ${entry.rounds.filter(round => round.open).map(round => `Round ${round.number}`).join(', ')} open` : ' · no open round yet'}\n${searchLine(entry)}`).join('\n')}${testing.length > 4 ? `\n- …and ${testing.length - 4} more: \`os.mjs issues --status testing\`` : ''}\n\n`;
}

/**
 * The buyer researcher's brief block: Candidates to cross-reference, each with
 * the I-checks still open; the closest to Verified first (a half point for a
 * check the older gate partly met), Gemini-only folders last. Empty when none.
 */
export function researcherIssuesMarkdown(entries = [], limit = 5) {
  const candidates = entries.filter(entry => entry.status === 'candidate')
    .sort((a, b) => closeness(b) - closeness(a) || a.slug.localeCompare(b.slug));
  if (!candidates.length) return '';
  // Gemini found these, nobody has written ISSUE.md yet: named on one line so they are never lost below the cut.
  const geminiOnly = candidates.filter(entry => entry.missingFile).slice(0, 8).map(entry => entry.slug);
  const shownSlugs = new Set(candidates.slice(0, limit).map(entry => entry.slug));
  const geminiLine = geminiOnly.some(slug => !shownSlugs.has(slug)) ? `\n- Gemini reports waiting for an ISSUE.md: ${geminiOnly.join(', ')} (${ISSUES_ROOT}/<slug>/)` : '';
  const line = entry => `- **${entry.slug}**${entry.missingFile ? ' (Gemini report only: write ISSUE.md from templates/ISSUE.md)' : entry.stub ? ' (stub)' : ''}: open ${openChecks(entry).map(check => `${check.id}${check.state === 'partly' ? ' (older gate)' : ''}`).join(', ')} · ${entry.quotes ?? 0} quotes, ${entry.sites ?? 0} sites · ${entry.missingFile ? `${ISSUES_ROOT}/${entry.slug}/` : entry.path}`;
  // I6 and I7 (owner, Oct 3: complaining is not wanting to buy): said once, while any Candidate still owes them.
  const owesNew = candidates.some(entry => openChecks(entry).some(check => NEW_CHECKS.includes(check.id)));
  const newLine = owesNew ? ' I6 Wants to buy: 5+ verbatim buying-intent quotes ("I wish there was", "I\'d pay for"), tagged intent; complaints alone don\'t count. I7 Not owned on Meta: Meta Ad Library (US, active) for the moment words shows fewer than 3 advertisers with 30+ day ads; save the searches, counts and links.' : '';
  return `## Issues to cross-reference (step 0)\n\n${plural(candidates.length, 'Candidate')}: Gemini claims are leads, never evidence. Verify each quote on the page, then tick a gate line only with the evidence in the file (I1-I7 in workflow/CHECKS.md; the "I1 · Real: …" lines are in templates/ISSUE.md).${newLine}\n\n${candidates.slice(0, limit).map(line).join('\n')}${candidates.length > limit ? `\n- …and ${candidates.length - limit} more: \`os.mjs issues --status candidate\`` : ''}${geminiLine}\n\n`;
}

/** How close a Candidate is to Verified: passed checks, plus a half for each partly met one. */
const closeness = entry => (entry.checks || []).reduce((sum, check) => sum + (check.state === 'passed' ? 1 : check.state === 'partly' ? 0.5 : 0), 0);

/** "crafters: 'sick of my back…'" for compact lists. */
export const issueName = entry => `${entry.slug}: ${clip(entry.title, 60)}`;
export {ISSUE_FILE};
