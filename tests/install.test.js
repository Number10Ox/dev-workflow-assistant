const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { install } = require('../src/commands/install');
const { getInstallDir } = require('../src/utils/paths');

let tempDir;
let originalExit;

beforeEach(async () => {
  // Create unique temp directory for each test
  tempDir = path.join(os.tmpdir(), 'dwa-test-' + Date.now());
  await fs.ensureDir(tempDir);

  // Set test home directory
  process.env.DWA_TEST_HOME = tempDir;

  // Ensure .claude/skills directory exists (parent directories)
  await fs.ensureDir(path.join(tempDir, '.claude', 'skills'));

  // Mock process.exit to prevent test process from exiting
  originalExit = process.exit;
  process.exit = (code) => {
    throw new Error(`process.exit(${code})`);
  };
});

afterEach(async () => {
  // Restore process.exit
  process.exit = originalExit;

  // Clean up temp directory
  if (tempDir) {
    await fs.remove(tempDir);
  }

  // Remove test environment variable
  delete process.env.DWA_TEST_HOME;
});

describe('install command', () => {
  test('install creates .dwa-version with schemaVersion', async () => {
    await install();

    const versionPath = path.join(getInstallDir(), '.dwa-version');
    const versionData = await fs.readJson(versionPath);

    assert.strictEqual(versionData.schemaVersion, '1.0.0');
    assert.strictEqual(typeof versionData.dwaVersion, 'string');
    assert.match(versionData.installedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('install creates install directory structure', async () => {
    await install();

    const installDir = getInstallDir();
    assert.ok(await fs.pathExists(installDir), 'Install directory should exist');
    assert.ok(await fs.pathExists(path.join(installDir, 'templates')), 'Templates directory should exist');
    assert.ok(await fs.pathExists(path.join(installDir, 'references')), 'References directory should exist');
  });

  test('install fails if already installed', async () => {
    // First install
    await install();

    // Try to install again - should throw process.exit(1)
    await assert.rejects(
      async () => await install(),
      (err) => {
        return err.message === 'process.exit(1)';
      },
      'Should fail when already installed'
    );
  });
});
