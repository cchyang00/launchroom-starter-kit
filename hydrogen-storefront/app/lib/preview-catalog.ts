import type {HydrogenCart, HydrogenSession} from '@shopify/hydrogen';
import type {
  CartApiQueryFragment,
  ProductFragment,
} from 'storefrontapi.generated';

/**
 * The preview catalog (October 3).
 *
 * A product packet may describe its product as it will be created in Shopify
 * (`catalog`: title, options, variants, prices, compare-at prices, weights and
 * the variant picture). The sample catalog (mock.shop: the local store and any
 * public preview) has no such product, so there the product page and the bag
 * sell from this description instead: the price on the page is the planned
 * Shopify price and the bag charges exactly that price. Checkout stays the
 * no-order preview.
 *
 * It never applies to the real store. With real Shopify credentials the
 * product, prices, compare-at prices and the cart come from Shopify alone,
 * and this description is the spec the owner creates the product from.
 */
export type CatalogVariant = {
  sku: string;
  /** Option name to value, e.g. {"Pack": "2 pillows"}; {} for one variant. */
  options: Record<string, string>;
  price: number;
  /** A real reference price only (it becomes Shopify's compare-at price). */
  compareAtPrice: number | null;
  weightGrams: number | null;
  available: boolean;
  /** Local picture for the bag and the first gallery slide. */
  image: string;
  imageAlt: string;
};
export type PacketCatalog = {
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  currency: string;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  options: {name: string; values: string[]}[];
  variants: CatalogVariant[];
  price?: number;
  sku?: string;
  image?: string;
  imageAlt?: string;
  kind?: string;
  /**
   * The other products this page sells (October 3, store/PAGE-BLUEPRINT.md
   * section 10): a bundle such as the Wind-Down Set and the one-tap add-ons.
   * Each is its own Shopify product with the same shape; on the sample
   * catalog the bag sells them at these prices too. A picture may wait (the
   * page shows a placeholder block until the image maker's file lands).
   */
  extras?: PacketCatalog[];
};
/** A second product the page offers (a bundle or a one-tap add-on). */
export type ExtraProduct = {
  handle: string;
  title: string;
  image: {url: string; altText: string | null} | null;
  variant: {
    id: string;
    availableForSale: boolean;
    price: {amount: string; currencyCode: string};
  } | null;
};

const DEFAULT_OPTION = {name: 'Title', values: ['Default Title']};
const variantGid = (sku: string) =>
  `gid://shopify/ProductVariant/preview-${slug(sku)}`;
const lineGid = (sku: string) => `gid://shopify/CartLine/preview-${slug(sku)}`;
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const money = (amount: number, currencyCode: string) => ({
  amount: amount.toFixed(2),
  currencyCode: currencyCode as 'USD',
});

/** The packet's catalog, only when it is complete enough to sell from. */
export function packetCatalog(packet: unknown): PacketCatalog | null {
  const c = (packet as {catalog?: PacketCatalog} | null)?.catalog;
  if (
    !c ||
    !c.handle?.trim() ||
    !c.title?.trim() ||
    !c.currency?.trim() ||
    !Array.isArray(c.variants) ||
    !c.variants.length ||
    c.variants.some(
      (variant) =>
        !variant.sku?.trim() ||
        !Number.isFinite(variant.price) ||
        variant.price <= 0,
    )
  )
    return null;
  return c;
}

/** The extra products that are complete enough to sell from. */
export function catalogExtras(catalog: PacketCatalog): PacketCatalog[] {
  return (catalog.extras ?? []).filter(
    (extra) =>
      extra?.handle?.trim() &&
      extra.title?.trim() &&
      extra.handle !== catalog.handle &&
      Array.isArray(extra.variants) &&
      extra.variants.length > 0 &&
      extra.variants.every(
        (variant) =>
          variant.sku?.trim() && Number.isFinite(variant.price) && variant.price > 0,
      ),
  );
}

