// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package ifastsettlementv3

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// IFastSettlementV3Intent is an auto generated low-level Go binding around an user-defined struct.
type IFastSettlementV3Intent struct {
	User        common.Address
	InputToken  common.Address
	OutputToken common.Address
	InputAmt    *big.Int
	UserAmtOut  *big.Int
	Recipient   common.Address
	Deadline    *big.Int
	Nonce       *big.Int
}

// IFastSettlementV3SwapCall is an auto generated low-level Go binding around an user-defined struct.
type IFastSettlementV3SwapCall struct {
	To    common.Address
	Value *big.Int
	Data  []byte
}

// Ifastsettlementv3MetaData contains all meta data concerning the Ifastsettlementv3 contract.
var Ifastsettlementv3MetaData = &bind.MetaData{
	ABI: "[{\"type\":\"function\",\"name\":\"executeWithETH\",\"inputs\":[{\"name\":\"intent\",\"type\":\"tuple\",\"internalType\":\"structIFastSettlementV3.Intent\",\"components\":[{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"inputToken\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"outputToken\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"inputAmt\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"userAmtOut\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"recipient\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"nonce\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"name\":\"swapData\",\"type\":\"tuple\",\"internalType\":\"structIFastSettlementV3.SwapCall\",\"components\":[{\"name\":\"to\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"data\",\"type\":\"bytes\",\"internalType\":\"bytes\"}]}],\"outputs\":[{\"name\":\"received\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"surplus\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"payable\"},{\"type\":\"function\",\"name\":\"executeWithPermit\",\"inputs\":[{\"name\":\"intent\",\"type\":\"tuple\",\"internalType\":\"structIFastSettlementV3.Intent\",\"components\":[{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"inputToken\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"outputToken\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"inputAmt\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"userAmtOut\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"recipient\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"nonce\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"},{\"name\":\"swapData\",\"type\":\"tuple\",\"internalType\":\"structIFastSettlementV3.SwapCall\",\"components\":[{\"name\":\"to\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"data\",\"type\":\"bytes\",\"internalType\":\"bytes\"}]}],\"outputs\":[{\"name\":\"received\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"surplus\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"rescueTokens\",\"inputs\":[{\"name\":\"token\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setExecutor\",\"inputs\":[{\"name\":\"_newExecutor\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setSwapTargets\",\"inputs\":[{\"name\":\"targets\",\"type\":\"address[]\",\"internalType\":\"address[]\"},{\"name\":\"allowed\",\"type\":\"bool[]\",\"internalType\":\"bool[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setTreasury\",\"inputs\":[{\"name\":\"_newTreasury\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"event\",\"name\":\"ExecutorUpdated\",\"inputs\":[{\"name\":\"oldExecutor\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"newExecutor\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"IntentExecuted\",\"inputs\":[{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"inputToken\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"outputToken\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"inputAmt\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"userAmtOut\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"received\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"surplus\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SwapTargetsUpdated\",\"inputs\":[{\"name\":\"targets\",\"type\":\"address[]\",\"indexed\":false,\"internalType\":\"address[]\"},{\"name\":\"allowed\",\"type\":\"bool[]\",\"indexed\":false,\"internalType\":\"bool[]\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"TreasuryUpdated\",\"inputs\":[{\"name\":\"oldTreasury\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"newTreasury\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"error\",\"name\":\"ArrayLengthMismatch\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadCallTarget\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadExecutor\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadInputAmt\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadInputToken\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadNonce\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadOwner\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadRecipient\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadTreasury\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BadUserAmtOut\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ExpectedETHInput\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InsufficientOut\",\"inputs\":[{\"name\":\"received\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"userAmtOut\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"IntentExpired\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidETHAmount\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidPermit2\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidWETH\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"UnauthorizedCaller\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"UnauthorizedExecutor\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"UnauthorizedSwapTarget\",\"inputs\":[]}]",
}

// Ifastsettlementv3ABI is the input ABI used to generate the binding from.
// Deprecated: Use Ifastsettlementv3MetaData.ABI instead.
var Ifastsettlementv3ABI = Ifastsettlementv3MetaData.ABI

