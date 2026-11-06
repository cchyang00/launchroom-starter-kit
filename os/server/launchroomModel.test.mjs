// Launchroom shell derivations (src/launchroomModel.mjs): marks, titles, routes,
// files, error words by code, the home's today list and project cards, and access edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectInitials, projectMark, projectIdFromPath, projectHref, workProjects, accessOf, docTitle, productRoute, productPath,
  fileKind, canPreview, formatSize, sortFiles, filterFiles, folderCrumbs, parentFolder, destinationText, uploadProblem, filesMessage,
  authMessage, passwordProblem, todayAcross, projectSummary, isEmptyProject, accessRows, accessChanges, UPLOAD_LIMIT,
} from '../src/launchroomModel.mjs';

const merrivy = {id: 'merrivy', name: 'Merrivy', kind: 'legacy', members: [], createdAt: '2026-10-01T10:00:00Z'};
const shared = {id: 'shared', name: 'Shared library', kind: 'shared', members: [], createdAt: '2026-10-01T10:00:00Z'};
const candle = {id: 'p-11111111-1111-4111-8111-111111111111', name: 'Candle studio', kind: 'project', members: ['u-bro'], createdAt: '2026-10-01T12:00:00Z'};
const course = {id: 'p-22222222-2222-4222-8222-222222222222', name: 'course', kind: 'project', members: [], createdAt: '2026-10-01T11:00:00Z'};

test('project marks, paths and titles name the project unmistakably', () => {
  assert.equal(projectInitials('Candle studio'), 'CS');
  assert.equal(projectInitials('merrivy'), 'M');
  assert.equal(projectInitials('  '), '?');
  assert.equal(projectInitials('émile zola'), 'ÉZ');
  assert.deepEqual(projectMark(merrivy), {initials: 'M', bg: 'var(--mark-merrivy)', ink: 'var(--mark-merrivy-ink)'});
  assert.equal(projectMark(shared).shared, true);
  assert.deepEqual(projectMark(candle), projectMark({...candle}), 'A project keeps its colour');
  assert.notEqual(projectMark(candle).bg, '#16302a');
  assert.equal(projectIdFromPath('/p/merrivy/'), 'merrivy');
  assert.equal(projectIdFromPath(`/p/${candle.id}`), candle.id);
  assert.equal(projectIdFromPath('/'), '');
  assert.equal(projectIdFromPath('/px/merrivy/'), '');
  assert.equal(projectHref('merrivy', 'files?folder=Ads'), '/p/merrivy/#/files?folder=Ads');
  assert.equal(projectHref('shared'), '/p/shared/');
  assert.deepEqual(workProjects([shared, candle, course, merrivy]).map(p => p.id), ['merrivy', course.id, candle.id]);
  assert.deepEqual(accessOf(shared), {kind: 'shared', label: 'Shared with everyone'});
  assert.deepEqual(accessOf(candle), {kind: 'private', label: 'Only Candle studio members'});
  assert.equal(docTitle('Today', 'Merrivy'), 'Today · Merrivy · Launchroom');
  assert.equal(docTitle('', ''), 'Launchroom');
  assert.equal(docTitle('Shared library', 'Shared library'), 'Shared library · Launchroom');
});

test('the product page lives at #/product/<id>; the old #/p/<id> redirects', () => {
  assert.deepEqual(productRoute('product/L096'), {id: 'L096', redirect: ''});
  assert.deepEqual(productRoute('p/P001-ruched-buckle-knee-high-boots'), {id: 'P001-ruched-buckle-knee-high-boots', redirect: 'product/P001-ruched-buckle-knee-high-boots'});
  assert.equal(productRoute('product'), null, '#/product alone is the Pipeline');
  assert.equal(productRoute('p/L0/../x'), null);
  assert.equal(productRoute('pipeline'), null);
  assert.equal(productPath('L096'), 'product/L096');
  assert.equal(productPath('L096', 'build=1'), 'product/L096?build=1');
});

