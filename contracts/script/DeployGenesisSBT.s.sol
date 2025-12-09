// SPDX-License-Identifier: MIT

// Step 1 - Dry run (simulate without broadcasting):
// forge script script/DeployGenesisSBT.s.sol:DeployScript --rpc-url $RPC_URL -vvvv
//
// Step 2 - Broadcast (actual deployment):
// forge script script/DeployGenesisSBT.s.sol:DeployScript --rpc-url $RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY -vvvv --private-key $PRIVATE_KEY

pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GenesisSBT} from "../src/GenesisSBT.sol";

/// @dev Deploy script for GenesisSBT contract
contract DeployScript is Script {
    struct DeploymentParams {
        uint256 deployerPrivateKey;
        address deployer;
        address initialOwner;
        address treasuryReceiver;
        string assetURI;
        uint256 mintPrice;
        string description;
    }

    struct DeploymentAddresses {
        address implementation;
        address proxy;
        address genesisSBT;
    }

    // =============================================================
    //                          MAIN FUNCTION
    // =============================================================

    /// @dev Main deployment function
    /// @dev Step 1: Run without --broadcast for dry run (simulation)
    /// @dev Step 2: Run with --broadcast to actually deploy
    /// @dev Foundry automatically handles dry run vs broadcast via --broadcast flag
    function run() external {
        DeploymentParams memory params = _loadAndValidateParams();
        _logDeploymentParams(params);

        vm.startBroadcast(params.deployerPrivateKey);

        DeploymentAddresses memory addresses = _deploy(params);
        _postDeploy(addresses, params);

        vm.stopBroadcast();

        _verifyDeployment(addresses);
        _logDeploymentSummary(addresses);
    }

    // =============================================================
    //                      PARAMETER LOADING
    // =============================================================

    /// @dev Loads and validates deployment parameters from environment
    function _loadAndValidateParams() internal view returns (DeploymentParams memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address initialOwner = vm.envOr("INITIAL_OWNER", deployer);
        address treasuryReceiver = vm.envOr("TREASURY_RECEIVER", deployer);
        string memory assetURI = vm.envString("ASSET_URI");
        uint256 mintPrice = vm.envUint("MINT_PRICE");
        string memory description = vm.envString("DESCRIPTION");

        _validateParams(deployer, initialOwner, treasuryReceiver, assetURI, mintPrice, description);

        return DeploymentParams({
            deployerPrivateKey: deployerPrivateKey,
            deployer: deployer,
            initialOwner: initialOwner,
            treasuryReceiver: treasuryReceiver,
            assetURI: assetURI,
            mintPrice: mintPrice,
            description: description
        });
    }

    /// @dev Validates deployment parameters
    function _validateParams(
        address deployer,
        address initialOwner,
        address treasuryReceiver,
        string memory assetURI,
        uint256 mintPrice,
        string memory description
    ) internal pure {
        require(deployer != address(0), "DeployScript: deployer cannot be zero address");
        require(initialOwner != address(0), "DeployScript: initialOwner cannot be zero address");
        require(treasuryReceiver != address(0), "DeployScript: treasuryReceiver cannot be zero address");
        require(bytes(assetURI).length > 0, "DeployScript: assetURI cannot be empty");
        require(mintPrice > 0, "DeployScript: mintPrice must be greater than zero");
        require(bytes(description).length > 0, "DeployScript: description cannot be empty");
    }

    // =============================================================
    //                      DEPLOYMENT FUNCTIONS
    // =============================================================

    /// @dev Deploys implementation and proxy contracts
    /// @dev In dry run mode (without --broadcast), Foundry simulates the deployment
    /// @dev In broadcast mode (with --broadcast), this actually deploys to the network
    function _deploy(DeploymentParams memory params) internal returns (DeploymentAddresses memory) {
        address implementation = _deployImplementation();
        address proxy = _deployProxy(implementation, params);
        address genesisSBT = address(proxy);

        return DeploymentAddresses({
            implementation: implementation,
            proxy: proxy,
            genesisSBT: genesisSBT
        });
    }

    /// @dev Deploys the implementation contract
    function _deployImplementation() internal returns (address) {
        console.log("\n=== Deploying Implementation ===");
        GenesisSBT implementation = new GenesisSBT();
        console.log("Implementation deployed at:", address(implementation));
        require(address(implementation) != address(0), "DeployScript: implementation deployment failed");
        return address(implementation);
    }

    /// @dev Deploys the proxy contract with initialization
    function _deployProxy(address implementation, DeploymentParams memory params) internal returns (address) {
        console.log("\n=== Deploying Proxy ===");
        require(implementation != address(0), "DeployScript: implementation address is zero");

        bytes memory initData = abi.encodeCall(
            GenesisSBT.initialize,
            (params.assetURI, params.initialOwner, params.mintPrice, params.treasuryReceiver)
        );

        require(initData.length > 0, "DeployScript: initData cannot be empty");

        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        address proxyAddress = address(proxy);
        console.log("Proxy deployed at:", proxyAddress);
        require(proxyAddress != address(0), "DeployScript: proxy deployment failed");

        return proxyAddress;
    }

    // =============================================================
    //                      POST-DEPLOYMENT FUNCTIONS
    // =============================================================

    /// @dev Post-deployment configuration steps
    function _postDeploy(DeploymentAddresses memory addresses, DeploymentParams memory params) internal {
        console.log("\n=== Post-Deployment Configuration ===");
        GenesisSBT genesisSBT = GenesisSBT(payable(addresses.genesisSBT));
        
        // Update description via setMetadataProperties
        genesisSBT.setMetadataProperties(genesisSBT.name(), params.description);
        console.log("Description updated successfully");
        console.log("Description:", params.description);
    }

    // =============================================================
    //                      VERIFICATION FUNCTIONS
    // =============================================================

    /// @dev Verifies the deployment was successful
    function _verifyDeployment(DeploymentAddresses memory addresses) internal view {
        console.log("\n=== Verifying Deployment ===");
        GenesisSBT genesisSBT = GenesisSBT(payable(addresses.genesisSBT));

        require(addresses.implementation != address(0), "DeployScript: implementation is zero");
        require(addresses.proxy != address(0), "DeployScript: proxy is zero");
        require(addresses.genesisSBT != address(0), "DeployScript: genesisSBT is zero");
        require(addresses.implementation != addresses.proxy, "DeployScript: implementation and proxy cannot be same");

        // Verify contract is initialized
        require(bytes(genesisSBT.name()).length > 0, "DeployScript: contract not initialized (name is empty)");
        require(bytes(genesisSBT.symbol()).length > 0, "DeployScript: contract not initialized (symbol is empty)");
        require(genesisSBT.owner() != address(0), "DeployScript: contract not initialized (owner is zero)");
        require(genesisSBT._mintPrice() > 0, "DeployScript: contract not initialized (mintPrice is zero)");
        require(genesisSBT._treasuryReceiver() != address(0), "DeployScript: contract not initialized (treasuryReceiver is zero)");

        console.log("Name:", genesisSBT.name());
        console.log("Symbol:", genesisSBT.symbol());
        console.log("Owner:", genesisSBT.owner());
        console.log("Mint Price:", genesisSBT._mintPrice());
        console.log("Treasury Receiver:", genesisSBT._treasuryReceiver());
        console.log("Deployment verified successfully");
    }

    // =============================================================
    //                      LOGGING FUNCTIONS
    // =============================================================

    /// @dev Logs deployment parameters
    function _logDeploymentParams(DeploymentParams memory params) internal pure {
        console.log("\n=== Deployment Parameters ===");
        console.log("Deployer:", params.deployer);
        console.log("Initial Owner:", params.initialOwner);
        console.log("Asset URI:", params.assetURI);
        console.log("Mint Price:", params.mintPrice);
        console.log("Treasury Receiver:", params.treasuryReceiver);
        console.log("Description:", params.description);
    }


    /// @dev Logs deployment summary
    function _logDeploymentSummary(DeploymentAddresses memory addresses) internal pure {
        console.log("\n=== Deployment Summary ===");
        console.log("Implementation:", addresses.implementation);
        console.log("Proxy:", addresses.proxy);
        console.log("GenesisSBT (proxy):", addresses.genesisSBT);
        console.log("\nDeployment completed successfully!");
    }
}
