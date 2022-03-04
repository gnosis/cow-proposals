# Make vCOW token swappable for COW

The vCOW token can be swapped one to one to COW tokens.
This is made possible by a proposal to the Cow DAO.

The steps of the proposal can be generated with:

```
export INFURA_KEY='your Infura key here'
npx hardhat make-swappable --settings ./settings.json --network mainnet 
```

The file `settings.json` included in this repo is the one that will be used in the proposal.

If the values for `atomsToTransfer` or `bridged.atomsToTransfer` are not included in the settings file, placeholder strings will be used in place of the expected amounts.

The output files are in the `output/deployment` folder, which include:
1. `steps.json`, a list of transactions to be executed from the Cow DAO in the proposal.
