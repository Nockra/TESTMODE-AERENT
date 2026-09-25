// Minimal ABI encoding for the fixed set of calls AERENT makes. All arguments are static types.
export const SEL = {
  listingCount: '0xa9b07c26',
  getListing: '0x107a274a',
  getListings: '0x1f5a9ddc',
  listingsOf: '0x86e2c84d',
  assetConfig: '0xd6dbaf58',
  priceOf: '0xb95ed06f',
  healthFactor: '0xbc71054e',
  paused: '0x5c975abb',
  protocolFeeBps: '0x35659fb8',
  gracePeriod: '0xa06db7dc',
  createListing: '0xa1ec3f8f',
  rent: '0x075b862e',
  addCollateral: '0xa8f35adf',
  returnRental: '0x3310df9e',
  cancelListing: '0x305a67a8',
  claimDefault: '0xfacd66c7',
  settleExpired: '0x87641eb2',
  liquidate: '0x415f1240',
  claimable: '0xd4570c1c',
  createOffer: '0x007e5f46',
  cancelOffer: '0xef706adf',
  fillOffer: '0x78447e7f',
  getOffer: '0x4579268a',
  getOffers: '0x52afdabb',
  offerCount: '0x1115c24d',
  offersOf: '0xfa04a1aa',
  assetList: '0xe372f03a',
  withdraw: '0xf940e385',
  // ERC-20 / ERC-721
  approve: '0x095ea7b3',
  allowance: '0xdd62ed3e',
  balanceOf: '0x70a08231',
  decimals: '0x313ce567',
  symbol: '0x95d89b41',
  name: '0x06fdde03',
  isApprovedForAll: '0xe985e9c5',
  setApprovalForAll: '0xa22cb465',
  getApproved: '0x081812fc',
  ownerOf: '0x6352211e'
};

export const TOPIC = {
  ListingCreated: '0x119f1da1ca0878bb08d858f7e37f0f7acd3fb7ebd837808f487583fa41ed9553',
  Rented: '0x20a0d3b54ff37263cc7a307c935d524b334c87c701e123ec380fadae44c930db',
  CollateralAdded: '0x935a476d8eb416e1441bbdc27477a7d90012bed1a74dba06f77fc32b8b119bd8',
  Returned: '0x67ffb28c0e498947b5c148a385ed64809190a87d2a053c40be021f28c69181ec',
  Settled: '0x1ddc75d9b5fc6d37e23b3284e94f0db77b95dfe06b38540ac86c16e6ee3f7238',
  DefaultClaimed: '0x730f277277cc712e23a43a4a3ce8679a46f58324ed8b495405bcfe1ecee3abc7',
  Liquidated: '0x969067f3911888d4f34a9dba2e904ea5e0dcd3323ccf9692ef8f091c6a4326a5',
  ListingCancelled: '0x411aee90354c51b1b04cd563fcab2617142a9d50da19232d888547c8a1b7fd8a',
  OfferCreated: '0x976b2b83a1c06e4fe710caff604c898fe5411a1d301d66cf76950cc3106a6171',
  OfferCancelled: '0x1f51377b3e685a0e2419f9bb4ba7c07ec54936353ba3d0fb3c6538dab6766222',
  OfferFilled: '0xcae2596881a3c8ab55a8e33991e752b0b50eafee18d026c0c38f0a6af5e4f577'
};

const strip = h => String(h || '').replace(/^0x/, '');
export const encUint = v => BigInt(v).toString(16).padStart(64, '0');
export const encAddr = a => strip(a).toLowerCase().padStart(64, '0');
export const encBool = b => encUint(b ? 1 : 0);
export const call = (sel, ...words) => sel + words.join('');

export const word = (hex, i) => strip(hex).slice(i * 64, i * 64 + 64);
export const uint = (hex, i = 0) => BigInt('0x' + (word(hex, i) || '0'));
export const addr = (hex, i = 0) => '0x' + word(hex, i).slice(24);
export const bool = (hex, i = 0) => uint(hex, i) !== 0n;

export function str(hex) {
  const raw = strip(hex);
  if (!raw) return '';
  try {
    if (raw.length === 64) return new TextDecoder().decode(hexBytes(raw)).replace(/\0+$/, '').trim();
    const off = Number(BigInt('0x' + raw.slice(0, 64))) * 2;
    const len = Number(BigInt('0x' + raw.slice(off, off + 64)));
    return new TextDecoder().decode(hexBytes(raw.slice(off + 64, off + 64 + len * 2))).trim();
  } catch { return ''; }
}
const hexBytes = h => new Uint8Array((h.match(/.{2}/g) || []).map(b => parseInt(b, 16)));

const STATUS = ['open', 'rented', 'returned', 'defaulted', 'liquidated', 'cancelled', 'settled'];
export const LISTING_WORDS = 18;

/** Decode a Listing struct starting at word index `o` */
export function listingAt(hex, o = 0) {
  const kind = Number(uint(hex, o + 1)) === 1 ? 'nft' : 'fungible';
  return {
    id: Number(uint(hex, o)),
    kind,
    status: STATUS[Number(uint(hex, o + 2))] || 'open',
    oracle: bool(hex, o + 3),
    lender: addr(hex, o + 4),
    renter: addr(hex, o + 5),
    asset: addr(hex, o + 6),
    amount: uint(hex, o + 7),
    collateralToken: addr(hex, o + 8),
    collateral: uint(hex, o + 9),
    fee: uint(hex, o + 10),
    duration: Number(uint(hex, o + 11)),
    startedAt: Number(uint(hex, o + 12)),
    dueAt: Number(uint(hex, o + 13)),
    grace: Number(uint(hex, o + 14)),
    protocolFeeBps: Number(uint(hex, o + 15)),
    liqRatioBps: Number(uint(hex, o + 16)),
    liqBonusBps: Number(uint(hex, o + 17))
  };
}

