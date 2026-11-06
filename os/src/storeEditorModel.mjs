// The Store editor (owner, Oct 2): "I want a way for you to do a lot of things
// yourself, but I also want to edit a little bit on this Launchroom."
//
// Pure rules shared by the server (server/storeEditor.mjs) and the Store page
// (src/StoreEditor.jsx). The owner edits words and swaps pictures in a product
// packet (hydrogen-storefront/app/content/<file>.json); layout, section order,
// theme and offer numbers stay with the agents. Every field the page shows is
// built here from the saved packet, in the order a shopper sees it, so the
// server only accepts a save for a field this model calls editable.

/** Each template's section order below the hero, as in app/content/templates.ts. */
const SPINE = ['comparison', 'inTheBox', 'proof', 'guarantee', 'specs', 'bundle', 'faq', 'promise'];
export const TEMPLATE_ORDERS = {
  'story-led': ['problem', 'features', 'howToUse', 'whoFor', ...SPINE],
  'problem-solution': ['problem', 'features', 'whoFor', 'howToUse', ...SPINE],
  'gift-led': ['problem', 'whoFor', 'features', 'howToUse', ...SPINE],
};
export const TEXT_MAX = 2000;
export const UNDO_LIMIT = 5;
export const PACKET_FILE = /^[a-z0-9][a-z0-9-]{0,62}\.json$/;
const SEGMENT = /^(?:[A-Za-z][A-Za-z0-9]{0,40}|\d{1,3})$/;

const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isStr = value => typeof value === 'string';

/* ---------- Paths ---------- */

export function splitPath(path) {
  if (!isStr(path) || !path || path.length > 200) return null;
  const parts = path.split('.');
  return parts.every(part => SEGMENT.test(part)) ? parts : null;
}
export function getAt(value, path) {
  const parts = splitPath(path);
  if (!parts) return undefined;
  let node = value;
  for (const part of parts) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return undefined;
    node = node[part];
  }
  return node;
}
/** A copy of `value` with one existing string field replaced. */
export function setAt(value, path, next) {
  const parts = splitPath(path);
  if (!parts) throw new Error(`Unknown field ${path}.`);
  const copy = structuredClone(value);
  let node = copy;
  for (const part of parts.slice(0, -1)) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) throw new Error(`Unknown field ${path}.`);
    node = node[part];
  }
  const last = parts.at(-1);
  if (node === null || typeof node !== 'object' || !Object.hasOwn(node, last)) throw new Error(`Unknown field ${path}.`);
  node[last] = next;
  return copy;
}

/* ---------- The form, built from the saved packet ---------- */

const ASK = 'Set in Shopify Admin (synced with checkout so prices and variants always match).';
const LINE_BREAKS = 'A new line here shows as a line break on the page.';

function builder(packet) {
  const fields = [];
  const add = (path, label, kind = 'line', extra = {}) => {
    const value = getAt(packet, path);
    if (kind === 'fixed') {
      if (value === undefined || value === null || isObj(value) || Array.isArray(value)) return;
    } else if (kind === 'palette') {
      if (!isObj(value)) return;
    } else if (!isStr(value)) return;
    fields.push({ path, label, kind: kind === 'line' && isStr(value) && value.includes('\n') ? 'text' : kind, value, ...extra });
  };
  return { fields, add };
}
const list = (packet, path) => { const value = getAt(packet, path); return Array.isArray(value) ? value : []; };

/** Common eyebrow + heading pair at the top of a section. */
function heads(add, key) {
  add(`${key}.eyebrow`, 'Small label above the heading');
  add(`${key}.heading`, 'Heading', 'line', { hint: LINE_BREAKS });
}
function imageWithAlt(add, base, label, { src = 'src', alt = 'alt' } = {}) {
  add(`${base}.${src}`, `${label}`, 'image');
  add(`${base}.${alt}`, `${label}: description`, 'line', { hint: 'Says what the picture shows, for screen readers and search.' });
}