/** Every product the preview sells: the page's own, then its extras. */
function allCatalogs(catalog: PacketCatalog) {
  return [catalog, ...catalogExtras(catalog)].map((item) => ({
    ...item,
    currency: item.currency || catalog.currency,
  }));
}

/** The product a variant belongs to, and the variant, by a test on the variant. */
function findVariant(
  catalog: PacketCatalog,
  test: (variant: CatalogVariant) => boolean,
) {
  for (const owner of allCatalogs(catalog)) {
    const variant = owner.variants.find(test);
    if (variant) return {owner, variant};
  }
  return null;
}

/**
 * An extra product (bundle or add-on) shaped like the add-on query's answer,
 * so the page offers it exactly as it would a real Shopify product.
 */
export function previewExtra(
  catalog: PacketCatalog,
  handle: string,
): ExtraProduct | null {
  const owner = allCatalogs(catalog)
    .slice(1)
    .find((item) => item.handle === handle);
  if (!owner) return null;
  const variant =
    owner.variants.find((item) => item.available) ?? owner.variants[0];
  const fragment = variantFragment(owner, variant);
  return {
    handle: owner.handle,
    title: owner.title,
    image: variant.image
      ? {url: variant.image, altText: variant.imageAlt || owner.title}
      : null,
    variant: {
      id: fragment.id,
      availableForSale: variant.available,
      price: fragment.price,
    },
  };
}

/** Options as Shopify reports them: a product without options has "Title". */
function optionsOf(catalog: PacketCatalog) {
  return catalog.options?.length ? catalog.options : [DEFAULT_OPTION];
}

function selectedOptionsOf(catalog: PacketCatalog, variant: CatalogVariant) {
  return optionsOf(catalog).map((option) => ({
    name: option.name,
    value:
      option === DEFAULT_OPTION
        ? DEFAULT_OPTION.values[0]
        : (variant.options?.[option.name] ?? ''),
  }));
}

function variantTitle(catalog: PacketCatalog, variant: CatalogVariant) {
  return selectedOptionsOf(catalog, variant)
    .map(({value}) => value)
    .join(' / ');
}

function variantFragment(catalog: PacketCatalog, variant: CatalogVariant) {
  return {
    __typename: 'ProductVariant' as const,
    availableForSale: variant.available,
    compareAtPrice:
      variant.compareAtPrice && variant.compareAtPrice > variant.price
        ? money(variant.compareAtPrice, catalog.currency)
        : null,
    id: variantGid(variant.sku),
    image: variant.image
      ? {
          __typename: 'Image' as const,
          id: `gid://shopify/ProductImage/preview-${slug(variant.sku)}`,
          url: variant.image,
          altText: variant.imageAlt || catalog.title,
          width: 1600,
          height: 1600,
        }
      : null,
    price: money(variant.price, catalog.currency),
    product: {
      title: catalog.title,
      handle: catalog.handle,
      requiresSellingPlan: false,
    },
    requiresComponents: false,
    sellingPlanAllocations: {nodes: []},
    selectedOptions: selectedOptionsOf(catalog, variant),
    sku: variant.sku,
    title: variantTitle(catalog, variant),
    unitPrice: null,
  };
}

/** Option value positions per variant, e.g. [[0], [1]]. */
function combinations(
  catalog: PacketCatalog,
  keep: (variant: CatalogVariant) => boolean,
) {
  const options = optionsOf(catalog);
  return catalog.variants.filter(keep).map((variant) =>
    selectedOptionsOf(catalog, variant).map(({value}, i) =>
      Math.max(0, options[i].values.indexOf(value)),
    ),
  );
}

/**
 * Shopify's v1 encoding of which option combinations exist (a trie written
 * with ":" for a deeper option, " " between values and "," to close a level).
 * Decoded by Hydrogen's getProductOptions.
 */
