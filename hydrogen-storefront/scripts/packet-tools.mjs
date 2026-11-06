import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Icon keys for hero benefits and the trust row; matches HERO_ICONS in templates.ts. */
export const HERO_ICON_KEYS = [
  'feather',
  'leaf',
  'heart',
  'sparkle',
  'moon',
  'sun',
  'bolt',
  'battery',
  'waves',
  'shield',
  'clock',
  'check',
  'truck',
  'return',
  'lock',
  'chat',
  'box',
  'gift',
];
/** The one page template (store/PAGE-BLUEPRINT.md); matches TEMPLATE_ID in templates.ts. */
export const TEMPLATE_ID = 'merrivy-standard';
/** Line icons for rows, stat cards and placeholders; matches STAT_ICONS in templates.ts. */
export const STAT_ICON_KEYS = [
  'timer',
  'power',
  'moon',
  'waves',
  'tub',
  'drop',
  'feather',
  'recline',
  'suction',
  'hand',
  'ruler',
  'rim',
  'sparkle',
  'air',
];
/** The first five gallery images, in order; matches GALLERY_ROLES in templates.ts. */
export const GALLERY_ROLE_KEYS = [
  'hero',
  'features',
  'in-use',
  'comparison',
  'in-the-box',
];

export function blankPacket(reference, slug) {
  const clear = (value) =>
    Array.isArray(value)
      ? value.map(clear)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, clear(v)]),
          )
        : typeof value === 'string'
          ? ''
          : value;
  const draft = clear(reference);
  draft.id = slug;
  draft.status = 'draft';
  draft.templateId = TEMPLATE_ID;
  draft.productHandles = [];
  draft.proof.kind = 'omit';
  draft.proof.items = [];
  draft.demonstrations.items = [];
  // One or two of the same item; the 2-pack ships free via the threshold.
  draft.purchase.offerChoices = [
    {quantity: 1, label: '', caption: ''},
    {quantity: 2, label: '', caption: ''},
  ];
  // Five designed image slots for the image-maker, in gallery order.
  draft.purchase.gallery = GALLERY_ROLE_KEYS.map((role) => ({
    src: '',
    alt: '',
    label: '',
    caption: '',
    role,
    overlay: {headline: '', callouts: []},
  }));
  if (draft.reviews) draft.reviews.items = [];
  // Below-hero sections stay hidden until filled; a guarantee needs real days.
  if (draft.guarantee) draft.guarantee.days = 0;
  draft.purchase.guidance.kind = 'omit';
  draft.purchase.guidance.chart = [];
  // Delivery windows must come from the new product's supplier terms.
  draft.purchase.delivery = {processingDays: [], transitDays: [], note: ''};
  return draft;
}

/**
 * Clone the 10/10 Master Base Theme (app/content/base-theme.json) for a new
 * product handle, optionally applying any palette id from palettes.json.
 */
export function cloneBaseTheme(reference, slug, {palette = null} = {}) {
  const clone = JSON.parse(JSON.stringify(reference));
  const titleWords = slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  clone.id = slug;
  clone.status = 'draft';
  clone.templateId = TEMPLATE_ID;
  clone.sections = ['features', 'comparison', 'quotes', 'guarantee', 'faq'];
  clone.productHandles = [slug];
  clone.productUrl = '/products/' + slug;
  clone.navLabel = titleWords;
  clone.shortName = titleWords;
  if (clone.catalog) {
    clone.catalog.handle = slug;
    clone.catalog.title = titleWords;
  }
  if (Array.isArray(clone.demonstrations?.items)) {
    for (const demo of clone.demonstrations.items) {
      demo.productHandle = slug;
    }
  }
  if (palette && typeof palette === 'object') {
    clone.theme = {
      name: palette.name,
      paper: palette.paper,
      ink: palette.ink,
      muted: palette.muted,
      line: palette.line,
      accent: palette.accent,
      accentText: palette.accentText,
      onAccent: palette.onAccent,
      highlight: palette.highlight,
      shade: palette.shade,
    };
  }
  return clone;
}

/**
 * Everything the page needs, then the blueprint rules for a real product
 * (store/PAGE-BLUEPRINT.md): one list of problems, empty when the packet passes.
 */
export function missingContent(packet) {
  return [...missingContentCore(packet), ...blueprintProblems(packet)];
}

