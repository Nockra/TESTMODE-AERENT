// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AerentMarketplace} from "../contracts/AerentMarketplace.sol";

/// Production deploy. The broadcasting key should be a hardware wallet used for nothing else.
/// Ownership goes straight to the Safe multisig through the constructor, so no acceptOwnership() step is needed
/// on first deploy. Later ownership moves use Ownable2Step (transferOwnership then acceptOwnership).
///
///   OWNER_SAFE=0x... TREASURY=0x... GUARDIAN=0x... \
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --ledger --broadcast --verify \
///     --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
contract Deploy is Script {
    function run() external returns (AerentMarketplace mkt) {
        address ownerSafe = vm.envAddress("OWNER_SAFE");
        address treasury = vm.envAddress("TREASURY");
        address guardian = vm.envAddress("GUARDIAN");
        require(ownerSafe.code.length > 0, "OWNER_SAFE must be a deployed Safe");
        vm.startBroadcast();
        mkt = new AerentMarketplace(ownerSafe, treasury, guardian);
        vm.stopBroadcast();
        console2.log("AerentMarketplace", address(mkt));
    }
}
