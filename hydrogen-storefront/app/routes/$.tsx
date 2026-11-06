import type {Route} from './+types/$';
import {retire, retiredTarget} from '~/lib/single-product';

/**
 * Any other path. Old template paths without a route of their own (/products,
 * /pages, /contact) move to their live page; a path we never had gets the
 * designed not-found page (root ErrorBoundary), never a bare 404.
 */
export async function loader({request}: Route.LoaderArgs) {
  const {pathname} = new URL(request.url);
  if (retiredTarget(pathname)) throw retire(request);
  throw new Response(`${pathname} not found`, {
    status: 404,
  });
}

export default function CatchAllPage() {
  return null;
}
