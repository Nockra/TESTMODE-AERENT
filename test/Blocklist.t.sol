// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {AerentMarketplace} from "../contracts/AerentMarketplace.sol";
import {BlocklistToken, MockFeed} from "./mocks/Mocks.sol";

/// A blocked recipient must never trap the other side of a rental.
contract BlocklistTest is Base {
    BlocklistToken busd;

    function setUp() public override {
        super.setUp();
        busd = new BlocklistToken();
        MockFeed f = new MockFeed(1e8, 8);
        vm.startPrank(owner);
        mkt.configureAsset(address(busd), _cfg(AerentMarketplace.AssetClass.VerifiedStablecoin, true, true, false, false, address(f), 11000, 10500, 200));
        vm.stopPrank();
        busd.mint(renter, 1_000_000e6);
        busd.mint(lender, 1_000_000e6);
        vm.prank(renter);
        busd.approve(address(mkt), type(uint256).max);
        vm.prank(lender);
        busd.approve(address(mkt), type(uint256).max);
    }

    function test_blockedLender_cannotTrapRenterCollateral() public {
        // lender lends the blocklisting stablecoin against USDG
        vm.prank(lender);
        uint256 id = mkt.createListing(address(busd), 10_000e6, address(usdg), 12_000e6, 30e6, 7 days);
        _rent(id, 12_000e6);
        busd.setBlocked(lender, true);

        vm.startPrank(renter);
        busd.approve(address(mkt), 10_000e6);
        mkt.returnRental(id); // succeeds even though the lender cannot receive BUSD
        vm.stopPrank();

        assertEq(uint8(_status(id)), uint8(AerentMarketplace.Status.Returned));
        assertEq(usdg.balanceOf(renter), 10_000_000e6 - 30e6); // collateral back, only the fee spent
        assertEq(mkt.claimable(address(busd), lender), 10_000e6);
        assertEq(busd.balanceOf(address(mkt)), mkt.escrowed(address(busd)));

        // lender routes the funds to a clean address
        address fresh = makeAddr("fresh");
        vm.prank(lender);
        mkt.withdraw(address(busd), fresh);
        assertEq(busd.balanceOf(fresh), 10_000e6);
        assertEq(mkt.escrowed(address(busd)), 0);
        assertEq(mkt.totalClaimable(address(busd)), 0);
    }

    function test_blockedLender_feeDeferred_rentStillWorks() public {
        vm.prank(lender);
        uint256 id = mkt.createListing(address(aapl), 1e18, address(busd), 400e6, 5e6, 1 days);
        busd.setBlocked(lender, true);
        vm.prank(renter);
        mkt.rent(id, 400e6, type(uint256).max);
        assertEq(mkt.claimable(address(busd), lender), 5e6);
        assertEq(busd.balanceOf(address(mkt)), mkt.escrowed(address(busd)));
    }

    function test_blockedRenter_collateralClaimable() public {
        vm.prank(lender);
        uint256 id = mkt.createListing(address(aapl), 1e18, address(busd), 400e6, 5e6, 1 days);
        vm.prank(renter);
        mkt.rent(id, 400e6, type(uint256).max);
        busd.setBlocked(renter, true);
        vm.startPrank(renter);
        aapl.approve(address(mkt), 1e18);
        mkt.returnRental(id);
        vm.expectRevert(); // still blocked for itself
        mkt.withdraw(address(busd), renter);
        address other = makeAddr("other");
        mkt.withdraw(address(busd), other);
        vm.stopPrank();
        assertEq(busd.balanceOf(other), 400e6);
    }

    function test_withdraw_revertsWhenNothingOwed() public {
        vm.prank(renter);
        vm.expectRevert(AerentMarketplace.BadParameter.selector);
        mkt.withdraw(address(busd), renter);
    }
}
