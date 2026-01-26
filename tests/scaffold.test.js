const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { scaffoldFromTemplate, hasDwaEntry, ensureGitignore } = require('../src/scaffolding/scaffold');
const { checkExisting } = require('../src/scaffolding/check-existing');

let testDir;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-test-'));
});

afterEach(async () => {
  await fs.remove(testDir);
});

describe('scaffoldFromTemplate', () => {
  test('creates feature-spec.md with valid content', async () => {
    await scaffoldFromTemplate('Test Feature', testDir);

    const specPath = path.join(testDir, 'feature-spec.md');
    assert.ok(await fs.pathExists(specPath), 'feature-spec.md should exist');

    const content = await fs.readFile(specPath, 'utf8');

    // Verify YAML frontmatter
    assert.ok(content.startsWith('---'), 'Should start with YAML frontmatter delimiter');
    assert.match(content, /title: "Test Feature"/, 'Should contain title in frontmatter');
    assert.match(content, /spec_schema_version: v2\.0/, 'Should contain spec_schema_version: v2.0');

    // Verify H1 heading
    assert.match(content, /# Feature Spec: Test Feature/, 'Should contain feature heading');

    // Verify Deliverables Table header row
    assert.match(content, /\| Deliverable ID \| User Story \| Description \|/, 'Should contain Deliverables Table header');

    // Verify auto-generated feature_id
    assert.match(content, /feature_id: FEAT-/, 'Should contain auto-generated feature_id');

    // Verify tdd_path field
    assert.match(content, /tdd_path: null/, 'Should contain tdd_path: null in frontmatter');
  });

  test('creates .dwa/feature.json with schema', async () => {
    await scaffoldFromTemplate('My Feature', testDir);

    const jsonPath = path.join(testDir, '.dwa', 'feature.json');
    assert.ok(await fs.pathExists(jsonPath), '.dwa/feature.json should exist');

    const featureJson = await fs.readJson(jsonPath);

    assert.strictEqual(featureJson.schemaVersion, '1.0.0', 'schemaVersion should be 1.0.0');
    assert.ok(featureJson.feature_id.startsWith('FEAT-'), 'feature_id should start with FEAT-');
    assert.strictEqual(featureJson.title, 'My Feature', 'title should match input');
    assert.strictEqual(featureJson.spec_path, 'feature-spec.md', 'spec_path should be feature-spec.md');
    assert.strictEqual(featureJson.tdd_path, null, 'tdd_path should be null initially');

    // Verify created_at is valid ISO date
    assert.ok(featureJson.created_at, 'created_at should exist');
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(featureJson.created_at),
      'created_at should be valid ISO date'
    );
  });

  test('no unreplaced placeholders', async () => {
    await scaffoldFromTemplate('Feature: With Special Chars & Stuff', testDir);

    const specPath = path.join(testDir, 'feature-spec.md');
    const content = await fs.readFile(specPath, 'utf8');

    // Verify no Handlebars placeholders remain
    assert.ok(
      !/\{\{[^}]+\}\}/.test(content),
      'Should not contain unreplaced Handlebars placeholders'
    );
  });
});

describe('checkExisting', () => {
  test('returns false for empty directory', async () => {
    const result = await checkExisting(testDir);

    assert.strictEqual(result.alreadyInitialized, false, 'alreadyInitialized should be false');
    assert.strictEqual(result.files.featureJson, false, 'featureJson should be false');
    assert.strictEqual(result.files.spec, false, 'spec should be false');
  });

  test('detects feature-spec.md', async () => {
    // Create feature-spec.md
    await fs.writeFile(path.join(testDir, 'feature-spec.md'), '# Test');

    const result = await checkExisting(testDir);

    assert.strictEqual(result.alreadyInitialized, true, 'alreadyInitialized should be true');
    assert.strictEqual(result.files.spec, true, 'spec should be true');
  });

  test('detects .dwa/feature.json', async () => {
    // Create .dwa/feature.json
    await fs.ensureDir(path.join(testDir, '.dwa'));
    await fs.writeJson(path.join(testDir, '.dwa', 'feature.json'), { test: true });

    const result = await checkExisting(testDir);

    assert.strictEqual(result.alreadyInitialized, true, 'alreadyInitialized should be true');
    assert.strictEqual(result.files.featureJson, true, 'featureJson should be true');
  });
});

