// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;
    bool public oraclePaused;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
    function setOraclePaused(bool p) external { oraclePaused = p; }
}

/// @dev Takes a 1% fee on every transfer.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}
    function mint(address to, uint256 amt) external { _mint(to, amt); }
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xdead), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract MockFeed {
    int256 public answer;
    uint256 public updatedAt;
    uint256 public startedAt;
    uint8 public immutable decimals;
    constructor(int256 a, uint8 d) { answer = a; decimals = d; updatedAt = block.timestamp; startedAt = block.timestamp; }
    function description() external pure returns (string memory) { return "MOCK / USD"; }
    function set(int256 a) external { answer = a; updatedAt = block.timestamp; }
    function setUpdatedAt(uint256 t) external { updatedAt = t; }
    function setStartedAt(uint256 t) external { startedAt = t; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, startedAt, updatedAt, 1);
    }
}

contract MockERC4907 is ERC721 {
    struct U { address user; uint64 expires; }
    mapping(uint256 => U) internal _users;
    event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);
    constructor() ERC721("Cloud Pass", "CLOUD") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
    function setUser(uint256 tokenId, address user, uint64 expires) external {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender) || getApproved(tokenId) == msg.sender, "not owner");
        _users[tokenId] = U(user, expires);
        emit UpdateUser(tokenId, user, expires);
    }
    function userOf(uint256 tokenId) external view returns (address) {
        return uint256(_users[tokenId].expires) >= block.timestamp ? _users[tokenId].user : address(0);
    }
    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0xad092b5c || super.supportsInterface(id);
    }
}

contract PlainERC721 is ERC721 {
    constructor() ERC721("Plain", "PLN") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
}

/// @dev Stablecoin with an issuer blocklist, like many real ones.
contract BlocklistToken is ERC20 {
    mapping(address => bool) public blocked;
    constructor() ERC20("Blocklist Dollar", "BUSD") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
    function setBlocked(address a, bool b) external { blocked[a] = b; }
    function _update(address from, address to, uint256 value) internal override {
        require(!blocked[from] && !blocked[to], "blocked");
        super._update(from, to, value);
    }
}
