import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {Icon} from './Icons';

/*
 * Small motion pieces for the product page (October 3, owner: "it doesn't
 * look interactive, gamified, or interesting at all"): numbers that count up,
 * blocks that draw in as they arrive, a swipe carousel that advances on its
 * own and flip cards. Opacity and transform only (plus the icons' stroke
 * draw); the server renders the finished state, so nothing shifts and
 * nothing hides without JavaScript; prefers-reduced-motion keeps it all still.
 */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True once the browser says motion is welcome (never on the server). */
export function useMotionAllowed() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setAllowed(true);
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAllowed(!query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return allowed;
}

/**
 * How a block enters: "still" on the server, with reduced motion, or when it
 * is already on screen (shown as it is); "armed" while it waits below the
 * screen (CSS holds its start pose); "in" once it arrives (CSS animates it).
 */
export type Entrance = 'still' | 'armed' | 'in';
export function useEntrance(ref: RefObject<Element>) {
  const [state, setState] = useState<Entrance>('still');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || reducedMotion())
      return;
    // Already on screen: never hide what someone is looking at.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState('armed');
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setState('in');
      },
      {rootMargin: '0px 0px -12% 0px', threshold: 0},
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return state;
}

const formatCount = (value: number) =>
  Math.round(value).toLocaleString('en-US');

/**
 * A number that counts up from 0 when its block enters. A hidden copy of the
 * final number holds the width, so nothing around it moves; screen readers
 * hear only the final number.
 */
export function CountUp({
  value,
  entrance,
  duration = 1400,
}: {
  value: number;
  entrance: Entrance;
  duration?: number;
}) {
  const final = formatCount(value);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (entrance === 'armed') {
      setShown(formatCount(0));
      return;
    }
    if (entrance !== 'in') return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? formatCount(value * eased) : null);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [entrance, value, duration]);
  return (
    <span className="count-up">
      <span className="count-up-size" aria-hidden="true">
        {final}
      </span>
      <span className="count-up-live" aria-hidden="true">
        {shown ?? final}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}

/**
 * A horizontal swipe track that knows which slide is in the middle. With
 * `autoMs` it moves on by itself, but only while it is on screen and the tab
 * is visible, never with reduced motion, and it holds still under a mouse,
 * a finger (for a moment after) or keyboard focus, or once paused.
 */
export function useCarousel(count: number, {autoMs = 0} = {}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const motion = useMotionAllowed();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [cycle, setCycle] = useState(0);
  const release = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const middle = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let distance = Infinity;
      Array.from(el.children).forEach((child, i) => {
        const slide = child as HTMLElement;
        const d = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
        if (d < distance) {
          distance = d;
          best = i;
        }
      });
      setIndex(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [count]);

  useEffect(() => {
    const el = root.current;
    if (!autoMs || !el || typeof IntersectionObserver === 'undefined') return;
    let visible = false;
    const sync = () => setOnScreen(visible && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      {threshold: 0.35},
    );
    observer.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [autoMs]);

  const goTo = useCallback(
    (target: number) => {
      const el = track.current;
      if (!el || !count) return;
      const slide = el.children[((target % count) + count) % count] as
        | HTMLElement
        | undefined;
      if (!slide) return;
      el.scrollTo({
        left: slide.offsetLeft + slide.offsetWidth / 2 - el.clientWidth / 2,
        behavior: reducedMotion() ? 'auto' : 'smooth',
      });
    },
    [count],
  );

  const auto = autoMs > 0 && motion && count > 1;
  const running = auto && onScreen && !paused && !held;
  useEffect(() => {
    if (!running) return;
    setCycle((n) => n + 1);
    const timer = setTimeout(() => goTo(index + 1), autoMs);
    return () => clearTimeout(timer);
  }, [running, index, autoMs, goTo]);
  useEffect(() => () => clearTimeout(release.current), []);

  const hold = () => {
    clearTimeout(release.current);
    setHeld(true);
  };
  const letGo = (delay = 0) => {
    clearTimeout(release.current);
    release.current = setTimeout(() => setHeld(false), delay);
  };
  const handlers = {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') hold();
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') letGo();
    },
    onTouchStart: () => hold(),
    onTouchEnd: () => letGo(2600),
    // Keyboard focus holds it; a tap on a dot does not stop it for good.
    onFocus: (event: FocusEvent) => {
      if ((event.target as Element).matches?.(':focus-visible')) hold();
    },
    onBlur: (event: FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        letGo();
    },
  };
  return {root, track, index, goTo, auto, running, paused, setPaused, cycle, handlers};
}

