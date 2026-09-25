import { S, on } from '../state.js';
import { icon } from '../icons.js';
import { esc, usd, duration, dateTime, remaining, parseUnits, formatUnits, toNumber, sameAddr, short } from '../util.js';
import { tokenLogo, CLASS_LABEL } from '../tokens.js';
import { statusBadge, empty, skeleton, hfView, note, explorerLink } from '../ui.js';
import { fmt, amountLabel, role, priceOf, escrowValue } from '../data.js';
import { runPlan } from '../tx.js';
import { connect } from '../walletflow.js';

const view = { tab: 'listings', filter: 'all', q: '', sort: 'value', dir: 'desc', showClosed: false };
const FILTERS = [['all', 'All'], ['rwa', 'Stock Tokens'], ['stablecoin', 'Stablecoins'], ['crypto', 'Crypto'], ['experimental', 'Experimental'], ['nft', 'NFTs']];

export function setMarketQuery(q) { view.q = q; view.filter = 'all'; view.tab = 'listings'; }
export function setMarketTab(t) { view.tab = t; }

export function assetCell(vm, sub) {
  const verified = vm.t.verified ? `<span class="verified" title="${vm.t.verified === 'robinhood' ? 'Canonical Robinhood Stock Token' : 'On the AERENT allowlist'}">${icon('check')}</span>` : '';
  return `<div class="asset">${vm.kind === 'nft' ? tokenLogo(vm.t, 38).replace('class="tlogo', 'class="tlogo nft') : tokenLogo(vm.t, 38)}<div><strong>${esc(vm.t.symbol)}${verified}</strong><small>${esc(sub ?? vm.t.name)}</small></div></div>`;
}

function typeBadge(vm) {
  if (vm.kind === 'nft') return '<span class="badge b-plain">Usage rights</span>';
  return vm.oracle ? '<span class="badge b-plain">Oracle priced</span>' : '<span class="badge b-warn">Fixed collateral</span>';
}

export function renderMarket(w) {
  const b = w.body;
  if (!S.loaded && !S.loadError) { b.innerHTML = skeleton(6); return; }
  if (S.loadError) { b.innerHTML = empty('Market unavailable', S.loadError, '<button class="btn btn-glass" data-reload>Try again</button>'); return; }

  const all = S.vms;
  const open = all.filter(v => v.status === 'open');
  const rented = all.filter(v => v.status === 'rented');
  const availableUsd = open.reduce((s, v) => s + (v.value || 0), 0);
  const q = view.q.trim().toLowerCase();
  let rows = all.filter(v => (view.showClosed ? true : v.status === 'open' || v.status === 'rented'))
    .filter(v => view.filter === 'all' || (v.t.class || 'none') === view.filter)
    .filter(v => !q || `${v.t.symbol} ${v.t.name} ${v.asset} ${v.c.symbol}`.toLowerCase().includes(q));
  const key = { value: v => v.value ?? -1, apr: v => v.apr ?? -1, term: v => v.duration, id: v => v.id }[view.sort];
  rows.sort((a, c) => (view.dir === 'asc' ? 1 : -1) * (key(a) - key(c)) || (a.status === 'open' ? -1 : 1));

  const th = (k, label, cls = '') => `<th class="${cls}"><button class="sort" data-sort="${k}" ${view.sort === k ? `data-dir="${view.dir}"` : ''}>${label}${icon('chevron')}</button></th>`;

  b.innerHTML = `
    ${S.paused ? note('warn', 'New listings and rentals are paused by the guardian. Returns, settlements and liquidations still work.') + '<div style="height:12px"></div>' : ''}
    <div class="stats">
      <div class="stat"><small>Open listings</small><strong>${open.length}</strong></div>
      <div class="stat"><small>Available to rent</small><strong>${usd(availableUsd, true) || '$0'}</strong></div>
      <div class="stat"><small>Value in escrow</small><strong>${usd(escrowValue(), true) || '$0'}</strong></div>
      <div class="stat"><small>Active rentals</small><strong>${rented.length}</strong></div>
      <div class="stat"><small>Protocol fee</small><strong>${(S.protocolFeeBps / 100).toFixed(S.protocolFeeBps % 100 ? 1 : 0)}%</strong></div>
    </div>
    <div class="trust-strip">
      <span>${icon('lock')}Approvals are for the exact amount shown, never unlimited</span>
      <span>${icon('shield')}Assets sit in the contract, not with the other side</span>
      <span>${icon('check')}${S.net.explorerUrl && S.src.mode !== 'preview' ? `<a href="${esc(S.net.explorerUrl)}/address/${esc(S.src.address)}" target="_blank" rel="noopener noreferrer">Contract verified onchain</a>` : 'Contract verified onchain'}</span>
    </div>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Market view">
        <button aria-pressed="${view.tab === 'listings'}" data-mtab="listings">Listings ${open.length}</button>
        <button aria-pressed="${view.tab === 'offers'}" data-mtab="offers">Requests ${S.offers.filter(o => o.status === 'open' && !o.expired).length}</button>
      </div>
      <span class="spacer"></span>
      <button class="btn btn-glass btn-sm" data-open="list">${icon('plus')}${view.tab === 'offers' ? 'Post a request' : 'List an asset'}</button>
    </div>
    ${view.tab === 'offers' ? offersTable() : `
    <div class="toolbar">
      <label class="search"><span class="sr">Search</span>${icon('search')}<input class="in" data-q placeholder="Search by ticker, name or contract" value="${esc(view.q)}"></label>
      <label class="row small strong soft" style="gap:8px"><input type="checkbox" data-closed ${view.showClosed ? 'checked' : ''}> Show closed</label>
      <button class="btn btn-glass" data-reload>${icon('refresh')}Refresh</button>
    </div>
    <div class="toolbar"><div class="seg" role="group" aria-label="Asset class">${FILTERS.map(([k, l]) => `<button aria-pressed="${view.filter === k}" data-filter="${k}">${l}</button>`).join('')}</div></div>
    ${rows.length ? `<div class="table-wrap"><table class="t">
      <thead><tr><th>Asset</th>${th('value', 'Available', 'num')}${th('apr', 'Rental fee', 'num')}<th class="num">Min collateral</th>${th('term', 'Term', 'num')}<th>Market</th><th>Status</th><th class="act"></th></tr></thead>
      <tbody>${rows.map(row).join('')}</tbody></table></div>`
      : empty('Nothing matches', view.q || view.filter !== 'all' ? 'Try another asset class or clear the search.' : 'No listings yet. Be the first to list an asset.', '<button class="btn btn-lime" data-open="list">List an asset</button>')}`}`;
}