export function encodeVariants(combos: number[][]) {
  if (!combos.length) return '';
  const sorted = [...combos].sort((a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  });
  const level = (rows: number[][], depth: number, top: boolean): string => {
    const values = [...new Set(rows.map((row) => row[depth]))];
    if (depth === rows[0].length - 1)
      return values.join(' ') + (top ? '' : ',');
    return (
      values
        .map(
          (value) =>
            `${value}:` +
            level(
              rows.filter((row) => row[depth] === value),
              depth + 1,
              false,
            ),
        )
        .join('') + (top ? '' : ',')
    );
  };
  return 'v1_' + level(sorted, 0, true);
}

/** The variant a shopper's chosen options point to, else the first available. */
function pickVariant(
  catalog: PacketCatalog,
  selected: {name: string; value: string}[],
) {
  const wanted = selected
    .map(({name, value}) => ({
      option: optionsOf(catalog).find(
        (option) => option.name.toLowerCase() === name.toLowerCase(),
      ),
      value: value.toLowerCase(),
    }))
    .filter(({option}) => Boolean(option));
  const matches = catalog.variants.filter((variant) =>
    wanted.every(
      ({option, value}) =>
        (variant.options?.[option!.name] ?? '').toLowerCase() === value,
    ),
  );
  if (!wanted.length && catalog.handle === 'portable-water-purifier-pump' && catalog.variants[1]?.available) {
    return catalog.variants[1];
  }
  return (
    matches.find((variant) => variant.available) ??
    matches[0] ??
    catalog.variants.find((variant) => variant.available) ??
    catalog.variants[0]
  );
}

/**
 * A product shaped exactly like the Storefront API's, built from the packet,
 * so the product page, gallery, options and packs render unchanged.
 */
