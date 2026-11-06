// The owner's seven-step Pipeline ending at Launch (owner, Nov 5):
// "Products is where we put hundreds of products because we do a kind of light-to-medium test, right?
// Verify is a full hard test. Then we push those products to the next tab (Winners), where we do the
// specific research on how we can understand the product and understand the audience with that product...
// understanding the pricing, understanding how this product sells and stuff, understanding the reviews,
// and understanding more about the product. After that, that's basically saying, 'Okay we're good. Those
// are two products. Those are the products we choose,' and then it goes to the next workflow, which is
// the store creatives stuff like that."
//
// Pipeline: Product · Verify · Winners · Store · Creatives · Checklist · Launch
// Manage (#/manage) lives in its own dedicated top-level tab with its own sub-tabs.
import {STEP_IDS} from './steps.mjs';
import {stepStations} from './pipelineView.mjs';

export const PIPELINE_STEP_SKILLS = {
  product: {
    id: 'product',
    label: 'Step 1 · Product',
    short: 'Product',
    slug: 'find',
    agents: ['scout'],
    skills: ['kalodata-keyword-reverse-engineering', 'merrivy-research-workspace', 'browser-use'],
    rule: 'Scout must load kalodata-keyword-reverse-engineering before scraping or staging any product.',
  },
  verify: {
    id: 'verify',
    label: 'Step 2 · Verify',
    short: 'Verify',
    slug: 'verify',
    agents: ['checker', 'buyer-researcher'],
    skills: ['hard-product-verification', 'amazon-review-and-hook-mining', 'kalodata-keyword-reverse-engineering', 'browser-use'],
    rule: 'Checker & Buyer Researcher must run all 5 hard verification gates and mine 4-5 star Amazon reviews.',
  },
  winners: {
    id: 'winners',
    label: 'Step 3 · Winners',
    short: 'Winners',
    slug: 'winners',
    agents: ['checker', 'buyer-researcher'],
    skills: ['hard-product-verification', 'amazon-review-and-hook-mining'],
    rule: 'Verified winners ready for the owner eye test (Approve & Build Store or Reject).',
  },
  build: {
    id: 'build',
    label: 'Step 4 · Store',
    short: 'Store',
    slug: 'build',
    agents: ['store-builder', 'copywriter'],
    skills: ['grimoire-storefront-and-checklist', 'viral-hook-and-dr-copywriting', 'merrivy-shopify-workspace'],
    rule: 'Store Builder must clone base-theme.json, write the 5-section Grimoire copy, and configure 2 Kits Only + $4.99 Shipping Protection.',
  },
  creatives: {
    id: 'creatives',
    label: 'Step 5 · Creatives',
    short: 'Creatives',
    slug: 'create',
    agents: ['image-maker', 'copywriter'],
    skills: ['winning-statics', 'sbc-statics-2-0', 'google-flow-creative-studio', 'viral-hook-and-dr-copywriting', 'merrivy-creative-workspace'],
    rule: 'Deconstruct winning viral videos + competitor research into 20 4:5 statics (10 Problem-Aware + 10 Solution-Aware) + 5 evergreen captions & 5 headlines in Google Flow.',
  },
  checklist: {
    id: 'checklist',
    label: 'Step 6 · Checklist',
    short: 'Checklist',
    slug: 'checklist',
    agents: ['store-builder'],
    skills: ['grimoire-storefront-and-checklist', 'merrivy-shopify-workspace'],
    rule: 'Verify all 7/7 pre-launch storefront, copy, 2-Kit, Shopify Admin, Meta Pixel, and Amy/CJ supplier gates.',
  },
  launch: {
    id: 'launch',
    label: 'Step 7 · Launch',
    short: 'Launch',
    slug: 'launch',
    agents: ['ad-manager', 'store-builder'],
    skills: ['meta-ads-manage-and-3day-kill', 'merrivy-os'],
    rule: 'Stage the $50/day broad CBO campaign with Shaunn KPI guardrails and launch into Manage.',
  },
  manage: {
    id: 'manage',
    label: 'Manage',
    short: 'Manage',
    slug: 'manage',
    agents: ['ad-manager', 'image-maker', 'store-builder'],
    skills: ['meta-ads-manage-and-3day-kill', 'winning-statics', 'google-flow-creative-studio', 'grimoire-storefront-and-checklist'],
    rule: 'Sync live Meta & Shopify daily numbers, hold 3-Day Algorithm Priming, and enforce End-of-Day 3 Scale or Cut.',
  },
};

export const DISPLAY_LINE = [
  {id:'product', short:'Product', steps:['product'], slug:'find', title:'Product catalog', goal:'What the scraper keeps after our keywords and hard filters. The agents test it from here.', ...PIPELINE_STEP_SKILLS.product},
  {id:'verify', short:'Verify', steps:['buyers','prove'], slug:'verify', title:'Verify', goal:'The hardest checks we have. Most products die here, and the survivors go to Winners.', ...PIPELINE_STEP_SKILLS.verify},
  {id:'winners', short:'Winners', steps:['prove'], slug:'winners', title:'Winners', goal:'Verified winners: deep avatar angles, buyer reviews, pricing & margins, and how the product sells. Choose the 1–2 products to build.', ...PIPELINE_STEP_SKILLS.winners},
  {id:'build', short:'Store', steps:['build'], slug:'build', title:'Store', goal:'Build the store and Shopify Admin setup for the chosen product, with the live Store on the right.', ...PIPELINE_STEP_SKILLS.build},
  {id:'creatives', short:'Creatives', steps:['create'], slug:'create', title:'Creatives', goal:'The 9:16 creator videos and 4:5 static ads for the chosen product.', ...PIPELINE_STEP_SKILLS.creatives},
  {id:'checklist', short:'Checklist', steps:['launch'], slug:'checklist', title:'Checklist', goal:'The 7-point storefront, copy, Shopify Admin + Meta Pixel, and Amy/Alibaba supplier checklist next to the mobile site preview.', ...PIPELINE_STEP_SKILLS.checklist},
  {id:'launch', short:'Launch', steps:['launch','learn'], slug:'launch', title:'Launch', goal:'Everything about launching the ads: set the daily CBO budget and guardrails, review the ad pack, and launch.', ...PIPELINE_STEP_SKILLS.launch},
];

