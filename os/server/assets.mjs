// Assets = the store page, picture by picture (owner, Oct 1: "the assets we have
// ... should be directly related to each section that we're going to do").
//
// The store map is read-only. It reads the Hydrogen product packets
// (hydrogen-storefront/app/content/*.json and drafts/*.json, never site.json),
// the active packet and section order from app/content/templates.ts, Merrivy's
// own pictures in app/content/site.json (always live), and, as a fallback, any
// literal /images/ pictures still written into the page code. Status comes from those saved files and
// the files on disk, never from where a tile sits on screen.
//
// Remove moves a production file (store/assets or products/P###/assets) into a
// `_removed/<day>/` bin beside it and records the move in os/data/assets.json.
// Restore moves it back. The app never deletes a file and never moves a file
// the store page uses (anything in hydrogen-storefront): those get a planner
// task for the store builder instead.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MEDIA_TYPES, text } from './domain.mjs';
import { withWorkspaceLock } from './workspace.mjs';
import { replaceFile } from './replaceFile.mjs';
import { localDay } from './memory.mjs';

export const ASSETS_PATH = 'os/data/assets.json';
export const BIN = '_removed';
export const PACKET_DIR = 'hydrogen-storefront/app/content';
export const TEMPLATES_FILE = 'hydrogen-storefront/app/content/templates.ts';
/** Merrivy's own pictures on pages that are not about one product (always live). Never a product packet. */
export const SITE_FILE = 'hydrogen-storefront/app/content/site.json';
/** The demo product packet: a real packet must not leave its pictures on Merrivy's own pages. */
export const DEMO_PACKET_FILE = 'hydrogen-storefront/app/content/hoodie.json';
// site.json holds Merrivy's own pictures; palettes.json is the palette list (Oct 2), not a product.
const NOT_PACKETS = new Set(['site.json', 'palettes.json']);
/** Read-only store media the app may show (never move). */
export const STORE_MEDIA_ROOTS = ['hydrogen-storefront/public/images', 'hydrogen-storefront/public/videos'];
const STORE_PUBLIC = 'hydrogen-storefront/public';
const CODE_DIRS = ['hydrogen-storefront/app/routes', 'hydrogen-storefront/app/components'];
const CODE_FILES = ['hydrogen-storefront/app/root.tsx'];
const PACKET_MAX = 1_000_000, CODE_MAX = 400_000, HEADER_BYTES = 64 * 1024;
const MAX_PACKETS = 30, MAX_CODE_FILES = 300, MAX_STORE_FILES = 500, MAX_SLOTS = 300;
export const REMOVED_LIMIT = 2000;
const REMOVABLE = /^(store\/assets|products\/P\d{3,}(?:-[a-z0-9]+)*\/(?:assets|creative))\/(.+)$/;
const AD_FOLDER = /^(?:ads?|meta-ads?|ad-statics?|statics?)$/i;
const BY = /^[a-z][a-z0-9-]{0,59}$/;
const RECORD_ID = /^R-[0-9a-f-]{36}$/;
export const DEFAULT_ORDER = ['story', 'benefits', 'proof', 'details', 'colors', 'useCases', 'fit', 'promise', 'faq'];
const TEMPLATE_SECTIONS = new Set(DEFAULT_ORDER);

const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const str = value => typeof value === 'string' ? value.trim() : '';
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function assetError(status, message, code) { return Object.assign(new Error(message), { status, code }); }
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ---------- Safe paths ---------- */

/** A workspace-relative path with plain segments (no traversal, aliases or secrets). */
export function safeSegments(relative) {
  if (typeof relative !== 'string' || !relative || relative.length > 1000 || /[\\\0:%?#]/.test(relative) || relative.startsWith('/')) return false;
  return relative.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
    && !/^(?:\.env.*|\.git|node_modules|credentials?|secrets?|tokens?|private|sessions?|cookies?|auth)$/i.test(part));
}
const inside = (root, candidate) => { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };

/** Absolute path for a relative one; refuses links at every existing segment. */
async function resolveSafe(root, relative) {
  if (!safeSegments(relative)) throw assetError(400, 'Use a plain workspace path with forward slashes.', 'UNSAFE_PATH');
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw assetError(403, 'Linked paths are not available to the app.', 'UNSAFE_PATH'); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') break; throw error; }
  }
  const full = path.join(root, ...relative.split('/'));
  if (!inside(root, full)) throw assetError(403, 'Path leaves the workspace.', 'UNSAFE_PATH');
  return full;
}
async function statFile(root, relative) {
  try { const stat = await fs.stat(await resolveSafe(root, relative)); return stat.isFile() ? stat : null; }
  catch (error) { if (['ENOENT', 'ENOTDIR', 'UNSAFE_PATH'].includes(error.code)) return null; throw error; }
}
async function readText(root, relative, max) {
  const stat = await statFile(root, relative);
  if (!stat) return null;
  if (stat.size > max) throw assetError(413, `${relative} is larger than the app reads.`, 'FILE_TOO_LARGE');
  return fs.readFile(await resolveSafe(root, relative), 'utf8');
}
async function listDir(root, relative) {
  // A missing folder, or one reached through a link, simply lists nothing.
  try { return await fs.readdir(await resolveSafe(root, relative), { withFileTypes: true }); }
  catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code) || error.code === 'UNSAFE_PATH') return []; throw error; }
}

