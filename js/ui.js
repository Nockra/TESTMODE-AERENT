import { icon } from './icons.js';
import { esc, $ } from './util.js';
import { S } from './state.js';

// ---------------------------------------------------------------- toasts
export function toast(title, detail = '', kind = 'info') {
  const box = $('#toasts');
  const n = document.createElement('div');
  n.className = `toast ${kind}`;
  n.innerHTML = `${icon(kind === 'ok' ? 'check' : kind === 'bad' ? 'alert' : 'info')}<div><strong>${esc(title)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</div>`;
  box.appendChild(n);
  setTimeout(() => n.remove(), kind === 'bad' ? 7000 : 4500);
}

// ---------------------------------------------------------------- small pieces
export function avatar(address = '') {
  const h = parseInt((address || '0x000000').slice(2, 8), 16) || 0;
  const a = h % 360, b = (a + 60 + (h >> 8) % 90) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 85% 62%)"/><stop offset="1" stop-color="hsl(${b} 80% 48%)"/></linearGradient></defs><rect width="40" height="40" fill="url(#g)"/><circle cx="${12 + (h % 16)}" cy="${12 + ((h >> 4) % 16)}" r="9" fill="rgba(255,255,255,.35)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function statusBadge(status, extra = '') {
  const map = {
    open: ['b-open', 'Open'], rented: ['b-rented', 'Rented'], returned: ['b-closed', 'Returned'], cancelled: ['b-closed', 'Cancelled'],
    settled: ['b-closed', 'Settled'], defaulted: ['b-warn', 'Defaulted'], liquidated: ['b-bad', 'Liquidated'],
    overdue: ['b-warn', 'Overdue'], risk: ['b-bad', 'At risk']
  };
  const [cls, label] = map[status] || ['b-plain', status];
  return `<span class="badge ${cls}"><i></i>${esc(extra || label)}</span>`;
}

export function hfView(hf, compact = false) {
  if (hf === Infinity || hf == null) return `<span class="muted small strong">${hf === Infinity ? 'No liquidation' : 'Unavailable'}</span>`;
  const cls = hf < 1 ? 'bad' : hf < 1.15 ? 'warn' : 'good';
  const pos = Math.max(2, Math.min(98, ((Math.min(hf, 2) - 0.6) / 1.4) * 100));
  const one = ((1 - 0.6) / 1.4) * 100;
  if (compact === 'bar') return `<div class="hf"><span class="hf-val ${cls}">${hf.toFixed(2)}</span><div class="hf-bar"><b style="left:${one}%"></b><i style="left:${pos}%"></i></div></div>`;
  if (compact) return `<span class="hf-val ${cls}">${hf.toFixed(2)}</span>`;
  return `<div class="hf"><div class="row"><span class="soft small strong">Health factor</span><span class="spacer"></span><span class="hf-val ${cls}">${hf.toFixed(2)}</span></div><div class="hf-bar"><b style="left:${one}%"></b><i style="left:${pos}%"></i></div></div>`;
}

export function empty(title, text, action = '') {
  return `<div class="empty"><div class="tile">${icon('layers')}</div><strong>${esc(title)}</strong><span>${esc(text)}</span>${action}</div>`;
}

export function note(kind, html) {
  const ic = { info: 'info', warn: 'alert', bad: 'alert', ok: 'check' }[kind] || 'info';
  return `<div class="note note-${kind}">${icon(ic)}<div>${html}</div></div>`;
}

export const skeleton = (n = 4) => Array.from({ length: n }, () => '<div class="skel"></div>').join('');

export function explorerLink(kind, value, label) {
  const base = S.net?.explorerUrl;
  if (!base || !value || S.src?.mode === 'preview') return `<span class="mono">${esc(label || value)}</span>`;
  return `<a class="mono" href="${esc(base)}/${kind}/${esc(value)}" target="_blank" rel="noopener noreferrer">${esc(label || value)}</a>`;
}

