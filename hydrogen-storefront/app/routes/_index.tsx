import {redirect} from 'react-router';
import type {Route} from './+types/_index';
import {
  buildActiveProductCookie,
  resolveActiveProductPath,
} from '~/content/navigation';
import {campaign as packet} from '~/content/templates';

export const meta = () => [
  {title: packet.home.meta.title},
  {name: 'description', content: packet.home.meta.description},
];

/**
 * Multi-product storefront rule: bare `/` never renders a product directly.
 * It always redirects (302) to `/products/<active-product-handle>` (resolved
 * from `?product=`, `Referer`, or the `merrivy_active_product` cookie, falling
 * back to `/products/the-witching-hour-2027-weekly-planner`) while preserving
 * all ad tracking query parameters (`?fbclid=`, `?utm_...`).
 */
export async function loader({request}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const targetPath = resolveActiveProductPath(request);
  const params = new URLSearchParams(url.search);
  params.delete('product');
  const qs = params.toString();
  return redirect(`${targetPath}${qs ? `?${qs}` : ''}`, {
    status: 302,
    headers: {
      'Set-Cookie': buildActiveProductCookie(targetPath),
      'Cache-Control': 'private, no-store',
    },
  });
}

export default function Homepage() {
  return null;
}
