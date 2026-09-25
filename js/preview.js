// Preview source: runs the AERENT contract rules in the browser so every flow can be tried without a deployment.
// Same maths as AerentMarketplace.sol. Prices are fixed reference values and can be moved from the Positions view.
import { load, save, sameAddr } from './util.js';
import { logoForSymbol } from './tokens.js';

const A = n => '0x' + n.toString(16).padStart(40, '0');
const WAD = 10n ** 18n;
export const PREVIEW_ACCOUNT = '0x7e57000000000000000000000000000000a3e7e5';

const CATALOG = [
  // symbol, name, class, decimals, price, risk [minCR, liq, bonus], collateral?
  ['USDG', 'Global Dollar', 'stablecoin', 6, 1, [11000, 10500, 200], true],
  ['WETH', 'Wrapped Ether', 'crypto', 18, 4450, [16000, 12500, 600], true],
  ['AAPL', 'Apple', 'rwa', 18, 245, [15000, 12000, 500]],
  ['NVDA', 'NVIDIA', 'rwa', 18, 182, [15000, 12000, 500]],
  ['TSLA', 'Tesla', 'rwa', 18, 412, [17500, 13000, 600]],
  ['MSFT', 'Microsoft', 'rwa', 18, 505, [15000, 12000, 500]],
  ['AMZN', 'Amazon', 'rwa', 18, 228, [15000, 12000, 500]],
  ['GOOGL', 'Alphabet', 'rwa', 18, 247, [15000, 12000, 500]],
  ['META', 'Meta Platforms', 'rwa', 18, 760, [15000, 12000, 500]],
  ['JPM', 'JPMorgan Chase', 'rwa', 18, 305, [15000, 12000, 500]],
  ['V', 'Visa', 'rwa', 18, 348, [15000, 12000, 500]],
  ['WMT', 'Walmart', 'rwa', 18, 101, [15000, 12000, 500]],
  ['SKY', 'Sky Meme', 'experimental', 18, null, null],
  ['CLOUD', 'Cloud Pass', 'nft', 0, null, null]
];

export function previewTokens() {
  return CATALOG.map(([symbol, name, cls, decimals, px, risk, coll], i) => ({
    address: A(0xae00 + i), symbol, name, class: cls, decimals, verified: 'aerent', logo: logoForSymbol(symbol),
    cfg: {
      class: cls, listingEnabled: true, collateralEnabled: !!coll, fixedCollateralAllowed: cls === 'experimental',
      stockToken: cls === 'rwa', priceFeed: px ? A(0xfeed + i) : '0x' + '0'.repeat(40), heartbeat: px ? 86400 : 0,
      minCollateralRatioBps: risk?.[0] || 0, liquidationRatioBps: risk?.[1] || 0, liquidationBonusBps: risk?.[2] || 0
    },
    refPrice: px
  }));
}

