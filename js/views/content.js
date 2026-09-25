import { S } from '../state.js';
import { esc } from '../util.js';
import { explorerLink, note } from '../ui.js';

export function renderDocs(w) {
  w.body.innerHTML = `<article class="prose">
  <h2>How AERENT works</h2>
  <p>AERENT is one marketplace with two kinds of rental. Both are fixed term, both are backed by collateral, and every exit path keeps working even if new activity is paused.</p>

  <h3>Fungible rentals: Stock Tokens, stablecoins, crypto</h3>
  <p>For an ERC-20 the renter receives tokens and later returns the same quantity, not the identical tokens. Economically this is a fixed-term, overcollateralised loan. The lender sets the amount, the fee, the term and a minimum collateral. When the asset has a Chainlink price feed the contract also enforces an opening collateral ratio and tracks a health factor.</p>
  <div class="formula">Health factor = <b>collateral value</b> / (<b>rented asset value</b> x liquidation ratio)</div>
  <p>Below 1.00 the position can be liquidated by anyone, before expiry. The liquidator delivers the rented quantity to the lender and receives collateral worth the asset value plus a bonus. Anything left goes back to the renter.</p>

  <h3>Requests: the other side of the market</h3>
  <p>A renter does not have to wait for a listing. They can post a request saying what they want, for how long, what they will pay and how much collateral they are putting up. The collateral and fee go into escrow immediately, so any holder can fill the request in one transaction and be paid on the spot. Unfilled requests expire, and the renter can cancel at any time, including while new activity is paused.</p>

  <h3>NFT usage rentals</h3>
  <p>Only ERC-4907 NFTs are accepted. The NFT never leaves AERENT escrow. The renter receives user rights that expire on their own, then anyone can settle: the NFT goes back to the lender and the collateral back to the renter. Standard ERC-721s are not supported, because a unique NFT that is not returned cannot be replaced by collateral.</p>

  <h3>Fair terms, enforced by the contract</h3>
  <p>A lender sets the terms, but not without limits. For every oracle-priced asset the contract holds a collateral floor and a collateral ceiling, and a cap on the fee. A rental whose collateral sits above the ceiling, or whose fee sits above the cap, simply cannot start: the transaction reverts.</p>
  <p>Typical settings are a floor of 150% of the asset's value, a ceiling of 200%, and a fee cap of 10% of the asset's value for the term. That keeps collateral proportionate, so nobody is asked for three times the value of what they are renting, and keeps fees in a range renters will actually accept. The interface presents both as percentages rather than raw amounts, so terms are comparable across listings at a glance.</p>
  <p>Caps apply to rentals that start after a change, never to positions already open.</p>

  <h3>Oracle priced and fixed collateral markets</h3>
  <p>Stock Tokens, WETH and verified stablecoins use Chainlink feeds with staleness checks and the Stock Token <code>oraclePaused()</code> flag during corporate actions. Stock feeds pause when US equity sessions are closed, so their staleness window covers weekends and holidays. Chainlink does not publish a sequencer uptime feed for Robinhood Chain; the guardian can pause new rentals during a network incident while exits keep working. Experimental tokens without a reliable feed can only use a fixed collateral amount, cannot be liquidated early, and should be listed with generous collateral.</p>

  <h3>Timeline of a rental</h3>
  <ol>
    <li>The lender approves the asset and creates a listing. The asset moves into escrow.</li>
    <li>A renter approves collateral plus fee and rents. The fee goes to the lender at once, less any protocol share.</li>
    <li>During the term the renter can add collateral or return early. Early returns do not refund the fee.</li>
    <li>After the due time there is a grace period, currently ${Math.round(S.grace / 3600)} hours, during which the renter can still return.</li>
    <li>After the grace period the lender can claim the collateral of an unreturned fungible rental.</li>
  </ol>

  <h3>What admins can and cannot do</h3>
  <p>The owner is a multisig. It can allowlist assets, set risk parameters and the protocol fee for new rentals, and the guardian can pause new listings and rentals. No admin function can move user funds, and every open rental keeps the grace period, fee rate and liquidation parameters it started with.</p>

  <h3>Stock Token details</h3>
  <p>AERENT accepts a Stock Token only at the contract address in Robinhood's registry. Chainlink feeds already include the corporate-action multiplier, so balances and prices stay consistent through splits and dividends. Tokenised equities can carry eligibility and jurisdiction restrictions that exist independently of this interface.</p>

  <h3>Robinhood Chain</h3>
  <p>Mainnet chain ID <code>4663</code>, testnet <code>46630</code>. Gas is paid in ETH. Use Get ETH for bridging options.</p>
  </article>`;
}

