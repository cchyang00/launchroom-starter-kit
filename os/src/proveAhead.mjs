// Work done ahead of the owner's Save (owner, Oct 3: "im on prove it and i
// literally dont see a spot to run those checks"). A card still waiting for
// the eye test can already have its buyers check and a Prove it file
// (research/<round>/prove/L###.md). The server only takes Prove it checks after
// the Save, so that work sat where the owner could not see it. These pure
// functions read what was done ahead and say, in plain words, why a check
// can't move and what moves it. Nothing here writes a record or passes a check:
// the prove file is a write-up, not a recorded check. Tested in
// server/proveAhead.test.mjs.
import {GATES, gateLine} from './gates.mjs';
import {PRODUCT_STEP, BUYERS_STEP, PROVE_STEP} from './pipeline.mjs';
import {FIND_CHECK_IDS, checkPasses} from './researchView.mjs';

/** research/<folder>/prove/L###.md */
export const PROVE_FILE = /^research\/[A-Za-z0-9._-]+\/prove\/(L\d{3,})\.md$/;
export const PROVE_FILE_MAX = 400_000;
/** The prove file's word for a line, read as a state. */
export const LINE_WORDS = {passed: 'Passes', failed: 'Fails', open: 'Open', drafted: 'Drafted', written: 'Written', none: 'Not started'};

const clean = value => String(value ?? '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
const clip = (value, max) => { const s = clean(value); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };

/** One verdict word to a state: PASS/PASSES passed, FAIL/FAILED/SATURATED failed, OPEN open, DRAFTED or "plan written" drafted, WRITTEN written. */
export function verdictState(text) {
  const t = clean(text).toUpperCase();
  if (/^(PASS|PASSES|PASSED)\b/.test(t)) return 'passed';
  if (/^(FAIL|FAILS|FAILED|SATURATED)\b/.test(t)) return 'failed';
  if (/^OPEN\b/.test(t)) return 'open';
  if (/^(DRAFTED|DRAFT)\b|^PLAN WRITTEN\b/.test(t)) return 'drafted';
  if (/^WRITTEN\b/.test(t)) return 'written';
  return 'open';
}

/** Markdown sections by "## " heading: [{title, body}]. */
function sections(text) {
  const out = []; let current = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const heading = raw.match(/^##\s+(.+?)\s*$/);
    if (heading && !raw.startsWith('###')) { current = {title: heading[1], body: []}; out.push(current); continue; }
    if (current) current.body.push(raw);
  }
  return out.map(section => ({title: section.title, body: section.body.join('\n')}));
}
const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());

/**
 * A prove file's summary: the P1 verdict (from "Room on Meta (P1)", else the
 * verdict table), the P2-P5 lines from "Verdict in six lines" ({id, state,
 * result, why}), the supplier sites that showed a verification page, and the
 * date in its header. Unknown stays unknown: a missing line is `none`.
 */
export function parseProveFile(text) {
  const source = String(text || '');
  const all = sections(source);
  const verdict = all.find(section => /verdict/i.test(section.title));
  const rows = new Map();
  for (const line of (verdict?.body || '').split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const [gate, result = '', why = ''] = cells(line);
    const id = clean(gate).match(/^P([1-5])\b/)?.[0];
    if (id && !rows.has(id)) rows.set(id, {id, label: clip(gate, 80), state: verdictState(result), result: clip(result, 110), why: clip(why, 260)});
  }
  // P1 · Room on Meta (owner, Oct 3): its own section when the checker ran it; its gate line wins over the table.
  const room = all.find(section => /^room on meta/i.test(section.title)) || all.find(section => /^p1\b.*room on meta/i.test(section.title) && !/superseded/i.test(section.title));
  let p1 = rows.get('P1') || null;
  if (room) {
    const gateLine = room.body.match(/P1\s*·\s*Room on Meta:\s*\**\s*(PASSES|PASSED|PASS|FAILS|FAILED|FAIL)\b\s*\(?([^)*\n.]*)\)?/i)
      || room.body.match(/P1 for L\d{3,}:\s*\**\s*(PASSES|PASSED|PASS|FAILS|FAILED|FAIL)\b[,:]?\s*([^*\n.]*)/i)
      || room.body.match(/P1 overall\**\s*\|\s*\**\s*(PASSES|PASSED|PASS|FAILS|FAILED|FAIL)\b[:,]?\s*([^*\n.|]*)/i);
    if (gateLine) p1 = {id: 'P1', state: verdictState(gateLine[1]), result: clip(`${clean(gateLine[1]).toUpperCase().startsWith('P') ? 'Passes' : 'Fails'}${gateLine[2] ? `: ${gateLine[2]}` : ''}`, 110), why: p1?.why || ''};
    else if (!p1) p1 = {id: 'P1', state: 'open', result: 'Written; no verdict line found', why: ''};
  }
  const lines = ['P1', 'P2', 'P3', 'P4', 'P5'].map(id => (id === 'P1' ? p1 : rows.get(id)) || {id, state: 'none', result: '', why: ''});
  // Supplier pages behind a verification wall (the "Access, honestly" table): the sites the checker stopped on.
  const walls = [];
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (row.length >= 3 && /^stopped\b/i.test(clean(row.at(-1))) && !/^P\d/.test(clean(row[0])) && /verif|captcha|slide/i.test(row.slice(1).join(' '))) {
      const site = clean(row[0]).replace(/^CJdropshipping$/i, 'CJ');
      if (site && !walls.includes(site)) walls.push(site);
    }
  }
  if (!walls.length && /human verification|recaptcha|slide to verify|slider/i.test(rows.get('P2')?.why || '')) walls.push('CJ', 'Alibaba', 'AliExpress');
  const observed = source.match(/observed (\d{4}-\d{2}-\d{2})/i)?.[1] || source.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || '';
  return {lines, p1: lines[0], walls, observed, roomOnMeta: Boolean(room)};
}

