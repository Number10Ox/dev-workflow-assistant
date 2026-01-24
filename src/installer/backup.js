const fs = require('fs-extra');

/**
 * Create a timestamped backup of the DWA installation directory.
 * @param {string} installDir - Path to the installation directory
 * @returns {Promise<string>} Path to the created backup directory
 */
async function backupInstallation(installDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${installDir}.backup.${timestamp}`;

  await fs.copy(installDir, backupDir, {
    errorOnExist: true,
    preserveTimestamps: true
  });

  return backupDir;
}

module.exports = {
  backupInstallation
};
