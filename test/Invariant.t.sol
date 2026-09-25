// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Base} from "./Base.t.sol";
import {AerentMarketplace} from "../contracts/AerentMarketplace.sol";
import {MockERC20, MockFeed} from "./mocks/Mocks.sol";

/// Random sequences of marketplace actions driven by the fuzzer.
contract Handler is Test {
    AerentMarketplace public mkt;
    MockERC20 public aapl;
    MockERC20 public usdg;
    MockFeed public feed;
    address public lender;
    address public renter;
    address public liquidator;

    uint256 public ghostCollateralIn;
    uint256 public ghostCollateralOut;
    mapping(uint256 => uint256) public timesRented;
    uint256 public maxTimesRented;

    constructor(AerentMarketplace m, MockERC20 a, MockERC20 u, MockFeed f, address l, address r, address q) {
        mkt = m; aapl = a; usdg = u; feed = f; lender = l; renter = r; liquidator = q;
    }

    function list(uint256 amount, uint256 minColl) external {
        amount = bound(amount, 1e16, 50e18);
        minColl = bound(minColl, 1, 5_000e6);
        vm.prank(lender);
        try mkt.createListing(address(aapl), amount, address(usdg), minColl, 5e6, 2 days) {} catch {}
    }

    function rent(uint256 seed, uint256 extra) external {
        uint256 n = mkt.listingCount();
        if (n == 0) return;
        uint256 id = bound(seed, 1, n);
        AerentMarketplace.Listing memory l0 = mkt.getListing(id);
        if (l0.status != AerentMarketplace.Status.Open) return;
        uint256 need = l0.collateralAmount + 4_000e6 + bound(extra, 0, 1_000e6);
        vm.prank(renter);
        try mkt.rent(id, need, type(uint256).max) {
            ghostCollateralIn += need;
            timesRented[id]++;
            if (timesRented[id] > maxTimesRented) maxTimesRented = timesRented[id];
        } catch {}
    }

    function giveBack(uint256 seed) external {
        uint256 n = mkt.listingCount();
        if (n == 0) return;
        uint256 id = bound(seed, 1, n);
        AerentMarketplace.Listing memory l = mkt.getListing(id);
        vm.startPrank(renter);
        aapl.approve(address(mkt), l.amountOrTokenId);
        try mkt.returnRental(id) { ghostCollateralOut += l.collateralAmount; } catch {}
        vm.stopPrank();
    }

    function cancel(uint256 seed) external {
        uint256 n = mkt.listingCount();
        if (n == 0) return;
        vm.prank(lender);
        try mkt.cancelListing(bound(seed, 1, n)) {} catch {}
    }

    function movePrice(uint256 p) external {
        feed.set(int256(bound(p, 50e8, 600e8)));
    }

    function warp(uint256 s) external {
        vm.warp(block.timestamp + bound(s, 0, 3 days));
        feed.set(feed.answer()); // keep the feed fresh
    }

    function liquidate(uint256 seed) external {
        uint256 n = mkt.listingCount();
        if (n == 0) return;
        uint256 id = bound(seed, 1, n);
        AerentMarketplace.Listing memory l = mkt.getListing(id);
        vm.prank(liquidator);
        try mkt.liquidate(id) { ghostCollateralOut += l.collateralAmount; } catch {}
    }

    function claim(uint256 seed) external {
        uint256 n = mkt.listingCount();
        if (n == 0) return;
        uint256 id = bound(seed, 1, n);
        AerentMarketplace.Listing memory l = mkt.getListing(id);
        vm.prank(lender);
        try mkt.claimDefault(id) { ghostCollateralOut += l.collateralAmount; } catch {}
    }
}

contract InvariantTest is Base {
    Handler h;

    function setUp() public override {
        super.setUp();
        vm.prank(owner);
        mkt.setSequencerUptimeFeed(address(0));
        h = new Handler(mkt, aapl, usdg, aaplFeed, lender, renter, liquidator);
        aapl.mint(renter, 1_000_000e18);
        aapl.mint(lender, 1_000_000e18);
        aapl.mint(liquidator, 1_000_000e18);
        targetContract(address(h));
    }

    /// Escrow accounting always matches what the contract actually holds.
    function invariant_escrowMatchesBalances() public view {
        assertEq(usdg.balanceOf(address(mkt)), mkt.escrowed(address(usdg)));
        assertEq(aapl.balanceOf(address(mkt)), mkt.escrowed(address(aapl)));
    }

    /// The marketplace never releases more collateral than it received.
    function invariant_neverReleasesMoreCollateralThanReceived() public view {
        assertLe(h.ghostCollateralOut(), h.ghostCollateralIn());
        assertEq(h.ghostCollateralIn() - h.ghostCollateralOut(), mkt.escrowed(address(usdg)));
    }

    /// A listing can be rented at most once.
    function invariant_singleRentPerListing() public view {
        assertLe(h.maxTimesRented(), 1);
    }

    /// Escrowed collateral equals the sum of collateral in live rentals.
    function invariant_escrowEqualsOpenPositions() public view {
        uint256 n = mkt.listingCount();
        uint256 sumColl;
        uint256 sumAsset;
        for (uint256 i = 1; i <= n; ++i) {
            AerentMarketplace.Listing memory l = mkt.getListing(i);
            if (l.status == AerentMarketplace.Status.Rented) sumColl += l.collateralAmount;
            if (l.status == AerentMarketplace.Status.Open) sumAsset += l.amountOrTokenId;
        }
        assertEq(sumColl + mkt.totalClaimable(address(usdg)), mkt.escrowed(address(usdg)));
        assertEq(sumAsset, mkt.escrowed(address(aapl)));
    }
}
