// Live data source: reads the AERENT contract through the indexer when configured, otherwise straight from the chain.
import { SEL, TOPIC, call, encUint, encAddr, encBool, uint, bool, addr, listingAt, listingArray, offerAt, offerArray, assetConfigOf } from './abi.js';
import { sameAddr } from './util.js';

const TOPIC_ASSET_CONFIGURED = '0x095cb891fb6b6ca12fff418690efb9b713280679987c0044ae336720707483ce';

export function createLiveSource({ network, rpc }) {
  const mkt = network.marketplaceContract;
  const cfgCache = new Map();
  const priceCache = new Map();

  const fromIndexer = row => ({
    ...row,
    amount: BigInt(row.amount), collateral: BigInt(row.collateral), fee: BigInt(row.fee)
  });

  async function listings() {
    if (network.indexerUrl) {
      try {
        const res = await fetch(`${network.indexerUrl.replace(/\/$/, '')}/listings?limit=5000`);
        if (res.ok) return (await res.json()).listings.map(fromIndexer);
      } catch { /* fall back to direct chain reads */ }
    }
    const total = Number(uint(await rpc.ethCall(mkt, SEL.listingCount)));
    const out = [];
    for (let offset = 0; offset < total; offset += 100) {
      const hex = await rpc.ethCall(mkt, call(SEL.getListings, encUint(offset), encUint(100), encBool(true)));
      out.push(...listingArray(hex));
    }
    return out;
  }

  async function offers() {
    const total = Number(uint(await rpc.ethCall(mkt, SEL.offerCount)));
    const out = [];
    for (let offset = 0; offset < total; offset += 100) {
      const hex = await rpc.ethCall(mkt, call(SEL.getOffers, encUint(offset), encUint(100), encBool(true)));
      out.push(...offerArray(hex));
    }
    return out;
  }

  async function getOffer(id) {
    return offerAt(await rpc.ethCall(mkt, call(SEL.getOffer, encUint(id))));
  }

  async function getListing(id) {
    return listingAt(await rpc.ethCall(mkt, call(SEL.getListing, encUint(id))));
  }

  async function assetConfig(token) {
    const k = token.toLowerCase();
    const hit = cfgCache.get(k);
    if (hit && Date.now() - hit.t < 120000) return hit.v;
    const v = assetConfigOf(await rpc.ethCall(mkt, call(SEL.assetConfig, encAddr(token))));
    cfgCache.set(k, { t: Date.now(), v });
    return v;
  }

  /** USD price or {error}. Never throws. */
  async function price(token) {
    const k = token.toLowerCase();
    const hit = priceCache.get(k);
    if (hit && Date.now() - hit.t < 15000) return hit.v;
    let v;
    try { v = { usd: Number(uint(await rpc.ethCall(mkt, call(SEL.priceOf, encAddr(token))))) / 1e18 }; }
    catch (err) { v = { usd: null, error: err.friendly ? err.message : 'No oracle price' }; }
    priceCache.set(k, { t: Date.now(), v });
    return v;
  }

  async function health(l) {
    if (!l.oracle || l.status !== 'rented') return Infinity;
    try {
      const raw = uint(await rpc.ethCall(mkt, call(SEL.healthFactor, encUint(l.id))));
      return raw > 10n ** 30n ? Infinity : Number(raw) / 1e18;
    } catch { return null; }
  }

  async function required(l) {
    if (!l.oracle) return l.collateral;
    try {
      const [a, c, ap, cp] = await Promise.all([
        assetConfig(l.asset), assetConfig(l.collateralToken), price(l.asset), price(l.collateralToken)
      ]);
      if (ap.usd == null || cp.usd == null) throw Object.assign(new Error(ap.error || cp.error || 'No oracle price'), { friendly: true });
      const assetValue = (Number(l.amount) / 10 ** a.decimals) * ap.usd;
      const needTokens = (assetValue * a.minCollateralRatioBps) / 10000 / cp.usd;
      // round up to the token's smallest unit, then keep the lender's minimum if it is higher
      const raw = BigInt(Math.ceil(needTokens * 10 ** Math.min(c.decimals, 9))) * 10n ** BigInt(Math.max(0, c.decimals - 9));
      return raw > l.collateral ? raw : l.collateral;
    } catch (err) {
      if (err.friendly) throw err;
      return l.collateral;
    }
  }

  async function paused() { try { return bool(await rpc.ethCall(mkt, SEL.paused)); } catch { return false; } }
  async function protocolFeeBps() { try { return Number(uint(await rpc.ethCall(mkt, SEL.protocolFeeBps))); } catch { return 0; } }
  async function gracePeriod() { try { return Number(uint(await rpc.ethCall(mkt, SEL.gracePeriod))); } catch { return 43200; } }

  async function allowlisted() {
    try {
      const hex = await rpc.ethCall(mkt, SEL.assetList);
      const off = Number(uint(hex, 0)) / 32, len = Number(uint(hex, off));
      return Array.from({ length: len }, (_, i) => addr(hex, off + 1 + i));
    } catch { /* older deployments without assetList(): fall back below */ }
    if (network.indexerUrl) {
      try {
        const res = await fetch(`${network.indexerUrl.replace(/\/$/, '')}/assets`);
        if (res.ok) return (await res.json()).assets.map(a => a.address);
      } catch {}
    }
    const head = Number(await rpc.request('eth_blockNumber'));
    const logs = await rpc.getLogs({ address: mkt, topics: [TOPIC_ASSET_CONFIGURED] }, Number(network.deployBlock || 0), head);
    return [...new Set(logs.map(l => '0x' + l.topics[1].slice(26)))];
  }

  async function balance(token, owner) {
    try { return uint(await rpc.ethCall(token, call(SEL.balanceOf, encAddr(owner)))); } catch { return 0n; }
  }
  async function claimable(token, owner) {
    try { return uint(await rpc.ethCall(mkt, call(SEL.claimable, encAddr(token), encAddr(owner)))); } catch { return 0n; }
  }
  async function nativeBalance(owner) { return BigInt(await rpc.request('eth_getBalance', [owner, 'latest'])); }
  async function allowance(token, owner) {
    try { return uint(await rpc.ethCall(token, call(SEL.allowance, encAddr(owner), encAddr(mkt)))); } catch { return 0n; }
  }
  async function nftApproved(token, owner, tokenId) {
    try {
      if (bool(await rpc.ethCall(token, call(SEL.isApprovedForAll, encAddr(owner), encAddr(mkt))))) return true;
      const a = '0x' + (await rpc.ethCall(token, call(SEL.getApproved, encUint(tokenId)))).slice(26);
      return sameAddr(a, mkt);
    } catch { return false; }
  }
  async function nftOwner(token, tokenId) {
    try { return '0x' + (await rpc.ethCall(token, call(SEL.ownerOf, encUint(tokenId)))).slice(26); } catch { return null; }
  }

  // ---- transaction plans: each step has a label and returns calldata, or null when already satisfied
  const approveStep = (token, symbol, amount, owner) => ({
    label: `Approve ${symbol}`,
    detail: 'Lets AERENT move exactly this amount. Nothing else.',
    build: async () => ((await allowance(token, owner)) >= amount ? null : { to: token, data: call(SEL.approve, encAddr(mkt), encUint(amount)) })
  });

  const plans = {
    createListing: ({ asset, kind, amount, collateralToken, collateral, fee, duration, symbol, account }) => [
      kind === 'nft'
        ? { label: `Approve ${symbol} #${amount}`, detail: 'Lets AERENT escrow this NFT.', build: async () => ((await nftApproved(asset, account, amount)) ? null : { to: asset, data: call(SEL.approve, encAddr(mkt), encUint(amount)) }) }
        : approveStep(asset, symbol, amount, account),
      { label: 'Create listing', detail: 'Moves the asset into AERENT escrow.', build: async () => ({ to: mkt, data: call(SEL.createListing, encAddr(asset), encUint(amount), encAddr(collateralToken), encUint(collateral), encUint(fee), encUint(duration)) }) }
    ],
    rent: ({ listing, collateral, collateralSymbol, symbol, account }) => [
      approveStep(listing.collateralToken, collateralSymbol, collateral + listing.fee, account),
      { label: `Rent ${symbol}`, detail: 'Posts collateral, pays the fee, starts the term.', build: async () => ({ to: mkt, data: call(SEL.rent, encUint(listing.id), encUint(collateral), encUint(listing.fee)) }) }
    ],
    addCollateral: ({ listing, amount, collateralSymbol, account }) => [
      approveStep(listing.collateralToken, collateralSymbol, amount, account),
      { label: 'Add collateral', detail: 'Raises the health factor of this rental.', build: async () => ({ to: mkt, data: call(SEL.addCollateral, encUint(listing.id), encUint(amount)) }) }
    ],
    returnRental: ({ listing, symbol, account }) => [
      ...(listing.kind === 'fungible' ? [approveStep(listing.asset, symbol, listing.amount, account)] : []),
      { label: `Return ${symbol}`, detail: 'Sends the asset back and releases your collateral.', build: async () => ({ to: mkt, data: call(SEL.returnRental, encUint(listing.id)) }) }
    ],
    liquidate: ({ listing, symbol, account }) => [
      approveStep(listing.asset, symbol, listing.amount, account),
      { label: 'Liquidate', detail: 'Repays the lender and pays you discounted collateral.', build: async () => ({ to: mkt, data: call(SEL.liquidate, encUint(listing.id)) }) }
    ],
    cancel: ({ listing }) => [{ label: 'Cancel listing', detail: 'Returns the asset from escrow.', build: async () => ({ to: mkt, data: call(SEL.cancelListing, encUint(listing.id)) }) }],
    claimDefault: ({ listing }) => [{ label: 'Claim collateral', detail: 'The term and grace period have ended.', build: async () => ({ to: mkt, data: call(SEL.claimDefault, encUint(listing.id)) }) }],
    withdraw: ({ token, to, symbol }) => [{ label: `Withdraw ${symbol}`, detail: 'Sends a deferred payment to the address you chose.', build: async () => ({ to: mkt, data: call(SEL.withdraw, encAddr(token), encAddr(to)) }) }],
    createOffer: ({ asset, amount, collateralToken, collateral, fee, duration, expiresAt, collateralSymbol, account }) => [
      approveStep(collateralToken, collateralSymbol, collateral + fee, account),
      { label: 'Post request', detail: 'Escrows your collateral and fee until someone fills it or you cancel.', build: async () => ({ to: mkt, data: call(SEL.createOffer, encAddr(asset), encUint(amount), encAddr(collateralToken), encUint(collateral), encUint(fee), encUint(duration), encUint(expiresAt)) }) }
    ],
    cancelOffer: ({ offer }) => [{ label: 'Cancel request', detail: 'Returns your collateral and fee.', build: async () => ({ to: mkt, data: call(SEL.cancelOffer, encUint(offer.id)) }) }],
    fillOffer: ({ offer, symbol, account }) => [
      approveStep(offer.asset, symbol, offer.amount, account),
      { label: `Fill request`, detail: 'Sends the asset to the renter and pays you the fee now.', build: async () => ({ to: mkt, data: call(SEL.fillOffer, encUint(offer.id), encUint(offer.fee)) }) }
    ],
    settle: ({ listing }) => [{ label: 'Settle rental', detail: 'NFT back to lender, collateral back to renter.', build: async () => ({ to: mkt, data: call(SEL.settleExpired, encUint(listing.id)) }) }]
  };

  return {
    mode: 'live', address: mkt,
    listings, offers, getOffer, getListing, assetConfig, price, health, required, paused, protocolFeeBps, gracePeriod, allowlisted,
    balance, claimable, nativeBalance, allowance, nftOwner, plans
  };
}
