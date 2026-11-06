import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readSkillFile, readTeam, saveSkill, frontMatter} from './team.mjs';
import {SKILL_SHELVES, agentSteps, shelfCounts, shelfGroups, shelfOf, skillLine, skillTitle} from '../src/skillShelf.mjs';

// Nov 5: skills are everything we curate or make, for any job. A subagent is skills plus workflow understanding.
test('a new skill lands on a shelf by itself, and a skill can name its own', () => {
  const shelf = (name, description = '') => shelfOf({name, description});
  assert.equal(shelf('hyperframes-keyframes'), 'video');
  assert.equal(shelf('media-use'), 'video');
  assert.equal(shelf('motion-graphics'), 'video');
  assert.equal(shelf('codebase-design', 'Shared vocabulary for designing deep modules.'), 'build');
  assert.equal(shelf('improve-codebase-architecture', 'as a visual HTML report'), 'build', 'its name decides before a word in its description');
  assert.equal(shelf('diagnosing-bugs'), 'build');
  assert.equal(shelf('merrivy-images', 'Generate and revise Merrivy product gallery images'), 'images');
  assert.equal(shelf('merrivy-shopify-workspace'), 'store');
  assert.equal(shelf('merrivy-research-workspace'), 'research');
  assert.equal(shelf('research', 'Investigate a question'), 'research');
  assert.equal(shelf('grill-me'), 'plan');
  assert.equal(shelf('to-tickets'), 'plan');
  assert.equal(shelf('merrivy-os'), 'launchroom');
  assert.equal(shelf('something-new', 'Nothing we know'), 'other');
  assert.equal(shelfOf({name: 'grill-me', shelf: 'copy'}), 'copy');
  assert.equal(shelfOf({name: 'x', shelf: 'nope'}), 'other');
  assert.equal(new Set(SKILL_SHELVES.map(entry => entry.id)).size, SKILL_SHELVES.length);
});

test('shelves read short, search narrows them and the skills in use come first', () => {
  assert.equal(skillTitle('hyperframes-keyframes'), 'Hyperframes keyframes');
  assert.equal(skillLine('Find bugs. Use it when something breaks.'), 'Find bugs.');
  assert.ok(skillLine('x'.repeat(300)).length <= 120);
  assert.equal(skillLine(''), '');
  const skills = [
    {name: 'aaa-video', description: 'Make a video', usedBy: []},
    {name: 'zzz-video', description: 'Edit a video', usedBy: ['image-maker']},
    {name: 'shopify', description: 'Build on Shopify', usedBy: []},
  ];
  assert.deepEqual(shelfGroups(skills).map(group => group.id), ['video', 'store']);
  assert.deepEqual(shelfGroups(skills)[0].skills.map(skill => skill.name), ['zzz-video', 'aaa-video']);
  assert.deepEqual(shelfGroups(skills, {shelf: 'store'}).map(group => group.id), ['store']);
  assert.deepEqual(shelfGroups(skills, {query: 'edit'})[0].skills.map(skill => skill.name), ['zzz-video']);
  assert.deepEqual(shelfGroups(skills, {query: 'nothing'}), []);
  assert.deepEqual(shelfCounts(skills).map(entry => [entry.id, entry.count]), [['video', 2], ['store', 1]]);
});

test('a subagent\'s workflow reads on the owner\'s pipeline, and Manage keeps its name', () => {
  const steps = agentSteps({workflow: [{id: 'buyers', name: 'Buyers', purpose: 'Mine reviews'}, {id: 'prove', name: 'Prove it'}, {id: 'create', name: 'Create'}, {id: 'learn', name: 'Manage'}]});
  assert.deepEqual(steps.map(step => step.name), ['Verify', 'Creatives', 'Manage']);
  assert.equal(steps[0].slug, 'verify');
  assert.equal(steps[0].purpose, 'Mine reviews');
  assert.equal(steps[2].slug, 'manage');
  assert.deepEqual(agentSteps({}), []);
});

