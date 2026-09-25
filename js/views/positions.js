import { S } from '../state.js';
import { icon } from '../icons.js';
import { esc, usd, duration, remaining, dateTime, parseUnits, sameAddr, short } from '../util.js';
import { tokenLogo } from '../tokens.js';
import { statusBadge, empty, hfView, note, modal, explorerLink } from '../ui.js';
import { fmt, amountLabel, role } from '../data.js';
import { assetCell } from './market.js';
import { runPlan } from '../tx.js';
import { connect } from '../walletflow.js';

export function renderPositions(w, api) {
  const st = w.state ||= { tab: 'renting' };
  const b = w.body;
  const tabs = [['renting', 'Renting'], ['lending', 'Lending'], ['watch', 'Liquidation watch']];
  const head = `<div class="toolbar"><div class="seg" role="group" aria-label="View">${tabs.map(([k, l]) => `<button aria-pressed="${st.tab === k}" data-tab="${k}">${l}</button>`).join('')}</div><span class="spacer"></span><button class="btn btn-glass" data-reload>${icon('refresh')}Refresh</button></div>`;

  if (st.tab === 'watch') { b.innerHTML = head + watch() + previewTools(); return; }
  if (!S.account) {
    b.innerHTML = head + empty('Connect your wallet', 'Positions are matched to the connected address.', '<button class="btn btn-lime" data-connect>Connect wallet</button>');
    return;
  }
  const mine = S.vms.filter(v => (st.tab === 'renting' ? sameAddr(v.renter, S.account) : sameAddr(v.lender, S.account)));
  const active = mine.filter(v => v.status === 'rented' || v.status === 'open');
  const closed = mine.filter(v => !active.includes(v));
  const atRisk = active.filter(v => v.hf < 1.15).length;
  const collUsd = active.filter(v => v.status === 'rented').reduce((s, v) => s + (v.collUsd || 0), 0);
  const stats = st.tab === 'renting'
    ? `<div class="stats"><div class="stat"><small>Active rentals</small><strong>${active.length}</strong></div><div class="stat"><small>Collateral posted</small><strong>${usd(collUsd, true) || '$0'}</strong></div><div class="stat"><small>Near liquidation</small><strong>${atRisk}</strong></div><div class="stat"><small>Closed</small><strong>${closed.length}</strong></div></div>`
    : `<div class="stats"><div class="stat"><small>Open listings</small><strong>${active.filter(v => v.status === 'open').length}</strong></div><div class="stat"><small>Rented out</small><strong>${active.filter(v => v.status === 'rented').length}</strong></div><div class="stat"><small>Fees earned</small><strong>${usd(mine.filter(v => v.startedAt).reduce((s, v) => s + (v.feeUsd || 0), 0)) || '$0'}</strong></div><div class="stat"><small>Closed</small><strong>${closed.length}</strong></div></div>`;
  const myOffers = S.offers.filter(o => o.status === 'open' && sameAddr(o.renter, S.account));
  const offersBlock = st.tab === 'renting' && myOffers.length ? `
    <div class="panel panel-pad stack" style="margin-bottom:14px">
      <div class="row"><strong>Your open requests</strong><span class="spacer"></span><span class="badge b-plain">${myOffers.length}</span></div>
      ${myOffers.map(o => `<div class="row">${tokenLogo(o.t, 30)}
        <div class="cell2"><strong>${esc(fmt(o.amountNum))} ${esc(o.t.symbol)}</strong><small>${esc(fmt(o.collNum))} ${esc(o.c.symbol)} collateral, ${esc(fmt(o.feeNum))} fee, ${duration(o.duration)}</small></div>
        <span class="spacer"></span><span class="small strong muted">${o.expired ? 'Expired' : remaining(o.expiresAt)}</span>
        <button class="btn btn-glass btn-sm" data-cancel-offer="${o.id}">Cancel</button></div>`).join('')}
    </div>` : '';
  b.innerHTML = head + stats + offersBlock + (mine.length ? table([...active, ...closed], st.tab) : empty(st.tab === 'renting' ? 'No rentals yet' : 'No listings yet', st.tab === 'renting' ? 'Rent an asset from the market to see it here.' : 'List an asset to start earning rental fees.', `<button class="btn btn-lime" data-open="${st.tab === 'renting' ? 'market' : 'list'}">${st.tab === 'renting' ? 'Browse the market' : 'List an asset'}</button>`)) + previewTools();
}

