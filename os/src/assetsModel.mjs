// Pure helpers for the Assets page (the store page, picture by picture).
// The server (server/assets.mjs) works out every place and its status from the
// saved product packet, the page code and the files on disk; these helpers only
// sort, filter and word what it returns. Tested in server/assets.test.mjs.

export const SORTS = [['page', 'Page order'], ['newest', 'Newest'], ['needs', 'Needs an image first'], ['draft', 'Draft vs in store']];
export const SORT_IDS = SORTS.map(([id]) => id);

export const STATUS = {
  'in-store': {label: 'In store', tone: 'live', help: 'On the store page now.'},
  draft: {label: 'Draft', tone: 'draft', help: 'In a draft packet. It is not on the store page yet.'},
  missing: {label: 'Missing file', tone: 'bad', help: 'The page points to a file that is not there, so shoppers would see a broken picture.'},
  empty: {label: 'Needs an image', tone: 'need', help: 'Nothing is set for this place yet.'},
  optional: {label: 'Optional', tone: 'muted', help: 'Only add this when there is a real one to show.'},
  online: {label: 'Online file', tone: 'muted', help: 'Loaded from another website. The app does not open it.'},
  'not-placed': {label: 'Not placed', tone: 'draft', help: 'Saved with our files but not used on the store page.'},
  brand: {label: 'Brand', tone: 'muted', help: 'Logo and icon files.'},
  ad: {label: 'Ad', tone: 'ad', help: 'An ad picture. Ads run on Meta, not on the store page.'},
  removed: {label: 'In the bin', tone: 'muted', help: 'Moved to the bin. Restore puts it back.'},
};

export function statusLabel(slot) {
  if (slot?.status === 'empty' && slot.kind === 'video') return 'Needs a video';
  return STATUS[slot?.status]?.label || 'Unknown';
}

/** The counts line: "20 filled · 1 empty · 2 removed" (missing only when there is one). */
export function countsLine(counts = {}) {
  return [
    {id: 'filled', value: counts.filled || 0, label: 'filled'},
    {id: 'empty', value: counts.empty || 0, label: 'empty'},
    ...(counts.missing ? [{id: 'missing', value: counts.missing, label: 'missing'}] : []),
    {id: 'removed', value: counts.removed || 0, label: 'removed'},
  ];
}

const clean = value => String(value || '').toLowerCase();
const slotWords = (slot, section) => clean(`${slot.label} ${slot.alt} ${slot.file} ${slot.src} ${section.label} ${statusLabel(slot)}`);
const fileWords = item => clean(`${item.name} ${item.path} ${STATUS[item.group === 'notPlaced' ? 'not-placed' : item.group]?.label || ''}`);
const matches = (words, query) => clean(query).split(/\s+/).filter(Boolean).every(word => words.includes(word));

/** Sections whose places match the search (all of them when the search is empty). */
export function filterSections(sections = [], query = '') {
  if (!clean(query).trim()) return sections;
  return sections.map(section => ({...section, slots: section.slots.filter(slot => matches(slotWords(slot, section), query))})).filter(section => section.slots.length);
}
export const filterFiles = (items = [], query = '') => clean(query).trim() ? items.filter(item => matches(fileWords(item), query)) : items;

/**
 * One flat list for the sorts other than page order: every place on the page
 * (the closing banner repeat left out) plus the files not placed on it.
 */
