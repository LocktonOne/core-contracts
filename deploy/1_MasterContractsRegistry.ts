import { ethers } from "hardhat";

import { Deployer } from "@solarity/hardhat-migrate";

import { ERC1967Proxy__factory, MasterContractsRegistry__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const provider = ethers.getDefaultProvider(await deployer.getChainId());
  process.env.START_MIGRATIONS_BLOCK = (await provider.getBlockNumber()).toString();

  const registry = await deployer.deploy(MasterContractsRegistry__factory);

  await deployer.deploy(ERC1967Proxy__factory, [await registry.getAddress(), "0x"], {
    name: "MasterContractsRegistry Proxy",
  });
};
