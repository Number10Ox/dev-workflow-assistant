/**
 * Bridge client for calling devex-service-bridge via VS Code extension API.
 *
 * DWA does NOT call Linear SDK directly. All issue tracker operations
 * go through the bridge, enabling provider-agnostic sync (Linear, JIRA, etc.).
 */

const vscode = require('vscode');

const BRIDGE_EXTENSION_IDS = [
  'jedwards.devex-service-bridge',
  'devex-service-bridge'  // Development mode (no publisher prefix)
];

const LINEAR_PROVIDER_IDS = [
  'jedwards.linear-tracker-provider',
  'linear-tracker-provider'  // Development mode
];

/**
 * Bridge client wrapper for VS Code extension API.
 */
class BridgeClient {
  constructor() {
    this.tracker = null;
    this.capabilities = null;
  }

  /**
   * Initialize the bridge client by discovering and activating the provider.
   *
   * @returns {Promise<void>}
   * @throws {Error} If bridge or provider not found
   */
  async initialize() {
    // Try to find and activate a provider
    for (const providerId of LINEAR_PROVIDER_IDS) {
      const ext = vscode.extensions.getExtension(providerId);

      if (!ext) {
        continue;
      }

      try {
        if (!ext.isActive) {
          await ext.activate();
        }

        const api = ext.exports;
        if (api && this.isValidTracker(api)) {
          this.tracker = api;
          console.log(`DWA: Connected to issue tracker provider: ${providerId}`);
          return;
        }
      } catch (error) {
        console.error(`DWA: Failed to activate provider ${providerId}:`, error);
      }
    }

    throw new Error(
      'No issue tracker provider found. Install the linear-tracker-provider extension ' +
      'and configure your Linear API key in settings.'
    );
  }

  /**
   * Check if API has required methods.
   */
  isValidTracker(api) {
    if (!api || typeof api !== 'object') return false;
    return (
      typeof api.createIssue === 'function' &&
      typeof api.updateIssue === 'function' &&
      typeof api.getIssue === 'function' &&
      typeof api.queryByExternalId === 'function'
    );
  }

  /**
   * Check capabilities and required features.
   *
   * @param {string[]} requiredFeatures - Features that must be supported
   * @returns {{ supported: boolean, missing: string[] }}
   */
  checkCapabilities(requiredFeatures = ['externalId', 'queryByExternalId']) {
    // For now, check based on method presence
    const missing = [];

    if (requiredFeatures.includes('queryByExternalId')) {
      if (!this.tracker || typeof this.tracker.queryByExternalId !== 'function') {
        missing.push('queryByExternalId');
      }
    }

    return {
      supported: missing.length === 0,
      missing
    };
  }

  /**
   * Create an issue via the bridge.
   *
   * @param {object} input - Issue create input
   * @returns {Promise<object>} Created issue
   */
  async createIssue(input) {
    if (!this.tracker) {
      throw new Error('Bridge client not initialized. Call initialize() first.');
    }
    return this.tracker.createIssue(input);
  }

  /**
   * Update an issue via the bridge.
   *
   * @param {string} id - Issue ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated issue
   */
  async updateIssue(id, updates) {
    if (!this.tracker) {
      throw new Error('Bridge client not initialized. Call initialize() first.');
    }
    return this.tracker.updateIssue(id, updates);
  }

  /**
   * Query for an issue by external ID.
   *
   * @param {string} externalId - External ID to search for
   * @returns {Promise<object | null>} Issue or null if not found
   */
  async queryByExternalId(externalId) {
    if (!this.tracker) {
      throw new Error('Bridge client not initialized. Call initialize() first.');
    }
    return this.tracker.queryByExternalId(externalId);
  }

  /**
   * Get an issue by ID.
   *
   * @param {string} id - Issue ID
   * @returns {Promise<object>} Issue
   */
  async getIssue(id) {
    if (!this.tracker) {
      throw new Error('Bridge client not initialized. Call initialize() first.');
    }
    return this.tracker.getIssue(id);
  }
}

module.exports = {
  BridgeClient,
  BRIDGE_EXTENSION_IDS,
  LINEAR_PROVIDER_IDS
};
