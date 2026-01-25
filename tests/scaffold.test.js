const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { scaffoldFromTemplate } = require('../src/scaffolding/scaffold');
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
