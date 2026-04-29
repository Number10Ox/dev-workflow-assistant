/**
 * User-global Linear configuration (`~/.dwa/config.json`).
 *
 * Distinct from `<project>/.dwa/config.json` (project-local, holds linear_project_id).
 * This file holds per-user credentials shared across DWA projects on this machine.
 *
 * Schema (namespaced from day one for future integrations):
 *   {
 *     "schemaVersion": 1,
 *     "linear": { "apiKey": "lin_api_..." }
 *   }
 */

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');

const CONFIG_SCHEMA_VERSION = 1;

function getConfigPath() {
  return path.join(os.homedir(), '.dwa', 'config.json');
}

async function loadConfig() {
  const configPath = getConfigPath();
  if (!(await fs.pathExists(configPath))) {
    return null;
  }
  try {
    return await fs.readJSON(configPath);
  } catch {
    return null;
  }
}

/**
 * Resolve Linear API key from env or user config file.
 *
 * Priority: LINEAR_API_KEY env var → ~/.dwa/config.json → null
 */
async function loadApiKey() {
  if (process.env.LINEAR_API_KEY) {
    return process.env.LINEAR_API_KEY;
  }
  const config = await loadConfig();
  return config?.linear?.apiKey || null;
}

/**
 * Persist a Linear API key to ~/.dwa/config.json.
 *
 * Sets file mode 0600 on POSIX. On Windows, chmod is effectively a no-op
 * (NTFS uses ACLs); a warning is emitted to make the user aware the file
 * is not OS-protected.
 */
async function saveApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('saveApiKey: apiKey must be a non-empty string');
  }

  const configPath = getConfigPath();
  await fs.ensureDir(path.dirname(configPath));

  const existing = (await loadConfig()) || {};
  const next = {
    ...existing,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    linear: { ...(existing.linear || {}), apiKey }
  };

  await writeFileAtomic(configPath, JSON.stringify(next, null, 2) + '\n');

  if (process.platform === 'win32') {
    console.warn(
      `Note: ${configPath} is not protected by OS file permissions on Windows. ` +
      `NTFS uses ACLs rather than POSIX file modes. Consider setting an ACL ` +
      `manually if other users have access to this machine.`
    );
  } else {
    await fs.chmod(configPath, 0o600);
  }
}

module.exports = {
  CONFIG_SCHEMA_VERSION,
  getConfigPath,
  loadConfig,
  loadApiKey,
  saveApiKey
};
