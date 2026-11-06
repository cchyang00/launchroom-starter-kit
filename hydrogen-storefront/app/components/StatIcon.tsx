import type {StatIconKey} from '~/content/templates';

/**
 * Line icons that draw themselves in (October 3). Every stroke has
 * pathLength 1, so the CSS can draw it from 0 to 1 with stroke-dashoffset
 * (app/styles/pdp-interactive.css). Without motion they simply show.
 */
const strokes: Record<StatIconKey, JSX.Element> = {
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" pathLength={1} />
      <path d="M12 13.5V9.5" pathLength={1} />
      <path d="M9.5 3h5M12 3v3" pathLength={1} />
      <path d="m18.2 7.3 1.4-1.4" pathLength={1} />
    </>
  ),
  power: (
    <>
      <path d="M12 3.5v8" pathLength={1} />
      <path d="M7.2 6.6a7.5 7.5 0 1 0 9.6 0" pathLength={1} />
    </>
  ),
  moon: (
    <>
      <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" pathLength={1} />
      <path d="M17 3.5v3M15.5 5h3" pathLength={1} />
    </>
  ),
  waves: (
    <>
      <path d="M3 9c3-3 6 3 9 0s6 3 9 0" pathLength={1} />
      <path d="M3 15c3-3 6 3 9 0s6 3 9 0" pathLength={1} />
    </>
  ),
  tub: (
    <>
      <path d="M2.5 12h19" pathLength={1} />
      <path d="M4.5 12v2.5A4.5 4.5 0 0 0 9 19h6a4.5 4.5 0 0 0 4.5-4.5V12" pathLength={1} />
      <path d="M6 12V6.5a2.5 2.5 0 0 1 5 0" pathLength={1} />
      <path d="m8 19-1 2M16 19l1 2" pathLength={1} />
    </>
  ),
  drop: (
    <>
      <path d="M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5Z" pathLength={1} />
      <path d="M9.2 14.5a2.8 2.8 0 0 0 2.8 2.8" pathLength={1} />
    </>
  ),
  feather: (
    <>
      <path d="M20 4c-7 0-12 5-12 12v4" pathLength={1} />
      <path d="M8 16c5 0 9-3 10-8" pathLength={1} />
      <path d="M8 20 4 21" pathLength={1} />
    </>
  ),
  recline: (
    <>
      <circle cx="9" cy="8.5" r="3.5" pathLength={1} />
      <rect x="3" y="13.5" width="18" height="6" rx="3" pathLength={1} />
      <path d="M8 16.5h8" pathLength={1} />
    </>
  ),
  suction: (
    <>
      <path d="M5 19.5h14" pathLength={1} />
      <path d="M7 19.5c0-3.5 2.2-5.5 5-5.5s5 2 5 5.5" pathLength={1} />
      <path d="M12 14V8.5" pathLength={1} />
      <circle cx="12" cy="6.2" r="2.2" pathLength={1} />
    </>
  ),
  hand: (
    <>
      <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12" pathLength={1} />
      <path d="M11 11V5a1.5 1.5 0 0 1 3 0v6" pathLength={1} />
      <path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 3.6-2.4 6.5-6 6.5-2.4 0-3.8-1-5-3l-2-3.5a1.5 1.5 0 0 1 2.6-1.5L8 14" pathLength={1} />
    </>
  ),
  ruler: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="1.2" pathLength={1} />
      <path d="M6.5 8.5v3M10.5 8.5v2M14.5 8.5v3M18.5 8.5v2" pathLength={1} />
    </>
  ),
  rim: (
    <>
      <path d="M12 4.5v14" pathLength={1} />
      <path d="m9 7.5 3-3 3 3M9 15.5l3 3 3-3" pathLength={1} />
      <path d="M4 21h16" pathLength={1} />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2Z" pathLength={1} />
      <path d="M19 3.5v3M17.5 5h3" pathLength={1} />
    </>
  ),
  air: (
    <>
      <path d="M3 8.5h10.5a3 3 0 1 0-3-3" pathLength={1} />
      <path d="M3 12.5h15a3 3 0 1 1-3 3" pathLength={1} />
      <path d="M3 16.5h6" pathLength={1} />
    </>
  ),
};

export function StatIcon({
  name,
  size = 26,
  className = '',
}: {
  name: StatIconKey;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`stat-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {strokes[name]}
    </svg>
  );
}
