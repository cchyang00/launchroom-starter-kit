import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';
import {resolveStoreEnvironment} from '~/lib/demo-environment';
import {isSampleCatalog} from '~/lib/store-policies';

/**
 * Export a fetch handler in module format.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      const hasRealStore =
        Boolean(env.PUBLIC_STORE_DOMAIN) &&
        !isSampleCatalog(env.PUBLIC_STORE_DOMAIN) &&
        Boolean(env.PUBLIC_STOREFRONT_API_TOKEN);
      env = resolveStoreEnvironment(
        hasRealStore
          ? ({
              ...env,
              PUBLIC_CHECKOUT_DOMAIN:
                env.PUBLIC_CHECKOUT_DOMAIN || env.PUBLIC_STORE_DOMAIN,
              MERRIVY_LIVE:
                (env as unknown as Record<string, string | undefined>)
                  .MERRIVY_LIVE ?? 'true',
            } as Env)
          : env,
      );
      const demo = isSampleCatalog(env.PUBLIC_STORE_DOMAIN);
      const pathname = new URL(request.url).pathname;
      if (demo && pathname === '/robots.txt') {
        return new Response('User-agent: *\nDisallow: /\n', {
          headers: {
            'Content-Type': 'text/plain',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
      if (demo && /^\/account(?:[/.]|$)/.test(pathname)) {
        // Retired with the other template pages (app/lib/single-product.ts): 301.
        return new Response(null, {status: 301, headers: {Location: '/help'}});
      }
      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
      );

      /**
       * Create a Hydrogen request handler that internally
       * delegates to React Router for routing and rendering.
       */
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
      });

      const response = await handleRequest(request);
      if (demo) response.headers.set('X-Robots-Tag', 'noindex, nofollow');

      if (hydrogenContext.session.isPending) {
        response.headers.set(
          'Set-Cookie',
          await hydrogenContext.session.commit(),
        );
      }

      if (response.status === 404) {
        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `storefrontRedirect`
         * will pass through the 404 response.
         */
        return storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
      }

      return response;
    } catch (error) {
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};