test('file kinds, sizes, order, search and folders read plainly', () => {
  assert.equal(fileKind({type: 'folder', name: 'Ads'}), 'folder');
  assert.equal(fileKind({type: 'file', name: 'A.JPG'}), 'image');
  assert.equal(fileKind({type: 'file', name: 'clip.webm'}), 'video');
  assert.equal(fileKind({type: 'file', name: 'guide.pdf'}), 'pdf');
  assert.equal(fileKind({type: 'file', name: 'brief.docx'}), 'doc');
  assert.equal(fileKind({type: 'file', name: 'costs.csv'}), 'text');
  assert.equal(fileKind({type: 'file', name: 'mystery.bin'}), 'file');
  assert.deepEqual(['image', 'video', 'text', 'pdf', 'doc', 'folder'].map(canPreview), [true, true, true, false, false, false]);
  assert.equal(formatSize(512), '512 B');
  assert.equal(formatSize(141 * 1024), '141 KB');
  assert.equal(formatSize(1277632), '1.2 MB');
  assert.equal(formatSize(52 * 1024 * 1024), '52 MB');
  assert.equal(formatSize(-1), '');
  const items = [
    {type: 'file', name: 'b 10.jpg', createdAt: '2026-10-01T10:00:00Z', uploaderName: 'Cha'},
    {type: 'folder', name: 'Zed', createdAt: '2026-09-01T10:00:00Z'},
    {type: 'file', name: 'b 9.jpg', createdAt: '2026-10-01T12:00:00Z', uploaderName: 'Brother'},
    {type: 'folder', name: 'Ads', createdAt: '2026-10-01T09:00:00Z'},
  ];
  assert.deepEqual(sortFiles(items).map(i => i.name), ['Ads', 'Zed', 'b 9.jpg', 'b 10.jpg']);
  assert.deepEqual(sortFiles(items, 'newest').map(i => i.name), ['Ads', 'Zed', 'b 9.jpg', 'b 10.jpg']);
  assert.deepEqual(sortFiles(items.slice(0, 3).filter(i => i.type === 'file'), 'newest').map(i => i.name), ['b 9.jpg', 'b 10.jpg']);
  assert.deepEqual(filterFiles(items, 'brother').map(i => i.name), ['b 9.jpg']);
  assert.deepEqual(filterFiles(items, 'folder').map(i => i.name), ['Zed', 'Ads']);
  assert.equal(filterFiles(items, '  ').length, 4);
  assert.deepEqual(folderCrumbs('Ads/October tests'), [{name: 'Ads', path: 'Ads'}, {name: 'October tests', path: 'Ads/October tests'}]);
  assert.deepEqual(folderCrumbs(''), []);
  assert.equal(parentFolder('Ads/October tests'), 'Ads');
  assert.equal(parentFolder('Ads'), '');
});

test('every upload says where it lands, and refusals are worded by code', () => {
  assert.equal(destinationText(merrivy, 'Ads/October tests'), 'Uploading to Merrivy › Files › Ads › October tests');
  assert.equal(destinationText(merrivy, ''), 'Uploading to Merrivy › Files');
  assert.equal(destinationText(shared, ''), 'Uploading to Shared library — everyone can see this');
  assert.equal(destinationText(shared, 'Course guides'), 'Uploading to Shared library › Course guides — everyone can see this');
  assert.equal(uploadProblem({name: 'ok.png', size: 10}), null);
  assert.equal(uploadProblem({name: 'big.mp4', size: UPLOAD_LIMIT + 1}).code, 'FILE_TOO_LARGE');
  assert.equal(uploadProblem({name: 'page.html', size: 10}).code, 'UNSUPPORTED_FILE_TYPE');
  assert.equal(uploadProblem({name: 'logo.svg', size: 10}).code, 'UNSUPPORTED_FILE_TYPE');
  assert.match(filesMessage({code: 'ALREADY_EXISTS'}, 'restore'), /didn’t overwrite/);
  assert.match(filesMessage({code: 'ALREADY_EXISTS'}, 'folder'), /folder with that name/);
  assert.match(filesMessage({code: 'QUOTA_EXCEEDED'}), /Removed bin counts/);
  assert.match(filesMessage({status: 401, code: 'REQUEST_FAILED'}), /signed out/);
  assert.match(filesMessage({code: 'REQUEST_FAILED', message: 'Something changed in the revision'}), /didn’t work/, 'Loose words never pick the message (LS-073)');
});

test('sign-in errors map by code, and short passwords are caught before sending', () => {
  assert.equal(authMessage({code: 'AUTH_INVALID_CREDENTIALS'}), 'That username and password don’t match.');
  assert.match(authMessage({code: 'AUTH_RATE_LIMITED', message: 'Unable to sign in with those credentials.'}), /Too many tries/);
  assert.match(authMessage({code: 'AUTH_INVALID_INVITE'}), /expired/);
  assert.match(authMessage({code: 'INVALID_PASSWORD'}), /12 to 128/);
  assert.match(authMessage({code: 'REQUEST_FAILED', message: 'Create the first account on the home computer.'}), /home computer/);
  assert.match(authMessage({network: true}), /Can’t reach/);
  assert.equal(passwordProblem('short'), 'Use at least 12 characters.');
  assert.equal(passwordProblem('a'.repeat(12)), '');
  assert.equal(passwordProblem('a'.repeat(129)), 'Use 128 characters or fewer.');
});