// Ifastsettlementv3 is an auto generated Go binding around an Ethereum contract.
type Ifastsettlementv3 struct {
	Ifastsettlementv3Caller     // Read-only binding to the contract
	Ifastsettlementv3Transactor // Write-only binding to the contract
	Ifastsettlementv3Filterer   // Log filterer for contract events
}

// Ifastsettlementv3Caller is an auto generated read-only Go binding around an Ethereum contract.
type Ifastsettlementv3Caller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// Ifastsettlementv3Transactor is an auto generated write-only Go binding around an Ethereum contract.
type Ifastsettlementv3Transactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// Ifastsettlementv3Filterer is an auto generated log filtering Go binding around an Ethereum contract events.
type Ifastsettlementv3Filterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// Ifastsettlementv3Session is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type Ifastsettlementv3Session struct {
	Contract     *Ifastsettlementv3 // Generic contract binding to set the session for
	CallOpts     bind.CallOpts      // Call options to use throughout this session
	TransactOpts bind.TransactOpts  // Transaction auth options to use throughout this session
}

// Ifastsettlementv3CallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type Ifastsettlementv3CallerSession struct {
	Contract *Ifastsettlementv3Caller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts            // Call options to use throughout this session
}

// Ifastsettlementv3TransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type Ifastsettlementv3TransactorSession struct {
	Contract     *Ifastsettlementv3Transactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts            // Transaction auth options to use throughout this session
}

// Ifastsettlementv3Raw is an auto generated low-level Go binding around an Ethereum contract.
type Ifastsettlementv3Raw struct {
	Contract *Ifastsettlementv3 // Generic contract binding to access the raw methods on
}

// Ifastsettlementv3CallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type Ifastsettlementv3CallerRaw struct {
	Contract *Ifastsettlementv3Caller // Generic read-only contract binding to access the raw methods on
}

// Ifastsettlementv3TransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type Ifastsettlementv3TransactorRaw struct {
	Contract *Ifastsettlementv3Transactor // Generic write-only contract binding to access the raw methods on
}

// NewIfastsettlementv3 creates a new instance of Ifastsettlementv3, bound to a specific deployed contract.
func NewIfastsettlementv3(address common.Address, backend bind.ContractBackend) (*Ifastsettlementv3, error) {
	contract, err := bindIfastsettlementv3(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3{Ifastsettlementv3Caller: Ifastsettlementv3Caller{contract: contract}, Ifastsettlementv3Transactor: Ifastsettlementv3Transactor{contract: contract}, Ifastsettlementv3Filterer: Ifastsettlementv3Filterer{contract: contract}}, nil
}

// NewIfastsettlementv3Caller creates a new read-only instance of Ifastsettlementv3, bound to a specific deployed contract.
func NewIfastsettlementv3Caller(address common.Address, caller bind.ContractCaller) (*Ifastsettlementv3Caller, error) {
	contract, err := bindIfastsettlementv3(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3Caller{contract: contract}, nil
}

// NewIfastsettlementv3Transactor creates a new write-only instance of Ifastsettlementv3, bound to a specific deployed contract.
func NewIfastsettlementv3Transactor(address common.Address, transactor bind.ContractTransactor) (*Ifastsettlementv3Transactor, error) {
	contract, err := bindIfastsettlementv3(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3Transactor{contract: contract}, nil
}

// NewIfastsettlementv3Filterer creates a new log filterer instance of Ifastsettlementv3, bound to a specific deployed contract.
func NewIfastsettlementv3Filterer(address common.Address, filterer bind.ContractFilterer) (*Ifastsettlementv3Filterer, error) {
	contract, err := bindIfastsettlementv3(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3Filterer{contract: contract}, nil
}

// bindIfastsettlementv3 binds a generic wrapper to an already deployed contract.
func bindIfastsettlementv3(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := Ifastsettlementv3MetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Ifastsettlementv3 *Ifastsettlementv3Raw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Ifastsettlementv3.Contract.Ifastsettlementv3Caller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Ifastsettlementv3 *Ifastsettlementv3Raw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.Ifastsettlementv3Transactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Ifastsettlementv3 *Ifastsettlementv3Raw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.Ifastsettlementv3Transactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Ifastsettlementv3 *Ifastsettlementv3CallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Ifastsettlementv3.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.contract.Transact(opts, method, params...)
}

// ExecuteWithETH is a paid mutator transaction binding the contract method 0x1fb7a307.
//
// Solidity: function executeWithETH((address,address,address,uint256,uint256,address,uint256,uint256) intent, (address,uint256,bytes) swapData) payable returns(uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3Transactor) ExecuteWithETH(opts *bind.TransactOpts, intent IFastSettlementV3Intent, swapData IFastSettlementV3SwapCall) (*types.Transaction, error) {
	return _Ifastsettlementv3.contract.Transact(opts, "executeWithETH", intent, swapData)
}

// ExecuteWithETH is a paid mutator transaction binding the contract method 0x1fb7a307.
//
// Solidity: function executeWithETH((address,address,address,uint256,uint256,address,uint256,uint256) intent, (address,uint256,bytes) swapData) payable returns(uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3Session) ExecuteWithETH(intent IFastSettlementV3Intent, swapData IFastSettlementV3SwapCall) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.ExecuteWithETH(&_Ifastsettlementv3.TransactOpts, intent, swapData)
}

// ExecuteWithETH is a paid mutator transaction binding the contract method 0x1fb7a307.
//
// Solidity: function executeWithETH((address,address,address,uint256,uint256,address,uint256,uint256) intent, (address,uint256,bytes) swapData) payable returns(uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorSession) ExecuteWithETH(intent IFastSettlementV3Intent, swapData IFastSettlementV3SwapCall) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.ExecuteWithETH(&_Ifastsettlementv3.TransactOpts, intent, swapData)
}

// ExecuteWithPermit is a paid mutator transaction binding the contract method 0x02c52a55.
//
// Solidity: function executeWithPermit((address,address,address,uint256,uint256,address,uint256,uint256) intent, bytes signature, (address,uint256,bytes) swapData) returns(uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3Transactor) ExecuteWithPermit(opts *bind.TransactOpts, intent IFastSettlementV3Intent, signature []byte, swapData IFastSettlementV3SwapCall) (*types.Transaction, error) {
	return _Ifastsettlementv3.contract.Transact(opts, "executeWithPermit", intent, signature, swapData)
}

