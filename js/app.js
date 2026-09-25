import { S, on, emit } from './state.js';
import { icon } from './icons.js';
import { $, esc, short, usd } from './util.js';
import { createRpc } from './rpc.js';
import { createRegistry, tokenLogo } from './tokens.js';
import { createLiveSource } from './live.js';
import { createPreviewSource } from './preview.js';
import { initPrivy, warmPrivy } from './wallet.js?v=perf-20260923';
import { connect, autoReconnect, accountMenu } from './walletflow.js?v=perf-20260923';
import { loadAll, configOf, escrowValue } from './data.js';
import { checkAlerts } from './alerts.js';
import { resumePending } from './tx.js';
import { openWindow, windows, setDockSync, refreshApp, refreshAll, toast, avatar, close } from './ui.js';
import { renderMarket, bindMarket, renderRent, bindRent, setMarketQuery, setMarketTab } from './views/market.js';
import { renderLeaderboard } from './views/leaderboard.js';
import { offerAction } from './views/offer-actions.js';
import { renderList, bindList } from './views/list.js';
const renderListPrefill = w => renderList(w, api);
import { renderPositions, bindPositions } from './views/positions.js';
import { renderPortfolio, renderStocks, renderActivity, renderBridge, renderSettings } from './views/misc.js';
import { renderDocs, renderSecurity, renderLegal } from './views/content.js';
import { renderAerentToken } from './views/token.js?v=aerent-token-20260922-2';

const FALLBACK_CONFIG = { networks: {}, features: { preview: true }, defaultNetwork: 'mainnet', securityEmail: 'security@aerentmarketplace.com' };

const api = {
  reload: async () => { await loadAll(); },
  openRent: id => open('rent', { id }),
  cfgOf: a => configOf(a),
  findInMarket: sym => { setMarketQuery(sym); const w = windows().get('market'); if (w) renderMarket(w); open('market'); },
  fillOffer: async id => {
    const o = S.offers.find(x => x.id === id);
    if (!o) return;
    if (!S.account && !(await connect())) return;
    offerAction('fillOffer', o);
  },
  cancelOffer: async id => {
    const o = S.offers.find(x => x.id === id);
    if (!o) return;
    if (!S.account && !(await connect())) return;
    offerAction('cancelOffer', o);
  },
  setNetwork: key => { localStorage.setItem('aerent.net', key); location.reload(); }
};

const APPS = {
  market: { title: 'Market', icon: 'market', sub: () => S.net.label, w: 1000, h: 640, render: w => { bindMarket(w, api); renderMarket(w); }, refresh: renderMarket, dock: true, desk: true },
  list: { title: 'List an asset', icon: 'list', sub: () => 'Earn fees on idle assets', w: 720, h: 680, render: w => { bindList(w, api); renderList(w, api); }, refresh: w => { if (!w.done && w.state && w.state.acct !== S.account) { w.state.tokens = null; renderList(w, api); } }, dock: true, desk: true, label: 'List asset' },
  positions: { title: 'Positions', icon: 'positions', sub: () => (S.account ? short(S.account) : 'Your rentals and listings'), w: 1000, h: 620, render: w => { bindPositions(w, api); renderPositions(w, api); }, refresh: w => renderPositions(w, api), dock: true, desk: true },
  portfolio: { title: 'Portfolio', icon: 'wallet', sub: () => (S.account ? short(S.account) : 'Wallet balances'), w: 820, h: 560, render: renderPortfolio, refresh: renderPortfolio, dock: true, desk: true },
  stocks: { title: 'Stock Tokens', icon: 'stocks', sub: () => 'Robinhood registry', w: 920, h: 620, render: w => renderStocks(w, api), refresh: w => renderStocks(w, api), dock: true, desk: true },
  activity: { title: 'Activity', icon: 'activity', sub: () => 'Your transactions', w: 620, h: 520, render: renderActivity, refresh: renderActivity, dock: true, desk: true },
  bridge: { title: 'Get ETH', icon: 'bridge', sub: () => 'Gas and bridging', w: 640, h: 560, render: renderBridge, refresh: renderBridge, desk: true },
  aerent: { title: '$AERENT', icon: 'globe', sub: () => 'Official token page', w: 760, h: 590, render: renderAerentToken, refresh: renderAerentToken },
  docs: { title: 'How AERENT works', icon: 'docs', sub: () => 'Protocol guide', w: 760, h: 640, render: renderDocs, refresh: renderDocs, dock: true, label: 'Docs' },
  security: { title: 'Security', icon: 'shield', sub: () => 'How AERENT protects funds', w: 700, h: 600, render: renderSecurity, refresh: renderSecurity, dock: true },
  leaderboard: { title: 'Leaderboard', icon: 'gauge', sub: () => 'Who is using AERENT', w: 860, h: 620, render: renderLeaderboard, refresh: renderLeaderboard, dock: true, desk: true },
  settings: { title: 'Settings', icon: 'settings', sub: () => S.net.label, w: 700, h: 520, render: w => renderSettings(w, api), refresh: w => renderSettings(w, api), dock: true },
  legal: { title: 'Legal', icon: 'file', sub: () => S.cfg.domain || '', w: 680, h: 560, render: renderLegal, refresh: renderLegal },
  rent: { title: 'Rent', icon: 'market', w: 900, h: 660, render: w => { bindRent(w, api); renderRent(w, api); }, refresh: w => renderRent(w, api) }
};

