// Deployment using trezor
//
// - DRY RUN:
// forge script script/DeployFastSettlementV3.s.sol:DeployFastSettlementV3 \
//   --rpc-url $RPC_URL \
//   --sender <TREZOR_ADDRESS> \
//   -vvvv
//
// - EXECUTE DEPLOYMENT:
// forge script script/DeployFastSettlementV3.s.sol:DeployFastSettlementV3 \
//   --rpc-url $RPC_URL \
//   --broadcast \
//   --verify \
//   --etherscan-api-key $ETHERSCAN_API_KEY \
//   --trezor \
//   --sender <TREZOR_ADDRESS> \
//   -vvvv

pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {FastSettlementV3} from "../src/FastSettlementV3.sol";

/// @dev Deploy script for FastSettlementV3 contract
contract DeployFastSettlementV3 is Script {
    struct DeploymentParams {
        address owner;
        address executor;
        address treasury;
        address permit2;
        address weth;
        address[] initialSwapTargets;
    }

    struct DeploymentAddresses {
        address implementation;
        address proxy;
        address fastSettlement;
    }

    // =============================================================
    //                          CONFIGURATION
    // =============================================================

    // Ethereum Mainnet addresses
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant PRIMEV_TEAM_MULTISIG = 0x9101eda106A443A0fA82375936D0D1680D5a64F5;
    address constant TREASURY = 0xfA0B0f5d298d28EFE4d35641724141ef19C05684;
    address constant EXECUTOR = 0x959DAD78D5B68986A43cd270134A2704A990AA68;

    // =============================================================
    //                          MAIN FUNCTION
    // =============================================================

    /// @dev Main deployment function
    /// @dev Signer is determined by CLI flags: --trezor, --ledger, or --private-key
    function run() external {
        DeploymentParams memory params = _loadAndValidateParams();
        _logDeploymentParams(params);

        // vm.startBroadcast() uses the signer from CLI flags
        vm.startBroadcast();

        DeploymentAddresses memory addresses = _deploy(params);

        vm.stopBroadcast();

        _verifyDeployment(addresses, params);
        _logDeploymentSummary(addresses);
    }

    /// @dev Loads and validates deployment parameters from constants
    function _loadAndValidateParams() internal pure returns (DeploymentParams memory) {
        // Barter swap router - whitelisted at deployment
        address[] memory initialSwapTargets = new address[](1);
        initialSwapTargets[0] = 0x179dC3fb0F2230094894317f307241A52CdB38Aa;

        _validateParams(PRIMEV_TEAM_MULTISIG, EXECUTOR, TREASURY, PERMIT2, WETH);

        return
            DeploymentParams({
                owner: PRIMEV_TEAM_MULTISIG,
                executor: EXECUTOR,
                treasury: TREASURY,
                permit2: PERMIT2,
                weth: WETH,
                initialSwapTargets: initialSwapTargets
            });
    }

    /// @dev Validates deployment parameters
    function _validateParams(
        address owner,
        address executor,
        address treasury,
        address permit2,
        address weth
    ) internal pure {
        require(owner != address(0), "DeployScript: owner cannot be zero address");
        require(
            executor != address(0),
            "DeployScript: executor cannot be zero address - UPDATE EXECUTOR CONSTANT"
        );
        require(treasury != address(0), "DeployScript: treasury cannot be zero address");
        require(permit2 != address(0), "DeployScript: permit2 cannot be zero address");
        require(weth != address(0), "DeployScript: weth cannot be zero address");
    }

    /// @dev Deploys implementation and proxy contracts
    /// @dev In dry run mode (without --broadcast), Foundry simulates the deployment
    /// @dev In broadcast mode (with --broadcast), this actually deploys to the network
    function _deploy(DeploymentParams memory params) internal returns (DeploymentAddresses memory) {
        address implementation = _deployImplementation(params);
        address proxy = _deployProxy(implementation, params);
        address fastSettlement = address(proxy);

        return
            DeploymentAddresses({
                implementation: implementation,
                proxy: proxy,
                fastSettlement: fastSettlement
            });
    }

    /// @dev Deploys the implementation contract (with immutables set in constructor)
    function _deployImplementation(DeploymentParams memory params) internal returns (address) {
        console.log("\n=== Deploying Implementation ===");
        FastSettlementV3 implementation = new FastSettlementV3(params.permit2, params.weth);
        console.log("Implementation deployed at:", address(implementation));
        require(
            address(implementation) != address(0),
            "DeployScript: implementation deployment failed"
        );
        return address(implementation);
    }

    /// @dev Deploys the proxy contract with initialization
    function _deployProxy(
        address implementation,
        DeploymentParams memory params
    ) internal returns (address) {
        console.log("\n=== Deploying Proxy ===");
        require(implementation != address(0), "DeployScript: implementation address is zero");

        bytes memory initData = abi.encodeCall(
            FastSettlementV3.initialize,
            (params.owner, params.executor, params.treasury, params.initialSwapTargets)
        );

        require(initData.length > 0, "DeployScript: initData cannot be empty");

        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        address proxyAddress = address(proxy);
        console.log("Proxy deployed at:", proxyAddress);
        require(proxyAddress != address(0), "DeployScript: proxy deployment failed");

        return proxyAddress;
    }

    /// @dev Verifies the deployment was successful
    function _verifyDeployment(
        DeploymentAddresses memory addresses,
        DeploymentParams memory params
    ) internal view {
        console.log("\n=== Verifying Deployment ===");
        FastSettlementV3 settlement = FastSettlementV3(payable(addresses.fastSettlement));

        require(addresses.implementation != address(0), "DeployScript: implementation is zero");
        require(addresses.proxy != address(0), "DeployScript: proxy is zero");
        require(addresses.fastSettlement != address(0), "DeployScript: fastSettlement is zero");
        require(
            addresses.implementation != addresses.proxy,
            "DeployScript: implementation and proxy cannot be same"
        );

        // Verify immutables
        require(address(settlement.PERMIT2()) == params.permit2, "DeployScript: PERMIT2 mismatch");
        require(address(settlement.WETH()) == params.weth, "DeployScript: WETH mismatch");

        // Verify initialization
        require(settlement.executor() == params.executor, "DeployScript: executor mismatch");
        require(settlement.treasury() == params.treasury, "DeployScript: treasury mismatch");

        console.log("PERMIT2:", address(settlement.PERMIT2()));
        console.log("WETH:", address(settlement.WETH()));
        console.log("Executor:", settlement.executor());
        console.log("Treasury:", settlement.treasury());
        console.log("Owner:", settlement.owner());
        console.log("Pending Owner:", settlement.pendingOwner());
        console.log("Deployment verified successfully");
    }

    // =============================================================
    //                      LOGGING FUNCTIONS
    // =============================================================

    /// @dev Logs deployment parameters
    function _logDeploymentParams(DeploymentParams memory params) internal pure {
        console.log("\n=== Deployment Parameters ===");
        console.log("Owner:", params.owner);
        console.log("Executor:", params.executor);
        console.log("Treasury:", params.treasury);
        console.log("Permit2:", params.permit2);
        console.log("WETH:", params.weth);
        console.log("Initial Swap Targets:", params.initialSwapTargets.length);
    }

    /// @dev Logs deployment summary
    function _logDeploymentSummary(DeploymentAddresses memory addresses) internal pure {
        console.log("\n=== Deployment Summary ===");
        console.log("Implementation:", addresses.implementation);
        console.log("Proxy:", addresses.proxy);
        console.log("FastSettlementV3 (proxy):", addresses.fastSettlement);
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Configure swap targets via setSwapTargets()");
        console.log("2. Verify contract on Etherscan (if not auto-verified)");
        console.log("\nDeployment completed successfully!");
    }
}
