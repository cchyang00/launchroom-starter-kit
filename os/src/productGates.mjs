// What gets through (owner, Nov 5): "Products: we're going to build a crazy scraper ... with keyword
// targeting and filtering. Those filters are going to be hard enough that it comes back with a catalog
// of products that are good." "Verify: that's going to be the tab where it does the hardest verification
// checks ... 90% of those products ... are not going to make it past ... they will be improved over time."
//
// These two lists are the one place the filters and checks live: change a rule here, or add a check, and
// the Product and Verify pages follow. Everything else in this file reads saved records only and never
// passes or fails a product.
import {checkPasses} from './researchView.mjs';
import {failedChecks,BUILD_FROM} from './pipeline.mjs';

export const KEYWORD_BIBLE = 'resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md';
export const STRESS_TEST_NOTE = 'resources/notes/2026-11-04-hard-verifier-stress-test-and-breakeven-floor.md';

/** What the scraper throws out before a product reaches the catalog. `id` is how a run counts what each one removed. */
export const CATALOG_FILTERS = [
  {id: 'price', name: 'Too cheap', rule: 'Under $24 on the market, or can\'t sell for $45+.'},
  {id: 'quality', name: 'Looks cheap', rule: 'Small or flimsy. It won\'t carry a $45 price.'},
  {id: 'stores', name: 'In every store', rule: 'General items people grab at Target, Walmart or on Prime.'},
  {id: 'videos', name: 'No viral videos', rule: 'Under 5 US videos from 3 creators. It only sells by browsing.'},
  {id: 'trend', name: 'Past its peak', rule: 'Flat or falling sales. We want the wave going up.'},
  {id: 'limits', name: 'Never sell', rule: 'Supplements, kids, weapons, batteries, liquids and brands.'},
];

/**
 * The hard checks, in the order agents run them. `reads` names the saved checks behind each one
 * (`screen:` a card check, `gate:` a deep gate): together they are exactly what upfrontReady asks
 * for, so a product passes all seven only when it is really verified.
 */
export const VERIFY_CHECKS = [
  {id: 'uptrend', name: 'Uptrend', rule: 'Sales are rising, with no downtrend.', reads: ['screen:provenDemand', 'gate:demand'],
    lines: ['2+ dated sales numbers, each with a link', 'Early wave: 100–2,500 sold and rising', 'Big volume: only with 0–5 Meta advertisers', 'A wave older than 30 days must still be climbing']},
  {id: 'viral', name: 'Viral videos', rule: '5+ US videos from 3+ creators are selling it.', reads: ['gate:community'],
    lines: ['2–3 videos doing $2,500+ each', 'Top 3 creators bring under 50% of sales', 'Mostly video sales, not livestreams', 'Never only TikTok Shop browsing']},
  {id: 'value', name: 'Looks expensive', rule: 'Looks worth $45+. Not something from Target.', reads: ['screen:looksWorth'],
    lines: ['$24+ market price, $45–75 for us', 'Solves a real problem', 'No Prime copy at $15–25', 'No fitted sizing or high returns']},
  {id: 'factory', name: 'Exact factory', rule: 'Exact item on CJdropshipping, with a saved image for Amy.', reads: ['screen:dropshippable', 'screen:sourceMatch', 'gate:sourcing'],
    lines: ['Exact product link on CJdropshipping (never a search URL)', 'Saved clean supplier product image for Amy (resources/sourcing/)', 'Send saved image to Amy on WhatsApp for quote when building the store']},
  {id: 'profit', name: 'Profit', rule: '3x landed cost, with room to pay for ads.', reads: ['screen:contribution'],
    lines: ['$18–25+ profit an order', '$30+ break-even cost per sale', 'The 2-pack makes more than the 1-pack']},
  {id: 'buyers', name: 'Real buyers', rule: '15+ real quotes, 3 avatars and an angle nobody uses.', reads: ['screen:buyers', 'screen:audienceRoom', 'screen:bigIssue', 'gate:fit'],
    lines: ['Quotes are word for word and dated', 'Each avatar has a trigger moment', 'Ties to an issue on our list']},
  {id: 'meta', name: 'Room on Meta', rule: 'Direct twins are ≤15 ads, and our mechanism beats category competitors.', reads: ['screen:metaGap', 'gate:competition'],
    lines: ['Direct Twins: 0–15 active US ads for this exact item', 'Category Competitors: check what similar products on Meta sell', 'Mechanism Advantage: how our product works differently and beats the category']},
];

