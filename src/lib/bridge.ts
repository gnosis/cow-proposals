import { MetaTransaction } from "@gnosis.pm/safe-contracts";
import IERC20 from "@openzeppelin/contracts/build/contracts/IERC20.json";
import { BigNumberish, ethers } from "ethers";

export const OMNIBRIDGE_FUNCTIONS = [
  "function relayTokens(address,address,uint256)",
];

const erc20Interface = new ethers.utils.Interface(IERC20.abi);
const omnibridgeInterface = new ethers.utils.Interface(OMNIBRIDGE_FUNCTIONS);

interface PrepareBridgingTokensInput {
  token: string;
  receiver: string;
  atoms: BigNumberish;
  multiTokenMediator: string;
}
export function prepareBridgingTokens({
  token,
  receiver,
  atoms,
  multiTokenMediator,
}: PrepareBridgingTokensInput): {
  approve: MetaTransaction;
  relay: MetaTransaction;
} {
  const approve = {
    to: token,
    value: "0",
    data: erc20Interface.encodeFunctionData("approve", [
      multiTokenMediator,
      atoms,
    ]),
    operation: 0,
  };
  const relay = {
    to: multiTokenMediator,
    value: "0",
    data: omnibridgeInterface.encodeFunctionData("relayTokens", [
      token,
      receiver,
      atoms,
    ]),
    operation: 0,
  };

  return { approve, relay };
}
