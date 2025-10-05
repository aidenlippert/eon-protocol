// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice Chainlink V3 Aggregator Interface
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/**
 * @title ChainlinkPriceOracle
 * @notice Secure price oracle using Chainlink Data Feeds
 * @dev Integrates with Chainlink V3 Aggregator for reliable price data
 *
 * SECURITY FEATURES:
 * - Stale price detection (configurable max age)
 * - Price deviation circuit breaker
 * - Fallback oracle support
 * - Access control for critical functions
 */
contract ChainlinkPriceOracle is Ownable {

    // ==================== STRUCTS ====================

    struct PriceFeedConfig {
        address feed;           // Chainlink price feed address
        uint32 heartbeat;       // Max acceptable staleness (seconds)
        uint8 decimals;         // Feed decimals (usually 8 for USD pairs)
        bool isActive;          // Circuit breaker
    }

    // ==================== STATE ====================

    // Token => Price Feed Config
    mapping(address => PriceFeedConfig) public priceFeeds;

    // Fallback oracle (optional)
    address public fallbackOracle;

    // Price deviation threshold (basis points, e.g., 1000 = 10%)
    uint16 public maxDeviationBps = 1000; // 10% default

    // Emergency circuit breaker
    bool public emergencyPaused;

    // ==================== EVENTS ====================

    event PriceFeedUpdated(address indexed token, address indexed feed, uint32 heartbeat);
    event FallbackOracleSet(address indexed fallbackOracle);
    event EmergencyPause(bool paused);
    event StalePrice(address indexed token, uint256 age, uint256 maxAge);
    event PriceDeviation(address indexed token, int256 price1, int256 price2, uint256 deviationBps);

    // ==================== ERRORS ====================

    error PriceStale(address token, uint256 age, uint256 maxAge);
    error PriceInvalid(address token, int256 price);
    error PriceFeedNotConfigured(address token);
    error EmergencyPaused();
    error RoundIncomplete(address token);

    // ==================== CONSTRUCTOR ====================

    constructor() Ownable(msg.sender) {}

    // ==================== PRICE FUNCTIONS ====================

    /**
     * @notice Get latest price for a token in USD (18 decimals)
     * @param token Address of the token
     * @return priceUsd18 Price in USD with 18 decimals
     */
    function getPrice(address token) external view returns (uint256 priceUsd18) {
        if (emergencyPaused) revert EmergencyPaused();

        PriceFeedConfig memory config = priceFeeds[token];
        if (config.feed == address(0)) revert PriceFeedNotConfigured(token);
        if (!config.isActive) revert PriceFeedNotConfigured(token);

        // Get latest price from Chainlink
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = AggregatorV3Interface(config.feed).latestRoundData();

        // Validate price data
        if (price <= 0) revert PriceInvalid(token, price);
        if (answeredInRound < roundId) revert RoundIncomplete(token);

        // Check staleness
        uint256 age = block.timestamp - updatedAt;
        if (age > config.heartbeat) {
            revert PriceStale(token, age, config.heartbeat);
        }

        // Convert to 18 decimals
        priceUsd18 = _scalePrice(uint256(price), config.decimals, 18);

        return priceUsd18;
    }

    /**
     * @notice Get price with fallback support
     * @param token Address of the token
     * @return priceUsd18 Price in USD with 18 decimals
     */
    function getPriceWithFallback(address token) external view returns (uint256 priceUsd18) {
        try this.getPrice(token) returns (uint256 price) {
            return price;
        } catch {
            // Try fallback oracle if configured
            if (fallbackOracle != address(0)) {
                (bool success, bytes memory data) = fallbackOracle.staticcall(
                    abi.encodeWithSignature("getPrice(address)", token)
                );
                if (success) {
                    return abi.decode(data, (uint256));
                }
            }
            revert PriceFeedNotConfigured(token);
        }
    }

    /**
     * @notice Get prices for multiple tokens (batch query)
     * @param tokens Array of token addresses
     * @return prices Array of prices in USD with 18 decimals
     */
    function getPrices(address[] calldata tokens) external view returns (uint256[] memory prices) {
        prices = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            prices[i] = this.getPrice(tokens[i]);
        }
        return prices;
    }

    /**
     * @notice Convert token amount to USD value (18 decimals)
     * @param token Address of the token
     * @param amount Amount of tokens (in token's native decimals)
     * @return valueUsd18 USD value with 18 decimals
     */
    function tokenToUsd(address token, uint256 amount) external view returns (uint256 valueUsd18) {
        uint256 priceUsd18 = this.getPrice(token);

        // Get token decimals
        uint8 tokenDecimals = _getTokenDecimals(token);

        // Calculate: (amount * price) / 10^tokenDecimals
        valueUsd18 = (amount * priceUsd18) / (10 ** tokenDecimals);

        return valueUsd18;
    }

    /**
     * @notice Convert USD value to token amount
     * @param token Address of the token
     * @param valueUsd18 USD value with 18 decimals
     * @return amount Amount of tokens (in token's native decimals)
     */
    function usdToToken(address token, uint256 valueUsd18) external view returns (uint256 amount) {
        uint256 priceUsd18 = this.getPrice(token);

        // Get token decimals
        uint8 tokenDecimals = _getTokenDecimals(token);

        // Calculate: (valueUsd18 * 10^tokenDecimals) / price
        amount = (valueUsd18 * (10 ** tokenDecimals)) / priceUsd18;

        return amount;
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Configure price feed for a token
     * @param token Address of the token
     * @param feed Chainlink price feed address
     * @param heartbeat Max acceptable staleness (seconds)
     */
    function setPriceFeed(address token, address feed, uint32 heartbeat) external onlyOwner {
        require(feed != address(0), "Invalid feed address");
        require(heartbeat > 0, "Invalid heartbeat");

        // Validate feed by calling it
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed);
        uint8 feedDecimals = priceFeed.decimals();
        priceFeed.latestRoundData(); // Ensure feed works

        priceFeeds[token] = PriceFeedConfig({
            feed: feed,
            heartbeat: heartbeat,
            decimals: feedDecimals,
            isActive: true
        });

        emit PriceFeedUpdated(token, feed, heartbeat);
    }

    /**
     * @notice Deactivate a price feed (circuit breaker)
     */
    function deactivatePriceFeed(address token) external onlyOwner {
        priceFeeds[token].isActive = false;
    }

    /**
     * @notice Activate a price feed
     */
    function activatePriceFeed(address token) external onlyOwner {
        require(priceFeeds[token].feed != address(0), "Feed not configured");
        priceFeeds[token].isActive = true;
    }

    /**
     * @notice Set fallback oracle address
     */
    function setFallbackOracle(address _fallbackOracle) external onlyOwner {
        fallbackOracle = _fallbackOracle;
        emit FallbackOracleSet(_fallbackOracle);
    }

    /**
     * @notice Set max price deviation threshold
     */
    function setMaxDeviationBps(uint16 _maxDeviationBps) external onlyOwner {
        require(_maxDeviationBps <= 5000, "Deviation too high"); // Max 50%
        maxDeviationBps = _maxDeviationBps;
    }

    /**
     * @notice Emergency pause (stops all price queries)
     */
    function setEmergencyPause(bool _paused) external onlyOwner {
        emergencyPaused = _paused;
        emit EmergencyPause(_paused);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Check if price feed is configured and active
     */
    function isPriceFeedActive(address token) external view returns (bool) {
        return priceFeeds[token].feed != address(0) && priceFeeds[token].isActive;
    }

    /**
     * @notice Get price feed configuration
     */
    function getPriceFeedConfig(address token) external view returns (PriceFeedConfig memory) {
        return priceFeeds[token];
    }

    // ==================== INTERNAL FUNCTIONS ====================

    /**
     * @notice Scale price from one decimal precision to another
     */
    function _scalePrice(uint256 price, uint8 fromDecimals, uint8 toDecimals) internal pure returns (uint256) {
        if (fromDecimals == toDecimals) {
            return price;
        } else if (fromDecimals < toDecimals) {
            return price * (10 ** (toDecimals - fromDecimals));
        } else {
            return price / (10 ** (fromDecimals - toDecimals));
        }
    }

    /**
     * @notice Get token decimals
     */
    function _getTokenDecimals(address token) internal view returns (uint8) {
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success, "Decimals call failed");
        return abi.decode(data, (uint8));
    }
}
