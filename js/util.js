export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const isAddress = v => /^0x[a-fA-F0-9]{40}$/.test(String(v || '').trim());
export const sameAddr = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const short = (a, h = 6, t = 4) => (a ? `${a.slice(0, h)}...${a.slice(-t)}` : '');

export function parseUnits(value, decimals) {
  const s = String(value ?? '').trim().replace(/,/g, '');
  if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') throw new Error('Enter a valid amount.');
  const [w = '0', f = ''] = s.split('.');
  if (f.length > decimals) throw new Error(`Use at most ${decimals} decimal places.`);
  return BigInt(w || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

export function formatUnits(value, decimals, maxFrac = 4) {
  let n = BigInt(value ?? 0);
  const neg = n < 0n; if (neg) n = -n;
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  let frac = (n % base).toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '');
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${w}${frac ? '.' + frac : ''}`;
}

/** bigint scaled by 1e18 to JS number */
export const fromWad = v => Number(BigInt(v)) / 1e18;
export const toNumber = (raw, decimals) => Number(formatUnits(raw, decimals, 8).replace(/,/g, ''));

export function usd(n, compact = false) {
  if (n == null || !Number.isFinite(n)) return '';
  if (n === 0) return '$0';
  const opts = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: n >= 100 || compact ? 0 : 2 };
  if (compact && n >= 100000) Object.assign(opts, { notation: 'compact', maximumFractionDigits: 1 });
  return new Intl.NumberFormat('en-US', opts).format(n);
}

export function num(n, max = 2) {
  if (n == null || !Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: max }).format(n);
}

export function duration(s) {
  s = Number(s || 0);
  if (s >= 86400 && s % 86400 === 0) return `${s / 86400} day${s === 86400 ? '' : 's'}`;
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600} hour${s === 3600 ? '' : 's'}`;
  return `${Math.round(s / 3600)} hours`;
}

export function remaining(unix) {
  const ms = Number(unix) * 1000 - Date.now();
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000), h = Math.floor((abs % 86400000) / 3600000), m = Math.floor((abs % 3600000) / 60000);
  const txt = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  return ms >= 0 ? `${txt} left` : `${txt} overdue`;
}

export function dateTime(unix) {
  return new Date(Number(unix) * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ago(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 30) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60) || 1} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key), revive); return v ?? fallback; } catch { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? { $big: v.toString() } : v))); } catch {}
}
function revive(_, v) { return v && typeof v === 'object' && '$big' in v ? BigInt(v.$big) : v; }

export const sleep = ms => new Promise(r => setTimeout(r, ms));
