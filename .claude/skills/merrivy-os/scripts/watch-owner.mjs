#!/usr/bin/env node
// Watches Launchroom's saved records and prints one line per owner action, so a
// Claude session running this under its Monitor tool is woken by the owner's clicks:
// eye-test decisions (Find), "Build this one", owner notes (Today "Keep a thought",
// Memory), owner-made to-dos, Store editor saves, "Publish to merrivy.com" requests and the owner's
// issue picks (step 0: "Test this issue", "Not now" and their undo).
// Read-only: it never deploys or writes anything. A publish request prints a line starting
// "LAUNCHROOM PUBLISH REQUEST"; the manager runs the deploy and then answers that owner note.
// Run from the workspace root.
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.MERRIVY_WORKSPACE_ROOT || process.cwd();
const files = {
  research: path.join(root, 'research', 'comparison.json'),
  workspace: path.join(root, 'os', 'data', 'workspace.json'),
  planner: path.join(root, 'os', 'data', 'planner.json'),
  // Optional: absent until the owner picks an issue for the first time.
  picks: path.join(root, 'os', 'data', 'issue-picks.json'),
};
const every = Number(process.env.WATCH_MS || 2000);

function read(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
const short = (text, n = 240) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, n);
const say = line => process.stdout.write(`LAUNCHROOM ${line}\n`);

function snapshot() {
  const research = read(files.research);
  const workspace = read(files.workspace);
  const planner = read(files.planner);
  // A missing picks file is no picks yet; an unreadable one (mid-write) is skipped this tick.
  const picks = fs.existsSync(files.picks) ? read(files.picks) : {picks: {}};
  return {
    // One tap decides (Oct 3): the reason may be empty; quick-reason chips ride along as reasonTags.
    decisions: new Map((research?.candidates || []).map(c => [c.id, JSON.stringify([c.screen?.ownerDecision || '', c.screen?.ownerReason || '', Array.isArray(c.screen?.reasonTags) ? c.screen.reasonTags : []])])),
    names: new Map((research?.candidates || []).map(c => [c.id, c.name || c.title || c.product || ''])),
    build: workspace ? `${workspace.build?.productId || ''}|${workspace.activeProductId || ''}` : null,
    buildReason: workspace?.build?.reason || '',
    notes: new Set((workspace?.notes || []).map(n => n.id)),
    ownerNotes: (workspace?.notes || []).filter(n => n.author === 'owner'),
    tasks: new Map((planner?.tasks || []).map(t => [t.id, t])),
    // The owner's issue picks (Oct 3): slug -> "testing|parked" plus "|undone" after an Undo; null while the file is unreadable.
    picks: picks && picks.picks ? new Map(Object.entries(picks.picks).map(([slug, p]) => [slug, `${p.pick}${p.undone ? '|undone' : ''}`])) : null,
    ok: Boolean(research && workspace && planner),
  };
}

let last = snapshot();
say(`watching started · ${last.ok ? 'records readable' : 'some records unreadable'}`);

setInterval(() => {
  const now = snapshot();
  if (!now.ok) return; // a file mid-write; try again next tick
  for (const [id, value] of now.decisions) {
    const before = last.decisions.get(id);
    if (before === undefined || before === value) continue;
    const [decision, reason, tags] = JSON.parse(value);
    if (!decision) continue;
    // Undo (5 seconds after a tap) puts an unreviewed card back.
    if (decision === 'unreviewed') { say(`eye test · ${id} ${short(now.names.get(id), 60)} → undone, waiting for the eye test again`); continue; }
    say(`eye test · ${id} ${short(now.names.get(id), 60)} → ${decision.toUpperCase()}${tags.length ? ` · tags: ${tags.join(', ')}` : ''}${reason.trim() ? ` · note: ${short(reason)}` : ''}${!tags.length && !reason.trim() ? ' · no reason given' : ''}`);
  }
  if (last.build !== null && now.build !== last.build) say(`build slot · now ${now.build.split('|').filter(Boolean)[0] || 'empty'}${now.buildReason ? ` · reason: ${short(now.buildReason)}` : ''}`);
  for (const note of now.ownerNotes) {
    if (last.notes.has(note.id)) continue;
    // The Store editor (owner, Oct 2): a publish request is an open owner note with topic "publish"; saves are addressed diary lines.
    if (note.topic === 'publish') say(`PUBLISH REQUEST · ${note.id} · deploy merrivy.com, then answer this note · ${short(note.text, 600)}`);
    else if (note.topic === 'store-edit') say(`owner store edit · ${note.id} · ${short(note.text, 300)}`);
    else say(`owner note · ${note.id} · ${short(note.text, 600)}`);
  }
  for (const [id, task] of now.tasks) {
    const before = last.tasks.get(id);
    if (!before && task.assignee === 'owner') say(`new owner to-do · ${id.slice(0, 8)} · ${short(task.title, 160)}`);
    else if (before && before.status !== task.status && task.assignee === 'owner') say(`owner to-do ${task.status} · ${id.slice(0, 8)} · ${short(task.title, 160)}`);
  }
  // Step 0 (owner, Oct 3): "LAUNCHROOM issue pick · <slug> → TESTING / PARKED / undone".
  if (now.picks && last.picks) {
    for (const [slug, value] of now.picks) {
      if (last.picks.get(slug) === value) continue;
      const [pick, undone] = value.split('|');
      say(`issue pick · ${slug} → ${pick.toUpperCase()}${undone ? ' · undone (back to the earlier pick)' : ''}`);
    }
    for (const slug of last.picks.keys()) if (!now.picks.has(slug)) say(`issue pick · ${slug} → undone, Verified again`);
  }
  if (now.picks || !last.picks) last = now; else last = {...now, picks: last.picks};
}, every);
