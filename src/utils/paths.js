const os = require('node:os');
const path = require('node:path');

/**
 * Get the home directory, with test override support.
 * @returns {string} Path to home directory
 */
function homeDir() {
  return process.env.DWA_TEST_HOME || os.homedir();
}

/**
 * Get the DWA installation directory.
 * @returns {string} Path to ~/.claude/dwa
 */
function getInstallDir() {
  return path.join(homeDir(), '.claude', 'dwa');
}

/**
 * Get the Claude skills directory.
 * @returns {string} Path to ~/.claude/skills
 */
function getSkillsDir() {
  return path.join(homeDir(), '.claude', 'skills');
}

/**
 * Get the version file path.
 * @returns {string} Path to ~/.claude/dwa/.dwa-version
 */
function getVersionFilePath() {
  return path.join(getInstallDir(), '.dwa-version');
}

/**
 * Get the templates directory (installed location).
 * @returns {string} Path to ~/.claude/dwa/templates
 */
function getTemplatesDir() {
  return path.join(getInstallDir(), 'templates');
}

/**
 * Get the package templates directory (source location).
 * Used during scaffolding from the package source before install copies them.
 * @returns {string} Path to package templates/ directory
 */
function getPackageTemplatesDir() {
  return path.join(__dirname, '..', '..', 'templates');
}

module.exports = {
  getInstallDir,
  getSkillsDir,
  getVersionFilePath,
  getTemplatesDir,
  getPackageTemplatesDir
};
