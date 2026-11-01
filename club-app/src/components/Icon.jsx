/** SF Symbols hissiyatında ince çizgili ikon seti. */
const PATHS = {
  home: (
    <>
      <path d="M3.5 10.6 12 3.8l8.5 6.8" />
      <path d="M5.8 9v9.4c0 .9.7 1.6 1.6 1.6h3v-5.2h3.2V20h3c.9 0 1.6-.7 1.6-1.6V9" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8.2" width="17" height="4.3" rx="1.3" />
      <path d="M5 12.5V19c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5v-6.5M12 8.2v12.3" />
      <path d="M12 8.2S10.9 3.6 8.4 3.6C6.9 3.6 6 4.6 6 5.8c0 1.6 1.7 2.4 6 2.4Zm0 0s1.1-4.6 3.6-4.6c1.5 0 2.4 1 2.4 2.2 0 1.6-1.7 2.4-6 2.4Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M10 3.5c.6 3.7 2.3 5.4 6 6-3.7.6-5.4 2.3-6 6-.6-3.7-2.3-5.4-6-6 3.7-.6 5.4-2.3 6-6Z" />
      <path d="M17.5 13.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3Z" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.2" r="3.9" />
      <path d="M4.5 20.2c.9-3.6 3.9-5.7 7.5-5.7s6.6 2.1 7.5 5.7" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.6" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  cup: (
    <>
      <path d="M5 9.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9.5Z" />
      <path d="M16 10.5h1.2a2.6 2.6 0 0 1 0 5.2H16M8.5 3.5c0 1.3 1 1.4 1 2.7M12 3.5c0 1.3 1 1.4 1 2.7" />
    </>
  ),
  glass: (
    <>
      <path d="M6.5 6h11l-1.5 13.2a1.6 1.6 0 0 1-1.6 1.4H9.6A1.6 1.6 0 0 1 8 19.2L6.5 6Z" />
      <path d="M7.3 10.5h9.4M12.5 6l1.8-3.5" />
    </>
  ),
  roll: <path d="M12 12a1 1 0 0 1 2 0 2 2 0 0 1-4 0 3 3 0 0 1 6 0 4 4 0 0 1-8 0 5 5 0 0 1 10 0 6 6 0 0 1-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  menu: (
    <>
      <path d="M5 4.5v6a2.5 2.5 0 0 0 5 0v-6M7.5 4.5v16" />
      <path d="M17.5 20.5v-16c-2 0-3.5 2.4-3.5 6v3.5h3.5" />
    </>
  ),
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5Z" />
    </>
  ),
  list: <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  edit: (
    <>
      <path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4.5h3c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5h-3" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  bolt: <path d="M13 3 5.5 13.2h5.6L10 21l7.5-10.2h-5.6L13 3Z" />,
  cake: (
    <>
      <path d="M4.5 20.5h15v-7c0-1.1-.9-2-2-2h-11c-1.1 0-2 .9-2 2v7Z" />
      <path d="M4.5 15.5c1.3 0 1.9-1 3-1s1.9 1 3 1 1.9-1 3-1 1.9 1 3 1 1.9-1 3-1M12 11.5v-3M12 6.2c.9 0 1.5-.7 1.5-1.5S12 2.5 12 2.5s-1.5 1.4-1.5 2.2.6 1.5 1.5 1.5Z" />
    </>
  ),
  camera: (
    <>
      <path d="M4.5 8.5c0-1.1.9-2 2-2h1.8l1.5-2h4.4l1.5 2h1.8c1.1 0 2 .9 2 2V17c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2V8.5Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.2" />
      <path d="M7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01M7 14h10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.4" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 3.8Z" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  google: null,
};

export default function Icon({ name, size = 24, stroke = 1.8, className = '', style }) {
  if (name === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
        <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
        <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
