// Builds the Safe Transaction Builder batch that allowlists assets on AerentMarketplace.
// Every row is checked before it is written: the token must be in Robinhood's registry (Stock Tokens) or the
// canonical list below, the feed must be in Chainlink's Robinhood directory, and both are read onchain
// (symbol, decimals, description, a positive and recent answer). Any mismatch aborts the whole batch.
//
//   node script/configure-assets.mjs --market 0xMARKET --safe 0xSAFE --rpc https://your-rpc \
//        --stocks AAPL,NVDA,TSLA,MSFT,AMZN,GOOGL,META > safe-batch.json
//
// Then in app.safe.global: Apps > Transaction Builder > drag in safe-batch.json > review > sign.
// Offline inputs (for air-gapped review or tests): --assets-file rh-assets.json --feeds-file feeds.json
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const need = k => { if (!args[k]) { console.error(`missing --${k}`); process.exit(1); } return args[k]; };
const MARKET = need('market'), SAFE = need('safe'), RPC = need('rpc');
const CHAIN_ID = Number(args.chain || 4663);
const STOCKS = (args.stocks || 'AAPL,NVDA,TSLA,MSFT,AMZN,GOOGL,META').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const INCLUDE_WETH = args.weth !== 'false';

// Canonical non-stock tokens (docs.robinhood.com/chain/contracts) and the Chainlink feed name that prices them.
const CANONICAL = [
  { symbol: 'USDG', address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', feedName: 'USDG / USD', cls: 2, listing: true, collateral: true, risk: [11000, 10500, 200], caps: [15000, 500], heartbeat: 93600 },
  ...(INCLUDE_WETH ? [{ symbol: 'WETH', address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', feedName: 'ETH / USD', cls: 3, listing: true, collateral: true, risk: [16000, 12500, 600], caps: [22000, 1000], heartbeat: 93600 }] : [])
];
// Stock feeds do not update when US equity sessions are closed, so the staleness window must cover weekends and holidays.
const STOCK_HEARTBEAT = Number(args['stock-heartbeat'] || 345600); // 4 days
const STOCK_RISK = (args['stock-risk'] || '15000,12000,500').split(',').map(Number);
// renter protections: collateral ceiling and the maximum fee, both in basis points of the asset's value
const STOCK_CAPS = (args['stock-caps'] || '20000,1000').split(',').map(Number);

const loadJson = async (file, url) => (file ? JSON.parse(readFileSync(file, 'utf8')) : (await (await fetch(url)).json()));
let id = 0;
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
  const j = await r.json(); if (j.error) throw new Error(`${method}: ${j.error.message}`); return j.result;
}
const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);
const str = h => { const raw = h.slice(2); if (!raw) return ''; const off = Number(BigInt('0x' + raw.slice(0, 64))) * 2; const len = Number(BigInt('0x' + raw.slice(off, off + 64))); return Buffer.from(raw.slice(off + 64, off + 64 + len * 2), 'hex').toString('utf8'); };
const w = v => BigInt(v).toString(16).padStart(64, '0');
const a = v => v.toLowerCase().replace('0x', '').padStart(64, '0');
const fail = m => { console.error('ABORT:', m); process.exit(2); };

const chainId = Number(await rpc('eth_chainId', []));
if (chainId !== CHAIN_ID) fail(`RPC is on chain ${chainId}, expected ${CHAIN_ID}`);
if ((await rpc('eth_getCode', [MARKET, 'latest'])).length < 10) fail('no contract at --market');

const feeds = await loadJson(args['feeds-file'], 'https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json');
const rh = await loadJson(args['assets-file'], 'https://api.robinhood.com/rhj/assets');
const feedByName = new Map(feeds.map(f => [f.name, f]));

async function checkToken(address, symbol, decimalsExpected) {
  if ((await rpc('eth_getCode', [address, 'latest'])).length < 10) fail(`${symbol}: no contract at ${address}`);
  const s = str(await call(address, '0x95d89b41'));
  const d = Number(BigInt(await call(address, '0x313ce567')));
  if (s.toUpperCase() !== symbol.toUpperCase()) fail(`${symbol}: onchain symbol is "${s}"`);
  if (decimalsExpected != null && d !== decimalsExpected) fail(`${symbol}: decimals ${d}, expected ${decimalsExpected}`);
  return d;
}
async function checkFeed(feed, label, maxAge) {
  const proxy = feed.proxyAddress;
  const desc = str(await call(proxy, '0x7284e416'));
  const dec = Number(BigInt(await call(proxy, '0x313ce567')));
  const r = await call(proxy, '0xfeaf968c');
  const answer = BigInt.asIntN(256, BigInt('0x' + r.slice(66, 130)));
  const updatedAt = Number(BigInt('0x' + r.slice(194, 258)));
  if (answer <= 0n) fail(`${label}: feed answer not positive`);
  const age = Math.floor(Date.now() / 1000) - updatedAt;
  if (age > maxAge) fail(`${label}: feed last updated ${age}s ago, above ${maxAge}s`);
  if (dec !== feed.decimals) fail(`${label}: feed decimals ${dec} differ from directory ${feed.decimals}`);
  console.error(`ok  ${label.padEnd(6)} feed ${proxy} "${desc}" ${Number(answer) / 10 ** dec} (age ${age}s)`);
  return proxy;
}

// configureAsset(address,(uint8 class,bool listing,bool collateral,bool fixed,bool stock,uint8 dec,address feed,uint32 hb,uint16 minCR,uint16 liq,uint16 bonus,uint16 maxCR,uint16 maxFee))
const SELECTOR = '0x422620f8';
const encode = (token, c) => SELECTOR + a(token) + w(c.cls) + w(c.listing ? 1 : 0) + w(c.collateral ? 1 : 0) + w(0) + w(c.stock ? 1 : 0) + w(0) + a(c.feed) + w(c.heartbeat) + w(c.risk[0]) + w(c.risk[1]) + w(c.risk[2]) + w(c.caps[0]) + w(c.caps[1]);

const txs = [];
const report = [];
for (const t of CANONICAL) {
  const feed = feedByName.get(t.feedName) || fail(`${t.symbol}: feed "${t.feedName}" not in Chainlink directory`);
  await checkToken(t.address, t.symbol);
  const proxy = await checkFeed(feed, t.symbol, t.heartbeat);
  txs.push(encode(t.address, { ...t, feed: proxy, stock: false }));
  report.push({ symbol: t.symbol, token: t.address, feed: proxy, heartbeat: t.heartbeat, risk: t.risk, caps: t.caps });
}
for (const sym of STOCKS) {
  const asset = (rh.assets || []).find(x => x.tokenSymbol === sym && x.status === 'ASSET_STATUS_ACTIVE') || fail(`${sym}: not an active asset in the Robinhood registry`);
  const dep = asset.deployments.find(d => Number(d.chainId) === CHAIN_ID) || fail(`${sym}: no deployment on chain ${CHAIN_ID}`);
  const feed = feedByName.get(`Robinhood ${sym} / USD`) || fail(`${sym}: no Chainlink feed "Robinhood ${sym} / USD"`);
  await checkToken(dep.contractAddress, sym, 18);
  const proxy = await checkFeed(feed, sym, STOCK_HEARTBEAT);
  txs.push(encode(dep.contractAddress, { cls: 1, listing: true, collateral: false, stock: true, feed: proxy, heartbeat: STOCK_HEARTBEAT, risk: STOCK_RISK, caps: STOCK_CAPS }));
  report.push({ symbol: sym, token: dep.contractAddress, feed: proxy, heartbeat: STOCK_HEARTBEAT, risk: STOCK_RISK, caps: STOCK_CAPS });
}

console.error(`\n${txs.length} assets verified. Review the table, then load the JSON into Safe Transaction Builder.`);
console.error(JSON.stringify(report, null, 1));
process.stdout.write(JSON.stringify({
  version: '1.0', chainId: String(CHAIN_ID), createdAt: Date.now(),
  meta: { name: 'AERENT asset allowlist', description: `configureAsset for ${report.map(r => r.symbol).join(', ')}`, txBuilderVersion: '1.16.5', createdFromSafeAddress: SAFE },
  transactions: txs.map(data => ({ to: MARKET, value: '0', data, contractMethod: null, contractInputsValues: null }))
}, null, 2) + '\n');
