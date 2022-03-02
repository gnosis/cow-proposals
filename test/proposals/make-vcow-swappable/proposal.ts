import { Contract } from "@ethersproject/contracts";
import IERC20 from "@openzeppelin/contracts/build/contracts/IERC20.json";
import { expect } from "chai";
import { MockContract } from "ethereum-waffle";
import { waffle } from "hardhat";

import {
  groupMultipleTransactions,
  execSafeTransaction,
} from "../../../src/lib";
import {
  generateMakeSwappableProposal,
  MakeSwappableSettings,
} from "../../../src/proposals/make-vcow-swappable/proposal";
import makeSwappableSettings from "../../../src/proposals/make-vcow-swappable/settings.json";
import { RevertMessage } from "../../lib/custom-errors";
import { GnosisSafeManager } from "../../lib/safe";

const [deployer, gnosisDaoOwner, executor] = waffle.provider.getWallets();

// Test at compile time that the example file has the expected format.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _makeSwappableTypeCheck: MakeSwappableSettings = makeSwappableSettings;

describe("make swappable proposal", function () {
  let cowDao: Contract;
  let cowToken: MockContract;
  let gnosisSafeManager: GnosisSafeManager;
  let settings: MakeSwappableSettings;

  before(async function () {
    gnosisSafeManager = await GnosisSafeManager.init(deployer);

    cowDao = await (
      await gnosisSafeManager.newSafe([gnosisDaoOwner.address], 1)
    ).connect(executor);
  });

  beforeEach(async function () {
    cowToken = await waffle.deployMockContract(deployer, IERC20.abi);

    settings = {
      cowToken: cowToken.address,
      virtualCowToken: "0x" + "42".repeat(20),
      atomsToTransfer: "31337",
      multisend: gnosisSafeManager.multisend.address,
    };
  });

  it("executes successfully", async function () {
    await cowToken.mock.transfer
      .withArgs(settings.virtualCowToken, settings.atomsToTransfer)
      .returns(true);

    const { steps } = generateMakeSwappableProposal(settings);
    for (const step of groupMultipleTransactions(
      steps,
      gnosisSafeManager.multisend.address,
    )) {
      await execSafeTransaction(cowDao, step, [gnosisDaoOwner]); //).not.to.be.reverted;
    }
  });

  it("transfers COW to vCOW", async function () {
    // Require that the mock in the test "executes successfully" has been
    // called. This is done by observing that without the mock the transaction
    // reverts.

    const { steps } = generateMakeSwappableProposal(settings);
    // Assumption: the first transaction in the list is the transfer. If this
    // test fails, it might be that it has changed order.
    const [[transferCow]] = steps;
    // To help check that, we assert that `to` is the COW token.
    expect(transferCow.to).to.equal(settings.cowToken);

    await expect(
      executor.sendTransaction({ to: transferCow.to, data: transferCow.data }),
    ).to.be.revertedWith(RevertMessage.UninitializedMock);
  });
});
