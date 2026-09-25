# Mainnet launch from the browser (no code on your computer)

Everything below happens in a browser. The only cost is gas on Robinhood Chain.
Free tools: MetaMask or Rabby, Safe, Remix, Blockscout, GitHub Actions, Vercel, Alchemy free tier, a Discord webhook.

## 0. Wallets and gas
1. Install MetaMask or Rabby. Create or import three wallets: Owner 1, Owner 2, Owner 3. Owner 1 is also the deployer and the guardian.
2. Open your live site, click Get ETH, then "Add Robinhood Chain to wallet".
3. Bridge ETH to Owner 1 on Robinhood Chain (bridging options are linked in Get ETH). Keep about 0.01 ETH for all the steps below.

## 1. Create the Safe (owner and treasury)
1. app.safe.global, Create account, network Robinhood Chain.
2. Add Owner 1, 2 and 3. Threshold 2 of 3. Create.
3. Copy the Safe address. It is the contract owner and the fee treasury.

## 2. Deploy the contract with Remix
1. In your GitHub repo open `deploy/AerentMarketplace.flat.sol`, click Raw, select all, copy.
2. Go to remix.ethereum.org. In the file explorer create `AerentMarketplace.sol` and paste.
3. Solidity Compiler tab:
   - Compiler: `0.8.26+commit.8a97fa7a`
   - Advanced configurations: Optimisation on, runs `200`, EVM version `cancun`
   - Click Compile. It must show a green tick.
4. Deploy and Run tab:
   - Environment: Injected Provider (your wallet, on Robinhood Chain, chain 4663)
   - Contract: `AerentMarketplace`
   - Constructor: `owner_` = Safe address, `treasury_` = Safe address, `guardian_` = Owner 1
   - Deploy, confirm in the wallet.
5. Copy the deployed address from Remix. Open the transaction on robinhoodchain.blockscout.com and note the block number.

## 3. Verify on Blockscout
1. Open the contract address on robinhoodchain.blockscout.com, tab Contract, Verify and publish.
2. Method: Solidity single file. Compiler `v0.8.26+commit.8a97fa7a`, optimisation yes, runs 200, EVM version cancun.
3. Paste the same flattened source. Submit.
4. In Read contract check `owner()` = Safe, `guardian()` = Owner 1, `paused()` = false.

## 4. Allowlist the assets (GitHub Actions builds the Safe batch)
1. Optional but recommended: create a free Alchemy app for Robinhood Chain mainnet. In GitHub repo Settings, Secrets and variables, Actions, add secret `RPC_URL` with that URL.
2. GitHub, Actions tab, "Build asset allowlist", Run workflow. Enter the contract address and Safe address. Run.
3. When it finishes, open the run. The summary shows every token and Chainlink feed it verified. Download the `safe-batch` artifact and unzip it.
4. app.safe.global, your Safe, Apps, Transaction Builder. Drag in `safe-batch.json`. Create batch, sign with Owner 1, sign with Owner 2, execute.
5. Blockscout, Read contract, `assetList()` should list the tokens.

If the workflow fails, the log names the exact token or feed that did not match. Nothing is signed in that case.

## 5. Switch the website to live
1. In GitHub open `config.json`, click the pencil to edit. Under `"mainnet"` set:
   - `"marketplaceContract": "0xYourContract"`
   - `"deployBlock": 12345678`
   - `"rpcUrls": ["https://your-alchemy-url", "https://rpc.mainnet.chain.robinhood.com"]`
   - leave `"indexerUrl": ""` (the site reads the contract directly, no server needed)
2. Commit. Vercel redeploys by itself in about a minute.
3. In the Alchemy dashboard restrict the key to your domain, because the URL is visible in the browser.
4. Open the site: the Preview tag is gone and Market reads the live contract.

## 6. Free monitoring
1. Discord: channel settings, Integrations, Webhooks, New webhook, copy URL.
2. GitHub Settings, Secrets and variables, Actions:
   - Variables tab: `AERENT_MARKETPLACE` = contract address
   - Secrets tab: `ALERT_WEBHOOK` = Discord URL, `RPC_URLS` = your Alchemy URL
3. Actions, "AERENT monitor", Run workflow once to test. It then runs every 30 minutes and posts to Discord when a position can be liquidated, a lender can claim collateral, escrow is short, or the chain is unreachable.

Public repos get unlimited free Actions minutes. Private repos get 2,000 free minutes a month, which covers this schedule.

## 6b. Wallet sign-in (Privy)

1. In the Privy dashboard, open your app, then Settings, then Domains.
2. Add `aerentmarketplace.com`, `www.aerentmarketplace.com` and your `*.vercel.app` preview domain. Connect fails on any domain that is not listed.
3. Under Login methods keep **Wallet** first, with **Email** as the fallback that creates an embedded wallet.
4. Under Chains, add Robinhood Chain (4663) so the wallet opens on the right network.

## 7. Domain
Vercel project, Settings, Domains, add `aerentmarketplace.com` and `www.aerentmarketplace.com`, then set the DNS records Vercel shows at your registrar.

## 8. First live test
With two of your own wallets and small amounts: list a little AAPL for 1 day against USDG, rent it from the other wallet, return it. Check each step on Blockscout.

## Emergency, no code needed
- Pause new listings and rentals: Blockscout, contract, Write contract, connect Owner 1, `pause()`.
- Resume: Safe, Transaction Builder, contract address, method `unpause`, sign with 2 owners.
- Returns, settlements, liquidations and withdrawals keep working while paused.
