// One-shot health check for AERENT. Designed for a free scheduled GitHub Action (no server needed).
// Reads every listing straight from the contract, then alerts on:
//   liquidatable positions, collateral claimable by lenders, escrow shortfall, pause state, RPC failure.
//   RPC_URLS=https://a,https://b MARKETPLACE=0x... ALERT_WEBHOOK=https://discord... node indexer/watch-once.mjs
const RPCS = (process.env.RPC_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
const M = (process.env.MARKETPLACE || '').toLowerCase();
const HOOK = process.env.ALERT_WEBHOOK || '';
if (!RPCS.length || !/^0x[0-9a-f]{40}$/.test(M)) { console.error('Set RPC_URLS and MARKETPLACE'); process.exit(1); }

let id = 0;
async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      if (j.error) throw Object.assign(new Error(j.error.message), { rpc: true });
      return j.result;
    } catch (e) { last = e; if (e.rpc) throw e; }
  }
  throw last;
}
const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);
const w = (h, i) => BigInt('0x' + (h.slice(2 + i * 64, 2 + i * 64 + 64) || '0'));
const ad = (h, i) => '0x' + h.slice(2 + i * 64 + 24, 2 + i * 64 + 64);
const enc = v => BigInt(v).toString(16).padStart(64, '0');
const encA = v => v.toLowerCase().replace('0x', '').padStart(64, '0');
const STATUS = ['open', 'rented', 'returned', 'defaulted', 'liquidated', 'cancelled', 'settled'];

const alerts = [];
const lines = [];
try {
  const head = Number(await rpc('eth_blockNumber', []));
  const total = Number(w(await call(M, '0xa9b07c26'), 0));
  const paused = w(await call(M, '0x5c975abb'), 0) === 1n;
  const listings = [];
  for (let off = 0; off < total; off += 100) {
    const h = await call(M, '0x1f5a9ddc' + enc(off) + enc(100) + enc(0));
    const base = Number(w(h, 0)) / 32, n = Number(w(h, base));
    for (let i = 0; i < n; i++) {
      const o = base + 1 + i * 18;
      listings.push({ id: Number(w(h, o)), kind: Number(w(h, o + 1)), status: STATUS[Number(w(h, o + 2))], oracle: w(h, o + 3) === 1n,
        lender: ad(h, o + 4), asset: ad(h, o + 6), amount: w(h, o + 7), coll: ad(h, o + 8), dueAt: Number(w(h, o + 13)), grace: Number(w(h, o + 14)) });
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const rented = listings.filter(l => l.status === 'rented');
  for (const l of rented.filter(l => l.oracle)) {
    try {
      const hf = Number(w(await call(M, '0xbc71054e' + enc(l.id)), 0)) / 1e18;
      if (hf < 1) alerts.push(`Listing #${l.id} is liquidatable, health factor ${hf.toFixed(3)}`);
      else if (hf < 1.05) alerts.push(`Listing #${l.id} is close to liquidation, health factor ${hf.toFixed(3)}`);
    } catch (e) { alerts.push(`Price unavailable for listing #${l.id}: ${e.message.slice(0, 120)}`); }
  }
  for (const l of rented.filter(l => l.kind === 0 && now > l.dueAt + l.grace)) alerts.push(`Listing #${l.id} is past its grace period; the lender can claim collateral`);
  const tokens = new Set([...listings.filter(l => l.status === 'open' && l.kind === 0).map(l => l.asset), ...rented.map(l => l.coll)]);
  for (const t of tokens) {
    const owed = w(await call(M, '0xd01242f9' + encA(t)), 0);
    const bal = w(await call(t, '0x70a08231' + encA(M)), 0);
    if (bal < owed) alerts.push(`ESCROW SHORTFALL on ${t}: holds ${bal}, owes ${owed}. Pause and investigate.`);
  }
  if (paused) alerts.push('Marketplace is paused: new listings and rentals are disabled.');
  lines.push(`block ${head}, ${total} listings, ${rented.length} active rentals, paused ${paused}`);
} catch (e) {
  alerts.push(`Health check could not reach the chain: ${e.message}`);
}

console.log(lines.join('\n'));
for (const a of alerts) console.log('ALERT', a);
if (alerts.length && HOOK) {
  const text = `AERENT monitor\n${alerts.map(a => `- ${a}`).join('\n')}`;
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: text, text }) }).catch(() => {});
}
if (alerts.some(a => a.startsWith('ESCROW') || a.startsWith('Health check'))) process.exit(1);
