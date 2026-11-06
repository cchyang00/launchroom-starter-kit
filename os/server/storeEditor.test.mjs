import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, existsSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApi } from './api.mjs';
import { createStoreEditor, activePacketFile, CONTENT_DIR, EDITS_PATH } from './storeEditor.mjs';
import { editorSections, fieldMap, explainProblem, conditionHint, ownerEdits, undoable, sincePublish, ownerEditsMarkdown, setAt, getAt, splitPath, META_RULE } from '../src/storeEditorModel.mjs';

// The Store editor against a temporary copy of the real demo packet, site file
// and packet-tools (never the live store files).
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = {
  packet: path.join(repo, 'hydrogen-storefront/app/content/_archived/hoodie.json'),
  site: path.join(repo, 'hydrogen-storefront/app/content/site.json'),
  tools: path.join(repo, 'hydrogen-storefront/scripts/packet-tools.mjs'),
  palettes: path.join(repo, 'hydrogen-storefront/app/content/palettes.ts'),
};
const ready = Object.values(real).every(file => existsSync(file));
// A palettes.ts in today's shape plus a possible next one (mood groups and good-for notes).
const PALETTES_TS = `export const PALETTES: Palette[] = [
  {id: 'lavender', name: 'Lavender & Butter', group: 'Soft', paper: '#fdfaf4', ink: '#2e2546', muted: '#655c7a', line: '#ebe4f0', accent: '#c7b3ff', accentText: '#6a4fd6', onAccent: '#2e2546', highlight: '#fff0b8', shade: '#1c1630'},
  {
    id: 'peach',
    name: 'Peach & Periwinkle',
    group: 'Soft',
    mood: 'Calm',
    goodFor: 'Sleep and evening routines',
    paper: '#fff8f2', ink: '#273152', muted: '#5d6684', line: '#f1e4d9', accent: '#ffb898', accentText: '#5464c8', onAccent: '#273152', highlight: '#dfe4ff', shade: '#161c33',
  },
  {id: 'broken', name: 'No colors', group: 'Soft'},
];
`;

async function fixture(t, edit = packet => packet) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-store-editor-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-store-editor-')); await fs.rm(root, { recursive: true, force: true }); });
  const content = path.join(root, CONTENT_DIR);
  await fs.mkdir(content, { recursive: true });
  await fs.mkdir(path.join(root, 'hydrogen-storefront/scripts'), { recursive: true });
  await fs.copyFile(real.tools, path.join(root, 'hydrogen-storefront/scripts/packet-tools.mjs'));
  const packet = edit(JSON.parse(await fs.readFile(real.packet, 'utf8')));
  await fs.writeFile(path.join(content, 'hoodie.json'), JSON.stringify(packet, null, 2) + '\n');
  await fs.copyFile(real.site, path.join(content, 'site.json'));
  await fs.writeFile(path.join(content, 'palettes.ts'), PALETTES_TS);
  await fs.writeFile(path.join(content, 'templates.ts'), "import packet from './hoodie.json';\n");
  const tools = await import(pathToFileURL(real.tools).href);
  const site = JSON.parse(await fs.readFile(real.site, 'utf8'));
  for (const src of [...tools.pictureSources(packet), ...tools.pictureSources(site), '/images/new-pick.webp', '/images/demo-gen/other.webp']) {
    const file = path.join(root, 'hydrogen-storefront/public', src);
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, 'img');
  }
  return { root, file: path.join(content, 'hoodie.json') };
}
function fakeNotes() {
  const notes = [];
  return {
    notes,
    add: async input => { notes.push({ id: `N-${notes.length + 1}`, status: 'open', response: '', ...input }); return { notes }; },
    address: async (id, response) => { const note = notes.find(item => item.id === id); note.status = 'addressed'; note.response = response; },
    workspace: async () => ({ notes }),
  };
}
const code = async (promise, expected) => { await assert.rejects(promise, error => { assert.equal(error.code, expected, error.message); return true; }); };

