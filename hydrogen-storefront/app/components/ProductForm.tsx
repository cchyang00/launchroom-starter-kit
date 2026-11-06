import {Link, useNavigate, useSearchParams} from 'react-router';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {CartForm, type MappedProductOptions} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {Icon} from './Icons';
import {campaign, getPacketByHandle} from '~/content/templates';
import {isColorOption, swatchColor} from '~/lib/colors';
import {moneyLocale} from '~/lib/money';
export const SHIPPING_PROTECTION_VARIANT_ID =
  'gid://shopify/ProductVariant/51054093893689';
export const SHIPPING_PROTECTION_PRICE = 4.99;
const ONE_PLANNER_VARIANT_ID = 'gid://shopify/ProductVariant/51050399957049';
const TWO_PLANNER_VARIANT_ID = 'gid://shopify/ProductVariant/51050399989817';

export function ProductForm({
  productOptions,
  selectedVariant,
  offerChoices,
  quantityMode = 'packs',
  sizeGuide,
  shipping,
  sticky,
  compareAt,
  shippingLine,
}: {
  productOptions: MappedProductOptions[];
  /** Packs. With `variant`, a pack is its own variant (an option value). */
  offerChoices?: {
    quantity: number;
    label: string;
    caption: string;
    variant?: string;
  }[];
  /** The shipping promise shown under the packs. */
  shippingLine?: string;
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  /** Campaign pages show pack choices; the general catalog uses a stepper. */
  quantityMode?: 'packs' | 'stepper';
  /** Shown beside the size option's label. */
  sizeGuide?: ReactNode;
  /** Configured shipping terms; drives honest "ships free" pack labels. */
  shipping?: {fee: number; freeAt: number};
  /** Adds a bar that keeps the purchase in reach once the button scrolls away. */
  sticky?: {title: string; image: string};
  /** Reference ("was") price for one unit, when an honest one exists. */
  compareAt?: number | null;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const variantQuery = (query: string) => {
    const params = new URLSearchParams(query);
    const template = searchParams.get('template');
    if (template) params.set('template', template);
    const packetParam = searchParams.get('packet');
    if (packetParam) params.set('packet', packetParam);
    return params.toString();
  };
  const {open} = useAside();
  const [quantity, setQuantity] = useState(1);
  const [purchaseOption, setPurchaseOption] = useState({
    variantId: '',
    planId: '',
  });
  const variantId = selectedVariant?.id ?? '';
  useEffect(() => {
    setPurchaseOption({variantId, planId: ''});
  }, [variantId]);
  const allocations = selectedVariant?.requiresComponents
    ? []
    : (selectedVariant?.sellingPlanAllocations?.nodes ?? []).filter(
        (allocation) => allocation.sellingPlan.recurringDeliveries,
      );
  const selectedAllocation =
    purchaseOption.variantId === variantId
      ? allocations.find(
          (allocation) => allocation.sellingPlan.id === purchaseOption.planId,
        )
      : undefined;
  const requiresSellingPlan = selectedVariant?.product.requiresSellingPlan;
  const canPurchase = Boolean(
    selectedVariant?.availableForSale &&
    (!requiresSellingPlan || selectedAllocation),
  );
  const price = Number(
    selectedAllocation?.checkoutChargeAmount.amount ??
      selectedVariant?.price.amount ??
      0,
  );
  const currency = selectedVariant?.price.currencyCode ?? 'CAD';
  const money = (value: number) =>
    new Intl.NumberFormat(moneyLocale(currency), {style: 'currency', currency}).format(value);
  const normalizeOpt = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[\u2014\u2013\u00b7\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const matchChoiceOption = (optName?: string, choiceVariant?: string, qty?: number) => {
    if (!optName) return false;
    if (choiceVariant && normalizeOpt(optName) === normalizeOpt(choiceVariant)) {
      return true;
    }
    if (qty && new RegExp(`^${qty}\\s*(kit|pack|planner|set|unit|pair|dress)`, 'i').test(optName.trim())) {
      return true;
    }
    return false;
  };
  const variantLabel =
    selectedVariant?.selectedOptions
      .filter(({value}) => value !== 'Default Title')
      .map(({value}) => value.replace(/\s*\u2014\s*/g, ' · '))
      .join(' / ') ?? '';
  // Packs that are their own variants (e.g. "2 sets" at its own price) choose
  // that variant; the bag gets one of it, so the bag price is the pack price.
  const packChoices = (offerChoices ?? []).filter(
    (choice) => choice.variant && choice.quantity <= 2,
  );
  const packOption = packChoices.length
    ? productOptions.find((option) =>
        option.optionValues.some((value) =>
          packChoices.some((choice) =>
            matchChoiceOption(value.name, choice.variant, choice.quantity),
          ),
        ),
      )
    : undefined;
  const isSolarProduct = /solar|blackout|dome/i.test(
    selectedVariant?.product?.handle || selectedVariant?.product?.title || '',
  );
  const isWaterPurifierProduct = /water-purifier|water-pump|0\.01-micron|purifier/i.test(
    selectedVariant?.product?.handle || selectedVariant?.product?.title || '',
  );
  const shippingNote =
    shippingLine ||
    (isWaterPurifierProduct
      ? 'FREE Tracked U.S. Shipping on the 2-Kit Family Reserve (Orders $150+)'
      : 'FREE Tracked Shipping on the 2-Pack Bundle & Orders $60+');
  const buyRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    const target = buyRef.current;
    if (!sticky || !target || typeof IntersectionObserver === 'undefined')
      return;
    // Show the sticky bar only once the shopper has scrolled past the main
    // Add to bag button, never while they are still at the top of the hero.
    const observer = new IntersectionObserver(
      ([entry]) =>
        setStickyVisible(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        ),
      {threshold: [0, 1]},
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [sticky]);
  const [protectShipping, setProtectShipping] = useState(true);
  const optimisticProtectionVariant = {
    id: SHIPPING_PROTECTION_VARIANT_ID,
    availableForSale: true,
    price: {amount: String(SHIPPING_PROTECTION_PRICE), currencyCode: currency},
    compareAtPrice: null,
    title: 'Default Title',
    selectedOptions: [{name: 'Title', value: 'Default Title'}],
    requiresShipping: false,
    image: {
      url: '/images/wftn/shipping-protection-badge.jpg',
      altText: 'Hardcover Corner & Transit Protection',
      width: 600,
      height: 600,
    },
    product: {
      handle: 'shipping-protection',
      title: 'Hardcover Corner & Transit Protection',
    },
  } as any;
  const lines =
    selectedVariant && canPurchase
      ? [
          {
            merchandiseId: selectedVariant.id,
            quantity,
            selectedVariant,
            ...(selectedAllocation
              ? {sellingPlanId: selectedAllocation.sellingPlan.id}
              : {}),
          },
          ...(protectShipping
            ? [
                {
                  merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                  quantity: 1,
                  selectedVariant: optimisticProtectionVariant,
                },
              ]
            : []),
        ]
      : [];
  const buttonLabel = !selectedVariant?.availableForSale
    ? 'Sold out'
    : requiresSellingPlan && !selectedAllocation
      ? 'Select a purchase plan'
      : selectedAllocation
        ? 'Subscribe'
        : 'Add to bag';
  return (
    <div className="product-form" id="choose">
      {productOptions.map((option) => {
        if (option.optionValues.length === 1 || option === packOption)
          return null;
        const color = isColorOption(option.name);
        return (
          <fieldset className="product-options" key={option.name}>
            <legend>
              {option.name}
              <span>{option.optionValues.find((v) => v.selected)?.name}</span>
              {!color && /size/i.test(option.name) && sizeGuide}
            </legend>
            <div
              className={`product-options-grid ${color ? 'color-options' : 'size-options'}`}
            >
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;
                const content = color ? (
                  <>
                    <span
                      className="color-dot"
                      style={{
                        backgroundColor: swatchColor(name, swatch?.color),
                      }}
                    />
                    <span className="sr-only">{name}</span>
                  </>
                ) : (
                  name
                    .replace(/\s*\([^)]*\)/g, '')
                    .replace('Small', 'S')
                    .replace('Medium', 'M')
                    .replace('X-Large', 'XL')
                    .replace('Large', 'L')
                );
                const label = `${option.name}: ${name}${!available ? ' (unavailable)' : ''}`;
                return isDifferentProduct ? (
                  <Link
                    key={name}
                    aria-label={label}
                    aria-current={selected ? 'true' : undefined}
                    className={`option ${selected ? 'selected' : ''} ${!available ? 'unavailable' : ''}`}
                    replace
                    preventScrollReset
                    to={`/products/${handle}?${variantQuery(variantUriQuery)}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={name}
                    type="button"
                    aria-label={label}
                    aria-pressed={selected}
                    className={`option ${selected ? 'selected' : ''} ${!available ? 'unavailable' : ''}`}
                    disabled={!exists}
                    onClick={() => {
                      if (!selected)
                        void navigate(`?${variantQuery(variantUriQuery)}`, {
                          replace: true,
                          preventScrollReset: true,
                        });
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {allocations.length > 0 && (
        <fieldset className="product-options">
          <legend>Purchase option</legend>
          {!requiresSellingPlan && (
            <label className="bundle-option">
              <input
                type="radio"
                name="purchase-option"
                checked={!selectedAllocation}
                onChange={() => setPurchaseOption({variantId, planId: ''})}
              />
              <span>
                <strong>One-time purchase</strong>
              </span>
              <b>{money(Number(selectedVariant?.price.amount ?? 0))}</b>
            </label>
          )}
          {allocations.map((allocation) => (
            <label className="bundle-option" key={allocation.sellingPlan.id}>
              <input
                type="radio"
                name="purchase-option"
                checked={
                  selectedAllocation?.sellingPlan.id ===
                  allocation.sellingPlan.id
                }
                onChange={() =>
                  setPurchaseOption({
                    variantId,
                    planId: allocation.sellingPlan.id,
                  })
                }
              />
              <span>
                <strong>{allocation.sellingPlan.name}</strong>
                {allocation.sellingPlan.options.map((option) => (
                  <small key={`${option.name}-${option.value}`}>
                    {option.name}: {option.value}
                  </small>
                ))}
                <small>
                  Per item, due at checkout before shipping and taxes
                </small>
              </span>
              <b>{money(Number(allocation.checkoutChargeAmount.amount))}</b>
            </label>
          ))}
        </fieldset>
      )}
      {selectedAllocation && (
        <p className="bundle-note" role="status">
          Recurring delivery.{' '}
          {selectedAllocation.sellingPlan.deliveryPolicy && (
            <>
              Delivered every{' '}
              {selectedAllocation.sellingPlan.deliveryPolicy.intervalCount}{' '}
              {selectedAllocation.sellingPlan.deliveryPolicy.interval.toLowerCase()}
              (s).{' '}
            </>
          )}
          {selectedAllocation.sellingPlan.billingPolicy && (
            <>
              Billed every{' '}
              {selectedAllocation.sellingPlan.billingPolicy.intervalCount}{' '}
              {selectedAllocation.sellingPlan.billingPolicy.interval.toLowerCase()}
              (s).{' '}
            </>
          )}
          {selectedAllocation.priceAdjustments[0] && (
            <>
              Initial price per delivery:{' '}
              {money(
                Number(
                  selectedAllocation.priceAdjustments[0].perDeliveryPrice
                    .amount,
                ) * quantity,
              )}
              .{' '}
            </>
          )}
          Review future charges and cancellation terms at checkout.
        </p>
      )}
      {requiresSellingPlan && !selectedAllocation && (
        <p className="bundle-note" role="status">
          {allocations.length > 0
            ? 'Choose a subscription plan to add this item.'
            : 'This item requires a purchase plan that is not currently available here.'}
        </p>
      )}
      {quantityMode === 'stepper' ? (
        <div className="quantity-row">
          <span id="quantity-label">Quantity</span>
          <div
            className="quantity-stepper"
            role="group"
            aria-labelledby="quantity-label"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= 10}
              onClick={() => setQuantity((value) => Math.min(10, value + 1))}
            >
              +
            </button>
          </div>
        </div>
      ) : packOption ? (
        <>
          <fieldset className="bundle-options is-variant-packs">
            <legend>How many?</legend>
            {packChoices.map((choice) => {
              const value = packOption.optionValues.find((item) =>
                matchChoiceOption(item.name, choice.variant, choice.quantity),
              );
              if (!value?.exists || !value.variant) return null;
              const total = Number(value.variant.price.amount);
              const was = value.variant.compareAtPrice
                ? Number(value.variant.compareAtPrice.amount)
                : 0;
              const pctOff =
                isWaterPurifierProduct && choice.quantity === 2
                  ? 15
                  : was > total
                    ? Math.floor(((was - total) / was) * 20) * 5
                    : 0;
              const shipsFree = choice.quantity >= 2;
              const ribbon =
                choice.quantity === 2
                  ? '★ MOST POPULAR · BEST VALUE'
                  : null;
              return (
                <label
                  className={`bundle-option ${ribbon ? 'has-ribbon' : ''} ${choice.quantity === 2 ? 'is-popular-pack' : ''} ${value.selected ? 'selected' : ''} ${!value.available ? 'unavailable' : ''}`}
                  key={choice.variant}
                >
                  {ribbon && (
                    <span
                      className={`bundle-ribbon ${choice.quantity === 2 ? 'is-popular' : 'is-best-value'}`}
                    >
                      {ribbon}
                    </span>
                  )}
                  <input
                    type="radio"
                    name="bundle"
                    value={choice.variant}
                    checked={value.selected}
                    disabled={!value.available}
                    onChange={() => {
                      if (!value.selected)
                        void navigate(`?${variantQuery(value.variantUriQuery)}`, {
                          replace: true,
                          preventScrollReset: true,
                        });
                    }}
                  />
                  <span>
                    <strong>
                      <span className="bundle-title-text">{choice.label}</span>
                      {(pctOff > 0 || shipsFree) && (
                        <span className="bundle-tags-row">
                          {pctOff > 0 && (
                            <em className="bundle-tag">SAVE {pctOff}%</em>
                          )}
                          {shipsFree && <em className="bundle-tag">Ships free</em>}
                        </span>
                      )}
                    </strong>
                    <small>{choice.caption}</small>
                  </span>
                  <b>
                    {was > total ? (
                      <s className="bundle-was">{money(was)}</s>
                    ) : null}
                    {money(total)}
                    {choice.quantity > 1 && (
                      <small>{money(total / choice.quantity)} each</small>
                    )}
                  </b>
                </label>
              );
            })}
          </fieldset>
          <p className="bundle-note pdp-ship-line">
            <Icon name="truck" size={16} />
            <span>{shippingNote}</span>
          </p>
        </>
      ) : (
        <>
          <fieldset className="bundle-options">
            <legend>How many?</legend>
            {(
              offerChoices || [
                {
                  quantity: 1,
                  label: 'One',
                  caption: 'One of your selected option',
                },
                {
                  quantity: 2,
                  label: 'Two',
                  caption: 'Two of your selected option',
                },
              ]
            )
              .filter((c) => c.quantity <= 2)
              .map(({quantity: amount, label, caption}) => {
              const total = price * Number(amount);
              const shipsFree = Number(amount) >= 2;
              return (
                <label
                  className={`bundle-option ${quantity === amount ? 'selected' : ''}`}
                  key={amount}
                >
                  <input
                    type="radio"
                    name="bundle"
                    value={amount}
                    checked={quantity === amount}
                    onChange={() => setQuantity(Number(amount))}
                  />
                  <span>
                    <strong>
                      {label}
                      {shipsFree && <em className="bundle-tag">Ships free</em>}
                    </strong>
                    <small>{caption}</small>
                  </span>
                  <b>
                    {compareAt ? (
                      <s className="bundle-was">
                        {money(compareAt * Number(amount))}
                      </s>
                    ) : null}
                    {money(total)}
                  </b>
                </label>
              );
            })}
          </fieldset>
          {shippingLine && (
            <p className="bundle-note pdp-ship-line">
              <Icon name="truck" size={16} />
              <span>{shippingLine}</span>
            </p>
          )}
          <p className="bundle-note">
            {compareAt
              ? `${Math.round((1 - price / compareAt) * 100)}% off every piece`
              : 'Same price per item'}
            {shippingNote && !shippingLine ? ` · ${shippingNote}` : ''}
            {selectedAllocation
              ? ' · Shown due at checkout before shipping and taxes'
              : ''}
          </p>
        </>
      )}
      <div className="pdp-urgency-strip" role="status">
        <div className="pdp-urgency-top">
          <Icon name="clock" size={15} />
          <strong>
            Only 9 left in stock · Ready to ship today
          </strong>
        </div>
        <div className="pdp-urgency-meter" aria-hidden="true">
          <span style={{width: '88%'}} />
        </div>
        <small>
          {isWaterPurifierProduct || isSolarProduct
            ? 'High preparedness & outdoor demand · Order today before these last 9 sell out'
            : 'High holiday demand · Order today before these last 9 sell out'}
        </small>
      </div>
      <div ref={buyRef}>
        <AddToCartButton
          disabled={!canPurchase}
          onClick={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('merrivy_added_to_bag', '1');
            }
            open('cart');
          }}
          lines={lines}
        >
          <span>
            {buttonLabel} · {money(price * quantity)}
          </span>
          <Icon name="arrow" />
        </AddToCartButton>
      </div>
      <ExitIntentModal
        openCart={() => open('cart')}
        optimisticProtectionVariant={optimisticProtectionVariant}
        packChoices={packChoices}
        packOption={packOption}
        selectedVariant={selectedVariant}
        fallbackPrice={price}
        money={money}
      />
      {sticky && (
        <div
          className={`sticky-buy ${stickyVisible ? 'is-visible' : ''}`}
          aria-hidden={!stickyVisible}
        >
          <img src={sticky.image} alt="" />
          <div className="sticky-buy-text">
            <strong>{sticky.title}</strong>
            <span>
              {variantLabel}
              {quantity > 1 ? ` · ${quantity} pieces` : ''}
            </span>
          </div>
          <AddToCartButton
            disabled={!canPurchase}
            onClick={() => open('cart')}
            lines={lines}
          >
            <span>
              {buttonLabel} · {money(price * quantity)}
            </span>
            <Icon name="arrow" />
          </AddToCartButton>
        </div>
      )}
    </div>
  );
}

function ExitIntentModal({
  openCart,
  optimisticProtectionVariant,
  packChoices,
  packOption,
  selectedVariant,
  fallbackPrice,
  money,
}: {
  openCart: () => void;
  optimisticProtectionVariant: any;
  packChoices: {
    quantity: number;
    label: string;
    caption: string;
    variant?: string;
  }[];
  packOption?: MappedProductOptions;
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  fallbackPrice: number;
  money: (value: number) => string;
}) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'nudge' | 'free-ship'>('nudge');
  const [secondsLeft, setSecondsLeft] = useState(300);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('nudge') === '1') {
      setStep('nudge');
      setVisible(true);
      return;
    }
    if (params.get('nudge') === '2') {
      setStep('free-ship');
      setVisible(true);
      return;
    }

    // Only trigger if the visitor has been browsing the page for 32 seconds
    // and still hasn't added anything to their bag (never on random scroll).
    const idleTimer = setTimeout(() => {
      if (
        sessionStorage.getItem('merrivy_browse_nudge_shown') ||
        sessionStorage.getItem('merrivy_added_to_bag')
      ) {
        return;
      }
      sessionStorage.setItem('merrivy_browse_nudge_shown', '1');
      setStep('nudge');
      setVisible(true);
    }, 32000);

    return () => {
      clearTimeout(idleTimer);
    };
  }, []);

  useEffect(() => {
    if (!visible || step !== 'free-ship') return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [visible, step]);

  if (!visible) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const normalizeModalOpt = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[\u2014\u2013\u00b7\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const onePackChoice = packChoices.find((c) => c.quantity === 1);
  const twoPackChoice = packChoices.find((c) => c.quantity === 2);
  const onePackVal = packOption?.optionValues.find(
    (item) =>
      normalizeModalOpt(item.name) === normalizeModalOpt(onePackChoice?.variant) ||
      /^1\s*(kit|pack|planner|set|unit)/i.test(item.name.trim()),
  );
  const twoPackVal = packOption?.optionValues.find(
    (item) =>
      normalizeModalOpt(item.name) === normalizeModalOpt(twoPackChoice?.variant) ||
      /^2\s*(kit|pack|planner|set|unit)/i.test(item.name.trim()),
  );
  const onePackVariantId =
    onePackVal?.variant?.id ?? selectedVariant?.id ?? ONE_PLANNER_VARIANT_ID;
  const twoPackVariantId =
    twoPackVal?.variant?.id ?? selectedVariant?.id ?? TWO_PLANNER_VARIANT_ID;
  const onePackPrice = Number(
    onePackVal?.variant?.price?.amount ?? fallbackPrice ?? 39.99,
  );
  const twoPackPrice = Number(
    twoPackVal?.variant?.price?.amount ??
      (fallbackPrice ? Number((fallbackPrice * 1.6).toFixed(2)) : 63.98),
  );
  const onePackLabel = onePackChoice?.label || '1-Unit Starter';
  const twoPackLabel = twoPackChoice?.label || '2-Pack Bundle';
  const matchedPacket = getPacketByHandle(selectedVariant?.product?.handle);
  const shortName =
    matchedPacket?.shortName ||
    selectedVariant?.product?.title ||
    campaign.shortName ||
    'Order';

  const handleClaim = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('merrivy_added_to_bag', '1');
    }
    setVisible(false);
    openCart();
  };

  return (
    <div
      className="exit-modal-backdrop"
      style={{display: visible ? 'flex' : 'none'}}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
    >
      <div className="exit-modal-card">
        <button
          type="button"
          className="exit-modal-close"
          aria-label="Close helper"
          onClick={() => setVisible(false)}
        >
          <Icon name="close" size={15} />
        </button>

        {step === 'nudge' ? (
          <>
            <span className="exit-modal-badge">
              <Icon name="sparkle" size={13} />
              <span>STILL DECIDING? · 30-DAY RISK-FREE TRIAL</span>
            </span>
            <h3 id="exit-modal-title">
              Want to Reserve Your {shortName} Before Today’s Batch Sells Out?
            </h3>
            <p className="exit-modal-copy">
              Every order is backed by our{' '}
              <strong>30-Day Money-Back Guarantee</strong>. Add your choice to
              the cart now to lock in today’s inventory:
            </p>
            <div className="exit-modal-actions">
              {twoPackChoice && (
                <CartForm
                  route="/cart"
                  action={CartForm.ACTIONS.LinesAdd}
                  inputs={
                    {
                      lines: [
                        {
                          merchandiseId: twoPackVariantId,
                          quantity: 1,
                        },
                        {
                          merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                          quantity: 1,
                          selectedVariant: optimisticProtectionVariant,
                        },
                      ],
                    } as any
                  }
                >
                  <button
                    type="submit"
                    className="exit-modal-cta is-primary"
                    onClick={handleClaim}
                  >
                    <span className="exit-modal-cta-row">
                      <strong>
                        Add 2-Pack Bundle ({money(twoPackPrice)}) · FREE
                        Shipping
                      </strong>
                      <Icon name="arrow" size={15} />
                    </span>
                    <small>
                      ★ Most Popular · Saves $7.99 Tracked Shipping + Bundle
                      Discount
                    </small>
                  </button>
                </CartForm>
              )}
              <CartForm
                route="/cart"
                action={CartForm.ACTIONS.LinesAdd}
                inputs={
                  {
                    lines: [
                      {
                        merchandiseId: onePackVariantId,
                        quantity: 1,
                      },
                      {
                        merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                        quantity: 1,
                        selectedVariant: optimisticProtectionVariant,
                      },
                    ],
                  } as any
                }
              >
                <button
                  type="submit"
                  className={`exit-modal-cta ${twoPackChoice ? 'is-secondary' : 'is-primary'}`}
                  onClick={handleClaim}
                >
                  <span className="exit-modal-cta-row">
                    <strong>
                      Add {onePackLabel} ({money(onePackPrice)}) to My Cart
                    </strong>
                    <Icon name="arrow" size={15} />
                  </span>
                  <small>
                    Standard 1-unit order (+$7.99 shipping · Free shipping over
                    $60)
                  </small>
                </button>
              </CartForm>
            </div>
            <button
              type="button"
              className="exit-modal-dismiss is-escalate-btn"
              onClick={() => setStep('free-ship')}
            >
              Not right now · I’m hesitating over the $7.99 shipping / price →
            </button>
          </>
        ) : (
          <>
            <span className="exit-modal-badge">
              <Icon name="truck" size={13} />
              <span>WAIT · WE’LL COVER YOUR $7.99 SHIPPING TODAY!</span>
            </span>
            <h3 id="exit-modal-title">
              Get FREE Tracked Shipping (Save $7.99) When You Add to Cart Now
            </h3>
            <div className="exit-modal-timer">
              <Icon name="clock" size={15} />
              <span>
                Courtesy Free Shipping Pass expires in{' '}
                <strong>
                  {mins}:{secs}
                </strong>
              </span>
            </div>
            <p className="exit-modal-copy">
              Don’t let the $7.99 shipping fee hold you back! Tap below and
              we’ll automatically apply{' '}
              <strong>VIP Free Tracked Shipping (Code: FREESHIPVIP)</strong> to
              your order at checkout:
            </p>
            <div className="exit-modal-actions">
              <CartForm
                route="/cart"
                action={CartForm.ACTIONS.LinesAdd}
                inputs={
                  {
                    lines: [
                      {
                        merchandiseId: onePackVariantId,
                        quantity: 1,
                      },
                      {
                        merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                        quantity: 1,
                        selectedVariant: optimisticProtectionVariant,
                      },
                    ],
                    discountCode: 'FREESHIPVIP',
                  } as any
                }
              >
                <button
                  type="submit"
                  className="exit-modal-cta is-primary"
                  onClick={handleClaim}
                >
                  <span className="exit-modal-cta-row">
                    <strong>
                      Claim FREE Shipping (Save $7.99) · {onePackLabel} (
                      {money(onePackPrice)})
                    </strong>
                    <Icon name="arrow" size={15} />
                  </span>
                  <small>
                    Code FREESHIPVIP (-$7.99 shipping) applied automatically at
                    checkout
                  </small>
                </button>
              </CartForm>
              {twoPackChoice && (
                <CartForm
                  route="/cart"
                  action={CartForm.ACTIONS.LinesAdd}
                  inputs={
                    {
                      lines: [
                        {
                          merchandiseId: twoPackVariantId,
                          quantity: 1,
                        },
                        {
                          merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                          quantity: 1,
                          selectedVariant: optimisticProtectionVariant,
                        },
                      ],
                      discountCode: 'SECRET5',
                    } as any
                  }
                >
                  <button
                    type="submit"
                    className="exit-modal-cta is-secondary"
                    onClick={handleClaim}
                  >
                    <span className="exit-modal-cta-row">
                      <strong>
                        Or Take {money(5)} Off 2-Pack Bundle (
                        {money(Math.max(0, twoPackPrice - 5))}) + FREE Shipping
                      </strong>
                      <Icon name="arrow" size={15} />
                    </span>
                    <small>
                      2-Pack Bundle + Free Tracked Shipping + Extra {money(5)}{' '}
                      VIP Credit (SECRET5)
                    </small>
                  </button>
                </CartForm>
              )}
            </div>
            <button
              type="button"
              className="exit-modal-dismiss"
              onClick={() => setVisible(false)}
            >
              No thanks, I’ll pass on the free shipping pass
            </button>
          </>
        )}
      </div>
    </div>
  );
}
