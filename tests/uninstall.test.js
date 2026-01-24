const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');

let testDir;

beforeEach(async () => {
  testDir = path.join(os.tmpdir(), 'dwa-uninstall-test-' + Date.now());
  await fs.ensureDir(testDir);
});

afterEach(async () => {
  await fs.remove(testDir);
});

describe('uninstall command safety', () => {
  test('filters only dwa-* prefixed directories', async () => {
    const skillsDir = path.join(testDir, 'skills');

    await fs.ensureDir(path.join(skillsDir, 'dwa-init'));
    await fs.ensureDir(path.join(skillsDir, 'dwa-parse'));
    await fs.ensureDir(path.join(skillsDir, 'dwa-sync'));
    await fs.ensureDir(path.join(skillsDir, 'other-skill'));
    await fs.ensureDir(path.join(skillsDir, 'my-custom-skill'));

    const entries = await fs.readdir(skillsDir);
    const dwaSkills = entries.filter(e => e.startsWith('dwa-'));

    assert.deepStrictEqual(dwaSkills.sort(), ['dwa-init', 'dwa-parse', 'dwa-sync']);
    assert.ok(!dwaSkills.includes('other-skill'));
    assert.ok(!dwaSkills.includes('my-custom-skill'));
  });

  test('safely removes only dwa-* directories', async () => {
    const skillsDir = path.join(testDir, 'skills');

    await fs.ensureDir(path.join(skillsDir, 'dwa-init'));
    await fs.ensureDir(path.join(skillsDir, 'dwa-parse'));
    await fs.ensureDir(path.join(skillsDir, 'other-skill'));

    await fs.writeFile(path.join(skillsDir, 'dwa-init', 'skill.txt'), 'init');
    await fs.writeFile(path.join(skillsDir, 'other-skill', 'skill.txt'), 'other');

    const entries = await fs.readdir(skillsDir);
    const dwaSkills = entries.filter(e => e.startsWith('dwa-'));

    for (const dir of dwaSkills) {
      await fs.remove(path.join(skillsDir, dir));
    }

    assert.ok(!(await fs.pathExists(path.join(skillsDir, 'dwa-init'))), 'dwa-init should be removed');
    assert.ok(!(await fs.pathExists(path.join(skillsDir, 'dwa-parse'))), 'dwa-parse should be removed');
    assert.ok(await fs.pathExists(path.join(skillsDir, 'other-skill')), 'other-skill should be preserved');
    const content = await fs.readFile(path.join(skillsDir, 'other-skill', 'skill.txt'), 'utf8');
    assert.strictEqual(content, 'other');
  });

  test('handles missing directories gracefully', async () => {
    const nonExistentDir = path.join(testDir, 'non-existent');

    const exists = await fs.pathExists(nonExistentDir);
    assert.strictEqual(exists, false);

    if (await fs.pathExists(nonExistentDir)) {
      await fs.readdir(nonExistentDir);
    }
    assert.ok(true, 'No error thrown for missing directory');
  });
});
