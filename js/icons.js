// AERENT line icon set. 24px grid, 1.6 stroke, rounded joins. Drawn for this interface.
const P = {
  market: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  list: '<path d="M12.6 3.5h6.4a1.5 1.5 0 0 1 1.5 1.5v6.4a1.5 1.5 0 0 1-.44 1.06l-7.9 7.9a1.5 1.5 0 0 1-2.12 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.12l7.9-7.9a1.5 1.5 0 0 1 1.06-.44Z"/><circle cx="16.2" cy="7.8" r="1.4"/>',
  positions: '<path d="m12 3.5 8.5 4.3-8.5 4.3-8.5-4.3L12 3.5Z"/><path d="m3.5 12 8.5 4.3 8.5-4.3"/><path d="m3.5 16.2 8.5 4.3 8.5-4.3"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1.5 1.5 0 0 1 1.5 1.5V8"/><rect x="4" y="7.5" width="16.5" height="12" rx="2.5"/><path d="M20.5 11.5h-4a2 2 0 0 0 0 4h4"/>',
  activity: '<path d="M3.5 12h3.6l2.4-6 5 12 2.4-6h3.6"/>',
  calculator: '<rect x="5" y="3.5" width="14" height="17" rx="3"/><rect x="8" y="6.5" width="8" height="3.5" rx="1"/><circle cx="9" cy="13.5" r=".6"/><circle cx="12" cy="13.5" r=".6"/><circle cx="15" cy="13.5" r=".6"/><circle cx="9" cy="17" r=".6"/><circle cx="12" cy="17" r=".6"/><circle cx="15" cy="17" r=".6"/>',
  docs: '<path d="M5 5.5A2 2 0 0 1 7 3.5h11.5v14H7a2 2 0 0 0-2 2V5.5Z"/><path d="M5 19.5a2 2 0 0 0 2 1h11.5v-3"/><path d="M9 8h6M9 11h4"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  shield: '<path d="M12 3.5 19 6v5.6c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6l7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  stocks: '<path d="M3.5 20.5h17"/><path d="M5.5 20.5v-8M10 20.5v-8M14 20.5v-8M18.5 20.5v-8"/><path d="M3.5 10.2 12 4l8.5 6.2H3.5Z"/>',
  gauge: '<path d="M4.2 17a8.5 8.5 0 1 1 15.6 0"/><path d="m12 13 3.5-4"/><circle cx="12" cy="13.5" r="1.3"/>',
  bridge: '<path d="M3 17.5h18"/><path d="M4.5 17.5c1.5-5 4.3-7.5 7.5-7.5s6 2.5 7.5 7.5"/><path d="M8 17.5v-4.6M12 17.5V10M16 17.5v-4.6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  minimise: '<path d="M6 12.5h12"/>',
  maximise: '<rect x="5.5" y="5.5" width="13" height="13" rx="3"/>',
  restore: '<rect x="4.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M8.5 5.5a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v8a1 1 0 0 1-1 1"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4 21 19.5H3L12 4Z"/><path d="M12 10v4.2"/><circle cx="12" cy="16.8" r=".5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  external: '<path d="M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.7-5.7L11.6 6.7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  power: '<path d="M12 4v7"/><path d="M7.2 7a7 7 0 1 0 9.6 0"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5Z"/>',
  drop: '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z"/>',
  layers: '<path d="m12 3.5 8.5 4.3-8.5 4.3-8.5-4.3L12 3.5Z"/><path d="m3.5 12 8.5 4.3 8.5-4.3"/>',
  x: '<path d="M4 4.5h4.4l11.6 15H15.6L4 4.5Z"/><path d="m19.5 4.5-6.2 7M4.5 19.5l6.2-7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  file: '<path d="M7 3.5h7l4.5 4.5v10.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M13.5 3.5V8h5"/>'
};

export function icon(name, cls = '') {
  const d = P[name] || P.info;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
}
