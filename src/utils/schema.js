const writeFileAtomic = require('write-file-atomic');

/**
 * Schema version for all DWA JSON files.
 * Follows semver: breaking.feature.patch
 */
const SCHEMA_VERSION = '1.0.0';

/**
 * Write JSON data to a file with schema version prepended.
 * This is the canonical way to write .dwa/ JSON files.
 *
 * @param {string} filePath - Absolute path to the JSON file
 * @param {object} data - Data object to write (schemaVersion will be prepended)
 * @returns {Promise<void>}
 */
async function writeJsonWithSchema(filePath, data) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    ...data
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  await writeFileAtomic(filePath, jsonContent, { encoding: 'utf8' });
}

module.exports = {
  SCHEMA_VERSION,
  writeJsonWithSchema
};
