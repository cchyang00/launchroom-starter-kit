import {useEffect, useRef, useState} from 'react';
import {CartForm, useOptimisticCart} from '@shopify/hydrogen';
import {Link, useFetcher, useRouteLoaderData} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {CartLineItem, type CartLine} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
import {FreeShippingMeter} from './Offer';
import type {RootLoader} from '~/root';
import {
  campaign,
  getPacketByHandle,
  offerAddOns,
  type CampaignPacket,
} from '~/content/templates';
import {useActiveProduct} from '~/content/navigation';
import {AddOnRow, optimisticVariant} from './PdpSections';
import {Icon} from './Icons';
import type {ExtraProduct} from '~/lib/preview-catalog';
import {moneyLocale} from '~/lib/money';
import {SHIPPING_PROTECTION_VARIANT_ID} from './ProductForm';

type RemovedCartOffer = {
  shortName: string;
  onePackLabel: string;
  onePackVariantId: string;
  onePackPrice: number;
  twoPackLabel: string;
  twoPackVariantId: string;
  twoPackPrice: number;
};

const PRODUCT_RECOVERY_DEFAULTS: Record<string, RemovedCartOffer> = {
  'portable-water-purifier-pump': {
    shortName: 'Military-Grade 6-Stage 0.01μm Electric Water Purifier',
    onePackLabel: '1 Kit (793-Gallon System)',
    onePackVariantId: 'gid://shopify/ProductVariant/preview-mrv-waterpump-1kit',
    onePackPrice: 129.99,
    twoPackLabel: '2-Kit Family & Go-Bag Reserve (Save 15%)',
    twoPackVariantId: 'gid://shopify/ProductVariant/preview-mrv-waterpump-2kit',
    twoPackPrice: 219.98,
  },
  'split-panel-solar-indoor-outdoor-ceiling-light-kit': {
    shortName: 'Split-Panel Solar Ceiling Light Kit',
    onePackLabel: '1 Kit (2 Ceiling Dome Lights)',
    onePackVariantId: 'gid://shopify/ProductVariant/51063888412729',
    onePackPrice: 39.99,
    twoPackLabel: '2-Kit Blackout Bundle (4 Ceiling Lights)',
    twoPackVariantId: 'gid://shopify/ProductVariant/51063888445497',
    twoPackPrice: 63.98,
  },
  'the-witching-hour-2027-weekly-planner': {
    shortName: 'Witching Hour 2027 Grimoire Planner',
    onePackLabel: '1 Grimoire Planner Kit',
    onePackVariantId: 'gid://shopify/ProductVariant/51050399957049',
    onePackPrice: 34.99,
    twoPackLabel: '2-Planner Gift Pair',
    twoPackVariantId: 'gid://shopify/ProductVariant/51050399989817',
    twoPackPrice: 54.98,
  },
  'holiday-tartan-plaid-satin-bow-babydoll-mini-dress': {
    shortName: 'Holiday Tartan Satin-Bow Dress',
    onePackLabel: '1 Holiday Tartan Dress',
    onePackVariantId: 'gid://shopify/ProductVariant/51055526641721',
    onePackPrice: 44.99,
    twoPackLabel: '2-Dress Sister / Bestie Bundle',
    twoPackVariantId: 'gid://shopify/ProductVariant/51055526674489',
    twoPackPrice: 76.48,
  },
  'weighted-organic-stone-seed-heating-pad': {
    shortName: 'Weighted Organic Stone-Seed Heating Pad',
    onePackLabel: '1 Weighted Heating Pad',
    onePackVariantId: 'gid://shopify/ProductVariant/51061639839801',
    onePackPrice: 58.0,
    twoPackLabel: '2-Pad Relief Bundle',
    twoPackVariantId: 'gid://shopify/ProductVariant/51061639872569',
    twoPackPrice: 98.0,
  },
};

const formatCartMoney = (value: number, currency: string) =>
  new Intl.NumberFormat(moneyLocale(currency), {
    style: 'currency',
    currency,
  }).format(value);