test('the Launchroom home lists today across projects and each project’s next move from saved records', () => {
  const day = '2026-10-01';
  const entries = [
    {project: merrivy, tasks: [
      {id: 'a', title: 'Eye test', date: day, assignee: 'owner', status: 'todo', focus: false, createdAt: '1'},
      {id: 'b', title: 'Agent job', date: day, assignee: 'agent', status: 'todo', createdAt: '2'},
      {id: 'c', title: 'Done', date: day, assignee: 'owner', status: 'done', createdAt: '3'},
      {id: 'd', title: 'Later', date: '2026-10-05', assignee: 'owner', status: 'todo', createdAt: '4'},
      {id: 'e', title: 'Someday', date: '', assignee: 'owner', status: 'todo', createdAt: '5'},
    ]},
    {project: candle, tasks: [
      {id: 'f', title: 'Carried', date: '2026-09-29', assignee: 'shared', status: 'doing', createdAt: '6'},
      {id: 'g', title: 'Focus', date: day, assignee: 'owner', status: 'todo', focus: true, createdAt: '7'},
    ]},
  ];
  const today = todayAcross(entries, day);
  assert.deepEqual(today.items.map(i => i.task.id), ['g', 'f', 'a']);
  assert.equal(today.items[0].project.id, candle.id);
  assert.equal(todayAcross(entries, day, 2).items.length, 2);
  assert.equal(todayAcross(entries, day, 2).total, 3);

  const pipeline = {items: [{id: 'L096'}], rounds: [{number: 4}], round: {number: 4}, counts: {active: 1}, ownerMoves: [{kind: 'eye-test', count: 1}], focus: {kind: 'owner', text: 'Eye test on 1 card: L096'}};
  const planner = {tasks: [{status: 'todo', updatedAt: '2026-10-01T15:00:00Z'}, {status: 'done', updatedAt: '2026-10-01T16:00:00Z'}]};
  assert.deepEqual(projectSummary({pipeline, planner}), {text: 'Your move: Eye test on 1 card: L096', owner: true, onLine: 1, needsYou: 1, openTasks: 1, lastActivity: '2026-10-01T16:00:00Z', empty: false, round: 4});
  const blank = projectSummary({pipeline: {items: [], rounds: [], counts: {active: 0}, ownerMoves: [], focus: {kind: 'start-round', text: 'Nothing is on the line', next: 'Scout: start Round 1'}}, planner: {tasks: []}});
  assert.equal(blank.empty, true);
  assert.match(blank.text, /New project/);
  assert.equal(isEmptyProject({pipeline: {items: [], rounds: []}, tasks: []}), true);
  assert.equal(isEmptyProject({pipeline: {items: [], rounds: []}, tasks: [{id: 'x'}]}), false);
  assert.equal(isEmptyProject({pipeline: {items: [], rounds: []}, tasks: [], archivedProducts: [{id: 'P001'}]}), false);
});

test('access edits save only the projects whose member lists change, with active people only', () => {
  const users = [{id: 'u-owner', role: 'admin'}, {id: 'u-bro', role: 'member'}, {id: 'u-old', role: 'member', disabled: true}];
  const projects = [merrivy, shared, candle, {...course, members: ['u-old']}];
  const rows = accessRows(users, projects);
  assert.deepEqual(rows.map(r => [r.user.id, r.admin, r.projectIds]), [
    ['u-owner', true, ['merrivy', course.id, candle.id]],
    ['u-bro', false, [candle.id]],
    ['u-old', false, [course.id]],
  ]);
  assert.deepEqual(accessChanges(projects, {'u-bro': [candle.id]}, ['u-owner', 'u-bro']), [], 'No change, nothing saved; a disabled member alone does not count as a change');
  assert.deepEqual(accessChanges(projects, {'u-bro': ['merrivy']}, ['u-owner', 'u-bro']), [
    {projectId: 'merrivy', userIds: ['u-bro']},
    {projectId: candle.id, userIds: []},
  ]);
  assert.deepEqual(accessChanges(projects, {'u-bro': [course.id, candle.id]}, ['u-owner', 'u-bro']), [{projectId: course.id, userIds: ['u-bro']}], 'The disabled member drops out of the list being saved');
  assert.equal(accessChanges(projects, {'u-bro': ['shared']}).length, 1, 'Choosing only the Shared library takes the person out of their projects; the library itself is never a membership');
});
