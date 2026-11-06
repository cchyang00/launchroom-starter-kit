import {Link, NavLink} from 'react-router';
import type {ReactNode} from 'react';
import {useActiveProduct, withProductParam} from '~/content/navigation';
import {SUPPORT_EMAIL} from '~/content/site';
import {supportLine, useSupportFlags} from './SupportCenter';

export function SupportShell({
  eyebrow,
  title,
  intro,
  note,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  note?: string;
  children: ReactNode;
}) {
  const {activePacket, productPath} = useActiveProduct();
  // The product block at the foot of every help and policy page matches the active product.
  const promo = activePacket.helpProduct;
  const {chat} = useSupportFlags();
  return (
    <div className="support-page">
      <div className="page-trail">
        <Link to={productPath}>Home</Link>
        <span>/</span>
        {eyebrow === 'Help center' ? (
          <span>Help center</span>
        ) : (
          <>
            <Link to={withProductParam('/help', productPath)}>Help center</Link>
            <span>/</span>
            <span>{eyebrow}</span>
          </>
        )}
      </div>
      <header className="support-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div className="support-layout">
        <aside className="support-sidebar">
          <span className="eyebrow">The useful details</span>
          <nav aria-label="Help and policies">
            {[
              ['/help', 'Help center'],
              ['/track', 'Track my order'],
              ['/delivery', 'Shipping'],
              ['/returns', 'Returns & refunds'],
              ['/privacy', 'Privacy'],
              ['/terms', 'Terms'],
            ].map(([to, label]) => (
              <NavLink key={to} to={withProductParam(to, productPath)} end>
                {label}
                <span aria-hidden="true">↗</span>
              </NavLink>
            ))}
          </nav>
          <div className="support-contact">
            <h2>Need a hand?</h2>
            <p>{supportLine(chat)}</p>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL} ↗</a>
          </div>
        </aside>
        <div className="support-article">
          {note && <p className="support-note">{note}</p>}
          {children}
        </div>
      </div>
      <div className="support-outro">
        <img src={promo.image.src} alt={promo.image.alt} loading="lazy" />
        <div>
          <span className="eyebrow">{promo.eyebrow}</span>
          <h2>
            {promo.heading}
            <br />
            <em>{promo.emphasis}</em>
          </h2>
          <Link className="text-link" to={productPath}>
            {`${promo.cta} ↗`}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ServiceSummary({
  items,
}: {
  items: {label: string; value: string}[];
}) {
  return (
    <dl className="service-summary">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ServiceLinks() {
  const {productPath} = useActiveProduct();
  return (
    <section className="service-links" aria-label="Shopping made simple">
      <div>
        <span className="eyebrow">A little less guesswork</span>
        <h2>
          Good to know.
          <br />
          <em>Easy to find.</em>
        </h2>
      </div>
      <Link to={withProductParam('/delivery', productPath)}>
        <span>01 / Delivery</span>
        <h3>
          From our door
          <br />
          to yours.
        </h3>
        <p>Rates, timing and what to expect.</p>
        <b aria-hidden="true">↗</b>
      </Link>
      <Link to={withProductParam('/returns', productPath)}>
        <span>02 / Returns</span>
        <h3>
          30 days to
          <br />
          change your mind.
        </h3>
        <p>Clear steps if plans change.</p>
        <b aria-hidden="true">↗</b>
      </Link>
      <Link to={withProductParam('/help', productPath)}>
        <span>03 / Here to help</span>
        <h3>
          A question?
          <br />
          Start here.
        </h3>
        <p>A few answers and a way to reach us.</p>
        <b aria-hidden="true">↗</b>
      </Link>
    </section>
  );
}
