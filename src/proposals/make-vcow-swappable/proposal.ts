import { MetaTransaction } from "@gnosis.pm/safe-contracts";
import IERC20 from "@openzeppelin/contracts/build/contracts/IERC20.json";
import { BigNumberish } from "ethers";
import { Interface } from "ethers/lib/utils";

import {
  SafeOperation,
  transformMetaTransaction,
  prepareBridgingTokens,
  CalldataReplacer,
  ProposalSteps,
} from "../../lib";

export interface TransferSettings {
  virtualCowToken: string;
  atomsToTransfer: BigNumberish;
}
export type PartialTransferSettings = Pick<
  TransferSettings,
  "virtualCowToken"
> &
  Partial<TransferSettings>;
export interface MakeSwappableSettings extends PartialTransferSettings {
  bridged: PartialTransferSettings;
  multiTokenMediator: string;
  cowToken: string;
  multisend: string;
}

export interface MakeSwappableProposal {
  replacer: CalldataReplacer;
  stepsWithPlaceholders: ProposalSteps;
}

const erc20Iface = new Interface(IERC20.abi);

export function generateMakeSwappableProposal(
  settings: MakeSwappableSettings,
): MakeSwappableProposal {
  const replacer = new CalldataReplacer();
  const atomsToTransfer =
    settings.atomsToTransfer ??
    replacer.generateUint256Placeholder("atomsToTransfer");

  const mainnetMakeSwappableTx = makeVcowSwappable({
    atomsToTransfer,
    cowToken: settings.cowToken,
    virtualCowToken: settings.virtualCowToken,
  });

  const atomsToBridge =
    settings.bridged.atomsToTransfer ??
    replacer.generateUint256Placeholder("atomsToBridge");
  const { approve: approveCowBridgingTx, relay: relayToOmniBridgeTx } =
    prepareBridgingTokens({
      token: settings.cowToken,
      receiver: settings.bridged.virtualCowToken,
      atoms: atomsToBridge,
      multiTokenMediator: settings.multiTokenMediator,
    });

  return {
    replacer,
    stepsWithPlaceholders: [
      [mainnetMakeSwappableTx, approveCowBridgingTx, relayToOmniBridgeTx],
    ].map((step) => step.map(transformMetaTransaction)),
  };
}

function makeVcowSwappable({
  cowToken,
  virtualCowToken,
  atomsToTransfer,
}: TransferSettings & { cowToken: string }): MetaTransaction {
  return {
    to: cowToken,
    data: erc20Iface.encodeFunctionData("transfer", [
      virtualCowToken,
      atomsToTransfer,
    ]),
    value: 0,
    operation: SafeOperation.Call,
  };
}
