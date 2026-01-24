const fs = require('fs-extra');
const path = require('node:path');
const { getInstallDir, getSkillsDir } = require('../utils/paths');

/**
 * Copy skills from source directory to ~/.claude/skills/
 * @param {string} sourceDir - Source skills directory (defaults to project skills/)
 * @returns {Promise<string[]>} Array of copied skill directory names
 */
async function copySkills(sourceDir = path.join(__dirname, '../../skills')) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const copied = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(getSkillsDir(), entry.name);

      await fs.copy(sourcePath, targetPath, {
        overwrite: false,
        errorOnExist: false
      });

      copied.push(entry.name);
    }
  }

  return copied;
}

/**
 * Copy templates from source directory to ~/.claude/dwa/templates/
 * @param {string} sourceDir - Source templates directory (defaults to project templates/)
 * @returns {Promise<void>}
 */
async function copyTemplates(sourceDir = path.join(__dirname, '../../templates')) {
  const targetPath = path.join(getInstallDir(), 'templates');
  await fs.copy(sourceDir, targetPath, { overwrite: false });
}

/**
 * Copy references from source directory to ~/.claude/dwa/references/
 * @param {string} sourceDir - Source references directory (defaults to project references/)
 * @returns {Promise<void>}
 */
async function copyReferences(sourceDir = path.join(__dirname, '../../references')) {
  const targetPath = path.join(getInstallDir(), 'references');
  await fs.copy(sourceDir, targetPath, { overwrite: false });
}

module.exports = {
  copySkills,
  copyTemplates,
  copyReferences
};
