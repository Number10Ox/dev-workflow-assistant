const fs = require('fs-extra');
const { getVersionFilePath } = require('../utils/paths');
const { SCHEMA_VERSION, writeJsonWithSchema } = require('../utils/schema');

/**
 * Read the current .dwa-version file.
 * @returns {Promise<object>} Version object with dwaVersion and schemaVersion
 */
async function readVersion() {
  const versionPath = getVersionFilePath();

  if (!await fs.pathExists(versionPath)) {
    throw new Error('Version file not found. DWA may not be installed.');
  }

  const content = await fs.readJson(versionPath);
  return {
    dwaVersion: content.dwaVersion,
    schemaVersion: content.schemaVersion
  };
}

/**
 * Write a new .dwa-version file with the given DWA version.
 * @param {string} dwaVersion - The DWA version to write
 * @returns {Promise<void>}
 */
async function writeVersion(dwaVersion) {
  const versionPath = getVersionFilePath();
  await writeJsonWithSchema(versionPath, {
    dwaVersion,
    installedAt: new Date().toISOString()
  });
}

module.exports = {
  readVersion,
  writeVersion
};