export function missingContentCore(packet) {
  const missing = [];
  const check = (key, value) => {
    if (typeof value !== 'string' || !value.trim()) missing.push(key);
  };
  check('id', packet.id);
  // One page template for every product (store/PAGE-BLUEPRINT.md, October 3).
  if (packet.templateId !== TEMPLATE_ID)
    missing.push(`known templateId (${TEMPLATE_ID}; the older story-led, problem-solution and gift-led are retired)`);
  if (!packet.productHandles?.length) missing.push('productHandles');
  check('productUrl', packet.productUrl);
  // Cart, demo checkout, Returns and Home link here, so it must be a real handle.
  if (
    packet.productUrl?.trim() &&
    !(packet.productHandles ?? []).some(
      (handle) => packet.productUrl === '/products/' + handle,
    )
  )
    missing.push('productUrl must be /products/<a handle from productHandles>');
  check('navLabel', packet.navLabel);
  // The plain noun for the product ("hoodie"), used in the /templates note.
  check('shortName', packet.shortName);
  // Words that used to sit in page code: the home page title and description,
  // the Returns page link, the demo checkout and the search page.
  check('home.meta.title', packet.home?.meta?.title);
  check('home.meta.description', packet.home?.meta?.description);
  check('helpProduct.returnsLink', packet.helpProduct?.returnsLink);
  for (const key of ['intro', 'confirmation', 'emptyCta'])
    check('checkoutPreview.' + key, packet.checkoutPreview?.[key]);
  check('search.placeholder', packet.search?.placeholder);
  if (
    !packet.search?.suggestions?.length ||
    packet.search.suggestions.some(
      (word) => typeof word !== 'string' || !word.trim(),
    )
  )
    missing.push('search.suggestions');
  for (const key of ['avatar', 'situation', 'emotion', 'evidence'])
    check('buyer.' + key, packet.buyer?.[key]);
  for (const key of [
    'home',
    'purchase',
    'benefits',
    'story',
    'featureSpotlight',
    'useCases',
    'fit',
    'promise',
    'faq',
    'closing',
    'finale',
    'aboutProduct',
    'helpProduct',
  ])
    check(key + '.heading', packet[key]?.heading);
  check('purchase.hook', packet.purchase?.hook);
  check('purchase.description', packet.purchase?.description);
  for (const key of [
    'home',
    'story',
    'useCases',
    'aboutProduct',
    'helpProduct',
  ]) {
    check(key + '.image.src', packet[key]?.image?.src);
    check(key + '.image.alt', packet[key]?.image?.alt);
  }
  // Product blocks on the About and Help pages link to the product page.
  check('aboutProduct.text', packet.aboutProduct?.text);
  check('aboutProduct.cta', packet.aboutProduct?.cta);
  check('helpProduct.cta', packet.helpProduct?.cta);
  // Home moments: picture cards under the story on the home page.
  check('home.moments.heading', packet.home?.moments?.heading);
  if (!packet.home?.moments?.items?.length) missing.push('home.moments.items');
  packet.home?.moments?.items?.forEach((item, i) => {
    for (const field of ['label', 'title', 'text'])
      check(`home.moments.items.${i}.${field}`, item?.[field]);
    check(`home.moments.items.${i}.image.src`, item?.image?.src);
    check(`home.moments.items.${i}.image.alt`, item?.image?.alt);
  });
  if (!packet.purchase?.gallery?.length) missing.push('purchase.gallery');
  packet.purchase?.gallery?.forEach((image, i) => {
    check(`purchase.gallery.${i}.src`, image.src);
    check(`purchase.gallery.${i}.alt`, image.alt);
  });
  if (
    !packet.purchase?.benefits?.length ||
    packet.purchase.benefits.some((x) => !x.trim())
  )
    missing.push('purchase.benefits');
  const arrays = [
    ['story.paragraphs', packet.story?.paragraphs, ''],
    ['benefits.items', packet.benefits?.items, 'text'],
    ['featureSpotlight.points', packet.featureSpotlight?.points, 'text'],
    ['useCases.items', packet.useCases?.items, 'text'],
    ['fit.tips', packet.fit?.tips, 'text'],
    ['promise.items', packet.promise?.items, 'text'],
    ['faq.items', packet.faq?.items, 'answer'],
    ['purchase.disclosures', packet.purchase?.disclosures, 'text'],
    ['purchase.trust', packet.purchase?.trust, 'title'],
  ];
  for (const [name, rows, field] of arrays)
    if (
      !rows?.length ||
      rows.some((row) => !(field ? row[field] : row)?.trim())
    )
      missing.push(name);
  // Hero-first purchase block (October 1).
  const hero = packet.hero ?? {};
  check('hero.headline', hero.headline);
  if (typeof hero.headline === 'string' && hero.headline.trim().split(/\s+/).length > 10)
    missing.push('hero.headline is too long (keep it to about 8 words)');
  if (!hero.benefits?.length || hero.benefits.length > 4)
    missing.push('hero.benefits (1 to 4)');
  hero.benefits?.forEach((item, i) => {
    check(`hero.benefits.${i}.text`, item?.text);
    if (!HERO_ICON_KEYS.includes(item?.icon))
      missing.push(`hero.benefits.${i}.icon (one of ${HERO_ICON_KEYS.join(', ')})`);
  });
  if (!hero.trustRow?.length || hero.trustRow.length > 4)
    missing.push('hero.trustRow (2 to 4: delivery time, returns, secure checkout)');
  hero.trustRow?.forEach((item, i) => {
    check(`hero.trustRow.${i}.text`, item?.text);
    if (!HERO_ICON_KEYS.includes(item?.icon))
      missing.push(`hero.trustRow.${i}.icon (one of ${HERO_ICON_KEYS.join(', ')})`);
  });
  const choices = packet.purchase?.offerChoices ?? [];
  if (
    !choices.length ||
    choices.some((c) => !Number.isInteger(c?.quantity) || c.quantity < 1 || !c.label?.trim())
  )
    missing.push('purchase.offerChoices (quantity and label for each pack)');
  // Real products need at least four designed images, in order.
  const roles = (packet.purchase?.gallery ?? []).map((image) => image?.role);
  if (packet.status !== 'sample')
    GALLERY_ROLE_KEYS.slice(
      0,
      Math.max(4, Math.min(roles.length, GALLERY_ROLE_KEYS.length)),
    ).forEach((role, i) => {
      if (roles[i] !== role)
        missing.push(`purchase.gallery.${i} must be the "${role}" image`);
    });
  const c = packet.comparison ?? {};
  for (const key of ['heading', 'oursLabel', 'theirsLabel'])
    check('comparison.' + key, c[key]);
  if (
    (c.rows?.length ?? 0) < 3 ||
    c.rows.some((row) => !row?.label?.trim() || !row?.ours?.trim() || !row?.theirs?.trim())
  )
    missing.push('comparison.rows (at least 3, each with label, ours, theirs)');
  check('howItWorks.heading', packet.howItWorks?.heading);
  if (
    (packet.howItWorks?.steps?.length ?? 0) < 2 ||
    packet.howItWorks.steps.some((step) => !step?.title?.trim() || !step?.text?.trim())
  )
    missing.push('howItWorks.steps (at least 2)');
  check('inTheBox.heading', packet.inTheBox?.heading);
  if (
    !packet.inTheBox?.items?.length ||
    packet.inTheBox.items.some((item) => !item?.qty?.trim() || !item?.name?.trim())
  )
    missing.push('inTheBox.items (qty and name for each)');
  missing.push(...belowHeroProblems(packet));
  check('reviews.heading', packet.reviews?.heading);
  (packet.reviews?.items ?? []).forEach((item, i) => {
    if (!['sample', 'genuine'].includes(item?.kind))
      missing.push(`reviews.items.${i}.kind (sample or genuine)`);
    if (item?.kind === 'sample' && !['sample', 'preview'].includes(packet.status))
      missing.push(
        `reviews.items.${i} is a sample review: remove it (sample reviews never show on the real store)`,
      );
    if (item?.kind === 'genuine')
      for (const field of ['name', 'text', 'source', 'date'])
        if (!item[field]?.trim())
          missing.push(`reviews.items.${i}.${field} (genuine reviews need a real buyer, source and date)`);
    if (item?.kind === 'genuine' && item.permission !== true)
      missing.push(`reviews.items.${i}.permission (genuine reviews need permission to show)`);
  });
  if (packet.status !== 'sample' && packet.proof?.kind === 'illustrative')
    missing.push('remove illustrative proof from non-sample packet');
  if (packet.status !== 'sample' && packet.proof?.kind === 'pending')
    missing.push('resolve pending proof or explicitly omit it');
  if (
    !['omit', 'pending', 'verified', 'illustrative'].includes(
      packet.proof?.kind,
    )
  )
    missing.push('proof.kind');
  if (
    packet.proof?.kind === 'verified' &&
    (!packet.proof.items?.length ||
      packet.proof.items.some(
        (item) =>
          !item.source?.trim() || !item.text?.trim() || !item.author?.trim(),
      ))
  )
    missing.push('attributed proof sources');
  return missing;
}

const has = (value) => typeof value === 'string' && value.trim().length > 0;
/**
 * Rows are either blank (hidden) or complete; half-filled rows are errors.
 * `picture: true` makes a row's image optional (a section picture can stand
 * in), but an image and its alt text still come together.
 */
