// Loads listings, resolves token metadata and prices, and builds view models the windows render from.
import { S, emit } from './state.js';
import { toNumber, sameAddr } from './util.js';

const prices = new Map();   // address -> { usd, error }
const configs = new Map();  // address -> asset config

export const priceOf = a => prices.get(String(a).toLowerCase())?.usd ?? null;
export const priceInfo = a => prices.get(String(a).toLowerCase()) || { usd: null };
export const configOf = a => configs.get(String(a).toLowerCase());
export const tokenOf = a => S.reg.get(a) || { address: a, symbol: '?', name: 'Unknown token', decimals: 18, class: 'none', logo: '' };

export async function ensureToken(address, nft = false) {
  const k = address.toLowerCase();
  if (!configs.has(k)) {
    try { configs.set(k, await S.src.assetConfig(address)); } catch { configs.set(k, { class: 'none' }); }
  }
  const cfg = configs.get(k);
  const existing = S.reg.get(address);
  if (existing) { if (existing.class === 'none' && cfg.class !== 'none') existing.class = cfg.class; return existing; }
  return S.reg.meta(address, { nft: nft || cfg.class === 'nft', allowlisted: cfg.class !== 'none', class: cfg.class });
}

export async function refreshPrice(address) {
  prices.set(address.toLowerCase(), await S.src.price(address));
  return priceOf(address);
}

export async function loadAll() {
  try {
    const [listings, offers, paused, fee, grace] = await Promise.all([
      S.src.listings(), S.src.offers ? S.src.offers().catch(() => []) : [], S.src.paused(), S.src.protocolFeeBps(), S.src.gracePeriod()
    ]);
    S.paused = paused; S.protocolFeeBps = fee; S.grace = grace;
    const addrs = new Map();
    for (const l of listings) { addrs.set(l.asset.toLowerCase(), l.kind === 'nft'); addrs.set(l.collateralToken.toLowerCase(), false); }
    for (const o of offers) { addrs.set(o.asset.toLowerCase(), false); addrs.set(o.collateralToken.toLowerCase(), false); }
    await Promise.all([...addrs].map(([a, nft]) => ensureToken(a, nft)));
    await Promise.all([...addrs].filter(([, nft]) => !nft).map(([a]) => refreshPrice(a)));
    S.listings = listings;
    S.vms = await Promise.all(listings.map(buildVm));
    S.offers = offers.map(buildOfferVm);
    S.loaded = true; S.loadError = ''; S.rpcOk = true;
  } catch (err) {
    console.error(err);
    S.loadError = 'The market could not be loaded. Check your connection or switch RPC in Settings.';
    S.rpcOk = false;
  }
  emit('data');
}

export async function buildVm(l) {
  const t = tokenOf(l.asset), c = tokenOf(l.collateralToken);
  const px = l.kind === 'nft' ? null : priceOf(l.asset);
  const cpx = priceOf(l.collateralToken);
  const amountNum = l.kind === 'nft' ? 1 : toNumber(l.amount, t.decimals);
  const collNum = toNumber(l.collateral, c.decimals);
  const feeNum = toNumber(l.fee, c.decimals);
  const value = px != null ? amountNum * px : null;
  const feeUsd = cpx != null ? feeNum * cpx : null;
  const collUsd = cpx != null ? collNum * cpx : null;
  const apr = value && feeUsd != null ? (feeUsd / value) * (365 * 86400 / l.duration) * 100 : null;
  let hf = Infinity;
  if (l.status === 'rented' && l.oracle) hf = await S.src.health(l);
  const now = Date.now() / 1000;
  const overdue = l.status === 'rented' && now > l.dueAt;
  const defaultable = l.status === 'rented' && l.kind === 'fungible' && now > l.dueAt + l.grace;
  const collRatio = value && collUsd != null ? (collUsd / value) * 100 : null;
  const feeRate = value && feeUsd != null ? (feeUsd / value) * 100 : null;
  const liqPrice = l.status === 'rented' && l.oracle && collUsd != null && l.liqRatioBps
    ? (collUsd * 10000) / (amountNum * l.liqRatioBps) : null;
  return { ...l, t, c, px, cpx, amountNum, collNum, feeNum, value, feeUsd, collUsd, apr, collRatio, feeRate, hf, overdue, defaultable, liqPrice };
}

/** USD value the marketplace is currently holding: assets waiting in open listings plus collateral on live rentals. */
export function escrowValue(vms = S.vms) {
  return vms.reduce((sum, v) => {
    if (v.status === 'open' && v.kind === 'fungible') return sum + (v.value || 0);
    if (v.status === 'rented') return sum + (v.collUsd || 0);
    return sum;
  }, 0);
}

/** View model for a renter's standing request. */
export function buildOfferVm(o) {
  const t = tokenOf(o.asset), c = tokenOf(o.collateralToken);
  const px = priceOf(o.asset), cpx = priceOf(o.collateralToken);
  const amountNum = toNumber(o.amount, t.decimals);
  const collNum = toNumber(o.collateral, c.decimals);
  const feeNum = toNumber(o.fee, c.decimals);
  const value = px != null ? amountNum * px : null;
  const feeUsd = cpx != null ? feeNum * cpx : null;
  const collUsd = cpx != null ? collNum * cpx : null;
  const apr = value && feeUsd != null ? (feeUsd / value) * (365 * 86400 / o.duration) * 100 : null;
  const expired = Date.now() / 1000 > o.expiresAt;
  const coverage = value && collUsd ? collUsd / value : null;
  const feeRate = value && feeUsd != null ? (feeUsd / value) * 100 : null;
  return { ...o, t, c, px, cpx, amountNum, collNum, feeNum, value, feeUsd, collUsd, apr, feeRate, expired, coverage };
}

export function role(vm) {
  if (!S.account) return null;
  if (sameAddr(vm.lender, S.account)) return 'lender';
  if (sameAddr(vm.renter, S.account)) return 'renter';
  return null;
}

export function amountLabel(vm) {
  if (vm.kind === 'nft') return `${vm.t.symbol} #${vm.amount}`;
  return `${fmt(vm.amountNum)} ${vm.t.symbol}`;
}

export function fmt(n) {
  if (n == null) return '';
  const abs = Math.abs(n);
  const max = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: max }).format(n);
}
