import {useEffect, useId, useRef, useState} from 'react';
import {Link} from 'react-router';
import type {MappedProductOptions} from '@shopify/hydrogen';
import {campaign, type CampaignPacket} from '~/content/templates';
import {swatchColor} from '~/lib/colors';
import {Icon} from './Icons';
import {MeasurementGuide} from './ProductInspection';
import {fillSupport, useSupportFlags} from './SupportCenter';

type Props = {packet?: CampaignPacket};
type IconName = 'truck' | 'return' | 'chat';
const iconName = (name: string): IconName =>
  name === 'truck' || name === 'return' || name === 'chat' ? name : 'chat';

export function BenefitsSection({packet = campaign}: Props) {
  const c = packet.benefits;
  if (!c?.items?.length) return null;
  return (
    <section className="pdp-benefits" id="why-it-works">
      <div className="pdp-section-head">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
      </div>
      <div className="pdp-benefit-grid">
        {c.items.map((item, index) => (
          <article key={item.title}>
            <div
              className={`pdp-benefit-media ${'cutout' in item.image && item.image.cutout ? 'is-cutout' : ''}`}
            >
              <img src={item.image.src} alt={item.image.alt} loading="lazy" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Every color, photographed: tapping one selects it in the purchase form. */
export function ColorStory({
  packet = campaign,
  option,
}: Props & {option?: MappedProductOptions}) {
  const c = packet.colors;
  if (!c?.heading || !option || option.optionValues.length < 2) return null;
  return (
    <section className="pdp-colors" id="colors">
      <div className="pdp-section-head is-centered">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
      </div>
      <div className="pdp-color-grid">
        {option.optionValues.map((value) => {
          const image =
            value.variant?.image ?? value.firstSelectableVariant?.image;
          return (
            <Link
              key={value.name}
              to={`?${value.variantUriQuery}`}
              replace
              preventScrollReset
              className={value.selected ? 'is-selected' : ''}
              aria-current={value.selected ? 'true' : undefined}
              onClick={() =>
                document
                  .getElementById('choose')
                  ?.scrollIntoView({behavior: 'smooth', block: 'start'})
              }
            >
              <span className="pdp-color-image">
                {image && (
                  <img
                    src={`${image.url}${image.url.includes('?') ? '&' : '?'}width=520`}
                    alt=""
                    loading="lazy"
                  />
                )}
              </span>
              <span className="pdp-color-name">
                <i
                  style={{
                    backgroundColor: swatchColor(
                      value.name,
                      value.swatch?.color,
                    ),
                  }}
                />
                {value.name}
              </span>
            </Link>
          );
        })}
      </div>
      {c.note && <p className="pdp-fine-print">{c.note}</p>}
    </section>
  );
}

export function FitSection({packet = campaign}: Props) {
  const c = packet.fit;
  const guide = packet.purchase.guidance;
  if (!c?.heading) return null;
  const chart = guide.kind === 'garment' ? guide.chart : [];
  return (
    <section className="pdp-fit" id="fit">
      <div className="pdp-fit-copy">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
        <p>{c.intro}</p>
        <dl className="pdp-fit-tips">
          {c.tips.map((tip) => (
            <div key={tip.title}>
              <dt>{tip.title}</dt>
              <dd>{tip.text}</dd>
            </div>
          ))}
        </dl>
        <a className="text-link" href="#choose">
          Choose your size <Icon name="arrow" size={16} />
        </a>
      </div>
      {chart.length > 0 && (
        <div className="pdp-fit-chart">
          <table>
            <caption>Garment measurements · cm</caption>
            <thead>
              <tr>
                <th scope="col">Size</th>
                <th scope="col">Chest width</th>
                <th scope="col">Body length</th>
                <th scope="col">Sleeve</th>
              </tr>
            </thead>
            <tbody>
              {chart.map((row) => (
                <tr key={row.size}>
                  <th scope="row">{row.size}</th>
                  <td>{row.chest}</td>
                  <td>{row.length}</td>
                  <td>{row.sleeve}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ol className="pdp-measure-steps">
            {guide.steps.map((step) => (
              <li key={step.label}>
                <strong>{step.label}</strong> {step.text}
              </li>
            ))}
          </ol>
          <p className="pdp-fine-print">{guide.limit}</p>
        </div>
      )}
    </section>
  );
}

export function PromiseSection({packet = campaign}: Props) {
  const c = packet.promise;
  if (!c?.items?.length) return null;
  return (
    <section className="pdp-promise" id="promise">
      <div className="pdp-section-head is-centered">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
      </div>
      <div className="pdp-promise-grid">
        {c.items.map((item) => (
          <article key={item.title}>
            <span className="pdp-promise-icon">
              <Icon name={iconName(item.icon)} size={26} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      {c.note && <p className="pdp-fine-print">{c.note}</p>}
    </section>
  );
}

export function ProductFinale({
  packet = campaign,
  image,
}: Props & {image: string}) {
  const {chat} = useSupportFlags();
  const c = packet.finale;
  return (
    <section className="pdp-finale">
      <div className="pdp-finale-media">
        <img src={image} alt="" loading="lazy" />
      </div>
      <div className="pdp-finale-copy">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
        <p>{packet.purchase.hook}</p>
        <a href="#choose" className="button-primary">
          {c.cta} <Icon name="arrow" />
        </a>
        <ul className="pdp-trust is-inline">
          {packet.purchase.trust.map((item) => (
            <li key={item.title}>
              <Icon name={iconName(item.icon)} size={17} />
              {fillSupport(item.title, chat)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function addBusinessDays(from: Date, days: number) {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date;
}

/** Dates depend on the shopper's clock, so they render after hydration. */
function DeliveryEstimate({
  delivery,
}: {
  delivery: CampaignPacket['purchase']['delivery'];
}) {
  const [range, setRange] = useState('');
  useEffect(() => {
    const [prepMin, prepMax] = delivery.processingDays;
    const [transitMin, transitMax] = delivery.transitDays;
    const format = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const today = new Date();
    setRange(
      `${format.format(addBusinessDays(today, prepMin + transitMin))} – ${format.format(addBusinessDays(today, prepMax + transitMax))}`,
    );
  }, [delivery]);
  const fallback = `in ${delivery.processingDays[0] + delivery.transitDays[0]}–${delivery.processingDays[1] + delivery.transitDays[1]} business days`;
  return (
    <p className="pdp-delivery">
      <Icon name="truck" size={18} />
      <span>
        Order today, arrives <strong>{range || fallback}</strong>
        <small>{delivery.note}</small>
      </span>
    </p>
  );
}

export function PurchaseAssurance({
  packet = campaign,
  compact = false,
}: Props & {compact?: boolean}) {
  const {chat} = useSupportFlags();
  const {trust, delivery} = packet.purchase;
  const hasWindow =
    delivery?.processingDays?.length === 2 &&
    delivery?.transitDays?.length === 2;
  return (
    <div className="pdp-assurance">
      {hasWindow && <DeliveryEstimate delivery={delivery} />}
      {!compact && (
        <ul className="pdp-trust">
          {trust.map((item) => (
            <li key={item.title}>
              <Icon name={iconName(item.icon)} size={18} />
              {fillSupport(item.title, chat)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Size guide opens beside the size choice instead of pushing the form down. */
export function SizeGuideButton({packet = campaign}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const guide = packet.purchase.guidance;
  if (guide.kind === 'omit') return null;
  return (
    <>
      <button
        type="button"
        className="size-guide-link"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {guide.label}
      </button>
      <dialog
        ref={dialog}
        className="size-guide-dialog"
        aria-labelledby={titleId}
      >
        <div className="size-guide-head">
          <h2 id={titleId}>{guide.title}</h2>
          <button
            type="button"
            aria-label="Close size guide"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <MeasurementGuide packet={packet} />
      </dialog>
    </>
  );
}