/** The display step a saved step id belongs to. */
export function displayIdOfStep(stepId) {
  if (stepId === 'create') return 'creatives';
  if (stepId === 'build') return 'build';
  if (stepId === 'launch') return 'checklist';
  if (stepId === 'learn') return 'launch';
  return DISPLAY_LINE.find(entry => entry.steps.includes(stepId))?.id || 'product';
}

/** A record's short product id: "P007-2-pack-…" and "P007" both give "P007"; L### cards keep theirs. */
export function shortProductId(value) {
  const text = String(value || '');
  return (text.match(/^[PL]\d{3,}/) || [text])[0];
}

/** Whether a Meta Ads campaign has already been launched (graduated to Manage). */
export function isCampaignLaunched(campaign) {
  if (!campaign) return false;
  if (campaign.launched === false || campaign.status === 'DRAFT' || campaign.status === 'READY' || campaign.status === 'READY_TO_LAUNCH') {
    return false;
  }
  return Boolean(
    campaign.launched ||
    campaign.status === 'ACTIVE' ||
    Number(campaign?.summaryLifetime?.spend || 0) > 0 ||
    Number(campaign?.summaryToday?.spend || 0) > 0
  );
}

/** Done / total for one product's saved Launch Checklist (checklists = GET /api/launch-checklists). */
export function checklistScore(checklists, productId) {
  const items = checklists?.items || [];
  const record = checklists?.products?.[shortProductId(productId)] || {};
  const done = items.filter(item => record.items?.[item.id]?.done).length;
  return {done, total: items.length, complete: items.length > 0 && done === items.length, record};
}

function itemChecklistComplete(item, checklists) {
  return [item.productId, item.id].filter(Boolean).some(id => checklistScore(checklists, id).complete);
}

/** The active products at one of the seven pipeline stations, for its thumbnails and counts. */
export function stationItems(pipeline, checklists, stationId) {
  const launchIndex = STEP_IDS.indexOf('launch');
  const learnIndex = STEP_IDS.indexOf('learn');
  const entry = DISPLAY_LINE.find(step => step.id === stationId);
  if (!entry) return [];
  return (pipeline?.active || []).filter(item => {
    if (stationId === 'winners') return Boolean(item.readyToBuild);
    if (stationId === 'verify') return entry.steps.includes(STEP_IDS[item.stepIndex]) && !item.readyToBuild;
    if (stationId === 'checklist') return item.stepIndex === launchIndex && !item.readyToBuild && !itemChecklistComplete(item, checklists);
    if (stationId === 'launch') {
      if (item.stepIndex === learnIndex) return true;
      return item.stepIndex === launchIndex && !item.readyToBuild && itemChecklistComplete(item, checklists);
    }
    return entry.steps.includes(STEP_IDS[item.stepIndex]) && !item.readyToBuild;
  });
}

/** The seven pipeline stations the owner sees, counted from the saved pipeline and checklists. */
export function displayStations(pipeline, checklists) {
  const base = stepStations(pipeline);
  const byId = Object.fromEntries(base.map(station => [station.id, station]));
  const launchIndex = STEP_IDS.indexOf('launch');
  const atLaunch = (pipeline?.active || []).filter(item => item.stepIndex === launchIndex && !item.readyToBuild);
  const launchReady = atLaunch.filter(item => itemChecklistComplete(item, checklists)).length;
  const launchedCount = byId.learn?.count || 0;
  const winnersReady = byId.prove?.ready || 0;
  return DISPLAY_LINE.map((entry, index) => {
    const parts = entry.steps.map(id => byId[id]).filter(Boolean);
    let count = parts.reduce((sum, part) => sum + part.count, 0);
    if (entry.id === 'winners') count = winnersReady;
    if (entry.id === 'checklist') count = atLaunch.length - launchReady;
    if (entry.id === 'launch') {
      count = launchReady + launchedCount;
      if (Array.isArray(checklists?.metaCampaigns)) {
        const unlaunchedCampaigns = checklists.metaCampaigns.filter(c => !isCampaignLaunched(c)).length;
        count = Math.max(count, unlaunchedCampaigns);
      }
    }
    const ready = entry.id === 'winners' ? winnersReady : 0;
    const owner = entry.id === 'winners'
      ? winnersReady > 0
      : entry.id === 'launch'
      ? launchReady > 0
      : entry.id === 'checklist' || entry.id === 'verify'
      ? false
      : entry.id === 'product'
      ? (pipeline?.ownerMoves || []).some(move => move.kind === 'eye-test')
      : parts.some(part => part.owner);
    const label = entry.id === 'winners'
      ? (winnersReady ? `${winnersReady} verified winner${winnersReady === 1 ? '' : 's'} ready to choose` : 'none')
      : count
      ? `${count} product${count === 1 ? '' : 's'}`
      : 'none';
    const target = entry.slug;
    return {...entry, index, number: index + 1, name: entry.short, count: entry.id === 'winners' ? 0 : count, ready, owner, label, target, stepIndexes: entry.steps.map(id => STEP_IDS.indexOf(id))};
  });
}
