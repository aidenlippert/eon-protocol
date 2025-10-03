// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockLendingPool
 * @notice Mock lending pool for testing purposes
 */
contract MockLendingPool {
    struct Loan {
        address borrower;
        uint256 collateralAmount;
        uint256 borrowedAmount;
        uint256 interestRate;
        uint256 startTime;
        uint256 duration;
        bool isActive;
    }

    mapping(uint256 => Loan) public loans;

    function setLoan(
        uint256 loanId,
        address borrower,
        uint256 collateralAmount,
        uint256 borrowedAmount,
        bool isActive
    ) external {
        loans[loanId] = Loan({
            borrower: borrower,
            collateralAmount: collateralAmount,
            borrowedAmount: borrowedAmount,
            interestRate: 0,
            startTime: block.timestamp,
            duration: 365 days,
            isActive: isActive
        });
    }

    function getLoan(uint256 loanId)
        external
        view
        returns (
            address borrower,
            uint256 collateralAmount,
            uint256 borrowedAmount,
            uint256 interestRate,
            uint256 startTime,
            uint256 duration,
            bool isActive
        )
    {
        Loan memory loan = loans[loanId];
        return (
            loan.borrower,
            loan.collateralAmount,
            loan.borrowedAmount,
            loan.interestRate,
            loan.startTime,
            loan.duration,
            loan.isActive
        );
    }

    function liquidateLoan(uint256 loanId, address liquidator) external {
        loans[loanId].isActive = false;
    }
}
