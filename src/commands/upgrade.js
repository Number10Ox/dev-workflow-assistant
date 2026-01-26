const fs = require('fs-extra');
const ora = require('ora');
const semver = require('semver');
const { getInstallDir } = require('../utils/paths');
const { copySkills, copyTemplates, copyReferences } = require('../installer/copy-files');
const { readVersion, writeVersion } = require('../installer/version');
const { backupInstallation } = require('../installer/backup');

/**
 * Upgrade an existing DWA installation to the latest version.
 * Creates a backup before modifying any files.
 * @returns {Promise<void>}
 */
async function upgrade() {
  const installDir = getInstallDir();
  const spinner = ora('Checking installation...').start();

  try {
    // Check if DWA is installed
    if (!await fs.pathExists(installDir)) {
      spinner.fail('DWA not installed. Run with --install first.');
      process.exit(1);
    }

    // Read current version (fallback to 0.0.0 for pre-versioning installs)
    let current;
    try {
      current = await readVersion();
    } catch {
      // Version file missing - this is a pre-versioning install, treat as 0.0.0
      current = { dwaVersion: '0.0.0', schemaVersion: '1.0.0' };
    }
    const packageVersion = require('../../package.json').version;

    // Compare versions
    if (!semver.lt(current.dwaVersion, packageVersion)) {
      spinner.info(`Already on latest version (${current.dwaVersion})`);
      return;
    }

    spinner.text = `Upgrading from ${current.dwaVersion} to ${packageVersion}...`;

    // Create backup
    spinner.text = 'Creating backup...';
    const backupDir = await backupInstallation(installDir);

    // Update files with overwrite enabled
    spinner.text = 'Updating skills...';
    await copySkills(undefined, { overwrite: true });

    spinner.text = 'Updating templates...';
    await copyTemplates(undefined, { overwrite: true });

    spinner.text = 'Updating references...';
    await copyReferences(undefined, { overwrite: true });

    // Write new version (preserves schemaVersion via writeJsonWithSchema)
    await writeVersion(packageVersion);

    spinner.succeed(`Upgraded from ${current.dwaVersion} to ${packageVersion}`);
    console.log(`\n  Backup saved to: ${backupDir}\n`);
  } catch (error) {
    spinner.fail('Upgrade failed: ' + error.message);
    console.log('Restore from backup if needed.');
    process.exit(1);
  }
}

module.exports = {
  upgrade
};
