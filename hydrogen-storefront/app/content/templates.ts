import packet from './base-theme.json';
import type {PacketCatalog} from '~/lib/preview-catalog';

/** The active packet's file, named on /templates. Change it with the import. */
export const packetFile = 'app/content/base-theme.json';

/**
 * Every packet has the reference packet's shape (the universal Grimoire template,
 * base-theme.json), so binding another packet never changes the page types.
 */
type PacketShape = typeof import('./base-theme.json');

/** Product content is separate from layout and from Shopify price/inventory. */

/** Every store picture keeps its alt text beside it; caption is shown text. */
export type PacketImage = {src: string; alt: string; caption?: string};
export type ReviewMedia = {
  kind: 'image' | 'video';
  src: string;
  alt: string;
  poster?: string;
  captions?: string;
};
export type ProductReview = {
  id: string;
  productHandle: string;
  title: string;
  text: string;
  author: string;
  detail: string;
  date: string;
  rating: number | null;
  source: string;
  permission: boolean;
  verifiedPurchaseEvidence: string;
  fictional?: boolean;
  media: ReviewMedia[];
};
export type ProductDemo = {
  id: string;
  productHandle: string;
  title: string;
  description: string;
  source: string;
  permission: boolean;
  src: string;
  poster: string;
  captions: string;
};
/** Icon keys a packet may use for hero benefits and the trust row. */
export const HERO_ICONS = [
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
] as const;
export type HeroIcon = (typeof HERO_ICONS)[number];
/** The first five gallery slots, in order; the image-maker designs each one. */
export const GALLERY_ROLES = [
  'hero',
  'features',
  'in-use',
  'comparison',
  'in-the-box',
] as const;
export type GalleryEntry = {
  src: string;
  alt: string;
  label: string;
  caption: string;
  /** hero, features, in-use, comparison, in-the-box, or extra. */
  role?: string;
  /** Text drawn over a plain photo. Leave empty when the image carries it. */
  overlay?: {headline: string; callouts: string[]};
};
/**
 * One review card. kind "sample" is placeholder text for the demo or a
 * preview and never renders on the real store; "genuine" needs a real buyer,
 * a source, a date and permission (store/HYDROGEN-POPULATION.md).
 */
export type PacketReview = {
  name: string;
  location: string;
  text: string;
  photo: {src: string; alt: string} | null;
  rating: number | null;
  source: string;
  date: string;
  permission: boolean;
  kind: 'sample' | 'genuine' | string;
};
/*
 * Sections below the hero (October 1). Every block is optional: a section
 * renders only when its packet field holds complete entries, so a blank draft
 * shows nothing it has not been given.
 */
/** "Sound familiar?": situations the buyer recognises, then the turn. */
export type ProblemBlock = {
  eyebrow: string;
  headline: string;
  situations: string[];
  turn: string;
  /** One line icon per situation, in the same order (STAT_ICONS keys). */
  icons?: string[];
};
/**
 * Line icons the page draws in as a section scrolls into view (October 3,
 * owner: "there's no visual, nothing"). Packet rows name one by key.
 */
export const STAT_ICONS = [
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
] as const;
export type StatIconKey = (typeof STAT_ICONS)[number];
/**
 * A big number on a card (October 3). `value` is the number exactly as the
 * source states it; `unit` sits beside it ("min", "weeks"); `caption` says
 * what was counted, in the source's words ("study samples of employees").
 */
export type StatFigure = {
  value: number;
  unit?: string;
  caption: string;
};
/** A feature row's picture is optional (October 3): words only is a text card. */
export type FeatureItem = {
  title: string;
  text: string;
  image?: string;
  alt?: string;
  /** A line icon drawn in beside the title (words-only cards). */
  icon?: string;
};
/** A pin on the diagram image; x and y are percentages from the top left. */
export type DiagramLabel = {text: string; x: number; y: number};
export type FeaturesBlock = {
  eyebrow: string;
  heading: string;
  /** The chip in the section nav; defaults to "Features". */
  navLabel?: string;
  items: FeatureItem[];
  /** A small foot note for the section, e.g. the source of a general fact. */
  note?: string;
  diagram?: {
    image: string;
    alt: string;
    caption: string;
    labels: DiagramLabel[];
  };
};
export type HowToUseStep = {
  title: string;
  text: string;
  image: string;
  alt: string;
  /** Optional short muted loop (mp4); the image is its poster. */
  video?: string;
  /** A line icon on a words-only step card. */
  icon?: string;
};
/*
 * Section pictures (October 3): a section may carry one picture for the whole
 * block (`image` + `alt`) instead of, or as well as, one per row. Rows then
 * need only their words; a row's own picture still needs its alt text.
 */
