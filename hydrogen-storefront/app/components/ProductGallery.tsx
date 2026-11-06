import {useEffect, useRef, useState} from 'react';
import {Icon} from './Icons';
import {HIGH_PRIORITY} from '~/lib/images';
import {prefersReducedMotion} from '~/lib/scroll-to-section';

export type GalleryImage = {
  src: string;
  alt: string;
  label: string;
  caption: string;
  role?: string;
  /** Benefit text drawn over a plain photo; empty when the image carries it. */
  overlay?: {headline: string; callouts: string[]};
};

/**
 * One swipeable track for every screen: thumbnails and arrows on desktop,
 * swipe and dots on mobile. The first slide is the clean product view.
 */
export function ProductGallery({
  images,
  resetKey,
}: {
  images: GalleryImage[];
  resetKey: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = images.length;

  useEffect(() => {
    track.current?.scrollTo({left: 0});
    setActive(0);
  }, [resetKey]);

  function show(index: number) {
    const el = track.current;
    const next = (index + count) % count;
    setActive(next);
    el?.scrollTo({left: next * el.clientWidth, behavior: 'smooth'});
  }

  function onScroll() {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== active && index >= 0 && index < count) setActive(index);
  }

  const current = images[active] ?? images[0];
  // Pictures with their words baked in (no overlay) show whole on phones too:
  // the phone's shorter 1:0.8 crop would cut text at the top and bottom.
  const square = images.every(
    (image) => !image.overlay?.headline && !image.overlay?.callouts?.length,
  );
  return (
    <div className="product-gallery pdp-gallery">
      <div
        className={`pdp-gallery-frame${square ? ' has-baked-text' : ''}`}
      >
        <div
          className={`pdp-gallery-track${square ? ' is-square' : ''}`}
          ref={track}
          onScroll={onScroll}
          aria-roledescription="carousel"
          aria-label="Product images"
        >
          {images.map((image, index) => (
            <figure
              // The first slide keeps its place when the colour changes, so
              // its picture can crossfade instead of popping.
              key={index === 0 ? 'product' : `${image.label}-${image.src}`}
              className={`pdp-slide ${index === 0 ? 'is-product' : ''}`}
              aria-hidden={index !== active}
            >
              {index === 0 ? (
                <CrossfadeImage src={image.src} alt={image.alt} />
              ) : (
                <img
                  src={image.src}
                  alt={image.alt}
                  loading="lazy"
                  decoding="async"
                />
              )}
              {(image.overlay?.headline || image.overlay?.callouts?.length) && (
                <figcaption className="pdp-slide-overlay">
                  {image.overlay.headline && (
                    <strong>{image.overlay.headline}</strong>
                  )}
                  {image.overlay.callouts?.length ? (
                    <ul>
                      {image.overlay.callouts.slice(0, 3).map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  ) : null}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
        {/* The caption chip would sit on top of baked-in words. */}
        {!square && (
          <span className="pdp-gallery-caption">{current.caption}</span>
        )}
        {count > 1 && (
          <>
            <span className="pdp-gallery-count" aria-hidden="true">
              {active + 1} / {count}
            </span>
            <button
              type="button"
              className="pdp-gallery-arrow is-prev"
              aria-label="Previous image"
              onClick={() => show(active - 1)}
            >
              <Icon name="chevron-left" size={20} />
            </button>
            <button
              type="button"
              className="pdp-gallery-arrow is-next"
              aria-label="Next image"
              onClick={() => show(active + 1)}
            >
              <Icon name="chevron-right" size={20} />
            </button>
            <div className="pdp-gallery-dots" role="group" aria-label="Images">
              {images.map((image, index) => (
                <button
                  key={`${image.label}-${image.src}`}
                  type="button"
                  aria-label={`Show ${image.label}`}
                  aria-current={index === active}
                  onClick={() => show(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="pdp-thumbs" role="group" aria-label="Choose an image">
          {images.map((image, index) => (
            <button
              key={`${image.label}-${image.src}`}
              type="button"
              className={index === 0 ? 'is-product' : ''}
              aria-label={image.label}
              aria-pressed={index === active}
              onClick={() => show(index)}
            >
              <img src={image.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The first slide's picture follows the chosen colour. When it changes, the
 * old picture stays until the new one has loaded, then the new one fades in
 * over it (opacity only). The first paint is not animated.
 */
function CrossfadeImage({src, alt}: {src: string; alt: string}) {
  const [shown, setShown] = useState(src);
  const [previous, setPrevious] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(true);
  useEffect(() => {
    if (src === shown) return;
    setPrevious(shown);
    setShown(src);
    setLoaded(false);
  }, [src, shown]);
  const fading = previous !== null;
  return (
    <>
      {fading && (
        <img className="pdp-slide-previous" src={previous} alt="" aria-hidden />
      )}
      <img
        key={shown}
        src={shown}
        alt={alt}
        loading="eager"
        decoding="async"
        {...HIGH_PRIORITY}
        className={fading ? (loaded ? 'is-fading-in' : 'is-loading') : undefined}
        onLoad={() => {
          setLoaded(true);
          // No fade with reduced motion: swap straight away.
          if (prefersReducedMotion()) setPrevious(null);
        }}
        onError={() => setPrevious(null)}
        onAnimationEnd={() => setPrevious(null)}
      />
    </>
  );
}
