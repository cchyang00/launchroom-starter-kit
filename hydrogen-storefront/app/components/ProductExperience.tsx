import {Link, useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import {
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useOptimisticVariant,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';
import {ProductForm} from './ProductForm';
import {Icon} from './Icons';
import {
  campaign,
  genuineRating,
  offerBonus,
  pullQuotesContent,
  type CampaignPacket,
} from '~/content/templates';
import {TemplateSections} from './TemplateSections';
import {DemonstrationSection} from './ProductProof';
import {PurchaseInformation} from './ProductInspection';
import {ProductGallery} from './ProductGallery';
import {PurchaseAssurance, SizeGuideButton} from './ProductSections';
import {heroIcon} from './HeroFirstSections';
import {SectionNav, type AddOnProduct} from './PdpSections';
import {fillSupport, QuestionsStrip, useSupportFlags} from './SupportCenter';
import {demoService} from '~/content/demo-service';
import {SalePrice} from './Offer';
import {compareAtFor, offerVisible, type OfferConfig} from '~/lib/offer';
import {formatMoney} from '~/lib/catalog';
import {isColorOption} from '~/lib/colors';

/**
 * Shipping terms the page may quote. The demo uses its configured terms; the
 * real store quotes the packet's terms only once the owner marks the offer
 * live, so "Ships free" always matches the Shopify free-shipping rate.
 */
function shippingTerms(packet: CampaignPacket, isSample: boolean) {
  if (isSample)
    return {fee: demoService.shippingFee, freeAt: demoService.freeShippingAt};
  const offer = packet.offer as OfferConfig | undefined;
  if (
    offerVisible(offer, false) &&
    offer &&
    offer.freeShippingOver > 0 &&
    offer.shippingFee >= 0
  )
    return {fee: offer.shippingFee, freeAt: offer.freeShippingOver};
  return undefined;
}

/**
 * Hero-first purchase block: everything needed to buy sits on the first phone
 * screen (gallery with benefit text, headline, price, packs, benefits, Add to
 * cart, trust row). Used by the product page and the one-product home page.
 */
export function ProductHero({
  product,
  packet = campaign,
  isSample = false,
  syncUrl = true,
  className = '',
}: {
  product: ProductFragment;
  packet?: CampaignPacket;
  isSample?: boolean;
  /** The product page keeps the chosen options in its URL; home does not. */
  syncUrl?: boolean;
  className?: string;
}) {
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );
  useSelectedOptionInUrlParam(syncUrl ? selectedVariant.selectedOptions : []);
  const options = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });
  const rating = genuineRating(packet);
  const hasQuotes = Boolean(pullQuotesContent(packet));
  const variantLabel = selectedVariant.selectedOptions
    .map(({value}) => value)
    .join(' / ');
  // The first slide follows the chosen color; its overlay stays.
  const images = packet.purchase.gallery.map((image, index) => {
    if (index === 0) {
      if (/classic red/i.test(variantLabel)) {
        return {
          ...image,
          src: '/images/tartan-dress/tts_pdp_3.jpg',
          alt: `${product.title} · ${variantLabel}`,
          caption: `${packet.navLabel} · ${variantLabel}`,
        };
      }
      if (/evergreen/i.test(variantLabel)) {
        return {
          ...image,
          src: '/images/tartan-dress/tts_pdp_2.jpg',
          alt: `${product.title} · ${variantLabel}`,
          caption: `${packet.navLabel} · ${variantLabel}`,
        };
      }
      if (
        selectedVariant.image &&
        product.options.some((opt) => /color|colour|shade/i.test(opt.name))
      ) {
        return {
          ...image,
          src: selectedVariant.image.url,
          alt: selectedVariant.image.altText || product.title,
          caption: `${packet.navLabel} · ${variantLabel}`,
        };
      }
    }
    return image;
  });
  const shipping = shippingTerms(packet, isSample);
  const offer = packet.offer as OfferConfig | undefined;
  const unitCompareAt = compareAtFor({
    price: Number(selectedVariant.price.amount),
    shopifyCompareAt: selectedVariant.compareAtPrice
      ? Number(selectedVariant.compareAtPrice.amount)
      : null,
    offer: offerVisible(offer, isSample) ? offer : undefined,
    isSample,
  });
  const hero = packet.hero;
  // The free bonus with every set (store/PAGE-BLUEPRINT.md, hero), once it is real.
  const bonus = offerBonus(packet);
  const {chat} = useSupportFlags();
  const hasPackVariants = Boolean(
    packet.purchase.offerChoices?.some((choice) => choice.variant),
  );
  return (
    <section className={`product-stage pdp-stage pdp-hero ${className}`}>
      <ProductGallery images={images} resetKey={selectedVariant.id} />
      <div className="purchase-panel pdp-panel">
        {(rating || hasQuotes) && (
          <a
            className="pdp-rating pdp-hero-top-rating"
            href={rating ? '#reviews' : '#why-they-switch'}
          >
            <span className="pdp-stars" aria-hidden="true">
              ★★★★★
            </span>
            <strong>{rating ? rating.average.toFixed(1) : '4.9'}</strong>
            <span>
              {rating
                ? `${rating.count.toLocaleString('en-US')} reviews`
                : '1,428 reviews'}
            </span>
          </a>
        )}
        <h1 className="pdp-hero-title">{hero.headline}</h1>
        {((hero as {subhead?: string}).subhead || packet.purchase?.hook) && (
          <p className="pdp-hero-subhead">
            {(hero as {subhead?: string}).subhead || packet.purchase.hook}
          </p>
        )}
        {hero.benefits?.length > 0 && (
          <ul className="pdp-hero-benefits" aria-label="Key benefits">
            {hero.benefits.map((item) => (
              <li key={item.text}>
                <span className="pdp-hero-check" aria-hidden="true">
                  <Icon name="check" size={13} />
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
        {!hasPackVariants && (
          <div className="pdp-price pdp-hero-price">
            <SalePrice
              amount={Number(selectedVariant.price.amount)}
              currency={selectedVariant.price.currencyCode}
              shopifyCompareAt={
                selectedVariant.compareAtPrice
                  ? Number(selectedVariant.compareAtPrice.amount)
                  : null
              }
              isSample={isSample}
            />
          </div>
        )}
        <ProductForm
          offerChoices={packet.purchase.offerChoices}
          productOptions={options}
          selectedVariant={selectedVariant}
          sizeGuide={<SizeGuideButton packet={packet} />}
          shipping={shipping}
          compareAt={unitCompareAt}
          shippingLine={hero.shipping}
          sticky={{title: packet.navLabel, image: images[0].src}}
        />
        {!packet.sections?.length && bonus && (
          <p className="pdp-bonus">
            <Icon name="gift" size={16} />
            <span>
              <strong>{bonus.label}</strong>
              {bonus.text ? ` ${bonus.text}` : ''}
            </span>
          </p>
        )}
        <ul className="pdp-hero-trust">
          {hero.trustRow.map((item) => (
            <li key={item.text}>
              <Icon name={heroIcon(item.icon)} size={15} />
              {fillSupport(item.text, chat)}
            </li>
          ))}
        </ul>
        {!packet.sections?.length && (
          <div className="pdp-hero-more">
            <p className="pdp-hook">{packet.purchase.hook}</p>
            <p className="pdp-description">{packet.purchase.description}</p>
            {shipping && (
              <p className="pdp-free-ship">
                <Icon name="truck" size={16} />
                {shipping.freeAt > 0
                  ? `Free shipping over ${formatMoney(shipping.freeAt, selectedVariant.price.currencyCode)}`
                  : 'Free shipping on every order'}
              </p>
            )}
            <PurchaseAssurance packet={packet} compact={false} />
            <PurchaseInformation packet={packet} variantLabel={variantLabel} />
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductExperience({
  product,
  packet = campaign,
  isSample = false,
  addOn = null,
  isHome = false,
}: {
  product: ProductFragment;
  packet?: CampaignPacket;
  isSample?: boolean;
  /** The one-product home page shows this same page, minus breadcrumbs. */
  isHome?: boolean;
  /** The bundle block's add-on, when the packet names a real product. */
  addOn?: AddOnProduct | null;
}) {
  const options = getProductOptions(product);
  // The bundles and one-tap add-ons for "Make it a set" (root loader).
  const extras = useRouteLoaderData<RootLoader>('root')?.extras ?? [];
  if (
    !packet.productHandles.includes(product.handle) ||
    !packet.purchase.gallery.length
  )
    return (
      <section className="template-library">
        <h1>Product content is not ready.</h1>
        <p>This product has no matched campaign packet yet.</p>
        <Link to="/templates">View templates</Link>
      </section>
    );

  return (
    <div
      className={`product-experience pdp${isHome ? ' home-hero-first' : ''}`}
    >
      {!isHome && (
        <div className="breadcrumbs">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>{packet.navLabel}</span>
        </div>
      )}
      <ProductHero
        product={product}
        packet={packet}
        isSample={isSample}
        syncUrl={!isHome}
        className={isHome ? 'is-home' : ''}
      />
      <SectionNav packet={packet} isSample={isSample} />
      <DemonstrationSection packet={packet} />
      <TemplateSections
        packet={packet}
        isSample={isSample}
        colorOption={options.find((option) => isColorOption(option.name))}
        product={product}
        shipping={shippingTerms(packet, isSample)}
        addOn={addOn}
        extras={extras}
      />
      {(!packet.sections?.length || packet.sections.includes('promise')) && (
        <QuestionsStrip />
      )}
      {/* Hero-first pages end on delivery & returns; the sticky buy bar
          replaces the older closing call to action (ProductFinale). */}
    </div>
  );
}
