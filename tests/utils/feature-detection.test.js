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

function freshModule() {
  delete require.cache[require.resolve('../../src/utils/feature-detection')];
  return require('../../src/utils/feature-detection');
}

describe('feature-detection', () => {
  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-feat-test-'));
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

  describe('Linear feature', () => {
    it('returns available: false when no env, no config, no vscode', () => {
      const { checkFeature } = freshModule();
      const result = checkFeature('linear');
      assert.strictEqual(result.available, false);
      assert.match(result.reason, /not running in vs code context/i);
    });

    it('returns available: true with mode=direct when LINEAR_API_KEY is set', () => {
      process.env.LINEAR_API_KEY = 'lin_api_test';
      const { checkFeature } = freshModule();
      const result = checkFeature('linear');
      assert.strictEqual(result.available, true);
      assert.strictEqual(result.mode, 'direct');
    });

    it('returns available: true with mode=direct when ~/.dwa/config.json has a key', async () => {
      const configPath = path.join(tmpHome, '.dwa', 'config.json');
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, {
        schemaVersion: 1,
        linear: { apiKey: 'lin_api_from_file' }
      });
      const { checkFeature } = freshModule();
      const result = checkFeature('linear');
      assert.strictEqual(result.available, true);
      assert.strictEqual(result.mode, 'direct');
    });

    it('DWA_LINEAR_MODE=direct + no key → available: false with actionable reason', () => {
      process.env.DWA_LINEAR_MODE = 'direct';
      const { checkFeature } = freshModule();
      const result = checkFeature('linear');
      assert.strictEqual(result.available, false);
      assert.match(result.reason, /DWA_LINEAR_MODE=direct/);
      assert.match(result.reason, /--setup linear/);
    });

    it('DWA_LINEAR_MODE=bridge skips the direct shortcut', () => {
      process.env.DWA_LINEAR_MODE = 'bridge';
      process.env.LINEAR_API_KEY = 'lin_api_test';
      const { checkFeature } = freshModule();
      const result = checkFeature('linear');
      // Should fall through to vscode probe (which fails outside VS Code).
      assert.strictEqual(result.available, false);
    });

    it('returns malformed-json fallthrough as not available', async () => {
      const configPath = path.join(tmpHome, '.dwa', 'config.json');
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeFile(configPath, '{not json');
      const { checkFeature } = freshModule();
      const result = checkFeature('linear');
      assert.strictEqual(result.available, false);
    });
  });

  describe('hasDirectLinearConfig', () => {
    it('true when env var set', () => {
      process.env.LINEAR_API_KEY = 'x';
      const { hasDirectLinearConfig } = freshModule();
      assert.strictEqual(hasDirectLinearConfig(), true);
    });

    it('true when file has linear.apiKey', async () => {
      const configPath = path.join(tmpHome, '.dwa', 'config.json');
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, { linear: { apiKey: 'k' } });
      const { hasDirectLinearConfig } = freshModule();
      assert.strictEqual(hasDirectLinearConfig(), true);
    });

    it('false when file lacks linear.apiKey', async () => {
      const configPath = path.join(tmpHome, '.dwa', 'config.json');
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, { schemaVersion: 1 });
      const { hasDirectLinearConfig } = freshModule();
      assert.strictEqual(hasDirectLinearConfig(), false);
    });

    it('false when no env and no file', () => {
      const { hasDirectLinearConfig } = freshModule();
      assert.strictEqual(hasDirectLinearConfig(), false);
    });
  });

  describe('Other features', () => {
    it('returns error for unknown feature', () => {
      const { checkFeature } = freshModule();
      const result = checkFeature('unknown-feature');
      assert.strictEqual(result.available, false);
      assert.match(result.reason, /unknown feature/i);
    });

    it('googleDocs still requires VS Code (no direct mode yet)', () => {
      const { checkFeature } = freshModule();
      const result = checkFeature('googleDocs');
      assert.strictEqual(result.available, false);
    });
  });

  describe('getSetupInstructions', () => {
    it('mentions both direct and vscode-bridge for linear', () => {
      const { getSetupInstructions } = freshModule();
      const instructions = getSetupInstructions('linear');
      assert.match(instructions, /direct/i);
      assert.match(instructions, /vscode-bridge/i);
      assert.match(instructions, /dwa --setup linear/i);
    });

    it('returns correct text for googleDocs', () => {
      const { getSetupInstructions } = freshModule();
      const instructions = getSetupInstructions('googleDocs');
      assert.ok(instructions.includes('gworkspace-provider'));
    });

    it('returns message for unknown feature', () => {
      const { getSetupInstructions } = freshModule();
      const instructions = getSetupInstructions('unknown');
      assert.match(instructions, /unknown feature/i);
    });
  });

  describe('getAllFeatureStatus', () => {
    it('returns all features', () => {
      const { getAllFeatureStatus } = freshModule();
      const status = getAllFeatureStatus();
      assert.strictEqual(status.length, 2);
      const linearFeature = status.find(f => f.id === 'linear');
      assert.ok(linearFeature);
      assert.strictEqual(linearFeature.name, 'Linear Integration');
    });

    it('reports linear as available when LINEAR_API_KEY is set', () => {
      process.env.LINEAR_API_KEY = 'k';
      const { getAllFeatureStatus } = freshModule();
      const status = getAllFeatureStatus();
      const linearFeature = status.find(f => f.id === 'linear');
      assert.strictEqual(linearFeature.available, true);
      assert.strictEqual(linearFeature.mode, 'direct');
    });
  });

  describe('FEATURES constant', () => {
    it('contains expected structure', () => {
      const { FEATURES } = freshModule();
      assert.ok(FEATURES.linear);
      assert.ok(FEATURES.googleDocs);
      assert.ok(Array.isArray(FEATURES.linear.providerIds));
    });
  });
});
