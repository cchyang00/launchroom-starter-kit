import { randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, message, code = 'INVALID_INPUT', details) { super(message); this.status = status; this.code = code; this.details = details; }
}
export const fail = (message, code = 'INVALID_INPUT', status = 400, details) => { throw new ApiError(status, message, code, details); };
export const STAGES = [
  { id: 'discovery', title: 'Discovery', description: 'Identify the exact item and its existing buyer situation.', owner: 'validation' },
  { id: 'validation', title: 'Validation', description: 'Verify trend, community and the destination opportunity.', owner: 'validation' },
  { id: 'sourcing', title: 'Sourcing', description: 'Confirm the variant, delivery route and destination economics.', owner: 'validation' },
  { id: 'creative', title: 'Creative', description: 'Prepare accurate claims and usable product assets.', owner: 'image-generator' },
  { id: 'shopify', title: 'Shopify', description: 'Prepare the offer and verify the actual customer journey.', owner: 'shopify-builder' },
  { id: 'testing', title: 'Testing', description: 'Run only authorized experiments: the test sheet and the go-ahead from the owner.', owner: 'manager' },
  // Step 7 · Learn (October 2): the measured result and the case review moved out of Testing.
  { id: 'learning', title: 'Learning', description: 'Read the measured result, log the decision and save what we learned.', owner: 'manager' },
];
const research = 'agents/validation/WORKFLOW.md';
const downstream = 'workflow/VALIDATION.md';
const launch = 'store/LAUNCH-CHECKLIST.md';
export const CHECKS = [
  ['exact-product', 'discovery', 'Exact product & variant', 'Identify the functional item, mechanism and distinguishing variant; aliases stay together.', research],
  ['buyer-situation', 'discovery', 'What, who, why, when, where', 'Support an existing buyer situation with original evidence, including objections and alternatives.', research],
  ['trend-history', 'discovery', 'Trend onset & product history', 'Separate listing age, earliest product history and recent trend onset; label seasonal returns.', research],
  ['trend-trajectory', 'validation', 'Rising or stable demand', 'Record comparable dated product-level demand and missing days; platform values remain estimates.', research],
  ['community', 'validation', 'Community participation', 'Inspect original discussions, independent use, questions and contrary outcomes; distinguish reused assets.', research],
  ['competition', 'validation', 'Country competition & opening', 'Record current, recent-entry and historical Meta searches, exact competitor domains and Trendtrack match.', research],
  ['country-demand', 'validation', 'Destination buyer evidence', 'Support demand in this selling country and language; discovery-country evidence does not transfer automatically.', research],
  ['exact-source', 'sourcing', 'Exact AliExpress or supplier match', 'Inspect the functional variant on AliExpress or record explicit dated supplier confirmation of the exact specification.', research],
  ['product-safety', 'sourcing', 'Product safety & recalls', 'Record destination-specific category requirements, recall search and exact-SKU documentation where applicable; unresolved requirements remain open.', 'workflow/PLAYBOOK.md'],
  ['destination-route', 'sourcing', 'Destination quote & fulfillment', 'Verify stock, SKU, processing, transit, tracking, duties and damaged/lost-order handling for this country.', downstream],
  // P5 (owner, Oct 3: no samples): the id stays 'sample' so saved records keep their place; it now means claims we can back.
  ['sample', 'sourcing', 'Claims we can back', 'Every page and ad claim is backed by a supplier spec or a pattern in buyers\' reviews of the same item type. No sample is bought.', downstream],
  ['economics', 'sourcing', 'Delivered contribution', 'Record one currency, real quoted costs, base/downside assumptions and feasible target acquisition cost.', downstream],
  ['claims-rights', 'creative', 'Claims, reviews & media rights', 'Verify product claims and usable media rights; preserve review origin and exclude invented Merrivy purchases.', launch],
  ['creative-assets', 'creative', 'Product assets & demonstrations', 'Link approved exact-variant images, usable demonstrations and asset manifests; verify crops and copy.', 'agents/image-generator/AGENTS.md'],
  ['angle-offer', 'creative', 'Country, angle & offer handoff', 'Connect the evidence-backed buyer situation to this country, offer, approved copy and creative.', downstream],
  ['draft-page', 'shopify', 'Accurate Shopify draft', 'Record the Merrivy product/template IDs, variant/SKU mapping, media and country availability; use Ascendify first.', launch],
  ['checkout', 'shopify', 'Customer & fulfillment journey', 'Verify mobile/desktop variant, cart, destination checkout, payment result and handoff; record test-mode limits.', launch],
  ['service-promise', 'shopify', 'Shipment promise & exception response', 'Match public ship/arrival terms to the supplier route; name the ship-by monitor, delay/refund owner and rehearse the exception path.', 'store/SUPPORT-EXCEPTIONS.md'],
  ['tracking', 'shopify', 'Store-specific measurement', 'Verify Merrivy catalog/dataset identity, event values/currency, attribution and duplicate handling.', launch],
  ['experiment-plan', 'testing', 'Scoped experiment plan', 'Record hypothesis, attribution window, target CAC, budget/loss cap, duration and stop/iterate/scale criteria.', downstream],
  ['authorized-test', 'testing', 'Authorized experiment execution', 'Record actual authorization and execution evidence for the exact country/offer/creative. This app cannot spend or launch.', downstream],
  ['result', 'learning', 'Measured commercial result', 'Record our paid/refunded orders, contribution, fulfillment outcomes and repeat observations; separate platform attribution.', downstream],
  ['case-review', 'learning', 'Case capture & review', 'Link the actual product/ad/offer case, measured result, buyer situation, limits and next change; retain contrary outcomes.', 'agents/validation/skills/research-products/references/CASE-LIBRARY.md'],
].map(([id, stage, title, description, sourceDoc]) => ({ id, stage, title, description, sourceDoc }));

