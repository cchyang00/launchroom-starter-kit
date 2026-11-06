// One product's page and card, worked out from saved records only (owner, Nov 4: "It's
// tiring sometimes to just read a bunch of text on the screen"). Pure, so the screens only
// draw; tested in server/productView.test.mjs. Nothing here writes or passes a check.
import {DISPLAY_LINE, checklistScore} from './displayLine.mjs';

/** A long saved name without its trailing note: "2-Pack Solar Lights ('NEED LIGHT' Kit)" reads "2-Pack Solar Lights". */
export const cardName = name => String(name || '').replace(/\s*\((?:[^()]|\([^)]*\))*\)\s*$/, '').trim() || name;

/** Our price against the landed cost, as a multiple (3.8 means 3.8x), from the saved card. */
export function markupOf(v) {
  const landed = Number(String(v?.money?.landed || '').replace(/[^\d.]/g, ''));
  return landed > 0 && v?.margin ? (landed + v.margin.value) / landed : null;
}

const RULE_NAMES = {category: 'Meta category', direct: 'Direct Meta ads', wave: 'Wave age', brand: 'Unbranded & price', tiers: 'Bundle margin'};
/** A hard rule's short name: "3. Kalodata Wave Age" reads "Wave age". */
export const ruleName = rule => RULE_NAMES[rule?.id] || String(rule?.label || '').replace(/^\d+\.\s*/, '');

/** How many of the owner's hard rules pass. */
export function rulesScore(rules) {
  const list = Array.isArray(rules) ? rules : [];
  return {good: list.filter(rule => rule.state === 'good').length, total: list.length};
}

/**
 * How many viral videos and creators the card claims (its saved wave line), and how many
 * videos it actually saved with links. The owner's rule: 5+ videos across 3+ creators.
 */
export function viralCounts(kalo) {
  const raw = Array.isArray(kalo?.rawVideos) ? kalo.rawVideos : [];
  const saved = raw.length;
  const savedCreators = new Set(raw.map(video => video?.handle).filter(Boolean)).size;
  const label = String(kalo?.waveLabel || '');
  const videos = Number(label.match(/(\d[\d,]*)\s+(?:US\s+)?Viral Videos/i)?.[1]?.replace(/,/g, ''));
  const creators = Number(label.match(/(\d[\d,]*)\s+Creators/i)?.[1]?.replace(/,/g, ''));
  return {
    videos: Number.isFinite(videos) ? videos : saved,
    creators: Number.isFinite(creators) ? creators : (savedCreators || (Number.isInteger(kalo?.creators) ? kalo.creators : 0)),
    saved,
    savedCreators,
  };
}

const CHECKLIST_LINE = new Set(['current', 'stopped']);

/** The owner's seven pipeline steps for one product (Product, Verify, Winners, Store, Creatives, Checklist, Launch). */
export function displaySteps(item, checklists) {
  const byId = Object.fromEntries((item?.line || []).map(step => [step.id, step]));
  const prove = byId.prove;
  const create = byId.create;
  const launch = byId.launch;
  const learn = byId.learn;
  const score = checklistScore(checklists, item?.productId || item?.id);
  return DISPLAY_LINE.map(entry => {
    const steps = entry.steps.map(id => byId[id]).filter(Boolean);
    let state = 'todo';
    if (steps.some(step => step.state === 'stopped')) state = 'stopped';
    else if (steps.some(step => step.state === 'current')) state = 'current';
    else if (steps.some(step => step.state === 'waiting')) state = 'waiting';
    else if (steps.some(step => step.state === 'early')) state = 'early';
    else if (steps.length && steps.every(step => step.state === 'done')) state = 'done';
    if (entry.id === 'winners') {
      if (prove?.state === 'done') {
        state = create?.state === 'waiting' || item?.readyToBuild ? 'waiting' : 'done';
      } else {
        state = 'todo';
      }
    }
    if (entry.id === 'creatives' && create?.state === 'waiting') {
      state = 'todo';
    }
    if (entry.id === 'checklist' && launch) {
      if (launch.state === 'done') state = 'done';
      else if (CHECKLIST_LINE.has(launch.state)) state = score.complete ? 'done' : launch.state;
    }
    if (entry.id === 'launch') {
      if (learn && (learn.state === 'current' || learn.state === 'done')) state = 'done';
      else if (launch && CHECKLIST_LINE.has(launch.state)) state = score.complete ? launch.state : 'todo';
      else if (launch && launch.state === 'todo') state = 'todo';
    }
    const done = steps.reduce((sum, step) => sum + (step.done || 0), 0);
    const total = steps.reduce((sum, step) => sum + (step.total || 0), 0);
    return {id: entry.id, short: entry.short, state, done, total};
  });
}

