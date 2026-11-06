// The Hubs (owner, Nov 5): "it's not necessarily going to be for me. It's going to be for both. The agents,
// that's where it's like a library. For example, if you wanted to write good copy, understand a reference, or
// understand what a winning product is, that's where you go." "The hub really helps do everything before you
// find the products."
//
// One list of doors, read by the Hub home and by agents through `os.mjs hub <door>`, so both go to the same
// place. Add a resource here and it shows in both. Everything else in this file reads saved files only.

export const KEYWORD_BIBLE_PATH = 'resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md';
export const WHATS_GOOD_PATH = 'resources/copywriting/WHATS-GOOD.md';

/**
 * `go` is the door's page, `topic` its Library shelf and `agent` the subagent who does this work.
 * A link opens a file (`doc`) or a page (`go`). No door starts work: the chat does that.
 */
export const HUB_DOORS = [
  {id: 'copy', title: 'Write good copy', line: 'What to say, what not to say and the words that got clicks.', go: 'assets?tab=copy', topic: 'copywriting', agent: 'copywriter', links: [
    {label: "What's good", doc: WHATS_GOOD_PATH},
    {label: 'Native ad kit', doc: 'templates/NATIVE-AD-KIT.md'},
    {label: 'Product page copy', doc: 'templates/PRODUCT-PAGE-COPY.md'},
    {label: 'Copy brief', doc: 'templates/COPY-BRIEF.md'},
    {label: 'Native ads playbook', doc: 'resources/copywriting/native-ads/PLAYBOOK.md'},
  ]},
  {id: 'creatives', title: 'Make better creatives', line: 'Our ads that worked, what failed and layouts to copy.', go: 'assets?tab=ads', topic: 'images-ads', agent: 'image-maker', links: [
    {label: "What's good", doc: WHATS_GOOD_PATH},
    {label: 'Ways to improve', go: 'assets?tab=improve'},
    {label: 'Reference to ad', doc: 'agents/image-generator/references/REFERENCE-TO-AD.md'},
    {label: 'Native images', doc: 'agents/image-generator/references/NATIVE-IMAGES.md'},
    {label: 'Ad urgency playbook', doc: 'resources/notes/2026-11-04-meta-ad-performance-and-urgency-playbook.md'},
  ]},
  {id: 'winners', title: 'Know a winning product', line: 'What sells on Meta, what never does, and the tests.', go: 'trends?tab=keywords', topic: 'product-research', agent: 'checker', links: [
    {label: 'Winners vs slop', go: 'trends?tab=keywords'},
    {label: 'The hard checks', go: 'verify'},
    {label: '10-point stress test', doc: 'resources/notes/2026-11-04-hard-verifier-stress-test-and-breakeven-floor.md'},
    {label: 'TikTok to Meta playbook', doc: 'resources/notes/2026-11-03-tiktok-to-meta-arbitrage-and-q4-product-finding.md'},
  ]},
  {id: 'research', title: 'Research a trend', line: 'Deep research, keywords and diagrams, all in one place.', go: 'trends', topic: 'buyer-angles', agent: 'buyer-researcher', links: [
    {label: 'Deep research', go: 'trends?tab=research'},
    {label: 'Keywords', go: 'trends?tab=keywords'},
    {label: 'Diagrams', go: 'trends?tab=diagrams'},
    {label: 'Gemini prompts', doc: 'templates/GEMINI-ISSUE-PROMPTS.md'},
  ]},
  {id: 'store', title: 'Build the store', line: 'Our themes, palettes and the page every product follows.', go: 'store', topic: 'store', agent: 'store-builder', links: [
    {label: 'Themes and palettes', go: 'store'},
    {label: 'Page blueprint', doc: 'store/PAGE-BLUEPRINT.md'},
    {label: 'Filling a product', doc: 'store/HYDROGEN-POPULATION.md'},
  ]},
  {id: 'team', title: 'Call a specialist', line: 'Skills for any job, and subagents who know how our workflow runs.', go: 'agents?tab=team', topic: '', agent: '', links: []},
];

export const isGemini = entry => /gemini/i.test(`${entry?.title || ''} ${entry?.path || ''} ${(entry?.sources || []).join(' ')}`);
export const isResearch = entry => Boolean(entry) && entry.status !== 'to-learn' && (entry.kind === 'research' || isGemini(entry));
/** When the work was done: the date in its file name if it has one (a report filed later keeps its own day), else when it was saved. */
export const entryDay = entry => String(entry?.path || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || String(entry?.learnedOn || entry?.updatedAt || entry?.createdAt || '').slice(0, 10);

/** The research shelf, newest first: search, one topic, or only Gemini's. */
export function researchShelf(entries = [], {query = '', topic = '', gemini = false} = {}) {
  const words = String(query).trim().toLowerCase();
  return entries.filter(isResearch)
    .filter(entry => !topic || (entry.topics || []).includes(topic))
    .filter(entry => !gemini || isGemini(entry))
    .filter(entry => !words || `${entry.title} ${entry.learned || ''} ${entry.path || ''}`.toLowerCase().includes(words))
    .sort((a, b) => entryDay(b).localeCompare(entryDay(a)) || String(b.id).localeCompare(String(a.id)));
}

const plain = text => String(text || '').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
const sentence = text => {const clean = plain(text); return clean ? clean[0].toUpperCase() + clean.slice(1) : '';};
/** A table cell as short items: backticks and the bracketed detail go, so a tile reads at a glance. */
const items = (cell, separator) => String(cell || '').split(separator).map(part => sentence(part.replace(/\([^)]*\)/g, ''))).filter(Boolean);