function table(rows, tab) {
  return `<div class="table-wrap"><table class="t"><thead><tr><th>Asset</th><th>${tab === 'renting' ? 'Lender' : 'Renter'}</th><th class="num">Collateral</th><th>Health</th><th class="num">Term</th><th>Status</th><th class="act"></th></tr></thead><tbody>
  ${rows.map(v => {
    const cp = tab === 'renting' ? v.lender : v.renter;
    const acts = actions(v);
    const st = v.status === 'rented' && v.defaultable ? statusBadge('overdue', 'Claimable') : v.status === 'rented' && v.overdue ? statusBadge('overdue') : v.status === 'rented' && v.hf < 1 ? statusBadge('risk') : statusBadge(v.status);
    return `<tr><td>${assetCell(v, amountLabel(v))}</td>
      <td>${/^0x0+$/.test(cp) ? '<span class="muted">Not rented</span>' : explorerLink('address', cp, short(cp))}</td>
      <td class="num"><div class="cell2"><span class="row" style="justify-content:flex-end;gap:6px">${tokenLogo(v.c, 18)}${esc(fmt(v.collNum))}</span><small>${v.collUsd != null ? usd(v.collUsd) : esc(v.c.symbol)}</small></div></td>
      <td style="min-width:130px">${v.status === 'rented' ? (v.oracle ? hfView(v.hf, 'bar') : '<span class="muted small strong">Fixed collateral</span>') : '<span class="muted small strong">Not active</span>'}${v.liqPrice ? `<small class="muted strong" style="display:block;margin-top:4px">Liquidates above ${usd(v.liqPrice)}</small>` : ''}</td>
      <td class="num"><div class="cell2"><span>${v.status === 'rented' ? remaining(v.dueAt) : duration(v.duration)}</span><small>${v.status === 'rented' ? `Due ${dateTime(v.dueAt)}` : ''}</small></div></td>
      <td>${st}</td><td class="act"><div class="row" style="justify-content:flex-end">${acts}</div></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function actions(v) {
  const r = role(v);
  const out = [];
  const now = Date.now() / 1000;
  if (r === 'renter' && v.status === 'rented') {
    if (v.kind === 'fungible') out.push(`<button class="btn btn-glass btn-sm" data-add="${v.id}">Add collateral</button>`);
    out.push(`<button class="btn btn-lime btn-sm" data-act="returnRental" data-id="${v.id}">Return</button>`);
  }
  if (r === 'lender' && v.status === 'open') out.push(`<button class="btn btn-danger btn-sm" data-act="cancel" data-id="${v.id}">Cancel</button>`);
  if (r === 'lender' && v.defaultable) out.push(`<button class="btn btn-ink btn-sm" data-act="claimDefault" data-id="${v.id}">Claim collateral</button>`);
  if (v.kind === 'nft' && v.status === 'rented' && now > v.dueAt) out.push(`<button class="btn btn-glass btn-sm" data-act="settle" data-id="${v.id}">Settle</button>`);
  if (v.oracle && v.status === 'rented' && v.hf < 1 && r !== 'renter') out.push(`<button class="btn btn-ink btn-sm" data-act="liquidate" data-id="${v.id}">Liquidate</button>`);
  if (r === 'lender' && v.status === 'rented' && v.overdue && !v.defaultable && v.kind === 'fungible') out.push(`<span class="small muted strong">Claimable ${remaining(v.dueAt + v.grace).replace(' left', '')}</span>`);
  return out.join('');
}

function watch() {
  const rows = S.vms.filter(v => v.status === 'rented' && v.oracle).sort((a, b) => (a.hf ?? 9) - (b.hf ?? 9));
  const expiring = S.vms.filter(v => v.status === 'rented' && v.kind === 'nft' && Date.now() / 1000 > v.dueAt);
  return `${note('info', 'Anyone can liquidate an oracle-priced rental once its health factor drops below 1.00. You deliver the rented tokens to the lender and receive collateral worth their value plus the liquidation bonus. Expired NFT rentals can be settled by anyone.')}
    <div style="height:12px"></div>
    ${rows.length || expiring.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Asset</th><th class="num">Owed</th><th class="num">Collateral</th><th>Health</th><th class="act"></th></tr></thead><tbody>
      ${[...rows, ...expiring].map(v => `<tr><td>${assetCell(v)}</td><td class="num"><div class="cell2"><span>${esc(amountLabel(v))}</span><small>${v.value != null ? usd(v.value) : ''}</small></div></td>
        <td class="num"><div class="cell2"><span>${esc(fmt(v.collNum))} ${esc(v.c.symbol)}</span><small>${v.collUsd != null ? usd(v.collUsd) : ''}</small></div></td>
        <td style="min-width:160px">${v.oracle ? hfView(v.hf, 'bar') : '<span class="muted small strong">Expired</span>'}</td>
        <td class="act">${v.kind === 'nft' ? `<button class="btn btn-glass btn-sm" data-act="settle" data-id="${v.id}">Settle</button>` : v.hf < 1 ? `<button class="btn btn-ink btn-sm" data-act="liquidate" data-id="${v.id}">Liquidate</button>` : '<span class="small muted strong">Healthy</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : empty('Nothing to watch', 'There are no active oracle-priced rentals right now.')}`;
}

function previewTools() {
  if (S.src.mode !== 'preview') return '';
  const shift = S.src.priceShift();
  const syms = [...new Set(S.vms.filter(v => v.status === 'rented' && v.oracle).map(v => v.t.symbol))];
  return `<div class="panel panel-pad stack" style="margin-top:16px">
    <div class="row"><strong>Preview controls</strong><span class="spacer"></span><span class="badge b-plain">Only in preview</span></div>
    <p class="soft small" style="margin:0">Move a reference price or skip time to test liquidations, overdue rentals and settlement without waiting.</p>
    ${syms.length ? syms.map(s => `<div class="row"><span class="strong" style="width:70px">${esc(s)}</span><input type="range" min="-50" max="80" step="5" value="${shift[s] || 0}" data-shift="${esc(s)}" style="flex:1" aria-label="${esc(s)} price change"><span class="strong" style="width:56px;text-align:right">${shift[s] > 0 ? '+' : ''}${shift[s] || 0}%</span></div>`).join('') : '<span class="muted small strong">Rent an oracle-priced asset to move its price.</span>'}
    <div class="row wrap"><button class="btn btn-glass btn-sm" data-warp="86400">Skip 1 day</button><button class="btn btn-glass btn-sm" data-warp="604800">Skip 7 days</button><button class="btn btn-glass btn-sm" data-warp="2592000">Skip 30 days</button></div>
  </div>`;
}

export function bindPositions(w, api) {
  w.body.addEventListener('click', async e => {
    const t = e.target.closest('[data-tab]'); if (t) { w.state.tab = t.dataset.tab; renderPositions(w, api); return; }
    if (e.target.closest('[data-reload]')) { api.reload(); return; }
    if (e.target.closest('[data-connect]')) { connect(); return; }
    const co = e.target.closest('[data-cancel-offer]'); if (co) { api.cancelOffer(Number(co.dataset.cancelOffer)); return; }
    const wp = e.target.closest('[data-warp]'); if (wp) { S.src.warp(Number(wp.dataset.warp)); api.reload(); return; }
    const add = e.target.closest('[data-add]'); if (add) { addCollateral(S.vms.find(v => v.id === Number(add.dataset.add)), api); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (!S.account && !(await connect())) return;
    const v = S.vms.find(x => x.id === Number(a.dataset.id));
    confirmAction(a.dataset.act, v, api);
  });
  w.body.addEventListener('change', e => {
    const s = e.target.closest('[data-shift]');
    if (s) { S.src.setPriceShift(s.dataset.shift, Number(s.value)); api.reload(); }
  });
}

const COPY = {
  returnRental: v => ({ title: `Return ${amountLabel(v)}`, rows: [['You send back', amountLabel(v)], ['You get back', `${fmt(v.collNum)} ${v.c.symbol}`], ['Fee refund', 'None, the fee is fixed upfront']] }),
  cancel: v => ({ title: `Cancel ${amountLabel(v)} listing`, rows: [['Returned to you', amountLabel(v)], ['Listing', `#${v.id} closes`]] }),
  claimDefault: v => ({ title: 'Claim collateral', rows: [['You receive', `${fmt(v.collNum)} ${v.c.symbol}`], ['Reason', 'Not returned by the end of the grace period'], ['Rented asset', 'Stays with the renter']] }),
  settle: v => ({ title: `Settle ${amountLabel(v)}`, rows: [['NFT goes to', 'The lender'], ['Collateral goes to', 'The renter'], ['User rights', 'Already expired']] }),
  liquidate: v => {
    const bonus = v.liqBonusBps / 10000;
    const seize = Math.min(v.collNum, v.value && v.cpx ? (v.value * (1 + bonus)) / v.cpx : v.collNum);
    return { title: `Liquidate ${amountLabel(v)}`, rows: [['You deliver to lender', amountLabel(v)], ['You receive about', `${fmt(seize)} ${v.c.symbol}`], ['Health factor', v.hf.toFixed(3)], ['Returned to renter', `${fmt(Math.max(0, v.collNum - seize))} ${v.c.symbol}`]] };
  }
};

function confirmAction(act, v, api) {
  const c = COPY[act](v);
  modal(c.title, `<div class="sum">${c.rows.map(([k, x]) => `<div><span>${esc(k)}</span><strong>${esc(x)}</strong></div>`).join('')}</div><div data-steps style="margin:14px 0"></div><button class="btn btn-lime btn-lg btn-block" data-go>Continue</button>`, (el, close) => {
    el.querySelector('[data-go]').onclick = async e => {
      e.currentTarget.disabled = true;
      const steps = S.src.plans[act]({ listing: v, symbol: v.t.symbol, account: S.account });
      const ok = await runPlan(el.querySelector('[data-steps]'), steps, { title: c.title });
      if (ok) { await api.reload(); setTimeout(close, 700); } else e.currentTarget.disabled = false;
    };
  });
}

function addCollateral(v, api) {
  modal('Add collateral', `<p class="soft" style="margin:0 0 12px">Top up ${esc(v.c.symbol)} on your ${esc(amountLabel(v))} rental. Current health factor ${v.hf === Infinity ? 'is not tracked' : v.hf.toFixed(2)}.</p>
    <div class="field"><label for="addc">Amount</label><div class="input-affix"><input class="in" id="addc" inputmode="decimal" placeholder="0.0"><span class="affix">${tokenLogo(v.c, 20)}${esc(v.c.symbol)}</span></div><span class="hint" data-after></span></div>
    <div data-steps style="margin:14px 0"></div><button class="btn btn-lime btn-lg btn-block" data-go>Add collateral</button>`, (el, close) => {
    const input = el.querySelector('#addc');
    input.oninput = () => {
      const n = Number(input.value) || 0;
      if (v.oracle && v.value && v.cpx) el.querySelector('[data-after]').textContent = `New health factor ${(((v.collNum + n) * v.cpx * 10000) / (v.value * v.liqRatioBps)).toFixed(2)}`;
    };
    el.querySelector('[data-go]').onclick = async e => {
      let amount;
      try { amount = parseUnits(input.value, v.c.decimals); if (!amount) throw new Error('Enter an amount.'); } catch (err) { el.querySelector('[data-after]').textContent = err.message; return; }
      e.currentTarget.disabled = true;
      const ok = await runPlan(el.querySelector('[data-steps]'), S.src.plans.addCollateral({ listing: v, amount, collateralSymbol: v.c.symbol, account: S.account }), { title: 'Add collateral' });
      if (ok) { await api.reload(); setTimeout(close, 700); } else e.currentTarget.disabled = false;
    };
  });
}
