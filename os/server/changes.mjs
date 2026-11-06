// Live changes: workspace files changed in the last N minutes, so the Agents
// tab shows movement between reports. Read-only. It walks only the allowed
// business and app folders below, never os/private, os/data, Launchroom
// uploads, node_modules, build output, .git or dotfiles such as .env, and it
// never follows a symbolic link or junction. Walks are bounded by entry count,
// depth and time, and only paths and times are returned (never contents).
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const CHANGE_ROOTS = Object.freeze([
  'os/src', 'os/server', '.claude/agents', '.claude/skills', 'workflow', 'store', 'research', 'products',
  'resources', 'memory', 'templates', 'agents', 'hydrogen-storefront/app', 'hydrogen-storefront/scripts',
]);
// Directory names skipped wherever they appear inside an allowed folder.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'private', 'launchroom', 'uploads', 'inbox', '_removed']);
// Key and certificate files are skipped by name even though only their path would show.
const SKIP_FILE = /\.(?:pem|key|p12|pfx|crt|cer|keystore)$/i;
const BURST_MS = 5000;
export const CHANGE_LIMITS = Object.freeze({ minutes: 240, limit: 50, entries: 20000, depth: 10, budgetMs: 1500 });

const clamp = (value, fallback, max) => { const n = Math.floor(Number(value)); return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback; };

// Every segment from the workspace root down must be a real directory, not a link.
async function realFolder(workspaceRoot, relative) {
  let current = workspaceRoot;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { const stat = await fs.lstat(current); if (stat.isSymbolicLink() || !stat.isDirectory()) return null; }
    catch { return null; }
  }
  return current;
}

/**
 * Files under the allowed folders modified within `minutes` (default 30, at most
 * 240), newest first, at most `limit` (default 12, at most 50).
 * Returns {minutes, since, changes:[{path, at, count}], total, more, truncated}:
 * `count` > 1 is a burst in one folder, `total` counts every changed file,
 * `more` says rows were left out, `truncated` says a cap stopped the walk early.
 */
export async function recentChanges({ workspaceRoot, minutes, limit, now = Date.now(), maxEntries = CHANGE_LIMITS.entries, maxDepth = CHANGE_LIMITS.depth, budgetMs = CHANGE_LIMITS.budgetMs } = {}) {
  const window = clamp(minutes, 30, CHANGE_LIMITS.minutes), cap = clamp(limit, 12, CHANGE_LIMITS.limit);
  const since = now - window * 60000, deadline = Date.now() + budgetMs, root = path.resolve(workspaceRoot);
  const found = []; let entries = 0, truncated = false;
  for (const relative of CHANGE_ROOTS) {
    const base = await realFolder(root, relative);
    if (!base) continue;
    const stack = [[base, relative, 0]];
    while (stack.length) {
      if (entries >= maxEntries || Date.now() > deadline) { truncated = true; break; }
      const [dir, rel, depth] = stack.pop();
      let items;
      try { items = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const item of items) {
        if (++entries > maxEntries) { truncated = true; break; }
        const name = item.name;
        if (name.startsWith('.') || item.isSymbolicLink()) continue;
        const absolute = path.join(dir, name), relPath = `${rel}/${name}`;
        if (item.isDirectory()) { if (!SKIP_DIRS.has(name.toLowerCase()) && depth < maxDepth) stack.push([absolute, relPath, depth + 1]); continue; }
        if (!item.isFile() || SKIP_FILE.test(name)) continue;
        let stat;
        try { stat = await fs.lstat(absolute); } catch { continue; }
        if (!stat.isFile() || stat.mtimeMs < since || stat.mtimeMs > now + 60000) continue;
        found.push({ path: relPath, at: new Date(stat.mtimeMs).toISOString(), ms: stat.mtimeMs });
      }
    }
    if (truncated) break;
  }
  found.sort((a, b) => b.ms - a.ms || a.path.localeCompare(b.path));
  // A burst (several files in one folder saved within a few seconds, such as the
  // regenerated memory/days pages) is one row: the newest file plus a count.
  const groups = [], open = new Map();
  for (const item of found) {
    const folder = item.path.slice(0, item.path.lastIndexOf('/'));
    const group = open.get(folder);
    if (group && group.oldest - item.ms <= BURST_MS) { group.count++; group.oldest = item.ms; continue; }
    const next = { path: item.path, at: item.at, count: 1, oldest: item.ms };
    groups.push(next); open.set(folder, next);
  }
  return { minutes: window, since: new Date(since).toISOString(), changes: groups.slice(0, cap).map(({ path: p, at, count }) => ({ path: p, at, count })), total: found.length, more: groups.length > cap, truncated };
}

/** A short-lived cache so mission control's polling does not walk the folders on every request. */
export function createChangeFeed({ workspaceRoot, ttlMs = 10000 }) {
  const cache = new Map();
  return async ({ minutes, limit } = {}) => {
    const key = `${clamp(minutes, 30, CHANGE_LIMITS.minutes)}:${clamp(limit, 12, CHANGE_LIMITS.limit)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = await recentChanges({ workspaceRoot, minutes, limit });
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    return value;
  };
}