/**
 * The Keyword Bible as data. `categories`: its eight Meta-proven groups, each with the products worth selling,
 * the slop to avoid, the ad hook and its keywords (its two tables number them the same way). `hot`: the keywords
 * that came back with sales in the saved run, biggest first. Anything the file doesn't say stays out.
 */
export function parseBibleMap(markdown) {
  const categories = new Map();
  const at = number => {if (!categories.has(number)) categories.set(number, {number, name: '', winners: [], slop: [], hook: '', keywords: []}); return categories.get(number);};
  const hot = [];
  for (const line of String(markdown || '').split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    const proven = cells[0]?.match(/^\*\*(\d+)\*\*$/);
    if (proven && cells.length >= 5) {
      const row = at(Number(proven[1]));
      row.name = row.name || plain(cells[1]);
      row.winners = items(cells[2], ';');
      row.slop = items(cells[3], ',');
      row.hook = plain(cells[4]).replace(/^["“]|["”]$/g, '');
      continue;
    }
    const listed = cells[0]?.match(/^\*\*(\d+)\.\s*(.+?)\*\*$/);
    if (listed && cells.length >= 2) {
      const row = at(Number(listed[1]));
      row.name = plain(listed[2]);
      row.keywords = [...cells[1].matchAll(/`([^`]+)`/g)].map(match => match[1].trim().toLowerCase()).filter(Boolean);
      continue;
    }
    const keyword = cells[1]?.match(/^`([^`]+)`$/);
    const money = cells[3]?.match(/\$([\d,]+)/);
    if (keyword && money && cells.length >= 5) {
      const window = cells[4].match(/(\d{4}-\d{2}-\d{2})\s*->\s*(\d{4}-\d{2}-\d{2})/);
      const quick = cells[3].match(/in\s+(\d+)\s+days/i);
      hot.push({keyword: keyword[1].trim().toLowerCase(), category: plain(cells[0]), revenue: Number(money[1].replace(/,/g, '')), from: window?.[1] || '', to: window?.[2] || '', days: quick ? Number(quick[1]) : null, why: plain(cells[5])});
    }
  }
  return {categories: [...categories.values()].filter(row => row.name).sort((a, b) => a.number - b.number), hot: hot.sort((a, b) => b.revenue - a.revenue)};
}

/** A table's rows under one "## Heading", keyed by its lowercased column names. */
function tableUnder(markdown, heading) {
  const lines = String(markdown || '').split(/\r?\n/);
  const start = lines.findIndex(line => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start < 0) return [];
  const rows = [];
  let columns = null;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.every(cell => /^:?-+:?$/.test(cell))) continue;
    if (!columns) { columns = cells.map(cell => cell.toLowerCase().split(' ')[0]); continue; }
    rows.push(Object.fromEntries(columns.map((column, index) => [column, cells[index] || ''])));
  }
  return rows;
}
/** The What's Good file as data. An agent adds a row there and it shows on the hub; anything missing stays out. */
export function parseWhatsGood(markdown) {
  const pairs = tableUnder(markdown, 'Say this, not this').map(row => ({where: row.where, say: row.say, not: row.not, why: row.why}));
  return {
    worked: tableUnder(markdown, 'Worked').filter(row => row.ad),
    failed: tableUnder(markdown, "Didn't work").filter(row => row.ad),
    pairs: pairs.filter(pair => pair.say && pair.not),
    rules: tableUnder(markdown, 'What makes a good ad').filter(row => row.rule),
    next: tableUnder(markdown, 'Try next').filter(row => row.idea),
  };
}

const isPicture = file => file?.kind === 'image' || /\.(png|jpe?g|webp|svg|gif)$/i.test(String(file?.path || ''));
const byName = (a, b) => String(a.path).localeCompare(String(b.path), undefined, {numeric: true});

/** Pictures an agent saved as a diagram: resources/diagrams and the research folders, plus the study figures (never QA screenshots or scraped frames). */
export function diagramFiles(media = []) {
  return media.filter(file => isPicture(file) && (String(file.path).startsWith('resources/diagrams/') || String(file.path).startsWith('resources/research/')
    || (/^resources\/learning\/[^/]+$/.test(String(file.path)) && !/(desktop|mobile)/i.test(String(file.path))))).sort(byName);
}
export const adLayouts = (media = []) => media.filter(file => isPicture(file) && String(file.path).startsWith('agents/image-generator/references/layouts/')).sort(byName);
export const studiedAds = (media = []) => media.filter(file => isPicture(file) && String(file.path).startsWith('resources/copywriting/')).sort(byName);
/** "2026-09-30-avatar-angle-os.png" reads "Avatar angle os". */
export const fileTitle = path => sentence(String(path || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/[-_]+/g, ' '));
