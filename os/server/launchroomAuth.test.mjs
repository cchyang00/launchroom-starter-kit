import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createLaunchroomAuth} from './launchroomAuth.mjs';

const DAY = 24 * 60 * 60 * 1000;
const secret = () => `fixture-${randomBytes(18).toString('base64url')}`;
const hasCode = code => error => error.code === code;

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'launchroom-auth-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('launchroom-auth-'));
    await fs.rm(root, {recursive: true, force: true});
  });
  const dataDir = path.join(root, 'data');
  let time = Date.UTC(2026, 9, 1);
  const now = () => time;
  const auth = await createLaunchroomAuth({dataDir, now});
  const password = secret();
  const setup = () => auth.setup({name: 'Fixture Admin', username: 'fixture-admin', password});
  return {root, dataDir, auth, password, setup, now, file: path.join(dataDir, 'auth/auth.json'), advance: ms => { time += ms; }};
}

function assertPublic(user) {
  assert.deepEqual(Object.keys(user).sort(), ['disabled', 'id', 'name', 'role', 'username']);
  assert.equal(typeof user.id, 'string');
}

test('first administrator setup is serialized across factories and cannot be repeated', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.auth.status(), {initialized: false});
  const other = await createLaunchroomAuth({dataDir: f.dataDir, now: f.now});
  const outcomes = await Promise.allSettled([f.setup(), other.setup({name: 'Other Fixture', username: 'other-admin', password: secret()})]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'AUTH_ALREADY_INITIALIZED');
  const admin = outcomes.find(result => result.status === 'fulfilled').value;
  assertPublic(admin);
  assert.equal(admin.role, 'admin');
  assert.deepEqual(await other.status(), {initialized: true});
  assert.equal((await other.users(admin)).length, 1);
  await assert.rejects(f.setup(), hasCode('AUTH_ALREADY_INITIALIZED'));
});

test('sessions persist across factory restart, logout is idempotent and expiry is enforced', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const login = await f.auth.login({username: ' FIXTURE-ADMIN ', password: f.password}, 'fixture-source');
  assertPublic(login.user);
  assert.equal(Date.parse(login.expiresAt) - f.now(), 7 * DAY);
  const restarted = await createLaunchroomAuth({dataDir: f.dataDir, now: f.now});
  assert.equal((await restarted.authenticate(login.token))?.id, admin.id);
  // A fresh Node process proves that session acceptance comes from disk. The
  // fixture token travels only on stdin and is never printed or put in argv.
  const moduleUrl = new URL('./launchroomAuth.mjs', import.meta.url).href;
  const childSource = `
    const {createLaunchroomAuth} = await import(${JSON.stringify(moduleUrl)});
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const fixture = JSON.parse(input);
    const auth = await createLaunchroomAuth({dataDir: fixture.dataDir, now: () => fixture.time});
    const user = await auth.authenticate(fixture.token);
    process.stdout.write(user?.id === fixture.userId ? 'accepted' : 'rejected');
  `;
  const childResult = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', childSource], {stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.resume();
    child.once('error', reject);
    child.once('close', code => resolve({code, accepted: output === 'accepted'}));
    child.stdin.end(JSON.stringify({dataDir: f.dataDir, time: f.now(), token: login.token, userId: admin.id}));
  });
  assert.equal(childResult.code, 0);
  assert.equal(childResult.accepted, true);
  await restarted.logout(login.token);
  await restarted.logout(login.token);
  assert.equal(await f.auth.authenticate(login.token), null);
  const second = await restarted.login({username: admin.username, password: f.password}, 'fixture-source');
  f.advance(7 * DAY - 1);
  assert.equal((await f.auth.authenticate(second.token))?.id, admin.id);
  f.advance(1);
  assert.equal(await f.auth.authenticate(second.token), null);
  for (const invalid of [null, {}, '', 'wrong', randomBytes(32).toString('base64url')]) {
    assert.equal(await f.auth.authenticate(invalid), null);
    await f.auth.logout(invalid);
  }
});