function rowProblems(name, rows, fields, {min = 0, max = 99, picture = false} = {}) {
  const problems = [];
  const list = Array.isArray(rows) ? rows : [];
  const pair = (row) => has(row?.image) === has(row?.alt);
  const complete = list.filter(
    (row) => fields.every((field) => has(row?.[field])) && (!picture || pair(row)),
  );
  list.forEach((row, i) => {
    const all = picture ? [...fields, 'image', 'alt'] : fields;
    const filled = all.filter((field) => has(row?.[field]));
    const missing = picture
      ? [
          ...fields.filter((field) => !has(row?.[field])),
          ...(pair(row) ? [] : [has(row?.image) ? 'alt' : 'image']),
        ]
      : fields.filter((field) => !has(row?.[field]));
    if (filled.length && missing.length)
      problems.push(`${name}.${i} is half filled: needs ${missing.join(', ')}`);
  });
  if (complete.length && (complete.length < min || complete.length > max))
    problems.push(`${name} (${min} to ${max} complete entries, has ${complete.length})`);
  return {problems, complete};
}
/** Wording that would turn copy into a claim about the reader's condition ("you have to" excitement hooks are allowed). */
const SECOND_PERSON_CONDITION = /\byou(?:'re|’re| are| have(?!\s+to\b)| suffer)\b/i;
/** Proof we never show without a genuine source field (none exist yet). */
export const FAKE_PROOF =
  /as seen (?:on|in)|doctor|dermatologist|clinically|expert[- ]?(?:recommended|approved)|#1\b|sold out|selling fast|only \d+ left|\d[\d,.]*k?\+? (?:happy )?(?:customers|buyers|users|sleepers|people)\b/i;

/**
 * Sections below the hero (October 1): problem, features + diagram, how to
 * use, who it's for, guarantee, specs and bundle. All optional; a section is
 * hidden when blank, so only half-filled or unsafe content is reported.
 */
export function belowHeroProblems(packet) {
  const problems = [];
  const p = packet.problem;
  if (p && (has(p.headline) || (p.situations ?? []).some(has) || has(p.turn))) {
    const situations = (p.situations ?? []).filter(has);
    if (!has(p.headline)) problems.push('problem.headline');
    if (situations.length < 3 || situations.length > 4)
      problems.push(`problem.situations (3 to 4 short lines, has ${situations.length})`);
    if (!has(p.turn)) problems.push('problem.turn (one line that turns to the product)');
    for (const line of [p.headline, ...situations])
      if (has(line) && SECOND_PERSON_CONDITION.test(line))
        problems.push(
          `problem: "${line}" speaks to the reader's condition; write it in the third person or as a situation`,
        );
  }
  const features = rowProblems('features.items', packet.features?.items, ['title', 'text'], {min: 2, max: 4, picture: true});
  problems.push(...features.problems);
  const d = packet.features?.diagram;
  if (d && (has(d.image) || (d.labels ?? []).some((label) => has(label?.text)))) {
    if (!has(d.image) || !has(d.alt)) problems.push('features.diagram.image and alt');
    const labels = (d.labels ?? []).filter((label) => has(label?.text));
    if (!labels.length) problems.push('features.diagram.labels (at least one)');
    labels.forEach((label, i) => {
      for (const axis of ['x', 'y'])
        if (!Number.isFinite(label[axis]) || label[axis] < 0 || label[axis] > 100)
          problems.push(`features.diagram.labels.${i}.${axis} (0 to 100, percent from the top left)`);
    });
  }
  if ((features.complete.length || has(d?.image)) && !has(packet.features?.heading))
    problems.push('features.heading');
  // A section's foot note and nav chip are plain words; a note may cite a source.
  for (const key of ['note', 'navLabel'])
    if (packet.features?.[key] !== undefined && typeof packet.features[key] !== 'string')
      problems.push(`features.${key} must be text`);
  for (const item of features.complete)
    if (HEALTH_CLAIMS.test(`${item.title} ${item.text}`))
      problems.push(`features: "${item.title}" reads as a treatment, condition or sleep-result claim; state the general fact with its source, never a result from the product`);
  const steps = rowProblems('howToUse.steps', packet.howToUse?.steps, ['title', 'text'], {min: 2, max: 4, picture: true});
  problems.push(...steps.problems);
  if (steps.complete.length && !has(packet.howToUse?.heading)) problems.push('howToUse.heading');
  // Section pictures (October 3): one picture for a whole block, with alt text.
  for (const block of ['howToUse', 'whoFor', 'inTheBox'])
    if (has(packet[block]?.image) !== has(packet[block]?.alt))
      problems.push(`${block}.image and ${block}.alt (a section picture needs both)`);
  const fit = rowProblems('fitCheck.steps', packet.fitCheck?.steps, ['title', 'text'], {min: 2, max: 5});
  problems.push(...fit.problems);
  if (fit.complete.length && !has(packet.fitCheck?.heading)) problems.push('fitCheck.heading');
  for (const step of fit.complete)
    if (SECOND_PERSON_CONDITION.test(`${step.title} ${step.text}`))
      problems.push(`fitCheck: "${step.title}" speaks to the reader's condition; describe the check instead`);
  const who = rowProblems('whoFor.items', packet.whoFor?.items, ['label', 'text'], {min: 2, max: 4, picture: true});
  problems.push(...who.problems);
  if (who.complete.length && !has(packet.whoFor?.heading)) problems.push('whoFor.heading');
  // A line under the title, a line after the cards and a sources note are plain text.
  for (const key of ['intro', 'outro', 'note'])
    if (packet.whoFor?.[key] !== undefined && typeof packet.whoFor[key] !== 'string')
      problems.push(`whoFor.${key} must be text`);
  for (const item of who.complete)
    if (SECOND_PERSON_CONDITION.test(item.label) || SECOND_PERSON_CONDITION.test(item.text))
      problems.push(`whoFor: "${item.label}" speaks to the reader's condition; describe the situation instead`);
  const g = packet.guarantee;
  if (g && ((Number(g.days) || 0) !== 0 || has(g.text) || has(g.heading))) {
    if (!Number.isInteger(g.days) || g.days < 1)
      problems.push('guarantee.days (whole days from the real returns policy; 0 hides the block)');
    if (!has(g.heading) || !has(g.text))
      problems.push('guarantee.heading and guarantee.text (what is covered)');
    if (!has(g.href))
      problems.push('guarantee.href (link to the returns policy the days come from)');
    if (packet.status !== 'sample' && /demo/i.test(`${g.text} ${g.note}`))
      problems.push('guarantee still carries demo terms');
  }
  const specs = rowProblems('specs.items', packet.specs?.items, ['label', 'value']);
  problems.push(...specs.problems);
  if (specs.complete.length && !has(packet.specs?.heading)) problems.push('specs.heading');
  const b = packet.bundle;
  if (b && (has(b.heading) || has(b.addOn?.handle))) {
    const choices = packet.purchase?.offerChoices ?? [];
    if (!has(b.heading)) problems.push('bundle.heading');
    if (!choices.some((choice) => choice?.quantity === b.quantity && b.quantity > 1) && !has(b.addOn?.handle))
      problems.push('bundle.quantity must match a purchase.offerChoices pack (2 or more)');
    if (has(b.image) && !has(b.alt)) problems.push('bundle.alt');
    if (has(b.addOn?.handle)) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(b.addOn.handle))
        problems.push('bundle.addOn.handle (a Shopify product handle)');
      if ((packet.productHandles ?? []).includes(b.addOn.handle))
        problems.push('bundle.addOn.handle must be a different product');
    }
  }
  // Quotes from other sellers' reviews of the same item type (October 3,
  // FTC 16 CFR Part 465): sourced, labelled as such, never shown as ours.
  const q = packet.pullQuotes;
  if (q && ((q.items ?? []).length || has(q.heading))) {
    const quotes = rowProblems('pullQuotes.items', q.items, ['id', 'text', 'review'], {min: 4, max: 6});
    problems.push(...quotes.problems);
    if (!quotes.complete.length) problems.push('pullQuotes.items (4 to 6 quotes with id, text and review link)');
    if (!has(q.heading)) problems.push('pullQuotes.heading');
    // The disclosure is made once, under the heading (subheading), or on every
    // quote (attribution, the older way).
    const subheading = typeof q.subheading === 'string' ? q.subheading : '';
    const attribution = typeof q.attribution === 'string' ? q.attribution : '';
    if (!has(subheading) && !has(attribution))
      problems.push("pullQuotes.subheading (the line under the heading that says these are other people's words about pillows like ours; or pullQuotes.attribution, a source line under every quote)");
    if (has(subheading) && !QUOTES_DISCLOSURE.test(subheading))
      problems.push(`pullQuotes.subheading: "${subheading}" must say these are about pillows like ours or from other sellers' reviews`);
    if (has(attribution) && !/review/i.test(attribution))
      problems.push('pullQuotes.attribution (the line under each quote that says whose review it is)');
    // The source (Amazon, other sellers) is named once: in the subheading or in a foot note.
    const disclosedInSubheading = has(subheading) && (QUOTES_SOURCE.test(subheading) || QUOTES_DISCLOSURE.test(subheading));
    if (!has(q.note) && !disclosedInSubheading) problems.push('pullQuotes.subheading must say these are about pillows like ours (or add a foot note naming the source)');
    else if (has(q.note) && !QUOTES_SOURCE.test(q.note))
      problems.push('pullQuotes.note must say where the quotes come from (Amazon, other sellers, a marketplace)');
    for (const key of ['subheading', 'attribution', 'note']) {
      const line = typeof q[key] === 'string' ? q[key] : '';
      if (OUR_REVIEWS.test(line))
        problems.push(`pullQuotes.${key}: "${line.slice(0, 80)}" reads as Merrivy's own reviews or customers`);
      if (RATING_WORDS.test(line))
        problems.push(`pullQuotes.${key}: "${line.slice(0, 80)}" carries a rating, stars or a count; quotes show none`);
    }
    if (!has(q.evidence)) problems.push('pullQuotes.evidence (the research file the quotes are copied from)');
    for (const item of q.items ?? []) {
      // Only id, text and review: no first name, initials, location, rating,
      // date, "verified" or any other person label (it would read as a Merrivy customer).
      for (const key of Object.keys(item ?? {}))
        if (!QUOTE_KEYS.includes(key))
          problems.push(`pullQuotes: ${item.id} carries "${key}"; quotes show no names, initials, stars, ratings, dates, badges or person labels (only id, text, review)`);
      if (has(item?.text) && CONDITION_WORDS.test(item.text))
        problems.push(`pullQuotes: ${item.id} names a condition; pick a quote about the bath, not the body`);
      if (has(item?.review) && !item.review.startsWith('https://'))
        problems.push(`pullQuotes: ${item.id} review must be the review's https link`);
    }
  }
  problems.push(...interactiveProblems(packet));
  // Customer review photos must all be distinct uploaded images.
  const reviewPhotos = (packet?.quotes?.items ?? [])
    .map((item) => item?.photo)
    .filter(Boolean);
  if (reviewPhotos.length > 1 && new Set(reviewPhotos).size !== reviewPhotos.length) {
    problems.push('quotes.items: every customer review must have a distinct uploaded photo (no duplicate review photo paths)');
  }
  // No fake proof, no child wording, no em dashes, and no unfilled copy token anywhere.
  const walk = (node, at) => {
    if (typeof node === 'string') {
      if (node.includes('\u2014')) problems.push(`${at}: "${node.slice(0, 80)}" contains an em dash (—); remove em dashes`);
      if (FAKE_PROOF.test(node)) problems.push(`${at}: "${node.slice(0, 80)}" reads as proof we do not hold`);
      if (CHILD_WORDS.test(node)) problems.push(`${at}: "${node.slice(0, 80)}" mentions children; Merrivy never sells to or shows children`);
      // Research notes (buyer.*, *.evidence) may quote the words we keep off the
      // page, and the features foot note may cite a paper by its own title.
      if (HEALTH_CLAIMS.test(node) && !/^buyer(?:\.|$)|\.evidence$|^features\.note$/.test(at))
        problems.push(`${at}: "${node.slice(0, 80)}" reads as a treatment, condition or sleep-result claim`);
      for (const token of node.match(/\{[a-zA-Z]+\}/g) ?? [])
        if (!STORE_TOKENS.includes(token))
          problems.push(`${at}: copy token ${token} is not filled (the store fills only ${STORE_TOKENS.join(', ')})`);
    } else if (Array.isArray(node)) node.forEach((item, i) => walk(item, `${at}.${i}`));
    else if (node && typeof node === 'object')
      for (const [key, item] of Object.entries(node))
        if (!['reviews', 'proof', 'id', 'productHandles'].includes(key)) walk(item, at ? `${at}.${key}` : key);
  };
  walk(packet, '');
  problems.push(...catalogProblems(packet));
  return problems;
}

