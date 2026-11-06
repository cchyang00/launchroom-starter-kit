// What a team agent can usefully do when nothing is assigned to it (cold-start
// test, Oct 1: a fresh agent with an empty to-do list had no next move).
// Pure: worked out from the saved pipeline (pipelineState), the issue files
// (GET /api/issues) and the topic map (resources/issues/TOPICS.md). It only
// suggests; nothing here queues, starts or passes anything.
import {plainText, ISSUES_ROOT} from './issues.mjs';

export const TOPICS_PATH = `${ISSUES_ROOT}/TOPICS.md`;
/** The idle block stays short: every brief is read before every job. */
export const IDLE_BLOCK_WORDS = 90;
export const IDLE_LINES = 3;

/**
 * The topic map's table rows: {number, issue, status}. "Next to research"
 * rows are the buyer researcher's queue, in table order.
 */
export function parseTopics(markdown) {
  const rows = [];
  for (const raw of String(markdown ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const cells = line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
    if (cells.length < 3) continue;
    const issue = plainText(cells[1]).replace(/^["“]+|["”]+$/g, '').trim();
    const status = plainText(cells.at(-1));
    rows.push({number: Number(cells[0]), issue, status, next: /next to research/i.test(status)});
  }
  return rows;
}

const clip = (value, max) => { const s = String(value ?? '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const ids = (items, max = 4) => `${items.slice(0, max).map(item => item.id).join(', ')}${items.length > max ? ` and ${items.length - max} more` : ''}`;

/**
 * Up to IDLE_LINES suggestions for `agent`, most useful first. Each is one
 * plain sentence with the command or file to start from.
 */
export function idleWork({agent = '', pipeline = null, issues = [], topics = []} = {}) {
  if (!agent || agent === 'manager') return [];
  const active = pipeline?.active || [];
  const at = step => active.filter(item => item.stepId === step && !item.outcome && !item.readyToBuild);
  const round = pipeline?.round?.open ? pipeline.round : null;
  const roundIssue = round?.issue ? issues.find(issue => issue.slug === round.issue) : null;
  const building = pipeline?.building || null;
  const next = topics.filter(row => row.next);
  const out = [];
  const waitForBuild = 'Nothing to make until the owner picks a product with "Build this one" (Pipeline).';
  switch (agent) {
    case 'scout': {
      // Owner, Oct 3: the issue list first (step 0); a round searches for products that match an issue the owner is testing.
      const testing = issues.filter(issue => issue.status === 'testing').map(issue => issue.slug);
      if (round) out.push(`Find more Round ${round.number} cards where the sales numbers are hitting (Step 1, F1-F6 in workflow/CHECKS.md: statistics first, dropshippable, a good product)${roundIssue ? `; its issue: ${roundIssue.slug}` : ''}: \`os.mjs step\`.`);
      else if (testing.length) out.push(`Ask the manager to start a round from a Testing issue (${testing.slice(0, 3).join(', ')}): \`os.mjs round start --issue <slug> --focus "..."\`; its product types are your search list.`);
      else out.push(`No issue is being tested yet: the owner picks a couple of Verified issues on the Issues page (#/issues). Meanwhile ask the manager for a focus round (\`os.mjs round start --focus "..."\`).`);
      break;
    }
    case 'buyer-researcher': {
      // Owner, Oct 2: Step 2 Buyers researches a saved product's own buyers. Oct 3: the issue list (step 0) is cross-referenced ahead of time.
      const buyers = at('buyers');
      const candidates = issues.filter(issue => issue.status === 'candidate' && Array.isArray(issue.checks));
      const open = issue => issue.checks.filter(check => check.state !== 'passed').map(check => check.id).join(', ');
      if (buyers.length) out.push(`Research the buyers of ${ids(buyers)} at Step 2 · Buyers: TikTok comments, 2-4 star reviews and forums (15+ quotes, 2+ avatars, the angle gap), \`os.mjs product ${buyers[0].id}\`.`);
      else if (candidates.length) out.push(`Nothing waits at Buyers. Cross-reference a Candidate issue (step 0): ${candidates[0].slug} (open ${open(candidates[0])}), ${candidates[0].missingFile ? `${ISSUES_ROOT}/${candidates[0].slug}/` : candidates[0].path || `${ISSUES_ROOT}/${candidates[0].slug}/ISSUE.md`}; the I1-I7 lines are in templates/ISSUE.md.`);
      else if (next.length) out.push(`Nothing waits at Buyers. Start a new issue (step 0): #${next[0].number} "${clip(next[0].issue, 60)}" (${TOPICS_PATH}, Next to research), from templates/ISSUE.md.`);
      else out.push('Nothing waits at Buyers: the owner\'s eye test (Save) comes first.');
      break;
    }
    case 'checker': {
      const prove = at('prove');
      if (prove.length) out.push(`Prove it on ${ids(prove)}: opening, exact item, delivery, money line and sample (P1-P5), \`os.mjs product ${prove[0].id}\`.`);
      if (!out.length) out.push('Nothing is at Prove it: the owner\'s Save and Step 2 · Buyers come first.');
      break;
    }
    case 'copywriter':
    case 'image-maker':
      if (building?.stepId === 'create') out.push(`Create for ${building.productId} in the build slot: \`os.mjs product ${building.productId}\`.`);
      else if (building) out.push(`${building.productId} holds the build slot at ${building.stepName}: ask the manager what it needs from you.`);
      else out.push(waitForBuild);
      break;
    case 'store-builder':
      if (building) out.push(`${building.productId} holds the build slot at ${building.stepName}: \`os.mjs product ${building.productId}\`.`);
      else out.push(waitForBuild);
      break;
    case 'ad-manager':
      out.push('Sync live Meta & Shopify numbers (`POST /api/meta-campaigns {action:"sync"}`) and audit Daily Numbers, Ad Testing, and Day 1–3 Scale or Cut rules in Manage (`#/manage`).');
      break;
    case 'os-builder':
      out.push('Run `os.mjs doctor` and fix what it lists; ask the manager for Launchroom bugs.');
      break;
    default:
      break;
  }
  if (!out.length) return [];
  if (agent !== 'os-builder' && out.length < IDLE_LINES) out.push(`Meanwhile, read what we know for your work: \`os.mjs library list --for ${agent}\`.`);
  return out.slice(0, IDLE_LINES);
}

/** The brief section shown only when nothing is assigned to the agent. */
export function idleMarkdown(lines = []) {
  if (!lines.length) return '';
  return `## Nothing assigned? Useful now\n\n${lines.map(line => `- ${line}`).join('\n')}\n\nAdd it to Today first (\`os.mjs add "..." --agent <you>\`) or ask the manager.\n\n`;
}