export type HowToUseBlock = {
  eyebrow: string;
  heading: string;
  steps: HowToUseStep[];
  image?: string;
  alt?: string;
};
export type WhoForItem = {
  label: string;
  /** The sourced line, with its footnote marker (¹ ² ³ …). */
  text: string;
  image?: string;
  alt?: string;
  /** The card's big number, drawn as it scrolls in (numbers only as the source states them). */
  stat?: StatFigure;
  icon?: string;
  /** The back of the card, "Why the pillow helps": tap to flip. */
  back?: string;
};
/**
 * One sourced study shown as a highlighted band under the cards (October 3,
 * owner: "the Japan study line is good ... just not as text"). `value` is the
 * study's own count; `days` lights that many day dots out of 7 ("every day").
 */
export type StatBand = {
  value: number;
  /** The words beside the number, e.g. "adults in Japan". */
  unit: string;
  /** Above the number, e.g. "In one study of". */
  lead?: string;
  /** The finding, in the paper's own verb, with its footnote marker. */
  text: string;
  days?: number;
  daysLabel?: string;
  /** The limit, said plainly ("An association, not proof of cause."). */
  note?: string;
  icon?: string;
};
export type WhoForBlock = {
  eyebrow: string;
  heading: string;
  items: WhoForItem[];
  image?: string;
  alt?: string;
  /** The picture has the heading baked in: the page keeps it for screen readers only. */
  pictureHasText?: boolean;
  /** One line under the heading, before the cards (October 3, "why take more baths"). */
  intro?: string;
  /** One line after the cards, before the sources. */
  outro?: string;
  /** Sources for the sourced general lines in the cards; small print under the section. */
  note?: string;
  /** One study as a highlighted stat band after the cards. */
  highlight?: StatBand;
  /** The flip button's words on a card with a back, e.g. "Why the pillow helps". */
  backLabel?: string;
};
/**
 * "Did you know?" (October 3, owner: "we love things that create interest
 * for the user. something they didnt know about"). Tap-to-reveal cards: the
 * hook on the front, the fact and a short source line on the back. Every
 * card needs its source; the section is hidden until 4 complete cards exist.
 */
export type DidYouKnowItem = {id: string; hook: string; fact: string; source: string};
export type DidYouKnowBlock = {
  eyebrow?: string;
  heading: string;
  items: DidYouKnowItem[];
  /** One quiet line under the cards (e.g. "General information, not medical advice."). */
  note?: string;
};
export type InTheBoxBlock = {
  eyebrow: string;
  heading: string;
  items: {qty: string; name: string; text: string}[];
  note: string;
  image?: string;
  alt?: string;
  /** The picture has the heading baked in: the page keeps it for screen readers only. */
  pictureHasText?: boolean;
};
/**
 * Pull quotes from other sellers' reviews of the same item type (October 3,
 * owner's request, FTC 16 CFR Part 465). Shown as editorial quotes, never as
 * Merrivy reviews: no names, stars, ratings, dates, "verified" or counts; a
 * source line under each quote and a note at the foot say where they come
 * from. `id` is the quote id in the research file; `review` its permalink.
 */
