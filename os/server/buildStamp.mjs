// Code and build stamps for the health check (server/doctor.mjs).
// - codeStamp: what the server runs (os/server/*.mjs without tests, plus the
//   pure os/src/*.mjs modules the server imports). The server keeps the stamp
//   it started with; a different stamp on disk means it needs a restart.
// - srcStamp: what the screens are built from (os/src and os/index.html).
//   `npm run build` runs this file afterwards (postbuild) to save
//   dist/build-stamp.json, so a later screen change shows as "needs a build".
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const OS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BUILD_STAMP = 'dist/build-stamp.json';
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

async function stampOf(dir, groups) {
  const files = {};
  for (const [folder, test] of groups) {
    let names = [];
    try { names = await fs.readdir(path.join(dir, folder)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const name of names.sort()) {
      if (!test(name)) continue;
      const relative = folder ? `${folder}/${name}` : name;
      try {
        const stat = await fs.stat(path.join(dir, relative));
        if (stat.isFile()) files[relative] = hash(await fs.readFile(path.join(dir, relative)));
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return {hash: hash(Object.entries(files).map(([name, value]) => `${name}:${value}`).join('\n')), files};
}

/** The server's code: os/server/*.mjs (not tests) and os/src/*.mjs. */
export const codeStamp = (dir = OS_DIR) => stampOf(dir, [['server', name => name.endsWith('.mjs') && !name.endsWith('.test.mjs')], ['src', name => name.endsWith('.mjs')]]);
/** What the screens are built from: every file in os/src, plus os/index.html. */
export const srcStamp = (dir = OS_DIR) => stampOf(dir, [['src', () => true], ['', name => name === 'index.html']]);

/** Files whose content differs between two stamps (added, removed or changed). */
export function changedFiles(before, after) {
  const names = new Set([...Object.keys(before?.files || {}), ...Object.keys(after?.files || {})]);
  return [...names].filter(name => before?.files?.[name] !== after?.files?.[name]).sort();
}

export async function readBuildStamp(dir = OS_DIR) {
  try { return JSON.parse(await fs.readFile(path.join(dir, BUILD_STAMP), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}

export async function writeBuildStamp(dir = OS_DIR, at = new Date()) {
  const src = await srcStamp(dir);
  const stamp = {builtAt: at.toISOString(), srcHash: src.hash, files: src.files};
  await fs.mkdir(path.join(dir, 'dist'), {recursive: true});
  await fs.writeFile(path.join(dir, BUILD_STAMP), JSON.stringify(stamp, null, 2) + '\n');
  return stamp;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const stamp = await writeBuildStamp();
  console.log(`build stamp ${stamp.srcHash} saved to os/${BUILD_STAMP}`);
}
