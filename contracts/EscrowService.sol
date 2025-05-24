// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// 🆕 Reward token interface
interface IFreelancerToken {
    function mint(address to, uint256 amount) external;
}

contract EscrowService {
    enum EscrowStatus { Created, Accepted, Completed, Released, Disputed, Cancelled }

    struct Escrow {
        address client;
        address freelancer;
        uint256 amount;
        address tokenAddress;
        EscrowStatus status;
    }

    uint256 public escrowCount;
    mapping(uint256 => Escrow) public escrows;

    address public owner;
    uint256 public feePercent = 30;

    // 🆕 Reward token and per-job amount
    IFreelancerToken public rewardToken;
    uint256 public constant REWARD_PER_JOB = 100 * 10**18;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    event EscrowCreated(uint256 escrowId, address client, address freelancer, uint256 amount, address tokenAddress);
    event EscrowAccepted(uint256 escrowId);
    event EscrowCompleted(uint256 escrowId);
    event EscrowReleased(uint256 escrowId);
    event EscrowDisputed(uint256 escrowId);
    event EscrowCancelled(uint256 escrowId);
    event FeePercentUpdated(uint256 newFeePercent);
    // 🆕 Reward event
    event RewardMinted(address indexed freelancer, uint256 amount);

    // Updated constructor to set reward token
    constructor(address _rewardToken) {
        owner = msg.sender;
        rewardToken = IFreelancerToken(_rewardToken);
    }

    function createEscrowNative(address _freelancer) external payable returns (uint256) {
        require(msg.value > 0, "Must send MATIC");

        escrowCount++;
        escrows[escrowCount] = Escrow({
            client: msg.sender,
            freelancer: _freelancer,
            amount: msg.value,
            tokenAddress: address(0),
            status: EscrowStatus.Created
        });

        emit EscrowCreated(escrowCount, msg.sender, _freelancer, msg.value, address(0));
        return escrowCount;
    }

    function createEscrowToken(address _freelancer, address _tokenAddress, uint256 _amount) external returns (uint256) {
        require(_amount > 0, "Amount must be > 0");
        require(_tokenAddress != address(0), "Invalid token");

        escrowCount++;
        escrows[escrowCount] = Escrow({
            client: msg.sender,
            freelancer: _freelancer,
            amount: _amount,
            tokenAddress: _tokenAddress,
            status: EscrowStatus.Created
        });

        require(IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount), "Token transfer failed");
        emit EscrowCreated(escrowCount, msg.sender, _freelancer, _amount, _tokenAddress);
        return escrowCount;
    }

    function acceptEscrow(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.freelancer, "Only assigned freelancer");
        require(escrow.status == EscrowStatus.Created, "Invalid status");

        escrow.status = EscrowStatus.Accepted;
        emit EscrowAccepted(_escrowId);
    }

    function completeWork(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.freelancer, "Only freelancer");
        require(escrow.status == EscrowStatus.Accepted, "Invalid status");

        escrow.status = EscrowStatus.Completed;
        emit EscrowCompleted(_escrowId);
    }

    function releaseFunds(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.client, "Only client can release");
        require(escrow.status == EscrowStatus.Completed, "Work must be completed");

        escrow.status = EscrowStatus.Released;

        uint256 feeAmount = (escrow.amount * feePercent) / 100;
        uint256 payoutAmount = escrow.amount - feeAmount;

        if (escrow.tokenAddress == address(0)) {
            payable(owner).transfer(feeAmount);
            payable(escrow.freelancer).transfer(payoutAmount);
        } else {
            require(IERC20(escrow.tokenAddress).transfer(owner, feeAmount), "Fee transfer failed");
            require(IERC20(escrow.tokenAddress).transfer(escrow.freelancer, payoutAmount), "Payout transfer failed");
        }

        // 🆕 Mint reward tokens directly from escrow
        rewardToken.mint(escrow.freelancer, REWARD_PER_JOB);
        emit RewardMinted(escrow.freelancer, REWARD_PER_JOB);

        emit EscrowReleased(_escrowId);
    }

    function disputeEscrow(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.client || msg.sender == escrow.freelancer, "Only client or freelancer");
        require(escrow.status == EscrowStatus.Accepted || escrow.status == EscrowStatus.Completed, "Invalid status to dispute");

        escrow.status = EscrowStatus.Disputed;
        emit EscrowDisputed(_escrowId);
    }

    function emergencyWithdraw(uint256 _escrowId) external onlyOwner {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.status == EscrowStatus.Disputed, "Only disputed escrow");

        escrow.status = EscrowStatus.Cancelled;

        if (escrow.tokenAddress == address(0)) {
            payable(owner).transfer(escrow.amount);
        } else {
            require(IERC20(escrow.tokenAddress).transfer(owner, escrow.amount), "Withdraw failed");
        }

        emit EscrowCancelled(_escrowId);
    }

    function updateFeePercent(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 50, "Fee cannot be more than 50%");
        feePercent = _newFeePercent;
        emit FeePercentUpdated(_newFeePercent);
    }

    function getEscrow(uint256 _escrowId) external view returns (Escrow memory) {
        return escrows[_escrowId];
    }
}

