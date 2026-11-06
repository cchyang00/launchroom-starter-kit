// The seven steps every product moves along (owner, October 2, reordered the
// same day: "we should do product research first, then do issues research"):
// Product, Buyers, Prove it, Create, Build, Launch, Learn. One home for the ids,
// names, page addresses and the product-check stages under each step, so the
// step guide, the pipeline, the planner tags and the tools cannot drift apart.
// workflow/CHECKS.md is the method; workflow/the-line.json the owner's guide.
export const STEP_IDS = ['product', 'buyers', 'prove', 'create', 'build', 'launch', 'learn'];
export const STEP_NAMES = ['Product', 'Buyers', 'Prove it', 'Create', 'Build', 'Launch', 'Learn'];
export const STEP_COUNT = STEP_IDS.length;
/** Each step's page address (#/<slug>). Product keeps #/find because #/product/<id> is one product's page. */
export const STEP_SLUGS = {product: 'find', buyers: 'buyers', prove: 'prove', create: 'create', build: 'build', launch: 'launch', learn: 'learn'};
/** Old page addresses that now open a new step (#/validate and #/source were merged into Prove it; #/product is Step 1). */
export const OLD_SLUGS = {validate: 'prove', source: 'prove', products: 'product', product: 'product', buyer: 'buyers'};
/**
 * The issue library (resources/issues/): a reference the Buyers step reads
 * from and adds to, never a step or a gate. #/issues is its page; #/issue (the
 * old Step 1) opens it.
 */
export const ISSUE_LIBRARY_SLUG = 'issues';
export const OLD_LIBRARY_SLUGS = ['issue'];

/**
 * The product check stages (server/domain.mjs) under each step. Product and
 * Buyers have none: the card's six checks and its buyers check are their
 * evidence. Prove it carries the product record's discovery, validation and
 * sourcing checks.
 */
export const STEP_STAGES = [[], [], ['discovery', 'validation', 'sourcing'], ['creative'], ['shopify'], ['testing'], ['learning']];
/** The step a product check stage belongs to (discovery, validation, sourcing: Prove it). */
export const stepOfStage = stage => STEP_STAGES.findIndex(list => list.includes(stage));
/** Step index from a product check stage index (server/domain.mjs STAGES order). */
export const lineIndexOfStage = index => index < 3 ? 2 : index;

/** The six-step ids and words saved before October 2, and what they are now (the old Step 1 "issue" is Buyers' research). */
export const LEGACY_STEPS = {issue: 'buyers', issues: 'buyers', buyer: 'buyers', discovery: 'product', find: 'product', validation: 'prove', validate: 'prove', sourcing: 'prove', source: 'prove', creative: 'create', shopify: 'build', testing: 'launch', 'prove-it': 'prove', learning: 'learn'};

/**
 * A step id from an id, a name, an old six-step id or word, or a number
 * ("product", "Prove it", "validate", "issue", "3"). Returns '' for none/empty and null
 * when the word is not a step.
 */
export function stepId(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key || key === 'none') return '';
  if (STEP_IDS.includes(key)) return key;
  const byName = STEP_NAMES.findIndex(name => name.toLowerCase() === key);
  if (byName >= 0) return STEP_IDS[byName];
  if (LEGACY_STEPS[key]) return LEGACY_STEPS[key];
  if (/^[1-7]$/.test(key)) return STEP_IDS[Number(key) - 1];
  return null;
}
/** A saved list of step ids (tools, tasks) in the new ids, old ones mapped, unknown ones dropped, in line order. */
export function normalizeSteps(list = []) {
  const ids = new Set((Array.isArray(list) ? list : []).map(stepId).filter(Boolean));
  return STEP_IDS.filter(id => ids.has(id));
}
export const stepName = id => STEP_NAMES[STEP_IDS.indexOf(stepId(id) || '')] || '';
