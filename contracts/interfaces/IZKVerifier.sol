// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IZKVerifier {
    function verifyProof(
        bytes calldata proof,
        bytes32 publicInputHash
    ) external view returns (bool);
}