/** A source line names where a fact comes from: a year or a link. */
export const SOURCE_LINE = /\b(?:1[6-9]|20)\d{2}\b|https:\/\//;
const SHOPIFY_HANDLE = /^[a-z0-9][a-z0-9-]*$/;
const iconProblem = (at, key) =>
  key !== undefined && key !== '' && !STAT_ICON_KEYS.includes(key)
    ? [`${at} (one of ${STAT_ICON_KEYS.join(', ')})`]
    : [];
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * The October 3 interactive fields: stat cards and the study band, "Did you
 * know?", line icons, the bonus, the add-ons and the sets. All optional; when
 * present they must be complete and sourced.
 */
export function interactiveProblems(packet) {
  const problems = [];
  // Why it matters: a card's number is exactly the source's, with its caption.
  (packet.whoFor?.items ?? []).forEach((item, i) => {
    if (item?.stat !== undefined) {
      if (!isNumber(item.stat?.value)) problems.push(`whoFor.items.${i}.stat.value (a number, as the source states it)`);
      if (!has(item.stat?.caption)) problems.push(`whoFor.items.${i}.stat.caption (what was counted)`);
    }
    if (item?.back !== undefined && typeof item.back !== 'string') problems.push(`whoFor.items.${i}.back must be text`);
    problems.push(...iconProblem(`whoFor.items.${i}.icon`, item?.icon));
  });
  const h = packet.whoFor?.highlight;
  if (h) {
    if (!isNumber(h.value)) problems.push('whoFor.highlight.value (the study’s own number)');
    if (!has(h.unit)) problems.push('whoFor.highlight.unit (e.g. "adults in Japan")');
    if (!has(h.text)) problems.push('whoFor.highlight.text (the finding, with its footnote marker)');
    if (h.days !== undefined && !(Number.isInteger(h.days) && h.days >= 1 && h.days <= 7))
      problems.push('whoFor.highlight.days (1 to 7)');
    if (has(h.text) && !/[¹²³⁴⁵⁶⁷⁸⁹]/.test(h.text))
      problems.push('whoFor.highlight.text needs its footnote marker (¹ ² ³ …)');
    problems.push(...iconProblem('whoFor.highlight.icon', h.icon));
  }
  // Every footnote marker used in the section has its source in the note.
  const w = packet.whoFor ?? {};
  const whoText = [
    w.intro,
    w.outro,
    w.highlight?.text,
    w.highlight?.note,
    ...(w.items ?? []).flatMap((item) => [item?.text, item?.back, item?.stat?.caption]),
  ]
    .filter(has)
    .join(' ');
  const markers = [...new Set(whoText.match(/[¹²³⁴⁵⁶⁷⁸⁹]/g) ?? [])];
  for (const marker of markers)
    if (!(packet.whoFor?.note ?? '').includes(marker))
      problems.push(`whoFor.note has no source for footnote ${marker}`);
  // Did you know? Every card carries its source.
  const d = packet.didYouKnow;
  if (d && ((d.items ?? []).length || has(d.heading))) {
    const cards = rowProblems('didYouKnow.items', d.items, ['id', 'hook', 'fact', 'source'], {min: 4, max: 6});
    problems.push(...cards.problems);
    if (!cards.complete.length) problems.push('didYouKnow.items (4 to 6 cards, each with id, hook, fact and source)');
    if (!has(d.heading)) problems.push('didYouKnow.heading');
    (d.items ?? []).forEach((item, i) => {
      if (!has(item?.source)) problems.push(`didYouKnow.items.${i}.source (every fact names its source)`);
      else if (!SOURCE_LINE.test(item.source))
        problems.push(`didYouKnow.items.${i}.source "${item.source}" must name the paper or page with its year (or link)`);
      for (const key of ['hook', 'fact'])
        if (has(item?.[key]) && SECOND_PERSON_CONDITION.test(item[key]))
          problems.push(`didYouKnow.items.${i}.${key} speaks to the reader's condition`);
    });
    if (d.note !== undefined && typeof d.note !== 'string') problems.push('didYouKnow.note must be text');
  }
  // Line icons.
  (packet.problem?.icons ?? []).forEach((key, i) => problems.push(...iconProblem(`problem.icons.${i}`, key)));
  if ((packet.problem?.icons ?? []).length > (packet.problem?.situations ?? []).length)
    problems.push('problem.icons (one per situation, no more)');
  (packet.features?.items ?? []).forEach((item, i) => problems.push(...iconProblem(`features.items.${i}.icon`, item?.icon)));
  (packet.howToUse?.steps ?? []).forEach((item, i) => problems.push(...iconProblem(`howToUse.steps.${i}.icon`, item?.icon)));
  (packet.fitCheck?.steps ?? []).forEach((item, i) => problems.push(...iconProblem(`fitCheck.steps.${i}.icon`, item?.icon)));
  // The offer stack: a real bonus, add-ons and sets by Shopify handle.
  const bonus = packet.offer?.bonus;
  if (bonus !== undefined && !has(bonus?.label)) problems.push('offer.bonus.label (e.g. "Free with every order: …")');
  if (has(bonus?.label) && /\$\s?\d|\bvalue\b|\bworth\b/i.test(bonus.label))
    problems.push('offer.bonus.label must not give the bonus a dollar value');
  // The bonus file: a local PDF under /guides/ that exists, linked from the
  // thank-you only, so no other packet line (the product page) may link it.
  const download = bonus?.download;
  if (download !== undefined) {
    if (!has(download?.href) || !/^\/guides\/[a-z0-9-]+\.pdf$/.test(download.href))
      problems.push('offer.bonus.download.href (a PDF under /guides/, e.g. "/guides/the-guide.pdf")');
    else if (!fs.existsSync(path.join('public', download.href)))
      problems.push(`offer.bonus.download.href: ${download.href} is not in public/`);
    if (!has(download?.label)) problems.push('offer.bonus.download.label (the link text on the thank-you)');
    if (has(download?.href)) {
      const elsewhere = JSON.stringify({...packet, offer: {...packet.offer, bonus: {...bonus, download: null}}}).includes(download.href);
      if (elsewhere) problems.push(`offer.bonus.download.href: ${download.href} is linked elsewhere in the packet; the guide is linked from the thank-you only`);
    }
  }
  const handles = new Set();
  (packet.offer?.addOns ?? []).forEach((item, i) => {
    if (!has(item?.handle) || !SHOPIFY_HANDLE.test(item.handle)) problems.push(`offer.addOns.${i}.handle (a Shopify product handle)`);
    if (!has(item?.text)) problems.push(`offer.addOns.${i}.text (one line on what it is)`);
    problems.push(...iconProblem(`offer.addOns.${i}.icon`, item?.icon));
    if (has(item?.handle)) handles.add(item.handle);
  });
  const b = packet.bundle ?? {};
  const card = (at, value, needsHandle) => {
    if (!value) return;
    if (needsHandle && (!has(value.handle) || !SHOPIFY_HANDLE.test(value.handle))) problems.push(`${at}.handle (a Shopify product handle)`);
    if (!has(value.label)) problems.push(`${at}.label`);
    if (!(value.items ?? []).some(has)) problems.push(`${at}.items (what is inside, piece by piece)`);
    if (has(value.image) !== has(value.alt)) problems.push(`${at}.image and alt`);
    problems.push(...iconProblem(`${at}.icon`, value.icon));
    for (const line of [value.label, value.caption, value.badge, ...(value.items ?? [])])
      if (has(line) && /\bvalue\b|\bsave \$|\$\d+ (?:value|off)/i.test(line))
        problems.push(`${at}: "${line}" claims a value or a saving; show the price we charge`);
    if (needsHandle && has(value.handle)) handles.add(value.handle);
  };
  card('bundle.base', b.base, false);
  (b.sets ?? []).forEach((set, i) => card(`bundle.sets.${i}`, set, true));
  for (const handle of handles)
    if ((packet.productHandles ?? []).includes(handle)) problems.push(`${handle} must be a different product from the page's own`);
  // On the sample catalog the bag sells them from the catalog's extras.
  if (packet.catalog && handles.size) {
    const extras = new Set((packet.catalog.extras ?? []).map((extra) => extra?.handle));
    for (const handle of handles)
      if (!extras.has(handle)) problems.push(`catalog.extras has no product "${handle}" (the preview bag could not sell it)`);
  }
  return problems;
}

