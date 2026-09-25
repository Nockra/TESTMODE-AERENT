// AERENT indexer, API and watcher. Zero dependencies: Node 22.5+ (node:sqlite, fetch).
//
//   RPC_URLS=https://primary,https://backup MARKETPLACE=0x... START_BLOCK=123 PORT=8787 node indexer/index.mjs
//
// The chain is the source of truth. Events tell the indexer which listings changed; it then re-reads each changed
// listing with getListing(id) and stores that snapshot, so a missed or reordered event can never corrupt state.
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';

const env = process.env;
const RPC_URLS = (env.RPC_URLS || 'http://127.0.0.1:8545').split(',').map(s => s.trim()).filter(Boolean);
const MARKET = (env.MARKETPLACE || '').toLowerCase();
const START = Number(env.START_BLOCK || 0);
const CONFIRMATIONS = Number(env.CONFIRMATIONS || 2);
const PORT = Number(env.PORT || 8787);
const POLL_MS = Number(env.POLL_MS || 4000);
const STEP = Number(env.LOG_STEP || 5000);
const ALERT_WEBHOOK = env.ALERT_WEBHOOK || '';           // Slack/Discord compatible JSON webhook
const CORS = env.CORS_ORIGIN || '*';
if (!/^0x[0-9a-f]{40}$/.test(MARKET)) { console.error('Set MARKETPLACE to the deployed contract address.'); process.exit(1); }

const TOPICS = {
  '0x119f1da1ca0878bb08d858f7e37f0f7acd3fb7ebd837808f487583fa41ed9553': 'ListingCreated',
  '0x20a0d3b54ff37263cc7a307c935d524b334c87c701e123ec380fadae44c930db': 'Rented',
  '0x935a476d8eb416e1441bbdc27477a7d90012bed1a74dba06f77fc32b8b119bd8': 'CollateralAdded',
  '0x67ffb28c0e498947b5c148a385ed64809190a87d2a053c40be021f28c69181ec': 'Returned',
  '0x1ddc75d9b5fc6d37e23b3284e94f0db77b95dfe06b38540ac86c16e6ee3f7238': 'Settled',
  '0x730f277277cc712e23a43a4a3ce8679a46f58324ed8b495405bcfe1ecee3abc7': 'DefaultClaimed',
  '0x969067f3911888d4f34a9dba2e904ea5e0dcd3323ccf9692ef8f091c6a4326a5': 'Liquidated',
  '0x411aee90354c51b1b04cd563fcab2617142a9d50da19232d888547c8a1b7fd8a': 'ListingCancelled',
  '0x976b2b83a1c06e4fe710caff604c898fe5411a1d301d66cf76950cc3106a6171': 'OfferCreated',
  '0x1f51377b3e685a0e2419f9bb4ba7c07ec54936353ba3d0fb3c6538dab6766222': 'OfferCancelled',
  '0xcae2596881a3c8ab55a8e33991e752b0b50eafee18d026c0c38f0a6af5e4f577': 'OfferFilled',
  '0x095cb891fb6b6ca12fff418690efb9b713280679987c0044ae336720707483ce': 'AssetConfigured',
  '0x5a0c3591c2e548638f5c88b63a0f9a9ff4b5f1c634efd01311827381fd8c6603': 'PaymentDeferred',
  '0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258': 'Paused',
  '0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa': 'Unpaused'
};
const SEL = { getListing: '0x107a274a', healthFactor: '0xbc71054e', escrowed: '0xd01242f9', balanceOf: '0x70a08231' };
const STATUS = ['open', 'rented', 'returned', 'defaulted', 'liquidated', 'cancelled', 'settled'];

