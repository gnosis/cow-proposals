import { MetaTransaction } from "@gnosis.pm/safe-contracts";
import IERC20 from "@openzeppelin/contracts/build/contracts/IERC20.json";
import { Interface } from "ethers/lib/utils";

import {
  SafeOperation,
  JsonMetaTransaction,
  transformMetaTransaction,
} from "../../lib";

export interface MakeSwappableSettings {
  virtualCowToken: string;
  atomsToTransfer: string;
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
  const mainnetMakeSwappableTransaction = makeVcowSwappable(settings);
  return {
    steps: [[mainnetMakeSwappableTransaction]].map((step) =>
      step.map(transformMetaTransaction),
    ),
  };
}

function makeVcowSwappable({
  cowToken,
  virtualCowToken,
  atomsToTransfer,
}: Pick<
  MakeSwappableSettings,
  "cowToken" | "virtualCowToken" | "atomsToTransfer"
>): MetaTransaction {
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
