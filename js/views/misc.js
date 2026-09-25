import { S } from '../state.js';
import { icon } from '../icons.js';
import { esc, usd, formatUnits, toNumber, ago, short, sameAddr } from '../util.js';
import { tokenLogo, logoForSymbol } from '../tokens.js';
import { empty, note, skeleton, explorerLink, toast, modal } from '../ui.js';
import { ensureToken, refreshPrice, priceOf, fmt } from '../data.js';
import { S as State } from '../state.js';
import { getActivity, clearActivity, runPlan } from '../tx.js';
import { isAddress } from '../util.js';
import { connect, switchNetwork } from '../walletflow.js';
import { alertPrefs, setAlertPrefs, enableDesktopAlerts } from '../alerts.js';

// ------------------------------------------------------------------ portfolio
export async function renderPortfolio(w) {
  const b = w.body;
  if (!S.account) { b.innerHTML = empty('Connect your wallet', 'See your balances on Robinhood Chain and what you have locked in AERENT.', '<button class="btn btn-lime" data-connect>Connect wallet</button>'); return; }
  b.innerHTML = skeleton(5);
  const addrs = await S.src.allowlisted().catch(() => []);
  const rows = [];
  for (const a of addrs) {
    const t = await ensureToken(a);
    if (t.class === 'nft') continue;
    const raw = await S.src.balance(a, S.account);
    if (!raw) continue;
    const px = priceOf(a) ?? (await refreshPrice(a));
    const n = toNumber(raw, t.decimals);
    rows.push({ t, raw, n, v: px != null ? n * px : null });
  }
  rows.sort((x, y) => (y.v || 0) - (x.v || 0));
  const owed = [];
  for (const a of addrs) {
    const t = S.reg.get(a);
    if (!t || t.class === 'nft') continue;
    const c = await S.src.claimable(a, S.account);
    if (c > 0n) owed.push({ t, raw: c });
  }
  const eth = await S.src.nativeBalance(S.account).catch(() => 0n);
  const mine = S.vms.filter(v => v.status === 'rented' && sameAddr(v.renter, S.account));
  const lent = S.vms.filter(v => (v.status === 'rented' || v.status === 'open') && sameAddr(v.lender, S.account));
  const total = rows.reduce((s, r) => s + (r.v || 0), 0);
  const locked = mine.reduce((s, v) => s + (v.collUsd || 0), 0);
  b.innerHTML = `
    <div class="stats">
      <div class="stat"><small>Wallet value</small><strong>${usd(total) || '$0'}</strong></div>
      <div class="stat"><small>Collateral locked</small><strong>${usd(locked) || '$0'}</strong></div>
      <div class="stat"><small>Assets lent out</small><strong>${lent.length}</strong></div>
      <div class="stat"><small>ETH for gas</small><strong>${formatUnits(eth, 18, 4)}</strong></div>
    </div>
    ${eth === 0n && S.src.mode !== 'preview' ? note('warn', 'You have no ETH on Robinhood Chain. Every transaction needs a little for gas. <button class="link-btn" data-open="bridge">Get ETH</button>') + '<div style="height:12px"></div>' : ''}
    ${owed.length ? `<div class="panel panel-pad stack" style="margin-bottom:14px"><div class="row"><strong>Payments waiting for you</strong><span class="spacer"></span><span class="badge b-warn">Action needed</span></div>
      <p class="soft small" style="margin:0">These could not be sent to your address when a rental closed, usually because the token issuer blocked the transfer. Withdraw them here, to this wallet or another address you control.</p>
      ${owed.map(o => `<div class="row">${tokenLogo(o.t, 28)}<strong>${esc(formatUnits(o.raw, o.t.decimals, 4))} ${esc(o.t.symbol)}</strong><span class="spacer"></span><button class="btn btn-lime btn-sm" data-withdraw="${esc(o.t.address)}">Withdraw</button></div>`).join('')}</div>` : ''}
    ${idleSection(rows)}
    ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Token</th><th class="num">Balance</th><th class="num">Price</th><th class="num">Value</th><th class="act"></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><div class="asset">${tokenLogo(r.t, 36)}<div><strong>${esc(r.t.symbol)}</strong><small>${esc(r.t.name)}</small></div></div></td>
        <td class="num">${esc(fmt(r.n))}</td><td class="num">${r.v != null ? usd(r.v / r.n) : '<span class="muted">No oracle</span>'}</td><td class="num">${r.v != null ? usd(r.v) : ''}</td>
        <td class="act"><button class="btn btn-glass btn-sm" data-open="list">Lend</button></td></tr>`).join('')}
    </tbody></table></div>` : empty('No allowlisted tokens here yet', 'Tokens you can lend or post as collateral on AERENT will appear here.')}`;
  b.querySelectorAll('[data-lend]').forEach(btn => btn.onclick = () => {
    window.dispatchEvent(new CustomEvent('aerent:lend', { detail: { asset: btn.dataset.lend } }));
  });
  b.querySelectorAll('[data-withdraw]').forEach(btn => btn.onclick = () => {
    const o = owed.find(x => x.t.address === btn.dataset.withdraw);
    modal(`Withdraw ${o.t.symbol}`, `<div class="field"><label for="wto">Send to</label><input class="in mono" id="wto" value="${esc(S.account)}" spellcheck="false"><span class="hint">Use another address you control if this one is blocked by the token issuer.</span></div>
      <div data-steps style="margin:14px 0"></div><button class="btn btn-lime btn-lg btn-block" data-go>Withdraw ${esc(formatUnits(o.raw, o.t.decimals, 4))} ${esc(o.t.symbol)}</button>`, (el, close) => {
      el.querySelector('[data-go]').onclick = async e => {
        const to = el.querySelector('#wto').value.trim();
        if (!isAddress(to)) { toast('Invalid address', 'Enter a 0x address with 40 hex characters.', 'bad'); return; }
        e.currentTarget.disabled = true;
        const ok = await runPlan(el.querySelector('[data-steps]'), S.src.plans.withdraw({ token: o.t.address, to, symbol: o.t.symbol }), { title: `Withdraw ${o.t.symbol}` });
        if (ok) { setTimeout(close, 700); renderPortfolio(w); } else e.currentTarget.disabled = false;
      };
    });
  });
}

