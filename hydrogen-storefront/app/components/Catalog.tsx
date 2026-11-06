import {Link, NavLink, useNavigate, useSearchParams} from 'react-router';
import {Image, Pagination} from '@shopify/hydrogen';
import type {ComponentProps, ReactNode} from 'react';
import type {ProductCardFragment} from 'storefrontapi.generated';
import {campaign} from '~/content/templates';
import {
  SORT_OPTIONS,
  formatMoney,
  isFeaturedCampaign,
  type SortValue,
} from '~/lib/catalog';
import {isColorOption, swatchColor} from '~/lib/colors';
import {Icon} from './Icons';

type CardImage = {
  src: string;
  alt: string;
  data?: ProductCardFragment['featuredImage'];
};

/** Campaign products show their campaign photography; others use Shopify media. */
function cardImages(product: ProductCardFragment): CardImage[] {
  if (isFeaturedCampaign(product.handle)) {
    const [first, ...rest] = campaign.purchase.gallery;
    const lifestyle =
      rest.find((image) => image.src.endsWith('.webp')) ?? rest[0];
    return [first, lifestyle]
      .filter(Boolean)
      .map((image) => ({src: image.src, alt: image.alt}));
  }
  const nodes = product.images.nodes.length
    ? product.images.nodes
    : product.featuredImage
      ? [product.featuredImage]
      : [];
  return nodes.slice(0, 2).map((image) => ({
    src: image.url,
    alt: image.altText || product.title,
    data: image,
  }));
}

function CardPicture({
  image,
  className,
  loading,
}: {
  image: CardImage;
  className?: string;
  loading?: 'eager' | 'lazy';
}) {
  if (image.data)
    return (
      <Image
        className={className}
        data={image.data}
        alt={image.alt}
        aspectRatio="4/5"
        crop="center"
        loading={loading}
        sizes="(min-width: 1100px) 25vw, (min-width: 760px) 33vw, 50vw"
      />
    );
  return (
    <img
      className={className}
      src={image.src}
      alt={image.alt}
      loading={loading}
      decoding="async"
    />
  );
}

export function ProductCard({
  product,
  loading = 'lazy',
}: {
  product: ProductCardFragment;
  loading?: 'eager' | 'lazy';
}) {
  const featured = isFeaturedCampaign(product.handle);
  const [primary, secondary] = cardImages(product);
  const title = featured ? campaign.navLabel : product.title;
  const {minVariantPrice: min, maxVariantPrice: max} = product.priceRange;
  const compareAt = product.compareAtPriceRange?.minVariantPrice;
  const onSale = compareAt && Number(compareAt.amount) > Number(min.amount);
  const colors =
    product.options.find((option) => isColorOption(option.name))
      ?.optionValues ?? [];
  return (
    <Link
      className={`product-card ${featured ? 'is-featured' : ''}`}
      to={`/products/${product.handle}`}
      prefetch="intent"
    >
      <div
        className={`product-card-media ${featured ? 'is-cutout' : ''} ${secondary ? 'has-alt' : ''}`}
      >
        {primary ? (
          <CardPicture image={primary} loading={loading} />
        ) : (
          <span className="product-card-empty" aria-hidden="true">
            merrivy
          </span>
        )}
        {secondary && (
          <CardPicture
            image={secondary}
            className="product-card-alt"
            loading="lazy"
          />
        )}
        {featured && (
          <span className="product-card-stamp">
            Our <em>featured</em> pick
          </span>
        )}
        {!product.availableForSale && (
          <span className="product-card-flag">Sold out</span>
        )}
        {onSale && product.availableForSale && (
          <span className="product-card-flag is-sale">Sale</span>
        )}
      </div>
      <div className="product-card-body">
        <h3>{title}</h3>
        <p className="product-card-price">
          {min.amount !== max.amount && <small>From </small>}
          {formatMoney(min.amount, min.currencyCode)}
          {onSale && compareAt && (
            <s>{formatMoney(compareAt.amount, compareAt.currencyCode)}</s>
          )}
        </p>
        {colors.length > 1 && (
          <p className="product-card-colors">
            <span className="swatch-row" aria-hidden="true">
              {colors.slice(0, 5).map((value) => (
                <i
                  key={value.name}
                  style={{
                    backgroundColor: swatchColor(
                      value.name,
                      value.swatch?.color,
                    ),
                  }}
                />
              ))}
            </span>
            {colors.length} colors
          </p>
        )}
      </div>
    </Link>
  );
}

export function CatalogToolbar({
  sort,
  chips,
  note,
}: {
  sort: SortValue;
  chips?: {to: string; label: string}[];
  note?: ReactNode;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  function changeSort(value: string) {
    const next = new URLSearchParams(params);
    // A new order starts from the first page.
    ['cursor', 'direction'].forEach((key) => next.delete(key));
    if (value === 'featured') next.delete('sort');
    else next.set('sort', value);
    const query = next.toString();
    void navigate(query ? `?${query}` : '.', {
      preventScrollReset: true,
      replace: true,
    });
  }
  return (
    <div className="catalog-toolbar">
      {chips && chips.length > 0 ? (
        <nav className="catalog-chips" aria-label="Collections">
          {chips.map((chip) => (
            <NavLink key={chip.to} to={chip.to} end prefetch="intent">
              {chip.label}
            </NavLink>
          ))}
        </nav>
      ) : (
        <span />
      )}
      <div className="catalog-toolbar-end">
        {note && <span className="catalog-source">{note}</span>}
        <label className="catalog-sort">
          <span>Sort</span>
          <span className="select-wrap">
            <select
              value={sort}
              onChange={(event) => changeSort(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" size={14} />
          </span>
        </label>
      </div>
    </div>
  );
}

export function CatalogGrid({
  connection,
}: {
  connection: ComponentProps<
    typeof Pagination<ProductCardFragment>
  >['connection'];
}) {
  return (
    <Pagination connection={connection}>
      {({
        nodes,
        isLoading,
        PreviousLink,
        NextLink,
        hasPreviousPage,
        hasNextPage,
      }) => (
        <div className="catalog-results">
          {hasPreviousPage && (
            <div className="catalog-more is-top">
              <PreviousLink className="load-more">
                {isLoading ? 'Loading…' : 'Show earlier pieces'}
              </PreviousLink>
            </div>
          )}
          {nodes.length ? (
            <div className="catalog-grid">
              {nodes.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  loading={index < 4 ? 'eager' : 'lazy'}
                />
              ))}
            </div>
          ) : (
            <CatalogEmpty />
          )}
          {hasNextPage && (
            <div className="catalog-more">
              <NextLink className="load-more">
                {isLoading ? (
                  'Loading…'
                ) : (
                  <>
                    Show more <Icon name="arrow" size={16} />
                  </>
                )}
              </NextLink>
            </div>
          )}
        </div>
      )}
    </Pagination>
  );
}

export function CatalogEmpty() {
  return (
    <div className="catalog-empty">
      <span className="eyebrow">Nothing on this shelf yet</span>
      <h2>
        Good things
        <br />
        <em>are on the way.</em>
      </h2>
      <p>We add each piece only when it earns its place. Check back soon.</p>
      <Link className="text-link" to="/">
        Back to home <Icon name="arrow" size={16} />
      </Link>
    </div>
  );
}
