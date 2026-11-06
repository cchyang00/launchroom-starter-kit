import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHub } from './hub.mjs';
import { localDay } from './memory.mjs';
import { imageSize, parseActivePacket, parseTemplateOrders, parseCodeImages, srcFile, removableParts, binPath, validateAssetsRecord, emptyAssetsRecord, packetSections, siteSections, siteDemoPictures, pictureSources, orderSections, codeSections, safeSegments } from './assets.mjs';
import { flatTiles, filterSections, countsLine, askTask, openAsk, askKind, usedWhere, statusLabel, binFolder, storePictures, SORT_IDS } from '../src/assetsModel.mjs';

/* ---------- Fixture: a tiny store, packets, page code and production files ---------- */

const png = (width, height) => {
  const buffer = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8); buffer.write('IHDR', 12, 'ascii'); buffer.writeUInt32BE(width, 16); buffer.writeUInt32BE(height, 20);
  return buffer;
};
const TEMPLATES = `import packet from './hoodie.json';
export const templates = [
  {id: 'story-led', name: 'Story-led', purpose: 'Lead with the moment.', sections: ['story', 'benefits', 'proof', 'details', 'colors', 'useCases', 'fit', 'promise', 'faq']},
  {id: 'gift-led', name: 'Gift-led', purpose: 'Start with the recipient.', sections: ['useCases', 'story', 'benefits', 'colors', 'proof', 'details', 'promise', 'fit', 'faq']},
];`;
const PACKET = {
  status: 'sample', templateId: 'gift-led', navLabel: 'Test Lamp', productUrl: '/products/lamp',
  home: { image: { src: '/images/hero.png', alt: 'Hero' }, featureImage: { src: '/images/gone.webp', alt: 'Gone' },
    moments: { items: [{ label: 'Staying in', title: 'Sofa, socks, done.', image: { src: '/images/hero.png', alt: 'Home moment' } }, { title: 'The long way home.', image: { src: '/images/side.png', alt: 'Out' } }] } },
  purchase: { gallery: [{ src: '/images/hero.png', alt: 'Front view', label: 'Front' }, { src: '/images/side.png', alt: 'Side view', label: 'Side' }] },
  benefits: { items: [{ title: 'Warm', image: { src: '/images/side.png', alt: 'Warm light' } }, { title: 'Bright' }] },
  story: { image: { src: 'https://cdn.example.com/story.png', alt: 'Online picture' } },
  featureSpotlight: { image: '/images/hero.png', alt: 'Close-up' },
  proof: { items: [{ author: 'Ana', media: [{ kind: 'image', src: '/images/review.png', alt: 'Ana in the lamp light' }] }] },
  demonstrations: { items: [] },
  aboutProduct: { image: { src: '/images/side.png', alt: 'About product' } },
  helpProduct: { image: { src: '/images/gone-help.webp', alt: 'Help product' } },
};
// Merrivy's own pictures (always live). The `home` key is only here to prove site.json is never read as a packet.
const SITE = {
  home: { note: 'not a product packet' },
  aboutHero: { image: { src: '/images/hero.png', alt: 'About hero', caption: 'Concept imagery' } },
  journal: { image: { src: '/images/site-only.png', alt: 'Journal' } },
  errorPage: { image: { src: '/images/missing-error.webp', alt: 'Error scene' } },
  setupScreen: { image: { src: '/images/hero.png', alt: 'Setup', caption: 'Design reference' } },
};

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-assets-'));
  let middleware;
  const server = http.createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  middleware = await createHub({ workspaceRoot: root, port });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${port}`;
  async function request(route, method = 'GET', data, headers = {}) {
    const response = await fetch(`${origin}${route}`, { method, headers: { ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' }), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
    const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body, headers: response.headers };
  }
  const file = async (relative, contents) => { const absolute = path.join(root, relative); await fs.mkdir(path.dirname(absolute), { recursive: true }); await fs.writeFile(absolute, contents); return absolute; };
  const exists = relative => fs.stat(path.join(root, relative)).then(() => true, () => false);
  await file('hydrogen-storefront/app/content/templates.ts', TEMPLATES);
  await file('hydrogen-storefront/app/content/hoodie.json', JSON.stringify(PACKET));
  await file('hydrogen-storefront/app/content/palettes.json', JSON.stringify({ palettes: [] }));
  await file('hydrogen-storefront/app/content/site.json', JSON.stringify(SITE));
  await file('hydrogen-storefront/app/content/drafts/lamp.json', JSON.stringify({ status: 'draft', navLabel: 'Draft lamp', purchase: { gallery: [] }, home: { image: { src: '/images/side.png' } } }));
  await file('hydrogen-storefront/app/routes/_index.tsx', '<img src={c.featureImage.src} alt={c.featureImage.alt} />');
  await file('hydrogen-storefront/app/components/ErrorPage.tsx', '<img\n  src="/images/missing-error.webp"\n  alt="Error scene"\n/>');
  await file('hydrogen-storefront/public/images/hero.png', png(1600, 900));
  await file('hydrogen-storefront/public/images/side.png', png(800, 1000));
  await file('hydrogen-storefront/public/images/review.png', png(600, 600));
  await file('hydrogen-storefront/public/images/site-only.png', png(1200, 800));
  await file('hydrogen-storefront/public/images/unused-original.png', png(2000, 2000));
  await file('hydrogen-storefront/.env', 'SESSION_SECRET=not-for-the-app');
  await file('store/assets/brand/logo.png', png(512, 512));
  await file('store/assets/drafts/a.png', png(1200, 800));
  await file('store/assets/drafts/README.md', '# Drafts');
  await file('products/P001/assets/J001/x.png', png(1000, 1000));
  await file('products/P001/assets/ads/ad1.png', png(1080, 1350));
  await file('products/P009-synthetic/os-product.json', JSON.stringify({ synthetic: true }));
  await file('products/P009-synthetic/assets/fake.png', png(10, 10));
  return { root, port, request, file, exists };
}
const section = (map, id) => map.sections.find(item => item.id === id);

/* ---------- Pure parts ---------- */

test('image sizes come from file headers: png, gif, webp (VP8X, VP8, VP8L) and jpeg', () => {
  assert.deepEqual(imageSize('.png', png(1536, 1024)), { width: 1536, height: 1024 });
  const gif = Buffer.alloc(13); gif.write('GIF89a', 0, 'ascii'); gif.writeUInt16LE(320, 6); gif.writeUInt16LE(240, 8);
  assert.deepEqual(imageSize('.gif', gif), { width: 320, height: 240 });
  const webp = kind => { const b = Buffer.alloc(40); b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write(kind, 12, 'ascii'); return b; };
  const vp8x = webp('VP8X'); vp8x.writeUIntLE(1535, 24, 3); vp8x.writeUIntLE(1023, 27, 3);
  assert.deepEqual(imageSize('.webp', vp8x), { width: 1536, height: 1024 });
  const vp8 = webp('VP8 '); vp8.writeUInt16LE(640, 26); vp8.writeUInt16LE(480, 28);
  assert.deepEqual(imageSize('.webp', vp8), { width: 640, height: 480 });
  const vp8l = webp('VP8L'); vp8l[20] = 0x2f; vp8l[21] = 0x2b; vp8l[22] = 0xc1; vp8l[23] = 0x31; vp8l[24] = 0x00;
  assert.deepEqual(imageSize('.webp', vp8l), { width: 300, height: 200 });
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14), Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20]), Buffer.alloc(20)]);
  assert.deepEqual(imageSize('.jpg', jpeg), { width: 800, height: 600 });
  assert.equal(imageSize('.png', Buffer.from('not a png at all, just text here')), null);
  assert.equal(imageSize('.svg', Buffer.from('<svg/>')), null);
});

test('the store code is read for the active packet, each template order and literal page pictures', () => {
  assert.equal(parseActivePacket(TEMPLATES), 'hoodie.json');
  assert.equal(parseActivePacket("import packet from './drafts/lamp.json';"), 'drafts/lamp.json');
  assert.equal(parseActivePacket("import packet from './../secrets.json';"), '');
  assert.deepEqual(parseTemplateOrders(TEMPLATES), {
    'story-led': ['story', 'benefits', 'proof', 'details', 'colors', 'useCases', 'fit', 'promise', 'faq'],
    'gift-led': ['useCases', 'story', 'benefits', 'colors', 'proof', 'details', 'promise', 'fit', 'faq'],
  });
  assert.deepEqual(parseCodeImages('<img src="/images/a.webp" alt="A" />\n<img src={x.src} alt="dynamic" />\n<img\n  alt="B first"\n  src="/images/b.webp"\n  loading="lazy"\n/>\n<img src="https://cdn.example.com/c.png" alt="online" />'),
    [{ src: '/images/a.webp', alt: 'A' }, { src: '/images/b.webp', alt: 'B first' }]);
  assert.deepEqual(srcFile('/images/campaign-coast.webp'), { kind: 'local', file: 'hydrogen-storefront/public/images/campaign-coast.webp' });
  assert.equal(srcFile('https://cdn.shopify.com/x.png').kind, 'online');
  assert.equal(srcFile('').kind, 'none');
  for (const unsafe of ['/images/../.env', '/images/%2e%2e/.env', 'images/a.png', '//evil.example/a.png', '/images/a\\b.png']) assert.equal(srcFile(unsafe).file, '', unsafe);
});

test('a packet becomes places in page order; a blank draft shows every place as empty', () => {
  const sections = packetSections(PACKET, parseTemplateOrders(TEMPLATES)['gift-led']);
  assert.deepEqual(sections.map(item => item.id), ['hero', 'homeFeature', 'homeMoments', 'gallery', 'videos', 'useCases', 'story', 'benefits', 'proof', 'details', 'finale', 'aboutProduct', 'help']);
  assert.deepEqual(section({ sections }, 'homeMoments').slots.map(slot => [slot.key, slot.label, slot.src]), [['home.moments.items[0].image', 'Sofa, socks, done.', '/images/hero.png'], ['home.moments.items[1].image', 'The long way home.', '/images/side.png']], 'labelled by each moment\'s title');
  assert.deepEqual(['aboutProduct', 'help'].map(id => [section({ sections }, id).page, section({ sections }, id).slots[0].key]), [['other', 'aboutProduct.image'], ['other', 'helpProduct.image']]);
  assert.deepEqual(section({ sections }, 'gallery').slots.map(slot => [slot.key, slot.label, slot.src]), [['purchase.gallery[0]', 'Front', '/images/hero.png'], ['purchase.gallery[1]', 'Side', '/images/side.png']]);
  assert.equal(section({ sections }, 'details').slots[0].src, '/images/hero.png', 'the spotlight image is a plain string in the packet');
  assert.equal(section({ sections }, 'finale').slots[0].derived, true);
  const blank = packetSections({ purchase: {} });
  assert.ok(blank.flatMap(item => item.slots).filter(slot => !slot.optional).every(slot => slot.src === ''));
  assert.equal(section({ sections: blank }, 'proof').slots[0].optional, true, 'review photos stay optional');
  assert.equal(section({ sections: blank }, 'videos').slots[0].kind, 'video');
  assert.deepEqual(['homeMoments', 'aboutProduct', 'help'].map(id => section({ sections: blank }, id).slots[0].src), ['', '', ''], 'a blank draft shows its moment and page blocks as empty places');
});

test('site.json pictures are always-live places on the other pages; page-code pictures stay a fallback', () => {
  const site = siteSections(SITE);
  assert.deepEqual(site.map(item => [item.id, item.label, item.slots[0].key, item.source]), [
    ['aboutHero', 'About page · Hero', 'aboutHero.image', 'site'], ['journal', 'Journal page', 'journal.image', 'site'],
    ['error', 'Error page', 'errorPage.image', 'site'], ['setup', 'Store setup screen', 'setupScreen.image', 'site']]);
  assert.equal(site[0].slots[0].caption, 'Concept imagery');
  const code = codeSections([{ file: 'hydrogen-storefront/app/components/ErrorPage.tsx', images: [{ src: '/images/old.webp', alt: 'Old' }] }, { file: 'hydrogen-storefront/app/routes/about.tsx', images: [{ src: '/images/about.webp', alt: 'About' }] }]);
  const ordered = orderSections(packetSections(PACKET), code, site);
  assert.deepEqual(ordered.filter(item => item.page === 'other').map(item => item.id), ['aboutHero', 'aboutProduct', 'about', 'journal', 'help', 'error', 'error-code', 'setup'], 'other pages in the order a shopper finds them; a duplicate code place keeps its own id');
  assert.equal(ordered.find(item => item.id === 'error-code').label, 'Error page (page code)');
  assert.deepEqual(orderSections([], code, []).map(item => item.id), ['about', 'error'], 'an older store without site.json still shows its page-code pictures');
  // A real product must not keep the demo's pictures on Merrivy's own pages (mirrors packet-tools check).
  const demo = pictureSources(PACKET);
  assert.ok(demo.includes('/images/hero.png') && demo.includes('/images/gone-help.webp'));
  assert.deepEqual(siteDemoPictures(SITE, { activeStatus: 'sample', demoSources: demo }), [], 'the demo store itself may use them');
  assert.deepEqual(siteDemoPictures(SITE, { activeStatus: 'draft', demoSources: demo }).map(item => item.key), ['aboutHero.image', 'setupScreen.image']);
});

test('only store/assets and product assets folders can move to the bin, beside the original', () => {
  assert.deepEqual(removableParts('store/assets/drafts/a.png'), { root: 'store/assets', rel: 'drafts/a.png' });
  assert.deepEqual(removableParts('products/P001-lamp/assets/J002/hero.png'), { root: 'products/P001-lamp/assets', rel: 'J002/hero.png' });
  for (const refused of ['hydrogen-storefront/public/images/a.png', 'products/P001/notes/a.png', 'store/assets/../os/data/assets.json', 'resources/a.png', 'os/data/assets.json']) assert.equal(removableParts(refused), null, refused);
  assert.equal(binPath('store/assets/drafts/a.png', '2026-10-01'), 'store/assets/_removed/2026-10-01/drafts/a.png');
  assert.equal(binPath('products/P001/assets/J001/x.png', '2026-10-01', 2), 'products/P001/assets/_removed/2026-10-01-2/J001/x.png');
  assert.equal(binFolder('products/P001/assets/J001/x.png'), 'products/P001/assets/_removed/');
  assert.equal(safeSegments('store/assets/.env'), false);
  assert.doesNotThrow(() => validateAssetsRecord(emptyAssetsRecord()));
  for (const bad of [null, { revision: -1, removed: [] }, { revision: 1, removed: [{ id: 'R-1', originalPath: 'store/assets/a.png' }] }, { revision: 1, removed: [{ id: `R-${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`, originalPath: 'os/data/x.png', removedPath: 'store/assets/_removed/x.png', removedAt: new Date().toISOString(), by: 'owner' }] }]) assert.throws(() => validateAssetsRecord(bad), error => error.code === 'MALFORMED_DATA');
});

/* ---------- The store map over HTTP ---------- */

test('GET /api/assets maps the store page in order with saved statuses, sizes and the groups after the page', async t => {
  const f = await fixture(t);
  const { status, body: map } = await f.request('/api/assets');
  assert.equal(status, 200);
  assert.deepEqual(map.packets.map(item => [item.id, item.active, item.label]), [['hoodie', true, 'Test Lamp'], ['draft-lamp', false, 'Draft lamp']], 'palettes.json and site.json are not packets');
  assert.equal(map.packet, 'hoodie'); assert.equal(map.active, true); assert.equal(map.template, 'gift-led'); assert.equal(map.siteFile, 'hydrogen-storefront/app/content/site.json');
  assert.deepEqual(map.sections.map(item => [item.number, item.label]), [[1, 'Home banner'], [2, 'Home product spotlight'], [3, 'Home moments'], [4, 'Product gallery'], [5, 'Videos'], [6, 'Ways to use it'], [7, 'Buyer moment'], [8, 'Why it works'], [9, 'Review photos'], [10, 'Details up close'], [11, 'Closing banner'],
    [12, 'About page · Hero'], [13, 'About page · Product block'], [14, 'Journal page'], [15, 'Help and policy pages'], [16, 'Error page'], [17, 'Error page (page code)'], [18, 'Store setup screen']]);
  const hero = section(map, 'hero').slots[0];
  assert.deepEqual([hero.status, hero.file, hero.width, hero.height, hero.previewable], ['in-store', 'hydrogen-storefront/public/images/hero.png', 1600, 900, true]);
  assert.equal(section(map, 'homeFeature').slots[0].status, 'missing');
  assert.equal(section(map, 'useCases').slots[0].status, 'empty');
  assert.equal(section(map, 'story').slots[0].status, 'online');
  assert.deepEqual(section(map, 'benefits').slots.map(slot => slot.status), ['in-store', 'empty']);
  assert.equal(statusLabel(section(map, 'videos').slots[0]), 'Needs a video');
  assert.equal(section(map, 'homeMoments').source, 'packet'); assert.deepEqual(section(map, 'homeMoments').slots.map(slot => [slot.alt, slot.status]), [['Home moment', 'in-store'], ['Out', 'in-store']]);
  assert.deepEqual(['aboutHero', 'journal', 'setup'].map(id => [section(map, id).source, section(map, id).slots[0].status]), [['site', 'in-store'], ['site', 'in-store'], ['site', 'in-store']]);
  assert.equal(section(map, 'aboutProduct').slots[0].status, 'in-store'); assert.equal(section(map, 'help').slots[0].status, 'missing');
  assert.equal(section(map, 'error').slots[0].status, 'missing'); assert.equal(section(map, 'error-code').source, 'code');
  assert.ok(map.sections.flatMap(item => item.slots).every((slot, index, all) => all.findIndex(other => other.id === slot.id) === index), 'every place has its own id');
  assert.deepEqual(map.counts, { sections: 18, slots: 20, filled: 13, empty: 3, missing: 4, needs: 7, inStore: 12, draft: 0, optional: 0, removed: 0, notPlaced: 3, brand: 1, ads: 1 });
  assert.deepEqual(map.siteDemo, [], 'the demo store may show demo pictures on its own pages');
  assert.deepEqual(map.brand.map(item => item.path), ['store/assets/brand/logo.png']);
  assert.deepEqual(map.ads.map(item => item.path), ['products/P001/assets/ads/ad1.png']);
  assert.deepEqual(map.notPlaced.map(item => [item.path, item.owner, item.removable]), [
    ['products/P001/assets/J001/x.png', 'production', true], ['store/assets/drafts/a.png', 'production', true],
    ['hydrogen-storefront/public/images/unused-original.png', 'store', false]], 'used store and site pictures and synthetic products stay out');
  assert.deepEqual(usedWhere(map, 'hydrogen-storefront/public/images/hero.png').map(({ section: s }) => s.id), ['hero', 'homeMoments', 'gallery', 'details', 'finale', 'aboutHero', 'setup']);
  const draft = (await f.request('/api/assets?packet=draft-lamp')).body;
  assert.equal(draft.active, false);
  assert.equal(section(draft, 'hero').slots[0].status, 'draft', 'a draft packet\'s file is a draft, not in store');
  assert.equal(section(draft, 'gallery').slots[0].status, 'empty');
  assert.equal(section(draft, 'homeMoments').slots[0].status, 'empty', 'the draft has no moments yet');
  assert.equal(section(draft, 'aboutHero').slots[0].status, 'in-store', 'site pictures stay in the store whatever packet is viewed');
  assert.equal(section(draft, 'error-code').slots[0].status, 'missing', 'page-code pictures too');
  assert.match((await f.request('/api/assets?packet=nope')).body.problems.join(' '), /No product packet called "nope"/);
  // The store switches to a real (non-sample) packet: site pictures still showing the demo's are flagged.
  await f.file('hydrogen-storefront/app/content/templates.ts', TEMPLATES.replace("'./hoodie.json'", "'./drafts/lamp.json'"));
  const real = (await f.request('/api/assets')).body;
  assert.equal(real.packet, 'draft-lamp'); assert.equal(real.active, true);
  assert.deepEqual(real.siteDemo.map(item => [item.key, item.src]), [['aboutHero.image', '/images/hero.png'], ['setupScreen.image', '/images/hero.png']]);
  assert.match(real.problems.join(' '), /site\.json aboutHero\.image \(About page · Hero\) still shows a demo hoodie picture/);
});

test('store pictures are served read-only; nothing else in hydrogen-storefront is', async t => {
  const f = await fixture(t);
  const image = await f.request(`/api/asset?path=${encodeURIComponent('hydrogen-storefront/public/images/hero.png')}`);
  assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
  for (const refused of ['hydrogen-storefront/app/content/hoodie.json', 'hydrogen-storefront/.env', 'hydrogen-storefront/app/routes/_index.tsx']) assert.equal((await f.request(`/api/asset?path=${encodeURIComponent(refused)}`)).status, 403, refused);
  assert.equal((await f.request(`/api/asset?path=${encodeURIComponent('hydrogen-storefront/public/images/../../.env')}`)).status, 400);
});

/* ---------- Remove to the bin, Restore ---------- */

test('remove moves a production file into a dated bin beside it, records it, and the asset list skips the bin', async t => {
  const f = await fixture(t), day = localDay();
  const removed = await f.request('/api/assets/remove', 'POST', { revision: 0, path: 'store/assets/drafts/a.png' });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.revision, 1);
  assert.equal(removed.body.removed.removedPath, `store/assets/_removed/${day}/drafts/a.png`);
  assert.equal(removed.body.removed.by, 'owner');
  assert.equal(await f.exists('store/assets/drafts/a.png'), false);
  assert.equal(await f.exists(`store/assets/_removed/${day}/drafts/a.png`), true, 'moved, never deleted');
  const record = JSON.parse(await fs.readFile(path.join(f.root, 'os/data/assets.json'), 'utf8'));
  assert.equal(record.revision, 1); assert.equal(record.removed[0].originalPath, 'store/assets/drafts/a.png');
  const hub = (await f.request('/api/hub')).body;
  assert.ok(!hub.assets.some(item => item.path.includes('/_removed/') || item.path.endsWith('/a.png')), 'the bin is not listed as assets');
  const map = (await f.request('/api/assets')).body;
  assert.equal(map.revision, 1); assert.equal(map.counts.removed, 1);
  assert.deepEqual(map.removed.map(item => [item.name, item.exists]), [['a.png', true]]);
  assert.equal((await f.request('/api/assets/remove', 'POST', { revision: 0, path: 'products/P001/assets/J001/x.png' })).body.code, 'REVISION_CONFLICT');
  const product = await f.request('/api/assets/remove', 'POST', { revision: 1, path: 'products/P001/assets/J001/x.png', by: 'image-maker', reason: 'Superseded by v2' });
  assert.equal(product.status, 200);
  assert.equal(product.body.removed.removedPath, `products/P001/assets/_removed/${day}/J001/x.png`);
  assert.deepEqual([product.body.removed.by, product.body.removed.reason], ['image-maker', 'Superseded by v2']);
});

test('remove refuses traversal, store page files, unlisted files, the bin itself and requests without the local Origin', async t => {
  const f = await fixture(t), day = localDay();
  const attempt = (data, headers) => f.request('/api/assets/remove', 'POST', { revision: 0, ...data }, headers);
  for (const unsafe of ['store/assets/../os/data/assets.json', 'store/assets/drafts\\a.png', 'store/assets/%2e%2e/a.png', '/etc/passwd', 'C:/Windows/win.ini', 'store/assets/drafts/a.png.']) {
    const result = await attempt({ path: unsafe });
    assert.equal(result.status, 400, unsafe); assert.equal(result.body.code, 'UNSAFE_PATH', unsafe);
  }
  const slot = await attempt({ path: 'hydrogen-storefront/public/images/hero.png' });
  assert.deepEqual([slot.status, slot.body.code], [409, 'ON_STORE_PAGE']);
  assert.match(slot.body.error, /store builder/);
  assert.equal(await f.exists('hydrogen-storefront/public/images/hero.png'), true, 'store page files are never moved');
  assert.deepEqual([(await attempt({ path: 'os/data/workspace.json' })).body.code, (await attempt({ path: 'resources/a.png' })).body.code], ['NOT_REMOVABLE', 'NOT_REMOVABLE']);
  assert.equal((await attempt({ path: 'store/assets/drafts/README.md' })).body.code, 'NOT_LISTED');
  assert.equal((await attempt({ path: 'products/P009-synthetic/assets/fake.png' })).body.code, 'NOT_LISTED');
  assert.equal((await attempt({ path: `store/assets/_removed/${day}/drafts/a.png` })).body.code, 'ALREADY_IN_BIN');
  assert.equal((await attempt({ path: 'store/assets/drafts/a.png', by: 'Owner Name' })).body.code, 'INVALID_INPUT');
  assert.equal((await f.request('/api/assets/remove', 'POST', { revision: 0, path: 'store/assets/drafts/a.png' }, { Origin: 'http://evil.example' })).status, 403);
  assert.equal(await f.exists('store/assets/drafts/a.png'), true);
  await assert.rejects(fs.stat(path.join(f.root, 'os/data/assets.json')), { code: 'ENOENT' }, 'refusals write nothing');
});

test('restore moves the file back, refuses an occupied original and a bin emptied by hand', async t => {
  const f = await fixture(t), day = localDay();
  const first = (await f.request('/api/assets/remove', 'POST', { revision: 0, path: 'store/assets/drafts/a.png' })).body;
  const restored = await f.request('/api/assets/restore', 'POST', { revision: 1, id: first.removed.id });
  assert.equal(restored.status, 200); assert.equal(restored.body.revision, 2); assert.ok(restored.body.restored.restoredAt);
  assert.equal(await f.exists('store/assets/drafts/a.png'), true);
  assert.equal(await f.exists(`store/assets/_removed/${day}`), false, 'the emptied dated folder is tidied away');
  assert.equal(await f.exists('store/assets/_removed'), false, 'an empty bin folder goes too');
  assert.equal(await f.exists('store/assets/drafts/README.md'), true, 'nothing else is touched');
  assert.equal((await f.request('/api/assets/restore', 'POST', { revision: 2, id: first.removed.id })).body.code, 'ALREADY_RESTORED');
  assert.equal((await f.request('/api/assets')).body.counts.removed, 0);
  // Remove again, then put a new file where it was: restore must not overwrite it.
  const second = (await f.request('/api/assets/remove', 'POST', { revision: 2, path: 'store/assets/drafts/a.png' })).body;
  await f.file('store/assets/drafts/a.png', png(10, 10));
  const blocked = await f.request('/api/assets/restore', 'POST', { revision: 3, id: second.removed.id });
  assert.deepEqual([blocked.status, blocked.body.code], [409, 'ORIGINAL_TAKEN']);
  assert.equal(await f.exists(second.removed.removedPath), true);
  assert.equal((await fs.readFile(path.join(f.root, 'store/assets/drafts/a.png'))).readUInt32BE(16), 10, 'the newer file is untouched');
  // The same name removed twice in one day goes to a second dated folder.
  const third = (await f.request('/api/assets/remove', 'POST', { revision: 3, path: 'store/assets/drafts/a.png' })).body;
  assert.equal(third.removed.removedPath, `store/assets/_removed/${day}-2/drafts/a.png`);
  // The owner empties the bin folder by hand: the entry stays listed as gone and cannot be restored.
  await fs.rm(path.join(f.root, ...third.removed.removedPath.split('/')));
  const gone = await f.request('/api/assets/restore', 'POST', { revision: 4, id: third.removed.id });
  assert.deepEqual([gone.status, gone.body.code], [404, 'BIN_FILE_MISSING']);
  const map = (await f.request('/api/assets')).body;
  assert.deepEqual(map.removed.map(item => [item.removedPath, item.exists]), [[third.removed.removedPath, false], [second.removed.removedPath, true]]);
  assert.equal(map.counts.removed, 1);
  assert.equal((await f.request('/api/assets/restore', 'POST', { revision: 4, id: 'R-nope' })).body.code, 'NOT_FOUND');
});

/* ---------- The page's sorting, search and asks (src/assetsModel.mjs) ---------- */

test('sorts flatten the page: needs first, newest, draft vs in store; search keeps matching places', async t => {
  const f = await fixture(t);
  const map = (await f.request('/api/assets')).body;
  assert.deepEqual(SORT_IDS, ['page', 'newest', 'needs', 'draft']);
  const needs = flatTiles(map, 'needs');
  assert.deepEqual(needs.slice(0, 7).map(tile => tile.status), ['missing', 'missing', 'missing', 'missing', 'empty', 'empty', 'empty']);
  assert.ok(!needs.some(tile => tile.slot?.derived), 'the closing banner repeat is left out of flat views');
  assert.equal(needs.filter(tile => tile.type === 'file').length, 3);
  const draft = flatTiles(map, 'draft');
  assert.equal(draft[0].status, 'not-placed');
  const newest = flatTiles(map, 'newest');
  assert.ok(newest.every((tile, index) => index === 0 || (newest[index - 1].at || '') >= (tile.at || '')));
  assert.deepEqual(filterSections(map.sections, 'warm').map(item => item.id), ['benefits']);
  assert.deepEqual(filterSections(map.sections, 'needs a video').map(item => item.id), ['videos']);
  assert.deepEqual(countsLine(map.counts).map(item => `${item.value} ${item.label}`), ['13 filled', '3 empty', '4 missing', '0 removed']);
  const pictures = storePictures(map);
  assert.equal(pictures.needs.length, 7); assert.ok(pictures.thumbs.length >= 3 && new Set(pictures.thumbs.map(item => item.file)).size === pictures.thumbs.length);
});

test('asking the store builder makes one plain planner task with the packet field in its notes', async t => {
  const f = await fixture(t);
  const map = (await f.request('/api/assets')).body;
  const packet = map.packets.find(item => item.id === map.packet);
  const gallery = section(map, 'gallery');
  const ask = askTask({ kind: askKind(gallery.slots[1]), section: gallery, slot: gallery.slots[1], packet, day: '2026-10-01' });
  assert.equal(ask.title, 'Replace the Product gallery image: Side');
  assert.deepEqual([ask.assignee, ask.agent, ask.step, ask.date], ['agent', 'store-builder', 'build', '2026-10-01']);
  assert.deepEqual(ask.references, ['store/HYDROGEN-POPULATION.md']);
  assert.match(ask.notes, /purchase\.gallery\[1\] in hydrogen-storefront\/app\/content\/hoodie\.json/);
  assert.match(ask.notes, /Current file: hydrogen-storefront\/public\/images\/side\.png/);
  const hero = section(map, 'hero');
  assert.equal(askTask({ kind: 'replace', section: hero, slot: hero.slots[0], packet, day: '2026-10-01' }).title, 'Replace the Home banner image');
  assert.equal(askTask({ kind: askKind(section(map, 'videos').slots[0]), section: section(map, 'videos'), slot: section(map, 'videos').slots[0], packet, day: '2026-10-01' }).title, 'Add a video for the Videos section');
  assert.equal(askKind(section(map, 'homeFeature').slots[0]), 'missing');
  const moment = askTask({ kind: 'replace', section: section(map, 'homeMoments'), slot: section(map, 'homeMoments').slots[1], packet, day: '2026-10-01' });
  assert.equal(moment.title, 'Replace the Home moments image: The long way home.');
  assert.match(moment.notes, /home\.moments\.items\[1\]\.image in hydrogen-storefront\/app\/content\/hoodie\.json/);
  const site = askTask({ kind: 'replace', section: section(map, 'journal'), slot: section(map, 'journal').slots[0], packet, day: '2026-10-01' });
  assert.match(site.notes, /Site field: journal\.image in hydrogen-storefront\/app\/content\/site\.json/);
  assert.match(site.nextAction, /point journal\.image in hydrogen-storefront\/app\/content\/site\.json at it/);
  const code = askTask({ kind: 'missing', section: section(map, 'error-code'), slot: section(map, 'error-code').slots[0], packet, day: '2026-10-01' });
  assert.match(code.notes, /Set in the page code: hydrogen-storefront\/app\/components\/ErrorPage\.tsx/);
  const tidy = askTask({ kind: 'tidy', item: map.notPlaced.find(item => item.owner === 'store'), day: '2026-10-01' });
  assert.equal(tidy.title, 'Tidy the store image folder: unused-original.png');
  const tasks = [{ id: 'T-1', title: ask.title, status: 'todo' }, { id: 'T-2', title: tidy.title, status: 'done' }];
  assert.equal(openAsk(tasks, ask.title)?.id, 'T-1', 'one open task per ask');
  assert.equal(openAsk(tasks, tidy.title), null, 'a finished ask can be asked again');
});
