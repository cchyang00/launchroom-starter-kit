// The Store editor's server side (owner, Oct 2: "if you write some bad copy ...
// I can just go in there and do it myself for a couple things").
//
// It edits words and swaps pictures in one product packet at a time:
// hydrogen-storefront/app/content/<file>.json, never site.json, never any other
// file. A save names the packet's hash (stale edits are refused), touches only
// fields the shared model (src/storeEditorModel.mjs) calls editable, must not
// add a store-check problem (packet-tools' own rules, imported, never run as a
// command), and is recorded in os/data/store-edits.json with who, when, field,
// before and after. Undo restores a recent save. "Publish to merrivy.com" only
// records an owner note for the manager; this server never runs a deploy.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { fail, MEDIA_TYPES } from './domain.mjs';
import { withWorkspaceLock } from './workspace.mjs';
import { replaceFile } from './replaceFile.mjs';
import { PACKET_FILE, TEXT_MAX, editorSections, fieldMap, fieldName, explainProblem, getAt, setAt, emptyEdits, undoable, ownerEdits, sincePublish, UNDO_LIMIT, parsePalettes, palettesFromJson, paletteGroups, currentPalette, themeFor, sameValue } from '../src/storeEditorModel.mjs';

export const CONTENT_DIR = 'hydrogen-storefront/app/content';
export const EDITS_PATH = 'os/data/store-edits.json';
const TEMPLATES_FILE = `${CONTENT_DIR}/templates.ts`;
const SITE_FILE = `${CONTENT_DIR}/site.json`;
const DEMO_FILE = `${CONTENT_DIR}/base-theme.json`;
const TOOLS_FILE = 'hydrogen-storefront/scripts/packet-tools.mjs';
/** The store's palettes (read only; the store builder owns the file). */
export const PALETTES_FILE = `${CONTENT_DIR}/palettes.ts`;
export const PALETTES_JSON = `${CONTENT_DIR}/palettes.json`;
/** JSON files in app/content that are not product packets. */
export const NOT_PACKETS = new Set(['site.json', 'palettes.json']);
const IMAGES_DIR = 'hydrogen-storefront/public/images';
const PACKET_MAX = 1_000_000, EDITS_MAX = 8_000_000, SAVES_KEPT = 1500, PUBLISHES_KEPT = 300, IMAGES_MAX = 400;
// The store's dev server (Hydrogen, hot-reloads the packet). A local QA copy may name another local port.
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/;
export const PREVIEW_ORIGIN = LOCAL_ORIGIN.test(process.env.LAUNCHROOM_STORE_PREVIEW || '') ? process.env.LAUNCHROOM_STORE_PREVIEW : 'http://localhost:3021';
const IMAGE_EXT = /\.(?:webp|png|jpe?g|gif|avif)$/i;
const BY = ['owner', 'agent'];
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const sha = raw => createHash('sha256').update(raw).digest('hex').slice(0, 32);
const inside = (root, candidate) => { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };

/** The history record: every save and publish request, oldest first. */
export function validateEdits(value) {
  if (!value || typeof value !== 'object' || !Number.isInteger(value.revision) || value.revision < 0 || !Array.isArray(value.saves) || !Array.isArray(value.publishes)) fail('Store edit history is malformed. Repair os/data/store-edits.json; the packet files were not changed.', 'MALFORMED_DATA', 500);
  for (const save of value.saves) {
    if (!/^SE-[0-9a-f-]{36}$/.test(save?.id) || !iso(save.at) || !BY.includes(save.by) || !PACKET_FILE.test(save.packet) || !Array.isArray(save.changes) || !save.changes.length) fail('Store edit history has a malformed save.', 'MALFORMED_DATA', 500);
    for (const change of save.changes) if (typeof change?.path !== 'string' || typeof change.label !== 'string') fail('Store edit history has a malformed change.', 'MALFORMED_DATA', 500);
  }
  for (const item of value.publishes) if (!/^PB-[0-9a-f-]{36}$/.test(item?.id) || !iso(item.at)) fail('Store edit history has a malformed publish request.', 'MALFORMED_DATA', 500);
  return value;
}

