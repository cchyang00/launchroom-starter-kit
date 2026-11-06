import {redirect} from 'react-router';
import type {Route} from './+types/checkout';
import {checkoutDestination} from '~/lib/checkout-destination';

export async function loader({context}: Route.LoaderArgs) {
  const cart = await context.cart.get();
  if (!cart?.totalQuantity) return redirect('/cart');
  const destination = checkoutDestination(
    context.env.PUBLIC_STORE_DOMAIN,
    context.env.PUBLIC_CHECKOUT_DOMAIN,
    cart.checkoutUrl,
  );
  if (!destination) {
    throw new Response(
      'Checkout connection needs verification. Your bag is saved.',
      {status: 503},
    );
  }
  if (destination.startsWith('https://')) {
    const url = new URL(destination);
    const storeDomain = context.env.PUBLIC_STORE_DOMAIN?.trim().toLowerCase();
    if (
      (url.hostname === 'merrivy.com' || url.hostname === 'www.merrivy.com') &&
      storeDomain &&
      storeDomain.endsWith('.myshopify.com')
    ) {
      url.hostname = storeDomain;
      return redirect(url.href);
    }
  }
  return redirect(destination);
}