const readOne = (candidate, ref) => {
  const [kind, id] = ref.split(':');
  const saved = kind === 'gate' ? candidate?.gates?.[id] : candidate?.screen?.checks?.[id];
  const passed = kind === 'gate' ? saved?.status === 'supported' : checkPasses(id, saved);
  return {state: passed ? 'pass' : saved?.status === 'failed' ? 'fail' : 'open', note: String(saved?.note || ''), observedAt: String(saved?.observedAt || ''), source: String(saved?.source || '')};
};

/** A card on the seven checks: `pass` needs every saved check behind it, `fail` a saved failure; anything else stays open. */
export function verifyLine(candidate) {
  return VERIFY_CHECKS.map(check => {
    const reads = check.reads.map(ref => readOne(candidate, ref));
    const state = reads.some(read => read.state === 'fail') ? 'fail' : reads.every(read => read.state === 'pass') ? 'pass' : 'open';
    const shown = reads.find(read => read.state === state && read.note) || reads.find(read => read.note) || reads[0];
    return {id: check.id, name: check.name, state, note: shown.note, observedAt: shown.observedAt, source: shown.source};
  });
}

const FAIL_WORDS = /\b(HARD (VERIFIER )?FAIL|FAILED|REJECTED|KILLED|Duplicate of)\b/;
/**
 * The first check that stopped this card, by the same rule that takes it off the line (failedChecks); null
 * when none did. Some failed checks kept an earlier, positive note, so `note` is the first saved words that say why.
 */
export function killedAt(candidate) {
  const failures = failedChecks(candidate).filter(failure => !failure.reopened);
  for (const check of VERIFY_CHECKS) {
    const mine = failures.filter(entry => check.reads.includes(`${entry.kind}:${entry.id}`));
    if (!mine.length) continue;
    const decision = String(candidate?.decision || '');
    const note = mine.find(entry => FAIL_WORDS.test(entry.note))?.note || (FAIL_WORDS.test(decision) ? decision : '') || failures.find(entry => FAIL_WORDS.test(entry.note))?.note || mine[0].note;
    return {checkId: check.id, name: check.name, note, observedAt: String(mine[0].observedAt || ''), source: mine[0].source};
  }
  return null;
}

/** A saved reason without its shouted lead-in ("HARD VERIFIER FAIL — ...", "REJECTED — FAILED Live Audit (Nov 3): ..."). */
export function shortReason(note) {
  let text = String(note || '').replace(/\s+/g, ' ').trim();
  for (let turn = 0; turn < 3; turn++) text = text.replace(/^(hard\s+)?(verifier\s+)?(rejected|reject|failed|fail|park(ed)?|kill(ed)?)\b[^:—]{0,80}[:—]\s*/i, '');
  return text;
}

const newestFirst = (a, b) => String(b.killed?.observedAt || '').localeCompare(String(a.killed?.observedAt || '')) || Number(String(b.item.id).slice(1)) - Number(String(a.item.id).slice(1));

/**
 * Where every product stands, from the saved pipeline: the catalog, being tested, killed at a check,
 * set aside another way (the owner's Pass or Reject, or parked before the hard test), and through.
 * `rows` is the funnel: how many reached each check, how many it killed and how many went on.
 */
export function gauntlet(items = [], leads = []) {
  const cards = new Map(leads.map(lead => [lead.id, lead.candidate]));
  const rows = VERIFY_CHECKS.map(check => ({...check, killed: [], testing: [], entered: 0, left: 0}));
  const byId = new Map(rows.map(row => [row.id, row]));
  const out = {catalog: [], testing: [], killed: [], setAside: [], winners: [], building: []};
  for (const item of items) {
    const candidate = cards.get(item.leadId || item.id) || null;
    const entry = {item, candidate, line: verifyLine(candidate)};
    if (item.outcome) {
      const killed = killedAt(candidate);
      if (killed) {const row = byId.get(killed.checkId); entry.killed = killed; row.killed.push(entry); out.killed.push(entry);}
      else out.setAside.push(entry);
    } else if (item.readyToBuild) out.winners.push(entry);
    else if (item.building || item.stepIndex >= BUILD_FROM) out.building.push(entry);
    else if (item.stepIndex === 0) out.catalog.push(entry);
    else {
      const at = entry.line.find(check => check.state !== 'pass') || entry.line.at(-1);
      entry.at = at;
      byId.get(at.id).testing.push(entry);
      out.testing.push(entry);
    }
  }
  out.killed.sort(newestFirst);
  for (const row of rows) row.killed.sort(newestFirst);
  const through = out.winners.length + out.building.length;
  const tested = out.killed.length + out.testing.length + through;
  let left = tested;
  for (const row of rows) {row.entered = left; left -= row.killed.length; row.left = left;}
  return {...out, rows, tested, through, killRate: tested ? Math.round(out.killed.length / tested * 100) : 0};
}