const DRESS_1_TO_2_VARIANT_MAP: Record<string, string> = {
  'gid://shopify/ProductVariant/51055526641721':
    'gid://shopify/ProductVariant/51055526674489',
  'gid://shopify/ProductVariant/51055526740025':
    'gid://shopify/ProductVariant/51055526772793',
  'gid://shopify/ProductVariant/51055526838329':
    'gid://shopify/ProductVariant/51055526871097',
  'gid://shopify/ProductVariant/51055526936633':
    'gid://shopify/ProductVariant/51055526969401',
  'gid://shopify/ProductVariant/51055527034937':
    'gid://shopify/ProductVariant/51055527067705',
  'gid://shopify/ProductVariant/51055527133241':
    'gid://shopify/ProductVariant/51055527166009',
  'gid://shopify/ProductVariant/51055527231545':
    'gid://shopify/ProductVariant/51055527264313',
  'gid://shopify/ProductVariant/51055527329849':
    'gid://shopify/ProductVariant/51055527362617',
};

function CartReservationTimer() {
  const [secondsLeft, setSecondsLeft] = useState(600);
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 600));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  return (
    <div className="cart-reservation-bar" role="status" aria-live="off">
      <Icon name="clock" size={15} />
      <span>
        <strong>Only 9 left in stock</strong> · Your bag is reserved for{' '}
        <b>
          {mins}:{secs}
        </b>
      </span>
    </div>
  );
}

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

