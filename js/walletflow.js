import { S, emit } from './state.js';
import { icon } from './icons.js';
import { esc, short, $ } from './util.js';
import { toast, avatar } from './ui.js';
import { privyConnect, privyReconnect, privyDisconnect, privySwitchChain, warmPrivy } from './wallet.js?v=perf-20260923';
import { PREVIEW_ACCOUNT } from './preview.js';

const LAST = 'aerent.wallet';
let bound = null;

function bind(provider) {
  if (bound === provider || !provider?.on) return;
  bound = provider;
  provider.on('accountsChanged', a => {
    S.account = a?.[0] || null;
    if (!S.account) localStorage.removeItem(LAST);
    emit('account');
  });
  provider.on('chainChanged', c => {
    S.walletChainId = Number(c);
    emit('account');
  });
  provider.on('disconnect', () => {
    S.account = null;
    emit('account');
  });
}

/** Direct browser wallet, used only if the Privy library cannot be reached. */
function injectedWallet() {
  const p = window.ethereum;
  if (!p) return null;
  return { provider: p, name: p.isMetaMask ? 'MetaMask' : 'Browser wallet', kind: 'injected' };
}

async function adopt(w) {
  if (!w?.provider) return false;
  const accounts = w.address ? [w.address] : await w.provider.request({ method: 'eth_accounts' });
  if (!accounts?.length) return false;

  S.provider = w.provider;
  S.walletName = w.name || 'Privy';
  S.account = accounts[0];
  S.walletChainId = Number(await w.provider.request({ method: 'eth_chainId' }));
  localStorage.setItem(LAST, w.kind === 'injected' ? 'injected' : 'privy');
  bind(w.provider);
  emit('account');
  return true;
}

export async function autoReconnect() {
  const last = localStorage.getItem(LAST);
  if (!last) return;
  if (last === 'preview') {
    usePreviewWallet();
    return;
  }
  if (last === 'injected') {
    const inj = injectedWallet();
    if (!inj) { localStorage.removeItem(LAST); return; }
    try {
      const accounts = await inj.provider.request({ method: 'eth_accounts' });
      if (accounts?.length) await adopt({ ...inj, address: accounts[0] });
    } catch {}
    return;
  }
  if (last !== 'privy') {
    localStorage.removeItem(LAST);
    return;
  }

  try {
    const w = await privyReconnect();
    if (w) await adopt(w);
  } catch {}
}

function usePreviewWallet() {
  S.provider = null;
  S.walletName = 'Preview wallet';
  S.account = PREVIEW_ACCOUNT;
  S.walletChainId = S.net.chainId;
  S.src.fund(S.account);
  localStorage.setItem(LAST, 'preview');
  emit('account');
}

export async function connect() {
  if (S.src.mode === 'preview') {
    usePreviewWallet();
    return true;
  }
  if (S.connecting) return false;

  S.connecting = true;
  emit('account');
  const slow = setTimeout(() => toast('Opening your wallet', 'Preparing the secure wallet dialog.'), 1200);

  try {
    const w = await privyConnect();
    const ok = await adopt(w);
    if (!ok) throw new Error('No wallet account was returned.');
    if (S.walletChainId !== S.net.chainId) await switchNetwork();
    return true;
  } catch (err) {
    // If the wallet library itself could not load, fall back to a browser wallet so the site still works.
    if (err?.sdk) {
      const inj = injectedWallet();
      if (inj) {
        try {
          const accounts = await inj.provider.request({ method: 'eth_requestAccounts' });
          if (accounts?.length && await adopt({ ...inj, address: accounts[0] })) {
            if (S.walletChainId !== S.net.chainId) await switchNetwork();
            return true;
          }
        } catch (injErr) {
          if (injErr?.code !== 4001) toast('Wallet not connected', 'Your browser wallet did not respond.', 'bad');
          return false;
        }
      }
      toast('Wallet unavailable', 'The wallet library could not load. Check your connection, any ad blocker, then try again.', 'bad');
      return false;
    }
    const rejected = err?.code === 4001 || /reject|cancel|closed|exited/i.test(err?.message || '');
    toast('Wallet not connected', rejected ? 'The wallet connection was cancelled.' : (err?.message || 'The wallet could not connect.'), 'bad');
    return false;
  } finally {
    clearTimeout(slow);
    S.connecting = false;
    emit('account');
  }
}

export { warmPrivy };

export function disconnect() {
  S.account = null;
  S.provider = null;
  S.walletName = '';
  bound = null;
  localStorage.removeItem(LAST);
  emit('account');
  privyDisconnect().catch(() => {});
}

export async function switchNetwork() {
  if (!S.provider) throw Object.assign(new Error('Connect a wallet first.'), { friendly: true });
  const n = S.net;

  try {
    await privySwitchChain(n.chainId);
  } catch (privyError) {
    try {
      await S.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: n.chainIdHex }] });
    } catch (err) {
      if (err?.code === 4902 || /unrecognized|not added|unknown chain/i.test(err?.message || '')) {
        await S.provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: n.chainIdHex,
            chainName: n.label,
            nativeCurrency: n.nativeCurrency,
            rpcUrls: n.rpcUrls,
            blockExplorerUrls: n.explorerUrl ? [n.explorerUrl] : []
          }]
        });
      } else {
        throw privyError || err;
      }
    }
  }

  S.walletChainId = n.chainId;
  emit('account');
}

export function accountMenu(anchor, handlers) {
  document.querySelector('.popover')?.remove();
  const p = document.createElement('div');
  p.className = 'popover';
  const wrong = S.src.mode !== 'preview' && S.provider && S.walletChainId !== S.net.chainId;
  p.innerHTML = `
    <div class="who"><img class="avatar" src="${avatar(S.account)}" alt=""><div><strong>${esc(short(S.account))}</strong><small>${esc(S.walletName || 'Wallet')}</small></div></div>
    ${wrong ? `<button class="item" data-a="switch">${icon('alert')}Switch to ${esc(S.net.label)}</button>` : ''}
    <button class="item" data-a="copy">${icon('copy')}Copy address</button>
    <button class="item" data-a="portfolio">${icon('wallet')}Portfolio</button>
    <button class="item" data-a="positions">${icon('positions')}My positions</button>
    ${S.net.explorerUrl && S.src.mode !== 'preview' ? `<button class="item" data-a="explorer">${icon('external')}View on explorer</button>` : ''}
    <hr><button class="item" data-a="disconnect">${icon('power')}Disconnect</button>`;
  document.body.appendChild(p);

  const r = anchor.getBoundingClientRect();
  p.style.top = r.bottom + 8 + 'px';
  p.style.left = Math.max(8, Math.min(innerWidth - p.offsetWidth - 8, r.right - p.offsetWidth)) + 'px';

  const off = e => {
    if (!p.contains(e.target) && e.target !== anchor) {
      p.remove();
      document.removeEventListener('pointerdown', off);
    }
  };
  setTimeout(() => document.addEventListener('pointerdown', off));

  p.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    p.remove();
    if (a === 'copy') {
      await navigator.clipboard?.writeText(S.account);
      toast('Address copied', short(S.account));
    }
    if (a === 'disconnect') disconnect();
    if (a === 'switch') switchNetwork().catch(() => toast('Network not switched', 'Approve the request in your wallet.', 'bad'));
    if (a === 'explorer') window.open(`${S.net.explorerUrl}/address/${S.account}`, '_blank', 'noopener');
    if (a === 'portfolio' || a === 'positions') handlers.open(a);
  });
}
