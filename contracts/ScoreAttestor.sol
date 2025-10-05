// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ScoreAttestor
 * @notice EAS-compatible attestation system for credit scores
 * @dev Integrates with Ethereum Attestation Service on Arbitrum Sepolia
 *
 * **EAS Integration**:
 * - Schema: CreditScore(address user, uint256 score, string tier, uint256 timestamp)
 * - Arbitrum Sepolia EAS: 0xaEF4103A04090071165F78D45D83A0C0782c2B2a
 * - Schema Registry: 0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797
 *
 * **Security**:
 * - Only ScoreOracle can create attestations
 * - Immutable attestations (cannot be revoked)
 * - On-chain verification via EAS
 */

interface IEAS {
    struct AttestationRequest {
        bytes32 schema;
        AttestationRequestData data;
    }

    struct AttestationRequestData {
        address recipient;
        uint64 expirationTime;
        bool revocable;
        bytes32 refUID;
        bytes data;
        uint256 value;
    }

    function attest(AttestationRequest calldata request) external payable returns (bytes32);
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}

struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64 time;
    uint64 expirationTime;
    uint64 revocationTime;
    bytes32 refUID;
    address recipient;
    address attester;
    bool revocable;
    bytes data;
}

contract ScoreAttestor is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // ==================== STATE ====================

    /// @notice EAS contract address on Arbitrum Sepolia
    IEAS public eas;

    /// @notice Schema UID for credit score attestations
    bytes32 public creditScoreSchema;

    /// @notice Authorized ScoreOracle address
    address public scoreOracle;

    /// @notice Mapping: user → latest attestation UID
    mapping(address => bytes32) public latestAttestation;

    /// @notice Attestation history per user
    mapping(address => bytes32[]) public attestationHistory;

    // ==================== EVENTS ====================

    event AttestationCreated(
        address indexed user,
        bytes32 indexed uid,
        uint256 score,
        string tier,
        uint256 timestamp
    );

    event SchemaUpdated(bytes32 indexed oldSchema, bytes32 indexed newSchema);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    // ==================== ERRORS ====================

    error UnauthorizedCaller();
    error InvalidScore();
    error AttestationFailed();

    // ==================== INITIALIZATION ====================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _easAddress,
        bytes32 _schemaUID,
        address _scoreOracle
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        eas = IEAS(_easAddress);
        creditScoreSchema = _schemaUID;
        scoreOracle = _scoreOracle;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Create attestation for user's credit score
     * @param user User address
     * @param score Credit score (0-1000)
     * @param tier Credit tier (Bronze/Silver/Gold/Platinum)
     * @return uid Attestation UID
     */
    function attestScore(
        address user,
        uint256 score,
        string calldata tier
    ) external returns (bytes32 uid) {
        if (msg.sender != scoreOracle) revert UnauthorizedCaller();
        if (score > 1000) revert InvalidScore();

        // Encode attestation data
        bytes memory attestationData = abi.encode(
            user,
            score,
            tier,
            block.timestamp
        );

        // Create EAS attestation request
        IEAS.AttestationRequest memory request = IEAS.AttestationRequest({
            schema: creditScoreSchema,
            data: IEAS.AttestationRequestData({
                recipient: user,
                expirationTime: 0, // No expiration
                revocable: false, // Immutable
                refUID: bytes32(0),
                data: attestationData,
                value: 0
            })
        });

        // Submit to EAS
        uid = eas.attest(request);
        if (uid == bytes32(0)) revert AttestationFailed();

        // Store attestation UID
        latestAttestation[user] = uid;
        attestationHistory[user].push(uid);

        emit AttestationCreated(user, uid, score, tier, block.timestamp);
    }

    /**
     * @notice Get latest attestation for user
     * @param user User address
     * @return uid Attestation UID
     */
    function getLatestAttestation(address user) external view returns (bytes32) {
        return latestAttestation[user];
    }

    /**
     * @notice Get full attestation history for user
     * @param user User address
     * @return uids Array of attestation UIDs
     */
    function getAttestationHistory(address user) external view returns (bytes32[] memory) {
        return attestationHistory[user];
    }

    /**
     * @notice Verify attestation on-chain via EAS
     * @param uid Attestation UID
     * @return valid Whether attestation is valid
     */
    function verifyAttestation(bytes32 uid) external view returns (bool valid) {
        Attestation memory attestation = eas.getAttestation(uid);

        // Check attestation exists and matches our schema
        return attestation.uid == uid &&
               attestation.schema == creditScoreSchema &&
               attestation.revocationTime == 0; // Not revoked
    }

    /**
     * @notice Decode attestation data
     * @param uid Attestation UID
     * @return user User address
     * @return score Credit score
     * @return tier Credit tier
     * @return timestamp Attestation timestamp
     */
    function decodeAttestation(bytes32 uid) external view returns (
        address user,
        uint256 score,
        string memory tier,
        uint256 timestamp
    ) {
        Attestation memory attestation = eas.getAttestation(uid);
        (user, score, tier, timestamp) = abi.decode(
            attestation.data,
            (address, uint256, string, uint256)
        );
    }

    // ==================== ADMIN FUNCTIONS ====================

    function updateSchema(bytes32 newSchema) external onlyOwner {
        bytes32 oldSchema = creditScoreSchema;
        creditScoreSchema = newSchema;
        emit SchemaUpdated(oldSchema, newSchema);
    }

    function updateOracle(address newOracle) external onlyOwner {
        address oldOracle = scoreOracle;
        scoreOracle = newOracle;
        emit OracleUpdated(oldOracle, newOracle);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
