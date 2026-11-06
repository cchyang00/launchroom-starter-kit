import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import type {CartLayout, LineItemChildrenMap} from '~/components/CartMain';
import {CartForm, Image, type OptimisticCartLine} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {Link} from 'react-router';
import {ProductPrice} from './ProductPrice';
import {useAside} from './Aside';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

export type CartLine = OptimisticCartLine<CartApiQueryFragment>;

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 * If the line is a parent line that has child components (like warranties or gift wrapping), they are
 * rendered nested below the parent line.
 */
export function CartLineItem({
  layout,
  line,
  childrenMap,
  isBundleComponent = false,
}: {
  layout: CartLayout;
  line: CartLine;
  childrenMap: LineItemChildrenMap;
  isBundleComponent?: boolean;
}) {
  const {id, merchandise} = line;
  const {product, title, image, selectedOptions} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const {close} = useAside();
  const childrenLabelId = `cart-line-children-${id}`;
  const bundleComponents = 'lineComponents' in line ? line.lineComponents : [];
  const componentIds = new Set(
    bundleComponents.map((component) => component.id),
  );
  const lineItemChildren = childrenMap[id]?.filter(
    (child) => !componentIds.has(child.id),
  );
  const sellingPlan =
    'sellingPlanAllocation' in line
      ? line.sellingPlanAllocation?.sellingPlan
      : undefined;

  return (
    <li key={id} className="cart-line">
      <div className="cart-line-inner">
        {image && (
          <Image
            alt={title}
            aspectRatio="1/1"
            data={image}
            height={100}
            loading="lazy"
            width={100}
          />
        )}

        <div>
          <Link
            prefetch="intent"
            to={lineItemUrl}
            onClick={() => {
              if (layout === 'aside') {
                close();
              }
            }}
          >
            <p>
              <strong>{product.title}</strong>
            </p>
          </Link>
          <ProductPrice
            price={line?.cost?.totalAmount}
            compareAtPrice={
              line?.cost?.compareAtAmountPerQuantity &&
              Number(line.cost.compareAtAmountPerQuantity.amount) *
                line.quantity >
                Number(line?.cost?.totalAmount?.amount ?? 0)
                ? {
                    amount: (
                      Number(line.cost.compareAtAmountPerQuantity.amount) *
                      line.quantity
                    ).toFixed(2),
                    currencyCode:
                      line.cost.compareAtAmountPerQuantity.currencyCode,
                  }
                : null
            }
          />
          <ul>
            {sellingPlan && (
              <li>
                <small>
                  {sellingPlan.name}
                  {sellingPlan.recurringDeliveries
                    ? ' · Recurring delivery'
                    : ''}
                </small>
                {sellingPlan.options.map((option) => (
                  <small key={`${option.name}-${option.value}`}>
                    {' '}
                    {option.name}: {option.value}
                  </small>
                ))}
              </li>
            )}
            {/* A one-variant product (a set or an add-on) reports "Title: Default Title". */}
            {selectedOptions
              .filter((option) => option.value !== 'Default Title')
              .map((option) => (
                <li key={option.name}>
                  <small>
                    {option.name}: {option.value}
                  </small>
                </li>
              ))}
          </ul>
          {isBundleComponent ? (
            <small>Included quantity: {line.quantity}</small>
          ) : (
            <CartLineQuantity line={line} />
          )}
        </div>
      </div>

      {bundleComponents.length > 0 && (
        <div>
          <p>Included in this bundle</p>
          <ul
            className="cart-line-children"
            aria-label={`Contents of ${product.title}`}
          >
            {bundleComponents.map((component) => (
              <CartLineItem
                key={component.id}
                line={component}
                layout={layout}
                childrenMap={childrenMap}
                isBundleComponent
              />
            ))}
          </ul>
        </div>
      )}

      {lineItemChildren?.length ? (
        <div>
          <p id={childrenLabelId} className="sr-only">
            Line items with {product.title}
          </p>
          <ul aria-labelledby={childrenLabelId} className="cart-line-children">
            {lineItemChildren.map((childLine) => (
              <CartLineItem
                childrenMap={childrenMap}
                key={childLine.id}
                line={childLine}
                layout={layout}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Pack variant triples [1-pack, 2-pack, 3-pack] so the cart drawer's `+` / `-`
 * stepper switches cleanly between 1-Pack, 2-Pack, and 3-Pack variants for both
 * the Witching Hour 2027 Planner and all 8 Color×Size combinations of the
 * Holiday Tartan Bow Dress.
 */
const PACK_VARIANT_GROUPS: Array<[string, string, string]> = [
  // P004: Witching Hour 2027 Planner (1 / 2 / 3 planners)
  [
    'gid://shopify/ProductVariant/51050399957049',
    'gid://shopify/ProductVariant/51050399989817',
    'gid://shopify/ProductVariant/51050400022585',
  ],
  // P005: Holiday Tartan Bow Dress — Evergreen Tartan (S, M, L, XL)
  [
    'gid://shopify/ProductVariant/51055526641721',
    'gid://shopify/ProductVariant/51055526674489',
    'gid://shopify/ProductVariant/51055526707257',
  ],
  [
    'gid://shopify/ProductVariant/51055526740025',
    'gid://shopify/ProductVariant/51055526772793',
    'gid://shopify/ProductVariant/51055526805561',
  ],
  [
    'gid://shopify/ProductVariant/51055526838329',
    'gid://shopify/ProductVariant/51055526871097',
    'gid://shopify/ProductVariant/51055526903865',
  ],
  [
    'gid://shopify/ProductVariant/51055526936633',
    'gid://shopify/ProductVariant/51055526969401',
    'gid://shopify/ProductVariant/51055527002169',
  ],
  // P005: Holiday Tartan Bow Dress — Classic Red Tartan (S, M, L, XL)
  [
    'gid://shopify/ProductVariant/51055527034937',
    'gid://shopify/ProductVariant/51055527067705',
    'gid://shopify/ProductVariant/51055527100473',
  ],
  [
    'gid://shopify/ProductVariant/51055527133241',
    'gid://shopify/ProductVariant/51055527166009',
    'gid://shopify/ProductVariant/51055527198777',
  ],
  [
    'gid://shopify/ProductVariant/51055527231545',
    'gid://shopify/ProductVariant/51055527264313',
    'gid://shopify/ProductVariant/51055527297081',
  ],
  [
    'gid://shopify/ProductVariant/51055527329849',
    'gid://shopify/ProductVariant/51055527362617',
    'gid://shopify/ProductVariant/51055527395385',
  ],
];

const LIVE_PACK_UNITS_BY_ID: Record<string, number> = {};
const LIVE_PACK_GROUP_BY_ID: Record<string, [string, string, string]> = {};
for (const group of PACK_VARIANT_GROUPS) {
  group.forEach((vid, idx) => {
    LIVE_PACK_UNITS_BY_ID[vid] = idx + 1;
    LIVE_PACK_GROUP_BY_ID[vid] = group;
  });
}

function buildPackLineUpdate(
  lineId: string,
  merchandiseId: string,
  targetUnits: number,
): CartLineUpdateInput {
  const group = LIVE_PACK_GROUP_BY_ID[merchandiseId];
  if (!group) {
    return {id: lineId, quantity: targetUnits};
  }
  if (targetUnits >= 1 && targetUnits <= 3) {
    return {
      id: lineId,
      merchandiseId: group[targetUnits - 1],
      quantity: 1,
    };
  }
  return {
    id: lineId,
    merchandiseId: group[0],
    quantity: targetUnits,
  };
}

/**
 * Provides the controls to update the quantity of a line item in the cart.
 * These controls are disabled when the line item is new, and the server
 * hasn't yet responded that it was successfully added to the cart.
 */
function CartLineQuantity({line}: {line: CartLine}) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic, merchandise} = line;
  const packUnits = LIVE_PACK_UNITS_BY_ID[merchandise?.id ?? ''];
  const effectiveQuantity = packUnits ? packUnits * quantity : quantity;
  const prevQuantity = Number(Math.max(0, effectiveQuantity - 1).toFixed(0));
  const nextQuantity = Number((effectiveQuantity + 1).toFixed(0));
  const prevUpdate = buildPackLineUpdate(
    lineId,
    merchandise?.id ?? '',
    prevQuantity,
  );
  const nextUpdate = buildPackLineUpdate(
    lineId,
    merchandise?.id ?? '',
    nextQuantity,
  );

  return (
    <div className="cart-line-quantity">
      <small>Quantity: {effectiveQuantity} &nbsp;&nbsp;</small>
      <CartLineUpdateButton lines={[prevUpdate]}>
        <button
          aria-label="Decrease quantity"
          disabled={effectiveQuantity <= 1 || !!isOptimistic}
          name="decrease-quantity"
          value={prevQuantity}
        >
          <span>&#8722; </span>
        </button>
      </CartLineUpdateButton>
      &nbsp;
      <CartLineUpdateButton lines={[nextUpdate]}>
        <button
          aria-label="Increase quantity"
          name="increase-quantity"
          value={nextQuantity}
          disabled={!!isOptimistic}
        >
          <span>&#43;</span>
        </button>
      </CartLineUpdateButton>
      &nbsp;
      <CartLineRemoveButton lineIds={[lineId]} disabled={!!isOptimistic} />
    </div>
  );
}

/**
 * A button that removes a line item from the cart. It is disabled
 * when the line item is new, and the server hasn't yet responded
 * that it was successfully added to the cart.
 */
function CartLineRemoveButton({
  lineIds,
  disabled,
}: {
  lineIds: string[];
  disabled: boolean;
}) {
  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      <button disabled={disabled} type="submit">
        Remove
      </button>
    </CartForm>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: CartLineUpdateInput[];
}) {
  const lineIds = lines.map((line) => line.id);

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines}}
    >
      {children}
    </CartForm>
  );
}

/**
 * Returns a unique key for the update action. This is used to make sure actions modifying the same line
 * items are not run concurrently, but cancel each other. For example, if the user clicks "Increase quantity"
 * and "Decrease quantity" in rapid succession, the actions will cancel each other and only the last one will run.
 * @param lineIds - line ids affected by the update
 * @returns
 */
function getUpdateKey(lineIds: string[]) {
  return [CartForm.ACTIONS.LinesUpdate, ...lineIds].join('-');
}
