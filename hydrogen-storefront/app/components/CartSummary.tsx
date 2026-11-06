import {useEffect, useState} from 'react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from './CartMain';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {Link, useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import {useAside} from './Aside';
import {Icon} from './Icons';
import {CartSavings} from './Offer';
import {campaign, getPacketByHandle, type CampaignPacket} from '~/content/templates';
import {SupportEmail} from './SupportEmail';
import {moneyLocale} from '~/lib/money';
import {
  SHIPPING_PROTECTION_PRICE,
  SHIPPING_PROTECTION_VARIANT_ID,
} from './ProductForm';

const SINGLE_PLANNER_VARIANT_ID = 'gid://shopify/ProductVariant/51050399957049';
const TWO_PLANNER_VARIANT_ID = 'gid://shopify/ProductVariant/51050399989817';

export function CartSummary({
  cart,
  layout,
}: {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
}) {
  const {close} = useAside();
  const root = useRouteLoaderData<RootLoader>('root');
  const domain = root?.publicStoreDomain ?? '';
  const isSample = domain === 'mock.shop' || domain.endsWith('.mock.shop');
  const pending = cart?.lines.nodes.some((line) => line.isOptimistic);
  const currency = cart?.cost?.subtotalAmount?.currencyCode ?? 'USD';
  const lines = cart?.lines?.nodes ?? [];
  const protectionLine = lines.find(
    (line) =>
      line.merchandise?.id === SHIPPING_PROTECTION_VARIANT_ID ||
      line.merchandise?.product?.handle === 'shipping-protection',
  );
  const singlePlannerLine = lines.find(
    (line) =>
      (line.merchandise?.id === SINGLE_PLANNER_VARIANT_ID ||
        line.merchandise?.selectedOptions?.some(
          (opt) => opt.name === 'Pack' && opt.value === '1 planner',
        )) &&
      line.quantity === 1,
  );
  const physicalLines = lines.filter(
    (line) =>
      line.merchandise?.id !== SHIPPING_PROTECTION_VARIANT_ID &&
      line.merchandise?.product?.handle !== 'shipping-protection',
  );
  const physicalSubtotal = physicalLines.reduce(
    (sum, line) =>
      sum +
      Number(line.merchandise?.price?.amount ?? 0) *
        Number(line.quantity ?? 1),
    0,
  );
  const hasMultiBundle = physicalLines.some(
    (line) =>
      Number(line.quantity ?? 1) >= 2 ||
      line.merchandise?.selectedOptions?.some((opt) =>
        /^[23]\b|2\s*kits?|3\s*kits?|2\s*planners?|3\s*planners?|2\s*dress|3\s*dress|2\s*heating|3\s*heating/i.test(
          opt.value,
        ),
      ),
  );
  const hasFreeShipVipCode = Boolean(
    cart?.discountCodes?.some(
      (c) => c.code?.toUpperCase() === 'FREESHIPVIP' && c.applicable !== false,
    ),
  );
  const hasSecret5Code = Boolean(
    cart?.discountCodes?.some(
      (c) => c.code?.toUpperCase() === 'SECRET5' && c.applicable !== false,
    ),
  );
  const activePacket =
    physicalLines
      .map((line) => getPacketByHandle(line.merchandise?.product?.handle))
      .find((pkt): pkt is CampaignPacket => Boolean(pkt)) ?? campaign;
  const freeShippingThreshold = Math.max(
    (activePacket.offer as {freeShippingThreshold?: number})
      ?.freeShippingThreshold ??
      activePacket.offer?.freeShippingOver ??
      60,
    60,
  );
  const qualifiesFreeShipping =
    hasMultiBundle ||
    physicalSubtotal >= freeShippingThreshold ||
    hasFreeShipVipCode;
  const [hesitationVisible, setHesitationVisible] = useState(false);
  useEffect(() => {
    if (physicalLines.length === 0) {
      setHesitationVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      setHesitationVisible(true);
    }, 18000);
    return () => clearTimeout(timer);
  }, [physicalLines.length]);

  const compareSaved = lines.reduce((sum, line) => {
    const unit = Number(line.merchandise?.price?.amount ?? 0);
    const was = Number(line.merchandise?.compareAtPrice?.amount ?? 0);
    const qty = Number(line.quantity ?? 1);
    return was > unit ? sum + (was - unit) * qty : sum;
  }, 0);
  const formatSaved = (value: number) =>
    new Intl.NumberFormat(moneyLocale(currency), {
      style: 'currency',
      currency,
    }).format(value);
  return (
    <div
      className={layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside'}
    >
      <div
        className={`cart-protection-card ${protectionLine ? 'is-protected' : ''}`}
      >
        <div className="cart-protection-head">
          <span className="cart-protection-icon" aria-hidden="true">
            <Icon name="shield" size={18} />
          </span>
          <div className="cart-protection-text">
            <strong>
              Package &amp; Transit Protection{' '}
              <span>{formatSaved(SHIPPING_PROTECTION_PRICE)}</span>
            </strong>
            <small>
              100% instant replacement if your order arrives damaged, wet, or
              lost in transit.
            </small>
          </div>
          {protectionLine ? (
            <CartForm
              route="/cart"
              action={CartForm.ACTIONS.LinesRemove}
              inputs={{lineIds: [protectionLine.id]}}
            >
              <button
                type="submit"
                className="cart-protection-toggle is-on"
                aria-pressed="true"
                disabled={Boolean(pending)}
                title="Remove shipping protection"
              >
                <span className="cart-toggle-knob" />
                <span className="sr-only">Protected</span>
              </button>
            </CartForm>
          ) : (
            <CartForm
              route="/cart"
              action={CartForm.ACTIONS.LinesAdd}
              inputs={{
                lines: [
                  {
                    merchandiseId: SHIPPING_PROTECTION_VARIANT_ID,
                    quantity: 1,
                  },
                ],
              }}
            >
              <button
                type="submit"
                className="cart-protection-toggle is-off"
                aria-pressed="false"
                disabled={Boolean(pending)}
                title="Add shipping protection"
              >
                <span className="cart-toggle-knob" />
                <span className="sr-only">Add protection</span>
              </button>
            </CartForm>
          )}
        </div>
      </div>
      <h4>Your order</h4>
      <dl className="cart-subtotal">
        <dt>Subtotal</dt>
        <dd aria-live="polite">
          {pending ? (
            'Updating…'
          ) : cart?.cost?.subtotalAmount ? (
            <Money data={cart.cost.subtotalAmount} />
          ) : (
            '—'
          )}
        </dd>
      </dl>
      <dl className="cart-subtotal is-shipping-line">
        <dt>Tracked Shipping</dt>
        <dd>
          {qualifiesFreeShipping ? (
            <strong>
              {hasFreeShipVipCode && !hasMultiBundle && physicalSubtotal < 60
                ? 'FREE (VIP Pass · Saved $7.99)'
                : 'FREE (Saved $7.99)'}
            </strong>
          ) : (
            <span>{formatSaved(7.99)} (FREE w/ 2-Pack or $60+)</span>
          )}
        </dd>
      </dl>
      {!pending && compareSaved > 0 && (
        <p className="cart-savings is-bundle-saved">
          <Icon name="check" size={15} />
          <span>
            Holiday savings applied · you save{' '}
            <strong>{formatSaved(compareSaved)}</strong>
          </span>
        </p>
      )}
      {hasFreeShipVipCode && (
        <div
          className="cart-savings is-vip-discount"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
            <Icon name="check" size={15} />
            <span>
              <strong>Courtesy FREE Shipping (FREESHIPVIP)</strong> applied at
              checkout
            </span>
          </span>
          <CartForm
            route="/cart"
            action={CartForm.ACTIONS.DiscountCodesUpdate}
            inputs={{
              discountCode: '',
              discountCodes: hasSecret5Code ? ['SECRET5'] : [],
            }}
          >
            <button
              type="submit"
              className="text-link"
              style={{fontSize: '0.75rem', whiteSpace: 'nowrap'}}
              title="Remove Free Shipping Pass"
            >
              Remove ×
            </button>
          </CartForm>
        </div>
      )}
      {hasSecret5Code && (
        <div
          className="cart-savings is-vip-discount"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
            <Icon name="check" size={15} />
            <span>
              <strong>+$5.00 VIP Checkout Credit (SECRET5)</strong> applied at
              checkout
            </span>
          </span>
          <CartForm
            route="/cart"
            action={CartForm.ACTIONS.DiscountCodesUpdate}
            inputs={{
              discountCode: '',
              discountCodes: hasFreeShipVipCode ? ['FREESHIPVIP'] : [],
            }}
          >
            <button
              type="submit"
              className="text-link"
              style={{fontSize: '0.75rem', whiteSpace: 'nowrap'}}
              title="Remove $5.00 Credit"
            >
              Remove ×
            </button>
          </CartForm>
        </div>
      )}
      {hesitationVisible && !qualifiesFreeShipping && (
        <div
          className="cart-upgrade-banner"
          style={{marginBottom: '10px', padding: '12px'}}
        >
          <div className="cart-upgrade-copy">
            <span className="cart-upgrade-badge">
              <Icon name="truck" size={12} /> STILL DECIDING ON CHECKOUT?
            </span>
            <strong>
              Don’t Let the $7.99 Shipping Fee Stop You · We’ll Cover It!
            </strong>
            <small>
              Tap below to apply a one-time{' '}
              <b>Courtesy FREE Tracked Shipping Pass (Saves $7.99)</b> directly
              to your checkout right now:
            </small>
          </div>
          <CartForm
            route="/cart"
            action={CartForm.ACTIONS.DiscountCodesUpdate}
            inputs={{
              discountCode: 'FREESHIPVIP',
              discountCodes: hasSecret5Code ? ['SECRET5'] : [],
            }}
          >
            <button
              type="submit"
              className="cart-upgrade-btn"
              disabled={Boolean(pending)}
            >
              <span>⚡ Apply FREE Shipping (-$7.99) to My Order Now</span>
              <Icon name="arrow" size={14} />
            </button>
          </CartForm>
        </div>
      )}
      {hesitationVisible && qualifiesFreeShipping && !hasSecret5Code && (
        <div
          className="cart-upgrade-banner"
          style={{marginBottom: '10px', padding: '12px'}}
        >
          <div className="cart-upgrade-copy">
            <span className="cart-upgrade-badge">
              <Icon name="gift" size={12} /> READY TO COMPLETE YOUR ORDER?
            </span>
            <strong>
              Take an Extra $5.00 Instant Credit When You Check Out Now!
            </strong>
            <small>
              You already unlocked <b>FREE Tracked Shipping</b>. Tap below to
              stack an extra <b>$5.00 VIP Checkout Credit (SECRET5)</b> on your
              order:
            </small>
          </div>
          <CartForm
            route="/cart"
            action={CartForm.ACTIONS.DiscountCodesUpdate}
            inputs={{
              discountCode: 'SECRET5',
              discountCodes: hasFreeShipVipCode ? ['FREESHIPVIP'] : [],
            }}
          >
            <button
              type="submit"
              className="cart-upgrade-btn"
              disabled={Boolean(pending)}
            >
              <span>🎁 Apply Extra $5.00 Off (SECRET5) to My Bag</span>
              <Icon name="arrow" size={14} />
            </button>
          </CartForm>
        </div>
      )}
      {!pending && compareSaved <= 0 && cart?.cost?.subtotalAmount && (
        <CartSavings
          subtotal={Number(cart.cost.subtotalAmount.amount)}
          currency={cart.cost.subtotalAmount.currencyCode ?? 'CAD'}
          isSample={isSample}
        />
      )}
      <p className="cart-disclaimer">
        {qualifiesFreeShipping
          ? 'Free tracked shipping unlocked (US, CA, UK, AU & NZ).'
          : '$7.99 tracked shipping · upgrade to the 2-Pack or orders $60+ for FREE shipping.'}{' '}
        Taxes and eligible discounts are calculated at checkout. Questions
        first? <SupportEmail />
      </p>
      {pending ? (
        <button className="button-primary" disabled>
          Updating your bag…
        </button>
      ) : (
        <Link
          onClick={() => {
            if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
              const physLines = lines.filter(
                (line) =>
                  line.merchandise?.id !== SHIPPING_PROTECTION_VARIANT_ID &&
                  line.merchandise?.product?.handle !== 'shipping-protection',
              );
              const primaryProd = physLines[0]?.merchandise?.product;
              const contentIds = physLines
                .map((l) => String(l.merchandise?.product?.id || '').split('/').pop() || '')
                .filter((id) => id && !id.startsWith('preview-'));
              const pPath = window.location.pathname.toLowerCase();
              const handleStr = String(primaryProd?.handle || '').toLowerCase();
              const isSolar =
                contentIds.includes('10418906497081') ||
                handleStr.includes('solar') ||
                pPath.includes('solar') ||
                sessionStorage.getItem('merrivy_active_pixel') === '1656598869345569';
              const isDress = !isSolar && handleStr.includes('tartan');
              const targetPixelId = isSolar
                ? '1656598869345569'
                : '1003355539496617';
              (window as any).fbq('trackSingle', targetPixelId, 'InitiateCheckout', {
                content_name:
                  primaryProd?.title ||
                  (isSolar
                    ? 'The Split-Panel Solar Indoor & Outdoor Ceiling Light Kit (2-Pack)'
                    : isDress
                      ? 'Holiday Tartan Plaid Satin-Bow Puff-Sleeve Babydoll Mini Dress'
                      : 'Waiting for the Night: The Witching Hour 2027 Dated Weekly Planner'),
                content_ids: contentIds.length
                  ? [...new Set(contentIds)]
                  : [
                      isSolar
                        ? '10418906497081'
                        : isDress
                          ? '10418259001593'
                          : '10416592814137',
                    ],
                content_type: 'product_group',
                value: Number(
                  cart?.cost?.subtotalAmount?.amount ??
                    (isSolar ? 39.99 : isDress ? 44.99 : 34.99),
                ),
                currency: cart?.cost?.subtotalAmount?.currencyCode ?? 'USD',
              });
            }
            close();
          }}
          className="button-primary"
          to="/checkout"
          reloadDocument
        >
          Continue to checkout{' '}
          <Icon name="arrow" />
        </Link>
      )}
      <p className="cart-guarantee-badge">
        <Icon name="shield" size={14} />
        <span>30-Day Money-Back Guarantee · Secure Encrypted Checkout</span>
      </p>
      <Link onClick={close} className="text-link" to="/cart">
        View your bag
      </Link>
    </div>
  );
}
