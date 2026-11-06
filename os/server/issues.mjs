// The issue list (owner, Oct 3: step 0, "the hard part, done first"):
// read-only. Every folder in resources/issues/ is one issue: its ISSUE.md
// (src/issues.mjs parses it) and any Gemini Deep Research report beside it. A
// folder with only a Gemini report is a Candidate with every check open.
// Real directories and regular files only (no symlinks), bounded reads.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ISSUES_ROOT, ISSUE_FILE, ISSUE_SLUG, parseIssue, geminiOnlyIssue, issuePath} from '../src/issues.mjs';

export const ISSUE_LIMITS = {files: 200, bytes: 1_000_000, folderFiles: 60};
/** A Gemini report beside ISSUE.md: a Markdown file whose name says gemini. */
export const GEMINI_FILE = /^[^/\\]*gemini[^/\\]*\.md$/i;

async function regularFile(file) {
  try { const stat = await fs.lstat(file); return stat.isFile() ? stat : null; }
  catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null; throw error; }
}

/**
 * Every issue: {issues: [...parsed, sorted by slug], problems: [{slug, path, text}]}.
 * Each issue carries `gemini` (its reports' workspace paths) and `modifiedAt`.
 * An odd folder name, an oversized or linked file, or an empty folder is a
 * problem, never a passed gate. A missing resources/issues/ is simply empty.
 */
export async function readIssues({workspaceRoot}) {
  const root = path.resolve(workspaceRoot);
  const dir = path.join(root, ...ISSUES_ROOT.split('/'));
  let entries;
  try { entries = await fs.readdir(dir, {withFileTypes: true}); }
  catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return {issues: [], problems: []}; throw error; }
  const issues = [], problems = [];
  for (const entry of entries.filter(item => item.isDirectory() && !item.name.startsWith('.') && !item.name.startsWith('_')).sort((a, b) => a.name.localeCompare(b.name)).slice(0, ISSUE_LIMITS.files)) {
    const slug = entry.name, relative = issuePath(slug);
    if (!ISSUE_SLUG.test(slug)) { problems.push({slug, path: `${ISSUES_ROOT}/${slug}/`, text: `"${slug}" is not a usable issue name (lowercase letters, numbers and hyphens).`}); continue; }
    const folder = path.join(dir, slug);
    let names = [];
    try { names = (await fs.readdir(folder, {withFileTypes: true})).filter(item => item.isFile()).map(item => item.name).slice(0, ISSUE_LIMITS.folderFiles); }
    catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
    const gemini = [];
    for (const name of names.filter(name => GEMINI_FILE.test(name)).sort()) {
      const stat = await regularFile(path.join(folder, name));
      if (stat && stat.size <= ISSUE_LIMITS.bytes) gemini.push({path: `${ISSUES_ROOT}/${slug}/${name}`, modifiedAt: stat.mtime.toISOString()});
    }
    const file = path.join(folder, ISSUE_FILE);
    let stat;
    try { stat = await fs.lstat(file); }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      // Gemini found it, nobody has written ISSUE.md yet: a Candidate (owner, Oct 3: "researching with gemini, and we do cross referencing").
      if (gemini.length) {
        const report = await fs.readFile(path.join(root, ...gemini[0].path.split('/')), 'utf8');
        issues.push({...geminiOnlyIssue(slug, report), gemini: gemini.map(item => item.path), modifiedAt: gemini.map(item => item.modifiedAt).sort().at(-1)});
      } else problems.push({slug, path: `${ISSUES_ROOT}/${slug}/`, text: `${ISSUES_ROOT}/${slug}/ has no ${ISSUE_FILE} and no Gemini report yet.`});
      continue;
    }
    if (!stat.isFile()) { problems.push({slug, path: relative, text: `${relative} is not a regular file.`}); continue; }
    if (stat.size > ISSUE_LIMITS.bytes) { problems.push({slug, path: relative, text: `${relative} is over ${ISSUE_LIMITS.bytes / 1_000_000} MB.`}); continue; }
    const parsed = parseIssue(await fs.readFile(file, 'utf8'), slug);
    const changed = [stat.mtime.toISOString(), ...gemini.map(item => item.modifiedAt)].sort().at(-1);
    issues.push({...parsed, gemini: gemini.map(item => item.path), modifiedAt: changed});
  }
  return {issues, problems};
}

/** The issue a round names, or null. */
export async function findIssue({workspaceRoot}, slug) {
  if (!ISSUE_SLUG.test(String(slug ?? ''))) return null;
  const {issues} = await readIssues({workspaceRoot});
  return issues.find(issue => issue.slug === slug) || null;
}