export function renderSecurity(w) {
  const addr = S.net.marketplaceContract;
  w.body.innerHTML = `<article class="prose">
  <h2>Security</h2>
  ${S.src.mode === 'preview' ? note('warn', 'This network runs in preview. No contract is deployed and nothing here touches real funds.') : ''}
  <h3>Contract</h3>
  <p>${addr ? `AerentMarketplace on ${esc(S.net.label)}: ${explorerLink('address', addr)}` : 'Not yet deployed on this network.'}</p>
  <h3>Testing</h3>
  <p>The contract carries a Foundry suite covering every normal and hostile path, plus fuzz and invariant tests: escrow always matches balances, collateral released never exceeds collateral received, a listing can be rented only once, and a closed rental can never be liquidated.</p>
  <h3>Design choices</h3>
  <ul>
    <li>OpenZeppelin SafeERC20, ReentrancyGuard, Pausable and Ownable2Step.</li>
    <li>Fee-on-transfer and rebasing behaviour is rejected by measuring balances around every transfer.</li>
    <li>A recipient that cannot receive a token, for example one blocked by a stablecoin issuer, never traps the other side. The payment is held for them to withdraw later.</li>
    <li>Only allowlisted assets and collateral. Lookalike tokens with a familiar symbol are never accepted.</li>
    <li>Pausing stops new listings and rentals only. Returns, settlements, cancellations and liquidations always work.</li>
    <li>Ownership sits with a Safe multisig. The deployer key is a hardware wallet used for nothing else.</li>
  </ul>
  <h3>Report a vulnerability</h3>
  <p>Email <a href="mailto:${esc(S.cfg.securityEmail)}">${esc(S.cfg.securityEmail)}</a> with a description and reproduction steps. In scope: the AerentMarketplace contract, this website and the indexer API. Please do not test against mainnet funds that are not yours, and give us reasonable time to fix before disclosure.</p>
  </article>`;
}

const LEGAL = {
  terms: ['Terms of use', `<p>AERENT provides software for listing, renting and managing supported onchain assets. By using the interface you are responsible for reviewing each transaction, the asset, the collateral and the rental terms before you sign.</p><h3>Your responsibilities</h3><p>Use the service lawfully, keep control of your wallet and make your own assessment of counterparties, collateral and assets.</p><h3>Blockchain transactions</h3><p>Transactions can be irreversible. Congestion, smart contract faults, oracle outages, token restrictions or third-party failures can affect availability and outcomes.</p><h3>Asset restrictions</h3><p>Tokenised real-world assets can carry eligibility, transfer or jurisdiction restrictions. The interface does not remove them.</p>`],
  privacy: ['Privacy policy', `<p>AERENT works without an account. When you connect a wallet the interface reads your public address to show balances, positions and transactions.</p><h3>Data on your device</h3><p>Preferences, preview state and your transaction history are stored in your browser. Clear them from Settings or your browser at any time.</p><h3>Blockchain data</h3><p>Addresses and transactions are public onchain and cannot be altered or removed by AERENT.</p><h3>Third parties</h3><p>Wallets, RPC providers, the Robinhood Stock Token API and block explorers process requests under their own policies.</p>`],
  disclaimer: ['Risk disclaimer', `<p>AERENT does not provide investment, legal, tax or financial advice. Fees, collateral levels, prices and liquidity change, and collateral may not fully cover a loss.</p><h3>Liquidation risk</h3><p>If the rented asset rises in value your position can be liquidated and you lose the liquidation bonus from your collateral.</p><h3>Smart contract and oracle risk</h3><p>Contracts can contain defects and oracles can pause or fail. Understand the contracts before committing assets.</p>`],
  cookies: ['Cookie policy', `<p>AERENT does not use advertising or tracking cookies. Browser storage keeps workspace preferences and local activity.</p><p>If analytics are ever added, this policy will change before they are enabled.</p>`]
};
export function renderLegal(w) {
  const [title, html] = LEGAL[w.payload?.kind] || LEGAL.terms;
  w.setTitle(title);
  w.body.innerHTML = `<article class="prose"><h2>${title}</h2>${html}<p class="row wrap" style="gap:8px;margin-top:20px">${Object.entries(LEGAL).map(([k, [t]]) => `<button class="btn btn-glass btn-sm" data-legal="${k}">${t}</button>`).join('')}</p></article>`;
}
