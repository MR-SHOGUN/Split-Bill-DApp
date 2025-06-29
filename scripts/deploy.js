const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  // Chainlink ETH/USD price feed address (Hardhat local mock, replace for other networks)
  const chainlinkFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // Hardhat ETH/USD mock

  const SplitBill = await hre.ethers.getContractFactory("SplitBill");
  const contract = await SplitBill.deploy(chainlinkFeedAddress);

  await contract.waitForDeployment();

  console.log("SplitBill contract deployed to:", contract.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