function open(app, payload = {}) {
  const def = APPS[app];
  if (!def) return;
  let key = app, title = def.title, tile;
  if (app === 'rent') {
    const vm = S.vms.find(v => v.id === payload.id);
    key = `rent-${payload.id}`;
    title = vm ? (vm.status === 'open' ? `Rent ${vm.t.symbol}` : `${vm.t.symbol} listing`) : 'Listing';
    tile = vm ? tokenLogo(vm.t, 26) : undefined;
  }
  if (app === 'legal') key = 'legal';
  const existing = windows().get(key);
  if (existing && app === 'legal') { existing.payload = payload; renderLegal(existing); }
  const w = openWindow(key, { app, title, icon: def.icon, tile, sub: def.sub?.() || (app === 'rent' ? `Listing #${payload.id}` : ''), w: def.w, h: def.h, payload, render: def.render, refresh: def.refresh });
  history.replaceState(null, '', app === 'market' ? '/market' : app === 'docs' ? '/docs' : app === 'aerent' ? '/aerent' : app === 'legal' ? `/${payload.kind || 'terms'}` : location.pathname);
  return w;
}

// ---------------------------------------------------------------------------------------------- chrome
function buildChrome() {
  const xBtn = $('#xTopBtn');
  if (xBtn) {
    xBtn.href = S.cfg.xUrl || 'https://x.com/AerentMarket';
    xBtn.innerHTML = icon('x');
  }
  $('#apps').innerHTML = Object.entries(APPS).filter(([, d]) => d.desk).map(([k, d]) =>
    `<button class="app-icon" data-open="${k}"><span class="tile">${icon(d.icon)}</span><span>${esc(d.label || d.title)}</span></button>`).join('');
  const dockApps = Object.entries(APPS).filter(([, d]) => d.dock);
  $('#dock').innerHTML = dockApps.slice(0, 6).map(dockBtn).join('') + '<span class="sep"></span>' + dockApps.slice(6).map(dockBtn).join('');
  setDockSync(() => {
    const ws = [...windows().values()];
    document.querySelectorAll('#dock [data-open]').forEach(b => {
      const w = ws.find(x => x.app === b.dataset.open);
      b.classList.toggle('open', !!w);
      b.classList.toggle('focused', !!w && w.el.classList.contains('active') && !w.el.hidden);
    });
    document.querySelectorAll('.nav [data-open]').forEach(b => b.setAttribute('aria-current', String(ws.some(x => x.app === b.dataset.open && x.el.classList.contains('active') && !x.el.hidden))));
  });
}
const dockBtn = ([k, d]) => `<button data-open="${k}" aria-label="${esc(d.title)}">${icon(d.icon)}<span class="tip">${esc(d.label || d.title)}</span></button>`;

function drawTickers() {
  const orbit = $('#orbit');
  orbit.querySelectorAll('.ticker').forEach(n => n.remove());
  const seen = new Set();
  const picks = [];
  const want = ['AAPL', 'NVDA', 'USDG', 'TSLA', 'WETH', 'MSFT'];
  const pool = [...S.vms.map(v => v.t), ...S.vms.map(v => v.c)];
  for (const s of want) { const t = pool.find(x => x.symbol === s && x.logo); if (t && !seen.has(s)) { seen.add(s); picks.push(t); } }
  for (const t of pool) { if (picks.length >= 4) break; if (t.logo && !seen.has(t.symbol)) { seen.add(t.symbol); picks.push(t); } }
  for (const t of picks.slice(0, 4)) {
    const b = document.createElement('button');
    b.className = 'ticker';
    b.innerHTML = `${tokenLogo(t, 32)}$${esc(t.symbol)}`;
    b.onclick = () => api.findInMarket(t.symbol);
    orbit.appendChild(b);
  }
}

function drawFacts() {
  const open = S.vms.filter(v => v.status === 'open');
  $('#factOpen').textContent = open.length;
  $('#factValue').textContent = usd(open.reduce((s, v) => s + (v.value || 0), 0), true) || '$0';
  $('#factActive').textContent = S.vms.filter(v => v.status === 'rented').length;
  $('#factEscrow').textContent = usd(escrowValue(), true) || '$0';
}

