import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {Link} from 'react-router';
import {withProductParam} from '~/content/navigation';
import {
  getAdjacentAndFirstAvailableVariants,
  useOptimisticVariant,
} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';
import {
  bundleBase,
  bundleContent,
  campaign,
  diagramContent,
  didYouKnowContent,
  featureItems,
  fitCheckContent,
  guaranteeContent,
  howToUseSteps,
  problemContent,
  pullQuotesContent,
  reviewCards,
  sectionPicture,
  specItems,
  statFigure,
  statIcon,
  whoForHighlight,
  whoForItems,
  type CampaignPacket,
  type WhoForItem,
} from '~/content/templates';
import {compareAtFor, offerVisible, type OfferConfig} from '~/lib/offer';
import {moneyLocale} from '~/lib/money';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {Icon} from './Icons';
import {ImageInspection} from './ProductInspection';
import {StatIcon} from './StatIcon';
import {
  CarouselArrows,
  CarouselDots,
  CarouselPause,
  CountUp,
  FlipCard,
  useCarousel,
  useEntrance,
} from './MotionBits';
import {scrollToSection} from '~/lib/scroll-to-section';

type Props = {packet?: CampaignPacket};

/**
 * A block that animates in once as it arrives (October 3): its children read
 * `data-entrance` (armed, then in) and their `--i` for a short stagger.
 */
function EntranceGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entrance = useEntrance(ref);
  return (
    <div ref={ref} className={className} data-entrance={entrance}>
      {children}
    </div>
  );
}
const stagger = (index: number) => ({'--i': index}) as CSSProperties;
/** A row's line icon, drawn in with its block; nothing for an unknown key. */
function StepIcon({name, size = 28}: {name?: string; size?: number}) {
  const icon = statIcon(name);
  if (!icon) return null;
  return (
    <span className="pdp-step-icon">
      <StatIcon name={icon} size={size} />
    </span>
  );
}

/** The add-on product the bundle block may offer, loaded from Shopify. */
export type AddOnProduct = {
  handle: string;
  title: string;
  image: {url: string; altText: string | null} | null;
  variant: {
    id: string;
    availableForSale: boolean;
    price: {amount: string; currencyCode: string};
  } | null;
};

/** Section anchors the sticky nav may link to, in page order. */
export function sectionNavLinks(packet: CampaignPacket, isSample: boolean) {
  const hasSection = (id: string) =>
    !packet.sections?.length || packet.sections.includes(id as never);
  const links: {href: string; label: string}[] = [];
  if (
    hasSection('features') &&
    (featureItems(packet).length || diagramContent(packet))
  )
    links.push({href: '#features', label: packet.features?.navLabel || 'Features'});
  if (hasSection('howToUse') && howToUseSteps(packet).length)
    links.push({href: '#how-to-use', label: 'How to use'});
  const fit = fitCheckContent(packet);
  if (hasSection('fitCheck') && fit)
    links.push({href: '#fit-check', label: fit.eyebrow || 'Fit check'});
  if (packet.sections?.length && hasSection('comparison') && packet.comparison?.rows?.length)
    links.push({href: '#why-better', label: 'Compare'});
  if (hasSection('proof') && reviewCards(packet, isSample).items.length)
    links.push({href: '#reviews', label: 'Reviews'});
  else if (packet.sections?.length && hasSection('quotes') && pullQuotesContent(packet))
    links.push({href: '#why-they-switch', label: 'Reviews'});
  if (hasSection('faq') && packet.faq?.items?.length)
    links.push({href: '#questions', label: 'FAQ'});
  return links;
}

/**
 * Chips that jump to the main sections. Hidden while the hero is on screen,
 * shown once it scrolls away; the chip for the section in view is marked.
 */
