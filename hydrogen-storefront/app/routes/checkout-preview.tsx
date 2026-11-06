import {useLoaderData, Link} from 'react-router';
import {useState} from 'react';
import {demoService} from '~/content/demo-service';
import {campaign, offerBonus} from '~/content/templates';
import {Icon} from '~/components/Icons';
import {isSampleCatalog} from '~/lib/store-policies';
import {moneyLocale} from '~/lib/money';
import {SupportEmail} from '~/components/SupportEmail';
import type {Route} from './+types/checkout-preview';
export const meta = () => [{title: 'Checkout | Merrivy'}];

/**
 * The sample-catalog build's checkout. It looks like a real checkout but is
 * client-only: no action, no Shopify checkout, no card, no order. The one
 * honest line shoppers see sits here, where they try to pay.
 */
const NOT_TAKING_ORDERS =
  'We’re not taking orders yet. Nothing was charged and no order was placed.';
export async function loader({context}: Route.LoaderArgs) {
  if (!isSampleCatalog(context.env.PUBLIC_STORE_DOMAIN))
    throw new Response('Not found', {
      status: 404,
    });
  return {cart: await context.cart.get()};
}
export default function CheckoutPreview() {
  const {cart} = useLoaderData<typeof loader>();
  const [done, setDone] = useState(false);
  const copy = campaign.checkoutPreview;
  // The free bonus file is linked here, on the thank-you, never on the product page.
  const bonus = offerBonus(campaign);
  const subtotal = Number(cart?.cost.subtotalAmount.amount || 0);
  const shipping =
    subtotal >= demoService.freeShippingAt ? 0 : demoService.shippingFee;
  // One formatter for every amount on this page, so the subtotal, shipping
  // and total always show the same currency style.
  const currency = cart?.cost.subtotalAmount.currencyCode || 'USD';
  const money = (amount: number) =>
    new Intl.NumberFormat(moneyLocale(currency), {
      style: 'currency',
      currency,
    }).format(amount);
  return (
    <div className="checkout-preview">
      <span className="eyebrow">Checkout</span>
      <h1>One last look.</h1>
      {cart?.totalQuantity ? (
        <>
          <p>{copy.intro}</p>
          <ul>
            {cart.lines.nodes.map((line) => (
              <li className="cart-line" key={line.id}>
                <div className="cart-line-inner">
                  {line.merchandise.image && (
                    <img
                      src={line.merchandise.image.url}
                      alt={line.merchandise.product.title}
                    />
                  )}
                  <div>
                    <strong>{line.merchandise.product.title}</strong>
                    <p>
                      {line.merchandise.title} · Quantity {line.quantity}
                    </p>
                    {money(Number(line.cost.totalAmount.amount))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="demo-checkout-details">
            <section>
              <span className="eyebrow">01 · Delivery</span>
              <h2>Standard delivery</h2>
              <p>
                {demoService.processing} preparation
                <br />
                {demoService.transit} in transit · United States
              </p>

            </section>
            <section>
              <span className="eyebrow">02 · Payment</span>
              <h2>Payment</h2>
              <p>
                We’re not taking orders yet, so there’s no card to enter and
                nothing will be charged.
              </p>
            </section>
          </div>
          <dl className="cart-subtotal">
            <dt>Subtotal</dt>
            <dd>
              {money(subtotal)}
            </dd>
          </dl>
          <dl className="cart-subtotal">
            <dt>Shipping</dt>
            <dd>{shipping ? money(shipping) : 'Free'}</dd>
          </dl>
          <dl className="cart-subtotal demo-total">
            <dt>Total</dt>
            <dd>{money(subtotal + shipping)}</dd>
          </dl>
          {done ? (
            <div className="preview-success" role="status">
              <span className="eyebrow">Order not placed</span>
              <h2>{copy.confirmation}</h2>
              <p>{NOT_TAKING_ORDERS}</p>
              {bonus?.download?.href && bonus.download.label && (
                <p className="preview-bonus">
                  <Icon name="gift" size={16} />
                  <span>
                    <strong>{bonus.label}</strong>{' '}
                    <a
                      className="text-link"
                      href={bonus.download.href}
                      download
                    >
                      {bonus.download.label}
                    </a>
                  </span>
                </p>
              )}
              <p className="checkout-help">
                Questions? Email <SupportEmail />
              </p>
              <Link className="text-link" to="/">
                Back to Merrivy
              </Link>
            </div>
          ) : (
            <>
              <button className="button-primary" onClick={() => setDone(true)}>
                Place order
              </button>
              <p className="checkout-help">
                Questions about your order? Email <SupportEmail />
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <p>Your bag is waiting for something good.</p>
          <Link className="button-primary" to="/">
            {copy.emptyCta}
          </Link>
        </>
      )}
    </div>
  );
}
