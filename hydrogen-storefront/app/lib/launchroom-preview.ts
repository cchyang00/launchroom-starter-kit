import {paletteCss, type Palette} from '~/content/palettes';

/**
 * Launchroom's Store editor (localhost:3000, Colors) shows this page in a
 * phone frame and asks it to preview a palette before the owner saves it:
 * parent.postMessage({type: 'launchroom:palette', palette: {...colors} | null}).
 * Dev server only, only from a local Launchroom page, and only hex colors, so
 * nothing reaches the built store (merrivy.com) and no other page can restyle it.
 */
const TOKENS = [
  'paper',
  'ink',
  'muted',
  'line',
  'accent',
  'accentText',
  'onAccent',
  'highlight',
  'shade',
] as const;
const HEX = /^#[0-9a-f]{3,8}$/i;
const LOCAL = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/;

export function listenForLaunchroomPreview() {
  if (!import.meta.env.DEV || window.parent === window) return;
  let sheet: CSSStyleSheet | null = null;
  window.addEventListener('message', (event) => {
    if (!LOCAL.test(event.origin) || event.source !== window.parent) return;
    const data = event.data as {type?: string; palette?: Record<string, unknown> | null};
    if (!data || data.type !== 'launchroom:palette') return;
    if (!('adoptedStyleSheets' in document)) return;
    if (sheet)
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
    sheet = null;
    if (!data.palette) return;
    const colors: Partial<Palette> = {};
    for (const key of TOKENS) {
      const value = data.palette[key];
      if (typeof value === 'string' && HEX.test(value)) colors[key] = value;
    }
    if (!Object.keys(colors).length) return;
    sheet = new CSSStyleSheet();
    sheet.replaceSync(paletteCss(colors));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
  // Tell the editor the page can take a preview (it resends after a reload).
  window.parent.postMessage({type: 'launchroom:ready'}, '*');
}
