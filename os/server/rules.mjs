// The starting rules (owner, Oct 2): the numbers the money line, the test
// sheet and the Learn step use, in one revision-checked file the Settings page
// can edit: os/data/rules.json. Each rule says whose number it is: `by: owner`
// (the owner's choice, such as the $50 first-test loss limit and the 3x kill
// line) or `by: starting` (a practitioner's rule of thumb from the research,
// never a promise). Nothing here spends, publishes or decides; later jobs read
// GET /api/rules (and `os.mjs rules`). Tested in server/rules.test.mjs.
import {fail} from './domain.mjs';

export const RULES_PATH = 'os/data/rules.json';
export const RULE_GROUPS = ['product', 'prove', 'create', 'launch', 'learn'];
export const RULE_GROUP_NAMES = {product: 'Product · the Step 1 checks', prove: 'Prove it · the money line', create: 'Create', launch: 'Launch · the test sheet', learn: 'Learn · kill, trim, keep, scale'};
const RULE_ID = /^[a-z][A-Za-z0-9]{1,40}$/;
const RULE_FIELDS = new Set(['id', 'group', 'label', 'value', 'max', 'unit', 'by', 'whose', 'note', 'setAt']);
const plain = (value, label, max, required = true) => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) fail(`${label} must be text of at most ${max} characters.`);
  return value.trim();
};
const number = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) fail(`${label} must be a number from 0 to 1,000,000.`);
  return value;
};

/**
 * The starting rules for a project with no os/data/rules.json yet (revision 0;
 * the first save writes the file). Merrivy's saved file starts from the same
 * list (owner, Oct 2: the $50 first-test loss limit and the 3x kill line).
 */
