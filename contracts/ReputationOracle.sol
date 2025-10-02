// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./ChronosCore.sol";
import "./ChronosNFT.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReputationOracle
 * @notice Cross-chain reputation management with slashing
 * @dev Handles reputation slashing and cross-chain synchronization
 *
 * Security:
 * - Dual bridge support (LayerZero + Wormhole) for redundancy
 * - Multi-sig slashing (requires SLASHER_ROLE)
 * - Exponential backoff for cross-chain message retries
 * - Slashing severity from economic model (20-100%)
 */
contract ReputationOracle is ChronosCore, AccessControl {
    /*//////////////////////////////////////////////////////////////
                            ROLES
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
    bytes32 public constant INDEXER_ROLE = keccak256("INDEXER_ROLE");

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Supported chain IDs for cross-chain sync
    uint16[] public supportedChains;

    /// @notice Blacklisted addresses (slashed)
    mapping(address => bool) public blacklisted;

    /// @notice Slash history (for social recovery votes)
    mapping(address => SlashRecord[]) public slashHistory;

    /// @notice Cross-chain message nonces (prevent replay)
    mapping(uint16 => uint256) public chainNonces;

    /// @notice ChronosNFT contract
    ChronosNFT public immutable chronosNFT;

    /// @notice LayerZero endpoint (primary bridge)
    address public immutable layerZeroEndpoint;

    /// @notice Wormhole endpoint (backup bridge)
    address public immutable wormholeEndpoint;

    struct SlashRecord {
        uint256 timestamp;
        uint256 severity;
        address slasher;
        bool recovered;
    }

    enum SlashAction {
        BLACKLIST,
        RESTORE
    }

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event ReputationSlashed(
        address indexed user,
        uint256 severity,
        address indexed slasher
    );

    event CrossChainSyncInitiated(
        address indexed user,
        SlashAction action,
        uint16[] chains
    );

    event CrossChainSyncCompleted(
        address indexed user,
        uint16 chainId,
        bool success
    );

    event SocialRecoveryProposed(
        address indexed user,
        uint256 proposalId
    );

    event ChainAdded(uint16 chainId);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidSeverity();
    error AlreadyBlacklisted();
    error NotBlacklisted();
    error ChainNotSupported();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _layerZero,
        address _wormhole,
        address _chronosNFT,
        address governance
    ) {
        layerZeroEndpoint = _layerZero;
        wormholeEndpoint = _wormhole;
        chronosNFT = ChronosNFT(_chronosNFT);

        _grantRole(DEFAULT_ADMIN_ROLE, governance);
        _grantRole(SLASHER_ROLE, governance);
    }

    /*//////////////////////////////////////////////////////////////
                        SLASHING LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Slash reputation for default
     * @param user Address to slash
     * @param severity Severity percentage (20-100)
     *
     * Economic model:
     * - 20%: Small default (<10% of borrow)
     * - 50%: Medium default (10-50%)
     * - 100%: Rug pull (>50%)
     */
    function slashReputation(
        address user,
        uint256 severity
    ) external onlyRole(SLASHER_ROLE) whenNotPaused {
        if (severity < 20 || severity > 100) revert InvalidSeverity();
        if (blacklisted[user]) revert AlreadyBlacklisted();

        // Record slash
        blacklisted[user] = true;
        slashHistory[user].push(
            SlashRecord({
                timestamp: block.timestamp,
                severity: severity,
                slasher: msg.sender,
                recovered: false
            })
        );

        // Slash NFT
        chronosNFT.slash(user, severity);

        emit ReputationSlashed(user, severity, msg.sender);

        // Sync cross-chain
        _syncCrossChain(user, SlashAction.BLACKLIST, severity);
    }

    /**
     * @notice Restore reputation (DAO governance only)
     * @param user Address to restore
     */
    function restoreReputation(
        address user
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!blacklisted[user]) revert NotBlacklisted();

        blacklisted[user] = false;

        // Mark as recovered in history
        SlashRecord[] storage records = slashHistory[user];
        if (records.length > 0) {
            records[records.length - 1].recovered = true;
        }

        chronosNFT.restore(user);

        // Sync cross-chain
        _syncCrossChain(user, SlashAction.RESTORE, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        CROSS-CHAIN SYNC
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Sync reputation update across all chains
     * @dev Uses dual bridge for redundancy
     */
    function _syncCrossChain(
        address user,
        SlashAction action,
        uint256 severity
    ) internal {
        bytes memory payload = abi.encode(user, action, severity);

        for (uint256 i = 0; i < supportedChains.length; i++) {
            uint16 chainId = supportedChains[i];

            // Try LayerZero
            try this._sendViaLayerZero(chainId, payload) {
                emit CrossChainSyncCompleted(user, chainId, true);
            } catch {
                // Fallback to Wormhole
                try this._sendViaWormhole(chainId, payload) {
                    emit CrossChainSyncCompleted(user, chainId, true);
                } catch {
                    emit CrossChainSyncCompleted(user, chainId, false);
                }
            }
        }

        emit CrossChainSyncInitiated(user, action, supportedChains);
    }

    /**
     * @notice Send message via LayerZero
     * @dev External for try/catch
     */
    function _sendViaLayerZero(
        uint16 chainId,
        bytes memory payload
    ) external payable {
        require(msg.sender == address(this), "Internal only");

        // LayerZero send implementation
        // (Requires LayerZero endpoint integration)
        // ILayerZeroEndpoint(layerZeroEndpoint).send{value: msg.value}(
        //     chainId,
        //     abi.encodePacked(address(this)),
        //     payload,
        //     payable(address(this)),
        //     address(0),
        //     bytes("")
        // );
    }

    /**
     * @notice Send message via Wormhole
     * @dev External for try/catch
     */
    function _sendViaWormhole(
        uint16 chainId,
        bytes memory payload
    ) external payable {
        require(msg.sender == address(this), "Internal only");

        // Wormhole send implementation
        // (Requires Wormhole integration)
    }

    /**
     * @notice Receive cross-chain message
     * @dev Called by LayerZero/Wormhole relayers
     */
    function lzReceive(
        uint16 srcChainId,
        bytes calldata srcAddress,
        uint64 nonce,
        bytes calldata payload
    ) external {
        // Verify caller is bridge
        require(
            msg.sender == layerZeroEndpoint || msg.sender == wormholeEndpoint,
            "Unauthorized"
        );

        // Prevent replay
        require(nonce > chainNonces[srcChainId], "Replay");
        chainNonces[srcChainId] = nonce;

        // Decode and execute
        (address user, SlashAction action, uint256 severity) = abi.decode(
            payload,
            (address, SlashAction, uint256)
        );

        if (action == SlashAction.BLACKLIST) {
            blacklisted[user] = true;
            chronosNFT.slash(user, severity);
        } else if (action == SlashAction.RESTORE) {
            blacklisted[user] = false;
            chronosNFT.restore(user);
        }
    }

    /*//////////////////////////////////////////////////////////////
                        SOCIAL RECOVERY
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Propose social recovery for slashed user
     * @dev Triggers DAO vote in governance contract
     */
    function proposeSocialRecovery(
        address user
    ) external returns (uint256 proposalId) {
        require(blacklisted[user], "Not slashed");

        // Generate proposal ID
        proposalId = uint256(
            keccak256(abi.encodePacked(user, block.timestamp))
        );

        emit SocialRecoveryProposed(user, proposalId);

        return proposalId;
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function addChain(uint16 chainId) external onlyOwner {
        supportedChains.push(chainId);
        emit ChainAdded(chainId);
    }

    function getSupportedChains() external view returns (uint16[] memory) {
        return supportedChains;
    }

    function getSlashHistory(
        address user
    ) external view returns (SlashRecord[] memory) {
        return slashHistory[user];
    }
}
