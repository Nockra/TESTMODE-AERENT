import { S } from '../state.js';
import { icon } from '../icons.js';
import { esc, usd, short, sameAddr } from '../util.js';
import { empty, note, avatar, explorerLink } from '../ui.js';
import { fmt } from '../data.js';

/** Built from the same listing data the market uses, so it needs no extra service. */
function tally() {
  const lenders = new Map(), renters = new Map();
  const bump = (map, addr, fn) => {
    const k = addr.toLowerCase();
    if (/^0x0+$/.test(k)) return;
    const row = map.get(k) || { address: addr, fees: 0, rentals: 0, listed: 0, active: 0, volume: 0 };
    fn(row);
    map.set(k, row);
  };
  for (const v of S.vms) {
    bump(lenders, v.lender, r => {
      r.listed++;
      if (v.startedAt) { r.rentals++; r.fees += v.feeUsd || 0; r.volume += v.value || 0; }
      if (v.status === 'rented') r.active++;
    });
    if (v.startedAt && v.renter) bump(renters, v.renter, r => {
      r.rentals++;
      r.fees += v.feeUsd || 0;
      r.volume += v.value || 0;
      if (v.status === 'rented') r.active++;
    });
  }
  const sort = m => [...m.values()].sort((a, b) => b.fees - a.fees || b.rentals - a.rentals || b.listed - a.listed);
  return { lenders: sort(lenders), renters: sort(renters) };
}

export function renderLeaderboard(w) {
  const st = w.state ||= { tab: 'lenders' };
  const { lenders, renters } = tally();
  const rows = st.tab === 'lenders' ? lenders : renters;
  const totalFees = lenders.reduce((s, r) => s + r.fees, 0);
  const totalVolume = lenders.reduce((s, r) => s + r.volume, 0);
  const completed = S.vms.filter(v => ['returned', 'settled', 'defaulted', 'liquidated'].includes(v.status)).length;

  w.body.innerHTML = `
    <div class="stats">
      <div class="stat"><small>Fees paid to lenders</small><strong>${usd(totalFees) || '$0'}</strong></div>
      <div class="stat"><small>Value rented to date</small><strong>${usd(totalVolume, true) || '$0'}</strong></div>
      <div class="stat"><small>Rentals completed</small><strong>${completed}</strong></div>
      <div class="stat"><small>Active now</small><strong>${S.vms.filter(v => v.status === 'rented').length}</strong></div>
    </div>
    <div class="toolbar"><div class="seg" role="group" aria-label="Leaderboard">
      <button aria-pressed="${st.tab === 'lenders'}" data-lb="lenders">Top lenders</button>
      <button aria-pressed="${st.tab === 'renters'}" data-lb="renters">Most active renters</button>
    </div></div>
    ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th style="width:56px">#</th><th>Address</th><th class="num">${st.tab === 'lenders' ? 'Fees earned' : 'Fees paid'}</th><th class="num">Rentals</th><th class="num">${st.tab === 'lenders' ? 'Listings' : 'Active'}</th><th class="num">Value rented</th></tr></thead><tbody>
      ${rows.slice(0, 25).map((r, i) => {
        const me = S.account && sameAddr(r.address, S.account);
        return `<tr${me ? ' style="background:rgba(184,251,75,.18)"' : ''}>
          <td><span class="badge ${i < 3 ? 'b-lime' : 'b-plain'}">${i + 1}</span></td>
          <td><div class="asset"><img class="avatar" src="${avatar(r.address)}" alt="" width="34" height="34" style="border-radius:50%"><div><strong>${esc(short(r.address))}${me ? ' <span class="badge b-plain">You</span>' : ''}</strong><small>${explorerLink('address', r.address, 'View on explorer')}</small></div></div></td>
          <td class="num">${usd(r.fees) || '$0'}</td>
          <td class="num">${r.rentals}</td>
          <td class="num">${st.tab === 'lenders' ? r.listed : r.active}</td>
          <td class="num">${usd(r.volume, true) || '$0'}</td></tr>`;
      }).join('')}
    </tbody></table></div>` : empty('Nothing to rank yet', 'Once assets are listed and rented, the people doing it show up here.', '<button class="btn btn-lime" data-open="list">List an asset</button>')}
    <p class="muted small" style="margin-top:12px">Read from the contract, counting rentals that have started. Fees are valued at current prices, so figures move with the market.</p>`;
  w.body.querySelectorAll('[data-lb]').forEach(b => b.onclick = () => { st.tab = b.dataset.lb; renderLeaderboard(w); });
}