test('the model builds the form in page order with plain labels and read-only offer numbers', { skip: !ready }, async () => {
  const packet = JSON.parse(await fs.readFile(real.packet, 'utf8'));
  const sections = editorSections(packet);
  assert.deepEqual(sections.slice(0, 6).map(s => s.id), ['top', 'gallery', 'problem', 'features', 'howToUse', 'whoFor']);
  assert.equal(sections.at(-1).id, 'other');
  const fields = fieldMap(packet);
  assert.equal(fields.get('hero.headline').label, 'Headline at the top');
  assert.equal(fields.get('hero.benefits.0.text').label, 'Benefit 1');
  assert.equal(fields.get('purchase.gallery.0.src').kind, 'image');
  assert.equal(fields.get('features.items.0.image').kind, 'image');
  for (const fixed of ['offer.sale.percentOff', 'offer.freeShippingOver', 'offer.shippingFee', 'purchase.offerChoices.0.quantity', 'bundle.quantity', 'guarantee.days']) assert.equal(fields.get(fixed).kind, 'fixed', fixed);
  assert.ok(fields.get('reviews.items.0.text').sample);
  for (const outside of ['theme.ink', 'templateId', 'productHandles.0', 'productUrl', 'reviews.items.0.kind', 'status']) assert.equal(fields.get(outside), undefined, outside);
  // Headings with a line break are a text area.
  assert.equal(fields.get('features.heading').kind, 'text');
  // A different template moves Who it's for, never the hero.
  assert.deepEqual(editorSections({ ...packet, templateId: 'gift-led' }).slice(0, 4).map(s => s.id), ['top', 'gallery', 'problem', 'whoFor']);
});

test('the model explains store-check problems in plain words and warns about Meta wording live', { skip: !ready }, async () => {
  const packet = JSON.parse(await fs.readFile(real.packet, 'utf8'));
  const fields = fieldMap(packet);
  assert.equal(explainProblem('problem: "You have trouble" speaks to the reader\'s condition; write it in the third person or as a situation', fields), META_RULE);
  assert.match(explainProblem('hero.headline', fields), /“Top of the page · Headline at the top” can’t be empty/);
  assert.match(explainProblem('hero.headline is too long (keep it to about 8 words)', fields), /too long/);
  assert.match(explainProblem('faq.items.0.answer: "Doctor approved" reads as proof we do not hold', fields), /proof we don’t hold/);
  assert.match(conditionHint(fields.get('problem.situations.0'), 'You have cold hands'), /personal-attributes/);
  assert.equal(conditionHint(fields.get('hero.headline'), 'You have cold hands'), '', 'only fields the check holds to the rule');
  assert.deepEqual(splitPath('a.0.b'), ['a', '0', 'b']); assert.equal(splitPath('a..b'), null); assert.equal(splitPath('__proto__.x'), null);
  assert.throws(() => setAt({ a: 1 }, 'b', 2)); assert.equal(getAt(setAt({ a: { b: 'x' } }, 'a.b', 'y'), 'a.b'), 'y');
});

