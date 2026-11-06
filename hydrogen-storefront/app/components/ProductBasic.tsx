import {Suspense, useEffect, useState} from 'react';
import {Await, Link} from 'react-router';
import {
  getAdjacentAndFirstAvailableVariants,
  getProductOptions,
  useOptimisticVariant,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import type {
  ProductCardFragment,
  ProductFragment,
} from 'storefrontapi.generated';
import {ProductForm} from './ProductForm';
import {ImageInspection} from './ProductInspection';
import {ProductCard} from './Catalog';
import {ServiceLinks} from './SupportShell';
import {Icon} from './Icons';
import {demoService} from '~/content/demo-service';
import {campaign} from '~/content/templates';
import {formatMoney} from '~/lib/catalog';

/**
 * General catalog page for a product without a campaign packet. It only shows
 * what Shopify provides (media, description, options and price) so no
 * campaign claims attach to unrelated merchandise.
 */
export function ProductBasic({
  product,
  recommended,
  isSample,
}: {
  product: ProductFragment;
  recommended: Promise<ProductCardFragment[]>;
  isSample: boolean;
}) {
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);
  const options = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const variantImage = selectedVariant.image;
  const images = [
    ...(variantImage ? [variantImage] : []),
    ...product.images.nodes.filter((image) => image.url !== variantImage?.url),
  ];
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [selectedVariant.id]);
  const current = images[active] ?? images[0];
  const variantLabel = selectedVariant.selectedOptions
    .filter(({value}) => value !== 'Default Title')
    .map(({value}) => value)
    .join(' / ');
  const compareAt = selectedVariant.compareAtPrice;
  const onSale =
    compareAt &&
    Number(compareAt.amount) > Number(selectedVariant.price.amount);

  return (
    <div className="product-experience product-basic">
      <div className="breadcrumbs">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>{product.title}</span>
      </div>
      <section className="product-stage">
        <div className="product-gallery">
          <div className="gallery-main basic-gallery-main">
            {current ? (
              <>
                <img
                  src={`${current.url}${current.url.includes('?') ? '&' : '?'}width=1200`}
                  alt={current.altText || product.title}
                />
                {variantLabel && (
                  <span className="gallery-caption">{variantLabel}</span>
                )}
                {images.length > 1 && (
                  <div className="gallery-counter">
                    {active + 1} / {images.length}
                  </div>
                )}
                <ImageInspection
                  src={current.url}
                  alt={current.altText || product.title}
                  caption={variantLabel || product.title}
                />
              </>
            ) : (
              <span className="product-card-empty" aria-hidden="true">
                merrivy
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs" aria-label="Product images">
              {images.slice(0, 8).map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  className={index === active ? 'active' : ''}
                  aria-pressed={index === active}
                  aria-label={`Show image ${index + 1}`}
                  onClick={() => setActive(index)}
                >
                  <img
                    src={`${image.url}${image.url.includes('?') ? '&' : '?'}width=200`}
                    alt=""
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="purchase-panel">
          <span className="eyebrow">
            {product.productType || 'The Merrivy shop'}
          </span>
          <h1 className="basic-title">{product.title}</h1>
          <div className="product-name-line basic-price">
            <span>
              {formatMoney(
                selectedVariant.price.amount,
                selectedVariant.price.currencyCode,
              )}{' '}
              <small>{selectedVariant.price.currencyCode}</small>
            </span>
            {onSale && compareAt && (
              <s className="basic-compare">
                {formatMoney(compareAt.amount, compareAt.currencyCode)}
              </s>
            )}
          </div>
          {product.descriptionHtml && (
            <div
              className="basic-description"
              dangerouslySetInnerHTML={{__html: product.descriptionHtml}}
            />
          )}
          <ProductForm
            productOptions={options}
            selectedVariant={selectedVariant}
            quantityMode="stepper"
          />
          <div className="basic-service">
            <details>
              <summary>
                Delivery <Icon name="plus" size={16} />
              </summary>
              {isSample ? (
                <p>
                  {formatMoney(demoService.shippingFee, 'CAD')}{' '}
                  delivery, free over{' '}
                  {formatMoney(demoService.freeShippingAt, 'CAD')}. Ships in{' '}
                  {demoService.processing}, then {demoService.transit} in
                  transit. <Link to="/delivery">Delivery details</Link>
                </p>
              ) : (
                <p>
                  Rates and timing are shown at checkout.{' '}
                  <Link to="/delivery">Delivery details</Link>
                </p>
              )}
            </details>
            <details>
              <summary>
                Returns <Icon name="plus" size={16} />
              </summary>
              {isSample ? (
                <p>
                  {demoService.returnDays}-day returns on unworn
                  items. <Link to="/returns">Returns & exchanges</Link>
                </p>
              ) : (
                <p>
                  Changed your mind?{' '}
                  <Link to="/returns">Returns & exchanges</Link> explains how it
                  works.
                </p>
              )}
            </details>
            <details>
              <summary>
                A question? <Icon name="plus" size={16} />
              </summary>
              <p>
                <a href="mailto:support@merrivy.com">support@merrivy.com</a>, or
                browse <Link to="/help">quick answers</Link>.
              </p>
            </details>
          </div>
        </div>
      </section>
      <Suspense fallback={null}>
        <Await resolve={recommended} errorElement={null}>
          {(products) =>
            products.length > 0 ? (
              <section
                className="recommended"
                aria-labelledby="recommended-heading"
              >
                <div className="recommended-heading">
                  <div>
                    <span className="eyebrow">Keep exploring</span>
                    <h2 id="recommended-heading">
                      You might <em>also like.</em>
                    </h2>
                  </div>
                  <Link className="text-link" to="/">
                    {campaign.navLabel} <Icon name="arrow" size={16} />
                  </Link>
                </div>
                <div className="catalog-grid">
                  {products.slice(0, 4).map((item) => (
                    <ProductCard key={item.id} product={item} />
                  ))}
                </div>
              </section>
            ) : null
          }
        </Await>
      </Suspense>
      <ServiceLinks />
    </div>
  );
}
