import {useEffect, useRef} from 'react';
import {
  campaign,
  HERO_ICONS,
  reviewCards,
  sectionPicture,
  type CampaignPacket,
  type HeroIcon,
} from '~/content/templates';
import {Icon} from './Icons';

type Props = {packet?: CampaignPacket};

/** Packet icon keys are checked by packet-tools; unknown keys fall back. */
export const heroIcon = (name: string): HeroIcon =>
  (HERO_ICONS as readonly string[]).includes(name)
    ? (name as HeroIcon)
    : 'check';

/** Why it's better: ours against an ordinary alternative, row by row. */
export function ComparisonSection({packet = campaign}: Props) {
  const c = packet.comparison;
  if (!c?.rows?.length) return null;
  return (
    <section className="pdp-compare" id="why-better">
      <div className="pdp-section-head is-centered">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
      </div>
      <div className="pdp-compare-table" role="table" aria-label={c.eyebrow}>
        <div className="pdp-compare-row is-head" role="row">
          <span role="columnheader" className="pdp-compare-label">
            <span className="sr-only">Feature</span>
          </span>
          <span role="columnheader" className="is-ours">
            {c.oursLabel}
          </span>
          <span role="columnheader" className="is-theirs">
            {c.theirsLabel}
          </span>
        </div>
        {c.rows.map((row) => (
          <div className="pdp-compare-row" role="row" key={row.label}>
            <span role="rowheader" className="pdp-compare-label">
              {row.label}
            </span>
            <span role="cell" className="is-ours">
              <Icon name="check" size={16} />
              {row.ours}
            </span>
            <span role="cell" className="is-theirs">
              <Icon name="close" size={14} />
              {row.theirs}
            </span>
          </div>
        ))}
      </div>
      {c.note && <p className="pdp-fine-print">{c.note}</p>}
    </section>
  );
}

export function HowItWorksSection({packet = campaign}: Props) {
  const c = packet.howItWorks;
  if (!c?.steps?.length) return null;
  return (
    <section className="pdp-how" id="how-it-works">
      <div className="pdp-section-head">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
      </div>
      <ol className="pdp-how-steps">
        {c.steps.map((step, index) => (
          <li key={step.title}>
            <span className="pdp-how-number" aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InTheBoxSection({packet = campaign}: Props) {
  const c = packet.inTheBox;
  if (!c?.items?.length) return null;
  const picture = sectionPicture(c);
  return (
    <section
      className={`pdp-box ${picture ? 'has-picture' : ''}`}
      id="in-the-box"
    >
      <div className="pdp-box-head">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2
          className={`packet-heading${picture && c.pictureHasText ? ' sr-only' : ''}`}
        >
          {c.heading}
        </h2>
      </div>
      {picture && (
        <figure className="pdp-box-picture">
          <img src={picture.src} alt={picture.alt} loading="lazy" decoding="async" />
        </figure>
      )}
      <ul className="pdp-box-list">
        {c.items.map((item) => (
          <li key={item.name}>
            <span className="pdp-box-qty">{item.qty}</span>
            <span>
              <strong>{item.name}</strong>
              {item.text && <small>{item.text}</small>}
            </span>
          </li>
        ))}
      </ul>
      {c.note && <p className="pdp-fine-print">{c.note}</p>}
    </section>
  );
}

const PIXELS_PER_SECOND = 32;

/**
 * Reviews that drift past on their own, pause under a finger or pointer and
 * can be swiped. Reduced motion gets a still, snap-scrolling row instead.
 */
export function ReviewsSlider({
  packet = campaign,
  isSample = false,
}: Props & {isSample?: boolean}) {
  const {items} = reviewCards(packet, isSample);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el || items.length < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;
    let frame = 0;
    let last = 0;
    let position = el.scrollLeft;
    let held = false;
    let visible = true;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const hold = () => {
      held = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const release = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        position = el.scrollLeft;
        held = false;
      }, 1800);
    };
    const step = (time: number) => {
      const elapsed = last ? Math.min(time - last, 64) : 0;
      last = time;
      if (!held && visible) {
        const half = el.scrollWidth / 2;
        position += (PIXELS_PER_SECOND * elapsed) / 1000;
        if (position >= half) position -= half;
        el.scrollLeft = Math.round(position);
      }
      frame = requestAnimationFrame(step);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(el);
    const events: [string, () => void][] = [
      ['pointerenter', hold],
      ['pointerleave', release],
      ['touchstart', hold],
      ['touchend', release],
      ['focusin', hold],
      ['focusout', release],
      ['wheel', () => (hold(), release())],
    ];
    for (const [name, fn] of events)
      el.addEventListener(name, fn, {passive: true});
    el.classList.add('is-moving');
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (resumeTimer) clearTimeout(resumeTimer);
      for (const [name, fn] of events) el.removeEventListener(name, fn);
      el.classList.remove('is-moving');
    };
  }, [items.length]);

  if (!items.length) return null;
  const c = packet.reviews;
  const card = (item: (typeof items)[number], copy: boolean, i: number) => (
    <figure
      className={`review-card ${item.photo?.src ? 'has-photo' : ''}`}
      key={`${copy ? 'copy' : 'card'}-${i}`}
      aria-hidden={copy || undefined}
      data-copy={copy || undefined}
    >
      {item.photo?.src && (
        <img
          src={item.photo.src}
          alt={copy ? '' : item.photo.alt}
          loading="lazy"
          decoding="async"
        />
      )}
      {item.rating !== null && (
        <span
          className="review-card-stars"
          role="img"
          aria-label={`${item.rating} out of 5 stars`}
        >
          {'★'.repeat(item.rating)}
          <span aria-hidden="true">{'★'.repeat(5 - item.rating)}</span>
        </span>
      )}
      <blockquote>{item.text}</blockquote>
      <figcaption>
        <strong>{item.name}</strong>
        {item.location && <span>{item.location}</span>}
      </figcaption>
    </figure>
  );
  return (
    <section className="pdp-reviews-slider" id="reviews">
      <div className="pdp-section-head is-centered">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
      </div>
      <div
        className="review-track"
        ref={track}
        // A scrollable region must be reachable by keyboard to scroll it.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label={`${c.heading} Swipe or use arrow keys to see more.`}
      >
        <div className="review-row">
          {items.map((item, i) => card(item, false, i))}
          {items.length > 1 && items.map((item, i) => card(item, true, i))}
        </div>
      </div>
    </section>
  );
}
