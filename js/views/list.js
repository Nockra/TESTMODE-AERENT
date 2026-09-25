import { S } from '../state.js';
import { icon } from '../icons.js';
import { esc, usd, parseUnits, formatUnits, toNumber, duration } from '../util.js';
import { tokenLogo, CLASS_LABEL } from '../tokens.js';
import { empty, note, skeleton } from '../ui.js';
import { ensureToken, refreshPrice, priceOf, configOf, fmt } from '../data.js';
import { runPlan } from '../tx.js';
import { connect } from '../walletflow.js';

const DAYS = [1, 3, 7, 14, 30, 60, 90];
const collUsdHint = (n, cpx) => (cpx != null ? ` (${usd(n * cpx)})` : '');

/** Terms as the contract sees them, derived from the percentage controls when the asset has a price. */
function terms(f, t, c) {
  const px = priceOf(t.address), cpx = priceOf(c.address);
  const amountNum = Number(f.amount) || 0;
  const value = px != null ? amountNum * px : null;
  const priced = px != null && cpx != null && value != null;
  if (!priced) return { priced, collateral: Number(f.collateral) || 0, fee: Number(f.fee) || 0 };
  const minPct = (t.cfg.minCollateralRatioBps || 0) / 100;
  const maxPct = (t.cfg.maxCollateralRatioBps || 0) / 100 || 200;
  const collPct = f.collPct == null ? Math.min(maxPct, Math.max(minPct, minPct + 10)) : f.collPct;
  const feePct = Math.min(f.feePct ?? 2, (t.cfg.maxFeeBps || 0) / 100 || 10);
  return { priced, collateral: (value * collPct / 100) / cpx, fee: (value * feePct / 100) / cpx, collPct, feePct };
}

export async function renderList(w, api) {
  if (w.done) { w.body.innerHTML = w.done; w.body.querySelector('[data-again]').onclick = () => { w.done = null; w.state = null; renderList(w, api); }; return; }
  const f = w.state ||= { mode: 'lend', asset: null, amount: '', tokenId: '', coll: null, collateral: '', collPct: null, fee: '', feePct: 2, days: 7, expiry: 3, err: '', tokens: null, balances: {} };
  if (!f.tokens) {
    w.body.innerHTML = skeleton(5);
    f.acct = S.account;
    try {
      const addrs = await S.src.allowlisted();
      const list = [];
      for (const a of addrs) {
        const t = await ensureToken(a);
        const cfg = configOf(a);
        if (!cfg || cfg.class === 'none') continue;
        if (cfg.priceFeed && !/^0x0+$/.test(cfg.priceFeed)) await refreshPrice(a);
        list.push({ ...t, cfg });
      }
      f.tokens = list;
      f.coll = f.coll || list.find(t => t.cfg.collateralEnabled && t.symbol === 'USDG')?.address || list.find(t => t.cfg.collateralEnabled)?.address || null;
      if (S.account) await loadBalances(f);
    } catch (err) {
      w.body.innerHTML = empty('Assets unavailable', 'The allowlist could not be read. Try again shortly.');
      return;
    }
  }
  draw(w, api);
}

async function loadBalances(f) {
  await Promise.all(f.tokens.filter(t => t.cfg.class !== 'nft').map(async t => { f.balances[t.address.toLowerCase()] = await S.src.balance(t.address, S.account); }));
}

