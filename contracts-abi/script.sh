#!/bin/bash

# Generate Go bindings for FastSettlement contracts
# Run from the contracts-abi directory

set -e

# Define paths
CONTRACTS_DIR="../contracts"
ABI_DIR="./abi"
GO_CODE_BASE_DIR="./clients"

# Create directories
mkdir -p "$ABI_DIR"
mkdir -p "$GO_CODE_BASE_DIR"

# Compile contracts with forge
echo "Compiling contracts..."
forge compile --root "$CONTRACTS_DIR"

# Function to extract and save the ABI
extract_and_save_abi() {
    local json_file="$1"
    local abi_file="$2"
    echo "Extracting ABI: $json_file -> $abi_file"
    jq .abi "$json_file" > "$abi_file"
}

# Function to generate Go code from ABI
generate_go_code() {
    local abi_file="$1"
    local contract_name="$2"
    local pkg_name="$3"

    local contract_dir="$GO_CODE_BASE_DIR/$contract_name"
    mkdir -p "$contract_dir"

    echo "Generating Go bindings: $contract_name"
    abigen --abi "$abi_file" --pkg "$pkg_name" --out "$contract_dir/$contract_name.go"
}

# Extract ABIs
extract_and_save_abi "$CONTRACTS_DIR/out/FastSettlementV3.sol/FastSettlementV3.json" "$ABI_DIR/FastSettlementV3.abi"
extract_and_save_abi "$CONTRACTS_DIR/out/IFastSettlementV3.sol/IFastSettlementV3.json" "$ABI_DIR/IFastSettlementV3.abi"

echo "ABI files extracted successfully."

# Generate Go bindings
generate_go_code "$ABI_DIR/FastSettlementV3.abi" "FastSettlementV3" "fastsettlementv3"
generate_go_code "$ABI_DIR/IFastSettlementV3.abi" "IFastSettlementV3" "ifastsettlementv3"

echo "Go bindings generated successfully in $GO_CODE_BASE_DIR"
