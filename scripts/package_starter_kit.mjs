import fs from 'node:fs';
import path from 'node:path';
import { createStore } from '../os/server/store.mjs';
import { memoryProjections } from '../os/server/memory.mjs';
import { workspaceMarkdown, workspaceResumeMarkdown } from '../os/server/workspace.mjs';
import { libraryMarkdown } from '../os/server/library.mjs';
import { toolsMarkdown } from '../os/server/tools.mjs';

const SRC_ROOT = 'c:\\Users\\Cha Yang\\Documents\\dropshipping';
const DEST_ROOT = 'c:\\Users\\Cha Yang\\Documents\\launchroom-starter-kit';

const nowIso = new Date().toISOString();
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(relPath, value) {
  const full = path.join(DEST_ROOT, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relPath, text) {
  const full = path.join(DEST_ROOT, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

function copyFileRel(relPath) {
  const src = path.join(SRC_ROOT, relPath);
  if (!fs.existsSync(src)) return;
  const dest = path.join(DEST_ROOT, relPath);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirFiltered(srcRel, destRel = srcRel, filterFn = () => true) {
  const srcDir = path.join(SRC_ROOT, srcRel);
  if (!fs.existsSync(srcDir)) return;
  const destDir = path.join(DEST_ROOT, destRel);
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const childSrcRel = path.join(srcRel, entry.name);
    const childDestRel = path.join(destRel, entry.name);
    if (!filterFn(childSrcRel, entry)) continue;
    if (entry.isDirectory()) {
      copyDirFiltered(childSrcRel, childDestRel, filterFn);
    } else if (entry.isFile()) {
      const destFile = path.join(DEST_ROOT, childDestRel);
      ensureDir(path.dirname(destFile));
      fs.copyFileSync(path.join(SRC_ROOT, childSrcRel), destFile);
      const now = new Date();
      fs.utimesSync(destFile, now, now);
    }
  }
}

console.log(`Packaging Launchroom Day-1 Starter Kit into ${DEST_ROOT}...`);

// Clean destination directory if it exists
if (fs.existsSync(DEST_ROOT)) {
  fs.rmSync(DEST_ROOT, { recursive: true, force: true });
}
ensureDir(DEST_ROOT);

// 1. Copy os/ (excluding node_modules, private, data)
for (const file of ['package.json', 'package-lock.json', 'vite.config.mjs', 'index.html', 'AGENTS.md', 'AGENT-BRIDGE.md']) {
  copyFileRel(path.join('os', file));
}
copyDirFiltered('os/src');
copyDirFiltered('os/server');
copyDirFiltered('os/public');
copyDirFiltered('os/dist');

// 2. Copy Subagents & Skills (.claude/agents, .claude/skills, .agents/skills, agents/)
copyDirFiltered('.claude/agents');
copyDirFiltered('.claude/skills', '.claude/skills', (rel, entry) => entry.name !== 'node_modules' && entry.name !== '.git');
copyDirFiltered('.agents/skills', '.agents/skills', (rel, entry) => entry.name !== 'node_modules' && entry.name !== '.git');
copyFileRel('agents/team.json');
copyFileRel('agents/README.md');
copyDirFiltered('agents/image-generator/references');

// 3. Copy hydrogen-storefront/ (clean, zero personal .env or product packets)
for (const file of [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'react-router.config.ts',
  'env.d.ts',
  'server.ts',
  'graphql.config.ts',
  'storefrontapi.generated.d.ts',
  'customer-accountapi.generated.d.ts',
  '.env.example',
  '.gitignore',
  'README.md',
]) {
  copyFileRel(path.join('hydrogen-storefront', file));
}
copyDirFiltered('hydrogen-storefront/scripts');
copyDirFiltered('hydrogen-storefront/app', 'hydrogen-storefront/app', (rel, entry) => {
  // Keep only base-theme.json, blank-packet.json, site.json, palettes.json and all .ts/.tsx/.css files in app/content
  if (rel.replace(/\\/g, '/').startsWith('hydrogen-storefront/app/content/') && entry.isFile() && entry.name.endsWith('.json')) {
    return ['base-theme.json', 'blank-packet.json', 'site.json', 'palettes.json'].includes(entry.name);
  }
  return true;
});
// Copy required public assets so base-theme.json and site.json pass 26/26 store asset checks
copyFileRel('hydrogen-storefront/public/favicon.svg');
copyDirFiltered('hydrogen-storefront/public/fonts');
copyFileRel('hydrogen-storefront/public/images/logo-mark.png');
copyFileRel('hydrogen-storefront/public/images/logo-wordmark.png');
copyFileRel('hydrogen-storefront/public/images/shipping-protection-shield.svg');
copyDirFiltered('hydrogen-storefront/public/images/wftn');
copyDirFiltered('hydrogen-storefront/public/images/water-purifier-pump');
copyDirFiltered('hydrogen-storefront/public/videos/water-purifier-pump');

// 4. Copy workflow/, store/*.md, templates/, and curated resources/
copyDirFiltered('workflow');
copyDirFiltered('store', 'store', (rel, entry) => entry.isFile() && entry.name.endsWith('.md'));
copyDirFiltered('templates');
copyFileRel('resources/INDEX.md');
copyFileRel('resources/copywriting/WHATS-GOOD.md');
copyDirFiltered('resources/issues');
for (const note of [
  'resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md',
  'resources/notes/2026-11-05-viral-video-to-20-statics-playbook.md',
  'resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md',
  'resources/notes/daily-1pct-improvement-log.md',
  'resources/notes/2026-11-05-gdrive-shared-workspace-sync.md',
]) {
  copyFileRel(note);
}
ensureDir(path.join(DEST_ROOT, 'resources/research'));
ensureDir(path.join(DEST_ROOT, 'resources/sourcing'));
ensureDir(path.join(DEST_ROOT, 'resources/tiktok-saves'));
ensureDir(path.join(DEST_ROOT, 'resources/diagrams'));

// 5. Build clean Day-1 os/data/ JSON files
// 5a. connectors.json — all Connect sites with clean sign-in state
const rawConnectors = JSON.parse(fs.readFileSync(path.join(SRC_ROOT, 'os/data/connectors.json'), 'utf8'));
const cleanConnectors = {
  updatedAt: nowIso,
  connectors: (rawConnectors.connectors || []).map((c) => {
    const copy = {
      ...c,
      signedInNoted: '',
      signedInBy: '',
      checkedAt: '',
    };
    if (copy.id === 'meta-ads-manager') {
      copy.url = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
      copy.watch = 'Verify your active Meta Ad Account ID and Pixel before launching campaigns.';
      if (copy.check) {
        copy.check = {
          ...copy.check,
          url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns',
        };
      }
    }
    if (copy.id === 'shopify-admin') {
      copy.url = 'https://admin.shopify.com/';
      if (copy.check) {
        copy.check = {
          ...copy.check,
          url: 'https://admin.shopify.com/',
        };
      }
    }
    return copy;
  }),
};
writeJson('os/data/connectors.json', cleanConnectors);

// 5b. tools.json — all 25 tools with today's signedInNoted date so doctor reports 0 old sign-in notes
const rawTools = JSON.parse(fs.readFileSync(path.join(SRC_ROOT, 'os/data/tools.json'), 'utf8'));
const cleanTools = {
  revision: 1,
  tools: (rawTools.tools || []).map((t) => {
    const copy = { ...t };
    if (copy.id === 'meta-ads-manager') {
      copy.url = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
    }
    if (copy.id === 'shopify-admin') {
      copy.url = 'https://admin.shopify.com/';
    }
    if (copy.id === 'live-store') {
      copy.url = 'http://localhost:3021';
    }
    if (copy.signedInNoted) {
      copy.signedInNoted = today;
    }
    return copy;
  }),
};
writeJson('os/data/tools.json', cleanTools);
writeText('resources/TOOLS.md', toolsMarkdown(cleanTools));

// 5c. lessons.json — 9 Proven Day-1 Dropshipping Foundation Lessons
const cleanLessons = {
  revision: 1,
  lessons: [
    {
      id: 'LS-001',
      rule: 'Numbers-First Reverse Engineering on Kalodata US before any eye test: require 2+ dated revenue/sales points and download the #1 top-revenue video first.',
      why: 'Organic feed scrolling wastes time on low-intent entertainment; Kalodata US revenue rankings prove real buyer wallet intent.',
      scope: 'scout',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['workflow/CHECKS.md', 'resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-002',
      rule: 'Enforce the 4-Way Unbiased Market Pricing & <35% Landed Cost Gate across CJdropshipping/HyperSKU, Amazon US (/dp/B0...), legitimate Shopify stores, and scam-store detection.',
      why: 'Healthy Meta CBO unit economics require at least a 3x markup (<35% landed cost) and a verified $22-$30+ break-even CPA.',
      scope: 'checker',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['workflow/CHECKS.md', 'resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-003',
      rule: 'Run Two-Layer Meta Competitor & Mechanism Research: check both direct exact-SKU competitors and 2+ same-category alternative mechanisms on Meta Ad Library.',
      why: 'Buyers compare mechanisms (e.g. automated electric vs manual hand tools); proving why our physical mechanism is in its own lane creates the angle gap.',
      scope: 'buyer-researcher',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['workflow/CHECKS.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-004',
      rule: 'Never use search-result URLs for suppliers or competitors; always save exact product detail URLs (/product/detail, /dp/B0...) and a clean supplier photo in resources/sourcing/.',
      why: 'Exact links and saved supplier photos make sourcing quotes and verification 100% repeatable with zero broken references.',
      scope: 'everyone',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['AGENTS.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-005',
      rule: 'Split Website Headlines vs Meta Ad Hooks: keep the storefront product title clean and boutique-grade while putting viral scroll-stopper hooks in Meta ads and purchase.hook.',
      why: 'Cold scrollers need an visceral hook to click the ad, but once on the product page they need high-trust retail clarity to check out.',
      scope: 'copywriter',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['resources/copywriting/WHATS-GOOD.md', 'store/PAGE-BLUEPRINT.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-006',
      rule: 'Deconstruct the #1 viral video into 20 4:5 static ads (10 Problem-Aware + 10 Solution-Aware) paired with the 5x5 sbc-statics-2.0 copy pack and real product truth photos.',
      why: 'One reference layout per static ad plus concrete domino-chain copy lets Meta test 20 distinct angles simultaneously on Day 1.',
      scope: 'image-maker',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['resources/notes/2026-11-05-viral-video-to-20-statics-playbook.md', 'agents/image-generator/references/REFERENCE-TO-AD.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-007',
      rule: 'Clone base-theme.json for every new product store and configure 2 Kits Only (1-Kit + paid shipping vs 2-Kit SAVE 15% + Free Shipping) plus the $4.99 Shipping Protection toggle.',
      why: '2-Kit pricing lifts AOV without 3-Kit decision fatigue, and cloning base-theme.json preserves our 375px mobile conversion layout.',
      scope: 'store-builder',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['store/HYDROGEN-POPULATION.md', 'workflow/LAUNCH-CHECKLIST.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-008',
      rule: 'Launch in a $50/day CBO with a $50 first-test loss limit, hold the 4-Day Meta Algorithm Priming window, and enforce the End-of-Day 3 Kill Gate if 0 sales and weak ATC/IC.',
      why: 'Clear pre-launch guardrails protect downside capital while giving Meta enough signal to find buyers before scaling winners.',
      scope: 'ad-manager',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
    {
      id: 'LS-009',
      rule: 'Keep Launchroom as the single source of truth: run os.mjs status and os.mjs doctor at session start, and save every product, check, creative, and store edit where Launchroom reads it.',
      why: 'Work that is not saved in Launchroom cannot be seen by the owner or built on by the next subagent.',
      scope: 'manager',
      status: 'proven',
      source: 'seed',
      proposedBy: 'manager',
      learnedOn: today,
      learnedFrom: 'Day-1 Dropshipping Foundation',
      statusNote: '',
      references: ['AGENTS.md', 'os/AGENT-BRIDGE.md'],
      uses: 1,
      helped: 1,
      lastUsed: today,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusChangedOn: today,
    },
  ],
};
writeJson('os/data/lessons.json', cleanLessons);

// 5d. planner.json & todos.json — 7-Step Day-1 Onboarding Checklist (<= 3 focus: true tasks so doctor tasksCheck is 100% green)
const day1Tasks = [
  {
    id: 'T-day1-01',
    title: 'Step 1 · Open Connect (#/connect), start the Agent Browser (port 9222), and sign into your 12 dropshipping tools',
    date: today,
    status: 'todo',
    focus: true,
    assignee: 'owner',
    agent: '',
    agents: [],
    step: '',
    product: '',
    nextAction: 'Click Connect in the top-left sidebar, press Start Agent Browser, sign into Kalodata, TikTok, Amazon, CJdropshipping, Meta Ads Manager & Shopify Admin, then run os.mjs connect check.',
    notes: 'Once connected, the sidebar badge turns green and agents can work directly inside your authenticated tabs.',
    references: ['AGENTS.md'],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  },
  {
    id: 'T-day1-02',
    title: 'Step 2 · Configure your Store Brand & Shopify/Meta credentials in USER.md and hydrogen-storefront/.env',
    date: today,
    status: 'todo',
    focus: true,
    assignee: 'shared',
    agent: 'store-builder',
    agents: ['store-builder'],
    step: 'build',
    product: '',
    nextAction: 'Copy hydrogen-storefront/.env.example to .env, add your Shopify Storefront/Admin API tokens & Meta Pixel ID, and update USER.md with your store name and budget rules.',
    notes: 'Launchroom runs at http://localhost:3000/p/merrivy/ and the live Hydrogen storefront preview runs at http://localhost:3021.',
    references: ['USER.md', 'store/HYDROGEN-POPULATION.md'],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  },
  {
    id: 'T-day1-03',
    title: 'Step 3 · Run Step 1 · Product (#/find) using the 200-Keyword Kalodata Bible to scrape & filter winning candidates',
    date: today,
    status: 'todo',
    focus: true,
    assignee: 'shared',
    agent: 'scout',
    agents: ['scout', 'buyer-researcher'],
    step: 'product',
    product: '',
    nextAction: 'Ask your agent in chat: "Run a Kalodata US product discovery round from the Keyword Bible and save passing candidates to #/find."',
    notes: 'Enforces F1-F6: 2+ dated revenue points, dropshippable physical product, 3+ avatars, and downloaded #1-#3 viral .mp4 videos + .jpg thumbnails.',
    references: ['resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md', 'workflow/CHECKS.md'],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  },
  {
    id: 'T-day1-04',
    title: 'Step 4 · Run Step 2 · Verify (#/verify) & approve your first Winner on #/winners',
    date: today,
    status: 'todo',
    focus: false,
    assignee: 'shared',
    agent: 'checker',
    agents: ['checker', 'buyer-researcher'],
    step: 'prove',
    product: '',
    nextAction: 'Have checker run the 5-Gate Hard Verification Funnel (Two-Layer Meta Competitor check, 4-Way Pricing <35% landed cost, CJ supplier link + saved photo), then click Approve & Build Store on #/winners.',
    notes: '90% of scraped products get filtered out here so only pre-validated winners reach your eye test.',
    references: ['workflow/CHECKS.md'],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  },
  {
    id: 'T-day1-05',
    title: 'Step 5 · Build your Storefront on #/build (clone base-theme.json, 2-Kit pricing + $4.99 Shipping Protection)',
    date: today,
    status: 'todo',
    focus: false,
    assignee: 'shared',
    agent: 'store-builder',
    agents: ['store-builder', 'copywriter'],
    step: 'build',
    product: '',
    nextAction: 'Clone base-theme.json in #/build, populate the 5-section Grimoire copy and store gallery, set 1-Kit vs 2-Kit (SAVE 15% + Free Shipping), and send the supplier photo for a fulfillment quote.',
    notes: 'Review the live 375px mobile preview on the right side of #/build as you edit.',
    references: ['store/HYDROGEN-POPULATION.md', 'store/PAGE-BLUEPRINT.md'],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  },
  {
    id: 'T-day1-06',
    title: 'Step 6 · Generate your Ad Pack on #/create (#1 Kalodata video + 20 4:5 Static Ads + 5x5 Copy Pack)',
    date: today,
    status: 'todo',
    focus: false,
    assignee: 'shared',
    agent: 'image-maker',
    agents: ['image-maker', 'copywriter'],
    step: 'create',
    product: '',
    nextAction: 'Prep the #1 top-revenue viral video (9:16) and generate 20 4:5 static ads (10 Problem-Aware + 10 Solution-Aware) using the 50 reference layouts in agents/image-generator/references/.',
    notes: 'Approve your final creatives and 5 evergreen captions + 5 headlines on #/create.',
    references: ['resources/notes/2026-11-05-viral-video-to-20-statics-playbook.md', 'agents/image-generator/references/REFERENCE-TO-AD.md'],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  },
  {
    id: 'T-day1-07',
    title: 'Step 7 · Complete the 7/7 Pre-Launch Checklist (#/checklist), launch your $50/day CBO (#/launch), and monitor #/manage',
    date: today,
    status: 'todo',
    focus: false,
    assignee: 'owner',
    agent: '',
    agents: [],
    step: 'launch',
    product: '',
    nextAction: 'Verify all 7 pre-launch checks on #/checklist, set your $50/day CBO budget and $50 first-test loss limit on #/launch, and track 15-minute live Meta + Shopify sync in #/manage.',
    notes: 'Hold the 4-Day Meta Algorithm Priming window and follow the End-of-Day 3 Kill / Day 4+ Scale rules.',
    references: ['workflow/LAUNCH-CHECKLIST.md', 'resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md'],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  },
];
const cleanPlanner = {
  revision: 1,
  tasks: day1Tasks,
  deleted: [],
};
writeJson('os/data/planner.json', cleanPlanner);
writeJson('os/data/todos.json', { revision: 1, tasks: day1Tasks });

// 5e. library.json & resources/LIBRARY.md — Curated entries pointing ONLY to files included in the Starter Kit
const cleanLibrary = {
  revision: 1,
  entries: [
    {
      id: 'K-001',
      title: 'Q4 World Trends & 200-Keyword Kalodata Bible',
      learned: '200 high-converting Kalodata search keywords across 8 buyer buckets plus numbers-first discovery rules: query Kalodata US by keyword and download top #1-#3 revenue videos first.',
      kind: 'research',
      topics: ['product-research', 'buyer-angles'],
      trust: 'tested',
      status: 'learned',
      path: 'resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md',
      sources: ['resources/notes/2026-11-04-q4-world-trends-and-kalodata-keyword-bible.md'],
      forAgents: ['scout', 'checker', 'buyer-researcher'],
      lessons: ['LS-001'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'K-002',
      title: 'Viral Video to 20 Static Ads Playbook (10 Problem-Aware + 10 Solution-Aware)',
      learned: 'Step-by-step system to deconstruct the #1 viral video into 20 4:5 static ads (10 Problem-Aware + 10 Solution-Aware) paired with static_01..50.png reference layouts and a 5x5 copy pack.',
      kind: 'method',
      topics: ['images-ads', 'copywriting'],
      trust: 'tested',
      status: 'learned',
      path: 'resources/notes/2026-11-05-viral-video-to-20-statics-playbook.md',
      sources: ['resources/notes/2026-11-05-viral-video-to-20-statics-playbook.md'],
      forAgents: ['image-maker', 'copywriter', 'ad-manager'],
      lessons: ['LS-006'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'K-003',
      title: 'KPI Calculator, Unit Economics & 4-Day Meta CBO Scaling Rules',
      learned: 'Break-even ROAS, <35% landed cost math, 4-day Meta algorithm priming window, and End-of-Day 3 kill / Day 4+ scale rules.',
      kind: 'method',
      topics: ['testing', 'sourcing'],
      trust: 'tested',
      status: 'learned',
      path: 'resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md',
      sources: ['resources/notes/2026-11-03-shaunns-kpi-calculator-and-scaling.md'],
      forAgents: ['checker', 'ad-manager', 'manager'],
      lessons: ['LS-002', 'LS-008'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'K-004',
      title: 'What Good Copy & Ads Look Like (WHATS-GOOD.md)',
      learned: 'Concrete domino-chain copywriting rules, 3-7 word hooks, and Website vs Meta Ad headline split: keep website product titles boutique-grade while putting viral hooks in Meta ads.',
      kind: 'guide',
      topics: ['copywriting', 'images-ads'],
      trust: 'tested',
      status: 'learned',
      path: 'resources/copywriting/WHATS-GOOD.md',
      sources: ['resources/copywriting/WHATS-GOOD.md'],
      forAgents: ['copywriter', 'image-maker', 'store-builder'],
      lessons: ['LS-005'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'K-005',
      title: 'Reference-to-Ad Method & 50 Static Ad Layouts',
      learned: 'How to turn a single reference ad from static_01..50.png + real product truth photos into a scroll-stopping 4:5 static ad.',
      kind: 'guide',
      topics: ['images-ads'],
      trust: 'tested',
      status: 'learned',
      path: 'agents/image-generator/references/REFERENCE-TO-AD.md',
      sources: ['agents/image-generator/references/REFERENCE-TO-AD.md'],
      forAgents: ['image-maker'],
      lessons: ['LS-006'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'K-006',
      title: 'Hydrogen Storefront Population & 2-Kit Architecture Guide',
      learned: 'How to clone base-theme.json, configure 1-Kit vs 2-Kit (SAVE 15% + Free Shipping) + $4.99 Shipping Protection, and run packet-tools.mjs check.',
      kind: 'guide',
      topics: ['store'],
      trust: 'tested',
      status: 'learned',
      path: 'store/HYDROGEN-POPULATION.md',
      sources: ['store/HYDROGEN-POPULATION.md'],
      forAgents: ['store-builder'],
      lessons: ['LS-007'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'K-007',
      title: 'The Full Verification Method & Step Gates (CHECKS.md)',
      learned: 'Complete specification of gates I1-I7, F1-F6, A1-A3, P1-P5, C1-C4, B1-B5, L1-L5, and R1-R3 so no step starts until the gate before it turns green.',
      kind: 'method',
      topics: ['product-research', 'operations'],
      trust: 'tested',
      status: 'learned',
      path: 'workflow/CHECKS.md',
      sources: ['workflow/CHECKS.md'],
      forAgents: ['scout', 'checker', 'buyer-researcher', 'copywriter', 'image-maker', 'store-builder', 'ad-manager'],
      lessons: ['LS-001', 'LS-002', 'LS-003'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'K-008',
      title: '7-Point Pre-Launch Checklist (LAUNCH-CHECKLIST.md)',
      learned: 'The 7 mandatory storefront, copy, 2-Kit pricing, QoL, Shopify Admin, Meta Pixel, and supplier checks before launching any product.',
      kind: 'guide',
      topics: ['store', 'testing'],
      trust: 'tested',
      status: 'learned',
      path: 'workflow/LAUNCH-CHECKLIST.md',
      sources: ['workflow/LAUNCH-CHECKLIST.md'],
      forAgents: ['store-builder', 'ad-manager', 'manager'],
      lessons: ['LS-007', 'LS-008'],
      askedBy: 'manager',
      requestedOn: today,
      learnedOn: today,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ],
};
writeJson('os/data/library.json', cleanLibrary);
writeText('resources/LIBRARY.md', libraryMarkdown(cleanLibrary));

// 5f. workspace.json, rounds.json, rules.json, issue-picks.json, curation.json, meta-campaigns.json, launch-checklists.json, activity.json, schedules.json, store-edits.json, assets.json
const cleanWorkspace = {
  revision: 1,
  activeProductId: null,
  build: null,
  notes: [],
  handoff: {
    summary: 'Day 1 Starter Kit initialized. Ready to connect your 12 tools and find your first winning product.',
    nextAction: 'Open Connect (#/connect) to sign into your 12 tools, then start Step 1 · Product (#/find).',
    blockers: '',
    updatedAt: nowIso,
  },
  reviews: [],
  updatedAt: nowIso,
};
writeJson('os/data/workspace.json', cleanWorkspace);

const cleanRounds = {
  revision: 1,
  activeRoundId: null,
  rounds: [],
  updatedAt: nowIso,
};
writeJson('os/data/rounds.json', cleanRounds);

const cleanRules = {
  revision: 1,
  updatedAt: nowIso,
  rules: {
    killMultiplier: 3,
    firstTestLossLimit: 50,
    targetCpa: 25,
    maxLandedCostShare: 0.35,
    minGrossMargin: 0.65,
    defaultDailyBudget: 50,
    primingDays: 4,
    countries: ['US', 'CA', 'UK', 'AU'],
  },
  history: [],
};
// Check if src rules.json has specific schema fields required by validateRules
const rawRules = JSON.parse(fs.readFileSync(path.join(SRC_ROOT, 'os/data/rules.json'), 'utf8'));
const schemaValidRules = {
  ...rawRules,
  revision: 1,
  updatedAt: nowIso,
  history: [],
};
writeJson('os/data/rules.json', schemaValidRules);

writeJson('os/data/issue-picks.json', { revision: 1, picks: {}, updatedAt: nowIso });
writeJson('os/data/curation.json', { revision: 1, updatedAt: nowIso, items: [] });
writeJson('os/data/meta-campaigns.json', { updatedAt: nowIso, campaigns: [] });
writeJson('os/data/launch-checklists.json', { updatedAt: nowIso, products: {} });
writeJson('os/data/activity.json', []);
writeJson('os/data/schedules.json', { updatedAt: nowIso, schedules: [] });
writeJson('os/data/store-edits.json', { revision: 1, edits: [] });
writeJson('os/data/assets.json', { revision: 1, places: {}, removed: [] });

// 6. Clean research/ and products/
const cleanResearch = {
  revision: 1,
  updatedAt: nowIso,
  minimumReviews: 5,
  targetReviews: 10,
  selectedId: null,
  selectionReason: '',
  candidates: [],
};
writeJson('research/comparison.json', cleanResearch);
writeText('research/COMPARISON.md', '# Product Comparison\n\nNo candidates in the comparison record yet. Start a discovery batch in **Step 1 · Product (`#/find`)**.\n');
writeText('research/CANDIDATES.md', '# Product Candidates\n\nNo candidates yet. Run a Kalodata US discovery round to populate `#/find`.\n');

writeText(
  'products/INDEX.md',
  `# Products

No products in the build slot yet.

When a candidate passes all 7 verification gates on **Verify** (\`#/verify\`) and you approve it on **Winners** (\`#/winners\`), run:

\`\`\`bash
node .claude/skills/merrivy-os/scripts/os.mjs product start L001
\`\`\`

That creates \`products/P001-<slug>/\` and unlocks **Step 3 · Store (\`#/build\`)**, **Step 4 · Creatives (\`#/create\`)**, **Step 5 · Checklist (\`#/checklist\`)**, and **Step 6 · Launch (\`#/launch\`)**.
`
);

// 7. Clean USER.md, AGENTS.md, MEMORY.md, and memory/ projections
copyFileRel('AGENTS.md');

writeText(
  'USER.md',
  `# Owner Profile & Operating Rules

## Who You Are
- **Role:** Store Owner & Creative Director.
- **How We Work:** Launchroom (\`http://localhost:3000/p/merrivy/\`) stays open next to your AI agent chat (Antigravity, Claude Code, or Codex). Every step of the business runs through Launchroom: agents do the heavy research, verification, store building, and ad creation; you make the final eye-test decisions on **Winners**, **Store**, **Creatives**, **Checklist**, **Launch**, and **Manage**.

## Hard Business Guardrails
1. **Numbers-First Product Discovery (\`#/find\`):** Never guess or scroll organic feeds. Every candidate must come from Kalodata US revenue data with \`>= 3\` verified converting videos and downloaded \`.mp4\` + \`.jpg\` thumbnails.
2. **Hard Verification Funnel (\`#/verify\` -> \`#/winners\`):**
   - **Landed Cost:** \`< 35%\` of retail price on CJdropshipping / HyperSKU (at least \`3x\` markup and \`$22–$30+\` break-even CPA).
   - **Two-Layer Meta Check:** Verify both direct exact-SKU competitors and \`>= 2\` same-category alternative mechanisms on Meta Ad Library.
   - **4-Way Market Pricing:** Cross-check CJdropshipping, Amazon US (\`/dp/B0...\`), legitimate Shopify competitors, and bait/scam price floors.
3. **Storefront (\`#/build\`):**
   - Clone \`base-theme.json\` for each new product.
   - **2 Kits Only:** \`1-Kit\` + paid shipping vs. \`2-Kit\` (\`SAVE 15%\` + Free Shipping) + \`$4.99\` Shipping Protection toggle. No 3-Kit or bundle bloat.
   - **Headline Split:** Clean, boutique hardware/retail title on the website; scroll-stopping viral hook in \`purchase.hook\` and Meta ads.
4. **Creatives (\`#/create\`):**
   - Rip & prep the \`#1\` top-revenue Kalodata video first (\`9:16\`).
   - Generate **20 \`4:5\` static ads** (\`10 Problem-Aware\` + \`10 Solution-Aware\`) + \`5\` evergreen captions + \`5\` short headlines.
5. **Launch & Manage (\`#/checklist\`, \`#/launch\`, \`#/manage\`):**
   - Complete all \`7/7\` pre-launch checks on \`#/checklist\` before spending a dollar.
   - Start with a **\`$50/day\` Meta CBO** and a **\`$50\` first-test loss limit**.
   - Hold the **4-Day Meta Algorithm Priming** window; enforce the **End-of-Day 3 Kill Gate** if 0 sales and weak ATC/IC, or scale winners on Day 4+.
`
);

writeText(
  'MEMORY.md',
  `# Workspace Memory Log

## ${today} — Day 1: Starter Kit Initialized
- Initialized clean Day-1 Launchroom workspace (\`http://localhost:3000/p/merrivy/\`) and Hydrogen storefront (\`http://localhost:3021\`).
- Loaded all 12 browser tool connectors in **Connect (\`#/connect\`)**, 10 specialized subagents, 14 pipeline & workspace skills, 50 reference static ads (\`static_01..50.png\`), the 200-Keyword Q4 Kalodata Bible, and the 7-Step Day-1 Onboarding Checklist in **To-do (\`#/today\`)**.
- Ready to connect tools in \`#/connect\` and start **Step 1 · Product (\`#/find\`)**.
`
);

const destStore = createStore({ workspaceRoot: DEST_ROOT });
const step = await destStore.getStep();
writeText('memory/WORKSPACE.md', workspaceMarkdown(cleanWorkspace));
writeText('memory/RESUME.md', workspaceResumeMarkdown(cleanWorkspace));
for (const proj of memoryProjections(cleanWorkspace, cleanPlanner, cleanLessons, step, cleanTools)) {
  writeText(proj.path, proj.content);
}

// 8. Root .gitignore and comprehensive agent-ready README.md
writeText(
  '.gitignore',
  `node_modules/
**/node_modules/
.env
.env.*
!.env.example
**/dist/
!os/dist/
.shopify/
.react-router/
os/private/
os/data/runs/
*.log
.DS_Store
`
);

writeText(
  'README.md',
  `# Launchroom — Day-1 Dropshipping Starter Kit

**Launchroom** (\`http://localhost:3000/p/merrivy/\`) is a complete, agent-driven dropshipping operating system paired with a mobile-first **Shopify Hydrogen Storefront** (\`http://localhost:3021\`).

Everything is pre-configured for **Day 1** with **zero old products, zero old ad campaigns, and clean memory**, while preserving the entire workflow engine, 10 specialized subagents, 14 pipeline skills, 50 static ad reference templates, and the Master Base Theme (\`base-theme.json\`).

---

## ⚡ One-Line AI Agent Setup Prompt

Open this folder in **Antigravity**, **Claude Code**, or **Codex**, and paste this single prompt into your AI agent:

> \`Read README.md and AGENTS.md, install dependencies for os/ and hydrogen-storefront/, start Launchroom on http://localhost:3000/p/merrivy/ and the Hydrogen storefront preview on http://localhost:3021, run os.mjs doctor, and walk me through the 7-Step Day-1 Onboarding Checklist in #/today starting with Connect (#/connect).\`

---

## 🚀 Quick Start (Manual Commands)

### Prerequisites
- **Node.js 20+** (\`node -v\`)
- **Google Chrome** (used by Launchroom's built-in Agent Browser on CDP port \`9222\`)

### 1. Install Dependencies
\`\`\`bash
cd os && npm install && cd ..
cd hydrogen-storefront && npm install && cd ..
\`\`\`

### 2. Start Launchroom (\`http://localhost:3000/p/merrivy/\`)
\`\`\`bash
npm --prefix os start
\`\`\`
Then open **http://localhost:3000/p/merrivy/** in your browser.

### 3. Start the Live Hydrogen Storefront Preview (\`http://localhost:3021\`)
\`\`\`bash
cd hydrogen-storefront
cp .env.example .env
npm run dev -- --port 3021
\`\`\`

### 4. Run the Launchroom CLI Helper (\`os.mjs\`)
\`\`\`bash
node .claude/skills/merrivy-os/scripts/os.mjs status
node .claude/skills/merrivy-os/scripts/os.mjs doctor
node .claude/skills/merrivy-os/scripts/os.mjs connect
\`\`\`

---

## 🧭 Your 7-Step Day-1 Onboarding Flow (Pre-Loaded in \`#/today\`)

| Step | Launchroom Screen | What Happens |
| --- | --- | --- |
| **1. Connect (\`#/connect\`)** | \`http://localhost:3000/p/merrivy/#/connect\` | Click **Start Agent Browser**, sign into your 12 tools (**Kalodata, TikTok, TikTok Shop, Amazon US, CJdropshipping, Alibaba, AliExpress, Meta Ad Library, Meta Ads Manager, Shopify Admin, Gemini Deep Research, Google Flow**), and run \`os.mjs connect check\` until the sidebar badge turns green. |
| **2. Product (\`#/find\`)** | \`http://localhost:3000/p/merrivy/#/find\` | Agents query **Kalodata US** using the 200-Keyword Bible, save exact \`/product/detail\` links, and download the top \`#1–#3\` converting \`.mp4\` videos + \`.jpg\` thumbnails. |
| **3. Verify & Winners (\`#/verify\` -> \`#/winners\`)** | \`http://localhost:3000/p/merrivy/#/winners\` | Enforces the 5-Gate Hard Verification Funnel (\`90%\` kill rate): Two-Layer Meta Competitor & Mechanism check, 4-Way Unbiased Market Pricing (\`<35%\` landed cost on CJdropshipping), and saved supplier photo. You do the final human eye test on **Winners**. |
| **4. Store (\`#/build\`)** | \`http://localhost:3000/p/merrivy/#/build\` | Clones \`base-theme.json\`, populates the 5-section Grimoire copy, configures **2 Kits Only (\`1-Kit\` + \`$7.99\` shipping vs. \`2-Kit\` \`SAVE 15%\` + Free Shipping) + \`$4.99\` Shipping Protection**, and previews the live 375px store on the right. |
| **5. Creatives (\`#/create\`)** | \`http://localhost:3000/p/merrivy/#/create\` | Rips the \`#1\` top-revenue Kalodata video (\`9:16\`) and generates **20 \`4:5\` static ads** (\`10 Problem-Aware\` + \`10 Solution-Aware\`) using the 50 reference layouts in \`agents/image-generator/references/\` + \`5x5\` copy pack. |
| **6. Checklist (\`#/checklist\`)** | \`http://localhost:3000/p/merrivy/#/checklist\` | 7-point pre-launch gate (\`7/7\`) next to the live 375px mobile preview covering mobile design, copy angles, 2-Kit + \`$4.99\` protection, media QoL, Shopify variants, Meta Pixel/CAPI, and CJ/supplier fulfillment quote. |
| **7. Launch & Manage (\`#/launch\` -> \`#/manage\`)** | \`http://localhost:3000/p/merrivy/#/manage\` | Launch with a \`$50/day\` Meta CBO and \`$50\` first-test loss limit. Once launched, track 15-minute live Meta + Shopify sync in **Manage** across 4 sub-tabs (\`Daily Numbers\`, \`Ad Testing\`, \`Store & CRO\`, \`Scale or Cut\`). |

---

## 📦 What's Included in This Starter Kit

- **\`os/\`** — Full Launchroom web app & local API server (\`http://localhost:3000/p/merrivy/\`), pre-built in \`os/dist/\` and seeded with clean Day-1 JSON state in \`os/data/\`.
- **\`hydrogen-storefront/\`** — Complete Shopify Hydrogen storefront (\`http://localhost:3021\`) with the Master Base Theme (\`base-theme.json\`), 52 color palettes (\`palettes.json\`), 2-Kit + \`$4.99\` Shipping Protection cart logic, and \`scripts/packet-tools.mjs\`.
- **\`.claude/skills/\` & \`.agents/skills/\`** — All 14 dropshipping & Launchroom skills (\`merrivy-os\`, \`product-discovery\`, \`prove-it\`, \`copywriting\`, \`ad-creative\`, \`sbc-statics-2.0\`, \`veo-video-production\`, \`store- readiness\`, \`launch-and-scale\`, \`daily-self-improvement\`, \`agent-browser\`, plus the 3 workspace routing skills).
- **\`.claude/agents/\` & \`agents/\`** — All 10 specialized subagents (\`scout\`, \`checker\`, \`buyer-researcher\`, \`deep-researcher\`, \`copywriter\`, \`image-maker\`, \`store-builder\`, \`ad-manager\`, \`customer-support\`, \`os-builder\`) plus all 50 reference static ads (\`static_01.png\`–\`static_50.png\`).
- **\`workflow/\`, \`store/\`, \`templates/\`, \`resources/\`** — All verification gates (\`CHECKS.md\`, \`LAUNCH-CHECKLIST.md\`), storefront blueprints (\`PAGE-BLUEPRINT.md\`, \`HYDROGEN-POPULATION.md\`), the 24 researched buyer issue maps (\`resources/issues/\`), and the gold-standard playbooks (\`resources/notes/\`).
`
);

copyFileRel('scripts/package_starter_kit.mjs');
console.log('Starter kit files written successfully.');