function draw(w, api) {
  const f = w.state;
  const listable = f.tokens.filter(t => t.cfg.listingEnabled && (f.mode !== 'request' || t.cfg.class !== 'nft'));
  const collats = f.tokens.filter(t => t.cfg.collateralEnabled && t.address !== f.asset);
  if (!listable.length) { w.body.innerHTML = empty('No listable assets yet', 'The AERENT allowlist is empty on this network.'); return; }
  const t = listable.find(x => x.address === f.asset);
  const c = f.tokens.find(x => x.address === f.coll);
  const isNft = t?.cfg.class === 'nft';
  const px = t && !isNft ? priceOf(t.address) : null;
  const cpx = c ? priceOf(c.address) : null;
  const amountNum = Number(f.amount) || 0;
  const value = px != null ? amountNum * px : null;
  const suggested = value != null && cpx ? (value * t.cfg.minCollateralRatioBps / 10000) / cpx : null;
  const minPct = t ? (t.cfg.minCollateralRatioBps || 0) / 100 : 0;
  const maxPct = t ? (t.cfg.maxCollateralRatioBps || 0) / 100 : 0;
  const maxFeePct = t ? (t.cfg.maxFeeBps || 0) / 100 : 0;
  const priced = px != null && cpx != null && value != null;
  // with a price we drive the terms from percentages; without one the lender types absolute amounts
  const collPct = f.collPct == null ? Math.min(maxPct || 170, Math.max(minPct, minPct + 10)) : f.collPct;
  const collNum = priced ? (value * collPct / 100) / cpx : Number(f.collateral) || 0;
  const feePct = Math.min(f.feePct ?? 2, maxFeePct || 10);
  const feeNum = priced ? (value * feePct / 100) / cpx : Number(f.fee) || 0;
  const apr = value && cpx ? ((feeNum * cpx) / value) * (365 / f.days) * 100 : null;
  const bal = t && !isNft ? f.balances[t.address.toLowerCase()] : null;
  const collBal = c ? f.balances[c.address.toLowerCase()] : null;
  const ownedNfts = isNft && S.src.ownedNfts && S.account ? S.src.ownedNfts(S.account).filter(n => n.token.toLowerCase() === t.address.toLowerCase()) : [];
  const oracleWithoutOracleColl = t && !isNft && px != null && c && cpx == null;

  const request = f.mode === 'request';
  w.body.innerHTML = `
    <div class="toolbar"><div class="seg" role="group" aria-label="Mode">
      <button aria-pressed="${!request}" data-mode="lend">Lend an asset</button>
      <button aria-pressed="${request}" data-mode="request">Request an asset</button>
    </div></div>
    <p class="lead">${request
      ? 'Say what you want to rent and what you will pay for it. Your collateral and fee go into escrow, and any holder can fill the request in one transaction. Cancel any time before someone does.'
      : 'Choose an allowlisted asset, set the collateral a renter must post and the fee you earn. Your asset sits in AERENT escrow until someone rents it, and you can cancel any time before that.'}</p>
    <div class="stack">
      <div class="field"><label>${request ? 'Asset you want to rent' : 'Asset to lend'}</label>
        <div class="pick" role="group" aria-label="Asset">${listable.map(x => `<button aria-pressed="${x.address === f.asset}" data-asset="${x.address}">${x.cfg.class === 'nft' ? tokenLogo(x, 32).replace('class="tlogo', 'class="tlogo nft') : tokenLogo(x, 32)}<span><strong>${esc(x.symbol)}</strong><small>${esc(CLASS_LABEL[x.cfg.class])}${x.cfg.class !== 'nft' && f.balances[x.address.toLowerCase()] ? `, ${formatUnits(f.balances[x.address.toLowerCase()], x.decimals, 2)} held` : ''}</small></span></button>`).join('')}</div>
      </div>
      ${t ? `
      <div class="grid-2">
        ${isNft ? `<div class="field"><label for="tid">Token ID</label>
            ${ownedNfts.length ? `<select class="in" id="tid" data-f="tokenId"><option value="">Choose an NFT you own</option>${ownedNfts.map(n => `<option ${String(f.tokenId) === n.id ? 'selected' : ''} value="${esc(n.id)}">${esc(t.symbol)} #${esc(n.id)}</option>`).join('')}</select>` : `<input class="in" id="tid" data-f="tokenId" inputmode="numeric" placeholder="482" value="${esc(f.tokenId)}">`}
            <span class="hint">Only ERC-4907 NFTs are accepted. Renters get user rights, never ownership.</span></div>`
        : `<div class="field"><label for="amt">Amount</label>
            <div class="input-affix"><input class="in" id="amt" data-f="amount" inputmode="decimal" placeholder="0.0" value="${esc(f.amount)}"><span class="affix">${tokenLogo(t, 20)}${esc(t.symbol)}</span></div>
            <div class="row small"><span class="hint">${value != null ? `Worth ${usd(value)} at ${usd(px)}` : 'No oracle: fixed collateral market'}</span><span class="spacer"></span>${bal != null && !request ? `<button class="link-btn" data-max>Max ${formatUnits(bal, t.decimals, 4)}</button>` : ''}</div></div>`}
        <div class="field"><label for="dur">Rental term</label>
          <select class="in" id="dur" data-f="days">${DAYS.map(d => `<option value="${d}" ${f.days === d ? 'selected' : ''}>${duration(d * 86400)}</option>`).join('')}</select>
          <span class="hint">${request ? `You get ${duration(S.grace)} of grace after the term to return it before the lender can claim your collateral.` : `Renters get ${duration(S.grace)} of grace after the term before you can claim collateral.`}</span></div>
        <div class="field"><label>Collateral token</label>
          <div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${collats.map(x => `<button aria-pressed="${x.address === f.coll}" data-coll="${x.address}">${tokenLogo(x, 28)}<span><strong>${esc(x.symbol)}</strong><small>${priceOf(x.address) != null ? 'Oracle priced' : 'No oracle'}</small></span></button>`).join('')}</div></div>
        ${priced ? `<div class="field"><label for="colpct">${request ? 'Collateral you post' : 'Collateral a renter posts'}</label>
          <input type="range" id="colpct" data-f="collPct" min="${minPct}" max="${maxPct || 200}" step="5" value="${collPct}">
          <div class="row small"><span class="hint"><strong>${collPct}% of value</strong>, ${fmt(collNum)} ${esc(c.symbol)}${collUsdHint(collNum, cpx)}</span><span class="spacer"></span><span class="hint">allowed ${minPct}% to ${maxPct || 200}%</span></div>
          <span class="hint">${request ? 'More collateral makes your request easier to fill and your position safer.' : `Renters will not accept silly numbers, and the contract refuses anything above ${maxPct || 200}%.`}</span></div>`
        : `<div class="field"><label for="col">${request ? 'Collateral you post' : 'Minimum collateral'}</label>
          <div class="input-affix"><input class="in" id="col" data-f="collateral" inputmode="decimal" placeholder="0.0" value="${esc(f.collateral)}"><span class="affix">${c ? tokenLogo(c, 20) + esc(c.symbol) : ''}</span></div>
          <div class="row small"><span class="hint">${isNft ? 'Covers the NFT if the renter never settles.' : 'No oracle for this asset, so set this carefully.'}${request && collBal != null ? `, you hold ${formatUnits(collBal, c.decimals, 2)}` : ''}</span></div></div>`}
        ${request ? `<div class="field"><label for="exp">Request expires in</label>
          <select class="in" id="exp" data-f="expiry">${[1, 2, 3, 7, 14].map(dd => `<option value="${dd}" ${f.expiry === dd ? 'selected' : ''}>${dd} day${dd === 1 ? '' : 's'}</option>`).join('')}</select>
          <span class="hint">After this, nobody can fill it and you can withdraw everything.</span></div>` : ''}
        ${priced ? `<div class="field full"><label for="feepct">${request ? 'Fee you will pay' : 'Rental rate you charge'}</label>
          <input type="range" id="feepct" data-f="feePct" min="0" max="${maxFeePct || 10}" step="0.25" value="${feePct}">
          <div class="row small"><span class="hint"><strong>${feePct}% of value for ${duration(f.days * 86400)}</strong>, ${fmt(feeNum)} ${esc(c.symbol)}</span><span class="spacer"></span><span class="hint">0% to ${maxFeePct || 10}% allowed${apr != null ? `, ${apr.toFixed(1)}% APR` : ''}</span></div>`
        : `<div class="field full"><label for="fee">${request ? 'Fee you will pay' : 'Rental fee you earn'}</label>
          <div class="input-affix"><input class="in" id="fee" data-f="fee" inputmode="decimal" placeholder="0.0" value="${esc(f.fee)}"><span class="affix">${c ? tokenLogo(c, 20) + esc(c.symbol) : ''}</span></div>`}
          <span class="hint">${request ? 'Paid to whoever fills your request, at the moment they fill it.' : `Paid upfront when the rental starts${S.protocolFeeBps ? `, less a ${S.protocolFeeBps / 100}% protocol share` : ''}. Early returns are not refunded.`}${apr != null ? ` Equivalent to ${apr.toFixed(1)}% APR.` : ''}</span></div>
      </div>
      ${oracleWithoutOracleColl ? note('bad', `${esc(t.symbol)} is oracle priced, so the collateral must be oracle priced too.`) : ''}
      ${!isNft && px == null ? note('warn', 'Fixed collateral market: no oracle means the rental cannot be liquidated early. Set collateral well above what the asset could be worth at the end of the term.') : ''}
      ${f.err ? note('bad', esc(f.err)) : ''}
      <div data-steps></div>
      <button class="btn btn-lime btn-lg btn-block" data-go ${S.paused || oracleWithoutOracleColl ? 'disabled' : ''}>${S.account ? (request ? 'Post request' : 'Create listing') : 'Connect wallet'}</button>` : note('info', 'Pick an asset to continue. Only allowlisted tokens appear here, so lookalike contracts cannot be listed.')}
    </div>`;
}

