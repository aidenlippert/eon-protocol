import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { CreditRegistryV1_1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CreditRegistryV1_1", function () {
  let creditRegistry: CreditRegistryV1_1;
  let owner: SignerWithAddress;
  let attester: SignerWithAddress;
  let challenger: SignerWithAddress;
  let user: SignerWithAddress;
  let treasury: SignerWithAddress;

  const CHALLENGE_PERIOD = 3600; // 1 hour
  const CHALLENGE_BOND = ethers.parseUnits("500", 6); // 500 USDC (6 decimals)

  beforeEach(async function () {
    [owner, attester, challenger, user, treasury] = await ethers.getSigners();

    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistryV1_1");
    creditRegistry = await CreditRegistryFactory.deploy(treasury.address);
    await creditRegistry.waitForDeployment();

    // Authorize attester
    await creditRegistry.setAuthorizedAttester(attester.address, true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await creditRegistry.owner()).to.equal(owner.address);
    });

    it("Should set the treasury address", async function () {
      expect(await creditRegistry.treasury()).to.equal(treasury.address);
    });

    it("Should authorize deployer as attester", async function () {
      expect(await creditRegistry.authorizedAttesters(owner.address)).to.be.true;
    });

    it("Should set correct challenge period", async function () {
      expect(await creditRegistry.challengePeriod()).to.equal(CHALLENGE_PERIOD);
    });

    it("Should set correct challenge bond", async function () {
      expect(await creditRegistry.challengeBond()).to.equal(CHALLENGE_BOND);
    });
  });

  describe("Score Attestation", function () {
    const score = 785; // Very Good
    const tier = 3; // Very Good
    const ltv = 75; // 75%
    const interestMultiplier = 90; // 0.9x
    const dataQuality = 2; // High
    const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));

    it("Should allow authorized attester to attest score", async function () {
      await expect(
        creditRegistry.connect(attester).attestScore(
          user.address,
          score,
          tier,
          ltv,
          interestMultiplier,
          dataQuality,
          merkleRoot
        )
      ).to.emit(creditRegistry, "ScoreAttested");
    });

    it("Should reject attestation from unauthorized attester", async function () {
      await expect(
        creditRegistry.connect(user).attestScore(
          user.address,
          score,
          tier,
          ltv,
          interestMultiplier,
          dataQuality,
          merkleRoot
        )
      ).to.be.revertedWithCustomError(creditRegistry, "UnauthorizedAttester");
    });

    it("Should reject invalid score (< 300)", async function () {
      await expect(
        creditRegistry.connect(attester).attestScore(
          user.address,
          299, // Too low
          tier,
          ltv,
          interestMultiplier,
          dataQuality,
          merkleRoot
        )
      ).to.be.revertedWithCustomError(creditRegistry, "InvalidScore");
    });

    it("Should reject invalid score (> 850)", async function () {
      await expect(
        creditRegistry.connect(attester).attestScore(
          user.address,
          851, // Too high
          tier,
          ltv,
          interestMultiplier,
          dataQuality,
          merkleRoot
        )
      ).to.be.revertedWithCustomError(creditRegistry, "InvalidScore");
    });

    it("Should reject invalid tier (> 4)", async function () {
      await expect(
        creditRegistry.connect(attester).attestScore(
          user.address,
          score,
          5, // Invalid tier
          ltv,
          interestMultiplier,
          dataQuality,
          merkleRoot
        )
      ).to.be.revertedWithCustomError(creditRegistry, "InvalidTier");
    });

    it("Should reject invalid LTV (> 90)", async function () {
      await expect(
        creditRegistry.connect(attester).attestScore(
          user.address,
          score,
          tier,
          91, // Too high
          interestMultiplier,
          dataQuality,
          merkleRoot
        )
      ).to.be.revertedWithCustomError(creditRegistry, "InvalidLTV");
    });

    it("Should store pending attestation correctly", async function () {
      await creditRegistry.connect(attester).attestScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality,
        merkleRoot
      );

      const attestation = await creditRegistry.pendingAttestations(user.address);
      expect(attestation.attester).to.equal(attester.address);
      expect(attestation.merkleRoot).to.equal(merkleRoot);
      expect(attestation.challenged).to.be.false;
      expect(attestation.finalized).to.be.false;
    });

    it("Should reject attestation if one is already pending", async function () {
      // First attestation
      await creditRegistry.connect(attester).attestScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality,
        merkleRoot
      );

      // Second attestation should fail
      await expect(
        creditRegistry.connect(attester).attestScore(
          user.address,
          score,
          tier,
          ltv,
          interestMultiplier,
          dataQuality,
          merkleRoot
        )
      ).to.be.revertedWithCustomError(creditRegistry, "AttestationPending");
    });
  });

  describe("Score Finalization", function () {
    const score = 785;
    const tier = 3;
    const ltv = 75;
    const interestMultiplier = 90;
    const dataQuality = 2;
    const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));

    beforeEach(async function () {
      await creditRegistry.connect(attester).attestScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality,
        merkleRoot
      );
    });

    it("Should finalize score after challenge period", async function () {
      // Advance time past challenge period
      await time.increase(CHALLENGE_PERIOD + 1);

      await expect(
        creditRegistry.finalizeScore(
          user.address,
          score,
          tier,
          ltv,
          interestMultiplier,
          dataQuality
        )
      ).to.emit(creditRegistry, "ScoreFinalized");
    });

    it("Should reject finalization before challenge period", async function () {
      await expect(
        creditRegistry.finalizeScore(
          user.address,
          score,
          tier,
          ltv,
          interestMultiplier,
          dataQuality
        )
      ).to.be.revertedWithCustomError(creditRegistry, "ChallengePeriodNotExpired");
    });

    it("Should store finalized score correctly", async function () {
      await time.increase(CHALLENGE_PERIOD + 1);

      await creditRegistry.finalizeScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality
      );

      const storedScore = await creditRegistry.scores(user.address);
      expect(storedScore.score).to.equal(score);
      expect(storedScore.tier).to.equal(tier);
      expect(storedScore.ltv).to.equal(ltv);
      expect(storedScore.interestRateMultiplier).to.equal(interestMultiplier);
      expect(storedScore.dataQuality).to.equal(dataQuality);
    });

    it("Should reject finalization with wrong score hash", async function () {
      await time.increase(CHALLENGE_PERIOD + 1);

      await expect(
        creditRegistry.finalizeScore(
          user.address,
          800, // Wrong score
          tier,
          ltv,
          interestMultiplier,
          dataQuality
        )
      ).to.be.revertedWith("Score hash mismatch");
    });
  });

  describe("Challenge Mechanism", function () {
    const score = 785;
    const tier = 3;
    const ltv = 75;
    const interestMultiplier = 90;
    const dataQuality = 2;
    const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));

    beforeEach(async function () {
      await creditRegistry.connect(attester).attestScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality,
        merkleRoot
      );
    });

    it("Should allow challenge with sufficient bond", async function () {
      await expect(
        creditRegistry.connect(challenger).challengeScore(
          user.address,
          1, // Reason code
          { value: CHALLENGE_BOND }
        )
      ).to.emit(creditRegistry, "ScoreChallenged");
    });

    it("Should reject challenge with insufficient bond", async function () {
      await expect(
        creditRegistry.connect(challenger).challengeScore(
          user.address,
          1,
          { value: CHALLENGE_BOND / 2n }
        )
      ).to.be.revertedWithCustomError(creditRegistry, "InsufficientBond");
    });

    it("Should reject challenge after challenge period", async function () {
      await time.increase(CHALLENGE_PERIOD + 1);

      await expect(
        creditRegistry.connect(challenger).challengeScore(
          user.address,
          1,
          { value: CHALLENGE_BOND }
        )
      ).to.be.revertedWithCustomError(creditRegistry, "ChallengePeriodNotExpired");
    });

    it("Should reject duplicate challenge", async function () {
      await creditRegistry.connect(challenger).challengeScore(
        user.address,
        1,
        { value: CHALLENGE_BOND }
      );

      await expect(
        creditRegistry.connect(challenger).challengeScore(
          user.address,
          1,
          { value: CHALLENGE_BOND }
        )
      ).to.be.revertedWithCustomError(creditRegistry, "AlreadyChallenged");
    });

    it("Should store challenge correctly", async function () {
      await creditRegistry.connect(challenger).challengeScore(
        user.address,
        1,
        { value: CHALLENGE_BOND }
      );

      const challenge = await creditRegistry.challenges(user.address);
      expect(challenge.challenger).to.equal(challenger.address);
      expect(challenge.bond).to.equal(CHALLENGE_BOND);
      expect(challenge.reason).to.equal(1);
      expect(challenge.resolved).to.be.false;
    });

    it("Should mark attestation as challenged", async function () {
      await creditRegistry.connect(challenger).challengeScore(
        user.address,
        1,
        { value: CHALLENGE_BOND }
      );

      const attestation = await creditRegistry.pendingAttestations(user.address);
      expect(attestation.challenged).to.be.true;
    });
  });

  describe("View Functions", function () {
    const score = 785;
    const tier = 3;
    const ltv = 75;
    const interestMultiplier = 90;
    const dataQuality = 2;
    const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));

    it("Should return score for user", async function () {
      // Attest and finalize
      await creditRegistry.connect(attester).attestScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality,
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);

      await creditRegistry.finalizeScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality
      );

      const storedScore = await creditRegistry.getScore(user.address);
      expect(storedScore.score).to.equal(score);
      expect(storedScore.tier).to.equal(tier);
    });

    it("Should check if score is valid and recent", async function () {
      // Attest and finalize
      await creditRegistry.connect(attester).attestScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality,
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);

      await creditRegistry.finalizeScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality
      );

      // Check with 30 days max age
      const maxAge = 30 * 24 * 60 * 60;
      expect(await creditRegistry.hasValidScore(user.address, maxAge)).to.be.true;
    });

    it("Should return false for expired score", async function () {
      // Attest and finalize
      await creditRegistry.connect(attester).attestScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality,
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);

      await creditRegistry.finalizeScore(
        user.address,
        score,
        tier,
        ltv,
        interestMultiplier,
        dataQuality
      );

      // Advance time 31 days
      await time.increase(31 * 24 * 60 * 60);

      // Check with 30 days max age
      const maxAge = 30 * 24 * 60 * 60;
      expect(await creditRegistry.hasValidScore(user.address, maxAge)).to.be.false;
    });

    it("Should return false for user with no score", async function () {
      const maxAge = 30 * 24 * 60 * 60;
      expect(await creditRegistry.hasValidScore(user.address, maxAge)).to.be.false;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to authorize attester", async function () {
      const newAttester = challenger.address;

      await expect(
        creditRegistry.setAuthorizedAttester(newAttester, true)
      ).to.emit(creditRegistry, "AttesterAuthorized")
        .withArgs(newAttester, true);

      expect(await creditRegistry.authorizedAttesters(newAttester)).to.be.true;
    });

    it("Should allow owner to deauthorize attester", async function () {
      await creditRegistry.setAuthorizedAttester(attester.address, false);
      expect(await creditRegistry.authorizedAttesters(attester.address)).to.be.false;
    });

    it("Should reject non-owner authorization", async function () {
      await expect(
        creditRegistry.connect(user).setAuthorizedAttester(challenger.address, true)
      ).to.be.revertedWithCustomError(creditRegistry, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update challenge period", async function () {
      const newPeriod = 7200; // 2 hours

      await expect(
        creditRegistry.setChallengePeriod(newPeriod)
      ).to.emit(creditRegistry, "ChallengePeriodUpdated")
        .withArgs(newPeriod);

      expect(await creditRegistry.challengePeriod()).to.equal(newPeriod);
    });

    it("Should reject invalid challenge period (too short)", async function () {
      await expect(
        creditRegistry.setChallengePeriod(5 * 60) // 5 minutes
      ).to.be.revertedWith("Invalid period");
    });

    it("Should reject invalid challenge period (too long)", async function () {
      await expect(
        creditRegistry.setChallengePeriod(25 * 60 * 60) // 25 hours
      ).to.be.revertedWith("Invalid period");
    });

    it("Should allow owner to update challenge bond", async function () {
      const newBond = ethers.parseUnits("1000", 6); // 1000 USDC

      await expect(
        creditRegistry.setChallengeBond(newBond)
      ).to.emit(creditRegistry, "ChallengeBondUpdated")
        .withArgs(newBond);

      expect(await creditRegistry.challengeBond()).to.equal(newBond);
    });

    it("Should reject invalid challenge bond (too low)", async function () {
      await expect(
        creditRegistry.setChallengeBond(ethers.parseUnits("50", 6))
      ).to.be.revertedWith("Invalid bond");
    });

    it("Should reject invalid challenge bond (too high)", async function () {
      await expect(
        creditRegistry.setChallengeBond(ethers.parseUnits("11000", 6))
      ).to.be.revertedWith("Invalid bond");
    });

    it("Should allow owner to update treasury", async function () {
      const newTreasury = challenger.address;
      await creditRegistry.setTreasury(newTreasury);
      expect(await creditRegistry.treasury()).to.equal(newTreasury);
    });

    it("Should reject invalid treasury address", async function () {
      await expect(
        creditRegistry.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple users independently", async function () {
      const user2 = challenger;
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));

      // Attest for user1
      await creditRegistry.connect(attester).attestScore(
        user.address,
        785,
        3,
        75,
        90,
        2,
        merkleRoot
      );

      // Attest for user2
      await creditRegistry.connect(attester).attestScore(
        user2.address,
        650,
        2,
        65,
        100,
        1,
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);

      // Finalize both
      await creditRegistry.finalizeScore(user.address, 785, 3, 75, 90, 2);
      await creditRegistry.finalizeScore(user2.address, 650, 2, 65, 100, 1);

      const score1 = await creditRegistry.getScore(user.address);
      const score2 = await creditRegistry.getScore(user2.address);

      expect(score1.score).to.equal(785);
      expect(score2.score).to.equal(650);
    });

    it("Should handle score updates after finalization", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));

      // First score
      await creditRegistry.connect(attester).attestScore(
        user.address,
        650,
        2,
        65,
        100,
        1,
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);
      await creditRegistry.finalizeScore(user.address, 650, 2, 65, 100, 1);

      // Update score
      await creditRegistry.connect(attester).attestScore(
        user.address,
        785,
        3,
        75,
        90,
        2,
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);
      await creditRegistry.finalizeScore(user.address, 785, 3, 75, 90, 2);

      const finalScore = await creditRegistry.getScore(user.address);
      expect(finalScore.score).to.equal(785);
    });
  });

  describe("Score Tier Examples", function () {
    const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));

    it("Should handle Exceptional tier (Platinum)", async function () {
      await creditRegistry.connect(attester).attestScore(
        user.address,
        820, // Exceptional
        4,   // Tier 4
        90,  // 90% LTV
        80,  // 0.8x rate
        2,   // High quality
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);
      await creditRegistry.finalizeScore(user.address, 820, 4, 90, 80, 2);

      const score = await creditRegistry.getScore(user.address);
      expect(score.tier).to.equal(4);
      expect(score.ltv).to.equal(90);
    });

    it("Should handle Subprime tier", async function () {
      await creditRegistry.connect(attester).attestScore(
        user.address,
        450, // Subprime
        0,   // Tier 0
        0,   // 0% LTV (not allowed to borrow)
        150, // 1.5x rate
        0,   // Low quality
        merkleRoot
      );

      await time.increase(CHALLENGE_PERIOD + 1);
      await creditRegistry.finalizeScore(user.address, 450, 0, 0, 150, 0);

      const score = await creditRegistry.getScore(user.address);
      expect(score.tier).to.equal(0);
      expect(score.ltv).to.equal(0);
      expect(score.interestRateMultiplier).to.equal(150);
    });
  });
});
