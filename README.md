# mai3-oracle-graph

[MCDEX](https://mcdex.io/) is an AMM-based decentralized perpetual swap protocol. Perpetual swap is one of the most popular derivatives that has no expiration date, supports margin trading, and has its price soft pegged to index price.

This subgraph dynamically tracks any pool created by the mcdex factory and tracks any perpetual created by liquidity pool. It tracks of the Oracle prices of each oracle used by perpetuals.

- price minute data,
- price hour data.

## Install

update config/arb.json
update package.json settings to point to your own graph account.
```
yarn install
yarn prepare:arb
yarn codegen
yarn deploy-arb
```