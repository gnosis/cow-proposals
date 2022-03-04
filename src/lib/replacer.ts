import { BigNumber, BigNumberish, ethers, utils } from "ethers";

import { ProposalSteps } from ".";

const keccak = utils.id;

export interface Placeholder {
  value: string;
}

export type StringReplacements = Record<string, string>;
export type Replacements = Record<string, BigNumberish>;

export class CalldataReplacer {
  private placeholders: Map<string, Placeholder>;
  private seed: string;

  constructor(seed?: string) {
    this.seed = keccak(seed ?? Math.random().toString());
    this.placeholders = new Map();
  }

  generateUint256Placeholder(id: string): BigNumber {
    if (this.placeholders.has(id)) {
      throw new Error(
        `Id "${id}" has already been used to identify replacement value. Please choose a different string.`,
      );
    }

    const replacement = keccak(this.seed + id);
    this.placeholders.set(id, { value: replacement.slice(2) });
    return BigNumber.from(replacement);
  }

  replaceAllWithStrings(calldata: string, replacements: StringReplacements) {
    const placeholderKeys = [...this.placeholders.keys()];
    const replacedKeys = Object.keys(replacements);
    const missingKeys = placeholderKeys.filter(
      (key) => !replacedKeys.includes(key),
    );
    const excessKeys = replacedKeys.filter(
      (key) => !placeholderKeys.includes(key),
    );
    if (missingKeys.length !== 0) {
      throw new Error(
        `The following keys should be replaced and are missing: ${missingKeys.join(
          " ",
        )}`,
      );
    }
    if (excessKeys.length !== 0) {
      throw new Error(
        `The following keys were specified to be replaced but the corresponding placeholder was not found: ${excessKeys.join(
          " ",
        )}`,
      );
    }

    let updatedCalldata = calldata.toLowerCase();
    for (const [key, value] of Object.entries(replacements)) {
      // The checks above guarantee that the key has a placeholder.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const placeholder = this.placeholders.get(key)!;
      updatedCalldata = updatedCalldata.replace(
        new RegExp(placeholder.value, "g"),
        value,
      );
    }
    return updatedCalldata;
  }

  replaceAll(calldata: string, replacements: Replacements): string {
    const stringReplacements = Object.fromEntries(
      Object.entries(replacements).map(([key, value]) => [
        key,
        bigNumberTo32Bytes(value),
      ]),
    );

    return this.replaceAllWithStrings(calldata, stringReplacements);
  }

  private replaceAllInProposalWithMethod<
    T extends "replaceAll" | "replaceAllWithStrings",
  >(
    method: T,
    steps: ProposalSteps,
    replacements: Parameters<typeof this[T]>[1],
  ): ProposalSteps {
    return steps.map((group) =>
      group.map((step) => ({
        ...step,
        // "as any" should not be necessary but it is
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: this[method](step.data, replacements as any),
      })),
    );
  }

  replaceAllInProposal(
    steps: ProposalSteps,
    replacements: Replacements,
  ): ProposalSteps {
    return this.replaceAllInProposalWithMethod(
      "replaceAll",
      steps,
      replacements,
    );
  }

  replaceAllWithStringsInProposal(
    steps: ProposalSteps,
    replacements: StringReplacements,
  ): ProposalSteps {
    return this.replaceAllInProposalWithMethod(
      "replaceAllWithStrings",
      steps,
      replacements,
    );
  }
}

function bigNumberTo32Bytes(number: BigNumberish): string {
  const bn = BigNumber.from(number);
  if (bn.gt(ethers.constants.MaxUint256)) {
    throw new Error(`Number is too large to represent in 32 bytes: ${bn}`);
  }
  return utils.hexZeroPad(bn.toHexString(), 32).slice(2);
}