/** Decode Listing[] returned by getListings */
export function listingArray(hex) {
  const off = Number(uint(hex, 0)) / 32;
  const len = Number(uint(hex, off));
  const out = [];
  for (let i = 0; i < len; i++) out.push(listingAt(hex, off + 1 + i * LISTING_WORDS));
  return out;
}

const OFFER_STATUS = ['open', 'filled', 'cancelled'];
export const OFFER_WORDS = 11;

/** Decode an Offer struct starting at word index `o` */
export function offerAt(hex, o = 0) {
  return {
    id: Number(uint(hex, o)),
    status: OFFER_STATUS[Number(uint(hex, o + 1))] || 'open',
    renter: addr(hex, o + 2),
    asset: addr(hex, o + 3),
    amount: uint(hex, o + 4),
    collateralToken: addr(hex, o + 5),
    collateral: uint(hex, o + 6),
    fee: uint(hex, o + 7),
    duration: Number(uint(hex, o + 8)),
    expiresAt: Number(uint(hex, o + 9)),
    listingId: Number(uint(hex, o + 10))
  };
}

export function offerArray(hex) {
  const off = Number(uint(hex, 0)) / 32;
  const len = Number(uint(hex, off));
  const out = [];
  for (let i = 0; i < len; i++) out.push(offerAt(hex, off + 1 + i * OFFER_WORDS));
  return out;
}

export function uintArray(hex) {
  const off = Number(uint(hex, 0)) / 32;
  const len = Number(uint(hex, off));
  return Array.from({ length: len }, (_, i) => uint(hex, off + 1 + i));
}

const CLASSES = ['none', 'rwa', 'stablecoin', 'crypto', 'experimental', 'nft'];
export function assetConfigOf(hex) {
  return {
    class: CLASSES[Number(uint(hex, 0))] || 'none',
    listingEnabled: bool(hex, 1),
    collateralEnabled: bool(hex, 2),
    fixedCollateralAllowed: bool(hex, 3),
    stockToken: bool(hex, 4),
    decimals: Number(uint(hex, 5)),
    priceFeed: addr(hex, 6),
    heartbeat: Number(uint(hex, 7)),
    minCollateralRatioBps: Number(uint(hex, 8)),
    liquidationRatioBps: Number(uint(hex, 9)),
    liquidationBonusBps: Number(uint(hex, 10)),
    maxCollateralRatioBps: Number(uint(hex, 11)),
    maxFeeBps: Number(uint(hex, 12))
  };
}

const ERRORS = {
  NotAllowed: 'This wallet is not allowed to do that.',
  AssetNotListable: 'This asset is not on the AERENT allowlist.',
  CollateralNotAccepted: 'That collateral token is not accepted.',
  CollateralNeedsOracle: 'Oracle-priced assets need oracle-priced collateral.',
  OracleRequired: 'This asset needs an oracle before it can be rented.',
  UnexpectedTransferAmount: 'The token did not transfer the exact amount. Fee-on-transfer and rebasing tokens are not supported.',
  InvalidStatus: 'This position has already changed state. Refresh and try again.',
  NotRenter: 'Only the renter can do this.',
  NotLender: 'Only the lender can do this.',
  TooEarly: 'Not available yet. Wait for the term and grace period to end.',
  Healthy: 'This position is healthy and cannot be liquidated.',
  Undercollateralised: 'Collateral is below the required amount.',
  StalePrice: 'The oracle price is stale. Try again after the next update.',
  InvalidPrice: 'The oracle returned an invalid price.',
  SequencerDown: 'Robinhood Chain sequencer is recovering. Prices are paused briefly.',
  OraclePaused: 'Price updates are paused for a corporate action on this Stock Token.',
  BadParameter: 'One of the values is outside the allowed range.',
  UnknownListing: 'That listing does not exist on this network.',
  OfferExpired: 'This request has expired. The renter can withdraw their collateral.',
  UnknownOffer: 'That request does not exist on this network.',
  CollateralTooHigh: 'The collateral on this listing is above the cap for this asset, so the rental cannot start.',
  FeeTooHigh: 'The fee on this listing is above the cap for this asset, so the rental cannot start.',
  EnforcedPause: 'New listings and rentals are paused. Returns and settlements still work.'
};
const ERROR_SEL = {
  '0x3d693ada': 'NotAllowed', '0x59dabf4c': 'AssetNotListable', '0x00ef4e95': 'CollateralNotAccepted', '0x9b82964c': 'CollateralNeedsOracle',
  '0x538d362c': 'OracleRequired', '0x4168cf8d': 'UnexpectedTransferAmount', '0xf525e320': 'InvalidStatus', '0x31abab61': 'NotRenter',
  '0x8c380003': 'NotLender', '0x085de625': 'TooEarly', '0xda1dae0c': 'Healthy', '0xd21aaddd': 'Undercollateralised', '0x19abf40e': 'StalePrice',
  '0x00bfc921': 'InvalidPrice', '0x032b3d00': 'SequencerDown', '0xe28b7053': 'OraclePaused', '0x8ec48e16': 'BadParameter',
  '0xd93c0665': 'EnforcedPause', '0xaf21e16c': 'UnknownListing', '0x9cb13087': 'OfferExpired', '0x52c55a2e': 'UnknownOffer', '0x714d5eb5': 'CollateralTooHigh', '0xcd4e6167': 'FeeTooHigh'
};
export function explainRevert(data) {
  const sel = String(data || '').slice(0, 10).toLowerCase();
  const name = ERROR_SEL[sel];
  return name ? ERRORS[name] : null;
}