export type PullQuote = {id: string; text: string; review: string};
export type PullQuotesBlock = {
  eyebrow: string;
  heading: string;
  /**
   * The section's own disclosure, shown once under the heading (October 3,
   * owner: no source line under each quote), e.g. "What people say about
   * air-mesh bath pillows like ours". Names, stars and badges stay out.
   */
  subheading?: string;
  /** Older packets: a source line under every quote. Leave empty to show none. */
  attribution?: string;
  /** The foot note saying whose reviews these are. */
  note: string;
  /** Where the quotes come from (research file); never shown. */
  evidence: string;
  items: PullQuote[];
};
/**
 * A pack in the hero. `quantity` is how many the pack holds. With `variant`
 * the pack is its own Shopify variant (an option value such as "2 sets", with
 * its own price) and the bag gets one of it; without it the bag gets
 * `quantity` of the chosen variant at the same price each.
 */
export type OfferChoice = {
  quantity: number;
  label: string;
  caption: string;
  variant?: string;
};
/**
 * Delivery and returns terms the Delivery and Returns pages, the checkout
 * preview and the help chat quote for this product. Copied from the owner's
 * policy and the supplier's confirmed route.
 */
export type ServiceTerms = {
  processing: string;
  transit: string;
  /** One line on the shipping rate. */
  shippingRate: string;
  returnCondition: string;
  returnConditionText: string;
  returnShipping: string;
  /** "Prefer a different size?" style block; empty heading hides it. */
  exchange: {heading: string; text: string};
};
/** Risk reversal. Shown only with real days and what it covers. */
export type GuaranteeBlock = {
  days: number;
  heading: string;
  text: string;
  href: string;
  linkLabel: string;
  note: string;
};
export type SpecItem = {label: string; value: string};
export type SpecsBlock = {
  eyebrow: string;
  heading: string;
  items: SpecItem[];
  note?: string;
};
export type BundleBlock = {
  eyebrow: string;
  heading: string;
  text: string;
  /** Must match one of purchase.offerChoices; same price per item. */
  quantity: number;
  image: string;
  alt: string;
  /** A real second product in the catalog, by Shopify handle; '' for none. */
  addOn: {handle: string; text: string};
  /**
   * "Make it a set" (store/PAGE-BLUEPRINT.md section 10, October 3): the base
   * set shown beside each bundle as the step up. `base` describes the page's
   * own product (its first pack); each `sets` entry is a real bundle product
   * by handle. A second bundle is one more entry. No "$X value" anywhere.
   */
  base?: BundleCard;
  sets?: (BundleCard & {handle: string})[];
  /** The heading over the one-tap add-ons (offer.addOns). */
  addOnsHeading?: string;
  /** One honest line under the set, e.g. that parts may arrive separately. */
  note?: string;
};
/** A set card: its name, one line, and what is inside, piece by piece. */
export type BundleCard = {
  label: string;
  caption: string;
  items: string[];
  /** A short badge, e.g. "Step up". */
  badge?: string;
  /** A line icon for the placeholder until the picture lands. */
  icon?: string;
  image?: string;
  alt?: string;
};
type BelowHeroKeys =
  | 'problem'
  | 'features'
  | 'howToUse'
  | 'whoFor'
  | 'guarantee'
  | 'specs'
  | 'bundle'
  | 'inTheBox'
  | 'pullQuotes';
/**
 * Measure-before-you-order guide (October 3): numbered checks a shopper does
 * at home, e.g. a tub check. Hidden unless it has 2 or more complete checks.
 */
export type FitCheckBlock = {
  eyebrow: string;
  heading: string;
  intro: string;
  /** Each check can be ticked off on the page; `icon` is an optional line icon. */
  steps: {title: string; text: string; icon?: string}[];
  note: string;
};
/**
 * A one-tap add-on for "Make it a set" (blueprint section 10): a real second
 * product in the catalog, by Shopify handle, with one line on why it goes
 * with the set. Empty until the offer research names real products.
 */
export type OfferAddOn = {
  handle: string;
  text: string;
  /** A line icon for the placeholder until the add-on's picture lands. */
  icon?: string;
};
/**
 * The free bonus that comes with every set (blueprint: the hero badge, e.g.
 * "Free with every set: the Soak Guide"). Shown only when it is filled, and it
 * must be real: something every order actually includes.
 */
