import {Await, Link, NavLink, useLocation} from 'react-router';
import {Suspense, useEffect, useState} from 'react';
import {useOptimisticCart} from '@shopify/hydrogen';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside, useAside} from './Aside';
import {CartMain} from './CartMain';
import {Icon} from './Icons';
import {campaign} from '~/content/templates';
import {paletteCss, type Palette} from '~/content/palettes';
import {isSampleCatalog} from '~/lib/store-policies';
import {
  localHref,
  primaryNavigation,
  SHOP_URL,
  showsProduct,
  storeNavigation,
  useActiveProduct,
  withProductParam,
  type NavItem,
} from '~/content/navigation';
import {OfferBar, SignupOffer} from './Offer';
import {
  scrollToSection,
  scrollToTop,
  sectionFor,
  whenDrawersClosed,
} from '~/lib/scroll-to-section';
import {setupReveal} from '~/lib/reveal';
import {PaletteSwitcher} from './PaletteSwitcher';
import {supportLabel} from './SupportCenter';
import {
  siteContent,
  SUPPORT_EMAIL,
  SUPPORT_REPLY_TIME,
} from '~/content/site';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  /** The help chat is live (an OpenRouter key, and MERRIVY_CHAT is not off). */
  helpChat?: boolean;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children,
  helpChat = false,
  publicStoreDomain,
}: PageLayoutProps) {
  const isSample = isSampleCatalog(publicStoreDomain);
  const {pathname, hash} = useLocation();
  const {productPath: effectiveProductPath, activePacket} = useActiveProduct();
  // Arriving from another page at a section (FAQ from Help, say): settle it
  // under the sticky header once the page is there.
  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(
      () => scrollToSection(hash, {instant: true}),
      80,
    );
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);
  // Sections below the first screen fade and rise in as they arrive.
  useEffect(() => setupReveal(), [pathname]);
  // iOS Safari shows :active press styles only when a touch listener exists.
  useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, {passive: true});
    return () => document.removeEventListener('touchstart', noop);
  }, []);
  return (
    <Aside.Provider>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {activePacket?.theme && (
        <style>{paletteCss(activePacket.theme as Partial<Palette>)}</style>
      )}
      <OfferBar isSample={isSample} productPath={effectiveProductPath} />
      <header className="m-header">
        <MenuToggle />
        <Link
          to={effectiveProductPath}
          className="wordmark"
          aria-label="Merrivy"
        >
          merrivy
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          <NavItems items={primaryNavigation(isSample, activePacket, effectiveProductPath)} />
        </nav>
        <div className="header-actions">
          <Suspense fallback={<CartToggle count={0} />}>
            <Await resolve={cart}>
              {(value) => <CartCount cart={value} />}
            </Await>
          </Suspense>
        </div>
      </header>
      <Aside type="cart" heading="Your bag">
        <Suspense
          fallback={<p className="loading-state">Getting your bag ready…</p>}
        >
          <Await resolve={cart}>
            {(value) => <CartMain cart={value} layout="aside" />}
          </Await>
        </Suspense>
      </Aside>
      <Aside type="mobile" heading="Explore Merrivy">
        <MobileLinks
          items={primaryNavigation(isSample, activePacket, effectiveProductPath)}
          productPath={effectiveProductPath}
        />
      </Aside>
      <main id="main-content">{children}</main>
      <SignupOffer isSample={isSample} variant="band" />
      {!activePacket.sections?.length && (
        <SignupOffer isSample={isSample} variant="popup" />
      )}
      {/* Local dev server only: production builds drop the switcher. */}
      {import.meta.env.DEV && (
        <PaletteSwitcher
          productDefault={(activePacket.theme as {name?: string})?.name ?? 'Default'}
        />
      )}
      <footer className="m-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <Link
              className="wordmark"
              to={effectiveProductPath}
            >
              merrivy
            </Link>
            <p>
              <Lines text={siteContent.tagline} />
            </p>
          </div>
          <div>
            <h3>On This Page</h3>
            <NavItems items={primaryNavigation(isSample, activePacket, effectiveProductPath)} />
          </div>
          <nav aria-label="Support" className="footer-support">
            <h3>Support</h3>
            {storeNavigation.footerSupport.map(({to, label}) => (
              <Link key={to} to={withProductParam(to, effectiveProductPath)}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="footer-contact">
            <h3>{supportLabel(helpChat)}</h3>
            {helpChat && <p>Chat with us any time.</p>}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            <p>Email replies within {SUPPORT_REPLY_TIME}.</p>
            {/* The support promise is the heading above; no second copy. */}
            <ul className="footer-trust">
              <li>Secure checkout</li>
              <li>30-day returns</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Merrivy</span>
        </div>
      </footer>
    </Aside.Provider>
  );
}
/** Text with line breaks, as separate lines. */
function Lines({text}: {text: string}) {
  return (
    <>
      {text.split('\n').map((line, index) => (
        <span key={line}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}
function CartCount({cart}: {cart: CartApiQueryFragment | null}) {
  const optimistic = useOptimisticCart(cart);
  const count = (optimistic?.lines?.nodes ?? []).reduce((sum, line) => {
    if (
      line.merchandise?.product?.handle === 'shipping-protection' ||
      line.merchandise?.id === 'gid://shopify/ProductVariant/51054093893689'
    ) {
      return sum;
    }
    return sum + (line.quantity ?? 0);
  }, 0);
  return <CartToggle count={count} />;
}
function CartToggle({count}: {count: number}) {
  const {open} = useAside();
  return (
    <button
      className="bag-toggle"
      onClick={() => open('cart')}
      aria-label={`Open bag, ${count} items`}
    >
      <Icon name="bag" />
      <span>Bag ({count})</span>
    </button>
  );
}
function MenuToggle() {
  const {open, type} = useAside();
  return (
    <button
      aria-expanded={type === 'mobile'}
      aria-controls="mobile-drawer"
      className="menu-toggle"
      onClick={() => open('mobile')}
      aria-label="Open menu"
    >
      <Icon name="menu" />
    </button>
  );
}
/**
 * Shop is the product page; the section jumps stay on the page when it
 * already shows the product (home or the product page). Those jumps scroll
 * here in one tap (see scroll-to-section.ts) instead of changing the hash,
 * which React Router answered by restoring an old scroll position.
 */
function NavItems({
  items,
  onNavigate,
  withArrow = false,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  withArrow?: boolean;
}) {
  const {pathname} = useLocation();
  const jump = (event: React.MouseEvent, scroll: () => boolean | void) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (onNavigate) {
      onNavigate();
      whenDrawersClosed(() => void scroll());
    } else scroll();
  };
  return (
    <>
      {items.map(({to, label}) => {
        const href = localHref(to, pathname);
        const arrow = withArrow ? <Icon name="arrow" /> : null;
        if (href.startsWith('#'))
          return (
            <a
              key={to}
              href={href}
              onClick={(event) => {
                if (!sectionFor(href)) return;
                jump(event, () => scrollToSection(href));
              }}
            >
              {label}
              {arrow}
            </a>
          );
        // Overview on a page that already shows the product: back to its top.
        if ((to === SHOP_URL || to === pathname) && showsProduct(pathname))
          return (
            <a
              key={to}
              href={to}
              onClick={(event) => jump(event, scrollToTop)}
            >
              {label}
              {arrow}
            </a>
          );
        return to.includes('#') ? (
          <Link key={to} to={href} onClick={onNavigate}>
            {label}
            {arrow}
          </Link>
        ) : (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}>
            {label}
            {arrow}
          </NavLink>
        );
      })}
    </>
  );
}
function MobileLinks({
  items,
  productPath = '/',
}: {
  items: NavItem[];
  productPath?: string;
}) {
  const {close} = useAside();
  return (
    <div className="mobile-menu-content">
      <nav className="mobile-links" aria-label="Mobile navigation">
        <NavItems items={items} onNavigate={close} withArrow />
      </nav>
      <nav className="mobile-support-links" aria-label="Customer care">
        <span className="eyebrow">Here to help</span>
        {storeNavigation.support.map(({to, label}) => (
          <NavLink onClick={close} key={to} to={withProductParam(to, productPath)}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