export type LineItemChildrenMap = {[parentId: string]: CartLine[]};
/** Returns a map of all line items and their children. */
function getLineItemChildrenMap(lines: CartLine[]): LineItemChildrenMap {
  const children: LineItemChildrenMap = {};
  for (const line of lines) {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      const parentId = line.parentRelationship.parent.id;
      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(line);
    }
    if ('lineComponents' in line) {
      const lineChildren = getLineItemChildrenMap(line.lineComponents);
      for (const [parentId, childIds] of Object.entries(lineChildren)) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(...childIds);
      }
    }
  }
  return children;
}
/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 */
export function CartMain({layout, cart: originalCart}: CartMainProps) {
  // The useOptimisticCart hook applies pending actions to the cart
  // so the user immediately sees feedback when they modify the cart.
  const cart = useOptimisticCart(originalCart);
  const {close} = useAside();
  const addFetcher = useFetcher<{errors?: unknown[]}>({key: 'product-add'});
  const cartFailed =
    addFetcher.state === 'idle' && Boolean(addFetcher.data?.errors?.length);

  const physicalLines = (cart?.lines?.nodes ?? []).filter(
    (line) =>
      line.merchandise?.product?.handle !== 'shipping-protection' &&
      line.merchandise?.id !== 'gid://shopify/ProductVariant/51054093893689',
  );
  const linesCount = Boolean(physicalLines.length);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = physicalLines.length > 0;
  const childrenMap = getLineItemChildrenMap(cart?.lines?.nodes ?? []);
  const root = useRouteLoaderData<RootLoader>('root');
  const domain = root?.publicStoreDomain ?? '';
  const isSample = domain === 'mock.shop' || domain.endsWith('.mock.shop');
  const physicalSubtotal = physicalLines.reduce(
    (sum, line) =>
      sum +
      Number(line.merchandise?.price?.amount ?? 0) * Number(line.quantity ?? 1),
    0,
  );
  const currency = cart?.cost?.subtotalAmount?.currencyCode ?? 'USD';
  const pending = cart?.lines?.nodes?.some((line) => line.isOptimistic);
  const activePacket =
    physicalLines
      .map((line) => getPacketByHandle(line.merchandise?.product?.handle))
      .find((pkt): pkt is CampaignPacket => Boolean(pkt)) ?? campaign;
  const hasMultiBundle = physicalLines.some(
    (line) =>
      Number(line.quantity ?? 1) >= 2 ||
      line.merchandise?.selectedOptions?.some((opt) =>
        /^[23]\b|2\s*kits?|3\s*kits?|2\s*planners?|3\s*planners?|2\s*dress|3\s*dress|2\s*heating|3\s*heating/i.test(
          opt.value,
        ),
      ),
  );
  const freeShippingThreshold = Math.max(
    (activePacket.offer as {freeShippingThreshold?: number})
      ?.freeShippingThreshold ??
      activePacket.offer?.freeShippingOver ??
      60,
    60,
  );
  const hasFreeShipVipCode = Boolean(
    cart?.discountCodes?.some(
      (c) => c.code?.toUpperCase() === 'FREESHIPVIP' && c.applicable !== false,
    ),
  );
  const qualifiesFreeShipping =
    hasMultiBundle ||
    physicalSubtotal >= freeShippingThreshold ||
    hasFreeShipVipCode;
  const lastProductHandleRef = useRef<string | null>(null);
  const [removedOffer, setRemovedOffer] = useState<RemovedCartOffer | null>(
    null,
  );
  useEffect(() => {
    if (cartHasItems) {
      const primaryHandle =
        physicalLines.find((l) => PRODUCT_RECOVERY_DEFAULTS[l.merchandise?.product?.handle ?? ''])
          ?.merchandise?.product?.handle ||
        physicalLines[0]?.merchandise?.product?.handle ||
        null;
      if (primaryHandle) {
        lastProductHandleRef.current = primaryHandle;
      }
      setRemovedOffer(null);
    } else if (lastProductHandleRef.current) {
      const fallback =
        PRODUCT_RECOVERY_DEFAULTS[lastProductHandleRef.current] ??
        PRODUCT_RECOVERY_DEFAULTS['split-panel-solar-indoor-outdoor-ceiling-light-kit'];
      setRemovedOffer(fallback);
      lastProductHandleRef.current = null;
    }
  }, [cartHasItems, physicalLines]);

  const singlePlannerLine = !qualifiesFreeShipping
    ? physicalLines.find(
        (line) =>
          line.quantity === 1 &&
          (line.merchandise?.id ===
            'gid://shopify/ProductVariant/51050399957049' ||
            line.merchandise?.selectedOptions?.some(
              (opt) => opt.name === 'Pack' && opt.value === '1 planner',
            )),
      )
    : undefined;
  const singleDressLine = !qualifiesFreeShipping
    ? physicalLines.find(
        (line) =>
          line.quantity === 1 &&
          (Boolean(DRESS_1_TO_2_VARIANT_MAP[line.merchandise?.id ?? '']) ||
            line.merchandise?.selectedOptions?.some(
              (opt) => opt.name === 'Pack' && opt.value === '1 Dress',
            )),
      )
    : undefined;
  const targetTwoDressVariantId = singleDressLine
    ? DRESS_1_TO_2_VARIANT_MAP[singleDressLine.merchandise?.id ?? ''] ??
      'gid://shopify/ProductVariant/51055526674489'
    : '';
  const singlePadLine = !qualifiesFreeShipping
    ? physicalLines.find(
        (line) =>
          line.quantity === 1 &&
          (line.merchandise?.id ===
            'gid://shopify/ProductVariant/51061639839801' ||
            line.merchandise?.selectedOptions?.some(
              (opt) => opt.name === 'Bundle' && opt.value === '1 Heating Pad',
            )),
      )
    : undefined;
  const singleSolarKitLine = !qualifiesFreeShipping
    ? physicalLines.find(
        (line) =>
          line.quantity === 1 &&
          (line.merchandise?.id ===
            'gid://shopify/ProductVariant/51063888412729' ||
            line.merchandise?.selectedOptions?.some(
              (opt) =>
                opt.name === 'Kit Bundle' &&
                opt.value === '1 Kit (2 Ceiling Dome Lights)',
            )),
      )
    : undefined;
  const singleWaterPumpLine = !qualifiesFreeShipping
    ? physicalLines.find(
        (line) =>
          line.quantity === 1 &&
          (line.merchandise?.id ===
            'gid://shopify/ProductVariant/preview-mrv-waterpump-1kit' ||
            line.merchandise?.selectedOptions?.some(
              (opt) =>
                opt.name === 'Pack' &&
                opt.value === '1 Kit (793-Gallon System)',
            )),
      )
    : undefined;

  return (
    <section
      className={className}
      aria-label={layout === 'page' ? 'Cart page' : 'Cart drawer'}
    >
      {cartFailed && (
        <div className="cart-error" role="alert">
          <strong>Your bag couldn’t be updated.</strong>
          <p>
            No item was added by that attempt. Return to the product and try
            again.
          </p>
          <button className="text-link" onClick={close}>
            Return to product
          </button>
        </div>
      )}
      {!linesCount && !cartFailed && removedOffer ? (
        <div className="cart-upgrade-banner is-removal-recovery">
          <div className="cart-upgrade-copy">
            <span className="cart-upgrade-badge">
              <Icon name="truck" size={12} /> WAIT · REMOVED BECAUSE OF SHIPPING OR PRICE?
            </span>
            <strong>
              Put Your {removedOffer.shortName} Back &amp; Get FREE Tracked
              Shipping (Save $7.99)!
            </strong>
            <small>
              We cleared your bag, but before you go: tap below to restore your
              order with either{' '}
              <b>Courtesy FREE Tracked Shipping (Code: FREESHIPVIP)</b> on 1
              unit, or an extra <b>$5.00 Off + FREE Shipping</b> on the 2-Pack
              Bundle:
            </small>
          </div>
          <CartForm
            route="/cart"
            action={CartForm.ACTIONS.LinesAdd}
            inputs={
              {
                lines: [
                  {
                    merchandiseId: removedOffer.onePackVariantId,
                    quantity: 1,
                  },
                  {
                    merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                    quantity: 1,
                  },
                ],
                discountCode: 'FREESHIPVIP',
              } as any
            }
          >
            <button type="submit" className="cart-upgrade-btn">
              <span>
                🚚 Restore {removedOffer.onePackLabel} (
                {formatCartMoney(removedOffer.onePackPrice, currency)}) + FREE
                Shipping
              </span>
              <Icon name="arrow" size={14} />
            </button>
          </CartForm>
          <CartForm
            route="/cart"
            action={CartForm.ACTIONS.LinesAdd}
            inputs={
              {
                lines: [
                  {
                    merchandiseId: removedOffer.twoPackVariantId,
                    quantity: 1,
                  },
                  {
                    merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                    quantity: 1,
                  },
                ],
                discountCode: 'SECRET5',
              } as any
            }
          >
            <button
              type="submit"
              className="cart-upgrade-btn"
              style={{marginTop: '8px', opacity: 0.94}}
            >
              <span>
                ★ Or Claim $5.00 Off {removedOffer.twoPackLabel} (
                {formatCartMoney(
                  Math.max(0, removedOffer.twoPackPrice - 5),
                  currency,
                )}
                ) + FREE Shipping
              </span>
              <Icon name="arrow" size={14} />
            </button>
          </CartForm>
          <button
            type="button"
            className="text-link"
            style={{marginTop: '10px', fontSize: '0.82rem'}}
            onClick={() => setRemovedOffer(null)}
          >
            No thanks, keep my bag empty
          </button>
        </div>
      ) : (
        <CartEmpty hidden={linesCount || cartFailed} layout={layout} />
      )}
      {cartHasItems && <CartReservationTimer />}
      {cartHasItems && (
        <FreeShippingMeter
          subtotal={physicalSubtotal}
          currency={currency}
          isSample={isSample}
          unlocked={qualifiesFreeShipping}
          thresholdOverride={freeShippingThreshold}
        />
      )}
      <div className="cart-details">
        <p id="cart-lines" className="sr-only">
          Line items
        </p>
        <div>
          <ul aria-labelledby="cart-lines">
            {(cart?.lines?.nodes ?? []).map((line) => {
              // we do not render non-parent lines at the root of the cart
              if (
                'parentRelationship' in line &&
                line.parentRelationship?.parent
              ) {
                return null;
              }
              if (
                line.merchandise?.product?.handle === 'shipping-protection' ||
                line.merchandise?.id ===
                  'gid://shopify/ProductVariant/51054093893689'
              ) {
                return null;
              }
              return (
                <CartLineItem
                  key={line.id}
                  line={line}
                  layout={layout}
                  childrenMap={childrenMap}
                />
              );
            })}
          </ul>
          {singlePlannerLine && (
            <div className="cart-upgrade-banner">
              <div className="cart-upgrade-copy">
                <span className="cart-upgrade-badge">
                  <Icon name="gift" size={12} /> ★ UNLOCK FREE SHIPPING · SAVE $7.99
                </span>
                <strong>
                  Gift a 2nd Planner to a Friend &amp; Ship Both FREE!
                </strong>
                <small>
                  Why pay $7.99 for shipping? Upgrade to the{' '}
                  <b>2-Planner Gift Pair (+$19.99 · 43% OFF 2nd)</b>, since
                  shipping becomes <b>FREE</b>, getting a 2nd Grimoire (with 4
                  extra sticker sheets &amp; ruler) is effectively only{' '}
                  <b>+$12.00 more!</b>
                </small>
              </div>
              <CartForm
                route="/cart"
                action={CartForm.ACTIONS.LinesUpdate}
                inputs={{
                  lines: [
                    {
                      id: singlePlannerLine.id,
                      merchandiseId:
                        'gid://shopify/ProductVariant/51050399989817',
                      quantity: 1,
                    },
                  ],
                }}
              >
                <button
                  type="submit"
                  className="cart-upgrade-btn"
                  disabled={Boolean(pending)}
                >
                  <span>Upgrade to 2-Pack (+$19.99) + Get FREE Shipping</span>
                  <Icon name="arrow" size={14} />
                </button>
              </CartForm>
            </div>
          )}
          {singleDressLine && (
            <div className="cart-upgrade-banner">
              <div className="cart-upgrade-copy">
                <span className="cart-upgrade-badge">
                  <Icon name="gift" size={12} /> UNLOCK FREE SHIPPING + SAVE 15%
                </span>
                <strong>
                  Grab a 2nd Dress for a Bestie or Sister &amp; Ship Both FREE!
                </strong>
                <small>
                  Why pay $7.99 shipping on 1 dress? Upgrade to the{' '}
                  <b>Sister / Bestie 2-Dress Bundle</b> to unlock a bigger{' '}
                  <b>15% discount ($38.24/dress)</b>, get{' '}
                  <b>FREE Tracked Shipping</b>, and gift a 2nd Holiday Tartan
                  Bow Dress to a friend or sister for only <b>+$31.49</b>.
                </small>
              </div>
              <CartForm
                route="/cart"
                action={CartForm.ACTIONS.LinesUpdate}
                inputs={{
                  lines: [
                    {
                      id: singleDressLine.id,
                      merchandiseId: targetTwoDressVariantId,
                      quantity: 1,
                    },
                  ],
                }}
              >
                <button
                  type="submit"
                  className="cart-upgrade-btn"
                  disabled={Boolean(pending)}
                >
                  <span>
                    Upgrade to 2-Dress Bundle (+$31.49) + Get FREE Shipping
                  </span>
                  <Icon name="arrow" size={14} />
                </button>
              </CartForm>
            </div>
          )}
          {singlePadLine && (
            <div className="cart-upgrade-banner">
              <div className="cart-upgrade-copy">
                <span className="cart-upgrade-badge">
                  <Icon name="gift" size={12} /> SAVE $18 ON THE 2-PACK BUNDLE
                </span>
                <strong>
                  Add a 2nd Weighted Organic Pad (Bed + Sofa or Gift) &amp; Save $18!
                </strong>
                <small>
                  Upgrade to the <b>2 Heating Pads Bundle ($49/pad)</b> so you
                  can keep one beside your bed and one on the couch (or gift one
                  to your mom, sister, or partner) for only <b>+$40.00</b> with{' '}
                  <b>FREE Tracked Shipping</b>.
                </small>
              </div>
              <CartForm
                route="/cart"
                action={CartForm.ACTIONS.LinesUpdate}
                inputs={{
                  lines: [
                    {
                      id: singlePadLine.id,
                      merchandiseId:
                        'gid://shopify/ProductVariant/51061639872569',
                      quantity: 1,
                    },
                  ],
                }}
              >
                <button
                  type="submit"
                  className="cart-upgrade-btn"
                  disabled={Boolean(pending)}
                >
                  <span>
                    Upgrade to 2-Pad Bundle (+$40.00 · Save $18)
                  </span>
                  <Icon name="arrow" size={14} />
                </button>
              </CartForm>
            </div>
          )}
          {singleSolarKitLine && (
            <div className="cart-upgrade-banner">
              <div className="cart-upgrade-copy">
                <span className="cart-upgrade-badge">
                  <Icon name="gift" size={12} /> ★ UNLOCK FREE SHIPPING · SAVE $7.99
                </span>
                <strong>
                  Light 4 Full Rooms When the Grid Goes Down &amp; Ship Both Kits FREE!
                </strong>
                <small>
                  Why pay $7.99 for shipping? Upgrade to the{' '}
                  <b>2-Kit Blackout Bundle (+$23.99 · 40% OFF 2nd)</b>, since
                  shipping becomes <b>FREE</b>, doubling to 4 ceiling lights is
                  effectively only <b>+$16.00 more!</b>
                </small>
              </div>
              <CartForm
                route="/cart"
                action={CartForm.ACTIONS.LinesUpdate}
                inputs={{
                  lines: [
                    {
                      id: singleSolarKitLine.id,
                      merchandiseId:
                        'gid://shopify/ProductVariant/51063888445497',
                      quantity: 1,
                    },
                  ],
                }}
              >
                <button
                  type="submit"
                  className="cart-upgrade-btn"
                  disabled={Boolean(pending)}
                >
                  <span>
                    Upgrade to 2-Kit Bundle (+$23.99) + Get FREE Shipping
                  </span>
                  <Icon name="arrow" size={14} />
                </button>
              </CartForm>
            </div>
          )}
          {singleWaterPumpLine && (
            <div className="cart-upgrade-banner">
              <div className="cart-upgrade-copy">
                <span className="cart-upgrade-badge">
                  <Icon name="gift" size={12} /> ★ UNLOCK FREE SHIPPING · SAVE 15% ($40.00 OFF)
                </span>
                <strong>
                  Upgrade to the 2-Kit Family Reserve · Save 15% + Get FREE Tracked Shipping!
                </strong>
                <small>
                  Why pay $7.99 for shipping on 1 kit? Upgrade to the{' '}
                  <b>
                    2-Kit Family &amp; Go-Bag Reserve (+$89.99 · $109.99/kit ·
                    Save $40.00 + Get FREE Tracked Shipping!)
                  </b>{' '}
                  so you can keep 1 kit at home and 1 in your vehicle (1,586
                  gallons total capacity).
                </small>
              </div>
              <CartForm
                route="/cart"
                action={CartForm.ACTIONS.LinesUpdate}
                inputs={{
                  lines: [
                    {
                      id: singleWaterPumpLine.id,
                      merchandiseId:
                        'gid://shopify/ProductVariant/preview-mrv-waterpump-2kit',
                      quantity: 1,
                    },
                  ],
                }}
              >
                <button
                  type="submit"
                  className="cart-upgrade-btn"
                  disabled={Boolean(pending)}
                >
                  <span>
                    Upgrade to the 2-Kit Family Reserve · Save 15% + Get FREE Tracked Shipping! (+$89.99)
                  </span>
                  <Icon name="arrow" size={14} />
                </button>
              </CartForm>
            </div>
          )}
        </div>
        {/* Separate physical companion add-ons removed to keep fulfillment 100% single-SKU */}
        {cartHasItems && <CartSummary cart={cart} layout={layout} />}
      </div>
    </section>
  );
}

