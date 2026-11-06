import {useSearchParams} from 'react-router';
import type {MappedProductOptions} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';
import {
  campaign,
  resolveTemplate,
  type CampaignPacket,
  type SectionId,
} from '~/content/templates';
import {StorySection, FaqSection} from './CampaignSections';
import {WaysToWear} from './ProductDepth';
import {ProductSpotlight} from './ProductProof';
import {
  ComparisonSection,
  HowItWorksSection,
  InTheBoxSection,
  ReviewsSlider,
} from './HeroFirstSections';
import {
  BundleSection,
  DidYouKnowSection,
  FeaturesSection,
  FitCheckSection,
  GuaranteeSection,
  HowToUseSection,
  ProblemSection,
  PullQuotesSection,
  SpecsSection,
  WhoForSection,
  type AddOnProduct,
} from './PdpSections';
import {
  BenefitsSection,
  ColorStory,
  FitSection,
  PromiseSection,
} from './ProductSections';

/** Renders the page sections below the purchase area in the chosen order. */
export function TemplateSections({
  packet = campaign,
  colorOption,
  isSample = false,
  product,
  shipping,
  addOn,
  extras = [],
}: {
  packet?: CampaignPacket;
  /** The product on this page; the bundle block adds its chosen variant. */
  product?: ProductFragment;
  /** Shipping terms the page may quote (same as the hero). */
  shipping?: {fee: number; freeAt: number};
  /** The bundle block's add-on product, when the packet names a real one. */
  addOn?: AddOnProduct | null;
  /** The bundles and one-tap add-ons the store sells (root loader). */
  extras?: AddOnProduct[];
  /** Demo catalog: labelled sample reviews may show. */
  isSample?: boolean;
  /** The product's color option from Shopify, if it has one. */
  colorOption?: MappedProductOptions;
}) {
  const [params] = useSearchParams();
  const template = resolveTemplate(params.get('template') || packet.templateId);
  const activeSections =
    !params.get('template') && packet.sections?.length
      ? packet.sections
      : template.sections;
  const renderers: Record<SectionId, JSX.Element | null> = {
    problem: <ProblemSection packet={packet} />,
    features: <FeaturesSection packet={packet} />,
    howToUse: <HowToUseSection packet={packet} />,
    fitCheck: <FitCheckSection packet={packet} />,
    whoFor: <WhoForSection packet={packet} />,
    didYouKnow: <DidYouKnowSection packet={packet} />,
    quotes: <PullQuotesSection packet={packet} />,
    guarantee: <GuaranteeSection packet={packet} />,
    specs: <SpecsSection packet={packet} />,
    bundle: product ? (
      <BundleSection
        packet={packet}
        product={product}
        isSample={isSample}
        shipping={shipping}
        addOn={addOn}
        extras={extras}
      />
    ) : null,
    comparison: <ComparisonSection packet={packet} />,
    howItWorks: <HowItWorksSection packet={packet} />,
    inTheBox: <InTheBoxSection packet={packet} />,
    story: <StorySection packet={packet} ctaHref="#choose" />,
    benefits: <BenefitsSection packet={packet} />,
    details: <ProductSpotlight packet={packet} />,
    colors: <ColorStory packet={packet} option={colorOption} />,
    // The Customer reviews slot: genuine reviews only on the real store, and
    // only once there are enough (the review app mounts here later). It
    // renders nothing until then.
    proof: <ReviewsSlider packet={packet} isSample={isSample} />,
    useCases: <WaysToWear packet={packet} />,
    fit: <FitSection packet={packet} />,
    promise: <PromiseSection packet={packet} />,
    faq: <FaqSection packet={packet} />,
  };
  return (
    <div data-layout={template.id}>
      {activeSections.map((id) => (
        <div key={id} data-template-section={id}>
          {renderers[id]}
        </div>
      ))}
    </div>
  );
}