/** About three lines on a phone (store/PAGE-BLUEPRINT.md rule 10). */
export const PARAGRAPH_LIMIT = 220;
/** Section body lines the blueprint holds to three phone lines (quotes and FAQ answers are exempt). */
function bodyLines(packet) {
  const lines = [];
  const add = (at, value) => {
    if (has(value)) lines.push([at, value]);
  };
  (packet.problem?.situations ?? []).forEach((line, i) => add(`problem.situations.${i}`, line));
  add('problem.turn', packet.problem?.turn);
  for (const key of ['intro', 'outro']) add(`whoFor.${key}`, packet.whoFor?.[key]);
  (packet.whoFor?.items ?? []).forEach((item, i) => {
    add(`whoFor.items.${i}.text`, item?.text);
    add(`whoFor.items.${i}.back`, item?.back);
  });
  add('whoFor.highlight.text', packet.whoFor?.highlight?.text);
  (packet.didYouKnow?.items ?? []).forEach((item, i) => {
    add(`didYouKnow.items.${i}.hook`, item?.hook);
    add(`didYouKnow.items.${i}.fact`, item?.fact);
  });
  (packet.features?.items ?? []).forEach((item, i) => add(`features.items.${i}.text`, item?.text));
  (packet.howToUse?.steps ?? []).forEach((item, i) => add(`howToUse.steps.${i}.text`, item?.text));
  add('fitCheck.intro', packet.fitCheck?.intro);
  (packet.fitCheck?.steps ?? []).forEach((item, i) => add(`fitCheck.steps.${i}.text`, item?.text));
  add('fitCheck.note', packet.fitCheck?.note);
  (packet.inTheBox?.items ?? []).forEach((item, i) => add(`inTheBox.items.${i}.text`, item?.text));
  add('bundle.text', packet.bundle?.text);
  (packet.offer?.addOns ?? []).forEach((item, i) => add(`offer.addOns.${i}.text`, item?.text));
  add('guarantee.text', packet.guarantee?.text);
  (packet.promise?.items ?? []).forEach((item, i) => add(`promise.items.${i}.text`, item?.text));
  return lines;
}

