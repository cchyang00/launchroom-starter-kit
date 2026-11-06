import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash, randomBytes, randomUUID, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const deriveKey = promisify(scrypt);
const SCRYPT = Object.freeze({N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024});
const DAY = 24 * 60 * 60 * 1000;
const SESSION_LIFE = 7 * DAY;
const MAX_USERS = 50;
const MAX_SESSIONS_PER_USER = 10;
const MAX_FILE_BYTES = 1024 * 1024;
const RATE_WINDOW = 15 * 60 * 1000;
const MAX_RATE_ENTRIES = 2000;
const BAD_LOGIN = 'Unable to sign in with those credentials.';
const lanes = new Map();
const dummyPassword = {salt: randomBytes(16).toString('hex'), key: randomBytes(64).toString('hex')};
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function fail(code, message, status = 400) {
  return Object.assign(new Error(message), {code, status});
}

function record(value, allowed, required = allowed) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Object.keys(value).every(key => allowed.includes(key))
    && required.every(key => Object.hasOwn(value, key));
}

function username(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalized) ? normalized : null;
}

function displayName(value) {
  if (typeof value !== 'string' || value.length > 160) return null;
  const normalized = value.trim();
  return normalized && [...normalized].length <= 80 && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(normalized)
    ? normalized : null;
}

function validPassword(value) {
  if (typeof value !== 'string' || value.length > 256) return false;
  const length = [...value].length;
  return length >= 12 && length <= 128 && !/[\p{Cc}\p{Cs}]/u.test(value);
}

function checkPassword(value) {
  if (!validPassword(value)) throw fail('INVALID_PASSWORD', 'Use a password of 12 to 128 characters without control characters.');
}

function identity(input) {
  const normalizedUsername = username(input.username);
  const name = displayName(input.name);
  if (!normalizedUsername || !name) throw fail('INVALID_USER', 'Provide a name and a username of 3 to 64 letters, numbers, dots, underscores or hyphens.');
  return {name, username: normalizedUsername};
}

function publicUser(user) {
  return {id: user.id, username: user.username, name: user.name, role: user.role, disabled: user.disabled};
}

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function matchingHash(a, b) { return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }
function timeValue(value) { return Number.isSafeInteger(value) && value >= 0; }
function freshState() { return {schema: 1, users: [], sessions: [], invites: []}; }

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, Buffer.from(salt, 'hex'), 64, SCRYPT);
  return {algorithm: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt, key: key.toString('hex')};
}

async function verifyPassword(password, stored) {
  const key = await deriveKey(password, Buffer.from(stored.salt, 'hex'), 64, SCRYPT);
  return timingSafeEqual(key, Buffer.from(stored.key, 'hex'));
}

function validateState(state) {
  const corrupt = () => { throw fail('AUTH_DATA_INVALID', 'The authentication data needs administrator repair.', 503); };
  if (!record(state, ['schema', 'users', 'sessions', 'invites']) || state.schema !== 1
    || !Array.isArray(state.users) || !Array.isArray(state.sessions) || !Array.isArray(state.invites)
    || state.users.length > MAX_USERS || state.invites.length > MAX_USERS
    || state.sessions.length > MAX_USERS * MAX_SESSIONS_PER_USER) corrupt();
  const ids = new Set();
  const names = new Set();
  for (const user of state.users) {
    if (!record(user, ['id', 'username', 'name', 'role', 'disabled', 'password'])
      || !idPattern.test(user.id) || ids.has(user.id) || !username(user.username)
      || username(user.username) !== user.username || names.has(user.username)
      || !displayName(user.name) || displayName(user.name) !== user.name || !['admin', 'member'].includes(user.role)
      || typeof user.disabled !== 'boolean'
      || !record(user.password, ['algorithm', 'N', 'r', 'p', 'salt', 'key'])
      || user.password.algorithm !== 'scrypt' || user.password.N !== SCRYPT.N
      || user.password.r !== SCRYPT.r || user.password.p !== SCRYPT.p
      || !/^[0-9a-f]{32}$/.test(user.password.salt) || !/^[0-9a-f]{128}$/.test(user.password.key)) corrupt();
    ids.add(user.id);
    names.add(user.username);
  }
  if (state.users.length && !state.users.some(user => user.role === 'admin' && !user.disabled)) corrupt();
  const sessionHashes = new Set();
  const sessionCounts = new Map();
  for (const session of state.sessions) {
    if (!record(session, ['hash', 'userId', 'createdAt', 'expiresAt'])
      || !hashPattern.test(session.hash) || sessionHashes.has(session.hash) || !ids.has(session.userId)
      || !timeValue(session.createdAt) || !timeValue(session.expiresAt)
      || session.expiresAt - session.createdAt !== SESSION_LIFE) corrupt();
    sessionHashes.add(session.hash);
    const count = (sessionCounts.get(session.userId) || 0) + 1;
    if (count > MAX_SESSIONS_PER_USER) corrupt();
    sessionCounts.set(session.userId, count);
  }
  const inviteHashes = new Set();
  for (const invite of state.invites) {
    if (!record(invite, ['hash', 'name', 'username', 'role', 'createdBy', 'createdAt', 'expiresAt'])
      || !hashPattern.test(invite.hash) || inviteHashes.has(invite.hash) || !ids.has(invite.createdBy)
      || username(invite.username) !== invite.username || !invite.username || names.has(invite.username)
      || displayName(invite.name) !== invite.name || !invite.name || !['admin', 'member'].includes(invite.role)
      || !timeValue(invite.createdAt) || !timeValue(invite.expiresAt)
      || invite.expiresAt - invite.createdAt !== DAY) corrupt();
    inviteHashes.add(invite.hash);
    names.add(invite.username);
  }
  if (state.users.length + state.invites.length > MAX_USERS) corrupt();
  return state;
}