test('front matter reads a folded description', () => {
  assert.equal(frontMatter('---\nname: a\ndescription: >\n  First line\n  second line\nmodel: x\n---\n').description, 'First line second line');
  assert.equal(frontMatter('---\r\nname: a\r\ndescription: |\r\n  One\r\n  Two\r\n---\r\n').description, 'One Two');
  assert.equal(frontMatter('---\nname: a\ndescription: Plain\n---\n').description, 'Plain');
});

test('skills from every home show on the shelf, personal ones read-only, and subagents carry their workflow', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-skills-'));
  const personal = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-personal-'));
  const before = process.env.LAUNCHROOM_PERSONAL_SKILLS;
  process.env.LAUNCHROOM_PERSONAL_SKILLS = personal;
  t.after(async () => {
    if (before === undefined) delete process.env.LAUNCHROOM_PERSONAL_SKILLS; else process.env.LAUNCHROOM_PERSONAL_SKILLS = before;
    await fs.rm(root, {recursive: true, force: true});
    await fs.rm(personal, {recursive: true, force: true});
  });
  const write = async (base, file, content) => { await fs.mkdir(path.dirname(path.join(base, file)), {recursive: true}); await fs.writeFile(path.join(base, file), content); };
  await write(root, '.claude/skills/merrivy-os/SKILL.md', '---\nname: merrivy-os\ndescription: Launchroom.\n---\n# OS\n');
  await write(root, 'hydrogen-storefront/.agents/skills/shopify/SKILL.md', '---\nname: shopify\ndescription: Build on Shopify.\n---\n');
  await write(personal, 'media-use/SKILL.md', '---\nname: media-use\ndescription: >\n  Every media need\n  in one place.\n---\n# Media\nBody\n');
  await write(personal, 'merrivy-os/SKILL.md', '---\nname: merrivy-os\ndescription: An older copy.\n---\n');
  await write(personal, 'loose-folder/notes.txt', 'no skill here');
  await write(root, 'agents/team.json', JSON.stringify({agents: [{id: 'scout', role: 'validation', name: 'Scout', summary: 'Finds.', skills: ['media-use']}, {id: 'os-builder', role: 'manager', name: 'Builder', summary: 'Builds.'}]}));
  await write(root, 'workflow/the-line.json', JSON.stringify({steps: [{id: 'product', name: 'Product', purpose: 'Scrape', doneWhen: 'Pass', agents: ['scout']}, {id: 'build', name: 'Build', agents: ['store-builder']}]}));

  const team = await readTeam(root);
  const skill = name => team.skills.find(entry => entry.name === name);
  assert.equal(skill('shopify').scope, 'project');
  assert.equal(skill('merrivy-os').scope, 'project', 'our own copy wins over a personal one with the same name');
  assert.equal(team.skills.filter(entry => entry.name === 'merrivy-os').length, 1);
  assert.equal(skill('media-use').scope, 'personal');
  assert.equal(skill('media-use').description, 'Every media need in one place.');
  assert.match(skill('media-use').path, /^~\/\.claude\/skills\//);
  assert.ok(!JSON.stringify(team.skills).includes(personal), 'a real folder path never reaches the screen');
  assert.deepEqual(skill('media-use').usedBy, ['scout'], 'a subagent can carry a personal skill');
  assert.equal(team.skills.some(entry => entry.name === 'loose-folder'), false);
  assert.deepEqual(team.agents.find(agent => agent.id === 'scout').workflow.map(step => step.id), ['product']);
  assert.deepEqual(team.agents.find(agent => agent.id === 'os-builder').workflow, []);
  assert.deepEqual(team.agents.find(agent => agent.id === 'scout').missingSkills, []);

  assert.match((await readSkillFile(root, 'media-use')).content, /Body/);
  assert.equal((await readSkillFile(root, '../../secret')).exists, false, 'a made-up name reads nothing');
  await saveSkill(root, {name: 'media-use', description: 'Our version', content: '# Ours'});
  assert.match(await fs.readFile(path.join(personal, 'media-use/SKILL.md'), 'utf8'), /Every media need/, 'saving never writes into the personal folder');
  assert.equal((await readTeam(root)).skills.find(entry => entry.name === 'media-use').scope, 'project');
});
