/**
 * Sections fade and rise in as they reach the screen, once (October 2).
 *
 * Only sections that start below the first screen are hidden, after the page
 * has loaded, so the first screen never waits on an animation and nothing
 * already visible blinks. With reduced motion, or without
 * IntersectionObserver, nothing is hidden at all. Opacity and transform only
 * (styles in motion.css); the classes come off once the fade is done, so no
 * section keeps a transform that could trap a fixed element.
 */

/** Sections below the hero on the product page, About and the help pages. */
export const REVEAL_SELECTOR = [
  '[data-template-section] > section',
  '.about-page > section',
  '.support-outro',
].join(', ');

export const REVEAL_PENDING = 'reveal-pending';
export const REVEAL_SHOWN = 'is-revealed';

type RevealWindow = Pick<Window, 'innerHeight' | 'setTimeout'> & {
  matchMedia?: Window['matchMedia'];
  IntersectionObserver?: typeof IntersectionObserver;
};

export function motionAllowed(win: RevealWindow) {
  if (typeof win.IntersectionObserver !== 'function') return false;
  return !(
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Hide the sections below the first screen and reveal each as it enters. */
export function setupReveal(
  doc: Pick<Document, 'querySelectorAll'> = document,
  win: RevealWindow = window,
) {
  if (!motionAllowed(win)) return () => {};
  const sections = [...doc.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)].filter(
    (el) => el.getBoundingClientRect().top > win.innerHeight,
  );
  if (!sections.length) return () => {};

  const finish = (el: HTMLElement) =>
    el.classList.remove(REVEAL_PENDING, REVEAL_SHOWN);
  const observer = new win.IntersectionObserver!(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        el.classList.add(REVEAL_SHOWN);
        // The fade takes 600ms (motion.css); then the classes come off.
        win.setTimeout(() => finish(el), 800);
      }
    },
    // Start just before the section reaches the screen.
    {rootMargin: '0px 0px -8% 0px', threshold: 0},
  );
  for (const el of sections) {
    el.classList.add(REVEAL_PENDING);
    observer.observe(el);
  }
  return () => {
    observer.disconnect();
    sections.forEach(finish);
  };
}