/** The store's public media path for a packet `src` such as "/images/a.webp". */
export function srcFile(src) {
  const value = str(src);
  if (!value) return { kind: 'none', file: '' };
  if (/^https?:\/\//i.test(value)) return { kind: 'online', file: '', url: value };
  if (!value.startsWith('/') || value.startsWith('//')) return { kind: 'unknown', file: '' };
  let decoded;
  try { decoded = decodeURIComponent(value.split(/[?#]/)[0]); } catch { return { kind: 'unknown', file: '' }; }
  const file = `${STORE_PUBLIC}${decoded}`;
  return safeSegments(file) ? { kind: 'local', file } : { kind: 'unknown', file: '' };
}
export const isStoreMedia = relative => STORE_MEDIA_ROOTS.some(rootPath => relative.startsWith(`${rootPath}/`));
const mediaKind = relative => (MEDIA_TYPES[path.extname(relative).toLowerCase()] || '').startsWith('video/') ? 'video' : 'image';

/* ---------- Image dimensions (headers only) ---------- */

export function imageSize(extension, buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const ext = String(extension).toLowerCase(), size = (width, height) => width > 0 && height > 0 ? { width, height } : null;
  try {
    if (ext === '.png' && buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString('ascii', 12, 16) === 'IHDR') return size(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
    if (ext === '.gif' && buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') return size(buffer.readUInt16LE(6), buffer.readUInt16LE(8));
    if (ext === '.webp' && buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8X') return size(1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3));
      if (chunk === 'VP8 ') return size(buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff);
      if (chunk === 'VP8L' && buffer[20] === 0x2f) {
        const [b0, b1, b2, b3] = [buffer[21], buffer[22], buffer[23], buffer[24]];
        return size(1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
      }
      return null;
    }
    if (['.jpg', '.jpeg'].includes(ext) && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset++; continue; }
        const marker = buffer[offset + 1];
        if (marker === 0xff) { offset++; continue; }
        if ([0xd8, 0x01].includes(marker) || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return size(buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5));
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }
  } catch { return null; }
  return null;
}

/* ---------- Reading the store's code (pure parsers) ---------- */

/** The packet templates.ts imports as `packet`, e.g. "hoodie.json" or "drafts/lamp.json". */
export function parseActivePacket(source) {
  const match = String(source || '').match(/import\s+packet\s+from\s+['"]\.\/([A-Za-z0-9_./-]+\.json)['"]/);
  return match && safeSegments(match[1]) ? match[1] : '';
}
/** Each template's section order from templates.ts; unknown names are dropped. */
export function parseTemplateOrders(source) {
  const orders = {};
  for (const match of String(source || '').matchAll(/id:\s*['"]([a-z0-9-]+)['"][^{}]*?sections:\s*\[([^\]]*)\]/g)) {
    const sections = [...match[2].matchAll(/['"]([A-Za-z]+)['"]/g)].map(item => item[1]).filter(id => TEMPLATE_SECTIONS.has(id));
    if (sections.length) orders[match[1]] = [...new Set(sections)];
  }
  return orders;
}
/** Literal <img src="/..."> pictures written into a page file. */
export function parseCodeImages(source) {
  const images = [];
  for (const match of String(source || '').matchAll(/<img\b([^>]*)>/g)) {
    const attrs = match[1];
    const src = attrs.match(/\bsrc=["']([^"'{}]+)["']/)?.[1];
    if (!src || !src.startsWith('/')) continue;
    images.push({ src, alt: attrs.match(/\balt=["']([^"']*)["']/)?.[1] || '' });
  }
  return images.slice(0, 40);
}

/* ---------- Sections in page order (pure) ---------- */

const PAGES = [
  { id: 'home', label: 'Home page', url: '/' },
  { id: 'product', label: 'Product page', url: '' },
  { id: 'other', label: 'Other pages', url: '' },
];
const CODE_PAGES = {
  'hydrogen-storefront/app/routes/_index.tsx': { id: 'homeMoments', page: 'home', label: 'Home moments', help: 'Pictures under the story on the home page.' },
  'hydrogen-storefront/app/routes/about.tsx': { id: 'about', page: 'other', label: 'About page', help: 'The pictures on the About page.' },
  'hydrogen-storefront/app/routes/blogs._index.tsx': { id: 'journal', page: 'other', label: 'Journal page', help: 'Shows until the first journal post is written.' },
  'hydrogen-storefront/app/components/SupportShell.tsx': { id: 'help', page: 'other', label: 'Help and policy pages', help: 'At the foot of the delivery, returns and help pages.' },
  'hydrogen-storefront/app/components/ErrorPage.tsx': { id: 'error', page: 'other', label: 'Error page', help: 'Shows when a page is not found.' },
  'hydrogen-storefront/app/root.tsx': { id: 'setup', page: 'other', label: 'Store setup screen', help: 'Shows only while the store is not connected to Shopify.' },
};
const CODE_ORDER = Object.keys(CODE_PAGES);
const CODE_HELP = 'Set in the page code, not the product packet. The store builder changes it.';
const SITE_HELP = 'Set in site.json (Merrivy\'s own pictures, not the product packet). The store builder changes it.';
/**
 * The site.json pictures (always live), in the order the Other pages list
 * them. `after` places the product packet's About and Help blocks between them.
 */
export const SITE_PICTURES = [
  { key: 'aboutHero', id: 'aboutHero', slot: 'Hero picture', label: 'About page · Hero', help: 'The big picture at the top of the About page.' },
  { key: 'journal', id: 'journal', slot: 'Waiting picture', label: 'Journal page', help: 'Shows until the first journal post is written.' },
  { key: 'errorPage', id: 'error', slot: 'Not-found picture', label: 'Error page', help: 'Shows when a page is not found.' },
  { key: 'setupScreen', id: 'setup', slot: 'Setup picture', label: 'Store setup screen', help: 'Shows only while the store is not connected to Shopify.' },
];
/** Order of the Other pages: site pictures and the packet's About and Help blocks together. */
const OTHER_ORDER = ['aboutHero', 'aboutProduct', 'about', 'journal', 'help', 'error', 'setup'];

function imageSlot(key, value, extra = {}) {
  const object = isObj(value);
  return { key, kind: 'image', src: str(object ? value.src : value), alt: str(object ? value.alt : ''), ...extra };
}
const list = value => Array.isArray(value) ? value.slice(0, 40) : [];

/**
 * The picture places of one product packet, in the order a shopper meets them:
 * home page, then the product page (gallery, videos, the template's sections,
 * the closing banner). Missing parts of a blank draft become empty places.
 */
export function packetSections(packet, order = DEFAULT_ORDER) {
  const p = isObj(packet) ? packet : {};
  const sections = [];
  const add = (section) => sections.push({ source: 'packet', ...section });
  add({ id: 'hero', page: 'home', label: 'Home banner', help: 'The big picture at the top of the home page.', slots: [imageSlot('home.image', p.home?.image, { label: 'Banner' })] });
  add({ id: 'homeFeature', page: 'home', label: 'Home product spotlight', help: 'Beside the product description, under the banner.', slots: [imageSlot('home.featureImage', p.home?.featureImage, { label: 'Product picture' })] });
  const moments = list(p.home?.moments?.items);
  add({ id: 'homeMoments', page: 'home', label: 'Home moments', help: moments.length ? `${plural(moments.length, 'picture')} under the story on the home page.` : 'Pictures under the story on the home page.',
    slots: (moments.length ? moments : [null]).map((item, index) => imageSlot(`home.moments.items[${index}].image`, item?.image, { label: str(item?.title) || str(item?.label) || `Moment ${index + 1}` })) });
  const gallery = list(p.purchase?.gallery);
  add({ id: 'gallery', page: 'product', label: 'Product gallery', help: gallery.length ? `${plural(gallery.length, 'picture')} beside Add to cart.` : 'The pictures beside Add to cart.',
    slots: (gallery.length ? gallery : [null]).map((item, index) => imageSlot(`purchase.gallery[${index}]`, item, { label: str(item?.label) || `Picture ${index + 1}` })) });
  const demos = list(p.demonstrations?.items);
  add({ id: 'videos', page: 'product', label: 'Videos', help: 'Short clips under the purchase area. The section stays hidden until a clip is added.',
    slots: (demos.length ? demos : [null]).map((item, index) => ({ key: `demonstrations.items[${index}]`, kind: 'video', src: str(item?.src), alt: str(item?.title), poster: str(item?.poster), label: str(item?.title) || `Clip ${index + 1}` })) });
  for (const id of order) {
    if (id === 'story') add({ id: 'story', page: 'product', label: 'Buyer moment', help: 'The story picture. It shows on the home page too.', slots: [imageSlot('story.image', p.story?.image, { label: 'Story picture' })] });
    if (id === 'benefits') {
      const items = list(p.benefits?.items);
      add({ id: 'benefits', page: 'product', label: 'Why it works', help: items.length ? `${plural(items.length, 'picture')}, one for each reason.` : 'One picture for each reason.',
        slots: (items.length ? items : [null]).map((item, index) => imageSlot(`benefits.items[${index}].image`, item?.image, { label: str(item?.title) || `Reason ${index + 1}` })) });
    }
    if (id === 'proof') {
      const media = list(p.proof?.items).flatMap((review, reviewIndex) => list(review?.media).map((item, index) => ({ key: `proof.items[${reviewIndex}].media[${index}]`, kind: item?.kind === 'video' ? 'video' : 'image', src: str(item?.src), alt: str(item?.alt), label: str(review?.author) ? `${str(review.author)}'s photo` : `Review photo ${index + 1}` })));
      add({ id: 'proof', page: 'product', label: 'Review photos', help: 'Real customer photos only, with permission. Optional.', optional: true,
        slots: media.length ? media : [{ key: 'proof.items[].media[]', kind: 'image', src: '', alt: '', label: 'Real review photo', optional: true }] });
    }
    if (id === 'details') add({ id: 'details', page: 'product', label: 'Details up close', help: 'The close-up with the numbered dots.', slots: [imageSlot('featureSpotlight.image', p.featureSpotlight?.image, { label: 'Close-up', alt: str(p.featureSpotlight?.alt) })] });
    if (id === 'useCases') add({ id: 'useCases', page: 'product', label: 'Ways to use it', help: 'One styling picture beside the list.', slots: [imageSlot('useCases.image', p.useCases?.image, { label: 'Styling picture' })] });
  }
  add({ id: 'finale', page: 'product', label: 'Closing banner', help: 'Repeats the first gallery picture, so it changes with the gallery.', slots: [{ ...imageSlot('purchase.gallery[0]', gallery[0], { label: 'Same as gallery picture 1' }), derived: true }] });
  // The product's blocks on Merrivy's own pages (they change with the product).
  add({ id: 'aboutProduct', page: 'other', label: 'About page · Product block', help: 'The product block on the About page.', slots: [imageSlot('aboutProduct.image', p.aboutProduct?.image, { label: 'Product picture' })] });
  add({ id: 'help', page: 'other', label: 'Help and policy pages', help: 'At the foot of the delivery, returns and help pages.', slots: [imageSlot('helpProduct.image', p.helpProduct?.image, { label: 'Product picture' })] });
  return sections;
}

/** Merrivy's own pictures from site.json (always live, whatever packet is viewed). */
export function siteSections(site) {
  const s = isObj(site) ? site : {};
  return SITE_PICTURES.map(({ key, id, slot, label, help }) => ({ id, page: 'other', label, help, source: 'site', siteFile: SITE_FILE, note: SITE_HELP,
    slots: [imageSlot(`${key}.image`, s[key]?.image, { label: slot, caption: str(s[key]?.image?.caption), source: 'site' })] }));
}

/** Every local picture or video path ("/images/...") named in a content file (as packet-tools.mjs reads it). */
export function pictureSources(value) {
  const found = new Set();
  const walk = node => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (isObj(node)) for (const [key, item] of Object.entries(node)) {
      if (['src', 'image', 'poster'].includes(key) && typeof item === 'string' && item.startsWith('/') && !item.startsWith('//')) found.add(item.split(/[?#]/)[0]);
      else walk(item);
    }
  };
  walk(value);
  return [...found];
}
/**
 * Site pictures that still show the demo product while the active packet is a
 * real one (status other than "sample"). Mirrors packet-tools.mjs check.
 */
export function siteDemoPictures(site, { activeStatus = 'sample', demoSources = [] } = {}) {
  if (activeStatus === 'sample') return [];
  return SITE_PICTURES.map(({ key, label }) => ({ key: `${key}.image`, label, src: str(site?.[key]?.image?.src).split(/[?#]/)[0] }))
    .filter(item => item.src && demoSources.includes(item.src));
}

/** Sections for pictures written into the page code, grouped by file. */
export function codeSections(files) {
  const known = new Map(CODE_ORDER.map((file, index) => [file, index]));
  return [...files].filter(item => item.images.length)
    .sort((a, b) => (known.get(a.file) ?? 99) - (known.get(b.file) ?? 99) || a.file.localeCompare(b.file))
    .map(({ file, images }) => {
      const meta = CODE_PAGES[file] || { id: `code-${path.posix.basename(file).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, page: 'other', label: `Page code: ${path.posix.basename(file)}`, help: 'Pictures written into this page file.' };
      return { ...meta, source: 'code', codeFile: file, note: CODE_HELP, slots: images.map((image, index) => ({ key: `${path.posix.basename(file)} picture ${index + 1}`, kind: mediaKind(image.src), src: image.src, alt: image.alt, label: `Picture ${index + 1}`, source: 'code' })) };
    });
}

/**
 * All sections in page order with their numbers: home, product, other pages.
 * Other pages mix site.json pictures and the packet's About and Help blocks.
 * Literal page-code pictures are a fallback; one that shares a place with a
 * packet or site section keeps its own id and says "(page code)".
 */
export function orderSections(packetList, codeList, siteList = []) {
  const taken = new Set([...packetList, ...siteList].map(item => item.id));
  const code = codeList.map(item => taken.has(item.id) ? { ...item, id: `${item.id}-code`, label: `${item.label} (page code)` } : item);
  const home = packetList.filter(item => item.page === 'home'), product = packetList.filter(item => item.page === 'product');
  const homeCode = code.filter(item => item.page === 'home');
  const rank = item => { const at = OTHER_ORDER.indexOf(item.id.replace(/-code$/, '')); return at < 0 ? OTHER_ORDER.length : at; };
  const other = [...packetList.filter(item => item.page === 'other'), ...siteList, ...code.filter(item => item.page !== 'home')]
    .map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index).map(({ item }) => item);
  return [...home, ...homeCode, ...product, ...other].map((section, index) => ({ ...section, number: index + 1 }));
}

/** Slot status from the packet and the file on disk. */
export function slotStatus(slot, { active }) {
  if (!slot.src) return slot.optional ? 'optional' : 'empty';
  if (slot.where === 'online') return 'online';
  if (!slot.exists) return 'missing';
  return active || slot.source === 'code' || slot.source === 'site' ? 'in-store' : 'draft';
}
/** Counts for the counts line. Closing-banner repeats and optional places are not counted. */
export function storeCounts(sections, { removed = [], notPlaced = [], brand = [], ads = [] } = {}) {
  const slots = sections.flatMap(section => section.slots).filter(slot => !slot.derived);
  const required = slots.filter(slot => !slot.optional);
  const counted = status => required.filter(slot => slot.status === status).length;
  return {
    sections: sections.length, slots: required.length,
    filled: required.filter(slot => ['in-store', 'draft', 'online'].includes(slot.status)).length,
    empty: counted('empty'), missing: counted('missing'), needs: counted('empty') + counted('missing'),
    inStore: counted('in-store'), draft: counted('draft'),
    optional: slots.filter(slot => slot.optional && slot.status === 'optional').length,
    removed: removed.filter(item => item.exists).length, notPlaced: notPlaced.length, brand: brand.length, ads: ads.length,
  };
}

/* ---------- The bin record (os/data/assets.json) ---------- */

export const emptyAssetsRecord = () => ({ revision: 0, removed: [] });
export function validateAssetsRecord(raw) {
  const bad = () => assetError(500, `Malformed ${ASSETS_PATH}. Restore or repair it before removing or restoring files; no file was moved.`, 'MALFORMED_DATA');
  if (!isObj(raw) || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.removed) || raw.removed.length > REMOVED_LIMIT) throw bad();
  const ids = new Set();
  for (const item of raw.removed) {
    if (!isObj(item) || !RECORD_ID.test(item.id) || ids.has(item.id) || !removableParts(item.originalPath) || !removableParts(item.removedPath) || !iso(item.removedAt) || !BY.test(item.by) || typeof (item.reason ?? '') !== 'string') throw bad();
    if (item.restoredAt !== undefined && (!iso(item.restoredAt) || !BY.test(item.restoredBy))) throw bad();
    ids.add(item.id);
  }
  return raw;
}
/** {root, rel} for a file the app may move (store/assets or a product's assets folder). */
export function removableParts(relative) {
  if (!safeSegments(relative)) return null;
  const match = relative.match(REMOVABLE);
  return match ? { root: match[1], rel: match[2] } : null;
}
/** The bin path: <root>/_removed/<day>[-n]/<original relative path>. */
export function binPath(originalPath, day, attempt = 1) {
  const parts = removableParts(originalPath);
  if (!parts) return '';
  return `${parts.root}/${BIN}/${attempt > 1 ? `${day}-${attempt}` : day}/${parts.rel}`;
}
const isAd = relative => relative.split('/').slice(0, -1).some(part => AD_FOLDER.test(part));

/* ---------- The library: read map, remove, restore ---------- */

export function createAssetLibrary({ workspaceRoot, catalogue, now = () => new Date() }) {
  const root = path.resolve(workspaceRoot);
  const dims = new Map(), code = new Map();

  async function fileInfo(relative) {
    const stat = await statFile(root, relative);
    if (!stat) return { exists: false };
    const info = { exists: true, size: stat.size, modifiedAt: stat.mtime.toISOString() };
    const ext = path.extname(relative).toLowerCase();
    if (!MEDIA_TYPES[ext] || mediaKind(relative) === 'video') return info;
    const cached = dims.get(relative);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return { ...info, ...cached.value };
    let value = {};
    const handle = await fs.open(await resolveSafe(root, relative), 'r');
    try {
      const buffer = Buffer.alloc(Math.min(HEADER_BYTES, stat.size));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      value = imageSize(ext, buffer.subarray(0, bytesRead)) || {};
    } finally { await handle.close(); }
    if (dims.size > 800) dims.clear();
    dims.set(relative, { mtimeMs: stat.mtimeMs, size: stat.size, value });
    return { ...info, ...value };
  }

  async function readRecord() {
    let raw;
    try { raw = await readText(root, ASSETS_PATH, 4_000_000); }
    catch (error) { if (error.status === 413) throw assetError(500, `${ASSETS_PATH} is too large to read safely.`, 'MALFORMED_DATA'); throw error; }
    if (raw === null) return emptyAssetsRecord();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* reported as malformed below */ }
    return validateAssetsRecord(parsed);
  }
  async function writeRecord(record) {
    const target = await resolveSafe(root, ASSETS_PATH);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await replaceFile(temporary, target);
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }

  async function packets(problems) {
    const found = [];
    for (const [folder, prefix] of [[PACKET_DIR, ''], [`${PACKET_DIR}/drafts`, 'drafts/']]) {
      // site.json holds Merrivy's own pictures; it is never a product packet.
      for (const entry of (await listDir(root, folder)).filter(item => item.isFile() && /\.json$/i.test(item.name) && !(folder === PACKET_DIR && NOT_PACKETS.has(item.name.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name))) {
        if (found.length >= MAX_PACKETS) break;
        const file = `${folder}/${entry.name}`;
        let packet;
        try { packet = JSON.parse(await readText(root, file, PACKET_MAX)); }
        catch { problems.push(`${file} could not be read as a product packet. Its places are not shown.`); continue; }
        if (!isObj(packet) || !(isObj(packet.purchase) || isObj(packet.home))) continue;
        const stem = entry.name.replace(/\.json$/i, '');
        found.push({ id: `${prefix ? 'draft-' : ''}${stem}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'), file, name: `${prefix}${entry.name}`, label: str(packet.navLabel) || stem, status: str(packet.status) || (prefix ? 'draft' : ''), template: str(packet.templateId), productUrl: str(packet.productUrl), packet });
      }
    }
    return found;
  }

  async function codeFiles() {
    const files = [...CODE_FILES];
    for (const folder of CODE_DIRS) for (const entry of await listDir(root, folder)) if (entry.isFile() && /\.tsx$/.test(entry.name)) files.push(`${folder}/${entry.name}`);
    const result = [];
    for (const file of files.slice(0, MAX_CODE_FILES)) {
      const stat = await statFile(root, file);
      if (!stat || stat.size > CODE_MAX) continue;
      const cached = code.get(file);
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) { result.push({ file, images: cached.images }); continue; }
      const images = parseCodeImages(await readText(root, file, CODE_MAX));
      code.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, images });
      result.push({ file, images });
    }
    return result;
  }

  async function storeFolderFiles() {
    const files = [];
    async function walk(relative, depth) {
      if (depth > 4 || files.length >= MAX_STORE_FILES) return;
      for (const entry of await listDir(root, relative)) {
        if (files.length >= MAX_STORE_FILES) return;
        if (entry.isSymbolicLink()) continue;
        const file = `${relative}/${entry.name}`;
        if (entry.isDirectory()) await walk(file, depth + 1);
        else if (entry.isFile() && MEDIA_TYPES[path.extname(entry.name).toLowerCase()] && safeSegments(file)) files.push(file);
      }
    }
    for (const folder of STORE_MEDIA_ROOTS) await walk(folder, 0);
    return files;
  }

  async function withFiles(slots, active) {
    for (const slot of slots) {
      const where = srcFile(slot.src);
      slot.where = where.kind;
      slot.file = where.file;
      slot.previewable = Boolean(where.file && isStoreMedia(where.file) && MEDIA_TYPES[path.extname(where.file).toLowerCase()]);
      Object.assign(slot, where.file ? await fileInfo(where.file) : { exists: false });
      slot.status = slotStatus(slot, { active });
    }
  }

  async function item(asset, group) {
    return { path: asset.path, name: asset.name, kind: asset.kind, size: asset.size, modifiedAt: asset.modifiedAt, group, owner: 'production', removable: true, ...(asset.productId ? { productId: asset.productId } : {}), ...(await fileInfo(asset.path)) };
  }

  /** The store map for one packet (the active one by default). */
  async function map(packetId = '') {
    const problems = [];
    const [templates, found, codeList, record, production, storeFiles, siteText, demoText] = await Promise.all([
      readText(root, TEMPLATES_FILE, CODE_MAX).catch(() => null), packets(problems), codeFiles(), readRecord(),
      catalogue({ resources: false }).then(value => value.assets), storeFolderFiles(),
      readText(root, SITE_FILE, PACKET_MAX).catch(() => null), readText(root, DEMO_PACKET_FILE, PACKET_MAX).catch(() => null),
    ]);
    if (templates === null) problems.push(`${TEMPLATES_FILE} could not be read, so the default section order is shown.`);
    let site = null;
    if (siteText !== null) { try { site = JSON.parse(siteText); } catch { problems.push(`${SITE_FILE} could not be read, so Merrivy's own pictures are not shown.`); } }
    const siteList = site ? siteSections(site) : [];
    const activeName = parseActivePacket(templates);
    const orders = parseTemplateOrders(templates);
    const packetsOut = found.map(({ packet, ...meta }) => ({ ...meta, active: meta.name === activeName }));
    const chosen = found.find(item => item.id === packetId) || found.find(item => item.name === activeName) || found[0] || null;
    if (packetId && chosen?.id !== packetId) problems.push(`No product packet called "${packetId}". Showing ${chosen ? chosen.label : 'the page code only'}.`);
    if (!found.length) problems.push(`No product packet found in ${PACKET_DIR}.`);
    const active = Boolean(chosen && chosen.name === activeName);
    const order = orders[chosen?.template] || DEFAULT_ORDER;
    const sections = orderSections(chosen ? packetSections(chosen.packet, order) : [], codeSections(codeList), siteList);
    let slotTotal = 0;
    for (const section of sections) {
      section.slots = section.slots.slice(0, Math.max(0, MAX_SLOTS - slotTotal)).map((slot, index) => ({ ...slot, id: `${section.id}-${index}`, source: section.source }));
      slotTotal += section.slots.length;
      await withFiles(section.slots, active);
    }
    // Files the page uses anywhere (any packet or the page code) are placed.
    const used = new Set();
    for (const packet of found) for (const section of packetSections(packet.packet, orders[packet.template] || DEFAULT_ORDER)) for (const slot of section.slots) { const file = srcFile(slot.src).file; if (file) used.add(file); }
    for (const section of sections) for (const slot of section.slots) if (slot.file) used.add(slot.file);
    for (const section of siteList) for (const slot of section.slots) { const file = srcFile(slot.src).file; if (file) used.add(file); }
    // A real product must not leave the demo's pictures on Merrivy's own pages.
    const activePacket = found.find(item => item.name === activeName);
    let demoSources = [];
    try { demoSources = demoText === null ? [] : pictureSources(JSON.parse(demoText)); } catch { /* the demo packet's own problem is reported above */ }
    const siteDemo = activePacket && site ? siteDemoPictures(site, { activeStatus: str(activePacket.packet.status) || 'draft', demoSources }) : [];
    for (const item of siteDemo) problems.push(`site.json ${item.key} (${item.label}) still shows a demo hoodie picture (${item.src}) while the store's packet is a real product.`);
    const brand = [], ads = [], notPlaced = [];
    for (const asset of production) {
      if (asset.path.startsWith('store/assets/brand/')) brand.push(await item(asset, 'brand'));
      else if (isAd(asset.path.replace(REMOVABLE, '$2'))) ads.push(await item(asset, 'ad'));
      else notPlaced.push(await item(asset, 'notPlaced'));
    }
    for (const file of storeFiles) if (!used.has(file)) notPlaced.push({ path: file, name: path.posix.basename(file), kind: mediaKind(file), group: 'notPlaced', owner: 'store', removable: false, ...(await fileInfo(file)) });
    const removed = [];
    for (const entry of record.removed.filter(item => !item.restoredAt).slice(-300).reverse()) {
      const info = await fileInfo(entry.removedPath).catch(() => ({ exists: false }));
      removed.push({ ...entry, name: path.posix.basename(entry.originalPath), kind: mediaKind(entry.originalPath), ...info });
    }
    return {
      revision: record.revision,
      packets: packetsOut,
      packet: chosen?.id || '',
      active,
      template: chosen ? (orders[chosen.template] ? chosen.template : `${chosen.template || 'default'} (default order)`) : '',
      pages: PAGES.map(page => page.id === 'product' ? { ...page, url: chosen?.productUrl || '' } : page),
      sections, brand, ads, notPlaced, removed,
      counts: storeCounts(sections, { removed, notPlaced, brand, ads }),
      siteFile: site ? SITE_FILE : '',
      siteDemo,
      problems,
    };
  }

  function checkBy(value) {
    const by = value === undefined || value === '' ? 'owner' : value;
    if (typeof by !== 'string' || !BY.test(by)) throw assetError(400, 'Say who is moving the file: owner or an agent ID.', 'INVALID_INPUT');
    return by;
  }
  function checkRevision(record, revision) {
    if (!Number.isInteger(revision)) throw assetError(400, 'A numeric revision is required.', 'REVISION_REQUIRED');
    if (record.revision !== revision) throw assetError(409, 'The bin list changed. Reload Assets and try again.', 'REVISION_CONFLICT');
  }
  async function free(relative) {
    try { await fs.lstat(await resolveSafe(root, relative)); return false; }
    catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return true; throw error; }
  }
  async function move(from, to) {
    const source = await resolveSafe(root, from), target = await resolveSafe(root, to);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await resolveSafe(root, to); // the folders just made must not be links either
    if (!(await free(to))) throw assetError(409, 'Something already sits where the file would go. Nothing was moved.', 'TARGET_TAKEN');
    await replaceFile(source, target);
  }
  async function tidy(removedPath) {
    // Remove only folders the move left empty, up to and including an empty _removed folder.
    const parts = removableParts(removedPath);
    if (!parts) return;
    const stop = path.join(root, ...parts.root.split('/'));
    let folder = path.dirname(path.join(root, ...removedPath.split('/')));
    while (inside(stop, folder) && folder !== stop) {
      try { if ((await fs.lstat(folder)).isSymbolicLink()) return; await fs.rmdir(folder); } catch { return; }
      folder = path.dirname(folder);
    }
  }

  /** Move a production file into the bin beside it. Store page files are refused. */
  async function remove(input) {
    return withWorkspaceLock(root, async () => {
      if (!isObj(input)) throw assetError(400, 'Send the file to remove as {revision, path}.', 'INVALID_INPUT');
      const file = text(input.path, 'File path', { required: true, max: 1000 });
      if (!safeSegments(file)) throw assetError(400, 'Use a plain workspace path with forward slashes.', 'UNSAFE_PATH');
      if (file.startsWith('hydrogen-storefront/')) throw assetError(409, 'This picture belongs to the store page, so the app never moves it. Ask the store builder to replace it instead.', 'ON_STORE_PAGE');
      const parts = removableParts(file);
      if (!parts) throw assetError(403, 'Only files in store/assets or a product\'s assets folder can go to the bin.', 'NOT_REMOVABLE');
      if (parts.rel.split('/')[0] === BIN) throw assetError(400, 'This file is already in the bin. Restore it instead.', 'ALREADY_IN_BIN');
      const by = checkBy(input.by);
      const reason = text(input.reason ?? '', 'Reason', { max: 300 });
      const record = await readRecord();
      checkRevision(record, input.revision);
      if (record.removed.length >= REMOVED_LIMIT) throw assetError(409, 'The bin list is full. Ask the manager to archive it first.', 'BIN_LIST_FULL');
      const listed = (await catalogue({ resources: false })).assets.some(asset => asset.path === file);
      if (!listed) throw assetError(404, 'That file is not one of the asset files shown in the app (archived products stay as they are).', 'NOT_LISTED');
      const day = localDay(now());
      let target = '';
      for (let attempt = 1; attempt <= 99 && !target; attempt++) { const candidate = binPath(file, day, attempt); if (await free(candidate)) target = candidate; }
      if (!target) throw assetError(409, 'Too many copies of this file are already in today\'s bin.', 'TARGET_TAKEN');
      await move(file, target);
      const entry = { id: `R-${randomUUID()}`, originalPath: file, removedPath: target, removedAt: now().toISOString(), by, ...(reason ? { reason } : {}) };
      const next = { revision: record.revision + 1, removed: [...record.removed, entry] };
      try { await writeRecord(next); }
      catch (error) { await move(target, file).catch(() => {}); await tidy(target); throw error; }
      return { revision: next.revision, removed: entry };
    });
  }

  /** Move a file back from the bin. Refused when its old place is taken. */
  async function restore(input) {
    return withWorkspaceLock(root, async () => {
      if (!isObj(input)) throw assetError(400, 'Send the bin entry to restore as {revision, id}.', 'INVALID_INPUT');
      const by = checkBy(input.by);
      const record = await readRecord();
      checkRevision(record, input.revision);
      const entry = record.removed.find(item => item.id === input.id);
      if (!entry) throw assetError(404, 'That file is not in the bin list. Reload Assets.', 'NOT_FOUND');
      if (entry.restoredAt) throw assetError(409, 'That file was already restored.', 'ALREADY_RESTORED');
      if (!(await statFile(root, entry.removedPath))) throw assetError(404, 'The file is no longer in the bin folder (it may have been emptied by hand), so it cannot be restored.', 'BIN_FILE_MISSING');
      if (!(await free(entry.originalPath))) throw assetError(409, 'Another file now sits at the original place. Rename or move that file first; nothing was changed.', 'ORIGINAL_TAKEN');
      await move(entry.removedPath, entry.originalPath);
      const restored = { ...entry, restoredAt: now().toISOString(), restoredBy: by };
      const next = { revision: record.revision + 1, removed: record.removed.map(item => item.id === entry.id ? restored : item) };
      try { await writeRecord(next); }
      catch (error) { await move(entry.originalPath, entry.removedPath).catch(() => {}); throw error; }
      await tidy(entry.removedPath);
      return { revision: next.revision, restored };
    });
  }

  return { map, remove, restore, readRecord };
}
