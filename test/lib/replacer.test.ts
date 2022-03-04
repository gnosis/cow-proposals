import { expect } from "chai";
import { ethers } from "ethers";
import { Interface } from "ethers/lib/utils";

import { CalldataReplacer } from "../../src/lib";

describe("replacer", function () {
  const encoder = new Interface([
    "function oneInput(uint256)",
    "function twoInputs(uint256,uint256)",
    "function threeInputs(uint256,uint256,uint256)",
  ]);

  it("replaces calldata", function () {
    const replacer = new CalldataReplacer("test");

    const placeholder = replacer.generateUint256Placeholder("key");
    expect(
      replacer.replaceAll(
        encoder.encodeFunctionData("oneInput", [placeholder]),
        {
          key: 1337,
        },
      ),
    ).to.equal(encoder.encodeFunctionData("oneInput", [1337]));
  });

  it("replaces repeating calldata", function () {
    const replacer = new CalldataReplacer("test");

    const placeholder = replacer.generateUint256Placeholder("key");
    expect(
      replacer.replaceAll(
        encoder.encodeFunctionData("twoInputs", [placeholder, placeholder]),
        {
          key: 1337,
        },
      ),
    ).to.equal(encoder.encodeFunctionData("twoInputs", [1337, 1337]));
  });

  it("replaces multiple values", function () {
    const replacer = new CalldataReplacer("test");

    const ph1 = replacer.generateUint256Placeholder("key1");
    const ph2 = replacer.generateUint256Placeholder("key2");
    const ph3 = replacer.generateUint256Placeholder("key3");
    const replacements = { key1: 1337, key2: 31337, key3: 42 };
    // Changing the order to make sure it doesn't influence the result.
    const placeholders = [ph1, ph3, ph2];
    const actual = [1337, 42, 31337];
    expect(
      replacer.replaceAll(
        encoder.encodeFunctionData("threeInputs", placeholders),
        replacements,
      ),
    ).to.equal(encoder.encodeFunctionData("threeInputs", actual));
  });

  describe("placeholder", function () {
    it("is deterministic", function () {
      const replacer1 = new CalldataReplacer("test");
      const replacer2 = new CalldataReplacer("test");
      expect(replacer1.generateUint256Placeholder("key")).to.equal(
        replacer2.generateUint256Placeholder("key"),
      );
    });

    it("depends on seed", function () {
      const replacer1 = new CalldataReplacer("test1");
      const replacer2 = new CalldataReplacer("test2");
      expect(replacer1.generateUint256Placeholder("key")).not.to.equal(
        replacer2.generateUint256Placeholder("key"),
      );
    });
  });

  it("throws if key to replace is missing", function () {
    const replacer = new CalldataReplacer("test");

    replacer.generateUint256Placeholder("key");
    expect(() => replacer.replaceAll("", {})).to.throw(
      Error,
      "The following keys should be replaced and are missing: key",
    );
  });

  it("throws if there are extra keys to replace", function () {
    const replacer = new CalldataReplacer("test");

    expect(() => replacer.replaceAll("", { key: "1337" })).to.throw(
      Error,
      "The following keys were specified to be replaced but the corresponding placeholder was not found: key",
    );
  });

  it("throws if trying to replace a very large number", function () {
    const replacer = new CalldataReplacer("test");

    expect(() =>
      replacer.replaceAll("", { key: ethers.constants.MaxUint256.add(1) }),
    ).to.throw(
      Error,
      "Number is too large to represent in 32 bytes: 115792089237316195423570985008687907853269984665640564039457584007913129639936",
    );
  });
});