// ------------------------------------------------------------------ rpc with failover
const bench = new Map();
let rpcId = 0;
const metrics = { rpcErrors: 0, lastRpcMs: null, head: 0, indexed: START - 1, lastPollAt: 0, alerts: [] };
async function rpc(method, params = []) {
  let last;
  const order = [...RPC_URLS].sort((a, b) => (bench.get(a) || 0) - (bench.get(b) || 0));
  for (const url of order) {
    if ((bench.get(url) || 0) > Date.now()) continue;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }), signal: AbortSignal.timeout(15000) });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      metrics.lastRpcMs = Date.now() - t0;
      if (j.error) { const e = new Error(j.error.message); e.rpc = true; throw e; }
      return j.result;
    } catch (e) {
      last = e;
      if (e.rpc) throw e;
      metrics.rpcErrors++;
      bench.set(url, Date.now() + 30000);
    }
  }
  throw last || new Error('all RPC endpoints benched');
}
const word = (h, i) => h.slice(2 + i * 64, 2 + i * 64 + 64);
const u = (h, i) => BigInt('0x' + (word(h, i) || '0'));
const a = (h, i) => '0x' + word(h, i).slice(24);
const enc = v => BigInt(v).toString(16).padStart(64, '0');
const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);

// ------------------------------------------------------------------ storage
const db = new DatabaseSync(env.DB_PATH || 'aerent-indexer.sqlite');
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY, kind TEXT, status TEXT, oracle INTEGER, lender TEXT, renter TEXT, asset TEXT, amount TEXT,
    collateral_token TEXT, collateral TEXT, fee TEXT, duration INTEGER, started_at INTEGER, due_at INTEGER, grace INTEGER,
    protocol_fee_bps INTEGER, liq_ratio_bps INTEGER, liq_bonus_bps INTEGER, updated_block INTEGER
  );
  CREATE INDEX IF NOT EXISTS ix_lender ON listings(lender);
  CREATE INDEX IF NOT EXISTS ix_renter ON listings(renter);
  CREATE INDEX IF NOT EXISTS ix_status ON listings(status);
  CREATE TABLE IF NOT EXISTS events (
    block INTEGER, tx TEXT, log_index INTEGER, name TEXT, listing_id INTEGER, actor TEXT, data TEXT,
    PRIMARY KEY (tx, log_index)
  );
  CREATE INDEX IF NOT EXISTS ix_ev_listing ON events(listing_id);
  CREATE INDEX IF NOT EXISTS ix_ev_actor ON events(actor);
  CREATE TABLE IF NOT EXISTS assets (address TEXT PRIMARY KEY, block INTEGER);