/** Requests: what renters are asking for, fillable by any holder. */
function offersTable() {
  const rows = S.offers.filter(o => o.status === 'open' && !o.expired);
  const mine = S.account ? S.offers.filter(o => o.status === 'open' && sameAddr(o.renter, S.account)) : [];
  if (!rows.length) {
    return note('info', 'A request is the other side of the market: a renter posts what they want, escrows the collateral and fee, and any holder can fill it in one transaction. Nothing is open right now.')
      + empty('No open requests', 'Post what you want to rent and let holders come to you.', '<button class="btn btn-lime" data-open="list">Post a request</button>');
  }
  return note('info', 'These are renters asking for assets. Their collateral and fee are already escrowed, so filling one pays you immediately and starts the rental on their terms.')
    + '<div style="height:12px"></div>'
    + `<div class="table-wrap"><table class="t"><thead><tr><th>Wanted</th><th class="num">Amount</th><th class="num">Fee to you</th><th class="num">Their collateral</th><th class="num">Term</th><th>Expires</th><th class="act"></th></tr></thead><tbody>
    ${rows.map(o => {
      const own = S.account && sameAddr(o.renter, S.account);
      return `<tr>
        <td><div class="asset">${tokenLogo(o.t, 38)}<div><strong>${esc(o.t.symbol)}</strong><small>${own ? 'Your request' : esc(o.t.name)}</small></div></div></td>
        <td class="num"><div class="cell2"><span>${esc(fmt(o.amountNum))}</span><small>${o.value != null ? usd(o.value) : ''}</small></div></td>
        <td class="num"><div class="cell2"><span class="row" style="justify-content:flex-end;gap:6px">${tokenLogo(o.c, 18)}${esc(fmt(o.feeNum))}</span><small>${o.apr != null ? `${o.apr.toFixed(1)}% APR` : 'Flat fee'}</small></div></td>
        <td class="num"><div class="cell2"><span>${esc(fmt(o.collNum))} ${esc(o.c.symbol)}</span><small>${o.coverage ? `${Math.round(o.coverage * 100)}% of value` : ''}</small></div></td>
        <td class="num">${duration(o.duration)}</td>
        <td>${remaining(o.expiresAt)}</td>
        <td class="act">${own ? `<button class="btn btn-danger btn-sm" data-cancel-offer="${o.id}">Cancel</button>` : `<button class="btn btn-lime btn-sm" data-fill="${o.id}">Fill request</button>`}</td></tr>`;
    }).join('')}</tbody></table></div>`
    + (mine.length ? `<p class="muted small strong" style="margin-top:10px">You have ${mine.length} open request${mine.length === 1 ? '' : 's'}. Cancel any of them to get your collateral and fee back.</p>` : '');
}

