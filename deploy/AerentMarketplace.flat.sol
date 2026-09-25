// SPDX-License-Identifier: MIT
pragma solidity =0.8.26 ^0.8.20;

// lib/openzeppelin-contracts/utils/Context.sol

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// lib/openzeppelin-contracts/utils/Errors.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/Errors.sol)

/**
 * @dev Collection of common custom errors used in multiple contracts
 *
 * IMPORTANT: Backwards compatibility is not guaranteed in future versions of the library.
 * It is recommended to avoid relying on the error API for critical functionality.
 *
 * _Available since v5.1._
 */
library Errors {
    /**
     * @dev The ETH balance of the account is not enough to perform the operation.
     */
    error InsufficientBalance(uint256 balance, uint256 needed);

    /**
     * @dev A call to an address target failed. The target may have reverted.
     */
    error FailedCall();

    /**
     * @dev The deployment failed.
     */
    error FailedDeployment();

    /**
     * @dev A necessary precompile is missing.
     */
    error MissingPrecompile(address);
}

// lib/openzeppelin-contracts/utils/introspection/IERC165.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/introspection/IERC165.sol)

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// lib/openzeppelin-contracts/token/ERC20/IERC20.sol

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/IERC20.sol)

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// lib/openzeppelin-contracts/token/ERC721/IERC721Receiver.sol

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC721/IERC721Receiver.sol)

/**
 * @title ERC-721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC-721 asset contracts.
 */
interface IERC721Receiver {
    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be
     * reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

// lib/openzeppelin-contracts/utils/ReentrancyGuard.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// lib/openzeppelin-contracts/utils/Address.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/Address.sol)

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev There's no code at `target` (it is not a contract).
     */
    error AddressEmptyCode(address target);

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.20/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert Errors.InsufficientBalance(address(this).balance, amount);
        }

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert Errors.FailedCall();
        }
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason or custom error, it is bubbled
     * up by this function (like regular Solidity function calls). However, if
     * the call reverted with no returned reason, this function reverts with a
     * {Errors.FailedCall} error.
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert Errors.InsufficientBalance(address(this).balance, value);
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and reverts if the target
     * was not a contract or bubbling up the revert reason (falling back to {Errors.FailedCall}) in case
     * of an unsuccessful call.
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            // only check if target is a contract if the call was successful and the return data is empty
            // otherwise we already know that it was a contract
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and reverts if it wasn't, either by bubbling the
     * revert reason or with a default {Errors.FailedCall} error.
     */
    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    /**
     * @dev Reverts with returndata if present. Otherwise reverts with {Errors.FailedCall}.
     */
    function _revert(bytes memory returndata) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            assembly ("memory-safe") {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert Errors.FailedCall();
        }
    }
}

// lib/openzeppelin-contracts/interfaces/IERC165.sol

// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/IERC165.sol)

// lib/openzeppelin-contracts/interfaces/IERC20.sol

// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/IERC20.sol)

// lib/openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/extensions/IERC20Metadata.sol)

/**
 * @dev Interface for the optional metadata functions from the ERC-20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}

// lib/openzeppelin-contracts/token/ERC721/IERC721.sol

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC721/IERC721.sol)

/**
 * @dev Required interface of an ERC-721 compliant contract.
 */
interface IERC721 is IERC165 {
    /**
     * @dev Emitted when `tokenId` token is transferred from `from` to `to`.
     */
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables `approved` to manage the `tokenId` token.
     */
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets.
     */
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    /**
     * @dev Returns the number of tokens in ``owner``'s account.
     */
    function balanceOf(address owner) external view returns (uint256 balance);

    /**
     * @dev Returns the owner of the `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon
     *   a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC-721 protocol to prevent tokens from being forever locked.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must have been allowed to move this token by either {approve} or
     *   {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon
     *   a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) external;

    /**
     * @dev Transfers `tokenId` token from `from` to `to`.
     *
     * WARNING: Note that the caller is responsible to confirm that the recipient is capable of receiving ERC-721
     * or else they may be permanently lost. Usage of {safeTransferFrom} prevents loss, though the caller must
     * understand this adds an external call which potentially creates a reentrancy vulnerability.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 tokenId) external;

    /**
     * @dev Gives permission to `to` to transfer `tokenId` token to another account.
     * The approval is cleared when the token is transferred.
     *
     * Only a single account can be approved at a time, so approving the zero address clears previous approvals.
     *
     * Requirements:
     *
     * - The caller must own the token or be an approved operator.
     * - `tokenId` must exist.
     *
     * Emits an {Approval} event.
     */
    function approve(address to, uint256 tokenId) external;