export type OfferBonus = {
  label: string;
  text?: string;
  /**
   * The bonus file, linked only from the order confirmation (the checkout
   * preview's thank-you on the sample catalog; Shopify's confirmation email
   * and Thank-you page at go-live), never from the product page.
   */
  download?: {href: string; label: string};
};
export type CampaignPacket = Omit<
  PacketShape,
  | 'proof'
  | 'demonstrations'
  | 'reviews'
  | 'purchase'
  | 'hero'
  | 'offer'
  | BelowHeroKeys
> & {
  offer: PacketShape['offer'] & {
    addOns?: OfferAddOn[];
    bonus?: OfferBonus;
  };
  hero: PacketShape['hero'] & {
    /** The shipping promise under the pack choice, e.g. "Free shipping · Ships in 1–3 days". */
    shipping?: string;
  };
  fitCheck?: FitCheckBlock;
  sections?: SectionId[];
  proof: Omit<PacketShape['proof'], 'items'> & {items: ProductReview[]};
  demonstrations: Omit<PacketShape['demonstrations'], 'items'> & {
    items: ProductDemo[];
  };
  reviews: Omit<PacketShape['reviews'], 'items'> & {items: PacketReview[]};
  purchase: Omit<PacketShape['purchase'], 'gallery' | 'offerChoices' | 'guidance'> & {
    gallery: GalleryEntry[];
    offerChoices: OfferChoice[];
    guidance: Omit<PacketShape['purchase']['guidance'], 'steps' | 'chart'> & {
      steps: {label: string; text: string}[];
      chart: {size: string; chest: string; length: string; sleeve: string}[];
    };
  };
  product?: {handle?: string; title?: string};
  problem?: ProblemBlock;
  features?: FeaturesBlock;
  howToUse?: HowToUseBlock;
  whoFor?: WhoForBlock;
  guarantee?: GuaranteeBlock;
  specs?: SpecsBlock;
  bundle?: BundleBlock;
  inTheBox: InTheBoxBlock;
  pullQuotes?: PullQuotesBlock;
  didYouKnow?: DidYouKnowBlock;
  /** The product as it will be created in Shopify (lib/preview-catalog.ts). */
  catalog?: PacketCatalog;
  service?: ServiceTerms;
};
const filled = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const allFilled = (row: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => filled(row?.[key]));
/** A row's own picture is optional, but a picture always has its alt text. */
const pictureComplete = (row: {image?: string; alt?: string}) =>
  filled(row?.image) === filled(row?.alt);
