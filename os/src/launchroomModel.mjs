// Launchroom shell: pure derivations shared by the screens and tested in
// server/launchroomModel.test.mjs. Launchroom is the app; Merrivy is one project
// in it; the Shared library is the one place every signed-in member can see.
// Nothing here reads or writes records; status always comes from saved data.

export const SHARED_ID = 'shared';
export const MERRIVY_ID = 'merrivy';

/* ---------- Projects ---------- */
// Soft, friendly marks (owner: no forest green, no ox red). Merrivy keeps its gold.
// The colours themselves are --mark-N / --mark-N-ink in tokens.css.
const MARKS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => [`var(--mark-${n})`, `var(--mark-${n}-ink)`]);
export const SHARED_MARK = {bg: 'var(--shared)', ink: 'var(--mark-3-ink)'};

export function projectInitials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return [...words[0]][0].toUpperCase();
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase();
}

export function projectMark(project) {
  if (!project) return {initials: '?', bg: 'var(--line)', ink: 'var(--text-2)'};
  if (project.id === SHARED_ID || project.kind === 'shared') return {initials: '', ...SHARED_MARK, shared: true};
  if (project.id === MERRIVY_ID) return {initials: projectInitials(project.name), bg: 'var(--mark-merrivy)', ink: 'var(--mark-merrivy-ink)'};
  let hash = 0;
  for (const ch of String(project.id)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  const [bg, ink] = MARKS[hash % MARKS.length];
  return {initials: projectInitials(project.name), bg, ink};
}

/** The project id in a Launchroom page path (/p/<id>/...), or '' on the Launchroom home. */
export function projectIdFromPath(pathname = '/') {
  return String(pathname).match(/^\/p\/([a-z0-9-]+)(?=\/|$)/)?.[1] || '';
}
export function projectHref(id, hash = '') {
  return `/p/${id}/${hash ? `#/${hash}` : ''}`;
}

/** Projects people work in (the Shared library is listed on its own), Merrivy first, then oldest first. */
export function workProjects(projects = []) {
  return projects.filter(project => project.id !== SHARED_ID && project.kind !== 'shared')
    .sort((a, b) => (a.id === MERRIVY_ID ? -1 : b.id === MERRIVY_ID ? 1 : String(a.createdAt).localeCompare(String(b.createdAt))));
}
export const sharedProject = (projects = []) => projects.find(project => project.id === SHARED_ID) || null;

/** Who can see a place: the Shared library is everyone's; a project is its members' (and admins'). */
export function accessOf(project) {
  if (!project) return {kind: 'private', label: 'Only members'};
  if (project.id === SHARED_ID || project.kind === 'shared') return {kind: 'shared', label: 'Shared with everyone'};
  return {kind: 'private', label: `Only ${project.name} members`};
}

/** "<page> · <project> · Launchroom", with no empty or repeated parts. */
export function docTitle(page = '', projectName = '') {
  const parts = [page, projectName, 'Launchroom'].map(part => String(part || '').trim()).filter(Boolean);
  return parts.filter((part, i) => parts.indexOf(part) === i).join(' · ');
}

/* ---------- Hash routes inside a project ---------- */
/**
 * One product's page is #/product/<L###|P###>. The older #/p/<id> looked like the
 * project path (/p/<project>/), so it now redirects. #/product alone is the Pipeline.
 */
export function productRoute(path = '') {
  const current = String(path).match(/^product\/([A-Za-z0-9-]{2,120})$/);
  if (current) return {id: current[1], redirect: ''};
  const legacy = String(path).match(/^p\/([A-Za-z0-9-]{2,120})$/);
  if (legacy) return {id: legacy[1], redirect: `product/${legacy[1]}`};
  return null;
}
export const productPath = (id, query = '') => `product/${id}${query ? `?${query}` : ''}`;

/* ---------- Files ---------- */
export const UPLOAD_LIMIT = 100 * 1024 * 1024;
export const ACCEPTED = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.pdf', '.txt', '.md', '.csv', '.docx'];
export const LIMITS_TEXT = 'Pictures, videos, PDF, Word, text, Markdown and CSV · up to 100 MB each';
export const UPLOAD_NOTE = 'Uploaded files are references. They aren’t verified evidence until someone checks them.';
const KINDS = {'.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image', '.mp4': 'video', '.webm': 'video', '.pdf': 'pdf', '.docx': 'doc', '.txt': 'text', '.md': 'text', '.csv': 'text'};
export const KIND_LABELS = {folder: 'Folder', image: 'Picture', video: 'Video', pdf: 'PDF', doc: 'Word document', text: 'Text', file: 'File'};

export const extOf = name => (String(name).match(/\.[A-Za-z0-9]+$/)?.[0] || '').toLowerCase();
export function fileKind(item) {
  if (!item) return 'file';
  if (item.type === 'folder' || item.type === 'directory') return 'folder';
  return KINDS[extOf(item.name)] || 'file';
}
/** Images and videos preview inline, text files as text; PDF and Word download. */
export const canPreview = kind => kind === 'image' || kind === 'video' || kind === 'text';

export function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** Folders first, then by name (natural order) or newest first. */
export function sortFiles(items = [], by = 'name') {
  const folder = item => fileKind(item) === 'folder';
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, {numeric: true, sensitivity: 'base'});
  return [...items].sort((a, b) => (folder(a) !== folder(b) ? (folder(a) ? -1 : 1)
    : by === 'newest' ? String(b.createdAt || b.removedAt || '').localeCompare(String(a.createdAt || a.removedAt || '')) || byName(a, b)
      : byName(a, b)));
}
export function filterFiles(items = [], query = '') {
  const q = String(query).trim().toLowerCase();
  if (!q) return items;
  return items.filter(item => `${item.name} ${item.uploaderName || ''} ${KIND_LABELS[fileKind(item)]}`.toLowerCase().includes(q));
}