const count = (rows, test = () => true) => (Array.isArray(rows) ? rows.filter(test).length : 0);
const between = (n, min, max) => n >= min && n <= max;

/**
 * The blueprint as hard rules (store/PAGE-BLUEPRINT.md, October 3): every
 * section's must-haves, a visual in every section and no text wall. Applies
 * to real products (not the labelled sample demo). Each line names the gap.
 */
export function blueprintProblems(packet) {
  if (packet.status === 'sample') return [];
  const gaps = [];
  const need = (ok, text) => {
    if (!ok) gaps.push(`blueprint: ${text}`);
  };
  const gallery = packet.purchase?.gallery ?? [];
  need(between(count(gallery, (image) => has(image?.src)), 4, 8), `hero gallery holds 4 to 8 selling images (has ${count(gallery, (image) => has(image?.src))})`);
  need(count(packet.hero?.benefits, (item) => has(item?.text)) === 4, 'hero has 4 benefit chips');
  need(has(packet.hero?.shipping), 'hero.shipping (free shipping and the delivery line)');
  need((packet.hero?.trustRow ?? []).some((item) => item?.icon === 'return'), 'hero trust line carries the returns promise');
  if (packet.offer?.bonus !== undefined)
    need(has(packet.offer?.bonus?.label), 'offer.bonus (the hero badge: "Free with every order: …")');
  const situations = count(packet.problem?.situations, has);
  need(between(situations, 3, 4), 'problem: 3 to 4 moments');
  need(count(packet.problem?.icons, (key) => STAT_ICON_KEYS.includes(key)) >= situations && situations > 0, 'problem.icons: an icon for every moment');
  const hasActiveSection = (id) => !Array.isArray(packet.sections) || packet.sections.includes(id);
  const who = packet.whoFor?.items ?? [];
  const isLifestyleWho = between(who.length, 3, 4) && who.every((item) => has(item?.label) && has(item?.text) && item?.stat === undefined);
  if (hasActiveSection('whoFor') && !isLifestyleWho) {
    need(between(who.length, 3, 4) && who.every((item) => isNumber(item?.stat?.value) && has(item?.stat?.caption)), 'whoFor: 3 to 4 stat cards, each with its number and caption');
    need(Boolean(packet.whoFor?.highlight && isNumber(packet.whoFor.highlight.value) && has(packet.whoFor.highlight.text)), 'whoFor.highlight: one stat band');
    need(has(packet.whoFor?.note), 'whoFor.note: the sources, folded under a toggle');
    need(has(packet.whoFor?.outro), 'whoFor.outro: a short bold closing line');
    need(has(packet.whoFor?.image) || who.some((item) => isNumber(item?.stat?.value)), 'whoFor: a picture or stats');
  }
  const facts = packet.didYouKnow?.items ?? [];
  if (packet.didYouKnow?.kind !== 'omit')
    need(between(facts.length, 4, 6) && facts.every((item) => has(item?.hook) && has(item?.fact) && has(item?.source)), 'didYouKnow: 4 to 6 flip cards, each with its source');
  const features = packet.features?.items ?? [];
  const gallerySrcs = new Set((packet.purchase?.gallery ?? []).map((img) => img?.src).filter(Boolean));
  need(between(features.length, 3, 4) && features.every((item) => STAT_ICON_KEYS.includes(item?.icon) || has(item?.image)), 'features ("Why This Is For You"): 3 to 4 situational cards, each with a clean situational image or valid icon');
  need(features.every((item) => !has(item?.image) || (!gallerySrcs.has(item.image) && !/\/ads\/|\/hero-\d/i.test(item.image))), 'features.items ("Why This Is For You") must use dedicated clean situational photos (e.g. why-1..3.webp), never hero gallery slides or static ad images');
  if (has(packet.features?.heading))
    need(packet.features.heading.trim().split(/\s+/).length <= 7, `features.heading ("${packet.features.heading}") is too long — keep section headers to 3–6 words (e.g. "Why This Is For You")`);
  const steps = packet.howToUse?.steps ?? [];
  need(between(steps.length, 2, 4) && (has(packet.howToUse?.image) || steps.every((step) => has(step?.image) || STAT_ICON_KEYS.includes(step?.icon))), 'howToUse: numbered steps, each with a picture or an icon');
  need(count(packet.fitCheck?.steps, (step) => has(step?.title) && has(step?.text)) >= 2, 'fitCheck: the "will it work for me?" check');
  need(between(count(packet.pullQuotes?.items, (item) => has(item?.text)), 4, 6) && QUOTES_DISCLOSURE.test(packet.pullQuotes?.subheading ?? packet.pullQuotes?.attribution ?? ''), 'pullQuotes: 4 to 6 quotes under the "…like ours" disclosure');
  need(count(packet.comparison?.rows, (row) => has(row?.ours) && has(row?.theirs)) >= 3, 'comparison: at least 3 true rows');
  need(has(packet.inTheBox?.image) && count(packet.inTheBox?.items, (item) => has(item?.name)) > 0, 'inTheBox: a picture and the list');
  if (has(packet.offer?.bonus?.label))
    need((packet.inTheBox?.items ?? []).some((item) => packet.offer.bonus.label.toLowerCase().includes(String(item?.name ?? '').toLowerCase().replace(/^the /, ''))), 'inTheBox lists the free bonus as an item');
  if (hasActiveSection('bundle')) {
    need(count(packet.bundle?.sets, (set) => has(set?.handle)) >= 1, 'bundle.sets: at least one bundle ("Make it a set")');
    need(between(count(packet.offer?.addOns, (item) => has(item?.handle)), 2, 3), 'offer.addOns: 2 to 3 one-tap add-ons');
  }
  need(Number.isInteger(packet.guarantee?.days) && packet.guarantee.days > 0, 'guarantee: the returns promise');
  need(between(count(packet.faq?.items, (item) => has(item?.answer)), 6, 10), `faq: 6 to 10 questions (has ${count(packet.faq?.items, (item) => has(item?.answer))})`);
  need(count(packet.promise?.items, (item) => HERO_ICON_KEYS.includes(item?.icon)) >= 2, 'promise: the closing promise with icons');
  for (const [at, line] of bodyLines(packet))
    if (line.length > PARAGRAPH_LIMIT)
      gaps.push(`blueprint: ${at} runs ${line.length} characters (about 3 phone lines is ${PARAGRAPH_LIMIT}); split or shorten it`);
  return gaps;
}

/**
 * The 10/10 check (store/PAGE-BLUEPRINT.md section 3), scored from the packet
 * and, for what only the rendered page can show, a QA record from the
 * build's browser pass: {heroFirstScreen, motion, links, checks, evidence}.
 * A line without its QA record scores 0 and says so.
 */
