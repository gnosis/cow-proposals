import type { TransactionResponse } from "@ethersproject/abstract-provider";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import {
  MetaTransaction,
  encodeMultiSend,
  calculateProxyAddress,
  buildSafeTransaction,
  executeTxWithSigners,
} from "@gnosis.pm/safe-contracts";
import GnosisSafe from "@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafe.sol/GnosisSafe.json";
import CreateCall from "@gnosis.pm/safe-contracts/build/artifacts/contracts/libraries/CreateCall.sol/CreateCall.json";
import MultiSend from "@gnosis.pm/safe-contracts/build/artifacts/contracts/libraries/MultiSend.sol/MultiSend.json";
import GnosisSafeProxyFactory from "@gnosis.pm/safe-contracts/build/artifacts/contracts/proxies/GnosisSafeProxyFactory.sol/GnosisSafeProxyFactory.json";
import CompatibilityFallbackHandlerDeployment from "@gnosis.pm/safe-deployments/src/assets/v1.3.0/compatibility_fallback_handler.json";
import CreateCallDeployment from "@gnosis.pm/safe-deployments/src/assets/v1.3.0/create_call.json";
import GnosisSafeDeployment from "@gnosis.pm/safe-deployments/src/assets/v1.3.0/gnosis_safe.json";
import MultiSendDeployment from "@gnosis.pm/safe-deployments/src/assets/v1.3.0/multi_send_call_only.json";
import GnosisSafeProxyFactoryDeployment from "@gnosis.pm/safe-deployments/src/assets/v1.3.0/proxy_factory.json";
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";
import {
  BigNumber,
  BigNumberish,
  BytesLike,
  constants,
  Contract,
  utils,
  Signer,
  Wallet,
} from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export { MultiSendDeployment, CreateCallDeployment };

export enum SafeOperation {
  Call = 0,
  DelegateCall = 1,
}

export interface SafeDeploymentAddresses {
  singleton: string;
  factory: string;
  fallbackHandler: string;
  createCall: string;
  multisendCallOnly: string;
}

const gnosisSafeIface = new utils.Interface(GnosisSafe.abi);
const proxyFactoryIface = new utils.Interface(GnosisSafeProxyFactory.abi);
const createCallIface = new utils.Interface(CreateCall.abi);

export type SupportedChainId =
  keyof typeof GnosisSafeProxyFactoryDeployment.networkAddresses &
    keyof typeof GnosisSafeDeployment.networkAddresses &
    keyof typeof MultiSendDeployment.networkAddresses &
    keyof typeof CreateCallDeployment.networkAddresses &
    keyof typeof CompatibilityFallbackHandlerDeployment.networkAddresses;

export function isChainIdSupported(
  chainId: string,
): chainId is SupportedChainId {
  return (
    Object.keys(GnosisSafeProxyFactoryDeployment.networkAddresses).includes(
      chainId,
    ) &&
    Object.keys(GnosisSafeDeployment.networkAddresses).includes(chainId) &&
    Object.keys(MultiSendDeployment.networkAddresses).includes(chainId) &&
    Object.keys(CreateCallDeployment.networkAddresses).includes(chainId) &&
    Object.keys(
      CompatibilityFallbackHandlerDeployment.networkAddresses,
    ).includes(chainId)
  );
}

export function defaultSafeDeploymentAddresses(
  chainId: SupportedChainId,
): SafeDeploymentAddresses {
  return {
    factory: GnosisSafeProxyFactoryDeployment.networkAddresses[chainId],
    singleton: GnosisSafeDeployment.networkAddresses[chainId],
    fallbackHandler:
      CompatibilityFallbackHandlerDeployment.networkAddresses[chainId],
    createCall: CreateCallDeployment.networkAddresses[chainId],
    multisendCallOnly: MultiSendDeployment.networkAddresses[chainId],
  };
}

export async function execSafeTransaction(
  safe: Contract,
  transaction: MetaTransaction,
  signers: (Signer & TypedDataSigner)[],
): Promise<TransactionResponse> {
  const safeTransaction = buildSafeTransaction({
    ...transaction,
    nonce: await safe.nonce(),
  });

  // Hack: looking at the call stack of the imported function
  // `executeTxWithSigners`, it is enough that the signer's type is `Signer &
  // TypedDataSigner`. However, the Safe library function requires the signers'
  // type to be `Wallet`. We coerce the type to be able to use this function
  // with signers without reimplementing all execution and signing routines.
  return await executeTxWithSigners(safe, safeTransaction, signers as Wallet[]);
}

export async function deployWithOwners(
  owners: string[],
  threshold: number,
  deployer: Signer,
  { ethers }: HardhatRuntimeEnvironment,
): Promise<Contract> {
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();
  if (!isChainIdSupported(chainId)) {
    throw new Error(`Chain id ${chainId} not supported by the Gnosis Safe`);
  }
  const safeDeploymentAddresses = defaultSafeDeploymentAddresses(chainId);
  const deployTransaction = await deployer.sendTransaction(
    await prepareSafeWithOwners(owners, threshold, safeDeploymentAddresses),
  );
  const proxies = await createdProxies(
    deployTransaction,
    safeDeploymentAddresses.factory,
  );
  if (proxies.length !== 1) {
    throw new Error(
      `Malformed deployment transaction, txhash ${deployTransaction.hash}`,
    );
  }

  const newSafeAddress = proxies[0];
  return new Contract(newSafeAddress, GnosisSafe.abi);
}

