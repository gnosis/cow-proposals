import { expect } from "chai";
import { Contract, utils } from "ethers";
import hre, { ethers } from "hardhat";

import { realityModule } from "../../../src/lib/constants";

import { forkMainnet, stopMainnetFork } from "./chain-fork";

describe("Mainnet: hardcoded addresses", () => {
  before(async () => {
    await forkMainnet(hre);
  });

  after(async () => {
    await stopMainnetFork(hre);
  });

  it("reality module", async function () {
    const address = realityModule["1"];
    expect(
      utils.arrayify(await ethers.provider.getCode(address)),
    ).to.have.length.greaterThan(0);

    // This function appears in the DAO module and can be used to as a hint that this is the correct address.
    const abi = ["function getChainId() view returns (uint256)"];
    const contract = new Contract(address, abi, ethers.provider);
    expect(await contract.getChainId()).to.equal(1);
  });
});
