import {type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
}) {
  return (
    <CartForm
      fetcherKey="product-add"
      route="/cart"
      inputs={{lines}}
      action={CartForm.ACTIONS.LinesAdd}
    >
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <button
            type="submit"
            onClick={() => {
              if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
                const primaryLine = lines?.[0] as any;
                const sv = primaryLine?.selectedVariant;
                const rawProdId = String(sv?.product?.id || '');
                const numProdId = rawProdId.includes('/') ? rawProdId.split('/').pop() : '';
                const pPath = window.location.pathname.toLowerCase();
                const handleStr = String(sv?.product?.handle || '').toLowerCase();
                const isSolar =
                  pPath.includes('solar') ||
                  handleStr.includes('solar') ||
                  numProdId === '10418906497081' ||
                  sessionStorage.getItem('merrivy_active_pixel') === '1656598869345569';
                const isDress =
                  !isSolar &&
                  (pPath.includes('tartan') ||
                    pPath.includes('plaid-bow') ||
                    handleStr.includes('tartan'));
                const targetPixelId = isSolar
                  ? '1656598869345569'
                  : '1003355539496617';
                const contentId =
                  numProdId && !numProdId.startsWith('preview-')
                    ? numProdId
                    : isSolar
                      ? '10418906497081'
                      : isDress
                        ? '10418259001593'
                        : '10416592814137';
                const contentName =
                  sv?.product?.title ||
                  (isSolar
                    ? 'The Split-Panel Solar Indoor & Outdoor Ceiling Light Kit (2-Pack)'
                    : isDress
                      ? 'Holiday Tartan Plaid Satin-Bow Puff-Sleeve Babydoll Mini Dress'
                      : 'Waiting for the Night: The Witching Hour 2027 Dated Weekly Planner');
                const unitPrice = Number(
                  sv?.price?.amount || (isSolar ? 39.99 : isDress ? 44.99 : 34.99),
                );
                const qty = Number(primaryLine?.quantity || 1);
                (window as any).fbq('trackSingle', targetPixelId, 'AddToCart', {
                  content_name: contentName,
                  content_ids: [contentId],
                  content_type: 'product_group',
                  value: Number((unitPrice * qty).toFixed(2)),
                  currency: sv?.price?.currencyCode || 'USD',
                });
              }
              onClick?.();
            }}
            className="button-primary add-to-bag"
            disabled={Boolean(disabled) || fetcher.state !== 'idle'}
          >
            {fetcher.state !== 'idle' ? 'Adding to your bag…' : children}
          </button>
          {fetcher.data?.errors?.length > 0 && (
            <p className="form-error" role="alert">
              We couldn’t update your bag. Please try again.
            </p>
          )}
        </>
      )}
    </CartForm>
  );
}
