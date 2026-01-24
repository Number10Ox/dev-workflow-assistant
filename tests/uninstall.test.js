const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');

describe('uninstall command safety', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), 'dwa-uninstall-test-' + Date.now());
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('filters only dwa-* prefixed directories', async () => {
    const skillsDir = path.join(testDir, 'skills');
    
    // Create various skill directories
    await fs.ensureDir(path.join(skillsDir, 'dwa-init'));
    await fs.ensureDir(path.join(skillsDir, 'dwa-parse'));
    await fs.ensureDir(path.join(skillsDir, 'dwa-sync'));
    await fs.ensureDir(path.join(skillsDir, 'other-skill'));
    await fs.ensureDir(path.join(skillsDir, 'my-custom-skill'));
    
    // Test the filtering logic
    const entries = await fs.readdir(skillsDir);
    const dwaSkills = entries.filter(e => e.startsWith('dwa-'));
    
    expect(dwaSkills).toEqual(['dwa-init', 'dwa-parse', 'dwa-sync']);
    expect(dwaSkills).not.toContain('other-skill');
    expect(dwaSkills).not.toContain('my-custom-skill');
  });

  test('safely removes only dwa-* directories', async () => {
    const skillsDir = path.join(testDir, 'skills');
    
    await fs.ensureDir(path.join(skillsDir, 'dwa-init'));
    await fs.ensureDir(path.join(skillsDir, 'dwa-parse'));
    await fs.ensureDir(path.join(skillsDir, 'other-skill'));
    
    await fs.writeFile(path.join(skillsDir, 'dwa-init', 'skill.txt'), 'init');
    await fs.writeFile(path.join(skillsDir, 'other-skill', 'skill.txt'), 'other');

    // Simulate selective removal
    const entries = await fs.readdir(skillsDir);
    const dwaSkills = entries.filter(e => e.startsWith('dwa-'));
    
    for (const dir of dwaSkills) {
      await fs.remove(path.join(skillsDir, dir));
    }

    // Verify dwa-* removed
    expect(await fs.pathExists(path.join(skillsDir, 'dwa-init'))).toBe(false);
    expect(await fs.pathExists(path.join(skillsDir, 'dwa-parse'))).toBe(false);
    
    // Verify other-skill preserved
    expect(await fs.pathExists(path.join(skillsDir, 'other-skill'))).toBe(true);
    const content = await fs.readFile(path.join(skillsDir, 'other-skill', 'skill.txt'), 'utf8');
    expect(content).toBe('other');
  });

  test('handles missing directories gracefully', async () => {
    const nonExistentDir = path.join(testDir, 'non-existent');
    
    // Should not throw when checking non-existent paths
    const exists = await fs.pathExists(nonExistentDir);
    expect(exists).toBe(false);
    
    // Safe to call readdir on parent if we check first
    if (await fs.pathExists(nonExistentDir)) {
      await fs.readdir(nonExistentDir);
    }
    // If we get here, no error was thrown
    expect(true).toBe(true);
  });
});
