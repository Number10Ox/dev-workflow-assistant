const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { status } = require('../../src/commands/status');

describe('status', () => {
  let testHome;
  let originalHome;

  beforeEach(async () => {
    testHome = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-status-test-'));
    originalHome = process.env.DWA_TEST_HOME;
    process.env.DWA_TEST_HOME = testHome;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.DWA_TEST_HOME = originalHome;
    } else {
      delete process.env.DWA_TEST_HOME;
    }
    if (testHome && await fs.pathExists(testHome)) {
      await fs.remove(testHome);
    }
  });

  it('shows not installed when .claude/dwa does not exist', async () => {
    const result = await status();
    assert.strictEqual(result.success, true);
    assert.match(result.message, /not installed/i);
  });

  it('shows installed status when .claude/dwa exists', async () => {
    // Create install directory
    const installDir = path.join(testHome, '.claude', 'dwa');
    await fs.ensureDir(installDir);

    const result = await status();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'Status displayed');
  });

  it('shows version when version file exists', async () => {
    // Create install directory and version file
    const installDir = path.join(testHome, '.claude', 'dwa');
    await fs.ensureDir(installDir);
    await fs.writeJSON(path.join(installDir, '.dwa-version'), {
      dwaVersion: '1.2.3'
    });

    const result = await status();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'Status displayed');
    // Version is displayed in console output
  });

  it('shows unknown version when version file missing', async () => {
    // Create install directory without version file
    const installDir = path.join(testHome, '.claude', 'dwa');
    await fs.ensureDir(installDir);

    const result = await status();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'Status displayed');
  });
});