export function bindList(w, api) {
  const f = () => w.state;
  w.body.addEventListener('click', async e => {
    const md = e.target.closest('[data-mode]');
    if (md) { Object.assign(f(), { mode: md.dataset.mode, err: '' }); if (f().mode === 'request' && f().tokens?.find(t => t.address === f().asset)?.cfg.class === 'nft') f().asset = null; draw(w, api); return; }
    const a = e.target.closest('[data-asset]');
    if (a) { Object.assign(f(), { asset: a.dataset.asset, amount: '', tokenId: '', collateral: '', err: '' }); if (f().coll === a.dataset.asset) f().coll = null; draw(w, api); return; }
    const c = e.target.closest('[data-coll]'); if (c) { f().coll = c.dataset.coll; f().collateral = ''; draw(w, api); return; }
    if (e.target.closest('[data-max]')) { const t = f().tokens.find(x => x.address === f().asset); f().amount = formatUnits(f().balances[t.address.toLowerCase()], t.decimals, 8).replace(/,/g, ''); draw(w, api); return; }
    const sg = e.target.closest('[data-suggest]'); if (sg) { f().collateral = String(Math.ceil(Number(sg.dataset.suggest) * 1.05)); draw(w, api); return; }
    const go = e.target.closest('[data-go]');
    if (!go) return;
    if (!S.account) { if (await connect()) { await loadBalances(f()); draw(w, api); } return; }
    await submit(w, api, go);
  });
  const onEdit = e => {
    const k = e.target.dataset.f; if (!k) return;
    f()[k] = ['days', 'expiry', 'collPct', 'feePct'].includes(k) ? Number(e.target.value) : e.target.value.trim();
    f().err = '';
    draw(w, api);
  };
  w.body.addEventListener('change', onEdit);
  w.body.addEventListener('input', e => { if (['collPct', 'feePct'].includes(e.target.dataset.f)) onEdit(e); });
}

