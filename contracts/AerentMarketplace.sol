// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function decimals() external view returns (uint8);
}

interface IERC4907 {
    function setUser(uint256 tokenId, address user, uint64 expires) external;
    function userOf(uint256 tokenId) external view returns (address);
}

interface IStockToken {
    function oraclePaused() external view returns (bool);
}

/// @title AERENT Marketplace v3
/// @notice Two products behind one marketplace:
///         1. Fungible rentals: fixed-term, over-collateralised loans of allowlisted ERC-20s. The renter receives
///            fungible tokens and returns the same quantity. Oracle-priced markets carry a health factor and can be
///            liquidated permissionlessly before expiry. Fixed-collateral markets cannot be liquidated early.
///         2. NFT usage rentals: allowlisted ERC-4907 NFTs stay in escrow; the renter only receives expiring user rights.
/// @dev    Admin powers are limited to risk parameters for new positions, the fee rate for new rentals and pausing new
///         listings/rentals. No admin function can move user funds. Open positions keep the parameters snapshotted
///         when they started, and returns, settlements, cancellations and liquidations stay available while paused.
contract AerentMarketplace is Ownable2Step, Pausable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------------------------------------------------

    enum AssetClass { None, VerifiedRWA, VerifiedStablecoin, VerifiedCrypto, Experimental, NFT4907 }
    enum Kind { Fungible, NFTUsage }
    enum Status { Open, Rented, Returned, Defaulted, Liquidated, Cancelled, Settled }
    enum OfferStatus { Open, Filled, Cancelled }

    struct AssetConfig {
        AssetClass class;
        bool listingEnabled;        // may be listed for rent
        bool collateralEnabled;     // may be posted as collateral
        bool fixedCollateralAllowed; // may be rented without an oracle (never liquidated early)
        bool stockToken;            // Robinhood Stock Token: respect oraclePaused()
        uint8 decimals;
        address priceFeed;          // Chainlink AggregatorV3 (USD), zero if none
        uint32 heartbeat;           // max age of a price in seconds
        uint16 minCollateralRatioBps; // opening requirement when this asset is rented (e.g. 15000 = 150%)
        uint16 liquidationRatioBps;   // position becomes liquidatable below this (e.g. 12000 = 120%)
        uint16 liquidationBonusBps;   // discount paid to liquidators (e.g. 500 = 5%)
        uint16 maxCollateralRatioBps; // renter protection: collateral may not exceed this share of asset value
        uint16 maxFeeBps;             // renter protection: fee may not exceed this share of asset value per term
    }

    /// @notice A renter's standing request: collateral and fee are escrowed up front, any holder can fill it.
    struct Offer {
        uint64 id;
        OfferStatus status;
        address renter;
        address asset;
        uint256 amount;
        address collateralToken;
        uint256 collateral;
        uint256 fee;
        uint32 duration;
        uint64 expiresAt;
        uint64 listingId;   // set once filled
    }

    struct Listing {
        uint64 id;
        Kind kind;
        Status status;
        bool oracleMarket;
        address lender;
        address renter;
        address asset;
        uint256 amountOrTokenId;
        address collateralToken;
        uint256 collateralAmount;   // minimum collateral set by the lender; grows if the renter tops up
        uint256 fee;                // fixed rental fee, paid in collateralToken
        uint32 duration;
        uint64 startedAt;
        uint64 dueAt;
        uint32 gracePeriod;         // snapshotted at rent
        uint16 protocolFeeBps;      // snapshotted at rent
        uint16 liquidationRatioBps; // snapshotted at rent
        uint16 liquidationBonusBps; // snapshotted at rent
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Constants and storage
    // ---------------------------------------------------------------------------------------------------------------

    bytes4 private constant ERC4907_INTERFACE_ID = 0xad092b5c;
    uint256 private constant BPS = 10_000;
    uint256 public constant MAX_PROTOCOL_FEE_BPS = 1_000;
    uint32 public constant MIN_DURATION = 1 hours;
    uint32 public constant MAX_DURATION = 365 days;
    uint32 public constant MIN_GRACE = 1 hours;
    uint32 public constant MAX_GRACE = 7 days;
    uint32 public constant SEQUENCER_GRACE = 1 hours;

    uint64 public nextListingId = 1;
    uint64 public nextOfferId = 1;
    uint32 public gracePeriod = 12 hours;
    uint16 public protocolFeeBps;
    address public treasury;
    address public guardian;
    address public sequencerUptimeFeed;

    mapping(address => AssetConfig) private _assets;
    address[] private _assetList;
    mapping(address => bool) private _assetKnown;
    mapping(uint256 => Listing) private _listings;
    /// @notice Tokens the marketplace currently owes to users, by token. Used by invariant checks and monitoring.
    mapping(address => uint256) public escrowed;
    /// @notice Payments that could not be pushed (for example a blocklisted stablecoin recipient). Pull with withdraw().
    mapping(address => mapping(address => uint256)) public claimable;
    mapping(address => uint256) public totalClaimable;
    /// @notice Listing ids created by or rented by an account, for wallets that do not run an indexer.
    mapping(address => uint256[]) private _accountListings;
    mapping(uint256 => Offer) private _offers;
    mapping(address => uint256[]) private _accountOffers;

    // ---------------------------------------------------------------------------------------------------------------
    // Events (the indexer consumes all of these)
    // ---------------------------------------------------------------------------------------------------------------

    event AssetConfigured(address indexed token, AssetClass class, AssetConfig config);
    event ListingCreated(
        uint256 indexed id,
        address indexed lender,
        address indexed asset,
        Kind kind,
        uint256 amountOrTokenId,
        address collateralToken,
        uint256 collateralAmount,
        uint256 fee,
        uint32 duration,
        bool oracleMarket
    );
    event Rented(uint256 indexed id, address indexed renter, uint256 collateralAmount, uint64 dueAt, uint256 protocolFee);
    event CollateralAdded(uint256 indexed id, address indexed renter, uint256 amount, uint256 newCollateral);
    event Returned(uint256 indexed id, address indexed renter);
    event Settled(uint256 indexed id, address indexed caller);
    event DefaultClaimed(uint256 indexed id, address indexed lender, uint256 collateralAmount);
    event Liquidated(
        uint256 indexed id, address indexed liquidator, uint256 seizedCollateral, uint256 returnedToRenter, uint256 healthFactor
    );
    event ListingCancelled(uint256 indexed id);
    event OfferCreated(
        uint256 indexed id, address indexed renter, address indexed asset, uint256 amount,
        address collateralToken, uint256 collateral, uint256 fee, uint32 duration, uint64 expiresAt
    );
    event OfferCancelled(uint256 indexed id, address indexed renter);
    event OfferFilled(uint256 indexed id, address indexed lender, uint256 indexed listingId, uint256 protocolFee);
    event PaymentDeferred(address indexed token, address indexed to, uint256 amount);
    event Withdrawn(address indexed token, address indexed account, address indexed to, uint256 amount);
    event ProtocolFeeUpdated(uint16 bps);
    event TreasuryUpdated(address treasury);
    event GracePeriodUpdated(uint32 seconds_);
    event GuardianUpdated(address guardian);
    event SequencerFeedUpdated(address feed);

    // ---------------------------------------------------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------------------------------------------------

    error NotAllowed();
    error ZeroAddress();
    error BadParameter();
    error AssetNotListable();
    error CollateralNotAccepted();
    error CollateralNeedsOracle();
    error OracleRequired();
    error NotERC4907();
    error UnexpectedTransferAmount();
    error InvalidStatus();
    error NotRenter();
    error NotLender();
    error TooEarly();
    error Healthy();
    error Undercollateralised();
    error UnknownListing();
    error StalePrice();
    error InvalidPrice();
    error SequencerDown();
    error OraclePaused();
    error OfferExpired();
    error UnknownOffer();
    error CollateralTooHigh();
    error FeeTooHigh();

    // ---------------------------------------------------------------------------------------------------------------
    // Construction and admin
    // ---------------------------------------------------------------------------------------------------------------

    constructor(address owner_, address treasury_, address guardian_) Ownable(owner_) {
        if (treasury_ == address(0) || guardian_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        guardian = guardian_;
    }

    modifier onlyGuardianOrOwner() {
        if (msg.sender != guardian && msg.sender != owner()) revert NotAllowed();
        _;
    }

    /// @notice Pause stops new listings and new rentals only. Exits are never paused.
    function pause() external onlyGuardianOrOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setGuardian(address g) external onlyOwner {
        if (g == address(0)) revert ZeroAddress();
        guardian = g;
        emit GuardianUpdated(g);
    }

    function setTreasury(address t) external onlyOwner {
        if (t == address(0)) revert ZeroAddress();
        treasury = t;
        emit TreasuryUpdated(t);
    }

    /// @notice Applies to rentals started after the change.
    function setProtocolFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_PROTOCOL_FEE_BPS) revert BadParameter();
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(bps);
    }

    /// @notice Applies to rentals started after the change.
    function setGracePeriod(uint32 s) external onlyOwner {
        if (s < MIN_GRACE || s > MAX_GRACE) revert BadParameter();
        gracePeriod = s;
        emit GracePeriodUpdated(s);
    }

    function setSequencerUptimeFeed(address feed) external onlyOwner {
        sequencerUptimeFeed = feed;
        emit SequencerFeedUpdated(feed);
    }

    /// @notice Allowlist or update a token. Only affects listings and rentals created afterwards.
    function configureAsset(address token, AssetConfig calldata cfg) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        AssetConfig memory c = cfg;
        if (c.class == AssetClass.NFT4907) {
            if (!IERC165(token).supportsInterface(ERC4907_INTERFACE_ID)) revert NotERC4907();
            if (c.collateralEnabled || c.priceFeed != address(0)) revert BadParameter();
            c.decimals = 0;
        } else if (c.class != AssetClass.None) {
            c.decimals = IERC20Metadata(token).decimals();
            if (c.priceFeed != address(0)) {
                if (c.heartbeat == 0) revert BadParameter();
                if (c.liquidationRatioBps < BPS || c.minCollateralRatioBps <= c.liquidationRatioBps) revert BadParameter();
                if (c.liquidationBonusBps > 2_000) revert BadParameter();
                // caps protect renters from unfillable terms: collateral ceiling must sit above the opening floor
                if (c.maxCollateralRatioBps < c.minCollateralRatioBps || c.maxFeeBps > 2_000) revert BadParameter();
                // bonus must fit inside the liquidation buffer, otherwise liquidations are always bad debt
                if (BPS + c.liquidationBonusBps > c.liquidationRatioBps) revert BadParameter();
            }
        }
        _assets[token] = c;
        if (!_assetKnown[token]) { _assetKnown[token] = true; _assetList.push(token); }
        emit AssetConfigured(token, c.class, c);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Lender actions
    // ---------------------------------------------------------------------------------------------------------------

    function createListing(
        address asset,
        uint256 amountOrTokenId,
        address collateralToken,
        uint256 collateralAmount,
        uint256 fee,
        uint32 duration
    ) external nonReentrant whenNotPaused returns (uint256 id) {
        AssetConfig memory a = _assets[asset];
        AssetConfig memory c = _assets[collateralToken];
        if (!a.listingEnabled || a.class == AssetClass.None) revert AssetNotListable();
        if (!c.collateralEnabled || c.class == AssetClass.NFT4907) revert CollateralNotAccepted();
        if (asset == collateralToken) revert BadParameter();
        if (collateralAmount == 0) revert BadParameter();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert BadParameter();

        Kind kind = a.class == AssetClass.NFT4907 ? Kind.NFTUsage : Kind.Fungible;
        bool oracleMarket;
        if (kind == Kind.Fungible) {
            if (amountOrTokenId == 0) revert BadParameter();
            if (a.priceFeed != address(0)) {
                if (c.priceFeed == address(0)) revert CollateralNeedsOracle();
                oracleMarket = true;
            } else if (!a.fixedCollateralAllowed) {
                revert OracleRequired();
            }
        }

        id = _newListing(Listing({
            id: 0, kind: kind, status: Status.Open, oracleMarket: oracleMarket, lender: msg.sender, renter: address(0),
            asset: asset, amountOrTokenId: amountOrTokenId, collateralToken: collateralToken, collateralAmount: collateralAmount,
            fee: fee, duration: duration, startedAt: 0, dueAt: 0, gracePeriod: 0, protocolFeeBps: 0,
            liquidationRatioBps: 0, liquidationBonusBps: 0
        }));

        if (kind == Kind.Fungible) {
            _pullExact(asset, msg.sender, amountOrTokenId);
            escrowed[asset] += amountOrTokenId;
        } else {
            IERC721(asset).safeTransferFrom(msg.sender, address(this), amountOrTokenId);
        }

        emit ListingCreated(
            id, msg.sender, asset, kind, amountOrTokenId, collateralToken, collateralAmount, fee, duration, oracleMarket
        );
    }

    function cancelListing(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (l.status != Status.Open) revert InvalidStatus();
        if (msg.sender != l.lender) revert NotLender();
        l.status = Status.Cancelled;
        if (l.kind == Kind.Fungible) {
            escrowed[l.asset] -= l.amountOrTokenId;
            _payOut(l.asset, l.lender, l.amountOrTokenId);
        } else {
            IERC721(l.asset).transferFrom(address(this), l.lender, l.amountOrTokenId);
        }
        emit ListingCancelled(id);
    }

    /// @notice After expiry plus the grace period the lender may take the collateral of an unreturned fungible rental.
    function claimDefault(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (l.status != Status.Rented || l.kind != Kind.Fungible) revert InvalidStatus();
        if (msg.sender != l.lender) revert NotLender();
        if (block.timestamp <= uint256(l.dueAt) + l.gracePeriod) revert TooEarly();
        l.status = Status.Defaulted;
        uint256 amt = l.collateralAmount;
        escrowed[l.collateralToken] -= amt;
        _payOut(l.collateralToken, l.lender, amt);
        emit DefaultClaimed(id, l.lender, amt);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Renter actions
    // ---------------------------------------------------------------------------------------------------------------

    /// @param collateralAmount Collateral to post. Must be at least the lender's minimum, and in oracle markets
    ///        large enough to satisfy the asset's opening collateral ratio.
    /// @param maxFee Slippage guard for the fee, protects against a lender front-running with a different listing.
    function rent(uint256 id, uint256 collateralAmount, uint256 maxFee) external nonReentrant whenNotPaused {
        Listing storage l = _get(id);
        if (l.status != Status.Open) revert InvalidStatus();
        if (msg.sender == l.lender) revert NotAllowed();
        if (l.fee > maxFee) revert BadParameter();
        if (collateralAmount < l.collateralAmount) revert Undercollateralised();

        AssetConfig memory a = _assets[l.asset];
        if (l.oracleMarket) _checkTerms(a, l.asset, l.amountOrTokenId, l.collateralToken, collateralAmount, l.fee);

        uint16 pFee = protocolFeeBps;
        l.renter = msg.sender;
        l.collateralAmount = collateralAmount;
        l.startedAt = uint64(block.timestamp);
        l.dueAt = uint64(block.timestamp + l.duration);
        l.gracePeriod = gracePeriod;
        l.protocolFeeBps = pFee;
        l.liquidationRatioBps = a.liquidationRatioBps;
        l.liquidationBonusBps = a.liquidationBonusBps;
        l.status = Status.Rented;
        _accountListings[msg.sender].push(id);

        _pullExact(l.collateralToken, msg.sender, collateralAmount + l.fee);
        escrowed[l.collateralToken] += collateralAmount;

        uint256 protocolCut = (l.fee * pFee) / BPS;
        if (protocolCut > 0) _payOut(l.collateralToken, treasury, protocolCut);
        if (l.fee - protocolCut > 0) _payOut(l.collateralToken, l.lender, l.fee - protocolCut);

        if (l.kind == Kind.Fungible) {
            escrowed[l.asset] -= l.amountOrTokenId;
            IERC20(l.asset).safeTransfer(msg.sender, l.amountOrTokenId);
        } else {
            IERC4907(l.asset).setUser(l.amountOrTokenId, msg.sender, l.dueAt);
        }
        emit Rented(id, msg.sender, collateralAmount, l.dueAt, protocolCut);
    }

    /// @notice Top up collateral on an active rental to improve its health factor.
    function addCollateral(uint256 id, uint256 amount) external nonReentrant {
        Listing storage l = _get(id);
        if (l.status != Status.Rented) revert InvalidStatus();
        if (msg.sender != l.renter) revert NotRenter();
        if (amount == 0) revert BadParameter();
        _pullExact(l.collateralToken, msg.sender, amount);
        l.collateralAmount += amount;
        escrowed[l.collateralToken] += amount;
        emit CollateralAdded(id, msg.sender, amount, l.collateralAmount);
    }

    /// @notice Return a fungible rental (approve the asset first) or end an NFT usage rental early.
    ///         Allowed until the position is defaulted or liquidated, including during the grace period.
    function returnRental(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (l.status != Status.Rented) revert InvalidStatus();
        if (msg.sender != l.renter) revert NotRenter();
        l.status = Status.Returned;
        if (l.kind == Kind.Fungible) {
            _deliver(l.asset, msg.sender, l.lender, l.amountOrTokenId);
        } else {
            _endUsage(l);
        }
        _releaseCollateral(l, l.renter);
        emit Returned(id, msg.sender);
    }

    /// @notice Anyone may settle an expired NFT usage rental: NFT back to lender, collateral back to renter.
    function settleExpired(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (l.status != Status.Rented || l.kind != Kind.NFTUsage) revert InvalidStatus();
        if (block.timestamp <= l.dueAt) revert TooEarly();
        l.status = Status.Settled;
        _endUsage(l);
        _releaseCollateral(l, l.renter);
        emit Settled(id, msg.sender);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Liquidation
    // ---------------------------------------------------------------------------------------------------------------

    /// @notice Permissionless liquidation of an unhealthy oracle-priced fungible rental.
    ///         The liquidator delivers the rented quantity to the lender and receives collateral worth the asset value
    ///         plus the liquidation bonus. Any surplus collateral goes back to the renter.
    function liquidate(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (l.status != Status.Rented || l.kind != Kind.Fungible || !l.oracleMarket) revert InvalidStatus();

        (uint256 assetValue, uint256 collValue) = _values(l.asset, l.amountOrTokenId, l.collateralToken, l.collateralAmount);
        uint256 hf = _healthFactor(assetValue, collValue, l.liquidationRatioBps);
        if (hf >= 1e18) revert Healthy();

        l.status = Status.Liquidated;
        _deliver(l.asset, msg.sender, l.lender, l.amountOrTokenId);

        uint256 collateral = l.collateralAmount;
        uint256 seize = collValue == 0
            ? collateral
            : (collateral * assetValue * (BPS + l.liquidationBonusBps)) / (collValue * BPS);
        if (seize > collateral) seize = collateral;
        uint256 surplus = collateral - seize;

        escrowed[l.collateralToken] -= collateral;
        IERC20(l.collateralToken).safeTransfer(msg.sender, seize);
        if (surplus > 0) _payOut(l.collateralToken, l.renter, surplus);
        emit Liquidated(id, msg.sender, seize, surplus, hf);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Offers: the renter posts the terms and escrows collateral, any holder can fill
    // ---------------------------------------------------------------------------------------------------------------

    /// @notice Post a request to rent `amount` of `asset`. Collateral and fee move into escrow immediately.
    ///         Fungible assets only: an NFT request cannot be met from a fungible balance.
    function createOffer(
        address asset,
        uint256 amount,
        address collateralToken,
        uint256 collateral,
        uint256 fee,
        uint32 duration,
        uint64 expiresAt
    ) external nonReentrant whenNotPaused returns (uint256 id) {
        AssetConfig memory a = _assets[asset];
        AssetConfig memory c = _assets[collateralToken];
        if (!a.listingEnabled || a.class == AssetClass.None || a.class == AssetClass.NFT4907) revert AssetNotListable();
        if (!c.collateralEnabled || c.class == AssetClass.NFT4907) revert CollateralNotAccepted();
        if (asset == collateralToken) revert BadParameter();
        if (amount == 0 || collateral == 0) revert BadParameter();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert BadParameter();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_DURATION) revert BadParameter();
        if (a.priceFeed != address(0)) {
            if (c.priceFeed == address(0)) revert CollateralNeedsOracle();
        } else if (!a.fixedCollateralAllowed) {
            revert OracleRequired();
        }

        id = nextOfferId++;
        _offers[id] = Offer({
            id: uint64(id), status: OfferStatus.Open, renter: msg.sender, asset: asset, amount: amount,
            collateralToken: collateralToken, collateral: collateral, fee: fee, duration: duration,
            expiresAt: expiresAt, listingId: 0
        });
        _accountOffers[msg.sender].push(id);

        _pullExact(collateralToken, msg.sender, collateral + fee);
        escrowed[collateralToken] += collateral + fee;

        emit OfferCreated(id, msg.sender, asset, amount, collateralToken, collateral, fee, duration, expiresAt);
    }

    /// @notice Withdraw an unfilled offer. Available at any time, including while paused.
    function cancelOffer(uint256 id) external nonReentrant {
        Offer storage o = _getOffer(id);
        if (o.status != OfferStatus.Open) revert InvalidStatus();
        if (msg.sender != o.renter) revert NotRenter();
        o.status = OfferStatus.Cancelled;
        uint256 amt = o.collateral + o.fee;
        escrowed[o.collateralToken] -= amt;
        _payOut(o.collateralToken, o.renter, amt);
        emit OfferCancelled(id, o.renter);
    }

    /// @notice Fill someone's request with your own tokens. The rental starts immediately on their terms.
    /// @param minFee Slippage guard: reverts if the offer's fee is below what you expected.
    function fillOffer(uint256 id, uint256 minFee) external nonReentrant whenNotPaused returns (uint256 listingId) {
        Offer storage o = _getOffer(id);
        if (o.status != OfferStatus.Open) revert InvalidStatus();
        if (block.timestamp >= o.expiresAt) revert OfferExpired();
        if (msg.sender == o.renter) revert NotAllowed();
        if (o.fee < minFee) revert BadParameter();

        AssetConfig memory a = _assets[o.asset];
        if (!a.listingEnabled || a.class == AssetClass.None) revert AssetNotListable();
        bool oracleMarket = a.priceFeed != address(0);
        if (oracleMarket) _checkTerms(a, o.asset, o.amount, o.collateralToken, o.collateral, o.fee);

        uint16 pFee = protocolFeeBps;
        listingId = _newListing(Listing({
            id: 0, kind: Kind.Fungible, status: Status.Rented, oracleMarket: oracleMarket,
            lender: msg.sender, renter: o.renter, asset: o.asset, amountOrTokenId: o.amount,
            collateralToken: o.collateralToken, collateralAmount: o.collateral, fee: o.fee, duration: o.duration,
            startedAt: uint64(block.timestamp), dueAt: uint64(block.timestamp + o.duration), gracePeriod: gracePeriod,
            protocolFeeBps: pFee, liquidationRatioBps: a.liquidationRatioBps, liquidationBonusBps: a.liquidationBonusBps
        }));
        _accountListings[o.renter].push(listingId);
        o.status = OfferStatus.Filled;
        o.listingId = uint64(listingId);

        // the asset goes straight to the renter, the escrowed fee is released to the filler
        _deliver(o.asset, msg.sender, o.renter, o.amount);
        escrowed[o.collateralToken] -= o.fee;
        uint256 protocolCut = (o.fee * pFee) / BPS;
        if (protocolCut > 0) _payOut(o.collateralToken, treasury, protocolCut);
        if (o.fee - protocolCut > 0) _payOut(o.collateralToken, msg.sender, o.fee - protocolCut);

        emit ListingCreated(
            listingId, msg.sender, o.asset, Kind.Fungible, o.amount, o.collateralToken, o.collateral, o.fee, o.duration, oracleMarket
        );
        emit Rented(listingId, o.renter, o.collateral, uint64(block.timestamp + o.duration), protocolCut);
        emit OfferFilled(id, msg.sender, listingId, protocolCut);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------------------------

    function listingCount() external view returns (uint256) { return nextListingId - 1; }

    function getListing(uint256 id) external view returns (Listing memory) { return _get(id); }

    /// @notice Paged read, newest first when `newestFirst` is set. Used when no indexer is configured.
    function getListings(uint256 offset, uint256 limit, bool newestFirst) external view returns (Listing[] memory out) {
        uint256 total = nextListingId - 1;
        if (offset >= total) return new Listing[](0);
        uint256 n = total - offset < limit ? total - offset : limit;
        out = new Listing[](n);
        for (uint256 i; i < n; ++i) {
            uint256 id = newestFirst ? total - offset - i : offset + i + 1;
            out[i] = _listings[id];
        }
    }

    function offerCount() external view returns (uint256) { return nextOfferId - 1; }

    function getOffer(uint256 id) external view returns (Offer memory) { return _getOffer(id); }

    /// @notice Paged read of offers, newest first when `newestFirst` is set.
    function getOffers(uint256 offset, uint256 limit, bool newestFirst) external view returns (Offer[] memory out) {
        uint256 total = nextOfferId - 1;
        if (offset >= total) return new Offer[](0);
        uint256 n = total - offset < limit ? total - offset : limit;
        out = new Offer[](n);
        for (uint256 i; i < n; ++i) {
            uint256 id = newestFirst ? total - offset - i : offset + i + 1;
            out[i] = _offers[id];
        }
    }

    function assetConfig(address token) external view returns (AssetConfig memory) { return _assets[token]; }

    /// @notice USD price with 18 decimals for one whole token. Reverts if the price cannot be trusted.
    function priceOf(address token) external view returns (uint256) { return _price(token); }

    /// @notice Every token ever configured (check assetConfig for its current state). Lets the UI work without an indexer.
    function assetList() external view returns (address[] memory) { return _assetList; }

    /// @notice Health factor with 18 decimals. Below 1e18 is liquidatable. type(uint256).max for non-oracle rentals.
    function healthFactor(uint256 id) external view returns (uint256) {
        Listing storage l = _get(id);
        if (!l.oracleMarket || l.status != Status.Rented) return type(uint256).max;
        (uint256 assetValue, uint256 collValue) = _values(l.asset, l.amountOrTokenId, l.collateralToken, l.collateralAmount);
        return _healthFactor(assetValue, collValue, l.liquidationRatioBps);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------------------------------

    function _newListing(Listing memory l) private returns (uint256 id) {
        id = nextListingId++;
        l.id = uint64(id);
        _listings[id] = l;
        _accountListings[msg.sender].push(id);
    }

    function _get(uint256 id) private view returns (Listing storage l) {
        if (id == 0 || id >= nextListingId) revert UnknownListing();
        l = _listings[id];
    }

    function _getOffer(uint256 id) private view returns (Offer storage o) {
        if (id == 0 || id >= nextOfferId) revert UnknownOffer();
        o = _offers[id];
    }

    function _endUsage(Listing storage l) private {
        IERC4907(l.asset).setUser(l.amountOrTokenId, address(0), 0);
        // plain transferFrom: a lender contract without a receiver hook must not be able to lock renter collateral
        IERC721(l.asset).transferFrom(address(this), l.lender, l.amountOrTokenId);
    }

    function _releaseCollateral(Listing storage l, address to) private {
        uint256 amt = l.collateralAmount;
        escrowed[l.collateralToken] -= amt;
        _payOut(l.collateralToken, to, amt);
    }

    /// @dev Pulls tokens into escrow and rejects fee-on-transfer or otherwise lossy tokens.
    function _pullExact(address token, address from, uint256 amount) private {
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        if (IERC20(token).balanceOf(address(this)) - before != amount) revert UnexpectedTransferAmount();
    }

    /// @dev Takes `amount` from `from` into escrow, then pays it to `to`. Routing through escrow means a recipient that
    ///      cannot receive (blocklisted, paused, reverting) never blocks the payer: the amount is credited instead.
    function _deliver(address token, address from, address to, uint256 amount) private {
        _pullExact(token, from, amount);
        _payOut(token, to, amount);
    }

    /// @dev Push a payment, or record it as claimable if the transfer fails. Never reverts on a failed transfer.
    function _payOut(address token, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
        bool success = ok && (data.length == 0 ? token.code.length > 0 : (data.length >= 32 && abi.decode(data, (bool))));
        if (success) return;
        claimable[token][to] += amount;
        totalClaimable[token] += amount;
        escrowed[token] += amount;
        emit PaymentDeferred(token, to, amount);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Deferred payments
    // ---------------------------------------------------------------------------------------------------------------

    /// @notice Withdraw a payment that could not be pushed earlier. `to` lets a blocked account route funds elsewhere.
    function withdraw(address token, address to) external nonReentrant {
        uint256 amt = claimable[token][msg.sender];
        if (amt == 0 || to == address(0)) revert BadParameter();
        claimable[token][msg.sender] = 0;
        totalClaimable[token] -= amt;
        escrowed[token] -= amt;
        IERC20(token).safeTransfer(to, amt);
        emit Withdrawn(token, msg.sender, to, amt);
    }

    /// @dev Both sides are protected here: the lender by the collateral floor, the renter by the collateral
    ///      ceiling and the fee cap. Terms outside these bounds simply cannot start a rental.
    function _checkTerms(
        AssetConfig memory a, address asset, uint256 amount, address coll, uint256 collAmount, uint256 fee
    ) private view {
        (uint256 assetValue, uint256 collValue) = _values(asset, amount, coll, collAmount);
        if (collValue * BPS < assetValue * a.minCollateralRatioBps) revert Undercollateralised();
        if (a.maxCollateralRatioBps != 0 && collValue * BPS > assetValue * a.maxCollateralRatioBps) revert CollateralTooHigh();
        if (a.maxFeeBps != 0 && fee != 0) {
            (, uint256 feeValue) = _values(asset, 0, coll, fee);
            if (feeValue * BPS > assetValue * a.maxFeeBps) revert FeeTooHigh();
        }
    }

    function _values(address asset, uint256 amount, address coll, uint256 collAmount)
        private
        view
        returns (uint256 assetValue, uint256 collValue)
    {
        assetValue = (amount * _price(asset)) / (10 ** _assets[asset].decimals);
        collValue = (collAmount * _price(coll)) / (10 ** _assets[coll].decimals);
    }

    function _healthFactor(uint256 assetValue, uint256 collValue, uint16 liqRatioBps) private pure returns (uint256) {
        if (assetValue == 0) return type(uint256).max;
        return (collValue * BPS * 1e18) / (assetValue * liqRatioBps);
    }

    function _price(address token) private view returns (uint256) {
        AssetConfig memory cfg = _assets[token];
        if (cfg.priceFeed == address(0)) revert OracleRequired();

        address seq = sequencerUptimeFeed;
        if (seq != address(0)) {
            (, int256 status, uint256 startedAt,,) = IAggregatorV3(seq).latestRoundData();
            if (status != 0) revert SequencerDown();
            if (block.timestamp - startedAt <= SEQUENCER_GRACE) revert SequencerDown();
        }

        if (cfg.stockToken) {
            // advisory flag exposed by Robinhood Stock Tokens during corporate actions
            (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(IStockToken.oraclePaused.selector));
            if (ok && data.length >= 32 && abi.decode(data, (bool))) revert OraclePaused();
        }

        IAggregatorV3 feed = IAggregatorV3(cfg.priceFeed);
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || answeredInRound < roundId) revert InvalidPrice();
        if (updatedAt > block.timestamp || block.timestamp - updatedAt > cfg.heartbeat) revert StalePrice();
        uint8 fd = feed.decimals();
        return fd <= 18 ? uint256(answer) * 10 ** (18 - fd) : uint256(answer) / 10 ** (fd - 18);
    }

    function onERC721Received(address operator, address, uint256, bytes calldata) external view returns (bytes4) {
        // only accept NFTs that the marketplace itself pulled in during createListing
        if (operator != address(this)) revert NotAllowed();
        return IERC721Receiver.onERC721Received.selector;
    }
}