describe('hasDwaEntry', () => {
  test('detects .dwa/ entry', () => {
    assert.strictEqual(hasDwaEntry('.dwa/'), true);
  });

  test('detects .dwa entry (no slash)', () => {
    assert.strictEqual(hasDwaEntry('.dwa'), true);
  });

  test('detects .dwa/** glob pattern', () => {
    assert.strictEqual(hasDwaEntry('.dwa/**'), true);
  });

  test('detects .dwa/* glob pattern', () => {
    assert.strictEqual(hasDwaEntry('.dwa/*'), true);
  });

  test('detects ./.dwa/ with leading ./', () => {
    assert.strictEqual(hasDwaEntry('./.dwa/'), true);
  });

  test('detects /.dwa entry with leading /', () => {
    assert.strictEqual(hasDwaEntry('/.dwa'), true);
  });

  test('ignores .dwa in comments', () => {
    assert.strictEqual(hasDwaEntry('# .dwa/'), false);
  });

  test('ignores inline comment after entry', () => {
    assert.strictEqual(hasDwaEntry('.dwa/ # some comment'), true);
  });

  test('returns false for unrelated content', () => {
    assert.strictEqual(hasDwaEntry('node_modules/\nbuild/\n'), false);
  });

  test('returns false for empty content', () => {
    assert.strictEqual(hasDwaEntry(''), false);
  });
});

describe('ensureGitignore', () => {
  test('creates .gitignore if missing', async () => {
    const result = await ensureGitignore(testDir);

    assert.strictEqual(result.action, 'created');
    const content = await fs.readFile(path.join(testDir, '.gitignore'), 'utf8');
    assert.ok(content.includes('.dwa/'));
    assert.ok(content.includes('# DWA state'));
  });

  test('appends to existing .gitignore without entry', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), 'node_modules/\n');

    const result = await ensureGitignore(testDir);

    assert.strictEqual(result.action, 'appended');
    const content = await fs.readFile(path.join(testDir, '.gitignore'), 'utf8');
    assert.ok(content.includes('node_modules/'), 'Should preserve existing content');
    assert.ok(content.includes('.dwa/'), 'Should include .dwa/');
  });

  test('preserves existing .gitignore content', async () => {
    const originalContent = 'node_modules/\nbuild/\ndist/\n';
    await fs.writeFile(path.join(testDir, '.gitignore'), originalContent);

    await ensureGitignore(testDir);

    const content = await fs.readFile(path.join(testDir, '.gitignore'), 'utf8');
    assert.ok(content.startsWith(originalContent), 'Should preserve original content');
  });

  test('is idempotent: detects .dwa/ entry', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), '.dwa/\n');

    const result = await ensureGitignore(testDir);

    assert.strictEqual(result.action, 'exists');
  });

  test('is idempotent: detects .dwa entry (no slash)', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), '.dwa\n');

    const result = await ensureGitignore(testDir);

    assert.strictEqual(result.action, 'exists');
  });

  test('is idempotent: detects .dwa/** glob pattern', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), '.dwa/**\n');

    const result = await ensureGitignore(testDir);

    assert.strictEqual(result.action, 'exists');
  });

  test('is idempotent: detects ./.dwa/ with leading ./', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), './.dwa/\n');

    const result = await ensureGitignore(testDir);

    assert.strictEqual(result.action, 'exists');
  });

  test('handles .gitignore without trailing newline', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), 'node_modules/');

    await ensureGitignore(testDir);

    const content = await fs.readFile(path.join(testDir, '.gitignore'), 'utf8');
    assert.ok(content.includes('.dwa/'));
    // Should not have double newlines before comment
    assert.ok(!content.includes('\n\n\n'), 'Should not have triple newlines');
  });

  test('ignores .dwa in comments (does not detect as existing)', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), '# .dwa/\nnode_modules/\n');

    const result = await ensureGitignore(testDir);

    assert.strictEqual(result.action, 'appended');
  });
});

describe('scaffoldFromTemplate gitignore integration', () => {
  test('scaffold returns gitignoreResult', async () => {
    const result = await scaffoldFromTemplate('Test Feature', testDir);

    assert.ok(result.gitignoreResult, 'gitignoreResult should be present');
    assert.strictEqual(result.gitignoreResult.action, 'created');
  });

  test('scaffold creates .gitignore with .dwa/ entry', async () => {
    await scaffoldFromTemplate('Test Feature', testDir);

    const gitignorePath = path.join(testDir, '.gitignore');
    assert.ok(await fs.pathExists(gitignorePath), '.gitignore should exist');
    const content = await fs.readFile(gitignorePath, 'utf8');
    assert.ok(content.includes('.dwa/'));
  });

  test('scaffold appends to existing .gitignore', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), 'node_modules/\n');

    const result = await scaffoldFromTemplate('Test Feature', testDir);

    assert.strictEqual(result.gitignoreResult.action, 'appended');
    const content = await fs.readFile(path.join(testDir, '.gitignore'), 'utf8');
    assert.ok(content.includes('node_modules/'));
    assert.ok(content.includes('.dwa/'));
  });

  test('scaffold is idempotent with existing .dwa entry', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), '.dwa/**\n');

    const result = await scaffoldFromTemplate('Test Feature', testDir);

    assert.strictEqual(result.gitignoreResult.action, 'exists');
  });
});
