import {Link} from 'react-router';
import {useActiveProduct, withProductParam} from '~/content/navigation';
import {siteContent} from '~/content/site';
import {Icon} from './Icons';

/** Friendly not-found and failure states that keep the shopper moving. */
export function ErrorPage({
  status,
  detail,
  withCampaign = true,
}: {
  status: number;
  detail?: string;
  /** Only link the campaign product where its sample catalog is connected. */
  withCampaign?: boolean;
}) {
  const notFound = status === 404;
  const {activePacket, productPath} = useActiveProduct();
  return (
    <section className="error-page" aria-labelledby="error-heading">
      <div className="error-copy">
        <span className="eyebrow">
          {notFound
            ? '404 · Page not found'
            : `${status} · Something went wrong`}
        </span>
        <h1 id="error-heading">
          {notFound ? (
            <>
              Nothing here.
              <br />
              <em>Something</em> worth finding.
            </>
          ) : (
            <>
              A small hiccup.
              <br />
              <em>Let’s try that again.</em>
            </>
          )}
        </h1>
        <p>
          {notFound
            ? 'The page you’re after has moved, or never quite existed. Take one of the good paths below.'
            : 'We couldn’t load this page just now. Refresh in a moment, or head somewhere else in the shop. If it keeps happening, let us know.'}
        </p>
        <div className="error-actions">
          {notFound && withCampaign ? (
            <Link className="button-primary" to={productPath}>
              {activePacket.home.cta} <Icon name="arrow" />
            </Link>
          ) : notFound ? (
            <Link className="button-primary" to={productPath}>
              Back to product <Icon name="arrow" />
            </Link>
          ) : (
            <button
              type="button"
              className="button-primary"
              onClick={() => window.location.reload()}
            >
              Try again <Icon name="arrow" />
            </button>
          )}
          <Link className="text-link" to={withProductParam('/help', productPath)}>
            Get help <Icon name="arrow" size={16} />
          </Link>
        </div>
        {detail && <pre className="error-detail">{detail}</pre>}
      </div>
      <div className="error-image">
        <img
          src={siteContent.errorPage.image.src}
          alt={siteContent.errorPage.image.alt}
        />
        <span className="error-stamp" aria-hidden="true">
          {status}
        </span>
      </div>
    </section>
  );
}
