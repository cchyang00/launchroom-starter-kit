import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createStore} from './store.mjs';
import {emptyLibrary, updateLibrary, validateLibrary, searchLibrary, closestEntries, stemOf, nearWords, libraryMarkdown, noteSlug, cleanMarkdown} from './library.mjs';
import {agentBrief} from './lessons.mjs';
import {browseEntries, toggleTopic, toggleTrust, libraryCounts, shelf, recentlyLearned, readingList, searchTerms, highlightParts, deriveTitle, deriveLearned, guessTopics, firstLink} from '../src/libraryModel.mjs';

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'merrivy-library-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('merrivy-library-')); await fs.rm(root, {recursive: true, force: true}); });
  for (const dir of ['agents', 'workflow', 'resources/research', '.claude/skills/kalodata']) await fs.mkdir(path.join(root, dir), {recursive: true});
  await fs.writeFile(path.join(root, 'workflow/AVATAR.md'), '# Avatar research\n\nStart with an established Meta category, then read real discussions to find an underserved buyer situation.\n');
  await fs.writeFile(path.join(root, 'resources/research/hooks.md'), '# Ad hooks\n\nThe first line of a native ad should name the buyer moment. Curiosity beats claims. Zebra crossings were mentioned once.\n');
  await fs.writeFile(path.join(root, '.claude/skills/kalodata/SKILL.md'), '---\nname: kalodata\n---\n# Kalodata\n\nUse the category filters, then open detail pages.\n');
  await fs.writeFile(path.join(root, 'agents/team.json'), JSON.stringify({agents: [{id: 'scout', role: 'validation', name: 'Product scout', summary: 'Finds products.'}, {id: 'copywriter', role: 'image-generator', name: 'Copywriter', summary: 'Writes copy.'}]}));
  return {root, store: createStore({workspaceRoot: root})};
}
const base = {title: 'Avatar-angle research', learned: 'Start from an established Meta category and find an underserved buyer situation.', kind: 'method', topics: ['buyer-angles'], trust: 'sourced', path: 'workflow/AVATAR.md'};
const now = new Date('2026-10-01T15:00:00Z');

test('entries validate their fields and get server IDs, dates and revisions', () => {
  let library = updateLibrary(emptyLibrary(), {revision: 0, ...base, forAgents: ['scout'], lessons: ['LS-004'], sources: ['https://example.com/a']}, now);
  const [entry] = library.entries;
  assert.equal(entry.id, 'K-001'); assert.equal(entry.status, 'learned'); assert.equal(entry.learnedOn, '2026-10-01'); assert.equal(entry.askedBy, 'manager');
  assert.equal(library.revision, 1); assert.ok(entry.createdAt && entry.updatedAt);
  library = updateLibrary(library, {revision: 1, title: 'Second', learned: 'Another thing.', topics: ['copywriting'], path: 'resources/research/hooks.md'}, now);
  assert.equal(library.entries[1].id, 'K-002'); assert.equal(library.entries[1].kind, 'note'); assert.equal(library.entries[1].trust, 'idea');
  for (const bad of [
    {title: 'x'.repeat(121)}, {learned: 'x'.repeat(401)}, {learned: ''}, {kind: 'video'}, {topics: []}, {topics: ['a', 'b', 'c', 'd']}, {topics: ['pets']},
    {trust: 'proven'}, {status: 'done'}, {path: '../secret.md'}, {path: 'os/data/library.json'}, {path: 'workflow/notes.txt'}, {path: '.claude/settings.json'},
    {sources: ['../x.md']}, {sources: Array(7).fill('https://example.com')}, {forAgents: ['Not An Agent']}, {lessons: ['L4']}, {askedBy: 'The Boss'},
    {learnedOn: '2026-02-30'}, {learnedOn: '2099-01-01'},
  ]) assert.throws(() => updateLibrary(emptyLibrary(), {revision: 0, ...base, ...bad}, now), `rejects ${JSON.stringify(bad).slice(0, 60)}`);
  assert.throws(() => updateLibrary(emptyLibrary(), {revision: 0, ...base, path: ''}, now), e => e.code === 'PATH_REQUIRED');
  assert.doesNotThrow(() => updateLibrary(emptyLibrary(), {revision: 0, ...base, path: '.claude/skills/kalodata/SKILL.md'}, now));
  // Quick notes may wait for topics; a missing title comes from the first sentence.
  const quick = updateLibrary(emptyLibrary(), {revision: 0, learned: 'Gift buyers want arrival dates. They ask in comments.', path: 'workflow/AVATAR.md'}, now).entries[0];
  assert.equal(quick.title, 'Gift buyers want arrival dates'); assert.equal(quick.kind, 'note'); assert.deepEqual(quick.topics, []);
  assert.throws(() => updateLibrary(emptyLibrary(), {revision: 0, learned: 'A method without topics.', kind: 'method', path: 'workflow/AVATAR.md'}, now), /topics/);
});

