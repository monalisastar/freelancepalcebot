// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TicketRegistry {
    struct Ticket {
        address client;
        string metadataHash; // MongoDB _id or IPFS hash
        string txHash;       // For linking to escrow/payment
        uint256 createdAt;
    }

    Ticket[] public tickets;

    event TicketLogged(
        uint indexed ticketId,
        address indexed client,
        string metadataHash,
        string txHash,
        uint256 createdAt
    );

    function logTicket(string calldata metadataHash, string calldata txHash) external {
        tickets.push(Ticket({
            client: msg.sender,
            metadataHash: metadataHash,
            txHash: txHash,
            createdAt: block.timestamp
        }));

        emit TicketLogged(tickets.length - 1, msg.sender, metadataHash, txHash, block.timestamp);
    }

    function getTicket(uint ticketId) public view returns (Ticket memory) {
        require(ticketId < tickets.length, "Invalid ticket ID");
        return tickets[ticketId];
    }

    function getTotalTickets() public view returns (uint256) {
        return tickets.length;
    }
}