export function previewProduct(
  catalog: PacketCatalog,
  selected: {name: string; value: string}[],
): ProductFragment {
  const options = optionsOf(catalog);
  const selectedVariant = pickVariant(catalog, selected);
  const images = [
    ...new Map(
      catalog.variants
        .filter((variant) => variant.image)
        .map((variant) => [variant.image, variant]),
    ).values(),
  ].map((variant) => ({
    id: `gid://shopify/ProductImage/preview-${slug(variant.sku)}`,
    url: variant.image,
    altText: variant.imageAlt || catalog.title,
    width: 1600,
    height: 1600,
  }));
  const product = {
    id: `gid://shopify/Product/preview-${slug(catalog.handle)}`,
    title: catalog.title,
    vendor: catalog.vendor || 'Merrivy',
    handle: catalog.handle,
    productType: catalog.productType || '',
    descriptionHtml: `<p>${escapeHtml(catalog.description || '')}</p>`,
    description: catalog.description || '',
    images: {nodes: images},
    encodedVariantExistence: encodeVariants(combinations(catalog, () => true)),
    encodedVariantAvailability: encodeVariants(
      combinations(catalog, (variant) => variant.available),
    ),
    options: options.map((option) => ({
      name: option.name,
      optionValues: option.values.map((value) => {
        const withValue = catalog.variants.filter(
          (variant) =>
            option === DEFAULT_OPTION ||
            variant.options?.[option.name] === value,
        );
        const first =
          withValue.find((variant) => variant.available) ?? withValue[0];
        return {
          name: value,
          firstSelectableVariant: first ? variantFragment(catalog, first) : null,
          swatch: null,
        };
      }),
    })),
    selectedOrFirstAvailableVariant: variantFragment(catalog, selectedVariant),
    adjacentVariants: catalog.variants
      .filter((variant) => variant !== selectedVariant)
      .map((variant) => variantFragment(catalog, variant)),
    seo: {
      title: catalog.seoTitle || catalog.title,
      description: catalog.seoDescription || catalog.description || '',
    },
  };
  return product as unknown as ProductFragment;
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/* ---------- The preview bag ---------- */

type BagLine = {sku: string; quantity: number};
type Bag = {id: string; lines: BagLine[]; discountCodes?: string[]};
const BAG_KEY = 'previewBag';
const MAX_QUANTITY = 20;
type CartError = {message: string; code?: string};

/** The variant a cart line input points to, by its preview id (any product). */
function variantById(catalog: PacketCatalog, id: string) {
  return findVariant(catalog, (variant) => variantGid(variant.sku) === id)
    ?.variant;
}

/** Pack unit count for tiered planner packs ("1 planner" -> 1, "2 planners" -> 2, "3 planners" -> 3). */
function plannerPackUnits(variant: CatalogVariant): number | null {
  const match = /^(\d+)\s+planners?$/i.exec(variant.options?.Pack?.trim() ?? '');
  return match ? Number(match[1]) : null;
}

/** Build a cart shaped like the Storefront API's from the stored lines. */
const PREVIEW_PROTECTION_VARIANT_ID =
  'gid://shopify/ProductVariant/51054093893689';
const PREVIEW_PROTECTION_SKU = '__SHIPPING_PROTECTION__';
const PREVIEW_PROTECTION_PRICE = 4.99;

export function previewCart(catalog: PacketCatalog, bag: Bag) {
  const currency = catalog.currency;
  const lines = bag.lines
    .map((line) => {
      if (line.sku === PREVIEW_PROTECTION_SKU) {
        return {
          __typename: 'CartLine' as const,
          id: lineGid(PREVIEW_PROTECTION_SKU),
          quantity: 1,
          sellingPlanAllocation: null,
          attributes: [],
          cost: {
            totalAmount: money(PREVIEW_PROTECTION_PRICE, currency),
            amountPerQuantity: money(PREVIEW_PROTECTION_PRICE, currency),
            compareAtAmountPerQuantity: null,
          },
          merchandise: {
            __typename: 'ProductVariant' as const,
            id: PREVIEW_PROTECTION_VARIANT_ID,
            availableForSale: true,
            compareAtPrice: null,
            price: money(PREVIEW_PROTECTION_PRICE, currency),
            requiresShipping: false,
            title: 'Default Title',
            image: {
              __typename: 'Image' as const,
              id: 'gid://shopify/ProductImage/preview-shipping-protection',
              url: '/images/wftn/shipping-protection-badge.jpg',
              altText: 'Package & Transit Protection',
              width: 600,
              height: 600,
            },
            product: {
              handle: 'shipping-protection',
              title: 'Package & Transit Protection',
              id: 'gid://shopify/Product/preview-shipping-protection',
              vendor: 'Merrivy',
            },
            selectedOptions: [{name: 'Title', value: 'Default Title'}],
          },
          parentRelationship: null,
        };
      }
      const found = findVariant(catalog, (item) => item.sku === line.sku);
      if (!found) return null;
      const {owner, variant} = found;
      const fragment = variantFragment(owner, variant);
      const packUnits = plannerPackUnits(variant);
      if (packUnits !== null) {
        const basePrice = owner.variants[0]?.price ?? 39.99;
        const twoPack = owner.variants[1]?.price ?? 69.98;
        const threePack = owner.variants[2]?.price ?? 95.97;
        const qty = line.quantity;
        const unitPrice =
          qty === 1
            ? basePrice
            : qty === 2
              ? Number((twoPack / 2).toFixed(2))
              : Number((threePack / 3).toFixed(2));
        const total = Number((unitPrice * qty).toFixed(2));
        const fullTotal = Number((basePrice * qty).toFixed(2));
        const saved = Math.round(fullTotal - total);
        const packLabel =
          qty === 1
            ? '1 planner'
            : `${qty} planners${saved > 0 ? ` (Save $${saved})` : ''}`;
        const comparePerUnit =
          qty > 1 ? money(basePrice, currency) : null;
        return {
          __typename: 'CartLine' as const,
          id: lineGid(variant.sku),
          quantity: qty,
          sellingPlanAllocation: null,
          attributes: [],
          cost: {
            totalAmount: money(total, currency),
            amountPerQuantity: money(unitPrice, currency),
            compareAtAmountPerQuantity: comparePerUnit,
          },
          merchandise: {
            __typename: 'ProductVariant' as const,
            id: fragment.id,
            availableForSale: variant.available,
            compareAtPrice: comparePerUnit,
            price: money(unitPrice, currency),
            requiresShipping: true,
            title: packLabel,
            image: fragment.image,
            product: {
              handle: owner.handle,
              title: owner.title,
              id: `gid://shopify/Product/preview-${slug(owner.handle)}`,
              vendor: owner.vendor || 'Merrivy',
            },
            selectedOptions: [{name: 'Pack', value: packLabel}],
          },
          parentRelationship: null,
        };
      }
      return {
        __typename: 'CartLine' as const,
        id: lineGid(variant.sku),
        quantity: line.quantity,
        sellingPlanAllocation: null,
        attributes: [],
        cost: {
          totalAmount: money(variant.price * line.quantity, currency),
          amountPerQuantity: money(variant.price, currency),
          compareAtAmountPerQuantity: fragment.compareAtPrice,
        },
        merchandise: {
          __typename: 'ProductVariant' as const,
          id: fragment.id,
          availableForSale: variant.available,
          compareAtPrice: fragment.compareAtPrice,
          price: fragment.price,
          requiresShipping: true,
          title: fragment.title,
          image: fragment.image,
          product: {
            handle: owner.handle,
            title: owner.title,
            id: `gid://shopify/Product/preview-${slug(owner.handle)}`,
            vendor: owner.vendor || 'Merrivy',
          },
          selectedOptions: fragment.selectedOptions,
        },
        parentRelationship: null,
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.cost.totalAmount.amount),
    0,
  );
  const cart = {
    updatedAt: new Date().toISOString(),
    id: bag.id,
    appliedGiftCards: [],
    // The sample catalog never hands a cart to a real checkout.
    checkoutUrl: '/checkout-preview',
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    buyerIdentity: {countryCode: 'US', customer: null, email: null, phone: null},
    lines: {nodes: lines},
    cost: {
      subtotalAmount: money(subtotal, currency),
      totalAmount: money(subtotal, currency),
      totalDutyAmount: null,
      totalTaxAmount: null,
    },
    note: '',
    attributes: [],
    discountCodes: (bag.discountCodes ?? []).map((code) => ({
      code,
      applicable: false,
    })),
  };
  return cart as unknown as CartApiQueryFragment;
}

type Overrides = Pick<
  HydrogenCart,
  | 'get'
  | 'getCartId'
  | 'setCartId'
  | 'create'
  | 'addLines'
  | 'updateLines'
  | 'removeLines'
  | 'updateDiscountCodes'
  | 'updateGiftCardCodes'
  | 'addGiftCardCodes'
  | 'removeGiftCardCodes'
  | 'updateBuyerIdentity'
  | 'updateNote'
  | 'updateAttributes'
>;

/**
 * Cart methods for the sample catalog when the packet has a catalog: the bag
 * lives in the signed session cookie and only ever holds catalog variants.
 * Adding anything else fails visibly (the bag shows its error), never silently.
 */
export function previewCartMethods(
  session: HydrogenSession,
  catalog: PacketCatalog,
) {
  const read = (): Bag | null => {
    const bag = session.get(BAG_KEY) as Bag | undefined;
    return bag && Array.isArray(bag.lines) ? bag : null;
  };
  const write = (bag: Bag) => session.set(BAG_KEY, bag);
  const fresh = (): Bag => ({
    id: `gid://shopify/Cart/preview-${crypto.randomUUID()}`,
    lines: [],
  });
  const reply = (bag: Bag | null, errors: CartError[] = []) => ({
    cart: bag ? previewCart(catalog, bag) : null,
    errors: errors.length ? errors : undefined,
    userErrors: errors.length ? errors : [],
    warnings: [],
  });
  type LineInput = {merchandiseId: string; quantity?: number};
  const add = (lines: LineInput[]) => {
    const bag = read() ?? fresh();
    const errors: CartError[] = [];
    for (const line of lines) {
      if (line.merchandiseId === PREVIEW_PROTECTION_VARIANT_ID) {
        if (!bag.lines.some((item) => item.sku === PREVIEW_PROTECTION_SKU)) {
          bag.lines.push({sku: PREVIEW_PROTECTION_SKU, quantity: 1});
        }
        continue;
      }
      const variant = variantById(catalog, line.merchandiseId);
      const quantity = Math.max(1, Math.floor(Number(line.quantity ?? 1)));
      if (!variant || !variant.available) {
        errors.push({
          code: 'MERCHANDISE_NOT_FOUND',
          message: 'That item is not available.',
        });
        continue;
      }
      const packUnits = plannerPackUnits(variant);
      if (packUnits !== null) {
        const baseSku = catalog.variants[0]?.sku ?? variant.sku;
        const addedUnits = packUnits * quantity;
        const existing = bag.lines.find((item) => item.sku === baseSku);
        if (existing)
          existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + addedUnits);
        else
          bag.lines.push({
            sku: baseSku,
            quantity: Math.min(MAX_QUANTITY, addedUnits),
          });
        continue;
      }
      const existing = bag.lines.find((item) => item.sku === variant.sku);
      if (existing)
        existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
      else
        bag.lines.push({
          sku: variant.sku,
          quantity: Math.min(MAX_QUANTITY, quantity),
        });
    }
    if (!errors.length || bag.lines.length) write(bag);
    return reply(bag, errors);
  };
  const unchanged = () => Promise.resolve(reply(read()));
  const methods = {
    get: () => {
      const bag = read();
      return Promise.resolve(bag ? previewCart(catalog, bag) : null);
    },
    getCartId: () => read()?.id,
    // The session cookie is committed by server.ts; no separate cart cookie.
    setCartId: () => new Headers(),
    create: (input: {lines?: LineInput[]}) =>
      Promise.resolve(add(input?.lines ?? [])),
    addLines: (lines: LineInput[]) => Promise.resolve(add(lines)),
    updateLines: (
      lines: {id: string; merchandiseId?: string; quantity?: number}[],
    ) => {
      const bag = read() ?? fresh();
      for (const line of lines) {
        const index = bag.lines.findIndex(
          (item) => lineGid(item.sku) === line.id,
        );
        if (index < 0) continue;
        const quantity = Math.floor(Number(line.quantity ?? 0));
        if (quantity <= 0) {
          bag.lines.splice(index, 1);
          continue;
        }
        if (line.merchandiseId) {
          const swapped = variantById(catalog, line.merchandiseId);
          if (swapped?.available) bag.lines[index].sku = swapped.sku;
        }
        bag.lines[index].quantity = Math.min(MAX_QUANTITY, quantity);
      }
      write(bag);
      return Promise.resolve(reply(bag));
    },
    removeLines: (lineIds: string[]) => {
      const bag = read() ?? fresh();
      bag.lines = bag.lines.filter((item) => !lineIds.includes(lineGid(item.sku)));
      write(bag);
      return Promise.resolve(reply(bag));
    },
    // No discount codes exist on the preview: a code is kept but never applies.
    updateDiscountCodes: (codes: string[]) => {
      const bag = read() ?? fresh();
      bag.discountCodes = [...new Set(codes.filter(Boolean))];
      write(bag);
      return Promise.resolve(reply(bag));
    },
    updateGiftCardCodes: unchanged,
    addGiftCardCodes: unchanged,
    removeGiftCardCodes: unchanged,
    updateBuyerIdentity: unchanged,
    updateNote: unchanged,
    updateAttributes: unchanged,
  };
  return methods as unknown as Overrides;
}
