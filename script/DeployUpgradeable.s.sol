// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/ChainlinkPriceOracle.sol";
import "../contracts/upgradeable/CreditRegistryV3Upgradeable.sol";
import "../contracts/upgradeable/ScoreOraclePhase3BUpgradeable.sol";
import "../contracts/upgradeable/CreditVaultV3Upgradeable.sol";

/**
 * @title UUPS Deployment Script (Foundry)
 * @notice Deploys upgradeable contracts using OpenZeppelin UUPS pattern
 * @dev Run with: forge script script/DeployUpgradeable.s.sol:DeployUpgradeable --rpc-url <RPC> --broadcast
 */
contract DeployUpgradeable is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying contracts with account:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // ==================== 1. Deploy ChainlinkPriceOracle (Non-Upgradeable) ====================
        console.log("\nDeploying ChainlinkPriceOracle...");
        ChainlinkPriceOracle priceOracle = new ChainlinkPriceOracle(deployer);
        console.log("ChainlinkPriceOracle deployed at:", address(priceOracle));

        // ==================== 2. Deploy CreditRegistryV3Upgradeable ====================
        console.log("\nDeploying CreditRegistryV3Upgradeable...");

        // Deploy implementation
        CreditRegistryV3Upgradeable registryImpl = new CreditRegistryV3Upgradeable();
        console.log("Registry implementation:", address(registryImpl));

        // Prepare initialization data
        address stakeToken = address(0); // TODO: Replace with actual stake token
        bytes memory registryInitData = abi.encodeWithSelector(
            CreditRegistryV3Upgradeable.initialize.selector,
            deployer,
            stakeToken
        );

        // Deploy proxy
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            registryInitData
        );
        console.log("Registry proxy deployed at:", address(registryProxy));

        CreditRegistryV3Upgradeable registry = CreditRegistryV3Upgradeable(payable(address(registryProxy)));

        // ==================== 3. Deploy ScoreOraclePhase3BUpgradeable ====================
        console.log("\nDeploying ScoreOraclePhase3BUpgradeable...");

        // Deploy implementation
        ScoreOraclePhase3BUpgradeable oracleImpl = new ScoreOraclePhase3BUpgradeable();
        console.log("Oracle implementation:", address(oracleImpl));

        // Prepare initialization data
        bytes memory oracleInitData = abi.encodeWithSelector(
            ScoreOraclePhase3BUpgradeable.initialize.selector,
            deployer,
            address(registry)
        );

        // Deploy proxy
        ERC1967Proxy oracleProxy = new ERC1967Proxy(
            address(oracleImpl),
            oracleInitData
        );
        console.log("Oracle proxy deployed at:", address(oracleProxy));

        ScoreOraclePhase3BUpgradeable oracle = ScoreOraclePhase3BUpgradeable(address(oracleProxy));

        // ==================== 4. Deploy CreditVaultV3Upgradeable ====================
        console.log("\nDeploying CreditVaultV3Upgradeable...");

        // Deploy implementation
        CreditVaultV3Upgradeable vaultImpl = new CreditVaultV3Upgradeable();
        console.log("Vault implementation:", address(vaultImpl));

        // Prepare initialization data
        bytes memory vaultInitData = abi.encodeWithSelector(
            CreditVaultV3Upgradeable.initialize.selector,
            deployer,
            address(registry),
            address(oracle),
            address(priceOracle)
        );

        // Deploy proxy
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            vaultInitData
        );
        console.log("Vault proxy deployed at:", address(vaultProxy));

        CreditVaultV3Upgradeable vault = CreditVaultV3Upgradeable(address(vaultProxy));

        // ==================== 5. Configure Access Control ====================
        console.log("\nConfiguring access control...");
        registry.setLenderAuthorization(address(vault), true);
        console.log("Vault authorized as lender in Registry");

        vm.stopBroadcast();

        // ==================== 6. Summary ====================
        console.log("\n============================================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("============================================================");
        console.log("\nContract Addresses:");
        console.log("ChainlinkPriceOracle:      ", address(priceOracle));
        console.log("CreditRegistry (Proxy):    ", address(registry));
        console.log("CreditRegistry (Impl):     ", address(registryImpl));
        console.log("ScoreOracle (Proxy):       ", address(oracle));
        console.log("ScoreOracle (Impl):        ", address(oracleImpl));
        console.log("CreditVault (Proxy):       ", address(vault));
        console.log("CreditVault (Impl):        ", address(vaultImpl));

        console.log("\nNext Steps:");
        console.log("1. Configure price feeds in ChainlinkPriceOracle");
        console.log("2. Set allowed assets in CreditVault");
        console.log("3. Set insurance pool address (optional)");
        console.log("4. Verify contracts on Arbiscan");
        console.log("5. Test upgrade flow with upgrade script");
    }
}
