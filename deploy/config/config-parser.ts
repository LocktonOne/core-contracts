import fs from "fs";

export const getConfigJson = () => {
  const configPath = process.env.CONFIG_FILE_PATH;
  if (!configPath) {
    throw new Error(`Config path is not defined`);
  }
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file under path ${configPath} does not exist`);
  }

  const rawConfig = fs.readFileSync(configPath);

  return JSON.parse(rawConfig.toString());
};
