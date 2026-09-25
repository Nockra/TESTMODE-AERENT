# Mainnet launch runbook

Robinhood Chain mainnet, chain ID 4663. Follow in order. Each step says how to confirm it worked before moving on.

## What you need

| Item | Notes |
| --- | --- |
| Hardware wallet (Ledger or Trezor) | Deployer only. Fund with about 0.02 ETH on Robinhood Chain. |
| 2 or 3 signer wallets | Safe owners. At least one hardware wallet. |
| Alchemy or QuickNode account | Robinhood Chain mainnet RPC URL. |
| GitHub and Vercel accounts | Website hosting. |
| Domain | aerentmarketplace.com with DNS access. |
| Small always-on server | Indexer. Railway, Fly.io, Render or any VPS with Node 22.5+. |
| Foundry | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |

## 1. Safe multisig
1. app.safe.global, network Robinhood Chain, Create account.
2. Add your 2 or 3 owner wallets, threshold 2.
3. Deploy the Safe and copy its address. This is `OWNER_SAFE` and also `TREASURY`.
4. Choose a `GUARDIAN` address (a second Safe, or a hardware wallet you keep with you). It can only pause new listings and rentals.

Confirm: the Safe shows on robinhoodchain.blockscout.com as a contract.

## 2. Deploy the contract
```bash
cd AERENT-Marketplace-v3
forge test                                   # expect 45 passed
export RPC_URL=https://your-alchemy-robinhood-mainnet-url
OWNER_SAFE=0x... TREASURY=0x... GUARDIAN=0x... \
forge script script/Deploy.s.sol --rpc-url $RPC_URL --ledger --broadcast \
  --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
```
Write down the printed `AerentMarketplace` address and the block number from `broadcast/Deploy.s.sol/4663/run-latest.json`.

Confirm on Blockscout: contract verified, `owner()` equals your Safe, `guardian()` and `treasury()` correct, `paused()` false.

## 3. Allowlist assets through the Safe
```bash
node script/configure-assets.mjs --market 0xMARKET --safe 0xSAFE --rpc $RPC_URL \
  --stocks AAPL,NVDA,TSLA,MSFT,AMZN,GOOGL,META > safe-batch.json
```
The script pulls Stock Token addresses from Robinhood's registry and feed proxies from Chainlink's Robinhood directory, checks every token and feed onchain, and aborts on any mismatch. It prints a table: compare each feed address with docs.chain.link/data-feeds/price-feeds/addresses (network Robinhood).

Then app.safe.global, Apps, Transaction Builder, drag in `safe-batch.json`, review, collect signatures, execute.

Confirm: `assetConfig(token)` on Blockscout returns the class and feed for each asset.

Do not call `setSequencerUptimeFeed`. Chainlink does not publish one for Robinhood Chain; leave it unset.

## 4. Indexer
On your server:
```bash
RPC_URLS=https://your-alchemy-url,https://rpc.mainnet.chain.robinhood.com \
MARKETPLACE=0xMARKET START_BLOCK=<deploy block> CONFIRMATIONS=2 PORT=8787 \
DB_PATH=/data/aerent.sqlite CORS_ORIGIN=https://aerentmarketplace.com \
ALERT_WEBHOOK=https://discord.com/api/webhooks/... node indexer/index.mjs
```
Put it behind HTTPS, for example `https://api.aerentmarketplace.com`. Keep the database on a persistent volume.

Confirm: `https://api.aerentmarketplace.com/health` returns `"ok": true` with `lag` near 0.

## 5. Website config
Edit `config.json`, network `mainnet`:
```json
"rpcUrls": ["https://your-alchemy-url", "https://rpc.mainnet.chain.robinhood.com"],
"marketplaceContract": "0xMARKET",
"deployBlock": 12345678,
"indexerUrl": "https://api.aerentmarketplace.com"
```
Optional: `xUrl`. Wallet sign-in uses Privy: set `privyAppId` and list your domains in the Privy dashboard.

The Alchemy URL is visible to visitors. In the Alchemy dashboard, restrict it to the domain aerentmarketplace.com.

## 6. Vercel and domain
1. Push the folder to a private GitHub repository.
2. vercel.com, Add New Project, import the repo. Framework: Other. Build command: none. Output directory: `.`
3. Deploy, then Settings, Domains, add `aerentmarketplace.com` and `www.aerentmarketplace.com`. Set the DNS records Vercel shows at your registrar.

Confirm: the site loads over HTTPS, the Preview tag is gone, the Stock Tokens window lists Robinhood assets, the Market shows no listings yet.

## 7. First live listing and rental
Use two of your own wallets with small amounts.
1. Wallet A: List 0.1 AAPL (or similar), collateral USDG, 1 day.
2. Wallet B: Rent it. Check health factor and liquidation level on the signing screen.
3. Wallet B: Return it. Collateral should come back minus the fee.
4. Check Activity links on Blockscout and the indexer `/listings`.

## 8. Go public
- Publish the contract address, Safe address and guardian address on the Security window and X.
- Keep the allowlist to well-known assets while volumes are small.

## Emergency
- Something wrong with new rentals: guardian calls `pause()` on the contract. Returns, settlements, liquidations and withdrawals still work.
- Resume: the Safe calls `unpause()`.