const SECTIONS = {
  top: {
    title: 'Top of the page', page: 'Product page and home page', help: 'The first screen: the name, headline, benefits, packs and the trust row.',
    build(packet, add) {
      add('navLabel', 'Product name');
      add('hero.headline', 'Headline at the top', 'line', { hint: 'Eye-catching viral reveal hook (5–10 words max, e.g. "You Have to Get This 2027 Grimoire Planner.") — never a flat product label.' });
      list(packet, 'hero.benefits').forEach((_, i) => add(`hero.benefits.${i}.text`, `Benefit ${i + 1}`, 'line', { hint: 'Under about 24 characters keeps it on one line.' }));
      list(packet, 'purchase.offerChoices').forEach((_, i) => {
        add(`purchase.offerChoices.${i}.label`, `Pack ${i + 1} name`);
        add(`purchase.offerChoices.${i}.caption`, `Pack ${i + 1} note`);
        add(`purchase.offerChoices.${i}.quantity`, `Pack ${i + 1} quantity`, 'fixed', { note: ASK });
      });
      list(packet, 'hero.trustRow').forEach((_, i) => add(`hero.trustRow.${i}.text`, `Trust line ${i + 1}`));
      add('purchase.hook', 'Short line under the buttons', 'line', { hint: 'Combine top viral video reveal phrasing with our offer — never a dry feature list.' });
      add('purchase.description', 'Product description', 'text');
      list(packet, 'purchase.disclosures').forEach((_, i) => {
        add(`purchase.disclosures.${i}.title`, `Info tab ${i + 1} title`);
        add(`purchase.disclosures.${i}.text`, `Info tab ${i + 1} text`, 'text', { hint: 'Words in {braces} fill in by themselves.' });
      });
    },
  },
  gallery: {
    title: 'Pictures at the top', page: 'Product page and home page', help: 'The swipeable pictures beside the headline. Text on a picture is drawn by the page.',
    build(packet, add) {
      list(packet, 'purchase.gallery').forEach((item, i) => {
        imageWithAlt(add, `purchase.gallery.${i}`, `Picture ${i + 1}`);
        add(`purchase.gallery.${i}.overlay.headline`, `Picture ${i + 1}: headline on it`);
        (Array.isArray(item?.overlay?.callouts) ? item.overlay.callouts : []).forEach((_, j) => add(`purchase.gallery.${i}.overlay.callouts.${j}`, `Picture ${i + 1}: callout ${j + 1}`));
      });
    },
  },
  problem: {
    title: 'Sound familiar?', page: 'Product page', help: 'Situations the buyer recognises, then the turn to the product.', meta: true,
    build(packet, add) {
      add('problem.eyebrow', 'Small label above the heading');
      add('problem.headline', 'Headline', 'line', { meta: true });
      list(packet, 'problem.situations').forEach((_, i) => add(`problem.situations.${i}`, `Situation ${i + 1}`, 'line', { meta: true }));
      add('problem.turn', 'Turn to the product');
    },
  },
  features: {
    title: 'Features', page: 'Product page', help: 'Feature close-ups and the numbered diagram.',
    build(packet, add) {
      heads(add, 'features');
      list(packet, 'features.items').forEach((_, i) => {
        add(`features.items.${i}.title`, `Feature ${i + 1} title`);
        add(`features.items.${i}.text`, `Feature ${i + 1} text`, 'text');
        imageWithAlt(add, `features.items.${i}`, `Feature ${i + 1} picture`, { src: 'image' });
      });
      imageWithAlt(add, 'features.diagram', 'Diagram picture', { src: 'image' });
      add('features.diagram.caption', 'Diagram caption');
      list(packet, 'features.diagram.labels').forEach((_, i) => add(`features.diagram.labels.${i}.text`, `Diagram label ${i + 1}`));
    },
  },
  howToUse: {
    title: 'How to use', page: 'Product page', help: 'The step-by-step, one picture per step.',
    build(packet, add) {
      heads(add, 'howToUse');
      list(packet, 'howToUse.steps').forEach((_, i) => {
        add(`howToUse.steps.${i}.title`, `Step ${i + 1} title`);
        add(`howToUse.steps.${i}.text`, `Step ${i + 1} text`, 'text');
        imageWithAlt(add, `howToUse.steps.${i}`, `Step ${i + 1} picture`, { src: 'image' });
      });
    },
  },
  whoFor: {
    title: 'Who it’s for', page: 'Product page', help: 'One card per buyer and situation.', meta: true,
    build(packet, add) {
      heads(add, 'whoFor');
      list(packet, 'whoFor.items').forEach((_, i) => {
        add(`whoFor.items.${i}.label`, `Card ${i + 1}: who it’s for`, 'line', { meta: true });
        add(`whoFor.items.${i}.text`, `Card ${i + 1} text`, 'text', { meta: true });
        imageWithAlt(add, `whoFor.items.${i}`, `Card ${i + 1} picture`, { src: 'image' });
      });
    },
  },
  comparison: {
    title: 'Why it’s better', page: 'Product page and home page', help: 'Ours against an ordinary one. Every row must be true for the exact item.',
    build(packet, add) {
      heads(add, 'comparison');
      add('comparison.oursLabel', 'Our column name');
      add('comparison.theirsLabel', 'Other column name');
      list(packet, 'comparison.rows').forEach((_, i) => {
        add(`comparison.rows.${i}.label`, `Row ${i + 1}`);
        add(`comparison.rows.${i}.ours`, `Row ${i + 1}: ours`);
        add(`comparison.rows.${i}.theirs`, `Row ${i + 1}: ordinary one`);
      });
      add('comparison.note', 'Small note under the table');
    },
  },
  inTheBox: {
    title: 'What’s in the box', page: 'Product page', help: 'Everything in the package, from the supplier’s list.',
    build(packet, add) {
      heads(add, 'inTheBox');
      list(packet, 'inTheBox.items').forEach((_, i) => {
        add(`inTheBox.items.${i}.qty`, `Item ${i + 1} amount`);
        add(`inTheBox.items.${i}.name`, `Item ${i + 1} name`);
        add(`inTheBox.items.${i}.text`, `Item ${i + 1} note`);
      });
      add('inTheBox.note', 'Small note');
    },
  },
  proof: {
    title: 'Reviews', page: 'Product page and home page', help: 'Only sample reviews (demo only) can be edited here. Real reviews keep the buyer’s own words.',
    build(packet, add) {
      heads(add, 'reviews');
      add('reviews.sampleLabel', 'Sample label');
      add('reviews.disclosure', 'Sample disclaimer', 'text');
      list(packet, 'reviews.items').forEach((item, i) => {
        const base = `reviews.items.${i}`;
        if (item?.kind === 'sample') {
          add(`${base}.name`, `Review ${i + 1} name`, 'line', { sample: true });
          add(`${base}.location`, `Review ${i + 1} place`, 'line', { sample: true });
          add(`${base}.text`, `Review ${i + 1} words`, 'text', { sample: true });
          if (isObj(item.photo)) {
            add(`${base}.photo.src`, `Review ${i + 1} photo`, 'image', { sample: true });
            add(`${base}.photo.alt`, `Review ${i + 1} photo: description`, 'line', { sample: true });
          }
        } else {
          add(`${base}.name`, `Review ${i + 1} (real buyer)`, 'fixed', { note: 'A real review keeps the buyer’s own words; it can’t be edited here.' });
        }
      });
    },
  },
  guarantee: {
    title: 'Guarantee', page: 'Product page', help: 'Words from the saved returns policy.',
    build(packet, add) {
      add('guarantee.heading', 'Heading');
      add('guarantee.text', 'What is covered', 'text');
      add('guarantee.linkLabel', 'Link words');
      add('guarantee.note', 'Small note');
      add('guarantee.days', 'Days to return', 'fixed', { note: 'Set in your store returns policy in Shopify Admin.' });
    },
  },
  specs: {
    title: 'Details and specs', page: 'Product page', help: 'Materials, size, care and anything else that applies.',
    build(packet, add) {
      heads(add, 'specs');
      list(packet, 'specs.items').forEach((_, i) => {
        add(`specs.items.${i}.label`, `Detail ${i + 1} name`);
        add(`specs.items.${i}.value`, `Detail ${i + 1}`, 'text');
      });
      add('specs.note', 'Small note');
    },
  },
  bundle: {
    title: 'Get the pair', page: 'Product page', help: 'The pack offer card and any add-on.',
    build(packet, add) {
      heads(add, 'bundle');
      add('bundle.text', 'Text', 'text');
      imageWithAlt(add, 'bundle', 'Pair picture', { src: 'image' });
      add('bundle.addOn.text', 'Add-on line');
      add('bundle.quantity', 'How many in the pair', 'fixed', { note: ASK });
    },
  },
  faq: {
    title: 'Questions', page: 'Product page and home page', help: 'The FAQ, in the order shown.',
    build(packet, add) {
      heads(add, 'faq');
      list(packet, 'faq.items').forEach((_, i) => {
        add(`faq.items.${i}.question`, `Question ${i + 1}`);
        add(`faq.items.${i}.answer`, `Answer ${i + 1}`, 'text', { hint: 'Words in {braces} fill in by themselves.' });
      });
    },
  },
  promise: {
    title: 'Delivery and returns', page: 'Product page', help: 'The three promises at the end of the page.',
    build(packet, add) {
      heads(add, 'promise');
      list(packet, 'promise.items').forEach((_, i) => {
        add(`promise.items.${i}.title`, `Promise ${i + 1} title`);
        add(`promise.items.${i}.text`, `Promise ${i + 1} text`, 'text');
      });
      add('promise.note', 'Small note');
    },
  },
  colors: {
    title: 'Colors', page: 'Every page', help: 'Pick the product’s palette. Fonts stay the same on every product.',
    build(packet, add) {
      add('theme', 'Palette', 'palette');
    },
  },
  offer: {
    title: 'Offer and banners', page: 'Every page', help: 'The words of the offer. Prices, percent off and shipping thresholds are set in Shopify Admin so checkout always matches.',
    build(packet, add) {
      list(packet, 'offer.announcements').forEach((_, i) => add(`offer.announcements.${i}`, `Top banner ${i + 1}`, 'line', { hint: 'Words in {braces} fill in by themselves.' }));
      add('offer.sale.label', 'Sale name');
      add('offer.sale.note', 'Sale note');
      add('offer.sale.percentOff', 'Percent off', 'fixed', { note: ASK, unit: '%' });
      add('offer.sale.endsAt', 'Sale ends', 'fixed', { note: ASK });
      add('offer.freeShippingOver', 'Free shipping over', 'fixed', { note: ASK });
      add('offer.shippingFee', 'Shipping fee', 'fixed', { note: ASK });
      add('offer.currency', 'Currency', 'fixed', { note: ASK });
      add('offer.signup.eyebrow', 'Sign-up: small label');
      add('offer.signup.heading', 'Sign-up: heading');
      add('offer.signup.text', 'Sign-up: text', 'text');
      add('offer.signup.cta', 'Sign-up: button');
      add('offer.signup.success', 'Sign-up: after joining');
      add('offer.signup.fineprint', 'Sign-up: small print');
    },
  },
  other: {
    title: 'Other pages', page: 'About, Help, checkout and search', help: 'The product blocks on About and Help, the browser title and the search box.',
    build(packet, add) {
      add('home.meta.title', 'Browser tab title');
      add('home.meta.description', 'Search engine description', 'text');
      add('aboutProduct.eyebrow', 'About page: small label');
      add('aboutProduct.heading', 'About page: heading');
      add('aboutProduct.emphasis', 'About page: second line');
      add('aboutProduct.text', 'About page: text', 'text');
      add('aboutProduct.cta', 'About page: button');
      add('aboutProduct.note', 'About page: small note');
      imageWithAlt(add, 'aboutProduct.image', 'About page picture');
      add('helpProduct.eyebrow', 'Help pages: small label');
      add('helpProduct.heading', 'Help pages: heading');
      add('helpProduct.emphasis', 'Help pages: second line');
      add('helpProduct.cta', 'Help pages: button');
      add('helpProduct.returnsLink', 'Returns page: link back');
      imageWithAlt(add, 'helpProduct.image', 'Help pages picture');
      add('checkoutPreview.intro', 'Checkout: line above the bag');
      add('checkoutPreview.confirmation', 'Checkout: done heading');
      add('checkoutPreview.emptyCta', 'Checkout: empty bag button');
      add('search.placeholder', 'Search box hint');
    },
  },
};