/**
 * One-tap add-ons in the bag (October 3, store/PAGE-BLUEPRINT.md section 10):
 * the packet's offer.addOns that are not in the bag yet, each at its own price.
 */
function BagAddOns({
  packet = campaign,
  extras,
  inBag,
  unlocksFreeShipping = false,
  amountLeftForFreeShipping = 0,
  currency = 'USD',
  pending = false,
}: {
  packet?: CampaignPacket;
  extras: ExtraProduct[];
  inBag: string[];
  unlocksFreeShipping?: boolean;
  amountLeftForFreeShipping?: number;
  currency?: string;
  pending?: boolean;
}) {
  const byHandle = new Map(extras.map((item) => [item.handle, item]));
  const setLines = (packet.bundle?.sets ?? []).map((set) => ({
    handle: set.handle,
    text: set.caption,
    icon: set.icon,
  }));
  const seenHandles = new Set<string>();
  const allAddOnLines = [...setLines, ...offerAddOns(packet)].filter((line) => {
    if (!line.handle || seenHandles.has(line.handle)) return false;
    seenHandles.add(line.handle);
    return true;
  });
  const rows = allAddOnLines
    .flatMap((line) => {
      const item = byHandle.get(line.handle);
      return item?.variant && !inBag.includes(item.variant.id)
        ? [{line, item}]
        : [];
    })
    .slice(0, 2);
  if (!rows.length) return null;
  const bothPrice = rows.reduce(
    (sum, r) => sum + Number(r.item.variant?.price?.amount ?? 0),
    0,
  );
  const bothWasPrice = rows.reduce((sum, r) => {
    const v = r.item.variant as {compareAtPrice?: {amount: string} | null};
    const fallbackWas = r.item.handle.includes('pencil')
      ? 24
      : r.item.handle.includes('hook')
        ? 19
        : 22;
    return sum + Number(v?.compareAtPrice?.amount ?? fallbackWas);
  }, 0);
  const netAfterShippingSaved = Math.max(0, bothPrice - 7.99);
  return (
    <div className="bag-addons">
      <div
        className={`bag-addons-incentive ${unlocksFreeShipping ? 'is-waive-ship' : 'is-vip-perk'}`}
      >
        <Icon name="sparkle" size={14} />
        {unlocksFreeShipping ? (
          rows.length === 1 ? (
            <span>
              <strong>
                🔥 ONLY {formatCartMoney(amountLeftForFreeShipping, currency)}{' '}
                AWAY FROM FREE SHIPPING!
              </strong>{' '}
              Add this final companion item below and we&rsquo;ll{' '}
              <strong>waive your $7.99 shipping fee</strong> (making it almost
              free!):
            </span>
          ) : (
            <span>
              <strong>✨ OPTION 2 TO UNLOCK FREE SHIPPING:</strong> You&rsquo;re{' '}
              <strong>
                {formatCartMoney(amountLeftForFreeShipping, currency)} away
              </strong>{' '}
              from $60 Free Shipping! Add companion extras below, or bundle
              both in 1 tap to <strong>waive your $7.99 shipping fee:</strong>
            </span>
          )
        ) : (
          <span>
            <strong>VIP BUNDLE PERK:</strong> Add matching companion extras at up
            to <strong>40% off</strong> and ships <strong>100% FREE</strong> in
            your box!
          </span>
        )}
      </div>
      {unlocksFreeShipping && rows.length === 2 && (
        <div className="bag-bundle-both-card">
          <CartForm
            fetcherKey="product-add"
            route="/cart"
            action={CartForm.ACTIONS.LinesAdd}
            inputs={{
              lines: rows.map(({item}) => ({
                merchandiseId: item.variant!.id,
                quantity: 1,
                selectedVariant: optimisticVariant(item),
              })),
            }}
          >
            <button
              type="submit"
              className="bag-bundle-both-btn"
              disabled={pending}
            >
              <span>
                ⚡ Add Both Companion Extras (
                {bothWasPrice > bothPrice && (
                  <s className="bag-bundle-both-was">
                    {formatCartMoney(bothWasPrice, currency)}
                  </s>
                )}{' '}
                +{formatCartMoney(bothPrice, currency)}) &amp; Ship Order FREE
              </span>
              <Icon name="arrow" size={14} />
            </button>
          </CartForm>
          <small className="bag-bundle-both-note">
            Saves your $7.99 shipping fee (effectively only +
            {formatCartMoney(netAfterShippingSaved, currency)} for both!) ·
            Ships together in 1 box
          </small>
        </div>
      )}
      <p className="bag-addons-heading">
        {packet.bundle?.addOnsHeading || 'Add to your order'}
      </p>
      <ul className="pdp-addon-list">
        {rows.map(({line, item}) => {
          const itemPrice = Number(item.variant?.price?.amount ?? 0);
          return (
            <li key={line.handle}>
              <AddOnRow
                item={item}
                text={line.text}
                icon={line.icon}
                unlocksFreeShipping={unlocksFreeShipping}
                singleItemUnlocksFreeShip={
                  rows.length === 1 || itemPrice >= amountLeftForFreeShipping
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function CartEmpty({
  hidden = false,
}: {
  hidden: boolean;
  layout?: CartMainProps['layout'];
}) {
  const {close} = useAside();
  const {productPath} = useActiveProduct();
  return (
    <div hidden={hidden}>
      <br />
      <p>
        Looks like you haven&rsquo;t added anything yet, let&rsquo;s get you
        started!
      </p>
      <br />
      <Link
        to={productPath}
        onClick={close}
        prefetch="viewport"
        className="button-primary"
      >
        Continue shopping →
      </Link>
    </div>
  );
}
