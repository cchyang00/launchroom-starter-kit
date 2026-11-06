import {retire} from '~/lib/single-product';

/**
 * A page the Hydrogen template shipped with. Merrivy sells one product, so it
 * moves permanently (301) to the live page that answers the same question
 * (see app/lib/single-product.ts).
 */
export function loader({request}: {request: Request}) {
  return retire(request);
}

export function action({request}: {request: Request}) {
  return retire(request);
}