test('passwords are salted with fixed scrypt parameters; raw passwords and tokens never persist', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const invitation = await f.auth.createInvite(admin, {name: 'Fixture Member', username: 'fixture-member'});
  const member = await f.auth.acceptInvite({token: invitation.token, password: f.password});
  const session = await f.auth.login({username: member.username, password: f.password}, 'fixture-source');
  const content = await fs.readFile(f.file, 'utf8');
  for (const value of [f.password, invitation.token, session.token]) assert.equal(content.includes(value), false);
  const state = JSON.parse(content);
  assert.equal(state.users[0].password.algorithm, 'scrypt');
  assert.deepEqual([state.users[0].password.N, state.users[0].password.r, state.users[0].password.p], [131072, 8, 1]);
  assert.equal(state.users[0].password.salt === state.users[1].password.salt, false);
  assert.equal(state.users[0].password.key === state.users[1].password.key, false);
  assert.equal(state.sessions.every(entry => /^[a-f0-9]{64}$/.test(entry.hash)), true);
  assert.equal(state.invites.length, 0);
  const entries = await fs.readdir(path.dirname(f.file));
  assert.deepEqual(entries, ['auth.json']);
  if (process.platform !== 'win32') {
    assert.equal((await fs.stat(f.file)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.dirname(f.file))).mode & 0o777, 0o700);
  }
});

test('invalid, replayed and expired invites fail, and a weak password does not consume an invite', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const invite = await f.auth.createInvite(admin, {name: 'Fixture Member', username: 'fixture-member'});
  assert.equal(Date.parse(invite.expiresAt) - f.now(), DAY);
  const password = secret();
  for (const token of ['', null, {}, randomBytes(32).toString('base64url')]) {
    await assert.rejects(f.auth.acceptInvite({token, password}), hasCode('AUTH_INVALID_INVITE'));
  }
  for (const invalid of ['short', 'x'.repeat(129), null, {}, 'has\ncontrol\ncharacters']) {
    await assert.rejects(f.auth.acceptInvite({token: invite.token, password: invalid}), hasCode('INVALID_PASSWORD'));
  }
  await assert.rejects(f.auth.acceptInvite({token: invite.token, password, role: 'admin'}), hasCode('AUTH_INVALID_INVITE'));
  const outcomes = await Promise.allSettled([
    f.auth.acceptInvite({token: invite.token, password}),
    f.auth.acceptInvite({token: invite.token, password}),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'AUTH_INVALID_INVITE');
  const member = outcomes.find(result => result.status === 'fulfilled').value;
  assert.equal(member.role, 'member');
  assertPublic(member);
  const expired = await f.auth.createInvite(admin, {name: 'Expired Fixture', username: 'expired-member'});
  f.advance(DAY);
  await assert.rejects(f.auth.acceptInvite({token: expired.token, password}), hasCode('AUTH_INVALID_INVITE'));
  await f.auth.createInvite(admin, {name: 'Replacement Fixture', username: 'expired-member'});
});

test('admin operations recheck stored authority, revoke all sessions and protect the last administrator', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const invite = await f.auth.createInvite(admin, {name: 'Fixture Member', username: 'fixture-member'});
  const password = secret();
  const member = await f.auth.acceptInvite({token: invite.token, password});
  const forgedActor = {...member, role: 'admin'};
  await assert.rejects(f.auth.users(forgedActor), hasCode('AUTH_FORBIDDEN'));
  await assert.rejects(f.auth.createInvite(forgedActor, {name: 'Unwanted User', username: 'unwanted-user'}), hasCode('AUTH_FORBIDDEN'));
  await assert.rejects(f.auth.revokeUser(forgedActor, admin.id), hasCode('AUTH_FORBIDDEN'));
  await assert.rejects(f.auth.users(null), hasCode('AUTH_FORBIDDEN'));
  await assert.rejects(f.auth.revokeUser(admin, admin.id), hasCode('LAST_ADMIN'));
  const sessions = await Promise.all([
    f.auth.login({username: member.username, password}, 'fixture-source-1'),
    f.auth.login({username: member.username, password}, 'fixture-source-2'),
  ]);
  const disabled = await f.auth.revokeUser(admin, member.id);
  assert.equal(disabled.disabled, true);
  for (const session of sessions) assert.equal(await f.auth.authenticate(session.token), null);
  const restarted = await createLaunchroomAuth({dataDir: f.dataDir, now: f.now});
  for (const session of sessions) assert.equal(await restarted.authenticate(session.token), null);
  await assert.rejects(restarted.login({username: member.username, password}, 'fixture-source-3'), hasCode('AUTH_INVALID_CREDENTIALS'));
  assert.equal((await restarted.users(admin)).find(user => user.id === member.id).disabled, true);
  await assert.rejects(f.auth.revokeUser(admin, 'absent-user'), hasCode('USER_NOT_FOUND'));
});

