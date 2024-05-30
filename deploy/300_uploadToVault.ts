import { Deployer } from "@solarity/hardhat-migrate";
import { getConfigJson } from "./config/config-parser";
import { MasterContractsRegistry__factory } from "@/generated-types";

module.exports = async (deployer: Deployer) => {
  if (process.env.VAULT_DISABLED && process.env.VAULT_DISABLED === 'true') return
  const vault = require("node-vault")({
    apiVersion: "v1",
    endpoint: process.env.VAULT_ENDPOINT,
    token: process.env.VAULT_TOKEN,
  });
  
  const registry = await deployer.deployed(
    MasterContractsRegistry__factory,
    "MasterContractsRegistry Proxy"
  );

  const masterAccessAddress = await registry.getMasterAccessManagement();
  const constantsRegistryAddress = await registry.getConstantsRegistry();
  const reviewableRequestsAddress = await registry.getReviewableRequests();
  const multicallAddress = await registry.getMulticall();

  const projectName = getConfigJson().projectName;

  if (projectName == undefined) {
    throw new Error("uploadToVault: projectName is undefined");
  }

  const config = {
    projectName: projectName,
    addresses: {
      ConstantsRegistry: constantsRegistryAddress,
      MasterContractsRegistry: registry.getAddress(),
      MasterAccessManagement: masterAccessAddress,
      ReviewableRequests: reviewableRequestsAddress,
      Multicall: multicallAddress,
    },
  };

  await vault.write(process.env.VAULT_UPLOAD_CONFIG_PATH, { data: config });
};
