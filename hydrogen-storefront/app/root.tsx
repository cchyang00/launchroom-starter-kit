import {useEffect} from 'react';
import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from 'react-router';
import type {Route} from './+types/root';
import favicon from '~/assets/favicon.svg';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import fontStyles from '~/styles/fonts.css?url';
import inspectionStyles from '~/styles/product-inspection.css?url';
import supportingStyles from '~/styles/supporting-pages.css?url';
import shopStyles from '~/styles/shop.css?url';
import productStyles from '~/styles/product.css?url';
import offerStyles from '~/styles/offer.css?url';
import pdpSectionStyles from '~/styles/pdp-sections.css?url';
import motionStyles from '~/styles/motion.css?url';
import interactiveStyles from '~/styles/pdp-interactive.css?url';
import helpChatStyles from '~/styles/help-chat.css?url';
import supportCenterStyles from '~/styles/support-center.css?url';
import {PageLayout} from './components/PageLayout';
import {
  packetForPathname,
  resolveActiveProductPath,
  SHOP_URL,
} from './content/navigation';
import {campaign} from './content/templates';
import {siteContent} from './content/site';
import {paletteBootScript, paletteCss, type Palette} from './content/palettes';
import {ErrorPage} from './components/ErrorPage';
import {isSampleCatalog} from '~/lib/store-policies';
import {loadExtras} from '~/lib/product-query';

