// Vercel serverless proxy for the Robinhood Stock Token registry.
// Keeps the browser on our origin (strict CSP), caches at the edge, and only passes through the fields the UI uses.
const SOURCE = 'https://api.robinhood.com/rhj/assets';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }
  try {
    const upstream = await fetch(SOURCE, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const json = await upstream.json();
    const assets = (json.assets || [])
      .filter(a => a && typeof a.tokenSymbol === 'string' && Array.isArray(a.deployments))
      .map(a => ({
        id: a.id,
        tokenSymbol: a.tokenSymbol,
        tokenName: a.tokenName,
        deployments: a.deployments.filter(d => /^0x[0-9a-fA-F]{40}$/.test(d.contractAddress)).map(d => ({ contractAddress: d.contractAddress, chainId: Number(d.chainId) })),
        currentMultiplier: a.currentMultiplier,
        pendingMultiplier: a.pendingMultiplier || '',
        pendingMultiplierEffectiveTime: a.pendingMultiplierEffectiveTime,
        logoUrl: typeof a.logoUrl === 'string' && a.logoUrl.startsWith('https://cdn.robinhood.com/') ? a.logoUrl : '',
        tradingCapabilities: a.tradingCapabilities || null,
        status: a.status
      }))
      .filter(a => a.status !== 'ASSET_STATUS_INACTIVE');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({ assets, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(502).json({ error: 'Registry unavailable', assets: [] });
  }
}
