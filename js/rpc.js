// JSON-RPC with ordered failover. The first healthy endpoint is preferred; a failing one is benched for 30s.
import { explainRevert } from './abi.js';

export function createRpc(urls) {
  const list = (urls || []).filter(Boolean);
  const bench = new Map();
  let id = 0;
  let lastLatency = null;
  let healthy = true;

  async function request(method, params = []) {
    let lastErr;
    const now = Date.now();
    const order = [...list].sort((a, b) => (bench.get(a) || 0) > now ? 1 : (bench.get(b) || 0) > now ? -1 : 0);
    for (const url of order) {
      const started = performance.now();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(url, {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
          body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })
        });
        clearTimeout(t);
        if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`RPC ${res.status}`), { transient: true });
        const json = await res.json();
        lastLatency = Math.round(performance.now() - started);
        healthy = true;
        if (json.error) {
          const err = new Error(json.error.message || 'RPC error');
          err.code = json.error.code; err.data = json.error.data;
          throw err; // contract-level errors are not failover reasons
        }
        return json.result;
      } catch (err) {
        lastErr = err;
        if (err.code !== undefined && !err.transient) throw err;
        bench.set(url, Date.now() + 30000);
      }
    }
    healthy = false;
    throw lastErr || new Error('No RPC endpoint available');
  }

  async function ethCall(to, data, from) {
    try {
      return await request('eth_call', [{ to, data, ...(from ? { from } : {}) }, 'latest']);
    } catch (err) {
      const reason = explainRevert(revertData(err));
      if (reason) throw Object.assign(new Error(reason), { friendly: true });
      throw err;
    }
  }

  async function getLogs(filter, fromBlock, toBlock, step = 20000) {
    const out = [];
    for (let start = fromBlock; start <= toBlock; start += step) {
      const end = Math.min(toBlock, start + step - 1);
      try {
        out.push(...await request('eth_getLogs', [{ ...filter, fromBlock: '0x' + start.toString(16), toBlock: '0x' + end.toString(16) }]));
      } catch (err) {
        if (step > 500) { out.push(...await getLogs(filter, start, end, Math.floor(step / 4))); } else throw err;
      }
    }
    return out;
  }

  return {
    request, ethCall, getLogs,
    status: () => ({ healthy, latency: lastLatency, endpoints: list.length })
  };
}

export function revertData(err) {
  const candidates = [err?.data, err?.data?.data, err?.error?.data, err?.info?.error?.data, err?.cause?.data];
  for (const c of candidates) if (typeof c === 'string' && c.startsWith('0x')) return c;
  const m = String(err?.message || '').match(/0x[0-9a-fA-F]{8,}/);
  return m ? m[0] : '';
}