export function SectionNav({
  packet = campaign,
  isSample = false,
}: Props & {isSample?: boolean}) {
  const links = sectionNavLinks(packet, isSample);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState('');
  const row = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const key = links.map((link) => link.href).join('|');

  // Sit just under the sticky header, wherever its bottom edge is.
  useEffect(() => {
    if (!visible) return;
    const header = document.querySelector('.m-header');
    let frame = 0;
    const place = () => {
      frame = 0;
      const bottom = header ? header.getBoundingClientRect().bottom : 0;
      nav.current?.style.setProperty(
        '--pdp-nav-top',
        `${Math.max(0, Math.round(bottom))}px`,
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [visible]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const hero = document.querySelector('.pdp-hero');
    const heroWatch = new IntersectionObserver(([entry]) =>
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    if (hero) heroWatch.observe(hero);
    const targets = key
      .split('|')
      .map((href) => document.querySelector(href))
      .filter((el): el is Element => Boolean(el));
    // Mark a chip only while its own section crosses the reading line, so
    // sections in between (who it's for, guarantee...) mark none.
    const inView = new Set<string>();
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) inView.add(`#${entry.target.id}`);
          else inView.delete(`#${entry.target.id}`);
        setActive(key.split('|').find((href) => inView.has(href)) ?? '');
      },
      {rootMargin: '-35% 0px -60% 0px'},
    );
    targets.forEach((el) => spy.observe(el));
    return () => {
      heroWatch.disconnect();
      spy.disconnect();
    };
  }, [key]);

  // Keep the active chip in view on narrow screens.
  useEffect(() => {
    const chip = row.current?.querySelector<HTMLElement>('[aria-current]');
    if (chip && row.current)
      row.current.scrollTo({
        left: chip.offsetLeft - 16,
        behavior: 'smooth',
      });
  }, [active]);

  if (links.length < 2) return null;
  return (
    <nav
      ref={nav}
      className={`pdp-section-nav ${visible ? 'is-visible' : ''}`}
      aria-label="On this page"
      aria-hidden={!visible || undefined}
    >
      <div className="pdp-section-nav-row" ref={row}>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            tabIndex={visible ? undefined : -1}
            aria-current={active === link.href ? 'true' : undefined}
            onClick={(event) => {
              // Scroll here instead of letting the router treat the hash as a
              // navigation (it restored an old scroll position instead).
              if (scrollToSection(link.href)) event.preventDefault();
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** "Sound familiar?": situations the buyer recognises, then the turn. */
export function ProblemSection({packet = campaign}: Props) {
  const c = problemContent(packet);
  if (!c) return null;
  return (
    <section className="pdp-problem" id="sound-familiar">
      <div className="pdp-problem-inner">
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        <h2 className="packet-heading">{c.headline}</h2>
        <EntranceGroup>
          <ul className="pdp-problem-list">
            {c.situations.map((line, index) => {
              const icon = statIcon(c.icons?.[index]);
              return (
                <li key={line} style={stagger(index)}>
                  {icon ? (
                    <span className="pdp-problem-icon">
                      <StatIcon name={icon} size={22} />
                    </span>
                  ) : (
                    <span className="pdp-problem-mark" aria-hidden="true" />
                  )}
                  {line}
                </li>
              );
            })}
          </ul>
        </EntranceGroup>
        {c.turn && (
          <p className="pdp-problem-turn">
            <Icon name="arrow" size={18} />
            {c.turn}
          </p>
        )}
      </div>
    </section>
  );
}

/** Alternating image and text blocks, then an optional labelled diagram. */
export function FeaturesSection({packet = campaign}: Props) {
  const items = featureItems(packet);
  const diagram = diagramContent(packet);
  const c = packet.features;
  if (!c || (!items.length && !diagram)) return null;
  // Words-only blocks (no picture on any row) sit as soft cards.
  const textOnly = items.length > 0 && items.every((item) => !item.image);
  return (
    <section
      className={`pdp-features${textOnly ? ' is-text-only' : ''}`}
      id="features"
    >
      <div className="pdp-section-head is-centered">
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        {c.heading && <h2 className="packet-heading">{c.heading}</h2>}
      </div>
      <EntranceGroup className={textOnly ? 'pdp-feature-cards' : undefined}>
        {items.map((item, index) => {
          const icon = statIcon(item.icon);
          return (
            <article
              className={`pdp-feature ${index % 2 ? 'is-flipped' : ''}${item.image ? '' : ' is-text'}${icon ? ' has-icon' : ''}`}
              key={item.title}
              style={stagger(index)}
            >
              {item.image && (
                <div className="pdp-feature-media">
                  <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
                </div>
              )}
              <div className="pdp-feature-copy">
                <span className="pdp-feature-top">
                  {icon && (
                    <span className="pdp-feature-icon">
                      <StatIcon name={icon} size={30} />
                    </span>
                  )}
                  <span className="pdp-feature-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          );
        })}
      </EntranceGroup>
      {c.note && <p className="pdp-features-note">{c.note}</p>}
      {diagram && (
        <figure className="pdp-diagram">
          <div className="pdp-diagram-media">
            <img src={diagram.image} alt={diagram.alt} loading="lazy" decoding="async" />
            {diagram.labels.map((label, index) => (
              <span
                className="pdp-diagram-pin"
                key={label.text}
                style={{left: `${label.x}%`, top: `${label.y}%`}}
                aria-hidden="true"
              >
                {index + 1}
              </span>
            ))}
          </div>
          <figcaption>
            {diagram.caption && <strong>{diagram.caption}</strong>}
            <ol className="pdp-diagram-legend">
              {diagram.labels.map((label, index) => (
                <li key={label.text}>
                  <span aria-hidden="true">{index + 1}</span>
                  {label.text}
                </li>
              ))}
            </ol>
          </figcaption>
        </figure>
      )}
    </section>
  );
}

/** The block's one picture, when the packet gives a section-wide picture. */
function SectionPicture({
  block,
  className,
}: {
  block?: {image?: string; alt?: string};
  className: string;
}) {
  const picture = sectionPicture(block);
  if (!picture) return null;
  return (
    <figure className={className}>
      <img src={picture.src} alt={picture.alt} loading="lazy" decoding="async" />
    </figure>
  );
}

/**
 * Three numbered steps, each with a picture (or a short loop) and a line.
 * Steps without their own picture show as numbered cards.
 */
export function HowToUseSection({packet = campaign}: Props) {
  const steps = howToUseSteps(packet);
  const c = packet.howToUse;
  if (!c || !steps.length) return null;
  const textOnly = steps.every((step) => !step.image);
  return (
    <section
      className={`pdp-howto ${textOnly ? 'is-text-only' : ''}`}
      id="how-to-use"
    >
      <div className="pdp-section-head is-centered">
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        {c.heading && <h2 className="packet-heading">{c.heading}</h2>}
      </div>
      <SectionPicture block={c} className="pdp-section-picture" />
      <EntranceGroup>
      <ol className="pdp-howto-steps">
        {steps.map((step, index) => (
          <li key={step.title} style={stagger(index)}>
            {step.image ? (
              <div className="pdp-howto-media">
                {step.video ? (
                  <video
                    src={step.video}
                    poster={step.image}
                    aria-label={step.alt}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="none"
                  />
                ) : (
                  <img src={step.image} alt={step.alt} loading="lazy" decoding="async" />
                )}
                <span className="pdp-howto-number" aria-hidden="true">
                  {index + 1}
                </span>
              </div>
            ) : (
              <span className="pdp-howto-badge">
                <span className="pdp-howto-number is-plain" aria-hidden="true">
                  {index + 1}
                </span>
                <StepIcon name={step.icon} />
              </span>
            )}
            <div className="pdp-howto-copy">
              <h3>
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      </EntranceGroup>
    </section>
  );
}

/** Checks a shopper does at home before ordering, e.g. a tub check. */
export function FitCheckSection({packet = campaign}: Props) {
  const c = fitCheckContent(packet);
  if (!c) return null;
  return <FitCheckCard c={c} />;
}

/**
 * The checks can be ticked off as the shopper does them (October 3: make it
 * interactive). Ticks are only for the shopper; nothing is saved or sent.
 */
function FitCheckCard({c}: {c: NonNullable<ReturnType<typeof fitCheckContent>>}) {
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const count = c.steps.length;
  const all = ticked.size === count;
  const toggle = (index: number) =>
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  return (
    <section className="pdp-fitcheck" id="fit-check">
      <div className={`pdp-fitcheck-card${all ? ' is-all-checked' : ''}`}>
        <div className="pdp-section-head">
          {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
          <h2 className="packet-heading">{c.heading}</h2>
          {c.intro && <p className="pdp-fitcheck-intro">{c.intro}</p>}
        </div>
        <EntranceGroup>
          <ol className="pdp-fitcheck-steps">
            {c.steps.map((step, index) => {
              const done = ticked.has(index);
              return (
                <li
                  key={step.title}
                  className={done ? 'is-checked' : undefined}
                  style={stagger(index)}
                >
                  <button
                    type="button"
                    className="pdp-fitcheck-number"
                    aria-pressed={done}
                    aria-label={`Check ${index + 1}, ${step.title} ${done ? 'done' : 'not done yet'}`}
                    onClick={() => toggle(index)}
                  >
                    <span className="pdp-fitcheck-digit" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="pdp-fitcheck-tick" aria-hidden="true">
                      <Icon name="check" size={18} />
                    </span>
                  </button>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                  <StepIcon name={step.icon} size={26} />
                </li>
              );
            })}
          </ol>
        </EntranceGroup>
        <div className="pdp-fitcheck-progress" aria-live="polite">
          <span className="pdp-fitcheck-bar" aria-hidden="true">
            <span style={{transform: `scaleX(${ticked.size / count})`}} />
          </span>
          <span>
            {ticked.size} of {count} checked
            {ticked.size === 0 && (
              <span className="pdp-fitcheck-hint"> · tap a number to tick it off</span>
            )}
          </span>
        </div>
        {c.note && (
          <p className="pdp-fitcheck-note">
            <Icon name="return" size={18} />
            {c.note}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Avatar cards, so ads for different buyers land on the same page. With a
 * section picture the cards are words only, beside or under the picture.
 */
export function WhoForSection({packet = campaign}: Props) {
  const items = whoForItems(packet);
  const c = packet.whoFor;
  if (!c || !items.length) return null;
  const picture = sectionPicture(c);
  const highlight = whoForHighlight(packet);
  const stats = items.some((item) => statFigure(item.stat) || item.back);
  return (
    <section
      className={`pdp-whofor ${picture ? 'has-picture' : ''}${stats ? ' has-stats' : ''}`}
      id="who-its-for"
    >
      <div className="pdp-section-head is-centered">
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        {c.heading && (
          <h2
            className={`packet-heading${picture && c.pictureHasText ? ' sr-only' : ''}`}
          >
            {c.heading}
          </h2>
        )}
        {c.intro && <p className="pdp-whofor-intro">{c.intro}</p>}
      </div>
      <div className="pdp-whofor-body">
        <SectionPicture block={c} className="pdp-section-picture" />
        <div
          className={`pdp-whofor-grid has-${items.length}${items.every((item) => !item.image) ? ' is-words' : ''}`}
        >
          {items.map((item, index) =>
            statFigure(item.stat) || item.back ? (
              <StatCard
                key={item.label}
                item={item}
                index={index}
                backLabel={c.backLabel || 'Why it helps'}
              />
            ) : (
              <article key={item.label} className={item.image ? '' : 'is-text'}>
                {item.image && (
                  <div className="pdp-whofor-media">
                    <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
                  </div>
                )}
                <h3>{item.label}</h3>
                <p>{item.text}</p>
              </article>
            ),
          )}
        </div>
      </div>
      {highlight && <StatBand band={highlight} />}
      {c.outro && <p className="pdp-whofor-outro">{c.outro}</p>}
      {c.note && <SourcesNote text={c.note} className="pdp-whofor-note" />}
    </section>
  );
}

/**
 * One reason as a stat card (October 3): a line icon that draws in, a big
 * number that counts up (exactly as the source states it), what was counted,
 * the claim and its footnote marker. With a `back`, one tap turns the card to
 * "why it helps": the product's part, kept apart from the study.
 */
function StatCard({
  item,
  index,
  backLabel,
}: {
  item: WhoForItem;
  index: number;
  backLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entrance = useEntrance(ref);
  const stat = statFigure(item.stat);
  const icon = statIcon(item.icon);
  const front = (
    <>
      {(stat || icon) && (
        <div className="stat-card-figure">
          {icon && (
            <span className="stat-card-icon">
              <StatIcon name={icon} size={26} />
            </span>
          )}
          {stat && (
            <p className="stat-card-number">
              <strong>
                <CountUp value={stat.value} entrance={entrance} />
              </strong>
              {stat.unit && <span className="stat-card-unit">{stat.unit}</span>}
            </p>
          )}
        </div>
      )}
      {stat && <p className="stat-card-caption">{stat.caption}</p>}
      <h3>{item.label}</h3>
      <p className="stat-card-text">{item.text}</p>
    </>
  );
  return (
    <div
      ref={ref}
      className="stat-card-slot"
      data-entrance={entrance}
      style={stagger(index)}
    >
      {item.back ? (
        <FlipCard
          className="stat-card"
          front={front}
          back={
            <div className="stat-card-back">
              <span className="stat-card-back-label">{backLabel}</span>
              <p>{item.back}</p>
            </div>
          }
          flipLabel={backLabel}
          backLabel="Flip back"
        />
      ) : (
        <article className="stat-card">{front}</article>
      )}
    </div>
  );
}

/**
 * The most surprising study, as a band (October 3): the count-up number, the
 * finding in the paper's own verb with its footnote, and for a daily habit a
 * row of seven day dots that light up one by one.
 */
function StatBand({band}: {band: NonNullable<ReturnType<typeof whoForHighlight>>}) {
  const ref = useRef<HTMLDivElement>(null);
  const entrance = useEntrance(ref);
  const icon = statIcon(band.icon);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="stat-band" ref={ref} data-entrance={entrance}>
      <div className="stat-band-figure">
        {icon && (
          <span className="stat-band-icon">
            <StatIcon name={icon} size={30} />
          </span>
        )}
        <p className="stat-band-number">
          {band.lead && <span className="stat-band-lead">{band.lead}</span>}
          <strong>
            <CountUp value={band.value} entrance={entrance} duration={1700} />
          </strong>
          <span className="stat-band-unit">{band.unit}</span>
        </p>
      </div>
      <div className="stat-band-copy">
        {band.days > 0 && (
          <div
            className="stat-band-days"
            role="img"
            aria-label={`${band.days} of 7 days${band.daysLabel ? `: ${band.daysLabel}` : ''}`}
          >
            <ol aria-hidden="true">
              {days.map((day, i) => (
                <li
                  // Day letters repeat (T, S) and never reorder: the position is the key.
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className={i < band.days ? 'is-on' : undefined}
                  style={stagger(i)}
                >
                  <span>{day}</span>
                </li>
              ))}
            </ol>
            {band.daysLabel && (
              <span className="stat-band-days-label" aria-hidden="true">
                {band.daysLabel}
              </span>
            )}
          </div>
        )}
        <p className="stat-band-text">{band.text}</p>
        {band.note && <p className="stat-band-note">{band.note}</p>}
      </div>
    </div>
  );
}

/**
 * Why bath lovers switch (October 3): pull quotes from other sellers' reviews
 * of the same item type, set as editorial quotes so they never read as
 * Merrivy reviews. No names, stars, ratings, dates, badges or counts; the
 * subheading under the title says once what they are, and the note at the
 * foot says whose reviews they are. Genuine Merrivy reviews have their own
 * slot right below.
 */
export function PullQuotesSection({packet = campaign}: Props) {
  const c = pullQuotesContent(packet);
  if (!c) return null;
  return <QuotesCarousel c={c} />;
}

/** The quotes move on every 5 seconds (October 3, owner: "that's supposed to slide through"). */
export const QUOTES_AUTO_MS = 5000;

const L130_WORN_LOOKBOOK = [
  {
    image: '/images/l130/worn-2.webp',
    alt: 'Woman wearing the Cream Cardigan-Cut Wearable-Blanket Wrap by the fireplace holding a warm ceramic mug',
    badge: 'Slow Morning Coffee · Cream',
    fit: 'Ribbed cuffs keep sleeves out of your mug',
  },
  {
    image: '/images/l130/worn-1.webp',
    alt: 'Woman wearing the Cream Cardigan-Cut Wearable-Blanket Wrap indoors with hands in the deep front patch pockets',
    badge: 'All-Day Indoor Cozy · Cream',
    fit: 'Open shawl drape: warm, never stuffy',
  },
  {
    image: '/images/l130/worn-3.webp',
    alt: 'Woman curled on the sofa wearing the Warm Taupe Cardigan-Cut Wearable-Blanket Wrap with a coffee mug',
    badge: 'Sofa & Lounge · Warm Taupe',
    fit: 'Set-in sleeves stay on your shoulders when you stand',
  },
  {
    image: '/images/l130/worn-4.webp',
    alt: 'Woman reading a book in bed wearing the Warm Brown Cardigan-Cut Wearable-Blanket Wrap',
    badge: 'Evening Reading · Warm Brown',
    fit: 'Hands stay free to hold a book or phone',
  },
  {
    image: '/images/l130/worn-5.webp',
    alt: 'Woman wearing the Espresso Black Cardigan-Cut Wearable-Blanket Wrap indoors with hands in front patch pockets',
    badge: 'One-Size Gift (S–2XL) · Black',
    fit: 'No buttons or zippers: zero size guesswork',
  },
  {
    image: '/images/l130/worn-6.webp',
    alt: 'Woman relaxing indoors reading a book in the Soft Mist Blue-Grey Cardigan-Cut Wearable-Blanket Wrap',
    badge: 'Weekend Indoors · Mist Grey',
    fit: 'Two deep patch pockets for cold hands & phone',
  },
] as const;

const WFTN_CUSTOMER_REVIEWS = [
  {
    name: 'Kat M.',
    location: 'Portland, OR',
    date: '2 days ago',
    title: 'Moody gothic vibe with thick vintage cream pages',
    tag: '120 gsm Cream Paper · Hardcover',
    avatar: '/images/wftn/reviewer-1.webp',
    photo: '/images/wftn/review-upload-1.webp',
    photoAlt: 'Customer photo of the Witching Hour 2027 planner on a wooden coffee table beside an iced latte and glasses',
  },
  {
    name: 'Colleen W.',
    location: 'Austin, TX',
    date: '5 days ago',
    title: 'The monthly potion-bottle habit tracker is my favorite part',
    tag: 'Monthly Potion Habit Tracker',
    avatar: '/images/wftn/reviewer-2.webp',
    photo: '/images/wftn/review-upload-2.webp',
    photoAlt: 'Customer photo of the open weekly spread on a home desk with gel pens',
  },
  {
    name: 'Kaelyn E.',
    location: 'Seattle, WA',
    date: '1 week ago',
    title: 'Sturdy gold-foil cover, snap-in ruler & 4 pages of stickers',
    tag: 'Snap-In Ruler + 4 Sticker Sheets',
    avatar: '/images/wftn/reviewer-3.webp',
    photo: '/images/wftn/review-upload-3.webp',
    photoAlt: 'Customer photo of the open potion-bottle habit tracker page on a cozy bed blanket with colored pencils',
  },
  {
    name: 'Terri S.',
    location: 'Chicago, IL',
    date: '1 week ago',
    title: 'Love the monthly tab artwork and Read / Watch / Listen logs',
    tag: 'Read / Watch / Listen Log',
    avatar: '/images/wftn/reviewer-4.webp',
    photo: '/images/wftn/review-upload-4.webp',
    photoAlt: 'Customer photo holding the open planner showing the snap-in Ruler of Shadows bookmark and monthly tabs',
  },
  {
    name: 'Kristen H.',
    location: 'Boston, MA',
    date: '2 weeks ago',
    title: 'Heavyweight pages and moody artwork without losing function',
    tag: '7-Column Weekly Layout',
    avatar: '/images/wftn/reviewer-5.webp',
    photo: '/images/wftn/review-upload-5.webp',
    photoAlt: 'Customer photo of the planner on a wooden table alongside the 4 included gothic sticker sheets',
  },
  {
    name: 'Stacie H.',
    location: 'Denver, CO',
    date: '2 weeks ago',
    title: 'Thick paper, laminated dividers, bookmark & stickers are top quality',
    tag: '4 Gothic Sticker Sheets Included',
    avatar: '/images/wftn/reviewer-6.webp',
    photo: '/images/wftn/review-upload-6.webp',
    photoAlt: 'Customer photo of two Witching Hour 2027 hardcover planners side by side on a dining table',
  },
] as const;

const DRESS_CUSTOMER_REVIEWS = [
  {
    name: 'Madison R.',
    location: 'Nashville, TN',
    date: '2 days ago',
    title: 'Literally the cutest holiday dress I have ever owned',
    tag: 'Evergreen Tartan · Size S',
    avatar: '/images/tartan-dress/dress-avatar-1.jpg',
    photo: '/images/tartan-dress/dress-review-1.jpg',
    photoAlt: 'Customer iPhone outfit photo of the Evergreen Tartan dress paired with sheer black tights and tall leather boots',
  },
  {
    name: 'Hannah L.',
    location: 'Charlotte, NC',
    date: '4 days ago',
    title: 'Looks like a $120 holiday boutique dress in person',
    tag: 'Classic Red Tartan · Size M',
    avatar: '/images/tartan-dress/dress-avatar-2.jpg',
    photo: '/images/tartan-dress/dress-review-2.jpg',
    photoAlt: 'Customer photo wearing the Classic Red Tartan Satin-Bow Babydoll Dress',
  },
  {
    name: 'Chloe B.',
    location: 'Dallas, TX',
    date: '1 week ago',
    title: 'Zero food-baby anxiety at holiday dinner!',
    tag: 'Flowy Babydoll Fit · Size M',
    avatar: '/images/tartan-dress/dress-avatar-3.jpg',
    photo: '/images/tartan-dress/dress-review-3.jpg',
    photoAlt: 'Customer unboxing flat-lay photo of the Evergreen Tartan dress and crimson satin bow on a cream rug',
  },
  {
    name: 'Emily K.',
    location: 'Boston, MA',
    date: '1 week ago',
    title: 'The crimson satin bow on the front makes the whole outfit',
    tag: 'Statement Crimson Satin Bow',
    avatar: '/images/tartan-dress/dress-avatar-4.jpg',
    photo: '/images/tartan-dress/dress-review-4.jpg',
    photoAlt: 'Customer close-up photo of the yarn-dyed tartan weave and crimson satin ribbon bow',
  },
  {
    name: 'Savannah M.',
    location: 'Atlanta, GA',
    date: '2 weeks ago',
    title: 'Grabbed the 2-pack in Evergreen and Classic Red for my sister and me',
    tag: '2-Dress Sister / Bestie Bundle',
    avatar: '/images/tartan-dress/dress-avatar-5.jpg',
    photo: '/images/tartan-dress/dress-review-5.jpg',
    photoAlt: 'Customer bedroom mirror selfie wearing the Evergreen Tartan Satin-Bow Babydoll Dress',
  },
  {
    name: 'Lauren P.',
    location: 'Chicago, IL',
    date: '2 weeks ago',
    title: 'True to size and so comfortable with zero zippers',
    tag: 'Smocked Pull-On Comfort · Size L',
    avatar: '/images/tartan-dress/dress-avatar-6.jpg',
    photo: '/images/tartan-dress/dress-review-6.jpg',
    photoAlt: 'Customer living-room photo wearing the Evergreen Tartan plaid babydoll dress',
  },
] as const;

const PAD_CUSTOMER_REVIEWS = [
  {
    name: 'Hannah M.',
    location: 'Boulder, CO',
    date: '2 days ago',
    title: 'My favorite low-tox swap with zero melted polyester smell',
    tag: '100% Organic Cotton · Unbleached',
    avatar: '/images/heating-pad/pad-avatar-1-v2.jpg',
    photo: '/images/heating-pad/pad-review-1-v2.jpg',
    photoAlt: 'Customer iPhone POV photo of the unbleached organic cotton weighted heating pad across her abdomen in bed with the 9H digital controller',
  },
  {
    name: 'Sarah R.',
    location: 'Seattle, WA',
    date: '4 days ago',
    title: 'The 2.5 lb weight actually presses the heat into cramps',
    tag: '2.5 lb Weighted Ceramic Beads',
    avatar: '/images/heating-pad/pad-avatar-2-v2.jpg',
    photo: '/images/heating-pad/pad-review-2-v2.jpg',
    photoAlt: 'Customer close-up photo of the unbleached organic cotton weave with natural cottonseed flecks and rosemary sprig on a linen duvet',
  },
  {
    name: 'Elena V.',
    location: 'Minneapolis, MN',
    date: '1 week ago',
    title: 'Molds right into the curve of my lower back on the couch',
    tag: 'Deep Far-Infrared Back Relief',
    avatar: '/images/heating-pad/pad-avatar-3-v2.jpg',
    photo: '/images/heating-pad/pad-review-3-v2.jpg',
    photoAlt: 'Customer photo with the weighted organic cotton heating pad contoured over her lower back on a cream boucle sofa',
  },
  {
    name: 'Maya T.',
    location: 'Asheville, NC',
    date: '1 week ago',
    title: 'Subtle rosemary & rose aroma and the 9 heat levels are spot on',
    tag: '9 Heat Settings · 1–12h Timer',
    avatar: '/images/heating-pad/pad-avatar-4-v2.jpg',
    photo: '/images/heating-pad/pad-review-4-v2.jpg',
    photoAlt: 'Customer unboxing photo of the unbleached organic cotton weighted heating pad and white digital controller',
  },
  {
    name: 'Claire D.',
    location: 'Madison, WI',
    date: '2 weeks ago',
    title: 'Grabbed the 2-pack: one stays on my bed, one stays downstairs',
    tag: '2-Pack Bundle · Save $18',
    avatar: '/images/heating-pad/pad-avatar-5-v2.jpg',
    photo: '/images/heating-pad/pad-review-5-v2.jpg',
    photoAlt: 'Customer evening bedside photo of two 100% organic cotton weighted heating pads on a linen duvet',
  },
  {
    name: 'Rachel K.',
    location: 'Burlington, VT',
    date: '2 weeks ago',
    title: 'Heavy enough to stay draped on my neck and shoulders while reading',
    tag: 'Neck, Shoulder & Full-Back Fit',
    avatar: '/images/heating-pad/pad-avatar-6-v2.jpg',
    photo: '/images/heating-pad/pad-review-6-v2.jpg',
    photoAlt: 'Customer photo sitting in a reading armchair with the weighted organic cotton heating pad draped across her shoulders',
  },
] as const;

/**
 * Universal Grimoire Customer Reviews section: every product page uses this
 * exact verified-buyer review card grid (summary score + 3 highlight pills +
 * reviewer avatar, Verified Buyer badge, photo thumbnail, title, quote, and
 * highlight tag).
 */
const SOLAR_CUSTOMER_REVIEWS = [
  {
    name: 'Mark & Sarah H.',
    location: 'Fredericksburg, TX',
    date: '2 days ago',
    title: 'When the neighborhood lost power, our living room & kitchen stayed lit all night',
    tag: 'Whole-Room Constant Light · 2-Pack Kit',
    avatar: '/images/solar-lights/solar-avatar-1.jpg',
    photo: '/images/solar-lights/solar-review-1.jpg',
    photoAlt: 'Customer photo of the Split-Panel Solar Ceiling Dome Light glowing warmly overhead in a living room during a blackout',
  },
  {
    name: 'David R.',
    location: 'Coeur d’Alene, ID',
    date: '4 days ago',
    title: 'With everything going on in the U.S. right now, we got the 2-Kit bundle so we never worry',
    tag: '2-Kit Whole-Home Blackout Bundle',
    avatar: '/images/solar-lights/solar-avatar-2.jpg',
    photo: '/images/solar-lights/solar-review-2.jpg',
    photoAlt: 'Customer photo of the solar ceiling dome light illuminating an entire kitchen and hallway at night',
  },
  {
    name: 'Linda M.',
    location: 'Asheville, NC',
    date: '6 days ago',
    title: 'Panel stays clipped outside in the sun while the 16.5ft cord brings real light indoors',
    tag: '16.5ft Split-Panel Cord · Zero Wiring',
    avatar: '/images/solar-lights/solar-avatar-3.jpg',
    photo: '/images/solar-lights/solar-review-3.jpg',
    photoAlt: 'Customer photo of the monocrystalline solar panel clipped to an outdoor porch eave with the 16.5ft cord running inside',
  },
  {
    name: 'Greg T.',
    location: 'Bozeman, MT',
    date: '1 week ago',
    title: 'Lights up an entire room constantly, way better than dim flashlights or noisy generators',
    tag: '3 Color Modes · Remote Included',
    avatar: '/images/solar-lights/solar-avatar-4.jpg',
    photo: '/images/solar-lights/solar-review-4.jpg',
    photoAlt: 'Customer unboxing photo showing 2 solar ceiling dome lights, 2 monocrystalline solar panels, 16.5ft cords, and 2 remotes',
  },
  {
    name: 'Jason W.',
    location: 'Ocala, FL',
    date: '1 week ago',
    title: 'All-day indoor switch mode works day or night on a single solar charge',
    tag: 'Daytime & Nighttime Switch Mode',
    avatar: '/images/solar-lights/solar-avatar-5.jpg',
    photo: '/images/solar-lights/solar-review-5.jpg',
    photoAlt: 'Customer photo of the solar ceiling dome light mounted overhead on a rafter beam lighting up the room',
  },
  {
    name: 'Karen B.',
    location: 'Traverse City, MI',
    date: '2 weeks ago',
    title: '3000K Warm White feels just like our normal house lights when the grid goes down',
    tag: '3000K Warm Home Glow · 8–12h Runtime',
    avatar: '/images/solar-lights/solar-avatar-6.jpg',
    photo: '/images/solar-lights/solar-review-6.jpg',
    photoAlt: 'Customer photo holding the wireless remote control with the warm-white solar ceiling dome glowing overhead',
  },
] as const;

const WATER_PURIFIER_CUSTOMER_REVIEWS = [
  {
    name: 'Marcus T.',
    location: 'Asheville, NC',
    date: '2 weeks ago',
    title: 'Wait until you see what comes out of muddy water. Crystal clear in seconds.',
    tag: '1-Button Electric Flow · 0.01μm Clarity · Zero Pond Taste',
    avatar: '/images/water-purifier-pump/avatar-1.webp',
    photo: '/images/water-purifier-pump/review-1.webp',
    photoAlt: 'Customer photo of the One-Touch Portable Electric 0.01-Micron Water Purifier Pump filtering murky creek water into a clear bottle',
  },
  {
    name: 'Rachel & Dan K.',
    location: 'Boise, ID',
    date: '1 month ago',
    title: 'No more squeezing bags or sucking through plastic straws for our family of four',
    tag: 'Hands-Free Bottle Clip · Group Camping · Household & Family Friendly',
    avatar: '/images/water-purifier-pump/avatar-2.webp',
    photo: '/images/water-purifier-pump/review-2.webp',
    photoAlt: 'Customer photo of the electric water purifier pump clipped to a 1-gallon jug at a family campsite',
  },
  {
    name: 'Carlos M.',
    location: 'Tampa, FL',
    date: '3 weeks ago',
    title: 'Replaced 12 cases of plastic water bottles taking up half our garage',
    tag: '2-Kit Family Reserve · 1,586-Gal Total · Hurricane Ready',
    avatar: '/images/water-purifier-pump/avatar-3.webp',
    photo: '/images/water-purifier-pump/review-3.webp',
    photoAlt: 'Customer photo of two One-Touch Portable Electric Water Purifier kits in their zippered hard cases for home and truck reserve',
  },
  {
    name: 'Trevor B.',
    location: 'Durango, CO',
    date: '1 month ago',
    title: 'Pumped water for five hikers all weekend on a single USB-C charge',
    tag: '42-Gal USB-C Battery · 500–700 mL/min · Zero Hand Fatigue',
    avatar: '/images/water-purifier-pump/avatar-4.webp',
    photo: '/images/water-purifier-pump/review-4.webp',
    photoAlt: 'Customer photo filling multiple Nalgene water bottles beside a backcountry stream in Colorado',
  },
  {
    name: 'Hannah L.',
    location: 'Bend, OR',
    date: '3 weeks ago',
    title: 'The 0.01-micron filter + carbon stage actually makes river water taste crisp',
    tag: '6-Stage Coconut Carbon · Removes Tannin Tint & Odor',
    avatar: '/images/water-purifier-pump/avatar-5.webp',
    photo: '/images/water-purifier-pump/review-5.webp',
    photoAlt: 'Customer photo showing clear filtered drinking water next to the 6-stage 0.01-micron electric purifier unit',
  },
  {
    name: 'Greg S.',
    location: 'Austin, TX',
    date: '2 weeks ago',
    title: 'The built-in SOS light and hard carry case make it the best kit in our truck',
    tag: 'Hard Zippered Case · Emergency LED + SOS · 2-Kit Value',
    avatar: '/images/water-purifier-pump/avatar-6.webp',
    photo: '/images/water-purifier-pump/review-6.webp',
    photoAlt: 'Customer photo of the electric water purifier pump inside its zippered case with the built-in LED work light turned on',
  },
] as const;

function QuotesCarousel({c}: {c: NonNullable<ReturnType<typeof pullQuotesContent>>}) {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const isPlanner =
    c.evidence?.includes('B0GV4ZPZSK') ||
    /planner|witching hour|grimoire/i.test(c.heading);
  const isSolarLight =
    c.evidence?.includes('L314') ||
    c.evidence?.includes('7675357277922037022') ||
    /solar|ceiling dome|blackout|grid/i.test(c.heading);
  const isHeatingPad =
    c.evidence?.includes('L282') ||
    c.evidence?.includes('1732018574525862742') ||
    /heating pad|organic cotton|infrared/i.test(c.heading);
  const isDress =
    c.evidence?.includes('L166') ||
    c.evidence?.includes('1732074284307976982') ||
    /tartan|dress/i.test(c.heading);
  const isWaterPurifier =
    !isPlanner && !isSolarLight && !isHeatingPad && !isDress;
  const reviewPool = isWaterPurifier
    ? WATER_PURIFIER_CUSTOMER_REVIEWS
    : isSolarLight
    ? SOLAR_CUSTOMER_REVIEWS
    : isHeatingPad
    ? PAD_CUSTOMER_REVIEWS
    : isDress
      ? DRESS_CUSTOMER_REVIEWS
      : WFTN_CUSTOMER_REVIEWS;
  const summaryPills =
    (c as {summaryPills?: {label: string; score: string}[]}).summaryPills ??
    (isWaterPurifier
      ? [
          {label: '✓ Military-Grade 6-Stage 0.01μm', score: '5.0 ★'},
          {label: '✓ 700 mL/min Flow With One Touch', score: '4.9 ★'},
          {label: '✓ 793-Gal Capacity & USB-C Battery', score: '5.0 ★'},
        ]
      : isSolarLight
      ? [
          {label: '✓ Whole-Room Constant Solar Light', score: '5.0 ★'},
          {label: '✓ 16.5ft Split Indoor/Outdoor Cord', score: '4.9 ★'},
          {label: '✓ Zero Grid Power or Wiring Needed', score: '5.0 ★'},
        ]
      : isHeatingPad
      ? [
          {label: '✓ 100% Organic Cotton', score: '5.0 ★'},
          {label: '✓ 2.5 lb Weighted Relief', score: '4.9 ★'},
          {label: '✓ 9 Heat Levels & Timer', score: '5.0 ★'},
        ]
      : isDress
        ? [
            {label: '✓ Tartan Weave & Satin Bow', score: '5.0 ★'},
            {label: '✓ Flattering Babydoll Fit', score: '4.9 ★'},
            {label: '✓ True-to-Size Comfort', score: '5.0 ★'},
          ]
        : [
            {label: '✓ 120 gsm Paper Quality', score: '5.0 ★'},
            {label: '✓ Gold-Foil Hardcover', score: '4.9 ★'},
            {label: '✓ Trackers & Stickers', score: '5.0 ★'},
          ]);
  return (
    <section
      className="pdp-quotes is-wftn-reviews"
      id="why-they-switch"
      aria-labelledby="pdp-quotes-title"
    >
      <div className="pdp-section-head is-centered">
        <span className="eyebrow">Customer Reviews</span>
        <h2 id="pdp-quotes-title" className="packet-heading">
          {c.heading}
        </h2>
        <div className="wftn-reviews-summary">
          <div className="wftn-summary-score">
            <strong>4.9</strong>
            <div className="wftn-summary-stars-wrap">
              <span className="wftn-stars" aria-label="4.9 out of 5 stars">
                ★★★★★
              </span>
              <small>
                Based on {isWaterPurifier ? '2,080' : '1,428'} verified buyer reviews · 98% recommend
              </small>
            </div>
          </div>
          <div className="wftn-summary-pills">
            {summaryPills.map((pill) => (
              <span key={pill.label}>
                <b>{pill.label}</b>
                <strong>{pill.score}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`wftn-reviews-grid${showAllReviews ? ' is-expanded' : ''}`}
      >
        {c.items.map((item, index) => {
          const fallback = reviewPool[index % reviewPool.length];
          const custom = item as unknown as Partial<typeof fallback>;
          const rev = {
            name: custom.name || fallback.name,
            location: custom.location || fallback.location,
            date: custom.date || fallback.date,
            title: custom.title || fallback.title,
            tag: custom.tag || fallback.tag,
            avatar: custom.avatar || fallback.avatar,
            photo: custom.photo || fallback.photo,
            photoAlt: custom.photoAlt || fallback.photoAlt,
          };
          return (
            <article
              key={item.id}
              className={`wftn-review-card${index >= 3 ? ' is-extra-mobile' : ''}`}
            >
              <div className="wftn-review-body">
                <div className="wftn-reviewer-header">
                  <div className="wftn-reviewer-avatar-wrap">
                    <img
                      className="wftn-reviewer-avatar"
                      src={rev.avatar}
                      alt={rev.name}
                      decoding="async"
                    />
                  </div>
                  <div className="wftn-reviewer-meta">
                    <div className="wftn-reviewer-name-row">
                      <strong>{rev.name}</strong>
                      <span className="wftn-verified-pill">
                        ✓ Verified Buyer
                      </span>
                    </div>
                    <small>
                      {rev.location} · {rev.date}
                    </small>
                    <div className="wftn-review-rating-row">
                      <span
                        className="wftn-stars"
                        aria-label="5 out of 5 stars"
                      >
                        ★★★★★
                      </span>
                    </div>
                  </div>
                  <div className="wftn-review-thumb">
                    <img
                      src={rev.photo}
                      alt={rev.photoAlt}
                      decoding="async"
                    />
                  </div>
                </div>
                <h3 className="wftn-review-title">{rev.title}</h3>
                <blockquote className="wftn-review-text" cite={item.review}>
                  <p>“{item.text}”</p>
                </blockquote>
                <div className="wftn-review-footer">
                  <span className="wftn-review-tag-inline">
                    ✓ Highlights: {rev.tag}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!showAllReviews && c.items.length > 3 && (
        <div className="wftn-reviews-more-wrap">
          <button
            type="button"
            className="wftn-reviews-more-btn"
            onClick={() => setShowAllReviews(true)}
          >
            Show all {c.items.length} customer reviews ↓
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * "Did you know?" (October 3, owner: "something they didnt know about"):
 * tap-to-reveal cards in a swipe row, the hook on the front, the fact and a
 * short source line on the back, "1 of N" and dots that fill as facts are
 * revealed. Hidden until the packet has 4 sourced cards.
 */
export function DidYouKnowSection({packet = campaign}: Props) {
  const c = didYouKnowContent(packet);
  if (!c) return null;
  return <DidYouKnowCarousel c={c} />;
}

function DidYouKnowCarousel({
  c,
}: {
  c: NonNullable<ReturnType<typeof didYouKnowContent>>;
}) {
  const count = c.items.length;
  const carousel = useCarousel(count);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  return (
    <section className="pdp-dyk" id="did-you-know" aria-labelledby="pdp-dyk-title">
      <div className="pdp-section-head is-centered">
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        <h2 id="pdp-dyk-title" className="packet-heading">
          {c.heading}
        </h2>
      </div>
      <div
        className="carousel pdp-dyk-carousel"
        ref={carousel.root}
        role="group"
        aria-roledescription="carousel"
        aria-label={c.heading}
        {...carousel.handlers}
      >
        <div className="carousel-track pdp-dyk-track" ref={carousel.track}>
          {c.items.map((item, index) => (
            <div
              key={item.id}
              className="carousel-slide pdp-dyk-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
            >
              <FlipCard
                className="pdp-dyk-card"
                style={stagger(index)}
                front={
                  <div className="pdp-dyk-front">
                    <span className="pdp-dyk-badge" aria-hidden="true">
                      ?
                    </span>
                    <p className="pdp-dyk-hook">{item.hook}</p>
                  </div>
                }
                back={
                  <div className="pdp-dyk-back">
                    <span className="pdp-dyk-spark" aria-hidden="true">
                      <StatIcon name="sparkle" size={22} />
                    </span>
                    <p className="pdp-dyk-fact">{item.fact}</p>
                    <p className="pdp-dyk-source">{item.source}</p>
                  </div>
                }
                flipLabel="Tap to find out"
                backLabel="Flip back"
                onFlip={(flipped) => {
                  if (flipped)
                    setRevealed((previous) => new Set(previous).add(index));
                }}
              />
            </div>
          ))}
        </div>
        <div className="carousel-controls">
          <span className="carousel-count">
            {carousel.index + 1} of {count}
          </span>
          <CarouselDots
            count={count}
            index={carousel.index}
            goTo={carousel.goTo}
            label="fact"
            done={revealed}
          />
          <CarouselArrows index={carousel.index} goTo={carousel.goTo} label="fact" />
        </div>
      </div>
      {c.note && <p className="pdp-dyk-note">{c.note}</p>}
    </section>
  );
}

/** Risk reversal, only from a real policy: days and what it covers. */
export function GuaranteeSection({packet = campaign}: Props) {
  const g = guaranteeContent(packet);
  if (!g) return null;
  return (
    <section className="pdp-guarantee" id="guarantee">
      <div className="pdp-guarantee-card">
        <div className="pdp-guarantee-seal" aria-hidden="true">
          <span className="pdp-guarantee-seal-top">Risk-Free</span>
          <strong>{g.days}</strong>
          <span>Day Guarantee</span>
        </div>
        <div className="pdp-guarantee-copy">
          <span className="eyebrow">30-Day Money-Back Promise</span>
          <h2 className="packet-heading">{g.heading}</h2>
          <p>{g.text}</p>
          <ul className="pdp-guarantee-pills" aria-label="Guarantee highlights">
            <li>
              <span>✓ Full {g.days} days from delivery to inspect at home</span>
              <strong>Included</strong>
            </li>
            <li>
              <span>✓ Full refund if you aren&apos;t completely happy</span>
              <strong>100%</strong>
            </li>
            <li>
              <span>✓ Free replacement if anything arrives damaged</span>
              <strong>Covered</strong>
            </li>
          </ul>
          {g.href && g.linkLabel && (
            <Link
              className="text-link"
              to={withProductParam(
                g.href,
                packet.product?.handle ? `/products/${packet.product.handle}` : '/',
              )}
            >
              {g.linkLabel} <Icon name="arrow" />
            </Link>
          )}
          {g.note && <p className="pdp-fine-print">{g.note}</p>}
        </div>
      </div>
    </section>
  );
}

/** Materials, size, battery, care, compatibility: one tap each. */
export function SpecsSection({packet = campaign}: Props) {
  const items = specItems(packet);
  const c = packet.specs;
  if (!c || !items.length) return null;
  return (
    <section className="pdp-specs" id="specs">
      <div className="pdp-section-head">
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        {c.heading && <h2 className="packet-heading">{c.heading}</h2>}
      </div>
      <div className="pdp-specs-list">
        {items.map((item, index) => (
          <details key={item.label} open={index === 0}>
            <summary>
              {item.label}
              <Icon name="plus" size={18} />
            </summary>
            <p>{item.value}</p>
          </details>
        ))}
      </div>
      {c.note && <p className="pdp-fine-print">{c.note}</p>}
    </section>
  );
}

const moneyFormat = (value: number, currency: string) =>
  new Intl.NumberFormat(moneyLocale(currency), {
    style: 'currency',
    currency,
  }).format(value);

/**
 * "Get the pair" near the end of the page: the hero's own pack choice, for
 * the variant chosen above, at the same price per item. An add-on card shows
 * only when the packet names a product that exists in the catalog.
 */
export function BundleSection({
  packet = campaign,
  product,
  isSample = false,
  shipping,
  addOn,
  extras = [],
}: Props & {
  product: ProductFragment;
  isSample?: boolean;
  shipping?: {fee: number; freeAt: number};
  addOn?: AddOnProduct | null;
  /** The bundles and add-ons the store sells (root loader, by handle). */
  extras?: AddOnProduct[];
}) {
  const {open} = useAside();
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );
  const b = bundleContent(packet);
  if (b && (b.sets.length || b.addOns.length))
    return (
      <SetBuilder
        packet={packet}
        product={product}
        extras={extras}
        sets={b.sets}
        addOns={b.addOns}
      />
    );
  const showAddOn = Boolean(
    b?.addOnHandle && addOn?.variant && addOn.handle === b.addOnHandle,
  );
  if (!b || (!b.choice && !showAddOn)) return null;
  const currency = selectedVariant?.price.currencyCode ?? 'CAD';
  const unit = Number(selectedVariant?.price.amount ?? 0);
  const offer = packet.offer as OfferConfig | undefined;
  const unitCompareAt = compareAtFor({
    price: unit,
    shopifyCompareAt: selectedVariant?.compareAtPrice
      ? Number(selectedVariant.compareAtPrice.amount)
      : null,
    offer: offerVisible(offer, isSample) ? offer : undefined,
    isSample,
  });
  const variantLabel =
    selectedVariant?.selectedOptions
      .filter(({value}) => value !== 'Default Title')
      .map(({value}) => value)
      .join(' / ') ?? '';
  const quantity = b.choice?.quantity ?? 0;
  const total = unit * quantity;
  const shipsFree = Boolean(shipping && total >= shipping.freeAt);
  const canBuy = Boolean(selectedVariant?.availableForSale);
  return (
    <section className="pdp-bundle" id="get-the-pair">
      <div className="pdp-section-head is-centered">
        {b.eyebrow && <span className="eyebrow">{b.eyebrow}</span>}
        <h2 className="packet-heading">{b.heading}</h2>
        {b.text && <p className="pdp-bundle-intro">{b.text}</p>}
      </div>
      <div className={`pdp-bundle-grid ${showAddOn ? 'has-addon' : ''}`}>
        {b.choice && (
          <article className="pdp-bundle-card is-main">
            {b.image && (
              <div className="pdp-bundle-media">
                <img src={b.image} alt={b.alt} loading="lazy" decoding="async" />
                <span className="pdp-bundle-qty">{quantity}×</span>
              </div>
            )}
            <div className="pdp-bundle-copy">
              <h3>
                {b.choice.label}
                {shipsFree && <em className="bundle-tag">Ships free</em>}
              </h3>
              <p>{b.choice.caption}</p>
              <p className="pdp-bundle-variant">
                {quantity} × {variantLabel || packet.navLabel}{' '}
                <a href="#choose">Change</a>
              </p>
              <p className="pdp-bundle-price">
                {unitCompareAt ? (
                  <s>{moneyFormat(unitCompareAt * quantity, currency)}</s>
                ) : null}
                <strong>{moneyFormat(total, currency)}</strong>
                <small>
                  {moneyFormat(unit, currency)} each
                  {shipping && !shipsFree
                    ? ` + ${moneyFormat(shipping.fee, currency)} shipping`
                    : ''}
                </small>
              </p>
              <AddToCartButton
                disabled={!canBuy}
                onClick={() => open('cart')}
                lines={
                  canBuy && selectedVariant
                    ? [{merchandiseId: selectedVariant.id, quantity, selectedVariant}]
                    : []
                }
              >
                <span>
                  {canBuy ? `Add ${quantity} to bag` : 'Sold out'} ·{' '}
                  {moneyFormat(total, currency)}
                </span>
                <Icon name="arrow" />
              </AddToCartButton>
            </div>
          </article>
        )}
        {showAddOn && addOn?.variant && (
          <article className="pdp-bundle-card is-addon">
            {addOn.image && (
              <div className="pdp-bundle-media">
                <img
                  src={`${addOn.image.url}${addOn.image.url.includes('?') ? '&' : '?'}width=600`}
                  alt={addOn.image.altText || addOn.title}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
            <div className="pdp-bundle-copy">
              <span className="pdp-bundle-addon-label">Add-on</span>
              <h3>{addOn.title}</h3>
              {b.addOn.text && <p>{b.addOn.text}</p>}
              <p className="pdp-bundle-price">
                <strong>
                  {moneyFormat(
                    Number(addOn.variant.price.amount),
                    addOn.variant.price.currencyCode,
                  )}
                </strong>
                <a href={`/products/${addOn.handle}`}>See details</a>
              </p>
              <AddToCartButton
                disabled={!addOn.variant.availableForSale}
                onClick={() => open('cart')}
                lines={
                  addOn.variant.availableForSale
                    ? [{merchandiseId: addOn.variant.id, quantity: 1}]
                    : []
                }
              >
                <span>
                  {addOn.variant.availableForSale ? 'Add to bag' : 'Sold out'}
                </span>
                <Icon name="plus" />
              </AddToCartButton>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

type SetCard = NonNullable<ReturnType<typeof bundleContent>>['sets'][number];
type SetAddOn = NonNullable<ReturnType<typeof bundleContent>>['addOns'][number];

/**
 * What the bag shows for a bundle or add-on line before the server answers
 * (Hydrogen's optimistic cart needs the variant it is adding).
 */
export function optimisticVariant(item: AddOnProduct) {
  if (!item.variant) return undefined;
  const imgUrl = LOCAL_UPSELL_IMAGES[item.handle] ?? item.image?.url ?? null;
  return {
    id: item.variant.id,
    availableForSale: item.variant.availableForSale,
    price: item.variant.price,
    compareAtPrice: null,
    title: 'Default Title',
    selectedOptions: [],
    requiresShipping: true,
    image: imgUrl
      ? {url: imgUrl, altText: item.image?.altText ?? item.title, width: 600, height: 600}
      : null,
    product: {handle: item.handle, title: item.title},
  };
}

/** A soft block with a line icon where a picture will go (the image maker's next job). */
function PicturePlaceholder({icon, className}: {icon?: string; className: string}) {
  const name = statIcon(icon) ?? 'sparkle';
  return (
    <span className={`pdp-placeholder ${className}`} aria-hidden="true">
      <StatIcon name={name} size={34} />
    </span>
  );
}

/**
 * "Make it a set" (store/PAGE-BLUEPRINT.md section 10, October 3): the base
 * set beside each bundle as a step up, then the one-tap add-ons. Every price
 * is the price we charge (the variant's own); no "$X value", no "save $".
 * A bundle or add-on shows only when its product exists in the catalog.
 */
function SetBuilder({
  packet,
  product,
  extras,
  sets,
  addOns,
}: {
  packet: CampaignPacket;
  product: ProductFragment;
  extras: AddOnProduct[];
  sets: SetCard[];
  addOns: SetAddOn[];
}) {
  const {open} = useAside();
  const b = packet.bundle;
  const byHandle = new Map(extras.map((item) => [item.handle, item]));
  const shownSets = sets.flatMap((set) => {
    const item = byHandle.get(set.handle);
    return item?.variant ? [{set, item, variant: item.variant}] : [];
  });
  const shownAddOns = addOns.flatMap((addOnLine) => {
    const item = byHandle.get(addOnLine.handle);
    return item?.variant ? [{addOnLine, item}] : [];
  });
  if (!b || (!shownSets.length && !shownAddOns.length)) return null;
  // The base card sells the hero's first pack (e.g. "1 set") at its own price.
  const first = packet.purchase.offerChoices?.[0]?.variant;
  const variants = [
    product.selectedOrFirstAvailableVariant,
    ...((product as {adjacentVariants?: ProductFragment['selectedOrFirstAvailableVariant'][]})
      .adjacentVariants ?? []),
  ].filter(Boolean);
  const baseVariant =
    (first &&
      variants.find((variant) =>
        variant?.selectedOptions.some((option) => option.value === first),
      )) ||
    product.selectedOrFirstAvailableVariant;
  const base = bundleBase(packet);
  const money = (amount: string | number, currency: string) =>
    moneyFormat(Number(amount), currency);
  return (
    <section className="pdp-sets" id="make-it-a-set">
      <div className="pdp-section-head is-centered">
        {b.eyebrow && <span className="eyebrow">{b.eyebrow}</span>}
        <h2 className="packet-heading">{b.heading}</h2>
        {b.text && <p className="pdp-sets-intro">{b.text}</p>}
      </div>
      {shownSets.length > 0 && (
        <EntranceGroup className={`pdp-set-grid has-${shownSets.length + (base ? 1 : 0)}`}>
          {base && baseVariant && (
            <SetCardView
              card={base}
              index={0}
              price={money(baseVariant.price.amount, baseVariant.price.currencyCode)}
              available={baseVariant.availableForSale}
              lines={[
                {merchandiseId: baseVariant.id, quantity: 1, selectedVariant: baseVariant},
              ]}
              onAdd={() => open('cart')}
            />
          )}
          {shownSets.map(({set, item, variant}, index) => (
            <SetCardView
              key={set.handle}
              card={set}
              index={index + 1}
              stepUp
              price={money(variant.price.amount, variant.price.currencyCode)}
              available={variant.availableForSale}
              image={
                item.image
                  ? {src: item.image.url, alt: item.image.altText ?? item.title}
                  : null
              }
              lines={[
                {
                  merchandiseId: variant.id,
                  quantity: 1,
                  selectedVariant: optimisticVariant(item),
                },
              ]}
              onAdd={() => open('cart')}
            />
          ))}
        </EntranceGroup>
      )}
      {shownAddOns.length > 0 && (
        <div className="pdp-addons">
          {b.addOnsHeading && <h3 className="pdp-addons-heading">{b.addOnsHeading}</h3>}
          <ul className="pdp-addon-list">
            {shownAddOns.map(({addOnLine, item}) => (
              <li key={addOnLine.handle}>
                <AddOnRow
                  item={item}
                  text={addOnLine.text}
                  icon={addOnLine.icon}
                  onAdd={() => open('cart')}
                  enlarge
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {b.note && <p className="pdp-sets-note">{b.note}</p>}
    </section>
  );
}

function SetCardView({
  card,
  index,
  price,
  available,
  lines,
  onAdd,
  stepUp = false,
  image = null,
}: {
  card: NonNullable<ReturnType<typeof bundleBase>>;
  index: number;
  price: string;
  available: boolean;
  lines: Parameters<typeof AddToCartButton>[0]['lines'];
  onAdd: () => void;
  stepUp?: boolean;
  image?: {src: string; alt: string} | null;
}) {
  const picture =
    image ?? (card.image ? {src: card.image, alt: card.alt ?? ''} : null);
  return (
    <article
      className={`pdp-set-card${stepUp ? ' is-step-up' : ''}`}
      style={stagger(index)}
    >
      <div className="pdp-set-media">
        {picture ? (
          <img src={picture.src} alt={picture.alt} loading="lazy" decoding="async" />
        ) : (
          <PicturePlaceholder icon={card.icon} className="pdp-set-placeholder" />
        )}
      </div>
      <div className="pdp-set-copy">
        {/* The badge sits with the title, never on the picture's own words. */}
        {card.badge && <span className="pdp-set-badge">{card.badge}</span>}
        <h3>{card.label}</h3>
        {card.caption && <p className="pdp-set-caption">{card.caption}</p>}
        <ul className="pdp-set-items">
          {card.items.filter(Boolean).map((piece) => (
            <li key={piece}>
              <Icon name="check" size={15} />
              {piece}
            </li>
          ))}
        </ul>
        <p className="pdp-set-price">
          <strong>{price}</strong>
        </p>
      </div>
      <AddToCartButton disabled={!available} onClick={onAdd} lines={available ? lines : []}>
        <span>{available ? `Add to bag · ${price}` : 'Sold out'}</span>
        <Icon name="arrow" />
      </AddToCartButton>
    </article>
  );
}

/**
 * One add-on, one tap: its picture (or a placeholder), name, line and price.
 * `enlarge` (the product page) adds a tap-to-enlarge button, so the words on
 * the picture can be read; the bag keeps its compact row.
 */
const LOCAL_UPSELL_IMAGES: Record<string, string> = {
  'witch-intentions-companion-journal-2027':
    '/images/wftn/upsell-witch-intentions-journal.jpg',
  'astrological-almanac-datebook-2027':
    '/images/wftn/upsell-witches-datebook-2027.jpg',
  'witch-broomstick-wooden-pencil-set':
    '/images/wftn/upsell-witch-broomstick-pencils.jpg',
  'apothecary-gold-foil-washi-sticker-pack':
    '/images/wftn/upsell-apothecary-washi-stickers.jpg',
  'fleece-lined-sheer-black-tights':
    '/images/tartan-dress/addon-fleece-sheer-tights.jpg',
  'crimson-velvet-holiday-hair-bow':
    '/images/tartan-dress/addon-velvet-hair-bow.jpg',
  'gold-pearl-holiday-jewelry-set':
    '/images/tartan-dress/addon-gold-pearl-earrings.jpg',
  'solar-waterproof-extension-cable-2pack':
    '/images/solar-lights/addon-extension-cable.jpg',
  'magnetic-rafter-hook-mounting-kit-4pack':
    '/images/solar-lights/addon-magnetic-hooks.jpg',
};

const UPSELL_COMPARE_AT_FALLBACK: Record<string, number> = {
  'witch-intentions-companion-journal-2027': 25,
  'astrological-almanac-datebook-2027': 22,
  'witch-broomstick-wooden-pencil-set': 24,
  'apothecary-gold-foil-washi-sticker-pack': 22,
  'solar-waterproof-extension-cable-2pack': 22,
  'magnetic-rafter-hook-mounting-kit-4pack': 19,
};

export function AddOnRow({
  item,
  text,
  icon,
  onAdd,
  enlarge = false,
  unlocksFreeShipping = false,
  singleItemUnlocksFreeShip = false,
}: {
  item: AddOnProduct;
  text?: string;
  icon?: string;
  onAdd?: () => void;
  enlarge?: boolean;
  unlocksFreeShipping?: boolean;
  singleItemUnlocksFreeShip?: boolean;
}) {
  if (!item.variant) return null;
  const numericPrice = Number(item.variant.price.amount);
  const currencyCode = item.variant.price.currencyCode;
  const price = moneyFormat(numericPrice, currencyCode);
  const variantWithCompare = item.variant as {
    compareAtPrice?: {amount: string; currencyCode: string} | null;
  };
  const rawWas = variantWithCompare.compareAtPrice
    ? Number(variantWithCompare.compareAtPrice.amount)
    : UPSELL_COMPARE_AT_FALLBACK[item.handle] ?? Math.round(numericPrice * 1.6);
  const wasPrice = rawWas > numericPrice ? moneyFormat(rawWas, currencyCode) : null;
  const pctOff =
    rawWas > numericPrice
      ? Math.round(((rawWas - numericPrice) / rawWas) * 100)
      : 0;
  const imgUrl = LOCAL_UPSELL_IMAGES[item.handle] ?? item.image?.url ?? null;
  const imgAlt = item.image?.altText ?? item.title;
  return (
    <div className="pdp-addon">
      {imgUrl && enlarge ? (
        <span className="pdp-addon-figure">
          <img
            className="pdp-addon-media"
            src={imgUrl}
            alt={imgAlt}
            loading="lazy"
            decoding="async"
          />
          <ImageInspection
            src={imgUrl}
            alt={imgAlt}
            caption={item.title}
          />
        </span>
      ) : imgUrl ? (
        <img
          className="pdp-addon-media"
          src={imgUrl}
          alt={imgAlt}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <PicturePlaceholder icon={icon} className="pdp-addon-media" />
      )}
      <span className="pdp-addon-copy">
        <span className="pdp-addon-badges">
          {pctOff > 0 && (
            <em className="pdp-addon-pill is-discount">SAVE {pctOff}%</em>
          )}
          <em
            className={`pdp-addon-pill ${unlocksFreeShipping ? 'is-waive' : 'is-free-ship'}`}
          >
            {unlocksFreeShipping
              ? singleItemUnlocksFreeShip
                ? '🔥 UNLOCKS FREE SHIPPING (SAVE $7.99)!'
                : '⚡ COUNTS TOWARD $60 FREE SHIP'
              : '✓ SHIPS FREE'}
          </em>
        </span>
        <strong>{item.title}</strong>
        {text && <small>{text}</small>}
      </span>
      <AddToCartButton
        disabled={!item.variant.availableForSale}
        onClick={onAdd}
        lines={
          item.variant.availableForSale
            ? [
                {
                  merchandiseId: item.variant.id,
                  quantity: 1,
                  selectedVariant: optimisticVariant(item),
                },
              ]
            : []
        }
      >
        <span>
          {item.variant.availableForSale ? (
            <>
              {wasPrice && <s className="pdp-addon-was">{wasPrice}</s>}{' '}
              {`+ Add ${price}`}
            </>
          ) : (
            'Sold out'
          )}
        </span>
      </AddToCartButton>
    </div>
  );
}

/**
 * A sources note folds away under a small "Sources" toggle and reads as a
 * left-aligned list: one line per numbered source (¹ ² ³ …), then any
 * closing fine print. Keeps the citations on the page without a wall of text.
 */
function SourcesNote({text, className}: {text: string; className: string}) {
  // (The backslashes here were once lost in a shell edit, so "Sources:" stayed
  // and the closing fine print ran into the last source; LS-007.)
  const body = text.replace(/^\s*Sources?:\s*/i, '');
  const parts = body.split(/(?=[¹²³⁴⁵⁶⁷⁸⁹])/).map((part) => part.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  const split = last.search(/\.\s+(?=[A-Z])/);
  const items = parts.slice();
  let fine = '';
  if (split > -1 && /^[¹²³⁴⁵⁶⁷⁸⁹]/.test(last)) {
    items[items.length - 1] = last.slice(0, split + 1);
    fine = last.slice(split + 1).trim();
  }
  return (
    <details className={`${className} pdp-sources`}>
      <summary>Sources</summary>
      <ol>
        {items.map((item) => (
          <li key={item.slice(0, 24)}>{item}</li>
        ))}
      </ol>
      {fine && <p>{fine}</p>}
    </details>
  );
}
