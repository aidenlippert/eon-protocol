// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UserRegistry
 * @notice KYC-linked multi-wallet management for credit scoring
 * @dev Enables one person (verified via KYC) to link multiple wallets for aggregate credit scoring
 *
 * KEY FEATURES:
 * - One KYC hash per user (Sybil resistance)
 * - Max 5 linked wallets per user (spam prevention)
 * - Primary wallet + linked wallets
 * - Reverse lookup (wallet → user)
 * - Unlinking support (wallet rotation)
 *
 * SECURITY:
 * - KYC hash stored on-chain (not raw ID)
 * - Only wallet owner can link/unlink
 * - Gas cost prevents spam
 * - Owner can emergency unlink (fraud cases)
 */
contract UserRegistry is Ownable, ReentrancyGuard {
    // ==================== STRUCTS ====================

    struct User {
        bytes32 kycHash;           // Hash of KYC verification ID (from Didit)
        address primaryWallet;      // Main wallet address
        address[] linkedWallets;    // Additional wallets (max 5)
        uint40 registeredAt;       // Registration timestamp
        bool exists;               // User exists flag
    }

    // ==================== STATE ====================

    /// @notice KYC hash → User data
    mapping(bytes32 => User) public users;

    /// @notice Wallet address → KYC hash (reverse lookup)
    mapping(address => bytes32) public walletToKycHash;

    /// @notice Track used KYC hashes (prevent duplicates)
    mapping(bytes32 => bool) public kycHashUsed;

    /// @notice Maximum linked wallets per user
    uint8 public constant MAX_LINKED_WALLETS = 5;

    /// @notice Total registered users
    uint256 public totalUsers;

    // ==================== EVENTS ====================

    event UserRegistered(bytes32 indexed kycHash, address indexed primaryWallet, uint256 timestamp);
    event WalletLinked(bytes32 indexed kycHash, address indexed wallet, uint256 timestamp);
    event WalletUnlinked(bytes32 indexed kycHash, address indexed wallet, uint256 timestamp);
    event PrimaryWalletChanged(bytes32 indexed kycHash, address indexed oldPrimary, address indexed newPrimary);

    // ==================== ERRORS ====================

    error AlreadyRegistered();
    error MaxWalletsReached();
    error NotYourWallet();
    error KYCAlreadyUsed();
    error UserNotFound();
    error WalletNotLinked();
    error CannotUnlinkPrimary();
    error InvalidKYCHash();
    error InvalidAddress();

    // ==================== CONSTRUCTOR ====================

    constructor() Ownable(msg.sender) {}

    // ==================== USER REGISTRATION ====================

    /**
     * @notice Register a new user with KYC verification
     * @param kycHash Hash of KYC verification ID (keccak256 of Didit session ID)
     * @dev One KYC hash can only be used once (one person = one account)
     */
    function registerUser(bytes32 kycHash) external nonReentrant {
        if (kycHash == bytes32(0)) revert InvalidKYCHash();
        if (kycHashUsed[kycHash]) revert KYCAlreadyUsed();
        if (walletToKycHash[msg.sender] != bytes32(0)) revert AlreadyRegistered();

        // Create new user
        User storage user = users[kycHash];
        user.kycHash = kycHash;
        user.primaryWallet = msg.sender;
        user.registeredAt = uint40(block.timestamp);
        user.exists = true;

        // Mark KYC as used
        walletToKycHash[msg.sender] = kycHash;
        kycHashUsed[kycHash] = true;
        totalUsers++;

        emit UserRegistered(kycHash, msg.sender, block.timestamp);
    }

    // ==================== WALLET LINKING ====================

    /**
     * @notice Link an additional wallet to your account
     * @param wallet Address to link
     * @dev Caller must be registered user, wallet must not be linked elsewhere
     */
    function linkWallet(address wallet) external nonReentrant {
        if (wallet == address(0)) revert InvalidAddress();

        bytes32 kycHash = walletToKycHash[msg.sender];
        if (kycHash == bytes32(0)) revert NotYourWallet();

        User storage user = users[kycHash];
        if (user.linkedWallets.length >= MAX_LINKED_WALLETS) revert MaxWalletsReached();
        if (walletToKycHash[wallet] != bytes32(0)) revert AlreadyRegistered();

        // Link wallet
        user.linkedWallets.push(wallet);
        walletToKycHash[wallet] = kycHash;

        emit WalletLinked(kycHash, wallet, block.timestamp);
    }

    /**
     * @notice Unlink a wallet from your account
     * @param wallet Address to unlink
     * @dev Cannot unlink primary wallet (use changePrimaryWallet first)
     */
    function unlinkWallet(address wallet) external nonReentrant {
        bytes32 kycHash = walletToKycHash[msg.sender];
        if (kycHash == bytes32(0)) revert NotYourWallet();

        User storage user = users[kycHash];
        if (wallet == user.primaryWallet) revert CannotUnlinkPrimary();

        // Find and remove wallet
        bool found = false;
        for (uint256 i = 0; i < user.linkedWallets.length; i++) {
            if (user.linkedWallets[i] == wallet) {
                // Swap with last element and pop
                user.linkedWallets[i] = user.linkedWallets[user.linkedWallets.length - 1];
                user.linkedWallets.pop();
                found = true;
                break;
            }
        }

        if (!found) revert WalletNotLinked();

        // Remove reverse lookup
        delete walletToKycHash[wallet];

        emit WalletUnlinked(kycHash, wallet, block.timestamp);
    }

    /**
     * @notice Change primary wallet
     * @param newPrimary New primary wallet address
     * @dev New primary must be one of your linked wallets
     */
    function changePrimaryWallet(address newPrimary) external nonReentrant {
        if (newPrimary == address(0)) revert InvalidAddress();

        bytes32 kycHash = walletToKycHash[msg.sender];
        if (kycHash == bytes32(0)) revert NotYourWallet();

        User storage user = users[kycHash];

        // Verify newPrimary is one of linked wallets
        bool isLinked = false;
        uint256 linkedIndex = 0;
        for (uint256 i = 0; i < user.linkedWallets.length; i++) {
            if (user.linkedWallets[i] == newPrimary) {
                isLinked = true;
                linkedIndex = i;
                break;
            }
        }

        if (!isLinked) revert WalletNotLinked();

        // Swap: old primary becomes linked, new linked becomes primary
        address oldPrimary = user.primaryWallet;
        user.primaryWallet = newPrimary;
        user.linkedWallets[linkedIndex] = oldPrimary;

        emit PrimaryWalletChanged(kycHash, oldPrimary, newPrimary);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get all wallets for a user
     * @param kycHash User's KYC hash
     * @return primary Primary wallet address
     * @return linked Array of linked wallet addresses
     */
    function getUserWallets(bytes32 kycHash) external view returns (address primary, address[] memory linked) {
        User storage user = users[kycHash];
        if (!user.exists) revert UserNotFound();
        return (user.primaryWallet, user.linkedWallets);
    }

    /**
     * @notice Get all wallets for caller
     * @return primary Primary wallet address
     * @return linked Array of linked wallet addresses
     */
    function getMyWallets() external view returns (address primary, address[] memory linked) {
        bytes32 kycHash = walletToKycHash[msg.sender];
        if (kycHash == bytes32(0)) return (address(0), new address[](0));

        User storage user = users[kycHash];
        return (user.primaryWallet, user.linkedWallets);
    }

    /**
     * @notice Get all wallets for any wallet address
     * @param wallet Any wallet owned by the user
     * @return primary Primary wallet address
     * @return linked Array of linked wallet addresses
     */
    function getAllWalletsForAddress(address wallet) external view returns (address primary, address[] memory linked) {
        bytes32 kycHash = walletToKycHash[wallet];
        if (kycHash == bytes32(0)) return (address(0), new address[](0));

        User storage user = users[kycHash];
        return (user.primaryWallet, user.linkedWallets);
    }

    /**
     * @notice Check if wallet is registered
     * @param wallet Wallet address to check
     * @return True if wallet is registered
     */
    function isWalletRegistered(address wallet) external view returns (bool) {
        return walletToKycHash[wallet] != bytes32(0);
    }

    /**
     * @notice Get user registration info
     * @param kycHash User's KYC hash
     * @return exists User exists
     * @return primaryWallet Primary wallet address
     * @return linkedCount Number of linked wallets
     * @return registeredAt Registration timestamp
     */
    function getUserInfo(bytes32 kycHash) external view returns (
        bool exists,
        address primaryWallet,
        uint256 linkedCount,
        uint256 registeredAt
    ) {
        User storage user = users[kycHash];
        return (
            user.exists,
            user.primaryWallet,
            user.linkedWallets.length,
            user.registeredAt
        );
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Emergency unlink wallet (owner only, for fraud cases)
     * @param wallet Wallet to unlink
     * @dev Use carefully - bypasses normal unlinking checks
     */
    function emergencyUnlinkWallet(address wallet) external onlyOwner {
        bytes32 kycHash = walletToKycHash[wallet];
        if (kycHash == bytes32(0)) revert WalletNotLinked();

        User storage user = users[kycHash];

        // Remove from linked wallets
        for (uint256 i = 0; i < user.linkedWallets.length; i++) {
            if (user.linkedWallets[i] == wallet) {
                user.linkedWallets[i] = user.linkedWallets[user.linkedWallets.length - 1];
                user.linkedWallets.pop();
                break;
            }
        }

        // Remove reverse lookup
        delete walletToKycHash[wallet];

        emit WalletUnlinked(kycHash, wallet, block.timestamp);
    }
}