/** The section-wide picture, when it has both a file and alt text. */
export function sectionPicture(block?: {image?: string; alt?: string}) {
  return block && filled(block.image) && filled(block.alt)
    ? {src: block.image, alt: block.alt}
    : null;
}
/** The problem section, or null when it has no headline or situations. */
export function problemContent(value: CampaignPacket) {
  const c = value.problem;
  const situations = (c?.situations ?? []).filter(filled);
  return c && filled(c.headline) && situations.length ? {...c, situations} : null;
}
export function featureItems(value: CampaignPacket) {
  return (value.features?.items ?? []).filter(
    (item) => allFilled(item, ['title', 'text']) && pictureComplete(item),
  );
}
export function diagramContent(value: CampaignPacket) {
  const d = value.features?.diagram;
  const labels = (d?.labels ?? []).filter(
    (label) =>
      filled(label.text) &&
      Number.isFinite(label.x) &&
      Number.isFinite(label.y) &&
      label.x >= 0 &&
      label.x <= 100 &&
      label.y >= 0 &&
      label.y <= 100,
  );
  return d && filled(d.image) && filled(d.alt) && labels.length
    ? {...d, labels}
    : null;
}
export function howToUseSteps(value: CampaignPacket) {
  return (value.howToUse?.steps ?? []).filter(
    (step) => allFilled(step, ['title', 'text']) && pictureComplete(step),
  );
}
export function fitCheckContent(value: CampaignPacket) {
  const c = value.fitCheck;
  const steps = (c?.steps ?? []).filter((step) =>
    allFilled(step, ['title', 'text']),
  );
  return c && filled(c.heading) && steps.length >= 2 ? {...c, steps} : null;
}
export function whoForItems(value: CampaignPacket) {
  return (value.whoFor?.items ?? []).filter(
    (item) => allFilled(item, ['label', 'text']) && pictureComplete(item),
  );
}
/** A known icon key, or null (an unknown key draws nothing). */
export function statIcon(key?: string): StatIconKey | null {
  return key && (STAT_ICONS as readonly string[]).includes(key)
    ? (key as StatIconKey)
    : null;
}
/** A card's big number, only when it is a real number with its caption. */
export function statFigure(stat?: StatFigure | null) {
  return stat &&
    typeof stat.value === 'number' &&
    Number.isFinite(stat.value) &&
    stat.value >= 0 &&
    filled(stat.caption)
    ? stat
    : null;
}
/** The highlighted study band under the cards, or null when incomplete. */
export function whoForHighlight(value: CampaignPacket) {
  const h = value.whoFor?.highlight;
  if (
    !h ||
    typeof h.value !== 'number' ||
    !Number.isFinite(h.value) ||
    h.value < 0 ||
    !filled(h.unit) ||
    !filled(h.text)
  )
    return null;
  const days =
    Number.isInteger(h.days) && Number(h.days) >= 1 && Number(h.days) <= 7
      ? Number(h.days)
      : 0;
  return {...h, days};
}
/** The hero's bonus badge, or null until a real bonus is named. */
export function offerBonus(value: CampaignPacket) {
  const b = value.offer?.bonus;
  return b && filled(b.label) ? b : null;
}
/** Complete one-tap add-ons (a product handle and its line). */
export function offerAddOns(value: CampaignPacket) {
  return (value.offer?.addOns ?? []).filter((item) =>
    allFilled(item, ['handle', 'text']),
  );
}
/** Between 4 and 6 "Did you know?" cards, each with its source. */
export const DID_YOU_KNOW_MIN = 4;
export const DID_YOU_KNOW_MAX = 6;
/** The "Did you know?" section, or null until it has 4 sourced cards. */
export function didYouKnowContent(value: CampaignPacket) {
  const c = value.didYouKnow;
  if (!c || !filled(c.heading)) return null;
  const items = (c.items ?? []).filter((item) =>
    allFilled(item, ['id', 'hook', 'fact', 'source']),
  );
  return items.length >= DID_YOU_KNOW_MIN
    ? {...c, items: items.slice(0, DID_YOU_KNOW_MAX)}
    : null;
}
/** Between 4 and 6 quotes, each traceable to its review. */
export const PULL_QUOTES_MIN = 4;
export const PULL_QUOTES_MAX = 6;
/**
 * The quotes section, or null. It shows only with its heading, a disclosure
 * (the subheading under the heading, or a source line under every quote) and
 * the foot note, so a quote never appears without saying whose review it is.
 */
export function pullQuotesContent(value: CampaignPacket) {
  const c = value.pullQuotes;
  if (
    !c ||
    !filled(c.heading) ||
    !(filled(c.subheading) || filled(c.attribution)) ||
    // The disclosure is the subtitle ("pillows like ours"): never shown as Merrivy orders.
    !(filled(c.note) || /\b(?:like ours|same (?:style|type|kind) as ours|other sellers?|similar pillows|pillows like)\b/i.test(c.subheading ?? ''))
  )
    return null;
  const items = (c.items ?? []).filter((item) =>
    allFilled(item, ['id', 'text', 'review']),
  );
  return items.length >= PULL_QUOTES_MIN
    ? {...c, items: items.slice(0, PULL_QUOTES_MAX)}
    : null;
}
/** Risk reversal needs whole days and what is covered; otherwise hidden. */
export function guaranteeContent(value: CampaignPacket) {
  const g = value.guarantee;
  return g &&
    Number.isInteger(g.days) &&
    g.days > 0 &&
    filled(g.heading) &&
    filled(g.text)
    ? g
    : null;
}
export function specItems(value: CampaignPacket) {
  return (value.specs?.items ?? []).filter((item) =>
    allFilled(item, ['label', 'value']),
  );
}
/**
 * The pack offer repeated near the end of the page. It reuses a hero offer
 * choice, so the price per item and the bag price stay the same.
 */