export function gnosisSafeAt(address: string): Contract {
  return new Contract(address, GnosisSafe.abi);
}

export function safeSetupData(
  owners: string[],
  threshold: number,
  fallbackHandler?: string,
): string {
  return gnosisSafeIface.encodeFunctionData("setup", [
    owners,
    threshold,
    constants.AddressZero,
    "0x",
    fallbackHandler ?? constants.AddressZero,
    constants.AddressZero,
    constants.Zero,
    constants.AddressZero,
  ]);
}

export async function prepareDeterministicSafeWithOwners(
  owners: string[],
  threshold: number,
  {
    singleton,
    factory,
    fallbackHandler,
  }: Pick<SafeDeploymentAddresses, "singleton" | "factory"> &
    Partial<SafeDeploymentAddresses>,
  nonce: BigNumberish,
  ethers: HardhatEthersHelpers,
): Promise<{ to: string; data: string; address: string }> {
  const setupOwnersBytecode = safeSetupData(owners, threshold, fallbackHandler);
  const proxyFactory = new Contract(
    factory,
    GnosisSafeProxyFactory.abi,
  ).connect(ethers.provider);
  const createProxyInput: [string, string, string] = [
    singleton,
    setupOwnersBytecode,
    BigNumber.from(nonce).toString(),
  ];
  const data: string = proxyFactoryIface.encodeFunctionData(
    "createProxyWithNonce",
    createProxyInput,
  );
  const address = await calculateProxyAddress(
    proxyFactory,
    ...createProxyInput,
  );
  return { to: proxyFactory.address, data, address };
}

export function prepareSafeWithOwners(
  owners: string[],
  threshold: number,
  {
    singleton,
    factory,
    fallbackHandler,
  }: Pick<SafeDeploymentAddresses, "singleton" | "factory"> &
    Partial<SafeDeploymentAddresses>,
): { to: string; data: string } {
  const setupOwnersBytecode = safeSetupData(owners, threshold, fallbackHandler);
  const data: string = proxyFactoryIface.encodeFunctionData("createProxy", [
    singleton,
    setupOwnersBytecode,
  ]);
  return { to: factory, data };
}

export async function createdProxies(
  response: TransactionResponse,
  proxyFactoryAddress: string,
): Promise<string[]> {
  const receipt = await response.wait();
  const creationEvents = receipt.logs
    .filter(({ address }) => address === proxyFactoryAddress)
    .map((log) => proxyFactoryIface.parseLog(log))
    .filter(({ name }) => name === "ProxyCreation");
  return creationEvents.map(({ args }) => args.proxy);
}

export async function getFallbackHandler(
  safe: string,
  ethers: HardhatEthersHelpers,
): Promise<string> {
  // The fallback handler is stored at a fixed storage slot in all Gnosis Safes.
  // https://github.com/gnosis/safe-contracts/blob/da66b45ec87d2fb6da7dfd837b29eacdb9a604c5/contracts/base/FallbackManager.sol#L11-L20
  // You can see usage examples in the Gnosis Safe tests:
  // https://github.com/gnosis/safe-contracts/blob/da66b45ec87d2fb6da7dfd837b29eacdb9a604c5/test/core/GnosisSafe.FallbackManager.spec.ts#L32-L73
  const FALLBACK_HANDLER_STORAGE_SLOT =
    "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";
  const storage = await ethers.provider.getStorageAt(
    safe,
    FALLBACK_HANDLER_STORAGE_SLOT,
  );
  return utils.getAddress(defaultAbiCoder.decode(["address"], storage)[0]);
}

export function multisend(
  transactions: MetaTransaction[],
  multisendAddress: string,
): MetaTransaction {
  const multisend = new Contract(multisendAddress, MultiSend.abi);
  const data = multisend.interface.encodeFunctionData("multiSend", [
    encodeMultiSend(transactions),
  ]);
  return {
    to: multisend.address,
    value: 0,
    operation: SafeOperation.DelegateCall,
    data,
  };
}

export function createTransaction(
  deploymentData: BytesLike,
  createCallAddress: string,
) {
  const createCall = new Contract(createCallAddress, CreateCall.abi);
  const value = constants.Zero;
  const data = createCall.interface.encodeFunctionData("performCreate", [
    value,
    deploymentData,
  ]);
  return {
    to: createCall.address,
    value,
    operation: SafeOperation.Call,
    data,
  };
}

export async function contractsCreatedWithCreateCall(
  response: TransactionResponse,
  createCallAddress: string,
): Promise<string[]> {
  const receipt = await response.wait();
  const creationEvents = receipt.logs
    .filter(({ address }) => address === createCallAddress)
    .map((log) => createCallIface.parseLog(log))
    .filter(({ name }) => name === "ContractCreation");
  return creationEvents.map(({ args }) => args.newContract);
}