test('one plain prompt becomes a title, a short summary and a topic guess', () => {
  assert.equal(deriveTitle('How do other stores word a free-shipping offer? I keep seeing different ones.'), 'How do other stores word a free-shipping offer?');
  assert.equal(deriveTitle('https://www.example.com/blog/hooks/'), 'Read example.com/blog/hooks');
  assert.equal(deriveTitle('# Heading line\nmore'), 'Heading line more');
  assert.ok(deriveTitle('word '.repeat(60)).length <= 120); assert.match(deriveTitle('word '.repeat(60)), /…$/);
  assert.equal(deriveLearned('First paragraph here.\n\nSecond paragraph.'), 'First paragraph here.');
  const long = 'Sentence one is short. ' + 'This sentence keeps going and going. '.repeat(20);
  assert.ok(deriveLearned(long).length <= 400); assert.match(deriveLearned(long), /^Sentence one is short\./); assert.match(deriveLearned(long), /\.$/);
  assert.ok(deriveLearned('x'.repeat(900)).length <= 400);
  assert.deepEqual(guessTopics('Gift buyers on Reddit want the supplier to ship faster'), ['buyer-angles', 'sourcing']);
  assert.deepEqual(guessTopics('Our headline hooks beat the old ad copy'), ['copywriting', 'images-ads']);
  assert.deepEqual(guessTopics('Nothing relevant here'), []);
  assert.equal(firstLink('See https://example.com/a?b=1. Then decide.'), 'https://example.com/a?b=1');
  assert.equal(firstLink('No link'), '');
});

test('edits keep omitted fields, check the revision and never share a file', () => {
  let library = updateLibrary(emptyLibrary(), {revision: 0, ...base}, now);
  library = updateLibrary(library, {revision: 1, id: 'K-001', trust: 'tested'}, now);
  assert.equal(library.entries[0].trust, 'tested'); assert.equal(library.entries[0].title, base.title); assert.equal(library.entries[0].learnedOn, '2026-10-01');
  assert.throws(() => updateLibrary(library, {revision: 1, id: 'K-001', trust: 'idea'}, now), e => e.code === 'REVISION_CONFLICT' && e.status === 409);
  assert.throws(() => updateLibrary(library, {revision: 2, id: 'K-999', trust: 'idea'}, now), e => e.status === 404);
  assert.throws(() => updateLibrary(library, {revision: 2, ...base, title: 'Same file'}, now), e => e.code === 'DUPLICATE_PATH' && e.status === 409);
  assert.throws(() => updateLibrary(library, {revision: 2, id: 'K-001', status: 'to-learn'}, now), /cannot go back/);
});

test('a to-learn entry waits without a file, then becomes learned with a path and a date', () => {
  let library = updateLibrary(emptyLibrary(), {revision: 0, title: 'How do bundles change AOV?', learned: 'Find out whether 2-for offers lift order value for impulse products.', status: 'to-learn', askedBy: 'owner', forAgents: ['scout']}, new Date('2026-09-28T15:00:00Z'));
  const [waiting] = library.entries;
  assert.equal(waiting.status, 'to-learn'); assert.equal(waiting.path, ''); assert.equal(waiting.requestedOn, '2026-09-28'); assert.equal(waiting.learnedOn, ''); assert.deepEqual(waiting.topics, []);
  assert.throws(() => updateLibrary(library, {revision: 1, id: waiting.id, status: 'learned', topics: ['testing']}, now), e => e.code === 'PATH_REQUIRED');
  library = updateLibrary(library, {revision: 1, id: waiting.id, status: 'learned', topics: ['testing'], path: 'resources/research/hooks.md', learned: 'Bundles help when the second unit is a natural gift.'}, now);
  assert.equal(library.entries[0].status, 'learned'); assert.equal(library.entries[0].learnedOn, '2026-10-01'); assert.equal(library.entries[0].requestedOn, '2026-09-28');
  const counts = libraryCounts(library.entries);
  assert.equal(counts.learned, 1); assert.equal(counts.toLearn, 0); assert.equal(counts.byTopic.testing, 1); assert.equal(counts.byTrust.idea, 1);
});

