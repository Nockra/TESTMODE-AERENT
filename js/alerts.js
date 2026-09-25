// Position alerts. Runs in the browser while the tab is open: no server, no account, no email needed.
// Warns when a rental you are in gets close to liquidation, is due soon, or has become claimable.
import { S, emit } from './state.js';
import { load, save, sameAddr, remaining } from './util.js';
import { toast } from './ui.js';

const KEY = 'aerent.alerts.v1';
let prefs = load(KEY, { enabled: true, desktop: false, hf: 1.15, seen: {} });

export const alertPrefs = () => ({ ...prefs });
export function setAlertPrefs(patch) {
  prefs = { ...prefs, ...patch };
  save(KEY, prefs);
  emit('alerts');
}

export async function enableDesktopAlerts() {
  if (!('Notification' in window)) return false;
  const res = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  setAlertPrefs({ desktop: res === 'granted', enabled: true });
  return res === 'granted';
}

function fire(key, title, body) {
  // one notice per position per state change, until the state clears
  if (prefs.seen[key]) return;
  prefs.seen[key] = Date.now();
  save(KEY, prefs);
  toast(title, body, key.startsWith('hf') ? 'bad' : 'info');
  if (prefs.desktop && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/assets/aerent-icon-192.png', tag: key }); } catch {}
  }
}

/** Called after every data refresh. */
export function checkAlerts() {
  if (!prefs.enabled || !S.account) return;
  const now = Date.now() / 1000;
  const live = new Set();
  for (const v of S.vms) {
    const renting = sameAddr(v.renter, S.account);
    const lending = sameAddr(v.lender, S.account);
    if (!renting && !lending) continue;

    if (renting && v.status === 'rented' && v.oracle && v.hf != null && v.hf < prefs.hf) {
      const key = `hf:${v.id}:${v.hf < 1 ? 'liq' : 'near'}`;
      live.add(key);
      fire(key, v.hf < 1 ? `${v.t.symbol} position can be liquidated` : `${v.t.symbol} position is close to liquidation`,
        `Health factor ${v.hf.toFixed(2)}. Add collateral or return the asset to close it safely.`);
    }
    if (renting && v.status === 'rented' && !v.overdue && v.dueAt - now < 86400) {
      const key = `due:${v.id}`;
      live.add(key);
      fire(key, `${v.t.symbol} rental is due soon`, `${remaining(v.dueAt)}. Return it before the grace period ends to keep your collateral.`);
    }
    if (renting && v.overdue && !v.defaultable) {
      const key = `grace:${v.id}`;
      live.add(key);
      fire(key, `${v.t.symbol} rental is overdue`, 'You are inside the grace period. Return it now to get your collateral back.');
    }
    if (lending && v.defaultable) {
      const key = `claim:${v.id}`;
      live.add(key);
      fire(key, `Collateral claimable on ${v.t.symbol}`, 'The grace period has ended. You can claim the collateral from Positions.');
    }
  }
  // forget anything that resolved, so it can alert again if it comes back
  let changed = false;
  for (const k of Object.keys(prefs.seen)) if (!live.has(k)) { delete prefs.seen[k]; changed = true; }
  if (changed) save(KEY, prefs);
}