test('save writes only the packet, records history and a diary line, and refuses stale hashes', { skip: !ready }, async t => {
  const { root, file } = await fixture(t);
  const notes = fakeNotes();
  const editor = createStoreEditor({ workspaceRoot: root, notes });
  const view = await editor.view();
  assert.deepEqual(view.packets.map(p => ({ file: p.file, active: p.active })), [{ file: 'hoodie.json', active: true }], 'site.json and templates.ts are not packets');
  assert.equal(activePacketFile("import packet from './hoodie.json';"), 'hoodie.json');
  assert.match(view.preview.url, /^http:\/\/localhost:3021\/products\/hoodie/);
  assert.ok(view.images.some(image => image.src === '/images/new-pick.webp'));
  assert.ok(view.images.some(image => image.src === '/images/demo-gen/other.webp' && image.folder === 'demo-gen'));
  assert.deepEqual(view.problems, [], 'the demo packet passes the store check');
  const saved = await editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'hero.headline', value: '  Off duty in one pull.  ' }, { path: 'purchase.gallery.1.src', value: '/images/new-pick.webp' }] });
  const disk = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(disk.hero.headline, 'Off duty in one pull.');
  assert.equal(disk.purchase.gallery[1].src, '/images/new-pick.webp');
  assert.equal(saved.save.by, 'owner'); assert.equal(saved.save.changes[0].before, 'Clock out. Pull it on. Exhale.'); assert.equal(saved.save.changes[0].label, 'Headline at the top');
  assert.equal(saved.history.length, 1); assert.equal(saved.undo.length, 1);
  assert.equal(notes.notes[0].topic, 'store-edit'); assert.equal(notes.notes[0].status, 'addressed'); assert.match(notes.notes[0].text, /Owner edited in the Store editor \(hoodie\.json\): Headline at the top, Picture 2/);
  assert.equal(saved.ownerEdits.length, 2); assert.ok(saved.ownerEdits.every(edit => edit.kept));
  const history = JSON.parse(await fs.readFile(path.join(root, EDITS_PATH), 'utf8'));
  assert.equal(history.saves.length, 1); assert.equal(history.revision, 1);
  // The old hash is stale now; the file is untouched by the refused save.
  await code(editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'hero.headline', value: 'Again' }] }), 'PACKET_CHANGED');
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).hero.headline, 'Off duty in one pull.');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'hero.headline', value: 'Off duty in one pull.' }] }), 'NOTHING_CHANGED');
  // Files outside app/content/*.json packets are never written.
  for (const packet of ['site.json', '../site.json', 'templates.ts', 'drafts/x.json', 'HOODIE.json']) await code(editor.save({ packet, hash: 'x', changes: [{ path: 'hero.headline', value: 'x' }] }), 'PACKET_NOT_ALLOWED');
  await code(editor.save({ packet: 'missing.json', hash: 'x', changes: [{ path: 'hero.headline', value: 'x' }] }), 'NOT_FOUND');
  // Layout, theme and offer numbers stay with the agents.
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'theme.ink', value: '#000000' }] }), 'FIELD_NOT_EDITABLE');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'templateId', value: 'gift-led' }] }), 'FIELD_NOT_EDITABLE');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'offer.sale.percentOff', value: '70' }] }), 'FIELD_READ_ONLY');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'purchase.gallery.0.src', value: '/images/not-there.webp' }] }), 'IMAGE_NOT_IN_STORE');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'hero.headline', value: 7 }] }), 'INVALID_INPUT');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'hero.headline', value: 'x' }], by: 'robot' }), 'INVALID_INPUT');
});

test('the store check keeps the old file and explains why (Meta personal attributes, fake proof)', { skip: !ready }, async t => {
  const { root, file } = await fixture(t);
  const editor = createStoreEditor({ workspaceRoot: root, notes: fakeNotes() });
  const before = await fs.readFile(file, 'utf8');
  const { packet } = await editor.view();
  await assert.rejects(editor.save({ packet: 'hoodie.json', hash: packet.hash, changes: [{ path: 'problem.situations.0', value: 'You have cold hands every evening.' }] }), error => {
    assert.equal(error.code, 'PACKET_CHECK'); assert.equal(error.status, 422);
    assert.match(error.details.problems[0].problem, /speaks to the reader's condition/, 'the exact check message travels with it');
    assert.equal(error.details.problems[0].plain, META_RULE);
    assert.match(error.message, /personal-attributes rule/);
    return true;
  });
  await code(editor.save({ packet: 'hoodie.json', hash: packet.hash, changes: [{ path: 'faq.items.0.answer', value: 'Doctor approved comfort.' }] }), 'PACKET_CHECK');
  await code(editor.save({ packet: 'hoodie.json', hash: packet.hash, changes: [{ path: 'hero.headline', value: 'One two three four five six seven eight nine ten eleven' }] }), 'PACKET_CHECK');
  await code(editor.save({ packet: 'hoodie.json', hash: packet.hash, changes: [{ path: 'hero.headline', value: '   ' }] }), 'PACKET_CHECK');
  assert.equal(await fs.readFile(file, 'utf8'), before, 'the old file is kept byte for byte');
  assert.equal(existsSync(path.join(root, EDITS_PATH)), false, 'a refused save leaves no history');
});

test('undo restores the last saves, refuses one changed since, and owner edits show agents what to keep', { skip: !ready }, async t => {
  const { root, file } = await fixture(t);
  const notes = fakeNotes();
  const editor = createStoreEditor({ workspaceRoot: root, notes });
  let view = await editor.view();
  const first = await editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'faq.items.0.question', value: 'Will it fit me?' }] });
  const second = await editor.save({ packet: 'hoodie.json', hash: first.packet.hash, changes: [{ path: 'hero.benefits.1.text', value: 'Cotton outside' }], by: 'agent', who: 'copywriter' });
  assert.equal(notes.notes.length, 1, 'only owner saves write a diary line');
  const undone = await editor.undo({ packet: 'hoodie.json', hash: second.packet.hash, saveId: first.save.id });
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).faq.items[0].question, 'How does it fit?');
  assert.equal(undone.save.undoOf, first.save.id); assert.match(notes.notes.at(-1).text, /\(undo\)/);
  assert.ok(undone.history.find(save => save.id === first.save.id).undoneAt);
  assert.equal(undone.ownerEdits.length, 0, 'an undone owner edit is no longer one to keep');
  assert.deepEqual(undone.undo.map(save => save.id), [second.save.id], 'undo saves and undone saves leave the undo list');
  await code(editor.undo({ packet: 'hoodie.json', hash: undone.packet.hash, saveId: first.save.id }), 'UNDO_DONE');
  // An owner edit an agent later overwrote directly in the file: undo refuses, the brief flags it.
  view = await editor.view();
  const owner = await editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'hero.trustRow.0.text', value: 'Ships in 2 days' }] });
  const disk = JSON.parse(await fs.readFile(file, 'utf8')); disk.hero.trustRow[0].text = 'Ships fast'; await fs.writeFile(file, JSON.stringify(disk, null, 2) + '\n');
  view = await editor.view();
  await code(editor.undo({ packet: 'hoodie.json', hash: view.packet.hash, saveId: owner.save.id }), 'UNDO_STALE');
  assert.equal(view.ownerEdits[0].kept, false); assert.equal(view.ownerEdits[0].current, 'Ships fast');
  const groups = await editor.ownerEditGroups();
  const brief = ownerEditsMarkdown(groups);
  assert.match(brief, /## Owner edits in the store \(keep them\)/); assert.match(brief, /Trust line 1 \(`hero\.trustRow\.0\.text`\): "Ships in 2 days" · changed since, check with the owner/);
  // The pure helpers agree with the server view.
  const record = JSON.parse(await fs.readFile(path.join(root, EDITS_PATH), 'utf8'));
  assert.equal(ownerEdits(record, 'hoodie.json', disk).length, 1);
  assert.equal(undoable(record, 'hoodie.json', disk)[0].stale.length, 1);
});

