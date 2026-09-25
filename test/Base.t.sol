// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AerentMarketplace} from "../contracts/AerentMarketplace.sol";
import {MockERC20, MockFeed, MockERC4907, FeeOnTransferToken, PlainERC721} from "./mocks/Mocks.sol";

abstract contract Base is Test {
    AerentMarketplace mkt;
    MockERC20 aapl;   // stock token, 18 decimals
    MockERC20 usdg;   // stablecoin, 6 decimals
    MockERC20 meme;   // experimental, no oracle
    MockERC4907 pass;
    MockFeed aaplFeed;
    MockFeed usdgFeed;
    MockFeed seqFeed;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address guardian = makeAddr("guardian");
    address lender = makeAddr("lender");
    address renter = makeAddr("renter");
    address liquidator = makeAddr("liquidator");

    uint32 constant DAY = 1 days;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        mkt = new AerentMarketplace(owner, treasury, guardian);
        aapl = new MockERC20("Apple", "AAPL", 18);
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        meme = new MockERC20("Sky Meme", "SKY", 18);
        pass = new MockERC4907();
        aaplFeed = new MockFeed(200e8, 8);
        usdgFeed = new MockFeed(1e8, 8);
        seqFeed = new MockFeed(0, 0);
        seqFeed.setStartedAt(block.timestamp - 2 hours);

        vm.startPrank(owner);
        mkt.configureAsset(address(aapl), _cfg(AerentMarketplace.AssetClass.VerifiedRWA, true, false, false, true, address(aaplFeed), 15000, 12000, 500));
        mkt.configureAsset(address(usdg), _cfg(AerentMarketplace.AssetClass.VerifiedStablecoin, true, true, false, false, address(usdgFeed), 11000, 10500, 200));
        mkt.configureAsset(address(meme), _cfg(AerentMarketplace.AssetClass.Experimental, true, false, true, false, address(0), 0, 0, 0));
        mkt.configureAsset(address(pass), _cfg(AerentMarketplace.AssetClass.NFT4907, true, false, false, false, address(0), 0, 0, 0));
        mkt.setSequencerUptimeFeed(address(seqFeed));
        vm.stopPrank();

        aapl.mint(lender, 1_000e18);
        pass.mint(lender, 482);
        meme.mint(lender, 10_000_000e18);
        usdg.mint(renter, 10_000_000e6);
        aapl.mint(liquidator, 1_000e18);
        aapl.mint(renter, 1_000e18);

        vm.startPrank(lender);
        aapl.approve(address(mkt), type(uint256).max);
        meme.approve(address(mkt), type(uint256).max);
        pass.setApprovalForAll(address(mkt), true);
        vm.stopPrank();
        vm.prank(renter);
        usdg.approve(address(mkt), type(uint256).max);
        vm.prank(liquidator);
        aapl.approve(address(mkt), type(uint256).max);
    }

    function _cfg(
        AerentMarketplace.AssetClass c, bool listing, bool coll, bool fixedOk, bool stock,
        address feed, uint16 minCR, uint16 liqR, uint16 bonus
    ) internal pure returns (AerentMarketplace.AssetConfig memory) {
        return _cfg(c, listing, coll, fixedOk, stock, feed, minCR, liqR, bonus, minCR == 0 ? 0 : 20000, 1000);
    }

    function _cfg(
        AerentMarketplace.AssetClass c, bool listing, bool coll, bool fixedOk, bool stock,
        address feed, uint16 minCR, uint16 liqR, uint16 bonus, uint16 maxCR, uint16 maxFee
    ) internal pure returns (AerentMarketplace.AssetConfig memory) {
        return AerentMarketplace.AssetConfig({
            class: c, listingEnabled: listing, collateralEnabled: coll, fixedCollateralAllowed: fixedOk,
            stockToken: stock, decimals: 0, priceFeed: feed, heartbeat: feed == address(0) ? 0 : 1 days,
            minCollateralRatioBps: minCR, liquidationRatioBps: liqR, liquidationBonusBps: bonus,
            maxCollateralRatioBps: maxCR, maxFeeBps: maxFee
        });
    }

    /// 10 AAPL at $200 = $2,000. Lender minimum collateral 3,000 USDG, fee 20 USDG, 14 days.
    function _listAapl() internal returns (uint256 id) {
        vm.prank(lender);
        id = mkt.createListing(address(aapl), 10e18, address(usdg), 3_000e6, 20e6, 14 * DAY);
    }

    function _rent(uint256 id, uint256 coll) internal {
        vm.prank(renter);
        mkt.rent(id, coll, type(uint256).max);
    }

    function _status(uint256 id) internal view returns (AerentMarketplace.Status) {
        return mkt.getListing(id).status;
    }
}
