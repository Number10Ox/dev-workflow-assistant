/**
 * Bridge client for calling devex-service-bridge gworkspace-provider via VS Code extension API.
 *
 * DWA does NOT call Google Docs/Drive API directly. All document access operations
 * go through the bridge, maintaining separation of concerns.
 *
 * Uses capability handshake (not method checks) to validate provider features.
 * Uses dependency injection for vscode module to enable Node.js testing.
 */

const WORKSPACE_PROVIDER_IDS = [
  'jedwards.gworkspace-provider',
  'gworkspace-provider'  // Development mode (no publisher prefix)
];

const REQUIRED_CAPABILITIES = ['docs.readDocument', 'docs.getDocumentInfo'];

/**
 * Capability handshake schema contract.
 * Provider must expose this structure; incompatible versions are rejected.
 *
 * @typedef {Object} CapabilityHandshake
 * @property {string} version - Semantic version (e.g., "1.0")
 * @property {string[]} features - Array of feature strings (e.g., "docs.readDocument")
 * @property {string} providerId - Provider identifier for logging
 */

/**
 * Bridge client wrapper for VS Code extension API.
 * Uses dependency injection: pass { vscode } in constructor for testing.
 */
class GoogleWorkspaceBridgeClient {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} [options.vscode] - VS Code API module (injected for testing)
   */
  constructor(options = {}) {
    this.provider = null;
    // Dependency injection: use provided vscode or lazy-require it
    // This allows tests to run in Node.js without extension host
    this._vscode = options.vscode || null;
  }

  /**
   * Get vscode module (lazy-load if not injected).
   * @private
   */
  _getVscode() {
    if (!this._vscode) {
      this._vscode = require('vscode');
    }
    return this._vscode;
  }

  /**
   * Initialize the bridge client by discovering and activating the provider.
   * Uses capability handshake to validate features.
   *
   * @returns {Promise<void>}
   * @throws {Error} If provider not found or missing required capabilities
   */
  async initialize() {
    const vscode = this._getVscode();

    for (const extensionId of WORKSPACE_PROVIDER_IDS) {
      const ext = vscode.extensions.getExtension(extensionId);

      if (!ext) {
        continue;
      }

      try {
        if (!ext.isActive) {
          await ext.activate();
        }

        const api = ext.exports;

        // Capability handshake instead of method check
        if (this.hasRequiredCapabilities(api)) {
          this.provider = api;
          console.log(`DWA: Connected to Google Workspace provider: ${extensionId} v${api.capabilities.version}`);
          return;
        }
      } catch (error) {
        console.error(`DWA: Failed to activate provider ${extensionId}:`, error);
      }
    }

    throw new Error(
      'Google Workspace provider not found or missing required capabilities. ' +
      'Run: DevEx Service Bridge: Run Setup Wizard'
    );
  }

  /**
   * Validate provider has required capabilities and compatible version.
   * @param {Object} api - Provider API with capabilities object
   * @returns {boolean} True if compatible
   */
  hasRequiredCapabilities(api) {
    if (!api?.capabilities?.features) return false;
    if (!api?.capabilities?.version) return false;

    // Version compatibility check: require major version 1.x
    const version = api.capabilities.version;
    const major = parseInt(version.split('.')[0], 10);
    if (isNaN(major) || major !== 1) {
      console.warn(`DWA: Incompatible provider version: ${version} (expected 1.x)`);
      return false;
    }
    return REQUIRED_CAPABILITIES.every(cap => api.capabilities.features.includes(cap));
  }

  /**
   * Check if Google Workspace access is available.
   *
   * @returns {Promise<{ available: boolean, error?: string, setupInstructions?: string }>}
   */
  async checkAvailability() {
    if (!this.provider) {
      return {
        available: false,
        error: 'Provider not initialized',
        setupInstructions: 'Run DevEx Service Bridge setup wizard to configure Google Workspace access.'
      };
    }
    return this.provider.checkAvailability();
  }

  /**
   * Read a Google Doc and return raw JSON structure.
   * Uses namespaced API: provider.docs.readDocument()
   *
   * @param {string} docId - Google Docs document ID
   * @returns {Promise<object>} Raw Google Docs API v1 Document structure with etag/modifiedTime
   */
  async readDocument(docId) {
    if (!this.provider) {
      throw new Error('Bridge client not initialized. Call initialize() first.');
    }
    return this.provider.docs.readDocument(docId);
  }

  /**
   * Get document metadata without full content.
   * Includes etag and modifiedTime for robust change detection.
   *
   * @param {string} docId - Google Docs document ID
   * @returns {Promise<{ id: string, title: string, revisionId?: string, etag?: string, modifiedTime?: string }>}
   */
  async getDocumentInfo(docId) {
    if (!this.provider) {
      throw new Error('Bridge client not initialized. Call initialize() first.');
    }
    return this.provider.docs.getDocumentInfo(docId);
  }

  /**
   * Fetch an asset (image, etc.) by URL.
   * Used for downloading embedded images from Google Docs.
   *
   * @param {string} url - Asset URL from inline object
   * @returns {Promise<{ bytes: Uint8Array, mimeType: string, name?: string }>}
   */
  async fetchAsset(url) {
    if (!this.provider) {
      throw new Error('Bridge client not initialized. Call initialize() first.');
    }
    return this.provider.drive.fetchByUrl(url);
  }
}

module.exports = {
  GoogleWorkspaceBridgeClient,
  WORKSPACE_PROVIDER_IDS
};