/** Suggested fee for an asset, taken from what the market has actually charged for it. */
function suggestedApr(address) {
  const seen = S.vms.filter(v => sameAddr(v.asset, address) && v.apr != null).map(v => v.apr).sort((a, b) => a - b);
  if (seen.length) return seen[Math.floor(seen.length / 2)];
  const all = S.vms.filter(v => v.apr != null).map(v => v.apr).sort((a, b) => a - b);
  return all.length ? all[Math.floor(all.length / 2)] : 12;
}

/** Anything in the wallet that could be earning, with a one-click route into the listing form. */
function idleSection(rows) {
  const idle = rows.filter(r => r.v != null && r.v >= 1 && S.vms.some(v => sameAddr(v.asset, r.t.address) || v.t.class === r.t.class));
  const pool = (idle.length ? idle : rows.filter(r => r.v != null && r.v >= 1)).slice(0, 4);
  if (!pool.length) return '';
  const total = pool.reduce((s, r) => s + r.v, 0);
  return `<div class="panel panel-pad stack" style="margin-bottom:14px">
    <div class="row"><strong>Put these to work</strong><span class="spacer"></span><span class="badge b-lime">${usd(total, true)} idle</span></div>
    <p class="soft small" style="margin:0">These are sitting in your wallet doing nothing. Suggested fees come from what the market has charged for similar rentals.</p>
    ${pool.map(r => {
      const apr = suggestedApr(r.t.address);
      const monthly = (r.v * apr / 100) / 12;
      return `<div class="row">${tokenLogo(r.t, 32)}
        <div class="cell2"><strong>${esc(fmt(r.n))} ${esc(r.t.symbol)}</strong><small>${usd(r.v)} idle</small></div>
        <span class="spacer"></span>
        <div class="cell2" style="text-align:right"><strong>${usd(monthly)} a month</strong><small>at ${apr.toFixed(0)}% APR, your terms</small></div>
        <button class="btn btn-lime btn-sm" data-lend="${esc(r.t.address)}">Lend</button></div>`;
    }).join('')}
  </div>`;
}

