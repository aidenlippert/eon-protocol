// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../ChronosCore.sol";
import "../ChronosNFT.sol";
import "../ClaimManager.sol";
import "../ReputationOracle.sol";
import "../LendingPool.sol";
import "../ChronosGovernance.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title Mock ERC20 for testing
 */
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title Mock ZK Verifier for testing
 */
contract MockZKVerifier {
    bool public shouldPass = true;

    function setShouldPass(bool _shouldPass) external {
        shouldPass = _shouldPass;
    }

    function verify(
        bytes calldata,
        uint256[4] calldata
    ) external view returns (bool) {
        return shouldPass;
    }
}

/**
 * @title Comprehensive Chronos Protocol Test Suite
 * @notice Tests all contracts, attack vectors, and edge cases
 */
contract ChronosProtocolTest is Test {
    /*//////////////////////////////////////////////////////////////
                            CONTRACTS
    //////////////////////////////////////////////////////////////*/

    ChronosCore public core;
    ChronosNFT public nft;
    ClaimManager public claimManager;
    ReputationOracle public oracle;
    LendingPool public lendingPool;
    ChronosGovernance public governance;
    TimelockController public timelock;

    MockERC20 public collateralToken;
    MockERC20 public borrowToken;
    MockZKVerifier public zkVerifier;

    /*//////////////////////////////////////////////////////////////
                            TEST ACCOUNTS
    //////////////////////////////////////////////////////////////*/

    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);
    address public attacker = address(0x4);
    address public liquidator = address(0x5);

    address public layerZeroEndpoint = address(0x100);
    address public wormholeEndpoint = address(0x101);

    /*//////////////////////////////////////////////////////////////
                            SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        // Deploy tokens
        collateralToken = new MockERC20("Wrapped ETH", "WETH");
        borrowToken = new MockERC20("USD Coin", "USDC");

        // Deploy ZK verifier
        zkVerifier = new MockZKVerifier();

        // Deploy core contracts
        core = new ChronosCore();
        core.initialize(owner);

        nft = new ChronosNFT(address(core));

        claimManager = new ClaimManager(
            address(nft),
            address(zkVerifier)
        );

        oracle = new ReputationOracle(
            layerZeroEndpoint,
            wormholeEndpoint,
            address(nft),
            owner
        );

        lendingPool = new LendingPool(
            address(nft),
            address(oracle),
            address(collateralToken),
            address(borrowToken)
        );

        // Deploy governance with timelock
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = owner;
        executors[0] = address(0); // Anyone can execute

        timelock = new TimelockController(
            2 days, // 2 day delay
            proposers,
            executors,
            owner
        );

        governance = new ChronosGovernance(
            IVotes(address(nft)),
            timelock,
            address(nft),
            address(oracle)
        );

        // Grant roles
        nft.grantRole(nft.MINTER_ROLE(), address(claimManager));
        oracle.grantRole(oracle.SLASHER_ROLE(), address(lendingPool));

        // Fund test accounts
        collateralToken.mint(alice, 100 ether);
        collateralToken.mint(bob, 100 ether);
        collateralToken.mint(attacker, 1000 ether);

        borrowToken.mint(owner, 1_000_000 ether);
        borrowToken.mint(liquidator, 100_000 ether);

        // Approve spending
        vm.prank(alice);
        collateralToken.approve(address(lendingPool), type(uint256).max);

        vm.prank(bob);
        collateralToken.approve(address(lendingPool), type(uint256).max);

        vm.prank(attacker);
        collateralToken.approve(address(lendingPool), type(uint256).max);

        borrowToken.approve(address(lendingPool), type(uint256).max);

        vm.prank(liquidator);
        borrowToken.approve(address(lendingPool), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                        CLAIM MANAGER TESTS
    //////////////////////////////////////////////////////////////*/

    function testSubmitClaim() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);

        uint256 claimId = claimManager.submitClaim{value: 0.1 ether}(
            10 ether,
            1000,
            2000,
            keccak256("merkle_root")
        );

        assertEq(claimId, 1);

        (
            address user,
            uint256 minBalance,
            ,
            ,
            ,
            ,
            ,
            ClaimManager.ClaimStatus status
        ) = claimManager.claims(claimId);

        assertEq(user, alice);
        assertEq(minBalance, 10 ether);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.PENDING));
    }

    function testClaimAutoAcceptance() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);

        uint256 claimId = claimManager.submitClaim{value: 0.1 ether}(
            10 ether,
            1000,
            2000,
            keccak256("merkle_root")
        );

        // Fast forward past challenge period (7 days)
        vm.warp(block.timestamp + 8 days);

        // Anyone can finalize
        claimManager.finalizeClaim(claimId);

        (,,,,,,, ClaimManager.ClaimStatus status) = claimManager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.ACCEPTED));

        // Alice should have NFT
        assertEq(nft.balanceOf(alice), 1);
    }

    function testChallengeInvalidClaim() public {
        // Alice submits claim
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256 claimId = claimManager.submitClaim{value: 0.1 ether}(
            10 ether,
            1000,
            2000,
            keccak256("merkle_root")
        );

        // Bob challenges
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        claimManager.challengeClaim{value: 0.2 ether}(claimId);

        // Set verifier to fail
        zkVerifier.setShouldPass(false);

        // Alice tries to resolve with ZK proof (will fail)
        vm.prank(alice);
        claimManager.resolveWithZKProof(claimId, bytes("fake_proof"));

        // Claim should be rejected
        (,,,,,,, ClaimManager.ClaimStatus status) = claimManager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.REJECTED));

        // Bob should get Alice's stake + his stake back
        assertGt(bob.balance, 0.2 ether);
    }

    function testFlashLoanProtection() public {
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);

        // Try to create claim with samples too close together
        // This should revert with InsufficientSampleGap
        vm.expectRevert(ClaimManager.InsufficientSampleGap.selector);
        claimManager.submitClaim{value: 0.1 ether}(
            10 ether,
            1000,
            1050, // Only 50 blocks (< 100 minimum)
            keccak256("merkle_root")
        );
    }

    /*//////////////////////////////////////////////////////////////
                        LENDING POOL TESTS
    //////////////////////////////////////////////////////////////*/

    function testDepositLiquidity() public {
        borrowToken.approve(address(lendingPool), 10_000 ether);

        lendingPool.depositLiquidity(
            LendingPool.PoolType.CONSERVATIVE,
            10_000 ether
        );

        (uint256 totalLiquidity,,,,,, bool active) = lendingPool.pools(
            LendingPool.PoolType.CONSERVATIVE
        );

        assertEq(totalLiquidity, 10_000 ether);
        assertTrue(active);
    }

    function testBorrowWithReputation() public {
        // Setup: Deposit liquidity
        borrowToken.approve(address(lendingPool), 100_000 ether);
        lendingPool.depositLiquidity(
            LendingPool.PoolType.CONSERVATIVE,
            100_000 ether
        );

        // Give Alice reputation
        vm.prank(address(claimManager));
        nft.mint(alice, 12, 750); // 750 score, 12 months age

        // Alice borrows
        vm.prank(alice);
        uint256 loanId = lendingPool.borrow(
            LendingPool.PoolType.CONSERVATIVE,
            10 ether, // collateral
            5 ether   // borrow (50% LTV)
        );

        assertEq(loanId, 1);

        (address borrower, uint256 principal,,,,, bool active,) = lendingPool.loans(loanId);
        assertEq(borrower, alice);
        assertEq(principal, 5 ether);
        assertTrue(active);
    }

    function testCannotBorrowWhenBlacklisted() public {
        // Setup liquidity
        borrowToken.approve(address(lendingPool), 100_000 ether);
        lendingPool.depositLiquidity(
            LendingPool.PoolType.CONSERVATIVE,
            100_000 ether
        );

        // Give Alice reputation
        vm.prank(address(claimManager));
        nft.mint(alice, 12, 750);

        // Blacklist Alice
        vm.prank(owner);
        oracle.grantRole(oracle.SLASHER_ROLE(), owner);
        oracle.slashReputation(alice, 100);

        // Alice tries to borrow
        vm.prank(alice);
        vm.expectRevert(LendingPool.Blacklisted.selector);
        lendingPool.borrow(
            LendingPool.PoolType.CONSERVATIVE,
            10 ether,
            5 ether
        );
    }

    function testLiquidation() public {
        // Setup liquidity
        borrowToken.approve(address(lendingPool), 100_000 ether);
        lendingPool.depositLiquidity(
            LendingPool.PoolType.CONSERVATIVE,
            100_000 ether
        );

        // Give Alice reputation
        vm.prank(address(claimManager));
        nft.mint(alice, 12, 750);

        // Alice borrows
        vm.prank(alice);
        uint256 loanId = lendingPool.borrow(
            LendingPool.PoolType.CONSERVATIVE,
            10 ether,
            5 ether
        );

        // Fast forward to accrue interest (simulate underwater position)
        vm.warp(block.timestamp + 365 days);

        // Liquidate
        vm.prank(liquidator);
        lendingPool.liquidate(loanId);

        // Loan should be inactive
        (,,,,,, bool active,) = lendingPool.loans(loanId);
        assertFalse(active);

        // Liquidator should receive collateral
        assertGt(collateralToken.balanceOf(liquidator), 0);
    }

    function testCircuitBreaker() public {
        // Setup liquidity
        borrowToken.approve(address(lendingPool), 1_000_000 ether);
        lendingPool.depositLiquidity(
            LendingPool.PoolType.CONSERVATIVE,
            1_000_000 ether
        );

        // Give attacker high reputation
        vm.prank(address(claimManager));
        nft.mint(attacker, 36, 1000);

        // Attacker tries to borrow >$10M in 1 hour
        vm.prank(attacker);
        vm.expectRevert(ChronosCore.CircuitBreakerExceeded.selector);
        lendingPool.borrow(
            LendingPool.PoolType.CONSERVATIVE,
            15_000 ether, // $15M+ at 1:1
            10_000 ether
        );
    }

    /*//////////////////////////////////////////////////////////////
                        REPUTATION ORACLE TESTS
    //////////////////////////////////////////////////////////////*/

    function testSlashReputation() public {
        // Give Alice reputation
        vm.prank(address(claimManager));
        nft.mint(alice, 12, 750);

        // Grant slasher role
        oracle.grantRole(oracle.SLASHER_ROLE(), owner);

        // Slash Alice
        oracle.slashReputation(alice, 50); // 50% slash

        assertTrue(oracle.blacklisted(alice));

        // Check slash history
        ReputationOracle.SlashRecord[] memory history = oracle.getSlashHistory(alice);
        assertEq(history.length, 1);
        assertEq(history[0].severity, 50);
    }

    function testRestoreReputation() public {
        // Setup: slash Alice
        vm.prank(address(claimManager));
        nft.mint(alice, 12, 750);

        oracle.grantRole(oracle.SLASHER_ROLE(), owner);
        oracle.slashReputation(alice, 50);

        assertTrue(oracle.blacklisted(alice));

        // Restore via governance
        oracle.restoreReputation(alice);

        assertFalse(oracle.blacklisted(alice));
    }

    /*//////////////////////////////////////////////////////////////
                        GOVERNANCE TESTS
    //////////////////////////////////////////////////////////////*/

    function testCreateProposal() public {
        // Give owner voting power
        vm.prank(address(claimManager));
        nft.mint(owner, 12, 500);

        // Create proposal
        address[] memory targets = new address[](1);
        targets[0] = address(core);

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(ChronosCore.pause.selector);

        uint256 proposalId = governance.propose(
            targets,
            values,
            calldatas,
            "Test Proposal"
        );

        assertGt(proposalId, 0);
    }

    function testSlashedCannotVote() public {
        // Give Alice voting power
        vm.prank(address(claimManager));
        nft.mint(alice, 12, 500);

        // Slash Alice
        oracle.grantRole(oracle.SLASHER_ROLE(), owner);
        oracle.slashReputation(alice, 100);

        // Alice tries to vote
        vm.prank(alice);
        vm.expectRevert(ChronosGovernance.SlashedCannotVote.selector);
        governance.castVote(1, 1);
    }

    /*//////////////////////////////////////////////////////////////
                        ATTACK VECTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testFalseClaimAttack() public {
        // Attacker submits false claim
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        uint256 claimId = claimManager.submitClaim{value: 0.1 ether}(
            1000 ether, // Fake large balance
            1000,
            2000,
            keccak256("fake_merkle")
        );

        // Honest indexer challenges
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        claimManager.challengeClaim{value: 0.2 ether}(claimId);

        // Verifier rejects
        zkVerifier.setShouldPass(false);

        vm.prank(attacker);
        claimManager.resolveWithZKProof(claimId, bytes("fake"));

        // Attacker loses 0.1 ETH stake
        assertLt(attacker.balance, 1 ether);

        // Bob wins 0.3 ETH (his 0.2 + attacker's 0.1)
        assertGt(bob.balance, 1 ether);
    }

    function testReputationRentalAttack() public {
        // Alice has good reputation
        vm.prank(address(claimManager));
        nft.mint(alice, 36, 1000);

        // Alice tries to transfer NFT to attacker
        vm.prank(alice);
        vm.expectRevert(ChronosNFT.SoulboundToken.selector);
        nft.transferFrom(alice, attacker, 1);

        // NFT remains soulbound
        assertEq(nft.ownerOf(1), alice);
    }

    function testCoordinatedDefaultAttack() public {
        // Setup large liquidity pool
        borrowToken.approve(address(lendingPool), 20_000_000 ether);
        lendingPool.depositLiquidity(
            LendingPool.PoolType.DEGEN,
            20_000_000 ether
        );

        // Multiple attackers try to default simultaneously
        // Circuit breaker should prevent >$10M/hour borrows

        address attacker1 = address(0x1001);
        address attacker2 = address(0x1002);

        // Give them reputation
        vm.prank(address(claimManager));
        nft.mint(attacker1, 36, 1000);

        vm.prank(address(claimManager));
        nft.mint(attacker2, 36, 1000);

        // Fund attackers
        collateralToken.mint(attacker1, 10_000 ether);
        collateralToken.mint(attacker2, 10_000 ether);

        vm.prank(attacker1);
        collateralToken.approve(address(lendingPool), type(uint256).max);

        vm.prank(attacker2);
        collateralToken.approve(address(lendingPool), type(uint256).max);

        // Attacker 1 borrows $5M
        vm.prank(attacker1);
        lendingPool.borrow(
            LendingPool.PoolType.DEGEN,
            6000 ether,
            5000 ether
        );

        // Attacker 2 tries to borrow another $6M (total >$10M/hour)
        vm.prank(attacker2);
        vm.expectRevert(ChronosCore.CircuitBreakerExceeded.selector);
        lendingPool.borrow(
            LendingPool.PoolType.DEGEN,
            7000 ether,
            6000 ether
        );
    }

    /*//////////////////////////////////////////////////////////////
                        INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testFullUserJourney() public {
        // 1. Alice submits temporal ownership claim
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256 claimId = claimManager.submitClaim{value: 0.1 ether}(
            10 ether,
            1000,
            100000,
            keccak256("merkle_root")
        );

        // 2. No challenges, claim auto-accepts
        vm.warp(block.timestamp + 8 days);
        claimManager.finalizeClaim(claimId);

        // 3. Alice receives reputation NFT
        assertEq(nft.balanceOf(alice), 1);

        // 4. Liquidity provider deposits
        borrowToken.approve(address(lendingPool), 100_000 ether);
        lendingPool.depositLiquidity(
            LendingPool.PoolType.CONSERVATIVE,
            100_000 ether
        );

        // 5. Alice borrows against reputation
        vm.prank(alice);
        uint256 loanId = lendingPool.borrow(
            LendingPool.PoolType.CONSERVATIVE,
            10 ether,
            5 ether
        );

        // 6. Alice repays loan
        vm.warp(block.timestamp + 30 days);

        // Calculate repayment
        (, uint256 principal,,,,,,) = lendingPool.loans(loanId);
        uint256 repayment = principal + (principal * 8 * 30) / (100 * 365); // ~8% APR

        borrowToken.mint(alice, repayment);

        vm.prank(alice);
        borrowToken.approve(address(lendingPool), repayment);

        vm.prank(alice);
        lendingPool.repay(loanId);

        // 7. Alice gets collateral back
        assertGt(collateralToken.balanceOf(alice), 90 ether);
    }
}
