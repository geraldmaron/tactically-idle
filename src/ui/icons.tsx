import type { ReactNode } from 'react';

// Inline SVG line icons (24px grid, 1.75 stroke, round caps and joins, currentColor). One set for the whole UI.

const PATHS = {
  house: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16.5 14.2c2.7.2 4.5 2.4 4.5 5.8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  chart: (
    <>
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="7" width="4" height="13" rx="1" />
      <rect x="16" y="3.5" width="4" height="16.5" rx="1" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9.5h.01M17.5 14.5h.01" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  shield: <path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z" />,
  radio: (
    <>
      <rect x="8" y="9" width="8" height="12" rx="2" />
      <path d="M9.5 9V3M10.5 13h3M10.5 16h3" />
    </>
  ),
  intel: (
    <>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H11" />
      <path d="M14 3l4 4v3M14 3v4h4" />
      <circle cx="16" cy="16" r="3" />
      <path d="M18.2 18.2L21 21M8 9h4M8 12h3" />
    </>
  ),
  thermal: (
    <>
      <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z" />
      <path d="M12 9v8" />
    </>
  ),
  drone: (
    <>
      <rect x="9.5" y="10" width="5" height="4" rx="1" />
      <path d="M9.5 11L6 8M14.5 11L18 8M9.5 13L6 16M14.5 13l3.5 3" />
      <circle cx="4.5" cy="7" r="1.8" />
      <circle cx="19.5" cy="7" r="1.8" />
      <circle cx="4.5" cy="17" r="1.8" />
      <circle cx="19.5" cy="17" r="1.8" />
    </>
  ),
  medic: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  door: (
    <>
      <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" />
      <path d="M4 21h16M14.5 12.5h.01" />
    </>
  ),
  binoculars: (
    <>
      <circle cx="7" cy="16" r="3.5" />
      <circle cx="17" cy="16" r="3.5" />
      <path d="M10.5 16h3M5 12.5V6h4v6.5M15 12.5V6h4v6.5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4 4v-4h-.5A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  handover: <path d="M4 9h13l-3-3M20 15H7l3 3" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  question: (
    <>
      <path d="M9 9.2A3 3 0 1 1 13 12c-.9.5-1 1.2-1 2" />
      <path d="M12 17.5h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" />,
  bookmark: <path d="M7 3.5h10v17l-5-4-5 4z" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  wait: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v3.5L12 12 8 17.5V21M16 3v3.5L12 12l4 5.5V21" />
    </>
  ),
  perimeter: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4h3l7 4V6L7 10z" />
      <path d="M17 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="8" width="16" height="8" rx="1.5" />
      <path d="M21 11v2M7 11v2M10 11v2" />
    </>
  ),
  hammer: (
    <>
      <path d="M13 5.5l5.5 5.5-2.5 2.5L10.5 8z" />
      <path d="M12.5 11.5L5 19" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  patrol: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
    </>
  ),
  standby: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h10" />
    </>
  ),
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  box: (
    <>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14 4.5L20 15" />
      <path d="M20 20v-5h-5" />
    </>
  ),
  edit: <path d="M4 20l1-4L16 5l3 3L8 19z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  blueprint: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  flag: <path d="M6 21V4M6 5h11l-2 4 2 4H6" />,
  // ---- phase 2 additions -------------------------------------------------
  bullseye: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  nodes: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M8.2 6h7.6M7 8l4 8M17 8l-4 8" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6z" />
      <path d="M12 15.5c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5z" />
    </>
  ),
  anchor: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14M8 11h8M5 15a7 7 0 0 0 14 0" />
    </>
  ),
  mortarboard: (
    <>
      <path d="M2.5 9.5L12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.8V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.2" />
      <path d="M21.5 9.5V15" />
    </>
  ),
  bolt: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
  soundwave: <path d="M4 11v2M8 8v8M12 5v14M16 8v8M20 11v2" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  cake: (
    <>
      <path d="M4 20h16v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" />
      <path d="M4 16.5c2 1.3 3 1.3 4 0s2-1.3 4 0 3 1.3 4 0 2-1.3 4 0" />
      <path d="M12 12V8.5M12 5.5h.01" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.6 13.4L7 21l5-3 5 3-1.6-7.6" />
    </>
  ),
  bandage: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l4-5M12 17h.01" />
    </>
  ),
  flame: <path d="M12 21a6 6 0 0 1-6-6c0-3.5 3-5 3.5-9 3 1.5 4.5 4 4.5 6.5 1-.5 1.5-1.5 1.7-2.5A7 7 0 0 1 18 15a6 6 0 0 1-6 6z" />,
  bed: (
    <>
      <path d="M3 19V6M3 15h18v4M21 15v-2.5A3.5 3.5 0 0 0 17.5 9H11v6" />
      <circle cx="7" cy="11.5" r="1.8" />
    </>
  ),
  bath: (
    <>
      <path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M6 12V6.5a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" />
    </>
  ),
  stove: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 9h16M8 6h.01M12 6h.01M16 6h.01" />
      <rect x="7" y="12" width="10" height="6" rx="1" />
    </>
  ),
  sofa: (
    <>
      <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z" />
      <path d="M6 18v2M18 18v2" />
    </>
  ),
  hall: <path d="M5 3v18M19 3v18M12 7v10M9 9.5l3-3 3 3M9 14.5l3 3 3-3" />,
  stairs: <path d="M3 20h5v-5h5v-5h5V5h3" />,
  store: (
    <>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" />
      <path d="M5 12v8h14v-8M10 20v-5h4v5" />
    </>
  ),
  desk: <path d="M3 9h18v2H3zM5 11v9M19 11v9M9 11v4h6v-4" />,
  wrench: <path d="M15 4a4.5 4.5 0 0 0-4.2 6.1L3.5 17.4a2 2 0 0 0 2.8 2.8l7.3-7.3A4.5 4.5 0 0 0 20 9l-3 3-3-1-1-3z" />,
  tree: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M12 14.5V21M9 21h6" />
    </>
  ),
  road: <path d="M8 3L5 21M16 3l3 18M12 4v3M12 11v3M12 18v3" />,
  car: (
    <>
      <path d="M5 16v-4l2-5h10l2 5v4z" />
      <path d="M3 16h18M7 19v-3M17 19v-3M7.5 13h.01M16.5 13h.01" />
    </>
  ),
  window: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M12 3v18M4 12h16" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  brick: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19" />
    </>
  ),
  timber: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <path d="M8 6c1 2 1 4 0 6M15 12c1 2 1 4 0 6" />
    </>
  ),
  drywall: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 12h16M8 7.5h.01M16 7.5h.01M8 16.5h.01M16 16.5h.01" />
    </>
  ),
  plaster: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M6 9c2-1.5 3 1.5 6 0s4 1.5 6 0M6 15c2-1.5 3 1.5 6 0s4 1.5 6 0" />
    </>
  ),
  concrete: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M7 8h.01M12 7.5h.01M17 9h.01M8 13h.01M14 12h.01M18 15.5h.01M6.5 17h.01M12 17h.01" />
    </>
  ),
  glass: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 17L16 7M8 12l4-5" />
    </>
  ),
  steeldoor: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <path d="M6 9h12M6 15h12M15 12h.01" />
    </>
  ),
  blinds: <path d="M4 4h16M5 8h14M5 12h14M5 16h14M12 16v5" />,
  curtains: (
    <>
      <path d="M3 4h18" />
      <path d="M5 4c1 5 1 11-.5 16h5C8.5 15 9 9 9.5 4" />
      <path d="M19 4c-1 5-1 11 .5 16h-5c1-5 .5-11 0-16z" />
    </>
  ),
  xcircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  checkcircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  civilian: (
    <>
      <path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8.5 16c.5-2 2-3 3.5-3s3 1 3.5 3" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  mountain: <path d="M3 20l6-11 4 6 3-4 5 9z" />,
  retire: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v3.5L12 12 8 17.5V21M16 3v3.5L12 12l4 5.5V21" />
      <path d="M10 18.5h4" />
    </>
  ),
  // ---- incidents, environment and intel (phase 3)
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  sunset: (
    <>
      <path d="M7 16a5 5 0 0 1 10 0" />
      <path d="M3 19h18M12 5v3M5.2 9.2l1.6 1.6M18.8 9.2l-1.6 1.6" />
    </>
  ),
  cloud: <path d="M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.5 4.8 4.8 0 0 1 17.5 18z" />,
  rain: (
    <>
      <path d="M7 14a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 4.5 4.8 4.8 0 0 1 17.5 14z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
    </>
  ),
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2" />,
  wind: <path d="M3 9h10a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 19h6" />,
  plug: (
    <>
      <path d="M9 3v5M15 3v5" />
      <path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 17v4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5L20 3M16 7l2.5 2.5M13.5 9.5L15.5 11.5" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5h4l1.5-2.5h7L17 8.5h4V19H3z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
      <path d="M10 21h4" />
    </>
  ),
  ear: (
    <>
      <path d="M7 10a5 5 0 0 1 10 0c0 3-2.5 3.5-2.5 6a2.5 2.5 0 0 1-5 0" />
      <path d="M10 10a2 2 0 0 1 4 0" />
    </>
  ),
  paw: (
    <>
      <circle cx="6.5" cy="11" r="1.8" />
      <circle cx="10" cy="6.5" r="1.8" />
      <circle cx="14" cy="6.5" r="1.8" />
      <circle cx="17.5" cy="11" r="1.8" />
      <path d="M8 17.5c0-2.5 2-4.5 4-4.5s4 2 4 4.5c0 1.5-1.5 2-4 2s-4-.5-4-2z" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20L15 9" />
      <path d="M14 4v3M12.5 5.5h3M19 10v3M17.5 11.5h3" />
    </>
  ),
  chevronUp: <path d="M6 15l6-6 6 6" />,
  hourglass: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v3.5L12 12 8 17.5V21M16 3v3.5L12 12l4 5.5V21" />
    </>
  ),
  child: (
    <>
      <circle cx="12" cy="7" r="2.6" />
      <path d="M8 20v-5a4 4 0 0 1 8 0v5" />
    </>
  ),
  crowd: (
    <>
      <circle cx="12" cy="7.5" r="2.4" />
      <circle cx="5.5" cy="9.5" r="2" />
      <circle cx="18.5" cy="9.5" r="2" />
      <path d="M7.5 20c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5M2 18c0-2 1.5-3.5 3.5-3.5M22 18c0-2-1.5-3.5-3.5-3.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Accessible label. Omit for purely decorative icons. */
  title?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, className, title, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Map the sim's action icon keys onto this set. */
export function actionIcon(key: string): IconName {
  const map: Record<string, IconName> = {
    radio: 'radio',
    intel: 'intel',
    thermal: 'thermal',
    drone: 'drone',
    shield: 'shield',
    medic: 'medic',
    wait: 'wait',
    handover: 'handover',
    door: 'door',
    perimeter: 'perimeter',
    search: 'intel',
  };
  return map[key] ?? 'question';
}

/** Map an item id onto an illustrated tile icon. */
export function itemIcon(itemId: string): IconName {
  const map: Record<string, IconName> = {
    radio_kit: 'radio',
    loud_hailer: 'megaphone',
    throw_phone: 'phone',
    thermal_imager: 'thermal',
    camera_drone: 'drone',
    ballistic_shield: 'shield',
    door_ram: 'hammer',
    trauma_kit: 'medic',
    battery_pack: 'battery',
  };
  return map[itemId] ?? 'box';
}

/** Room types and exterior zone kinds (the key set is open: unknown types fall back to a blueprint glyph). */
export function roomIcon(type: string | undefined): IconName {
  const map: Record<string, IconName> = {
    bedroom: 'bed',
    bathroom: 'bath',
    bath: 'bath',
    kitchen: 'stove',
    living: 'sofa',
    hall: 'hall',
    storage: 'box',
    office: 'desk',
    retail: 'store',
    utility: 'wrench',
    stair: 'stairs',
    porch: 'stairs',
    yard: 'tree',
    street: 'road',
    alley: 'road',
    parking: 'car',
  };
  return (type && map[type]) || 'blueprint';
}

/** Pick a material or construction icon from a player-language line such as 'Brick wall to the hall'. */
export function materialIcon(text: string): IconName {
  const t = text.toLowerCase();
  if (/blind/.test(t)) return 'blinds';
  if (/curtain/.test(t)) return 'curtains';
  if (/steel/.test(t)) return 'steeldoor';
  if (/glass|glaz/.test(t)) return /door/.test(t) && !/window|glazing/.test(t) ? 'door' : 'glass';
  if (/window|sliding/.test(t)) return 'window';
  if (/brick/.test(t)) return 'brick';
  if (/timber|wood/.test(t)) return 'timber';
  if (/drywall/.test(t)) return 'drywall';
  if (/plaster/.test(t)) return 'plaster';
  if (/concrete/.test(t)) return 'concrete';
  if (/door/.test(t)) return 'door';
  return 'layers';
}