function drawWallet() {
  const b = $('#walletBtn');
  if (S.connecting && !S.account) {
    b.className = 'btn btn-lime wallet-btn';
    b.innerHTML = '<span class="spin"></span>Connecting';
    b.disabled = true;
  } else if (S.account) {
    b.className = 'btn btn-glass wallet-btn';
    b.innerHTML = `<img class="avatar" src="${avatar(S.account)}" alt="">${esc(short(S.account))}`;
    b.disabled = false;
  } else {
    b.className = 'btn btn-lime wallet-btn';
    b.textContent = 'Connect wallet';
    b.disabled = false;
  }
  const chip = $('#netChip');
  if (chip) {
    const wrong = S.provider && S.src.mode !== 'preview' && S.walletChainId !== S.net.chainId;
    chip.classList.toggle('wrong', !!wrong);
    chip.classList.toggle('down', !S.rpcOk);
    chip.title = wrong ? `Your wallet is on another chain. Switch to ${S.net.label}.` : S.rpcOk ? `${S.net.label} is reachable` : `${S.net.label} is unreachable right now`;
    const lbl = $('#netLabel');
    if (lbl) lbl.textContent = wrong ? 'Wrong network' : S.net.label;
  }
}

function clock() {
  $('#clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------------------------- boot
async function boot() {
  let cfg;
  try { const r = await fetch('/config.json', { cache: 'no-store' }); cfg = await r.json(); } catch { cfg = FALLBACK_CONFIG; }
  S.cfg = cfg;
  const qp = new URLSearchParams(location.search).get('network');
  let key = qp || localStorage.getItem('aerent.net') || cfg.defaultNetwork;
  if (!cfg.networks[key]) key = cfg.defaultNetwork;
  S.netKey = key; S.net = cfg.networks[key];
  S.rpc = createRpc(S.net.rpcUrls);
  S.reg = createRegistry({ network: S.net, rpc: S.rpc });

  if (/^0x[a-fA-F0-9]{40}$/.test(S.net.marketplaceContract || '')) S.src = createLiveSource({ network: S.net, rpc: S.rpc });
  else S.src = createPreviewSource();
  if (S.src.mode === 'preview') { S.src.tokens.forEach(t => S.reg.put(t)); $('#previewTag').hidden = false; }

  buildChrome();
  clock(); setInterval(clock, 15000);
  try { initPrivy(cfg, S.net); } catch (err) { console.error('Privy init failed', err); }
  // logo fallback without inline handlers (CSP friendly)
  document.addEventListener('error', e => { const img = e.target; if (img.tagName === 'IMG' && img.parentNode?.classList?.contains('tlogo')) { img.parentNode.classList.add('mono'); img.remove(); } }, true);

  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) { document.querySelector('.popover')?.remove(); open(o.dataset.open); return; }
    const l = e.target.closest('[data-legal]');
    if (l) { open('legal', { kind: l.dataset.legal }); return; }
    if (e.target.closest('[data-connect]')) connect();
  });
  const walletBtn = $('#walletBtn');
  walletBtn.onclick = e => (S.account ? accountMenu(e.currentTarget, { open }) : connect());
  // Warm the wallet library the moment the pointer moves towards the button, and in idle time anyway.
  const warm = () => { warmPrivy(); walletBtn.removeEventListener('pointerenter', warm); walletBtn.removeEventListener('touchstart', warm); };
  walletBtn.addEventListener('pointerenter', warm, { passive: true });
  walletBtn.addEventListener('touchstart', warm, { passive: true });
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
  idle(() => { if (S.src.mode !== 'preview') warmPrivy(); }, { timeout: 3000 });

  window.addEventListener('aerent:lend', e => {
    const w = open('list');
    if (!w) return;
    const apply = () => {
      if (!w.state?.tokens) return setTimeout(apply, 250);
      w.state.mode = 'lend';
      w.state.asset = w.state.tokens.find(t => t.address.toLowerCase() === e.detail.asset.toLowerCase())?.address || w.state.asset;
      w.state.amount = ''; w.state.collateral = ''; w.state.err = '';
      w.refresh ? w.refresh() : null;
      renderListPrefill(w);
    };
    apply();
  });

  on('data', () => { drawFacts(); drawTickers(); drawWallet(); refreshAll(); checkAlerts(); });
  on('account', () => { drawWallet(); loadAll(); });
  on('chain', () => loadAll());
  on('activity', () => refreshApp('activity'));

  // Show the interface immediately. Wallet restoration and chain data continue in the background.
  $('#boot').classList.add('gone');

  const path = location.pathname.replace(/\/+$/, '');
  const route = { '/market': ['market'], '/docs': ['docs'], '/aerent': ['aerent'], '/list': ['list'], '/positions': ['positions'], '/security': ['security'],
    '/terms': ['legal', { kind: 'terms' }], '/privacy': ['legal', { kind: 'privacy' }], '/disclaimer': ['legal', { kind: 'disclaimer' }], '/cookies': ['legal', { kind: 'cookies' }] }[path];
  if (route) open(...route);

  autoReconnect().catch(() => {}).finally(() => resumePending());
  loadAll().catch(() => {});
  setInterval(() => { if (!document.hidden) loadAll(); }, 30000);
}

boot().catch(err => {
  console.error(err);
  $('#boot')?.classList.add('gone');
  toast('AERENT could not start', 'Reload the page. If this continues, check config.json.', 'bad');
});
