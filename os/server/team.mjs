import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AGENTS, safeRelative} from './domain.mjs';
import {AGENT_ID} from './planner.mjs';

// agents/team.json is the owner-facing roster: who each team agent is, what it
// is good for and which skills/guides it uses. The executable instructions for
// each agent live in .claude/agents/<id>.md. Reading the team never runs anything.
export const TEAM_FILE = 'agents/team.json';
const SKILL_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_BYTES = 96_000;
const SKILL_GLOBS = [['.claude/skills'], ['.agents/skills'], ['agents', '*', '.agents/skills'], ['agents', '*', 'skills'], ['hydrogen-storefront/.agents/skills']];
const MAX_SKILLS = 150;
const LINE_FILE = 'workflow/the-line.json';
/**
 * The owner's own skills (Nov 5: "skills that we curate or make over time for designing or doing anything") live
 * in their Claude folder and work in every project. Launchroom reads each one's SKILL.md and never writes there.
 */
const personalSkillsDir = () => process.env.LAUNCHROOM_PERSONAL_SKILLS || path.join(os.homedir(), '.claude', 'skills');

function str(value, label, max, required = true) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) throw new Error(`${label} must be text up to ${max} characters.`);
  return value.trim();
}
function list(value, label, max, each) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must be a list of at most ${max}.`);
  return value.map((item, i) => each(item, `${label} ${i + 1}`));
}

export function validateTeam(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.agents) || raw.agents.length > 30) throw new Error('The team file needs an agents list (at most 30).');
  const ids = new Set();
  const agents = raw.agents.map((agent, i) => {
    if (!agent || typeof agent !== 'object') throw new Error(`Agent ${i + 1} must be an object.`);
    if (typeof agent.id !== 'string' || !AGENT_ID.test(agent.id) || ids.has(agent.id)) throw new Error(`Agent ${i + 1} needs a unique lowercase ID.`);
    ids.add(agent.id);
    if (!AGENTS.some(role => role.id === agent.role)) throw new Error(`${agent.id}: unknown role.`);
    return {
      id: agent.id, role: agent.role,
      name: str(agent.name, `${agent.id} name`, 60),
      icon: str(agent.icon, `${agent.id} icon`, 30, false),
      summary: str(agent.summary, `${agent.id} summary`, 240),
      goodFor: list(agent.goodFor, `${agent.id} good-for`, 8, (v, l) => str(v, l, 200)),
      delivers: str(agent.delivers, `${agent.id} delivers`, 300, false),
      never: list(agent.never, `${agent.id} never`, 8, (v, l) => str(v, l, 200)),
      skills: list(agent.skills, `${agent.id} skills`, 12, (v, l) => { if (typeof v !== 'string' || !SKILL_NAME.test(v)) throw new Error(`${l} must be a skill name.`); return v; }),
      guides: list(agent.guides, `${agent.id} guides`, 12, (v, l) => safeRelative(str(v, l, 300))),
    };
  });
  // The manager is the main conversation (Claude or Codex chat), not a dispatched agent.
  const lead = raw.manager;
  const manager = lead && typeof lead === 'object' ? {
    name: str(lead.name, 'Manager name', 60), summary: str(lead.summary, 'Manager summary', 300),
    goodFor: list(lead.goodFor, 'Manager good-for', 8, (v, l) => str(v, l, 200)),
    skills: list(lead.skills, 'Manager skills', 12, (v, l) => { if (typeof v !== 'string' || !SKILL_NAME.test(v)) throw new Error(`${l} must be a skill name.`); return v; }),
  } : null;
  return {manager, agents};
}

async function isFile(file) { try { const s = await fs.lstat(file); return s.isFile(); } catch { return false; } }
async function dirs(dir) {
  try { return (await fs.readdir(dir, {withFileTypes: true})).filter(e => e.isDirectory() && !e.isSymbolicLink()).map(e => e.name); }
  catch { return []; }
}

/** Single-line `key: value` front matter; enough for name/description. */
export function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!match) return out;
  const lines = match[1].split(/\r?\n/);
  lines.forEach((line, index) => {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) return;
    let value = kv[2].trim();
    // A folded or literal block ("description: >") runs on over its indented lines.
    if (/^[>|][+-]?$/.test(value)) {
      const block = [];
      for (let next = index + 1; next < lines.length && (/^\s+\S/.test(lines[next]) || !lines[next].trim()); next++) block.push(lines[next].trim());
      value = block.filter(Boolean).join(' ');
    }
    out[kv[1]] = value.replace(/^(['"])(.*)\1$/, '$2');
  });
  return out;
}
async function head(file) {
  const handle = await fs.open(file, 'r');
  try { const {buffer, bytesRead} = await handle.read(Buffer.alloc(4096), 0, 4096, 0); return buffer.toString('utf8', 0, bytesRead); }
  finally { await handle.close(); }
}
function readable(relative) { try { safeRelative(relative, {markdown: true}); return true; } catch { return false; } }

async function discoverSkills(root) {
  const found = [];
  for (const parts of SKILL_GLOBS) {
    let bases = [''];
    for (const part of parts) {
      if (part === '*') { const next = []; for (const base of bases) for (const name of await dirs(path.join(root, base))) next.push(path.posix.join(base, name)); bases = next; }
      else bases = bases.map(base => path.posix.join(base, part));
    }
    for (const base of bases) for (const dir of await dirs(path.join(root, base))) {
      const relative = path.posix.join(base, dir, 'SKILL.md');
      if (!SKILL_NAME.test(dir) || !(await isFile(path.join(root, relative)))) continue;
      const meta = frontMatter(await head(path.join(root, relative)));
      found.push({name: SKILL_NAME.test(meta.name || '') ? meta.name : dir, description: (meta.description || '').slice(0, 400), path: relative, readable: readable(relative), forClaude: relative.startsWith('.claude/'), scope: 'project', ...(meta.shelf ? {shelf: meta.shelf} : {})});
      if (found.length >= MAX_SKILLS) return found;
    }
  }
  // Then the owner's own. Our project's copy wins when a name is on both.
  const home = personalSkillsDir();
  for (const dir of await dirs(home)) {
    if (found.length >= MAX_SKILLS) break;
    const file = path.join(home, dir, 'SKILL.md');
    if (!SKILL_NAME.test(dir) || !(await isFile(file))) continue;
    const meta = frontMatter(await head(file));
    const name = SKILL_NAME.test(meta.name || '') ? meta.name : dir;
    if (found.some(skill => skill.name === name)) continue;
    found.push({name, description: (meta.description || '').slice(0, 400), path: `~/.claude/skills/${dir}/SKILL.md`, readable: true, forClaude: true, scope: 'personal', folder: dir, ...(meta.shelf ? {shelf: meta.shelf} : {})});
  }
  return found;
}

/** Which steps of the workflow name this agent, from the-line.json. A missing or broken file reads as no steps. */
async function workflowSteps(root) {
  try {
    const line = JSON.parse(await fs.readFile(path.join(root, LINE_FILE), 'utf8'));
    return (Array.isArray(line?.steps) ? line.steps : []).map(step => ({id: String(step?.id || ''), name: String(step?.name || ''), purpose: String(step?.purpose || '').slice(0, 300), doneWhen: String(step?.doneWhen || '').slice(0, 300), agents: Array.isArray(step?.agents) ? step.agents : []}));
  } catch { return []; }
}

export async function readTeam(root) {
  const skills = await discoverSkills(root);
  let raw;
  try {
    const file = path.join(root, TEAM_FILE);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('The team file is missing or too large.');
    raw = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {source: TEAM_FILE, agents: [], skills, missing: true};
    return {source: TEAM_FILE, agents: [], skills, error: `Team file could not be read: ${error.message}`};
  }
  let team;
  try { team = validateTeam(raw); } catch (error) { return {source: TEAM_FILE, agents: [], skills, error: `Team file needs repair: ${error.message}`}; }
  const steps = await workflowSteps(root);
  const agents = [];
  for (const agent of team.agents) {
    const definition = `.claude/agents/${agent.id}.md`;
    const installed = await isFile(path.join(root, definition));
    const meta = installed ? frontMatter(await head(path.join(root, definition))) : {};
    const guides = [];
    for (const guide of agent.guides) guides.push({path: guide, exists: await isFile(path.join(root, guide))});
    agents.push({...agent, guides, definition, installed, description: (meta.description || '').slice(0, 600), workflow: steps.filter(step => step.agents.includes(agent.id)).map(({agents: _names, ...step}) => step)});
  }
  for (const skill of skills) skill.usedBy = [...(team.manager?.skills.includes(skill.name) ? ['manager'] : []), ...agents.filter(agent => agent.skills.includes(skill.name)).map(agent => agent.id)];
  for (const agent of agents) agent.missingSkills = agent.skills.filter(name => !skills.some(skill => skill.name === name));
  return {source: TEAM_FILE, manager: team.manager, agents, skills};
}

export async function readAgentPrompt(root, id) {
  const cleanId = str(id, 'Agent ID', 40);
  if (!AGENT_ID.test(cleanId)) throw new Error('Invalid agent ID.');
  const relative = `.claude/agents/${cleanId}.md`;
  const file = path.join(root, relative);
  if (!(await isFile(file))) return {id: cleanId, path: relative, exists: false, content: ''};
  const content = await fs.readFile(file, 'utf8');
  const meta = frontMatter(content);
  return {id: cleanId, path: relative, exists: true, content, description: meta.description || '', model: meta.model || 'opus'};
}

export async function saveAgent(root, input = {}) {
  const id = str(input.id, 'Agent ID', 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (!AGENT_ID.test(id)) throw new Error('Agent ID must be lowercase letters, numbers, and hyphens.');
  const file = path.join(root, TEAM_FILE);
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  const existingIdx = (raw.agents || []).findIndex(a => a.id === id);
  const previous = existingIdx >= 0 ? raw.agents[existingIdx] : {};
  const splitLines = val => Array.isArray(val) ? val.map(s => String(s).trim()).filter(Boolean) : typeof val === 'string' ? val.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
  const nextAgent = {
    id,
    role: AGENTS.some(r => r.id === input.role) ? input.role : (previous.role || 'validation'),
    name: str(input.name ?? previous.name ?? id, `${id} name`, 60),
    icon: str(input.icon ?? previous.icon ?? 'bot', `${id} icon`, 30, false),
    summary: str(input.summary ?? previous.summary ?? 'Specialist subagent on the Launchroom team.', `${id} summary`, 240),
    goodFor: splitLines(input.goodFor ?? previous.goodFor ?? ['Focused specialist tasks assigned by the manager']).slice(0, 8),
    delivers: str(input.delivers ?? previous.delivers ?? 'Saved workspace records and verified outputs.', `${id} delivers`, 300, false),
    never: splitLines(input.never ?? previous.never ?? ['Never invent evidence or publish without owner approval']).slice(0, 8),
    skills: splitLines(input.skills ?? previous.skills ?? []).filter(s => SKILL_NAME.test(s)).slice(0, 12),
    guides: splitLines(input.guides ?? previous.guides ?? ['AGENTS.md']).slice(0, 12),
  };
  const nextRaw = {
    ...raw,
    agents: existingIdx >= 0
      ? raw.agents.map((a, idx) => (idx === existingIdx ? nextAgent : a))
      : [...(raw.agents || []), nextAgent],
  };
  validateTeam(nextRaw);
  await fs.writeFile(file, `${JSON.stringify(nextRaw, null, 2)}\n`, 'utf8');

  const defDir = path.join(root, '.claude', 'agents');
  await fs.mkdir(defDir, {recursive: true});
  const defFile = path.join(defDir, `${id}.md`);
  if (typeof input.prompt === 'string' && input.prompt.trim()) {
    await fs.writeFile(defFile, `${input.prompt.trim()}\n`, 'utf8');
  } else if (!(await isFile(defFile))) {
    const defaultPrompt = [
      '---',
      `name: ${id}`,
      `description: ${nextAgent.summary.replace(/\r?\n/g, ' ')}`,
      'model: opus',
      '---',
      '',
      `You are **${nextAgent.name}** (\`${id}\`) on the Launchroom team. Your role is \`${nextAgent.role}\`.`,
      '',
      '## What you are good for',
      ...nextAgent.goodFor.map(line => `- ${line}`),
      '',
      '## What you deliver',
      nextAgent.delivers || '- Verified files saved in the workspace.',
      '',
      '## Never',
      ...nextAgent.never.map(line => `- ${line}`),
      '',
    ].join('\n');
    await fs.writeFile(defFile, defaultPrompt, 'utf8');
  }
  return {team: await readTeam(root), agentId: id};
}

