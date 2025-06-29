// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract SplitBill {
    struct Participant {
        string name;
        address wallet;
        uint256 amountPaid;
        bool paid;
    }

    struct Bill {
        Participant[] participants;
        uint256 timestamp;
        uint256 total;
    }

    Bill[] public bills;
    AggregatorV3Interface public priceFeed;

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function createBill(
        string[] calldata names,
        address[] calldata wallets,
        uint256[] calldata amounts
    ) external {
        require(
            names.length == wallets.length && wallets.length == amounts.length,
            "Mismatched input lengths"
        );
        require(names.length >= 2, "At least 2 participants required");

        Bill storage newBill = bills.push();
        newBill.timestamp = block.timestamp;

        uint256 total;

        for (uint256 i = 0; i < names.length; i++) {
            newBill.participants.push(
                Participant({
                    name: names[i],
                    wallet: wallets[i],
                    amountPaid: amounts[i],
                    paid: false
                })
            );
            total += amounts[i];
        }

        newBill.total = total;
    }

    function getBillCount() external view returns (uint256) {
        return bills.length;
    }

    function getBill(uint256 index)
        external
        view
        returns (
            string[] memory names,
            address[] memory wallets,
            uint256[] memory amounts,
            bool[] memory paid,
            uint256 total,
            uint256 timestamp
        )
    {
        require(index < bills.length, "Invalid bill index");
        Bill storage bill = bills[index];
        uint256 len = bill.participants.length;

        names = new string[](len);
        wallets = new address[](len);
        amounts = new uint256[](len);
        paid = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            Participant storage p = bill.participants[i];
            names[i] = p.name;
            wallets[i] = p.wallet;
            amounts[i] = p.amountPaid;
            paid[i] = p.paid;
        }

        total = bill.total;
        timestamp = bill.timestamp;
    }

    function payShare(uint256 billIndex) external payable {
        Bill storage bill = bills[billIndex];
        bool matched = false;

        for (uint256 i = 0; i < bill.participants.length; i++) {
            Participant storage p = bill.participants[i];
            if (p.wallet == msg.sender) {
                require(!p.paid, "Already paid");
                require(msg.value == p.amountPaid, "Incorrect payment amount");
                p.paid = true;
                matched = true;
                break;
            }
        }

        require(matched, "Not a participant");
    }

    function calculateSettlements(uint256 index)
        external
        view
        returns (
            address[] memory froms,
            address[] memory tos,
            uint256[] memory amounts
        )
    {
        require(index < bills.length, "Invalid bill index");
        Bill storage bill = bills[index];
        uint256 len = bill.participants.length;
        require(len >= 2, "At least 2 participants");

        uint256 total;
        for (uint256 i = 0; i < len; i++) {
            total += bill.participants[i].amountPaid;
        }

        uint256 avg = total / len;
        int256[] memory balances = new int256[](len);

        for (uint256 i = 0; i < len; i++) {
            balances[i] = int256(bill.participants[i].amountPaid) - int256(avg);
        }

        address[] memory tempFrom = new address[](len * len);
        address[] memory tempTo = new address[](len * len);
        uint256[] memory tempAmounts = new uint256[](len * len);
        uint256 count = 0;

        for (uint256 i = 0; i < len; i++) {
            if (balances[i] < 0) {
                for (uint256 j = 0; j < len; j++) {
                    if (balances[j] > 0) {
                        int256 settlement = min(-balances[i], balances[j]);

                        if (settlement > 0) {
                            tempFrom[count] = bill.participants[i].wallet;
                            tempTo[count] = bill.participants[j].wallet;
                            tempAmounts[count] = uint256(settlement);

                            balances[i] += settlement;
                            balances[j] -= settlement;
                            count++;
                        }

                        if (balances[i] == 0) break;
                    }
                }
            }
        }

        froms = new address[](count);
        tos = new address[](count);
        amounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            froms[i] = tempFrom[i];
            tos[i] = tempTo[i];
            amounts[i] = tempAmounts[i];
        }
    }

    function getLatestETHUSD() external view returns (int256) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        return price;
    }

    function min(int256 a, int256 b) internal pure returns (int256) {
        return a < b ? a : b;
    }
}
