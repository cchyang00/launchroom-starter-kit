import {Icon} from './Icons';
import {campaign, type CampaignPacket} from '~/content/templates';
type Props = {packet?: CampaignPacket};
export function WaysToWear({packet = campaign}: Props) {
  const c = packet.useCases;
  return (
    <section className="wear-chapter" id="ways-to-wear">
      <div className="wear-intro">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
        <p>{c.intro}</p>
      </div>
      <div className="wear-layout">
        <figure>
          <img src={c.image.src} alt={c.image.alt} loading="lazy" />
          <figcaption>{c.image.caption}</figcaption>
        </figure>
        <div className="moment-list">
          {c.items.map((item, i) => (
            <article key={item.title}>
              <span className="moment-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <small>{item.label}</small>
                <strong>{item.detail}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
