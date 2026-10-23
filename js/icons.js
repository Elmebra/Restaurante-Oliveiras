// Ícones inline (SVG, traço). Usam currentColor.
const svg = (d, extra = '') => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${extra}>${d}</svg>`;

export const icons = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>'),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  up: svg('<path d="M18 15l-6-6-6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  trash: svg('<path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>'),
  users: svg('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'),
  scale: svg('<path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 008 0L7 7M19 7l-3 7a4 4 0 008 0l-3-7"/>'),
  pot: svg('<path d="M4 10h16v6a4 4 0 01-4 4H8a4 4 0 01-4-4v-6z"/><path d="M2 10h20"/><path d="M9 4c0 1-1 1-1 2s1 1 1 2M15 4c0 1-1 1-1 2s1 1 1 2"/>'),
  moto: svg('<circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 18h6l2-6h4l3 6M11 12L9 7H6"/>'),
  cash: svg('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M6 6V4h12v2"/>'),
  chart: svg('<path d="M4 20V10M12 20V4M20 20v-7"/>'),
  cloche: svg('<path d="M6 13a4 4 0 01-1-7.9A4.5 4.5 0 0112 4a4.5 4.5 0 017 1.1A4 4 0 0118 13"/><path d="M6 13h12v3a1 1 0 01-1 1H7a1 1 0 01-1-1v-3z"/><path d="M6 21h12M8 21v-4M12 21v-4M16 21v-4"/>'),
  phone: svg('<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>'),
  glass: svg('<path d="M8 2h8M12 2v6M6 8h12l-1.5 12a2 2 0 01-2 1.8h-5a2 2 0 01-2-1.8L6 8z"/>'),
  bottle: svg('<path d="M10 2h4v5l2 3v10a2 2 0 01-2 2h-4a2 2 0 01-2-2V10l2-3V2z"/>'),
  can: svg('<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M6 8h12M6 16h12"/>'),
  bar: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 12h18M9 6v12M15 6v12"/>'),
  candy: svg('<path d="M3 7l5 5-5 5zM21 7l-5 5 5 5z"/><rect x="8" y="7" width="8" height="10" rx="4"/>'),
  download: svg('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  undo: svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'),
};

/** Ícone do produto de venda rápida conforme a categoria. */
export function productIcon(cat) {
  return icons[cat] || icons.bottle;
}
