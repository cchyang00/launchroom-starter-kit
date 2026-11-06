import {Link} from 'react-router';
import {ServiceLinks} from '~/components/SupportShell';
import {useActiveProduct} from '~/content/navigation';
import {siteContent} from '~/content/site';
import {HIGH_PRIORITY} from '~/lib/images';
export const meta = () => [
  {title: 'Our story | Merrivy'},
  {
    name: 'description',
    content: `${siteContent.about.heading.replace(/\n/g, ' ')} ${siteContent.about.emphasis} ${siteContent.about.intro}`,
  },
];
/** Lines split on line breaks. */
function Lines({text}: {text: string}) {
  return (
    <>
      {text.split('\n').map((line) => (
        <span key={line}>
          {line}
          <br />
        </span>
      ))}
    </>
  );
}
export default function AboutPage() {
  // The hero is Merrivy's own picture; the product block comes from the active packet.
  const {activePacket, productPath} = useActiveProduct();
  const hero = siteContent.aboutHero.image;
  const edit = activePacket.aboutProduct;
  const about = siteContent.about;
  return (
    <div className="about-page">
      <header className="about-hero">
        <div>
          <div className="page-trail">
            <Link to={productPath}>Home</Link>
            <span>/</span>
            <span>Our story</span>
          </div>
          <span className="eyebrow">{about.eyebrow}</span>
          <h1>
            <Lines text={about.heading} />
            <em>{about.emphasis}</em>
          </h1>
          <p>{about.intro}</p>
          <a className="text-link" href="#our-approach">
            A little about us ↓
          </a>
        </div>
        <figure>
          <img src={hero.src} alt={hero.alt} {...HIGH_PRIORITY} />
          {hero.caption ? <figcaption>{hero.caption}</figcaption> : null}
        </figure>
      </header>
      <section className="about-manifesto" id="our-approach">
        <span className="eyebrow">{about.manifesto.eyebrow}</span>
        <h2>
          <Lines text={about.manifesto.heading} />
          <em>{about.manifesto.emphasis}</em>
        </h2>
        <div>
          {about.manifesto.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </section>
      <section className="about-principles">
        {about.principles.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </section>
      <section className="about-edit">
        <img src={edit.image.src} alt={edit.image.alt} loading="lazy" />
        <div>
          <span className="eyebrow">{edit.eyebrow}</span>
          <h2>
            {edit.heading}
            <br />
            <em>{edit.emphasis}</em>
          </h2>
          <p>{edit.text}</p>
          <Link className="button-primary" to={productPath}>
            {`${edit.cta} ↗`}
          </Link>
          {edit.note ? <small>{edit.note}</small> : null}
        </div>
      </section>
      <ServiceLinks />
    </div>
  );
}
