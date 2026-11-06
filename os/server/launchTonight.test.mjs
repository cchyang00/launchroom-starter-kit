import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchTonight, launchFolderPath } from './launchTonight.mjs';
import { parseLaunchPlan, launchBlocks, splitLead, blockOf, inlineParts, linkTarget, folderLinks, launchProduct, launchFolders, folderLine } from '../src/launchTonight.mjs';

const PLAN = `# Launch tonight: Cozy Lamp (P002)\r
\r
Owner picked the lamp at 6pm. Ship-by and prices below come from the CJ quote.\r
\r
## 1. Native ads & copy\r
\r
Three image ads in the article and moment formats.\r
\r
- [x] Write 3 hooks ([kit](../templates/NATIVE-AD-KIT.md))\r
- [ ] Make 3 images in [the batch](../research/2026-10-01-batch/)\r
  - [ ] Moment photo\r
    with the lamp on a desk\r
- Note: no review claims\r
\r
### Headlines\r
- [ ] Pick the headline\r
\r
## 2. Website (product page)\r
- [x] Populate the packet\r
- [ ] Check mobile on <http://localhost:3001>\r
\r
## 3. Offer & upsell\r
- [ ] **Bundle:** 2 for $49\r
\r
\`\`\`\r
- [ ] not a task inside a code block\r
\`\`\`\r
\r
## Your actions (owner)\r
- [ ] Approve the ad copy\r
- [X] Pick the product\r
\r
| Item | Cost |\r
| --- | --- |\r
\r
## Timeline\r
- 9pm ads ready\r
`;

test('blockOf picks the earliest block word, in priority order on ties', () => {
  assert.equal(blockOf('1. Native ads & copy'), 'ads');
  assert.equal(blockOf('Website (product page)'), 'website');
  assert.equal(blockOf('Offer & upsell'), 'offer');
  assert.equal(blockOf('Your actions'), 'actions');
  assert.equal(blockOf('Owner: approve the ads'), 'actions');
  assert.equal(blockOf('Ad copy for the product page'), 'ads');
  assert.equal(blockOf('Timeline'), null);
});

test('parseLaunchPlan reads the title, sections, tasks and notes from saved Markdown', () => {
  const plan = parseLaunchPlan(PLAN);
  assert.equal(plan.title, 'Launch tonight: Cozy Lamp (P002)');
  assert.match(plan.intro, /^Owner picked the lamp/);
  const ads = plan.sections[0];
  assert.equal(ads.block, 'ads');
  assert.match(ads.lead, /Three image ads/);
  assert.deepEqual(ads.items.map(item => [item.task, item.done]), [[true, true], [true, false], [false, false]]);
  assert.equal(ads.items[1].children[0].text, 'Moment photo with the lamp on a desk', 'an indented item folds under its parent and its next line continues it');
  assert.equal(plan.sections[1].heading, 'Headlines');
  assert.equal(plan.sections[1].block, 'ads', 'a sub-heading with no block word joins its parent');
  assert.equal(plan.sections.find(s => /Your actions/.test(s.heading)).items[1].done, true, '[X] counts as done');
  assert.ok(!plan.sections.some(s => s.items.some(i => /code block/.test(i.text))), 'fenced code is ignored');
  assert.deepEqual([plan.done, plan.total], [3, 8]);
  assert.deepEqual(parseLaunchPlan(''), { title: '', intro: '', callout: '', sections: [], done: 0, total: 0 });
});

test('launchBlocks keeps the owner order and counts only saved ticks', () => {
  const { blocks, other, alreadyDone } = launchBlocks(parseLaunchPlan(PLAN));
  assert.deepEqual(blocks.map(b => b.id), ['ads', 'website', 'offer', 'actions']);
  assert.deepEqual(blocks.map(b => `${b.done}/${b.total}`), ['1/3', '1/2', '0/1', '1/2']);
  assert.deepEqual(other.map(s => s.heading), ['Timeline']);
  assert.equal(alreadyDone, 0);
  const empty = launchBlocks(parseLaunchPlan('# Plan\n\n## Website\n- [ ] Populate'));
  assert.deepEqual(empty.blocks.map(b => b.written), [false, true, false, false]);
});

