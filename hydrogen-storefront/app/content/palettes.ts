import library from './palettes.json';

/**
 * Storefront palettes. The library lives in palettes.json (a plain JSON list
 * that Launchroom's Store editor can read); this module types it and turns a
 * palette into CSS tokens. A product packet's "theme" is the one live palette;
 * the switcher previews others on the local dev server only. Palettes change
 * colours only: fonts, sizes and spacing never change with a palette.
 */
export type PaletteGroup =
  | 'Holiday, Gifting & Boutique'
  | 'Calm & sleep'
  | 'Morning energy'
  | 'Focus & clarity'
  | 'Warm comfort'
  | 'Fresh & clean'
  | 'Bold accents';

export type Palette = {
  id: string;
  name: string;
  /** Mood group, e.g. "Calm & sleep". */
  group: PaletteGroup;
  /** One line: what the palette suits, e.g. "Sleep products, night routines". */
  goodFor: string;
  paper: string;
  ink: string;
  muted: string;
  line: string;
  /** Fill for buttons, deal bar and badges. */
  accent: string;
  /** Readable accent for text on paper. */
  accentText: string;
  /** Text on accent fills. */
  onAccent: string;
  highlight: string;
  shade: string;
};

/** Mood groups, in display order. */
export const PALETTE_GROUPS = library.groups as {
  id: string;
  name: PaletteGroup;
  note: string;
}[];

export const PALETTES = library.palettes as Palette[];

export const PALETTE_STORAGE_KEY = 'merrivy.palette';

/** CSS custom properties for a palette (token names match the stylesheets). */
export function paletteCss(palette: Partial<Palette>) {
  const map: [string, string | undefined][] = [
    ['--paper', palette.paper],
    ['--ink', palette.ink],
    ['--muted', palette.muted],
    ['--line', palette.line],
    ['--orange', palette.accent],
    ['--accent', palette.accent],
    ['--accent-text', palette.accentText ?? palette.accent],
    ['--on-accent', palette.onAccent],
    ['--yellow', palette.highlight],
    ['--shade', palette.shade],
  ];
  return `:root{${map
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')}}`;
}

/**
 * Runs before first paint (inline, with the CSP nonce) and from the switcher.
 * Uses a constructable stylesheet, so no server-rendered node is modified and
 * hydration stays clean.
 */
export function paletteBootScript() {
  const css = Object.fromEntries(PALETTES.map((p) => [p.id, paletteCss(p)]));
  return `(function(){try{var c=${JSON.stringify(css)};var id=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});if(!id||!c[id]||!('adoptedStyleSheets' in document))return;var s=new CSSStyleSheet();s.replaceSync(c[id]);document.adoptedStyleSheets=[s];window.__merrivyPalette=s;}catch(e){}})();`;
}

export function applyPalette(id: string | null) {
  if (typeof document === 'undefined' || !('adoptedStyleSheets' in document))
    return;
  const palette = PALETTES.find((item) => item.id === id);
  const win = window as unknown as {__merrivyPalette?: CSSStyleSheet};
  if (!palette) {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (sheet) => sheet !== win.__merrivyPalette,
    );
    win.__merrivyPalette = undefined;
    return;
  }
  const sheet = win.__merrivyPalette ?? new CSSStyleSheet();
  sheet.replaceSync(paletteCss(palette));
  if (!document.adoptedStyleSheets.includes(sheet))
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  win.__merrivyPalette = sheet;
}
