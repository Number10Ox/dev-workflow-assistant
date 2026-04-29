/**
 * IssueTrackerFactory — chooses the right backend at initialize() time.
 *
 * Two modes:
 *   - Bridge mode: when running inside the VS Code extension host, talk to
 *     `jedwards.linear-tracker-provider` via the extension API.
 *   - Direct mode: when running from the terminal (no `vscode` module), or
 *     when forced via env var, instantiate DirectLinearTracker locally.
 *
 * Mode selection:
 *   - DWA_LINEAR_MODE=direct   → always direct (skips bridge probe).
 *   - vscode module present    → try bridge first, fall back to direct if no
 *                                provider extension is registered AND a direct
 *                                config exists.
 *   - vscode module absent     → direct.
 *
 * Both backends expose the same IssueTracker interface, so sync.js does not
 * need to know which one it got.
 *
 * (This file replaces the older `bridge-client.js` / `BridgeClient` —
 * the old name lied once direct mode existed.)
 */

const BRIDGE_EXTENSION_IDS = [
  'jedwards.devex-service-bridge',
  'devex-service-bridge'
];

const LINEAR_PROVIDER_IDS = [
  'jedwards.linear-tracker-provider',
  'linear-tracker-provider'
];

class IssueTrackerFactory {
  constructor(options = {}) {
    this.tracker = null;
    this.capabilities = null;
    this.mode = null; // 'bridge' | 'direct' | null
    // Test seam — let tests inject a fake vscode module without going through require().
    this._injectedVscode = options.vscode;
  }

  _getVscodeOrNull() {
    if (this._injectedVscode) return this._injectedVscode;
    try {
      // Lazy require so this module loads outside an extension host.
      return require('vscode');
    } catch {
      return null;
    }
  }

  async initialize() {
    const forced = process.env.DWA_LINEAR_MODE;
    if (forced && forced !== 'direct' && forced !== 'bridge') {
      throw new Error(
        `Invalid DWA_LINEAR_MODE='${forced}'. Expected 'direct' or 'bridge'.`
      );
    }

    if (forced === 'direct') {
      await this._initializeDirect();
      return;
    }

    const vscode = forced === 'bridge' ? this._getVscodeOrNull() : this._getVscodeOrNull();

    if (vscode) {
      const ok = await this._tryBridge(vscode);
      if (ok) return;
      if (forced === 'bridge') {
        throw new Error(
          'DWA_LINEAR_MODE=bridge requested but no Linear provider extension is registered. ' +
          'Install jedwards.linear-tracker-provider or unset DWA_LINEAR_MODE.'
        );
      }
      // Bridge unreachable; fall through to direct.
    } else if (forced === 'bridge') {
      throw new Error(
        'DWA_LINEAR_MODE=bridge requested but `vscode` module is unavailable. ' +
        'Run from a VS Code extension host or unset DWA_LINEAR_MODE.'
      );
    }

    await this._initializeDirect();
  }

  async _tryBridge(vscode) {
    for (const providerId of LINEAR_PROVIDER_IDS) {
      const ext = vscode.extensions?.getExtension?.(providerId);
      if (!ext) continue;
      try {
        if (!ext.isActive) await ext.activate();
        const api = ext.exports;
        if (api && this._isValidTracker(api)) {
          this.tracker = api;
          this.mode = 'bridge';
          return true;
        }
      } catch {
        // Try next provider id.
      }
    }
    return false;
  }

  async _initializeDirect() {
    // Lazy-require so unit tests can mock the SDK without paying its load cost.
    const { DirectLinearTracker } = require('./direct-tracker');
    const { loadApiKey } = require('./config');

    const apiKey = await loadApiKey();
    if (!apiKey) {
      throw new Error(
        'No Linear API key found. Set LINEAR_API_KEY in your environment or run ' +
        '`npx dwa --setup linear` to write one to ~/.dwa/config.json.'
      );
    }
    this.tracker = new DirectLinearTracker(apiKey);
    this.mode = 'direct';
  }

  _isValidTracker(api) {
    if (!api || typeof api !== 'object') return false;
    return (
      typeof api.createIssue === 'function' &&
      typeof api.updateIssue === 'function' &&
      typeof api.getIssue === 'function' &&
      typeof api.queryByExternalId === 'function'
    );
  }

  checkCapabilities(requiredFeatures = ['externalId', 'queryByExternalId']) {
    const missing = [];
    if (requiredFeatures.includes('queryByExternalId')) {
      if (!this.tracker || typeof this.tracker.queryByExternalId !== 'function') {
        missing.push('queryByExternalId');
      }
    }
    return { supported: missing.length === 0, missing };
  }

  _requireInit() {
    if (!this.tracker) {
      throw new Error('IssueTrackerFactory not initialized. Call initialize() first.');
    }
  }

  async createIssue(input)         { this._requireInit(); return this.tracker.createIssue(input); }
  async updateIssue(id, updates)   { this._requireInit(); return this.tracker.updateIssue(id, updates); }
  async queryByExternalId(eid)     { this._requireInit(); return this.tracker.queryByExternalId(eid); }
  async getIssue(id)               { this._requireInit(); return this.tracker.getIssue(id); }
}

module.exports = {
  IssueTrackerFactory,
  BRIDGE_EXTENSION_IDS,
  LINEAR_PROVIDER_IDS
};