// The shape store-builder actually wrote on Oct 1: a timeline table, an owner list with bold leads and sub-points, an offer table.
const REAL = `# Launch tonight

Written by store-builder.

**Honest bottom line:** live tonight if the product is picked by 19:30.

## 1. Already done

| What | Evidence |
| --- | --- |
| Store with HTTPS | [Checklist](LAUNCH-CHECKLIST.md) |
| Payments on | x |

## 2. Minimum launch path (T0 = product picked)

| # | Step | Who | Time |
| --- | --- | --- | --- |
| 1 | Pick the product card; give the exact CJ listing | Owner | 5 min |
| 3 | Copy: product page plus 3-5 Meta headlines, no invented reviews | copywriter | 45-60 min |
| 4 | Images: gallery from real CJ photos plus 3-5 native-style static ads | image-maker | 60-90 min |
| 6 | Shipping rates from the CJ route (Standard, Express, threshold) | Owner approves, agent edits | 10 min |
| 8 | Store build: \`npm run packet:new\`, fill from copy and images | store-builder | 60-75 min (starts at T0+20) |
| 10 | Private preview deploy, then the owner looks | Agent with owner OK, then owner | 20 min |

## 3. Owner-only actions

1. **Minnesota sales tax** (Shopify shows "Action required"). Your choice:
   - Register with the state.
   - Or exclude Minnesota for now.
2. **Approve deploys:** private preview first, then production.

## 4. Knowingly left for after launch

| Left open | Risk |
| --- | --- |
| Storefront pixel events | Less signal |

## 6. Offer and upsell tonight

The owner prices about $20 above cost.

| Option | Works now? | Time |
| --- | --- | --- |
| **Paid faster shipping** | Yes, no code | 5 min |
| **Buy-2 pack** | Partly | 15 min |

**Simplest to ship tonight:** set the free-shipping threshold just above one unit.
`;

test('launchBlocks sorts a timeline table by each step’s own words and folds owner details', () => {
  const plan = parseLaunchPlan(REAL);
  assert.match(plan.callout, /^\*\*Honest bottom line:\*\*/);
  const { blocks, other, alreadyDone } = launchBlocks(plan);
  const lines = id => blocks.find(b => b.id === id).groups.flatMap(g => g.items.map(i => splitLead(i.text).lead));
  assert.equal(alreadyDone, 2, 'finished rows are counted, never shown as to-dos');
  assert.deepEqual(lines('ads'), ['Copy: product page plus 3-5 Meta headlines', 'Images: gallery from real CJ photos plus 3-5 native-style static ads']);
  assert.deepEqual(lines('website'), ['Store build: `npm run packet:new`', 'Private preview deploy']);
  assert.deepEqual(lines('offer'), ['Shipping rates from the CJ route', 'Paid faster shipping', 'Buy-2 pack']);
  assert.deepEqual(lines('actions'), ['Minnesota sales tax', 'Approve deploys']);
  const tax = blocks.find(b => b.id === 'actions').groups[0].items[0];
  assert.deepEqual(tax.children.map(c => c.text), ['Register with the state.', 'Or exclude Minnesota for now.']);
  assert.equal(splitLead(tax.text).detail, '(Shopify shows "Action required"). Your choice:');
  const copy = blocks.find(b => b.id === 'ads').groups[0].items[0];
  assert.deepEqual([copy.who, copy.time, copy.num, copy.done], ['copywriter', '45-60 min', '3', false]);
  assert.match(blocks.find(b => b.id === 'offer').groups[1].callout, /Simplest to ship tonight/);
  assert.deepEqual(other.map(s => [s.heading.slice(0, 22), s.items.map(i => splitLead(i.text).lead)]), [
    ['2. Minimum launch path', ['Pick the product card']], ['4. Knowingly left for ', ['Storefront pixel events']]], 'unsorted steps and side lists stay in "Also in the plan"');
});

