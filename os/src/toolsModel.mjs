// The Tools page: every outside tool we use, with the one link the owner and
// Claude both open in the same browser. Shared by the server (os/server/tools.mjs)
// and the screens, so the credential guard, the groups and the step lists can
// never disagree.
//
// Safety rule (LS-064): no passwords, keys or tokens are ever stored here. Every
// agent reads these records. The owner signs in once in the shared browser and
// agents work in that signed-in session.
import {STEP_IDS, STEP_NAMES, stepId, normalizeSteps} from './steps.mjs';

export const TOOL_GROUPS = ['research', 'sourcing', 'store', 'ads', 'creative', 'email', 'local'];
export const GROUP_LABELS = {research: 'Research', sourcing: 'Sourcing', store: 'Store', ads: 'Ads', creative: 'Creative', email: 'Email', local: 'On this computer'};
export const OPENS_IN = ['chrome', 'luxury-desktop', 'local'];
export const OPENS_LABELS = {chrome: 'Browser', 'luxury-desktop': 'Luxury app', local: 'This computer'};
/** The only fields a tool may hold. Anything else is refused. */
export const TOOL_FIELDS = ['id', 'name', 'group', 'url', 'opensIn', 'steps', 'agents', 'purpose', 'signIn', 'limits', 'source', 'retired', 'signedInNoted', 'optional'];
export const TOOL_LIMIT = 200;
export const SECRET_MESSAGE = "Don't store passwords here — sign in once in the browser instead.";
export const PAYMENT_MESSAGE = "Don't store card or bank details here — the owner types those only on the payment page.";
export const TOOL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OS_HOSTS = new Set(['localhost:3000', '127.0.0.1:3000']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/* ---------- The credential guard ---------- */

// Words that name a secret. A mention is fine ("never paste the API key in chat");
// a word followed by a value ("password: hunter2", "token=abc123") is refused.
const SECRET_WORD = String.raw`(?:pass(?:word|wd|code|phrase)?s?|pwd|pw|api[\s_-]?keys?|secret(?:[\s_-]?keys?)?|client[\s_-]?secret|access[\s_-]?(?:keys?|tokens?)|refresh[\s_-]?tokens?|auth[\s_-]?(?:tokens?|codes?)|bearer|session[\s_-]?(?:ids?|tokens?|cookies?)|cookies?|private[\s_-]?keys?|tokens?|otp|one[\s-]?time[\s-]?codes?|2fa[\s-]?codes?|recovery[\s-]?codes?|backup[\s-]?codes?|pin)`;
const ASSIGNED = new RegExp(String.raw`(?:^|[^A-Za-z0-9])${SECRET_WORD}\s*[:=]\s*["'“‘]?([^\s"'”’]{3,})`, 'gi');
const STATED = new RegExp(String.raw`(?:^|[^A-Za-z0-9])${SECRET_WORD}\s+(?:is|was|are|were)\s+["'“‘]?([^\s"'”’]{4,})`, 'gi');
// A value after "password:" that is plainly not a secret ("Password: none", "Password: owner signs in").
const NOT_A_VALUE = new Set(['none', 'n/a', 'na', 'no', 'not', 'never', 'nothing', 'unknown', 'owner', "owner's", 'owners', 'ask', 'in', 'the', 'saved', 'stored', 'kept', 'handled', 'managed', 'required', 'needed', 'optional', 'only', 'see', 'via', 'through', 'by', 'from', 'with', 'use', 'set', 'blank', 'empty']);
// Well-known key and token shapes.
const KEY_SHAPES = [
  /\bsk-(?:or-|proj-|ant-|live-|test-)?[A-Za-z0-9_-]{16,}/,
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bshp(?:at|ss|ca|pa)_[a-fA-F0-9]{20,}/,
  /\bEAA[A-Za-z0-9]{40,}/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
];
// Query parameters that carry credentials in links.
const SECRET_PARAMS = new Set(['token', 'access_token', 'id_token', 'refresh_token', 'auth', 'auth_token', 'authtoken', 'api_key', 'apikey', 'api-key', 'key', 'secret', 'client_secret', 'password', 'passwd', 'pwd', 'pass', 'session', 'sessionid', 'session_id', 'sid', 'sig', 'signature', 'x-amz-signature', 'x-amz-credential', 'x-amz-security-token', 'otp', 'code_verifier']);
// Field names an agent might try to add for a login.
export const SECRET_FIELD = /pass|secret|token|api.?key|credential|cookie|session|otp|2fa|pin$|private.?key|login|username|e-?mail/i;

const classOf = ch => /[a-z]/.test(ch) ? 'l' : /[A-Z]/.test(ch) ? 'u' : /[0-9]/.test(ch) ? 'd' : '';
/** A long string that looks machine-generated: many switches between letters and digits. */
export function looksRandom(piece) {
  if (typeof piece !== 'string' || piece.length < 20) return false;
  const alnum = piece.replace(/[^A-Za-z0-9]/g, '');
  const digits = alnum.replace(/[^0-9]/g, '').length, letters = alnum.length - digits;
  if (/^[a-f0-9]{32,}$/i.test(alnum) && digits && letters) return true;
  if (digits < 2 || letters < 4) return false;
  let switches = 0, last = '';
  for (const ch of alnum) { const c = classOf(ch); if (last && c !== last) switches++; last = c; }
  return switches >= 6 || (alnum.length >= 40 && /[a-z]/.test(alnum) && /[A-Z]/.test(alnum) && digits >= 4);
}
function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
/** A 13-19 digit card number (Luhn-valid, card networks start 2-6). */
export function looksLikeCard(value) {
  for (const match of String(value).matchAll(/(?:\d[ -]?){12,18}\d/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && /^[2-6]/.test(digits) && luhn(digits)) return true;
  }
  return false;
}
const trimValue = value => value.replace(/[.,;:!?)\]]+$/, '');
function assignedValue(text) {
  for (const match of text.matchAll(ASSIGNED)) {
    const value = trimValue(match[1]);
    if (value.length >= 3 && !NOT_A_VALUE.has(value.toLowerCase())) return true;
  }
  for (const match of text.matchAll(STATED)) {
    const value = trimValue(match[1]);
    if (value.length >= 4 && /[^A-Za-z]/.test(value)) return true;
  }
  return false;
}

