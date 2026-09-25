// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {AerentMarketplace} from "../contracts/AerentMarketplace.sol";
import {MockERC20, MockFeed, FeeOnTransferToken, PlainERC721} from "./mocks/Mocks.sol";

contract AerentMarketplaceTest is Base {
    // ---------------- listing ----------------

    function test_createListing_escrowsAsset() public {
        uint256 id = _listAapl();
        assertEq(id, 1);
        assertEq(aapl.balanceOf(address(mkt)), 10e18);
        assertEq(mkt.escrowed(address(aapl)), 10e18);
        AerentMarketplace.Listing memory l = mkt.getListing(id);
        assertTrue(l.oracleMarket);
        assertEq(uint8(l.status), uint8(AerentMarketplace.Status.Open));
    }

    function test_revert_unlistedAsset() public {
        MockERC20 fake = new MockERC20("USD Coin", "USDC", 6);
        fake.mint(lender, 1e12);
        vm.startPrank(lender);
        fake.approve(address(mkt), type(uint256).max);
        vm.expectRevert(AerentMarketplace.AssetNotListable.selector);
        mkt.createListing(address(fake), 1e6, address(usdg), 1e6, 0, DAY);
        vm.stopPrank();
    }

    function test_revert_unapprovedCollateral() public {
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.CollateralNotAccepted.selector);
        mkt.createListing(address(aapl), 1e18, address(meme), 1e18, 0, DAY);
    }

    function test_revert_badDuration() public {
        vm.startPrank(lender);
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.createListing(address(aapl), 1e18, address(usdg), 1e6, 0, 30 minutes);
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.createListing(address(aapl), 1e18, address(usdg), 1e6, 0, 366 days);
        vm.stopPrank();
    }

    function test_revert_feeOnTransferAsset() public {
        FeeOnTransferToken fot = new FeeOnTransferToken();
        vm.prank(owner);
        mkt.configureAsset(address(fot), _cfg(AerentMarketplace.AssetClass.Experimental, true, false, true, false, address(0), 0, 0, 0));
        fot.mint(lender, 1_000e18);
        vm.startPrank(lender);
        fot.approve(address(mkt), type(uint256).max);
        vm.expectRevert(AerentMarketplace.UnexpectedTransferAmount.selector);
        mkt.createListing(address(fot), 100e18, address(usdg), 1e6, 0, DAY);
        vm.stopPrank();
    }

    function test_revert_plainERC721_notConfigurableAsRental() public {
        PlainERC721 nft = new PlainERC721();
        vm.prank(owner);
        vm.expectRevert(AerentMarketplace.NotERC4907.selector);
        mkt.configureAsset(address(nft), _cfg(AerentMarketplace.AssetClass.NFT4907, true, false, false, false, address(0), 0, 0, 0));
    }

    function test_revert_unsolicitedNFTTransfer() public {
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.NotAllowed.selector);
        pass.safeTransferFrom(lender, address(mkt), 482);
    }

    function test_cancelListing_returnsAsset() public {
        uint256 id = _listAapl();
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.NotLender.selector);
        mkt.cancelListing(id);
        vm.prank(lender);
        mkt.cancelListing(id);
        assertEq(aapl.balanceOf(lender), 1_000e18);
        assertEq(mkt.escrowed(address(aapl)), 0);
        vm.expectRevert(AerentMarketplace.InvalidStatus.selector);
        _rent(id, 3_000e6);
    }

    // ---------------- renting ----------------

    function test_rent_happyPath_feeSplit() public {
        vm.prank(owner);
        mkt.setProtocolFeeBps(1000); // 10%
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        assertEq(aapl.balanceOf(renter), 1_010e18);
        assertEq(usdg.balanceOf(lender), 18e6);
        assertEq(usdg.balanceOf(treasury), 2e6);
        assertEq(mkt.escrowed(address(usdg)), 3_000e6);
        AerentMarketplace.Listing memory l = mkt.getListing(id);
        assertEq(l.dueAt, block.timestamp + 14 days);
        assertEq(l.gracePeriod, 12 hours);
    }

    function test_revert_rentBelowOracleRequirement() public {
        vm.prank(lender);
        uint256 id = mkt.createListing(address(aapl), 10e18, address(usdg), 1_000e6, 20e6, DAY);
        // $2,000 of AAPL needs 150% = 3,000 USDG
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.Undercollateralised.selector);
        mkt.rent(id, 2_999e6, type(uint256).max);
        _rent(id, 3_000e6);
    }

    function test_revert_rentBelowLenderMinimum() public {
        uint256 id = _listAapl();
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.Undercollateralised.selector);
        mkt.rent(id, 2_500e6, type(uint256).max);
    }

    function test_revert_feeSlippage() public {
        uint256 id = _listAapl();
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.rent(id, 3_000e6, 19e6);
    }

    function test_revert_doubleRent() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        address other = makeAddr("other");
        usdg.mint(other, 1e12);
        vm.startPrank(other);
        usdg.approve(address(mkt), type(uint256).max);
        vm.expectRevert(AerentMarketplace.InvalidStatus.selector);
        mkt.rent(id, 3_000e6, type(uint256).max);
        vm.stopPrank();
    }

    function test_revert_lenderCannotRent() public {
        uint256 id = _listAapl();
        usdg.mint(lender, 1e12);
        vm.startPrank(lender);
        usdg.approve(address(mkt), type(uint256).max);
        vm.expectRevert(AerentMarketplace.NotAllowed.selector);
        mkt.rent(id, 3_000e6, type(uint256).max);
        vm.stopPrank();
    }

    // ---------------- returning ----------------

    function test_earlyReturn_releasesCollateral_noFeeRefund() public {
        uint256 id = _listAapl();
        uint256 before = usdg.balanceOf(renter);
        _rent(id, 3_000e6);
        vm.warp(block.timestamp + 2 days);
        vm.startPrank(renter);
        aapl.approve(address(mkt), 10e18);
        mkt.returnRental(id);
        vm.stopPrank();
        assertEq(uint8(_status(id)), uint8(AerentMarketplace.Status.Returned));
        assertEq(aapl.balanceOf(lender), 1_000e18);
        assertEq(usdg.balanceOf(renter), before - 20e6);
        assertEq(mkt.escrowed(address(usdg)), 0);
    }

    function test_returnDuringGrace_allowed() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        vm.warp(block.timestamp + 14 days + 6 hours);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.TooEarly.selector);
        mkt.claimDefault(id);
        vm.startPrank(renter);
        aapl.approve(address(mkt), 10e18);
        mkt.returnRental(id);
        vm.stopPrank();
        assertEq(uint8(_status(id)), uint8(AerentMarketplace.Status.Returned));
    }

    function test_claimDefault_afterGrace() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        vm.warp(block.timestamp + 14 days + 12 hours + 1);
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.NotLender.selector);
        mkt.claimDefault(id);
        vm.prank(lender);
        mkt.claimDefault(id);
        assertEq(usdg.balanceOf(lender), 20e6 + 3_000e6);
        vm.startPrank(renter);
        aapl.approve(address(mkt), 10e18);
        vm.expectRevert(AerentMarketplace.InvalidStatus.selector);
        mkt.returnRental(id);
        vm.stopPrank();
    }

    function test_gracePeriodSnapshot_notChangedByAdmin() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        vm.prank(owner);
        mkt.setGracePeriod(1 hours);
        vm.warp(block.timestamp + 14 days + 2 hours);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.TooEarly.selector);
        mkt.claimDefault(id);
    }

    // ---------------- liquidation ----------------

    function test_liquidation_afterPriceRise() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        assertGt(mkt.healthFactor(id), 1e18);
        vm.prank(liquidator);
        vm.expectRevert(AerentMarketplace.Healthy.selector);
        mkt.liquidate(id);

        // AAPL moves to $260: asset value $2,600 * 1.2 = $3,120 > $3,000 collateral
        aaplFeed.set(260e8);
        assertLt(mkt.healthFactor(id), 1e18);

        uint256 renterBefore = usdg.balanceOf(renter);
        vm.prank(liquidator);
        mkt.liquidate(id);
        // seize = $2,600 * 1.05 = 2,730 USDG, surplus 270 to renter
        assertEq(usdg.balanceOf(liquidator), 2_730e6);
        assertEq(usdg.balanceOf(renter) - renterBefore, 270e6);
        assertEq(aapl.balanceOf(lender), 1_000e18);
        assertEq(mkt.escrowed(address(usdg)), 0);
        assertEq(uint8(_status(id)), uint8(AerentMarketplace.Status.Liquidated));
    }

    function test_liquidation_badDebt_capsAtCollateral() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        aaplFeed.set(1_000e8);
        vm.prank(liquidator);
        mkt.liquidate(id);
        assertEq(usdg.balanceOf(liquidator), 3_000e6);
    }

    function test_addCollateral_restoresHealth() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        aaplFeed.set(260e8);
        vm.prank(renter);
        mkt.addCollateral(id, 500e6);
        assertGt(mkt.healthFactor(id), 1e18);
        vm.prank(liquidator);
        vm.expectRevert(AerentMarketplace.Healthy.selector);
        mkt.liquidate(id);
    }

    function test_closedRental_cannotBeLiquidated() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        vm.startPrank(renter);
        aapl.approve(address(mkt), 10e18);
        mkt.returnRental(id);
        vm.stopPrank();
        aaplFeed.set(1_000e8);
        vm.prank(liquidator);
        vm.expectRevert(AerentMarketplace.InvalidStatus.selector);
        mkt.liquidate(id);
    }

    // ---------------- oracle safety ----------------

    function test_revert_stalePrice() public {
        uint256 id = _listAapl();
        aaplFeed.setUpdatedAt(block.timestamp - 2 days);
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.StalePrice.selector);
        mkt.rent(id, 3_000e6, type(uint256).max);
    }

    function test_revert_negativePrice() public {
        uint256 id = _listAapl();
        aaplFeed.set(-1);
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.InvalidPrice.selector);
        mkt.rent(id, 3_000e6, type(uint256).max);
    }

    function test_revert_sequencerDown() public {
        uint256 id = _listAapl();
        seqFeed.set(1);
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.SequencerDown.selector);
        mkt.rent(id, 3_000e6, type(uint256).max);
    }

    function test_revert_sequencerJustRecovered() public {
        uint256 id = _listAapl();
        seqFeed.setStartedAt(block.timestamp - 10 minutes);
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.SequencerDown.selector);
        mkt.rent(id, 3_000e6, type(uint256).max);
    }

    function test_revert_stockOraclePaused() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        aapl.setOraclePaused(true);
        aaplFeed.set(400e8);
        vm.prank(liquidator);
        vm.expectRevert(AerentMarketplace.OraclePaused.selector);
        mkt.liquidate(id);
        // exits still work while the oracle is paused
        vm.startPrank(renter);
        aapl.approve(address(mkt), 10e18);
        mkt.returnRental(id);
        vm.stopPrank();
    }

    // ---------------- fixed-collateral markets ----------------

    function test_fixedCollateral_notLiquidatable() public {
        vm.prank(lender);
        uint256 id = mkt.createListing(address(meme), 2_500_000e18, address(usdg), 4_800e6, 192e6, 3 * DAY);
        assertFalse(mkt.getListing(id).oracleMarket);
        _rent(id, 4_800e6);
        vm.prank(liquidator);
        vm.expectRevert(AerentMarketplace.InvalidStatus.selector);
        mkt.liquidate(id);
        assertEq(mkt.healthFactor(id), type(uint256).max);
    }

    function test_revert_oracleAssetWithoutOracleCollateral() public {
        MockERC20 stable2 = new MockERC20("Plain Dollar", "PUSD", 6);
        vm.prank(owner);
        mkt.configureAsset(address(stable2), _cfg(AerentMarketplace.AssetClass.VerifiedStablecoin, false, true, false, false, address(0), 0, 0, 0));
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.CollateralNeedsOracle.selector);
        mkt.createListing(address(aapl), 1e18, address(stable2), 1e6, 0, DAY);
    }

    // ---------------- ERC-4907 ----------------

    function test_nftUsage_lifecycle() public {
        vm.prank(lender);
        uint256 id = mkt.createListing(address(pass), 482, address(usdg), 600e6, 18e6, 10 * DAY);
        assertEq(pass.ownerOf(482), address(mkt));
        _rent(id, 600e6);
        assertEq(pass.userOf(482), renter);
        assertEq(pass.ownerOf(482), address(mkt));

        vm.expectRevert(AerentMarketplace.TooEarly.selector);
        mkt.settleExpired(id);

        vm.warp(block.timestamp + 10 days + 1);
        assertEq(pass.userOf(482), address(0));
        mkt.settleExpired(id); // anyone
        assertEq(pass.ownerOf(482), lender);
        assertEq(usdg.balanceOf(renter), 10_000_000e6 - 18e6);
        vm.expectRevert(AerentMarketplace.InvalidStatus.selector);
        vm.prank(lender);
        mkt.claimDefault(id);
    }

    function test_nftUsage_earlyReturn() public {
        vm.prank(lender);
        uint256 id = mkt.createListing(address(pass), 482, address(usdg), 600e6, 18e6, 10 * DAY);
        _rent(id, 600e6);
        vm.prank(renter);
        mkt.returnRental(id);
        assertEq(pass.ownerOf(482), lender);
        assertEq(pass.userOf(482), address(0));
    }

    // ---------------- pause and admin ----------------

    function test_pause_blocksNew_allowsExits() public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        uint256 id2 = _listAapl();
        vm.prank(guardian);
        mkt.pause();

        vm.prank(lender);
        vm.expectRevert();
        mkt.createListing(address(aapl), 1e18, address(usdg), 1e6, 0, DAY);
        vm.prank(renter);
        vm.expectRevert();
        mkt.rent(id2, 3_000e6, type(uint256).max);

        vm.prank(lender);
        mkt.cancelListing(id2);
        vm.startPrank(renter);
        aapl.approve(address(mkt), 10e18);
        mkt.returnRental(id);
        vm.stopPrank();

        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", guardian));
        mkt.unpause();
    }

    function test_admin_onlyOwner() public {
        vm.startPrank(renter);
        vm.expectRevert();
        mkt.setProtocolFeeBps(10);
        vm.expectRevert();
        mkt.configureAsset(address(meme), _cfg(AerentMarketplace.AssetClass.Experimental, true, true, true, false, address(0), 0, 0, 0));
        vm.expectRevert(AerentMarketplace.NotAllowed.selector);
        mkt.pause();
        vm.stopPrank();
        vm.prank(owner);
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.setProtocolFeeBps(1001);
    }

    function test_revert_badRiskParams() public {
        vm.prank(owner);
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        // bonus larger than the liquidation buffer
        mkt.configureAsset(address(aapl), _cfg(AerentMarketplace.AssetClass.VerifiedRWA, true, false, false, true, address(aaplFeed), 15000, 10300, 500));
    }

    // ---------------- views ----------------

    function test_pagedListings_andAccountIndex() public {
        for (uint256 i; i < 5; ++i) _listAapl();
        AerentMarketplace.Listing[] memory page = mkt.getListings(0, 3, true);
        assertEq(page.length, 3);
        assertEq(page[0].id, 5);
        page = mkt.getListings(3, 10, true);
        assertEq(page.length, 2);
        assertEq(page[1].id, 1);
        assertEq(mkt.getListings(10, 10, false).length, 0);
        assertEq(mkt.assetList().length, 4);
    }

    // ---------------- renter protection: collateral ceiling and fee cap ----------------

    function test_revert_outrageousCollateral() public {
        // 10 AAPL is worth $2,000, so the 200% ceiling is 4,000 USDG
        vm.prank(lender);
        uint256 id = mkt.createListing(address(aapl), 10e18, address(usdg), 5_000e6, 20e6, DAY);
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.CollateralTooHigh.selector);
        mkt.rent(id, 5_000e6, type(uint256).max);
        // and a renter cannot volunteer silly collateral on a sane listing either
        uint256 ok = _listAapl();
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.CollateralTooHigh.selector);
        mkt.rent(ok, 4_500e6, type(uint256).max);
        _rent(ok, 3_000e6);
    }

    function test_revert_outrageousFee() public {
        // fee cap is 10% of $2,000 = 200 USDG
        vm.prank(lender);
        uint256 id = mkt.createListing(address(aapl), 10e18, address(usdg), 3_000e6, 250e6, DAY);
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.FeeTooHigh.selector);
        mkt.rent(id, 3_000e6, type(uint256).max);
        vm.prank(lender);
        uint256 fair = mkt.createListing(address(aapl), 10e18, address(usdg), 3_000e6, 199e6, DAY);
        _rent(fair, 3_000e6);
    }

    function test_capsAreConfigurable() public {
        vm.startPrank(owner);
        // ceiling below the floor is rejected
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.configureAsset(address(aapl), _cfg(AerentMarketplace.AssetClass.VerifiedRWA, true, false, false, true, address(aaplFeed), 15000, 12000, 500, 14000, 1000));
        // a fee cap above 20% is rejected
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.configureAsset(address(aapl), _cfg(AerentMarketplace.AssetClass.VerifiedRWA, true, false, false, true, address(aaplFeed), 15000, 12000, 500, 20000, 2500));
        // tighter caps take effect for new rentals
        mkt.configureAsset(address(aapl), _cfg(AerentMarketplace.AssetClass.VerifiedRWA, true, false, false, true, address(aaplFeed), 15000, 12000, 500, 16000, 200));
        vm.stopPrank();
        uint256 id = _listAapl();
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.CollateralTooHigh.selector);
        mkt.rent(id, 3_300e6, type(uint256).max);
        _rent(id, 3_000e6);
        assertEq(mkt.assetConfig(address(aapl)).maxFeeBps, 200);
    }

    // ---------------- fuzz ----------------

    function testFuzz_rentReturn_conservesFunds(uint96 amount, uint32 duration, uint16 feeBps) public {
        uint256 amt = bound(uint256(amount), 1e17, 100e18);
        uint32 dur = uint32(bound(uint256(duration), 1 hours, 365 days));
        // fee must stay inside the 10% renter-protection cap
        uint256 valueUsd = (amt * 200) / 1e18;
        uint256 fee = (valueUsd * bound(uint256(feeBps), 0, 900) / 10000) * 1e6;
        vm.prank(lender);
        uint256 id = mkt.createListing(address(aapl), amt, address(usdg), 1, fee, dur);
        uint256 need = ((amt * 200 * 16000) / 1e18 / 10000) * 1e6 + 1e6;
        uint256 renterUsd = usdg.balanceOf(renter);
        _rent(id, need);
        assertGe(mkt.healthFactor(id), 1e18);
        vm.warp(block.timestamp + dur);
        vm.startPrank(renter);
        aapl.approve(address(mkt), amt);
        mkt.returnRental(id);
        vm.stopPrank();
        assertEq(usdg.balanceOf(renter), renterUsd - fee);
        assertEq(mkt.escrowed(address(usdg)), 0);
        assertEq(usdg.balanceOf(address(mkt)), 0);
    }

    function testFuzz_liquidation_neverPaysMoreThanCollateral(uint64 newPrice) public {
        uint256 id = _listAapl();
        _rent(id, 3_000e6);
        int256 p = int256(bound(uint256(newPrice), 1e8, 100_000e8));
        aaplFeed.set(p);
        uint256 hf = mkt.healthFactor(id);
        vm.prank(liquidator);
        if (hf >= 1e18) {
            vm.expectRevert(AerentMarketplace.Healthy.selector);
            mkt.liquidate(id);
        } else {
            mkt.liquidate(id);
            assertLe(usdg.balanceOf(liquidator), 3_000e6);
            assertEq(usdg.balanceOf(address(mkt)), 0);
        }
    }
}
