import {data, useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {Analytics} from '@shopify/hydrogen';
import type {ProductCardFragment} from 'storefrontapi.generated';
import {ProductExperience} from '~/components/ProductExperience';
import {ProductBasic} from '~/components/ProductBasic';
import {PRODUCT_CARD_FRAGMENT, hasCampaign} from '~/lib/catalog';
import {buildActiveProductCookie} from '~/content/navigation';
import {campaign, getPacketByHandle} from '~/content/templates';
import {paletteCss, type Palette} from '~/content/palettes';
import type {AddOnProduct} from '~/components/PdpSections';
import {ADD_ON_QUERY, loadProduct} from '~/lib/product-query';
import {isSampleCatalog} from '~/lib/store-policies';

import {redirectIfHandleIsLocalized} from '~/lib/redirect';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {
      title: `${data?.packet?.home?.meta?.title || data?.product.seo.title || data?.product.title || 'Product'} | Merrivy`,
    },
    {
      name: 'description',
      content: data?.packet?.home?.meta?.description || data?.product.seo.description || data?.product.description || '',
    },
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Multi-product storefront: every /products/<handle> route renders its own
  // matched CampaignPacket (copy, gallery, theme palette, and cart-drawer upsells)
  // and locks the shopper's active product cookie so `/` and support pages stay
  // on this exact product.
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);

  return data(
    {...deferredData, ...criticalData},
    {
      headers: {
        'Set-Cookie': buildActiveProductCookie(
          `/products/${criticalData.product.handle}`,
        ),
      },
    },
  );
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const packetParam = new URL(request.url).searchParams.get('packet');
  const pagePacket = getPacketByHandle(packetParam) ?? getPacketByHandle(handle) ?? (hasCampaign(handle) ? campaign : null);

  // The bundle block's add-on shows only when its handle is a real product.
  const addOnHandle = pagePacket
    ? pagePacket.bundle?.addOn?.handle?.trim() ?? ''
    : '';
  const [product, addOn] = await Promise.all([
    loadProduct(context, request, handle, pagePacket),
    addOnHandle
      ? storefront
          .query(ADD_ON_QUERY, {variables: {handle: addOnHandle}})
          .then(({product: item}) => (item ?? null) as AddOnProduct | null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  if (!String(product.id).includes('/preview-')) {
    redirectIfHandleIsLocalized(request, {handle, data: product});
  }

  return {
    product,
    packet: pagePacket,
    addOn: addOn?.variant ? addOn : null,
    isSample: isSampleCatalog(context.env.PUBLIC_STORE_DOMAIN) || String(product.id).includes('/preview-'),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  // Campaign pages carry their own sections; the general catalog page suggests
  // related products instead.
  if (!params.handle || hasCampaign(params.handle)) {
    return {recommended: Promise.resolve([] as ProductCardFragment[])};
  }
  const recommended = context.storefront
    .query(RECOMMENDED_QUERY, {variables: {handle: params.handle}})
    .then(
      ({productRecommendations}) =>
        productRecommendations?.filter(
          (item) => item.handle !== params.handle,
        ) ?? [],
    )
    .catch((error: Error) => {
      console.error(error);
      return [] as ProductCardFragment[];
    });
  return {recommended};
}

export default function Product() {
  const {product, packet, recommended, isSample, addOn} =
    useLoaderData<typeof loader>();
  const selectedVariant = product.selectedOrFirstAvailableVariant;
  return (
    <>
      {packet?.theme && (
        <style>{paletteCss(packet.theme as Partial<Palette>)}</style>
      )}
      {packet ? (
        <ProductExperience
          product={product}
          packet={packet}
          isSample={isSample}
          addOn={addOn}
          isHome
        />
      ) : (
        <ProductBasic
          product={product}
          recommended={recommended}
          isSample={isSample}
        />
      )}
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </>
  );
}

const RECOMMENDED_QUERY = `#graphql
  query ProductRecommendations(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productHandle: $handle, intent: RELATED) {
      ...ProductCard
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;