// ExecuteWithPermit is a paid mutator transaction binding the contract method 0x02c52a55.
//
// Solidity: function executeWithPermit((address,address,address,uint256,uint256,address,uint256,uint256) intent, bytes signature, (address,uint256,bytes) swapData) returns(uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3Session) ExecuteWithPermit(intent IFastSettlementV3Intent, signature []byte, swapData IFastSettlementV3SwapCall) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.ExecuteWithPermit(&_Ifastsettlementv3.TransactOpts, intent, signature, swapData)
}

// ExecuteWithPermit is a paid mutator transaction binding the contract method 0x02c52a55.
//
// Solidity: function executeWithPermit((address,address,address,uint256,uint256,address,uint256,uint256) intent, bytes signature, (address,uint256,bytes) swapData) returns(uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorSession) ExecuteWithPermit(intent IFastSettlementV3Intent, signature []byte, swapData IFastSettlementV3SwapCall) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.ExecuteWithPermit(&_Ifastsettlementv3.TransactOpts, intent, signature, swapData)
}

// RescueTokens is a paid mutator transaction binding the contract method 0x57376198.
//
// Solidity: function rescueTokens(address token, uint256 amount) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Transactor) RescueTokens(opts *bind.TransactOpts, token common.Address, amount *big.Int) (*types.Transaction, error) {
	return _Ifastsettlementv3.contract.Transact(opts, "rescueTokens", token, amount)
}

// RescueTokens is a paid mutator transaction binding the contract method 0x57376198.
//
// Solidity: function rescueTokens(address token, uint256 amount) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Session) RescueTokens(token common.Address, amount *big.Int) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.RescueTokens(&_Ifastsettlementv3.TransactOpts, token, amount)
}

// RescueTokens is a paid mutator transaction binding the contract method 0x57376198.
//
// Solidity: function rescueTokens(address token, uint256 amount) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorSession) RescueTokens(token common.Address, amount *big.Int) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.RescueTokens(&_Ifastsettlementv3.TransactOpts, token, amount)
}

