// Subagents & Skills (owner, Nov 5): "bring in skills that we curate or make over time for designing or doing
// anything. the subagents for me, are more indepth. they are a combination of skills and workflow understanding."
//
// Pure: skills sorted onto shelves, with no list to keep up, and a subagent's steps on the owner's pipeline. A new
// skill lands on a shelf from its own name and description; `shelf: <id>` in its front matter overrides that.
import {DISPLAY_LINE, displayIdOfStep} from './displayLine.mjs';

/** In order: the first shelf whose words match wins, trying a skill's name first and then its description. */
export const SKILL_SHELVES = [
  {id: 'video', title: 'Video & motion', words: /hyperframes|\bvideo|animation|motion|media-use|\baudio\b/i},
  {id: 'build', title: 'Building & code', words: /codebase|\bcode\b|\bbugs?\b|\bmerge\b|architecture|domain model|\brepo\b/i},
  {id: 'images', title: 'Design & images', words: /\bdesign|\bimages?\b|graphic|visual|palette|\bbrand|\bchart|dataviz/i},
  {id: 'copy', title: 'Copy & ads', words: /\bcopy|headline|native ad|\bmeta ads?\b/i},
  {id: 'store', title: 'Store & Shopify', words: /shopify|storefront|hydrogen/i},
  {id: 'research', title: 'Research', words: /research|investigat|discovery|kalodata/i},
  {id: 'plan', title: 'Planning & thinking', words: /\bplan|grill|interview|\bspec\b|ticket|handoff|\bteach|triage|wayfinder|to-spec|to-tickets/i},
  {id: 'launchroom', title: 'Launchroom', words: /merrivy-os|launchroom/i},
  {id: 'other', title: 'Everything else', words: null},
];

export function shelfOf(skill) {
  if (SKILL_SHELVES.some(shelf => shelf.id === skill?.shelf)) return skill.shelf;
  for (const text of [skill?.name, skill?.description]) {
    const found = SKILL_SHELVES.find(shelf => shelf.words?.test(String(text || '')));
    if (found) return found.id;
  }
  return 'other';
}

/** "hyperframes-keyframes" reads "Hyperframes keyframes". */
export const skillTitle = name => {
  const words = String(name || '').replace(/-/g, ' ').replace(/\b(os|cli|qa)\b/g, word => word.toUpperCase()).trim();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
};

/** A skill's description, cut to its first sentence. */
export function skillLine(description, limit = 120) {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  const first = text.match(/^.+?[.!?](?=\s|$)/)?.[0] || text;
  return first.length > limit ? `${first.slice(0, limit - 1).trimEnd()}…` : first;
}

/** The shelves that have something on them, after a search and one chosen shelf. Skills someone uses come first. */
export function shelfGroups(skills = [], {query = '', shelf = ''} = {}) {
  const words = String(query).trim().toLowerCase();
  const shown = skills.filter(skill => (!shelf || shelfOf(skill) === shelf) && (!words || `${skill.name} ${skill.description}`.toLowerCase().includes(words)));
  return SKILL_SHELVES.map(entry => ({
    id: entry.id,
    title: entry.title,
    skills: shown.filter(skill => shelfOf(skill) === entry.id).sort((a, b) => (b.usedBy?.length || 0) - (a.usedBy?.length || 0) || String(a.name).localeCompare(String(b.name))),
  })).filter(group => group.skills.length);
}

/** How many skills sit on each shelf, for the filter chips. */
export function shelfCounts(skills = []) {
  return SKILL_SHELVES.map(entry => ({id: entry.id, title: entry.title, count: skills.filter(skill => shelfOf(skill) === entry.id).length})).filter(entry => entry.count);
}

/**
 * The steps a subagent works, on the owner's pipeline. `agent.workflow` holds the saved steps from
 * workflow/the-line.json, where each step names its agents. Manage has its own tab, so it keeps its own name.
 */
export function agentSteps(agent) {
  const seen = new Map();
  for (const step of agent?.workflow || []) {
    const entry = step.id === 'learn' ? {id: 'manage', short: 'Manage', slug: 'manage'} : DISPLAY_LINE.find(line => line.id === displayIdOfStep(step.id));
    if (!entry) continue;
    if (!seen.has(entry.id)) seen.set(entry.id, {id: entry.id, name: entry.short, slug: entry.slug, purpose: step.purpose || '', doneWhen: step.doneWhen || ''});
  }
  return [...seen.values()];
}
