import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { AGENTS, MEDIA_ROOTS, MEDIA_TYPES, safeRelative, sourceUrl } from './domain.mjs';
import { validateWorkspace, WORKSPACE_MAX_BYTES } from './workspace.mjs';
import { createAssetLibrary, STORE_MEDIA_ROOTS, BIN, safeSegments } from './assets.mjs';
import { createChangeFeed } from './changes.mjs';
import { launchTonight } from './launchTonight.mjs';
import { createLaunchChecklists } from './launchChecklist.mjs';

const MAX_ASSET = 25 * 1024 * 1024;
const MAX_VIDEO = 250 * 1024 * 1024;
const MIME = MEDIA_TYPES;
const queues = new Map();
const NODE_KINDS = ['idea', 'question', 'action', 'agent', 'stage', 'evidence', 'decision'];
const NODE_STATUSES = ['open', 'in-progress', 'needs-review', 'verified', 'blocked'];
const MAX_NODES = 100;
const MAX_EDGES = 500;
const folders = [
  { name: 'Resources', path: 'resources/INDEX.md', description: 'Shared methods, examples and reference media; separate from production assets.' },
  { name: 'Products', path: 'products/INDEX.md', description: 'Actual product dossiers, markets, angles and experiments.' },
  { name: 'Creative references', path: 'agents/image-generator/references/INDEX.md', description: '50 external layout references; pictured claims and performance are unverified.' },
  { name: 'Image workspace', path: 'agents/image-generator/references/REFERENCE-TO-AD.md', description: 'Image jobs, production methods and reference-to-ad method.' },
  { name: 'Course library', path: 'guides/rippy-club/INDEX.md', description: 'Course notes, timecoded visual evidence and review coverage.' },
  { name: 'Shopify readiness', path: 'workflow/LAUNCH-CHECKLIST.md', description: '7-point pre-launch storefront, copy, 2-kit, Shopify admin, pixel and supplier checklist.' },
  { name: 'Validation workflow', path: 'workflow/CHECKS.md', description: 'Product research through hard verification, build, launch and manage.' },
  { name: 'Now', path: 'memory/NOW.md', description: 'What is true today, what is next and what is blocked.' },
  { name: 'Specialists', path: 'agents/README.md', description: 'Role registry, assignments and learning contract.' },
];
const fail = (status, message) => Object.assign(new Error(message), { status });
const inside = (root, candidate) => { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function string(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw fail(400, `${label} must be a nonempty string of at most ${max} characters.`);
  return value.trim();
}
function checkNode(node) {
  if (!plain(node)) throw fail(400, 'node must be an object.');
  const value = { id: node.id === undefined ? randomUUID() : string(node.id, 'Node ID', 100), title: string(node.title, 'Node title'), note: node.note ?? '', x: node.x, y: node.y, kind: node.kind, status: node.status ?? 'open' };
  if (typeof value.note !== 'string' || value.note.length > 10000) throw fail(400, 'Node note must be a string of at most 10000 characters.');
  if (![value.x, value.y].every(n => Number.isFinite(n) && Math.abs(n) <= 100000)) throw fail(400, 'Node coordinates must be finite numbers within ±100000.');
  if (!NODE_KINDS.includes(value.kind)) throw fail(400, 'Invalid node kind.');
  if (!NODE_STATUSES.includes(value.status)) throw fail(400, 'Invalid node status. A map status is an annotation, not evidence verification.');
  if (node.productId !== undefined) value.productId = string(node.productId, 'Product ID', 100);
  if (node.reference !== undefined && node.reference !== '') {
    const reference = string(node.reference, 'Node reference', 3000);
    value.reference = /^https?:\/\//i.test(reference) ? sourceUrl(reference) : safeRelative(reference, { markdown: true });
  }
  if (node.role !== undefined && node.role !== '') {
    value.role = string(node.role, 'Node role', 40);
    if (!AGENTS.some(agent => agent.id === value.role)) throw fail(400, 'Unknown node role.');
  }
  return value;
}
function checkGraph(inputNodes, inputEdges) {
  if (!Array.isArray(inputNodes) || !Array.isArray(inputEdges)) throw fail(400, 'Graph replacement requires nodes and edges arrays.');
  if (inputNodes.length > MAX_NODES || inputEdges.length > MAX_EDGES) throw fail(409, 'Graph limit is 100 nodes and 500 edges.');
  const nodes = inputNodes.map(node => { if (!node?.id) throw fail(400, 'Every graph node requires a stable ID.'); return checkNode(node); });
  const nodeIds = new Set(nodes.map(node => node.id));
  if (nodeIds.size !== nodes.length) throw fail(400, 'Node IDs must be unique within the graph.');
  const edgeIds = new Set();
  const edges = inputEdges.map(edge => {
    if (!plain(edge) || !nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) throw fail(400, 'Edge must connect two existing, different nodes.');
    const id = JSON.stringify([edge.from, edge.to]);
    if (edgeIds.has(id)) throw fail(400, 'Graph edges must be unique.');
    edgeIds.add(id); return { from: edge.from, to: edge.to };
  });
  return { nodes, edges };
}
function validateMaps(maps) {
  if (!Array.isArray(maps) || maps.length > 50) throw new Error('Invalid maps list.');
  const ids = new Set();
  for (const map of maps) {
    if (!plain(map) || typeof map.id !== 'string' || !map.id || ids.has(map.id) || !Number.isInteger(map.revision) || map.revision < 1 || typeof map.createdAt !== 'string' || typeof map.updatedAt !== 'string') throw new Error('Invalid map metadata.');
    ids.add(map.id); string(map.title, 'Map title');
    Object.assign(map, checkGraph(map.nodes, map.edges));
  }
  return maps;
}
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
async function body(req, port, authorizeRequest) {
  if (authorizeRequest) authorizeRequest(req, true);
  else {
  const allowed = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  if (!allowed.has(req.headers.host)) throw fail(403, 'Local host required.');
  let origin;
  try { origin = new URL(req.headers.origin); } catch { throw fail(403, 'Local Origin header required.'); }
  if (origin.protocol !== 'http:' || !allowed.has(origin.host) || origin.host !== req.headers.host || origin.origin !== req.headers.origin) throw fail(403, 'Same local origin required.');
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw fail(415, 'application/json required.');
  if (Number(req.headers['content-length']) > 128 * 1024) throw fail(413, 'Request too large.');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 128 * 1024) throw fail(413, 'Request too large.'); chunks.push(chunk); }
  let value; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'Invalid JSON body.'); }
  if (!plain(value)) throw fail(400, 'JSON object required.');
  return value;
}