export function folderCrumbs(folder = '') {
  const parts = String(folder).split('/').filter(Boolean);
  return parts.map((name, i) => ({name, path: parts.slice(0, i + 1).join('/')}));
}
export const parentFolder = folder => String(folder).split('/').filter(Boolean).slice(0, -1).join('/');

/** Where an upload lands, said plainly every time. */
export function destinationText(project, folder = '') {
  const tail = folderCrumbs(folder).map(part => ` › ${part.name}`).join('');
  if (accessOf(project).kind === 'shared') return `Uploading to Shared library${tail} — everyone can see this`;
  return `Uploading to ${project?.name || 'this project'} › Files${tail}`;
}

/** A client-side check before sending; the server checks again (type signature, size, quota). */
export function uploadProblem(file) {
  if (!file) return null;
  if (!ACCEPTED.includes(extOf(file.name))) return {code: 'UNSUPPORTED_FILE_TYPE', text: 'This type isn’t accepted. Use pictures, videos, PDF, Word, text, Markdown or CSV.', retry: false};
  if (file.size > UPLOAD_LIMIT) return {code: 'FILE_TOO_LARGE', text: 'Larger than 100 MB.', retry: false};
  return null;
}

/** Friendly words for a Files refusal, by its code (LS-073) and the action that was tried. */
export function filesMessage(error, action = '') {
  const code = error?.code || '', status = error?.status || 0;
  if (status === 401) return 'You’re signed out. Sign in again, then retry.';
  switch (code) {
    case 'FILE_TOO_LARGE': return 'Larger than 100 MB.';
    case 'QUOTA_EXCEEDED': return 'This project’s storage is full (the Removed bin counts too).';
    case 'UNSUPPORTED_FILE_TYPE': return 'This type isn’t accepted. Use pictures, videos, PDF, Word, text, Markdown or CSV.';
    case 'INVALID_FILE_TYPE': return 'The file’s contents don’t match its type, so it wasn’t saved.';
    case 'LENGTH_MISMATCH': return 'The upload was cut off. Retry.';
    case 'ALREADY_EXISTS': return action === 'restore' ? 'Something with that name is back in its old folder, so restore didn’t overwrite it.' : action === 'folder' ? 'A folder with that name is already here.' : 'That name is already taken here.';
    case 'NOT_FOUND': return action === 'preview' ? 'This file is gone or moved. The list was refreshed.' : 'That file or folder is no longer there. The list was refreshed.';
    case 'NOT_PREVIEWABLE': return 'This type downloads; it doesn’t open inside Launchroom.';
    case 'INVALID_INPUT': return action === 'folder' ? 'Use a simple folder name: no / \\ : * ? " < > | and no dot or space at the start or end.' : 'That name or folder isn’t allowed.';
    case 'STORAGE_BUSY': return 'Storage is busy. Try again in a moment.';
    case 'UNTRACKED_FILE': return 'This folder holds files Launchroom didn’t upload, so it can’t be moved from here.';
    case 'UNSAFE_PATH': case 'CORRUPT_DATA': return 'Launchroom refused this to keep files safe. Ask your agent to check the project’s storage.';
    default: break;
  }
  if (error?.network) return 'Connection lost. Check Launchroom is running, then retry.';
  return 'That didn’t work. Try again.';
}

