# AerentMarketplace v3

See the NatSpec in `AerentMarketplace.sol` and the Docs window of the site. Key properties:

- Fungible rentals return the same quantity, not the same tokens. Oracle markets have a health factor and permissionless liquidation.
- NFT rentals are ERC-4907 only; the NFT never leaves escrow.
- Pause blocks `createListing` and `rent` only.
- Owner (Safe) sets allowlists and parameters for new positions. No function moves user funds.

- Payments never trap the other party. Every outgoing transfer goes through `_payOut`: if the recipient cannot receive (for example a stablecoin issuer blocklist), the amount is credited to `claimable[token][recipient]` and emits `PaymentDeferred`. The recipient pulls it later with `withdraw(token, to)`, optionally to a different address. Returns go through escrow first, so a blocked lender cannot make a renter default.