export const DEFAULT_RULES = [
  {
    "id": "statsMinPoints",
    "group": "product",
    "label": "Statistics: dated points at least",
    "value": 2,
    "unit": "points in time",
    "by": "owner",
    "whose": "Owner, October 2: \"you have to bring in their statistics\"; two points show rising, stable or falling",
    "note": "Launchroom checks this on every card (os/src/researchView.mjs STATS_MIN_POINTS); ask the OS builder before changing it."
  },
  {
    "id": "trendBandPercent",
    "group": "product",
    "label": "Statistics: rising or falling beyond",
    "value": 15,
    "unit": "percent between the oldest and newest point",
    "by": "starting",
    "whose": "Launchroom's own rule (ours), not from the research",
    "note": "Inside the band the trend reads as stable. Checked in code (TREND_BAND_PERCENT); ask the OS builder before changing it."
  },
  {
    "id": "avatarsMinimum",
    "group": "product",
    "label": "Angles and avatars to target",
    "value": 3,
    "unit": "avatars or angles",
    "by": "owner",
    "whose": "Owner, October 2: \"various different angles and avatars to target\"",
    "note": "The main audience plus two others (AVATARS_MINIMUM in code)."
  },
  {
    "id": "maxWeightLb",
    "group": "product",
    "label": "Dropshippable: heavier than this fails",
    "value": 2,
    "unit": "lb",
    "by": "owner",
    "whose": "Owner, October 2: heavy or bulky items (over about 2 lb or oversized) fail F2",
    "note": ""
  },
  {
    "id": "firstTestLossLimit",
    "group": "launch",
    "label": "First test loss limit",
    "value": 50,
    "unit": "usd",
    "by": "owner",
    "whose": "Owner, October 2 (memory/JOURNAL.md)",
    "note": "The most the first test may spend before we decide. It buys a signal, not a verdict."
  },
  {
    "id": "conceptsPerTest",
    "group": "launch",
    "label": "Concepts per test",
    "value": 3,
    "max": 5,
    "unit": "concepts",
    "by": "starting",
    "whose": "Gemini (Dara Denney), research A and C: 3-5 distinct concepts",
    "note": "Start at the low end when the loss limit is small."
  },
  {
    "id": "formatsPerConcept",
    "group": "create",
    "label": "Formats per concept",
    "value": 2,
    "max": 3,
    "unit": "formats",
    "by": "starting",
    "whose": "Gemini: ad families, 3-5 concepts x 2-3 formats",
    "note": ""
  },
  {
    "id": "noEditHours",
    "group": "launch",
    "label": "No edits after launch",
    "value": 72,
    "unit": "hours",
    "by": "starting",
    "whose": "Gemini (72-120 h), Adenslab in research C (72 h)",
    "note": ""
  },
  {
    "id": "targetCpaPercent",
    "group": "prove",
    "label": "Target cost per sale",
    "value": 55,
    "unit": "percent of bundle order value",
    "by": "starting",
    "whose": "Gemini (Baker): target cost per sale at or below about 55% of bundle order value",
    "note": "Use the lower of this and break-even."
  },
  {
    "id": "breakEvenFlag",
    "group": "prove",
    "label": "Flag a break-even under",
    "value": 20,
    "unit": "usd",
    "by": "starting",
    "whose": "Ours (CHECKS S4): Meta sales in home categories often cost $20-75; Adenslab in research C: $25-50",
    "note": ""
  },
  {
    "id": "killMultiple",
    "group": "learn",
    "label": "Kill an ad",
    "value": 3,
    "unit": "x target cost per sale spent, no sale",
    "by": "owner",
    "whose": "Owner, October 2: the patient kill line (Coinis in research A; Gemini says 2x)",
    "note": "\"Probably have to be more patient due to the algorithm.\""
  },
  {
    "id": "trimSpendMultiple",
    "group": "learn",
    "label": "Trim: spend reached",
    "value": 2,
    "unit": "x target cost per sale",
    "by": "starting",
    "whose": "Gemini",
    "note": "Together with the next rule."
  },
  {
    "id": "trimCpaMultiple",
    "group": "learn",
    "label": "Trim: cost per sale over",
    "value": 1.5,
    "unit": "x target",
    "by": "starting",
    "whose": "Gemini",
    "note": ""
  },
  {
    "id": "trimExtraHours",
    "group": "learn",
    "label": "Trim: extra time before deciding",
    "value": 48,
    "unit": "hours",
    "by": "starting",
    "whose": "Gemini: 24-48 h",
    "note": ""
  },
  {
    "id": "conceptKillAds",
    "group": "learn",
    "label": "Kill a concept when this many of its ads hit the kill line",
    "value": 2,
    "unit": "ads",
    "by": "starting",
    "whose": "Gemini: 2 of 4 ads",
    "note": ""
  },
  {
    "id": "scaleHoldHours",
    "group": "learn",
    "label": "Scale: holds the target for",
    "value": 72,
    "unit": "hours",
    "by": "starting",
    "whose": "Gemini",
    "note": ""
  },
  {
    "id": "scalePercent",
    "group": "learn",
    "label": "Scale: budget step, at most",
    "value": 20,
    "unit": "percent",
    "by": "starting",
    "whose": "Gemini, Adenslab and RoasPig in research C; Meta's learning resets above about 20-25% (second-hand)",
    "note": ""
  },
  {
    "id": "scaleEveryHours",
    "group": "learn",
    "label": "Scale: at most once every",
    "value": 48,
    "unit": "hours",
    "by": "starting",
    "whose": "Gemini: 24-48 h; Adenslab: 2-3 days",
    "note": ""
  },
  {
    "id": "earlyImpressions",
    "group": "learn",
    "label": "Early signals: judge after",
    "value": 3000,
    "unit": "impressions",
    "by": "starting",
    "whose": "RoasPig in research C",
    "note": "A small budget is judged by early signals (owner, October 2)."
  },
  {
    "id": "ctrFloorPercent",
    "group": "learn",
    "label": "Early signals: weak click rate under",
    "value": 1,
    "unit": "percent",
    "by": "starting",
    "whose": "Howland in research B (under 1%); Adenslab average 1.49% in research C",
    "note": "Weak click rate points at the picture or hook."
  },
  {
    "id": "clicksNoSale",
    "group": "learn",
    "label": "Early signals: link clicks with no purchase",
    "value": 30,
    "unit": "clicks",
    "by": "starting",
    "whose": "RoasPig in research C ($50 spent, 30+ link clicks, no purchase)",
    "note": "Points at the page or the offer."
  }
];
/** What never becomes a card (owner, Oct 2: Step 2 · F2 Dropshippable and the hard limits). */
export const DEFAULT_HARD_LIMITS = [
  {
    "id": "audio",
    "label": "Earbuds, headphones and Bluetooth audio",
    "by": "owner",
    "whose": "Owner, October 2: \"earbuds arent something we can dropship\""
  },
  {
    "id": "app-electronics",
    "label": "Complex or app-paired electronics",
    "by": "owner",
    "whose": "Owner, October 2"
  },
  {
    "id": "branded",
    "label": "Branded or patented items",
    "by": "owner",
    "whose": "Owner, October 2"
  },
  {
    "id": "fragile",
    "label": "Fragile items",
    "by": "owner",
    "whose": "Owner, October 2"
  },
  {
    "id": "heavy",
    "label": "Heavy or bulky items (over about 2 lb or oversized)",
    "by": "owner",
    "whose": "Owner, October 2"
  },
  {
    "id": "sized",
    "label": "High-return sized items",
    "by": "owner",
    "whose": "Owner, October 2"
  },
  {
    "id": "battery",
    "label": "Battery-core products",
    "by": "owner",
    "whose": "Owner, October 2"
  },
  {
    "id": "eaten",
    "label": "Anything eaten, drunk or put on skin; liquids and powders",
    "by": "owner",
    "whose": "Owner, October 1 (workflow/CHECKS.md, Hard limits)"
  },
  {
    "id": "medical",
    "label": "Devices that need FDA clearance or claim to treat a condition",
    "by": "starting",
    "whose": "Research, October 1 (resources/research/2026-10-01-product-filter/C-hard-limits-and-tools.md)"
  },
  {
    "id": "restricted",
    "label": "Weapons, adult, children's and baby products, loose magnets, power banks, recalled items and lookalikes",
    "by": "starting",
    "whose": "Research, October 1 (C-hard-limits-and-tools.md)"
  }
];
export const emptyRules = () => ({revision: 0, updatedAt: '', rules: structuredClone(DEFAULT_RULES), hardLimits: structuredClone(DEFAULT_HARD_LIMITS)});