export type RootLoader = typeof loader;

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}): boolean => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Revalidate when navigating between different `/products/<handle>` funnels
  if (
    currentUrl.pathname.startsWith('/products/') &&
    nextUrl.pathname.startsWith('/products/') &&
    currentUrl.pathname !== nextUrl.pathname
  ) {
    return true;
  }

  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ];
}

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;
  const activeProductPath = resolveActiveProductPath(args.request);

  return {
    ...deferredData,
    ...criticalData,
    activeProductPath,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    // AI Support Chat disabled per owner direction so it never confuses multi-product visitors
    helpChat: false,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;

  const [header, extras] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // The bundles and one-tap add-ons the page and the bag offer (October 3).
    loadExtras(context),
  ]);

  return {header, extras};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({children}: {children?: React.ReactNode}) {
  const nonce = useNonce();
  const location = useLocation();
  const rootData = useRouteLoaderData<RootLoader>('root');
  const activePacket = packetForPathname(
    rootData?.activeProductPath || SHOP_URL,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Local previews (the Launchroom store panes, QA) must never count as visits on the real pixels.
    if (import.meta.env.DEV) return;
    const w = window as any;
    if (!w.fbq) {
      const n: any = (w.fbq = function (...args: any[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      });
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const t = document.createElement('script');
      t.async = true;
      t.src = 'https://connect.facebook.net/en_US/fbevents.js';
      if (nonce) t.nonce = nonce;
      document.body.appendChild(t);
    }
    if (!w.__merrivyWetrackedLoaded) {
      w.__merrivyWetrackedLoaded = true;
      const wt = document.createElement('script');
      wt.async = true;
      wt.src = 'https://pixel.wetracked.io/ndfdtc-br.myshopify.com/events.js';
      if (nonce) wt.nonce = nonce;
      document.body.appendChild(wt);
    }

    const p = (location?.pathname || window.location.pathname || '').toLowerCase();
    let isSolar =
      p.includes('solar') ||
      sessionStorage.getItem('merrivy_active_pixel') === '1656598869345569';
    if (p.includes('solar')) {
      try {
        sessionStorage.setItem('merrivy_active_pixel', '1656598869345569');
      } catch {}
      isSolar = true;
    } else if (p.includes('witching-hour') || p.includes('planner')) {
      try {
        sessionStorage.setItem('merrivy_active_pixel', '1003355539496617');
      } catch {}
      isSolar = false;
    }
    const pixelId = isSolar ? '1656598869345569' : '1003355539496617';
    if (!w.__merrivyInitedPixels) w.__merrivyInitedPixels = {};
    if (!w.__merrivyInitedPixels[pixelId]) {
      w.__merrivyInitedPixels[pixelId] = true;
      w.fbq('init', pixelId);
    }
    w.fbq('trackSingle', pixelId, 'PageView');
    if (p.startsWith('/products/')) {
      const isDress = p.includes('tartan') || p.includes('plaid-bow');
      w.fbq('trackSingle', pixelId, 'ViewContent', {
        content_name: isSolar
          ? 'The Split-Panel Solar Indoor & Outdoor Ceiling Light Kit (2-Pack)'
          : isDress
            ? 'Holiday Tartan Plaid Satin-Bow Puff-Sleeve Babydoll Mini Dress'
            : 'Waiting for the Night: The Witching Hour 2027 Dated Weekly Planner',
        content_ids: [
          isSolar
            ? '10418906497081'
            : isDress
              ? '10418259001593'
              : '10416592814137',
        ],
        content_type: 'product_group',
        value: isSolar ? 39.99 : isDress ? 44.99 : 34.99,
        currency: 'USD',
      });
    }
  }, [location?.pathname, nonce]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* Every build stays out of search results until launch. */}
        <meta name="robots" content="noindex,nofollow" />
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        <link rel="stylesheet" href={fontStyles}></link>
        <link rel="stylesheet" href={inspectionStyles}></link>
        <link rel="stylesheet" href={supportingStyles}></link>
        <link rel="stylesheet" href={shopStyles}></link>
        <link rel="stylesheet" href={productStyles}></link>
        <link rel="stylesheet" href={offerStyles}></link>
        <link rel="stylesheet" href={pdpSectionStyles}></link>
        <link rel="stylesheet" href={motionStyles}></link>
        <link rel="stylesheet" href={interactiveStyles}></link>
        <link rel="stylesheet" href={helpChatStyles}></link>
        <link rel="stylesheet" href={supportCenterStyles}></link>
        {/* The active packet's theme is rendered on SSR with zero flash. */}
        <style suppressHydrationWarning>
          {paletteCss((activePacket.theme ?? campaign.theme) as Partial<Palette>)}
        </style>
        {import.meta.env.DEV && (
          <script
            nonce={nonce}
            // Browsers hide nonce values from the DOM after parsing.
            suppressHydrationWarning
            dangerouslySetInnerHTML={{__html: paletteBootScript()}}
          />
        )}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');
  const {pathname} = useLocation();

  if (!data) {
    return <Outlet />;
  }

  // A sample packet never shows on a connected store: demo claims must not reach
  // real shoppers. That is judged per page, not by the default packet, so a real
  // product's page always shows it. Local previews (dev only) show the sample too,
  // because the Store & Theme Hub displays the base theme's dummy product.
  const isReferenceCatalog =
    data.publicStoreDomain === 'mock.shop' ||
    data.publicStoreDomain.endsWith('.mock.shop');
  const pagePacket = packetForPathname(
    pathname.startsWith('/products/')
      ? pathname
      : data.activeProductPath || SHOP_URL,
  );
  if (
    !isReferenceCatalog &&
    !import.meta.env.DEV &&
    pagePacket.status === 'sample'
  ) {
    return (
      <main className="campaign-home setup-screen">
        <header className="m-header">
          <span className="wordmark">merrivy</span>
          <span className="setup-label">Private store setup</span>
        </header>
        <section className="campaign-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              {data.header.shop.name} · Connected to Shopify
            </span>
            <h1>
              Something
              <br />
              <em>worth finding.</em>
            </h1>
            <p>
              Our storefront is connected. We’re choosing the product that
              belongs here.
            </p>
            <p>
              Product selection, final content and checkout testing come next.
              No orders are available in this preview.
            </p>
            <a className="hero-secondary" href="mailto:support@merrivy.com">
              support@merrivy.com
            </a>
          </div>
          <div className="hero-image">
            <img
              src={siteContent.setupScreen.image.src}
              alt={siteContent.setupScreen.image.alt}
            />
            {siteContent.setupScreen.image.caption ? (
              <span className="concept-caption">
                {siteContent.setupScreen.image.caption}
              </span>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const data = useRouteLoaderData<RootLoader>('root');
  let errorMessage = '';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage =
      typeof error.data === 'string' ? error.data : (error.data?.message ?? '');
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  // Technical detail helps local debugging; shoppers never see it.
  const page = (withCampaign: boolean) => (
    <ErrorPage
      status={errorStatus}
      detail={import.meta.env.DEV ? errorMessage : undefined}
      withCampaign={withCampaign}
    />
  );

  if (data && isSampleCatalog(data.publicStoreDomain)) {
    return (
      <Analytics.Provider
        cart={data.cart}
        shop={data.shop}
        consent={data.consent}
      >
        <PageLayout {...data}>{page(true)}</PageLayout>
      </Analytics.Provider>
    );
  }

  return (
    <main className="error-standalone">
      <header className="m-header">
        <a className="wordmark" href="/">
          merrivy
        </a>
      </header>
      {page(false)}
    </main>
  );
}