`);
const getMeta = k => db.prepare('SELECT v FROM meta WHERE k = ?').get(k)?.v;
const setMeta = (k, v) => db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, String(v));
metrics.indexed = Number(getMeta('indexed') ?? START - 1);

const upsert = db.prepare(`INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
  kind=excluded.kind, status=excluded.status, oracle=excluded.oracle, lender=excluded.lender, renter=excluded.renter, asset=excluded.asset,
  amount=excluded.amount, collateral_token=excluded.collateral_token, collateral=excluded.collateral, fee=excluded.fee, duration=excluded.duration,
  started_at=excluded.started_at, due_at=excluded.due_at, grace=excluded.grace, protocol_fee_bps=excluded.protocol_fee_bps,
  liq_ratio_bps=excluded.liq_ratio_bps, liq_bonus_bps=excluded.liq_bonus_bps, updated_block=excluded.updated_block`);
const insEvent = db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?)');
const insAsset = db.prepare('INSERT OR IGNORE INTO assets VALUES (?,?)');

async function snapshot(id, block) {
  const h = await call(MARKET, SEL.getListing + enc(id));
  upsert.run(id, Number(u(h, 1)) === 1 ? 'nft' : 'fungible', STATUS[Number(u(h, 2))], Number(u(h, 3)), a(h, 4), a(h, 5), a(h, 6),
    u(h, 7).toString(), a(h, 8), u(h, 9).toString(), u(h, 10).toString(), Number(u(h, 11)), Number(u(h, 12)), Number(u(h, 13)),
    Number(u(h, 14)), Number(u(h, 15)), Number(u(h, 16)), Number(u(h, 17)), block);
}

// ------------------------------------------------------------------ sync loop
async function poll() {
  const head = Number(await rpc('eth_blockNumber'));
  metrics.head = head;
  const safe = head - CONFIRMATIONS;
  while (metrics.indexed < safe) {
    const from = metrics.indexed + 1, to = Math.min(safe, from + STEP - 1);
    const logs = await rpc('eth_getLogs', [{ address: MARKET, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }]);
    const touched = new Map();
    for (const l of logs) {
      const name = TOPICS[l.topics[0]];
      if (!name) continue;
      const block = Number(l.blockNumber);
      if (name === 'AssetConfigured') { insAsset.run('0x' + l.topics[1].slice(26), block); continue; }
      if (name === 'OfferCreated' || name === 'OfferCancelled' || name === 'OfferFilled') continue; // offers are read live from the contract
      if (name === 'PaymentDeferred') { alert(`payment deferred to 0x${l.topics[2].slice(26)} in token 0x${l.topics[1].slice(26)}`, 'deferred'); continue; }
      if (name === 'Paused' || name === 'Unpaused') { setMeta('paused', name === 'Paused' ? 1 : 0); continue; }
      const id = Number(BigInt(l.topics[1]));
      const actor = l.topics[2] ? '0x' + l.topics[2].slice(26) : null;
      insEvent.run(block, l.transactionHash, Number(l.logIndex), name, id, actor, l.data);
      touched.set(id, block);
    }
    db.exec('BEGIN');
    try {
      for (const [id, block] of touched) await snapshot(id, block);
      metrics.indexed = to;
      setMeta('indexed', to);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  metrics.lastPollAt = Date.now();
}

// ------------------------------------------------------------------ watcher: liquidations, overdue, escrow
async function watch() {
  const rented = db.prepare("SELECT * FROM listings WHERE status = 'rented'").all();
  const now = Math.floor(Date.now() / 1000);
  const liquidatable = [];
  for (const r of rented) {
    if (r.oracle) {
      try {
        const hf = Number(u(await call(MARKET, SEL.healthFactor + enc(r.id)), 0)) / 1e18;
        if (hf < 1) liquidatable.push({ id: r.id, hf });
      } catch (e) { alert(`health check failed for #${r.id}: ${e.message}`, 'oracle'); }
    }
  }
  metrics.liquidatable = liquidatable;
  metrics.overdue = rented.filter(r => now > r.due_at).map(r => r.id);
  if (liquidatable.length) alert(`${liquidatable.length} position(s) liquidatable: ${liquidatable.map(x => `#${x.id} HF ${x.hf.toFixed(3)}`).join(', ')}`, 'liquidation');
  // escrow invariant: contract balance must cover what it owes, per token
  const tokens = new Set(db.prepare("SELECT asset t FROM listings WHERE status='open' AND kind='fungible' UNION SELECT collateral_token FROM listings WHERE status='rented'").all().map(x => x.t));
  for (const t of tokens) {
    const owed = u(await call(MARKET, SEL.escrowed + t.toLowerCase().replace('0x', '').padStart(64, '0')), 0);
    const bal = u(await call(t, SEL.balanceOf + MARKET.slice(2).padStart(64, '0')), 0);
    if (bal < owed) alert(`ESCROW SHORTFALL on ${t}: balance ${bal} < owed ${owed}`, 'escrow');
  }
}

const lastAlert = new Map();
function alert(message, kind) {
  const key = kind + message;
  if (Date.now() - (lastAlert.get(key) || 0) < 15 * 60000) return;
  lastAlert.set(key, Date.now());
  const entry = { at: new Date().toISOString(), kind, message };
  metrics.alerts = [entry, ...metrics.alerts].slice(0, 50);
  console.warn('[alert]', kind, message);
  if (ALERT_WEBHOOK) fetch(ALERT_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `AERENT ${kind}: ${message}`, content: `AERENT ${kind}: ${message}` }) }).catch(() => {});
}

// ------------------------------------------------------------------ HTTP API
const toApi = r => ({
  id: r.id, kind: r.kind, status: r.status, oracle: !!r.oracle, lender: r.lender, renter: r.renter, asset: r.asset, amount: r.amount,
  collateralToken: r.collateral_token, collateral: r.collateral, fee: r.fee, duration: r.duration, startedAt: r.started_at, dueAt: r.due_at,
  grace: r.grace, protocolFeeBps: r.protocol_fee_bps, liqRatioBps: r.liq_ratio_bps, liqBonusBps: r.liq_bonus_bps
});
const addrOk = v => /^0x[0-9a-fA-F]{40}$/.test(v || '');