/** One rule, checked field by field. Unknown fields are refused. */
export function validateRule(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('A rule must be an object.');
  for (const key of Object.keys(raw)) if (!RULE_FIELDS.has(key)) fail(`A rule has no field "${key}".`);
  if (typeof raw.id !== 'string' || !RULE_ID.test(raw.id)) fail('A rule needs an id like killMultiple.');
  if (!RULE_GROUPS.includes(raw.group)) fail(`Rule ${raw.id}: group must be one of ${RULE_GROUPS.join(', ')}.`);
  if (!['owner', 'starting'].includes(raw.by)) fail(`Rule ${raw.id}: "by" must be owner or starting.`);
  const rule = {id: raw.id, group: raw.group, label: plain(raw.label, `Rule ${raw.id} label`, 120), value: number(raw.value, `Rule ${raw.id} value`), unit: plain(raw.unit, `Rule ${raw.id} unit`, 80), by: raw.by, whose: plain(raw.whose, `Rule ${raw.id} whose`, 300), note: plain(raw.note, `Rule ${raw.id} note`, 300, false)};
  if (raw.max !== undefined) { rule.max = number(raw.max, `Rule ${raw.id} max`); if (rule.max < rule.value) fail(`Rule ${raw.id}: max is below the value.`); }
  if (raw.setAt !== undefined) { if (typeof raw.setAt !== 'string' || !Number.isFinite(Date.parse(raw.setAt))) fail(`Rule ${raw.id}: setAt must be a date.`); rule.setAt = raw.setAt; }
  return rule;
}