export function bundleContent(value: CampaignPacket) {
  const b = value.bundle;
  if (!b || !filled(b.heading)) return null;
  const choice = (value.purchase.offerChoices ?? []).find(
    (option) => option.quantity === b.quantity && option.quantity > 1,
  );
  const addOnHandle = filled(b.addOn?.handle) ? b.addOn.handle.trim() : '';
  const sets = bundleSets(value);
  const addOns = offerAddOns(value);
  if (!choice && !addOnHandle && !sets.length && !addOns.length) return null;
  return {...b, choice: choice ?? null, addOnHandle, sets, addOns};
}
const cardComplete = (card?: BundleCard) =>
  Boolean(
    card &&
      filled(card.label) &&
      (card.items ?? []).filter(filled).length > 0 &&
      pictureComplete(card),
  );
/** The bundles for "Make it a set", each a real product by handle. */
export function bundleSets(value: CampaignPacket) {
  return (value.bundle?.sets ?? []).filter(
    (set) => filled(set?.handle) && cardComplete(set),
  );
}
/** The base set card beside the bundles, when it is complete. */
export function bundleBase(value: CampaignPacket) {
  const base = value.bundle?.base;
  return base && cardComplete(base) ? base : null;
}
/** Stars and the reviews section stay hidden on the real store below this. */
export const MIN_GENUINE_REVIEWS = 3;
export function genuineReviews(value: CampaignPacket) {
  return (value.reviews?.items ?? []).filter(
    (item) =>
      item.kind === 'genuine' &&
      item.permission === true &&
      item.name.trim() &&
      item.text.trim() &&
      item.source.trim() &&
      item.date.trim() &&
      (item.rating === null ||
        (Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5)),
  );
}
/**
 * Review cards to render. The demo catalog may show labelled samples; the
 * real store shows only genuine reviews, and only once there are enough.
 */
export function reviewCards(value: CampaignPacket, isSample: boolean) {
  const genuine = genuineReviews(value);
  if (!isSample)
    return {
      items: genuine.length >= MIN_GENUINE_REVIEWS ? genuine : [],
      sample: false,
    };
  const samples = (value.reviews?.items ?? []).filter(
    (item) => item.kind === 'sample' && item.name.trim() && item.text.trim(),
  );
  const items = [...genuine, ...samples];
  return {items, sample: samples.length > 0};
}
/** Average star rating from genuine reviews only; null hides every star. */
export function genuineRating(value: CampaignPacket) {
  const genuine = genuineReviews(value);
  const rated = genuine.filter((item) => item.rating !== null);
  if (genuine.length < MIN_GENUINE_REVIEWS || !rated.length) return null;
  return {
    average:
      rated.reduce((sum, item) => sum + Number(item.rating), 0) / rated.length,
    count: genuine.length,
  };
}
type OfferTerms = {
  currency: string;
  freeShippingOver: number;
  shippingFee: number;
  sale?: {label: string; percentOff: number};
};
const offerMoney = (value: number, currency: string) =>
  new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
/** Fill {freeShipping}, {shippingFee}, {percentOff} and {saleLabel} tokens. */
export function fillOfferText(text: string, offer?: OfferTerms) {
  if (!offer) return text;
  return text
    .replaceAll('{freeShipping}', offerMoney(offer.freeShippingOver, offer.currency))
    .replaceAll('{shippingFee}', offerMoney(offer.shippingFee, offer.currency))
    .replaceAll('{percentOff}', `${offer.sale?.percentOff ?? 0}%`)
    .replaceAll('{saleLabel}', offer.sale?.label ?? 'Offer');
}
/** Deep-fill every string in a packet once, at load. */
export function fillPacketText<T>(value: T, offer?: OfferTerms): T {
  if (typeof value === 'string') return fillOfferText(value, offer) as T;
  if (Array.isArray(value))
    return value.map((item) => fillPacketText(item, offer)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, fillPacketText(item, offer)]),
    ) as T;
  return value;
}
// Offer tokens such as {freeShipping} are filled once, so copy always matches
// the configured terms.
export const campaign: CampaignPacket = fillPacketText(
  packet as unknown as CampaignPacket,
  packet.offer as OfferTerms,
);