export const AGENTS = [
  { id: 'manager', name: 'Manager', description: 'Coordinates assignments, verifies outputs and integrates learning. Overall Shopify lead.', path: 'agents/manager/AGENTS.md', skillPath: 'agents/manager/.agents/skills/merrivy-manager/SKILL.md' },
  { id: 'validation', name: 'Validation', description: 'Exact product, buyer situations, trends, country competition and source checks.', path: 'agents/validation/AGENTS.md', skillPath: 'agents/validation/skills/research-products/SKILL.md' },
  { id: 'image-generator', name: 'Image generator', description: 'Exact-product images, Shopify graphics, Meta static assets and manifests.', path: 'agents/image-generator/AGENTS.md', skillPath: 'agents/image-generator/.agents/skills/merrivy-images/SKILL.md' },
  { id: 'shopify-builder', name: 'Shopify builder', description: 'Assigned store setup, Ascendify assembly, product insertion and journey verification.', path: 'agents/shopify-builder/AGENTS.md', skillPath: 'agents/shopify-builder/.agents/skills/merrivy-shopify/SKILL.md' },
];
export const EVIDENCE_TYPES = ['observed', 'third-party estimate', 'supplier assertion', 'our result'];
export const DOC_ROOTS = ['agents', 'guides', 'workflow', 'store', 'research', 'memory', 'products', 'templates', 'inbox', 'resources'];
export const MEDIA_ROOTS = ['products', 'store/assets', 'resources', 'agents/image-generator', 'agents/validation/references', 'agents/validation/cases', 'agents/validation/skills/research-products/references', 'guides/rippy-club'];
export const MEDIA_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm' };
export const DOC_FILES = [
  'AGENTS.md', 'USER.md', 'MEMORY.md', 'PRODUCT.md', 'DESIGN.md', 'os/README.md', 'os/AGENTS.md', 'os/AGENT-BRIDGE.md',
  // Root routing skills are readable documents, not permission to expose .agents.
  '.agents/skills/merrivy-research-workspace/SKILL.md',
  '.agents/skills/merrivy-creative-workspace/SKILL.md',
  '.agents/skills/merrivy-shopify-workspace/SKILL.md',
];
// Claude Code team agent definitions and skill entry files are readable
// instructions; the rest of .claude (settings, scripts) stays unavailable.
export const TEAM_DOC = /^(?:\.claude\/agents\/[a-z][a-z0-9-]{0,59}\.md|\.claude\/skills\/[a-z][a-z0-9-]{0,59}\/SKILL\.md)$/;
export function object(value, label = 'Request') { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`); return value; }
export function text(value, label, { required = false, max = 12000 } = {}) {
  if (value === undefined || value === null) { if (required) fail(`${label} is required.`); return ''; }
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) fail(`${label} must be text of at most ${max} characters.`);
  const clean = value.trim(); if (required && !clean) fail(`${label} is required.`); return clean;
}
export function sourceUrl(value) {
  const clean = text(value, 'Source URL', { max: 3000 }); if (!clean) return '';
  let url; try { url = new URL(clean); } catch { fail('Source URL must be a valid http or https URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('Source URL must use http or https without credentials.');
  return clean;
}
function sourceLink(value, id) {
  object(value, 'Source link');
  const linkId = text(id, 'Link ID', { required: true, max: 100 });
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(linkId)) fail('Link ID may contain only letters, numbers, underscores and hyphens.');
  return { id: linkId, label: text(value.label, 'Link label', { required: true, max: 120 }), url: sourceUrl(text(value.url, 'Link URL', { required: true, max: 3000 })), note: text(value.note, 'Link note', { max: 3000 }) };
}
export function productLinks(value = []) {
  if (!Array.isArray(value) || value.length > 100) fail('A product can contain at most 100 source links.');
  const links = value.map(link => sourceLink(link, link?.id));
  if (new Set(links.map(link => link.id)).size !== links.length) fail('Product source link IDs must be unique.');
  return links;
}
export function safeRelative(value, { markdown = false } = {}) {
  const clean = text(value, 'Workspace path', { required: true, max: 1000 });
  if (clean.includes('\\') || clean.includes('%') || clean.includes(':') || clean.includes('?') || clean.includes('#') || clean.startsWith('/') || clean.split('/').some(s => !s || /[. ]$/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))) fail('Use a bounded workspace-relative path with forward slashes and no Windows path aliases.', 'UNSAFE_PATH');
  const parts = clean.split('/');
  if ((!DOC_FILES.includes(clean) && !TEAM_DOC.test(clean) && !DOC_ROOTS.includes(parts[0])) || parts.some(p => /^(?:\.env.*|\.git|node_modules|credentials?|secrets?|tokens?|private|sessions?|cookies?|auth)$/i.test(p)) || (markdown && !/\.md$/i.test(clean))) fail('This workspace path is not available in the document reader.', 'UNSAFE_PATH');
  return clean;
}
export function evidenceSource(value) { const clean = text(value, 'Evidence source', { required: true, max: 3000 }); return /^https?:\/\//i.test(clean) ? sourceUrl(clean) : safeRelative(clean); }
export function checkProof(input, market) {
  object(input, 'Check'); const definition = CHECKS.find(c => c.id === input.id); if (!definition) fail('Unknown evidence check.');
  if (!['pending', 'verified', 'blocked'].includes(input.status)) fail('Check status must be pending, verified or blocked.');
  const proof = { status: input.status, note: text(input.note, 'Evidence note'), source: text(input.source, 'Evidence source', { max: 3000 }), evidenceType: text(input.evidenceType, 'Evidence type', { max: 50 }), observedAt: text(input.observedAt, 'Observation date', { max: 40 }), window: text(input.window, 'Measurement window', { max: 300 }), country: market.country, marketId: market.id };
  if (input.country !== undefined && input.country !== market.country) fail('Evidence country must match the selected market.', 'COUNTRY_MISMATCH');
  if (proof.source) evidenceSource(proof.source);
  if (proof.status === 'verified') {
    for (const key of ['note', 'source', 'evidenceType', 'observedAt', 'window']) if (!proof[key]) fail(`Verified evidence requires ${key}.`, 'INCOMPLETE_EVIDENCE');
    if (!EVIDENCE_TYPES.includes(proof.evidenceType)) fail('Verified evidence must be observed, third-party estimate, supplier assertion or our result.', 'INCOMPLETE_EVIDENCE');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(proof.observedAt) ? new Date(`${proof.observedAt}T00:00:00Z`) : null;
    if (!date || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== proof.observedAt || proof.observedAt > new Date().toISOString().slice(0, 10)) fail('Observation date must be a real, non-future YYYY-MM-DD date.');
    if (input.id === 'exact-source') {
      // Owner (CHECKS.md P2): Alibaba or AliExpress is enough to source; CJ only last. An Alibaba or AliExpress listing, or a local record of explicit supplier confirmation.
      let ali = false; try { const url = new URL(proof.source); ali = /(^|\.)(aliexpress\.(com|us)|alibaba\.com)$/.test(url.hostname); } catch { /* local supplier record */ }
      const supplier = proof.evidenceType === 'supplier assertion' && /supplier\s+(?:explicitly\s+)?confirm(?:ed|s|ation)/i.test(proof.note) && !/^https?:/i.test(proof.source);
      if (!ali && !supplier) fail('Exact source requires an Alibaba or AliExpress listing, or a local record of explicit supplier confirmation.', 'EXACT_SOURCE_REQUIRED');
    }
    if (input.id === 'result' && proof.evidenceType !== 'our result') fail('Commercial result requires our result evidence, not external estimates.', 'OWN_RESULT_REQUIRED');
  }
  return proof;
}
const now = () => new Date().toISOString();
const event = (type, note) => ({ id: randomUUID(), at: now(), type, note });
export function newMarket(input) {
  object(input, 'Market');
  return { id: `M-${randomUUID()}`, country: text(input.country, 'Selling country', { required: true, max: 100 }), researchCandidateId: '', angle: text(input.angle, 'Angle', { max: 2000 }), offer: text(input.offer, 'Offer', { max: 2000 }), status: 'active', reason: '', checks: {}, economics: { price: null, productCost: null, shipping: null, fees: null, other: null, adCost: null, currency: 'USD' }, activity: [event('created', 'Market opened; evidence is country-specific.')] };
}
export function createProduct(input, id) {
  object(input); if (input.synthetic) fail('Synthetic examples do not belong in the real product pipeline.');
  return { id, name: text(input.name, 'Product name', { required: true, max: 180 }), variant: text(input.variant, 'Exact variant', { max: 2000 }), discoveryCountry: text(input.discoveryCountry, 'Discovery country', { max: 100 }), sourceUrl: sourceUrl(input.sourceUrl), links: [], createdAt: now(), updatedAt: now(), revision: 1, markets: [newMarket({ country: input.country })], activity: [event('created', 'Real candidate captured; no gate is verified.')] };
}
export function marketProgress(market) {
  const verified = CHECKS.filter(c => market.checks[c.id]?.status === 'verified');
  return { stageId: STAGES.find(s => CHECKS.some(c => c.stage === s.id && market.checks[c.id]?.status !== 'verified'))?.id || 'learning', verifiedCount: verified.length, totalChecks: CHECKS.length };
}
export function presentProduct(product) { return { ...product, links: productLinks(product.links), markets: product.markets.map(m => ({ ...m, ...marketProgress(m) })) }; }
export function assertRevision(actual, proposed, required = true) {
  if (proposed === undefined && !required) return;
  if (!Number.isInteger(proposed)) fail('A numeric revision is required.', 'REVISION_REQUIRED');
  if (actual !== proposed) fail('This record changed. Reload before saving your changes.', 'REVISION_CONFLICT', 409, { currentRevision: actual });
}
function resetChecks(market, stageIds, reason) {
  for (const c of CHECKS.filter(c => stageIds.includes(c.stage))) if (market.checks[c.id]) market.checks[c.id] = { ...market.checks[c.id], status: 'pending', invalidatedFromCountry: market.checks[c.id].country, country: market.country, marketId: market.id, invalidatedAt: now(), invalidationReason: reason };
  if (market.status === 'winner') { market.status = 'active'; market.reason = ''; }
  market.activity.push(event('evidence-reopened', reason));
}
export function updateProduct(existing, input) {
  object(input); assertRevision(existing.revision, input.revision); const product = structuredClone(existing);
  if (input.synthetic !== undefined) fail('Synthetic flags cannot be changed through real product records.');
  product.links = productLinks(product.links);
  if (input.removeLink !== undefined) {
    const id = text(input.removeLink, 'Link ID', { required: true, max: 100 }); const index = product.links.findIndex(link => link.id === id);
    if (index < 0) fail('Source link not found on this product.', 'LINK_NOT_FOUND', 404);
    const [removed] = product.links.splice(index, 1); product.activity.push(event('source-link-removed', `Removed ${removed.label}; evidence decisions are unchanged.`));
  }
  if (input.link !== undefined) {
    object(input.link, 'Source link'); const link = sourceLink(input.link, input.link.id ?? `L-${randomUUID()}`);
    const index = product.links.findIndex(existingLink => existingLink.id === link.id);
    if (index < 0) { if (product.links.length >= 100) fail('A product can contain at most 100 source links.'); product.links.push(link); }
    else product.links[index] = link;
    product.activity.push(event(index < 0 ? 'source-link-added' : 'source-link-updated', `${link.label}; saving a link does not verify its contents.`));
  }
  for (const key of ['name', 'variant', 'discoveryCountry', 'sourceUrl']) if (input[key] !== undefined) {
    const value = key === 'sourceUrl' ? sourceUrl(input[key]) : text(input[key], key, { required: key === 'name', max: key === 'name' ? 180 : key === 'discoveryCountry' ? 100 : 2000 });
    if (value !== product[key]) { product[key] = value; for (const m of product.markets) resetChecks(m, STAGES.map(s => s.id), `${key} changed; verify evidence against the new product scope.`); }
  }
  if (input.newMarket) product.markets.push(newMarket(input.newMarket));
  if (input.market || input.check) {
    const market = product.markets.find(m => m.id === input.marketId); if (!market) fail('Select a market belonging to this product.', 'MARKET_NOT_FOUND', 404);
    if (input.market) {
      object(input.market, 'Market');
      for (const key of ['country', 'researchCandidateId', 'angle', 'offer']) if (input.market[key] !== undefined) {
        const value = text(input.market[key], key, { required: key === 'country', max: key === 'country' ? 100 : 2000 });
        if (key === 'researchCandidateId' && value && !/^L\d{3,}$/.test(value)) fail('Link a saved research card such as L095.', 'INVALID_RESEARCH_BINDING');
        if (market[key] !== value) {
          market[key] = value;
          resetChecks(market, ['country', 'researchCandidateId'].includes(key) ? STAGES.map(s => s.id) : ['validation', 'sourcing', 'creative', 'shopify', 'testing', 'learning'], `${key} changed; prior evidence must be checked for this scope.`);
        }
      }
      if (input.market.economics) {
        object(input.market.economics, 'Economics'); const next = { ...market.economics };
        for (const [key, value] of Object.entries(input.market.economics)) {
          if (!Object.hasOwn(next, key)) fail(`Unknown economics field: ${key}.`);
          if (key === 'currency') { const currency = text(value, 'Currency', { required: true, max: 3 }).toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) fail('Currency must be a three-letter code.'); next.currency = currency; }
          else { if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e10)) fail(`${key} must be a non-negative number or null for unknown.`); next[key] = value; }
        }
        if (JSON.stringify(next) !== JSON.stringify(market.economics)) { market.economics = next; resetChecks(market, ['sourcing', 'shopify', 'testing', 'learning'], 'Economics changed; source costs and downstream decisions require review.'); }
      }
      if (input.market.reason !== undefined) market.reason = text(input.market.reason, 'Decision reason');
      if (input.market.status !== undefined) {
        if (!['active', 'parked', 'rejected', 'winner'].includes(input.market.status)) fail('Unknown market decision.');
        market.status = input.market.status;
      }
    }
    if (input.check) { market.checks[input.check.id] = checkProof(input.check, market); market.activity.push(event('evidence', `${input.check.id}: ${input.check.status}`)); }
    if (['parked', 'rejected'].includes(market.status) && !market.reason) fail('A parked or rejected market requires a reason and next action.');
    if (market.status === 'winner') {
      const missing = CHECKS.filter(c => market.checks[c.id]?.status !== 'verified').map(c => c.id);
      if (missing.length || market.checks.result?.evidenceType !== 'our result') fail('Winner requires every evidence gate and our measured commercial result.', 'WINNER_GATES_INCOMPLETE', 400, { missing });
    }
    market.activity.push(event('updated', 'Market updated.'));
  }
  product.revision += 1; product.updatedAt = now(); product.activity.push(event('updated', `Revision ${product.revision} saved.`)); return product;
}
