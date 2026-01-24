const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { backupInstallation } = require('../src/installer/backup');
const { writeJsonWithSchema } = require('../src/utils/schema');

describe('upgrade command', () => {
  let testDir;

  beforeEach(async () => {
    // Create unique test directory
    testDir = path.join(os.tmpdir(), 'dwa-upgrade-test-' + Date.now());
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    // Clean up
    await fs.remove(testDir);
  });

  test('backupInstallation creates timestamped backup', async () => {
    // Create a fake installation directory
    const installDir = path.join(testDir, 'dwa');
    await fs.ensureDir(installDir);
    await fs.writeFile(path.join(installDir, 'test.txt'), 'original content');

    // Create backup
    const backupDir = await backupInstallation(installDir);

    // Verify backup exists
    expect(await fs.pathExists(backupDir)).toBe(true);
    expect(backupDir).toMatch(/\.backup\./);

    // Verify backup contains original file
    const backedUpFile = path.join(backupDir, 'test.txt');
    expect(await fs.pathExists(backedUpFile)).toBe(true);
    const content = await fs.readFile(backedUpFile, 'utf8');
    expect(content).toBe('original content');
  });

  test('backupInstallation preserves timestamps', async () => {
    const installDir = path.join(testDir, 'dwa');
    await fs.ensureDir(installDir);
    const testFile = path.join(installDir, 'test.txt');
    await fs.writeFile(testFile, 'content');

    // Get original timestamp
    const originalStat = await fs.stat(testFile);

    // Create backup
    const backupDir = await backupInstallation(installDir);

    // Verify timestamps preserved
    const backedUpFile = path.join(backupDir, 'test.txt');
    const backupStat = await fs.stat(backedUpFile);
    
    expect(backupStat.mtime.getTime()).toBe(originalStat.mtime.getTime());
  });

  test('backupInstallation includes subdirectories', async () => {
    const installDir = path.join(testDir, 'dwa');
    await fs.ensureDir(path.join(installDir, 'templates'));
    await fs.writeFile(path.join(installDir, 'templates', 'spec.md'), 'template');

    const backupDir = await backupInstallation(installDir);

    const backedUpTemplate = path.join(backupDir, 'templates', 'spec.md');
    expect(await fs.pathExists(backedUpTemplate)).toBe(true);
    const content = await fs.readFile(backedUpTemplate, 'utf8');
    expect(content).toBe('template');
  });
});