/** The saved rules record: a revision, an update time and unique rules. */
export function validateRules(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`The rules record (${RULES_PATH}) must be an object.`, 'MALFORMED_DATA', 500);
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.rules) || raw.rules.length > 100) fail(`The rules record (${RULES_PATH}) needs a revision and at most 100 rules.`, 'MALFORMED_DATA', 500);
  const seen = new Set();
  const rules = raw.rules.map(item => {
    let rule;
    try { rule = validateRule(item); } catch (error) { fail(`The rules record (${RULES_PATH}): ${error.message}`, 'MALFORMED_DATA', 500); }
    if (seen.has(rule.id)) fail(`The rules record (${RULES_PATH}) lists ${rule.id} twice.`, 'MALFORMED_DATA', 500);
    seen.add(rule.id);
    return rule;
  });
  if (raw.hardLimits !== undefined && (!Array.isArray(raw.hardLimits) || raw.hardLimits.length > 50)) fail(`The rules record (${RULES_PATH}) lists at most 50 hard limits.`, 'MALFORMED_DATA', 500);
  const limits = new Set();
  const hardLimits = (raw.hardLimits ?? DEFAULT_HARD_LIMITS).map(item => {
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item)) fail('a hard limit must be an object.');
      for (const key of Object.keys(item)) if (!['id', 'label', 'by', 'whose'].includes(key)) fail(`a hard limit has no field "${key}".`);
      if (typeof item.id !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(item.id) || limits.has(item.id)) fail('a hard limit needs a unique id like audio.');
      if (!['owner', 'starting'].includes(item.by)) fail(`hard limit ${item.id}: "by" must be owner or starting.`);
      limits.add(item.id);
      return {id: item.id, label: plain(item.label, `Hard limit ${item.id} label`, 200), by: item.by, whose: plain(item.whose, `Hard limit ${item.id} whose`, 300)};
    } catch (error) { fail(`The rules record (${RULES_PATH}): ${error.message}`, 'MALFORMED_DATA', 500); }
  });
  return {revision: raw.revision, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '', rules, hardLimits};
}

/**
 * Change rule values (the Settings page): `changes` is {id: {value, max?}}.
 * Only the number moves; the label, unit and source stay. A changed rule
 * becomes the owner's (`by: owner`, `setAt`). The revision must match.
 */
export function updateRules(record, input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Send the revision and the rules to change.');
  if (input.revision !== record.revision) fail('The rules changed since you opened them. Reload and try again.', 'REVISION_CONFLICT', 409);
  const changes = input.changes;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length) fail('Name at least one rule to change.');
  const byId = new Map(record.rules.map(rule => [rule.id, rule]));
  const at = now.toISOString();
  for (const [id, change] of Object.entries(changes)) {
    const rule = byId.get(id);
    if (!rule) fail(`No rule ${id}.`, 'NOT_FOUND', 404);
    if (!change || typeof change !== 'object' || Array.isArray(change)) fail(`Rule ${id}: send {value}.`);
    for (const key of Object.keys(change)) if (!['value', 'max'].includes(key)) fail(`Rule ${id}: only value and max can change here.`);
    byId.set(id, validateRule({...rule, ...change, by: 'owner', whose: rule.by === 'owner' ? rule.whose : `Owner, changed ${at.slice(0, 10)} (was ${rule.value}: ${rule.whose})`.slice(0, 300), setAt: at}));
  }
  return {revision: record.revision + 1, updatedAt: at, rules: record.rules.map(rule => byId.get(rule.id)), hardLimits: record.hardLimits || structuredClone(DEFAULT_HARD_LIMITS)};
}

/** A rule's value by id (null when it is not set). */
export const ruleValue = (record, id) => record?.rules?.find(rule => rule.id === id)?.value ?? null;

/** Plain text for the helper: one line per rule, grouped. */
export function rulesText(record) {
  const lines = [`Starting rules (${RULES_PATH}, revision ${record.revision}). owner = the owner's choice; starting = a rule of thumb from the research.`];
  for (const group of RULE_GROUPS) {
    const rules = record.rules.filter(rule => rule.group === group);
    if (!rules.length) continue;
    lines.push('', RULE_GROUP_NAMES[group]);
    for (const rule of rules) lines.push(`  ${rule.label}: ${rule.value}${rule.max !== undefined ? `-${rule.max}` : ''} ${rule.unit} · ${rule.by} · ${rule.whose}${rule.note ? ` · ${rule.note}` : ''}`);
  }
  if (record.hardLimits?.length) lines.push('', 'Never a card (F2 Dropshippable and the hard limits)', ...record.hardLimits.map(item => `  ${item.label} · ${item.by} · ${item.whose}`));
  return lines.join('\n');
}
