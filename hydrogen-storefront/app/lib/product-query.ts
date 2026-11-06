import {getSelectedProductOptions, type Storefront} from '@shopify/hydrogen';
import {
  campaign,
  campaignPacketsByFile,
  getPacketByHandle,
  type CampaignPacket,
} from '~/content/templates';
import {isSampleCatalog} from '~/lib/store-policies';
import {
  packetCatalog,
  previewExtra,
  previewProduct,
  type ExtraProduct,
} from '~/lib/preview-catalog';

/** The product page query, shared by the product page and the one-product home page. */
const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
      requiresSellingPlan
    }
    requiresComponents
    sellingPlanAllocations(first: 100) {
      nodes {
        checkoutChargeAmount {
          amount
          currencyCode
        }
        priceAdjustments {
          price { amount currencyCode }
          perDeliveryPrice { amount currencyCode }
        }
        sellingPlan {
          id
          name
          recurringDeliveries
          options { name value }
          billingPolicy {
            ... on SellingPlanRecurringBillingPolicy { interval intervalCount }
          }
          deliveryPolicy {
            ... on SellingPlanRecurringDeliveryPolicy { interval intervalCount }
          }
        }
      }
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    productType
    descriptionHtml
    description
    images(first: 10) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

export const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

/** The bundle block's add-on product, when the packet names a real one. */
export const ADD_ON_QUERY = `#graphql
  query BundleAddOn(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      handle
      title
      image: featuredImage {
        url
        altText
      }
      variant: selectedOrFirstAvailableVariant {
        id
        availableForSale
        price {
          amount
          currencyCode
        }
      }
    }
  }
` as const;

/**
 * The page's other products (October 3, "Make it a set"): the bundles named in
 * `bundle.sets` and the one-tap add-ons in `offer.addOns`. On the sample
 * catalog they come from the packet's catalog extras (planned prices); on the
 * real store from Shopify, by handle. A handle Shopify does not know is left
 * out, so the page never offers a product that does not exist.
 */
export async function loadExtras(context: {
  storefront: Storefront;
  env: {PUBLIC_STORE_DOMAIN: string};
}): Promise<ExtraProduct[]> {
  const allPackets = [campaign, ...Object.values(campaignPacketsByFile)];
  const handles = [
    ...new Set(
      allPackets
        .flatMap((pkt) => [
          ...(pkt.bundle?.sets ?? []).map((set) => set?.handle),
          ...(pkt.offer?.addOns ?? []).map((item) => item?.handle),
        ])
        .filter((handle): handle is string => typeof handle === 'string')
        .map((handle) => handle.trim())
        .filter(Boolean),
    ),
  ];
  if (!handles.length) return [];
  const isSample = isSampleCatalog(context.env.PUBLIC_STORE_DOMAIN);
  const found = await Promise.all(
    handles.map((handle) => {
      if (isSample) {
        for (const pkt of allPackets) {
          const cat = packetCatalog(pkt);
          const extra = cat ? previewExtra(cat, handle) : null;
          if (extra) return Promise.resolve(extra);
        }
        return Promise.resolve(null);
      }
      return context.storefront
        .query(ADD_ON_QUERY, {variables: {handle}})
        .then(({product}) => {
          if (!product?.variant) return null;
          for (const pkt of allPackets) {
            const cat = packetCatalog(pkt);
            const extraSpec = cat?.extras?.find((e) => e.handle === handle);
            if (extraSpec) {
              return {
                ...product,
                title: extraSpec.title || product.title,
                variant: {
                  ...product.variant,
                  price: {
                    ...product.variant.price,
                    amount: String(extraSpec.price),
                  },
                },
              } as ExtraProduct;
            }
          }
          return product as ExtraProduct;
        })
        .catch(() => null);
    }),
  );
  return found.filter((item): item is ExtraProduct => Boolean(item?.variant));
}

/**
 * The product for a page. On the sample catalog, the packet's own product
 * description (catalog) answers for its handle, so the page shows the planned
 * Shopify prices; everything else, and the whole real store, asks Shopify.
 */
export async function loadProduct(
  context: {
    storefront: Storefront;
    env: {PUBLIC_STORE_DOMAIN: string};
  },
  request: Request,
  handle: string,
  targetPacket?: CampaignPacket | null,
) {
  // The template selector controls presentation, not a Shopify variant option.
  const selectedOptions = getSelectedProductOptions(request).filter(
    (option) => option.name !== 'template' && option.name !== 'packet',
  );
  const resolvedPacket = targetPacket ?? getPacketByHandle(handle) ?? campaign;
  const catalog = packetCatalog(resolvedPacket);
  if (
    (isSampleCatalog(context.env.PUBLIC_STORE_DOMAIN) || resolvedPacket?.status === 'sample') &&
    catalog &&
    (catalog.handle === handle || resolvedPacket.productHandles?.includes(handle))
  ) {
    return previewProduct(catalog, selectedOptions);
  }
  const {product} = await context.storefront
    .query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions},
    })
    .catch(() => ({product: null}));
  if (product?.id) {
    if (catalog?.variants?.length) {
      const normOptVal = (s?: string) =>
        String(s || '')
          .toLowerCase()
          .replace(/[\u2014\u2013\u00b7\-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const syncVariantPrice = (v: any) => {
        if (!v?.selectedOptions) return v;
        const matchedSpec = catalog.variants.find((spec) =>
          v.selectedOptions.some(
            (opt: any) =>
              normOptVal(spec.options?.[opt.name]) === normOptVal(opt.value),
          ),
        );
        if (!matchedSpec) return v;
        return {
          ...v,
          price: {
            ...v.price,
            amount: String(matchedSpec.price),
          },
          compareAtPrice: matchedSpec.compareAtPrice
            ? {
                amount: String(matchedSpec.compareAtPrice),
                currencyCode: v.price?.currencyCode || 'USD',
              }
            : v.compareAtPrice,
        };
      };
      return {
        ...product,
        selectedOrFirstAvailableVariant: syncVariantPrice(
          product.selectedOrFirstAvailableVariant,
        ),
        adjacentVariants: (product.adjacentVariants ?? []).map(syncVariantPrice),
        options: (product.options ?? []).map((opt: any) => ({
          ...opt,
          optionValues: (opt.optionValues ?? []).map((ov: any) => ({
            ...ov,
            firstSelectableVariant: syncVariantPrice(ov.firstSelectableVariant),
          })),
        })),
      };
    }
    return product;
  }
  // In local dev / Store Editor preview, if the product has not been pushed to Shopify Admin yet,
  // fall back to the packet's catalog spec so the phone preview works immediately.
  if ((import.meta.env.DEV || resolvedPacket?.status === 'sample') && catalog) {
    return previewProduct(catalog, selectedOptions);
  }
  return null;
}
