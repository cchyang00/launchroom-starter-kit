// Tonight's launch (owner, Oct 1 evening): "the copywriting and native ads are
// more important. then the website and product offer and upsell".
// Home leads with four blocks in that order, plus the owner's own actions. Every
// item comes from the saved plan file (store/LAUNCH-TONIGHT.md); nothing is
// ticked, counted or placed by the screen. Pure functions, shared with tests.
import {resolveDocumentPath} from './documentPaths.mjs';

export const LAUNCH_PLAN_PATH = 'store/LAUNCH-TONIGHT.md';
export const NATIVE_AD_KIT_PATH = 'templates/NATIVE-AD-KIT.md';
export const POPULATION_PATH = 'store/HYDROGEN-POPULATION.md';
export const LAUNCH_SITE_URL = 'http://localhost:3001';
// Folders the launch route may count (paths and counts only, never contents).
export const LAUNCH_FOLDER_ROOTS = Object.freeze(['products', 'research']);
export const LAUNCH_FOLDER_LIMIT = 6;

// The four blocks, in the owner's priority order. A heading belongs to the block
// whose word appears first in it ("Your ad approvals" is an action; "Ad copy
// for the product page" is ads).
export const LAUNCH_BLOCKS = Object.freeze([
  {id: 'ads', n: 1, title: 'Native ads & copy', words: /\b(?:native|ads?|copy(?:writing)?|creatives?|headlines?|hooks?|images?|angles?)\b/i},
  {id: 'website', n: 2, title: 'Website', words: /\b(?:web ?site|site|product page|pages?|store ?front|store|hydrogen|shopify|checkout)\b/i},
  {id: 'offer', n: 3, title: 'Offer & upsell', words: /\b(?:offers?|upsells?|bundles?|pric(?:e|es|ing)|deals?|discounts?|cross-?sells?|add-?ons?)\b/i},
  {id: 'actions', n: 4, title: 'Your actions', words: /\b(?:your|you|owner(?:'s)?|approvals?|approve)\b/i},
]);

/** The block a heading belongs to, or null. Earliest matching word wins; ties go to the higher priority. */
export function blockOf(heading) {
  let best = null, at = Infinity;
  for (const block of LAUNCH_BLOCKS) {
    const match = block.words.exec(String(heading || ''));
    if (match && match.index < at) { best = block.id; at = match.index; }
  }
  return best;
}

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

// A line in a section with no block heading (a timeline table, a mixed list)
// is sorted by its own words (manager, Oct 1): copy/ads/images, then the page,
// deploys and previews, then the offer, upsell and shipping rates.
export const ITEM_WORDS = Object.freeze({
  ads: /\b(?:copy(?:writing)?|ads?|ads manager|images?|headlines?|primary texts?|creatives?|hooks?)\b/i,
  website: /\b(?:populat(?:e|ion)|product page|pages?|deploy(?:s|ed)?|preview|store build|store ?front|pixel|hydrogen|site)\b/i,
  offer: /\b(?:offers?|upsells?|shipping rates?|rates?|threshold|discounts?|bundles?|packs?|express)\b/i,
});
/** The block a step's own words name, judged on its short line (splitLead), or null. */
export function itemBlockOf(text) {
  const lead = splitLead(text).lead.replace(/\*\*|`/g, '');
  let best = null, at = Infinity;
  for (const [id, words] of Object.entries(ITEM_WORDS)) {
    const match = words.exec(lead);
    if (match && match.index < at) { best = id; at = match.index; }
  }
  return best;
}
// Sections that list finished work are counted, not shown as to-dos.
const DONE_HEADING = /\b(?:already done|done so far|finished|completed)\b/i;
// The table column that names the thing, in order of preference.
const TEXT_COLUMNS = [/^step$/i, /^option$/i, /^what$/i, /^actions?$/i, /^tasks?$/i, /^items?$/i, /^element$/i, /^left open$/i];
const DONE_VALUE = /^(?:done|yes|✓|✔|x|\[x\])$/i;

/**
 * A short line for an item: its bold lead ("**Minnesota sales tax** (…)" gives
 * "Minnesota sales tax"), else its first clause (up to "(", ", ", "; " or ". "
 * after a dozen characters), at most about 80 characters. `detail` is the rest.
 */
export function splitLead(text) {
  const value = clean(text);
  const bold = /^\*\*([^*]+?)\*\*[\s:.,\-–—]*(.*)$/.exec(value);
  if (bold) return {lead: bold[1].replace(/[:.]\s*$/, ''), detail: bold[2]};
  const cut = /^(.{12,}?)(?:\s\(|,\s|;\s|\.\s)(.*)$/.exec(value);
  let lead = cut ? cut[1] : value, detail = cut ? value.slice(cut[1].length).replace(/^[\s,;.]+/, '') : '';
  if (lead.length > 84) { const at = lead.lastIndexOf(' ', 80); lead = `${lead.slice(0, at > 40 ? at : 80)}…`; detail = value; }
  return {lead, detail: detail === value && !lead.endsWith('…') ? '' : detail};
}

const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => clean(cell));

function tableItems(rows, section) {
  if (rows.length < 2 || !/^[\s|:-]+$/.test(rows[1])) return [];
  const head = cells(rows[0]);
  let textAt = -1;
  for (const pattern of TEXT_COLUMNS) { textAt = head.findIndex(name => pattern.test(name.replace(/\*/g, ''))); if (textAt >= 0) break; }
  if (textAt < 0) textAt = head[0] === '#' && head.length > 1 ? 1 : 0;
  const whoAt = head.findIndex(name => /^who$/i.test(name)), timeAt = head.findIndex(name => /^(?:time|when)$/i.test(name));
  const numAt = head.findIndex(name => name === '#'), statusAt = head.findIndex(name => /^(?:status|done)$/i.test(name));
  const skip = new Set([textAt, whoAt, timeAt, numAt, statusAt]);
  return rows.slice(2).map(cells).filter(row => row[textAt]).map(row => ({
    text: row[textAt], who: whoAt >= 0 ? row[whoAt] || '' : '', time: timeAt >= 0 ? row[timeAt] || '' : '', num: numAt >= 0 ? row[numAt] || '' : '',
    done: section.done || (statusAt >= 0 && DONE_VALUE.test(row[statusAt] || '')), task: true, depth: 0, children: [],
    more: head.map((name, index) => skip.has(index) || !row[index] ? '' : `${name.replace(/\*/g, '')}: ${row[index]}`).filter(Boolean).join(' · '),
  }));
}

/**
 * Reads the plan's Markdown: the first `#` heading is its title, every other
 * heading starts a section. Table rows, numbered lines and "- [ ]" / "- [x]"
 * lines are steps; other bullets are notes; indented lines fold under the line
 * above as its details. A sub-heading with no block word joins its parent's block.
 * Returns {title, intro, callout, sections:[{heading, level, block, done, lead, callout,
 * items:[{text, done, task, depth, who, time, num, more, children}]}], done, total}.
 */
export function parseLaunchPlan(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  let title = '', intro = '', callout = '', fenced = false, paragraph = [], table = [];
  const sections = [], stack = [];
  let current = null, lastItem = null;
  const ensure = () => { if (!current) { current = {heading: '', level: 2, block: null, done: false, lead: '', callout: '', items: []}; sections.push(current); } return current; };
  const flush = () => {
    if (table.length) { const section = ensure(); section.items.push(...tableItems(table, section)); table = []; }
    const value = clean(paragraph.join(' '));
    paragraph = [];
    if (!value) return;
    const isCallout = /^\*\*[^*]+:\*\*|^\*\*[^*]+\*\*:/.test(value);
    if (current) { if (isCallout && !current.callout) current.callout = value; else if (!current.lead) current.lead = value; }
    else if (isCallout && !callout) callout = value;
    else if (!intro) intro = value;
  };
  for (const raw of lines) {
    if (/^\s*(```|~~~)/.test(raw)) { flush(); fenced = !fenced; lastItem = null; continue; }
    if (fenced) continue;
    if (/^\s*\|/.test(raw)) { if (paragraph.length) { const keep = table; table = []; flush(); table = keep; } table.push(raw); lastItem = null; continue; }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (heading) {
      flush(); lastItem = null;
      const level = heading[1].length, name = clean(heading[2]);
      if (level === 1 && !title && !sections.length) { title = name; continue; }
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack[stack.length - 1] || null;
      const done = DONE_HEADING.test(name);
      current = {heading: name, level, block: done ? null : blockOf(name) || parent?.block || null, done, lead: '', callout: '', items: []};
      sections.push(current); stack.push(current);
      continue;
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(?:\[([ xX])\]\s*)?(.*)$/.exec(raw);
    if (item) {
      flush();
      const section = ensure();
      const depth = Math.min(3, Math.floor(item[1].replace(/\t/g, '  ').length / 2));
      const entry = {text: clean(item[4]), done: section.done || (item[3] ? item[3] !== ' ' : false), task: item[3] !== undefined || /\d/.test(item[2]) || section.done, depth, who: '', time: '', num: '', more: '', children: []};
      if (!entry.text && !entry.task) continue;
      const parent = depth > 0 ? [...section.items].reverse().find(other => other.depth < depth) : null;
      if (parent) parent.children.push(entry); else section.items.push(entry);
      lastItem = entry;
      continue;
    }
    if (!raw.trim()) { flush(); lastItem = null; continue; }
    // An indented line right under a list item continues it.
    if (lastItem && /^\s{2,}\S/.test(raw)) { lastItem.text = clean(`${lastItem.text} ${raw}`); continue; }
    paragraph.push(raw.replace(/^\s*>\s?/, ''));
  }
  flush();
  const tasks = sections.filter(section => !section.done).flatMap(section => section.items.filter(item => item.task));
  return {title, intro, callout, sections, done: tasks.filter(item => item.done).length, total: tasks.length};
}

/**
 * The four blocks in priority order. A section with a block heading goes whole
 * to its block; lines of other sections go to the block their own words name,
 * grouped under their section's heading. Lines that name no block stay with
 * their section in `other`; "Already done" sections are counted in `alreadyDone`.
 * Each block: {id, n, title, groups:[{heading, lead, callout, items}], done, total, written}.
 */
export function launchBlocks(plan) {
  const sections = plan?.sections || [];
  const groups = {ads: [], website: [], offer: [], actions: []}, other = [];
  let alreadyDone = 0;
  for (const section of sections) {
    if (section.done) { alreadyDone += section.items.length; continue; }
    const heading = section.heading.replace(/^\d+[.)]\s*/, '').replace(/\s*\([^)]*\)\s*$/, '');
    if (section.block) {
      if (section.items.length || section.lead || section.callout) groups[section.block].push({heading, lead: section.lead, callout: section.callout, items: section.items});
      continue;
    }
    // Only a plan's steps (table rows with a who or # column) are sorted; notes, appendices and lists stay put.
    const sorted = {ads: [], website: [], offer: []}, rest = [];
    for (const item of section.items) { const block = item.who || item.num ? itemBlockOf(item.text) : null; (block ? sorted[block] : rest).push(item); }
    for (const [block, items] of Object.entries(sorted)) if (items.length) groups[block].push({heading, lead: '', callout: '', items});
    if (rest.length || section.lead || section.callout) other.push({...section, heading: section.heading, items: rest});
  }
  const blocks = LAUNCH_BLOCKS.map(({words, ...block}) => {
    const mine = groups[block.id];
    const tasks = mine.flatMap(group => group.items.filter(item => item.task));
    return {...block, groups: mine, done: tasks.filter(item => item.done).length, total: tasks.length, written: mine.length > 0};
  });
  return {blocks, other, alreadyDone};
}


/**
 * Inline Markdown for one line: [label](href) and <https://…> become links,
 * **bold**, __bold__ and `code` marks are dropped. Returns [{text} | {label, href}].
 */
export function inlineParts(text) {
  const parts = [], source = String(text || '');
  const pattern = /\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|<(https?:\/\/[^>\s]+)>/g;
  const strip = value => value.replace(/\*\*|__|`/g, '');
  let last = 0, match;
  while ((match = pattern.exec(source))) {
    if (match.index > last) parts.push({text: strip(source.slice(last, match.index))});
    parts.push(match[3] ? {label: match[3], href: match[3]} : {label: strip(match[1]), href: match[2]});
    last = pattern.lastIndex;
  }
  if (last < source.length) parts.push({text: strip(source.slice(last))});
  return parts.filter(part => part.href || part.text);
}

/**
 * Where a link in the plan goes: a web page, a workspace document the reader
 * opens, or a workspace folder (shown with its file count, not opened).
 */
export function linkTarget(href, from = LAUNCH_PLAN_PATH) {
  const value = String(href || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return {kind: 'web', href: value};
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const resolved = resolveDocumentPath(from, value);
  if (!resolved || resolved.startsWith('..')) return null;
  const [file] = resolved.split('#');
  if (/\.md$/i.test(file) || file === 'workflow/the-line.json') return {kind: 'doc', path: resolved};
  if (/\.[a-z0-9]{2,5}$/i.test(file)) return {kind: 'file', path: file};
  return {kind: 'folder', path: file.replace(/\/+$/, '')};
}

/** Folder links in the given sections that the launch route may count. */
export function folderLinks(sections) {
  const found = [];
  for (const section of sections || []) for (const item of [{text: section.lead}, ...section.items]) {
    for (const part of inlineParts(item.text)) {
      const target = part.href && linkTarget(part.href);
      if (target?.kind === 'folder' && LAUNCH_FOLDER_ROOTS.includes(target.path.split('/')[0]) && !found.includes(target.path)) found.push(target.path);
    }
  }
  return found;
}

/**
 * The product the launch is about: the one in the build slot, else the first
 * P### the plan names that matches a saved product record. Returns its folder id or null.
 */
export function launchProduct({buildProductId, planText, products = []}) {
  const ids = products.map(product => product.id).filter(Boolean);
  const byShort = short => ids.find(id => id === short || id.startsWith(`${short}-`)) || null;
  if (buildProductId) return byShort(String(buildProductId).match(/^P\d{3,}/)?.[0] || buildProductId) || null;
  for (const match of String(planText || '').matchAll(/\bP\d{3,}\b/g)) { const id = byShort(match[0]); if (id) return id; }
  return null;
}

/**
 * The Home "Launch plan" panel (owner, Oct 1 night: tonight's launch is
 * paused). It shows only while a product holds the build slot (saved
 * workspace build pick) and the plan file exists; otherwise Home hides it.
 */
export function launchPanel({buildProductId, buildingName = '', planExists = false}) {
  const show = Boolean(buildProductId) && Boolean(planExists);
  return {show, eyebrow: 'Launch plan', title: buildingName ? `Launch plan · ${buildingName}` : 'Launch plan'};
}

/** The folders the Native ads block counts: the product's creative and copy folders, then folders the ads sections link. */
export function launchFolders({productId, adsSections}) {
  const folders = productId ? [`products/${productId}/creative`, `products/${productId}/copy`, `products/${productId}/assets/ads`] : [];
  for (const folder of folderLinks(adsSections)) if (!folders.includes(folder)) folders.push(folder);
  return folders.slice(0, LAUNCH_FOLDER_LIMIT);
}

/** "12 files · 5 images" for a counted folder. */
export function folderLine(folder) {
  if (!folder?.exists) return 'Not made yet';
  if (!folder.files) return 'Empty so far';
  const bits = [`${folder.files} file${folder.files === 1 ? '' : 's'}`];
  if (folder.images) bits.push(`${folder.images} image${folder.images === 1 ? '' : 's'}`);
  if (folder.truncated) bits.push('more not counted');
  return bits.join(' · ');
}

// Who a live report helps when its title names no block.
export const AGENT_BLOCKS = Object.freeze({copywriter: 'ads', 'image-maker': 'ads', 'store-builder': 'website'});

/**
 * What is happening now: live agent reports (pass liveRunning(activity)) grouped
 * by block, newest first. A report's title words decide first, then its agent;
 * reports about none of the three work blocks are left out.
 */
export function launchWork(reports = []) {
  const work = {ads: [], website: [], offer: [], actions: []};
  for (const report of [...reports].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))) {
    const block = blockOf(report.title) || AGENT_BLOCKS[report.agent] || null;
    if (block && block !== 'actions') work[block].push({id: report.id, agent: report.agent || '', title: report.title || '', latest: report.events?.at(-1)?.text || report.summary || '', updatedAt: report.updatedAt || ''});
  }
  return work;
}