/** The packet the store shows, from templates.ts (`import packet from './x.json'`). */
export function activePacketFile(source) {
  const match = String(source || '').match(/import\s+packet\s+from\s+['"]\.\/([a-z0-9-]+\.json)['"]/);
  return match ? match[1] : '';
}

/**
 * The store check (packet-tools `check`): the same exported rules, run on a
 * packet object. Returns the problem lines, exactly as the command prints them.
 */
export function packetProblems(tools, packet, { site, demo, exists }) {
  const missing = tools.missingContent(packet);
  for (const src of tools.pictureSources(packet).filter(src => !exists(src))) missing.push('picture file not in public/: ' + src);
  if (!site) missing.push('app/content/site.json');
  else {
    missing.push(...tools.missingSiteContent(site, { status: packet.status, demoSources: tools.pictureSources(demo || {}) }));
    for (const src of tools.pictureSources(site).filter(src => !exists(src))) missing.push('site.json picture file not in public/: ' + src);
  }
  return missing;
}

/**
 * `notes` writes the diary line and the publish request through the store:
 * {add(input) -> saved workspace, address(id, response), workspace() -> state}.
 */
export function createStoreEditor({ workspaceRoot, notes = null, now = () => new Date() }) {
  const root = path.resolve(workspaceRoot);
  const lockKey = path.join(root, CONTENT_DIR);

  async function resolve(relative) {
    let current = root;
    for (const segment of relative.split('/')) {
      current = path.join(current, segment);
      try { if ((await fs.lstat(current)).isSymbolicLink()) fail('Linked paths are not available to the Store editor.', 'UNSAFE_PATH', 403); }
      catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') break; throw error; }
    }
    const full = path.join(root, ...relative.split('/'));
    if (!inside(root, full)) fail('Path leaves the workspace.', 'UNSAFE_PATH', 403);
    return full;
  }
  async function readOptional(relative, max) {
    const file = await resolve(relative);
    try { const stat = await fs.stat(file); if (!stat.isFile()) return null; if (stat.size > max) fail(`${relative} is larger than the Store editor reads.`, 'FILE_TOO_LARGE', 413); return await fs.readFile(file, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error; }
  }
  async function packetFiles() {
    let entries = [];
    try { entries = await fs.readdir(await resolve(CONTENT_DIR), { withFileTypes: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const names = entries
      .filter(entry => entry.isFile() && PACKET_FILE.test(entry.name) && !NOT_PACKETS.has(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => (a === 'base-theme.json' ? -1 : b === 'base-theme.json' ? 1 : a.localeCompare(b)));
    // Only real product packets (an object with a hero and a purchase block) are offered.
    const packets = [];
    for (const name of names) { try { const value = JSON.parse(await readOptional(`${CONTENT_DIR}/${name}`, PACKET_MAX) || 'null'); if (value && typeof value === 'object' && value.hero && value.purchase) packets.push(name); } catch { /* not a packet */ } }
    return packets;
  }
  function packetPath(file) {
    if (typeof file !== 'string' || !PACKET_FILE.test(file) || NOT_PACKETS.has(file)) fail('Choose a product packet in hydrogen-storefront/app/content (for example hoodie.json).', 'PACKET_NOT_ALLOWED', 400);
    return `${CONTENT_DIR}/${file}`;
  }
  async function readPacket(file) {
    const relative = packetPath(file);
    const raw = await readOptional(relative, PACKET_MAX);
    if (raw === null) fail(`${file} is not in hydrogen-storefront/app/content.`, 'NOT_FOUND', 404);
    let packet; try { packet = JSON.parse(raw); } catch { fail(`${file} is not valid JSON. Ask the store builder to repair it.`, 'MALFORMED_PACKET', 409); }
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) fail(`${file} is not a product packet.`, 'MALFORMED_PACKET', 409);
    return { raw, packet, hash: sha(raw), relative, newline: raw.includes('\r\n') ? '\r\n' : '\n' };
  }
  async function readEdits() {
    const raw = await readOptional(EDITS_PATH, EDITS_MAX);
    if (raw === null) return emptyEdits();
    try { return validateEdits(JSON.parse(raw)); } catch (error) { if (error.code === 'MALFORMED_DATA') throw error; fail('Store edit history is not valid JSON. Repair os/data/store-edits.json.', 'MALFORMED_DATA', 500); }
  }
  async function atomic(relative, content) {
    const target = await resolve(relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
    try { const handle = await fs.open(temporary, 'wx', 0o600); try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); } await replaceFile(temporary, target); }
    finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  async function images() {
    const found = [];
    async function walk(relative, depth) {
      if (depth > 2 || found.length >= IMAGES_MAX) return;
      let entries = [];
      try { entries = await fs.readdir(await resolve(relative), { withFileTypes: true }); } catch (error) { if (['ENOENT', 'ENOTDIR', 'UNSAFE_PATH'].includes(error.code)) return; throw error; }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name === '_removed') continue;
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) await walk(child, depth + 1);
        else if (entry.isFile() && IMAGE_EXT.test(entry.name) && MEDIA_TYPES[path.extname(entry.name).toLowerCase()] && found.length < IMAGES_MAX)
          found.push({ src: `/images${child.slice(IMAGES_DIR.length)}`, path: child, name: entry.name, folder: path.posix.dirname(child.slice(IMAGES_DIR.length + 1)) === '.' ? '' : path.posix.dirname(child.slice(IMAGES_DIR.length + 1)) });
      }
    }
    await walk(IMAGES_DIR, 0);
    return found;
  }
  async function exists(src) {
    try { const decoded = decodeURIComponent(String(src).split(/[?#]/)[0]); const file = path.join(root, 'hydrogen-storefront', 'public', decoded); if (!inside(path.join(root, 'hydrogen-storefront', 'public'), file)) return false; return (await fs.stat(file)).isFile(); }
    catch { return false; }
  }
  /** The store check, with the same rules packet-tools uses (imported fresh when the file changes). */
  async function checker() {
    const file = await resolve(TOOLS_FILE);
    let stat; try { stat = await fs.stat(file); } catch { fail('The store check (hydrogen-storefront/scripts/packet-tools.mjs) is missing, so nothing can be saved.', 'CHECK_UNAVAILABLE', 503); }
    const tools = await import(`${pathToFileURL(file).href}?v=${stat.mtimeMs}`);
    if (![tools.missingContent, tools.pictureSources, tools.missingSiteContent].every(fn => typeof fn === 'function')) fail('The store check has changed shape; ask the OS builder to update the Store editor.', 'CHECK_UNAVAILABLE', 503);
    const siteRaw = await readOptional(SITE_FILE, PACKET_MAX), demoRaw = await readOptional(DEMO_FILE, PACKET_MAX);
    let site = null, demo = {};
    try { site = siteRaw ? JSON.parse(siteRaw) : null; demo = demoRaw ? JSON.parse(demoRaw) : {}; } catch { site = null; }
    return async packet => {
      const sources = new Set([...tools.pictureSources(packet), ...(site ? tools.pictureSources(site) : [])]);
      const present = new Set();
      for (const src of sources) if (await exists(src)) present.add(src);
      return packetProblems(tools, packet, { site, demo, exists: src => present.has(src) });
    };
  }
  // palettes.json (the plain list the store builder keeps for the editor) first, else palettes.ts.
  async function paletteLibrary() {
    const json = await readOptional(PALETTES_JSON, 400_000);
    if (json !== null) { try { const library = palettesFromJson(JSON.parse(json)); if (library.palettes.length) return library; } catch { /* fall back to palettes.ts */ } }
    return { palettes: parsePalettes(await readOptional(PALETTES_FILE, 400_000) || ''), groups: [] };
  }
  async function readPalettes() { return (await paletteLibrary()).palettes; }
  async function colors(packet) {
    const { palettes, groups } = await paletteLibrary();
    const current = currentPalette(packet.theme, palettes);
    return { groups: paletteGroups(palettes, groups), current: current?.id || '', theme: packet.theme && typeof packet.theme === 'object' ? packet.theme : null, count: palettes.length };
  }
  async function publishState(record) {
    const since = sincePublish(record);
    let pending = null;
    if (since.last?.noteId && notes?.workspace) {
      try { const state = await notes.workspace(); const note = state.notes.find(item => item.id === since.last.noteId); if (note && note.status === 'open') pending = { at: since.last.at, noteId: note.id }; }
      catch { pending = null; }
    }
    return { last: since.last, pending, changes: since.changes };
  }

  async function view(file = '') {
    const files = await packetFiles();
    const active = activePacketFile(await readOptional(TEMPLATES_FILE, 400_000));
    const chosen = file || (files.includes(active) ? active : files[0] || '');
    const packets = [];
    for (const name of files) {
      let meta = { file: name, active: name === active };
      try {
        const { packet: p } = await readPacket(name);
        const pUrl = typeof p.productUrl === 'string' && p.productUrl.startsWith('/') ? p.productUrl : `/products/${name.replace(/\.json$/i, '')}`;
        const handle = pUrl.split('/').filter(Boolean).pop() || name.replace(/\.json$/i, '');
        meta = {
          file: name,
          active: name === active,
          id: p.id || '',
          status: p.status || 'draft',
          navLabel: p.navLabel || p.shortName || name.replace(/\.json$/i, ''),
          shortName: p.shortName || '',
          productUrl: pUrl,
          handle,
          themeName: p.theme?.name || 'Custom Palette',
          themeAccent: p.theme?.accent || '#472e1e',
          themePaper: p.theme?.paper || '#fcf8f1',
          heroImage: p.purchase?.gallery?.[0]?.src || '',
          previewUrl: `${PREVIEW_ORIGIN}${pUrl}?packet=${encodeURIComponent(name)}`,
          liveUrl: `https://merrivy.com${pUrl}`,
        };
      } catch { /* fallback to minimal meta */ }
      packets.push(meta);
    }
    if (!chosen) return { packets, packet: null, sections: [], images: [], history: [], undo: [], ownerEdits: [], publish: await publishState(await readEdits()), problems: [] };
    const { packet, hash } = await readPacket(chosen);
    const record = await readEdits();
    const check = await checker().catch(() => null);
    const problems = check ? await check(packet) : null;
    const fields = fieldMap(packet);
    const chosenUrl = typeof packet.productUrl === 'string' && packet.productUrl.startsWith('/') ? packet.productUrl : `/products/${chosen.replace(/\.json$/i, '')}`;
    return {
      packets, packet: { file: chosen, active: chosen === active, id: packet.id || '', status: packet.status || '', navLabel: packet.navLabel || '', templateId: packet.templateId || '', productUrl: chosenUrl, hash },
      preview: { origin: PREVIEW_ORIGIN, url: `${PREVIEW_ORIGIN}${chosenUrl}?packet=${encodeURIComponent(chosen)}` },
      sections: editorSections(packet), images: await images(), colors: await colors(packet),
      history: record.saves.filter(save => save.packet === chosen).slice(-30).reverse(),
      undo: undoable(record, chosen, packet),
      ownerEdits: ownerEdits(record, chosen, packet),
      publish: await publishState(record),
      problems: problems === null ? null : problems.map(problem => ({ problem, plain: explainProblem(problem, fields) })),
      revision: record.revision,
    };
  }

  /** Apply changes to the packet file after the hash and store checks; returns the save record. */
  async function commit({ file, hash, changes, by, who, undoOf = null }) {
    const current = await readPacket(file);
    if (typeof hash !== 'string' || hash !== current.hash) fail('This page changed since you opened it (Claude or an agent saved it). Your edits are still on screen: load the latest, then save again.', 'PACKET_CHANGED', 409, { hash: current.hash });
    let next = current.packet;
    const applied = [];
    for (const change of changes) {
      const before = getAt(next, change.path);
      if (sameValue(before, change.value)) continue;
      next = setAt(next, change.path, change.value);
      applied.push({ path: change.path, label: change.label, section: change.section, before, after: change.value });
    }
    if (!applied.length) fail('Nothing changed: every field already says that.', 'NOTHING_CHANGED', 400);
    const check = await checker();
    const was = new Set(await check(current.packet));
    const added = (await check(next)).filter(problem => !was.has(problem));
    if (added.length) {
      const fields = fieldMap(current.packet);
      fail(`The store check refused this save, so the page was not changed: ${explainProblem(added[0], fields)}`, 'PACKET_CHECK', 422, { problems: added.map(problem => ({ problem, plain: explainProblem(problem, fields) })) });
    }
    const content = JSON.stringify(next, null, 2).replace(/\n/g, current.newline) + current.newline;
    // Re-read under the lock immediately before replacing, so a direct file edit in between is not lost.
    const latest = await readPacket(file);
    if (latest.hash !== current.hash) fail('This page changed while saving. Your edits are still on screen: load the latest, then save again.', 'PACKET_CHANGED', 409, { hash: latest.hash });
    await atomic(current.relative, content);
    const record = await readEdits();
    const save = { id: `SE-${randomUUID()}`, at: now().toISOString(), by, ...(who ? { who } : {}), packet: file, hash: sha(content), changes: applied, ...(undoOf ? { undoOf } : {}) };
    record.saves.push(save);
    if (undoOf) { const original = record.saves.find(item => item.id === undoOf); if (original) { original.undoneAt = save.at; original.undoneBy = by; } }
    if (record.saves.length > SAVES_KEPT) record.saves = record.saves.slice(-SAVES_KEPT);
    record.revision += 1;
    await atomic(EDITS_PATH, `${JSON.stringify(record, null, 2)}\n`);
    return save;
  }
  function author(input) {
    const by = input.by === undefined ? 'owner' : input.by;
    if (!BY.includes(by)) fail('A save is by the owner or an agent.', 'INVALID_INPUT', 400);
    const who = input.who === undefined ? '' : String(input.who).trim();
    if (who && !/^[A-Za-z0-9 ._'-]{1,60}$/.test(who)) fail('Who saved must be a short name.', 'INVALID_INPUT', 400);
    return { by, who };
  }
  async function diary(save) {
    if (!notes?.add || save.by !== 'owner') return '';
    const names = save.changes.map(change => change.label);
    const text = `Owner edited in the Store editor (${save.packet}): ${names.slice(0, 6).join(', ')}${names.length > 6 ? ` and ${names.length - 6} more` : ''}${save.undoOf ? ' (undo)' : ''}.`;
    try {
      const saved = await notes.add({ author: 'owner', text, kind: 'note', topic: 'store-edit' });
      const note = saved.notes.at(-1);
      // The edit is already done, so the note is a diary line, not a request waiting on the manager.
      await notes.address(note.id, 'Saved in the Store editor. Agents keep this edit (store-builder brief, os.mjs store).');
      return note.id;
    } catch { return ''; }
  }

  return {
    view,
    async save(input) {
      const file = input?.packet; packetPath(file);
      const { by, who } = author(input || {});
      if (!Array.isArray(input.changes) || !input.changes.length || input.changes.length > 200) fail('Send 1 to 200 changed fields.', 'INVALID_INPUT', 400);
      const save = await withWorkspaceLock(lockKey, async () => {
        const { packet } = await readPacket(file);
        const fields = fieldMap(packet);
        const known = new Set((await images()).map(image => image.src));
        const palettes = await readPalettes();
        const seen = new Set();
        const changes = input.changes.map(change => {
          const field = fields.get(change?.path);
          if (!field) fail(`${change?.path || 'That field'} is not something the Store editor changes. Layout, section order, theme and offer numbers are synced with Shopify Admin and the Store Builder.`, 'FIELD_NOT_EDITABLE', 400);
          if (field.kind === 'fixed') fail(`${fieldName(field)} is read-only here: ${field.note || 'edit it in Shopify Admin.'}`, change.path.startsWith('reviews.') ? 'REVIEW_NOT_SAMPLE' : 'FIELD_READ_ONLY', 400);
          if (seen.has(change.path)) fail(`${fieldName(field)} is listed twice.`, 'INVALID_INPUT', 400);
          seen.add(change.path);
          if (field.kind === 'palette') {
            // Colors: the value names a palette from palettes.ts; the packet's theme takes its colors and name, fonts untouched.
            const palette = palettes.find(item => item.id === change.value);
            if (!palette) fail('Pick a palette from the Colors list (app/content/palettes.ts).', 'PALETTE_NOT_FOUND', 400);
            return { path: change.path, value: themeFor(field.value, palette), label: field.label, section: field.section };
          }
          if (typeof change.value !== 'string' || change.value.length > TEXT_MAX || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(change.value)) fail(`${fieldName(field)} must be text of at most ${TEXT_MAX} characters.`, 'INVALID_INPUT', 400);
          const value = field.kind === 'image' ? change.value.trim() : change.value.replace(/\r\n?/g, '\n').trim();
          if (field.kind === 'image' && value !== field.value && !known.has(value)) fail(`Pick ${fieldName(field)} from the store's images (hydrogen-storefront/public/images). Uploading is not part of the editor yet.`, 'IMAGE_NOT_IN_STORE', 400);
          return { path: change.path, value, label: field.label, section: field.section };
        });
        return commit({ file, hash: input.hash, changes, by, who });
      });
      const noteId = await diary(save);
      return { save, noteId, ...(await view(file)) };
    },
    async undo(input) {
      const file = input?.packet; packetPath(file);
      const { by, who } = author(input || {});
      const save = await withWorkspaceLock(lockKey, async () => {
        const record = await readEdits();
        const { packet } = await readPacket(file);
        const target = record.saves.find(item => item.id === input.saveId && item.packet === file);
        if (!target) fail('That save is not in this page\'s history.', 'NOT_FOUND', 404);
        if (target.undoneAt || target.undoOf) fail('That save was already undone.', 'UNDO_DONE', 409);
        if (!undoable(record, file, packet, UNDO_LIMIT).some(item => item.id === target.id)) fail(`Only the last ${UNDO_LIMIT} saves can be undone here; ask your agent for older ones.`, 'UNDO_TOO_OLD', 409);
        const stale = target.changes.filter(change => !sameValue(getAt(packet, change.path), change.after));
        if (stale.length) fail(`${stale.map(change => `${change.section} · ${change.label}`).join(', ')} changed after that save, so it can't be undone automatically. Edit it by hand instead.`, 'UNDO_STALE', 409);
        return commit({ file, hash: input.hash, changes: target.changes.map(change => ({ path: change.path, value: change.before, label: change.label, section: change.section })), by, who, undoOf: target.id });
      });
      const noteId = await diary(save);
      return { save, noteId, ...(await view(file)) };
    },
    /** Records a publish request for the manager (an open owner note). Never deploys. */
    async publish(input = {}) {
      const { by, who } = author(input);
      const file = input.packet ? (packetPath(input.packet), input.packet) : '';
      const request = await withWorkspaceLock(lockKey, async () => {
        const record = await readEdits();
        const state = await publishState(record);
        if (state.pending) fail(`You already asked the Store Builder to publish (${state.pending.at}). It is still waiting; anything you save now goes out with it.`, 'PUBLISH_PENDING', 409, { noteId: state.pending.noteId });
        if (!notes?.add) fail('Publish requests need the workspace notes, which are unavailable.', 'NOTES_UNAVAILABLE', 503);
        const names = state.changes.map(change => `${change.label} (${change.packet})`);
        const text = `Publish to merrivy.com (Store editor): please deploy the store. ${names.length ? `Changed since the last publish request: ${names.slice(0, 20).join('; ')}${names.length > 20 ? `; and ${names.length - 20} more` : ''}.` : 'No Store editor changes since the last publish request.'}${file ? ` Packet: ${file}.` : ''}`;
        const saved = await notes.add({ author: by === 'owner' ? 'owner' : 'agent', text: text.slice(0, 3900), kind: 'note', topic: 'publish' });
        const note = saved.notes.at(-1);
        const item = { id: `PB-${randomUUID()}`, at: now().toISOString(), by, ...(who ? { who } : {}), noteId: note.id, packet: file, saveIds: [...new Set(state.changes.map(change => change.saveId))], fields: names.slice(0, 200) };
        record.publishes.push(item);
        if (record.publishes.length > PUBLISHES_KEPT) record.publishes = record.publishes.slice(-PUBLISHES_KEPT);
        record.revision += 1;
        await atomic(EDITS_PATH, `${JSON.stringify(record, null, 2)}\n`);
        return item;
      });
      return { request, ...(await view(file)) };
    },
    /** Clone the 10/10 Master Base Theme (`base-theme.json`) into a new product packet with any of the 52 color palettes. */
    async clone(input = {}) {
      const cleanSlug = String(input.slug || '').trim().toLowerCase().replace(/\.json$/i, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      if (!cleanSlug || cleanSlug === 'palettes' || cleanSlug === 'base-theme') fail('Provide a valid product handle slug (e.g. heated-compression-wrap).', 'INVALID_INPUT', 400);
      const targetFile = `${cleanSlug}.json`;
      packetPath(targetFile);
      await withWorkspaceLock(lockKey, async () => {
        const existing = await packetFiles();
        if (existing.includes(targetFile)) fail(`${targetFile} already exists in the storefront.`, 'PACKET_EXISTS', 409);
        const sourceFile = existing.includes('base-theme.json') ? 'base-theme.json' : existing[0];
        if (!sourceFile) fail('No base theme packet found to clone.', 'NOT_FOUND', 404);
        const { packet: base } = await readPacket(sourceFile);
        const cloned = structuredClone(base);
        const prettyTitle = String(input.title || '').trim() || cleanSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        cloned.id = cleanSlug;
        cloned.status = input.status === 'live' ? 'live' : 'draft';
        cloned.navLabel = prettyTitle.slice(0, 60);
        cloned.shortName = prettyTitle.slice(0, 80);
        cloned.productUrl = `/products/${cleanSlug}`;
        if (cloned.purchase) cloned.purchase.heading = prettyTitle.slice(0, 80);
        if (cloned.hero) cloned.hero.headline = prettyTitle.slice(0, 90);
        if (cloned.seo) cloned.seo.title = `${prettyTitle} | Merrivy`;
        if (input.paletteId) {
          const palettes = await readPalettes();
          const chosenPalette = palettes.find(p => p.id === input.paletteId);
          if (chosenPalette) cloned.theme = themeFor(cloned.theme, chosenPalette);
        }
        await atomic(`${CONTENT_DIR}/${targetFile}`, `${JSON.stringify(cloned, null, 2)}\n`);
      });
      return { clonedFile: targetFile, ...(await view(targetFile)) };
    },
    /** Owner edits per packet, for agent briefs and `os.mjs store`. */
    async ownerEditGroups() {
      const record = await readEdits();
      const groups = [];
      for (const file of new Set(record.saves.map(save => save.packet))) {
        let packet; try { packet = (await readPacket(file)).packet; } catch { continue; }
        const edits = ownerEdits(record, file, packet);
        if (edits.length) groups.push({ packet: file, edits });
      }
      return groups;
    },
  };
}
