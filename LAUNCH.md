# Production status

Every item from the production plan, what this package delivers, and what still needs you.

| Item | Status | Notes |
| --- | --- | --- |
| Define "rent" per asset type | Done | Fungible rentals are fixed-term collateralised loans; NFTs are ERC-4907 usage rentals. Explained in the Docs window. |
| Separate fungible and NFT logic | Done | `Kind.Fungible` and `Kind.NFTUsage` paths in one contract, one marketplace UI. |
| Drop plain ERC-721 transfer rentals | Done | `configureAsset` rejects NFTs without the ERC-4907 interface. |
| Collateral management and health factor | Done | Opening ratio, liquidation ratio, health factor view, top-up via `addCollateral`. |
| Oracle layer | Done | Chainlink AggregatorV3, per-asset staleness (4 days for Stock Tokens to cover closed sessions), answer checks, Stock Token `oraclePaused()`. Sequencer feed support is built in but unused: Chainlink publishes none for Robinhood Chain. |
| Oracle supported vs fixed collateral | Done | Fixed-collateral markets only for allowlisted experimental assets; never liquidated early. |
| Liquidation engine | Done | Permissionless `liquidate`, bonus to liquidator, surplus to renter, capped at collateral. |
| Asset and collateral allowlists | Done | Classes: Stock Token, Stablecoin, Crypto, Experimental, NFT. |
| Hardened token handling | Done | OpenZeppelin SafeERC20 and ReentrancyGuard, balance-delta checks reject fee-on-transfer tokens. |
| Emergency pause | Done | Guardian can pause new listings and rentals only; exits always work. Owner via Ownable2Step. |
| No admin access to user funds | Done | No function moves user funds; open rentals snapshot their parameters. |
| Grace period | Done | Default 12 hours, bounded 1 hour to 7 days, snapshotted per rental. |
| Fee model | Done | Lender fee plus optional protocol share (max 10%), shown before signing. Early returns keep the fee. |
| Event indexer and database | Done | `indexer/`, SQLite, REST API, re-reads state from chain for every touched listing. |
| No 120-listing cap | Done | Paged `getListings` fallback plus indexer. |
| Production RPC with failover | Done in code | Ordered `rpcUrls` with benching. **You** add an Alchemy or QuickNode URL. |
| Wallet selection and mobile | Done | Privy sign-in (browser wallets, mobile wallets and an embedded wallet by email), warmed in the background so the dialog opens immediately. Falls back to a browser wallet if the Privy library cannot load. |
| Human-readable signing screens | Done | Rent, list, return, liquidate, claim and settle all show a plain summary with due date, health factor and liquidation level. |
| Transaction states and recovery | Done | Checking, confirm in wallet, submitted, confirming, confirmed, reverted; pending hashes resume after refresh. Reverts are simulated first and explained. |
| Robinhood asset discovery | Done | Stock Tokens window reads the registry through `/api/rh-assets`. |
| Corporate actions and multiplier | Done | Uses multiplier-adjusted Chainlink prices; shows current and pending multiplier. |
| Blocked recipients cannot trap funds | Done | Failed payouts become claimable balances, withdrawable to any address from Portfolio. Indexer alerts on each deferral. |
| Test suite, fuzz, invariants | Done | 45 passing Foundry tests. |
| Blockscout verification | Ready | Commands in `DEPLOY.md`. |
| Full testnet beta | **You** | List, rent, move price, return, expire, liquidate, settle, withdraw with many wallets. |
| Bug bounty | **You** | Security window and `SECURITY.md` already carry the disclosure route. |
| Deployment key security and multisig | **You** | Hardware deployer, Safe owner, publish admin addresses. |
| GitHub, Vercel, domain | Ready | Steps in `DEPLOY.md`. |
| Website hardening | Done | CSP, HSTS, frame blocking, permissions policy, no inline scripts, self-hosted font. |
| Monitoring and liquidation watcher | Done | Indexer `/health`, watcher alerts for liquidatable positions, escrow shortfall and RPC failures. |
| Incident response | **You** | Decide owners and runbooks for RPC outage, stale oracle, vulnerability report, frontend compromise, depeg, Stock Token halt. |
| Get ETH and bridging | Done | Get ETH window with balance, bridging options link, testnet faucet and add-network button. |
