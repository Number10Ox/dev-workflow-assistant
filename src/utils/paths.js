const os = require('node:os');
const path = require('node:path');

/**
 * Get the DWA installation directory.
 * @returns {string} Path to ~/.claude/dwa
 */
function getInstallDir() {
  return path.join(os.homedir(), '.claude', 'dwa');
}

/**
 * Get the Claude skills directory.
 * @returns {string} Path to ~/.claude/skills
 */
function getSkillsDir() {
  return path.join(os.homedir(), '.claude', 'skills');
}

/**
 * Get the version file path.
 * @returns {string} Path to ~/.claude/dwa/.dwa-version
 */
function getVersionFilePath() {
  return path.join(getInstallDir(), '.dwa-version');
}

module.exports = {
  getInstallDir,
  getSkillsDir,
  getVersionFilePath
};
