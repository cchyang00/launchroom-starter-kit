import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink, stat, realpath } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createLaunchroomProjects, LAUNCHROOM_UPLOAD_LIMIT, LAUNCHROOM_PROJECT_QUOTA, LAUNCHROOM_ITEM_LIMIT } from './launchroomProjects.mjs';

const admin = { id: 'owner', role: 'admin' };
const alice = { id: 'alice', role: 'member' };
const bob = { id: 'bob', role: 'member' };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const hasCode = code => error => error.code === code && Number.isInteger(error.status) && error.statusCode === error.status;
async function fixture(t) {
  const tempRoot = await realpath(tmpdir());
  const base = await mkdtemp(path.join(tempRoot, 'launchroom-project-test-'));
  const root = path.join(base, 'workspace'), dataDir = path.join(base, 'private');
  await mkdir(path.join(root, 'workflow'), { recursive: true });
  await mkdir(path.join(root, 'memory'));
  await writeFile(path.join(root, 'workflow', 'the-line.json'), JSON.stringify({ steps: [{ id: 'find', name: 'Find' }] }));
  await writeFile(path.join(root, 'memory', 'NOW.md'), 'PRIVATE OWNER HANDOFF');
  await writeFile(path.join(root, 'private.txt'), 'PRIVATE OWNER MATERIAL');
  t.after(async () => {
    assert.ok(base.startsWith(path.join(tempRoot, 'launchroom-project-test-')));
    await rm(base, { recursive: true, force: true });
  });
  const options = { workspaceRoot: root, dataDir };
  const service = await createLaunchroomProjects(options);
  const upload = (user, id, name = 'notes.txt', bytes = Buffer.from('Hello'), extra = {}) => service.upload(user, id, { name, stream: Readable.from([bytes]), contentLength: String(bytes.length), ...extra });
  const manifestPath = id => path.join(dataDir, 'project-files', `${id}.json`);
  return { base, root, dataDir, options, service, upload, manifestPath };
}
function entry(name, { type = 'folder', size = 0 } = {}) {
  const id = randomUUID();
  return { id, name, type, size, uploadedBy: alice.id, createdAt: new Date().toISOString(), path: type === 'folder' ? name : `${id}${path.extname(name)}`, ...(type === 'file' ? { mime: 'image/png' } : {}) };
}
function docx(names = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
  const local = [], central = [];
  let offset = 0;
  for (const name of names) {
    const filename = Buffer.from(name), contents = Buffer.from('<xml/>');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(contents.length, 18); header.writeUInt32LE(contents.length, 22); header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(contents.length, 20); directory.writeUInt32LE(contents.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, filename, contents); central.push(directory, filename);
    offset += header.length + filename.length + contents.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

test('seeds a private legacy project and shared library; new projects copy only the workflow method', async t => {
  const { service, root } = await fixture(t);
  assert.deepEqual((await service.list(alice)).map(project => project.id), ['shared']);
  assert.deepEqual((await service.list(admin)).map(project => project.id), ['merrivy', 'shared']);
  await assert.rejects(service.get(alice, 'merrivy'), hasCode('NOT_FOUND'));
  assert.equal((await service.get(admin, 'merrivy')).root, root);
  const project = await service.create(alice, { name: 'Alice studio' });
  assert.equal(project.kind, 'project');
  assert.deepEqual(project.members, [alice.id]);
  assert.ok(project.root.startsWith(path.join(root, 'launchroom', 'projects')));
  for (const name of ['products', 'research', 'resources', 'notes', 'store', 'memory', 'workflow', 'os/data', 'agents']) assert.ok((await stat(path.join(project.root, name))).isDirectory());
  assert.match(await readFile(path.join(project.root, 'products/INDEX.md'), 'utf8'), /No products/);
  assert.doesNotMatch(await readFile(path.join(project.root, 'memory/NOW.md'), 'utf8'), /PRIVATE OWNER/);
  assert.ok((await readFile(path.join(project.root, 'AGENTS.md'), 'utf8')).includes(`LAUNCHROOM_PROJECT=${project.id}`));
  assert.equal(await readFile(path.join(project.root, 'workflow/the-line.json'), 'utf8'), await readFile(path.join(root, 'workflow/the-line.json'), 'utf8'));
  await assert.rejects(readFile(path.join(project.root, 'private.txt')), { code: 'ENOENT' });
  assert.deepEqual(await service.files(admin, 'merrivy'), []);
});

test('every method enforces authentication and live membership; admin can grant and revoke access', async t => {
  const { service, upload } = await fixture(t);
  const project = await service.create(alice, { name: 'Private' });
  const file = await upload(alice, project.id);
  for (const operation of [
    () => service.list(null), () => service.get(null, project.id), () => service.create(null, { name: 'x' }),
    () => service.setMembers(null, project.id, []), () => service.files(null, project.id),
    () => service.mkdir(null, project.id, { name: 'x' }), () => upload(null, project.id),
    () => service.download(null, project.id, file.path), () => service.remove(null, project.id, file.path),
    () => service.removed(null, project.id), () => service.restore(null, project.id, file.id),
  ]) await assert.rejects(operation(), hasCode('UNAUTHENTICATED'));
  for (const operation of [
    () => service.get(bob, project.id), () => service.files(bob, project.id), () => service.mkdir(bob, project.id, { name: 'x' }),
    () => upload(bob, project.id), () => service.download(bob, project.id, file.path), () => service.remove(bob, project.id, file.path),
    () => service.removed(bob, project.id), () => service.restore(bob, project.id, file.id),
  ]) await assert.rejects(operation(), hasCode('NOT_FOUND'));
  await assert.rejects(service.setMembers(alice, project.id, [bob.id]), hasCode('FORBIDDEN'));
  await service.setMembers(admin, project.id, [alice.id, bob.id]);
  assert.equal((await service.files(bob, project.id))[0].uploadedBy, alice.id);
  await service.setMembers(admin, project.id, [alice.id]);
  await assert.rejects(service.download(bob, project.id, file.path), hasCode('NOT_FOUND'));
  await service.setMembers(admin, 'merrivy', [bob.id]);
  assert.equal((await service.get(bob, 'merrivy')).kind, 'legacy');
  await assert.rejects(service.setMembers(admin, 'shared', []), hasCode('INVALID_INPUT'));
  await assert.rejects(service.list({ ...alice, active: false }), hasCode('UNAUTHENTICATED'));
});

test('projects and duplicate filenames stay separate; metadata and uploader survive restart', async t => {
  const { service, options, upload } = await fixture(t);
  const a = await service.create(alice, { name: 'A' }), b = await service.create(bob, { name: 'B' });
  const folder = await service.mkdir(alice, a.id, { name: 'References' });
  await service.mkdir(alice, a.id, { folder: folder.path, name: 'Images' });
  const first = await upload(alice, a.id, 'same.png', png, { folder: 'References/Images' });
  const second = await upload(alice, a.id, 'same.png', png, { folder: 'References/Images' });
  await upload(bob, b.id, 'same.png', png);
  assert.notEqual(first.path, second.path);
  assert.equal(first.name, second.name);
  assert.equal((await service.files(alice, a.id, 'References/Images')).length, 2);
  assert.equal((await service.files(bob, b.id)).length, 1);
  await assert.rejects(service.download(admin, b.id, first.path), hasCode('NOT_FOUND'));
  const restarted = await createLaunchroomProjects(options);
  assert.deepEqual(await restarted.files(alice, a.id, 'References/Images'), await service.files(alice, a.id, 'References/Images'));
  const download = await restarted.download(alice, a.id, first.path);
  assert.deepEqual(await readFile(download.filePath), png);
  assert.equal(download.mime, 'image/png');
  assert.equal(download.name, 'same.png');
  const shared = await upload(alice, 'shared', 'shared.md', Buffer.from('# Shared'));
  assert.equal((await restarted.files(bob, 'shared'))[0].id, shared.id);
});

test('rejects traversal, encoded paths, Windows aliases, absolute paths and nested bypasses', async t => {
  const { service, upload } = await fixture(t);
  for (const name of ['../x', '.', '..', '/tmp/x', 'C:\\temp', 'a:b.txt', 'CON', 'con.txt', 'LPT1.txt', 'COM¹.txt', 'trailing.', 'trailing ', '.hidden', '%2e%2e', 'x\\y', 'x\0y', 'x/y', 'a?b', 'a|b']) {
    await assert.rejects(service.mkdir(alice, 'shared', { name }), hasCode('INVALID_INPUT'), name);
    await assert.rejects(upload(alice, 'shared', name), hasCode('INVALID_INPUT'), name);
  }
  for (const folder of ['../memory', 'C:/private', '\\\\server\\share', 'foo//bar', 'foo/../bar', '%2e%2e', 'foo.', 'foo/bar/']) {
    await assert.rejects(service.files(alice, 'shared', folder), hasCode('INVALID_INPUT'), folder);
    await assert.rejects(upload(alice, 'shared', 'ok.txt', Buffer.from('x'), { folder }), hasCode('INVALID_INPUT'), folder);
    await assert.rejects(service.download(alice, 'shared', folder), hasCode('INVALID_INPUT'), folder);
  }
  await service.mkdir(alice, 'shared', { name: 'Folder' });
  await assert.rejects(service.mkdir(alice, 'shared', { name: 'folder' }), hasCode('ALREADY_EXISTS'));
  await assert.rejects(service.files(alice, 'shared', 'untracked'), hasCode('NOT_FOUND'));
});

test('allows the documented file formats and verifies binary signatures and safe UTF-8 text', async t => {
  const { upload } = await fixture(t);
  const mp4 = Buffer.alloc(20); mp4.writeUInt32BE(20, 0); mp4.write('ftypisom', 4);
  for (const [name, bytes] of [
    ['image.png', png], ['image.jpg', Buffer.from([255, 216, 255, 224])], ['image.jpeg', Buffer.from([255, 216, 255, 224])],
    ['image.gif', Buffer.from('GIF89a')], ['image.webp', Buffer.from('RIFFxxxxWEBP')], ['paper.pdf', Buffer.from('%PDF-1.7\n')],
    ['video.mp4', mp4], ['video.webm', Buffer.concat([Buffer.from([26, 69, 223, 163]), Buffer.from('webm')])],
    ['notes.txt', Buffer.from('Hello')], ['notes.md', Buffer.from('# Notes')], ['rows.csv', Buffer.from('a,b\n1,2')], ['document.docx', docx()],
  ]) assert.equal((await upload(alice, 'shared', name, bytes)).name, name);
  for (const name of ['bad.svg', 'bad.html', 'bad.exe', 'bad.js', 'bad.zip']) await assert.rejects(upload(alice, 'shared', name), hasCode('UNSUPPORTED_FILE_TYPE'));
  for (const name of ['bad.png', 'bad.jpg', 'bad.gif', 'bad.webp', 'bad.pdf', 'bad.mp4', 'bad.webm', 'bad.docx']) await assert.rejects(upload(alice, 'shared', name, Buffer.from('not an image')), hasCode('INVALID_FILE_TYPE'));
  for (const bytes of [Buffer.from('<html>bad</html>'), Buffer.from('<svg/>'), Buffer.from([255, 254]), Buffer.from('a\0b')]) await assert.rejects(upload(alice, 'shared', 'bad.txt', bytes), hasCode('INVALID_FILE_TYPE'));
  await assert.rejects(upload(alice, 'shared', 'archive.docx', docx(['other.txt'])), hasCode('INVALID_FILE_TYPE'));
  await assert.rejects(upload(alice, 'shared', 'macro.docx', docx(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/vbaProject.bin'])), hasCode('INVALID_FILE_TYPE'));
});

test('bounds actual streamed bytes, rejects size mismatches and cleans failed partial uploads', async t => {
  const { service, upload, root } = await fixture(t);
  await assert.rejects(upload(alice, 'shared', 'huge.png', png, { contentLength: LAUNCHROOM_UPLOAD_LIMIT + 1 }), hasCode('FILE_TOO_LARGE'));
  await assert.rejects(upload(alice, 'shared', 'mismatch.png', png, { contentLength: 2 }), hasCode('LENGTH_MISMATCH'));
  for (const contentLength of ['1e3', '-1', 'nonsense', '9007199254740993']) await assert.rejects(upload(alice, 'shared', 'invalid.png', png, { contentLength }), hasCode('INVALID_INPUT'));
  const chunk = Buffer.alloc(1024 * 1024); png.copy(chunk);
  async function* tooBig() { for (let i = 0; i < 101; i++) yield chunk; }
  await assert.rejects(service.upload(alice, 'shared', { name: 'huge.png', stream: Readable.from(tooBig()) }), hasCode('FILE_TOO_LARGE'));
  async function* interrupted() { yield png; throw new Error('connection interrupted'); }
  await assert.rejects(service.upload(alice, 'shared', { name: 'partial.png', stream: Readable.from(interrupted()) }), /connection interrupted/);
  assert.deepEqual(await service.files(alice, 'shared'), []);
  assert.deepEqual(await readdir(path.join(root, 'launchroom/shared/inbox/uploads')), []);
});

test('remove and restore preserve nested files, names and attribution across restart without overwrites', async t => {
  const { service, options, upload } = await fixture(t);
  const folder = await service.mkdir(alice, 'shared', { name: 'Keep' });
  await service.mkdir(alice, 'shared', { folder: folder.path, name: 'Nested' });
  const original = await upload(alice, 'shared', 'original.png', png, { folder: 'Keep/Nested' });
  const removal = await service.remove(bob, 'shared', folder.path);
  assert.ok(removal.removed);
  assert.deepEqual(await service.files(alice, 'shared'), []);
  await assert.rejects(service.download(alice, 'shared', original.path), hasCode('NOT_FOUND'));
  const restarted = await createLaunchroomProjects(options);
  const [removed] = await restarted.removed(alice, 'shared');
  assert.equal(removed.id, folder.id); assert.equal(removed.itemCount, 3); assert.equal(removed.removedBy, bob.id);
  assert.equal((await restarted.restore(bob, 'shared', folder.id)).id, folder.id);
  assert.deepEqual(await readFile((await restarted.download(alice, 'shared', original.path)).filePath), png);
  assert.equal((await restarted.files(alice, 'shared', 'Keep/Nested'))[0].uploadedBy, alice.id);
  assert.deepEqual(await restarted.removed(alice, 'shared'), []);
  await restarted.remove(alice, 'shared', folder.path);
  await restarted.mkdir(alice, 'shared', { name: 'Keep' });
  await assert.rejects(restarted.restore(alice, 'shared', folder.id), hasCode('ALREADY_EXISTS'));
  assert.equal((await restarted.removed(alice, 'shared')).length, 1);
});

test('restoring a file requires its parent folder and never recreates an unrelated deleted tree', async t => {
  const { service, upload } = await fixture(t);
  const folder = await service.mkdir(alice, 'shared', { name: 'Parent' });
  const file = await upload(alice, 'shared', 'note.txt', Buffer.from('data'), { folder: 'Parent' });
  await service.remove(alice, 'shared', file.path);
  await service.remove(alice, 'shared', folder.path);
  await assert.rejects(service.restore(alice, 'shared', file.id), hasCode('NOT_FOUND'));
  await service.restore(alice, 'shared', folder.id);
  await service.restore(alice, 'shared', file.id);
  assert.equal((await service.files(alice, 'shared', 'Parent'))[0].id, file.id);
});

test('fails closed on corrupt or missing private records and does not reset the registry', async t => {
  const { service, options, dataDir, manifestPath, base } = await fixture(t);
  const registry = path.join(dataDir, 'projects.json');
  const saved = await readFile(registry, 'utf8');
  await writeFile(registry, '{broken');
  await assert.rejects(service.list(admin), hasCode('CORRUPT_DATA'));
  await assert.rejects(createLaunchroomProjects(options), hasCode('CORRUPT_DATA'));
  assert.equal(await readFile(registry, 'utf8'), '{broken');
  await writeFile(registry, saved);
  const otherRoot = path.join(base, 'other-workspace'); await mkdir(otherRoot);
  await assert.rejects(createLaunchroomProjects({ workspaceRoot: otherRoot, dataDir }), hasCode('CORRUPT_DATA'));
  await writeFile(manifestPath('shared'), JSON.stringify({ version: 1, projectId: 'shared', entries: [{ ...entry('safe'), path: '../private' }], removed: [] }));
  await assert.rejects(service.files(alice, 'shared'), hasCode('CORRUPT_DATA'));
  await rm(registry);
  await assert.rejects(createLaunchroomProjects(options), hasCode('CORRUPT_DATA'));
});

test('serialized concurrent calls from separate service instances cannot exceed the item quota', async t => {
  const { service, options, manifestPath, upload } = await fixture(t);
  const second = await createLaunchroomProjects(options);
  const record = JSON.parse(await readFile(manifestPath('shared'), 'utf8'));
  record.entries = Array.from({ length: LAUNCHROOM_ITEM_LIMIT - 1 }, (_, index) => entry(`existing-${index}`));
  await writeFile(manifestPath('shared'), JSON.stringify(record));
  const results = await Promise.allSettled([
    upload(alice, 'shared', 'last.txt'),
    second.upload(alice, 'shared', { name: 'racing.txt', stream: Readable.from(['hello']) }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'QUOTA_EXCEEDED');
  assert.equal(JSON.parse(await readFile(manifestPath('shared'), 'utf8')).entries.length, LAUNCHROOM_ITEM_LIMIT);
});

test('byte quota includes the recoverable bin and rejects before consuming the request', async t => {
  const { service, manifestPath } = await fixture(t);
  const record = JSON.parse(await readFile(manifestPath('shared'), 'utf8'));
  let remaining = LAUNCHROOM_PROJECT_QUOTA;
  while (remaining) {
    const size = Math.min(remaining, LAUNCHROOM_UPLOAD_LIMIT), file = entry('previous.png', { type: 'file', size });
    record.removed.push({ binId: randomUUID(), sourcePath: file.path, removedAt: new Date().toISOString(), removedBy: alice.id, entries: [file] });
    remaining -= size;
  }
  await writeFile(manifestPath('shared'), JSON.stringify(record));
  let consumed = false;
  async function* data() { consumed = true; yield png; }
  await assert.rejects(service.upload(alice, 'shared', { name: 'over.png', contentLength: String(png.length), stream: Readable.from(data()) }), hasCode('QUOTA_EXCEEDED'));
  assert.equal(consumed, false);
});

test('rejects junctions in workspace, upload folders and private metadata paths', async t => {
  const { service, root, base, dataDir } = await fixture(t);
  const outside = path.join(base, 'outside'); await mkdir(outside);
  const alias = path.join(base, 'linked-workspace');
  await symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createLaunchroomProjects({ workspaceRoot: alias, dataDir }), hasCode('UNSAFE_PATH'));
  await service.mkdir(alice, 'shared', { name: 'Linked' });
  const folder = path.join(root, 'launchroom/shared/inbox/uploads/Linked');
  await rm(folder, { recursive: true });
  await symlink(outside, folder, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(service.files(alice, 'shared'), hasCode('UNSAFE_PATH'));
  await assert.rejects(service.files(alice, 'shared', 'Linked'), hasCode('UNSAFE_PATH'));
  await assert.rejects(service.remove(alice, 'shared', 'Linked'), hasCode('UNSAFE_PATH'));
  const privateAlias = path.join(base, 'linked-private');
  await symlink(dataDir, privateAlias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createLaunchroomProjects({ workspaceRoot: root, dataDir: privateAlias }), hasCode('UNSAFE_PATH'));
  await assert.rejects(createLaunchroomProjects({ workspaceRoot: root, dataDir: path.join(root, 'inbox/uploads/private') }), hasCode('UNSAFE_PATH'));
});

test('unregistered legacy files are not listed or downloadable and unknown folder contents are not removed', async t => {
  const { service, root, upload } = await fixture(t);
  await service.files(admin, 'merrivy');
  await writeFile(path.join(root, 'inbox/uploads/unregistered.txt'), 'NOT SHARED');
  assert.deepEqual(await service.files(admin, 'merrivy'), []);
  await assert.rejects(service.download(admin, 'merrivy', 'unregistered.txt'), hasCode('NOT_FOUND'));
  const folder = await service.mkdir(alice, 'shared', { name: 'Folder' });
  await upload(alice, 'shared', 'registered.txt', Buffer.from('yes'), { folder: folder.path });
  const unknown = path.join(root, 'launchroom/shared/inbox/uploads/Folder/unregistered.txt');
  await writeFile(unknown, 'external file');
  await assert.rejects(service.remove(alice, 'shared', folder.path), hasCode('UNTRACKED_FILE'));
  assert.equal(await readFile(unknown, 'utf8'), 'external file');
});

test('missing tracked children block removal rather than create an unrestorable recovery record', async t => {
  const { service, root, upload } = await fixture(t);
  const folder = await service.mkdir(alice, 'shared', { name: 'Folder' });
  const file = await upload(alice, 'shared', 'registered.txt', Buffer.from('data'), { folder: folder.path });
  await rm(path.join(root, 'launchroom/shared/inbox/uploads', file.path));
  await assert.rejects(service.remove(alice, 'shared', folder.path), hasCode('CORRUPT_DATA'));
  assert.deepEqual(await service.removed(alice, 'shared'), []);
});