export async function readSkillFile(root, nameOrPath) {
  const skills = await discoverSkills(root);
  const found = skills.find(s => s.name === nameOrPath || s.path === nameOrPath);
  const asked = String(nameOrPath || '').trim();
  if (!found && !SKILL_NAME.test(asked)) return {name: asked, path: '', exists: false, description: '', content: ''};
  const relative = found ? found.path : `.claude/skills/${asked}/SKILL.md`;
  const file = found?.scope === 'personal' ? path.join(personalSkillsDir(), found.folder, 'SKILL.md') : path.join(root, relative);
  if (!(await isFile(file))) return {name: asked, path: relative, exists: false, description: '', content: ''};
  const content = await fs.readFile(file, 'utf8');
  const meta = frontMatter(content);
  return {name: found?.name || meta.name || String(nameOrPath), path: relative, exists: true, scope: found?.scope || 'project', description: meta.description || '', content};
}

export async function saveSkill(root, input = {}) {
  const name = str(input.name, 'Skill name', 63).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (!SKILL_NAME.test(name)) throw new Error('Skill name must be lowercase letters, numbers, and hyphens.');
  const description = str(input.description || 'Reusable Launchroom skill.', 'Skill description', 400);
  const skills = await discoverSkills(root);
  const existing = skills.find(s => s.name === name && s.scope !== 'personal');
  const relative = existing ? existing.path : `.claude/skills/${name}/SKILL.md`;
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), {recursive: true});

  let content = typeof input.content === 'string' ? input.content.trim() : '';
  if (!content) {
    content = [
      '---',
      `name: ${name}`,
      `description: ${description.replace(/\r?\n/g, ' ')}`,
      '---',
      '',
      `# ${name}`,
      '',
      description,
      '',
      '## Instructions',
      '',
      '- Follow the Launchroom workflow and verify every output.',
    ].join('\n');
  } else if (!/^---\r?\n/.test(content)) {
    content = `---\nname: ${name}\ndescription: ${description.replace(/\r?\n/g, ' ')}\n---\n\n${content}`;
  }
  await fs.writeFile(file, `${content}\n`, 'utf8');

  if (Array.isArray(input.assignedAgents)) {
    const teamFile = path.join(root, TEAM_FILE);
    const raw = JSON.parse(await fs.readFile(teamFile, 'utf8'));
    const assigned = new Set(input.assignedAgents.map(String));
    if (raw.manager) {
      const mSkills = new Set(raw.manager.skills || []);
      if (assigned.has('manager')) mSkills.add(name); else mSkills.delete(name);
      raw.manager.skills = [...mSkills];
    }
    raw.agents = (raw.agents || []).map(agent => {
      const aSkills = new Set(agent.skills || []);
      if (assigned.has(agent.id)) aSkills.add(name); else aSkills.delete(name);
      return {...agent, skills: [...aSkills]};
    });
    validateTeam(raw);
    await fs.writeFile(teamFile, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  }
  return {team: await readTeam(root), skillName: name, path: relative};
}