test('search ranks title over learned over topics over file text, and returns snippets', () => {
  const entries = [
    {id: 'K-001', title: 'Hooks for native ads', learned: 'Name the buyer moment first.', kind: 'research', topics: ['copywriting'], trust: 'sourced', status: 'learned', path: 'a.md', updatedAt: '2026-10-01T00:00:00Z'},
    {id: 'K-002', title: 'Image ad tests', learned: 'Hooks matter less than the picture.', kind: 'note', topics: ['images-ads'], trust: 'idea', status: 'learned', path: 'b.md', updatedAt: '2026-10-01T00:00:00Z'},
    {id: 'K-003', title: 'Supplier checklist', learned: 'Confirm the exact SKU.', kind: 'template', topics: ['sourcing'], trust: 'tested', status: 'learned', path: 'c.md', updatedAt: '2026-10-01T00:00:00Z'},
    {id: 'K-004', title: 'Old hooks', learned: 'Long hooks.', kind: 'note', topics: ['copywriting'], trust: 'outdated', status: 'learned', path: 'd.md', updatedAt: '2026-10-01T00:00:00Z'},
  ];
  const clean = value => ({clean: value, lower: value.toLowerCase()});
  const texts = new Map([['c.md', clean('Ask the supplier about hooks on the packaging and the zebra print.')]]);
  const hits = searchLibrary(entries, 'hooks', texts);
  assert.deepEqual(hits.map(hit => hit.id), ['K-001', 'K-004', 'K-002', 'K-003'], 'title 12 > outdated title+learned halved 9 > learned 6 > file text 1');
  assert.ok(hits[0].score > hits[1].score && hits[1].score > hits.at(-1).score);
  const zebra = searchLibrary(entries, 'zebra', texts);
  assert.equal(zebra.length, 1); assert.equal(zebra[0].id, 'K-003'); assert.match(zebra[0].snippet, /zebra print/);
  assert.equal(searchLibrary(entries, 'sourcing', texts)[0].id, 'K-003', 'topics are searchable');
  assert.deepEqual(searchLibrary(entries, '', texts), []);
  assert.deepEqual(searchLibrary(entries, 'how to the', texts), [], 'stop words alone find nothing');
  assert.deepEqual(searchTerms('How do we write Ad hooks? hooks'), ['write', 'ad', 'hooks']);
  assert.deepEqual(highlightParts('Hooks for ads', ['hooks']).map(part => part.hit), [true, false]);
  assert.equal(cleanMarkdown('# Title\n\n**Bold** [link](x.md) ![img](y.png)'), 'Title Bold link');
});

test('zero hits suggest the closest entries: stems, word beginnings, buyer situations and topics', () => {
  const at = '2026-10-01T00:00:00Z';
  const entry = (id, title, learned, topics, extra = {}) => ({id, title, learned, kind: 'research', topics, trust: 'sourced', status: 'learned', path: `${id}.md`, updatedAt: at, ...extra});
  const entries = [
    entry('K-011', 'Gift avatars: the buyer wants the keepsake', 'Givers want a finished book.', ['buyer-angles', 'copywriting']),
    entry('K-122', 'Personalised couples mug', 'The meaning is in the personalised gift.', ['buyer-angles']),
    entry('K-029', 'Four brand pages as copy references', 'Strong pages bridge an emotion to a mechanism.', ['copywriting']),
    entry('K-050', 'Category filters in Kalodata', 'Use category and price filters.', ['product-research']),
    entry('K-060', 'Dog bed case', 'Dogs sleep better on raised beds.', ['product-research']),
    entry('K-070', 'Old gift ideas', 'Gift wrap upsells.', ['copywriting'], {trust: 'outdated'}),
    entry('K-080', 'Gift card research', 'Waiting on the reading list.', [], {status: 'to-learn', path: ''}),
  ];
  const clean = value => ({clean: value, lower: value.toLowerCase()});
  const texts = new Map([['K-029.md', clean('Storyworth: a weekly question for grandma becomes a printed book.')]]);
  assert.deepEqual(searchLibrary(entries, 'grandparent', texts), [], 'no entry uses the word itself');
  const near = closestEntries(entries, 'grandparent', texts);
  assert.deepEqual(near.map(hit => hit.id), ['K-011', 'K-122', 'K-029'], 'gift entries first; "grand" finds grandma in a file');
  assert.ok(near.every(hit => hit.closest === true && hit.near.length > 0));
  assert.ok(near[0].near.includes('gift')); assert.ok(near[2].near.includes('grand')); assert.match(near[2].snippet, /grandma/);
  assert.ok(!near.some(hit => ['K-070', 'K-080'].includes(hit.id)), 'outdated entries and the reading list are not suggested');
  // Related words match whole words only: "cat" never finds "category".
  assert.deepEqual(closestEntries(entries, 'puppies', texts).map(hit => hit.id), ['K-060']);
  assert.deepEqual(closestEntries(entries, 'zebra', texts), [], 'nothing close is an honest empty list');
  assert.deepEqual(closestEntries(entries, 'how to the', texts), []);
  assert.equal(stemOf('gifts'), 'gift'); assert.equal(stemOf('families'), 'family'); assert.equal(stemOf('shipping'), 'ship'); assert.equal(stemOf('glass'), 'glass');
  assert.deepEqual(nearWords('moment').related, [], '"mom" inside another word is not a buyer situation');
  assert.ok(nearWords('grandparents').related.includes('gift'));
});

