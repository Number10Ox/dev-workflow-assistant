const fs = require('fs-extra');
const ora = require('ora');
const { getInstallDir, getSkillsDir } = require('../utils/paths');
const { copySkills, copyTemplates, copyReferences } = require('../installer/copy-files');
const { writeVersion } = require('../installer/version');

const packageVersion = require('../../package.json').version;

/**
 * Install DWA to the user's home directory.
 * Creates install directory with templates and references.
 * Copies skills to skills directory.
 * Writes version file with schemaVersion, dwaVersion, and installedAt.
 * @returns {Promise<void>}
 */
async function install() {
  const spinner = ora('Installing DWA...').start();

  try {
    // Check if already installed
    if (await fs.pathExists(getInstallDir())) {
      spinner.fail('DWA already installed. Use --upgrade to update.');
      process.exit(1);
    }

    // Create install directory
    await fs.ensureDir(getInstallDir());

    // Copy skills
    spinner.text = 'Copying skills...';
    await copySkills();

    // Copy templates
    spinner.text = 'Copying templates...';
    await copyTemplates();

    // Copy references
    spinner.text = 'Copying references...';
    await copyReferences();

    // Write version info
    spinner.text = 'Writing version info...';
    await writeVersion(packageVersion);

    // Success!
    spinner.succeed('DWA installed successfully!');

    console.log(`\n  Install directory: ${getInstallDir()}`);
    console.log(`  Skills directory:  ${getSkillsDir()}`);
    console.log('\n  Run /dwa:* commands in Claude Code to get started.\n');
  } catch (error) {
    spinner.fail('Installation failed: ' + error.message);
    process.exit(1);
  }
}

module.exports = {
  install
};