// Check every component, including ancestors of dataDir: never follow a junction
// or symlink into another location. The host must also protect this directory's
// Windows ACL; POSIX permissions do not provide that protection on Windows.
async function directoryChain(directory, allowMissing = false) {
  const root = path.parse(directory).root;
  let current = root;
  for (const part of path.relative(root, directory).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) {
      if (allowMissing && error.code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail('AUTH_STORAGE_UNSAFE', 'Authentication storage must use real directories.', 503);
  }
}

async function safeFile(file, allowMissing = false) {
  try {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) {
      throw fail('AUTH_STORAGE_UNSAFE', 'Authentication storage must use a private regular file.', 503);
    }
    return stat;
  } catch (error) {
    if (allowMissing && error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * One active server process owns this store. All factories in that process share
 * a queue and rate limits. Every method returns a Promise. Actor arguments must
 * come from server-side authenticate(), never from request bodies. HTTP setup
 * restrictions, CSRF/origin checks, cookies and HTTPS belong to the caller.
 */
export async function createLaunchroomAuth({dataDir, now = Date.now} = {}) {
  if (typeof dataDir !== 'string' || !dataDir || typeof now !== 'function') {
    throw fail('INVALID_AUTH_CONFIGURATION', 'Authentication requires a data directory and clock.', 500);
  }
  const directory = path.join(path.resolve(dataDir), 'auth');
  const file = path.join(directory, 'auth.json');
  const laneKey = process.platform === 'win32' ? file.toLowerCase() : file;
  if (!lanes.has(laneKey)) lanes.set(laneKey, {tail: Promise.resolve(), pending: 0, rates: new Map()});
  const lane = lanes.get(laneKey);

  function clock() {
    const value = Number(now());
    if (!timeValue(value) || value > 8640000000000000 - SESSION_LIFE) {
      throw fail('INVALID_AUTH_CLOCK', 'Authentication clock is unavailable.', 503);
    }
    return value;
  }

  function queued(action) {
    if (lane.pending >= 128) return Promise.reject(fail('AUTH_BUSY', 'Authentication is busy. Try again shortly.', 429));
    lane.pending += 1;
    const result = lane.tail.then(action).catch(error => {
      if (error.code?.startsWith('AUTH_') || ['INVALID_AUTH_CLOCK', 'INVALID_USER', 'INVALID_PASSWORD', 'INVALID_INPUT', 'INVALID_ROLE', 'USERNAME_TAKEN', 'USER_LIMIT', 'LAST_ADMIN', 'USER_NOT_FOUND'].includes(error.code)) throw error;
      throw fail('AUTH_STORAGE_UNAVAILABLE', 'Authentication storage is unavailable.', 503);
    });
    lane.tail = result.then(() => { lane.pending -= 1; }, () => { lane.pending -= 1; });
    return result;
  }

  async function read() {
    await directoryChain(directory);
    const stat = await safeFile(file, true);
    if (!stat) return freshState();
    if (stat.size > MAX_FILE_BYTES) throw fail('AUTH_DATA_INVALID', 'The authentication data needs administrator repair.', 503);
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > MAX_FILE_BYTES) {
        throw fail('AUTH_STORAGE_UNSAFE', 'Authentication storage changed during access.', 503);
      }
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const {bytesRead} = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > MAX_FILE_BYTES) throw fail('AUTH_DATA_INVALID', 'The authentication data needs administrator repair.', 503);
      let state;
      try { state = JSON.parse(buffer.subarray(0, length).toString('utf8')); }
      catch { throw fail('AUTH_DATA_INVALID', 'The authentication data needs administrator repair.', 503); }
      return validateState(state);
    } finally { await handle.close(); }
  }

  async function write(state) {
    validateState(state);
    await directoryChain(directory);
    await safeFile(file, true);
    const temporary = path.join(directory, `.auth-${randomUUID()}.tmp`);
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(state)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await directoryChain(directory);
      await safeFile(file, true);
      await fs.rename(temporary, file);
    } finally {
      if (handle) await handle.close();
      await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }

  function prune(state, time) {
    const enabled = new Set(state.users.filter(user => !user.disabled).map(user => user.id));
    state.sessions = state.sessions.filter(session => session.expiresAt > time && enabled.has(session.userId));
    state.invites = state.invites.filter(invite => invite.expiresAt > time && enabled.has(invite.createdBy));
  }

  function admin(state, actor) {
    const user = state.users.find(candidate => candidate.id === actor?.id);
    if (!user || user.disabled || user.role !== 'admin') throw fail('AUTH_FORBIDDEN', 'Administrator access is required.', 403);
    return user;
  }

  function available(state, normalizedUsername) {
    if (state.users.some(user => user.username === normalizedUsername) || state.invites.some(invite => invite.username === normalizedUsername)) {
      throw fail('USERNAME_TAKEN', 'That username is already in use.', 409);
    }
    if (state.users.length + state.invites.length >= MAX_USERS) throw fail('USER_LIMIT', 'The account limit has been reached.', 409);
  }

  function rateEntry(key, time) {
    if (!lane.rates.has(key)) {
      if (lane.rates.size >= MAX_RATE_ENTRIES) throw fail('AUTH_RATE_LIMITED', BAD_LOGIN, 429);
      lane.rates.set(key, {count: 0, resetAt: time + RATE_WINDOW});
    }
    return lane.rates.get(key);
  }

  function loginRate(rateKey, normalizedUsername, time) {
    for (const [key, entry] of lane.rates) if (entry.resetAt <= time) lane.rates.delete(key);
    const source = typeof rateKey === 'string' && rateKey.length > 0 && rateKey.length <= 200 ? rateKey : 'unknown';
    const pairKey = digest(`pair\0${source}\0${normalizedUsername || 'invalid'}`);
    const pair = rateEntry(pairKey, time);
    const address = rateEntry(digest(`source\0${source}`), time);
    if (pair.count >= 5 || address.count >= 30) throw fail('AUTH_RATE_LIMITED', BAD_LOGIN, 429);
    return {pair, address, pairKey};
  }

  await queued(async () => {
    await directoryChain(directory, true);
    await fs.mkdir(directory, {recursive: true, mode: 0o700});
    await directoryChain(directory);
    await fs.chmod(directory, 0o700);
    await read();
  });

  return Object.freeze({
    status: () => queued(async () => ({initialized: (await read()).users.length > 0})),

    setup: input => queued(async () => {
      const state = await read();
      if (state.users.length) throw fail('AUTH_ALREADY_INITIALIZED', 'The administrator account is already set up.', 409);
      if (!record(input, ['name', 'username', 'password'])) throw fail('INVALID_INPUT', 'Provide name, username and password only.');
      const values = identity(input);
      checkPassword(input.password);
      const user = {...values, id: randomUUID(), role: 'admin', disabled: false, password: await hashPassword(input.password)};
      state.users.push(user);
      await write(state);
      return publicUser(user);
    }),

    login: (input, rateKey) => queued(async () => {
      const time = clock();
      const validInput = record(input, ['username', 'password']);
      const normalized = validInput ? username(input.username) : null;
      const rate = loginRate(rateKey, normalized, time);
      const state = await read();
      const user = state.users.find(candidate => candidate.username === normalized);
      const valid = validInput && validPassword(input.password);
      const matched = await verifyPassword(valid ? input.password : 'invalid-credential-placeholder', user && !user.disabled ? user.password : dummyPassword);
      if (!valid || !matched || !user || user.disabled) {
        rate.pair.count += 1;
        rate.address.count += 1;
        throw fail('AUTH_INVALID_CREDENTIALS', BAD_LOGIN, 401);
      }
      prune(state, time);
      const existing = state.sessions.filter(session => session.userId === user.id);
      if (existing.length >= MAX_SESSIONS_PER_USER) {
        const oldest = existing[0];
        state.sessions = state.sessions.filter(session => session !== oldest);
      }
      const token = randomBytes(32).toString('base64url');
      const expiresAt = time + SESSION_LIFE;
      state.sessions.push({hash: digest(token), userId: user.id, createdAt: time, expiresAt});
      await write(state);
      lane.rates.delete(rate.pairKey);
      return {user: publicUser(user), token, expiresAt: new Date(expiresAt).toISOString()};
    }),

    authenticate: token => queued(async () => {
      if (typeof token !== 'string' || !tokenPattern.test(token)) return null;
      const state = await read();
      const hash = digest(token);
      const time = clock();
      const session = state.sessions.find(candidate => matchingHash(candidate.hash, hash) && candidate.expiresAt > time);
      const user = session && state.users.find(candidate => candidate.id === session.userId && !candidate.disabled);
      return user ? publicUser(user) : null;
    }),

    logout: token => queued(async () => {
      if (typeof token !== 'string' || !tokenPattern.test(token)) return;
      const state = await read();
      const hash = digest(token);
      const remaining = state.sessions.filter(session => !matchingHash(session.hash, hash));
      if (remaining.length !== state.sessions.length) {
        state.sessions = remaining;
        prune(state, clock());
        await write(state);
      }
    }),

    users: actor => queued(async () => {
      const state = await read();
      admin(state, actor);
      return state.users.map(publicUser);
    }),

    // Internal attribution lookup only. Call after project authorization, with
    // IDs from that project's actual file records; never expose it as a route.
    displayNames: ids => queued(async () => {
      if (!Array.isArray(ids) || ids.length > 2000 || ids.some(id => typeof id !== 'string' || (!idPattern.test(id) && id !== 'local-agent'))) {
        throw fail('INVALID_INPUT', 'Provide valid user IDs for file attribution.');
      }
      const requested = new Set(ids);
      const state = await read();
      const entries = state.users.filter(user => requested.has(user.id)).map(user => [user.id, user.name]);
      if (requested.has('local-agent')) entries.push(['local-agent', 'Local agent']);
      return Object.fromEntries(entries);
    }),

    createInvite: (actor, input) => queued(async () => {
      const state = await read();
      const inviter = admin(state, actor);
      if (!record(input, ['name', 'username', 'role'], ['name', 'username'])) throw fail('INVALID_INPUT', 'Provide name, username and an optional role only.');
      const values = identity(input);
      const role = input.role === undefined ? 'member' : input.role;
      if (!['admin', 'member'].includes(role)) throw fail('INVALID_ROLE', 'Choose the admin or member role.');
      const time = clock();
      prune(state, time);
      available(state, values.username);
      const token = randomBytes(32).toString('base64url');
      const expiresAt = time + DAY;
      state.invites.push({...values, role, hash: digest(token), createdBy: inviter.id, createdAt: time, expiresAt});
      await write(state);
      return {token, expiresAt: new Date(expiresAt).toISOString()};
    }),

    acceptInvite: input => queued(async () => {
      if (!record(input, ['token', 'password']) || typeof input.token !== 'string' || !tokenPattern.test(input.token)) {
        throw fail('AUTH_INVALID_INVITE', 'This invitation is invalid or expired.', 400);
      }
      const state = await read();
      prune(state, clock());
      const hash = digest(input.token);
      const invite = state.invites.find(candidate => matchingHash(candidate.hash, hash));
      const inviter = invite && state.users.find(user => user.id === invite.createdBy && user.role === 'admin' && !user.disabled);
      if (!invite || !inviter) throw fail('AUTH_INVALID_INVITE', 'This invitation is invalid or expired.', 400);
      checkPassword(input.password);
      state.invites = state.invites.filter(candidate => candidate !== invite);
      available(state, invite.username);
      const user = {id: randomUUID(), username: invite.username, name: invite.name, role: invite.role, disabled: false, password: await hashPassword(input.password)};
      state.users.push(user);
      await write(state);
      return publicUser(user);
    }),

    revokeUser: (actor, userId) => queued(async () => {
      const state = await read();
      admin(state, actor);
      const user = typeof userId === 'string' && state.users.find(candidate => candidate.id === userId);
      if (!user) throw fail('USER_NOT_FOUND', 'The user was not found.', 404);
      if (!user.disabled && user.role === 'admin' && state.users.filter(candidate => candidate.role === 'admin' && !candidate.disabled).length === 1) {
        throw fail('LAST_ADMIN', 'The last administrator cannot be disabled.', 409);
      }
      user.disabled = true;
      prune(state, clock());
      await write(state);
      return publicUser(user);
    }),
  });
}