test('LIBRARY.md groups entries by topic, lists the reading list and keeps outdated apart', () => {
  let library = updateLibrary(emptyLibrary(), {revision: 0, ...base, forAgents: ['scout'], lessons: ['LS-004']}, now);
  library = updateLibrary(library, {revision: 1, title: 'Old hook rule', learned: 'Long hooks win.', topics: ['copywriting'], trust: 'outdated', path: 'resources/research/hooks.md'}, now);
  library = updateLibrary(library, {revision: 2, title: 'Learn bundles', learned: 'Do bundles lift AOV?', status: 'to-learn', askedBy: 'owner'}, now);
  const markdown = libraryMarkdown(library);
  assert.match(markdown, /# Library — all our knowledge/);
  assert.match(markdown, /## Buyers & angles \(1\)\n\n- \*\*K-001 · Avatar-angle research\*\*[^\n]*sourced[^\n]*\n {2}File: \[workflow\/AVATAR.md\]\(\.\.\/workflow\/AVATAR.md\) · For: scout · Lessons: LS-004/);
  assert.match(markdown, /## On the reading list \(1\)\n\n- \*\*K-003 · Learn bundles\*\*/);
  assert.match(markdown, /## Outdated \(1\)[\s\S]*K-002 · Old hook rule/);
  assert.doesNotMatch(markdown, /## Copywriting/, 'outdated entries leave their topic shelf');
  assert.deepEqual(shelf(library.entries).map(entry => entry.id), ['K-001']);
  assert.deepEqual(shelf(library.entries, {showOutdated: true}).map(entry => entry.id).sort(), ['K-001', 'K-002']);
  assert.deepEqual(readingList(library.entries).map(entry => entry.id), ['K-003']);
  assert.deepEqual(recentlyLearned(library.entries).map(entry => entry.id), ['K-001']);
});

test('the agent brief lists library entries picked for that agent, newest first', () => {
  let library = emptyLibrary();
  for (let i = 1; i <= 8; i++) library = updateLibrary(library, {revision: library.revision, title: `Scout read ${i}`, learned: 'Something useful.', topics: ['product-research'], path: `workflow/F${i}.md`, forAgents: ['scout'], learnedOn: `2026-09-${String(10 + i).padStart(2, '0')}`}, now);
  library = updateLibrary(library, {revision: library.revision, title: 'Copy only', learned: 'For the copywriter.', topics: ['copywriting'], path: 'workflow/C.md', forAgents: ['copywriter']}, now);
  library = updateLibrary(library, {revision: library.revision, title: 'Scout outdated', learned: 'Old.', topics: ['product-research'], path: 'workflow/O.md', forAgents: ['scout'], trust: 'outdated'}, now);
  const state = {handoff: {summary: 'Setup.', nextAction: 'Curate.', blockers: ''}}, planner = {tasks: []}, lessons = {revision: 0, lessons: []};
  const brief = agentBrief({state, planner, lessons, library, agent: 'scout', name: 'Product scout'});
  assert.match(brief.markdown, /## From the library \(read when relevant\)\n\n- K-008 Scout read 8 — workflow\/F8.md \(idea\)/);
  assert.equal(brief.library.length, 6); assert.match(brief.markdown, /and 2 more/);
  assert.doesNotMatch(brief.markdown, /Copy only|Scout outdated|Scout read 1 /);
  assert.ok(brief.words < 400, `brief stays short (${brief.words} words)`);
  assert.match(agentBrief({state, planner, lessons, library: emptyLibrary(), agent: 'scout'}).markdown, /Nothing picked for you yet/);
  assert.match(agentBrief({state, planner, lessons, library: null, agent: 'scout'}).markdown, /needs repair/);
  assert.doesNotMatch(agentBrief({state, planner, lessons, agent: 'scout'}).markdown, /From the library/);
});

test('the store saves entries, checks files, writes notes without overwriting and searches file text', async t => {
  const {root, store} = await setup(t);
  const read = file => fs.readFile(path.join(root, file), 'utf8');
  const empty = await store.getLibrary(); assert.equal(empty.revision, 0); assert.deepEqual(empty.entries, []); assert.equal(empty.counts.toLearn, 0);
  await assert.rejects(store.saveLibraryEntry({revision: 0, ...base, path: 'workflow/MISSING.md'}), e => e.code === 'EVIDENCE_NOT_FOUND');
  await assert.rejects(store.saveLibraryEntry({revision: 0, ...base, sources: ['workflow/MISSING.md']}), e => e.code === 'EVIDENCE_NOT_FOUND');
  await assert.rejects(store.saveLibraryEntry({revision: 0, ...base, path: '../outside.md'}), e => e.code === 'UNSAFE_PATH');
  let saved = await store.saveLibraryEntry({revision: 0, ...base, forAgents: ['scout'], sources: ['resources/research/hooks.md']});
  assert.equal(saved.revision, 1); assert.equal(saved.counts.learned, 1); assert.equal(saved.counts.byKind.method, 1);
  assert.match(await read('resources/LIBRARY.md'), /K-001 · Avatar-angle research/);
  await assert.rejects(store.saveLibraryEntry({revision: 1, ...base, title: 'Twin'}), e => e.code === 'DUPLICATE_PATH');
  await assert.rejects(store.saveLibraryEntry({revision: 0, id: 'K-001', trust: 'tested'}), e => e.code === 'REVISION_CONFLICT');
  saved = await store.saveLibraryEntry({revision: 1, title: 'Kalodata method', learned: 'Filter by category first.', kind: 'method', topics: ['tools'], trust: 'tested', path: '.claude/skills/kalodata/SKILL.md'});

  // Write a note from the app: a new file, never an overwrite.
  const note = {title: 'Gift buyers & bundles', learned: 'Gift buyers want arrival dates.', topics: ['buyer-angles'], askedBy: 'owner'};
  saved = await store.saveLibraryEntry({revision: 2, ...note, note: {body: 'Seen in three Reddit threads.\n\nDetails follow.'}});
  const first = saved.entries.at(-1);
  assert.match(first.path, /^resources\/notes\/\d{4}-\d{2}-\d{2}-gift-buyers-bundles\.md$/);
  assert.equal(await read(first.path), '# Gift buyers & bundles\n\n**What we learned:** Gift buyers want arrival dates.\n\nSeen in three Reddit threads.\n\nDetails follow.\n');
  assert.equal(first.status, 'learned'); assert.equal(first.kind, 'note'); assert.equal(first.trust, 'idea');
  saved = await store.saveLibraryEntry({revision: 3, ...note, note: {body: 'Second copy.'}});
  assert.equal(saved.entries.at(-1).path, first.path.replace(/\.md$/, '-2.md'));
  assert.match(await read(first.path), /Seen in three Reddit threads/, 'the first note is untouched');
  await assert.rejects(store.saveLibraryEntry({revision: 4, ...note, path: 'workflow/AVATAR.md', note: {body: 'x'}}), e => e.code === 'NOTE_HAS_PATH');
  await assert.rejects(store.saveLibraryEntry({revision: 4, ...note, note: {body: 'x'.repeat(20_001)}}));

  // Reading list item answered by writing a note.
  saved = await store.saveLibraryEntry({revision: 4, title: 'Learn: shipping promises', learned: 'What arrival promise is honest for US orders?', status: 'to-learn', askedBy: 'owner', forAgents: ['scout']});
  const waiting = saved.entries.at(-1);
  assert.equal(saved.counts.toLearn, 1);
  saved = await store.saveLibraryEntry({revision: 5, id: waiting.id, learned: 'Promise a range, not a date.', topics: ['store'], note: {body: 'From the supplier quote.'}});
  const answered = saved.entries.find(entry => entry.id === waiting.id);
  assert.equal(answered.status, 'learned'); assert.ok(answered.learnedOn); assert.match(answered.path, /learn-shipping-promises\.md$/);
  assert.equal(saved.counts.toLearn, 0);

  // The owner's one text box: title, summary and topic guess come from the text.
  saved = await store.saveLibraryEntry({revision: 6, askedBy: 'owner', sources: ['https://example.com/thread'], note: {body: 'Buyers on Reddit ask about arrival dates before gifting. Two threads said so.\n\nMore detail in the second paragraph.'}});
  const quick = saved.entries.at(-1);
  assert.equal(quick.title, 'Buyers on Reddit ask about arrival dates before gifting'); assert.equal(quick.learned, 'Buyers on Reddit ask about arrival dates before gifting. Two threads said so.');
  assert.deepEqual(quick.topics, ['buyer-angles']); assert.equal(quick.kind, 'note'); assert.equal(quick.trust, 'idea'); assert.equal(quick.askedBy, 'owner'); assert.deepEqual(quick.sources, ['https://example.com/thread']);
  assert.match(await read(quick.path), /^# Buyers on Reddit ask about arrival dates before gifting\n\n\*\*What we learned:\*\* Buyers on Reddit[^\n]*\n\nBuyers on Reddit[\s\S]*second paragraph\.\n$/);
  await assert.rejects(store.saveLibraryEntry({revision: 7, askedBy: 'owner', note: {body: '   '}}), /Title is required/);

  // Search reads file text, including skills.
  assert.deepEqual(await store.searchLibrary(''), []);
  const hits = await store.searchLibrary('category filters');
  assert.equal(hits[0].id, 'K-002'); assert.ok(hits.length >= 1);
  const deep = await store.searchLibrary('underserved discussions');
  assert.equal(deep[0].id, 'K-001'); assert.match(deep[0].snippet, /discussions/);
  await fs.writeFile(path.join(root, 'workflow/AVATAR.md'), '# Avatar research\n\nNow mentions quokkas.\n');
  assert.equal((await store.searchLibrary('quokkas'))[0]?.id, 'K-001', 'changed files are read again');
  await assert.rejects(store.searchLibrary('x'.repeat(201)));

  // An entry whose file later disappears can still be marked outdated.
  await fs.rm(path.join(root, 'workflow/AVATAR.md'));
  saved = await store.saveLibraryEntry({revision: 7, id: 'K-001', trust: 'outdated'});
  assert.equal(saved.entries[0].trust, 'outdated');

  // The agent brief picks entries for that agent.
  await store.saveLibraryEntry({revision: 8, title: 'Scout method', learned: 'Read this first.', topics: ['product-research'], path: 'resources/research/hooks.md', forAgents: ['scout']});
  assert.match((await store.getBrief('scout')).markdown, /From the library[\s\S]*Scout method — resources\/research\/hooks.md/);

  await fs.writeFile(path.join(root, 'os/data/library.json'), '{broken');
  await assert.rejects(store.getLibrary(), e => e.code === 'MALFORMED_DATA');
  assert.match((await store.getBrief('scout')).markdown, /needs repair/, 'a damaged library does not block briefs');
  await fs.writeFile(path.join(root, 'os/data/library.json'), JSON.stringify({revision: 1, entries: [{id: 'K-001', title: 'x', learned: 'y', topics: ['store'], status: 'learned', path: '', createdAt: 'x', updatedAt: 'y'}]}));
  await assert.rejects(store.getLibrary(), e => e.code === 'MALFORMED_DATA' && e.status === 500);
  assert.throws(() => validateLibrary({revision: 0, entries: 'nope'}), e => e.code === 'MALFORMED_DATA');
});

test('note slugs are short, safe and never empty', () => {
  assert.equal(noteSlug('Café: Über-good HOOKS!!'), 'cafe-uber-good-hooks');
  assert.equal(noteSlug('???'), 'note');
  assert.ok(noteSlug('x'.repeat(200)).length <= 60);
});

test('the library API keeps the local Origin guard and revision checks', async t => {
  const {root} = await setup(t);
  const {createApi} = await import('./api.mjs');
  const http = await import('node:http');
  const api = createApi({workspaceRoot: root});
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, method = 'GET', data, origin = 'http://localhost:3000', host = 'localhost:3000') => new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: {Host: host, Origin: origin, 'Content-Type': 'application/json'}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    req.on('error', reject); req.end(data === undefined ? undefined : JSON.stringify(data));
  });
  assert.equal((await request('/api/library')).data.revision, 0);
  assert.equal((await request('/api/library', 'POST', {revision: 0, ...base}, 'https://outside.example')).status, 403);
  assert.equal((await request('/api/library', 'GET', undefined, 'http://localhost:3000', 'evil.example')).status, 403);
  const saved = await request('/api/library', 'POST', {revision: 0, ...base});
  assert.equal(saved.status, 200); assert.equal(saved.data.entries[0].id, 'K-001'); assert.equal(saved.data.counts.learned, 1);
  assert.equal((await request('/api/library', 'POST', {revision: 0, ...base, title: 'Stale'})).status, 409);
  const found = await request('/api/library/search?q=' + encodeURIComponent('underserved buyer'));
  assert.equal(found.status, 200); assert.equal(found.data[0].id, 'K-001');
  assert.deepEqual((await request('/api/library/search?q=')).data, []);
  // Zero exact hits: the same list shape, holding the closest entries marked closest.
  const near = await request('/api/library/search?q=' + encodeURIComponent('underserving situations'));
  assert.equal(near.status, 200); assert.ok(near.data.length >= 1);
  assert.equal(near.data[0].id, 'K-001'); assert.equal(near.data[0].closest, true); assert.ok(near.data[0].near.includes('situation'));
});

test('the tiles pick what the Library shows, and tapping one again takes it off', () => {
  const entry = (id, topic, kind, trust, status = 'learned') => ({id, title: id, topics: [topic], kind, trust, status, learnedOn: '2026-10-01', requestedOn: '2026-10-01'});
  const entries = [entry('K-1', 'store', 'method', 'tested'), entry('K-2', 'store', 'note', 'outdated'), entry('K-3', 'tools', 'method', 'idea'), entry('K-4', 'store', 'note', 'idea', 'to-learn')];
  const ids = options => browseEntries(entries, options).map(item => item.id);
  assert.deepEqual(ids({topic: 'store'}), ['K-1', 'K-2'], 'outdated stays, at the end, and the reading list stays out');
  assert.deepEqual(ids({topic: 'all', trust: 'idea'}), ['K-3']);
  assert.deepEqual(ids({topic: 'all', trust: 'to-learn'}), ['K-4']);
  assert.deepEqual(ids({topic: 'tools', trust: 'to-learn'}), []);
  assert.deepEqual(ids({kind: 'method'}).sort(), ['K-1', 'K-3']);

  assert.deepEqual(toggleTopic(null, 'store'), {topic: 'store', trust: '', kind: ''});
  assert.equal(toggleTopic({topic: 'store', trust: '', kind: ''}, 'store'), null);
  assert.deepEqual(toggleTopic({topic: 'store', trust: 'idea', kind: ''}, 'store'), {topic: 'all', trust: 'idea', kind: ''});
  assert.deepEqual(toggleTopic({topic: 'tools', trust: 'idea', kind: 'note'}, 'store'), {topic: 'store', trust: 'idea', kind: ''});
  assert.equal(toggleTopic({topic: 'all', trust: '', kind: ''}, 'all'), null);
  assert.deepEqual(toggleTopic({topic: 'all', trust: 'idea', kind: ''}, 'all'), {topic: 'all', trust: '', kind: ''});
  assert.deepEqual(toggleTrust(null, 'tested'), {topic: 'all', trust: 'tested', kind: ''});
  assert.equal(toggleTrust({topic: 'all', trust: 'tested', kind: ''}, 'tested'), null);
  assert.deepEqual(toggleTrust({topic: 'store', trust: 'tested', kind: ''}, 'tested'), {topic: 'store', trust: '', kind: ''});
  assert.deepEqual(toggleTrust({topic: 'store', trust: '', kind: ''}, 'idea'), {topic: 'store', trust: 'idea', kind: ''});
});
