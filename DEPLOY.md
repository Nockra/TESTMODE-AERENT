# Deploying AERENT

For the complete mainnet runbook with exact commands, see `MAINNET.md`. Build the asset allowlist with `script/configure-assets.mjs`.

Order matters: testnet first, then mainnet.

## 1. Contract

1. Create a Safe multisig on Robinhood Chain for ownership, and pick a guardian address (a second Safe or a monitored hot key that can only pause).
2. Use a hardware wallet as the deployer. Never reuse it for anything else. No private keys in GitHub, Vercel or `.env` files that get committed.
3. Deploy to testnet:
   ```bash
   OWNER_SAFE=0x... TREASURY=0x... GUARDIAN=0x... \
   forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --ledger --broadcast \
     --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/
   ```
4. From the Safe, call `configureAsset` for each token. Take feed proxy addresses, decimals and heartbeats from the Chainlink Robinhood feeds page, never from memory. Take Stock Token addresses only from Robinhood's registry.
   Suggested starting parameters:
   | Class | minCollateralRatioBps | liquidationRatioBps | liquidationBonusBps | maxCollateralRatioBps | maxFeeBps |
   | --- | --- | --- | --- | --- | --- |
   | Stock Token | 15000 | 12000 | 500 | 20000 | 1000 |
   | WETH | 16000 | 12500 | 600 | 22000 | 1000 |
   | Stablecoin rented against WETH | 11000 | 10500 | 200 | 15000 | 500 |
   | Experimental (no feed) | fixed collateral only | none | none | none | none |

   The last two columns are the renter protections: collateral may not exceed the ceiling, and the fee may not exceed that share of the asset's value for the term.
5. Do not set a sequencer uptime feed: Chainlink does not publish one for Robinhood Chain.
6. Run the full testnet beta (see `LAUNCH.md`), then repeat on mainnet with `https://robinhoodchain.blockscout.com/api/`.

## 2. Indexer

Run `indexer/index.mjs` on any always-on host (Fly, Railway, a VM). Node 22.5 or later.

```bash
RPC_URLS=https://your-alchemy-url,https://rpc.mainnet.chain.robinhood.com \
MARKETPLACE=0x... START_BLOCK=<deploy block> CONFIRMATIONS=2 PORT=8787 \
ALERT_WEBHOOK=https://hooks.slack.com/... CORS_ORIGIN=https://aerentmarketplace.com \
node indexer/index.mjs
```

Point uptime monitoring at `GET /health` (returns 503 when lagging more than 50 blocks or not polling).

## 3. Website on Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel, framework "Other", no build command, output directory `.`.
3. In `config.json` set, per network: `rpcUrls` (production provider first, public RPC as backup), `marketplaceContract`, `deployBlock`, `indexerUrl`. Optionally `xUrl`. Wallet sign-in uses Privy: set `privyAppId` and add your domain to the allowed origins in the Privy dashboard.
4. Add the domain `aerentmarketplace.com` in Vercel and set the DNS records it shows. HTTPS is automatic.
5. Security headers (CSP, HSTS, frame blocking, permissions policy) are already in `vercel.json`.

Nothing secret ever goes into `config.json` or Vercel environment variables for this site.
