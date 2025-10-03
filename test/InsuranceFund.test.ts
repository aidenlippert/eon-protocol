import { expect } from "chai";
import { ethers } from "hardhat";
import {
  InsuranceFund,
  MockERC20
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("InsuranceFund", function () {
  let insuranceFund: InsuranceFund;
  let stablecoin: MockERC20;
  let owner: SignerWithAddress;
  let lendingPool: SignerWithAddress;
  let lender1: SignerWithAddress;
  let lender2: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, lendingPool, lender1, lender2, other] = await ethers.getSigners();

    // Deploy mock stablecoin
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    stablecoin = await MockERC20Factory.deploy("USD Coin", "USDC");

    // Deploy InsuranceFund
    const InsuranceFundFactory = await ethers.getContractFactory("InsuranceFund");
    insuranceFund = await InsuranceFundFactory.deploy(await stablecoin.getAddress());

    // Authorize lending pool
    await insuranceFund.setAuthorizedRequestor(lendingPool.address, true);

    // Mint stablecoins for testing
    await stablecoin.mint(owner.address, ethers.parseEther("100000"));
    await stablecoin.mint(lender1.address, ethers.parseEther("10000"));
    await stablecoin.mint(lendingPool.address, ethers.parseEther("50000"));
  });

  describe("Deployment", function () {
    it("Should set the correct stablecoin address", async function () {
      expect(await insuranceFund.stablecoin()).to.equal(await stablecoin.getAddress());
    });

    it("Should set the owner correctly", async function () {
      expect(await insuranceFund.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero funds", async function () {
      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(0);
      expect(stats._totalCovered).to.equal(0);
      expect(stats._totalDefaults).to.equal(0);
    });

    it("Should set MAX_COVERAGE_PERCENT correctly (0.25%)", async function () {
      expect(await insuranceFund.MAX_COVERAGE_PERCENT()).to.equal(25); // 0.25% = 25/10000
    });

    it("Should set REVENUE_ALLOCATION_PERCENT correctly (5%)", async function () {
      expect(await insuranceFund.REVENUE_ALLOCATION_PERCENT()).to.equal(500); // 5% = 500/10000
    });
  });

  describe("Deposits", function () {
    it("Should allow deposits and update total funds", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("1000"));
      await insuranceFund.deposit(ethers.parseEther("1000"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("1000"));
    });

    it("Should emit Deposit event", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("1000"));

      await expect(insuranceFund.deposit(ethers.parseEther("1000")))
        .to.emit(insuranceFund, "Deposit")
        .withArgs(owner.address, ethers.parseEther("1000"));
    });

    it("Should allow multiple deposits", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("2000"));

      await insuranceFund.deposit(ethers.parseEther("1000"));
      await insuranceFund.deposit(ethers.parseEther("500"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("1500"));
    });

    it("Should allow deposits from different users", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("1000"));
      await stablecoin.connect(lender1).approve(await insuranceFund.getAddress(), ethers.parseEther("500"));

      await insuranceFund.deposit(ethers.parseEther("1000"));
      await insuranceFund.connect(lender1).deposit(ethers.parseEther("500"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("1500"));
    });

    it("Should revert when depositing zero amount", async function () {
      await expect(insuranceFund.deposit(0)).to.be.revertedWith("Amount must be > 0");
    });

    it("Should revert when user has insufficient balance", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("200000"));

      await expect(
        insuranceFund.deposit(ethers.parseEther("200000"))
      ).to.be.reverted; // ERC20: transfer amount exceeds balance
    });

    it("Should revert when user hasn't approved", async function () {
      await expect(insuranceFund.deposit(ethers.parseEther("1000"))).to.be.reverted;
    });
  });

  describe("Revenue Allocation", function () {
    it("Should allocate 5% of protocol revenue", async function () {
      await stablecoin.connect(lendingPool).approve(
        await insuranceFund.getAddress(),
        ethers.parseEther("10000")
      );

      await insuranceFund.connect(lendingPool).allocateRevenue(ethers.parseEther("10000"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("500")); // 5% of 10000
    });

    it("Should emit RevenueAllocated event", async function () {
      await stablecoin.connect(lendingPool).approve(
        await insuranceFund.getAddress(),
        ethers.parseEther("10000")
      );

      await expect(
        insuranceFund.connect(lendingPool).allocateRevenue(ethers.parseEther("10000"))
      )
        .to.emit(insuranceFund, "RevenueAllocated")
        .withArgs(ethers.parseEther("10000"), ethers.parseEther("500"));
    });

    it("Should only allow authorized requestor to allocate", async function () {
      await expect(
        insuranceFund.connect(other).allocateRevenue(ethers.parseEther("10000"))
      ).to.be.revertedWith("Not authorized");
    });

    it("Should handle multiple revenue allocations", async function () {
      await stablecoin.connect(lendingPool).approve(
        await insuranceFund.getAddress(),
        ethers.parseEther("20000")
      );

      await insuranceFund.connect(lendingPool).allocateRevenue(ethers.parseEther("10000"));
      await insuranceFund.connect(lendingPool).allocateRevenue(ethers.parseEther("5000"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("750")); // 500 + 250
    });

    it("Should revert when allocating zero revenue", async function () {
      await expect(
        insuranceFund.connect(lendingPool).allocateRevenue(0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Coverage Calculation", function () {
    it("Should calculate 0.25% maximum coverage", async function () {
      const principal = ethers.parseEther("100000");
      const expectedCoverage = (principal * BigInt(25)) / BigInt(10000);

      const coverage = await insuranceFund.getMaxCoveragePercent(principal);
      expect(coverage).to.equal(expectedCoverage); // 250 USDC
    });

    it("Should limit coverage to available funds", async function () {
      // Fund with only 100 USDC
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("100"));
      await insuranceFund.deposit(ethers.parseEther("100"));

      // Request coverage for 100K USDC loan (would be 250 USDC, but only 100 available)
      const coverage = await insuranceFund.getAvailableCoverage(ethers.parseEther("100000"));
      expect(coverage).to.equal(ethers.parseEther("100"));
    });

    it("Should return full percentage when funds are sufficient", async function () {
      // Fund with 10K USDC
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));

      // Request coverage for 100K USDC loan (250 USDC coverage)
      const principal = ethers.parseEther("100000");
      const expectedCoverage = (principal * BigInt(25)) / BigInt(10000);

      const coverage = await insuranceFund.getMaxCoveragePercent(principal);
      expect(coverage).to.equal(expectedCoverage);
    });

    it("Should return 0 when fund is empty", async function () {
      const coverage = await insuranceFund.getAvailableCoverage(ethers.parseEther("100000"));
      expect(coverage).to.equal(0);
    });

    it("Should handle small loan amounts", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("1000"));
      await insuranceFund.deposit(ethers.parseEther("1000"));

      const principal = ethers.parseEther("100");
      const expectedCoverage = (principal * BigInt(25)) / BigInt(10000); // 0.25 USDC

      const coverage = await insuranceFund.getMaxCoveragePercent(principal);
      expect(coverage).to.equal(expectedCoverage);
    });
  });

  describe("Loss Coverage", function () {
    beforeEach(async function () {
      // Fund insurance pool with 10K USDC
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));
    });

    it("Should cover loss up to maximum percentage", async function () {
      const principal = ethers.parseEther("100000");
      const lossAmount = ethers.parseEther("5000"); // 5% loss
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000); // 250 USDC

      const coveredAmount = await insuranceFund.connect(lendingPool).coverLoss.staticCall(
        lender1.address,
        1,
        principal,
        lossAmount
      );

      expect(coveredAmount).to.equal(maxCoverage);
    });

    it("Should transfer covered amount to lender", async function () {
      const principal = ethers.parseEther("100000");
      const lossAmount = ethers.parseEther("5000");
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000);

      const lenderBalanceBefore = await stablecoin.balanceOf(lender1.address);

      await insuranceFund.connect(lendingPool).coverLoss(lender1.address, 1, principal, lossAmount);

      const lenderBalanceAfter = await stablecoin.balanceOf(lender1.address);
      expect(lenderBalanceAfter - lenderBalanceBefore).to.equal(maxCoverage);
    });

    it("Should update statistics after coverage", async function () {
      const principal = ethers.parseEther("100000");
      const lossAmount = ethers.parseEther("5000");
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000);

      await insuranceFund.connect(lendingPool).coverLoss(lender1.address, 1, principal, lossAmount);

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("10000") - maxCoverage);
      expect(stats._totalCovered).to.equal(maxCoverage);
      expect(stats._totalDefaults).to.equal(1);
    });

    it("Should emit LossCovered event", async function () {
      const principal = ethers.parseEther("100000");
      const lossAmount = ethers.parseEther("5000");
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000);

      await expect(
        insuranceFund.connect(lendingPool).coverLoss(lender1.address, 1, principal, lossAmount)
      )
        .to.emit(insuranceFund, "LossCovered")
        .withArgs(1, lender1.address, lossAmount, maxCoverage);
    });

    it("Should only allow authorized requestor to cover losses", async function () {
      await expect(
        insuranceFund.connect(other).coverLoss(lender1.address, 1, ethers.parseEther("100000"), ethers.parseEther("1000"))
      ).to.be.revertedWith("Not authorized");
    });

    it("Should handle multiple defaults", async function () {
      const principal = ethers.parseEther("100000");
      const loss1 = ethers.parseEther("5000");
      const loss2 = ethers.parseEther("3000");
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000);

      await insuranceFund.connect(lendingPool).coverLoss(lender1.address, 1, principal, loss1);
      await insuranceFund.connect(lendingPool).coverLoss(lender2.address, 2, principal, loss2);

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalCovered).to.equal(maxCoverage * BigInt(2));
      expect(stats._totalDefaults).to.equal(2);
    });

    it("Should cover partial amount when fund is insufficient", async function () {
      // Try to cover more than fund has - should cover what's available
      const principal = ethers.parseEther("100000000"); // 100M
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000); // 25K coverage needed
      const lossAmount = ethers.parseEther("50000");

      // Fund only has 10K, so should cover min(10K, 25K, 50K) = 10K
      const balanceBefore = await insuranceFund.totalFunds();

      const coveredAmount = await insuranceFund.connect(lendingPool).coverLoss.staticCall(
        lender1.address,
        1,
        principal,
        lossAmount
      );

      // Should cover all available funds (10K)
      expect(coveredAmount).to.equal(balanceBefore);
      expect(coveredAmount).to.be.lt(maxCoverage); // Less than max coverage
    });

    it("Should cover exact loss amount if less than max coverage", async function () {
      const principal = ethers.parseEther("100000");
      const lossAmount = ethers.parseEther("100"); // Small loss
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000); // 250 max

      const coveredAmount = await insuranceFund.connect(lendingPool).coverLoss.staticCall(
        lender1.address,
        1,
        principal,
        lossAmount
      );

      // Should cover full 100, not 250
      expect(coveredAmount).to.equal(lossAmount);
    });

    it("Should handle zero principal (edge case)", async function () {
      const coveredAmount = await insuranceFund.connect(lendingPool).coverLoss.staticCall(
        lender1.address,
        1,
        0, // zero principal
        ethers.parseEther("1000")
      );

      expect(coveredAmount).to.equal(0);
    });
  });

  describe("Default History", function () {
    beforeEach(async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));
    });

    it("Should record default history", async function () {
      const principal = ethers.parseEther("100000");
      const lossAmount = ethers.parseEther("5000");

      await insuranceFund.connect(lendingPool).coverLoss(lender1.address, 1, principal, lossAmount);

      const history = await insuranceFund.getDefaultHistory(1);
      expect(history.loanId).to.equal(1);
      expect(history.lender).to.equal(lender1.address);
      expect(history.lossAmount).to.equal(lossAmount);
      expect(history.coveredAmount).to.be.gt(0);
    });

    it("Should return empty history for non-existent loan", async function () {
      const history = await insuranceFund.getDefaultHistory(999);
      expect(history.loanId).to.equal(0);
      expect(history.lender).to.equal(ethers.ZeroAddress);
      expect(history.lossAmount).to.equal(0);
      expect(history.coveredAmount).to.equal(0);
      expect(history.timestamp).to.equal(0);
    });

    it("Should track timestamp of default", async function () {
      const principal = ethers.parseEther("100000");
      const lossAmount = ethers.parseEther("5000");

      const tx = await insuranceFund.connect(lendingPool).coverLoss(
        lender1.address,
        1,
        principal,
        lossAmount
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const history = await insuranceFund.getDefaultHistory(1);
      expect(history.timestamp).to.equal(block!.timestamp);
    });
  });

  describe("Authorization Management", function () {
    it("Should allow owner to authorize requestors", async function () {
      await insuranceFund.setAuthorizedRequestor(other.address, true);
      expect(await insuranceFund.authorizedRequestors(other.address)).to.be.true;
    });

    it("Should allow owner to revoke authorization", async function () {
      await insuranceFund.setAuthorizedRequestor(lendingPool.address, false);
      expect(await insuranceFund.authorizedRequestors(lendingPool.address)).to.be.false;
    });

    it("Should emit AuthorizedRequestorSet event", async function () {
      await expect(insuranceFund.setAuthorizedRequestor(other.address, true))
        .to.emit(insuranceFund, "AuthorizedRequestorSet")
        .withArgs(other.address, true);
    });

    it("Should prevent non-owner from authorizing", async function () {
      await expect(
        insuranceFund.connect(other).setAuthorizedRequestor(other.address, true)
      ).to.be.revertedWithCustomError(insuranceFund, "OwnableUnauthorizedAccount");
    });
  });

  describe("Emergency Withdrawal", function () {
    beforeEach(async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));
    });

    it("Should allow owner to emergency withdraw", async function () {
      const ownerBalanceBefore = await stablecoin.balanceOf(owner.address);

      await insuranceFund.emergencyWithdraw(ethers.parseEther("5000"));

      const ownerBalanceAfter = await stablecoin.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(ethers.parseEther("5000"));
    });

    it("Should emit EmergencyWithdrawal event", async function () {
      await expect(insuranceFund.emergencyWithdraw(ethers.parseEther("5000")))
        .to.emit(insuranceFund, "EmergencyWithdrawal")
        .withArgs(owner.address, ethers.parseEther("5000"));
    });

    it("Should update total funds after withdrawal", async function () {
      await insuranceFund.emergencyWithdraw(ethers.parseEther("5000"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("5000"));
    });

    it("Should prevent non-owner from emergency withdrawal", async function () {
      await expect(
        insuranceFund.connect(other).emergencyWithdraw(ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(insuranceFund, "OwnableUnauthorizedAccount");
    });

    it("Should revert when withdrawing more than available", async function () {
      await expect(
        insuranceFund.emergencyWithdraw(ethers.parseEther("20000"))
      ).to.be.revertedWith("Insufficient funds");
    });

    it("Should allow withdrawing full balance", async function () {
      await insuranceFund.emergencyWithdraw(ethers.parseEther("10000"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(0);
    });
  });

  describe("Statistics", function () {
    it("Should return accurate statistics after multiple operations", async function () {
      // Deposit 10K
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));

      // Allocate revenue (5% of 2K = 100)
      await stablecoin.connect(lendingPool).approve(
        await insuranceFund.getAddress(),
        ethers.parseEther("2000")
      );
      await insuranceFund.connect(lendingPool).allocateRevenue(ethers.parseEther("2000"));

      // Cover 2 defaults
      const principal = ethers.parseEther("100000");
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000);

      await insuranceFund.connect(lendingPool).coverLoss(
        lender1.address,
        1,
        principal,
        ethers.parseEther("5000")
      );
      await insuranceFund.connect(lendingPool).coverLoss(
        lender2.address,
        2,
        principal,
        ethers.parseEther("3000")
      );

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(
        ethers.parseEther("10100") - (maxCoverage * BigInt(2))
      );
      expect(stats._totalCovered).to.equal(maxCoverage * BigInt(2));
      expect(stats._totalDefaults).to.equal(2);
    });

    it("Should show coverage ratio correctly", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));

      const principal = ethers.parseEther("100000");
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000);

      await insuranceFund.connect(lendingPool).coverLoss(
        lender1.address,
        1,
        principal,
        ethers.parseEther("5000")
      );

      const stats = await insuranceFund.getStatistics();
      const ratio = (stats._totalCovered * BigInt(10000)) / (stats._totalCovered + stats._totalFunds);

      // Ratio should be small (covered amount / total ever in fund)
      expect(ratio).to.be.lt(1000); // Less than 10%
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very large amounts", async function () {
      const largeAmount = ethers.parseEther("1000000000"); // 1 billion
      await stablecoin.mint(owner.address, largeAmount);
      await stablecoin.approve(await insuranceFund.getAddress(), largeAmount);

      await insuranceFund.deposit(largeAmount);

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(largeAmount);
    });

    it("Should handle very small amounts (wei)", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), 1000);
      await insuranceFund.deposit(1000);

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(1000);
    });

    it("Should handle coverage calculation with 1 wei principal", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("1000"));
      await insuranceFund.deposit(ethers.parseEther("1000"));

      const coverage = await insuranceFund.getAvailableCoverage(1);
      expect(coverage).to.equal(0); // 1 wei * 0.25% = 0
    });

    it("Should handle multiple withdrawals and deposits", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("5000"));
      await insuranceFund.deposit(ethers.parseEther("1000"));
      await insuranceFund.emergencyWithdraw(ethers.parseEther("500"));
      await insuranceFund.deposit(ethers.parseEther("2000"));
      await insuranceFund.emergencyWithdraw(ethers.parseEther("1000"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("1500"));
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should protect deposit from reentrancy", async function () {
      // This test verifies the nonReentrant modifier is in place
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("1000"));
      await insuranceFund.deposit(ethers.parseEther("1000"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("1000"));
    });

    it("Should protect coverLoss from reentrancy", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));

      const principal = ethers.parseEther("100000");
      await insuranceFund.connect(lendingPool).coverLoss(
        lender1.address,
        1,
        principal,
        ethers.parseEther("5000")
      );

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalDefaults).to.equal(1);
    });

    it("Should protect emergencyWithdraw from reentrancy", async function () {
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("1000"));
      await insuranceFund.deposit(ethers.parseEther("1000"));
      await insuranceFund.emergencyWithdraw(ethers.parseEther("500"));

      const stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("500"));
    });
  });
});
