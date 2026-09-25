// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {AerentMarketplace} from "../contracts/AerentMarketplace.sol";

contract OffersTest is Base {
    uint64 exp;

    function setUp() public override {
        super.setUp();
        exp = uint64(block.timestamp + 3 days);
        aapl.mint(lender, 1_000e18);
    }

    function _offer() internal returns (uint256 id) {
        vm.prank(renter);
        id = mkt.createOffer(address(aapl), 10e18, address(usdg), 3_100e6, 25e6, 14 * DAY, exp);
    }

    function test_createOffer_escrowsCollateralAndFee() public {
        uint256 before = usdg.balanceOf(renter);
        uint256 id = _offer();
        assertEq(usdg.balanceOf(renter), before - 3_125e6);
        assertEq(mkt.escrowed(address(usdg)), 3_125e6);
        assertEq(uint8(mkt.getOffer(id).status), uint8(AerentMarketplace.OfferStatus.Open));
    }

    function test_fillOffer_startsRentalOnRenterTerms() public {
        vm.prank(owner);
        mkt.setProtocolFeeBps(1000);
        uint256 id = _offer();
        uint256 lenderUsd = usdg.balanceOf(lender);

        vm.prank(lender);
        uint256 listingId = mkt.fillOffer(id, 25e6);

        AerentMarketplace.Listing memory l = mkt.getListing(listingId);
        assertEq(uint8(l.status), uint8(AerentMarketplace.Status.Rented));
        assertEq(l.lender, lender);
        assertEq(l.renter, renter);
        assertEq(l.collateralAmount, 3_100e6);
        assertEq(l.dueAt, block.timestamp + 14 days);
        assertEq(aapl.balanceOf(renter), 1_010e18);          // renter received the asset
        assertEq(usdg.balanceOf(lender), lenderUsd + 22.5e6); // fee less the 10% protocol share
        assertEq(usdg.balanceOf(treasury), 2.5e6);
        assertEq(mkt.escrowed(address(usdg)), 3_100e6);       // collateral only
        assertEq(mkt.escrowed(address(aapl)), 0);
        assertGt(mkt.healthFactor(listingId), 1e18);
    }

    function test_filledOffer_behavesLikeAnyRental() public {
        uint256 id = _offer();
        vm.prank(lender);
        uint256 listingId = mkt.fillOffer(id, 0);
        // renter returns and gets collateral back
        vm.startPrank(renter);
        aapl.approve(address(mkt), 10e18);
        mkt.returnRental(listingId);
        vm.stopPrank();
        assertEq(uint8(_status(listingId)), uint8(AerentMarketplace.Status.Returned));
        assertEq(mkt.escrowed(address(usdg)), 0);
        assertEq(aapl.balanceOf(lender), 2_000e18);
    }

    function test_filledOffer_canBeLiquidated() public {
        uint256 id = _offer();
        vm.prank(lender);
        uint256 listingId = mkt.fillOffer(id, 0);
        aaplFeed.set(300e8); // 10 AAPL = $3,000, collateral 3,100 below 120% requirement
        assertLt(mkt.healthFactor(listingId), 1e18);
        vm.prank(liquidator);
        mkt.liquidate(listingId);
        assertEq(uint8(_status(listingId)), uint8(AerentMarketplace.Status.Liquidated));
        assertEq(usdg.balanceOf(address(mkt)), 0);
    }

    function test_cancelOffer_returnsEverything() public {
        uint256 before = usdg.balanceOf(renter);
        uint256 id = _offer();
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.NotRenter.selector);
        mkt.cancelOffer(id);
        vm.prank(renter);
        mkt.cancelOffer(id);
        assertEq(usdg.balanceOf(renter), before);
        assertEq(mkt.escrowed(address(usdg)), 0);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.InvalidStatus.selector);
        mkt.fillOffer(id, 0);
    }

    function test_revert_expiredOffer() public {
        uint256 id = _offer();
        vm.warp(exp + 1);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.OfferExpired.selector);
        mkt.fillOffer(id, 0);
        // the renter can still pull their funds out after expiry
        vm.prank(renter);
        mkt.cancelOffer(id);
        assertEq(mkt.escrowed(address(usdg)), 0);
    }

    function test_revert_outrageousOfferTerms() public {
        // 10 AAPL at $200 is worth $2,000: ceiling 4,000 USDG, fee cap 200 USDG
        vm.prank(renter);
        uint256 tooMuchCollateral = mkt.createOffer(address(aapl), 10e18, address(usdg), 5_000e6, 20e6, DAY, exp);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.CollateralTooHigh.selector);
        mkt.fillOffer(tooMuchCollateral, 0);
        vm.prank(renter);
        uint256 tooBigFee = mkt.createOffer(address(aapl), 10e18, address(usdg), 3_100e6, 300e6, DAY, exp);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.FeeTooHigh.selector);
        mkt.fillOffer(tooBigFee, 0);
        // both renters can always take their funds back
        vm.startPrank(renter);
        mkt.cancelOffer(tooMuchCollateral);
        mkt.cancelOffer(tooBigFee);
        vm.stopPrank();
        assertEq(mkt.escrowed(address(usdg)), 0);
    }

    function test_revert_undercollateralisedOffer() public {
        vm.prank(renter);
        uint256 id = mkt.createOffer(address(aapl), 10e18, address(usdg), 2_500e6, 25e6, DAY, exp);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.Undercollateralised.selector);
        mkt.fillOffer(id, 0);
    }

    function test_revert_selfFillAndFeeSlippage() public {
        uint256 id = _offer();
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.NotAllowed.selector);
        mkt.fillOffer(id, 0);
        vm.prank(lender);
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.fillOffer(id, 26e6);
    }

    function test_revert_nftOrUnlistedAsset() public {
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.AssetNotListable.selector);
        mkt.createOffer(address(pass), 482, address(usdg), 100e6, 1e6, DAY, exp);
    }

    function test_pause_blocksOffersButNotCancel() public {
        uint256 id = _offer();
        vm.prank(guardian);
        mkt.pause();
        vm.prank(lender);
        vm.expectRevert();
        mkt.fillOffer(id, 0);
        vm.prank(renter);
        vm.expectRevert();
        mkt.createOffer(address(aapl), 1e18, address(usdg), 400e6, 1e6, DAY, exp);
        vm.prank(renter);
        mkt.cancelOffer(id); // exits always work
        assertEq(mkt.escrowed(address(usdg)), 0);
    }

    function test_pagedOffers() public {
        for (uint256 i; i < 4; ++i) _offer();
        AerentMarketplace.Offer[] memory page = mkt.getOffers(0, 3, true);
        assertEq(page.length, 3);
        assertEq(page[0].id, 4);
        assertEq(mkt.offerCount(), 4);
    }

    function testFuzz_offerLifecycle_conservesFunds(uint96 amount, uint16 feeBps) public {
        uint256 amt = bound(uint256(amount), 1e18, 100e18);
        uint256 valueUsd = (amt * 200) / 1e18;
        uint256 fee = (valueUsd * bound(uint256(feeBps), 0, 900) / 10000) * 1e6;
        uint256 coll = ((amt * 200 * 17000) / 1e18 / 10000) * 1e6; // 170%: inside the 150-200% band
        uint256 renterUsd = usdg.balanceOf(renter);
        vm.prank(renter);
        uint256 id = mkt.createOffer(address(aapl), amt, address(usdg), coll, fee, DAY, exp);
        vm.prank(lender);
        uint256 listingId = mkt.fillOffer(id, 0);
        vm.startPrank(renter);
        aapl.approve(address(mkt), amt);
        mkt.returnRental(listingId);
        vm.stopPrank();
        assertEq(usdg.balanceOf(renter), renterUsd - fee);
        assertEq(usdg.balanceOf(address(mkt)), 0);
    }
}