// SetExecutor is a paid mutator transaction binding the contract method 0x1c3c0ea8.
//
// Solidity: function setExecutor(address _newExecutor) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Transactor) SetExecutor(opts *bind.TransactOpts, _newExecutor common.Address) (*types.Transaction, error) {
	return _Ifastsettlementv3.contract.Transact(opts, "setExecutor", _newExecutor)
}

// SetExecutor is a paid mutator transaction binding the contract method 0x1c3c0ea8.
//
// Solidity: function setExecutor(address _newExecutor) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Session) SetExecutor(_newExecutor common.Address) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.SetExecutor(&_Ifastsettlementv3.TransactOpts, _newExecutor)
}

// SetExecutor is a paid mutator transaction binding the contract method 0x1c3c0ea8.
//
// Solidity: function setExecutor(address _newExecutor) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorSession) SetExecutor(_newExecutor common.Address) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.SetExecutor(&_Ifastsettlementv3.TransactOpts, _newExecutor)
}

// SetSwapTargets is a paid mutator transaction binding the contract method 0x57d6924c.
//
// Solidity: function setSwapTargets(address[] targets, bool[] allowed) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Transactor) SetSwapTargets(opts *bind.TransactOpts, targets []common.Address, allowed []bool) (*types.Transaction, error) {
	return _Ifastsettlementv3.contract.Transact(opts, "setSwapTargets", targets, allowed)
}

// SetSwapTargets is a paid mutator transaction binding the contract method 0x57d6924c.
//
// Solidity: function setSwapTargets(address[] targets, bool[] allowed) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Session) SetSwapTargets(targets []common.Address, allowed []bool) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.SetSwapTargets(&_Ifastsettlementv3.TransactOpts, targets, allowed)
}

// SetSwapTargets is a paid mutator transaction binding the contract method 0x57d6924c.
//
// Solidity: function setSwapTargets(address[] targets, bool[] allowed) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorSession) SetSwapTargets(targets []common.Address, allowed []bool) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.SetSwapTargets(&_Ifastsettlementv3.TransactOpts, targets, allowed)
}

// SetTreasury is a paid mutator transaction binding the contract method 0xf0f44260.
//
// Solidity: function setTreasury(address _newTreasury) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Transactor) SetTreasury(opts *bind.TransactOpts, _newTreasury common.Address) (*types.Transaction, error) {
	return _Ifastsettlementv3.contract.Transact(opts, "setTreasury", _newTreasury)
}

// SetTreasury is a paid mutator transaction binding the contract method 0xf0f44260.
//
// Solidity: function setTreasury(address _newTreasury) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3Session) SetTreasury(_newTreasury common.Address) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.SetTreasury(&_Ifastsettlementv3.TransactOpts, _newTreasury)
}

// SetTreasury is a paid mutator transaction binding the contract method 0xf0f44260.
//
// Solidity: function setTreasury(address _newTreasury) returns()
func (_Ifastsettlementv3 *Ifastsettlementv3TransactorSession) SetTreasury(_newTreasury common.Address) (*types.Transaction, error) {
	return _Ifastsettlementv3.Contract.SetTreasury(&_Ifastsettlementv3.TransactOpts, _newTreasury)
}

// Ifastsettlementv3ExecutorUpdatedIterator is returned from FilterExecutorUpdated and is used to iterate over the raw logs and unpacked data for ExecutorUpdated events raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3ExecutorUpdatedIterator struct {
	Event *Ifastsettlementv3ExecutorUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *Ifastsettlementv3ExecutorUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(Ifastsettlementv3ExecutorUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(Ifastsettlementv3ExecutorUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *Ifastsettlementv3ExecutorUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *Ifastsettlementv3ExecutorUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// Ifastsettlementv3ExecutorUpdated represents a ExecutorUpdated event raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3ExecutorUpdated struct {
	OldExecutor common.Address
	NewExecutor common.Address
	Raw         types.Log // Blockchain specific contextual infos
}

// FilterExecutorUpdated is a free log retrieval operation binding the contract event 0x0ef3c7eb9dbcf33ddf032f4cce366a07eda85eed03e3172e4a90c4cc16d57886.
//
// Solidity: event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) FilterExecutorUpdated(opts *bind.FilterOpts, oldExecutor []common.Address, newExecutor []common.Address) (*Ifastsettlementv3ExecutorUpdatedIterator, error) {

	var oldExecutorRule []interface{}
	for _, oldExecutorItem := range oldExecutor {
		oldExecutorRule = append(oldExecutorRule, oldExecutorItem)
	}
	var newExecutorRule []interface{}
	for _, newExecutorItem := range newExecutor {
		newExecutorRule = append(newExecutorRule, newExecutorItem)
	}

	logs, sub, err := _Ifastsettlementv3.contract.FilterLogs(opts, "ExecutorUpdated", oldExecutorRule, newExecutorRule)
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3ExecutorUpdatedIterator{contract: _Ifastsettlementv3.contract, event: "ExecutorUpdated", logs: logs, sub: sub}, nil
}