/**
 * Dots under a carousel. The current dot is a pill that fills while the
 * carousel waits to move on, so the 5-second rhythm is visible.
 */
export function CarouselDots({
  count,
  index,
  goTo,
  label,
  running = false,
  cycle = 0,
  autoMs = 0,
  done,
}: {
  count: number;
  index: number;
  goTo: (index: number) => void;
  /** Names one slide for screen readers, e.g. "quote". */
  label: string;
  running?: boolean;
  cycle?: number;
  autoMs?: number;
  /** Slides already revealed (flip cards); they show filled. */
  done?: Set<number>;
}) {
  return (
    <div className="carousel-dots">
      {Array.from({length: count}, (_, i) => (
        <button
          key={i}
          type="button"
          className={`carousel-dot${i === index ? ' is-current' : ''}${done?.has(i) ? ' is-done' : ''}`}
          aria-label={`Show ${label} ${i + 1} of ${count}`}
          aria-current={i === index ? 'true' : undefined}
          onClick={() => goTo(i)}
        >
          {i === index && (
            <span
              key={running ? `run-${cycle}` : 'still'}
              className={`carousel-dot-fill${running ? ' is-running' : ''}`}
              style={{'--carousel-ms': `${autoMs}ms`} as CSSProperties}
            />
          )}
        </button>
      ))}
    </div>
  );
}

/** Previous and next buttons for a carousel. */
export function CarouselArrows({
  index,
  goTo,
  label,
}: {
  index: number;
  goTo: (index: number) => void;
  label: string;
}) {
  return (
    <div className="carousel-arrows">
      <button
        type="button"
        className="carousel-arrow"
        aria-label={`Previous ${label}`}
        onClick={() => goTo(index - 1)}
      >
        <Icon name="chevron-left" size={18} />
      </button>
      <button
        type="button"
        className="carousel-arrow"
        aria-label={`Next ${label}`}
        onClick={() => goTo(index + 1)}
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </div>
  );
}

/** Pause and play for a carousel that moves on its own (WCAG 2.2.2). */
export function CarouselPause({
  paused,
  setPaused,
  label,
}: {
  paused: boolean;
  setPaused: (paused: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="carousel-pause"
      aria-label={paused ? `Play ${label}` : `Pause ${label}`}
      aria-pressed={paused}
      onClick={() => setPaused(!paused)}
    >
      {paused ? (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

const FlipGlyph = () => (
  <svg
    className="flip-glyph"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 11a8 8 0 0 0-14.7-4.3M4 13a8 8 0 0 0 14.7 4.3" />
    <path d="M5 3v4h4M19 21v-4h-4" />
  </svg>
);

/**
 * A card with a front and a back. One tap anywhere on the card turns it
 * (the face's button covers the card); the hidden face is out of the tab
 * order and hidden from screen readers. Both faces share one grid cell, so
 * the card is as tall as its taller face and nothing moves when it turns.
 */
export function FlipCard({
  front,
  back,
  flipLabel,
  backLabel,
  className = '',
  style,
  onFlip,
  children,
}: {
  front: ReactNode;
  back: ReactNode;
  flipLabel: ReactNode;
  backLabel: ReactNode;
  className?: string;
  style?: CSSProperties;
  onFlip?: (flipped: boolean) => void;
  /** Anything outside the turning faces (e.g. a decoration). */
  children?: ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const frontButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const turn = () => {
    const next = !flipped;
    const hadFocus =
      document.activeElement === frontButton.current ||
      document.activeElement === backButton.current;
    setFlipped(next);
    onFlip?.(next);
    if (hadFocus)
      requestAnimationFrame(() =>
        (next ? backButton : frontButton).current?.focus({preventScroll: true}),
      );
  };
  return (
    <div
      className={`flip-card${flipped ? ' is-flipped' : ''} ${className}`}
      style={style}
    >
      {children}
      <div className="flip-card-inner">
        <div className="flip-face is-front" aria-hidden={flipped || undefined}>
          {front}
          <button
            ref={frontButton}
            type="button"
            className="flip-toggle"
            onClick={turn}
            tabIndex={flipped ? -1 : undefined}
          >
            <span>{flipLabel}</span>
            <FlipGlyph />
          </button>
        </div>
        <div className="flip-face is-back" aria-hidden={!flipped || undefined}>
          {back}
          <button
            ref={backButton}
            type="button"
            className="flip-toggle"
            onClick={turn}
            tabIndex={flipped ? undefined : -1}
          >
            <span>{backLabel}</span>
            <FlipGlyph />
          </button>
        </div>
      </div>
    </div>
  );
}