/** The sections in the order a shopper meets them, for the packet's template. */
export function sectionOrder(packet) {
  const below = TEMPLATE_ORDERS[packet?.templateId] || TEMPLATE_ORDERS['story-led'];
  return ['top', 'gallery', ...below, 'colors', 'offer', 'other'];
}

/* ---------- Colors (owner, Oct 2: palettes per product, fonts fixed) ---------- */

/** The packet theme's color keys, as in app/content/palettes.ts. */
export const THEME_TOKENS = ['paper', 'ink', 'muted', 'line', 'accent', 'accentText', 'onAccent', 'highlight', 'shade'];
const HEX = /^#[0-9a-f]{3,8}$/i;
/**
 * The palettes in app/content/palettes.ts, read from its source text: every
 * object literal with an id, a name and the nine hex colors. Extra string
 * fields (group, mood, goodFor, note) come along; anything else is ignored.
 */
export function parsePalettes(source) {
  const palettes = [];
  for (const match of String(source || '').matchAll(/\{([^{}]*\bid\s*:[^{}]*)\}/g)) {
    const item = {};
    for (const pair of match[1].matchAll(/([A-Za-z]+)\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) item[pair[1]] = (pair[2] ?? pair[3]).replace(/\\(.)/g, '$1');
    if (!/^[a-z0-9-]{1,40}$/.test(item.id || '') || !item.name || !THEME_TOKENS.every(key => HEX.test(item[key] || ''))) continue;
    if (palettes.some(palette => palette.id === item.id)) continue;
    const group = item.mood || item.group || 'Other';
    palettes.push({ id: item.id, name: item.name.slice(0, 80), group: group.slice(0, 40), goodFor: String(item.goodFor || item.good || item.note || '').slice(0, 200), colors: Object.fromEntries(THEME_TOKENS.map(key => [key, item[key]])) });
  }
  return palettes;
}
/**
 * The palettes in app/content/palettes.json ({groups: [{id, name, note}],
 * palettes: [...]}, the JSON list the store builder keeps for us). Same checks
 * as parsePalettes; returns {palettes, groups} with the mood notes.
 */
export function palettesFromJson(data) {
  if (!isObj(data) || !Array.isArray(data.palettes)) return { palettes: [], groups: [] };
  const source = data.palettes.filter(isObj).map(item => `{${Object.entries(item).filter(([, value]) => isStr(value)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')}}`).join('\n');
  const groups = (Array.isArray(data.groups) ? data.groups : []).filter(group => isObj(group) && isStr(group.name)).map(group => ({ name: group.name.slice(0, 40), note: isStr(group.note) ? group.note.slice(0, 200) : '' }));
  return { palettes: parsePalettes(source), groups };
}
/** Palettes grouped by mood: the file's group order and notes first, then any other group. */
export function paletteGroups(palettes, meta = []) {
  const groups = meta.map(group => ({ name: group.name, note: group.note || '', palettes: [] }));
  for (const palette of palettes) {
    let group = groups.find(item => item.name === palette.group);
    if (!group) groups.push(group = { name: palette.group, note: '', palettes: [] });
    group.palettes.push(palette);
  }
  return groups.filter(group => group.palettes.length);
}
/** The palette a packet theme uses: same colors (name breaks ties), or null. */
export function currentPalette(theme, palettes) {
  if (!isObj(theme)) return null;
  const same = palettes.filter(palette => THEME_TOKENS.every(key => String(theme[key] || '').toLowerCase() === palette.colors[key].toLowerCase()));
  return same.find(palette => palette.name === theme.name) || same[0] || null;
}
/** The packet's new theme for a palette: its colors and name; any other theme key (fonts) is kept. */
export function themeFor(theme, palette) {
  return { ...(isObj(theme) ? theme : {}), name: palette.name, ...palette.colors };
}

/** Deep equality for saved values (strings, or the theme object). */
export function sameValue(a, b) {
  return a === b || (isObj(a) && isObj(b) && JSON.stringify(a) === JSON.stringify(b));
}
/** A saved value in a few words (a theme reads as its palette name). */
export function valueText(value) {
  if (isStr(value)) return value;
  if (isObj(value)) return value.name ? `${value.name} palette` : JSON.stringify(value);
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Every editable (and read-only) field of a packet, grouped by section in page
 * order. Fields keep their saved value; `kind` is line, text, image or fixed.
 */
export function editorSections(packet) {
  if (!isObj(packet)) return [];
  return sectionOrder(packet).map((id, index) => {
    const section = SECTIONS[id];
    const { fields, add } = builder(packet);
    section.build(packet, add);
    return { id, number: index + 1, title: section.title, page: section.page, help: section.help, meta: Boolean(section.meta), fields: fields.map(field => ({ ...field, section: section.title })) };
  }).filter(section => section.fields.length);
}
/** path -> field, for every field the editor shows. */
export function fieldMap(packet) {
  return new Map(editorSections(packet).flatMap(section => section.fields.map(field => [field.path, field])));
}
export const fieldName = field => field ? `${field.section} · ${field.label}` : '';

/* ---------- Plain words for the store check ---------- */

/** Wording Meta refuses: saying the reader has a condition (same rule as packet-tools). */
export const CONDITION_WORDS = /\byou(?:'re|’re| are| have| suffer)\b/i;
export const META_RULE = 'Meta’s personal-attributes rule: copy may not say the reader has a condition (“you have…”, “you are…”, “you suffer…”). Describe the situation, or write it about someone else.';
/** A live, non-blocking hint for the fields the store check holds to Meta's rule. */
export function conditionHint(field, value) {
  return field?.meta && isStr(value) && CONDITION_WORDS.test(value) ? META_RULE : '';
}

/**
 * One store-check problem (exact text from packet-tools) in plain words.
 * Matched by the check's exact sentences, never a loose word (LS-073).
 */
export function explainProblem(problem, fields = new Map()) {
  const text = String(problem || '');
  const labelOf = path => fieldName(fields.get(path)) || path;
  if (text.includes('speaks to the reader\'s condition')) return META_RULE;
  if (text.includes('reads as proof we do not hold')) return 'This reads as proof we don’t hold (a doctor, an expert, “#1”, “sold out”, “only N left” or a customer count). The store only shows proof we can source.';
  if (text.includes('is too long (keep it to about 8 words)')) return 'The headline at the top is too long: keep it to about 8 words (10 at most).';
  const half = text.match(/^([A-Za-z.0-9]+) is half filled: needs (.+)$/);
  if (half) return `${half[1]} is half filled: each card needs all its parts (${half[2]}). Fill them in, or clear the whole card.`;
  if (text.startsWith('picture file not in public/')) return `That picture isn’t in the store’s images (${text.slice('picture file not in public/: '.length)}).`;
  if (/is a sample review: remove it/.test(text)) return 'Sample reviews only show on the demo store, never on the real one.';
  if (/^problem\.situations \(3 to 4 short lines/.test(text)) return '“Sound familiar?” needs 3 or 4 situation lines.';
  if (/^[A-Za-z]+(?:\.[A-Za-z0-9]+)+$/.test(text)) return `“${labelOf(text)}” can’t be empty.`;
  return `The store check refused it: ${text}`;
}

/* ---------- History, undo, owner edits, publish (pure, on saved records) ---------- */

export function emptyEdits() { return { revision: 0, saves: [], publishes: [] }; }
const live = save => !save.undoneAt && !save.undoOf;

/** The last few saves of a packet that can still be undone (newest first). */
export function undoable(record, packetFile, packet, limit = UNDO_LIMIT) {
  return (record?.saves || []).filter(save => save.packet === packetFile && live(save)).slice(-limit).reverse()
    .map(save => ({ ...save, stale: save.changes.filter(change => !sameValue(getAt(packet, change.path), change.after)).map(change => change.label) }));
}
/**
 * Fields whose latest standing edit (not undone, not an undo) is the owner's.
 * `kept` says whether the packet still holds the owner's words.
 */
export function ownerEdits(record, packetFile, packet) {
  const latest = new Map();
  for (const save of record?.saves || []) {
    if (save.packet !== packetFile || !live(save)) continue;
    for (const change of save.changes) latest.set(change.path, { ...change, by: save.by, at: save.at, saveId: save.id });
  }
  return [...latest.values()].filter(edit => edit.by === 'owner').map(edit => ({ ...edit, current: getAt(packet, edit.path), kept: sameValue(getAt(packet, edit.path), edit.after) }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
/** What changed (by field) since the last publish request, across packets. */
export function sincePublish(record) {
  const last = (record?.publishes || []).at(-1);
  const after = last?.at || '';
  const fields = new Map();
  const saves = record?.saves || [];
  // A save and its undo, both after the last publish, cancel out.
  const undoneSince = new Set(saves.filter(save => save.at > after && save.undoneAt).map(save => save.id));
  for (const save of saves) {
    if (save.at <= after || save.undoneAt || (save.undoOf && undoneSince.has(save.undoOf))) continue;
    for (const change of save.changes) fields.set(`${save.packet}:${change.path}`, { packet: save.packet, path: change.path, label: change.label, section: change.section, saveId: save.id, at: save.at, by: save.by });
  }
  return { last: last || null, changes: [...fields.values()] };
}
/** Markdown for agent briefs: the owner's edits agents must keep. */
export function ownerEditsMarkdown(groups, max = 8) {
  const all = groups.flatMap(group => group.edits.map(edit => ({ ...edit, packet: group.packet })));
  if (!all.length) return '';
  const one = value => valueText(value).replace(/\s+/g, ' ').trim().slice(0, 70);
  const lines = all.slice(0, max).map(edit => `- ${edit.packet} · ${edit.section} · ${edit.label} (\`${edit.path}\`): "${one(edit.after)}"${edit.kept ? '' : ' · changed since, check with the owner'}`);
  return `## Owner edits in the store (keep them)\n\nThe owner fixed these in the Store editor. Build on them; never overwrite one without asking. Full list: \`os.mjs store\`.\n\n${lines.join('\n')}${all.length > max ? `\n- …and ${all.length - max} more` : ''}\n\n`;
}
