// Shared application state and a tiny event bus.
export const S = {
  cfg: null, netKey: 'mainnet', net: null, rpc: null, reg: null, src: null,
  account: null, provider: null, walletName: '', walletChainId: null, connecting: false,
  listings: [], vms: [], offers: [], loaded: false, loadError: '',
  paused: false, protocolFeeBps: 0, grace: 43200,
  allowlist: [], rpcOk: true
};
const handlers = {};
export const on = (name, fn) => ((handlers[name] ||= []).push(fn), fn);
export const emit = (name, data) => (handlers[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