function row(v) {
  const mine = role(v);
  let act = `<button class="btn btn-glass btn-sm" data-rent="${v.id}">View</button>`;
  if (v.status === 'open' && mine !== 'lender') act = `<button class="btn btn-lime btn-sm" data-rent="${v.id}">Rent</button>`;
  if (mine) act = `<button class="btn btn-glass btn-sm" data-open="positions">Manage</button>`;
  const status = v.status === 'rented' && v.overdue ? statusBadge('overdue') : v.status === 'rented' && v.hf < 1 ? statusBadge('risk') : statusBadge(v.status);
  return `<tr>
    <td>${assetCell(v, mine ? (mine === 'lender' ? 'Your listing' : 'Your rental') : `${CLASS_LABEL[v.t.class] || ''}${v.kind === 'nft' ? ' ERC-4907' : ''}`)}</td>
    <td class="num"><div class="cell2"><span>${esc(v.kind === 'nft' ? '#' + v.amount : fmt(v.amountNum))}</span><small>${v.value != null ? usd(v.value) : v.kind === 'nft' ? '1 NFT' : 'No oracle'}</small></div></td>
    <td class="num"><div class="cell2"><span class="row" style="justify-content:flex-end;gap:6px">${tokenLogo(v.c, 18)}${esc(fmt(v.feeNum))}</span><small>${v.feeRate != null ? `${v.feeRate.toFixed(2)}% of value` : 'Flat fee'}${v.apr != null ? `, ${v.apr.toFixed(0)}% APR` : ''}</small></div></td>
    <td class="num"><div class="cell2"><span class="row" style="justify-content:flex-end;gap:6px">${tokenLogo(v.c, 18)}${esc(fmt(v.collNum))}</span><small>${v.collRatio != null ? `${Math.round(v.collRatio)}% of value` : v.collUsd != null ? usd(v.collUsd) : esc(v.c.symbol)}</small></div></td>
    <td class="num"><div class="cell2"><span>${duration(v.duration)}</span><small>${v.status === 'rented' ? remaining(v.dueAt) : 'From rental start'}</small></div></td>
    <td>${typeBadge(v)}</td>
    <td>${status}</td>
    <td class="act">${act}</td></tr>`;
}

export function bindMarket(w, api) {
  w.body.addEventListener('input', e => {
    if (e.target.matches('[data-q]')) {
      view.q = e.target.value;
      const pos = e.target.selectionStart;
      renderMarket(w);
      const el = w.body.querySelector('[data-q]'); el.focus(); el.setSelectionRange(pos, pos);
    }
  });
  w.body.addEventListener('change', e => { if (e.target.matches('[data-closed]')) { view.showClosed = e.target.checked; renderMarket(w); } });
  w.body.addEventListener('click', e => {
    const mt = e.target.closest('[data-mtab]'); if (mt) { view.tab = mt.dataset.mtab; renderMarket(w); return; }
    const fl = e.target.closest('[data-fill]'); if (fl) { api.fillOffer(Number(fl.dataset.fill)); return; }
    const co = e.target.closest('[data-cancel-offer]'); if (co) { api.cancelOffer(Number(co.dataset.cancelOffer)); return; }
    const f = e.target.closest('[data-filter]'); if (f) { view.filter = f.dataset.filter; renderMarket(w); return; }
    const s = e.target.closest('[data-sort]');
    if (s) { const k = s.dataset.sort; view.dir = view.sort === k && view.dir === 'desc' ? 'asc' : 'desc'; view.sort = k; renderMarket(w); return; }
    if (e.target.closest('[data-reload]')) { api.reload(); return; }
    const r = e.target.closest('[data-rent]'); if (r) api.openRent(Number(r.dataset.rent));
  });
}

// ------------------------------------------------------------------------------------------ rent window

