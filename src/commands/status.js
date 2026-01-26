/**
 * Display DWA configuration status.
 *
 * Shows which features are installed and configured.
 */

const fs = require('fs-extra');
const { getInstallDir, getVersionFilePath } = require('../utils/paths');
const { getAllFeatureStatus } = require('../utils/feature-detection');

/**
 * Display status of DWA installation and features.
 *
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function status() {
  const lines = [];

  lines.push('\n┌─────────────────────────────────────────────────┐');
  lines.push('│           DWA Status                            │');
  lines.push('└─────────────────────────────────────────────────┘\n');

  // Check installation
  const installDir = getInstallDir();
  const versionPath = getVersionFilePath();

  if (!await fs.pathExists(installDir)) {
    lines.push('Status: NOT INSTALLED');
    lines.push('\nRun: npx dwa --install');
    console.log(lines.join('\n'));
    return { success: true, message: 'Not installed' };
  }

  // Read version
  let version = 'unknown';
  if (await fs.pathExists(versionPath)) {
    const versionData = await fs.readJSON(versionPath);
    version = versionData.dwaVersion || 'unknown';
  }

  lines.push(`Status: INSTALLED (v${version})`);
  lines.push(`Location: ${installDir}`);
  lines.push('');

  // Core features (always available when installed)
  lines.push('Core Features:');
  lines.push('  ✓ scaffold    Create feature specs');
  lines.push('  ✓ parse       Extract deliverables to registry');
  lines.push('  ✓ packet      Generate execution packets');
  lines.push('  ✓ complete    Mark deliverables complete');
  lines.push('');

  // Optional features
  lines.push('Optional Features:');

  const features = getAllFeatureStatus();
  for (const feature of features) {
    const status = feature.available ? '✓' : '○';
    const hint = feature.available ? '' : ` (run: ${feature.setupCommand})`;
    lines.push(`  ${status} ${feature.name}${hint}`);
  }

  lines.push('');
  lines.push('Run \'dwa setup\' to configure optional features.');

  console.log(lines.join('\n'));
  return { success: true, message: 'Status displayed' };
}

module.exports = {
  status
};
