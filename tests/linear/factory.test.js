const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_USERPROFILE = process.env.USERPROFILE;
const ORIGINAL_LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ORIGINAL_DWA_LINEAR_MODE = process.env.DWA_LINEAR_MODE;

let tmpHome;

function freshFactory() {
  // Bust any cached version of the factory + its dependencies so test
  // overrides (env vars, mocked modules) take effect each call.
  for (const k of Object.keys(require.cache)) {
    if (k.includes('/src/linear/factory.js') || k.includes('/src/linear/config.js')) {
      delete require.cache[k];
    }
  }
  return require('../../src/linear/factory');
}

// Build a vscode mock with a registered tracker extension API.
function makeVscodeWithProvider(api) {
  return {
    extensions: {
      getExtension: (id) => {
        if (id === 'jedwards.linear-tracker-provider' || id === 'linear-tracker-provider') {
          return {
            isActive: true,
            activate: async () => {},
            exports: api
          };
        }
        return null;
      }
    }
  };
}

function makeValidTrackerApi() {
  return {
    createIssue: async () => ({}),
    updateIssue: async () => ({}),
    getIssue: async () => ({}),
    queryByExternalId: async () => null
  };
}

describe('IssueTrackerFactory', () => {
  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-factory-test-'));
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    delete process.env.LINEAR_API_KEY;
    delete process.env.DWA_LINEAR_MODE;
  });

  afterEach(async () => {
    if (ORIGINAL_HOME === undefined) delete process.env.HOME;
    else process.env.HOME = ORIGINAL_HOME;
    if (ORIGINAL_USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = ORIGINAL_USERPROFILE;
    if (ORIGINAL_LINEAR_API_KEY === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = ORIGINAL_LINEAR_API_KEY;
    if (ORIGINAL_DWA_LINEAR_MODE === undefined) delete process.env.DWA_LINEAR_MODE;
    else process.env.DWA_LINEAR_MODE = ORIGINAL_DWA_LINEAR_MODE;
    await fs.remove(tmpHome);
  });

  describe('mode = bridge (vscode + provider available)', () => {
    it('uses bridge tracker', async () => {
      const { IssueTrackerFactory } = freshFactory();
      const api = makeValidTrackerApi();
      const factory = new IssueTrackerFactory({ vscode: makeVscodeWithProvider(api) });
      await factory.initialize();
      assert.strictEqual(factory.mode, 'bridge');
      assert.strictEqual(factory.tracker, api);
    });

    it('skips provider with incomplete API and falls back to direct if config exists', async () => {
      const { IssueTrackerFactory } = freshFactory();
      const incomplete = { createIssue: async () => ({}) }; // missing other methods
      // Provide a direct-mode key so fallback can succeed.
      process.env.LINEAR_API_KEY = 'lin_api_test';
      const factory = new IssueTrackerFactory({
        vscode: makeVscodeWithProvider(incomplete)
      });
      await factory.initialize();
      assert.strictEqual(factory.mode, 'direct');
    });
  });

  describe('mode = direct (vscode unavailable)', () => {
    it('throws actionable error when no API key is configured', async () => {
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory(); // no vscode injected, none in env
      await assert.rejects(
        () => factory.initialize(),
        /No Linear API key found/
      );
    });

    it('uses direct tracker when LINEAR_API_KEY is set', async () => {
      process.env.LINEAR_API_KEY = 'lin_api_from_env';
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory();
      await factory.initialize();
      assert.strictEqual(factory.mode, 'direct');
      assert.ok(factory.tracker);
    });

    it('uses direct tracker when ~/.dwa/config.json has a key', async () => {
      const configPath = path.join(tmpHome, '.dwa', 'config.json');
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, {
        schemaVersion: 1,
        linear: { apiKey: 'lin_api_from_file' }
      });
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory();
      await factory.initialize();
      assert.strictEqual(factory.mode, 'direct');
    });
  });

  describe('DWA_LINEAR_MODE=direct override', () => {
    it('forces direct mode even when vscode + provider are available', async () => {
      process.env.DWA_LINEAR_MODE = 'direct';
      process.env.LINEAR_API_KEY = 'lin_api_test';
      const { IssueTrackerFactory } = freshFactory();
      const api = makeValidTrackerApi();
      const factory = new IssueTrackerFactory({ vscode: makeVscodeWithProvider(api) });
      await factory.initialize();
      assert.strictEqual(factory.mode, 'direct');
      assert.notStrictEqual(factory.tracker, api, 'should not have used the bridge tracker');
    });

    it('errors clearly when forced direct but no key configured', async () => {
      process.env.DWA_LINEAR_MODE = 'direct';
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory({ vscode: makeVscodeWithProvider(makeValidTrackerApi()) });
      await assert.rejects(() => factory.initialize(), /No Linear API key found/);
    });
  });

  describe('DWA_LINEAR_MODE=bridge override', () => {
    it('errors clearly when bridge requested but no provider extension', async () => {
      process.env.DWA_LINEAR_MODE = 'bridge';
      const vscodeWithoutProvider = {
        extensions: { getExtension: () => null }
      };
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory({ vscode: vscodeWithoutProvider });
      await assert.rejects(() => factory.initialize(), /no Linear provider extension is registered/);
    });

    it('errors clearly when bridge requested but vscode unavailable', async () => {
      process.env.DWA_LINEAR_MODE = 'bridge';
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory(); // no vscode
      await assert.rejects(() => factory.initialize(), /vscode.+unavailable/i);
    });
  });

  describe('DWA_LINEAR_MODE invalid value', () => {
    it('throws on unrecognized value', async () => {
      process.env.DWA_LINEAR_MODE = 'banana';
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory();
      await assert.rejects(() => factory.initialize(), /Invalid DWA_LINEAR_MODE/);
    });
  });

  describe('checkCapabilities', () => {
    it('reports queryByExternalId as supported when tracker has the method', async () => {
      process.env.LINEAR_API_KEY = 'lin_api_test';
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory();
      await factory.initialize();
      const caps = factory.checkCapabilities(['queryByExternalId']);
      assert.strictEqual(caps.supported, true);
      assert.deepStrictEqual(caps.missing, []);
    });
  });

  describe('proxy methods require initialization', () => {
    it('createIssue throws before initialize()', async () => {
      const { IssueTrackerFactory } = freshFactory();
      const factory = new IssueTrackerFactory();
      await assert.rejects(() => factory.createIssue({}), /not initialized/);
    });
  });
});
