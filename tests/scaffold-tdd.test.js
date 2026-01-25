const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { scaffoldTDD } = require('../src/scaffolding/scaffold-tdd');
const { scaffoldFromTemplate } = require('../src/scaffolding/scaffold');

let testDir;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-tdd-test-'));
});

afterEach(async () => {
  await fs.remove(testDir);
});

describe('scaffoldTDD', () => {
  test('creates TDD file in docs/tdds/', async () => {
    // Setup: create spec first
    await scaffoldFromTemplate('Test Feature', testDir);

    // Scaffold TDD
    const tddPath = await scaffoldTDD('FEAT-2026-123', 'Test Feature', 'feature-spec.md', testDir);

    assert.strictEqual(tddPath, 'docs/tdds/test-feature-tdd.md', 'Should return relative path');

    const fullPath = path.join(testDir, tddPath);
    assert.ok(await fs.pathExists(fullPath), 'TDD file should exist');
  });

  test('TDD content has valid frontmatter', async () => {
    await scaffoldFromTemplate('My Feature', testDir);
    await scaffoldTDD('FEAT-2026-456', 'My Feature', 'feature-spec.md', testDir);

    const tddContent = await fs.readFile(path.join(testDir, 'docs/tdds/my-feature-tdd.md'), 'utf8');

    assert.ok(tddContent.startsWith('---'), 'Should start with YAML delimiter');
    assert.match(tddContent, /feature_id: FEAT-2026-456/, 'Should contain feature_id');
    assert.match(tddContent, /title: "My Feature - Technical Design"/, 'Should contain title');
    assert.match(tddContent, /tdd_schema_version: v1\.0/, 'Should contain tdd_schema_version');
    assert.match(tddContent, /spec_path:/, 'Should contain spec_path');
  });

  test('TDD content has all 8 sections', async () => {
    await scaffoldFromTemplate('Complete Feature', testDir);
    await scaffoldTDD('FEAT-2026-789', 'Complete Feature', 'feature-spec.md', testDir);

    const tddContent = await fs.readFile(path.join(testDir, 'docs/tdds/complete-feature-tdd.md'), 'utf8');

    assert.match(tddContent, /## 1\) Objectives/, 'Should have Objectives section');
    assert.match(tddContent, /## 2\) Architecture Overview/, 'Should have Architecture section');
    assert.match(tddContent, /## 3\) Decision Log/, 'Should have Decision Log section');
    assert.match(tddContent, /## 4\) Guardrails/, 'Should have Guardrails section');
    assert.match(tddContent, /## 5\) Risks & Mitigations/, 'Should have Risks section');
    assert.match(tddContent, /## 6\) Test Strategy/, 'Should have Test Strategy section');
    assert.match(tddContent, /## 7\) Implementation Notes/, 'Should have Implementation Notes section');
    assert.match(tddContent, /## 8\) Revision History/, 'Should have Revision History section');
  });

  test('updates feature.json with tdd_path', async () => {
    await scaffoldFromTemplate('Linked Feature', testDir);
    await scaffoldTDD('FEAT-2026-111', 'Linked Feature', 'feature-spec.md', testDir);

    const featureJson = await fs.readJson(path.join(testDir, '.dwa/feature.json'));

    assert.strictEqual(featureJson.tdd_path, 'docs/tdds/linked-feature-tdd.md', 'feature.json should have tdd_path');
    assert.strictEqual(featureJson.schemaVersion, '1.0.0', 'schemaVersion should be preserved');
  });

  test('updates spec frontmatter with tdd_path', async () => {
    await scaffoldFromTemplate('Bidirectional Feature', testDir);
    await scaffoldTDD('FEAT-2026-222', 'Bidirectional Feature', 'feature-spec.md', testDir);

    const specContent = await fs.readFile(path.join(testDir, 'feature-spec.md'), 'utf8');

    assert.match(specContent, /tdd_path: docs\/tdds\/bidirectional-feature-tdd\.md/, 'spec should have tdd_path in frontmatter');
  });

  test('no unreplaced placeholders', async () => {
    await scaffoldFromTemplate('Placeholder Test', testDir);
    await scaffoldTDD('FEAT-2026-333', 'Placeholder Test', 'feature-spec.md', testDir);

    const tddContent = await fs.readFile(path.join(testDir, 'docs/tdds/placeholder-test-tdd.md'), 'utf8');

    assert.ok(
      !/\{\{[^}]+\}\}/.test(tddContent),
      'Should not contain unreplaced Handlebars placeholders'
    );
  });

  test('handles special characters in title', async () => {
    await scaffoldFromTemplate('Feature: With Special & Chars!', testDir);
    const tddPath = await scaffoldTDD('FEAT-2026-444', 'Feature: With Special & Chars!', 'feature-spec.md', testDir);

    assert.strictEqual(tddPath, 'docs/tdds/feature-with-special-chars-tdd.md', 'Should slugify special characters');
    assert.ok(await fs.pathExists(path.join(testDir, tddPath)), 'TDD file should exist');
  });
});
