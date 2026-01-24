const fs = require('fs-extra');
const path = require('node:path');
const ora = require('ora');
const { getInstallDir, getSkillsDir } = require('../utils/paths');

/**
 * Uninstall DWA by removing the installation directory and skill directories.
 * Only removes directories prefixed with 'dwa-' to avoid collateral damage.
 * @returns {Promise<void>}
 */
async function uninstall() {
  const installDir = getInstallDir();
  const skillsDir = getSkillsDir();
  const spinner = ora('Uninstalling DWA...').start();

  try {
    let removedInstall = false;
    let removedSkills = 0;

    // Remove installation directory
    if (await fs.pathExists(installDir)) {
      await fs.remove(installDir);
      removedInstall = true;
    }

    // Remove skill directories (only dwa-* prefixed)
    if (await fs.pathExists(skillsDir)) {
      const entries = await fs.readdir(skillsDir);
      const dwaSkills = entries.filter(e => e.startsWith('dwa-'));

      for (const dir of dwaSkills) {
        await fs.remove(path.join(skillsDir, dir));
      }

      removedSkills = dwaSkills.length;
    }

    // If nothing was found, inform user
    if (!removedInstall && removedSkills === 0) {
      spinner.info('DWA was not installed. Nothing to remove.');
      return;
    }

    // Success - show what was removed
    spinner.succeed('DWA uninstalled successfully');

    if (removedInstall) {
      console.log(`  Removed: ${installDir}`);
    }

    if (removedSkills > 0) {
      console.log(`  Removed: ${removedSkills} skill(s) from ${skillsDir}`);
    }

    console.log('');
  } catch (error) {
    spinner.fail('Uninstall failed: ' + error.message);
    process.exit(1);
  }
}

module.exports = {
  uninstall
};
