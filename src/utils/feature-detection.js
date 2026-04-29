/**
 * Runtime feature detection and setup instructions.
 *
 * Provides graceful degradation when optional features aren't configured.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FEATURES = {
  linear: {
    name: 'Linear Integration',
    description: 'Sync deliverables to Linear issues',
    providerIds: ['jedwards.linear-tracker-provider', 'linear-tracker-provider'],
    setupCommand: 'dwa --setup linear',
    setupInstructions: `
Linear integration is available via two paths:

  Direct mode (no VS Code):
    1. Run: dwa --setup linear --mode=direct
    2. Paste your Linear API key when prompted

  VS Code bridge:
    1. Run: dwa --setup linear --mode=vscode-bridge
    2. Configure the key under "Linear Tracker" in VS Code settings
`.trim()
  },
  googleDocs: {
    name: 'Google Docs Import',
    description: 'Import specs from Google Docs',
    providerIds: ['jedwards.gworkspace-provider', 'gworkspace-provider'],
    setupCommand: 'dwa --setup google-docs',
    setupInstructions: `
Google Docs import requires the gworkspace-provider extension.

To set up:
  1. Run: dwa --setup google-docs

Or manually:
  1. Install extension: code --install-extension jedwards.gworkspace-provider
  2. Authenticate via the extension's OAuth flow
`.trim()
  }
};

/**
 * Synchronous check for a Linear API key in env or ~/.dwa/config.json.
 * Used by checkFeature so it can stay sync. Mirrors src/linear/config.js
 * but without the async fs-extra dependency.
 */
function hasDirectLinearConfig() {
  if (process.env.LINEAR_API_KEY) return true;
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const configPath = path.join(home, '.dwa', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    return Boolean(cfg?.linear?.apiKey);
  } catch {
    return false;
  }
}

/**
 * Check if a feature is available.
 *
 * @param {string} featureId - Feature identifier (linear, googleDocs)
 * @returns {{ available: boolean, mode?: 'direct'|'vscode-bridge', reason?: string }}
 */
function checkFeature(featureId) {
  const feature = FEATURES[featureId];
  if (!feature) {
    return { available: false, reason: `Unknown feature: ${featureId}` };
  }

  // Linear has a non-VSCode "direct" mode. Honor an explicit override first.
  if (featureId === 'linear') {
    const forced = process.env.DWA_LINEAR_MODE;
    if (forced === 'direct') {
      return hasDirectLinearConfig()
        ? { available: true, mode: 'direct' }
        : { available: false, reason: 'DWA_LINEAR_MODE=direct but no Linear API key configured. Run `dwa --setup linear --mode=direct`.' };
    }
    if (hasDirectLinearConfig() && forced !== 'bridge') {
      return { available: true, mode: 'direct' };
    }
  }

  // VS Code bridge probe.
  try {
    const vscode = require('vscode');

    if (!vscode.extensions) {
      return {
        available: false,
        reason: 'Not running in VS Code context (and no direct config found)'
      };
    }

    for (const providerId of feature.providerIds) {
      const ext = vscode.extensions.getExtension(providerId);
      if (ext) {
        return { available: true, mode: 'vscode-bridge' };
      }
    }

    return {
      available: false,
      reason: `${feature.name} extension not installed`
    };
  } catch (err) {
    return {
      available: false,
      reason: 'Not running in VS Code context (and no direct config found)'
    };
  }
}

/**
 * Get setup instructions for a feature.
 *
 * @param {string} featureId - Feature identifier
 * @returns {string} Setup instructions
 */
function getSetupInstructions(featureId) {
  const feature = FEATURES[featureId];
  return feature?.setupInstructions || `Unknown feature: ${featureId}`;
}

/**
 * Get all features and their status.
 *
 * @returns {object[]} Feature status array
 */
function getAllFeatureStatus() {
  return Object.entries(FEATURES).map(([id, feature]) => ({
    id,
    ...feature,
    ...checkFeature(id)
  }));
}

module.exports = {
  checkFeature,
  getSetupInstructions,
  getAllFeatureStatus,
  hasDirectLinearConfig,
  FEATURES
};