// ---------------------------------------------------------------- modal
export function modal(title, bodyHtml, onMount) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><strong>${esc(title)}</strong><button class="icon-btn" data-x aria-label="Close">${icon('close')}</button></div><div class="modal-body">${bodyHtml}</div></div>`;
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-x]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(scrim);
  onMount?.(scrim.querySelector('.modal'), close);
  scrim.querySelector('button, input')?.focus();
  return close;
}

// ---------------------------------------------------------------- window manager
const wins = new Map();
let z = 100, count = 0;
export const windows = () => wins;

export function openWindow(key, def) {
  if (wins.has(key)) {
    const w = wins.get(key);
    w.el.hidden = false;
    focus(w);
    if (def.onReopen) def.onReopen(w);
    return w;
  }
  const el = document.createElement('section');
  el.className = 'win opening';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', def.title);
  const stage = $('#stage').getBoundingClientRect();
  const W = Math.min(def.w || 760, stage.width - 40), H = Math.min(def.h || 560, stage.height - 30);
  const off = (count++ % 6) * 26;
  el.style.width = W + 'px';
  el.style.height = H + 'px';
  el.style.left = Math.max(12, Math.min(stage.width - W - 12, (stage.width - W) / 2 + 60 + off)) + 'px';
  el.style.top = Math.max(10, Math.min(stage.height - H - 10, 24 + off)) + 'px';
  el.innerHTML = `
    <header class="win-head">
      <span class="tile">${def.tile || icon(def.icon)}</span>
      <div class="win-title"><strong>${esc(def.title)}</strong><small>${esc(def.sub || '')}</small></div>
      <div class="win-ctrl">
        <button class="icon-btn" data-min aria-label="Minimise">${icon('minimise')}</button>
        <button class="icon-btn" data-max aria-label="Maximise">${icon('maximise')}</button>
        <button class="icon-btn" data-close aria-label="Close">${icon('close')}</button>
      </div>
    </header>
    <div class="win-body"></div>`;
  $('#windows').appendChild(el);
  setTimeout(() => el.classList.remove('opening'), 300);

  const w = {
    key, el, app: def.app, body: el.querySelector('.win-body'), payload: def.payload,
    setSub: t => (el.querySelector('.win-title small').textContent = t),
    setTitle: t => (el.querySelector('.win-title strong').textContent = t),
    close: () => close(key),
    refresh: def.refresh ? () => def.refresh(w) : null,
    foot: null
  };
  wins.set(key, w);

  el.querySelector('[data-close]').onclick = () => close(key);
  el.querySelector('[data-min]').onclick = () => { el.hidden = true; el.classList.remove('active'); syncDock(); };
  el.querySelector('[data-max]').onclick = () => toggleMax(w);
  el.querySelector('.win-head').addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleMax(w); });
  el.addEventListener('pointerdown', () => focus(w), true);
  drag(w);
  focus(w);
  def.render?.(w);
  return w;
}

export function close(key) {
  const w = wins.get(key);
  if (!w) return;
  w.onClose?.();
  w.el.remove();
  wins.delete(key);
  syncDock();
}

function toggleMax(w) {
  w.el.classList.toggle('max');
  w.el.querySelector('[data-max]').innerHTML = icon(w.el.classList.contains('max') ? 'restore' : 'maximise');
}

export function focus(w) {
  wins.forEach(x => x.el.classList.remove('active'));
  w.el.classList.add('active');
  w.el.style.zIndex = ++z;
  syncDock();
}

function drag(w) {
  const head = w.el.querySelector('.win-head');
  let sx, sy, ox, oy, moving = false;
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || w.el.classList.contains('max') || innerWidth <= 820) return;
    moving = true; sx = e.clientX; sy = e.clientY; ox = w.el.offsetLeft; oy = w.el.offsetTop;
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', e => {
    if (!moving) return;
    const r = $('#stage').getBoundingClientRect();
    w.el.style.left = Math.max(-w.el.offsetWidth + 120, Math.min(r.width - 120, ox + e.clientX - sx)) + 'px';
    w.el.style.top = Math.max(0, Math.min(r.height - 60, oy + e.clientY - sy)) + 'px';
  });
  head.addEventListener('pointerup', () => (moving = false));
}

let dockSync = () => {};
export const setDockSync = fn => (dockSync = fn);
export const syncDock = () => dockSync();

export function refreshApp(app) {
  wins.forEach(w => { if (w.app === app && w.refresh) w.refresh(); });
}
export function refreshAll() { wins.forEach(w => w.refresh && w.refresh()); }
