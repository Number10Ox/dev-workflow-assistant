const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const { runStart } = require('../src/commands/start');
const { SCHEMA_VERSION } = require('../src/utils/schema');
const { hashContent } = require('../src/utils/hash-content');

/**
 * Test fixture - valid feature.json
 */
const FEATURE_JSON = {
  schemaVersion: SCHEMA_VERSION,
  feature_id: 'FEAT-2026-TEST',
  title: 'Test Feature',
  spec_path: 'feature-spec.md',
  tdd_path: 'docs/tdds/test-feature.md',
  created_at: '2026-01-25T00:00:00Z'
};

/**
 * Test fixture - valid deliverable registry entry
 */
const DELIVERABLE_REGISTRY = {
  schemaVersion: SCHEMA_VERSION,
  id: 'DEL-001',
  user_story: 'As a user, I want to login so that I can access my account',
  description: 'Implement user authentication with email and password',
  acceptance_criteria: 'C1: Valid credentials redirect to dashboard. F1: Invalid credentials show error. E1: Rate limit after 5 failures.',
  qa_notes: 'Test with valid and invalid credentials. Verify rate limiting.',
  dependencies: '',
  created_at: '2026-01-25T00:00:00Z'
};

/**
 * Test fixture - TDD file content
 */
const TDD_CONTENT = `---
feature_id: FEAT-2026-TEST
title: "Test Feature - Technical Design"
spec_path: "feature-spec.md"
tdd_schema_version: v1.0
---

# Technical Design: Test Feature

## 4) Guardrails

### Performance
- Response time under 200ms

### Security
- All endpoints require auth

### Do NOT
- Do not store plaintext passwords
`;

let tempDir;