/** "CJ, Alibaba and AliExpress" */
export const listWords = list => list.length <= 1 ? (list[0] || '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;

/**
 * Researched ahead (owner, Oct 3): a card still waiting for the owner's Save
 * that already has prove work (a prove file) or a saved buyers check. Returns
 * what is ready (Buyers A1-A3, P1-P5 from the file) and what waits on the Save,
 * or null. A Pass, Reject, Save, park or failure is never "ahead".
 */
export function aheadOf(item, candidate, prove = null) {
  if (!item || item.outcome || !candidate || item.readyToBuild || item.stepIndex > PROVE_STEP) return null;
  if ((candidate.screen?.ownerDecision || 'unreviewed') !== 'unreviewed') return null;
  const b = candidate.screen?.checks?.buyers;
  const buyersSaved = Boolean(b && b.status && b.status !== 'pending');
  if (!prove && !buyersSaved) return null;
  const buyerLines = GATES.buyers.map(line => gateLine(line, {candidate}));
  const passed = buyerLines.filter(line => line.state === 'passed').length;
  const buyers = {state: b?.status === 'failed' ? 'failed' : passed === buyerLines.length ? 'passed' : buyersSaved ? 'partly' : 'none', passed, total: buyerLines.length, quotes: Number.isInteger(b?.quotes) ? b.quotes : null, avatars: Array.isArray(b?.avatars) ? b.avatars.length : null, source: b?.source || ''};
  const find = FIND_CHECK_IDS.filter(id => checkPasses(id, candidate.screen?.checks?.[id])).length;
  const lines = prove?.lines || [];
  // What the prove file says that the checker hasn't put on the card yet.
  const pendingWrites = lines.filter(line => line.state !== 'none').map(line => line.id);
  return {id: item.id, buyers, find, findTotal: FIND_CHECK_IDS.length, lines, p1: prove?.p1 || null, file: prove?.path || '', observed: prove?.observed || '', walls: prove?.walls || [], pendingWrites};
}

/**
 * Why a check can't move, in plain words, with the action that moves it and
 * whose it is: [{id, check, text, action, who}]. From saved records and the
 * prove file only; an empty list means nothing is stuck.
 */
export function waitReasons({item, candidate = null, prove = null, ahead = null} = {}) {
  if (!item || item.outcome) return [];
  const out = [];
  const add = (id, check, text, action, who) => out.push({id, check, text, action, who});
  const walls = prove?.walls || [];
  const line = id => prove?.lines?.find(entry => entry.id === id) || null;
  if (ahead) {
    if (ahead.pendingWrites.length) add('record', ahead.pendingWrites.join(', '), `${ahead.pendingWrites.join(', ')} ${ahead.pendingWrites.length === 1 ? 'is' : 'are'} written in the prove file, not on the card yet.`, 'The checker records them on its next pass.', 'checker');
    if (ahead.find < ahead.findTotal) add('find', 'F1-F6', `Product checks ${ahead.find}/${ahead.findTotal} are still open.`, 'The scout finishes the open Product checks.', 'scout');
  }
  const atProve = item.stepIndex === PROVE_STEP || Boolean(ahead);
  if (atProve && walls.length && ['open', 'none'].includes(line('P2')?.state || 'none')) add('walls', 'P2', `P2 waits for supplier pages: ${listWords(walls)} showed a verification page, so the exact item wasn't read.`, `Clear the ${listWords(walls)} verification once in the browser; the checker reads the item next.`, 'owner');
  if (atProve && line('P3')?.state === 'drafted') add('p3', 'P3', 'P3 is a draft until a supplier confirms the shipping times.', walls.length ? 'It follows P2: once the supplier pages open, the checker asks for a shipping quote.' : 'The checker asks the supplier for a shipping quote (a message to a supplier needs your yes).', 'checker');
  // Owner, Oct 3: no samples. P5 is claims we can back; an older file's sample draft is not a wait on the owner.
  if (atProve && line('P5') && line('P5').state !== 'passed') add('p5', 'P5', /sample/i.test(`${line("P5").label || ""} ${line("P5").result} ${line("P5").why}`) ? 'P5 is now Claims we can back (no sample is bought); this file still has the old sample plan.' : 'P5 Claims we can back: each page and ad claim still needs its supplier spec or review pattern.', 'The checker backs every claim with a supplier spec or a pattern in buyers\' reviews of the same item type, and drops the rest.', 'checker');
  if (!ahead && item.stepIndex === BUYERS_STEP) {
    const b = candidate?.screen?.checks?.buyers;
    if (!b || b.status === 'pending') add('buyers', 'A1-A3', 'Buyers hasn\'t started: no buyers write-up is saved for this product yet.', 'The buyer researcher reads its TikTok comments, 2-4 star reviews and forums.', 'buyer-researcher');
  }
  if (!ahead && item.stepIndex === PROVE_STEP && !prove) add('prove', 'P1-P5', 'Prove it hasn\'t started: no prove file is saved for this product yet.', 'The checker runs Room on Meta (P1), then P2-P5.', 'checker');
  return out;
}