/* ---------- Sign-in, setup and invitations ---------- */
export const PASSWORD_MIN = 12;
export function authMessage(error) {
  const code = error?.code || '';
  switch (code) {
    case 'AUTH_INVALID_CREDENTIALS': return 'That username and password don’t match.';
    case 'AUTH_RATE_LIMITED': return 'Too many tries. Wait 15 minutes, then try again.';
    case 'AUTH_INVALID_INVITE': return 'This invitation code isn’t valid or has expired. Ask for a new one.';
    case 'INVALID_PASSWORD': return `Use a password of ${PASSWORD_MIN} to 128 characters.`;
    case 'INVALID_USER': return 'Give a name, and a username of 3 to 64 letters, numbers, dots, dashes or underscores.';
    case 'USERNAME_TAKEN': return 'That username is already taken.';
    case 'USER_LIMIT': return 'Launchroom has reached its account limit.';
    case 'AUTH_ALREADY_INITIALIZED': return 'Launchroom is already set up. Sign in instead.';
    case 'AUTH_BUSY': return 'Launchroom is busy. Try again in a moment.';
    case 'AUTH_FORBIDDEN': return 'Only the owner can do this.';
    case 'LAST_ADMIN': return 'The last owner account can’t be disabled.';
    case 'USER_NOT_FOUND': return 'That person isn’t here any more. The list was refreshed.';
    default: break;
  }
  if (error?.message === 'Create the first account on the home computer.') return 'Set up Launchroom on the home computer first.';
  if (error?.message === 'Choose active members.') return 'One of those people was disabled. The list was refreshed.';
  if (error?.network) return 'Can’t reach Launchroom. Check it’s running on this computer.';
  if (error?.status === 401) return 'You’re signed out. Sign in again.';
  return 'That didn’t work. Try again.';
}
/** A password the server would refuse, said before sending (setup and invitations only). */
export function passwordProblem(password = '') {
  const length = [...String(password)].length;
  if (length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (length > 128) return 'Use 128 characters or fewer.';
  return '';
}

/* ---------- Launchroom home ---------- */
/**
 * "Today across projects": open tasks for the owner (or together) due today or
 * carried from earlier, focus first, at most `limit`. Entries: [{project, tasks}].
 */
export function todayAcross(entries = [], day = '', limit = 6) {
  const items = [];
  for (const {project, tasks = []} of entries) {
    for (const task of tasks) {
      if (task.status === 'done' || task.assignee === 'agent' || !task.date || (day && task.date > day)) continue;
      items.push({task, project});
    }
  }
  items.sort((a, b) => Number(Boolean(b.task.focus)) - Number(Boolean(a.task.focus)) || String(a.task.date).localeCompare(String(b.task.date)) || String(a.task.createdAt).localeCompare(String(b.task.createdAt)));
  return {items: items.slice(0, limit), total: items.length};
}

/** One project card: its focus move, counts and last saved activity, from its pipeline and planner. */
export function projectSummary({pipeline = null, planner = null} = {}) {
  const tasks = planner?.tasks || [];
  const moves = pipeline?.ownerMoves || [];
  const needsYou = moves.reduce((sum, move) => sum + (Number(move.count) || 0), 0);
  const onLine = pipeline?.counts?.active || 0;
  const touched = tasks.map(task => task.updatedAt || task.createdAt).filter(Boolean).sort().at(-1) || '';
  const empty = !pipeline?.items?.length && !tasks.length && !(pipeline?.rounds || []).length;
  const focus = pipeline?.focus || null;
  const text = empty ? 'New project: add a first task or start a Find round.'
    : focus?.kind === 'owner' ? `Your move: ${focus.text}`
      : focus?.kind === 'start-round' ? (onLine ? focus.next || focus.text : 'Nothing is on the line yet.')
        : focus?.text || focus?.next || '';
  const open = tasks.filter(task => task.status !== 'done').length;
  return {text, owner: focus?.kind === 'owner', onLine, needsYou, openTasks: open, lastActivity: touched, empty, round: pipeline?.round?.number || null};
}

/** A brand-new project: nothing on the line, no rounds, no tasks, no products. */
export function isEmptyProject({pipeline = null, tasks = [], products = [], archivedProducts = []} = {}) {
  return !pipeline?.items?.length && !(pipeline?.rounds || []).length && !tasks.length && !products.length && !archivedProducts.length;
}

/* ---------- People & access ---------- */
/** Which projects each person can open: admins see every project; members their memberships. */
export function accessRows(users = [], projects = []) {
  const work = workProjects(projects);
  return users.map(user => ({
    user,
    admin: user.role === 'admin',
    projectIds: user.role === 'admin' ? work.map(project => project.id) : work.filter(project => (project.members || []).includes(user.id)).map(project => project.id),
  }));
}
/**
 * The member lists to save after per-person toggles. draft: {userId: [projectIds]} for the
 * people edited. Returns one {projectId, userIds} per project whose member list changes.
 * With `activeIds`, disabled accounts drop out of a list being saved (the server only
 * accepts active members) without making an untouched project count as changed.
 */
export function accessChanges(projects = [], draft = {}, activeIds = null) {
  const changes = [];
  for (const project of workProjects(projects)) {
    const before = (project.members || []).filter(id => !activeIds || activeIds.includes(id));
    let after = [...before];
    for (const [userId, ids] of Object.entries(draft)) {
      const wants = ids.includes(project.id), has = after.includes(userId);
      if (wants && !has) after.push(userId);
      if (!wants && has) after = after.filter(id => id !== userId);
    }
    const same = after.length === before.length && after.every(id => before.includes(id));
    if (!same) changes.push({projectId: project.id, userIds: after});
  }
  return changes;
}