/**
 * Plain-language problem if this text holds (or looks like it holds) a
 * credential or payment detail; '' when it is safe to store.
 */
export function secretProblem(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const text = value.normalize('NFKC'), words = text.split(/\s+/);
  // Long numeric IDs inside links (TikTok, AliExpress) are not cards, so links are left out here.
  if (looksLikeCard(words.filter(word => !/^https?:\/\//i.test(word)).join(' '))) return PAYMENT_MESSAGE;
  if (KEY_SHAPES.some(shape => shape.test(text)) || assignedValue(text)) return SECRET_MESSAGE;
  // Links are checked by part: sign-in details, credential parameters and random query values.
  for (const word of words) {
    if (/^https?:\/\//i.test(word)) { const problem = urlSecretProblem(word); if (problem) return problem; continue; }
    for (const piece of word.split(/[^A-Za-z0-9_+=-]+/)) if (looksRandom(piece)) return SECRET_MESSAGE;
  }
  return '';
}
function urlSecretProblem(value) {
  let url; try { url = new URL(value); } catch { return ''; }
  if (url.username || url.password) return SECRET_MESSAGE;
  const query = [...url.searchParams.entries()];
  const fragment = url.hash.replace(/^#/, '');
  const fragmentParams = /[=&]/.test(fragment) ? [...new URLSearchParams(fragment).entries()] : [['', fragment]];
  for (const [key, val] of [...query, ...fragmentParams]) {
    if (key && SECRET_PARAMS.has(key.toLowerCase()) && val) return SECRET_MESSAGE;
    for (const piece of String(val).split(/[^A-Za-z0-9_+=-]+/)) if (looksRandom(piece)) return SECRET_MESSAGE;
  }
  return '';
}

/* ---------- Links ---------- */

export function hostOf(value) { try { return new URL(value).host.replace(/^www\./, ''); } catch { return ''; } }
export function isLocalUrl(value) { try { return LOCAL_HOSTS.has(new URL(value).hostname); } catch { return false; } }
/** The OS itself (localhost:3000): shown in the list, never as an Open card while you are in it. */
export function isThisApp(tool) { try { return OS_HOSTS.has(new URL(tool.url).host); } catch { return false; } }
/**
 * Plain-language problem with a tool link, or ''. https anywhere; http only
 * for this computer (localhost). No sign-in details inside the link.
 */
export function urlProblem(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Add the link the tool opens at.';
  let url; try { url = new URL(value.trim()); } catch { return 'Use a full link that starts with https://.'; }
  if (url.protocol === 'http:' && !LOCAL_HOSTS.has(url.hostname)) return 'Use an https:// link (http:// is only for tools on this computer, like localhost).';
  if (!['http:', 'https:'].includes(url.protocol)) return 'Use an https:// link, or http://localhost for tools on this computer.';
  return urlSecretProblem(url.href);
}

/* ---------- Names, groups and lists ---------- */

export function slugify(name) {
  return String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
const STEP_GROUP = {product: 'research', buyers: 'research', prove: 'research', create: 'creative', build: 'store', launch: 'ads', learn: 'ads'};
/** A sensible group for a tool added with only a name, link, purpose and step. */
export function guessGroup({url = '', steps = [], name = '', purpose = ''} = {}) {
  if (isLocalUrl(url)) return 'local';
  const words = `${name} ${purpose} ${hostOf(url)}`.toLowerCase();
  if (/\b(?:mail|inbox|gmail|zoho|outlook)\b/.test(words)) return 'email';
  if (/\b(?:supplier|sourcing|aliexpress|alibaba|cj|1688|wholesale)\b/.test(words)) return 'sourcing';
  // The chosen step decides for Create and Build; words decide for Product, Buyers, Prove it, Launch and Learn.
  const byStep = STEP_GROUP[stepId(steps[0]) || ''] || 'research';
  if (!['research', 'ads'].includes(byStep)) return byStep;
  if (/\b(?:ads?|advert|campaign|meta|facebook)\b/.test(words)) return 'ads';
  if (/\b(?:image|video|design|canva|creative|photo)\b/.test(words)) return 'creative';
  if (/\b(?:shopify|store|storefront|theme)\b/.test(words)) return 'store';
  return byStep;
}
export const opensInFor = url => isLocalUrl(url) ? 'local' : 'chrome';
/** Whether agents should expect a sign-in wall (anything not public or local). */
export const needsSignIn = tool => tool.opensIn !== 'local' && !/^\s*no sign-in/i.test(tool.signIn || '');
export const activeTools = (tools = []) => tools.filter(tool => !tool.retired);
/**
 * Tools tagged with one step: the live method's tools first, optional
 * cross-checks last, each in group order; the OS itself left out. Tags saved
 * with the six-step ids (before Oct 2) count under their new step.
 */
export function toolsForStep(tools = [], step) {
  const id = stepId(step) || step;
  return sortTools(activeTools(tools).filter(tool => normalizeSteps(tool.steps).includes(id) && !isThisApp(tool)));
}
/**
 * The step tools an agent can use: Luxury-app tools are left out, because
 * agents cannot drive Luxury's DICloak browser (LS-006); the owner still sees
 * them on the Tools page.
 */
export const agentStepTools = (tools = [], step) => toolsForStep(tools, step).filter(tool => tool.opensIn !== 'luxury-desktop');
export const OPTIONAL_LABEL = 'optional cross-check';
export function sortTools(tools = []) {
  return [...tools].sort((a, b) => Number(Boolean(a.optional)) - Number(Boolean(b.optional)) || TOOL_GROUPS.indexOf(a.group) - TOOL_GROUPS.indexOf(b.group));
}
/** Active tools grouped in the fixed group order; empty groups left out. */
export function toolsByGroup(tools = []) {
  const active = activeTools(tools);
  return TOOL_GROUPS.map(group => ({group, label: GROUP_LABELS[group], tools: active.filter(tool => tool.group === group)})).filter(item => item.tools.length);
}
export function toolCounts(tools = []) {
  const active = activeTools(tools);
  return {
    active: active.length, retired: tools.length - active.length,
    byGroup: Object.fromEntries(TOOL_GROUPS.map(group => [group, active.filter(tool => tool.group === group).length])),
    byStep: Object.fromEntries(STEP_IDS.map(step => [step, toolsForStep(tools, step).length])),
    signInNoted: active.filter(tool => tool.signedInNoted).length,
  };
}
export const stepLabel = id => STEP_NAMES[STEP_IDS.indexOf(id)] || id;
/** Step ids from ids, names, old six-step words or numbers ("product", "find", "validate", "3"). Unknown values come back as null. */
export function stepFrom(value) {
  return stepId(value) || null;
}