const curveKey = v => (v?.series?.points?.length >= 3 ? v.series.points.map(point => `${point.date}:${point.value}`).join('|') : '');
const EVIDENCE_KEYS = {
  curve: curveKey,
  kalodata: v => v?.kalodata?.kalodataUrl || '',
  tiktok: v => v?.kalodata?.tiktokUrl || '',
  meta: v => v?.meta?.url || '',
};

const indexes = new WeakMap();
/**
 * Which saved evidence is identical on two or more products: a product id gives the kinds
 * it shares and with whom. Worked out once per item list, so every card can ask cheaply.
 */
export function evidenceIndex(items) {
  const list = Array.isArray(items) ? items : [];
  if (indexes.has(list)) return indexes.get(list);
  const index = new Map();
  for (const [kind, read] of Object.entries(EVIDENCE_KEYS)) {
    const groups = new Map();
    for (const item of list) {
      if (!item?.validation) continue;
      const key = read(item.validation);
      if (key) groups.set(key, [...(groups.get(key) || []), item.id]);
    }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      for (const id of ids) {
        if (!index.has(id)) index.set(id, {});
        index.get(id)[kind] = ids.filter(other => other !== id);
      }
    }
  }
  indexes.set(list, index);
  return index;
}

/** "L376, L374 and 3 more". */
export function idList(ids, shown = 3) {
  const first = ids.slice(0, shown).join(', ');
  return ids.length > shown ? `${first} and ${ids.length - shown} more` : first;
}

const searchWords = url => {
  try { return new URL(url).searchParams.get('q') || ''; } catch { return ''; }
};

/**
 * Evidence on this product that looks copied from another one, in plain words. It reads
 * saved records and only warns: it passes nothing, fails nothing and changes nothing.
 */
export function evidenceFlags(item, items, candidate) {
  const shared = evidenceIndex(items).get(item?.id) || {};
  const v = item?.validation;
  const flags = [];
  if (shared.curve) flags.push({id: 'curve', text: `This trend curve is identical on ${idList(shared.curve)}. Different products shouldn't share one curve, so treat ${Number.isFinite(v?.changePercent) ? `the ${v.changePercent > 0 ? '+' : ''}${v.changePercent}%` : 'it'} as unverified.`});
  if (shared.kalodata) flags.push({id: 'kalodata', text: `Its Kalodata link is the same as on ${idList(shared.kalodata)}.`});
  if (shared.tiktok) flags.push({id: 'tiktok', text: `Its TikTok link is the same as on ${idList(shared.tiktok)}.`});
  if (shared.meta) {
    const words = searchWords(v?.meta?.url);
    flags.push({id: 'meta', text: `Its Meta Ad Library link is the same as on ${idList(shared.meta)}${words ? ` and searches "${words}"` : ''}.`});
  }
  const buyers = candidate?.screen?.checks?.buyers?.source;
  const other = String(buyers || '').match(/\/(L\d{3,})\.md$/)?.[1];
  if (other && other !== (item?.leadId || item?.id)) flags.push({id: 'buyers', text: `Its buyers write-up is saved under ${other}, a different card.`});
  return flags;
}

/** True when this product's trend curve also sits on another product. */
export const trendInDoubt = (item, items) => Boolean(evidenceIndex(items).get(item?.id)?.curve);