test('splitLead gives one short line: the bold lead or the first clause', () => {
  assert.deepEqual(splitLead('**Approve deploys:** private preview first'), { lead: 'Approve deploys', detail: 'private preview first' });
  assert.deepEqual(splitLead('**CJ to Shopify**, pick one:'), { lead: 'CJ to Shopify', detail: 'pick one:' });
  assert.deepEqual(splitLead('Private preview deploy (`hydrogen deploy --preview`), then look'), { lead: 'Private preview deploy', detail: '(`hydrogen deploy --preview`), then look' });
  assert.deepEqual(splitLead('Short line'), { lead: 'Short line', detail: '' });
  assert.ok(splitLead('A'.repeat(30) + ' ' + 'b'.repeat(70)).lead.endsWith('…'));
});

test('inlineParts and linkTarget turn plan links into web pages, documents and folders', () => {
  assert.deepEqual(inlineParts('**Bundle:** see [kit](../templates/NATIVE-AD-KIT.md) or <http://localhost:3001>'), [
    { text: 'Bundle: see ' }, { label: 'kit', href: '../templates/NATIVE-AD-KIT.md' }, { text: ' or ' }, { label: 'http://localhost:3001', href: 'http://localhost:3001' }]);
  assert.deepEqual(linkTarget('../templates/NATIVE-AD-KIT.md'), { kind: 'doc', path: 'templates/NATIVE-AD-KIT.md' });
  assert.deepEqual(linkTarget('HYDROGEN-POPULATION.md#steps'), { kind: 'doc', path: 'store/HYDROGEN-POPULATION.md#steps' });
  assert.deepEqual(linkTarget('../research/2026-10-01-batch/'), { kind: 'folder', path: 'research/2026-10-01-batch' });
  assert.deepEqual(linkTarget('http://localhost:3001'), { kind: 'web', href: 'http://localhost:3001' });
  assert.deepEqual(linkTarget('../products/P002-lamp/assets/ads/a.png'), { kind: 'file', path: 'products/P002-lamp/assets/ads/a.png' });
  assert.equal(linkTarget('javascript:alert(1)'), null);
  assert.deepEqual(folderLinks(parseLaunchPlan(PLAN).sections.filter(s => s.block === 'ads')), ['research/2026-10-01-batch']);
});

test('launchProduct uses the build slot first, then the first saved P### the plan names', () => {
  const products = [{ id: 'P001-boots' }, { id: 'P002-cozy-lamp' }];
  assert.equal(launchProduct({ buildProductId: 'P001-boots', planText: PLAN, products }), 'P001-boots');
  assert.equal(launchProduct({ buildProductId: null, planText: PLAN, products }), 'P002-cozy-lamp');
  assert.equal(launchProduct({ buildProductId: null, planText: 'P009 is not saved', products }), null);
  assert.deepEqual(launchFolders({ productId: 'P002-cozy-lamp', adsSections: parseLaunchPlan(PLAN).sections.filter(s => s.block === 'ads') }),
    ['products/P002-cozy-lamp/creative', 'products/P002-cozy-lamp/copy', 'products/P002-cozy-lamp/assets/ads', 'research/2026-10-01-batch']);
  assert.equal(folderLine({ exists: false }), 'Not made yet');
  assert.equal(folderLine({ exists: true, files: 0 }), 'Empty so far');
  assert.equal(folderLine({ exists: true, files: 12, images: 1 }), '12 files · 1 image');
});

test('launchFolderPath allows only plain products/ and research/ folders', () => {
  assert.equal(launchFolderPath('products/P002-lamp/creative/'), 'products/P002-lamp/creative');
  assert.equal(launchFolderPath('research/2026-10-01-batch'), 'research/2026-10-01-batch');
  for (const bad of ['os/data', 'products', '../products/x', 'products/../os', 'products/P1/.env', 'products/P1/private', 'C:/x', '/products/x', 'products\\x', 'research/x/_removed', 'store/assets'])
    assert.equal(launchFolderPath(bad), null, bad);
});