function route(req) {
  const url = new URL(req.url, 'http://x');
  const q = Object.fromEntries(url.searchParams);
  const limit = Math.min(Number(q.limit) || 100, 5000), offset = Math.max(Number(q.offset) || 0, 0);
  if (url.pathname === '/health') {
    const lag = metrics.head - metrics.indexed;
    return [lag > 50 || Date.now() - metrics.lastPollAt > 60000 ? 503 : 200, { ok: lag <= 50, head: metrics.head, indexed: metrics.indexed, lag, rpcErrors: metrics.rpcErrors, rpcLatencyMs: metrics.lastRpcMs, liquidatable: metrics.liquidatable || [], overdue: metrics.overdue || [], alerts: metrics.alerts.slice(0, 10) }];
  }
  if (url.pathname === '/listings') {
    const where = [], args = [];
    if (q.status) { where.push('status = ?'); args.push(q.status); }
    if (addrOk(q.asset)) { where.push('lower(asset) = ?'); args.push(q.asset.toLowerCase()); }
    if (addrOk(q.account)) { where.push('(lower(lender) = ? OR lower(renter) = ?)'); args.push(q.account.toLowerCase(), q.account.toLowerCase()); }
    const sql = `SELECT * FROM listings ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const rows = db.prepare(sql).all(...args, limit, offset);
    return [200, { listings: rows.map(toApi), indexedBlock: metrics.indexed }];
  }
  const m = url.pathname.match(/^\/listings\/(\d+)$/);
  if (m) {
    const r = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(m[1]));
    const events = db.prepare('SELECT block, tx, name, actor FROM events WHERE listing_id = ? ORDER BY block, log_index').all(Number(m[1]));
    return r ? [200, { listing: toApi(r), events }] : [404, { error: 'not found' }];
  }
  if (url.pathname === '/activity') {
    if (!addrOk(q.account)) return [400, { error: 'account required' }];
    const acct = q.account.toLowerCase();
    const rows = db.prepare(`SELECT e.block, e.tx, e.name, e.listing_id id, e.actor FROM events e JOIN listings l ON l.id = e.listing_id
      WHERE lower(e.actor) = ? OR lower(l.lender) = ? OR lower(l.renter) = ? ORDER BY e.block DESC LIMIT ? OFFSET ?`).all(acct, acct, acct, limit, offset);
    return [200, { events: rows }];
  }
  if (url.pathname === '/assets') return [200, { assets: db.prepare('SELECT address, block FROM assets').all() }];
  if (url.pathname === '/stats') {
    const s = db.prepare("SELECT status, count(*) n FROM listings GROUP BY status").all();
    return [200, { byStatus: Object.fromEntries(s.map(x => [x.status, x.n])), paused: getMeta('paused') === '1' }];
  }
  return [404, { error: 'not found' }];
}

http.createServer((req, res) => {
  let status = 500, body = { error: 'internal' };
  try {
    if (req.method === 'OPTIONS') { status = 204; body = null; } else if (req.method !== 'GET') { status = 405; body = { error: 'GET only' }; } else [status, body] = route(req);
  } catch (e) { console.error(e); }
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': CORS, 'access-control-allow-methods': 'GET, OPTIONS', 'cache-control': 'public, max-age=3', 'x-content-type-options': 'nosniff' });
  res.end(body == null ? '' : JSON.stringify(body));
}).listen(PORT, () => console.log(`AERENT indexer on :${PORT}, market ${MARKET}, from block ${metrics.indexed + 1}`));

async function loop() {
  try { await poll(); } catch (e) { console.error('poll failed:', e.message); alert(`indexer poll failed: ${e.message}`, 'rpc'); }
  try { await watch(); } catch (e) { console.error('watch failed:', e.message); }
  setTimeout(loop, POLL_MS);
}
loop();
