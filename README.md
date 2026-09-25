# AERENT Marketplace v3

Rent Robinhood Stock Tokens, stablecoins, crypto and ERC-4907 NFTs on Robinhood Chain.

## What is in this package

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css`, `js/` | The website. Plain ES modules, no build step. Sky and glass desktop with Market, List, Positions, Portfolio, Stock Tokens, Activity, Get ETH, Docs, Security and Settings. |
| `config.json` | The only file you edit for public settings: networks, RPC list, contract address, indexer URL, verified tokens. |
| `api/rh-assets.js` | Vercel function that proxies and caches the Robinhood Stock Token registry. |
| `contracts/AerentMarketplace.sol` | v4 contract: two-sided market (listings and renter requests), oracle-priced fungible rentals with health factor and permissionless liquidation, fixed-collateral markets, ERC-4907 usage rentals, allowlists, grace period, protocol fee, guardian pause. |
| `test/` | Foundry suite: 53 unit and fuzz tests plus 4 invariant tests. |
| `script/` | `Deploy.s.sol` for testnet and mainnet, `configure-assets.mjs` to build a verified Safe batch that allowlists assets, `DeployLocal.s.sol` for a full local environment with seeded listings. |
| `indexer/` | Zero-dependency Node indexer, REST API and watcher (liquidations, overdue rentals, escrow shortfall, RPC health) with webhook alerts. |
| `assets/` | Brand marks, favicons, OG image, self-hosted Figtree font, Stock Token logos and token logos. |

## Two modes

**Live.** When `marketplaceContract` is set for the selected network, every read and write goes to the chain (through the indexer when `indexerUrl` is set, otherwise straight from the contract with paging, no cap).

**Preview.** When no contract is configured, the site runs the exact contract rules in the browser with test balances. A dark "Preview" tag shows in the menu bar, no transactions are sent, and Positions gains controls to move reference prices and skip time so liquidations, overdue rentals and settlement can be tried end to end.

## Run locally

```bash
python3 -m http.server 8080            # website, preview mode
```

Full local chain, contract, indexer and site:

```bash
anvil &
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# put the printed MARKETPLACE address into config.json -> networks.local.marketplaceContract
MARKETPLACE=0x... CONFIRMATIONS=0 node indexer/index.mjs &
# set networks.local.indexerUrl to http://127.0.0.1:8787, then open http://localhost:8080/?network=local
```

## Tests

```bash
forge test            # 57 tests incl. fuzz, invariants, blocklist and offer cases
```

See `UPGRADE-v4.md` for what is new and what needs redeploying, `BROWSER-DEPLOY.md` to launch entirely from the browser, `MAINNET.md` for the command-line route, `DEPLOY.md` for background and `LAUNCH.md` for the status of every production requirement.
