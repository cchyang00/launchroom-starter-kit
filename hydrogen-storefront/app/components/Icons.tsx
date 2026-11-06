export function Icon({
  name,
  size = 22,
}: {
  name:
    | 'bag'
    | 'arrow'
    | 'close'
    | 'menu'
    | 'check'
    | 'plus'
    | 'star'
    | 'search'
    | 'arrow-up-right'
    | 'minus'
    | 'chevron-down'
    | 'chevron-left'
    | 'chevron-right'
    | 'truck'
    | 'return'
    | 'chat'
    | 'clock'
    | 'play'
    | 'tag'
    | 'feather'
    | 'leaf'
    | 'heart'
    | 'sparkle'
    | 'moon'
    | 'sun'
    | 'bolt'
    | 'battery'
    | 'waves'
    | 'shield'
    | 'lock'
    | 'box'
    | 'gift';
  size?: number;
}) {
  const paths = {
    bag: (
      <>
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16M14 6l6 6-6 6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 8h16M4 16h16" />,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    'arrow-up-right': <path d="M7 17 17 7M9 7h8v8" />,
    minus: <path d="M5 12h14" />,
    'chevron-down': <path d="m6 9 6 6 6-6" />,
    'chevron-left': <path d="m15 6-6 6 6 6" />,
    'chevron-right': <path d="m9 6 6 6-6 6" />,
    truck: (
      <>
        <path d="M3 6.5h11v10H3zM14 10h4.2l2.8 3.2v3.3h-7" />
        <circle cx="7" cy="17.5" r="1.9" />
        <circle cx="17.2" cy="17.5" r="1.9" />
      </>
    ),
    return: (
      <>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </>
    ),
    chat: <path d="M4 5.5h16v10.5H9.5L4 20z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
    tag: (
      <>
        <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7-8.3-8.3Z" />
        <circle cx="8.2" cy="8.2" r="1.4" />
      </>
    ),
    feather: (
      <>
        <path d="M20 4c-7 0-12 5-12 12v4" />
        <path d="M8 16c5 0 9-3 10-8" />
        <path d="M8 20 4 21" />
      </>
    ),
    leaf: (
      <>
        <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
        <path d="M5 19 13 11" />
      </>
    ),
    heart: (
      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
    ),
    sparkle: (
      <>
        <path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2Z" />
      </>
    ),
    moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      </>
    ),
    bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
    battery: (
      <>
        <rect x="3" y="7.5" width="16" height="9" rx="1.5" />
        <path d="M21 10.5v3M6 10.5v3M9 10.5v3M12 10.5v3" />
      </>
    ),
    waves: (
      <path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0" />
    ),
    shield: (
      <>
        <path d="M12 3.5 19 6v6c0 4.4-3 7.4-7 8.5-4-1.1-7-4.1-7-8.5V6l7-2.5Z" />
        <path d="m8.8 12 2.2 2.2 4.2-4.4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </>
    ),
    box: (
      <>
        <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4v-9Z" />
        <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" />
      </>
    ),
    gift: (
      <>
        <rect x="4" y="9" width="16" height="11" rx="1" />
        <path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-5.5-1.5S12 9 12 9Zm0 0c1.5-4 6-4 5.5-1.5S12 9 12 9Z" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9L12 3Z" />
    ),
  };
  return (
    <svg
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
      {paths[name]}
    </svg>
  );
}
