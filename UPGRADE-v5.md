# v5: fair terms, requests, and three interface upgrades

## What changed in the contract

**Renter protection, enforced onchain.** Two new per-asset limits sit alongside the existing collateral floor:

- `maxCollateralRatioBps`: collateral may not exceed this share of the rented asset's value. Suggested 20000, meaning 200%.
- `maxFeeBps`: the fee may not exceed this share of the asset's value for the term. Suggested 1000, meaning 10%.

A rental whose collateral is above the ceiling, or whose fee is above the cap, cannot start: `rent` and `fillOffer` revert with `CollateralTooHigh` or `FeeTooHigh`. This closes the complaint that a lender could demand $53 of collateral for a $20 rental. Both limits apply only to rentals starting after a change, never to open positions, and `configureAsset` rejects a ceiling below the floor or a fee cap above 20%.

**Requests.** A renter posts what they want, escrowing collateral and fee up front, and any holder fills it in one transaction. Requests expire and can be cancelled at any time, including while new activity is paused.

## What changed in the interface

- **Terms are percentages, not guesses.** Listing an asset now uses two sliders: collateral as a share of value, bounded by the asset's own floor and ceiling, and a rental rate from 0% to 10% for the term. The amounts are computed for you, so a listing is comparable with every other listing at a glance.
- **The market shows rates.** Each row displays collateral as a percentage of value and the fee as a percentage, so an outrageous listing is obvious immediately.
- **The rent screen refuses bad input.** Collateral below the floor or above the ceiling is rejected before you sign, with the reason named.
- Plus the three from v4: idle asset scanner, position alerts, leaderboard.

## Deploying: one extra step

The contract is now compiled through the IR pipeline, which keeps it comfortably inside the 24,576 byte limit at 20,233 bytes. That needs one extra click in Remix.

1. Paste `deploy/AerentMarketplace.flat.sol` into Remix as before.
2. In the Solidity Compiler tab, choose **Use configuration file** and point it at `deploy/compiler_config.json` from this repo. That file sets compiler 0.8.26, optimisation with 200 runs, EVM version cancun and `viaIR: true`.
3. Compile, then deploy with your Safe, Safe and guardian addresses as before.
4. Verify on Blockscout using **Solidity (Standard JSON input)** and upload `deploy/standard-json-input.json`. This is the exact input used to produce the deployed bytecode, so it matches precisely.
5. Re-run the **Build asset allowlist** workflow. It now sets the collateral ceiling and fee cap for each asset; adjust with `--stock-caps 20000,1000` if you want different limits.
6. Update `marketplaceContract` and `deployBlock` in `config.json`.

The old contract keeps working for anyone with an open position: returns, settlements, claims, liquidations and withdrawals can never be paused or removed.