describe('runStart', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-start-test-'));

    // Setup .dwa directory structure
    const dwaDir = path.join(tempDir, '.dwa');
    await fs.ensureDir(path.join(dwaDir, 'deliverables'));

    // Create spec file first
    const specContent = '# Feature Spec';
    await fs.writeFile(path.join(tempDir, 'feature-spec.md'), specContent);

    // Create feature.json with matching spec_content_hash
    const featureJsonWithHash = {
      ...FEATURE_JSON,
      spec_content_hash: hashContent(specContent)
    };
    await fs.writeJSON(path.join(dwaDir, 'feature.json'), featureJsonWithHash, { spaces: 2 });

    // Create TDD file
    const tddDir = path.join(tempDir, 'docs', 'tdds');
    await fs.ensureDir(tddDir);
    await fs.writeFile(path.join(tddDir, 'test-feature.md'), TDD_CONTENT);

    // Create deliverable registry file
    await fs.writeJSON(
      path.join(dwaDir, 'deliverables', 'DEL-001.json'),
      DELIVERABLE_REGISTRY,
      { spaces: 2 }
    );
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  describe('successful packet generation', () => {
    it('generates packet at .dwa/packets/DEL-###.md for valid deliverable', async () => {
      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.packetPath);

      const expectedPath = path.join(tempDir, '.dwa', 'packets', 'DEL-001.md');
      assert.strictEqual(result.packetPath, expectedPath);
      assert.ok(await fs.pathExists(expectedPath));
    });

    it('returns success with packet path and word count', async () => {
      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.packetPath);
      assert.ok(typeof result.wordCount === 'number');
      assert.ok(result.wordCount > 0);
    });

    it('creates .dwa/packets/ directory if missing', async () => {
      // Ensure packets directory doesn't exist
      await fs.remove(path.join(tempDir, '.dwa', 'packets'));

      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(await fs.pathExists(path.join(tempDir, '.dwa', 'packets')));
    });

    it('sets registry.started_at timestamp after successful generation', async () => {
      const before = new Date().toISOString();
      await runStart('DEL-001', tempDir);
      const after = new Date().toISOString();

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);

      assert.ok(registry.started_at, 'Should have started_at timestamp');
      assert.ok(registry.started_at >= before.slice(0, 19), 'started_at should be after start');
      assert.ok(registry.started_at <= after, 'started_at should be before end');
    });
  });

  describe('error handling', () => {
    it('fails if deliverable not found in registry', async () => {
      const result = await runStart('DEL-999', tempDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
      assert.strictEqual(result.errors[0].code, 'DWA-E041');
    });

    it('fails if .dwa/feature.json missing', async () => {
      await fs.remove(path.join(tempDir, '.dwa', 'feature.json'));

      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
      assert.strictEqual(result.errors[0].code, 'DWA-E040');
    });

    it('returns empty errors array on success', async () => {
      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(Array.isArray(result.errors));
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe('already-started detection', () => {
    it('returns alreadyStarted: true if packet already exists', async () => {
      // First start
      await runStart('DEL-001', tempDir);

      // Second start
      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.alreadyStarted, true);
      assert.ok(result.existingPath);
    });

    it('returns existingPath without generating new packet', async () => {
      // First start
      const firstResult = await runStart('DEL-001', tempDir);
      const firstContent = await fs.readFile(firstResult.packetPath, 'utf8');

      // Wait a bit to ensure timestamp would change
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second start
      const result = await runStart('DEL-001', tempDir);
      const secondContent = await fs.readFile(result.existingPath, 'utf8');

      // Content should be unchanged (same file, not regenerated)
      assert.strictEqual(firstContent, secondContent);
    });

    it('alreadyStarted is false when packet does not exist', async () => {
      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.alreadyStarted, false);
      assert.strictEqual(result.success, true);
    });

    it('does not update started_at when already started', async () => {
      // First start
      await runStart('DEL-001', tempDir);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const firstRegistry = await fs.readJSON(registryPath);
      const firstStartedAt = firstRegistry.started_at;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second start (already started)
      await runStart('DEL-001', tempDir);

      const secondRegistry = await fs.readJSON(registryPath);

      // started_at should not change
      assert.strictEqual(secondRegistry.started_at, firstStartedAt);
    });
  });

  describe('integration', () => {
    it('packet contains all required sections', async () => {
      const result = await runStart('DEL-001', tempDir);
      const content = await fs.readFile(result.packetPath, 'utf8');

      // Verify key sections
      assert.ok(content.includes('## 0) Control Block'));
      assert.ok(content.includes('## 1) MUST / MUST NOT Guardrails'));
      assert.ok(content.includes('## 2) Goal'));
      assert.ok(content.includes('## 4) Acceptance Criteria'));
      assert.ok(content.includes('## 7) Provenance'));
    });

    it('packet includes constraints from TDD', async () => {
      const result = await runStart('DEL-001', tempDir);
      const content = await fs.readFile(result.packetPath, 'utf8');

      // Check for TDD constraints
      assert.ok(content.includes('200ms') || content.includes('auth'));
    });

    it('packet includes deliverable info from registry', async () => {
      const result = await runStart('DEL-001', tempDir);
      const content = await fs.readFile(result.packetPath, 'utf8');

      // Check for registry info
      assert.ok(content.includes('DEL-001'));
      assert.ok(content.includes('Implement user authentication'));
    });
  });

  describe('staleness detection', () => {
    it('returns stale=false when spec hash matches', async () => {
      // Store matching spec hash in feature.json
      const specContent = await fs.readFile(path.join(tempDir, 'feature-spec.md'), 'utf8');
      const featureJsonPath = path.join(tempDir, '.dwa', 'feature.json');
      const featureJson = await fs.readJSON(featureJsonPath);
      featureJson.spec_content_hash = hashContent(specContent);
      await fs.writeJSON(featureJsonPath, featureJson, { spaces: 2 });

      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.stale, false);
      assert.strictEqual(result.success, true);
    });

    it('returns error DWA-E045 when spec changed without --force', async () => {
      // Store old hash in feature.json
      const featureJsonPath = path.join(tempDir, '.dwa', 'feature.json');
      const featureJson = await fs.readJSON(featureJsonPath);
      featureJson.spec_content_hash = hashContent('old content');
      await fs.writeJSON(featureJsonPath, featureJson, { spaces: 2 });

      const result = await runStart('DEL-001', tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.stale, true);
      assert.ok(result.errors.length > 0);
      assert.strictEqual(result.errors[0].code, 'DWA-E045');
      assert.ok(result.errors[0].message.includes('hash-changed'));
    });

    it('--force bypasses staleness check and generates packet', async () => {
      // Store old hash in feature.json
      const featureJsonPath = path.join(tempDir, '.dwa', 'feature.json');
      const featureJson = await fs.readJSON(featureJsonPath);
      featureJson.spec_content_hash = hashContent('old content');
      await fs.writeJSON(featureJsonPath, featureJson, { spaces: 2 });

      const result = await runStart('DEL-001', tempDir, { force: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.stale, true);
      assert.ok(result.packetPath);
    });

    it('generated packet includes staleness warning when forced', async () => {
      // Store old hash in feature.json
      const featureJsonPath = path.join(tempDir, '.dwa', 'feature.json');
      const featureJson = await fs.readJSON(featureJsonPath);
      featureJson.spec_content_hash = hashContent('old content');
      await fs.writeJSON(featureJsonPath, featureJson, { spaces: 2 });

      const result = await runStart('DEL-001', tempDir, { force: true });
      const content = await fs.readFile(result.packetPath, 'utf8');

      assert.ok(content.includes('STALENESS WARNING'));
      assert.ok(content.includes('changed since last parse'));
    });

    it('falls back to mtime when no stored hash', async () => {
      // Remove spec_content_hash from feature.json (mtime fallback)
      const featureJsonPath = path.join(tempDir, '.dwa', 'feature.json');
      const featureJson = await fs.readJSON(featureJsonPath);
      delete featureJson.spec_content_hash;
      await fs.writeJSON(featureJsonPath, featureJson, { spaces: 2 });

      // Touch spec to make it newer than feature.json
      await new Promise(resolve => setTimeout(resolve, 10));
      const specPath = path.join(tempDir, 'feature-spec.md');
      const specContent = await fs.readFile(specPath, 'utf8');
      await fs.writeFile(specPath, specContent + '\n');

      const result = await runStart('DEL-001', tempDir);

      // Should detect stale via mtime
      assert.strictEqual(result.stale, true);
      assert.strictEqual(result.errors[0].code, 'DWA-E045');
      assert.ok(result.errors[0].message.includes('mtime-newer'));
    });

    it('handles missing spec gracefully', async () => {
      // Delete spec file
      await fs.remove(path.join(tempDir, 'feature-spec.md'));

      const result = await runStart('DEL-001', tempDir);

      // Should not report as stale when spec doesn't exist
      assert.strictEqual(result.stale, false);
    });

    it('returns stalenessReason in result', async () => {
      // Store old hash in feature.json
      const featureJsonPath = path.join(tempDir, '.dwa', 'feature.json');
      const featureJson = await fs.readJSON(featureJsonPath);
      featureJson.spec_content_hash = hashContent('old content');
      await fs.writeJSON(featureJsonPath, featureJson, { spaces: 2 });

      const result = await runStart('DEL-001', tempDir, { force: true });

      assert.strictEqual(result.stale, true);
      assert.ok(result.stalenessReason);
      assert.ok(result.stalenessReason.includes('content has changed'));
    });
  });
});