const moneyValue = value => {const n = Number(String(value ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null;};
export const sellPrice = item => moneyValue(item?.validation?.money?.sell) ?? moneyValue(item?.validation?.kalodata?.price);
const metaCount = item => item?.validation?.meta?.liveAds ?? item?.validation?.meta?.advertisers ?? null;
const salesOf = item => item?.validation?.kalodata?.gmv ?? item?.validation?.kalodata?.videoGmv ?? null;
const newest = (a, b) => Number(String(b.item.id).slice(1)) - Number(String(a.item.id).slice(1));
const most = read => (a, b) => (read(b.item) ?? -Infinity) - (read(a.item) ?? -Infinity) || newest(a, b);

/** The ways to sort the catalog. A product missing the number goes last. */
export const CATALOG_SORTS = [
  {id: 'newest', label: 'Newest', compare: newest},
  {id: 'trend', label: 'Rising fastest', compare: most(item => item?.validation?.changePercent)},
  {id: 'sold', label: 'Most sold', compare: most(item => item?.validation?.kalodata?.units)},
  {id: 'sales', label: 'Most sales', compare: most(salesOf)},
  {id: 'price', label: 'Highest price', compare: most(sellPrice)},
];

/** The catalog's quick filters, each a plain test on saved numbers. */
export const CATALOG_CHIPS = [
  {id: 'rising', label: 'Rising', test: entry => entry.item?.validation?.direction === 'rising'},
  {id: 'video', label: 'With video', test: entry => Boolean(entry.item?.video)},
  {id: 'price', label: '$45+', test: entry => (sellPrice(entry.item) ?? 0) >= 45},
  {id: 'meta', label: 'Under 15 Meta ads', test: entry => {const count = metaCount(entry.item); return count !== null && count <= 15;}},
];

/** Search, chips, then sort. */
export function browseCatalog(entries, {query = '', chips = [], sort = 'newest', group = null} = {}) {
  const words = String(query).trim().toLowerCase();
  const tests = CATALOG_CHIPS.filter(chip => chips.includes(chip.id));
  const compare = (CATALOG_SORTS.find(entry => entry.id === sort) || CATALOG_SORTS[0]).compare;
  return entries.filter(entry => (!words || `${entry.item.id} ${entry.item.name} ${entry.candidate?.keyword || ''}`.toLowerCase().includes(words))
    && tests.every(chip => chip.test(entry))
    && (!group || group.keywords.includes(String(entry.candidate?.keyword || '').toLowerCase()))).sort(compare);
}

/** The Keyword Bible's table: one group a row, its keywords in backticks. [] when the file has no such table. */
export function parseKeywordBible(markdown) {
  const groups = [];
  for (const line of String(markdown || '').split(/\r?\n/)) {
    const row = line.match(/^\|\s*\*\*\d+\.\s*(.+?)\*\*\s*\|(.+)\|\s*$/);
    if (!row) continue;
    const keywords = [...row[2].matchAll(/`([^`]+)`/g)].map(match => match[1].trim().toLowerCase()).filter(Boolean);
    if (keywords.length) groups.push({name: row[1].trim(), keywords});
  }
  return groups;
}

const count = value => Number.isInteger(value) && value >= 0 ? value : 0;

/** Keeps only the well-formed rows of research/scrape-runs.json, newest first: what the scraper reports, never invented. */
export function normalizeRuns(record) {
  const list = Array.isArray(record?.runs) ? record.runs : [];
  return list.filter(run => run && typeof run === 'object' && typeof run.at === 'string' && Number.isFinite(Date.parse(run.at))).map((run, index) => ({
    id: String(run.id || `run-${index + 1}`).slice(0, 60),
    at: run.at,
    scraped: count(run.scraped),
    kept: count(run.kept),
    keywords: (Array.isArray(run.keywords) ? run.keywords : []).filter(word => typeof word === 'string' && word.trim()).map(word => word.trim().toLowerCase()).slice(0, 500),
    removed: Object.fromEntries(Object.entries(run.removed && typeof run.removed === 'object' ? run.removed : {}).filter(([, value]) => Number.isInteger(value) && value >= 0)),
    note: typeof run.note === 'string' ? run.note.slice(0, 300) : '',
  })).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Every run added up: how many were scraped and kept, and what each filter took out. */
export function runTotals(runs = []) {
  const removed = {};
  for (const run of runs) for (const [id, value] of Object.entries(run.removed)) removed[id] = (removed[id] || 0) + value;
  const scraped = runs.reduce((sum, run) => sum + run.scraped, 0), kept = runs.reduce((sum, run) => sum + run.kept, 0);
  return {count: runs.length, scraped, kept, filteredOut: Math.max(0, scraped - kept), removed, latest: runs[0] || null};
}