test('disabling an administrator invalidates its pending invitations and stale actor object', async t => {
  const f = await fixture(t);
  const first = await f.setup();
  const invite = await f.auth.createInvite(first, {name: 'Second Admin', username: 'second-admin', role: 'admin'});
  const second = await f.auth.acceptInvite({token: invite.token, password: secret()});
  const pending = await f.auth.createInvite(first, {name: 'Pending User', username: 'pending-user'});
  await f.auth.revokeUser(second, first.id);
  await assert.rejects(f.auth.users(first), hasCode('AUTH_FORBIDDEN'));
  await assert.rejects(f.auth.acceptInvite({token: pending.token, password: secret()}), hasCode('AUTH_INVALID_INVITE'));
  await assert.rejects(f.auth.revokeUser(second, second.id), hasCode('LAST_ADMIN'));
  assert.equal((await f.auth.users(second)).filter(user => user.role === 'admin' && !user.disabled).length, 1);
});

test('bad sign-ins use one generic response and throttle normalized usernames per source', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  const errors = [];
  for (const input of [
    {username: admin.username, password: secret()},
    {username: 'unknown-user', password: secret()},
    {username: null, password: null},
    {username: admin.username, password: f.password, role: 'admin'},
  ]) {
    try { await f.auth.login(input, 'separate-source'); assert.fail('Invalid login was accepted'); }
    catch (error) { assert.equal(error.code, 'AUTH_INVALID_CREDENTIALS'); errors.push(error.message); }
  }
  assert.equal(new Set(errors).size, 1);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(f.auth.login({username: attempt % 2 ? ' FIXTURE-ADMIN ' : admin.username, password: secret()}, 'limited-source'), hasCode('AUTH_INVALID_CREDENTIALS'));
  }
  const second = await createLaunchroomAuth({dataDir: f.dataDir, now: f.now});
  await assert.rejects(second.login({username: admin.username, password: f.password}, 'limited-source'), error => error.code === 'AUTH_RATE_LIMITED' && error.status === 429 && error.message === errors[0]);
  const session = await second.login({username: admin.username, password: f.password}, 'another-source');
  assert.equal((await f.auth.authenticate(session.token))?.id, admin.id);
  f.advance(15 * 60 * 1000);
  const recovered = await f.auth.login({username: admin.username, password: f.password}, 'limited-source');
  assert.equal(recovered.user.id, admin.id);
});

