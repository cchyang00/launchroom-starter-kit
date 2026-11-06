// Appearance: which colour scheme and which mode (light, dark, match my device).
// Pure rules here (tested in server/tokens.test.mjs); the colours live in tokens.css.
// Saved per browser under mv.appearance, and per signed-in person under mv.appearance:<username>.

export const APPEARANCE_KEY = 'mv.appearance';
export const OLD_THEME_KEY = 'mv.theme';
export const MODES = ['light', 'dark'];
export const MODE_CHOICES = [
  {id: 'light', label: 'Light', note: 'Warm paper, light sidebar'},
  {id: 'dark', label: 'Dark', note: 'Soft dark, easy at night'},
  {id: 'device', label: 'Match my device', note: 'Follows your computer or phone'},
];
// Soft schemes have a light sidebar in light mode; deep ones keep their dark sidebar.
export const SCHEMES = [
  {id: 'lavender', name: 'Lavender & Butter', group: 'Soft · default', note: 'The store’s colours'},
  {id: 'sky', name: 'Sky & Apricot', group: 'Soft', note: 'Clear blue, warm peach'},
  {id: 'sand', name: 'Sand & Lilac', group: 'Soft', note: 'Warm beige, a touch of lilac'},
  {id: 'rose', name: 'Rose & Cream', group: 'Soft', note: 'Blush pink, cream'},
  {id: 'sage', name: 'Sage & Linen', group: 'Soft', note: 'Calm grey-green'},
  {id: 'slate', name: 'Slate & Ice', group: 'Soft', note: 'Cool and focused'},
  {id: 'ink', name: 'Ink', group: 'Deep sidebar', note: 'Charcoal and gold'},
  {id: 'midnight', name: 'Midnight', group: 'Deep sidebar', note: 'Navy and gold'},
  {id: 'espresso', name: 'Espresso', group: 'Deep sidebar', note: 'Warm brown and gold'},
  {id: 'plum', name: 'Plum', group: 'Deep sidebar', note: 'Aubergine and gold'},
  {id: 'forest', name: 'Forest', group: 'Deep sidebar', note: 'The original green'},
];
export const DEFAULT_APPEARANCE = Object.freeze({scheme: 'lavender', mode: 'light'});
const SCHEME_IDS = new Set(SCHEMES.map(s => s.id));
const MODE_IDS = new Set(MODE_CHOICES.map(m => m.id));

export function cleanAppearance(value) {
  const scheme = SCHEME_IDS.has(value?.scheme) ? value.scheme : DEFAULT_APPEARANCE.scheme;
  const mode = MODE_IDS.has(value?.mode) ? value.mode : DEFAULT_APPEARANCE.mode;
  return {scheme, mode};
}

// The old sidebar dots saved mv.theme on every load, so "ink" was only the old default:
// it moves to the new default. A deliberate other choice carries over in light mode.
export function migrateTheme(old) {
  if (old === 'ink') return {...DEFAULT_APPEARANCE};
  if (SCHEME_IDS.has(old)) return {scheme: old, mode: 'light'};
  return null;
}

function parse(raw) {
  if (!raw) return null;
  try { const value = JSON.parse(raw); return value && typeof value === 'object' ? cleanAppearance(value) : null; } catch { return null; }
}

export function personKey(username) { return `${APPEARANCE_KEY}:${String(username).toLowerCase()}`; }

/** The saved choice: the person's own, else this browser's, else the old picker's, else the default. */
export function readAppearance(storage, username = '') {
  try {
    const mine = username ? parse(storage.getItem(personKey(username))) : null;
    if (mine) return mine;
    const browser = parse(storage.getItem(APPEARANCE_KEY));
    if (browser) return browser;
    const old = migrateTheme(storage.getItem(OLD_THEME_KEY));
    if (old) return old;
  } catch {}
  return {...DEFAULT_APPEARANCE};
}

export function resolveMode(mode, deviceDark) {
  if (mode === 'device') return deviceDark ? 'dark' : 'light';
  return mode === 'dark' ? 'dark' : 'light';
}

/* ---------- Browser side (not used by tests) ---------- */
const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function applyAppearance(value, root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return;
  const {scheme, mode} = cleanAppearance(value);
  root.dataset.scheme = scheme;
  root.dataset.mode = resolveMode(mode, Boolean(media()?.matches));
  root.dataset.modeChoice = mode;
  delete root.dataset.theme;
  // The phone's browser bar follows the page colour.
  try {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (bg && meta) meta.setAttribute('content', bg);
  } catch {}
}

let current = null;
const listeners = new Set();
export function currentAppearance() { return current || {...DEFAULT_APPEARANCE}; }
export function onAppearance(listener) { listeners.add(listener); return () => listeners.delete(listener); }

/** Read, apply and keep following the device when the choice is "Match my device". */
export function startAppearance(username = '') {
  let storage = null; try { storage = window.localStorage; } catch {}
  current = storage ? readAppearance(storage, username) : {...DEFAULT_APPEARANCE};
  applyAppearance(current);
  const mq = media();
  if (mq && !startAppearance.listening) {
    startAppearance.listening = true;
    mq.addEventListener?.('change', () => { if (current?.mode === 'device') applyAppearance(current); });
  }
  for (const listener of listeners) listener(current);
  return current;
}

/** Save a new choice (browser and, when signed in, the person) and apply it at once. */
export function saveAppearance(value, username = '') {
  current = cleanAppearance(value);
  try {
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(current));
    if (username) window.localStorage.setItem(personKey(username), JSON.stringify(current));
    window.localStorage.removeItem(OLD_THEME_KEY);
  } catch {}
  applyAppearance(current);
  for (const listener of listeners) listener(current);
  return current;
}