export async function createHub({ workspaceRoot, port = 3000, authorizeRequest = null }) {
  const root = await fs.realpath(workspaceRoot);
  const dataDir = path.join(root, 'os', 'data');
  const mapsFile = path.join(dataDir, 'maps.json');
  async function referencePaths(nodes) {
    const inspected = new Set();
    for (const node of nodes) {
      if (!node.reference || /^https?:\/\//i.test(node.reference)) continue;
      let current = root;
      for (const segment of node.reference.split('/')) {
        current = path.join(current, segment);
        if (inspected.has(current)) continue;
        inspected.add(current);
        try { if ((await fs.lstat(current)).isSymbolicLink()) throw fail(403, 'Map references cannot point through linked paths.'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
  }
  async function storagePath() {
    // Check existing ancestors even when the data directory does not exist yet.
    for (const target of [path.join(root, 'os'), dataDir, mapsFile]) {
      try { if (!inside(root, await fs.realpath(target))) throw fail(403, 'Map storage must remain in this workspace.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  async function readMaps() {
    await storagePath();
    let raw;
    try { if ((await fs.stat(mapsFile)).size > 60 * 1024 * 1024) throw fail(500, 'Mind map data is too large; repair the file before editing.'); raw = await fs.readFile(mapsFile, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    try { const maps = validateMaps(JSON.parse(raw)); for (const map of maps) await referencePaths(map.nodes); return maps; }
    catch { throw fail(500, 'Mind map data is malformed. Repair os/data/maps.json before editing; existing data was preserved.'); }
  }
  async function mutate(operation) {
    const previous = queues.get(mapsFile) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      const maps = await readMaps();
      const result = await operation(maps);
      await storagePath(); await fs.mkdir(dataDir, { recursive: true }); await storagePath();
      const temporary = path.join(dataDir, `.maps-${randomUUID()}.tmp`);
      try { await fs.writeFile(temporary, `${JSON.stringify(maps, null, 2)}\n`, { flag: 'wx' }); await fs.rename(temporary, mapsFile); }
      finally { await fs.unlink(temporary).catch(() => {}); }
      return result;
    });
    queues.set(mapsFile, pending);
    try { return await pending; } finally { if (queues.get(mapsFile) === pending) queues.delete(mapsFile); }
  }
  async function assetFile(relative) {
    if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0') || relative.includes(':') || relative.includes('%') || relative.split('/').some(part => !part || /[. ]$/.test(part)) || path.isAbsolute(relative)) throw fail(400, 'Invalid asset path.');
    // The store's public pictures are shown read-only on the Assets page; nothing else in hydrogen-storefront is served.
    const storeMedia = STORE_MEDIA_ROOTS.find(p => relative.startsWith(`${p}/`));
    const prefix = storeMedia || MEDIA_ROOTS.find(p => relative.startsWith(`${p}/`));
    if (!prefix || !MIME[path.extname(relative).toLowerCase()]) throw fail(403, 'Asset path is not allowed.');
    if (storeMedia) { if (!safeSegments(relative)) throw fail(403, 'Asset path is not allowed.'); }
    else safeRelative(relative);
    let ancestor = root;
    for (const segment of relative.split('/')) {
      ancestor = path.join(ancestor, segment);
      if ((await fs.lstat(ancestor)).isSymbolicLink()) throw fail(403, 'Media paths cannot pass through symlinks.');
    }
    const allowedRoot = await fs.realpath(path.join(root, prefix));
    const actual = await fs.realpath(path.join(root, relative));
    if (!inside(root, allowedRoot) || !inside(allowedRoot, actual)) throw fail(403, 'Asset path leaves its allowed folder.');
    const stat = await fs.stat(actual);
    if (!stat.isFile()) throw fail(404, 'Asset not found.');
    const kind = MIME[path.extname(relative).toLowerCase()].startsWith('video/') ? 'video' : 'image';
    const limit = kind === 'video' ? MAX_VIDEO : MAX_ASSET;
    if (stat.size > limit) throw fail(413, kind === 'video' ? 'Video exceeds the 250 MB limit.' : 'Image exceeds the 25 MB limit.');
    return { actual, stat, kind, limit };
  }
  // `resources: false` lists only production assets (the Assets page's store map).
  async function catalogue({ resources = true } = {}) {
    const assets = []; const resourceMedia = []; let directoryCount = 0;
    let archivedProductIds = new Set();
    try {
      const workspaceFile = path.join(dataDir, 'workspace.json');
      for (const filename of [path.join(root, 'os'), dataDir, workspaceFile]) if ((await fs.lstat(filename)).isSymbolicLink()) throw fail(403, 'Workspace state cannot be read through a linked path.');
      const stat = await fs.stat(workspaceFile); if (!stat.isFile() || stat.size > WORKSPACE_MAX_BYTES) throw fail(500, 'Workspace memory is not a bounded readable file.');
      const state = validateWorkspace(JSON.parse(await fs.readFile(workspaceFile, 'utf8')));
      archivedProductIds = new Set(state.reviews.map(review => review.productId));
    } catch (error) {
      if (error.code !== 'ENOENT') throw fail(error.status === 403 ? 403 : 500, 'Cannot classify current assets: os/data/workspace.json is unsafe or malformed. Existing files were preserved.');
    }
    async function walk(relative, category, scope, productId, depth = 0) {
      if (assets.length + resourceMedia.length >= 2000 || directoryCount >= 2000 || depth > 24) return;
      let entries;
      try {
        safeRelative(`${relative}/catalog.md`);
        const target = path.join(root, relative);
        if ((await fs.lstat(target)).isSymbolicLink() || !inside(root, await fs.realpath(target))) return;
        entries = await fs.readdir(target, { withFileTypes: true });
        directoryCount += 1;
      } catch (error) { if (error.code === 'ENOENT' || error.code === 'UNSAFE_PATH') return; throw error; }
      for (const entry of entries) {
        if (assets.length + resourceMedia.length >= 2000) return;
        if (entry.isSymbolicLink()) continue;
        const filename = `${relative}/${entry.name}`;
        // `_removed` holds files moved to the bin from the Assets page; they are listed as removed, not as assets.
        if (entry.isDirectory() && entry.name !== BIN && !/^(?:node_modules|\.git|frames?|frame[-_]?sequences?|screenshots?|contact[-_]?sheets?)$/i.test(entry.name)) await walk(filename, category, scope, productId, depth + 1);
        else if (entry.isFile() && MIME[path.extname(entry.name).toLowerCase()]) {
          try {
            const { stat, kind } = await assetFile(filename);
            const item = { path: filename, name: entry.name, category, size: stat.size, modifiedAt: stat.mtime.toISOString(), kind, scope, ...(productId ? { productId } : {}) };
            (scope === 'resource' ? resourceMedia : assets).push(item);
          } catch (error) { if ([400, 403, 413].includes(error.status) || error.code === 'ENOENT') continue; throw error; }
        }
      }
    }
    let productDirectories = [];
    try { if (!(await fs.lstat(path.join(root, 'products'))).isSymbolicLink()) productDirectories = await fs.readdir(path.join(root, 'products'), { withFileTypes: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const entry of productDirectories) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !/^P\d{3,}(?:-[a-z0-9]+)*$/.test(entry.name) || archivedProductIds.has(entry.name)) continue;
      let synthetic = false;
      try {
        const recordPath = path.join(root, 'products', entry.name, 'os-product.json');
        const stat = await fs.lstat(recordPath);
        if (stat.isSymbolicLink() || stat.size > 2_000_000) continue;
        synthetic = JSON.parse(await fs.readFile(recordPath, 'utf8')).synthetic === true;
      } catch (error) { if (error.code !== 'ENOENT') throw fail(500, `Cannot classify product assets: products/${entry.name}/os-product.json is unreadable or malformed.`); }
      if (!synthetic) {
        await walk(`products/${entry.name}/assets`, 'Product assets', 'product', entry.name);
        await walk(`products/${entry.name}/creative`, 'Product creative & ads', 'product', entry.name);
      }
    }
    await walk('store/assets', 'Store assets', 'store');
    if (resources) for (const [relative, category] of [
      ['agents/image-generator/references', 'Creative references'],
      ['agents/image-generator/sandbox', 'Layout examples'],
      ['agents/validation/references', 'Research references'],
      ['agents/validation/cases', 'Research cases'],
      ['agents/validation/skills/research-products/references', 'Research references'],
      ['resources', 'Shared resources'],
    ]) await walk(relative, category, 'resource');
    return { assets: assets.sort((a, b) => a.path.localeCompare(b.path)), resourceMedia: resourceMedia.sort((a, b) => a.path.localeCompare(b.path)) };
  }
  async function readMetaCampaigns() {
    try {
      const metaFile = path.join(dataDir, 'meta-campaigns.json');
      const raw = await fs.readFile(metaFile, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.campaigns) ? parsed.campaigns : [];
    } catch { return []; }
  }
  // When the Meta numbers were last saved, so Home and Manage can say how fresh they are.
  async function readMetaSavedAt() {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(dataDir, 'meta-campaigns.json'), 'utf8'));
      return typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : '';
    } catch { return ''; }
  }
  async function readMetaDataIntegrity() {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(dataDir, 'meta-campaigns.json'), 'utf8'));
      return parsed?.dataIntegrity || null;
    } catch { return null; }
  }
  let syncingMeta = null;
  function runMetaSync() {
    if (syncingMeta) return syncingMeta;
    const scriptPath = path.join(root, 'scripts', 'sync_meta_campaigns.py');
    syncingMeta = new Promise(resolve => {
      let stdout = '', stderr = '';
      const child = spawn('python', [scriptPath], { cwd: root, shell: false, windowsHide: true });
      const timer = setTimeout(() => { try { child.kill(); } catch {} resolve({ ok: false, error: 'Sync timed out after 45s' }); }, 45000);
      timer.unref?.();
      child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
      child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
      child.once('error', err => { clearTimeout(timer); resolve({ ok: false, error: err.message }); });
      child.once('close', code => {
        clearTimeout(timer);
        resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim() });
      });
    }).finally(() => { syncingMeta = null; });
    return syncingMeta;
  }
  // Background auto-sync every 15 minutes when scripts/sync_meta_campaigns.py is present in workspace
  fs.stat(path.join(root, 'scripts', 'sync_meta_campaigns.py'))
    .then(st => {
      if (st.isFile()) {
        const autoSyncTimer = setInterval(() => { runMetaSync().catch(() => {}); }, 15 * 60 * 1000);
        autoSyncTimer.unref?.();
      }
    })
    .catch(() => {});
  const library = createAssetLibrary({ workspaceRoot: root, catalogue });
  const ASSET_ROUTES = ['/api/assets', '/api/assets/remove', '/api/assets/restore'];
  // Live changes (Agents tab): paths and times only, allowed folders only (server/changes.mjs).
  const changeFeed = createChangeFeed({ workspaceRoot: root });
  const launchChecklists = createLaunchChecklists({ root });
  const hub = async function hub(req, res, next) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return json(res, 400, { error: 'Invalid request URL.' }); }
    const route = url.pathname;
    if (!['/api/hub', '/api/asset', '/api/maps', '/api/changes', '/api/launch', '/api/meta-campaigns', '/api/launch-checklists', '/api/store-preview', ...ASSET_ROUTES].includes(route) && !route.startsWith('/api/maps/')) return next?.();
    try {
      const localHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
      const remote = req.socket?.remoteAddress;
      if (authorizeRequest) authorizeRequest(req, req.method !== 'GET' && req.method !== 'HEAD');
      else if (!localHosts.has(String(req.headers.host ?? '').toLowerCase()) || (remote && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote))) throw fail(403, 'Local host required.');
      if (req.method === 'GET' && route === '/api/store-preview') {
        const asset = url.searchParams.get('asset') || '';
        const targetPath = url.searchParams.get('path') || '/';
        const clean = asset || targetPath;
        if (!clean.startsWith('/') || clean.startsWith('//') || clean.includes('..')) throw fail(400, 'Invalid store preview path.');
        const upstream = await fetch(`http://localhost:3021${clean}`);
        const ctype = upstream.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (asset) {
          if (ctype.includes('text/css')) {
            let css = await upstream.text();
            css = css
              .replace(/url\((['"]?)\/fonts\//g, 'url($1/api/store-preview?asset=/fonts/')
              .replace(/url\((['"]?)\/images\//g, 'url($1/api/store-preview?asset=/images/');
            res.writeHead(upstream.status, { 'Content-Type': ctype, 'Cache-Control': 'public, max-age=120' });
            return res.end(css);
          }
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.writeHead(upstream.status, { 'Content-Type': ctype, 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=120' });
          return res.end(buf);
        }
        let html = await upstream.text();
        html = html
          .replace(/href="\/app\//g, 'href="/api/store-preview?asset=/app/')
          .replace(/src="\/images\//g, 'src="/api/store-preview?asset=/images/')
          .replace(/src="\/videos\//g, 'src="/api/store-preview?asset=/videos/')
          .replace(/poster="\/images\//g, 'poster="/api/store-preview?asset=/images/');
        res.writeHead(upstream.status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (req.method === 'GET' && route === '/api/hub') {
        const [media, maps, metaCampaigns, metaSavedAt, metaDataIntegrity] = await Promise.all([catalogue(), readMaps(), readMetaCampaigns(), readMetaSavedAt(), readMetaDataIntegrity()]);
        return json(res, 200, { ...media, maps, folders, metaCampaigns, metaSavedAt, metaDataIntegrity });
      }
      if (req.method === 'GET' && route === '/api/launch-checklists') return json(res, 200, await launchChecklists.view());
      if (req.method === 'POST' && route === '/api/launch-checklists') return json(res, 200, await launchChecklists.save(await body(req, port, authorizeRequest), { agent: req.headers['x-launchroom-local-agent'] === '1' }));
      if (req.method === 'POST' && route === '/api/meta-campaigns') {
        const input = await body(req, port, authorizeRequest);
        if (input.action === 'sync') {
          const syncRes = await runMetaSync();
          const [metaCampaigns, metaSavedAt, metaDataIntegrity] = await Promise.all([readMetaCampaigns(), readMetaSavedAt(), readMetaDataIntegrity()]);
          return json(res, 200, { ok: syncRes.ok, metaCampaigns, metaSavedAt, metaDataIntegrity });
        }
        const metaFile = path.join(dataDir, 'meta-campaigns.json');
        let parsed = { updatedAt: new Date().toISOString(), campaigns: [] };
        try {
          parsed = JSON.parse(await fs.readFile(metaFile, 'utf8'));
        } catch {}
        const campaigns = Array.isArray(parsed?.campaigns) ? parsed.campaigns : [];
        if (input.newCampaign && plain(input.newCampaign)) {
          const nc = input.newCampaign;
          const productId = string(nc.productId || `P-NEW-${Date.now()}`, 'Product ID', 120);
          const campaign = {
            productId,
            shortName: string(nc.shortName || productId, 'Short name', 120),
            campaignId: String(nc.campaignId || `DRAFT-${Date.now()}`),
            adsetId: String(nc.adsetId || `ADSET-${Date.now()}`),
            campaignName: string(nc.campaignName || `MERRIVY — ${nc.shortName || productId} — CBO $50/d`, 'Campaign name', 160),
            adsetName: String(nc.adsetName || '01 — Broad (US/CA/UK/AU) — Viral Videos + Native Statics').slice(0, 200),
            status: String(nc.status || 'READY_TO_LAUNCH'),
            dailyBudget: Number(nc.dailyBudget) || 50,
            storeUrl: String(nc.storeUrl || 'https://merrivy.com').slice(0, 300),
            pricingSummary: String(nc.pricingSummary || '').slice(0, 300),
            breakEvenCpa: Number(nc.breakEvenCpa) || 25,
            ads: [],
            launchChecklist: [
              { id: 'c1', label: 'Storefront PDP live & verified on mobile (375px)', checked: true },
              { id: 'c2', label: 'Viral video hook-harvested headlines & reveal copy verified', checked: true },
              { id: 'c3', label: 'Meta Pixel single Purchase event verified', checked: false },
            ],
          };
          campaigns.unshift(campaign);
          parsed.campaigns = campaigns;
          parsed.updatedAt = new Date().toISOString();
          await fs.writeFile(metaFile, JSON.stringify(parsed, null, 2), 'utf8');
          return json(res, 200, { metaCampaigns: campaigns });
        }
        if (input.action === 'approve-winner-to-build') {
          const leadId = String(input.leadId || '').trim();
          const rawTitle = String(input.name || leadId || 'New Winner').replace(/\s*\([^)]*\)\s*$/, '').trim();
          const cleanSlug = String(input.slug || rawTitle)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48) || `winner-${Date.now()}`;

          // Reuse existing unlaunched campaign for this leadId if already created
          let existingCamp = campaigns.find(c => c.leadId === leadId && !c.launched && c.status !== 'ACTIVE');
          let shortId = existingCamp ? (String(existingCamp.productId).match(/^P\d{3,}/) || [''])[0] : '';

          if (!shortId) {
            let maxNum = 7;
            for (const c of campaigns) {
              const m = String(c.productId || '').match(/^P(\d{3,})/);
              if (m) maxNum = Math.max(maxNum, Number(m[1]));
            }
            try {
              const prodEntries = await fs.readdir(path.join(root, 'products'));
              for (const name of prodEntries) {
                const m = name.match(/^P(\d{3,})/);
                if (m) maxNum = Math.max(maxNum, Number(m[1]));
              }
            } catch {}
            shortId = `P${String(maxNum + 1).padStart(3, '0')}`;
          }

          const fullProductId = `${shortId}-${cleanSlug}`;
          const packetFile = `${cleanSlug}.json`;
          const nowIso = new Date().toISOString();

          // 1. Clone base-theme.json into hydrogen-storefront/app/content/<cleanSlug>.json
          try {
            const contentDir = path.join(root, 'hydrogen-storefront', 'app', 'content');
            const baseFile = path.join(contentDir, 'base-theme.json');
            const targetPath = path.join(contentDir, packetFile);
            const exists = await fs.stat(targetPath).then(() => true).catch(() => false);
            if (!exists) {
              const baseRaw = await fs.readFile(baseFile, 'utf8');
              const cloned = JSON.parse(baseRaw);
              cloned.id = cleanSlug;
              cloned.status = 'live';
              cloned.navLabel = rawTitle.slice(0, 60);
              cloned.shortName = rawTitle.slice(0, 80);
              cloned.productUrl = `/products/${cleanSlug}`;
              if (cloned.purchase) cloned.purchase.heading = rawTitle.slice(0, 80);
              if (cloned.hero) {
                cloned.hero.headline = rawTitle.slice(0, 90);
                if (input.angle) cloned.hero.subheadline = String(input.angle).slice(0, 220);
              }
              if (cloned.seo) cloned.seo.title = `${rawTitle.slice(0, 60)} | Merrivy`;
              await fs.writeFile(targetPath, `${JSON.stringify(cloned, null, 2)}\n`, 'utf8');
            }
          } catch {}

          // 2. Seed pre-launch campaign in meta-campaigns.json (status: READY_TO_LAUNCH, launched: false)
          const savedVideos = Array.isArray(input.savedVideos) ? input.savedVideos : [];
          const savedPhotos = Array.isArray(input.savedPhotos) ? input.savedPhotos : [];
          const seededAds = [
            ...savedVideos.map((vPath, idx) => ({
              id: `${shortId}-vid-${idx + 1}`,
              name: `${shortId}_VIDEO_${idx + 1}_VIRAL_CREATOR`,
              format: 'video',
              status: 'READY',
              angle: String(input.angle || 'Verified Viral Creator Hook').slice(0, 140),
              headline: `${rawTitle.slice(0, 64)} — Creator Hook #${idx + 1}`,
              primaryText: String(input.angle || rawTitle).slice(0, 500),
              mediaPath: vPath,
              ownerVerdict: 'approved',
            })),
            ...savedPhotos.map((pPath, idx) => ({
              id: `${shortId}-img-${idx + 1}`,
              name: `${shortId}_STATIC_${idx + 1}_4x5`,
              format: 'static',
              status: 'READY',
              angle: String(input.angle || 'Verified Product Angle').slice(0, 140),
              headline: `${rawTitle.slice(0, 64)}`,
              primaryText: String(input.angle || rawTitle).slice(0, 500),
              mediaPath: pPath,
              ownerVerdict: 'approved',
            })),
          ];

          const beCpa = Number(input.breakEvenCpa) > 0 ? Number(input.breakEvenCpa) : 36.4;
          const tCpa = Number(input.targetCpa) > 0 ? Number(input.targetCpa) : Math.round(beCpa * 0.75 * 100) / 100;

          if (!existingCamp) {
            existingCamp = {
              productId: fullProductId,
              leadId,
              shortName: `${shortId} · ${rawTitle.slice(0, 72)}`,
              campaignId: `DRAFT-${shortId}`,
              adsetId: `ADSET-${shortId}`,
              campaignName: `Merrivy - ${shortId} - ${rawTitle.slice(0, 48)} - CBO`,
              adsetName: `${shortId} - Broad - US/CA/UK/AU - 18-65+`,
              status: 'READY_TO_LAUNCH',
              launched: false,
              dailyBudget: 50,
              countries: 'US / CA / UK / AU (Broad)',
              breakEvenCpa: beCpa,
              targetCpa: tCpa,
              lossLimit: 50,
              storeUrl: `https://merrivy.com/products/${cleanSlug}`,
              pricingSummary: String(input.pricingSummary || '1-Kit & 2-Kit Bundle + $4.99 Shipping Protection'),
              summaryLifetime: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, purchases: 0, revenue: 0 },
              summaryToday: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, purchases: 0, revenue: 0 },
              dailyBreakdown: [],
              ads: seededAds,
              updatedAt: nowIso,
            };
            campaigns.unshift(existingCamp);
            parsed.campaigns = campaigns;
            parsed.updatedAt = nowIso;
            await fs.writeFile(metaFile, JSON.stringify(parsed, null, 2), 'utf8');
          }

          // 3. Link storefront packet in launch-checklists.json
          try {
            const clFile = path.join(dataDir, 'launch-checklists.json');
            let cl = { items: [], products: {} };
            try { cl = JSON.parse(await fs.readFile(clFile, 'utf8')); } catch {}
            cl.products = cl.products || {};
            cl.products[shortId] = {
              ...(cl.products[shortId] || {}),
              packet: packetFile,
              items: cl.products[shortId]?.items || {},
              updatedAt: nowIso,
            };
            await fs.writeFile(clFile, JSON.stringify(cl, null, 2), 'utf8');
          } catch {}

          return json(res, 200, {
            ok: true,
            productId: shortId,
            fullProductId,
            packetFile,
            metaCampaigns: campaigns,
          });
        }
        if (input.action === 'launch-product') {
          const shortId = (String(input.productId || '').match(/^[PL]\d{3,}/) || [String(input.productId || '')])[0];
          let targetCamp = campaigns.find(
            c =>
              c.productId === input.productId ||
              c.campaignId === input.campaignId ||
              (shortId && String(c.productId || '').startsWith(shortId))
          );
          const nowIso = new Date().toISOString();
          if (!targetCamp) {
            targetCamp = {
              productId: String(input.productId || shortId),
              shortName: String(input.shortName || input.productId || shortId),
              campaignId: String(input.campaignId || `CBO-${shortId}-${Date.now()}`),
              adsetId: String(input.adsetId || `ADSET-${shortId}-${Date.now()}`),
              campaignName: String(input.campaignName || `Merrivy - ${shortId} - CBO`).slice(0, 160),
              adsetName: String(input.adsetName || `${shortId} - Broad - US/CA/UK/AU - 18-65+`).slice(0, 200),
              status: 'ACTIVE',
              launched: true,
              launchedAt: nowIso,
              dailyBudget: Number(input.dailyBudget) || 50,
              countries: String(input.countries || 'US / CA / UK / AU (Broad)').slice(0, 200),
              breakEvenCpa: Number(input.breakEvenCpa) || 36.4,
              targetCpa: Number(input.targetCpa) || 27.3,
              lossLimit: Number(input.lossLimit) || 50,
              storeUrl: String(input.storeUrl || 'https://merrivy.com').slice(0, 300),
              pricingSummary: String(input.pricingSummary || '').slice(0, 300),
              summaryLifetime: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, purchases: 0, revenue: 0 },
              summaryToday: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, purchases: 0, revenue: 0 },
              dailyBreakdown: [],
              ads: [],
            };
            campaigns.unshift(targetCamp);
          } else {
            targetCamp.status = 'ACTIVE';
            targetCamp.launched = true;
            targetCamp.launchedAt = targetCamp.launchedAt || nowIso;
            if (input.dailyBudget !== undefined) targetCamp.dailyBudget = Math.max(5, Math.min(5000, Number(input.dailyBudget) || 50));
            if (input.countries !== undefined) targetCamp.countries = String(input.countries).trim().slice(0, 200);
            if (input.breakEvenCpa !== undefined) targetCamp.breakEvenCpa = Math.max(1, Math.min(1000, Number(input.breakEvenCpa) || 25));
            if (input.targetCpa !== undefined) targetCamp.targetCpa = Math.max(1, Math.min(1000, Number(input.targetCpa) || 20));
            if (input.lossLimit !== undefined) targetCamp.lossLimit = Math.max(5, Math.min(5000, Number(input.lossLimit) || 50));
            if (input.campaignName !== undefined) targetCamp.campaignName = String(input.campaignName).trim().slice(0, 200);
            if (input.adsetName !== undefined) targetCamp.adsetName = String(input.adsetName).trim().slice(0, 200);
          }
          targetCamp.updatedAt = nowIso;
          parsed.campaigns = campaigns;
          parsed.updatedAt = nowIso;
          await fs.writeFile(metaFile, JSON.stringify(parsed, null, 2), 'utf8');

          // Clear build slot in os/data/workspace.json so Build & Launch is free for the next winner
          if (shortId) {
            try {
              const wsFile = path.join(dataDir, 'workspace.json');
              const ws = JSON.parse(await fs.readFile(wsFile, 'utf8'));
              let wsChanged = false;
              if (ws.activeProductId && String(ws.activeProductId).startsWith(shortId)) {
                ws.activeProductId = null;
                wsChanged = true;
              }
              if (ws.build?.productId && String(ws.build.productId).startsWith(shortId)) {
                ws.build = null;
                wsChanged = true;
              }
              if (wsChanged) {
                await fs.writeFile(wsFile, JSON.stringify(ws, null, 2), 'utf8');
              }
            } catch {}
          }

          return json(res, 200, { ok: true, launchedProductId: targetCamp.productId, metaCampaigns: campaigns });
        }
        const camp = campaigns.find(
          c =>
            c.productId === input.productId ||
            c.campaignId === input.campaignId ||
            (input.productId && String(c.productId || '').startsWith(String(input.productId)))
        );
        if (!camp) throw fail(404, 'Campaign not found.');
        if (input.action === 'cancel-and-wipe') {
          const shortId = (String(camp.productId || input.productId || '').match(/^[PL]\d{3,}/) || [''])[0];
          const reason = String(input.reason || 'Canceled & wiped from Manage due to failing baseline numbers.').trim().slice(0, 400);
          const wipedItems = [];

          // 1. Remove from active meta-campaigns.json
          const remaining = campaigns.filter(c => c !== camp);
          parsed.campaigns = remaining;
          parsed.updatedAt = new Date().toISOString();
          await fs.writeFile(metaFile, JSON.stringify(parsed, null, 2), 'utf8');
          wipedItems.push(`Removed ${shortId || camp.productId} from Manage & Meta campaigns`);

          // 2. Archive storefront packet in hydrogen-storefront/app/content/
          try {
            const contentDir = path.join(root, 'hydrogen-storefront', 'app', 'content');
            const archiveDir = path.join(contentDir, '_archived');
            await fs.mkdir(archiveDir, { recursive: true });
            let storeSlug = '';
            try {
              storeSlug = new URL(camp.storeUrl || '').pathname.split('/').filter(Boolean).pop() || '';
            } catch {}
            const files = await fs.readdir(contentDir);
            for (const f of files) {
              if (!f.endsWith('.json') || f === 'site.json' || f === 'base-theme.json') continue;
              const fullPath = path.join(contentDir, f);
              const rawPacket = await fs.readFile(fullPath, 'utf8').catch(() => '');
              if (
                (storeSlug && f === `${storeSlug}.json`) ||
                (storeSlug && rawPacket.includes(`/products/${storeSlug}`)) ||
                (shortId && rawPacket.includes(shortId))
              ) {
                await fs.rename(fullPath, path.join(archiveDir, f));
                wipedItems.push(`Archived storefront packet ${f}`);
                try {
                  const tmplPath = path.join(contentDir, 'templates.ts');
                  const tmplRaw = await fs.readFile(tmplPath, 'utf8');
                  if (tmplRaw.includes(f)) {
                    const updatedTmpl = tmplRaw.replaceAll(f, 'base-theme.json');
                    await fs.writeFile(tmplPath, updatedTmpl, 'utf8');
                  }
                } catch {}
              }
            }
          } catch {}

          // 3. Move products/P###-... folder to products/drafts/ and capture linked L### card
          let linkedLeadId = '';
          if (shortId) {
            try {
              const productsDir = path.join(root, 'products');
              const draftsDir = path.join(productsDir, 'drafts');
              await fs.mkdir(draftsDir, { recursive: true });
              const entries = await fs.readdir(productsDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory() && (entry.name === shortId || entry.name.startsWith(`${shortId}-`))) {
                  const prodFolder = path.join(productsDir, entry.name);
                  try {
                    const osProd = JSON.parse(await fs.readFile(path.join(prodFolder, 'os-product.json'), 'utf8'));
                    linkedLeadId = osProd?.markets?.[0]?.researchCandidateId || '';
                  } catch {}
                  const destFolder = path.join(draftsDir, entry.name);
                  await fs.rm(destFolder, { recursive: true, force: true }).catch(() => {});
                  await fs.rename(prodFolder, destFolder);
                  wipedItems.push(`Archived product folder products/${entry.name}`);
                }
              }
            } catch {}

            // 4. Clear activeProductId / buildProductId in os/data/workspace.json if it matches
            try {
              const wsFile = path.join(dataDir, 'workspace.json');
              const ws = JSON.parse(await fs.readFile(wsFile, 'utf8'));
              let wsChanged = false;
              if (ws.activeProductId && String(ws.activeProductId).startsWith(shortId)) {
                ws.activeProductId = null;
                wsChanged = true;
              }
              if (ws.buildProductId && String(ws.buildProductId).startsWith(shortId)) {
                ws.buildProductId = null;
                wsChanged = true;
              }
              if (ws.build?.productId && String(ws.build.productId).startsWith(shortId)) {
                ws.build = null;
                wsChanged = true;
              }
              if (wsChanged) {
                await fs.writeFile(wsFile, JSON.stringify(ws, null, 2), 'utf8');
                wipedItems.push(`Cleared ${shortId} from active build slot`);
              }
            } catch {}

            // 5. Remove from os/data/launch-checklists.json
            try {
              const clFile = path.join(dataDir, 'launch-checklists.json');
              const cl = JSON.parse(await fs.readFile(clFile, 'utf8'));
              if (cl?.products?.[shortId]) {
                delete cl.products[shortId];
                await fs.writeFile(clFile, JSON.stringify(cl, null, 2), 'utf8');
                wipedItems.push(`Cleared ${shortId} launch checklist`);
              }
            } catch {}
          }

          // 6. Mark linked research candidate (L###) as rejected in research/comparison.json
          if (linkedLeadId) {
            try {
              const compFile = path.join(root, 'research', 'comparison.json');
              const comp = JSON.parse(await fs.readFile(compFile, 'utf8'));
              const cand = (comp.candidates || []).find(x => x.id === linkedLeadId);
              if (cand) {
                cand.decision = `KILL — ${reason}`;
                cand.screen = cand.screen || {};
                cand.screen.ownerDecision = 'rejected';
                cand.screen.ownerReason = reason;
                cand.screen.decidedAt = new Date().toISOString();
                comp.revision = Number(comp.revision || 0) + 1;
                await fs.writeFile(compFile, JSON.stringify(comp, null, 2), 'utf8');
                wipedItems.push(`Marked research card ${linkedLeadId} as rejected`);
              }
            } catch {}
          }

          return json(res, 200, { ok: true, wipedItems, metaCampaigns: remaining });
        }
        if (input.newAd && plain(input.newAd)) {
          const na = input.newAd;
          const ad = {
            id: String(na.id || `AD-${Date.now()}`),
            name: string(na.name || `CREATIVE_${Date.now()}`, 'Ad name', 140),
            format: na.format === 'video' ? 'video' : 'static',
            status: String(na.status || 'READY'),
            mediaPath: String(na.mediaPath || '').trim().slice(0, 400),
            angle: String(na.angle || '').trim().slice(0, 300),
            headline: string(na.headline || 'You Have to See This — Get Yours Today!', 'Headline', 200),
            primaryText: String(na.primaryText || '').trim().slice(0, 3000),
            cta: String(na.cta || 'Shop Now').slice(0, 60),
            note: String(na.note || 'Hook-harvested viral reveal creative').slice(0, 300),
            ownerVerdict: 'keep',
          };
          camp.ads = [ad, ...(camp.ads || [])];
        }
        if (input.adId) {
          const ad = (camp.ads || []).find(a => a.id === input.adId || a.name === input.adId);
          if (!ad) throw fail(404, 'Ad not found.');
          if (input.ownerVerdict !== undefined) ad.ownerVerdict = String(input.ownerVerdict);
          if (input.ownerNote !== undefined) ad.ownerNote = String(input.ownerNote);
          if (input.headline !== undefined) ad.headline = String(input.headline).slice(0, 200);
          if (input.primaryText !== undefined) ad.primaryText = String(input.primaryText).slice(0, 3000);
          if (input.angle !== undefined) ad.angle = String(input.angle).slice(0, 300);
          if (input.mediaPath !== undefined) ad.mediaPath = String(input.mediaPath).slice(0, 400);
          if (input.name !== undefined) ad.name = String(input.name).slice(0, 140);
        }
        if (input.checkId && Array.isArray(camp.launchChecklist)) {
          const item = camp.launchChecklist.find(x => x.id === input.checkId);
          if (item && input.checked !== undefined) item.checked = Boolean(input.checked);
        }
        if (input.dailyBudget !== undefined && Number.isFinite(Number(input.dailyBudget)) && Number(input.dailyBudget) > 0) {
          camp.dailyBudget = Number(input.dailyBudget);
        }
        if (input.breakEvenCpa !== undefined && Number.isFinite(Number(input.breakEvenCpa)) && Number(input.breakEvenCpa) > 0) {
          camp.breakEvenCpa = Number(input.breakEvenCpa);
        }
        if (input.lossLimit !== undefined && Number.isFinite(Number(input.lossLimit)) && Number(input.lossLimit) > 0) {
          camp.lossLimit = Number(input.lossLimit);
        }
        if (input.targetCpa !== undefined && Number.isFinite(Number(input.targetCpa)) && Number(input.targetCpa) > 0) {
          camp.targetCpa = Number(input.targetCpa);
        }
        if (typeof input.countries === 'string' && input.countries.trim()) {
          camp.countries = input.countries.trim().slice(0, 120);
        }
        if (typeof input.campaignName === 'string' && input.campaignName.trim()) {
          camp.campaignName = input.campaignName.trim().slice(0, 180);
        }
        if (typeof input.adsetName === 'string' && input.adsetName.trim()) {
          camp.adsetName = input.adsetName.trim().slice(0, 200);
        }
        if (typeof input.status === 'string' && input.status.trim()) {
          camp.status = input.status.trim().slice(0, 60);
        }
        if (input.dailyLogEntry && plain(input.dailyLogEntry)) {
          const entry = {
            id: String(input.dailyLogEntry.id || `LOG-${Date.now()}`),
            date: String(input.dailyLogEntry.date || new Date().toISOString().slice(0, 10)).slice(0, 20),
            decision: String(input.dailyLogEntry.decision || 'Iterate').slice(0, 60),
            whatWorked: String(input.dailyLogEntry.whatWorked || '').trim().slice(0, 1000),
            whatToImprove: String(input.dailyLogEntry.whatToImprove || '').trim().slice(0, 1000),
            nextStep: String(input.dailyLogEntry.nextStep || '').trim().slice(0, 1000),
          };
          camp.dailyLogs = [entry, ...(Array.isArray(camp.dailyLogs) ? camp.dailyLogs : [])];
        }
        if (input.croCheckId) {
          camp.croChecklist = plain(camp.croChecklist) ? camp.croChecklist : {};
          camp.croChecklist[String(input.croCheckId)] = Boolean(input.checked);
        }
        parsed.updatedAt = new Date().toISOString();
        await fs.writeFile(metaFile, JSON.stringify(parsed, null, 2), 'utf8');
        return json(res, 200, { metaCampaigns: campaigns });
      }
      if (['GET', 'HEAD'].includes(req.method) && route === '/api/asset') {
        const relative = url.searchParams.get('path'); const { actual, limit } = await assetFile(relative);
        const handle = await fs.open(actual, 'r');
        try {
          const stat = await handle.stat(); if (!stat.isFile() || stat.size > limit) throw fail(413, 'Media changed or exceeds its size limit.');
          let start = 0; let end = stat.size - 1; let status = 200;
          if (req.headers.range !== undefined) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
            const invalid = () => { res.setHeader('Content-Range', `bytes */${stat.size}`); res.setHeader('Accept-Ranges', 'bytes'); throw fail(416, 'A single satisfiable byte range is required.'); };
            if (!match || (!match[1] && !match[2]) || !stat.size) invalid();
            if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) invalid(); start = Math.max(0, stat.size - suffix); }
            else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), stat.size - 1); }
            if (![start, end].every(Number.isSafeInteger) || start < 0 || start >= stat.size || end < start) invalid();
            status = 206;
          }
          const headers = { 'Content-Type': MIME[path.extname(relative).toLowerCase()], 'Content-Length': Math.max(0, end - start + 1), 'Accept-Ranges': 'bytes', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(relative))}`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` } : {}) };
          res.writeHead(status, headers);
          if (req.method === 'HEAD' || !stat.size) return res.end();
          await pipeline(handle.createReadStream({ start, end, autoClose: false }), res); return;
        } finally { await handle.close(); }
      }
      // Assets: the store map (read-only) and the restorable bin. Never a delete.
      if (req.method === 'GET' && route === '/api/assets') return json(res, 200, await library.map(url.searchParams.get('packet') || ''));
      if (req.method === 'POST' && route === '/api/assets/remove') return json(res, 200, await library.remove(await body(req, port, authorizeRequest)));
      if (req.method === 'POST' && route === '/api/assets/restore') return json(res, 200, await library.restore(await body(req, port, authorizeRequest)));
      if (req.method === 'GET' && route === '/api/changes') return json(res, 200, await changeFeed({ minutes: url.searchParams.get('minutes'), limit: url.searchParams.get('limit') }));
      // Tonight's launch (Home): the saved plan file and creative folder counts, read-only (server/launchTonight.mjs).
      if (req.method === 'GET' && route === '/api/launch') return json(res, 200, await launchTonight({ workspaceRoot: root, folders: url.searchParams.getAll('folder') }));
      if (req.method === 'GET' && route === '/api/maps') return json(res, 200, { maps: await readMaps() });
      if (req.method === 'POST' && route === '/api/maps') {
        const input = await body(req, port, authorizeRequest); const title = string(input.title, 'Map title');
        const map = await mutate(maps => {
          if (maps.length >= 50) throw fail(409, 'Limit of 50 maps reached.');
          const now = new Date().toISOString(); const map = { id: randomUUID(), title, revision: 1, createdAt: now, updatedAt: now, nodes: [], edges: [] };
          maps.push(map); return map;
        }); return json(res, 201, map);
      }
      if (req.method === 'PATCH' && /^\/api\/maps\/[^/]+$/.test(route)) {
        const input = await body(req, port, authorizeRequest); const id = decodeURIComponent(route.slice('/api/maps/'.length));
        const map = await mutate(async maps => {
          const map = maps.find(map => map.id === id); if (!map) throw fail(404, 'Map not found.');
          if (!Number.isInteger(input.revision)) throw fail(400, 'Current integer revision is required.');
          if (map.revision !== input.revision) throw fail(409, 'Map changed. Reload before saving your edit.');
          if (input.title !== undefined) map.title = string(input.title, 'Map title');
          if (input.nodes !== undefined || input.edges !== undefined) {
            if (['node', 'edge', 'removeNode', 'removeEdge'].some(key => input[key] !== undefined)) throw fail(400, 'Use either full graph replacement or individual graph edits in one request.');
            Object.assign(map, checkGraph(input.nodes, input.edges));
          }
          if (input.node !== undefined) {
            if (!plain(input.node)) throw fail(400, 'node must be an object.');
            const previous = map.nodes.find(n => n.id === input.node.id);
            const node = checkNode({ ...previous, ...input.node }); const i = map.nodes.findIndex(n => n.id === node.id);
            if (i < 0) { if (map.nodes.length >= 100) throw fail(409, 'Limit of 100 nodes reached.'); map.nodes.push(node); }
            else map.nodes[i] = node;
          }
          if (input.removeNode !== undefined) {
            const id = string(input.removeNode, 'Node ID', 100);
            if (!map.nodes.some(n => n.id === id)) throw fail(404, 'Node not found.');
            map.nodes = map.nodes.filter(n => n.id !== id); map.edges = map.edges.filter(e => e.from !== id && e.to !== id);
          }
          if (input.edge !== undefined) {
            const edge = input.edge;
            if (!plain(edge) || edge.from === edge.to || !map.nodes.some(n => n.id === edge.from) || !map.nodes.some(n => n.id === edge.to)) throw fail(400, 'Edge must connect two existing, different nodes.');
            if (!map.edges.some(e => e.from === edge.from && e.to === edge.to)) { if (map.edges.length >= MAX_EDGES) throw fail(409, 'Limit of 500 edges reached.'); map.edges.push({ from: edge.from, to: edge.to }); }
          }
          if (input.removeEdge !== undefined) {
            const edge = input.removeEdge;
            if (!plain(edge) || typeof edge.from !== 'string' || typeof edge.to !== 'string') throw fail(400, 'Edge endpoints required.');
            map.edges = map.edges.filter(e => e.from !== edge.from || e.to !== edge.to);
          }
          await referencePaths(map.nodes);
          map.revision++; map.updatedAt = new Date().toISOString(); return map;
        }); return json(res, 200, map);
      }
      return json(res, 405, { error: 'Method not allowed.' });
    } catch (error) {
      if (res.headersSent) { if (!res.writableEnded) res.destroy(error); return; }
      const status = error.status ?? (error.code === 'ENOENT' ? 404 : 500);
      const code = error.status && typeof error.code === 'string' && /^[A-Z][A-Z_]+$/.test(error.code) ? { code: error.code } : {};
      return json(res, status, { error: status === 500 && !error.status ? 'Hub operation failed.' : error.message, ...code });
    }
  };
  // The health check (server/doctor.mjs) reads the same read-only store map.
  hub.storeMap = (packetId = '') => library.map(packetId);
  return hub;
}