test('setup validates input without saving and normalizes usernames before duplicate checks', async t => {
  const f = await fixture(t);
  for (const input of [
    {name: 'Fixture', username: 'fixture', password: 'short'},
    {name: 'Fixture', username: 'fixture', password: 'x'.repeat(129)},
    {name: 'Fixture', username: 'fixture', password: f.password, role: 'admin'},
    {name: '\n', username: 'fixture', password: f.password},
    {name: 'Fixture', username: '../fixture', password: f.password},
    {name: 'Fixture', username: 'aa', password: f.password},
    null,
  ]) await assert.rejects(f.auth.setup(input));
  assert.deepEqual(await f.auth.status(), {initialized: false});
  await assert.rejects(fs.stat(f.file), hasCode('ENOENT'));
  const admin = await f.setup();
  await assert.rejects(f.auth.createInvite(admin, {name: 'Duplicate', username: ' FIXTURE-ADMIN '}), hasCode('USERNAME_TAKEN'));
  await f.auth.createInvite(admin, {name: 'Pending', username: 'pending-member'});
  await assert.rejects(f.auth.createInvite(admin, {name: 'Duplicate Pending', username: 'PENDING-MEMBER'}), hasCode('USERNAME_TAKEN'));
  for (const role of ['owner', '', null, {}]) {
    await assert.rejects(f.auth.createInvite(admin, {name: 'Other', username: 'other-member', role}), hasCode('INVALID_ROLE'));
  }
  for (const input of [{name: 'Other', username: 'other-member', disabled: false}, {name: {}, username: 'other-member'}]) {
    await assert.rejects(f.auth.createInvite(admin, input));
  }
});

test('pending invitations reserve the 50-user capacity and expire out of the count', async t => {
  const f = await fixture(t);
  const admin = await f.setup();
  for (let index = 1; index < 50; index += 1) {
    await f.auth.createInvite(admin, {name: `Fixture ${index}`, username: `fixture-${index}`});
  }
  await assert.rejects(f.auth.createInvite(admin, {name: 'Too Many', username: 'too-many'}), hasCode('USER_LIMIT'));
  f.advance(DAY);
  await f.auth.createInvite(admin, {name: 'After Expiry', username: 'after-expiry'});
  assert.equal((await f.auth.users(admin)).length, 1);
});

test('corrupt or oversized authentication data fails closed and is never overwritten', async t => {
  const f = await fixture(t);
  await f.setup();
  const original = await fs.readFile(f.file, 'utf8');
  for (const content of ['{broken', JSON.stringify({schema: 1, users: [], sessions: [], invites: [], unexpected: true}), 'x'.repeat(1024 * 1024 + 1)]) {
    await fs.writeFile(f.file, content);
    await assert.rejects(f.auth.status(), hasCode('AUTH_DATA_INVALID'));
    await assert.rejects(f.setup(), hasCode('AUTH_DATA_INVALID'));
    await assert.rejects(createLaunchroomAuth({dataDir: f.dataDir}), hasCode('AUTH_DATA_INVALID'));
    assert.equal((await fs.readFile(f.file, 'utf8')) === content, true);
  }
  const corrupted = JSON.parse(original);
  corrupted.users[0].password.N = 2;
  await fs.writeFile(f.file, JSON.stringify(corrupted));
  await assert.rejects(f.auth.status(), hasCode('AUTH_DATA_INVALID'));
  corrupted.users[0].password.N = 131072;
  corrupted.users[0].name = null;
  await fs.writeFile(f.file, JSON.stringify(corrupted));
  await assert.rejects(f.auth.status(), hasCode('AUTH_DATA_INVALID'));
});

test('symlink or junction storage is rejected on startup and after initialization', async t => {
  const f = await fixture(t);
  const elsewhere = path.join(f.root, 'elsewhere');
  await fs.mkdir(elsewhere);
  const linked = path.join(f.root, 'linked');
  await fs.symlink(elsewhere, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createLaunchroomAuth({dataDir: linked}), hasCode('AUTH_STORAGE_UNSAFE'));
  const current = path.join(f.dataDir, 'auth');
  await fs.rename(current, path.join(f.dataDir, 'original-auth'));
  await fs.symlink(elsewhere, current, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.setup(), hasCode('AUTH_STORAGE_UNSAFE'));
  assert.deepEqual(await fs.readdir(elsewhere), []);
});

test('hard-linked auth files are rejected without touching the linked destination', async t => {
  const f = await fixture(t);
  await f.setup();
  const duplicate = path.join(f.root, 'linked-auth.json');
  await fs.link(f.file, duplicate);
  await assert.rejects(f.auth.status(), hasCode('AUTH_STORAGE_UNSAFE'));
  await assert.rejects(createLaunchroomAuth({dataDir: f.dataDir}), hasCode('AUTH_STORAGE_UNSAFE'));
});
