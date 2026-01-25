/**
 * Compute provenance information for execution packets.
 *
 * Provenance tracks:
 * - Git SHA for spec and TDD files
 * - Registry revision (HEAD commit)
 * - Packet generator version
 * - Generation timestamp
 */

const { execSync } = require('node:child_process');
const path = require('path');
const fs = require('fs-extra');

/**
 * Get git SHA for a file.
 *
 * @param {string} projectRoot - Project root directory
 * @param {string} filePath - Relative path to file
 * @returns {string|null} Git SHA or null if not in git
 */
function getFileSha(projectRoot, filePath) {
  try {
    const fullPath = path.join(projectRoot, filePath);

    // Check if file exists
    if (!fs.pathExistsSync(fullPath)) {
      return null;
    }

    // Try to get git log for the file
    const sha = execSync(`git log -1 --format=%H -- "${filePath}"`, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    return sha || null;
  } catch {
    // File not in git or not a git repo
    return null;
  }
}

/**
 * Get current HEAD SHA for the repository.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {string|null} HEAD SHA or null if not a git repo
 */
function getHeadSha(projectRoot) {
  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    return sha || null;
  } catch {
    return null;
  }
}

/**
 * Get packet generator version from package.json.
 *
 * @returns {string} Version string
 */
function getGeneratorVersion() {
  try {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = fs.readJSONSync(packageJsonPath);
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Compute provenance information for a packet.
 *
 * @param {string} projectRoot - Project root directory
 * @param {string} specPath - Relative path to spec file
 * @param {string} tddPath - Relative path to TDD file (can be null)
 * @returns {Promise<{
 *   spec: {path: string, sha: string|null},
 *   tdd: {path: string, sha: string|null},
 *   registry_sha: string|null,
 *   generator_version: string,
 *   generated_at: string
 * }>}
 */
async function computeProvenance(projectRoot, specPath, tddPath) {
  return {
    spec: {
      path: specPath,
      sha: getFileSha(projectRoot, specPath)
    },
    tdd: {
      path: tddPath || 'N/A',
      sha: tddPath ? getFileSha(projectRoot, tddPath) : null
    },
    registry_sha: getHeadSha(projectRoot),
    generator_version: getGeneratorVersion(),
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  computeProvenance,
  getFileSha,
  getHeadSha,
  getGeneratorVersion
};
