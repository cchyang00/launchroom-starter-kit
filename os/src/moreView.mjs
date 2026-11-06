// The More page (#/more): everything behind the scenes, as doors with one live
// number each. Pure, so server/moreView.test.mjs can check it. The owner, Nov 5:
// "it's a tab that we have not worked with before, I don't know what should even
// go in there." It holds what keeps the team running (memory, rules, health,
// tools, files, settings), the guides agents follow, and the older records we
// keep for reference. Nothing here passes, fails or changes a record.

/** Pages that live behind More: the sidebar marks More while one of them is open. */
export const MORE_PAGES = ['memory', 'tools', 'files', 'learning', 'issues', 'maps'];

/** The guides agents follow, opened in the document reader. */
export const MORE_GUIDES = [
  {path: 'AGENTS.md', title: 'How we work', line: 'Every rule you have given, in one file'},
  {path: 'workflow/the-line.json', title: 'The step guide', line: 'What each step is for and when it is done'},
  {path: 'workflow/CHECKS.md', title: 'The checks', line: 'Every gate a product has to pass'},
  {path: 'workflow/LAUNCH-CHECKLIST.md', title: 'Launch checklist', line: 'The seven checks before we spend'},
  {path: 'memory/START-HERE.md', title: 'Agent start file', line: 'What an agent reads first'},
];

/** The rules' step ids, named the way the sidebar names them today. */
export const RULE_STEPS = [['product', 'Product'], ['prove', 'Verify'], ['create', 'Creatives'], ['launch', 'Launch'], ['learn', 'Manage']];

const time = value => {const t = Date.parse(value || ''); return Number.isFinite(t) ? t : 0;};

/** The newest of some dates, as the saved string, or ''. */
export function latest(values = []) {
  let best = '', at = 0;
  for (const value of values) {const t = time(value); if (t > at) {at = t; best = value;}}
  return best;
}

/** Lessons in use (trying or proven), waiting (proposed) and retired. */
export function lessonCounts(lessons = []) {
  const list = Array.isArray(lessons) ? lessons : [];
  return {
    inUse: list.filter(lesson => lesson.status === 'trying' || lesson.status === 'proven').length,
    proposed: list.filter(lesson => lesson.status === 'proposed').length,
    retired: list.filter(lesson => lesson.status === 'retired').length,
  };
}

/** Tools we still use, and how many have a saved sign-in date. */
export function toolCounts(tools = []) {
  const live = (Array.isArray(tools) ? tools : []).filter(tool => !tool.retired);
  return {live: live.length, signedIn: live.filter(tool => tool.signedInNoted).length};
}

/** A rule's number as one big figure and the words that follow it. */
export function ruleFigure(rule = {}) {
  const value = rule.max !== undefined && rule.max !== rule.value ? `${rule.value}–${rule.max}` : String(rule.value ?? '');
  const unit = String(rule.unit || '').trim();
  if (unit === 'usd') return {big: `$${value}`, small: ''};
  if (/^percent\b/.test(unit)) return {big: `${value}%`, small: unit.replace(/^percent\s*/, '')};
  if (/^x\b/.test(unit)) return {big: `${value}×`, small: unit.replace(/^x\s*/, '')};
  if (unit === 'hours') return {big: `${value} h`, small: ''};
  if (unit === 'lb') return {big: `${value} lb`, small: ''};
  return {big: value, small: unit};
}

/**
 * The saved rules sorted for reading: the owner's own numbers first, then the
 * starting numbers by step, then what we never sell. Rules on an unknown step
 * land under "Other" rather than disappearing.
 */
export function ruleGroups(record = {}) {
  const rules = Array.isArray(record?.rules) ? record.rules : [];
  const yours = rules.filter(rule => rule.by === 'owner');
  const starting = rules.filter(rule => rule.by !== 'owner');
  const known = new Set(RULE_STEPS.map(([id]) => id));
  const steps = RULE_STEPS.map(([id, label]) => ({id, label, rules: starting.filter(rule => rule.group === id)}));
  const other = starting.filter(rule => !known.has(rule.group));
  if (other.length) steps.push({id: 'other', label: 'Other', rules: other});
  return {
    yours,
    starting: steps.filter(step => step.rules.length),
    startingCount: starting.length,
    never: (Array.isArray(record?.hardLimits) ? record.hardLimits : []).filter(limit => limit?.label),
  };
}

/** The headline rule for the door: the first-test loss limit, else the first owner number. */
export function headlineRule(record = {}) {
  const rules = Array.isArray(record?.rules) ? record.rules : [];
  return rules.find(rule => rule.id === 'firstTestLossLimit') || rules.find(rule => rule.by === 'owner') || null;
}

/** The older pages kept for reference, each with how much it holds and when it last changed. */
export function oldRecords({issues = [], improvements = [], maps = []} = {}) {
  const list = value => (Array.isArray(value) ? value : []);
  return [
    {id: 'issues', title: 'Issue list', line: 'Real problems by buyer, researched before products', count: list(issues).length, unit: 'issues', last: latest(list(issues).map(issue => issue.researched))},
    {id: 'learning', title: 'Learning log', line: 'Changes we tried on the workflow', count: list(improvements).length, unit: 'changes', last: latest(list(improvements).map(item => item.updatedAt || item.createdAt))},
    {id: 'maps', title: 'Maps', line: 'Mind maps of the process', count: list(maps).length, unit: 'maps', last: latest(list(maps).map(map => map.updatedAt))},
  ];
}