export function flatTiles(map, sort = 'newest', query = '') {
  if (!map) return [];
  const tiles = [];
  for (const section of filterSections(map.sections, query)) section.slots.forEach((slot, index) => { if (!slot.derived) tiles.push({type: 'slot', id: slot.id, slot, section, status: slot.status, order: section.number * 1000 + index, at: slot.exists ? slot.modifiedAt : ''}); });
  filterFiles(map.notPlaced, query).forEach((item, index) => tiles.push({type: 'file', id: item.path, item, status: 'not-placed', order: 900000 + index, at: item.modifiedAt || ''}));
  const rank = {
    needs: {missing: 0, empty: 1, optional: 2},
    draft: {draft: 0, 'not-placed': 1, 'in-store': 2, online: 3, missing: 4, empty: 5, optional: 6},
  }[sort];
  return tiles.sort((a, b) => {
    if (sort === 'newest') return (b.at || '').localeCompare(a.at || '') || a.order - b.order;
    if (rank) return (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.order - b.order;
    return a.order - b.order;
  });
}

/** Every place a store file shows, in page order (used by the preview sheet). */
export function usedWhere(map, file) {
  if (!map || !file) return [];
  return map.sections.flatMap(section => section.slots.filter(slot => slot.file === file).map(slot => ({section, slot})));
}

/** The bin folder a production file would move to (mirrors server/assets.mjs). */
export function binFolder(path = '') {
  const match = String(path).match(/^(store\/assets|products\/P\d{3,}(?:-[a-z0-9]+)*\/assets)\//);
  return match ? `${match[1]}/_removed/` : '';
}
export const isStoreFile = path => String(path || '').startsWith('hydrogen-storefront/');

/**
 * The one planner task "Ask the store builder" creates. The packet and page
 * files live in hydrogen-storefront (not a planner reference), so they go in
 * the notes; the reference is the population procedure.
 */
export function askTask({kind, section, slot, item, packet, day}) {
  const several = (section?.slots || []).filter(entry => !entry.derived).length > 1;
  const which = several && slot ? `: ${slot.label}` : '';
  const title = (kind === 'tidy' ? `Tidy the store image folder: ${item?.name || ''}`
    : kind === 'fill' ? (slot?.kind === 'video' ? `Add a video for the ${section.label} section` : `Add the ${section.label} image${which}`)
    : kind === 'missing' ? `Fix the missing ${section.label} image${which}`
    : `Replace the ${section.label} image${which}`).slice(0, 180);
  const code = slot?.source === 'code' || section?.source === 'code';
  const site = !code && (slot?.source === 'site' || section?.source === 'site');
  const where = code ? `the <img> in ${section.codeFile}` : site ? `${slot?.key} in ${section.siteFile}` : `${slot?.key} in ${packet?.file || 'the product packet'}`;
  const nextAction = kind === 'tidy'
    ? `Check nothing uses hydrogen-storefront/${String(item?.path || '').replace(/^hydrogen-storefront\//, '')}, then remove it from the store folder or note why it stays.`
    : `${kind === 'replace' ? 'Make or choose the new picture' : 'Make or choose the picture'}, save it in hydrogen-storefront/public/images, point ${where} at it, then check the page on desktop and phone.`;
  const notes = [
    `Asked from the Assets page on ${day}.`,
    section && `Place: ${String(section.number).padStart(2, '0')} ${section.label}${slot ? ` · ${slot.label}` : ''} (${section.page === 'home' ? 'home page' : section.page === 'product' ? 'product page' : 'other pages'})`,
    code ? `Set in the page code: ${section.codeFile}` : site ? slot && `Site field: ${slot.key} in ${section.siteFile}` : slot && `Packet field: ${slot.key} in ${packet?.file || 'the product packet'}`,
    (slot?.file || item?.path) && `Current file: ${slot?.file || item?.path}`,
    slot?.alt && `Alt text now: ${slot.alt}`,
    'Use our own or licensed pictures of the exact product; keep illustrative pictures labelled.',
  ].filter(Boolean).join('\n');
  return {title, assignee: 'agent', agent: 'store-builder', date: day, step: 'build', nextAction: nextAction.slice(0, 1500), notes: notes.slice(0, 6000), references: ['store/HYDROGEN-POPULATION.md']};
}
/** An open planner task already asking for this (one task per ask). */
export const openAsk = (tasks = [], title = '') => tasks.find(task => task.status !== 'done' && task.title === title) || null;

/** The ask that fits a place: fill an empty one, fix a missing file, replace the rest. */
export function askKind(slot) {
  if (!slot) return 'tidy';
  if (slot.status === 'empty' || slot.status === 'optional') return 'fill';
  if (slot.status === 'missing') return 'missing';
  return 'replace';
}

/** For the Build and Create pages: counts and a few filled thumbnails. */
export function storePictures(map, limit = 8) {
  if (!map?.sections) return null;
  const seen = new Set(), thumbs = [];
  for (const section of map.sections) for (const slot of section.slots) {
    if (slot.derived || !slot.previewable || !slot.exists || seen.has(slot.file) || thumbs.length >= limit) continue;
    seen.add(slot.file); thumbs.push({file: slot.file, label: `${section.label} · ${slot.label}`});
  }
  const needs = map.sections.flatMap(section => section.slots.filter(slot => !slot.derived && !slot.optional && ['empty', 'missing'].includes(slot.status)).map(slot => ({section, slot})));
  return {counts: map.counts, thumbs, needs};
}

export const fileSize = bytes => !Number.isFinite(bytes) ? '' : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
