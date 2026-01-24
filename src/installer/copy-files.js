const fs = require('fs-extra');
const path = require('node:path');
const { getInstallDir, getSkillsDir } = require('../utils/paths');

/**
 * Copy skills from source to ~/.claude/skills/dwa-*
 * @param {string} sourceDir - Source directory (defaults to package skills/)
 * @param {object} options - Options object
 * @param {boolean} options.overwrite - Whether to overwrite existing files (default: false)
 * @returns {Promise<void>}
 */
async function copySkills(sourceDir, options = {}) {
  sourceDir = sourceDir || path.join(__dirname, '../../skills');
  const targetDir = getSkillsDir();

  await fs.ensureDir(targetDir);

  // Copy each skill directory from skills/ to ~/.claude/skills/
  const skillDirs = await fs.readdir(sourceDir);
  for (const dir of skillDirs) {
    const sourcePath = path.join(sourceDir, dir);
    const targetPath = path.join(targetDir, dir);

    // Only process directories
    const stat = await fs.stat(sourcePath);
    if (!stat.isDirectory()) continue;

    await fs.copy(sourcePath, targetPath, {
      overwrite: options.overwrite || false,
      errorOnExist: !options.overwrite
    });
  }
}

/**
 * Copy templates from source to ~/.claude/dwa/templates/
 * @param {string} sourceDir - Source directory (defaults to package templates/)
 * @param {object} options - Options object
 * @param {boolean} options.overwrite - Whether to overwrite existing files (default: false)
 * @returns {Promise<void>}
 */
async function copyTemplates(sourceDir, options = {}) {
  sourceDir = sourceDir || path.join(__dirname, '../../templates');
  const targetDir = path.join(getInstallDir(), 'templates');

  await fs.copy(sourceDir, targetDir, {
    overwrite: options.overwrite || false,
    errorOnExist: !options.overwrite
  });
}

/**
 * Copy references from source to ~/.claude/dwa/references/
 * @param {string} sourceDir - Source directory (defaults to package references/)
 * @param {object} options - Options object
 * @param {boolean} options.overwrite - Whether to overwrite existing files (default: false)
 * @returns {Promise<void>}
 */
async function copyReferences(sourceDir, options = {}) {
  sourceDir = sourceDir || path.join(__dirname, '../../references');
  const targetDir = path.join(getInstallDir(), 'references');

  await fs.copy(sourceDir, targetDir, {
    overwrite: options.overwrite || false,
    errorOnExist: !options.overwrite
  });
}

module.exports = {
  copySkills,
  copyTemplates,
  copyReferences
};
