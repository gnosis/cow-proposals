import { promises as fs } from "fs";

import { task } from "hardhat/config";

import {
  generateMakeSwappableProposal,
  MakeSwappableSettings,
} from "./proposal";

const OUTPUT_FOLDER = "./output/make-swappable";

interface Args {
  settings: string;
}

const setupMakeSwappableTask: () => void = () => {
  task(
    "make-swappable",
    "Generate the steps that need to be proposed to the CoW DAO in order to make the vCOW token swappable to COW",
  )
    .addParam(
      "settings",
      "Path to the JSON file that contains the deployment settings.",
    )
    .setAction(makeSwappable);
};

export { setupMakeSwappableTask };

async function makeSwappable({ settings: settingsJson }: Args): Promise<void> {
  console.log("Processing input files...");
  // TODO: validate settings
  const settings: MakeSwappableSettings = JSON.parse(
    await fs.readFile(settingsJson, "utf8"),
  );

  const { replacer, stepsWithPlaceholders } =
    await generateMakeSwappableProposal(settings);

  const replacements: Record<string, string> = {};
  if (settings.atomsToTransfer === undefined) {
    replacements.atomsToTransfer = "x".repeat(64);
  }
  if (settings.bridged.atomsToTransfer === undefined) {
    replacements.atomsToBridge = "y".repeat(64);
  }
  const steps = replacer.replaceAllWithStringsInProposal(
    stepsWithPlaceholders,
    replacements,
  );

  console.log("Clearing old files...");
  await fs.rm(`${OUTPUT_FOLDER}/steps.json`, { recursive: true, force: true });

  console.log("Saving generated data to file...");
  await fs.mkdir(OUTPUT_FOLDER, { recursive: true });
  await fs.writeFile(
    `${OUTPUT_FOLDER}/steps.json`,
    JSON.stringify(steps, undefined, 2),
  );
}
