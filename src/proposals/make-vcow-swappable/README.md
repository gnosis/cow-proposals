# Make vCOW token swappable for COW

The vCOW token can be swapped one to one to COW tokens.
This is made possible by a proposal to the Cow DAO.

The steps of the proposal can be generated with:

```
export INFURA_KEY='your Infura key here'
npx hardhat make-swappable --settings ./settings.json --network mainnet 
```

The file `settings.json` included in this repo is the one that will be used in the proposal.

This script is deterministic and can be used to verify the transactions proposed to the Cow DAO by comparing the transaction hashes.

The output files are in the `output/deployment` folder, which include:
1. `steps.json`, a list of transactions to be executed from the Cow DAO in the proposal.
2. `txhashes.json`, the hashes of all transactions appearing in the proposal. They can be used to verify that the proposal was created correctly.
