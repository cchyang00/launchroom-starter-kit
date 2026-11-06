import {campaign, getPacketByHandle} from '~/content/templates';
import {moneyLocale} from '~/lib/money';

/** Card data shared by the shop, collections, search and recommendations. */
export const PRODUCT_CARD_FRAGMENT = `#graphql
  fragment ProductCard on Product {
    id
    handle
    title
    productType
    availableForSale
    featuredImage {
      id
      url
      altText
      width
      height
    }
    images(first: 2) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    options(first: 3) {
      name
      optionValues {
        name
        swatch {
          color
        }
      }
    }
  }
` as const;

/** Collection links shown as filter chips above product grids. */
export const COLLECTION_CHIPS_QUERY = `#graphql
  query CollectionChips($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    collections(first: 8, sortKey: TITLE) {
      nodes {
        id
        handle
        title
      }
    }
  }
` as const;

export const SORT_OPTIONS = [
  {value: 'featured', label: 'Featured'},
  {value: 'newest', label: 'Newest'},
  {value: 'price-low', label: 'Price, low to high'},
  {value: 'price-high', label: 'Price, high to low'},
  {value: 'name', label: 'Name, A–Z'},
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export function sortValue(request: Request): SortValue {
  const value = new URL(request.url).searchParams.get('sort');
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as SortValue)
    : 'featured';
}

/** Storefront API sort keys differ between the product catalog and a collection. */
export function catalogSort(value: SortValue) {
  switch (value) {
    case 'newest':
      return {sortKey: 'CREATED_AT', reverse: true} as const;
    case 'price-low':
      return {sortKey: 'PRICE', reverse: false} as const;
    case 'price-high':
      return {sortKey: 'PRICE', reverse: true} as const;
    case 'name':
      return {sortKey: 'TITLE', reverse: false} as const;
    default:
      return {sortKey: 'BEST_SELLING', reverse: false} as const;
  }
}

export function collectionSort(value: SortValue) {
  switch (value) {
    case 'newest':
      return {sortKey: 'CREATED', reverse: true} as const;
    case 'price-low':
      return {sortKey: 'PRICE', reverse: false} as const;
    case 'price-high':
      return {sortKey: 'PRICE', reverse: true} as const;
    case 'name':
      return {sortKey: 'TITLE', reverse: false} as const;
    default:
      return {sortKey: 'COLLECTION_DEFAULT', reverse: false} as const;
  }
}

/** Products with a matched campaign packet use the full campaign page. */
export function hasCampaign(handle: string) {
  return Boolean(getPacketByHandle(handle)) || campaign.productHandles.includes(handle);
}

/** The single product the campaign pages and navigation point to. */
export function isFeaturedCampaign(handle: string) {
  return campaign.productUrl === `/products/${handle}`;
}

export function formatMoney(amount: string | number, currencyCode: string) {
  return new Intl.NumberFormat(moneyLocale(currencyCode), {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amount));
}
