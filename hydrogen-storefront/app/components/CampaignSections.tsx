import {Link} from 'react-router';
import {Icon} from './Icons';
import {SupportEmail} from './SupportEmail';
import {campaign, type CampaignPacket} from '~/content/templates';
import {withProductParam} from '~/content/navigation';
type Props = {packet?: CampaignPacket};

export function StorySection({
  packet = campaign,
  ctaHref,
}: Props & {ctaHref?: string}) {
  const c = packet.story;
  return (
    <section className="story-section" id="the-story">
      <div className="story-image">
        <img src={c.image.src} alt={c.image.alt} loading="lazy" />
        <span className="image-caption">{c.image.caption}</span>
      </div>
      <div className="story-copy">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
        {c.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        {ctaHref ? (
          <a className="text-link" href={ctaHref}>
            {c.cta} <Icon name="arrow" />
          </a>
        ) : (
          <Link className="text-link" to="/">
            {c.cta} <Icon name="arrow" />
          </Link>
        )}
      </div>
    </section>
  );
}
export {ReviewsSection} from './ProductProof';
export function FaqSection({packet = campaign}: Props) {
  const c = packet.faq;
  const productPath = packet.product?.handle ? `/products/${packet.product.handle}` : '/';
  return (
    <section className="faq-section" id="questions">
      <div>
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
        <p>
          <Link to={withProductParam('/help', productPath)} className="text-link">
            We’re here to help <Icon name="arrow" />
          </Link>
        </p>
      </div>
      <div className="faq-list">
        {c.items.map((item) => (
          <details key={item.question}>
            <summary>
              {item.question}
              <Icon name="plus" />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
        <p className="faq-still">
          Still have a question? Email <SupportEmail />
        </p>
      </div>
    </section>
  );
}
export function ClosingSection({packet = campaign}: Props) {
  const c = packet.closing;
  return (
    <section className="closing-section">
      <span className="eyebrow">{c.eyebrow}</span>
      <h2 className="packet-heading">
        {c.heading} <em>{c.emphasis}</em>
      </h2>
      <Link to="/" className="button-primary">
        {c.cta}
        <Icon name="arrow" />
      </Link>
      <span className="closing-footnote">{c.footnote}</span>
    </section>
  );
}
