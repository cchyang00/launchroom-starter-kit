// The issue list (owner, Oct 3: "we want a list of deep real issues in life for
// many different avatars and angle. researching with gemini, and we do cross
// referencing and then once we got those issues down. it's all about choosing a
// couple from the list of what we're testing and finding products to match").
// workflow/CHECKS.md is the method: "The issue list: the hard part, done first",
// gate I1-I7 (I6 Wants to buy and I7 Not owned on Meta since Oct 3: "if a user
// is just complaining. it doesnt always mean they want to buy something").
// Each issue is a folder, resources/issues/<slug>/, holding
// ISSUE.md (from templates/ISSUE.md) and, often, a Gemini report.
//
// Pure parsers shared by the server and the screens (tested on the real files
// in server/issues.test.mjs):
//   parseIssue(markdown, slug)  one issue: title, group, quotes and sites,
//                               product types, the gate lines and the seven
//                               I-checks (I1-I7) read from them
//   issueChecks(gate)           the seven I-checks from the new "I1 · Real: …"
//                               lines, or from an older file's five lines
//                               (which never asked I6 or I7)
//   parseMethodGates(markdown)  each "## Step …" section of CHECKS.md and its gate
//   gatesForStep(method, index) the section a step page shows (Step 1 to Step 7)
// Nothing here ticks a gate: a check passes only from the saved file's own [x].
// Status (Candidate, Verified, Testing, Parked) is src/issueList.mjs.
import {headingAnchor} from './documentPaths.mjs';

export const ISSUES_ROOT = 'resources/issues';
export const ISSUE_FILE = 'ISSUE.md';
export const ISSUE_TEMPLATE = 'templates/ISSUE.md';
export const CHECKS_PATH = 'workflow/CHECKS.md';
/** The Buyers step's section of CHECKS.md. */
export const BUYERS_ANCHOR = 'step-2--buyers-who-buys-this-product-in-their-own-words';
/** The issue list's section of CHECKS.md ("## The issue list: the hard part, done first"). */
export const ISSUE_LIST_HEADING = 'The issue list: the hard part, done first';
export const ISSUE_LIST_ANCHOR = headingAnchor(ISSUE_LIST_HEADING);
/** The template's gate has seven items (I1-I7); a file with fewer cannot pass. */
export const ISSUE_GATE_MIN = 7;
export const ISSUE_SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const issuePath = slug => `${ISSUES_ROOT}/${slug}/${ISSUE_FILE}`;

/**
 * The seven checks of the issue list's gate (workflow/CHECKS.md, I1-I7), in
 * the owner's words, shortened for dots and tooltips. I6 and I7 (Oct 3) ask
 * whether they want to buy and whether Meta is already crowded for the moment.
 */
export const ISSUE_CHECKS = [
  {id: 'I1', name: 'Real', rule: '15+ verbatim quotes from 3+ sites, dated within 24 months, each with its link'},
  {id: 'I2', name: 'Deep', rule: 'A moment that keeps coming back and what it costs them, in their words'},
  {id: 'I3', name: 'Distinct avatars', rule: '2+ avatars, each with its own trigger moment'},
  {id: 'I4', name: 'Product-shaped', rule: '3+ physical product types that could help, with what fails them today; none on the never-sell list'},
  {id: 'I5', name: 'Clean', rule: "The words bank is filled, Gemini's claims are cross-referenced, no quote implies a condition we'd treat"},
  {id: 'I6', name: 'Wants to buy', rule: '5+ verbatim buying-intent quotes ("I wish there was", "I\'d pay for", …), tagged intent; complaints alone don\'t count'},
  {id: 'I7', name: 'Not owned on Meta', rule: "Meta Ad Library (US, active) for the group's moment words shows fewer than 3 advertisers with 30+ day ads speaking to this moment; searches, counts and links saved"},
];
export const ISSUE_CHECK_IDS = ISSUE_CHECKS.map(check => check.id);

