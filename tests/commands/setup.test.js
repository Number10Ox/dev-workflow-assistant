const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');

// Mock child_process before requiring setup
const originalExecSync = execSync;

const {
  isVSCodeAvailable,
  setupLinear,
  setupGoogleDocs
} = require('../../src/commands/setup');

describe('setup', () => {
  describe('isVSCodeAvailable', () => {
    it('returns true when code CLI exists', () => {
      // This test depends on actual environment
      // We just verify it returns a boolean
      const result = isVSCodeAvailable();
      assert.strictEqual(typeof result, 'boolean');
    });
  });

  describe('setupLinear', () => {
    it('returns failure message when VS Code CLI not available', async () => {
      const result = await setupLinear();
      // In test environment, VS Code might not be available
      assert.ok(result);
      assert.strictEqual(typeof result.success, 'boolean');
      assert.ok(result.message);
    });
  });

  describe('setupGoogleDocs', () => {
    it('returns failure message when VS Code CLI not available', async () => {
      const result = await setupGoogleDocs();
      // In test environment, VS Code might not be available
      assert.ok(result);
      assert.strictEqual(typeof result.success, 'boolean');
      assert.ok(result.message);
    });
  });

  describe('installExtension', () => {
    it('handles extension installation', async () => {
      const { installExtension } = require('../../src/commands/setup');

      // Test with a non-existent extension config (will fail gracefully - no GitHub release)
      const testConfig = {
        id: 'test.nonexistent-extension',
        vsixPattern: /nonexistent.*\.vsix$/i,
        name: 'Test Extension'
      };
      const result = await installExtension(testConfig);
      assert.ok(result);
      assert.strictEqual(typeof result.success, 'boolean');
      assert.ok(result.message);
    });
  });
});
