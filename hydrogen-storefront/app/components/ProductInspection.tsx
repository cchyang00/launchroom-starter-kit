import {useId, useRef} from 'react';
import {Link} from 'react-router';
import {Icon} from './Icons';
import {campaign, type CampaignPacket} from '~/content/templates';

export function ImageInspection({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const captionId = useId();

  return (
    <>
      <button
        className="inspection-trigger"
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <Icon name="plus" size={16} /> Enlarge image
      </button>
      <dialog
        className="inspection-dialog"
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={captionId}
        onClose={() => trigger.current?.focus()}
      >
        <div className="inspection-heading">
          <h2 id={titleId}>A closer look</h2>
          <button
            type="button"
            className="inspection-close"
            onClick={() => dialog.current?.close()}
            aria-label="Close enlarged image"
          >
            <Icon name="close" />
          </button>
        </div>
        <figure>
          <img src={src} alt={alt} />
          <figcaption id={captionId}>{caption}</figcaption>
        </figure>
      </dialog>
    </>
  );
}

export function MeasurementGuide({
  packet = campaign,
}: {
  packet?: CampaignPacket;
}) {
  const c = packet.purchase.guidance;
  return (
    <div className="measurement-guide" id="product-measuring-guide">
      <h3>{c.title}</h3>
      <p>{c.intro}</p>
      {c.chart?.length > 0 && (
        <div className="size-chart-scroll">
          <table className="size-chart">
            <caption>Garment measurements · cm</caption>
            <thead>
              <tr>
                <th scope="col">Size</th>
                <th scope="col">Chest</th>
                <th scope="col">Length</th>
                <th scope="col">Sleeve</th>
              </tr>
            </thead>
            <tbody>
              {c.chart.map((row) => (
                <tr key={row.size}>
                  <th scope="row">{row.size}</th>
                  <td>{row.chest}</td>
                  <td>{row.length}</td>
                  <td>{row.sleeve}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {c.kind === 'garment' && (
        <svg
          className="measurement-diagram"
          viewBox="0 0 360 240"
          role="img"
          aria-label={c.diagramAlt}
        >
          <path
            className="measurement-outline"
            d="M151 30Q180 9 209 30L224 56L249 70L294 145L268 160L236 112L240 215H120L124 112L92 160L66 145L111 70L136 56Z"
          />
          <path
            className="measurement-seam"
            d="M136 56Q180 86 224 56M151 30Q180 64 209 30M124 112L136 56M236 112L224 56M121 204H239M153 157H207L216 190H144Z"
          />
          <path
            className="measurement-line"
            d="M128 119H232M128 114V124M232 114V124M112 61V211M107 61H117M107 211H117M237 67L284 146M232 70L242 64M279 149L289 143"
          />
          <g className="measurement-label">
            <circle cx="180" cy="119" r="13" />
            <text x="180" y="119">
              A
            </text>
            <circle cx="112" cy="179" r="13" />
            <text x="112" y="179">
              B
            </text>
            <circle cx="274" cy="107" r="13" />
            <text x="274" y="107">
              C
            </text>
          </g>
        </svg>
      )}
      <dl className="measurement-steps">
        {c.steps.map((step, i) => (
          <div key={step.label}>
            <dt>
              <span>{String.fromCharCode(65 + i)}</span>
              {step.label}
            </dt>
            <dd>{step.text}</dd>
          </div>
        ))}
      </dl>
      <p className="measurement-limit">{c.limit}</p>
      <Link to="/help" className="measurement-help">
        More questions? Visit Help <Icon name="arrow" size={14} />
      </Link>
    </div>
  );
}

export function PurchaseInformation({
  variantLabel,
  packet = campaign,
}: {
  variantLabel: string;
  packet?: CampaignPacket;
}) {
  return (
    <div className="purchase-information" aria-label="Purchase information">
      {packet.purchase.disclosures.map((item) => (
        <details key={item.title}>
          <summary>
            {item.title}
            <Icon name="plus" size={16} />
          </summary>
          <div>
            <p>{item.text.replaceAll('{variant}', variantLabel)}</p>
            {item.href && (
              <Link to={item.href}>
                {item.linkLabel}
                <Icon name="arrow" size={14} />
              </Link>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
