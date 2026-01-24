const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { backupInstallation } = require('../src/installer/backup');

let testDir;

beforeEach(async () => {
  testDir = path.join(os.tmpdir(), 'dwa-upgrade-test-' + Date.now());
  await fs.ensureDir(testDir);
});

afterEach(async () => {
  await fs.remove(testDir);
});

describe('upgrade command', () => {
  test('backupInstallation creates timestamped backup', async () => {
    const installDir = path.join(testDir, 'dwa');
    await fs.ensureDir(installDir);
    await fs.writeFile(path.join(installDir, 'test.txt'), 'original content');

    const backupDir = await backupInstallation(installDir);

    assert.ok(await fs.pathExists(backupDir), 'Backup directory should exist');
    assert.match(backupDir, /\.backup\./);

    const backedUpFile = path.join(backupDir, 'test.txt');
    assert.ok(await fs.pathExists(backedUpFile), 'Backed up file should exist');
    const content = await fs.readFile(backedUpFile, 'utf8');
    assert.strictEqual(content, 'original content');
  });

  test('backupInstallation preserves timestamps', async () => {
    const installDir = path.join(testDir, 'dwa');
    await fs.ensureDir(installDir);
    const testFile = path.join(installDir, 'test.txt');
    await fs.writeFile(testFile, 'content');

    const originalStat = await fs.stat(testFile);
    const backupDir = await backupInstallation(installDir);

    const backedUpFile = path.join(backupDir, 'test.txt');
    const backupStat = await fs.stat(backedUpFile);

    assert.strictEqual(backupStat.mtime.getTime(), originalStat.mtime.getTime());
  });

  test('backupInstallation includes subdirectories', async () => {
    const installDir = path.join(testDir, 'dwa');
    await fs.ensureDir(path.join(installDir, 'templates'));
    await fs.writeFile(path.join(installDir, 'templates', 'spec.md'), 'template');

    const backupDir = await backupInstallation(installDir);

    const backedUpTemplate = path.join(backupDir, 'templates', 'spec.md');
    assert.ok(await fs.pathExists(backedUpTemplate), 'Backed up template should exist');
    const content = await fs.readFile(backedUpTemplate, 'utf8');
    assert.strictEqual(content, 'template');
  });
});