// Multi-product packet registry: every product packet in app/content/*.json
// maps its handles and filename slug to its own CampaignPacket, theme palette,
// gallery and cart-drawer upsell stack on /products/<handle>.
const rawPacketModules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

export const campaignPacketsByFile: Record<string, CampaignPacket> = {};
export const campaignPacketsByHandle: Record<string, CampaignPacket> = {};

for (const [relPath, raw] of Object.entries(rawPacketModules)) {
  const fileName = relPath.replace(/^\.\//, '');
  if (fileName === 'site.json' || fileName === 'palettes.json') continue;
  if (!raw || typeof raw !== 'object' || !('hero' in raw) || !('purchase' in raw)) {
    continue;
  }
  const filledPacket = fillPacketText(
    raw as unknown as CampaignPacket,
    (raw as {offer?: OfferTerms}).offer,
  );
  campaignPacketsByFile[fileName] = filledPacket;
  const slug = fileName.replace(/\.json$/i, '');
  campaignPacketsByHandle[slug] = filledPacket;
  for (const h of filledPacket.productHandles ?? []) {
    if (typeof h === 'string' && h.trim()) {
      campaignPacketsByHandle[h.trim()] = filledPacket;
    }
  }
  const urlHandle = filledPacket.productUrl?.split('/').filter(Boolean).pop();
  if (urlHandle) {
    campaignPacketsByHandle[urlHandle] = filledPacket;
  }
  const catalogHandle = filledPacket.catalog?.handle?.trim();
  if (catalogHandle) {
    campaignPacketsByHandle[catalogHandle] = filledPacket;
  }
}

export function getPacketByHandle(handleOrFile?: string | null): CampaignPacket | null {
  if (!handleOrFile) return null;
  const key = handleOrFile.trim().replace(/^\.\//, '');
  return (
    campaignPacketsByFile[key] ??
    campaignPacketsByFile[`${key}.json`] ??
    campaignPacketsByHandle[key] ??
    null
  );
}
export function approvedReviews(value: CampaignPacket) {
  if (value.proof.kind !== 'verified') return [];
  return value.proof.items.filter(
    (item) =>
      !item.fictional &&
      item.source.trim() &&
      item.permission &&
      value.productHandles.includes(item.productHandle) &&
      item.author.trim() &&
      item.text.trim() &&
      (item.rating === null ||
        (Number.isInteger(item.rating) &&
          item.rating >= 1 &&
          item.rating <= 5)),
  );
}
/** Illustrative testimonials are isolated from evidence-backed reviews. */
export function displayedReviews(value: CampaignPacket) {
  if (value.status === 'sample' && value.proof.kind === 'illustrative') {
    return value.proof.items.filter(
      (item) =>
        item.fictional === true &&
        value.productHandles.includes(item.productHandle) &&
        item.author &&
        item.text &&
        Number.isInteger(item.rating) &&
        Number(item.rating) >= 1 &&
        Number(item.rating) <= 5,
    );
  }
  return approvedReviews(value);
}
export function approvedDemos(value: CampaignPacket) {
  return value.demonstrations.items.filter(
    (item) =>
      item.source.trim() &&
      item.permission &&
      value.productHandles.includes(item.productHandle) &&
      item.src &&
      item.poster &&
      item.captions,
  );
}
export function showProof(value: CampaignPacket) {
  return (
    displayedReviews(value).length > 0 ||
    (value.status === 'sample' && value.proof.kind === 'pending')
  );
}
export type SectionId =
  | 'problem'
  | 'features'
  | 'howToUse'
  | 'fitCheck'
  | 'whoFor'
  | 'didYouKnow'
  | 'quotes'
  | 'comparison'
  | 'howItWorks'
  | 'inTheBox'
  | 'story'
  | 'benefits'
  | 'details'
  | 'colors'
  | 'proof'
  | 'useCases'
  | 'fit'
  | 'guarantee'
  | 'specs'
  | 'bundle'
  | 'promise'
  | 'faq';
/** Every product page answers these questions once, in a template's order. */
export const sectionLabels: Record<SectionId, string> = {
  problem: 'Sound familiar?',
  features: 'Features & diagram',
  howToUse: 'How to use',
  fitCheck: 'Fit check',
  whoFor: 'Who it’s for',
  didYouKnow: 'Did you know? (sourced facts)',
  quotes: 'Why people switch (quotes)',
  comparison: 'Why it’s better',
  howItWorks: 'How it works',
  inTheBox: 'What’s in the box',
  story: 'Buyer moment',
  benefits: 'Why it works',
  details: 'Details up close',
  colors: 'Color choice',
  proof: 'Customer reviews',
  useCases: 'Ways to use it',
  fit: 'Fit & sizing',
  guarantee: 'Guarantee',
  specs: 'Details & specs',
  bundle: 'Get the pair',
  promise: 'Delivery & returns',
  faq: 'Questions & objections',
};
/*
 * Hero-first templates (trimmed October 1, job pdp-trim-2026-10-01): one
 * section per buyer question, in the same order everywhere (problem,
 * features + diagram, how to use, who it's for, comparison, box, reviews,
 * guarantee, specs, bundle, FAQ, delivery & returns). Templates differ only in
 * where "who it's for" sits. The older story, benefits, details, colors, ways
 * to use, fit and how-it-works sections answered the same questions again, so
 * they are not rendered here; their renderers and packet fields stay, so
 * older packets still load and their content can return in a later template.
 */
export const legacySections: SectionId[] = [
  'howItWorks',
  'story',
  'benefits',
  'details',
  'colors',
  'useCases',
  'fit',
];
/*
 * One page template (October 3, owner: "the pages shouldnt change all the
 * time. we should be able to have 10/10 template that we just fill in with
 * the content"). store/PAGE-BLUEPRINT.md is the source: every product uses
 * these sections in this order; missing content hides a section, it never
 * moves another. The older story-led, problem-solution and gift-led orders
 * are retired. Genuine Merrivy reviews (proof) sit just above the quotes and
 * stay hidden until there are three.
 */
export const TEMPLATE_ID = 'merrivy-standard';
export const templates: {
  id: string;
  name: string;
  purpose: string;
  sections: SectionId[];
}[] = [
  {
    id: TEMPLATE_ID,
    name: 'Merrivy standard',
    purpose:
      'The one product page (store/PAGE-BLUEPRINT.md): the problem, why it matters, did you know, what it does, how it works, will it work for me, what people say, us vs the usual, the box, the set, the promise, questions.',
    sections: [
      'problem',
      'whoFor',
      'didYouKnow',
      'features',
      'howToUse',
      'fitCheck',
      'proof',
      'quotes',
      'comparison',
      'inTheBox',
      'bundle',
      'guarantee',
      'faq',
      'promise',
    ],
  },
];
/** Every packet renders the one template; an old or unknown id falls back to it. */
export function resolveTemplate(id?: string | null) {
  return templates.find((template) => template.id === id) ?? templates[0];
}
export const requiredInputs = [
  [
    'Exact product',
    'Shopify product/variant binding and matched supplier item',
  ],
  [
    'Buyer & angle',
    'Who, buying situation, emotional reason and supporting observations',
  ],
  [
    'Offer',
    'Actual price, contents, quantities and configured Shopify discounts/plans',
  ],
  [
    'Images',
    'Exact-product gallery, hero, use situation and feature details with usage rights',
  ],
  [
    'Copy',
    'Headline, buyer story, supported benefits, specifications and objections',
  ],
  [
    'Proof',
    'Genuine attributed product feedback, or an explicit omit decision',
  ],
  ['Service', 'Verified destination delivery, return terms and support route'],
  [
    'Acceptance',
    'Product-specific mobile/desktop, cart and checkout verification',
  ],
] as const;
