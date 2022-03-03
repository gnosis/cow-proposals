import { MetaTransaction } from "@gnosis.pm/safe-contracts";
import IERC20 from "@openzeppelin/contracts/build/contracts/IERC20.json";
import { Interface } from "ethers/lib/utils";

import {
  SafeOperation,
  JsonMetaTransaction,
  transformMetaTransaction,
  prepareBridgingTokens,
} from "../../lib";

export interface TransferSettings {
  virtualCowToken: string;
  atomsToTransfer: string;
}
export interface MakeSwappableSettings extends TransferSettings {
  bridged: TransferSettings;
  multiTokenMediator: string;
  cowToken: string;
  multisend: string;
}

export interface MakeSwappableProposal {
  steps: JsonMetaTransaction[][];
}

const erc20Iface = new Interface(IERC20.abi);

export function generateMakeSwappableProposal(
  settings: MakeSwappableSettings,
): MakeSwappableProposal {
  const mainnetMakeSwappableTx = makeVcowSwappable(settings);

  const { approve: approveCowBridgingTx, relay: relayToOmniBridgeTx } =
    prepareBridgingTokens({
      token: settings.cowToken,
      receiver: settings.bridged.virtualCowToken,
      atoms: settings.bridged.atomsToTransfer,
      multiTokenMediator: settings.multiTokenMediator,
    });

  return {
    steps: [
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
