import {Link} from 'react-router';
import {
  campaign,
  packetFile,
  templates,
  sectionLabels,
  requiredInputs,
} from '~/content/templates';
import {Icon} from '~/components/Icons';
import {retire} from '~/lib/single-product';

/** The layout library is a builder's page: the local dev server only. */
export function loader({request}: {request: Request}) {
  if (!import.meta.env.DEV) throw retire(request);
  return null;
}
export const meta = () => [{title: 'Template library | Merrivy'}];
export default function TemplatesPage() {
  // Only a sample packet is called a design sample.
  const sampleNote =
    campaign.status === 'sample'
      ? `The ${campaign.shortName} is a design sample. `
      : '';
  return (
    <div className="template-library">
      <header className="template-intro">
        <span className="eyebrow">The starting point for the next product</span>
        <h1>
          One foundation.
          <br />
          <em>A different story.</em>
        </h1>
        <p>
          Choose the page order. Add the product’s story, images and proof. Keep
          the working purchase flow.
        </p>
        <span className="template-count">
          3 layout presets · 1 sample content packet
        </span>
      </header>
      <div className="template-grid">
        {templates.map((template, i) => (
          <article className="template-card" key={template.id}>
            <div
              className={`template-mini template-mini-${i}`}
              aria-label={`${template.name} section order`}
            >
              <div className="template-mini-purchase">
                <span />
                <div>
                  <i />
                  <i />
                  <b />
                </div>
              </div>
              <ol>
                {template.sections.map((id, index) => (
                  <li key={id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {sectionLabels[id]}
                  </li>
                ))}
              </ol>
            </div>
            <div className="template-card-copy">
              <span className="eyebrow">0{i + 1} / Layout</span>
              <h2>{template.name}</h2>
              <p>{template.purpose}</p>
              <Link
                to={campaign.productUrl + '?template=' + template.id}
                className="text-link"
                aria-label={`Preview ${template.name}`}
              >
                Preview with sample content <Icon name="arrow" />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <section className="template-packet">
        <div>
          <span className="eyebrow">What changes for each product</span>
          <h2>
            Fill the packet.
            <br />
            Keep the foundation.
          </h2>
          <p>
            These presets share the current visual style. Each changes the
            section order; the copy and imagery come from a separate product
            packet.
          </p>
          <p className="section-note">
            {sampleNote +
              'No product is verified or launch-ready by choosing a template.'}
          </p>
          <details>
            <summary>Where the content lives</summary>
            <p>
              Edit <code>{packetFile}</code> for the sample. Use{' '}
              <code>npm run packet:new -- product-slug</code> for a blank draft.
              Shopify remains the source for prices, variants, stock, discounts
              and selling plans.
            </p>
          </details>
        </div>
        <ol className="template-inputs">
          {requiredInputs.map(([label, description], i) => (
            <li key={label}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{label}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
