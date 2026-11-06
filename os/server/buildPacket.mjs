import { CHECKS, assertRevision, evidenceSource, fail, object, safeRelative, text } from './domain.mjs';
import { RESEARCH_GATES, screenReady } from './research.mjs';
import { researchIdentityBinding } from './productResearch.mjs';

export const BUILD_SECTIONS = [
  { id: 'buyer', title: 'Buyer evidence', description: 'Actual buyer situations, attraction, objections and evidence limits.' },
  { id: 'offer', title: 'Exact offer', description: 'Country, variant, included parts, price, delivery and unresolved supplier checks.' },
  { id: 'copy', title: 'Supported copy', description: 'Viral video reveal hooks ("You have to get this...") combined with our offer, benefits, objections and verified buyer review context.' },
  { id: 'ads', title: 'Ad plan', description: 'Harvested top viral creator hooks & captions + our offer across Track A (15–20+ MP4 videos) or Track B (testimonial native ads + videos).' },
  { id: 'images', title: 'Image production brief', description: 'Product references, required slots, generation instructions and QC criteria.' },
  { id: 'page', title: 'Store page section plan', description: 'Purchase-to-footer section order, copy, media slots and reference layouts.' },
  { id: 'assets', title: 'Approved asset manifest', description: 'Final product asset files plus slot mapping, exact-variant QC and rights evidence.' },
];
const sectionIds = BUILD_SECTIONS.map(s => s.id);
const preparationIds = sectionIds.filter(id => id !== 'assets');
const blankSection = id => ({ id, content: '', source: '', observedAt: '', status: 'draft', ...(id === 'assets' ? { files: [] } : {}) });
const emptySectionMap = () => Object.fromEntries(sectionIds.map(id => [id, blankSection(id)]));

// Match the country choices in src/ui.jsx without importing React into the API.
// Only explicit country aliases are equivalent; empty/unknown regions never bind.
const countryAliases = new Map([
  ['US', 'United States', 'USA', 'U.S.', 'U.S.A.', 'United States of America'],
  ['GB', 'United Kingdom', 'UK', 'U.K.'], ['CA', 'Canada'], ['AU', 'Australia'],
  ['NZ', 'New Zealand'], ['DE', 'Germany'], ['FR', 'France'], ['IE', 'Ireland'],
  ['NL', 'Netherlands'], ['ES', 'Spain'], ['IT', 'Italy'], ['SE', 'Sweden'],
].flatMap(([code, ...names]) => [code, ...names].map(name => [name.toLowerCase(), code])));
export function buildCountryCode(country) {
  return typeof country === 'string' ? countryAliases.get(country.trim().toLowerCase().replace(/\s+/g, ' ')) ?? null : null;
}
export function sameBuildCountry(left, right) {
  const code = buildCountryCode(left);
  return code !== null && code === buildCountryCode(right);
}