// WatchExecutorUpdated is a free log subscription operation binding the contract event 0x0ef3c7eb9dbcf33ddf032f4cce366a07eda85eed03e3172e4a90c4cc16d57886.
//
// Solidity: event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) WatchExecutorUpdated(opts *bind.WatchOpts, sink chan<- *Ifastsettlementv3ExecutorUpdated, oldExecutor []common.Address, newExecutor []common.Address) (event.Subscription, error) {

	var oldExecutorRule []interface{}
	for _, oldExecutorItem := range oldExecutor {
		oldExecutorRule = append(oldExecutorRule, oldExecutorItem)
	}
	var newExecutorRule []interface{}
	for _, newExecutorItem := range newExecutor {
		newExecutorRule = append(newExecutorRule, newExecutorItem)
	}

	logs, sub, err := _Ifastsettlementv3.contract.WatchLogs(opts, "ExecutorUpdated", oldExecutorRule, newExecutorRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(Ifastsettlementv3ExecutorUpdated)
				if err := _Ifastsettlementv3.contract.UnpackLog(event, "ExecutorUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseExecutorUpdated is a log parse operation binding the contract event 0x0ef3c7eb9dbcf33ddf032f4cce366a07eda85eed03e3172e4a90c4cc16d57886.
//
// Solidity: event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) ParseExecutorUpdated(log types.Log) (*Ifastsettlementv3ExecutorUpdated, error) {
	event := new(Ifastsettlementv3ExecutorUpdated)
	if err := _Ifastsettlementv3.contract.UnpackLog(event, "ExecutorUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// Ifastsettlementv3IntentExecutedIterator is returned from FilterIntentExecuted and is used to iterate over the raw logs and unpacked data for IntentExecuted events raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3IntentExecutedIterator struct {
	Event *Ifastsettlementv3IntentExecuted // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *Ifastsettlementv3IntentExecutedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(Ifastsettlementv3IntentExecuted)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(Ifastsettlementv3IntentExecuted)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *Ifastsettlementv3IntentExecutedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *Ifastsettlementv3IntentExecutedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// Ifastsettlementv3IntentExecuted represents a IntentExecuted event raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3IntentExecuted struct {
	User        common.Address
	InputToken  common.Address
	OutputToken common.Address
	InputAmt    *big.Int
	UserAmtOut  *big.Int
	Received    *big.Int
	Surplus     *big.Int
	Raw         types.Log // Blockchain specific contextual infos
}

// FilterIntentExecuted is a free log retrieval operation binding the contract event 0x1ad6a4af59e844de3a921ec3dba60cb46f0b9051c9a106258624709dff629a87.
//
// Solidity: event IntentExecuted(address indexed user, address indexed inputToken, address indexed outputToken, uint256 inputAmt, uint256 userAmtOut, uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) FilterIntentExecuted(opts *bind.FilterOpts, user []common.Address, inputToken []common.Address, outputToken []common.Address) (*Ifastsettlementv3IntentExecutedIterator, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}
	var inputTokenRule []interface{}
	for _, inputTokenItem := range inputToken {
		inputTokenRule = append(inputTokenRule, inputTokenItem)
	}
	var outputTokenRule []interface{}
	for _, outputTokenItem := range outputToken {
		outputTokenRule = append(outputTokenRule, outputTokenItem)
	}

	logs, sub, err := _Ifastsettlementv3.contract.FilterLogs(opts, "IntentExecuted", userRule, inputTokenRule, outputTokenRule)
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3IntentExecutedIterator{contract: _Ifastsettlementv3.contract, event: "IntentExecuted", logs: logs, sub: sub}, nil
}

// WatchIntentExecuted is a free log subscription operation binding the contract event 0x1ad6a4af59e844de3a921ec3dba60cb46f0b9051c9a106258624709dff629a87.
//
// Solidity: event IntentExecuted(address indexed user, address indexed inputToken, address indexed outputToken, uint256 inputAmt, uint256 userAmtOut, uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) WatchIntentExecuted(opts *bind.WatchOpts, sink chan<- *Ifastsettlementv3IntentExecuted, user []common.Address, inputToken []common.Address, outputToken []common.Address) (event.Subscription, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}
	var inputTokenRule []interface{}
	for _, inputTokenItem := range inputToken {
		inputTokenRule = append(inputTokenRule, inputTokenItem)
	}
	var outputTokenRule []interface{}
	for _, outputTokenItem := range outputToken {
		outputTokenRule = append(outputTokenRule, outputTokenItem)
	}

	logs, sub, err := _Ifastsettlementv3.contract.WatchLogs(opts, "IntentExecuted", userRule, inputTokenRule, outputTokenRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(Ifastsettlementv3IntentExecuted)
				if err := _Ifastsettlementv3.contract.UnpackLog(event, "IntentExecuted", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseIntentExecuted is a log parse operation binding the contract event 0x1ad6a4af59e844de3a921ec3dba60cb46f0b9051c9a106258624709dff629a87.
//
// Solidity: event IntentExecuted(address indexed user, address indexed inputToken, address indexed outputToken, uint256 inputAmt, uint256 userAmtOut, uint256 received, uint256 surplus)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) ParseIntentExecuted(log types.Log) (*Ifastsettlementv3IntentExecuted, error) {
	event := new(Ifastsettlementv3IntentExecuted)
	if err := _Ifastsettlementv3.contract.UnpackLog(event, "IntentExecuted", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// Ifastsettlementv3SwapTargetsUpdatedIterator is returned from FilterSwapTargetsUpdated and is used to iterate over the raw logs and unpacked data for SwapTargetsUpdated events raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3SwapTargetsUpdatedIterator struct {
	Event *Ifastsettlementv3SwapTargetsUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *Ifastsettlementv3SwapTargetsUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(Ifastsettlementv3SwapTargetsUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(Ifastsettlementv3SwapTargetsUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *Ifastsettlementv3SwapTargetsUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *Ifastsettlementv3SwapTargetsUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// Ifastsettlementv3SwapTargetsUpdated represents a SwapTargetsUpdated event raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3SwapTargetsUpdated struct {
	Targets []common.Address
	Allowed []bool
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterSwapTargetsUpdated is a free log retrieval operation binding the contract event 0xe18e0ae71e84871d203445f1d9d5c51bd93bb2e362ee0e455940a88475dc13bc.
//
// Solidity: event SwapTargetsUpdated(address[] targets, bool[] allowed)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) FilterSwapTargetsUpdated(opts *bind.FilterOpts) (*Ifastsettlementv3SwapTargetsUpdatedIterator, error) {

	logs, sub, err := _Ifastsettlementv3.contract.FilterLogs(opts, "SwapTargetsUpdated")
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3SwapTargetsUpdatedIterator{contract: _Ifastsettlementv3.contract, event: "SwapTargetsUpdated", logs: logs, sub: sub}, nil
}

// WatchSwapTargetsUpdated is a free log subscription operation binding the contract event 0xe18e0ae71e84871d203445f1d9d5c51bd93bb2e362ee0e455940a88475dc13bc.
//
// Solidity: event SwapTargetsUpdated(address[] targets, bool[] allowed)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) WatchSwapTargetsUpdated(opts *bind.WatchOpts, sink chan<- *Ifastsettlementv3SwapTargetsUpdated) (event.Subscription, error) {

	logs, sub, err := _Ifastsettlementv3.contract.WatchLogs(opts, "SwapTargetsUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(Ifastsettlementv3SwapTargetsUpdated)
				if err := _Ifastsettlementv3.contract.UnpackLog(event, "SwapTargetsUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseSwapTargetsUpdated is a log parse operation binding the contract event 0xe18e0ae71e84871d203445f1d9d5c51bd93bb2e362ee0e455940a88475dc13bc.
//
// Solidity: event SwapTargetsUpdated(address[] targets, bool[] allowed)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) ParseSwapTargetsUpdated(log types.Log) (*Ifastsettlementv3SwapTargetsUpdated, error) {
	event := new(Ifastsettlementv3SwapTargetsUpdated)
	if err := _Ifastsettlementv3.contract.UnpackLog(event, "SwapTargetsUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// Ifastsettlementv3TreasuryUpdatedIterator is returned from FilterTreasuryUpdated and is used to iterate over the raw logs and unpacked data for TreasuryUpdated events raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3TreasuryUpdatedIterator struct {
	Event *Ifastsettlementv3TreasuryUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *Ifastsettlementv3TreasuryUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(Ifastsettlementv3TreasuryUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(Ifastsettlementv3TreasuryUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *Ifastsettlementv3TreasuryUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *Ifastsettlementv3TreasuryUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// Ifastsettlementv3TreasuryUpdated represents a TreasuryUpdated event raised by the Ifastsettlementv3 contract.
type Ifastsettlementv3TreasuryUpdated struct {
	OldTreasury common.Address
	NewTreasury common.Address
	Raw         types.Log // Blockchain specific contextual infos
}

// FilterTreasuryUpdated is a free log retrieval operation binding the contract event 0x4ab5be82436d353e61ca18726e984e561f5c1cc7c6d38b29d2553c790434705a.
//
// Solidity: event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) FilterTreasuryUpdated(opts *bind.FilterOpts, oldTreasury []common.Address, newTreasury []common.Address) (*Ifastsettlementv3TreasuryUpdatedIterator, error) {

	var oldTreasuryRule []interface{}
	for _, oldTreasuryItem := range oldTreasury {
		oldTreasuryRule = append(oldTreasuryRule, oldTreasuryItem)
	}
	var newTreasuryRule []interface{}
	for _, newTreasuryItem := range newTreasury {
		newTreasuryRule = append(newTreasuryRule, newTreasuryItem)
	}

	logs, sub, err := _Ifastsettlementv3.contract.FilterLogs(opts, "TreasuryUpdated", oldTreasuryRule, newTreasuryRule)
	if err != nil {
		return nil, err
	}
	return &Ifastsettlementv3TreasuryUpdatedIterator{contract: _Ifastsettlementv3.contract, event: "TreasuryUpdated", logs: logs, sub: sub}, nil
}

// WatchTreasuryUpdated is a free log subscription operation binding the contract event 0x4ab5be82436d353e61ca18726e984e561f5c1cc7c6d38b29d2553c790434705a.
//
// Solidity: event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) WatchTreasuryUpdated(opts *bind.WatchOpts, sink chan<- *Ifastsettlementv3TreasuryUpdated, oldTreasury []common.Address, newTreasury []common.Address) (event.Subscription, error) {

	var oldTreasuryRule []interface{}
	for _, oldTreasuryItem := range oldTreasury {
		oldTreasuryRule = append(oldTreasuryRule, oldTreasuryItem)
	}
	var newTreasuryRule []interface{}
	for _, newTreasuryItem := range newTreasury {
		newTreasuryRule = append(newTreasuryRule, newTreasuryItem)
	}

	logs, sub, err := _Ifastsettlementv3.contract.WatchLogs(opts, "TreasuryUpdated", oldTreasuryRule, newTreasuryRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(Ifastsettlementv3TreasuryUpdated)
				if err := _Ifastsettlementv3.contract.UnpackLog(event, "TreasuryUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseTreasuryUpdated is a log parse operation binding the contract event 0x4ab5be82436d353e61ca18726e984e561f5c1cc7c6d38b29d2553c790434705a.
//
// Solidity: event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)
func (_Ifastsettlementv3 *Ifastsettlementv3Filterer) ParseTreasuryUpdated(log types.Log) (*Ifastsettlementv3TreasuryUpdated, error) {
	event := new(Ifastsettlementv3TreasuryUpdated)
	if err := _Ifastsettlementv3.contract.UnpackLog(event, "TreasuryUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
