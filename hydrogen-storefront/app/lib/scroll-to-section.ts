/**
 * One-tap jumps to a section of the page (October 2).
 *
 * A plain `<a href="#reviews">` let the browser jump, then React Router saw
 * the hash change as a back/forward navigation and restored an old scroll
 * position, so the first tap landed somewhere else and only a second tap of
 * the same link worked. Section links now scroll here instead: smoothly
 * (instantly with reduced motion), under the sticky header and the section
 * chips, without touching the router's history.
 */

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** The element's top in the document, from layout (ignores transforms). */
export function layoutTop(element: HTMLElement) {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

/**
 * Space the sticky header (and the product page's section chips, which show
 * once the hero has scrolled away) cover at the top of the screen.
 */
export function stickyOffset(doc: Document = document) {
  const header = doc.querySelector<HTMLElement>('.m-header');
  const chips = doc.querySelector<HTMLElement>('.pdp-section-nav');
  return (header?.offsetHeight ?? 0) + (chips?.offsetHeight ?? 0) + 12;
}

/** Where the page must scroll so the section starts just under the header. */
export function sectionScrollTop(element: HTMLElement, offset: number) {
  return Math.max(0, Math.round(layoutTop(element) - offset));
}

/** The section a `#hash` link points at, or null when it is not on the page. */
export function sectionFor(hash: string, doc: Document = document) {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  return id ? doc.getElementById(id) : null;
}

/**
 * Scroll to the section. Returns false when it isn't on this page, so the
 * caller can let the link navigate normally.
 */
export function scrollToSection(hash: string, {instant = false} = {}) {
  const target = sectionFor(hash);
  if (!target) return false;
  const behavior: ScrollBehavior =
    instant || prefersReducedMotion() ? 'auto' : 'smooth';
  const top = () => sectionScrollTop(target, stickyOffset());
  window.scrollTo({top: top(), behavior});

  // Pictures above the section can finish loading mid-scroll and move it;
  // once scrolling stops, correct the landing unless the shopper took over.
  let tookOver = false;
  let finished = false;
  const takeOver = () => (tookOver = true);
  const done = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('wheel', takeOver);
    window.removeEventListener('touchstart', takeOver);
    window.removeEventListener('scrollend', done);
    if (!tookOver && Math.abs(window.scrollY - top()) > 6)
      window.scrollTo({top: top(), behavior});
  };
  window.addEventListener('wheel', takeOver, {passive: true, once: true});
  window.addEventListener('touchstart', takeOver, {passive: true, once: true});
  if (behavior === 'smooth' && 'onscrollend' in window)
    window.addEventListener('scrollend', done, {once: true});
  window.setTimeout(done, behavior === 'smooth' ? 1200 : 60);

  // Move keyboard focus with the scroll, as an anchor jump would.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({preventScroll: true});
  return true;
}

/** Scroll back to the top of the page (Shop on a page that shows the product). */
export function scrollToTop() {
  window.scrollTo({top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth'});
}

/**
 * Run once no drawer (menu or bag) is open, so a jump from the menu starts
 * after the menu has slid away and the page can scroll again.
 */
export function whenDrawersClosed(run: () => void, doc: Document = document) {
  const started = Date.now();
  const check = () => {
    if (!doc.querySelector('dialog[open]') || Date.now() - started > 600) run();
    else window.requestAnimationFrame(check);
  };
  window.requestAnimationFrame(check);
}