test('reviews: only sample reviews are editable; a real review is never changed or created here', { skip: !ready }, async t => {
  const genuine = { name: 'Real Buyer', location: 'Duluth, MN', text: 'Real words.', photo: null, rating: 5, source: 'https://example.com/review', date: '2026-09-20', permission: true, kind: 'genuine' };
  const { root, file } = await fixture(t, packet => { packet.reviews.items.push(genuine); return packet; });
  const editor = createStoreEditor({ workspaceRoot: root, notes: fakeNotes() });
  const view = await editor.view();
  const reviews = view.sections.find(section => section.id === 'proof');
  assert.ok(reviews.fields.filter(field => field.path.startsWith('reviews.items.0.')).every(field => field.sample));
  const real = reviews.fields.find(field => field.path === 'reviews.items.6.name');
  assert.equal(real.kind, 'fixed');
  const ok = await editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'reviews.items.0.text', value: 'Sample words, edited.' }] });
  await code(editor.save({ packet: 'hoodie.json', hash: ok.packet.hash, changes: [{ path: 'reviews.items.6.name', value: 'Someone else' }] }), 'REVIEW_NOT_SAMPLE');
  await code(editor.save({ packet: 'hoodie.json', hash: ok.packet.hash, changes: [{ path: 'reviews.items.6.text', value: 'Better words' }] }), 'FIELD_NOT_EDITABLE');
  await code(editor.save({ packet: 'hoodie.json', hash: ok.packet.hash, changes: [{ path: 'reviews.items.0.kind', value: 'genuine' }] }), 'FIELD_NOT_EDITABLE');
  const disk = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(disk.reviews.items[0].kind, 'sample'); assert.deepEqual(disk.reviews.items[6], genuine);
});