export function renderRent(w, api) {
  const id = w.payload.id;
  if (w.done) { w.body.innerHTML = w.done; return; }
  const v = S.vms.find(x => x.id === id);
  if (!v) { w.body.innerHTML = empty('Listing not found', 'It may have been cancelled. Refresh the market.'); return; }
  const mine = role(v);
  const canRent = v.status === 'open' && mine !== 'lender';
  const a = w.state ||= { collateral: null, balance: null, required: null, err: '' };

  const cfgMin = v.collateral;
  const req = a.required ?? cfgMin;
  const collRaw = a.collateral ?? req;
  const collNum = toNumber(collRaw, v.c.decimals);
  const collUsd = v.cpx != null ? collNum * v.cpx : null;
  const hf = v.oracle && v.value ? (collUsd * 10000) / (v.value * (api.cfgOf(v.asset)?.liquidationRatioBps || 12000)) : Infinity;
  const liqRatio = api.cfgOf(v.asset)?.liquidationRatioBps || 0;
  const liqPx = v.oracle && liqRatio ? (collUsd * 10000) / (v.amountNum * liqRatio) : null;
  const due = Math.floor(Date.now() / 1000) + v.duration;
  const totalRaw = collRaw + v.fee;
  const short = a.balance != null && a.balance < totalRaw;
  const protoCut = (v.feeNum * S.protocolFeeBps) / 10000;

  const summary = `
    <div class="sum">
      <div class="big"><span>You receive</span><strong>${esc(amountLabel(v))}${v.kind === 'nft' ? ' usage rights' : ''}</strong></div>
      <div><span>Collateral</span><strong>${esc(fmt(collNum))} ${esc(v.c.symbol)}${v.value && collUsd != null ? ` <span class="muted">${Math.round((collUsd / v.value) * 100)}% of value</span>` : ''}</strong></div>
      <div><span>Rental fee</span><strong>${esc(fmt(v.feeNum))} ${esc(v.c.symbol)}${v.feeRate != null ? ` <span class="muted">${v.feeRate.toFixed(2)}% of value</span>` : ''}</strong></div>
      <div><span>Duration</span><strong>${duration(v.duration)}</strong></div>
      <div><span>Due</span><strong>${v.status === 'rented' ? dateTime(v.dueAt) : dateTime(due)}</strong></div>
      <div><span>Grace period after due</span><strong>${duration(S.grace)}</strong></div>
      ${v.oracle ? `<div><span>Health factor at start</span><strong>${hf === Infinity ? '' : hf.toFixed(2)}</strong></div>
      <div><span>Liquidation level</span><strong>${liqPx ? `${esc(v.t.symbol)} above ${usd(liqPx)}` : ''}</strong></div>` : ''}
      <div><span>Total leaving your wallet</span><strong>${esc(fmt(toNumber(totalRaw, v.c.decimals)))} ${esc(v.c.symbol)}</strong></div>
    </div>`;

  const explain = v.kind === 'nft'
    ? 'The NFT stays in AERENT escrow. You get ERC-4907 user rights until the due time, then anyone can settle and your collateral comes back.'
    : v.oracle
      ? `You receive the tokens and must return the same quantity. If the ${esc(v.t.symbol)} price rises until collateral no longer covers ${liqRatio / 100}% of its value, anyone can liquidate and you keep what is left after a ${(api.cfgOf(v.asset)?.liquidationBonusBps || 0) / 100}% bonus.`
      : 'This asset has no oracle, so the position cannot be liquidated early. If it is not returned by the end of the grace period the lender keeps all collateral.';

  w.body.innerHTML = `
    <div class="asset-hero">${tokenLogo(v.t, 52)}<div><h2>${esc(amountLabel(v))}</h2><p>${esc(v.t.name)}${v.value != null ? `, worth ${usd(v.value)}` : ''}${v.px != null ? ` at ${usd(v.px)} each` : ''}</p></div><span class="spacer"></span>${statusBadge(v.status)}</div>
    <div class="split">
      <div class="stack">
        <div class="panel panel-pad">${summary}</div>
        ${note(v.oracle ? 'info' : 'warn', explain)}
        <div class="panel panel-pad small soft">
          <div class="row"><span>Lender</span><span class="spacer"></span>${explorerLink('address', v.lender)}</div>
          <div class="row" style="margin-top:6px"><span>Asset contract</span><span class="spacer"></span>${explorerLink('token', v.asset)}</div>
          ${S.protocolFeeBps ? `<div class="row" style="margin-top:6px"><span>Protocol share of fee</span><span class="spacer"></span><span class="strong">${fmt(protoCut)} ${esc(v.c.symbol)}</span></div>` : ''}
        </div>
      </div>
      <div class="stack">
        ${canRent ? `
        <div class="panel panel-pad stack">
          <div class="field">
            <label for="coll-${id}">Collateral you post</label>
            <div class="input-affix"><input class="in" id="coll-${id}" data-coll inputmode="decimal" value="${esc(formatUnits(collRaw, v.c.decimals, 6).replace(/,/g, ''))}"><span class="affix">${tokenLogo(v.c, 20)}${esc(v.c.symbol)}</span></div>
            <div class="row small"><span class="hint">Minimum ${esc(formatUnits(req, v.c.decimals, 4))} ${esc(v.c.symbol)}. More collateral means a safer health factor.</span></div>
            <div class="row small"><span class="hint">Wallet balance: ${a.balance == null ? (S.account ? 'reading' : 'connect a wallet') : `${formatUnits(a.balance, v.c.decimals, 4)} ${esc(v.c.symbol)}`}</span><span class="spacer"></span><button class="link-btn" data-min>Use minimum</button></div>
            ${a.err ? `<span class="hint bad">${esc(a.err)}</span>` : ''}
          </div>
          ${v.oracle ? hfView(hf) : ''}
          ${short ? note('bad', `Your ${esc(v.c.symbol)} balance is below collateral plus fee.`) : ''}
          ${S.paused ? note('warn', 'New rentals are paused right now.') : ''}
          <div data-steps></div>
          <button class="btn btn-lime btn-lg btn-block" data-go ${short || S.paused || a.err ? 'disabled' : ''}>${S.account ? `Rent ${esc(v.t.symbol)}` : 'Connect wallet to rent'}</button>
        </div>` : `
        <div class="panel panel-pad stack">
          ${v.status === 'rented' ? `<div class="sum"><div><span>Renter</span><strong>${explorerLink('address', v.renter)}</strong></div><div><span>Time left</span><strong>${remaining(v.dueAt)}</strong></div></div>${v.oracle ? hfView(v.hf) : ''}` : ''}
          ${mine === 'lender' && v.status === 'open' ? note('info', 'This is your listing. Manage or cancel it from Positions.') : ''}
          <button class="btn btn-glass btn-block" data-open="positions">Open positions</button>
        </div>`}
      </div>
    </div>`;

  if (!canRent) return;
  if (a.required == null && v.oracle) {
    a.required = cfgMin;
    S.src.required(v).then(r => { a.required = r; if (a.collateral == null || a.collateral < r) a.collateral = r; renderRent(w, api); })
      .catch(err => { a.err = err.message; renderRent(w, api); });
  }
  if (a.balance == null && S.account) S.src.balance(v.collateralToken, S.account).then(bal => { a.balance = bal; renderRent(w, api); });
}