export function createPreviewSource() {
  const tokens = previewTokens();
  const bySym = Object.fromEntries(tokens.map(t => [t.symbol, t]));
  const byAddr = new Map(tokens.map(t => [t.address.toLowerCase(), t]));
  const units = (sym, n) => BigInt(Math.round(n * 1e6)) * 10n ** BigInt(bySym[sym].decimals) / 1000000n;
  const lenders = [A(0x1ea1), A(0x2b0b), A(0x3ca7), A(0x4d0e)];
  const now = () => Math.floor(Date.now() / 1000);

  function seed() {
    let id = 0;
    const mk = (lender, sym, amount, collSym, collateral, fee, days) => ({
      id: ++id, kind: sym === 'CLOUD' ? 'nft' : 'fungible', status: 'open',
      oracle: !!bySym[sym].refPrice, lender, renter: A(0), asset: bySym[sym].address,
      amount: sym === 'CLOUD' ? BigInt(amount) : units(sym, amount), collateralToken: bySym[collSym].address,
      collateral: units(collSym, collateral), fee: units(collSym, fee), duration: days * 86400,
      startedAt: 0, dueAt: 0, grace: 0, protocolFeeBps: 0, liqRatioBps: 0, liqBonusBps: 0
    });
    return [
      mk(lenders[0], 'AAPL', 12, 'USDG', 4500, 28, 30),
      mk(lenders[1], 'NVDA', 40, 'USDG', 11000, 64, 14),
      mk(lenders[2], 'TSLA', 5, 'USDG', 3700, 19, 7),
      mk(lenders[0], 'MSFT', 8, 'USDG', 6100, 36, 21),
      mk(lenders[3], 'AMZN', 20, 'WETH', 1.7, 0.007, 10),
      mk(lenders[1], 'META', 3, 'USDG', 3450, 22, 14),
      mk(lenders[2], 'GOOGL', 15, 'USDG', 5600, 31, 30),
      mk(lenders[3], 'USDG', 25000, 'WETH', 6.4, 0.02, 7),
      mk(lenders[0], 'WETH', 4, 'USDG', 28500, 95, 5),
      mk(lenders[1], 'JPM', 10, 'USDG', 4600, 24, 14),
      mk(lenders[2], 'SKY', 2500000, 'USDG', 4800, 192, 3),
      mk(lenders[3], 'CLOUD', 482, 'USDG', 600, 18, 10),
      mk(lenders[0], 'V', 6, 'USDG', 3150, 15, 21),
      mk(lenders[1], 'WMT', 30, 'USDG', 4550, 20, 30)
    ];
  }

  function seedOffers() {
    const now = Math.floor(Date.now() / 1000);
    const mk = (id, who, sym, amount, collSym, collateral, fee, days, expDays) => ({
      id, status: 'open', renter: who, asset: bySym[sym].address, amount: units(sym, amount),
      collateralToken: bySym[collSym].address, collateral: units(collSym, collateral), fee: units(collSym, fee),
      duration: days * 86400, expiresAt: now + expDays * 86400, listingId: 0
    });
    return [
      mk(1, A(0x5a1e), 'NVDA', 25, 'USDG', 7_400, 48, 14, 3),
      mk(2, A(0x6b2f), 'AAPL', 8, 'USDG', 3_100, 21, 7, 2),
      mk(3, A(0x7c30), 'WETH', 2, 'USDG', 15_000, 64, 5, 4)
    ];
  }

  const KEY = 'aerent.preview.v4';
  let st = load(KEY, null);
  if (!st || st.version !== 4) {
    st = {
      version: 4, listings: seed(), offers: seedOffers(), priceShift: {}, nfts: { [bySym.CLOUD.address]: { 7: PREVIEW_ACCOUNT } },
      balances: {}, paused: false
    };
  }
  st.offers ||= seedOffers();
  const persist = () => save(KEY, st);
  const bal = (token, who) => BigInt(st.balances[`${token.toLowerCase()}:${who.toLowerCase()}`] ?? 0);
  const setBal = (token, who, v) => { st.balances[`${token.toLowerCase()}:${who.toLowerCase()}`] = BigInt(v); };
  const move = (token, from, to, v) => {
    if (bal(token, from) < v) throw new Error('Insufficient balance for this preview transaction.');
    setBal(token, from, bal(token, from) - v); setBal(token, to, bal(token, to) + v);
  };
  const ESCROW = A(0xa3e7);

  function fund(account) {
    const k = `funded:${account.toLowerCase()}`;
    if (st[k]) return;
    st[k] = true;
    const give = { USDG: 250000, WETH: 20, AAPL: 50, NVDA: 120, TSLA: 10, MSFT: 20, SKY: 50000000 };
    for (const [s, n] of Object.entries(give)) setBal(bySym[s].address, account, bal(bySym[s].address, account) + units(s, n));
    // lenders hold what they listed in escrow already; give escrow the seeded assets
    for (const l of st.listings) if (l.kind === 'fungible' && l.status === 'open' && !st[`esc:${l.id}`]) { setBal(l.asset, ESCROW, bal(l.asset, ESCROW) + l.amount); st[`esc:${l.id}`] = true; }
    st.nfts[bySym.CLOUD.address][7] = account;
    persist();
  }

  const priceUsd = token => {
    const t = byAddr.get(token.toLowerCase());
    if (!t?.refPrice) return null;
    return t.refPrice * (1 + (st.priceShift[t.symbol] || 0) / 100);
  };
  const cfg = token => byAddr.get(token.toLowerCase())?.cfg;
  const value = (token, raw) => (Number(raw) / 10 ** byAddr.get(token.toLowerCase()).decimals) * priceUsd(token);

  function hf(l) {
    if (!l.oracle || l.status !== 'rented') return Infinity;
    const av = value(l.asset, l.amount), cv = value(l.collateralToken, l.collateral);
    return (cv * 10000) / (av * l.liqRatioBps);
  }
  function required(l) {
    if (!l.oracle) return l.collateral;
    const a = cfg(l.asset), c = byAddr.get(l.collateralToken.toLowerCase());
    const need = (value(l.asset, l.amount) * a.minCollateralRatioBps) / 10000 / priceUsd(l.collateralToken);
    const raw = BigInt(Math.ceil(need * 10 ** Math.min(c.decimals, 12))) * 10n ** BigInt(Math.max(0, c.decimals - 12));
    return raw > l.collateral ? raw : l.collateral;
  }
  const find = id => { const l = st.listings.find(x => x.id === Number(id)); if (!l) throw new Error('That listing does not exist.'); return l; };
  const need = (cond, msg) => { if (!cond) throw new Error(msg); };

  const ops = {
    createListing({ asset, kind, amount, collateralToken, collateral, fee, duration, account }) {
      need(!st.paused, 'New listings and rentals are paused. Returns and settlements still work.');
      need(cfg(asset)?.listingEnabled, 'This asset is not on the AERENT allowlist.');
      need(cfg(collateralToken)?.collateralEnabled, 'That collateral token is not accepted.');
      need(duration >= 3600 && duration <= 365 * 86400, 'Duration must be between 1 hour and 365 days.');
      need(collateral > 0n, 'Collateral must be greater than zero.');
      if (kind === 'nft') {
        need(sameAddr(st.nfts[asset]?.[String(amount)], account), 'This wallet does not own that NFT.');
        st.nfts[asset][String(amount)] = ESCROW;
      } else move(asset, account, ESCROW, amount);
      const l = {
        id: st.listings.length + 1, kind, status: 'open', oracle: !!priceUsd(asset), lender: account, renter: A(0), asset,
        amount, collateralToken, collateral, fee, duration, startedAt: 0, dueAt: 0, grace: 0, protocolFeeBps: 0, liqRatioBps: 0, liqBonusBps: 0
      };
      st.listings.push(l);
      return l.id;
    },
    rent({ listing, collateral, account }) {
      const l = find(listing.id);
      need(!st.paused, 'New listings and rentals are paused. Returns and settlements still work.');
      need(l.status === 'open', 'This listing is no longer open.');
      need(!sameAddr(l.lender, account), 'You cannot rent your own listing.');
      need(collateral >= required(l), 'Collateral is below the required amount.');
      move(l.collateralToken, account, ESCROW, collateral + l.fee);
      move(l.collateralToken, ESCROW, l.lender, l.fee);
      if (l.kind === 'fungible') move(l.asset, ESCROW, account, l.amount);
      const a = cfg(l.asset);
      Object.assign(l, {
        status: 'rented', renter: account, collateral, startedAt: now(), dueAt: now() + l.duration, grace: 43200,
        liqRatioBps: a.liquidationRatioBps, liqBonusBps: a.liquidationBonusBps
      });
    },
    addCollateral({ listing, amount, account }) {
      const l = find(listing.id);
      need(l.status === 'rented' && sameAddr(l.renter, account), 'Only the renter can add collateral.');
      move(l.collateralToken, account, ESCROW, amount);
      l.collateral += amount;
    },
    returnRental({ listing, account }) {
      const l = find(listing.id);
      need(l.status === 'rented', 'This rental is no longer active.');
      need(sameAddr(l.renter, account), 'Only the renter can return this rental.');
      if (l.kind === 'fungible') move(l.asset, account, l.lender, l.amount);
      else st.nfts[l.asset][String(l.amount)] = l.lender;
      move(l.collateralToken, ESCROW, account, l.collateral);
      l.status = 'returned';
    },
    cancel({ listing, account }) {
      const l = find(listing.id);
      need(l.status === 'open' && sameAddr(l.lender, account), 'Only the lender can cancel an open listing.');
      if (l.kind === 'fungible') move(l.asset, ESCROW, account, l.amount); else st.nfts[l.asset][String(l.amount)] = account;
      l.status = 'cancelled';
    },
    claimDefault({ listing, account }) {
      const l = find(listing.id);
      need(l.status === 'rented' && l.kind === 'fungible', 'This rental cannot be defaulted.');
      need(sameAddr(l.lender, account), 'Only the lender can claim collateral.');
      need(now() > l.dueAt + l.grace, 'Not available yet. Wait for the term and grace period to end.');
      move(l.collateralToken, ESCROW, account, l.collateral);
      l.status = 'defaulted';
    },
    settle({ listing }) {
      const l = find(listing.id);
      need(l.status === 'rented' && l.kind === 'nft', 'Only NFT rentals can be settled.');
      need(now() > l.dueAt, 'The rental term has not ended yet.');
      st.nfts[l.asset][String(l.amount)] = l.lender;
      move(l.collateralToken, ESCROW, l.renter, l.collateral);
      l.status = 'settled';
    },
    createOffer({ asset, amount, collateralToken, collateral, fee, duration, expiresAt, account }) {
      need(!st.paused, 'New listings and rentals are paused. Returns and settlements still work.');
      need(cfg(asset)?.listingEnabled && cfg(asset)?.class !== 'nft', 'This asset cannot be requested.');
      need(cfg(collateralToken)?.collateralEnabled, 'That collateral token is not accepted.');
      move(collateralToken, account, ESCROW, collateral + fee);
      st.offers.push({ id: st.offers.length + 1, status: 'open', renter: account, asset, amount, collateralToken, collateral, fee, duration, expiresAt, listingId: 0 });
    },
    cancelOffer({ offer, account }) {
      const o = st.offers.find(x => x.id === Number(offer.id));
      need(o && o.status === 'open', 'This request is no longer open.');
      need(sameAddr(o.renter, account), 'Only the renter can cancel this request.');
      move(o.collateralToken, ESCROW, account, o.collateral + o.fee);
      o.status = 'cancelled';
    },
    fillOffer({ offer, account }) {
      const o = st.offers.find(x => x.id === Number(offer.id));
      need(o && o.status === 'open', 'This request is no longer open.');
      need(!st.paused, 'New listings and rentals are paused. Returns and settlements still work.');
      need(now() < o.expiresAt, 'This request has expired.');
      need(!sameAddr(o.renter, account), 'You cannot fill your own request.');
      const a = cfg(o.asset);
      if (priceUsd(o.asset)) {
        const av = value(o.asset, o.amount), cv = value(o.collateralToken, o.collateral);
        need(cv * 10000 >= av * a.minCollateralRatioBps, 'The renter has not posted enough collateral.');
      }
      move(o.asset, account, o.renter, o.amount);
      move(o.collateralToken, ESCROW, account, o.fee);
      const l = {
        id: st.listings.length + 1, kind: 'fungible', status: 'rented', oracle: !!priceUsd(o.asset), lender: account,
        renter: o.renter, asset: o.asset, amount: o.amount, collateralToken: o.collateralToken, collateral: o.collateral,
        fee: o.fee, duration: o.duration, startedAt: now(), dueAt: now() + o.duration, grace: 43200, protocolFeeBps: 0,
        liqRatioBps: a.liquidationRatioBps, liqBonusBps: a.liquidationBonusBps
      };
      st.listings.push(l);
      o.status = 'filled'; o.listingId = l.id;
    },
    liquidate({ listing, account }) {
      const l = find(listing.id);
      need(l.status === 'rented' && l.oracle, 'This position cannot be liquidated.');
      const h = hf(l);
      need(h < 1, 'This position is healthy and cannot be liquidated.');
      move(l.asset, account, l.lender, l.amount);
      const av = value(l.asset, l.amount), cv = value(l.collateralToken, l.collateral);
      let seize = BigInt(Math.floor(Number(l.collateral) * (av * (10000 + l.liqBonusBps)) / (cv * 10000)));
      if (seize > l.collateral) seize = l.collateral;
      move(l.collateralToken, ESCROW, account, seize);
      if (l.collateral - seize > 0n) move(l.collateralToken, ESCROW, l.renter, l.collateral - seize);
      l.status = 'liquidated';
    }
  };

  const step = (label, detail, run) => ({ label, detail, simulate: run });
  const plans = {
    createOffer: a => [step(`Approve ${a.collateralSymbol}`, 'Collateral plus fee.', null), step('Post request', 'Escrows your collateral and fee.', () => ops.createOffer(a))],
    cancelOffer: a => [step('Cancel request', 'Returns your collateral and fee.', () => ops.cancelOffer(a))],
    fillOffer: a => [step(`Approve ${a.symbol}`, 'The quantity the renter asked for.', null), step('Fill request', 'Sends the asset and pays you the fee now.', () => ops.fillOffer(a))],
    createListing: a => [step(a.kind === 'nft' ? `Approve ${a.symbol} #${a.amount}` : `Approve ${a.symbol}`, 'Lets AERENT move exactly this amount.', null), step('Create listing', 'Moves the asset into AERENT escrow.', () => ops.createListing(a))],
    rent: a => [step(`Approve ${a.collateralSymbol}`, 'Collateral plus fee.', null), step(`Rent ${a.symbol}`, 'Posts collateral, pays the fee, starts the term.', () => ops.rent(a))],
    addCollateral: a => [step(`Approve ${a.collateralSymbol}`, 'Top-up amount only.', null), step('Add collateral', 'Raises the health factor.', () => ops.addCollateral(a))],
    returnRental: a => [...(a.listing.kind === 'fungible' ? [step(`Approve ${a.symbol}`, 'The rented quantity.', null)] : []), step(`Return ${a.symbol}`, 'Sends the asset back and releases collateral.', () => ops.returnRental(a))],
    liquidate: a => [step(`Approve ${a.symbol}`, 'The rented quantity, delivered to the lender.', null), step('Liquidate', 'Repays the lender and pays you discounted collateral.', () => ops.liquidate(a))],
    cancel: a => [step('Cancel listing', 'Returns the asset from escrow.', () => ops.cancel(a))],
    claimDefault: a => [step('Claim collateral', 'The term and grace period have ended.', () => ops.claimDefault(a))],
    settle: a => [step('Settle rental', 'NFT back to lender, collateral back to renter.', () => ops.settle(a))]
  };
  // wrap simulate so state persists after each step
  for (const k of Object.keys(plans)) {
    const orig = plans[k];
    plans[k] = a => orig(a).map(s => ({ ...s, simulate: s.simulate ? () => { const r = s.simulate(); persist(); return r; } : null }));
  }

  return {
    mode: 'preview', address: ESCROW, tokens,
    fund,
    async listings() { return st.listings.map(l => ({ ...l })); },
    async offers() { return st.offers.map(o => ({ ...o })); },
    async getOffer(id) { return { ...st.offers.find(o => o.id === Number(id)) }; },
    async getListing(id) { return { ...find(id) }; },
    async assetConfig(token) { return cfg(token) || { class: 'none' }; },
    async price(token) { const p = priceUsd(token); return p == null ? { usd: null, error: 'No oracle: fixed collateral market' } : { usd: p }; },
    async health(l) { return hf(find(l.id)); },
    async required(l) { return required(find(l.id)); },
    async paused() { return st.paused; },
    async protocolFeeBps() { return 0; },
    async gracePeriod() { return 43200; },
    async allowlisted() { return tokens.map(t => t.address); },
    async balance(token, owner) { return bal(token, owner); },
    async claimable() { return 0n; },
    async nativeBalance() { return 5n * 10n ** 17n; },
    async nftOwner(token, id) { return st.nfts[token]?.[String(id)] || null; },
    ownedNfts(owner) { return Object.entries(st.nfts).flatMap(([t, m]) => Object.entries(m).filter(([, o]) => sameAddr(o, owner)).map(([id]) => ({ token: t, id }))); },
    plans,
    priceShift: () => ({ ...st.priceShift }),
    setPriceShift(symbol, pct) { st.priceShift[symbol] = pct; persist(); },
    warp(seconds) { for (const l of st.listings) if (l.status === 'rented') { l.dueAt -= seconds; l.startedAt -= seconds; } persist(); },
    reset() { localStorage.removeItem(KEY); }
  };
}