// ------------------------------------------------------------------ stock tokens (Robinhood registry)
export async function renderStocks(w, api) {
  const b = w.body;
  b.innerHTML = skeleton(6);
  let items = [];
  let source = 'robinhood';
  if (S.src.mode === 'preview') {
    source = 'preview';
    items = S.src.tokens.filter(t => t.class === 'rwa').map(t => ({ ...t, multiplier: '1.000000000000000000', trading: { allDayTradability: 'tradable' } }));
  } else {
    items = await S.reg.stockTokens();
    if (!items.length) source = 'none';
  }
  const q = (w.state ||= { q: '' }).q.toLowerCase();
  const allow = new Set((await S.src.allowlisted().catch(() => [])).map(a => a.toLowerCase()));
  const listed = a => S.vms.filter(v => sameAddr(v.asset, a) && v.status === 'open').length;
  const rows = items.filter(i => !q || `${i.symbol} ${i.name}`.toLowerCase().includes(q)).sort((a, c) => listed(c.address) - listed(a.address) || a.symbol.localeCompare(c.symbol));
  b.innerHTML = `
    <p class="lead">${source === 'robinhood' ? 'Canonical Stock Token contracts from the Robinhood registry. AERENT only accepts a Stock Token whose address matches this list, never a lookalike with the same ticker.' : source === 'preview' ? 'Stock Tokens available in preview. On a live deployment this list comes from the Robinhood Stock Token registry.' : 'The Robinhood Stock Token registry is not configured for this network.'}</p>
    <div class="toolbar"><label class="search">${icon('search')}<input class="in" data-sq placeholder="Search ticker or company" value="${esc(w.state.q)}"></label></div>
    ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Stock Token</th><th>Contract</th><th class="num">Multiplier</th><th>24/5 trading</th><th>On AERENT</th><th class="act"></th></tr></thead><tbody>
      ${rows.map(i => {
        const t = { ...i, logo: logoForSymbol(i.symbol) || i.remoteLogo || i.logo };
        const m = Number(i.multiplier || 1);
        const onA = allow.has(i.address.toLowerCase());
        const n = listed(i.address);
        const pending = i.pendingMultiplier ? `<small class="muted">Changes to ${Number(i.pendingMultiplier).toFixed(4)}</small>` : '';
        return `<tr><td><div class="asset">${tokenLogo(t, 36)}<div><strong>${esc(i.symbol)}<span class="verified" title="Canonical Robinhood Stock Token">${icon('check')}</span></strong><small>${esc(i.name)}</small></div></div></td>
          <td>${explorerLink('token', i.address, short(i.address, 8, 6))}</td>
          <td class="num"><div class="cell2"><span>${m.toFixed(4)}</span>${pending}</div></td>
          <td>${i.trading?.allDayTradability === 'tradable' ? '<span class="badge b-open"><i></i>Yes</span>' : '<span class="badge b-plain">Market hours</span>'}</td>
          <td>${onA ? `<span class="badge b-rented">${n ? `${n} open` : 'Allowlisted'}</span>` : '<span class="badge b-plain">Not yet</span>'}</td>
          <td class="act">${onA ? `<button class="btn btn-${n ? 'lime' : 'glass'} btn-sm" data-find="${esc(i.symbol)}">${n ? 'Rent' : 'View'}</button>` : ''}</td></tr>`;
      }).join('')}
    </tbody></table></div>` : empty('No Stock Tokens found', q ? 'Try another search.' : 'The registry did not return any assets for this network.')}
    <p class="muted small" style="margin-top:12px">Prices on AERENT come from Chainlink feeds that already include the corporate-action multiplier, so a split or dividend never changes what a position is worth. While Robinhood pauses a Stock Token oracle for a corporate action, new rentals and liquidations for that token wait, and returns keep working.</p>`;
  const input = b.querySelector('[data-sq]');
  input.oninput = () => { w.state.q = input.value; renderStocks(w, api).then(() => { const i = b.querySelector('[data-sq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); };
  b.onclick = e => { const f = e.target.closest('[data-find]'); if (f) api.findInMarket(f.dataset.find); };
}

// ------------------------------------------------------------------ activity
export function renderActivity(w) {
  const items = getActivity();
  const glyph = { pending: 'clock', confirmed: 'check', failed: 'alert', preview: 'layers' };
  const label = { pending: '<span class="badge b-rented"><i></i>Confirming</span>', confirmed: '<span class="badge b-open"><i></i>Confirmed</span>', failed: '<span class="badge b-bad"><i></i>Reverted</span>', preview: '<span class="badge b-plain">Preview</span>' };
  w.body.innerHTML = items.length ? `<div class="row" style="margin-bottom:6px"><span class="muted small strong">Stored on this device only. Pending transactions resume after a refresh.</span><span class="spacer"></span><button class="btn btn-ghost btn-sm" data-clear>Clear</button></div>
    <div class="feed">${items.map(a => `<div class="feed-item"><span class="tile">${icon(glyph[a.status] || 'activity')}</span>
      <div><strong>${esc(a.title)}</strong><small>${esc(a.detail || '')}${a.hash ? ` ${explorerLink('tx', a.hash, short(a.hash, 8, 6))}` : ''} ${esc(ago(a.time))}</small></div>${label[a.status] || ''}</div>`).join('')}</div>`
    : empty('No activity yet', 'Transactions you send from AERENT appear here with their status.');
  const c = w.body.querySelector('[data-clear]'); if (c) c.onclick = () => { clearActivity(); renderActivity(w); };
}

// ------------------------------------------------------------------ get ETH / bridge
export async function renderBridge(w) {
  const n = S.net;
  let eth = null;
  if (S.account) eth = await S.src.nativeBalance(S.account).catch(() => null);
  w.body.innerHTML = `
    <div class="asset-hero">${tokenLogo({ symbol: 'ETH', logo: '/assets/tokens/eth.svg' }, 52)}<div><h2>Gas on ${esc(n.label)}</h2><p>Every AERENT transaction costs a small amount of ETH on Robinhood Chain.</p></div></div>
    <div class="stack">
      <div class="panel panel-pad"><div class="sum">
        <div><span>Your ETH balance</span><strong>${S.account ? (eth == null ? 'Unavailable' : `${formatUnits(eth, 18, 5)} ETH`) : 'Connect a wallet'}</strong></div>
        <div><span>Network</span><strong>${esc(n.label)}, chain ${n.chainId}</strong></div>
        <div><span>Canonical deposit from Ethereum</span><strong>About 10 minutes</strong></div>
        <div><span>Canonical withdrawal to Ethereum</span><strong>About 7 days (Arbitrum challenge period)</strong></div>
      </div></div>
      ${note('info', 'Robinhood Chain supports the canonical Arbitrum bridge plus faster third-party routes. Only use bridges listed in the Robinhood Chain documentation.')}
      <div class="row wrap">
        ${n.bridgeDocsUrl ? `<a class="btn btn-lime" href="${esc(n.bridgeDocsUrl)}" target="_blank" rel="noopener noreferrer">Bridging options</a>` : ''}
        ${n.faucetUrl ? `<a class="btn btn-glass" href="${esc(n.faucetUrl)}" target="_blank" rel="noopener noreferrer">Testnet faucet</a>` : ''}
        <button class="btn btn-glass" data-addnet>Add ${esc(n.label)} to wallet</button>
        ${S.account && n.explorerUrl && S.src.mode !== 'preview' ? `<a class="btn btn-ghost" href="${esc(n.explorerUrl)}/address/${esc(S.account)}" target="_blank" rel="noopener noreferrer">View on explorer</a>` : ''}
      </div>
    </div>`;
  w.body.querySelector('[data-addnet]').onclick = async () => {
    try { if (!S.provider) await connect(); if (S.provider) { await switchNetwork(); toast('Network ready', n.label, 'ok'); } }
    catch { toast('Not added', 'Approve the request in your wallet.', 'bad'); }
  };
}

// ------------------------------------------------------------------ settings
export function renderSettings(w, api) {
  const nets = Object.entries(S.cfg.networks).filter(([k, n]) => !n.hidden || k === S.netKey || ['localhost', '127.0.0.1'].includes(location.hostname));
  const rs = S.rpc.status();
  const wrong = S.provider && S.src.mode !== 'preview' && S.walletChainId !== S.net.chainId;
  w.body.innerHTML = `
    <div class="set"><div><strong>Network</strong><small>Where AERENT reads listings and sends transactions.</small></div>
      <select class="in" data-net>${nets.map(([k, n]) => `<option value="${k}" ${k === S.netKey ? 'selected' : ''}>${esc(n.label)}</option>`).join('')}</select></div>
    <div class="set"><div><strong>Wallet network</strong><small>${S.provider ? (wrong ? `Your wallet is on chain ${S.walletChainId}.` : `Connected to ${esc(S.net.label)}.`) : 'No wallet connected.'}</small></div>
      <button class="btn btn-glass" data-switch ${S.provider ? '' : 'disabled'}>Switch wallet network</button></div>
    <div class="set"><div><strong>RPC</strong><small>${rs.endpoints} endpoint${rs.endpoints === 1 ? '' : 's'} with automatic failover. ${rs.latency != null ? `Last response ${rs.latency} ms.` : ''} ${rs.healthy ? '' : 'Currently unreachable.'}</small></div>
      <span class="badge ${rs.healthy ? 'b-open' : 'b-bad'}"><i></i>${rs.healthy ? 'Healthy' : 'Down'}</span></div>
    <div class="set"><div><strong>Data source</strong><small>${S.src.mode === 'preview' ? 'Preview simulation. No marketplace contract is configured for this network.' : S.net.indexerUrl ? 'AERENT indexer, with direct chain reads as fallback.' : 'Direct contract reads.'}</small></div>
      <span class="badge b-plain">${S.src.mode === 'preview' ? 'Preview' : S.net.indexerUrl ? 'Indexer' : 'Onchain'}</span></div>
    ${S.src.mode === 'preview' ? `<div class="set"><div><strong>Reset preview</strong><small>Restore the preview market and test balances.</small></div><button class="btn btn-glass" data-resetp>Reset</button></div>` : ''}
    <div class="set"><div><strong>Position alerts</strong><small>Warn me when a rental nears liquidation, falls due, or becomes claimable. Runs in this browser while AERENT is open.</small></div>
      <div class="row"><label class="row small strong soft" style="gap:8px"><input type="checkbox" data-alerts ${alertPrefs().enabled ? 'checked' : ''}> On</label>
      <button class="btn btn-glass btn-sm" data-desktop ${alertPrefs().desktop ? 'disabled' : ''}>${alertPrefs().desktop ? 'Desktop alerts on' : 'Allow desktop alerts'}</button></div></div>
    <div class="set"><div><strong>Local activity</strong><small>Clear the transaction history stored in this browser.</small></div><button class="btn btn-glass" data-clr>Clear</button></div>`;
  w.body.querySelector('[data-net]').onchange = e => api.setNetwork(e.target.value);
  w.body.querySelector('[data-switch]').onclick = () => switchNetwork().then(() => { toast('Wallet switched', S.net.label, 'ok'); renderSettings(w, api); }).catch(() => toast('Not switched', 'Approve the request in your wallet.', 'bad'));
  w.body.querySelector('[data-clr]').onclick = () => { clearActivity(); toast('Activity cleared'); };
  w.body.querySelector('[data-alerts]').onchange = e => { setAlertPrefs({ enabled: e.target.checked }); toast(e.target.checked ? 'Alerts on' : 'Alerts off'); };
  w.body.querySelector('[data-desktop]').onclick = async () => {
    const ok = await enableDesktopAlerts();
    toast(ok ? 'Desktop alerts on' : 'Not allowed', ok ? 'AERENT will notify you even when this tab is in the background.' : 'Your browser blocked notifications.', ok ? 'ok' : 'bad');
    renderSettings(w, api);
  };
  const rp = w.body.querySelector('[data-resetp]'); if (rp) rp.onclick = () => { S.src.reset(); location.reload(); };
}
