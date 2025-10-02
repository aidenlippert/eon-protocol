// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ChronosNFT
 * @notice Soulbound reputation NFT with slashing capabilities
 * @dev Non-transferable ERC721 storing reputation score
 *
 * Security Model:
 * - Soulbound: Cannot be transferred (prevents reputation rental attacks)
 * - Burnable: Can be slashed on default
 * - Score-based: Reputation score determines borrowing power
 */
contract ChronosNFT is ERC721, AccessControl {
    /*//////////////////////////////////////////////////////////////
                            ROLES
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    struct ReputationData {
        uint256 score;           // 0-1000 reputation score
        uint256 ageMonths;       // Age of reputation in months
        uint256 mintTimestamp;   // When NFT was minted
        uint256 lastUpdateTime;  // Last score update
        bool isSlashed;          // Slashing flag
        uint256 slashAmount;     // % slashed (0-100)
    }

    /// @notice Token ID counter
    uint256 private _tokenIdCounter;

    /// @notice Mapping from token ID to reputation data
    mapping(uint256 => ReputationData) public reputationData;

    /// @notice Mapping from owner to token ID
    mapping(address => uint256) public ownerToTokenId;

    /// @notice Reputation half-life (730 days = 2 years)
    uint256 public constant REPUTATION_HALF_LIFE = 730 days;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event ReputationMinted(address indexed owner, uint256 tokenId, uint256 score);
    event ReputationSlashed(address indexed owner, uint256 tokenId, uint256 slashPercent);
    event ReputationRestored(address indexed owner, uint256 tokenId);
    event ReputationDecayed(uint256 tokenId, uint256 oldScore, uint256 newScore);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error SoulboundToken();
    error AlreadyHasReputation();
    error NoReputation();
    error InvalidScore();
    error Slashed();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() ERC721("Chronos Reputation", "CHRONOS") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                        CORE FUNCTIONALITY
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Mint reputation NFT for user
     * @param to User address
     * @param score Initial reputation score (0-1000)
     */
    function mint(address to, uint256 score) external onlyRole(MINTER_ROLE) {
        if (ownerToTokenId[to] != 0) revert AlreadyHasReputation();
        if (score > 1000) revert InvalidScore();

        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);

        uint256 ageMonths = _calculateAge(score);

        reputationData[tokenId] = ReputationData({
            score: score,
            ageMonths: ageMonths,
            mintTimestamp: block.timestamp,
            lastUpdateTime: block.timestamp,
            isSlashed: false,
            slashAmount: 0
        });

        ownerToTokenId[to] = tokenId;

        emit ReputationMinted(to, tokenId, score);
    }

    /**
     * @notice Slash reputation on default
     * @param owner User who defaulted
     * @param slashPercent Percentage to slash (0-100)
     */
    function slash(address owner, uint256 slashPercent) external onlyRole(BURNER_ROLE) {
        uint256 tokenId = ownerToTokenId[owner];
        if (tokenId == 0) revert NoReputation();

        ReputationData storage data = reputationData[tokenId];
        data.isSlashed = true;
        data.slashAmount = slashPercent;

        if (slashPercent == 100) {
            // Full burn (rug pull)
            _burn(tokenId);
            delete ownerToTokenId[owner];
        } else {
            // Partial slash
            data.score = (data.score * (100 - slashPercent)) / 100;
        }

        emit ReputationSlashed(owner, tokenId, slashPercent);
    }

    /**
     * @notice Restore slashed reputation (governance decision)
     */
    function restore(address owner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 tokenId = ownerToTokenId[owner];
        if (tokenId == 0) revert NoReputation();

        ReputationData storage data = reputationData[tokenId];
        data.isSlashed = false;
        data.slashAmount = 0;

        emit ReputationRestored(owner, tokenId);
    }

    /*//////////////////////////////////////////////////////////////
                        REPUTATION DECAY
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculate decayed score based on half-life
     * @dev Reputation decays 50% every 730 days (see economic model)
     */
    function getDecayedScore(address owner) public view returns (uint256) {
        uint256 tokenId = ownerToTokenId[owner];
        if (tokenId == 0) return 0;

        ReputationData memory data = reputationData[tokenId];
        if (data.isSlashed) return 0;

        uint256 timeSinceUpdate = block.timestamp - data.lastUpdateTime;
        if (timeSinceUpdate == 0) return data.score;

        // Exponential decay: score * (0.5 ^ (time / half_life))
        // Approximation: score * (1 - time/(2*half_life))
        uint256 decayFactor = (timeSinceUpdate * 1e18) / (2 * REPUTATION_HALF_LIFE);
        if (decayFactor >= 1e18) return 0;

        return (data.score * (1e18 - decayFactor)) / 1e18;
    }

    /**
     * @notice Update score to account for decay
     */
    function updateDecay(address owner) external {
        uint256 tokenId = ownerToTokenId[owner];
        if (tokenId == 0) revert NoReputation();

        ReputationData storage data = reputationData[tokenId];
        uint256 oldScore = data.score;
        uint256 newScore = getDecayedScore(owner);

        data.score = newScore;
        data.lastUpdateTime = block.timestamp;

        emit ReputationDecayed(tokenId, oldScore, newScore);
    }

    /*//////////////////////////////////////////////////////////////
                        HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculate reputation age from score
     * @dev Reverse engineering: score = 500 + (months * 100)
     */
    function _calculateAge(uint256 score) internal pure returns (uint256) {
        if (score < 500) return 0;
        return (score - 500) / 100; // months
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getScore(address owner) external view returns (uint256) {
        return getDecayedScore(owner);
    }

    function getReputationAge(address owner) external view returns (uint256) {
        uint256 tokenId = ownerToTokenId[owner];
        if (tokenId == 0) return 0;
        return reputationData[tokenId].ageMonths;
    }

    function isSlashed(address owner) external view returns (bool) {
        uint256 tokenId = ownerToTokenId[owner];
        if (tokenId == 0) return false;
        return reputationData[tokenId].isSlashed;
    }

    /*//////////////////////////////////////////////////////////////
                        SOULBOUND OVERRIDES
    //////////////////////////////////////////////////////////////*/

    /// @notice Prevent all transfers (soulbound)
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow mints and burns, block transfers
        if (from != address(0) && to != address(0)) {
            revert SoulboundToken();
        }

        return super._update(to, tokenId, auth);
    }

    /// @notice Required override
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