export function buildMarket(product, marketId) {
  if (typeof marketId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(marketId)) fail('Use a safe market ID belonging to this product.', 'UNSAFE_PATH');
  safeRelative(`products/${product.id}/build/${marketId}/packet.json`);
  const market = product.markets.find(m => m.id === marketId);
  if (!market) fail('Select a market belonging to this product.', 'MARKET_NOT_FOUND', 404);
  return market;
}
export function buildPaths(productId, marketId) {
  const base = `products/${productId}/build/${marketId}`;
  return { packet: safeRelative(`${base}/packet.json`), atlasResearch: safeRelative(`${base}/ATLAS-RESEARCH.md`), buildPacket: safeRelative(`${base}/BUILD-PACKET.md`) };
}
export function emptyBuildPacket(product, market) {
  return { revision: 0, productId: product.id, marketId: market.id, candidateId: null, bindingSource: '', sourceRevision: null, researchRevision: null, sections: emptySectionMap(), updatedAt: null };
}
function sectionValue(value, productId) {
  object(value, 'Build section');
  if (!sectionIds.includes(value.id)) fail('Unknown build section.');
  if (!['draft', 'reviewed'].includes(value.status)) fail('Build section status must be draft or reviewed.');
  const required = value.status === 'reviewed';
  const section = { id: value.id, status: value.status, content: text(value.content, 'Section content', { required, max: 12000 }), source: text(value.source, 'Section source', { required, max: 3000 }), observedAt: text(value.observedAt, 'Section observation date', { required, max: 10 }) };
  if (value.id === 'assets') {
    const files = value.files ?? [];
    if (!Array.isArray(files) || files.length > 40) fail('List at most 40 final product asset files.');
    section.files = files.map(file => {
      const path = safeRelative(file);
      if (!path.startsWith(`products/${productId}/assets/`) || !/\.(?:png|jpe?g|webp|avif|gif|mp4|webm)$/i.test(path)) fail('Final asset files must be image or video files in this product’s Assets folder.', 'UNSAFE_PATH');
      return path;
    });
    if (new Set(section.files).size !== section.files.length) fail('Final asset files must not be duplicated.');
    if (required && !section.files.length) fail('Reviewed assets require at least one final product asset file.');
  }
  if (section.source) section.source = evidenceSource(section.source);
  if (section.observedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(section.observedAt) || !Number.isFinite(Date.parse(section.observedAt)) || new Date(section.observedAt).toISOString().slice(0, 10) !== section.observedAt || section.observedAt > new Date().toISOString().slice(0, 10))) fail('Use a real non-future YYYY-MM-DD observation date.');
  return section;
}
export function validateBuildPacket(packet, product, market) {
  object(packet, 'Build packet');
  if (packet.productId !== product.id || packet.marketId !== market.id || !Number.isInteger(packet.revision) || packet.revision < 0) fail('Invalid build packet identity or revision.');
  if (packet.candidateId !== null && !/^L\d{3,}$/.test(packet.candidateId)) fail('Invalid bound research candidate.');
  if (packet.candidateId) evidenceSource(packet.bindingSource); else if (packet.bindingSource !== '') fail('Unbound packet cannot retain a binding source.');
  for (const key of ['sourceRevision', 'researchRevision']) if (packet[key] !== null && (!Number.isInteger(packet[key]) || packet[key] < 0)) fail('Invalid build source revision.');
  if (packet.updatedAt !== null && (typeof packet.updatedAt !== 'string' || !Number.isFinite(Date.parse(packet.updatedAt)) || new Date(packet.updatedAt).toISOString() !== packet.updatedAt)) fail('Invalid build update date.');
  object(packet.sections, 'Build sections');
  if (Object.keys(packet.sections).length !== sectionIds.length || Object.keys(packet.sections).some(id => !sectionIds.includes(id))) fail('Build packet requires exactly seven known sections.');
  for (const id of sectionIds) { if (packet.sections[id]?.id !== id) fail('Build section identity mismatch.'); sectionValue(packet.sections[id], product.id); }
  return packet;
}
export function updateBuildPacket(current, input, product, market, research) {
  object(input); assertRevision(current.revision, input.revision);
  if (input.marketId !== undefined && input.marketId !== market.id) fail('Request market must match the selected market.', 'MARKET_MISMATCH');
  if (input.revalidate !== undefined && typeof input.revalidate !== 'boolean') fail('revalidate must be boolean.');
  const next = structuredClone(current);
  if (input.candidateId !== undefined) {
    if (input.candidateId !== null) {
      const candidate = research.candidates.find(c => c.id === input.candidateId);
      if (!candidate) fail('Select an existing research candidate.', 'CANDIDATE_NOT_FOUND', 404);
      if (!sameBuildCountry(candidate.country, market.country)) fail('Research candidate must match a recognized country for this product market.', 'COUNTRY_MISMATCH');
      next.bindingSource = evidenceSource(input.bindingSource);
    } else next.bindingSource = '';
    if (next.candidateId !== input.candidateId || next.bindingSource !== current.bindingSource) {
      for (const section of Object.values(next.sections)) section.status = 'draft';
      next.sourceRevision = product.revision; next.researchRevision = research.revision;
    }
    next.candidateId = input.candidateId;
  } else if (input.bindingSource !== undefined) fail('Set candidateId alongside its binding source.');
  if (input.section !== undefined) { const section = sectionValue(input.section, product.id); next.sections[section.id] = section; }
  if (input.revalidate === true) {
    const candidate = research.candidates.find(c => c.id === next.candidateId);
    if (!candidate || !sameBuildCountry(candidate.country, market.country)) fail('Revalidation requires a bound candidate in the current country.', 'COUNTRY_MISMATCH');
    const identity = researchIdentityBinding(product, market, candidate);
    if (!identity.ready) fail(identity.reason, identity.code, 409);
    next.sourceRevision = product.revision; next.researchRevision = research.revision;
  }
  if (input.section === undefined && input.candidateId === undefined && input.revalidate !== true) fail('Provide a section, candidate binding or explicit revalidation.');
  next.revision++; next.updatedAt = new Date().toISOString();
  return validateBuildPacket(next, product, market);
}