/** Markdown inline marks to plain text: links keep their words; bold, italics and code lose their marks. */
export function plainText(value) {
  return String(value ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const clip = (value, max) => { const s = String(value ?? '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s; };

/**
 * One gate line: "15+ quotes … 24 months. *56 numbered items …*" becomes the
 * label (the rule) and the note (what the researcher found). A line with no
 * note is all label.
 */
export function splitGateLine(text) {
  const raw = String(text ?? '').trim();
  const match = raw.match(/^(.+?[^.\s])\.\s+((?:\*|\(|\*\*).*)$/s);
  if (match) return {label: plainText(match[1]), note: plainText(match[2]).replace(/^\((.*)\)$/s, '$1')};
  return {label: plainText(raw).replace(/[.;]$/, ''), note: ''};
}

/**
 * A new-format line's id, tolerant of hand edits: "I6 · Wants to buy: …",
 * "**I6** · …", "**I6 · Wants to buy:** …", "I6: …", "I6 - …", "I6 – …",
 * "I6 — …", "I6. …" and "I6 Wants to buy: …", with extra spaces or bold.
 */
const CODED_LINE = /^\s*[*_]*\s*([Ii][1-7])(?![0-9])\s*[*_]*\s*(?:[·•:.\-–—|]\s*)?(.*)$/s;
const squash = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * A new-format gate line ("I1 · Real: …"): its check id, name, rule and note;
 * null for an older line. The name is always the check's own (ISSUE_CHECKS);
 * words before a colon are read as the name only when they are that name, so
 * "I7: Ad Library: 2 advertisers" keeps all its words as the rule.
 */
function codedGateLine(raw) {
  const coded = String(raw ?? '').match(CODED_LINE);
  if (!coded) return null;
  const id = coded[1].toUpperCase();
  const known = ISSUE_CHECKS.find(check => check.id === id);
  const {label, note} = splitGateLine(coded[2]);
  const colon = label.indexOf(':');
  const head = colon > 0 && colon <= 40 ? squash(label.slice(0, colon)) : '';
  const named = head.length >= 3 && (head.startsWith(squash(known.name)) || squash(known.name).startsWith(head));
  return {id, name: known.name, rule: named ? label.slice(colon + 1).trim() : label, note};
}

/**
 * Which I-check an older gate line covers (files written before Oct 3 keep
 * their five lines). Older lines asked less than I1-I5, so each says how far
 * it gets: `full` when it asked the same thing, else `part` with what is
 * still owed. Lines that match nothing count for no check; no older line
 * covers I6 (Wants to buy) or I7 (Not owned on Meta).
 */
export function olderLineCheck(label) {
  const text = String(label ?? '').toLowerCase();
  if (/words bank|username/.test(text)) return {id: 'I5', full: false, owed: "Gemini's claims cross-referenced and no quote implying a condition we'd treat"};
  if (/quote/.test(text) && /site/.test(text)) return /\b15\+/.test(text) ? {id: 'I1', full: true} : {id: 'I1', full: false, owed: '15+ quotes (the older gate asked fewer)'};
  if (/cost/.test(text)) return {id: 'I2', full: false, owed: 'a moment that keeps coming back, in their words'};
  if (/avatar/.test(text)) return {id: 'I3', full: true};
  if (/product type|product-shaped/.test(text)) return /\b[35]\+/.test(text) ? {id: 'I4', full: true} : {id: 'I4', full: false, owed: '3+ product types with what fails them today'};
  return null;
}

/**
 * The seven I-checks from a parsed gate (`items` with `checked`, `label`, `note`
 * and, for new lines, `id`). Each is {id, name, rule, state, note, from}:
 * - state `passed`: its I-line is checked (every one, if the file repeats it),
 *   or an older line that asked the same is checked;
 * - state `partly`: checked under the older gate, which asked less (`owed` says what);
 * - state `open`: unchecked, or no line in the file covers it (I6 and I7 in
 *   a file written before Oct 3).
 * An I-line wins wherever it sits in the Gate section; a check with no I-line
 * falls back to the file's older lines. `from` is `gate`, `older` or `none`.
 */
export function issueChecks(gate) {
  const items = gate?.items || [];
  const coded = items.some(item => item.id);
  const older = items.filter(item => !item.id);
  return ISSUE_CHECKS.map(check => {
    const own = items.filter(item => item.id === check.id);
    if (own.length) return {...check, state: own.every(line => line.checked) ? 'passed' : 'open', note: own.map(line => line.note).filter(Boolean).join(' '), from: 'gate'};
    const lines = older.map(item => ({item, match: olderLineCheck(item.label)})).filter(entry => entry.match?.id === check.id);
    if (!lines.length) return {...check, state: 'open', note: coded ? 'Not in the file\'s gate yet.' : items.length ? 'The older gate did not ask this.' : 'No gate in the file yet.', from: 'none'};
    const checked = lines.every(entry => entry.item.checked);
    const full = lines.every(entry => entry.match.full);
    const owed = lines.map(entry => entry.match.owed).filter(Boolean)[0] || '';
    const found = lines.map(entry => entry.item.note).filter(Boolean).join(' ');
    if (!checked) return {...check, state: 'open', note: found || 'Unchecked in the older gate.', from: 'older'};
    return {...check, state: full ? 'passed' : 'partly', note: full ? found : `Checked under the older gate, which asked less. Still owed: ${owed}.`, from: 'older'};
  });
}

/** "## …" sections of a file as {heading, lines}. */
function sectionsOf(lines) {
  const out = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (heading && !/^###/.test(line)) { current = {heading: plainText(heading[1]), lines: []}; out.push(current); continue; }
    if (current) current.lines.push(line);
  }
  return out;
}
const cellsOf = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
/** Every markdown table in some lines: {header: [...], rows: [[...]]}. */
function tablesIn(lines) {
  const tables = [];
  let current = null;
  for (const line of lines) {
    if (!/^\s*\|.*\|\s*$/.test(line)) { current = null; continue; }
    const cells = cellsOf(line);
    if (!current) { current = {header: cells.map(cell => plainText(cell)), rows: []}; tables.push(current); continue; }
    if (cells.every(cell => /^:?-{2,}:?$/.test(cell) || cell === '')) continue;
    current.rows.push(cells);
  }
  return tables;
}
const findSection = (sections, re) => sections.find(section => re.test(section.heading)) || null;
const bold = cell => { const match = String(cell).match(/\*\*([^*]+)\*\*/); return match ? plainText(match[1]) : ''; };
/** A table cell or list item's short name: its bold words, else its words before a bracket or semicolon; no numbering. */
const shortName = cell => clip((bold(cell) || plainText(cell)).replace(/^\([^)]*\)\s*/, '').split(/\s\(|;\s|:\s|,\s(?=sold\b)/)[0].replace(/^(?:[A-Z]?\d+\.?\s+|[A-Z]\.\s+)/, '').replace(/[.:,]$/, '').trim(), 70);
const unique = list => [...new Set(list.filter(Boolean))];
/** Search phrases in a cell or line: words in backticks or quotes ("…", '…', “…”). */
const phrases = value => [...String(value ?? '').matchAll(/`([^`]{3,60})`|"([^"]{3,60})"|“([^”]{3,60})”|(?:^|[\s:,(])'([^']{3,60})'(?=[\s,.;)]|$)/g)].map(match => (match[1] || match[2] || match[3] || match[4]).trim());
/** The TikTok Shop part of a search note ("TikTok Shop: '…'. Amazon: '…'"). */
const tiktokPart = value => { const text = String(value ?? ''); const at = text.search(/tiktok/i); if (at < 0) return ''; const rest = text.slice(at); const amazon = rest.search(/amazon/i); return amazon > 0 ? rest.slice(0, amazon) : rest; };
const NOT_A_PRODUCT = /^(?:fallback|honest|why|what is crowded|where the gap|not sold|note)\b|^\d+$/i;
/** A TikTok search cell: its quoted phrases, else its plain terms split at semicolons. */
const termsIn = cell => { const quoted = phrases(cell); if (quoted.length) return quoted; return plainText(cell).split(/;\s*/).map(term => term.trim()).filter(term => term.length >= 3 && term.length <= 60); };

/** The quotes and sites in section 9 (Sources): numbered rows, distinct sites. */
function sourcesOf(sections) {
  const section = findSection(sections, /^9\.?\s+Sources\b|^Sources\b/i);
  if (!section) return {quotes: null, sites: null, siteNames: []};
  const numbers = new Set(), sites = new Set(), names = [];
  for (const table of tablesIn(section.lines)) {
    const site = table.header.findIndex(cell => /^site\b/i.test(cell));
    for (const row of table.rows) {
      const id = plainText(row[0]);
      if (!/^[A-Z]{0,2}\d+[a-z]?$/.test(id)) continue;
      numbers.add(id);
      if (site >= 0 && row[site]) {
        const name = plainText(row[site]).replace(/\s*\([^)]*\)\s*/g, ' ').split(/,\s*/)[0].trim();
        const key = name.toLowerCase().replace(/\s+(?:comments?|reviews?|posts?|thread)$/, '').replace(/\.(com|net|org)$/, '');
        if (key && !/^(?:same|n\/a|na|unknown|-+)$/.test(key) && !sites.has(key)) { sites.add(key); names.push(name); }
      }
    }
  }
  return {quotes: numbers.size || null, sites: sites.size || null, siteNames: names};
}

/** Product types (section 6), their TikTok Shop search terms and, when the table has one, what fails them today. */
function productsOf(sections) {
  const section = findSection(sections, /^6\.?\s|Product opportunit/i);
  const tables = section ? tablesIn(section.lines).filter(table => table.header.some(cell => /product/i.test(cell))) : [];
  const types = [], terms = [], failing = [];
  for (const table of tables) {
    const nameAt = table.header.findIndex(cell => /product/i.test(cell));
    const search = table.header.map((cell, index) => /tiktok|search/i.test(cell) && !/^\s*(?:search terms?:?\s*)?amazon/i.test(cell) ? index : -1).filter(index => index >= 0);
    const fails = table.header.findIndex(cell => /fail/i.test(cell));
    for (const row of table.rows) {
      const name = shortName(row[nameAt]);
      if (!name || NOT_A_PRODUCT.test(name)) continue;
      types.push(name);
      for (const index of search) terms.push(...(/tiktok/i.test(table.header[index]) ? termsIn(row[index]) : phrases(tiktokPart(row[index]) || String(row[index] || '').split(/amazon/i)[0])));
      if (fails >= 0 && row[fails]) failing.push(`${name}: ${clip(plainText(row[fails]), 90)}`);
    }
  }
  // No table: numbered or bold product lines ("1. **Name**", "**1. Name** …") and their "TikTok Shop: '…'" notes.
  if (section && !types.length) {
    for (const line of section.lines) {
      const item = line.match(/^(?:\d+\.\s+)?\*\*(?:\d+\.\s*)?([^*]+?)\*\*/);
      if (item && !/:\s*$/.test(item[1])) { const name = shortName(`**${item[1]}**`); if (name && !NOT_A_PRODUCT.test(name)) types.push(name); }
      if (/tiktok/i.test(line)) terms.push(...phrases(tiktokPart(line)));
    }
  }
  return {productTypes: unique(types).slice(0, 8), searchTerms: unique(terms).slice(0, 8), failing};
}

/** What they have tried (section 5): each fix with what people say about it. */
function triedOf(sections) {
  const section = findSection(sections, /^5\.?\s|What they.ve tried/i);
  const table = section ? tablesIn(section.lines)[0] : null;
  if (!table) return [];
  const verdict = table.header.length - 1;
  return table.rows.map(row => ({fix: shortName(row[0]), says: clip(plainText(row[verdict] || ''), 110)})).filter(item => item.fix).slice(0, 8);
}

/** The avatar group: the file's "**Group:**" line, else the avatar names in section 4. */
function groupOf(lines, sections) {
  for (const line of lines.slice(0, 40)) {
    const group = line.match(/^\*\*Group(?: chosen and why)?[:.]?\*\*[:.]?\s*(.+)$/i);
    if (group) {
      const text = plainText(group[1]).replace(/\*\*Read this first.*$/i, '').trim();
      const first = text.split(/(?<=[a-z)])\.\s/)[0];
      return clip(first, 140);
    }
  }
  const section = findSection(sections, /^4\.?\s|Avatars/i);
  const table = section ? tablesIn(section.lines)[0] : null;
  if (!table) return '';
  const column = Math.max(0, table.header.findIndex(cell => /^avatar/i.test(cell)));
  return clip(unique(table.rows.map(row => shortName(row[column]))).slice(0, 4).join(' · '), 140);
}

const PLACEHOLDER = /^\[.*\]$|\[the problem/i;
const humanSlug = slug => String(slug || '').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());

/**
 * One issue file. `title` is the words after "# Issue: " (the slug when the
 * file is a stub); `researched` the first "Researched YYYY-MM-DD" date; `gate`
 * the "- [x]" / "- [ ]" items under the "## Gate" heading (new lines carry
 * their I-check `id`; "1. [x]" works too); `checks` the seven I-checks;
 * `verified` (also kept as `gatePassed` for older callers) is true only when
 * all seven passed. `gate.format` is `i1-i7` (I-lines), `mixed` (I-lines
 * beside older lines), `older` or `none`.
 * `group`, `quotes`, `sites`, `productTypes`, `searchTerms`, `failing` and
 * `tried` are read from the file's own sections; unknown stays null or empty.
 */
export function parseIssue(markdown, slug = '') {
  const text = String(markdown ?? '');
  const lines = text.split(/\r?\n/);
  const heading = lines.find(line => /^#\s+/.test(line)) || '';
  const titled = heading.match(/^#\s+Issue:\s*(.+?)\s*#*\s*$/);
  const rawTitle = titled ? plainText(titled[1]) : plainText(heading.replace(/^#\s+/, ''));
  const placeholder = !rawTitle || PLACEHOLDER.test(rawTitle);
  const title = placeholder ? humanSlug(slug) : rawTitle;
  const researched = text.match(/Researched\s+(\d{4}-\d{2}-\d{2})(?:\s+by\s+([a-z][a-z0-9-]*))?/i);
  const items = [];
  let inGate = false, gateFound = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) { inGate = /^##\s+Gate\b/i.test(line); gateFound ||= inGate; continue; }
    if (!inGate) continue;
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+)$/);
    if (!item) continue;
    const checked = item[1].toLowerCase() === 'x';
    const coded = codedGateLine(item[2]);
    items.push(coded ? {checked, id: coded.id, name: coded.name, label: `${coded.id} · ${coded.name}: ${coded.rule}`, rule: coded.rule, note: coded.note} : {checked, ...splitGateLine(item[2])});
  }
  const done = items.filter(item => item.checked).length;
  const hasCoded = items.some(item => item.id);
  const hasOlder = items.some(item => !item.id && olderLineCheck(item.label));
  const gate = {found: gateFound, items, done, total: items.length, min: ISSUE_GATE_MIN, format: hasCoded ? (hasOlder ? 'mixed' : 'i1-i7') : items.length ? 'older' : 'none'};
  const checks = issueChecks(gate);
  const verified = checks.every(check => check.state === 'passed');
  const sections = sectionsOf(lines);
  const sources = sourcesOf(sections);
  const products = productsOf(sections);
  const stub = placeholder || !gateFound || sources.quotes === null;
  return {
    slug, path: slug ? issuePath(slug) : '', title, titled: Boolean(titled) && !placeholder, stub,
    researched: researched ? researched[1] : '', researchedBy: researched?.[2] || '',
    group: groupOf(lines, sections), ...sources, ...products, tried: triedOf(sections),
    gate, checks, verified, gatePassed: verified,
  };
}

/** A folder that holds only a Gemini report (no ISSUE.md yet): a Candidate with every check open. */
export function geminiOnlyIssue(slug, reportMarkdown = '') {
  const heading = String(reportMarkdown).split(/\r?\n/).find(line => /^#\s+/.test(line)) || '';
  const parsed = parseIssue('', slug);
  return {...parsed, path: '', missingFile: true, stub: true, title: heading ? clip(plainText(heading.replace(/^#\s+/, '')).replace(/^(?:Gemini(?: Deep Research)?(?: report)?\s*[:·-]\s*)/i, ''), 140) || parsed.title : parsed.title};
}

/** "I1–I7 3/7" with ✓ when all seven passed. */
export const gateLabel = issue => {
  const passed = (issue?.checks || []).filter(check => check.state === 'passed').length;
  return `I1–${ISSUE_CHECKS.at(-1).id} ${passed}/${ISSUE_CHECKS.length}${issue?.verified ?? issue?.gatePassed ? ' ✓' : ''}`;
};

/* ---------- workflow/CHECKS.md: each step's gate ---------- */

const STEP_HEADING = /^##\s+(Step\s+(\d+[a-z]?)\s+·\s+(.+?))\s*$/;
const GATE_LINE = /^\*\*Gate(?:\s*\([^)]*\))?:\*\*\s*(.*)$/;
const TABLE_ROW = /^\|(.+)\|\s*$/;

function gateItem(text) {
  const clean = text.trim().replace(/[;.]$/, '');
  const coded = clean.match(/^\*\*([A-Z]\d+)\s+·\s+(.+?)\.?\*\*\s*(.*)$/);
  if (coded) return {id: coded[1], label: plainText(coded[2]).replace(/[:.,]$/, ''), text: plainText(coded[3]).replace(/[;.]$/, ''), children: []};
  return {id: '', label: '', text: plainText(clean), children: []};
}

/**
 * Each "## Step …" section of CHECKS.md: its id ("1", "2"), name, anchor (the
 * document reader's heading id) and gate: the intro after "**Gate…:**", the
 * bullet items (nested bullets become children), or, when the gate is one
 * sentence (Step 1 · Product), the coded rows of the section's checks table (F1-F6).
 * The issue list's section is deliberately not a "## Step" heading (step 0).
 */
export function parseMethodGates(markdown) {
  const sections = [];
  let current = null, mode = '';
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const heading = line.match(STEP_HEADING);
    if (heading) { current = {id: heading[2], name: plainText(heading[3]).split(':')[0].trim(), title: plainText(heading[3]), heading: heading[1], anchor: headingAnchor(plainText(heading[1])), intro: '', items: [], table: []}; sections.push(current); mode = ''; continue; }
    if (/^#{1,2}\s+/.test(line)) { current = null; continue; }
    if (!current) continue;
    const row = line.match(TABLE_ROW);
    if (row) {
      const cells = row[1].split('|').map(cell => cell.trim());
      if (/^[A-Z]\d+$/.test(cells[0]) && cells.length >= 3) current.table.push({id: cells[0], label: plainText(cells[1]), text: plainText(cells[2]), children: []});
    }
    const gate = line.match(GATE_LINE);
    if (gate) { current.intro = plainText(gate[1]); mode = 'gate'; continue; }
    if (mode !== 'gate') continue;
    if (/^\*\*[^*]+:\*\*/.test(line) || /^#{3,}\s/.test(line)) { mode = ''; continue; }
    const top = line.match(/^[-*]\s+(.+)$/), nested = line.match(/^\s{2,}[-*]\s+(.+)$/);
    if (top) current.items.push(gateItem(top[1]));
    else if (nested && current.items.length) current.items.at(-1).children.push(plainText(nested[1]).replace(/[;.]$/, ''));
    else if (line.trim() && current.items.length && !/^\s/.test(line)) mode = '';
  }
  return sections.map(({table, ...section}) => ({...section, items: section.items.length ? section.items : table, fromTable: !section.items.length && table.length > 0}));
}

/**
 * The issue list's gate from CHECKS.md ("## The issue list: …", I1-I7), the
 * same shape as a step section, so the Issues page shows the method's own words.
 */
export function parseIssueListGate(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const start = lines.findIndex(line => /^##\s+The issue list\b/i.test(line));
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && /^#{1,2}\s+/.test(line));
  const body = lines.slice(start + 1, end < 0 ? undefined : end);
  const items = [];
  let inGate = false;
  for (const line of body) {
    if (/^\*\*Gate\b/i.test(line)) { inGate = true; continue; }
    if (!inGate) continue;
    if (/^\*\*[^*]+:?\*\*/.test(line) && !/^\*\*I\d/.test(line)) break;
    const top = line.match(/^[-*]\s+(.+)$/);
    if (top) items.push(gateItem(top[1]));
  }
  const heading = plainText(lines[start].replace(/^##\s+/, ''));
  return {id: '0', name: 'The issue list', title: heading, heading, anchor: headingAnchor(heading), items};
}

/** Which CHECKS.md section belongs to each of the seven step pages. */
export const STEP_SECTIONS = [['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7']];
export function gatesForStep(method, index) {
  const ids = STEP_SECTIONS[index] || [];
  return ids.map(id => (method || []).find(section => section.id === id)).filter(Boolean);
}

/**
 * The issue list for os.mjs and tests: one entry per issue with its status
 * (when known), I-checks and the rounds that use it, from GET /api/issues.
 * Testing first, then Verified, Candidate and Parked; within each, the issue an
 * open round uses first.
 */
export function issueLane(data) {
  const issues = data?.issues || [];
  const order = {testing: 0, verified: 1, candidate: 2, parked: 3};
  const entries = issues.map(issue => {
    const rounds = issue.rounds || [];
    const status = issue.status || (issue.verified ?? issue.gatePassed ? 'verified' : 'candidate');
    const passed = (issue.checks || []).filter(check => check.state === 'passed').length;
    return {
      slug: issue.slug, title: issue.title || issue.slug, path: issue.path || issuePath(issue.slug), passed: Boolean(issue.verified ?? issue.gatePassed), status,
      gate: `${passed}/${ISSUE_CHECKS.length}`, rounds: rounds.map(round => round.id), open: rounds.some(round => round.open),
      roundText: rounds.length ? rounds.map(round => `${round.id}${round.open ? '' : ' (done)'}`).join(', ') : 'No round yet',
    };
  }).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || Number(b.open) - Number(a.open));
  const legacy = (data?.roundsWithoutIssue || []).filter(round => round.open).map(round => round.id);
  return {entries, passed: entries.filter(entry => entry.passed).length, testing: entries.filter(entry => entry.status === 'testing').length, total: entries.length, legacy};
}
