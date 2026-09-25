// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AerentMarketplace} from "../contracts/AerentMarketplace.sol";
import {MockERC20, MockFeed, MockERC4907} from "../test/mocks/Mocks.sol";

/// Local end-to-end environment for anvil or a private testnet: mock Stock Tokens, USDG, feeds and seeded listings.
///   anvil --chain-id 46630 &
///   forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
contract DeployLocal is Script {
    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        AerentMarketplace mkt = new AerentMarketplace(me, me, me);
        MockERC20 usdg = new MockERC20("Global Dollar", "USDG", 6);
        MockFeed usdgFeed = new MockFeed(1e8, 8);
        mkt.configureAsset(address(usdg), _cfg(AerentMarketplace.AssetClass.VerifiedStablecoin, true, true, false, false, address(usdgFeed), 11000, 10500, 200));

        string[5] memory syms = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];
        string[5] memory names = ["Apple", "NVIDIA", "Tesla", "Microsoft", "Amazon"];
        int256[5] memory px = [int256(245e8), 182e8, 412e8, 505e8, 228e8];
        address[5] memory tokens;
        for (uint256 i; i < 5; ++i) {
            MockERC20 t = new MockERC20(string.concat(names[i], " \u2022 Robinhood Token"), syms[i], 18);
            MockFeed f = new MockFeed(px[i], 8);
            mkt.configureAsset(address(t), _cfg(AerentMarketplace.AssetClass.VerifiedRWA, true, false, false, true, address(f), 15000, 12000, 500));
            t.mint(me, 10_000e18);
            t.approve(address(mkt), type(uint256).max);
            tokens[i] = address(t);
            console2.log(syms[i], address(t), address(f));
        }

        MockERC20 sky = new MockERC20("Sky Meme", "SKY", 18);
        mkt.configureAsset(address(sky), _cfg(AerentMarketplace.AssetClass.Experimental, true, false, true, false, address(0), 0, 0, 0));
        sky.mint(me, 100_000_000e18);
        sky.approve(address(mkt), type(uint256).max);

        MockERC4907 pass = new MockERC4907();
        mkt.configureAsset(address(pass), _cfg(AerentMarketplace.AssetClass.NFT4907, true, false, false, false, address(0), 0, 0, 0));
        pass.mint(me, 482);
        pass.setApprovalForAll(address(mkt), true);

        usdg.mint(me, 10_000_000e6);

        mkt.createListing(tokens[0], 12e18, address(usdg), 4_500e6, 28e6, 30 days);
        mkt.createListing(tokens[1], 40e18, address(usdg), 11_000e6, 64e6, 14 days);
        mkt.createListing(tokens[2], 5e18, address(usdg), 3_100e6, 19e6, 7 days);
        mkt.createListing(tokens[3], 8e18, address(usdg), 6_100e6, 36e6, 21 days);
        mkt.createListing(tokens[4], 20e18, address(usdg), 6_900e6, 30e6, 10 days);
        mkt.createListing(address(sky), 2_500_000e18, address(usdg), 4_800e6, 192e6, 3 days);
        mkt.createListing(address(pass), 482, address(usdg), 600e6, 18e6, 10 days);
        vm.stopBroadcast();

        console2.log("MARKETPLACE", address(mkt));
        console2.log("USDG", address(usdg));
        console2.log("SKY", address(sky));
        console2.log("PASS", address(pass));
    }

    function _cfg(
        AerentMarketplace.AssetClass c, bool listing, bool coll, bool fixedOk, bool stock,
        address feed, uint16 minCR, uint16 liqR, uint16 bonus
    ) internal pure returns (AerentMarketplace.AssetConfig memory) {
        return AerentMarketplace.AssetConfig({
            class: c, listingEnabled: listing, collateralEnabled: coll, fixedCollateralAllowed: fixedOk,
            stockToken: stock, decimals: 0, priceFeed: feed, heartbeat: feed == address(0) ? 0 : 365 days,
            minCollateralRatioBps: minCR, liquidationRatioBps: liqR, liquidationBonusBps: bonus,
            maxCollateralRatioBps: minCR == 0 ? 0 : 20000, maxFeeBps: 1000
        });
    }
}
