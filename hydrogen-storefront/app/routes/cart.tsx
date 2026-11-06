import {useLoaderData, data, Link, type HeadersFunction} from 'react-router';
import type {Route} from './+types/cart';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {useActiveProduct, withProductParam} from '~/content/navigation';

export const meta: Route.MetaFunction = () => {
  return [{title: `Your bag | Merrivy`}];
};

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result: CartQueryDataReturn;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      if ((inputs as any).discountCode) {
        result = await cart.updateDiscountCodes([
          String((inputs as any).discountCode),
        ]);
      }
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove: {
      result = await cart.removeLines(inputs.lineIds);
      const remainingLines = result?.cart?.lines?.nodes ?? [];
      const physicalRemaining = remainingLines.filter(
        (line: any) =>
          line?.merchandise?.id !==
            'gid://shopify/ProductVariant/51054093893689' &&
          line?.merchandise?.product?.handle !== 'shipping-protection',
      );
      if (physicalRemaining.length === 0) {
        const leftoverProtectionIds = remainingLines
          .map((line: any) => line?.id)
          .filter(Boolean);
        if (leftoverProtectionIds.length > 0) {
          result = await cart.removeLines(leftoverProtectionIds);
        }
        result = await cart.updateDiscountCodes([]);
      } else if ((inputs as any).clearDiscounts) {
        result = await cart.updateDiscountCodes([]);
      }
      break;
    }
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = (
        formDiscountCode ? [formDiscountCode] : []
      ) as string[];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesAdd: {
      const formGiftCardCode = inputs.giftCardCode;

      const giftCardCodes = (
        formGiftCardCode ? [formGiftCardCode] : []
      ) as string[];

      result = await cart.addGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesRemove: {
      const appliedGiftCardIds = inputs.giftCardCodes as string[];
      result = await cart.removeGiftCardCodes(appliedGiftCardIds);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    status = 303;
    headers.set('Location', redirectTo);
  }

  return data(
    {
      cart: cartResult,
      errors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

export async function loader({context}: Route.LoaderArgs) {
  const {cart} = context;
  return await cart.get();
}

export default function Cart() {
  const cart = useLoaderData<typeof loader>();
  const {productPath} = useActiveProduct();

  return (
    <div className="cart">
      <div className="page-trail">
        <Link to={productPath}>Home</Link>
        <span>/</span>
        <span>Your bag</span>
      </div>
      <header className="shopping-hero">
        <span className="eyebrow">A few good things</span>
        <h1>
          Your bag.
          <br />
          <em>Your everyday.</em>
        </h1>
        <p>One last look before checkout. Make a little room for comfort.</p>
      </header>
      <CartMain layout="page" cart={cart} />
      <div className="bag-help">
        <span>A question before you go?</span>
        <Link to={withProductParam('/delivery', productPath)}>Delivery ↗</Link>
        <Link to={withProductParam('/returns', productPath)}>Returns ↗</Link>
        <Link to={withProductParam('/help', productPath)}>Here to help ↗</Link>
      </div>
    </div>
  );
}
