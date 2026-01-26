/**
 * Runtime feature detection and setup instructions.
 *
 * Provides graceful degradation when optional features aren't configured.
 */

const FEATURES = {
  linear: {
    name: 'Linear Integration',
    description: 'Sync deliverables to Linear issues',
    providerIds: ['jedwards.linear-tracker-provider', 'linear-tracker-provider'],
    setupCommand: 'dwa setup --linear',
    setupInstructions: `
Linear integration requires the linear-tracker-provider extension.

To set up:
  1. Run: dwa setup --linear

Or manually:
  1. Install extension: code --install-extension jedwards.linear-tracker-provider
  2. Configure API key in VS Code settings: dwa.linear.apiKey
`.trim()
  },
  googleDocs: {
    name: 'Google Docs Import',
    description: 'Import specs from Google Docs',
    providerIds: ['jedwards.gworkspace-provider', 'gworkspace-provider'],
    setupCommand: 'dwa setup --google-docs',
    setupInstructions: `
Google Docs import requires the gworkspace-provider extension.

To set up:
  1. Run: dwa setup --google-docs

Or manually:
  1. Install extension: code --install-extension jedwards.gworkspace-provider
  2. Authenticate via the extension's OAuth flow
`.trim()
  }
};

/**
 * Check if a feature is available.
 *
 * @param {string} featureId - Feature identifier (linear, googleDocs)
 * @returns {{ available: boolean, reason?: string }}
 */
function checkFeature(featureId) {
  const feature = FEATURES[featureId];
  if (!feature) {
    return { available: false, reason: `Unknown feature: ${featureId}` };
  }

  // Check if we're in VS Code context
  // In Node.js/CLI context, we can't check extensions - assume not available
  try {
    const vscode = require('vscode');

    if (!vscode.extensions) {
      return {
        available: false,
        reason: 'Not running in VS Code context'
      };
    }

    // Check if any provider extension is available
    for (const providerId of feature.providerIds) {
      const ext = vscode.extensions.getExtension(providerId);
      if (ext) {
        return { available: true };
      }
    }

    return {
      available: false,
      reason: `${feature.name} extension not installed`
    };
  } catch (err) {
    // vscode module not available (running in CLI)
    return {
      available: false,
      reason: 'Not running in VS Code context'
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
  FEATURES
};
