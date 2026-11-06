// Tonight's launch (Home): the saved plan file, whether the native ad kit and the
// population guide exist, and file counts for the launch product's creative
// folders. Read-only. Folders must sit under products/ or research/; links,
// junctions, dotfiles, _removed and private names are skipped, walks are bounded,
// and only paths, counts and times are returned (never folder contents).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LAUNCH_PLAN_PATH, NATIVE_AD_KIT_PATH, POPULATION_PATH, LAUNCH_FOLDER_ROOTS, LAUNCH_FOLDER_LIMIT } from '../src/launchTonight.mjs';

export const LAUNCH_LIMITS = Object.freeze({ planBytes: 256 * 1024, entries: 4000, depth: 6, docs: 6 });
const IMAGE = /\.(?:png|jpe?g|webp|gif|avif|svg)$/i;
const VIDEO = /\.(?:mp4|webm|mov)$/i;
const PRIVATE = /^(?:\.env.*|\.git|node_modules|credentials?|secrets?|tokens?|private|sessions?|cookies?|auth|_removed)$/i;

// Every segment from the workspace root down must exist without links; returns the stat or null.
async function realPath(workspaceRoot, relative) {
  let current = workspaceRoot, stat = null;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { stat = await fs.lstat(current); if (stat.isSymbolicLink()) return null; }
    catch { return null; }
  }
  return { absolute: current, stat };
}

/** A folder path the route may count, or null: products/… or research/…, plain segments only. */
export function launchFolderPath(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '');
  if (!clean || clean.length > 300 || /[\\%:?#*"<>|]/.test(clean) || clean.startsWith('/')) return null;
  const parts = clean.split('/');
  if (parts.length < 2 || !LAUNCH_FOLDER_ROOTS.includes(parts[0])) return null;
  if (parts.some(part => !part || part === '.' || part === '..' || part.startsWith('.') || /[. ]$/.test(part) || PRIVATE.test(part))) return null;
  return clean;
}

async function fileFact(workspaceRoot, relative) {
  const found = await realPath(workspaceRoot, relative);
  if (!found || !found.stat.isFile()) return { path: relative, exists: false };
  return { path: relative, exists: true, modifiedAt: found.stat.mtime.toISOString(), size: found.stat.size };
}

async function countFolder(workspaceRoot, relative) {
  const found = await realPath(workspaceRoot, relative);
  if (!found || !found.stat.isDirectory()) return { path: relative, exists: false };
  let files = 0, images = 0, videos = 0, entries = 0, truncated = false, newest = 0;
  const docs = [];
  const stack = [[found.absolute, relative, 0]];
  while (stack.length) {
    const [dir, rel, depth] = stack.pop();
    let items;
    try { items = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const item of items) {
      if (++entries > LAUNCH_LIMITS.entries) { truncated = true; break; }
      const name = item.name;
      if (name.startsWith('.') || item.isSymbolicLink() || PRIVATE.test(name)) continue;
      const absolute = path.join(dir, name), relPath = `${rel}/${name}`;
      if (item.isDirectory()) { if (depth < LAUNCH_LIMITS.depth) stack.push([absolute, relPath, depth + 1]); else truncated = true; continue; }
      if (!item.isFile()) continue;
      files += 1;
      if (IMAGE.test(name)) images += 1; else if (VIDEO.test(name)) videos += 1;
      let at = 0; try { at = (await fs.stat(absolute)).mtimeMs; } catch {}
      if (at > newest) newest = at;
      if (/\.md$/i.test(name)) docs.push({ path: relPath, at });
    }
    if (truncated) break;
  }
  docs.sort((a, b) => b.at - a.at);
  return { path: relative, exists: true, files, images, videos, truncated, modifiedAt: newest ? new Date(newest).toISOString() : null,
    docs: docs.slice(0, LAUNCH_LIMITS.docs).map(doc => doc.path) };
}

/**
 * {plan:{path, exists, modifiedAt, content}, kit, population, folders:[{path, exists, files, images, videos, docs, modifiedAt, truncated}]}.
 * `folders` takes up to six folder paths (the screen asks for the launch product's creative folders and
 * the folders the plan links); anything outside products/ or research/ is refused as `allowed: false`.
 */
export async function launchTonight({ workspaceRoot, folders = [] } = {}) {
  const root = path.resolve(workspaceRoot);
  const plan = await fileFact(root, LAUNCH_PLAN_PATH);
  if (plan.exists) {
    if (plan.size > LAUNCH_LIMITS.planBytes) { plan.tooLarge = true; plan.content = ''; }
    else plan.content = await fs.readFile(path.join(root, ...LAUNCH_PLAN_PATH.split('/')), 'utf8');
  }
  const asked = [...new Set((Array.isArray(folders) ? folders : [folders]).map(value => String(value || '').trim()).filter(Boolean))].slice(0, LAUNCH_FOLDER_LIMIT);
  const counted = [];
  for (const value of asked) {
    const safe = launchFolderPath(value);
    counted.push(safe ? await countFolder(root, safe) : { path: value.slice(0, 300), exists: false, allowed: false });
  }
  const { size, ...planFact } = plan;
  return { plan: planFact, kit: await fileFact(root, NATIVE_AD_KIT_PATH), population: await fileFact(root, POPULATION_PATH), folders: counted };
}
