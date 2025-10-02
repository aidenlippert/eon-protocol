// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/IZKVerifier.sol";

/**
 * @title ZKVerifierMock
 * @notice Mock ZK verifier for testnet (always returns true)
 * @dev Replace with real Groth16 verifier on mainnet
 */
contract ZKVerifierMock is IZKVerifier {
    /**
     * @notice Mock verification - always accepts proofs
     * @dev FOR TESTNET ONLY - DO NOT USE ON MAINNET
     */
    function verify(
        bytes calldata /* proof */,
        uint256[4] calldata /* publicInputs */
    ) external pure override returns (bool) {
        // Always return true for testnet
        // Real implementation would verify Groth16 SNARK proof
        return true;
    }
}
