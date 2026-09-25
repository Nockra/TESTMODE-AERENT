// Token registry: config tokens, Robinhood Stock Token registry and onchain metadata. Logos are required everywhere.
import { SEL, call, encAddr, str, uint } from './abi.js';
import { esc } from './util.js';

const STOCK_LOGOS = new Set(['AAPL', 'AMZN', 'GOOGL', 'JPM', 'META', 'MSFT', 'NVDA', 'TSLA', 'V', 'WMT']);
const TOKEN_LOGOS = {
  USDG: '/assets/tokens/usdg.png', USDC: '/assets/tokens/usdc.svg', USDT: '/assets/tokens/usdt.svg', DAI: '/assets/tokens/dai.svg',
  WETH: '/assets/tokens/weth.png', ETH: '/assets/tokens/eth.svg', WBTC: '/assets/tokens/btc.svg', BTC: '/assets/tokens/btc.svg',
  SKY: '/assets/tokens/sky.svg', CLOUD: '/assets/tokens/cloudpass.svg'
};

export function logoForSymbol(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (STOCK_LOGOS.has(s)) return `/assets/stocks/${s.toLowerCase()}.webp`;
  return TOKEN_LOGOS[s] || '';
}

export const CLASS_LABEL = { rwa: 'Stock Token', stablecoin: 'Stablecoin', crypto: 'Crypto', experimental: 'Experimental', nft: 'NFT', none: 'Unlisted' };

export function createRegistry({ network, rpc }) {
  const byAddr = new Map();
  let robinhood = new Map();
  let robinhoodLoaded = false;

  for (const t of network.tokens || []) {
    byAddr.set(t.address.toLowerCase(), { ...t, verified: 'config', logo: t.logo || logoForSymbol(t.symbol) });
  }

  async function loadRobinhood() {
    if (robinhoodLoaded || !network.stockTokenApi) return robinhood;
    robinhoodLoaded = true;
    try {
      const res = await fetch(network.stockTokenApi);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const map = new Map();
      for (const a of json.assets || []) {
        for (const d of a.deployments || []) {
          if (Number(d.chainId) !== network.chainId) continue;
          map.set(d.contractAddress.toLowerCase(), {
            address: d.contractAddress, symbol: a.tokenSymbol, name: String(a.tokenName || a.tokenSymbol).replace(/\s*\u2022\s*Robinhood Token$/i, ''),
            decimals: 18, class: 'rwa', remoteLogo: a.logoUrl, multiplier: a.currentMultiplier, pendingMultiplier: a.pendingMultiplier,
            pendingAt: a.pendingMultiplierEffectiveTime, status: a.status, trading: a.tradingCapabilities || null
          });
        }
      }
      robinhood = map;
    } catch { /* registry optional: onchain allowlist still applies */ }
    return robinhood;
  }

  async function meta(address, hint = {}) {
    const key = String(address).toLowerCase();
    if (byAddr.has(key)) return byAddr.get(key);
    await loadRobinhood();
    const rh = robinhood.get(key);
    let symbol = rh?.symbol, name = rh?.name, decimals = hint.nft ? 0 : 18;
    if (!rh) {
      const [s, n, d] = await Promise.all([
        rpc.ethCall(address, SEL.symbol).catch(() => '0x'),
        rpc.ethCall(address, SEL.name).catch(() => '0x'),
        hint.nft ? '0x0' : rpc.ethCall(address, SEL.decimals).catch(() => '0x12')
      ]);
      symbol = str(s) || 'TOKEN'; name = (str(n) || 'Token').replace(/\s*\u2022\s*Robinhood Token$/i, ''); decimals = hint.nft ? 0 : Number(uint(d));
    }
    const verified = rh ? 'robinhood' : hint.allowlisted ? 'aerent' : null;
    const info = {
      address, symbol, name, decimals, class: hint.class || rh?.class || 'none', verified,
      logo: rh ? (logoForSymbol(symbol) || rh.remoteLogo) : verified ? logoForSymbol(symbol) : '',
      robinhood: rh || null
    };
    byAddr.set(key, info);
    return info;
  }

  return {
    meta, loadRobinhood,
    known: () => [...byAddr.values()],
    stockTokens: async () => [...(await loadRobinhood()).values()],
    get: a => byAddr.get(String(a).toLowerCase()),
    put: t => byAddr.set(t.address.toLowerCase(), t)
  };
}

/** Logo markup. Unknown tokens get a neutral monogram so rows never render empty. */
export function tokenLogo(t, size = 36) {
  const sym = t?.symbol || '?';
  if (t?.logo) {
    return `<span class="tlogo" style="--s:${size}px"><img src="${esc(t.logo)}" alt="" loading="lazy" decoding="async"><b>${esc(sym.slice(0, 2))}</b></span>`;
  }
  return `<span class="tlogo mono" style="--s:${size}px"><b>${esc(sym.slice(0, 2))}</b></span>`;
}
