/** Ícones inline (traço 1.7) — evita puxar uma biblioteca inteira no bundle. */

type P = React.SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconFeed = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5h16M4 12h16M4 19h9" />
  </svg>
);

export const IconLibrary = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10v18H5.5A1.5 1.5 0 0 1 4 19.5z" />
    <path d="M10 3h4.5A1.5 1.5 0 0 1 16 4.5v15a1.5 1.5 0 0 1-1.5 1.5H10" />
    <path d="m17.5 5.4 2.2 14.2" />
  </svg>
);

export const IconFlame = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-1.4.6-2.6 1.4-3.6C9 9.5 10 11 10 11s-.5-5 2-8z" />
  </svg>
);

export const IconGear = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 8 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 3.7 8a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 3.7V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 16 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);

export const IconArrowDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

export const IconBolt = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13 2 4.5 13H11l-1 9 8.5-11H12z" />
  </svg>
);

export const IconBookmark = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 3.8h12a.8.8 0 0 1 .8.8v16L12 16.8 5.2 20.6v-16a.8.8 0 0 1 .8-.8z" />
  </svg>
);

export const IconBookmarkFilled = (p: P) => (
  <svg {...base} {...p} fill="currentColor">
    <path d="M6 3.8h12a.8.8 0 0 1 .8.8v16L12 16.8 5.2 20.6v-16a.8.8 0 0 1 .8-.8z" />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconPlay = (p: P) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

export const IconPause = (p: P) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
  </svg>
);

export const IconShuffle = (p: P) => (
  <svg {...base} {...p}>
    <path d="M17 4h4v4M21 4l-6.5 6.5M17 20h4v-4M21 20l-6.5-6.5M3 4l4.5 4.5M3 20l7-7" />
  </svg>
);

export const IconDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v12M7 12l5 5 5-5M4 20h16" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);

export const IconList = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 6h12M8 12h12M8 18h7" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);

export const IconFile = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
    <path d="M13.5 3v5.5H19" />
    <path d="M9 13h6M9 16.5h4" />
  </svg>
);

export const IconRefresh = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 1 0-1.5 5.5M20 5v6h-6" />
  </svg>
);