    /**
     * @dev Approve or remove `operator` as an operator for the caller.
     * Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.
     *
     * Requirements:
     *
     * - The `operator` cannot be the address zero.
     *
     * Emits an {ApprovalForAll} event.
     */
    function setApprovalForAll(address operator, bool approved) external;

    /**
     * @dev Returns the account approved for `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function getApproved(uint256 tokenId) external view returns (address operator);

    /**
     * @dev Returns if the `operator` is allowed to manage all of the assets of `owner`.
     *
     * See {setApprovalForAll}
     */
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

// lib/openzeppelin-contracts/access/Ownable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// lib/openzeppelin-contracts/utils/Pausable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (utils/Pausable.sol)

/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Pausable is Context {
    bool private _paused;

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Initializes the contract in unpaused state.
     */
    constructor() {
        _paused = false;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

// lib/openzeppelin-contracts/access/Ownable2Step.sol

// OpenZeppelin Contracts (last updated v5.1.0) (access/Ownable2Step.sol)

/**
 * @dev Contract module which provides access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This extension of the {Ownable} contract includes a two-step mechanism to transfer
 * ownership, where the new owner must call {acceptOwnership} in order to replace the
 * old one. This can help prevent common mistakes, such as transfers of ownership to
 * incorrect accounts, or to contracts that are unable to interact with the
 * permission system.
 *
 * The initial owner is specified at deployment time in the constructor for `Ownable`. This
 * can later be changed with {transferOwnership} and {acceptOwnership}.
 *
 * This module is used through inheritance. It will make available all functions
 * from parent (Ownable).
 */
abstract contract Ownable2Step is Ownable {
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Returns the address of the pending owner.
     */
    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    /**
     * @dev Starts the ownership transfer of the contract to a new account. Replaces the pending transfer if there is one.
     * Can only be called by the current owner.
     *
     * Setting `newOwner` to the zero address is allowed; this can be used to cancel an initiated ownership transfer.
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`) and deletes any pending owner.
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual override {
        delete _pendingOwner;
        super._transferOwnership(newOwner);
    }

    /**
     * @dev The new owner accepts the ownership transfer.
     */
    function acceptOwnership() public virtual {
        address sender = _msgSender();
        if (pendingOwner() != sender) {
            revert OwnableUnauthorizedAccount(sender);
        }
        _transferOwnership(sender);
    }
}

// lib/openzeppelin-contracts/interfaces/IERC1363.sol

// OpenZeppelin Contracts (last updated v5.1.0) (interfaces/IERC1363.sol)

/**
 * @title IERC1363
 * @dev Interface of the ERC-1363 standard as defined in the https://eips.ethereum.org/EIPS/eip-1363[ERC-1363].
 *
 * Defines an extension interface for ERC-20 tokens that supports executing code on a recipient contract
 * after `transfer` or `transferFrom`, or code on a spender contract after `approve`, in a single transaction.
 */
interface IERC1363 is IERC20, IERC165 {
    /*
     * Note: the ERC-165 identifier for this interface is 0xb0202a11.
     * 0xb0202a11 ===
     *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
     *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
     */

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @param data Additional data with no specified format, sent in call to `spender`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}

// lib/openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/utils/SafeERC20.sol)

/**
 * @title SafeERC20
 * @dev Wrappers around ERC-20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    /**
     * @dev An operation with an ERC-20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     *
     * NOTE: If the token implements ERC-7674, this function will not modify any temporary allowance. This function
     * only sets the "standard" allowance. Any temporary allowance will remain active, in addition to the value being
     * set here.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    /**
     * @dev Performs an {ERC1363} transferAndCall, with a fallback to the simple {ERC20} transfer if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferFromAndCall, with a fallback to the simple {ERC20} transferFrom if the target
     * has no code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} approveAndCall, with a fallback to the simple {ERC20} approve if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * NOTE: When the recipient address (`to`) has no code (i.e. is an EOA), this function behaves as {forceApprove}.
     * Opposedly, when the recipient address (`to`) has code, this function only attempts to call {ERC1363-approveAndCall}
     * once without retrying, and relies on the returned value to be true.
     *
     * Reverts if the returned value is other than `true`.
     */
    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturnBool} that reverts if call fails to meet the requirements.
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            let success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            // bubble errors
            if iszero(success) {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize())
                revert(ptr, returndatasize())
            }
            returnSize := returndatasize()
            returnValue := mload(0)
        }

        if (returnSize == 0 ? address(token).code.length == 0 : returnValue != 1) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturn} that silently catches all reverts and returns a bool instead.
     */
    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        bool success;
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            returnSize := returndatasize()
            returnValue := mload(0)
        }
        return success && (returnSize == 0 ? address(token).code.length > 0 : returnValue == 1);
    }
}

// contracts/AerentMarketplace.sol

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