export function blueprintScore(packet, qa = null) {
  const problems = [...missingContentCore(packet)];
  const gaps = blueprintProblems(packet);
  const gap = (pattern) => gaps.filter((line) => pattern.test(line));
  const from = (pattern) => problems.filter((line) => pattern.test(line));
  const qaLine = (key) => (qa && typeof qa[key] === 'boolean' ? qa[key] : null);
  const lines = [];
  const line = (n, title, ok, why) => lines.push({n, title, ok: Boolean(ok), why});
  const heroGaps = gap(/hero|offer\.bonus/);
  const heroQa = qaLine('heroFirstScreen');
  line(1, 'Hero has everything to buy on the first phone screen', !heroGaps.length && heroQa === true, heroGaps.length ? heroGaps.join('; ') : heroQa === null ? 'needs the QA record (first phone screen)' : heroQa ? 'packet complete; QA: Add to bag on the first screen' : 'QA: something to buy is below the first screen');
  const problemGaps = gap(/problem/);
  line(2, 'Problem in buyers’ own words', !problemGaps.length && has(packet.buyer?.evidence), problemGaps.join('; ') || (has(packet.buyer?.evidence) ? `moments from the buyer research (${packet.buyer.evidence.slice(0, 80)}…)` : 'buyer.evidence names no research'));
  const whyGaps = [...gap(/whoFor/), ...from(/^whoFor/)];
  line(3, 'Why it matters: animated stats, a stat band, folded sources', !whyGaps.length, whyGaps.join('; ') || 'stat cards, band and sources present');
  const dykGaps = [...gap(/didYouKnow/), ...from(/^didYouKnow/)];
  line(4, '"Did you know?" has 4 to 6 sourced flip cards', !dykGaps.length, dykGaps.join('; ') || `${count(packet.didYouKnow?.items)} sourced cards`);
  const visualGaps = gap(/picture|icon|runs \d+ characters|stat cards|text wall/);
  // Bundles and add-ons show a placeholder block until their own picture lands.
  const offered = new Set([
    ...(packet.bundle?.sets ?? []).map((set) => set?.handle),
    ...(packet.offer?.addOns ?? []).map((item) => item?.handle),
  ]);
  const pending = (packet.catalog?.extras ?? [])
    .filter((extra) => offered.has(extra?.handle) && !(extra.variants ?? []).some((variant) => has(variant?.image)))
    .filter((extra) => !(packet.bundle?.sets ?? []).some((set) => set?.handle === extra.handle && has(set?.image)))
    .map((extra) => extra.handle);
  if (pending.length) visualGaps.push(`pictures still placeholders: ${pending.join(', ')} (the image maker's next job)`);
  line(5, 'Every section has a visual; no text wall over 3 lines', !visualGaps.length, visualGaps.join('; ') || 'every section has a picture, icons, stats or cards; no line over 220 characters');
  const motion = qaLine('motion');
  line(6, 'Quotes slide, cards animate, reduced motion respected', motion === true, motion === null ? 'needs the QA record (motion)' : motion ? 'QA: quotes advance, count-ups run, reduced motion holds still' : 'QA: motion failed');
  const offerGaps = gap(/bundle|addOns|offer\.bonus|bonus as an item/);
  line(7, 'Offer stack: bonus, add-ons, bundles', !offerGaps.length, offerGaps.join('; ') || 'bonus, add-ons and a bundle in place');
  const claimProblems = from(/treatment|condition|proof we do not hold|claims a value|rating|Merrivy's own|footnote|source/);
  line(8, 'Every claim backed; compliance clean', !claimProblems.length, claimProblems.join('; ') || 'no condition, health-result or fake-proof wording; every footnote and fact has its source');
  const links = qaLine('links');
  line(9, 'Every link live; no demo or template content', links === true && packet.status !== 'sample', links === null ? 'needs the QA record (link crawl)' : links ? 'QA: crawl found only live pages' : 'QA: dead link or demo content');
  const checks = qaLine('checks');
  line(10, 'Typecheck, lint, build, packet check, suites, QA 390 and 1440 pass', checks === true && !problems.length && !gaps.length, checks === null ? 'needs the QA record (checks)' : !checks ? 'QA: a check failed' : problems.length || gaps.length ? 'the packet check itself still reports problems' : 'all checks pass');
  return {score: lines.filter((item) => item.ok).length, lines, evidence: qa?.evidence ?? ''};
}

/** A quotes heading may never present other sellers' reviews as ours. */
const OUR_REVIEWS = /love us|our (?:customers?|reviews?|buyers?)|customer reviews?|verified/i;
/** The only fields a pull quote may carry. */
export const QUOTE_KEYS = ['id', 'text', 'review'];
/** The subheading says these are about pillows like ours, or other sellers' reviews. */
export const QUOTES_DISCLOSURE =
  /\b(?:like ours|same (?:style|type|kind) as ours|other sellers?|other brands?|other pillows|similar pillows|pillows like)\b/i;
/** The foot note says where the quotes come from. */
export const QUOTES_SOURCE = /\b(?:amazon|other sellers?|marketplace|another seller)\b/i;
/** A rating, star or review count never sits in the quotes' own words. */
export const RATING_WORDS = /\b\d(?:\.\d)?\s*(?:stars?|\/\s*5|out of 5)\b|★|\brated\b|\b\d[\d,]*\+?\s+reviews\b/i;
/**
 * A treatment, condition or sleep-result claim about the product (Meta
 * personal attributes; no health claims). A general, sourced fact about warm
 * baths is written as "linked to", never as what the pillow does.
 */
export const HEALTH_CLAIMS =
  /\b(?:cures?|cured|heals?|healing|treats?|treated|treatment|relieves?|insomnia|anxiety|depress\w*|stress disorder|clinically proven|(?:helps?|help) (?:you |me )?(?:to )?(?:sleep|fall asleep)|improves? (?:your |the )?sleep|(?:better|deeper) sleep|sleep better)\b/i;
/** Health wording kept out of quotes (Meta personal attributes; no claims). */
export const CONDITION_WORDS =
  /\b(?:pain\w*|surger\w*|surgical|pregnan\w*|injur\w*|spasms?|arthritis|sciatica|neuropathy|recover\w*|therap\w*|back issues)\b/i;
/** Tokens the store fills when the page loads; any other {token} is a gap. */
export const STORE_TOKENS = [
  '{freeShipping}',
  '{shippingFee}',
  '{percentOff}',
  '{saleLabel}',
  '{support}',
  '{variant}',
];
/** Merrivy never sells children's products or shows children (AGENTS.md). */
export const CHILD_WORDS = /\b(?:baby|babies|kids?|child|children|infants?|toddlers?|newborns?)\b/i;

/**
 * The packet's own product description (October 3), which the sample catalog
 * sells from and the owner creates in Shopify. Optional; when present it must
 * be complete and agree with the page: its handle is the page's, packs that
 * name a variant name a real option value, and a compare-at price is above
 * the price (a real reference price, never a decoration).
 */
export function catalogProblems(packet) {
  const c = packet.catalog;
  if (!c) return [];
  const problems = [];
  for (const key of ['handle', 'title', 'vendor', 'currency'])
    if (!has(c[key])) problems.push(`catalog.${key}`);
  if (has(c.handle) && packet.productUrl !== `/products/${c.handle}`)
    problems.push('catalog.handle must match productUrl');
  if (has(c.handle) && !(packet.productHandles ?? []).includes(c.handle))
    problems.push('catalog.handle must be one of productHandles');
  if (has(c.currency) && packet.offer?.currency && c.currency !== packet.offer.currency)
    problems.push('catalog.currency must match offer.currency');
  const options = Array.isArray(c.options) ? c.options : [];
  const variants = Array.isArray(c.variants) ? c.variants : [];
  if (!variants.length) problems.push('catalog.variants (at least one)');
  const skus = new Set();
  variants.forEach((v, i) => {
    if (!has(v?.sku)) problems.push(`catalog.variants.${i}.sku`);
    else if (skus.has(v.sku)) problems.push(`catalog.variants.${i}.sku is a duplicate`);
    else skus.add(v.sku);
    if (!(Number.isFinite(v?.price) && v.price > 0)) problems.push(`catalog.variants.${i}.price`);
    if (v?.compareAtPrice != null && !(v.compareAtPrice > v.price))
      problems.push(`catalog.variants.${i}.compareAtPrice must be above the price, or null`);
    if (!has(v?.image) || !has(v?.imageAlt)) problems.push(`catalog.variants.${i}.image and imageAlt`);
    for (const option of options)
      if (!option.values?.includes(v?.options?.[option.name]))
        problems.push(`catalog.variants.${i}.options.${option.name} must be one of ${option.values?.join(', ')}`);
  });
  const values = options.flatMap((option) => option.values ?? []);
  for (const [i, choice] of (packet.purchase?.offerChoices ?? []).entries())
    if (has(choice?.variant) && !values.includes(choice.variant))
      problems.push(`purchase.offerChoices.${i}.variant "${choice.variant}" is not a catalog option value`);
  return problems;
}

/** Every local picture or video path ("/images/...") named in a content file. */
export function pictureSources(value) {
  const found = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object')
      for (const [key, item] of Object.entries(node)) {
        if (
          ['src', 'image', 'poster'].includes(key) &&
          typeof item === 'string' &&
          item.startsWith('/') &&
          !item.startsWith('//')
        )
          found.add(item.split(/[?#]/)[0]);
        else walk(item);
      }
  };
  walk(value);
  return [...found];
}

/** Merrivy's own pictures in app/content/site.json, on pages not about one product. */
export const SITE_PICTURES = [
  'aboutHero',
  'journal',
  'errorPage',
  'setupScreen',
];

/**
 * Site pictures need a src and alt text. A real (non-sample) packet must not
 * leave the demo product's pictures on Merrivy's own pages.
 */
export function missingSiteContent(
  site,
  {status = 'sample', demoSources = []} = {},
) {
  const missing = [];
  for (const key of SITE_PICTURES) {
    const image = site?.[key]?.image;
    for (const field of ['src', 'alt'])
      if (typeof image?.[field] !== 'string' || !image[field].trim())
        missing.push(`site.json ${key}.image.${field}`);
    if (status !== 'sample' && image?.src && demoSources.includes(image.src))
      missing.push(
        `site.json ${key}.image still shows the demo product (${image.src})`,
      );
  }
  return missing;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, arg] = process.argv.slice(2);
  if (mode === 'new') {
    if (!arg || !/^[a-z][a-z0-9-]{1,63}$/.test(arg))
      throw new Error('Use a lowercase product slug, e.g. family-activity-kit');
    const isLive = process.argv.includes('--live');
    const isBlank = process.argv.includes('--blank');
    const paletteIdx = process.argv.indexOf('--palette');
    const paletteId = paletteIdx > -1 ? process.argv[paletteIdx + 1] : '';
    let chosenPalette = null;
    if (paletteId) {
      const library = JSON.parse(
        fs.readFileSync('app/content/palettes.json', 'utf8'),
      );
      chosenPalette = (library.palettes ?? []).find((p) => p.id === paletteId);
      if (!chosenPalette) {
        throw new Error(
          `Unknown palette "${paletteId}". Choose one of: ${(library.palettes ?? []).map((p) => p.id).join(', ')}`,
        );
      }
    }
    const root = path.resolve(isLive ? 'app/content' : 'app/content/drafts');
    fs.mkdirSync(root, {recursive: true});
    const target = path.join(root, arg + '.json');
    const baseSource = fs.existsSync('app/content/base-theme.json')
      ? 'app/content/base-theme.json'
      : 'app/content/portable-water-purifier-pump.json';
    const reference = JSON.parse(fs.readFileSync(baseSource, 'utf8'));
    const nextPacket = isBlank
      ? blankPacket(reference, arg)
      : cloneBaseTheme(reference, arg, {palette: chosenPalette});
    fs.writeFileSync(target, JSON.stringify(nextPacket, null, 2) + '\n', {
      flag: 'wx',
    });
    console.warn(
      `Created ${isBlank ? 'blank draft' : '10/10 base-theme clone'}${chosenPalette ? ` with palette "${chosenPalette.name}" (${chosenPalette.id})` : ''}: ` +
        target +
        '\nPopulate product copy/media, run `node scripts/packet-tools.mjs check`, and preview in Store & Theme Hub (#/store).',
    );
  } else if (mode === 'check' && arg) {
    const packet = JSON.parse(fs.readFileSync(arg, 'utf8'));
    const missing = missingContent(packet);
    const absent = (src) => {
      try {
        return !fs.existsSync(path.join('public', decodeURIComponent(src)));
      } catch {
        return true;
      }
    };
    for (const src of pictureSources(packet).filter(absent))
      missing.push('picture file not in public/: ' + src);
    // Merrivy's own pages read site.json, so every packet check covers it too.
    const sitePath = 'app/content/site.json';
    if (!fs.existsSync(sitePath)) missing.push(sitePath);
    else {
      const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
      const demo = fs.existsSync('app/content/hoodie.json')
        ? JSON.parse(fs.readFileSync('app/content/hoodie.json', 'utf8'))
        : {};
      missing.push(
        ...missingSiteContent(site, {
          status: packet.status,
          demoSources: pictureSources(demo),
        }),
      );
      for (const src of pictureSources(site).filter(absent))
        missing.push('site.json picture file not in public/: ' + src);
    }
    console.warn(
      missing.length
        ? 'Missing content:\n- ' + missing.join('\n- ')
        : 'Content presence checks passed. Sources, rights, claims, commerce and visual acceptance still require review.',
    );
    // The 10/10 check (store/PAGE-BLUEPRINT.md section 3). Lines only the
    // rendered page can show read the build's QA record: --qa <results.json>.
    const qaAt = process.argv.indexOf('--qa');
    let qa = null;
    if (qaAt > -1 && process.argv[qaAt + 1]) {
      try {
        qa = JSON.parse(fs.readFileSync(process.argv[qaAt + 1], 'utf8'));
      } catch (error) {
        console.warn(`QA record not read (${process.argv[qaAt + 1]}): ${error.message}`);
      }
    }
    if (packet.status !== 'sample') {
      const {score, lines} = blueprintScore(packet, qa);
      console.warn(
        `\n10/10 check (store/PAGE-BLUEPRINT.md): ${score}/10${qa ? '' : ' (lines 1, 6, 9 and 10 need --qa <the build QA record>)'}\n` +
          lines.map((item) => `  ${item.ok ? 'yes' : 'NO '} ${item.n}. ${item.title}: ${item.why}`).join('\n'),
      );
    }
    process.exitCode = missing.length ? 1 : 0;
  } else
    throw new Error('Usage: packet-tools.mjs new <slug> | check <packet.json>');
}
