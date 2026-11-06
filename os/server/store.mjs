import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeRuns } from '../src/productGates.mjs';
import { ApiError, AGENTS, CHECKS, STAGES, DOC_ROOTS, DOC_FILES, MEDIA_ROOTS, MEDIA_TYPES, assertRevision, checkProof, createProduct, fail, object, presentProduct, productLinks, safeRelative, text, updateProduct, evidenceSource } from './domain.mjs';
import { emptyWorkspace, validateWorkspace, workspaceScope, addWorkspaceNote, patchWorkspaceNote, patchWorkspaceHandoff, appendCycleReview, pickBuildProduct, workspaceMarkdown, workspaceResumeMarkdown, withWorkspaceLock } from './workspace.mjs';
import {emptyResearch,validateResearch,updateResearch,researchSummary,migrateResearch} from './research.mjs';
import {projectProductResearch,researchBinding} from './productResearch.mjs';
import {researchDocument, cardIdentity, cardIssues, upfrontReady} from '../src/researchView.mjs';
import {curationBatchLinks,curationBatchOverview,curationCards} from '../src/curationView.mjs';
import {replaceFile} from './replaceFile.mjs';
import { buildMarket, buildPaths, emptyBuildPacket, validateBuildPacket, updateBuildPacket, presentBuildPacket } from './buildPacket.mjs';
import { mediaFileMatchesExtension } from './mediaSignature.mjs';
import {emptyPlanner, validatePlanner, updatePlanner, movePlannerTasks, deletePlannerTasks, restorePlannerTasks, AGENT_ID, PRODUCT_REF} from './planner.mjs';
import {readTeam} from './team.mjs';
import {memoryContext, memoryProjections, localDay as journalDay} from './memory.mjs';
import {emptyLessons, validateLessons, updateLessons, agentBrief, lessonReview} from './lessons.mjs';
import {reasonTagsMarkdown, OWNER_SAID_ACTIONS, SAID_DECISIONS, quoteProblem, ownerSaidCandidate} from '../src/eyeTest.mjs';
import {emptyLibrary, validateLibrary, updateLibrary, presentLibrary, libraryMarkdown, searchLibrary, closestEntries, cleanMarkdown, noteBody, noteSlug, notePath, noteContent, libraryDay, SEARCH_FILE_MAX} from './library.mjs';
import {deriveTitle, deriveLearned, guessTopics} from '../src/libraryModel.mjs';
import {LINE_PATH, validateLine, currentStep, stepMarkdown, lineMarkdown, briefBlocks, pipelineMarkdown, itemStep, fillPrompt} from '../src/theLine.mjs';
import {ROUNDS_PATH, ROUNDS_DOC, emptyRounds, validateRounds, updateRounds, roundsMarkdown} from './rounds.mjs';
import {readIssues} from './issues.mjs';
import {ISSUE_PICKS_PATH, emptyPicks, validatePicks, updatePicks} from './issuePicks.mjs';
import {issueEntries, issueCounts, testingHint, scoutIssuesMarkdown, researcherIssuesMarkdown} from '../src/issueList.mjs';
import {parseTopics, TOPICS_PATH} from '../src/idleWork.mjs';
import {ISSUES_ROOT, CHECKS_PATH, ISSUE_GATE_MIN} from '../src/issues.mjs';
import {pipelineItems, roundBlockers, primaryMarket, findItem, BUILD_FROM, openBeforeBuild, roundOf, leadPaths, roundFolder} from '../src/pipeline.mjs';
import {PROVE_FILE, PROVE_FILE_MAX, parseProveFile} from '../src/proveAhead.mjs';
import {processState} from '../src/processModel.mjs';
import {TOOLS_PATH, TOOLS_DOC, emptyTools, validateTools, updateTools, presentTools, toolsMarkdown} from './tools.mjs';
import {RULES_PATH, RULE_GROUPS, RULE_GROUP_NAMES, validateRules, updateRules, emptyRules} from './rules.mjs';
import {itemGates} from '../src/gates.mjs';
import {STEP_COUNT} from '../src/steps.mjs';
import {buildLeads} from '../src/workflowView.mjs';
import {createStoreEditor} from './storeEditor.mjs';
import {ownerEditsMarkdown} from '../src/storeEditorModel.mjs';
// Agents whose brief lists the owner's Store editor edits, so they never overwrite one blindly.
const STORE_EDIT_READERS = new Set(['manager', 'store-builder', 'copywriter', 'image-maker']);