export function bindRent(w, api) {
  w.body.addEventListener('change', e => {
    if (!e.target.matches('[data-coll]')) return;
    const v = S.vms.find(x => x.id === w.payload.id);
    const a = w.state;
    try {
      const raw = parseUnits(e.target.value, v.c.decimals);
      const cfg = api.cfgOf(v.asset);
      const maxRaw = cfg?.maxCollateralRatioBps && v.value && v.cpx
        ? BigInt(Math.floor(((v.value * cfg.maxCollateralRatioBps / 10000) / v.cpx) * 10 ** Math.min(v.c.decimals, 9))) * 10n ** BigInt(Math.max(0, v.c.decimals - 9))
        : null;
      a.err = raw < (a.required ?? v.collateral) ? 'Below the minimum collateral for this listing.'
        : maxRaw && raw > maxRaw ? `Above the ${cfg.maxCollateralRatioBps / 100}% collateral cap for this asset.` : '';
      a.collateral = raw;
    } catch (err) { a.err = err.message; }
    renderRent(w, api);
  });
  w.body.addEventListener('click', async e => {
    const v = S.vms.find(x => x.id === w.payload.id);
    if (e.target.closest('[data-min]')) { w.state.collateral = w.state.required ?? v.collateral; w.state.err = ''; renderRent(w, api); return; }
    const go = e.target.closest('[data-go]');
    if (!go) return;
    go.disabled = true;
    if (!S.account) { await connect(); w.state.balance = null; renderRent(w, api); return; }
    const collateral = w.state.collateral ?? w.state.required ?? v.collateral;
    const plan = () => S.src.plans.rent({ listing: v, collateral, symbol: v.t.symbol, collateralSymbol: v.c.symbol, account: S.account });
    const ok = await runPlan(w.body.querySelector('[data-steps]'), plan(), { title: `Rent ${amountLabel(v)}` });
    if (ok) {
      w.done = `<div class="empty"><div class="tile">${icon('check')}</div><strong>Rental started</strong><span>${esc(amountLabel(v))} is yours until ${esc(dateTime(Math.floor(Date.now() / 1000) + v.duration))}. Return it from Positions to get your collateral back.</span><button class="btn btn-lime" data-open="positions">View position</button></div>`;
      w.body.innerHTML = w.done;
      api.reload();
    } else go.disabled = false;
  });
}
