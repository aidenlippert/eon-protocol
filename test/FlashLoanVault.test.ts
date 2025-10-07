import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { FlashLoanVaultV1 } from "../typechain-types";

describe("FlashLoanVaultV1", function () {
  let flashLoanVault: FlashLoanVaultV1;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user: SignerWithAddress;
  let mockToken: any;

  const MAX_FLASH_LOAN = ethers.parseEther("1000000"); // 1M max
  const FLASH_LOAN_PREMIUM_TOTAL = 9; // 0.09%
  const FLASH_LOAN_PREMIUM_TO_PROTOCOL = 4; // 0.04%
  const PREMIUM_PRECISION = 10000;

  beforeEach(async function () {
    [owner, treasury, user] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock USDC", "USDC", 18);
    await mockToken.waitForDeployment();

    // Deploy FlashLoanVault
    const FlashLoanVaultFactory = await ethers.getContractFactory(
      "FlashLoanVaultV1"
    );

    flashLoanVault = (await upgrades.deployProxy(
      FlashLoanVaultFactory,
      [treasury.address, MAX_FLASH_LOAN],
      { initializer: "initialize" }
    )) as unknown as FlashLoanVaultV1;

    await flashLoanVault.waitForDeployment();

    // Mint tokens to vault (liquidity)
    await mockToken.mint(
      await flashLoanVault.getAddress(),
      ethers.parseEther("10000000") // 10M liquidity
    );
  });

  describe("Deployment", function () {
    it("Should set correct treasury", async function () {
      expect(await flashLoanVault.treasury()).to.equal(treasury.address);
    });

    it("Should set correct max flash loan amount", async function () {
      expect(await flashLoanVault.maxFlashLoanAmount()).to.equal(
        MAX_FLASH_LOAN
      );
    });

    it("Should set correct owner", async function () {
      expect(await flashLoanVault.owner()).to.equal(owner.address);
    });

    it("Should reject zero treasury address", async function () {
      const FlashLoanVaultFactory = await ethers.getContractFactory(
        "FlashLoanVaultV1"
      );

      await expect(
        upgrades.deployProxy(
          FlashLoanVaultFactory,
          [ethers.ZeroAddress, MAX_FLASH_LOAN],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(flashLoanVault, "InvalidTreasury");
    });
  });

  describe("Flash Loan Fee Calculation", function () {
    it("Should calculate correct fees (0.09% total)", async function () {
      const amount = ethers.parseEther("100000"); // 100k

      const [premium, protocolFee, lpFee] = await flashLoanVault.flashFee(
        amount
      );

      // Total premium = 100000 * 0.0009 = 90
      const expectedPremium = (amount * BigInt(FLASH_LOAN_PREMIUM_TOTAL)) /
        BigInt(PREMIUM_PRECISION);
      expect(premium).to.equal(expectedPremium);

      // Protocol fee = 100000 * 0.0004 = 40
      const expectedProtocolFee = (amount * BigInt(FLASH_LOAN_PREMIUM_TO_PROTOCOL)) /
        BigInt(PREMIUM_PRECISION);
      expect(protocolFee).to.equal(expectedProtocolFee);

      // LP fee = 90 - 40 = 50
      expect(lpFee).to.equal(premium - protocolFee);
    });

    it("Should calculate fees for small amounts", async function () {
      const amount = ethers.parseEther("1000"); // 1k

      const [premium, protocolFee, lpFee] = await flashLoanVault.flashFee(
        amount
      );

      expect(premium).to.be.gt(0);
      expect(protocolFee).to.be.gt(0);
      expect(lpFee).to.equal(premium - protocolFee);
    });

    it("Should calculate fees for large amounts", async function () {
      const amount = ethers.parseEther("10000000"); // 10M

      const [premium, protocolFee, lpFee] = await flashLoanVault.flashFee(
        amount
      );

      // 10M * 0.0009 = 9000
      expect(premium).to.equal(ethers.parseEther("9000"));
      expect(protocolFee).to.equal(ethers.parseEther("4000"));
      expect(lpFee).to.equal(ethers.parseEther("5000"));
    });
  });

  describe("Max Flash Loan", function () {
    it("Should return 0 for disabled assets", async function () {
      const maxAmount = await flashLoanVault.maxFlashLoan(
        await mockToken.getAddress()
      );
      expect(maxAmount).to.equal(0);
    });

    it("Should return available liquidity when enabled", async function () {
      await flashLoanVault.enableFlashLoan(await mockToken.getAddress());

      const maxAmount = await flashLoanVault.maxFlashLoan(
        await mockToken.getAddress()
      );

      // Should be min(availableLiquidity, maxFlashLoanAmount)
      expect(maxAmount).to.equal(MAX_FLASH_LOAN);
    });

    it("Should cap at maxFlashLoanAmount", async function () {
      await flashLoanVault.enableFlashLoan(await mockToken.getAddress());

      // Even though vault has 10M, max is 1M
      const maxAmount = await flashLoanVault.maxFlashLoan(
        await mockToken.getAddress()
      );
      expect(maxAmount).to.equal(MAX_FLASH_LOAN);
    });
  });

  describe("Asset Management", function () {
    it("Should enable flash loans (owner)", async function () {
      await expect(
        flashLoanVault.enableFlashLoan(await mockToken.getAddress())
      )
        .to.emit(flashLoanVault, "FlashLoanEnabled")
        .withArgs(await mockToken.getAddress());

      expect(
        await flashLoanVault.flashLoanEnabled(await mockToken.getAddress())
      ).to.be.true;
    });

    it("Should disable flash loans (owner)", async function () {
      await flashLoanVault.enableFlashLoan(await mockToken.getAddress());

      await expect(
        flashLoanVault.disableFlashLoan(await mockToken.getAddress())
      )
        .to.emit(flashLoanVault, "FlashLoanDisabled")
        .withArgs(await mockToken.getAddress());

      expect(
        await flashLoanVault.flashLoanEnabled(await mockToken.getAddress())
      ).to.be.false;
    });

    it("Should reject non-owner enable/disable", async function () {
      await expect(
        flashLoanVault.connect(user).enableFlashLoan(
          await mockToken.getAddress()
        )
      ).to.be.revertedWithCustomError(flashLoanVault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Treasury Management", function () {
    it("Should update treasury (owner)", async function () {
      const newTreasury = user.address;

      await expect(flashLoanVault.setTreasury(newTreasury))
        .to.emit(flashLoanVault, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury);

      expect(await flashLoanVault.treasury()).to.equal(newTreasury);
    });

    it("Should reject zero address treasury", async function () {
      await expect(
        flashLoanVault.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(flashLoanVault, "InvalidTreasury");
    });

    it("Should reject non-owner treasury update", async function () {
      await expect(
        flashLoanVault.connect(user).setTreasury(user.address)
      ).to.be.revertedWithCustomError(flashLoanVault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Max Flash Loan Amount Management", function () {
    it("Should update max amount (owner)", async function () {
      const newMax = ethers.parseEther("5000000"); // 5M

      await expect(flashLoanVault.setMaxFlashLoanAmount(newMax))
        .to.emit(flashLoanVault, "MaxFlashLoanAmountUpdated")
        .withArgs(MAX_FLASH_LOAN, newMax);

      expect(await flashLoanVault.maxFlashLoanAmount()).to.equal(newMax);
    });
  });

  describe("Statistics", function () {
    it("Should return zero stats initially", async function () {
      const [volume, fees] = await flashLoanVault.getAssetStats(
        await mockToken.getAddress()
      );

      expect(volume).to.equal(0);
      expect(fees).to.equal(0);
    });

    it("Should return zero user stats initially", async function () {
      const [count, volume] = await flashLoanVault.getUserStats(user.address);

      expect(count).to.equal(0);
      expect(volume).to.equal(0);
    });

    it("Should return zero flash loan count initially", async function () {
      expect(await flashLoanVault.getFlashLoanCount()).to.equal(0);
    });
  });

  describe("Emergency Controls", function () {
    it("Should pause (owner)", async function () {
      await flashLoanVault.pause();
      expect(await flashLoanVault.paused()).to.be.true;
    });

    it("Should unpause (owner)", async function () {
      await flashLoanVault.pause();
      await flashLoanVault.unpause();
      expect(await flashLoanVault.paused()).to.be.false;
    });

    it("Should reject flash loans when paused", async function () {
      await flashLoanVault.enableFlashLoan(await mockToken.getAddress());
      await flashLoanVault.pause();

      // TODO: Test flash loan rejection when paused
      // Will need mock receiver contract
    });
  });

  describe("Flash Loan Execution", function () {
    // NOTE: Full flash loan execution tests require:
    // 1. Mock flash loan receiver contract
    // 2. Approval setup
    // 3. Balance verification
    // These will be implemented in integration tests

    it("Should reject flash loan for disabled asset", async function () {
      // TODO: Implement with mock receiver
    });

    it("Should reject flash loan exceeding max amount", async function () {
      // TODO: Implement with mock receiver
    });

    it("Should reject flash loan with insufficient liquidity", async function () {
      // TODO: Implement with mock receiver
    });

    it("Should execute successful flash loan", async function () {
      // TODO: Implement with mock receiver that:
      // 1. Receives flash loan
      // 2. Executes arbitrary logic
      // 3. Approves vault to pull repayment
      // 4. Returns true
    });

    it("Should distribute fees correctly", async function () {
      // TODO: Verify:
      // 1. Protocol fee sent to treasury
      // 2. LP fee stays in vault
    });

    it("Should update statistics after flash loan", async function () {
      // TODO: Verify volume and fee tracking
    });

    it("Should record flash loan history", async function () {
      // TODO: Verify history recording
    });

    it("Should emit FlashLoan event", async function () {
      // TODO: Verify event emission with correct parameters
    });
  });

  describe("Flash Loan History", function () {
    it("Should retrieve recent flash loans", async function () {
      // TODO: Execute multiple flash loans and retrieve history
    });

    it("Should limit history retrieval", async function () {
      // TODO: Test count parameter works correctly
    });
  });
});
