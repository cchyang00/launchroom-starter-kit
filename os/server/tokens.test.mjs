// Colour tokens: one place for colours (src/tokens.css), every scheme x mode complete
// and readable (WCAG AA), and no hard-coded colours anywhere else in os/src.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCHEMES, MODES, readAppearance, resolveMode, migrateTheme, DEFAULT_APPEARANCE, APPEARANCE_KEY} from '../src/appearance.mjs';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const tokensCss = fs.readFileSync(path.join(src, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- A tiny cascade for the selectors tokens.css uses ---------- */
function parseRules(css) {
  const rules = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const name = d.slice(0, i).trim();
      if (name.startsWith('--')) decls[name] = d.slice(i + 1).trim();
    }
    rules.push({selectors: m[1].split(',').map(s => s.trim()), decls});
  }
  return rules;
}
// Returns [matches, specificity] for an element {root, attrs}.
function matchSelector(sel, el) {
  let rest = sel, spec = 0;
  const attrOk = (name, value) => value === undefined ? el.attrs[name] !== undefined : el.attrs[name] === value;
  while (rest.length) {
    let m;
    if ((m = rest.match(/^:root/))) { if (!el.root) return [false, 0]; spec++; }
    else if ((m = rest.match(/^:not\(\[([a-z-]+)(?:="([^"]*)")?\]\)/))) { if (attrOk(m[1], m[2])) return [false, 0]; spec++; }
    else if ((m = rest.match(/^\[([a-z-]+)(?:="([^"]*)")?\]/))) { if (!attrOk(m[1], m[2])) return [false, 0]; spec++; }
    else if ((m = rest.match(/^(html|body)/))) return [false, 0];
    else throw new Error(`Unsupported selector in tokens.css: ${sel}`);
    rest = rest.slice(m[0].length);
  }
  return [true, spec];
}
const rules = parseRules(tokensCss);
function tokensFor(scheme, mode) {
  const el = {root: true, attrs: {'data-scheme': scheme, 'data-mode': mode}};
  const winners = {};
  rules.forEach((rule, order) => {
    let best = -1;
    for (const s of rule.selectors) { const [ok, spec] = matchSelector(s, el); if (ok) best = Math.max(best, spec); }
    if (best < 0) return;
    for (const [name, value] of Object.entries(rule.decls)) {
      const prev = winners[name];
      if (!prev || best > prev.spec || (best === prev.spec && order >= prev.order)) winners[name] = {value, spec: best, order};
    }
  });
  return Object.fromEntries(Object.entries(winners).map(([k, v]) => [k, v.value]));
}

/* ---------- Colour maths: var(), color-mix(in srgb), rgb(), #hex ---------- */
function hex(h) {
  let s = h.slice(1);
  if (s.length <= 4) s = [...s].map(c => c + c).join('');
  const n = [0, 2, 4, 6].map(i => s.length > i ? parseInt(s.slice(i, i + 2), 16) : 255);
  return {r: n[0], g: n[1], b: n[2], a: n[3] / 255};
}
function splitTop(str) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}
function resolve(value, vars, depth = 0) {
  if (depth > 20) throw new Error(`Token loop at ${value}`);
  value = value.trim();
  let m;
  if ((m = value.match(/^var\((--[a-z0-9-]+)\)$/))) {
    if (!(m[1] in vars)) throw new Error(`Missing token ${m[1]}`);
    return resolve(vars[m[1]], vars, depth + 1);
  }
  if (value === 'transparent') return {r: 0, g: 0, b: 0, a: 0};
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return hex(value);
  if ((m = value.match(/^rgb\((.+)\)$/))) {
    const inner = m[1].replace(/var\((--[a-z0-9-]+)\)/g, (_, v) => vars[v]);
    const [rgb, alpha] = inner.split('/');
    const [r, g, b] = rgb.trim().split(/[\s,]+/).map(Number);
    return {r, g, b, a: alpha === undefined ? 1 : Number(alpha)};
  }
  if ((m = value.match(/^color-mix\(in srgb,(.+)\)$/))) {
    const [a, b] = splitTop(m[1]);
    const pa = a.match(/^(.*?)\s+([\d.]+)%$/);
    const p = Number(pa[2]) / 100;
    const ca = resolve(pa[1], vars, depth + 1), cb = resolve(b, vars, depth + 1);
    // Premultiplied interpolation, as browsers do.
    const alpha = ca.a * p + cb.a * (1 - p);
    if (!alpha) return {r: 0, g: 0, b: 0, a: 0};
    const ch = k => (ca[k] * ca.a * p + cb[k] * cb.a * (1 - p)) / alpha;
    return {r: ch('r'), g: ch('g'), b: ch('b'), a: alpha};
  }
  throw new Error(`Cannot resolve colour ${value}`);
}
const over = (top, bottom) => ({r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1});
const lum = ({r, g, b}) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
function contrast(fg, bg) { const L1 = lum(fg), L2 = lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }

const SEEDS = ['--bg', '--surface', '--text', '--muted', '--line', '--sidebar', '--sidebar-text', '--sidebar-muted', '--hero', '--hero-text', '--hero-muted', '--accent', '--on-accent', '--accent-text', '--highlight', '--on-highlight', '--strong', '--on-strong', '--shadow-rgb'];
// [foreground, background (stack, bottom first), minimum ratio]
const PAIRS = [
  ['--text', ['--bg'], 4.5], ['--text', ['--surface'], 4.5], ['--text-2', ['--surface'], 4.5], ['--text', ['--bg', '--bg-2'], 4.5],
  ['--muted', ['--surface'], 4.5], ['--muted', ['--bg'], 4.5], ['--muted', ['--surface', '--surface-2'], 4.5], ['--muted', ['--bg', '--bg-2'], 4.5],
  ['--faint', ['--surface'], 4.5], ['--faint', ['--bg'], 4.5],
  ['--accent-text', ['--surface'], 4.5], ['--accent-text', ['--bg'], 4.5], ['--accent-text', ['--surface', '--accent-soft'], 4.5], ['--text', ['--surface', '--accent-soft'], 4.5],
  ['--on-accent', ['--accent'], 4.5], ['--on-accent', ['--accent-hover'], 4.5], ['--on-strong', ['--strong'], 4.5], ['--on-strong', ['--strong-hover'], 4.5], ['--on-highlight', ['--highlight'], 4.5],
  ['--highlight-text', ['--surface'], 4.5], ['--highlight-text', ['--surface', '--highlight-soft'], 4.5], ['--text', ['--surface', '--highlight-soft'], 4.5],
  ['--sidebar-text', ['--sidebar'], 4.5], ['--sidebar-muted', ['--sidebar'], 4.5], ['--sidebar-text', ['--sidebar', '--sidebar-active'], 4.5], ['--sidebar-muted', ['--sidebar', '--sidebar-hover'], 4.5],
  ['--sidebar-owner', ['--sidebar'], 4.5], ['--sidebar-done', ['--sidebar'], 3], ['--sidebar-mark', ['--sidebar'], 3],
  ['--hero-text', ['--hero'], 4.5], ['--hero-muted', ['--hero'], 4.5], ['--hero-text', ['--hero', '--hero-2'], 4.5], ['--hero-muted', ['--hero', '--hero-chip'], 4.5], ['--hero-done', ['--hero'], 3], ['--hero-info', ['--hero'], 4.5], ['--hero-accent', ['--hero'], 4.5], ['--hero-owner', ['--hero'], 4.5], ['--hero-owner', ['--hero', '--hero-chip'], 4.5], ['--hero-accent', ['--hero', '--hero-2'], 4.5],
  ...['success', 'warning', 'info', 'danger', 'special'].flatMap(k => [
    [`--${k}-text`, ['--surface'], 4.5], [`--${k}-text`, ['--bg'], 4.5], [`--${k}-text`, ['--surface', `--${k}-soft`], 4.5],
    [`--on-${k}`, [`--${k}`], 4.5], [`--on-${k}`, [`--${k}-hover`], 4.5], [`--${k}`, ['--surface'], 4.5], [`--${k}`, ['--bg'], 4.5],
  ]),
  ...['manager', 'research', 'creative', 'store', 'owner', 'other'].map(k => ['--on-media', [`--role-${k}`], 4.5]),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => [`--mark-${n}-ink`, [`--mark-${n}`], 4.5]),
  ...[1, 2, 3, 4, 5, 6].map(n => [`--tile-${n}-ink`, ['--surface', `--tile-${n}`], 4.5]),
];

test('every scheme x mode sets the full seed set in tokens.css', () => {
  for (const {id} of SCHEMES) for (const mode of MODES) {
    const block = rules.find(rule => rule.selectors.some(s => mode === 'light' ? s === `[data-scheme="${id}"]` : s === `[data-scheme="${id}"][data-mode="dark"]`));
    assert.ok(block, `${id} ${mode}: no token block`);
    const missing = SEEDS.filter(seed => !(seed in block.decls));
    assert.deepEqual(missing, [], `${id} ${mode}: missing seeds`);
  }
});

test('every scheme x mode passes WCAG AA for text, buttons, chips, badges and dots', () => {
  const failures = [];
  for (const {id} of SCHEMES) for (const mode of MODES) {
    const vars = tokensFor(id, mode);
    for (const [fg, stack, min] of PAIRS) {
      let bg = {r: 255, g: 255, b: 255, a: 1};
      for (const layer of stack) bg = over(resolve(`var(${layer})`, vars), bg);
      let f = resolve(`var(${fg})`, vars);
      if (f.a < 1) f = over(f, bg);
      const ratio = contrast(f, bg);
      if (ratio < min) failures.push(`${id}/${mode}: ${fg} on ${stack.at(-1)} = ${ratio.toFixed(2)} (needs ${min})`);
    }
  }
  assert.deepEqual(failures, []);
});

test('the default is Lavender & Butter in light mode, and a bare page gets it too', () => {
  assert.deepEqual(DEFAULT_APPEARANCE, {scheme: 'lavender', mode: 'light'});
  const bare = (() => { const el = {root: true, attrs: {}}; const v = {}; rules.forEach(r => { if (r.selectors.some(s => matchSelector(s, el)[0])) Object.assign(v, r.decls); }); return v; })();
  assert.equal(bare['--bg'], '#fdfaf4');
  assert.equal(bare['--accent'], '#c7b3ff');
  assert.equal(SCHEMES[0].id, 'lavender');
  assert.ok(!SCHEMES.find(s => s.id === 'forest').group.includes('default'));
});

test('appearance: reading, migrating the old picker and matching the device', () => {
  const store = data => ({getItem: key => data[key] ?? null});
  assert.equal(APPEARANCE_KEY, 'mv.appearance');
  assert.deepEqual(readAppearance(store({})), {scheme: 'lavender', mode: 'light'});
  assert.deepEqual(readAppearance(store({'mv.appearance': JSON.stringify({scheme: 'sky', mode: 'dark'})})), {scheme: 'sky', mode: 'dark'});
  assert.deepEqual(readAppearance(store({'mv.appearance': JSON.stringify({scheme: 'nope', mode: 'purple'})})), {scheme: 'lavender', mode: 'light'});
  assert.deepEqual(readAppearance(store({'mv.appearance': '{broken'})), {scheme: 'lavender', mode: 'light'});
  // The old sidebar dots saved mv.theme on every load, so "ink" was just the old default.
  assert.deepEqual(migrateTheme('ink'), {scheme: 'lavender', mode: 'light'});
  assert.deepEqual(migrateTheme('plum'), {scheme: 'plum', mode: 'light'});
  assert.deepEqual(migrateTheme('midnight'), {scheme: 'midnight', mode: 'light'});
  assert.equal(migrateTheme('weird'), null);
  assert.deepEqual(readAppearance(store({'mv.theme': 'espresso'})), {scheme: 'espresso', mode: 'light'});
  assert.deepEqual(readAppearance(store({'mv.theme': 'espresso', 'mv.appearance': JSON.stringify({scheme: 'rose', mode: 'device'})})), {scheme: 'rose', mode: 'device'});
  // A per-person choice wins over the browser's.
  assert.deepEqual(readAppearance(store({'mv.appearance': JSON.stringify({scheme: 'rose', mode: 'light'}), 'mv.appearance:cha': JSON.stringify({scheme: 'sage', mode: 'dark'})}), 'cha'), {scheme: 'sage', mode: 'dark'});
  assert.equal(resolveMode('light', true), 'light');
  assert.equal(resolveMode('dark', false), 'dark');
  assert.equal(resolveMode('device', true), 'dark');
  assert.equal(resolveMode('device', false), 'light');
});

/* ---------- The guard: no literal colours outside tokens.css ---------- */
export function hardCodedColours(text, file) {
  const found = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const lines = clean.split('\n');
  lines.forEach((line, i) => {
    const hits = [];
    if (file.endsWith('.css')) {
      for (const m of line.matchAll(/:[^;{}]*?(#[0-9a-fA-F]{3,8})\b/g)) hits.push(m[1]);
      for (const m of line.matchAll(/:[^;{}]*?\b(white|black)\b(?!-)/g)) hits.push(m[1]);
    } else {
      for (const m of line.matchAll(/['"`]\s*(#[0-9a-fA-F]{3,8})\s*['"`]/g)) hits.push(m[1]);
      for (const m of line.matchAll(/(?:fill|stroke|color|background)=["'](#[0-9a-fA-F]{3,8})["']/g)) hits.push(m[1]);
      for (const m of line.matchAll(/:\s*['"`](white|black)['"`]/g)) hits.push(m[1]);
    }
    for (const m of line.matchAll(/\b(rgba?|hsla?)\(\s*[\d.]/g)) hits.push(m[0]);
    for (const hit of new Set(hits)) found.push(`${file}:${i + 1} ${hit}`);
  });
  return found;
}

test('the guard catches literal colours', () => {
  assert.equal(hardCodedColours('.a{color:#fff}', 'x.css').length, 1);
  assert.equal(hardCodedColours('.a{border:1px solid rgba(0,0,0,.1)}', 'x.css').length, 1);
  assert.equal(hardCodedColours('.a{color:white}', 'x.css').length, 1);
  assert.equal(hardCodedColours("const c = {color:'#a2467a'}", 'x.jsx').length, 1);
  assert.equal(hardCodedColours('<path fill="#adb9ce"/>', 'x.jsx').length, 1);
  assert.equal(hardCodedColours('.a{color:var(--text);box-shadow:0 1px rgb(var(--shadow-rgb) / .2)}', 'x.css').length, 0);
  assert.equal(hardCodedColours("go('#/pipeline'); href='#top'", 'x.jsx').length, 0);
  assert.equal(hardCodedColours('/* #fff in a comment */', 'x.css').length, 0);
});

test('no hard-coded colours in os/src outside tokens.css', () => {
  const found = [];
  for (const file of fs.readdirSync(src)) {
    if (!/\.(css|jsx|mjs|js)$/.test(file) || file === 'tokens.css') continue;
    found.push(...hardCodedColours(fs.readFileSync(path.join(src, file), 'utf8'), file));
  }
  assert.deepEqual(found, [], 'Use a token from src/tokens.css instead of a literal colour');
});