test('launchTonight reads the plan and counts folders without contents, links or the bin', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-launch-'));
  try {
    const empty = await launchTonight({ workspaceRoot: root, folders: ['products/P002-lamp/creative'] });
    assert.equal(empty.plan.exists, false);
    assert.equal(empty.plan.content, undefined);
    assert.deepEqual(empty.folders, [{ path: 'products/P002-lamp/creative', exists: false }]);

    await fs.mkdir(path.join(root, 'store'), { recursive: true });
    await fs.mkdir(path.join(root, 'templates'), { recursive: true });
    await fs.writeFile(path.join(root, 'store', 'LAUNCH-TONIGHT.md'), PLAN);
    await fs.writeFile(path.join(root, 'templates', 'NATIVE-AD-KIT.md'), '# Kit\n');
    const creative = path.join(root, 'products', 'P002-lamp', 'creative');
    await fs.mkdir(path.join(creative, 'J001', '_removed'), { recursive: true });
    await fs.mkdir(path.join(creative, 'private'), { recursive: true });
    await fs.writeFile(path.join(creative, 'J001', 'JOB.md'), '# Job\n');
    await fs.writeFile(path.join(creative, 'J001', 'ad-1.png'), 'x');
    await fs.writeFile(path.join(creative, 'J001', 'clip.mp4'), 'x');
    await fs.writeFile(path.join(creative, 'J001', '_removed', 'old.png'), 'x');
    await fs.writeFile(path.join(creative, 'private', 'secret.txt'), 'x');
    await fs.writeFile(path.join(creative, '.env'), 'x');
    let linked = false;
    try { await fs.symlink(path.join(root, 'store'), path.join(creative, 'link'), 'junction'); linked = true; } catch {}

    const result = await launchTonight({ workspaceRoot: root, folders: ['products/P002-lamp/creative', 'os/data', 'products/P002-lamp/copy'] });
    assert.equal(result.plan.exists, true);
    assert.match(result.plan.content, /Launch tonight/);
    assert.equal(result.kit.exists, true);
    assert.equal(result.population.exists, false);
    const [counted, refused, missing] = result.folders;
    assert.deepEqual([counted.files, counted.images, counted.videos], [3, 1, 1], `bin, private folder, dotfiles${linked ? ' and links' : ''} are skipped`);
    assert.deepEqual(counted.docs, ['products/P002-lamp/creative/J001/JOB.md']);
    assert.deepEqual(refused, { path: 'os/data', exists: false, allowed: false });
    assert.equal(missing.exists, false);
    assert.ok(!JSON.stringify(result.folders).includes('secret'), 'no private names leak');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('launchWork puts live reports under the block they help, by title words then agent', async () => {
  const { launchWork } = await import('../src/launchTonight.mjs');
  const work = launchWork([
    { id: 'a', agent: 'copywriter', title: 'Primary texts for tonight', updatedAt: '2026-10-01T20:00:00Z', events: [{ text: 'Step 2/4: ad 2 of 3' }] },
    { id: 'b', agent: 'store-builder', title: 'Upsell bundle on the cart', updatedAt: '2026-10-01T20:05:00Z', summary: 'Adding the bundle' },
    { id: 'c', agent: 'store-builder', title: 'Populate the packet', updatedAt: '2026-10-01T19:00:00Z' },
    { id: 'd', agent: 'os-builder', title: 'OS easier for tonight', updatedAt: '2026-10-01T20:06:00Z' },
    { id: 'e', agent: 'scout', title: 'Your approval list', updatedAt: '2026-10-01T20:07:00Z' },
  ]);
  assert.deepEqual(work.ads.map(r => [r.id, r.latest]), [['a', 'Step 2/4: ad 2 of 3']]);
  assert.deepEqual(work.offer.map(r => [r.id, r.latest]), [['b', 'Adding the bundle']]);
  assert.deepEqual(work.website.map(r => r.id), ['c']);
  assert.deepEqual(work.actions, [], 'owner actions are the owner’s; agent reports never land there');
});