const within = (root, file) => file === root || (!path.relative(root, file).startsWith('..') && !path.isAbsolute(path.relative(root, file)));
const productIdPattern = /^P\d{3,}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ACTIVITY_LIMITS = { records: 200, eventsPerRecord: 20, maxBytes: 1_500_000 };
const activityStatuses = ['running', 'completed', 'blocked', 'failed'];
const ACTIVITY_REPORTERS = ['codex', 'claude'];
function activityFields(input, previous = {}) {
  const title = text(input.title ?? previous.title, 'Activity title', { required: true, max: 180 });
  const role = text(input.role ?? previous.role, 'Activity role', { required: true, max: 40 });
  if (!AGENTS.some(agent => agent.id === role)) fail('Unknown activity role.');
  const status = input.status ?? previous.status;
  if (!activityStatuses.includes(status)) fail('Activity status must be running, completed, blocked or failed.');
  const summary = text(input.summary ?? previous.summary, 'Activity summary', { required: true, max: 2000 });
  const incomingReferences = input.references ?? previous.references ?? [];
  if (!Array.isArray(incomingReferences) || incomingReferences.length > 20) fail('Activity references must be an array of at most 20 workspace paths.');
  const references = [...new Set(incomingReferences.map(reference => safeRelative(reference)))];
  // Optional team member within the role (agents/team.json ID), e.g. role validation, agent scout.
  const agent = input.agent ?? previous.agent ?? '';
  if (typeof agent !== 'string' || (agent && !AGENT_ID.test(agent))) fail('Activity agent must be a team agent ID.');
  // Optional product on the pipeline this report is about: a card (L###) or a product (P###).
  const product = input.product ?? previous.product ?? '';
  if (typeof product !== 'string' || (product && !PRODUCT_REF.test(product))) fail('Activity product must be a card id (L###) or a product id (P### or P###-name).');
  return { title, role, status, summary, references, ...(agent ? { agent } : {}), ...(product ? { product } : {}) };
}
function activityId(value) {
  const id = text(value, 'Activity ID', { required: true, max: 100 });
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) fail('Activity ID may contain only letters, numbers, underscores and hyphens.');
  return id;
}
function validTimestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
export function parseChecklist(content) {
  const groups = []; let current;
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) { current = { title: heading[1], items: [] }; groups.push(current); }
    const item = line.match(/^\s*-\s+\[([ xX])\]\s+(?:\*\*([A-Z]\d+)\*\*\s+)?(.+)/);
    if (item) { if (!current) { current = { title: 'Readiness', items: [] }; groups.push(current); } current.items.push({ id: item[2] || `item-${groups.reduce((sum, g) => sum + g.items.length, 0) + 1}`, title: item[3], done: item[1].toLowerCase() === 'x' }); }
  }
  const populated = groups.filter(g => g.items.length); const items = populated.flatMap(g => g.items);
  return { groups: populated, sourcePath: 'store/LAUNCH-CHECKLIST.md', done: items.filter(i => i.done).length, total: items.length };
}
const mdText = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
function productMarkdown(p) {
  const links = productLinks(p.links);
  const linkSection = links.length ? `## Source links\n\nSaved references only; verification is recorded in the evidence checks below.\n\n| Label | URL | Note |\n| --- | --- | --- |\n${links.map(link => `| ${mdText(link.label)} | ${mdText(link.url)} | ${mdText(link.note)} |`).join('\n')}\n\n` : '';
  return `# ${mdText(p.id)} · ${mdText(p.name)}\n\nGenerated by the local Merrivy OS from os-product.json. Edit through the OS; existing dossiers remain authoritative for their own evidence.\n\nRevision: ${p.revision} · Updated: ${p.updatedAt}\n\nVariant: ${mdText(p.variant) || 'Unspecified'}\n\nDiscovery country: ${mdText(p.discoveryCountry) || 'Unknown'}\n\nSource: ${mdText(p.sourceUrl) || 'Not recorded'}\n\n` + linkSection + p.markets.map(m => `## ${mdText(m.country)} · ${m.id}\n\nDecision: ${m.status}\n\nResearch card: ${mdText(m.researchCandidateId) || 'Not linked'}\n\nAngle: ${mdText(m.angle) || 'Not recorded'}\n\nOffer: ${mdText(m.offer) || 'Not recorded'}\n\nReason: ${mdText(m.reason) || 'Not recorded'}\n\nEconomics (${m.economics.currency}): ${Object.entries(m.economics).filter(([k]) => k !== 'currency').map(([k, v]) => `${k}=${v ?? 'unknown'}`).join('; ')}\n\n| Check | Status | Evidence | Source | Type | Date | Window |\n| --- | --- | --- | --- | --- | --- | --- |\n` + CHECKS.map(c => { const e = m.checks[c.id] || {}; return `| ${c.title} | ${e.status || 'pending'} | ${mdText(e.note)} | ${mdText(e.source)} | ${mdText(e.evidenceType)} | ${mdText(e.observedAt)} | ${mdText(e.window)} |`; }).join('\n')).join('\n\n') + '\n';
}
export function createStore({ workspaceRoot, replaceFileImpl = replaceFile }) {
  if (!workspaceRoot) throw new Error('workspaceRoot is required');
  const root = path.resolve(workspaceRoot);
  async function serialized(fn) {
    return withWorkspaceLock(root, fn);
  }
  // Start a product record (createProduct's rules); call only inside serialized().
  async function startProduct(input) {
      object(input);
      let request = input, lead = null;
      if (input.leadId !== undefined) {
        const leadId = text(input.leadId, 'Card id', { required: true, max: 12 });
        if (!/^L\d{3,}$/.test(leadId)) fail('Start a product from a card id such as L095.', 'INVALID_RESEARCH_BINDING');
        lead = (await currentResearch()).candidates.find(candidate => candidate.id === leadId);
        if (!lead) fail(`No card ${leadId} in research/comparison.json.`, 'NOT_FOUND', 404);
        if (lead.screen?.ownerDecision !== 'saved') fail(`Only a card the owner saved for checks can start a product. ${leadId} is ${lead.screen?.ownerDecision === 'passed' ? 'passed' : lead.screen?.ownerDecision === 'rejected' ? 'rejected' : 'not saved yet (the eye test is the owner\'s)'}.`, 'LEAD_NOT_SAVED', 409);
        if (/^\s*(?:PARK|KILL)\b/i.test(lead.decision || '')) fail(`${leadId} is out of the line (its decision says ${lead.decision.trim().split(/\s|:/)[0]}). Reopen the card before starting a product.`, 'LEAD_OUT_OF_LINE', 409);
        const linked = (await products()).find(item => item.markets.some(market => market.researchCandidateId === leadId));
        if (linked) fail(`${leadId} already has a product: ${linked.id}. One product per card.`, 'LEAD_HAS_PRODUCT', 409, { productId: linked.id });
        const identity = cardIdentity(lead);
        const country = text(lead.country || input.country, 'Selling country', { required: true, max: 100 });
        request = { name: input.name || lead.name, variant: input.variant ?? lead.screen?.checks?.sourceMatch?.variant ?? '', discoveryCountry: input.discoveryCountry ?? '', country, sourceUrl: /^https?:\/\//i.test(identity) ? identity : input.sourceUrl ?? '' };
      }
      const entries = await directories('products'); const next = Math.max(0, ...entries.map(e => Number(e.name.match(/^P(\d+)(?:-|$)/)?.[1] || 0))) + 1;
      const name = text(request.name, 'Product name', { required: true, max: 180 }); const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 65).replace(/-$/, '') || 'product';
      const record = createProduct(request, `P${String(next).padStart(3, '0')}-${slug}`);
      if (lead) {
        record.markets[0].researchCandidateId = lead.id;
        const costs = lead.screen?.checks?.contribution?.costs;
        if (costs && typeof costs === 'object' && Number.isFinite(costs.sellPrice)) {
          record.markets[0].economics = {
            price: Number.isFinite(costs.sellPrice) ? costs.sellPrice : null,
            productCost: Number.isFinite(costs.itemCost) ? costs.itemCost : null,
            shipping: Number.isFinite(costs.shippingCost) ? costs.shippingCost : null,
            fees: Number.isFinite(costs.fees) ? costs.fees : null,
            other: Number.isFinite(costs.returnReserve) ? costs.returnReserve : null,
            adCost: Number.isFinite(costs.acquisitionAllowance) ? costs.acquisitionAllowance : null,
            currency: typeof costs.currency === 'string' && /^[A-Z]{3}$/.test(costs.currency) ? costs.currency : 'USD',
          };
        }
        if (!record.markets[0].offer && typeof lead.screen?.checks?.contribution?.note === 'string') {
          record.markets[0].offer = lead.screen.checks.contribution.note.slice(0, 2000);
        }
        record.activity.push({ id: randomUUID(), at: new Date().toISOString(), type: 'started-from-card', note: `Started from card ${lead.id}; its checks are recorded from the card's evidence, nothing is copied as verified.` });
      }
      return saveProduct(record);
  }
  async function bounded(relative, { createParent = false } = {}) {
    const full = path.resolve(root, relative); if (!within(root, full)) fail('Path leaves the workspace.', 'UNSAFE_PATH');
    // Reject junctions/symlinks at every segment, including existing targets. This also
    // stops writes being redirected between the products and OS data directories.
    let current = root;
    for (const segment of path.relative(root, full).split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      try { if ((await fs.lstat(current)).isSymbolicLink()) fail('Linked paths are unavailable to the local OS.', 'UNSAFE_PATH'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (createParent) await fs.mkdir(path.dirname(full), { recursive: true });
    return full;
  }
  async function requireLocalEvidence(source) {
    if (!source || /^https?:\/\//i.test(source)) return;
    let stat;
    try { stat = await fs.stat(await bounded(source)); }
    catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) fail(`Local evidence file does not exist: ${source}`, 'EVIDENCE_NOT_FOUND', 404);
      throw error;
    }
    if (!stat.isFile()) fail(`Local evidence must be a regular file: ${source}`, 'EVIDENCE_NOT_FOUND', 404);
  }
  async function researchWithAvailableEvidence(raw) {
    const batch = structuredClone(raw);
    const checked = new Map();
    async function unavailable(source) {
      if (!source || /^https?:\/\//i.test(source)) return false;
      if (!checked.has(source)) checked.set(source, (async () => {
        try { return !(await fs.stat(await bounded(source))).isFile(); }
        catch (error) {
          if (['ENOENT', 'ENOTDIR', 'UNSAFE_PATH'].includes(error.code)) return true;
          throw error;
        }
      })());
      return checked.get(source);
    }
    for (const candidate of batch.candidates) {
      delete candidate.missingEvidence;
      const screen = [], gates = [], paths = new Set();
      for (const [id, check] of Object.entries(candidate.screen?.checks || {})) {
        if (check.status !== 'pending' && await unavailable(check.source)) { screen.push(id); paths.add(check.source); }
      }
      for (const [id, gate] of Object.entries(candidate.gates)) {
        if (gate.status !== 'pending' && await unavailable(gate.source)) { gates.push(id); paths.add(gate.source); }
      }
      if (paths.size) candidate.missingEvidence = { screen, gates, paths: [...paths] };
    }
    return batch;
  }
  async function currentResearch() {
    return researchWithAvailableEvidence(validateResearch(migrateResearch(await json('research/comparison.json', emptyResearch()))));
  }
  async function read(relative, optional = false) {
    try { const file = await bounded(relative); const stat = await fs.stat(file); const maxBytes = ['research/comparison.json', 'research/COMPARISON.md'].includes(relative) ? 20_000_000 : 2_000_000; if (!stat.isFile() || stat.size > maxBytes) fail(`File is not a readable document under 2 MB: ${relative}`, 'FILE_TOO_LARGE'); return await fs.readFile(file, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT' && optional) return null; if (error.code === 'ENOENT') throw new ApiError(404, `File not found: ${relative}`, 'NOT_FOUND'); throw error; }
  }
  async function json(relative, fallback) {
    const content = await read(relative, true); if (content === null) return structuredClone(fallback);
    try { return JSON.parse(content); } catch { throw new ApiError(500, `Malformed JSON in ${relative}. Restore or repair this record before saving.`, 'MALFORMED_DATA'); }
  }
  async function atomic(relative, content) {
    const target = await bounded(relative, { createParent: true }); const temporary = `${target}.${randomUUID()}.tmp`;
    try { const handle = await fs.open(temporary, 'wx', 0o600); try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); } await replaceFileImpl(temporary, target); }
    finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  async function commitProjections(projections, authoritative, repairCode, repairMessage) {
    const previous = await Promise.all(projections.map(file => read(file.path, true)));
    for (const file of [...projections, authoritative]) await bounded(file.path);
    let written = 0;
    try {
      for (const file of projections) { await atomic(file.path, file.content); written += 1; }
      await atomic(authoritative.path, authoritative.content);
    } catch (error) {
      try {
        for (let index = written - 1; index >= 0; index--) {
          const file = projections[index];
          if (previous[index] === null) await fs.rm(await bounded(file.path), { force: true });
          else await atomic(file.path, previous[index]);
        }
      } catch { throw new ApiError(500, repairMessage, repairCode); }
      throw error;
    }
  }
  async function directories(relative) {
    try { return await fs.readdir(await bounded(relative), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  async function getCuration() {
    const queue = await read('research/CURATION-QUEUE.md', true);
    if (queue === null) return { batches: [], totalCards: 0 };
    const batches = [];
    for (const { label, reference } of curationBatchLinks(queue).slice(0, 8)) {
      const batchPath = safeRelative(path.posix.normalize(path.posix.join('research', reference)), { markdown: true });
      if (!batchPath.startsWith('research/') || !batchPath.endsWith('/BATCH.md')) continue;
      const batchContent = await read(batchPath, true);
      if (batchContent === null) continue;
      const folder = path.posix.dirname(batchPath);
      const cards = new Map(curationCards(batchContent, batchPath).map(card => [card.id, card]));
      for (const entry of await directories(folder)) {
        if (!entry.isFile() || !/^L\d{3,}\.md$/.test(entry.name)) continue;
        const sourcePath = `${folder}/${entry.name}`;
        const detail = await read(sourcePath, true);
        if (detail === null) continue;
        const card = curationCards(detail, sourcePath).find(item => `${item.id}.md` === entry.name);
        if (!card) continue;
        const earlier = cards.get(card.id);
        cards.set(card.id, { ...card, imageReference: earlier?.imageReference || card.imageReference, imageAlt: earlier?.imageAlt || card.imageAlt, imageSourcePath: earlier?.imageReference ? earlier.sourcePath : card.sourcePath, externalUrl: card.externalUrl || earlier?.externalUrl || '' });
      }
      const resolved = [];
      for (const card of cards.values()) {
        const imageSourcePath = card.imageSourcePath || card.sourcePath;
        let imagePath = '';
        if (card.imageReference && !/^(?:https?:|data:|\/)/i.test(card.imageReference)) {
          try {
            const relative = safeRelative(path.posix.normalize(path.posix.join(path.posix.dirname(imageSourcePath), card.imageReference)));
            if (MEDIA_ROOTS.some(prefix => relative.startsWith(`${prefix}/`)) && MEDIA_TYPES[path.extname(relative).toLowerCase()]?.startsWith('image/')) {
              const stat = await fs.stat(await bounded(relative));
              if (stat.isFile() && stat.size <= 25 * 1024 * 1024) imagePath = relative;
            }
          } catch (error) { if (!['UNSAFE_PATH', 'ENOENT', 'ENOTDIR', 'EINVAL'].includes(error.code)) throw error; }
        }
        resolved.push({ id: card.id, name: card.name, heading: card.heading, sourcePath: card.sourcePath, imagePath, imageAlt: card.imageAlt, externalUrl: card.externalUrl, disposition: card.disposition, ownerDecision: card.ownerDecision });
      }
      resolved.sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1)));
      batches.push({ label, path: batchPath, ...curationBatchOverview(batchContent), cards: resolved });
    }
    return { batches, totalCards: batches.reduce((sum, batch) => sum + batch.cards.length, 0) };
  }
  function validateProduct(p, id) {
    try {
      object(p); if (p.id !== id || !productIdPattern.test(p.id) || !Number.isInteger(p.revision) || p.revision < 1 || !Array.isArray(p.markets) || !p.markets.length || !Array.isArray(p.activity)) throw new Error('Invalid product structure.');
      text(p.name, 'Product name', { required: true });
      productLinks(p.links);
      const marketIds = new Set();
      for (const m of p.markets) {
        if (!m.id || marketIds.has(m.id) || !Array.isArray(m.activity) || !['active', 'parked', 'rejected', 'winner'].includes(m.status)) throw new Error('Invalid or duplicate market.');
        marketIds.add(m.id); text(m.country, 'Country', { required: true }); object(m.checks); object(m.economics);
        for (const [checkId, proof] of Object.entries(m.checks)) {
          checkProof({ ...proof, id: checkId }, m);
          if (proof.status === 'verified' && (proof.country !== m.country || proof.marketId !== m.id)) throw new Error('Verified evidence belongs to another market.');
        }
        if (m.status === 'winner' && (CHECKS.some(c => m.checks[c.id]?.status !== 'verified') || m.checks.result.evidenceType !== 'our result')) throw new Error('Winner gates are incomplete.');
      }
    } catch (error) { throw new ApiError(500, `Malformed product record products/${id}/os-product.json: ${error.message}`, 'MALFORMED_DATA'); }
    return p;
  }
  async function products() {
    const entries = await directories('products'); const records = [];
    const research = await currentResearch();
    for (const entry of entries) {
      if (!entry.isDirectory() || !productIdPattern.test(entry.name)) continue;
      const p = await json(`products/${entry.name}/os-product.json`, null); if (!p || p.synthetic === true) continue;
      records.push(projectProductResearch(presentProduct(validateProduct(p, entry.name)), research));
    }
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async function product(id) {
    if (!productIdPattern.test(id)) fail('Unknown product ID.', 'NOT_FOUND', 404);
    const p = await json(`products/${id}/os-product.json`, null); if (!p || p.synthetic === true) fail('Product not found.', 'NOT_FOUND', 404); return validateProduct(p, id);
  }
  async function readWorkspace() {
    const state = await json('os/data/workspace.json', emptyWorkspace());
    try { return validateWorkspace(state); }
    catch (error) { throw new ApiError(500, `Malformed workspace memory in os/data/workspace.json: ${error.message}`, 'MALFORMED_DATA'); }
  }
  async function currentWorkspace(productList) { return workspaceScope(await readWorkspace(), productList || await products()); }
  async function lessonRecords() { return validateLessons(await json('os/data/lessons.json', emptyLessons())); }
  async function libraryRecords() { return validateLibrary(await json('os/data/library.json', emptyLibrary())); }
  async function toolRecords() { return validateTools(await json(TOOLS_PATH, emptyTools())); }
  // Briefs list the tools for the current step. A damaged tool list shows as a
  // repair line (null) instead of blocking every write that restages START-HERE.
  async function briefTools() { try { return await toolRecords(); } catch (error) { if (error.code === 'MALFORMED_DATA') return null; throw error; } }
  async function exists(relative) {
    try { await fs.lstat(await bounded(relative)); return true; }
    catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false; throw error; }
  }
  // Library search reads each catalogued file once and reuses it until the
  // file changes. Files over 400 KB are skipped and the cache is capped.
  const libraryTexts = new Map(); let libraryTextBytes = 0;
  async function libraryText(relative) {
    try {
      const file = await bounded(relative); const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > SEARCH_FILE_MAX) return null;
      const cached = libraryTexts.get(relative);
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
      if (libraryTextBytes - (cached?.size || 0) + stat.size > 40_000_000) return cached || null;
      const clean = cleanMarkdown(await fs.readFile(file, 'utf8'));
      const value = {mtimeMs: stat.mtimeMs, size: stat.size, clean, lower: clean.toLowerCase()};
      libraryTextBytes += stat.size - (cached?.size || 0); libraryTexts.set(relative, value);
      return value;
    } catch (error) { if (['ENOENT', 'ENOTDIR', 'UNSAFE_PATH'].includes(error.code)) return null; throw error; }
  }
  // The step guide is a business file: the app only reads and validates it.
  // A missing or broken guide never blocks other writes; it shows as an error.
  async function lineRecord() {
    let raw;
    try { raw = await read(LINE_PATH, true); }
    catch (error) { if (error instanceof ApiError) return {line: null, error: `The step guide (${LINE_PATH}) could not be read: ${error.message}`}; throw error; }
    if (raw === null) return {line: null, error: `The step guide (${LINE_PATH}) is missing.`};
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return {line: null, error: `The step guide (${LINE_PATH}) is not valid JSON.`}; }
    try { return {line: validateLine(parsed), error: ''}; }
    catch (error) { if (error.code === 'MALFORMED_LINE') return {line: null, error: error.message}; throw error; }
  }
  // Rounds are a business record of their own: a broken file shows as a repair
  // line in the briefs instead of blocking every other write.
  async function roundsRecord() {
    try { return {record: validateRounds(await json(ROUNDS_PATH, emptyRounds())), error: ''}; }
    catch (error) { if (error instanceof ApiError) return {record: null, error: `The rounds record (${ROUNDS_PATH}) needs repair: ${error.message}`}; throw error; }
  }
  async function roundRecords() {
    const {record, error} = await roundsRecord();
    if (!record) throw new ApiError(500, error, 'MALFORMED_DATA');
    return record;
  }
  // Cards in research/comparison.json still count if a batch file cannot be read.
  const safeCuration = () => getCuration().catch(error => { if (error instanceof ApiError) return {batches: []}; throw error; });
  /**
   * The pipeline and the step its focus is on, from saved records only
   * (currentStep in src/theLine.mjs, the same function the screens use). Pass
   * pending records during a write (`rounds` is a whole rounds record).
   */
  async function stepFor({state, productList, research, rounds} = {}) {
    const list = productList || await products();
    const [guide, batch, curation, roundRec, issueFiles, picks] = await Promise.all([lineRecord(), research || currentResearch(), safeCuration(), rounds ? {record: rounds, error: ''} : roundsRecord(), readIssues({workspaceRoot: root}), safePicks()]);
    const ws = state || await currentWorkspace(list);
    const archived = new Set(ws.reviews.map(review => review.productId));
    return currentStep({line: guide.line, lineError: guide.error, stages: STAGES, checks: CHECKS, products: list.filter(item => !archived.has(item.id)), archivedProducts: list.filter(item => archived.has(item.id)), reviews: ws.reviews, buildProductId: ws.buildProductId, leads: buildLeads(batch, curation), issues: issueEntries(issueFiles.issues, {rounds: roundRec.record?.rounds || [], picks: picks.record}), rounds: roundRec.record?.rounds || [], roundsRevision: roundRec.record?.revision ?? null, roundsError: roundRec.error});
  }
  /** A planner task's or report's `product`: a card or product that exists; P### becomes the full P###-name. */
  async function productRef(value) {
    if (!value) return '';
    if (/^L\d{3,}$/.test(value)) {
      if ((await currentResearch()).candidates.some(candidate => candidate.id === value)) return value;
      if ((await safeCuration()).batches.some(batch => batch.cards.some(card => card.id === value))) return value;
      fail(`No card ${value}. Name a card (L###) or a product (P###) that exists.`, 'UNKNOWN_PRODUCT', 404);
    }
    const hit = (await directories('products')).find(entry => entry.isDirectory() && productIdPattern.test(entry.name) && (entry.name === value || entry.name.startsWith(`${value}-`)));
    if (!hit) fail(`No product ${value}. Name a card (L###) or a product (P###) that exists.`, 'UNKNOWN_PRODUCT', 404);
    return hit.name;
  }
  async function memoryInput(input) {
    for(const source of input.references || []) await requireLocalEvidence(source);
    if(input.taskId && !(await json('os/data/planner.json',emptyPlanner())).tasks.some(t=>t.id===input.taskId)) fail('Linked task not found. Refresh the plan.','NOT_FOUND',404);
  }
  async function saveWorkspace(next) {
    const productList = await products(); const scope = workspaceScope(next, productList);
    const saved = { ...scope, revision: next.revision + 1, updatedAt: new Date().toISOString() };
    // Derived fields stay out of the file; activeProductId mirrors the build slot.
    delete saved.conflictingProductIds; delete saved.missingActiveProductId; delete saved.buildProductId;
    saved.build = scope.build || null; saved.activeProductId = saved.build?.productId || null;
    validateWorkspace(saved);
    // Stage both reading projections before the authoritative commit. Restore
    // them if any stage fails so a failed write cannot leave a false handoff.
    const projections = [
      ['memory/WORKSPACE.md', workspaceMarkdown({ ...saved, conflictingProductIds: scope.conflictingProductIds })],
      ['memory/RESUME.md', workspaceResumeMarkdown(saved)],
      ...memoryProjections(saved,validatePlanner(await json('os/data/planner.json',emptyPlanner())),await lessonRecords(),await stepFor({state: scope, productList}),await briefTools()).map(file=>[file.path,file.content]),
    ];
    const prior = await Promise.all(projections.map(async ([relative]) => [relative, await read(relative, true)]));
    try {
      for (const [relative, content] of projections) await atomic(relative, content);
      await atomic('os/data/workspace.json', JSON.stringify(saved, null, 2) + '\n');
    }
    catch (error) {
      try {
        for (const [relative, content] of prior) {
          if (content === null) await fs.rm(await bounded(relative), { force: true });
          else await atomic(relative, content);
        }
      }
      catch { throw new ApiError(500, 'Workspace commit failed. Authoritative records are preserved; generated memory projections need repair.', 'WORKSPACE_PROJECTION_REPAIR'); }
      throw error;
    }
    return workspaceScope(saved, productList);
  }
  async function assertProductEditable(id) {
    const state = await readWorkspace();
    if (state.reviews.some(review => review.productId === id)) fail('This product cycle is archived and read-only. Its files and evidence are preserved.', 'PRODUCT_ARCHIVED', 409);
  }
  async function saveProduct(p) {
    const list = [p, ...(await products()).filter(item => item.id !== p.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const start = '<!-- MERRIVY-OS:START -->'; const end = '<!-- MERRIVY-OS:END -->';
    const index = await read('products/INDEX.md', true) ?? '# Product branches\n';
    const section = `${start}\n## Products recorded in the local OS\n\nThis generated section lists real OS candidates. Older manual statements above retain their original observation scope.\n\n| ID and record | Product | Countries and decisions | Updated |\n| --- | --- | --- | --- |\n${list.filter(x => !x.synthetic).map(x => `| [${x.id}](${x.id}/OS.md) | ${mdText(x.name)} | ${x.markets.map(m => `${mdText(m.country)}: ${m.status}`).join('; ')} | ${x.updatedAt.slice(0, 10)} |`).join('\n')}\n${end}`;
    const left = index.indexOf(start); const right = index.indexOf(end);
    if ((left >= 0) !== (right >= 0) || (left >= 0 && right < left)) throw new ApiError(500, 'INDEX.md has an incomplete OS section. Repair its markers before saving the product.', 'INDEX_REPAIR_REQUIRED');
    const nextIndex = left >= 0 ? index.slice(0, left) + section + index.slice(right + end.length) : index.trimEnd() + '\n\n' + section + '\n';
    const research = await currentResearch();
    // A product change can move the step, so START-HERE.md is restaged with it.
    const projected = list.map(item => item === p ? projectProductResearch(presentProduct(p), research) : item);
    const state = await currentWorkspace(projected);
    const startHere = memoryContext(state, validatePlanner(await json('os/data/planner.json', emptyPlanner())), new Date(), await lessonRecords(), await stepFor({state, productList: projected, research}), await briefTools());
    // Stage generated views first; a failed authoritative JSON commit restores
    // them, keeping this product-file operation coherent on failure.
    await commitProjections(
      [{ path: `products/${p.id}/OS.md`, content: productMarkdown(p) }, { path: 'products/INDEX.md', content: nextIndex }, { path: 'memory/START-HERE.md', content: startHere.markdown }],
      { path: `products/${p.id}/os-product.json`, content: JSON.stringify(p, null, 2) + '\n' },
      'PRODUCT_PROJECTION_REPAIR', 'Product commit failed; generated OS.md or INDEX.md needs repair. Check the authoritative product JSON before retrying.'
    );
    return projectProductResearch(presentProduct(p), research);
  }
  async function records(kind) {
    const list = await json(`os/data/${kind}.json`, []);
    if (!Array.isArray(list) || list.some(r => !r || typeof r !== 'object' || typeof r.id !== 'string' || !Number.isInteger(r.revision) || r.revision < 1) || new Set(list.map(r => r.id)).size !== list.length) throw new ApiError(500, `Malformed record list in os/data/${kind}.json.`, 'MALFORMED_DATA');
    return list;
  }
  async function saveRecords(kind, list) { await atomic(`os/data/${kind}.json`, JSON.stringify(list, null, 2) + '\n'); }
  async function activityRecords() {
    const list = await records('activity');
    try {
      if (list.length > ACTIVITY_LIMITS.records || Buffer.byteLength(JSON.stringify(list, null, 2) + '\n') > ACTIVITY_LIMITS.maxBytes) throw new Error('Activity feed exceeds its retention limits.');
      for (const record of list) {
        activityId(record.id); activityFields(record);
        if (!ACTIVITY_REPORTERS.includes(record.reportedBy) || !validTimestamp(record.startedAt) || !validTimestamp(record.updatedAt) || !Array.isArray(record.events) || !record.events.length || record.events.length > ACTIVITY_LIMITS.eventsPerRecord) throw new Error('Invalid activity provenance, timestamps or event history.');
        for (const event of record.events) { if (!validTimestamp(event?.at)) throw new Error('Invalid event timestamp.'); text(event?.text, 'Activity event', { required: true, max: 1000 }); }
      }
    } catch (error) { throw new ApiError(500, `Malformed activity feed in os/data/activity.json: ${error.message}`, 'MALFORMED_DATA'); }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async function documents() {
    const curated = ['resources/INDEX.md', 'resources/research/2026-09-27-a-to-z-checkpoints.md', 'agents/README.md', ...AGENTS.flatMap(a => [a.path, a.skillPath]), 'agents/validation/WORKFLOW.md', 'agents/validation/references/TOOLS.md', 'agents/manager/references/IMPROVEMENT.md', 'workflow/VALIDATION.md', 'store/LAUNCH-TONIGHT.md', 'templates/NATIVE-AD-KIT.md', 'store/HYDROGEN-POPULATION.md', 'store/LAUNCH-CHECKLIST.md', 'store/TRANSFER.md', 'store/SETUP.md', 'store/BUILD-LOG.md', 'store/PRODUCT-PAGE-BLUEPRINT.md', 'store/EMAIL.md', 'guides/rippy-club/INDEX.md', 'guides/rippy-club/WORKFLOW-NOTES.md', 'memory/RESUME.md', 'memory/STATE.md', 'products/INDEX.md'];
    const limit = 1000; const docs = []; const seen = new Set(); let visitedDirectories = 0;
    async function caseMetadata(file, content) {
      const metadata = {};
      const status = content.match(/^\s*(?:\*\*)?Status:(?:\*\*)?\s*(.+)$/mi)?.[1]
        || content.match(/^\s*\*\*(EXTERNAL [^*\r\n]+)\*\*([^\r\n]*)$/mi)?.slice(1).join('');
      if (status) metadata.evidenceStatus = status.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[*_`]/g, '').trim().slice(0, 1500);
      const image = content.match(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/);
      if (!image) return metadata;
      try {
        const target = decodeURIComponent(image[1] || image[2]).replace(/\\/g, '/');
        if (/^https?:\/\//i.test(target) || /^data:/i.test(target)) return metadata;
        const direct = DOC_ROOTS.some(prefix => target.startsWith(`${prefix}/`));
        const absolute = path.isAbsolute(target) ? path.resolve(target) : path.resolve(root, direct ? '' : path.dirname(file), target);
        if (!within(root, absolute)) return metadata;
        const relative = safeRelative(path.relative(root, absolute).split(path.sep).join('/'));
        if (!MEDIA_ROOTS.some(prefix => relative.startsWith(`${prefix}/`)) || !MEDIA_TYPES[path.extname(relative).toLowerCase()]?.startsWith('image/')) return metadata;
        const safe = await bounded(relative); const stat = await fs.stat(safe);
        if (stat.isFile() && stat.size <= 25 * 1024 * 1024) metadata.previewPath = relative;
      } catch (error) { if (!(error instanceof URIError) && !['UNSAFE_PATH', 'ENOENT', 'ENOTDIR', 'EINVAL'].includes(error.code)) throw error; }
      return metadata;
    }
    async function add(file) {
      if (seen.has(file) || docs.length >= limit) return;
      seen.add(file); let content;
      try { content = await read(safeRelative(file, { markdown: true }), true); }
      catch (error) { if (['UNSAFE_PATH', 'FILE_TOO_LARGE'].includes(error.code)) return; throw error; }
      if (content === null) return;
      const isCase = file.includes('/references/cases/');
      const category = isCase ? 'Product cases' : file.startsWith('resources/') ? 'Shared resources' : file.startsWith('guides/') ? 'Course library' : file.startsWith('agents/') ? 'Agent methods' : file.startsWith('store/') ? 'Shopify' : file.startsWith('research/') ? 'Research' : file.startsWith('products/') ? 'Products' : file.startsWith('templates/') ? 'Templates' : file.startsWith('inbox/') ? 'Inbox' : 'Operating records';
      docs.push({ path: file, title: content.match(/^#\s+(.+)$/m)?.[1]?.replace(/\r$/, '') || path.basename(file, '.md'), category, ...(isCase ? await caseMetadata(file, content) : {}) });
    }
    async function walk(relative, depth = 0) {
      if (docs.length >= limit || depth > 24 || visitedDirectories >= 2000) return;
      // Validate directory scope with a harmless Markdown suffix before reading it.
      // Never descend into symlinks, credentials, build trees or frame sequences.
      try { safeRelative(`${relative}/catalog.md`, { markdown: true }); }
      catch (error) { if (error.code === 'UNSAFE_PATH') return; throw error; }
      let entries;
      try { entries = await directories(relative); }
      catch (error) { if (error.code === 'UNSAFE_PATH') return; throw error; }
      visitedDirectories += 1;
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (docs.length >= limit) return;
        if (entry.isSymbolicLink()) continue;
        const file = `${relative}/${entry.name}`;
        if (entry.isFile() && /\.md$/i.test(entry.name)) await add(file);
        else if (entry.isDirectory() && !/^(?:node_modules|\.git|\.cache|dist|build|coverage|frames?|frame[-_]?(?:captures?|sequences?|sheets?)|contact[-_]?sheets?|screenshots?)$/i.test(entry.name)) await walk(file, depth + 1);
      }
    }
    for (const file of [...curated, ...DOC_FILES]) await add(file);
    for (const relative of DOC_ROOTS) await walk(relative);
    return docs;
  }
  async function buildContext(id, marketId) {
    const candidate = await product(id); const market = buildMarket(candidate, marketId);
    const paths = buildPaths(id, market.id);
    const packet = await json(paths.packet, emptyBuildPacket(candidate, market));
    try { validateBuildPacket(packet, candidate, market); }
    catch (error) { throw new ApiError(500, `Malformed build packet ${paths.packet}: ${error.message}`, 'MALFORMED_DATA'); }
    const research = await currentResearch();
    const archived = (await readWorkspace()).reviews.some(review => review.productId === id);
    const missingEvidence = [], invalidAssets = [];
    const reviewedAssetFiles = packet.sections.assets.status === 'reviewed' ? packet.sections.assets.files || [] : [];
    for (const source of new Set([packet.bindingSource, ...Object.values(packet.sections).filter(section => section.status === 'reviewed').map(section => section.source), ...reviewedAssetFiles])) {
      if (!source || /^https?:\/\//i.test(source)) continue;
      try { if (!(await fs.stat(await bounded(source))).isFile()) missingEvidence.push(source); }
      catch (error) { if (['ENOENT', 'ENOTDIR', 'UNSAFE_PATH'].includes(error.code)) missingEvidence.push(source); else throw error; }
    }
    for (const file of reviewedAssetFiles) {
      if (missingEvidence.includes(file)) continue;
      try { if (!(await mediaFileMatchesExtension(await bounded(file)))) invalidAssets.push(file); }
      catch (error) { if (['ENOENT', 'ENOTDIR', 'UNSAFE_PATH'].includes(error.code)) missingEvidence.push(file); else throw error; }
    }
    return { candidate, market, paths, packet, research, archived, missingEvidence, invalidAssets };
  }
  /** The owner's issue picks (os/data/issue-picks.json): a broken file is an error for writes. */
  async function picksRecord() { return validatePicks(await json(ISSUE_PICKS_PATH, emptyPicks())); }
  /** For reads (bootstrap, briefs, the doctor): a broken picks file shows as `error`, and statuses fall back to the files alone. */
  async function safePicks() {
    try { return {record: await picksRecord(), error: ''}; }
    catch (error) { if (error instanceof ApiError) return {record: null, error: error.message}; throw error; }
  }
  /** The issue list (step 0): every issue with its status, its pick and the rounds that name it. */
  async function issueList(savedRounds = null) {
    const [{issues, problems}, rounds, picks] = await Promise.all([readIssues({workspaceRoot: root}), savedRounds ? {record: {rounds: savedRounds}, error: ''} : roundsRecord(), safePicks()]);
    return {entries: issueEntries(issues, {rounds: rounds.record?.rounds || [], picks: picks.record}), problems, rounds, picks};
  }
  /** The starting rules (os/data/rules.json): a broken file is an error, never silently replaced. */
  async function rulesRecord() {
    // A project without the file uses the starting rules (revision 0); a broken file is an error, never silently replaced.
    return validateRules(await json(RULES_PATH, emptyRules()));
  }
  const presentRules = record => ({...record, path: RULES_PATH, groups: RULE_GROUPS.map(id => ({id, name: RULE_GROUP_NAMES[id]})), owner: record.rules.filter(rule => rule.by === 'owner').map(rule => rule.id)});
  /** Every issue with its I1-I7 checks, status, pick and rounds (GET /api/issues). */
  async function issuesView() {
    const {entries, problems, rounds, picks} = await issueList();
    const saved = rounds.record?.rounds || [];
    return {
      root: ISSUES_ROOT, method: CHECKS_PATH, gateMin: ISSUE_GATE_MIN,
      issues: entries, counts: issueCounts(entries), hint: testingHint(entries),
      picks: {path: ISSUE_PICKS_PATH, revision: picks.record?.revision ?? null, error: picks.error},
      problems, roundsWithoutIssue: saved.filter(round => !round.issue).map(round => ({id: round.id, number: round.number, open: !round.review})),
      roundsError: rounds.error,
    };
  }

  return {
    getBuildPacket: (id, marketId) => serialized(async () => {
      const c = await buildContext(id, marketId);
      return presentBuildPacket(c.packet, c.candidate, c.market, c.research, c.archived, c.missingEvidence, c.invalidAssets);
    }),
    patchBuildPacket: (id, marketId, input) => serialized(async () => {
      await assertProductEditable(id);
      const c = await buildContext(id, marketId);
      const next = updateBuildPacket(c.packet, input, c.candidate, c.market, c.research);
      for (const source of [next.bindingSource, ...Object.values(next.sections).map(section => section.source), ...(next.sections.assets.files || [])]) if (source && !/^https?:\/\//i.test(source)) await bounded(source);
      const reviewedAssetFiles = next.sections.assets.status === 'reviewed' ? next.sections.assets.files || [] : [];
      for (const source of [next.bindingSource, ...Object.values(next.sections).filter(section => section.status === 'reviewed').map(section => section.source), ...reviewedAssetFiles]) {
        if (!source || /^https?:\/\//i.test(source)) continue;
        let stat; try { stat = await fs.stat(await bounded(source)); }
        catch (error) { if (error.code === 'ENOENT') fail('Local binding, reviewed evidence and final asset files must exist.', 'EVIDENCE_NOT_FOUND', 404); throw error; }
        if (!stat.isFile()) fail('Local reviewed evidence and final assets must reference regular files.', 'UNSAFE_PATH');
      }
      for (const file of reviewedAssetFiles) if (!(await mediaFileMatchesExtension(await bounded(file)))) fail(`Final asset content does not match its file type: ${file}`, 'INVALID_ASSET_CONTENT');
      const result = presentBuildPacket(next, c.candidate, c.market, c.research);
      // Stage both draft projections before the authoritative JSON commit. Restore
      // prior projections if a write fails, preserving the previous packet revision.
      const projections = Object.values(result.exports);
      const previous = await Promise.all(projections.map(file => read(file.path, true)));
      for (const file of [c.paths.packet, ...projections.map(file => file.path)]) await bounded(file);
      try {
        for (const file of projections) await atomic(file.path, file.content);
        await atomic(c.paths.packet, JSON.stringify(next, null, 2) + '\n');
      } catch (error) {
        try {
          for (let index = 0; index < projections.length; index++) {
            if (previous[index] === null) await fs.rm(await bounded(projections[index].path), { force: true });
            else await atomic(projections[index].path, previous[index]);
          }
        } catch { throw new ApiError(500, 'Build packet commit failed; generated draft projections require repair.', 'BUILD_PROJECTION_REPAIR'); }
        throw error;
      }
      return result;
    }),
    getResearch: async()=>{const batch=await currentResearch();return {...batch,summary:researchSummary(batch)};},
    getCuration,
    patchResearch: (input,{agent=false,ownerSaid=false}={})=>serialized(async()=>{
      const current=validateResearch(migrateResearch(await json('research/comparison.json',emptyResearch())));
      const batch=updateResearch(current,input,{agent,ownerSaid});
      if(input.candidate){
        const prior=current.candidates.find(item=>item.id===input.candidate.id);
        const candidate=batch.candidates.find(item=>item.id===input.candidate.id);
        const changedEvidence=[
          ...Object.entries(candidate.screen?.checks||{}).filter(([id,check])=>check.status!=='pending'&&JSON.stringify(check)!==JSON.stringify(prior?.screen?.checks?.[id])).map(([,check])=>check.source),
          ...Object.entries(candidate.gates).filter(([id,gate])=>gate.status!=='pending'&&JSON.stringify(gate)!==JSON.stringify(prior?.gates?.[id])).map(([,gate])=>gate.source)
        ];
        for(const source of new Set(changedEvidence))await requireLocalEvidence(source);
        // F5 "Ties to our issues" names files in the issue library (workflow/CHECKS.md, Step 1): they must exist.
        const issue=candidate.screen?.checks?.bigIssue;
        if(issue?.status==='supported'&&JSON.stringify(issue)!==JSON.stringify(prior?.screen?.checks?.bigIssue)){const known=new Set((await readIssues({workspaceRoot:root})).issues.map(item=>item.slug));const missing=cardIssues(issue).filter(slug=>!known.has(slug));if(missing.length)fail(`No issue file resources/issues/${missing[0]}/ISSUE.md: "Ties to our issues" must name ours.`,'ISSUE_MISSING',400);}
      }
      const effective = await researchWithAvailableEvidence(batch);
      if(input.candidate){
        const prior=current.candidates.find(item=>item.id===input.candidate.id);
        const candidate=effective.candidates.find(item=>item.id===input.candidate.id);
        const changedGate=Object.entries(candidate.gates).some(([id,gate])=>gate.status!=='pending'&&JSON.stringify(gate)!==JSON.stringify(prior?.gates?.[id]));
        if(changedGate&&candidate.missingEvidence?.screen?.length)fail('Restore missing pre-verification evidence before recording detailed research gates.','RESEARCH_EVIDENCE_MISSING',409);
      }
      validateResearch(effective);
      // An eye-test decision changes the card counts in the step block.
      const productList = await products(), state = await currentWorkspace(productList);
      const startHere = memoryContext(state, validatePlanner(await json('os/data/planner.json', emptyPlanner())), new Date(), await lessonRecords(), await stepFor({state, productList, research: effective}), await briefTools());
      await commitProjections(
        [{ path: 'research/COMPARISON.md', content: researchDocument(batch) }, { path: 'memory/START-HERE.md', content: startHere.markdown }],
        { path: 'research/comparison.json', content: JSON.stringify(batch, null, 2) + '\n' },
        'RESEARCH_PROJECTION_REPAIR', 'Research commit failed; COMPARISON.md needs repair. Check the authoritative comparison JSON before retrying.'
      );
      return {...effective,summary:researchSummary(effective)};
    }),
    root,
    async bootstrap() {
      const [productList, jobs, improvements, docs, checklist, storeProofs, team] = await Promise.all([products(), records('jobs'), records('improvements'), documents(), read('store/LAUNCH-CHECKLIST.md', true), json('store/os-verifications.json', {}), readTeam(root)]);
      if (!storeProofs || typeof storeProofs !== 'object' || Array.isArray(storeProofs)) throw new ApiError(500, 'Malformed store verification records in store/os-verifications.json.', 'MALFORMED_DATA');
      const storeChecklist = parseChecklist(checklist || '');
      for (const item of storeChecklist.groups.flatMap(g => g.items)) item.proof = storeProofs[item.id] || (item.done ? { method: 'inherited from source checklist', source: 'store/LAUNCH-CHECKLIST.md' } : null);
      const workspace = await currentWorkspace(productList); const reviewed = new Map(workspace.reviews.map(review => [review.productId, review]));
      const archivedProducts = productList.filter(product => reviewed.has(product.id)).map(product => ({ ...product, archived: true, archivedAt: reviewed.get(product.id).date, archiveReviewId: reviewed.get(product.id).id }));
      const [guide, rounds, issueFiles, picks] = await Promise.all([lineRecord(), roundsRecord(), readIssues({workspaceRoot: root}), safePicks()]);
      return { products: productList.filter(product => !reviewed.has(product.id)), archivedProducts, workspace, stages: STAGES, checks: CHECKS, line: guide.line, lineError: guide.error, rounds: rounds.record, roundsError: rounds.error, issues: issueEntries(issueFiles.issues, {rounds: rounds.record?.rounds || [], picks: picks.record}), issuePicksError: picks.error, jobs: jobs.filter(j => !j.synthetic), improvements: improvements.filter(i => !i.synthetic), agents: AGENTS, team, documents: docs, storeChecklist };
    },
    getWorkspace: () => currentWorkspace(),
    getMemoryContext: async () => { const productList = await products(), state = await currentWorkspace(productList); return memoryContext(state,validatePlanner(await json('os/data/planner.json',emptyPlanner())),new Date(),await lessonRecords(),await stepFor({state, productList}),await briefTools()); },
    /**
     * The live step: the guide, the pipeline and its focus step from saved
     * records, and the two blocks the manager's brief opens with.
     */
    async getStep() {
      const guide = await lineRecord(), at = new Date();
      const current = await stepFor();
      const blocks = briefBlocks(current, {at, agent: 'manager', line: guide.line});
      return { line: guide.line, error: guide.error, current, pipeline: current.pipeline, markdown: `${blocks.pipeline}\n${blocks.step}`, computedAt: at.toISOString() };
    },
    /** GET /api/pipeline: every product's own line, the rounds, the build slot and the owner's moves. */
    async getPipeline() {
      const guide = await lineRecord(), at = new Date();
      const current = await stepFor();
      return { pipeline: current.pipeline, focus: {index: current.index, number: current.number, id: current.id, name: current.name, status: current.status, next: current.next, owner: current.owner}, line: guide.line, error: guide.error, markdown: pipelineMarkdown(current.pipeline, {at, line: guide.line}), computedAt: at.toISOString() };
    },
    /**
     * GET /api/pipeline/item?id=L###|P###: one product's own line, its step
     * block and that step's prompts with the product's name, country and card
     * filled in.
     */
    async getPipelineItem(key) {
      const id = text(key ?? '', 'Product', { required: true, max: 120 });
      const guide = await lineRecord(), at = new Date();
      const current = await stepFor();
      const item = findItem(current.pipeline, id);
      if (!item) fail(`No card or product ${id} on the pipeline.`, 'NOT_FOUND', 404);
      const view = itemStep(item, guide.line, {lineError: guide.error});
      const values = {product: item.name, country: item.country, lead: item.leadId};
      // The seven gates from the saved checks (src/gates.mjs): nothing passes that the saved records do not.
      const [research, productList] = await Promise.all([currentResearch(), products()]);
      const record = item.productId ? productList.find(entry => entry.id === item.productId) : null;
      const gates = itemGates({candidate: research.candidates.find(candidate => candidate.id === item.leadId) || null, market: record ? primaryMarket(record) : null});
      return { item, gates, step: {index: view.index, number: view.number, id: view.id, name: view.name, status: view.status, next: view.next}, markdown: stepMarkdown(view, {at, title: `Step ${view.number} of ${STEP_COUNT} · ${view.name} · ${item.id} ${item.name}`}), prompts: (view.guide?.prompts || []).map(prompt => ({label: prompt.label, text: fillPrompt(prompt.text, values)})), round: current.pipeline.rounds.find(round => round.number === item.round) || null, buildProductId: current.pipeline.buildProductId, error: guide.error, computedAt: at.toISOString() };
    },
    /**
     * GET /api/issues: the issue list (step 0, owner Oct 3). Every
     * resources/issues/<slug>/ folder with its title, group, quotes and sites,
     * product types, the seven I-checks, its status (Candidate, Verified,
     * Testing, Parked), the owner's pick and the rounds that name it.
     */
    /**
     * GET /api/prove-ahead: each card still on the line with a Prove it file
     * (research/<round>/prove/L###.md, named by its checks or found in its
     * round's folder), summarised by parseProveFile: the P1 verdict, P2-P5 and
     * the supplier pages behind a verification wall. Read-only; a write-up is
     * never a recorded check.
     */
    async getProveAhead() {
      const research = await currentResearch();
      const rounds = (await roundsRecord()).record?.rounds || [];
      const cards = {};
      for (const candidate of research.candidates) {
        if (['passed', 'rejected'].includes(candidate.screen?.ownerDecision) || /^\s*(?:PARK|KILL)\b/i.test(candidate.decision || '')) continue;
        const paths = leadPaths({candidate});
        const named = paths.filter(file => PROVE_FILE.exec(file)?.[1] === candidate.id);
        const round = roundOf(paths, rounds);
        const guesses = [...named, ...(round?.folders || []).map(folder => `${roundFolder(folder)}prove/${candidate.id}.md`)].filter((file, i, all) => PROVE_FILE.test(file) && all.indexOf(file) === i);
        for (const file of guesses) {
          let content = null;
          try { const target = await bounded(file); const stat = await fs.stat(target); if (stat.isFile() && stat.size <= PROVE_FILE_MAX) content = await fs.readFile(target, 'utf8'); }
          catch (error) { if (!['ENOENT', 'ENOTDIR', 'UNSAFE_PATH'].includes(error.code)) throw error; }
          if (content === null) continue;
          cards[candidate.id] = {path: file, ...parseProveFile(content)};
          break;
        }
      }
      return {cards, computedAt: new Date().toISOString()};
    },
    /**
     * POST /api/owner-said {action, target, quote} (owner, Oct 3: "if you cant run
     * the pipeline by yourself and i have to manual this process all the time.
     * clearly something is wrong"). The manager records a decision the owner
     * gave in chat, always with the owner's own words, through the same
     * owner-decision rules as the screens: the eye test (save, pass, reject),
     * "Build this one" (launch early when Prove it is open, the quote as the
     * reason), an issue pick (test-issue, park-issue) and the launch approval
     * (approve, the product in the build slot). No quote, no decision. A
     * headless run (`run`) can never use it. Returns what was recorded.
     */
    async ownerSaid(input, {run = ''} = {}) {
      object(input);
      if (run) fail('A headless run can never record an owner decision. Only the manager does, with the owner\'s words from chat.', 'OWNER_DECISION_ONLY', 403);
      const extra = Object.keys(input).filter(key => !['action', 'target', 'quote'].includes(key));
      if (extra.length) fail(`owner-said takes only an action, a target and the quote (not ${extra.join(', ')}).`, 'INVALID_INPUT');
      const action = String(input.action || '');
      if (!OWNER_SAID_ACTIONS.includes(action)) fail(`Say one of: ${OWNER_SAID_ACTIONS.join(', ')}.`, 'UNKNOWN_ACTION');
      const problem = quoteProblem(input.quote);
      if (problem) fail(problem, 'QUOTE_REQUIRED', 400);
      const quote = input.quote.trim();
      const target = text(input.target, 'Target', { required: true, max: 120 });
      if (SAID_DECISIONS[action]) {
        if (!/^L\d{3,}$/.test(target)) fail('Name the card, such as L105.', 'INVALID_TARGET');
        const research = await currentResearch();
        const card = research.candidates.find(candidate => candidate.id === target);
        if (!card) fail(`No card ${target} in research/comparison.json.`, 'NOT_FOUND', 404);
        await this.patchResearch({revision: research.revision, candidate: ownerSaidCandidate(card, SAID_DECISIONS[action], quote)}, {ownerSaid: true});
        return {action, target, decision: SAID_DECISIONS[action], quote, recordedBy: 'manager', source: 'owner-chat'};
      }
      if (action === 'build') {
        const state = await currentWorkspace();
        const list = await products();
        const record = /^P\d{3,}/.test(target) ? list.find(item => item.id === target || item.id.startsWith(`${target}-`)) : null;
        if (/^P\d{3,}/.test(target) && !record) fail(`No product ${target}.`, 'NOT_FOUND', 404);
        if (!record && !/^L\d{3,}$/.test(target)) fail('Name the card or product, such as L105 or P012.', 'INVALID_TARGET');
        const next = await this.pickBuild({revision: state.revision, ...(record ? {productId: record.id} : {leadId: target}), reason: quote, override: true}, {said: true});
        return {action, target, build: next.build, quote, recordedBy: 'manager', source: 'owner-chat'};
      }
      if (action === 'test-issue' || action === 'park-issue') {
        const picks = await picksRecord();
        const result = await this.pickIssue({revision: picks.revision, slug: target, pick: action === 'test-issue' ? 'testing' : 'parked'}, {said: {quote}});
        return {action, target, pick: result.saved, quote, recordedBy: 'manager', source: 'owner-chat'};
      }
      // approve: the launch approval for the product in the build slot, logged in the product's decision file.
      const state = await currentWorkspace();
      const list = await products();
      const record = list.find(item => item.id === target || item.id.startsWith(`${target}-`) || item.markets.some(market => market.researchCandidateId === target));
      if (!record) fail(`No product ${target}.`, 'NOT_FOUND', 404);
      if (state.buildProductId !== record.id) fail(`Only the product in the build slot can be approved for a test; ${record.id} is not building.`, 'NOT_BUILDING', 409);
      const market = primaryMarket(record);
      const day = journalDay();
      const log = `products/${record.id}/owner-decisions.md`;
      const before = (await read(log, true)) || '# Owner decisions said in chat\n\nRecorded by the manager with the owner\'s own words (os.mjs owner-said).\n\n';
      await atomic(log, `${before}- ${day} · approve the test · "${quote.replace(/\s+/g, ' ')}"\n`);
      await this.patchProduct(record.id, {revision: record.revision, marketId: market.id, check: {id: 'authorized-test', status: 'verified', note: `Owner approved the test in chat: "${quote}" (recorded by the manager).`, source: log, evidenceType: 'observed', observedAt: day, window: 'this test'}});
      return {action, target: record.id, quote, recordedBy: 'manager', source: 'owner-chat', log};
    },
    getIssues: () => issuesView(),
    /**
     * POST /api/issues/pick {revision, slug, pick: 'testing'|'parked'} (or,
     * from Undo, {pick: <earlier>|null, undo: true}): the owner's one-tap pick.
     * A write from an agent is refused (OWNER_DECISION_ONLY); a Candidate
     * cannot be picked (ISSUE_NOT_VERIFIED). Returns the issue list.
     */
    pickIssue: (input, {agent = false, said = null} = {}) => serialized(async () => {
      if (agent) updatePicks(emptyPicks(), input, {agent});
      const {entries} = await issueList();
      const result = updatePicks(await picksRecord(), input, {entries, agent, said});
      await atomic(ISSUE_PICKS_PATH, JSON.stringify(result.picks, null, 2) + '\n');
      return {...(await issuesView()), saved: result.saved};
    }),
    getRounds: async () => {
      const record = await roundRecords();
      const current = await stepFor({rounds: record});
      return {...record, summary: current.pipeline.rounds, current: current.pipeline.round, nextNumber: current.pipeline.nextNumber};
    },
    /**
     * Start, review or import rounds (rounds.mjs owns the rules). A review, or
     * an import with a review, is refused while the round still has cards in
     * Find or Validate. Writes os/data/rounds.json with memory/ROUNDS.md and
     * START-HERE (the pipeline block names the round).
     */
    saveRounds: input => serialized(async () => {
      const current = await roundRecords();
      const productList = await products(), state = await currentWorkspace(productList);
      const [research, curation] = await Promise.all([currentResearch(), safeCuration()]);
      const leads = buildLeads(research, curation);
      const archived = new Set(state.reviews.map(review => review.productId));
      const blockersFor = (rounds, number) => roundBlockers(pipelineItems({leads, products: productList.filter(item => !archived.has(item.id)), archivedProducts: productList.filter(item => archived.has(item.id)), reviews: state.reviews, stages: STAGES, checks: CHECKS, rounds, buildProductId: state.buildProductId}), number);
      const {entries: issues} = await issueList(current.rounds);
      const result = updateRounds(current, input, {blockersFor, issues});
      if (!result.imported.length && !result.saved) return {...current, imported: [], skipped: result.skipped, summary: (await stepFor({state, productList, research, rounds: current})).pipeline.rounds};
      const step = await stepFor({state, productList, research, rounds: result.rounds});
      const startHere = memoryContext(state, validatePlanner(await json('os/data/planner.json', emptyPlanner())), new Date(), await lessonRecords(), step, await briefTools());
      await commitProjections([{path: ROUNDS_DOC, content: roundsMarkdown(result.rounds, step.pipeline.rounds)}, {path: 'memory/START-HERE.md', content: startHere.markdown}], {path: ROUNDS_PATH, content: JSON.stringify(result.rounds, null, 2) + '\n'}, 'ROUNDS_PROJECTION_REPAIR', `Rounds commit failed; ${ROUNDS_DOC} needs repair. Check ${ROUNDS_PATH} before retrying.`);
      return {...result.rounds, imported: result.imported, skipped: result.skipped, saved: result.saved?.id || '', summary: step.pipeline.rounds};
    }),
    /**
     * The owner's "Build this one" (POST /api/workspace/build): put one product
     * whose Source is complete into the empty build slot, with the owner's
     * reason. Only the owner's screen calls it; no helper command records it.
     */
    pickBuild: (input, {said = false} = {}) => serialized(async () => {
      object(input);
      let state = await currentWorkspace();
      let research = await currentResearch();
      // Fast launch (owner, Oct 1): a card the owner saved can be picked before
      // its product record exists; with override the record starts from the
      // card here (createProduct's rules), after the slot and reason are checked.
      let id = input.productId ? text(input.productId, 'Product', { required: true, max: 120 }) : '';
      if (!id) {
        const leadId = text(input.leadId, 'Product or card', { required: true, max: 12 });
        const linked = (await products()).find(item => item.markets.some(market => market.researchCandidateId === leadId));
        if (linked) id = linked.id;
        else {
          assertRevision(state.revision, input.revision);
          text(input.reason, 'Your reason for building this one', { required: true, max: 1000 });
          if (state.buildProductId && !said) fail(`${state.buildProductId} is in the build slot. One product builds at a time; it frees the slot when its cycle is reviewed.`, 'BUILD_SLOT_TAKEN', 409, { productId: state.buildProductId });
          const leadCard = research.candidates.find(candidate => candidate.id === leadId);
          if (input.override !== true && !upfrontReady(leadCard)) fail(`${leadId} has not finished its upfront checks yet: every Product, Buyers and Prove-it check must be reviewed before it can build.`, 'SOURCE_NOT_DONE', 409);
          id = (await startProduct({ leadId })).id;
          state = await currentWorkspace(); research = await currentResearch();
        }
      }
      const record = projectProductResearch(presentProduct(await product(id)), research);
      const market = primaryMarket(record);
      const flow = processState(STAGES, CHECKS, market);
      const card = research.candidates.find(candidate => candidate.id === market?.researchCandidateId);
      const ready = (flow.currentIndex >= BUILD_FROM || upfrontReady(card)) && ['active', 'winner'].includes(market?.status);
      if (!ready && input.override === true && ['parked', 'rejected'].includes(market?.status)) fail(`${id} is ${market.status}; reopen it before building.`, 'PRODUCT_OUT_OF_LINE', 409);
      const ownerSaved = card?.screen?.ownerDecision === 'saved' && !/^\s*(?:PARK|KILL)\b/i.test(card?.decision || '');
      const missing = upfrontReady(card) ? [] : openBeforeBuild(STAGES, CHECKS, market).map(check => check.id);
      return saveWorkspace(pickBuildProduct(state, input, { product: record, ready, archived: state.reviews.some(review => review.productId === id), missing, ownerSaved, said }));
    }),
    getLessons: async () => { const lessons = await lessonRecords(); return {...lessons, review: lessonReview(lessons, journalDay())}; },
    saveLesson: input => serialized(async () => {
      const next = updateLessons(await lessonRecords(), input);
      const lesson = input.id ? next.lessons.find(item => item.id === input.id) : next.lessons.at(-1);
      for (const source of lesson.references) await requireLocalEvidence(source);
      await commitProjections(memoryProjections(await currentWorkspace(), validatePlanner(await json('os/data/planner.json', emptyPlanner())), next, await stepFor(), await briefTools()), {path: 'os/data/lessons.json', content: JSON.stringify(next, null, 2) + '\n'}, 'MEMORY_PROJECTION_REPAIR', 'Lesson commit failed; preserve records and repair memory projections.');
      return {...next, review: lessonReview(next, journalDay())};
    }),
    async getBrief(agent = 'manager') {
      if (agent !== 'manager' && !AGENT_ID.test(agent)) fail('Ask for the brief of the manager or a team agent ID.');
      const team = await readTeam(root);
      const member = team.agents.find(item => item.id === agent);
      if (agent !== 'manager' && !member) fail('That agent is not on the team roster.', 'NOT_FOUND', 404);
      // A damaged library shows as a repair line in the brief instead of blocking every agent.
      let library; try { library = await libraryRecords(); } catch (error) { if (error.code !== 'MALFORMED_DATA') throw error; library = null; }
      const productList = await products(), state = await currentWorkspace(productList);
      const names = Object.fromEntries(team.agents.map(item => [item.id, item.name]));
      // An idle team agent's brief suggests work from the issues and the topic map; either may be missing.
      let issues = [], topics = [];
      if (agent !== 'manager') {
        try { issues = (await issuesView()).issues; } catch { issues = []; }
        try { topics = parseTopics(await read(TOPICS_PATH, true) || ''); } catch { topics = []; }
      }
      // The owner's Store editor edits (a damaged history never blocks the brief).
      let storeEdits = '';
      if (STORE_EDIT_READERS.has(agent)) { try { storeEdits = ownerEditsMarkdown(await createStoreEditor({workspaceRoot: root}).ownerEditGroups()); } catch { storeEdits = ''; } }
      // The scout reads the owner's recent eye-test chips (Oct 3), so searches filter harder on them; a damaged record never blocks the brief.
      let ownerTaste = '';
      if (agent === 'scout') { try { ownerTaste = reasonTagsMarkdown((await json('research/comparison.json', emptyResearch())).candidates || []); } catch { ownerTaste = ''; } }
      // Step 0 (owner, Oct 3): the scout searches for the Testing issues; the buyer researcher cross-references Candidates.
      const issueBlock = agent === 'scout' ? scoutIssuesMarkdown(issues) : agent === 'buyer-researcher' ? researcherIssuesMarkdown(issues) : '';
      const skills = (agent === 'manager' ? team.manager?.skills : member?.skills) || [];
      return agentBrief({state, planner: validatePlanner(await json('os/data/planner.json', emptyPlanner())), lessons: await lessonRecords(), library, agent, name: member?.name || 'the manager', step: await stepFor({state, productList}), names, tools: (await briefTools())?.tools ?? null, line: (await lineRecord()).line, issues, topics, storeEdits, ownerTaste, issueBlock, skills});
    },
    getLibrary: async () => presentLibrary(await libraryRecords()),
    searchLibrary: async query => {
      const q = text(query ?? '', 'Search words', {max: 200});
      const library = await libraryRecords();
      const texts = new Map(), paths = [...new Set(library.entries.map(entry => entry.path).filter(Boolean))];
      for (let index = 0; index < paths.length; index += 40) {
        const batch = paths.slice(index, index + 40);
        (await Promise.all(batch.map(libraryText))).forEach((value, i) => { if (value) texts.set(batch[i], value); });
      }
      const hits = searchLibrary(library.entries, q, texts);
      // Nothing matched exactly: the closest entries, each marked closest: true.
      return hits.length ? hits : closestEntries(library.entries, q, texts);
    },
    /**
     * Create or edit one library entry. With `note: {body}` and no file, the
     * server writes a new resources/notes/YYYY-MM-DD-<slug>.md (never
     * overwriting) and points the entry at it.
     */
    saveLibraryEntry: input => serialized(async () => {
      object(input);
      const current = await libraryRecords();
      const previous = input.id ? current.entries.find(entry => entry.id === input.id) : null;
      let request = input, note = null;
      if (input.note !== undefined) {
        const body = noteBody(input.note);
        if ((input.path !== undefined && input.path !== '') || previous?.path) fail('This entry already points to a file. Edit that file, or leave out the note.', 'NOTE_HAS_PATH');
        // One plain prompt is enough: a missing title, summary or topic comes from the text itself.
        const title = text(input.title || previous?.title || deriveTitle(body), 'Title', {required: true, max: 120});
        const learned = text(input.learned || deriveLearned(body) || previous?.learned, 'What we learned', {required: true, max: 400});
        const topics = input.topics ?? (previous?.topics?.length ? previous.topics : guessTopics(`${title} ${body}`));
        const on = libraryDay(), slug = noteSlug(title);
        let file = '';
        for (let n = 1; n <= 200 && !file; n++) if (!(await exists(notePath(on, slug, n)))) file = notePath(on, slug, n);
        if (!file) fail('Too many notes with this title today. Use a different title.', 'NOTE_EXISTS', 409);
        note = {path: file, content: noteContent({title, learned, body})};
        request = {...input, title, learned, topics, path: file, status: input.status ?? 'learned'}; delete request.note;
      }
      const next = updateLibrary(current, request);
      const entry = request.id ? next.entries.find(item => item.id === request.id) : next.entries.at(-1);
      // Check only what changed, so an old entry whose file moved can still be marked outdated.
      if (entry.path && !note && entry.path !== previous?.path) await requireLocalEvidence(entry.path);
      for (const source of entry.sources) if (!previous?.sources.includes(source)) await requireLocalEvidence(source);
      if (note) {
        const target = await bounded(note.path, {createParent: true});
        let handle;
        try { handle = await fs.open(target, 'wx', 0o644); }
        catch (error) { if (error.code === 'EEXIST') fail(`A note already exists at ${note.path}. Try again.`, 'NOTE_EXISTS', 409); throw error; }
        try { await handle.writeFile(note.content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      }
      try {
        await commitProjections([{path: 'resources/LIBRARY.md', content: libraryMarkdown(next)}], {path: 'os/data/library.json', content: JSON.stringify(next, null, 2) + '\n'}, 'LIBRARY_PROJECTION_REPAIR', 'Library commit failed; resources/LIBRARY.md needs repair. Check os/data/library.json before retrying.');
      } catch (error) {
        if (note) await fs.rm(await bounded(note.path), {force: true}).catch(() => {});
        throw error;
      }
      return presentLibrary(next);
    }),
    /** GET /api/rules: the starting rules (the kill line, the loss limit, the target cost per sale…), each with whose number it is. */
    getRules: async () => presentRules(await rulesRecord()),
    /** POST /api/rules {revision, changes: {id: {value}}}: the owner changes a number (Settings). Only values move. */
    saveRules: input => serialized(async () => {
      const next = updateRules(await rulesRecord(), input);
      await atomic(RULES_PATH, JSON.stringify(next, null, 2) + '\n');
      return presentRules(next);
    }),
    getTools: async () => presentTools(await toolRecords()),
    /**
     * Create or edit one tool (tools.mjs owns the rules, including the
     * credential guard). Writes os/data/tools.json and resources/TOOLS.md
     * together. Retiring hides a tool; nothing is deleted.
     */
    saveTool: input => serialized(async () => {
      object(input);
      const current = await toolRecords();
      const next = updateTools(current, input);
      const tool = input.id ? next.tools.find(item => item.id === input.id) : next.tools.at(-1);
      const previous = current.tools.find(item => item.id === tool.id);
      // Only a changed workspace file is checked, so an old tool whose note moved can still be retired.
      if (tool.source && !/^https?:\/\//i.test(tool.source) && tool.source !== previous?.source) await requireLocalEvidence(tool.source.split('#')[0]);
      const startHere = memoryContext(await currentWorkspace(), validatePlanner(await json('os/data/planner.json', emptyPlanner())), new Date(), await lessonRecords(), await stepFor(), next);
      await commitProjections([{path: TOOLS_DOC, content: toolsMarkdown(next)}, {path: 'memory/START-HERE.md', content: startHere.markdown}], {path: TOOLS_PATH, content: JSON.stringify(next, null, 2) + '\n'}, 'TOOLS_PROJECTION_REPAIR', `Tool commit failed; ${TOOLS_DOC} needs repair. Check ${TOOLS_PATH} before retrying.`);
      return {...presentTools(next), saved: tool.id};
    }),
    getPlanner: async () => validatePlanner(await json('os/data/planner.json', emptyPlanner())),
    savePlannerTask: input => serialized(async () => {
      const raw = await json('os/data/planner.json', emptyPlanner());
      const next = updatePlanner(raw, input);
      const task = input.id ? next.tasks.find(task => task.id === input.id) : next.tasks.at(-1);
      for (const source of task.references) await requireLocalEvidence(source);
      // A named product must exist (P### is saved as the full P###-name).
      if (task.product && task.product !== raw.tasks?.find(item => item.id === task.id)?.product) task.product = await productRef(task.product);
      await commitProjections(memoryProjections(await currentWorkspace(),next,await lessonRecords(),await stepFor(),await briefTools()),{path:'os/data/planner.json',content:JSON.stringify(next,null,2)+'\n'},'MEMORY_PROJECTION_REPAIR','Planner commit failed; preserve records and repair memory projections.');
      return next;
    }),
    // From earlier and Wrap up the day: one revision-checked write for several open tasks.
    movePlannerTasks: input => serialized(async () => {
      const {planner: next, moved, unflagged} = movePlannerTasks(await json('os/data/planner.json', emptyPlanner()), input);
      if (moved.length) await commitProjections(memoryProjections(await currentWorkspace(),next,await lessonRecords(),await stepFor(),await briefTools()),{path:'os/data/planner.json',content:JSON.stringify(next,null,2)+'\n'},'MEMORY_PROJECTION_REPAIR','Planner commit failed; preserve records and repair memory projections.');
      return {...next, moved, unflagged};
    }),
    deletePlannerTasks: (input, options) => serialized(async () => {
      const next = deletePlannerTasks(await json('os/data/planner.json', emptyPlanner()), input, options);
      await commitProjections(memoryProjections(await currentWorkspace(),next,await lessonRecords(),await stepFor(),await briefTools()),{path:'os/data/planner.json',content:JSON.stringify(next,null,2)+'\n'},'MEMORY_PROJECTION_REPAIR','Planner commit failed; preserve records and repair memory projections.');
      return next;
    }),
    restorePlannerTasks: input => serialized(async () => {
      const next = restorePlannerTasks(await json('os/data/planner.json', emptyPlanner()), input);
      await commitProjections(memoryProjections(await currentWorkspace(),next,await lessonRecords(),await stepFor(),await briefTools()),{path:'os/data/planner.json',content:JSON.stringify(next,null,2)+'\n'},'MEMORY_PROJECTION_REPAIR','Planner commit failed; preserve records and repair memory projections.');
      return next;
    }),
    addWorkspaceNote: input => serialized(async () => { const next=addWorkspaceNote(await currentWorkspace(),input); await memoryInput(input);return saveWorkspace(next); }),
    patchWorkspaceNote: (id, input) => serialized(async () => {const next=patchWorkspaceNote(await currentWorkspace(),id,input);await memoryInput(input);return saveWorkspace(next);}),
    patchWorkspaceHandoff: input => serialized(async () => saveWorkspace(patchWorkspaceHandoff(await currentWorkspace(), input))),
    reviewWorkspaceCycle: input => serialized(async () => {
      object(input); const state = await currentWorkspace();
      const candidate = await product(input.productId); const next = appendCycleReview(state, candidate, input);
      for (const source of next.reviews.at(-1).evidence) if (!/^https?:\/\//i.test(source)) await read(source);
      const runFiles = (await directories('os/data/runs')).filter(entry => entry.name.endsWith('.json'));
      if (runFiles.length > 2000) throw new ApiError(409, 'Too many run records to safely review this cycle. Review the run archive first.', 'RUN_REVIEW_REQUIRED');
      const savedJobs = await json('os/data/jobs.json', []);
      const jobs = Array.isArray(savedJobs) ? savedJobs : savedJobs?.jobs;
      if (!Array.isArray(jobs)) throw new ApiError(500, 'Malformed job records prevent a safe cycle review.', 'MALFORMED_DATA');
      for (const entry of runFiles) {
        const run = await json(`os/data/runs/${entry.name}`, null);
        if (!run || !['running', 'completed', 'failed', 'interrupted'].includes(run.status)) throw new ApiError(500, 'Malformed run records prevent a safe cycle review.', 'MALFORMED_DATA');
        if (run.status !== 'running') continue;
        const matches = jobs.filter(job => job?.id === run.jobId);
        if (matches.length !== 1) throw new ApiError(409, 'A running CLI record has an unresolved job scope. Review it before archiving.', 'RUN_REVIEW_REQUIRED');
        if (matches[0].productId === candidate.id) throw new ApiError(409, `CLI run ${run.id} is still recorded as running for this product. Wait for it to return or stop it before reviewing the cycle.`, 'PRODUCT_RUN_ACTIVE');
      }
      return saveWorkspace(next);
    }),
    async readDocument(relative) {
      // The step guide is JSON; the reader shows it as a page (the file is never written).
      if (relative === LINE_PATH) { const guide = await lineRecord(); return { path: LINE_PATH, content: guide.line ? lineMarkdown(guide.line) : `# The seven-step line\n\n${guide.error}\n` }; }
      const file = safeRelative(relative, { markdown: true }); return { path: file, content: await read(file) };
    },
    // What the scraper reports (research/scrape-runs.json): read only, malformed rows dropped. The scraper writes the file.
    async getScrapeRuns() { return { runs: normalizeRuns(await json('research/scrape-runs.json', { runs: [] })) }; },
    async getActivity() { return { activity: await activityRecords(), retention: ACTIVITY_LIMITS }; },
    reportActivity: input => serialized(async () => {
      object(input); const id = input.id === undefined ? `A-${randomUUID()}` : activityId(input.id);
      if (input.events !== undefined) fail('Report one event text; event timestamps and history are maintained by the API.');
      const list = await activityRecords(); const previous = list.find(record => record.id === id);
      assertRevision(previous?.revision || 0, input.revision, false);
      const fields = activityFields(input, previous);
      if (fields.product && fields.product !== previous?.product) fields.product = await productRef(fields.product);
      // Labels the report's source harness; it is not authentication or runtime proof.
      const reporter = input.reportedBy ?? previous?.reportedBy ?? 'codex';
      if (!ACTIVITY_REPORTERS.includes(reporter)) fail('Activity reporter must be codex or claude.');
      for (const reference of fields.references) await bounded(reference);
      const explicitEvent = input.event === undefined ? '' : text(input.event, 'Activity event', { required: true, max: 1000 });
      const changed = !previous || Object.entries(fields).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key]));
      const eventChanged = explicitEvent && explicitEvent !== previous?.events.at(-1)?.text;
      if (!changed && !eventChanged) return { record: previous, created: false };
      const at = new Date().toISOString();
      const record = { id, ...fields, reportedBy: reporter, startedAt: previous?.startedAt || at, updatedAt: at, revision: (previous?.revision || 0) + 1, events: [...(previous?.events || []), { at, text: explicitEvent || `${fields.status}: ${fields.summary}`.slice(0, 1000) }].slice(-ACTIVITY_LIMITS.eventsPerRecord) };
      // Activity is a bounded report feed, not a process registry. Keep the most
      // recently updated reports and a bounded tail of each report's history.
      const retained = [record, ...list.filter(item => item.id !== id)].slice(0, ACTIVITY_LIMITS.records);
      while (retained.length > 1 && Buffer.byteLength(JSON.stringify(retained, null, 2) + '\n') > ACTIVITY_LIMITS.maxBytes) retained.pop();
      await saveRecords('activity', retained); return { record, created: !previous };
    }),
    getProduct: async id => {
      const research = await currentResearch();
      const candidate = projectProductResearch(presentProduct(await product(id)), research); const review = (await readWorkspace()).reviews.find(review => review.productId === id);
      return review ? { ...candidate, archived: true, archivedAt: review.date, archiveReviewId: review.id } : candidate;
    },
    /**
     * Start a product record (P###). Many products can be open at once (one
     * build slot later). With `leadId` (os.mjs product start L###) it starts
     * from a card the owner saved: one product per card, and the record takes
     * the card's id, country and exact listing so its checks bind to the card.
     * Starting a product never puts it in the build slot.
     */
    createProduct: input => serialized(() => startProduct(input)),
    patchProduct: (id, input) => serialized(async () => {
      await assertProductEditable(id);
      const previous = await product(id);
      const next = updateProduct(previous, input);
      const market = next.markets.find(m => m.id === input.marketId);
      const priorMarket = previous.markets.find(m => m.id === input.marketId);
      const newlyVerified = input.check?.status === 'verified' && JSON.stringify(market?.checks?.[input.check.id]) !== JSON.stringify(priorMarket?.checks?.[input.check.id]);
      const winnerWrite = input.market?.status === 'winner';
      // One product per card.
      const lead = input.market?.researchCandidateId;
      if (lead && lead !== priorMarket?.researchCandidateId) {
        const other = (await products()).find(item => item.id !== id && item.markets.some(m => m.researchCandidateId === lead));
        if (other) fail(`${lead} already has a product: ${other.id}. One product per card.`, 'LEAD_HAS_PRODUCT', 409, { productId: other.id });
      }
      // Create, Build and Launch checks belong to the product in the build slot (the owner's pick).
      const stage = CHECKS.find(check => check.id === input.check?.id)?.stage;
      if ((newlyVerified && STAGES.findIndex(item => item.id === stage) >= BUILD_FROM) || winnerWrite) {
        const state = await currentWorkspace();
        if (state.buildProductId !== id) fail(`Only the product in the build slot records Create, Build or Launch checks. ${state.buildProductId ? `${state.buildProductId} is building now.` : 'The slot is empty: the owner picks one with "Build this one".'}`, 'BUILD_SLOT_REQUIRED', 409, { buildProductId: state.buildProductId });
      }
      if (newlyVerified || winnerWrite) {
        const research = await currentResearch();
        const binding = researchBinding(next, market, research);
        if (!binding.ready) fail(binding.reason, binding.code, 409);
      }
      if (newlyVerified) await requireLocalEvidence(market.checks[input.check.id].source);
      return saveProduct(next);
    }),
    patchStoreCheck: (id, input) => serialized(async () => {
      object(input); if (!/^[A-Z]\d+$/.test(id)) fail('Unknown store checklist ID.');
      if (typeof input.done !== 'boolean') fail('Store check done must be true or false.');
      const note = text(input.note, 'Review evidence', { required: input.done });
      const source = input.source ? evidenceSource(input.source) : '';
      const observedAt = text(input.observedAt, 'Observation date', { required: input.done, max: 10 });
      if (input.done && !source) fail('A checked store item requires an evidence source.');
      if (input.done) await requireLocalEvidence(source);
      if (observedAt) {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(observedAt) ? new Date(`${observedAt}T00:00:00Z`) : null;
        if (!date || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== observedAt || observedAt > new Date().toISOString().slice(0, 10)) fail('Observation date must be a real non-future YYYY-MM-DD date.');
      }
      const sourcePath = 'store/LAUNCH-CHECKLIST.md'; const content = await read(sourcePath);
      const matcher = new RegExp(`^(\\s*-\\s+\\[)([ xX])(\\]\\s+\\*\\*${id}\\*\\*\\s+)`, 'gm');
      if ([...content.matchAll(matcher)].length !== 1) fail('Store checklist ID must match exactly one source item.', 'AMBIGUOUS_CHECK', 409);
      const proofs = await json('store/os-verifications.json', {}); object(proofs, 'Stored store verifications');
      const previous = proofs[id]; if (input.revision !== undefined) assertRevision(previous?.revision || 0, input.revision);
      const proof = { done: input.done, note, source, observedAt, revision: (previous?.revision || 0) + 1, updatedAt: new Date().toISOString(), method: 'manually recorded review', history: [...(previous?.history || []), ...(previous ? [{ done: previous.done, note: previous.note, source: previous.source, observedAt: previous.observedAt, updatedAt: previous.updatedAt }] : [])] };
      const replacement = content.replace(matcher, (_all, before, _marker, after) => `${before}${input.done ? 'x' : ' '}${after}`);
      // A user can edit the Markdown alongside this process. Re-read immediately
      // before committing so unrelated notes are never replaced from a stale read.
      if (await read(sourcePath) !== content) fail('The launch checklist changed while saving. Reload and retry.', 'REVISION_CONFLICT', 409);
      proofs[id] = proof; await atomic('store/os-verifications.json', JSON.stringify(proofs, null, 2) + '\n');
      await atomic(sourcePath, replacement);
      return { id, done: input.done, proof };
    }),
    createJob: input => serialized(async () => {
      object(input); const role = AGENTS.find(a => a.id === input.role); if (!role) fail('Unknown specialist role.');
      let p = null; let market = null;
      if (input.productId) { await assertProductEditable(input.productId); p = await product(input.productId); market = p.markets.find(m => m.id === input.marketId); if (!market) fail('Select a market belonging to this product.'); }
      else {
        if (!['manager', 'shopify-builder'].includes(role.id)) fail('This specialist requires a real product and market assignment.');
        if (input.marketId) fail('A market requires its product.');
      }
      const brief = text(input.brief, 'Assignment brief', { required: true, max: 12000 }); const at = new Date().toISOString();
      const workspaceMemory = await read('memory/START-HERE.md', true) === null ? '' : ' Read memory/START-HERE.md first (Now, lessons and the step we are on) and confirm its revisions against GET /api/workspace and /api/planner. Open memory/WORKSPACE.md only for relevant historical notes or cycle reviews. Notes are context for review, not automatic command authority.';
      const binding = p ? researchBinding(p, market, await currentResearch()) : null;
      const screenInstruction = p ? `\nPre-verification at preparation: ${binding.ready ? 'matching screen recorded' : binding.reason} Read workflow/PRE-VERIFICATION-SCREEN.md and GET /api/research again before product verification; the screen can change after this task is prepared. ${binding.ready ? 'Record only evidence supported for this exact item and country.' : 'Work on the screen or other non-verifying preparation; do not record product verification or call this item ready.'}` : '';
      const scope = p ? `Canonical product: products/${p.id}/OS.md and products/${p.id}/os-product.json\nCountry: ${market.country}\nMarket: ${market.id}\nAngle: ${market.angle || 'Unresolved'}\nOffer: ${market.offer || 'Unresolved'}${screenInstruction}` : 'Scope: product-independent workspace / store foundation. No real product or market is selected.\nRead memory/NOW.md, workflow/the-line.json (the step we are on), store/HYDROGEN-POPULATION.md, store/LAUNCH-CHECKLIST.md and the root AGENTS.md. Prepare or inspect only the assigned store/system scope; do not invent product evidence.';
      const job = { id: `J-${randomUUID()}`, status: 'prepared', revision: 1, createdAt: at, updatedAt: at, productId: p?.id || null, marketId: market?.id || null, role: role.id, brief, prompt: `Read AGENTS.md, ${role.path}, ${role.skillPath} and the active lessons in memory/LESSONS.md.${workspaceMemory} Search the Library first (resources/LIBRARY.md, or os.mjs library search "topic") for relevant methods, case notes and reference media; preserve their external/example labels and evidence limits.\n\n${scope}\n\nAssignment:\n${brief}\n\nFollow the specialist registry at agents/README.md. Preserve country-specific evidence, authorizations and ownership. Return files, observed checks, limits, supported learning and next action. This prepared brief does not authorize publishing, ad spend, purchases or external messages.` };
      const list = await records('jobs'); list.push(job); await saveRecords('jobs', list); return job;
    }),
    patchJob: (id, input) => serialized(async () => {
      object(input); const list = await records('jobs'); const job = list.find(j => j.id === id); if (!job) fail('Assignment not found.', 'NOT_FOUND', 404); assertRevision(job.revision, input.revision, false);
      if (!['prepared', 'completed', 'cancelled'].includes(input.status)) fail('Assignment status must be prepared, completed or cancelled.');
      const result = input.result === undefined ? job.result || '' : text(input.result, 'Result evidence', { max: 20000 }); if (input.status === 'completed' && !result) fail('Manually recorded completion requires result evidence.');
      Object.assign(job, { status: input.status, result, completionMethod: input.status === 'completed' ? 'manually recorded' : null, updatedAt: new Date().toISOString(), revision: job.revision + 1 }); await saveRecords('jobs', list); return job;
    }),
    createImprovement: input => serialized(async () => {
      object(input); if (!AGENTS.some(a => a.id === input.role)) fail('Unknown role.');
      const record = { id: `I-${randomUUID()}`, revision: 1, status: 'proposed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), role: input.role, title: text(input.title, 'Improvement title', { required: true, max: 200 }), observation: text(input.observation, 'Observation', { required: true }), proposal: text(input.proposal, 'Proposed change', { required: true }), source: evidenceSource(input.source), evidence: '', previous: '', nextCheck: '' };
      const list = await records('improvements'); list.push(record); await saveRecords('improvements', list); return record;
    }),
    patchImprovement: (id, input) => serialized(async () => {
      object(input); const list = await records('improvements'); const record = list.find(i => i.id === id); if (!record) fail('Improvement not found.', 'NOT_FOUND', 404); assertRevision(record.revision, input.revision, false);
      if (!['proposed', 'trialed', 'adopted', 'reverted'].includes(input.status)) fail('Unknown improvement status.');
      for (const key of ['evidence', 'previous', 'nextCheck']) if (input[key] !== undefined) record[key] = text(input[key], key);
      if (input.status === 'adopted' && (!record.evidence || !record.previous || !record.nextCheck)) fail('Adoption requires verification evidence, previous text for rollback and a next check.');
      if (['trialed', 'reverted'].includes(input.status) && !record.evidence) fail('A trial or rollback requires evidence.');
      record.status = input.status; record.updatedAt = new Date().toISOString(); record.revision += 1; await saveRecords('improvements', list); return record;
    }),
  };
}