async function submitOffer(w, api, go) {
  const f = w.state;
  const t = f.tokens.find(x => x.address === f.asset);
  const c = f.tokens.find(x => x.address === f.coll);
  try {
    if (!c) throw new Error('Choose a collateral token.');
    const amount = parseUnits(f.amount, t.decimals);
    if (amount === 0n) throw new Error('Enter an amount greater than zero.');
    const d = terms(f, t, c);
    const collateral = parseUnits(String(d.collateral.toFixed(Math.min(c.decimals, 6))), c.decimals);
    if (collateral === 0n) throw new Error('Post some collateral so holders know you are good for it.');
    const fee = d.fee > 0 ? parseUnits(String(d.fee.toFixed(Math.min(c.decimals, 6))), c.decimals) : 0n;
    const bal = f.balances[c.address.toLowerCase()];
    if (bal != null && collateral + fee > bal) throw new Error(`You hold ${formatUnits(bal, c.decimals, 4)} ${c.symbol}, which is less than the collateral plus fee.`);
    f.err = '';
    go.disabled = true;
    const expiresAt = Math.floor(Date.now() / 1000) + f.expiry * 86400;
    const steps = S.src.plans.createOffer({ asset: t.address, amount, collateralToken: c.address, collateral, fee, duration: f.days * 86400, expiresAt, collateralSymbol: c.symbol, account: S.account });
    const ok = await runPlan(w.body.querySelector('[data-steps]'), steps, { title: `Request ${f.amount} ${t.symbol}` });
    if (ok) {
      w.done = `<div class="empty"><div class="tile">${icon('check')}</div><strong>Request posted</strong><span>Any holder of ${esc(t.symbol)} can now fill it on your terms. Your collateral and fee stay in escrow until they do, or until you cancel.</span><div class="row"><button class="btn btn-lime" data-open="market">See the market</button><button class="btn btn-glass" data-again>Post another</button></div></div>`;
      renderList(w, api);
      api.reload();
    } else go.disabled = false;
  } catch (err) {
    f.err = err.message;
    draw(w, api);
  }
}