export function presentBuildPacket(packet, product, market, research, archived = false, missingEvidence = [], invalidAssets = []) {
  const candidate = research.candidates.find(c => c.id === packet.candidateId);
  const bindingValid = Boolean(candidate && sameBuildCountry(candidate.country, market.country) && packet.bindingSource && researchIdentityBinding(product, market, candidate).ready);
  const researchSupported = bindingValid && screenReady(candidate) && !candidate.missingEvidence?.gates?.length && RESEARCH_GATES.every(id => candidate.gates[id]?.status === 'supported');
  const ownerSelected = bindingValid && research.selectedId === candidate.id;
  const revisionsCurrent = packet.sourceRevision === product.revision && packet.researchRevision === research.revision;
  const missingSections = preparationIds.filter(id => packet.sections[id].status !== 'reviewed');
  const marketBlocked = ['parked', 'rejected'].includes(market.status);
  const blockers = [];
  if (archived) blockers.push('Product cycle is archived.');
  if (marketBlocked) blockers.push(`Product market is ${market.status}; resolve its canonical decision before preparation is ready.`);
  if (missingEvidence.length) blockers.push(`Local reviewed evidence is unavailable: ${missingEvidence.join(', ')}.`);
  if (!bindingValid) blockers.push('In Our product → Edit details, link the exact research card and listing for this selling country; bind that same card here with identity mapping evidence.');
  if (!researchSupported) blockers.push('The bound candidate needs a saved owner eye test, seven supported screen checks and all five research gates.');
  if (candidate?.missingEvidence?.paths?.length) blockers.push(`Research evidence files are unavailable: ${candidate.missingEvidence.paths.join(', ')}.`);
  if (!ownerSelected) blockers.push('Owner selection of the bound research candidate is not recorded.');
  if (!revisionsCurrent) blockers.push('Product or research context is unreviewed or has changed; review the scope and explicitly revalidate.');
  if (missingSections.length) blockers.push(`Review preparation sections: ${missingSections.join(', ')}.`);
  const briefReady = blockers.length === 0;
  const assetFiles = packet.sections.assets.files || [];
  const assetsReviewed = packet.sections.assets.status === 'reviewed' && assetFiles.length > 0 && !assetFiles.some(file => missingEvidence.includes(file) || invalidAssets.includes(file));
  const atlasBlockers = [...blockers, ...(invalidAssets.length ? [`Final asset content does not match its file type: ${invalidAssets.join(', ')}.`] : []), ...(!assetsReviewed ? ['Review the final asset manifest and list existing QC-passed files from this product’s Assets folder, with exact-variant and rights evidence.'] : [])];
  const productChecks = Object.fromEntries(CHECKS.map(check => [check.id, structuredClone(market.checks[check.id] || { status: 'pending' })]));
  const readiness = { assetFileChecksSupported: true, bindingValid, researchSupported, ownerSelected, revisionsCurrent, briefReady, assetsReviewed, atlasReady: briefReady && assetsReviewed, archived, marketBlocked, marketStatus: market.status, missingSections, missingEvidence, invalidAssets, blockers, atlasBlockers, productChecks, currentSourceRevision: product.revision, currentResearchRevision: research.revision };
  const paths = buildPaths(product.id, market.id);
  const scope = `# DRAFT — ${product.name}\n\nProduct: ${product.id}\nMarket: ${market.id} / ${market.country}\nVariant: ${product.variant || 'Unspecified'}\nAngle: ${market.angle || 'Unspecified'}\nOffer: ${market.offer || 'Unspecified'}\nResearch candidate: ${packet.candidateId || 'Unbound'}\nIdentity evidence: ${packet.bindingSource || 'Missing'}\n\nPacket revision: ${packet.revision}; reviewed product/research revisions: ${packet.sourceRevision ?? 'none'}/${packet.researchRevision ?? 'none'}; current: ${product.revision}/${research.revision}.\n\nBrief reviewed for preparation: ${briefReady ? 'yes' : 'no'}. Asset handoff reviewed: ${readiness.atlasReady ? 'yes' : 'no'}. These are local preparation states, not launch, upload, purchase, supplier, rights verification by the software, or spending authority.\n\n## Current blockers\n\n${atlasBlockers.length ? atlasBlockers.map(b => `- ${b}`).join('\n') : '- No packet-review blockers at this snapshot. Canonical source/sample, delivery, launch and authority checks still apply.'}\n\n## Context limits\n\nGenerated snapshot; always GET the build-packet API again before use. Later product/research edits invalidate readiness without rewriting this file. A reviewer attests source identity and section content; the app does not authenticate those claims. Do not include credentials, private customer data, invented claims, synthetic testimonials or unsupported delivery promises. No external calls or Atlas upload were performed. ${revisionsCurrent ? 'Reviewed sections below are reviewer-attested content for the current scope; DRAFT sections remain unapproved working material.' : 'Scope is stale or unreviewed; all content requires contextual review before use, even where a prior section review is retained.'}\n\nCanonical record: products/${product.id}/os-product.json\nResearch: research/comparison.json\nPacket: ${paths.packet}\n\n## Canonical product checks (separate from preparation)\n\n${Object.entries(market.checks).map(([id, check]) => `- ${id}: ${check.status}`).join('\n') || '- No verified checks recorded.'}\n`;
  const render = ids => scope + ids.map(id => { const section = packet.sections[id]; const definition = BUILD_SECTIONS.find(s => s.id === id); const files = id === 'assets' ? `\nFinal local files:\n${(section.files || []).map(file => `- ${file}`).join('\n') || '- None listed'}\n` : ''; return `\n## ${definition.title} — ${section.status === 'reviewed' ? 'REVIEWED CONTENT (scope freshness above)' : 'DRAFT / UNREVIEWED'}\n\nSource: ${section.source || 'Missing'}\nObserved: ${section.observedAt || 'Missing'}\n${files}\n${section.content || 'Not prepared.'}\n`; }).join('');
  return { packet, sectionDefinitions: BUILD_SECTIONS, readiness, exports: { atlasResearch: { path: paths.atlasResearch, content: render(['buyer', 'offer', 'copy', 'ads', 'images', 'page']) }, buildPacket: { path: paths.buildPacket, content: render(sectionIds) } } };
}