test('Colors: palettes come from palettes.ts by mood; Use this palette writes the theme with check, history and undo; fonts stay', { skip: !ready }, async t => {
  const { root, file } = await fixture(t, packet => { packet.theme.fontDisplay = 'Fixed Serif'; return packet; });
  const notes = fakeNotes();
  const editor = createStoreEditor({ workspaceRoot: root, notes });
  const view = await editor.view();
  assert.equal(view.colors.count, 2, 'a palette without its nine colors is skipped');
  assert.deepEqual(view.colors.groups.map(group => group.name), ['Soft', 'Calm'], 'grouped by mood when a palette has one');
  assert.equal(view.colors.groups[1].palettes[0].goodFor, 'Sleep and evening routines');
  assert.equal(view.colors.current, 'lavender');
  assert.equal(view.sections.find(section => section.id === 'colors').fields[0].kind, 'palette');
  const saved = await editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'theme', value: 'peach' }] });
  const theme = JSON.parse(await fs.readFile(file, 'utf8')).theme;
  assert.equal(theme.name, 'Peach & Periwinkle'); assert.equal(theme.accent, '#ffb898'); assert.equal(theme.fontDisplay, 'Fixed Serif', 'fonts are never touched');
  assert.equal(saved.colors.current, 'peach'); assert.equal(saved.save.changes[0].before.name, 'Lavender & Butter');
  assert.match(notes.notes[0].text, /Palette/);
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'theme', value: 'peach' }] }), 'NOTHING_CHANGED');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'theme', value: 'forest' }] }), 'PALETTE_NOT_FOUND');
  await code(editor.save({ packet: 'hoodie.json', hash: saved.packet.hash, changes: [{ path: 'theme.accent', value: '#000000' }] }), 'FIELD_NOT_EDITABLE');
  assert.match(ownerEditsMarkdown(await editor.ownerEditGroups()), /Colors · Palette \(`theme`\): "Peach & Periwinkle palette"/);
  const undone = await editor.undo({ packet: 'hoodie.json', hash: saved.packet.hash, saveId: saved.save.id });
  assert.equal(undone.colors.current, 'lavender');
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).theme.fontDisplay, 'Fixed Serif');
});

test('Colors read palettes.json first (mood notes kept), and palettes.json is never offered as a packet', { skip: !ready }, async t => {
  const { root } = await fixture(t);
  const content = path.join(root, CONTENT_DIR);
  await fs.writeFile(path.join(content, 'palettes.json'), JSON.stringify({ note: 'x', groups: [{ id: 'calm', name: 'Calm & sleep', note: 'Night blues for winding down.' }, { id: 'bold', name: 'Bold accents', note: 'Strong fills.' }], palettes: [
    { id: 'lavender', name: 'Lavender & Butter', group: 'Calm & sleep', goodFor: 'Sleep products', paper: '#fdfaf4', ink: '#2e2546', muted: '#655c7a', line: '#ebe4f0', accent: '#c7b3ff', accentText: '#6a4fd6', onAccent: '#2e2546', highlight: '#fff0b8', shade: '#1c1630' },
    { id: 'night', name: 'Night & Sand', group: 'Calm & sleep', goodFor: 'Wind-down routines', paper: '#f7f3ec', ink: '#1d2440', muted: '#5b6178', line: '#e6e0d4', accent: '#3d4f9a', accentText: '#3d4f9a', onAccent: '#ffffff', highlight: '#efe2c4', shade: '#10142a' },
  ] }));
  await fs.writeFile(path.join(content, 'notes.json'), JSON.stringify({ hello: 'not a packet' }));
  const editor = createStoreEditor({ workspaceRoot: root, notes: fakeNotes() });
  const view = await editor.view();
  assert.deepEqual(view.packets.map(p => p.file), ['hoodie.json'], 'palettes.json and other non-packet JSON are not pages to edit');
  assert.equal(view.colors.count, 2);
  assert.deepEqual(view.colors.groups.map(group => [group.name, group.note, group.palettes.length]), [['Calm & sleep', 'Night blues for winding down.', 2]], 'empty mood groups are left out');
  await code(editor.save({ packet: 'palettes.json', hash: 'x', changes: [{ path: 'note', value: 'y' }] }), 'PACKET_NOT_ALLOWED');
  const saved = await editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'theme', value: 'night' }] });
  assert.equal(saved.colors.current, 'night');
});

