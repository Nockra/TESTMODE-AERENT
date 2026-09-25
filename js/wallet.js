// Privy bridge for AERENT.
// The SDK is warmed in the background as soon as the interface is painted, so pressing Connect opens the
// wallet dialog straight away instead of waiting for a few megabytes of JavaScript.
let configRef = null;
let networkRef = null;
let mounted = false;
let mountPromise = null;
let activeWallet = null;
let pendingConnect = null;

let sdkPromise = null;
let sdkError = null;

let state = {
  ready: false,
  walletsReady: false,
  authenticated: false,
  wallets: [],
  logout: null,
  connectOrCreateWallet: null
};

let readyResolve;
const readyPromise = new Promise(resolve => { readyResolve = resolve; });

function settleConnect(error, wallet) {
  if (!pendingConnect) return;
  const { resolve, reject } = pendingConnect;
  pendingConnect = null;
  if (error) reject(error);
  else resolve(wallet);
}

export function initPrivy(config, network) {
  configRef = config;
  networkRef = network;
}

export const privyReady = () => state.ready;
export const privyLoadFailed = () => sdkError;

/** Fetch the SDK once and keep the promise. Safe to call as often as you like. */
function loadSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = Promise.all([
    import('https://esm.sh/react@18.3.1'),
    import('https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1'),
    import('https://esm.sh/@privy-io/react-auth@3.45.0?deps=react@18.3.1,react-dom@18.3.1,viem@2.56.8')
  ]).catch(err => {
    sdkPromise = null;
    sdkError = err;
    throw Object.assign(new Error('The wallet library could not be loaded.'), { sdk: true, cause: err });
  });
  return sdkPromise;
}

/** Start downloading and mounting Privy before the user asks for it. Never throws. */
export function warmPrivy() {
  if (!configRef?.privyAppId) return Promise.resolve(false);
  return mountPrivy().then(() => true).catch(() => false);
}

async function mountPrivy() {
  if (mounted) return;
  if (mountPromise) return mountPromise;
  if (!configRef?.privyAppId || !networkRef?.chainId) {
    throw new Error('Privy is not configured.');
  }

  mountPromise = (async () => {
    const [reactMod, domMod, privyMod] = await loadSdk();

    const React = reactMod.default || reactMod;
    const { useEffect } = reactMod;
    const { createRoot } = domMod;
    const { PrivyProvider, usePrivy, useWallets, useConnectOrCreateWallet } = privyMod;

    function Bridge() {
      const { ready, authenticated, logout } = usePrivy();
      const { wallets, ready: walletsReady } = useWallets();
      const { connectOrCreateWallet } = useConnectOrCreateWallet({
        onSuccess: async ({ wallet }) => {
          activeWallet = wallet;
          settleConnect(null, wallet);
        },
        onError: async error => settleConnect(error || new Error('Privy wallet connection failed.'))
      });

      useEffect(() => {
        state = { ready, walletsReady, authenticated, wallets, logout, connectOrCreateWallet };
        if (!activeWallet && wallets?.length) activeWallet = wallets[0];
        if (ready) readyResolve?.(true);
      }, [ready, walletsReady, authenticated, wallets, logout, connectOrCreateWallet]);

      return null;
    }

    // Plain chain object rather than viem's defineChain: Privy only reads these fields, and skipping the
    // viem entry point removes a large download from the connect path.
    const chain = {
      id: Number(networkRef.chainId),
      name: networkRef.label || 'Robinhood Chain',
      network: 'robinhood-chain',
      nativeCurrency: networkRef.nativeCurrency || { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: networkRef.rpcUrls || [] },
        public: { http: networkRef.rpcUrls || [] }
      },
      blockExplorers: networkRef.explorerUrl
        ? { default: { name: 'Blockscout', url: networkRef.explorerUrl } }
        : undefined
    };

    let host = document.getElementById('privy-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'privy-root';
      document.body.appendChild(host);
    }

    const root = createRoot(host);
    root.render(
      React.createElement(
        PrivyProvider,
        {
          appId: configRef.privyAppId,
          config: {
            defaultChain: chain,
            supportedChains: [chain],
            loginMethods: ['wallet', 'email'],
            embeddedWallets: {
              ethereum: { createOnLogin: 'users-without-wallets' }
            },
            appearance: {
              theme: 'light',
              accentColor: '#b5f750',
              showWalletLoginFirst: true
            }
          }
        },
        React.createElement(Bridge)
      )
    );

    mounted = true;
  })();

  try {
    await mountPromise;
  } catch (error) {
    mountPromise = null;
    throw error;
  }
}

async function waitReady(timeout = 20000, needWallets = false) {
  await mountPrivy();
  if (state.ready && (!needWallets || state.walletsReady)) return true;

  let timer;
  try {
    await Promise.race([
      readyPromise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Privy is taking too long to initialize.')), timeout);
      })
    ]);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

async function adapt(wallet) {
  if (!wallet) return null;
  const provider = await wallet.getEthereumProvider();
  const client = wallet.walletClientType || '';
  const embedded = client === 'privy';
  return {
    id: wallet.address || 'privy',
    rdns: 'privy',
    name: embedded ? 'AERENT Wallet' : (wallet.meta?.name || client || 'Wallet'),
    address: wallet.address,
    provider,
    wallet
  };
}

export async function privyConnect() {
  await waitReady();
  if (!state.connectOrCreateWallet) throw new Error('Privy wallet connection is not ready.');
  if (pendingConnect) throw new Error('A wallet connection is already in progress.');

  const wallet = await new Promise((resolve, reject) => {
    pendingConnect = { resolve, reject };
    try {
      const result = state.connectOrCreateWallet();
      Promise.resolve(result).catch(error => {
        pendingConnect = null;
        reject(error);
      });
    } catch (error) {
      pendingConnect = null;
      reject(error);
    }
  });

  activeWallet = wallet;
  return adapt(wallet);
}

export async function privyReconnect() {
  await waitReady(20000, true);
  const wallet = activeWallet || state.wallets?.[0];
  return wallet ? adapt(wallet) : null;
}

export async function privySwitchChain(chainId) {
  await waitReady();
  const wallet = activeWallet || state.wallets?.[0];
  if (!wallet?.switchChain) throw new Error('No Privy wallet is connected.');
  await wallet.switchChain(Number(chainId));
}

export async function privyDisconnect() {
  const logout = state.logout;
  activeWallet = null;
  if (state.authenticated && logout) {
    try { await logout(); } catch {}
  }
}
