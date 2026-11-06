import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createStore} from './store.mjs';
import {readTeam, validateTeam, frontMatter} from './team.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-team-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-team-')); await fs.rm(root, {recursive: true, force: true}); });
  const write = async (file, content) => { await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true}); await fs.writeFile(path.join(root, file), content); };
  await write('workflow/GUIDE.md', '# Guide\n');
  await write('.claude/skills/merrivy-os/SKILL.md', '---\nname: merrivy-os\ndescription: Working inside the OS.\n---\n# OS\n');
  await write('agents/validation/skills/research-products/SKILL.md', '---\nname: research-products\ndescription: "Research products."\n---\n');
  await write('agents/image-generator/.agents/skills/merrivy-images/SKILL.md', '---\r\nname: merrivy-images\r\ndescription: Make images.\r\n---\r\n');
  await write('.claude/agents/scout.md', '---\nname: scout\ndescription: Finds products.\n---\nYou are the scout.\n');
  await write('.claude/settings.local.json', '{"secret":"must stay unreadable"}');
  return {root, write, store: createStore({workspaceRoot: root})};
}
const roster = {
  manager: {name: 'Manager', summary: 'The main chat.', skills: ['merrivy-os']},
  agents: [
    {id: 'scout', role: 'validation', name: 'Product scout', summary: 'Finds products.', goodFor: ['Find ideas'], never: ['Decide for the owner'], skills: ['research-products', 'missing-skill'], guides: ['workflow/GUIDE.md', 'workflow/GONE.md']},
    {id: 'image-maker', role: 'image-generator', name: 'Image maker', summary: 'Makes images.', skills: ['merrivy-images']},
  ],
};

test('team roster joins agent definitions, skills and guides without running anything', async t => {
  const {root, write, store} = await fixture(t);
  assert.equal((await readTeam(root)).missing, true);
  await write('agents/team.json', JSON.stringify(roster));
  const team = await readTeam(root);
  const scout = team.agents.find(a => a.id === 'scout'), maker = team.agents.find(a => a.id === 'image-maker');
  assert.equal(scout.installed, true); assert.equal(scout.description, 'Finds products.'); assert.equal(scout.definition, '.claude/agents/scout.md');
  assert.equal(maker.installed, false);
  assert.deepEqual(scout.missingSkills, ['missing-skill']);
  assert.deepEqual(scout.guides, [{path: 'workflow/GUIDE.md', exists: true}, {path: 'workflow/GONE.md', exists: false}]);
  const skill = name => team.skills.find(s => s.name === name);
  assert.equal(skill('research-products').description, 'Research products.');
  assert.equal(skill('merrivy-images').description, 'Make images.');
  assert.deepEqual(skill('merrivy-os').usedBy, ['manager']);
  assert.deepEqual(skill('research-products').usedBy, ['scout']);
  assert.ok(team.skills.every(s => s.readable));
  assert.equal(team.manager.name, 'Manager');
  // The bootstrap carries the roster; agent and skill instructions are readable, settings are not.
  assert.equal((await store.bootstrap()).team.agents.length, 2);
  assert.match((await store.readDocument('.claude/agents/scout.md')).content, /You are the scout/);
  assert.match((await store.readDocument('.claude/skills/merrivy-os/SKILL.md')).content, /Working inside/);
  for (const denied of ['.claude/settings.local.json', '.claude/agents/../settings.md', '.claude/skills/merrivy-os/scripts/os.mjs', '.claude/agents/Scout.md'])
    await assert.rejects(store.readDocument(denied), e => e.code === 'UNSAFE_PATH', denied);
});

test('a broken roster is reported without breaking the app', async t => {
  const {root, write, store} = await fixture(t);
  await write('agents/team.json', '{not json');
  assert.match((await readTeam(root)).error, /could not be read/);
  await write('agents/team.json', JSON.stringify({agents: [{...roster.agents[0], role: 'boss'}]}));
  assert.match((await readTeam(root)).error, /unknown role/);
  assert.ok((await store.bootstrap()).team.error);
  for (const bad of [{agents: [{...roster.agents[0], id: 'Bad ID'}]}, {agents: [roster.agents[0], roster.agents[0]]}, {agents: [{...roster.agents[0], guides: ['../secret.md']}]}, {agents: [{...roster.agents[0], skills: ['Not A Skill']}]}])
    assert.throws(() => validateTeam(bad));
  assert.deepEqual(frontMatter('no front matter'), {});
});

test('planner tasks and activity reports can name a team agent; Claude reports are labeled', async t => {
  const {store} = await fixture(t);
  let planner = await store.savePlannerTask({revision: 0, title: 'Find pet products', assignee: 'agent', agent: 'scout'});
  assert.equal(planner.tasks[0].agent, 'scout');
  planner = await store.savePlannerTask({revision: 1, id: planner.tasks[0].id, status: 'doing'});
  assert.equal(planner.tasks[0].agent, 'scout', 'omitted agent is preserved');
  planner = await store.savePlannerTask({revision: 2, id: planner.tasks[0].id, agent: ''});
  assert.equal(planner.tasks[0].agent, '', 'agent can be cleared');
  await assert.rejects(store.savePlannerTask({revision: 3, title: 'Mine', assignee: 'owner', agent: 'scout'}), /cannot be the owner/);
  await assert.rejects(store.savePlannerTask({revision: 3, title: 'Bad', agent: 'Scout!'}), /team agent/);
  const {record} = await store.reportActivity({id: 'scout-batch', title: 'Pet batch', role: 'validation', agent: 'scout', status: 'running', summary: 'Searching.', reportedBy: 'claude'});
  assert.equal(record.agent, 'scout'); assert.equal(record.reportedBy, 'claude');
  const {record: done} = await store.reportActivity({id: 'scout-batch', revision: 1, status: 'completed', summary: 'Saved 12 cards.'});
  assert.equal(done.agent, 'scout'); assert.equal(done.reportedBy, 'claude');
  await assert.rejects(store.reportActivity({id: 'x', title: 'X', role: 'manager', status: 'running', summary: 'X', reportedBy: 'someone'}), /codex or claude/);
  await assert.rejects(store.reportActivity({id: 'y', title: 'Y', role: 'manager', status: 'running', summary: 'Y', agent: 'Not valid'}), /team agent/);
  assert.equal((await store.getActivity()).activity[0].agent, 'scout');
});