test('the real palette library parses into complete palettes', { skip: !existsSync(real.palettes) }, async () => {
  const { parsePalettes, palettesFromJson } = await import('../src/storeEditorModel.mjs');
  const jsonFile = path.join(repo, 'hydrogen-storefront/app/content/palettes.json');
  const palettes = existsSync(jsonFile) ? palettesFromJson(JSON.parse(await fs.readFile(jsonFile, 'utf8'))).palettes : parsePalettes(await fs.readFile(real.palettes, 'utf8'));
  assert.ok(palettes.length >= 1);
  assert.ok(palettes.every(palette => /^#/.test(palette.colors.accent) && palette.name && palette.group));
});

test('publish records one owner note for the manager with what changed, and never runs anything', { skip: !ready }, async t => {
  const { root } = await fixture(t);
  const notes = fakeNotes();
  const editor = createStoreEditor({ workspaceRoot: root, notes });
  const view = await editor.view();
  const first = await editor.save({ packet: 'hoodie.json', hash: view.packet.hash, changes: [{ path: 'hero.headline', value: 'Clock out. Exhale.' }] });
  // A save undone before publishing is not a change to publish.
  const tried = await editor.save({ packet: 'hoodie.json', hash: first.packet.hash, changes: [{ path: 'faq.items.0.question', value: 'Fit?' }] });
  const back = await editor.undo({ packet: 'hoodie.json', hash: tried.packet.hash, saveId: tried.save.id });
  assert.deepEqual(back.publish.changes.map(change => change.label), ['Headline at the top']);
  const asked = await editor.publish({ packet: 'hoodie.json' });
  const note = notes.notes.at(-1);
  assert.equal(note.author, 'owner'); assert.equal(note.topic, 'publish'); assert.equal(note.status, 'open');
  assert.match(note.text, /^Publish to merrivy\.com \(Store editor\): please deploy the store\. Changed since the last publish request: Headline at the top \(hoodie\.json\)\./);
  assert.equal(asked.request.noteId, note.id); assert.equal(asked.publish.pending.noteId, note.id); assert.equal(asked.publish.changes.length, 0);
  await code(editor.publish({ packet: 'hoodie.json' }), 'PUBLISH_PENDING');
  await notes.address(note.id, 'Deployed.');
  const again = await editor.publish({});
  assert.match(notes.notes.at(-1).text, /No Store editor changes since the last publish request/);
  assert.equal(again.publish.last.id, again.request.id);
  assert.equal(sincePublish(JSON.parse(await fs.readFile(path.join(root, EDITS_PATH), 'utf8'))).changes.length, 0);
});

test('the API routes: local origin for writes, saves through workspace notes, errors carry codes and details', { skip: !ready }, async t => {
  const { root } = await fixture(t);
  await fs.mkdir(path.join(root, 'os/data'), { recursive: true });
  const api = createApi({ workspaceRoot: root });
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const call = (method, route, body, headers = {}) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({ host: '127.0.0.1', port: server.address().port, method, path: route, headers: { Host: 'localhost:3000', ...(body ? { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, res => { let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(text) })); });
    req.on('error', reject); req.end(data);
  });
  const view = await call('GET', '/api/store-editor');
  assert.equal(view.status, 200); assert.equal(view.json.packet.file, 'hoodie.json');
  const foreign = await call('POST', '/api/store-editor/save', { packet: 'hoodie.json', hash: view.json.packet.hash, changes: [{ path: 'hero.headline', value: 'x' }] }, { Origin: 'http://evil.example' });
  assert.equal(foreign.status, 403);
  const refused = await call('POST', '/api/store-editor/save', { packet: 'hoodie.json', hash: view.json.packet.hash, changes: [{ path: 'whoFor.items.0.label', value: 'For people who are you are tired' }] });
  assert.equal(refused.status, 422); assert.equal(refused.json.code, 'PACKET_CHECK'); assert.equal(refused.json.details.problems[0].plain, META_RULE);
  const saved = await call('POST', '/api/store-editor/save', { packet: 'hoodie.json', hash: view.json.packet.hash, changes: [{ path: 'hero.headline', value: 'Clock out. Get cozy.' }] });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const workspace = await call('GET', '/api/workspace');
  const line = workspace.json.notes.find(note => note.topic === 'store-edit');
  assert.equal(line.author, 'owner'); assert.equal(line.status, 'addressed'); assert.match(line.text, /Headline at the top/);
  const publish = await call('POST', '/api/store-editor/publish', { packet: 'hoodie.json' });
  assert.equal(publish.status, 200);
  const after = await call('GET', '/api/workspace');
  const request = after.json.notes.find(note => note.topic === 'publish');
  assert.equal(request.status, 'open'); assert.equal(request.author, 'owner');
  const brief = await call('GET', '/api/memory/brief?agent=manager');
  assert.equal(brief.status, 200);
  assert.match(brief.json.markdown, /## Owner edits in the store \(keep them\)[\s\S]*Headline at the top \(`hero\.headline`\): "Clock out\. Get cozy\."/);
});
