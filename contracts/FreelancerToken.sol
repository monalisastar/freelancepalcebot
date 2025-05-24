// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FreelancerToken is ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000 * 10**18;

    /// @notice Only this address can mint
    address public escrowService;

    /// @notice Pass deployer into Ownable so they become the owner
    constructor()
        ERC20("Freelancer Palace", "FLR")
        Ownable(msg.sender)
    {
        // nothing minted in constructor
    }

    /// @notice Owner sets the only escrowService allowed to mint
    function setEscrowService(address _escrowService) external onlyOwner {
        escrowService = _escrowService;
    }

    /// @notice Mints up to MAX_SUPPLY, but only called by escrowService
    function mint(address to, uint256 amount) external {
        require(msg.sender == escrowService, "FT: only escrowService");
        require(totalSupply() + amount <= MAX_SUPPLY, "FT: cap exceeded");
        _mint(to, amount);
    }
}