async function submit(w, api, go) {
  const f = w.state;
  if (f.mode === 'request') return submitOffer(w, api, go);
  const t = f.tokens.find(x => x.address === f.asset);
  const c = f.tokens.find(x => x.address === f.coll);
  try {
    if (!c) throw new Error('Choose a collateral token.');
    const isNft = t.cfg.class === 'nft';
    const amount = isNft ? BigInt(String(f.tokenId || '').replace('#', '') || 'x') : parseUnits(f.amount, t.decimals);
    if (!isNft && amount === 0n) throw new Error('Enter an amount greater than zero.');
    const bal = f.balances[t.address.toLowerCase()];
    if (!isNft && bal != null && amount > bal) throw new Error(`You hold ${formatUnits(bal, t.decimals, 4)} ${t.symbol}.`);
    const d = terms(f, t, c);
    const collateral = parseUnits(String(d.collateral.toFixed(Math.min(c.decimals, 6))), c.decimals);
    if (collateral === 0n) throw new Error('Set the collateral above zero.');
    const fee = d.fee > 0 ? parseUnits(String(d.fee.toFixed(Math.min(c.decimals, 6))), c.decimals) : 0n;
    f.err = '';
    go.disabled = true;
    const steps = S.src.plans.createListing({ asset: t.address, kind: isNft ? 'nft' : 'fungible', amount, collateralToken: c.address, collateral, fee, duration: f.days * 86400, symbol: t.symbol, account: S.account });
    const ok = await runPlan(w.body.querySelector('[data-steps]'), steps, { title: `List ${isNft ? `${t.symbol} #${amount}` : `${f.amount} ${t.symbol}`}` });
    if (ok) {
      w.done = `<div class="empty"><div class="tile">${icon('check')}</div><strong>Listing live</strong><span>Your ${esc(t.symbol)} is in escrow and visible in the market. You can cancel it until someone rents it.</span><div class="row"><button class="btn btn-lime" data-open="market">View market</button><button class="btn btn-glass" data-again>List another</button></div></div>`;
      renderList(w, api);
      api.reload();
    } else go.disabled = false;
  } catch (err) {
    f.err = err.message === 'Cannot convert x to a BigInt' ? 'Enter a token ID.' : err.message;
    draw(w, api);
  }
}
