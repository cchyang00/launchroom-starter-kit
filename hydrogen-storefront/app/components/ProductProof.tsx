import {useState} from 'react';
import {
  campaign,
  displayedReviews,
  approvedDemos,
  type CampaignPacket,
  type ReviewMedia,
} from '~/content/templates';
import {ImageInspection} from './ProductInspection';

function ProofMedia({media}: {media: ReviewMedia}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <p className="media-unavailable" role="status">
        This media is unavailable. The review is still readable below.
      </p>
    );
  if (media.kind === 'video')
    return (
      <video
        controls
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        poster={media.poster}
        onError={() => setFailed(true)}
        aria-label={media.alt}
      >
        <source src={media.src} />
        <track
          kind="captions"
          src={media.captions}
          srcLang="en"
          label="English"
        />
      </video>
    );
  return (
    <div className="review-photo">
      <img
        src={media.src}
        alt={media.alt}
        loading="lazy"
        onError={() => setFailed(true)}
      />
      <ImageInspection
        src={media.src}
        alt={media.alt}
        caption="Product review photo"
      />
    </div>
  );
}

export function ReviewsSection({packet = campaign}: {packet?: CampaignPacket}) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const reviews = displayedReviews(packet);
  const illustrative =
    packet.status === 'sample' && packet.proof.kind === 'illustrative';
  const rated = reviews.filter((r) => r.rating !== null);
  const average = rated.length
    ? rated.reduce((sum, r) => sum + (r.rating || 0), 0) / rated.length
    : null;
  const visible = reviews
    .filter((r) => filter === 'all' || r.media.some((m) => m.kind === filter))
    .sort((a, b) =>
      sort === 'newest'
        ? b.date.localeCompare(a.date)
        : (b.rating || 0) - (a.rating || 0),
    );
  if (
    !reviews.length &&
    !(packet.status === 'sample' && packet.proof.kind === 'pending')
  )
    return null;
  return (
    <section className="customer-proof" id="reviews">
      <div className="proof-heading">
        <div>
          <span className="eyebrow">{packet.proof.eyebrow}</span>
          <h2 className="packet-heading">{packet.proof.heading}</h2>
        </div>
        {average !== null && (
          <div className="rating-summary">
            <a href="#review-list" className="rating-overview">
              <strong>
                {average.toFixed(1)}
                <small> / 5</small>
              </strong>
              <span className="pdp-stars" aria-hidden="true">
                {'★'.repeat(Math.round(average))}
                {'☆'.repeat(5 - Math.round(average))}
              </span>
              <small>
                {rated.length}{' '}
                reviews
              </small>
            </a>
            <ol className="rating-bars" aria-label="Rating breakdown">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = rated.filter((r) => r.rating === stars).length;
                return (
                  <li key={stars}>
                    <span>{stars} ★</span>
                    <i>
                      <b
                        style={{
                          width: `${(count / rated.length) * 100}%`,
                        }}
                      />
                    </i>
                    <span>{count}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
      {!reviews.length ? (
        <div className="proof-empty">
          <strong>No customer reviews yet.</strong>
          <p>{packet.proof.disclosure}</p>
        </div>
      ) : (
        <>
          {!illustrative && packet.proof.disclosure && (
            <p className="proof-context">{packet.proof.disclosure}</p>
          )}
          <div className="proof-toolbar">
            <div role="group" aria-label="Filter reviews">
              {[
                ['all', 'All reviews'],
                ['image', 'With photos'],
                ['video', 'With video'],
              ]
                // Media filters only appear when there is media to filter.
                .filter(
                  ([value]) =>
                    value === 'all' ||
                    reviews.some((r) => r.media.some((m) => m.kind === value)),
                )
                .map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
            </div>
            <label>
              Sort{' '}
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="rating">Highest rating</option>
              </select>
            </label>
          </div>
          <p className="review-count" role="status">
            {visible.length} of {reviews.length} reviews
          </p>
          <div className="authentic-review-grid" id="review-list">
            {visible.map((review) => (
              <article key={review.id} className="authentic-review">
                <div className="review-media">
                  {review.media
                    .filter((m) => m.src && (m.kind === 'image' || m.captions))
                    .map((media) => (
                      <ProofMedia key={media.src} media={media} />
                    ))}
                </div>
                <div className="authentic-review-copy">
                  {review.rating !== null && (
                    <span
                      className="review-stars"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </span>
                  )}
                  <h3>{review.title}</h3>
                  <p>{review.text}</p>
                  <strong>{review.author}</strong>
                  <small>{review.detail}</small>
                  {!illustrative && review.verifiedPurchaseEvidence && (
                    <small>Verified purchase at the review source</small>
                  )}
                  {review.date && (
                    <time dateTime={review.date}>{review.date}</time>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <p className="proof-empty">
              No reviews match this filter.{' '}
              <button type="button" onClick={() => setFilter('all')}>
                Show all reviews
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function DemonstrationSection({
  packet = campaign,
}: {
  packet?: CampaignPacket;
}) {
  const clips = approvedDemos(packet);
  if (!clips.length) return null;
  return (
    <section className="product-demonstrations" id="in-motion">
      <div className="pdp-section-head is-centered">
        <span className="eyebrow">
          {(packet.demonstrations as any)?.eyebrow ||
            (/planner/i.test(packet.shortName || '')
              ? 'INSIDE THE PAGES'
              : 'SEE IT IN MOTION')}
        </span>
        <h2 className="packet-heading">{packet.demonstrations.heading}</h2>
        {packet.demonstrations.description && (
          <p className="pdp-demo-sub">{packet.demonstrations.description}</p>
        )}
      </div>
      <div className="demonstration-grid">
        {clips.map((clip) => (
          <article key={clip.id}>
            <ProofMedia
              media={{
                kind: 'video',
                src: clip.src,
                poster: clip.poster,
                captions: clip.captions,
                alt: clip.title,
              }}
            />
            <h3>{clip.title}</h3>
            {clip.description && <p>{clip.description}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProductSpotlight({
  packet = campaign,
}: {
  packet?: CampaignPacket;
}) {
  const [active, setActive] = useState(0);
  const c = packet.featureSpotlight;
  return (
    <section className="product-spotlight" id="details">
      <div className="spotlight-photo">
        <img src={c.image} alt={c.alt} loading="lazy" />
        {c.points.map((point, i) => (
          <button
            type="button"
            key={point.title}
            style={{left: point.x + '%', top: point.y + '%'}}
            aria-label={`Inspect ${point.title}`}
            aria-pressed={active === i}
            onClick={() => setActive(i)}
          >
            {i + 1}
          </button>
        ))}
        <small>{c.caption}</small>
      </div>
      <div className="spotlight-copy">
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 className="packet-heading">{c.heading}</h2>
        <div className="spotlight-points">
          {c.points.map((point, i) => (
            <button
              key={point.title}
              className={i === active ? 'active' : ''}
              type="button"
              aria-pressed={i === active}
              onClick={() => setActive(i)}
            >
              <span>0{i + 1}</span>
              <div>
                <h3>{point.title}</h3>
                <p>{point.text}</p>
              </div>
            </button>
          ))}
        </div>
        <a href="#choose" className="text-link">
          Choose your color & size →
        </a>
      </div>
    </section>
  );
}
