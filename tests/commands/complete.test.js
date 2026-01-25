/**
 * Tests for Complete Deliverable command.
 * TDD RED phase: Write failing tests first.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { runComplete } = require('../../src/commands/complete');
const { SCHEMA_VERSION } = require('../../src/utils/schema');

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
  acceptance_criteria: 'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
  qa_notes: 'Test with valid and invalid credentials. Verify rate limiting.',
  dependencies: '',
  status: 'in_progress',
  created_at: '2026-01-25T00:00:00Z'
};

/**
 * Test fixture - spec content matching the deliverable
 */
const SPEC_CONTENT = `---
feature_id: FEAT-2026-TEST
title: "Test Feature"
status: draft
---

# Test Feature

## Deliverables Table

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies |
|----------------|------------|-------------|--------------------------------|---------------|--------------|
| DEL-001 | As a user, I want to login so that I can access my account | Implement user authentication with email and password | C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures | Test with valid and invalid credentials. Verify rate limiting. | |
`;

let tempDir;

describe('runComplete', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-complete-test-'));

    // Setup .dwa directory structure
    const dwaDir = path.join(tempDir, '.dwa');
    await fs.ensureDir(path.join(dwaDir, 'deliverables'));

    // Create feature.json
    await fs.writeJSON(path.join(dwaDir, 'feature.json'), FEATURE_JSON, { spaces: 2 });

    // Create spec file
    await fs.writeFile(path.join(tempDir, 'feature-spec.md'), SPEC_CONTENT);

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

  describe('basic completion (no drift)', () => {
    it('updates status to completed', async () => {
      const result = await runComplete('DEL-001', {}, tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.driftDetected, false);
      assert.strictEqual(result.driftRecorded, false);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.strictEqual(registry.status, 'completed');
    });

    it('sets completed_at timestamp', async () => {
      const before = new Date().toISOString();
      await runComplete('DEL-001', {}, tempDir);
      const after = new Date().toISOString();

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);

      assert.ok(registry.completed_at, 'Should have completed_at timestamp');
      assert.ok(registry.completed_at >= before.slice(0, 19), 'completed_at should be after start');
      assert.ok(registry.completed_at <= after, 'completed_at should be before end');
    });

    it('returns empty errors array on success', async () => {
      const result = await runComplete('DEL-001', {}, tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(Array.isArray(result.errors));
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe('captures evidence (PR URL and commit SHA)', () => {
    it('stores prUrl in registry.pr_url', async () => {
      const options = { prUrl: 'https://github.com/user/repo/pull/42' };
      await runComplete('DEL-001', options, tempDir);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);

      assert.strictEqual(registry.pr_url, 'https://github.com/user/repo/pull/42');
    });

    it('stores commitSha in registry.last_completed_commit', async () => {
      const options = { commitSha: 'abc1234def5678' };
      await runComplete('DEL-001', options, tempDir);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);

      assert.strictEqual(registry.last_completed_commit, 'abc1234def5678');
    });

    it('stores both prUrl and commitSha together', async () => {
      const options = {
        prUrl: 'https://github.com/user/repo/pull/42',
        commitSha: 'abc1234def5678'
      };
      await runComplete('DEL-001', options, tempDir);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);

      assert.strictEqual(registry.pr_url, 'https://github.com/user/repo/pull/42');
      assert.strictEqual(registry.last_completed_commit, 'abc1234def5678');
    });
  });

  describe('deliverable not found', () => {
    it('returns DWA-E080 error when deliverable does not exist', async () => {
      const result = await runComplete('DEL-999', {}, tempDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
      assert.strictEqual(result.errors[0].code, 'DWA-E080');
      assert.ok(result.errors[0].message.includes('DEL-999'));
    });

    it('does not create registry file for missing deliverable', async () => {
      await runComplete('DEL-999', {}, tempDir);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-999.json');
      assert.strictEqual(await fs.pathExists(registryPath), false);
    });
  });

  describe('drift detection', () => {
    it('detects AC count mismatch as drift', async () => {
      // Modify spec to have different AC count
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const result = await runComplete('DEL-001', {}, tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.driftDetected, true);
      assert.strictEqual(result.driftRecorded, false); // No decision provided
    });

    it('detects description change as drift', async () => {
      // Modify spec to have different description
      const modifiedSpec = SPEC_CONTENT.replace(
        'Implement user authentication with email and password',
        'Implement user authentication with OAuth'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const result = await runComplete('DEL-001', {}, tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.driftDetected, true);
    });

    it('returns driftDetected: false when spec matches registry', async () => {
      const result = await runComplete('DEL-001', {}, tempDir);

      assert.strictEqual(result.driftDetected, false);
    });
  });

  describe('drift recording with decision', () => {
    it('records drift event when decision is accept', async () => {
      // Create AC count mismatch
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = { driftDecision: 'accept' };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.driftDetected, true);
      assert.strictEqual(result.driftRecorded, true);

      // Verify drift event was recorded
      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.ok(registry.drift_events);
      assert.strictEqual(registry.drift_events.length, 1);
      assert.strictEqual(registry.drift_events[0].decision, 'accept');
      assert.strictEqual(registry.drift_events[0].source, 'complete_command');
    });

    it('records drift event when decision is revert', async () => {
      // Create AC count mismatch
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = { driftDecision: 'revert' };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.driftRecorded, true);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.strictEqual(registry.drift_events[0].decision, 'revert');
    });

    it('records drift event when decision is escalate', async () => {
      // Create AC count mismatch
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = { driftDecision: 'escalate' };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.driftRecorded, true);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.strictEqual(registry.drift_events[0].decision, 'escalate');
    });

    it('records drift event when decision is pending', async () => {
      // Create AC count mismatch
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = { driftDecision: 'pending' };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.driftRecorded, true);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.strictEqual(registry.drift_events[0].decision, 'pending');
    });

    it('includes appliesToNext in drift event when option is true', async () => {
      // Create AC count mismatch
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = { driftDecision: 'accept', appliesToNext: true };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.driftRecorded, true);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.strictEqual(registry.drift_events[0].applies_to_next_work, true);
    });

    it('includes notes in drift event when provided', async () => {
      // Create AC count mismatch
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = { driftDecision: 'accept', notes: 'Intentionally reduced scope' };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.driftRecorded, true);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.ok(registry.drift_events[0].author_notes === 'Intentionally reduced scope' ||
                registry.drift_events[0].notes === 'Intentionally reduced scope');
    });

    it('includes evidence_refs with prUrl and commitSha', async () => {
      // Create AC count mismatch
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = {
        driftDecision: 'accept',
        prUrl: 'https://github.com/user/repo/pull/42',
        commitSha: 'abc1234'
      };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.driftRecorded, true);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      const event = registry.drift_events[0];
      assert.ok(event.evidence_refs);
      assert.ok(event.evidence_refs.includes('https://github.com/user/repo/pull/42') ||
                event.evidence_refs.pr_url === 'https://github.com/user/repo/pull/42');
    });
  });

  describe('drift decision without drift', () => {
    it('does not record drift event if no drift detected', async () => {
      // Spec matches registry, so no drift
      const options = { driftDecision: 'accept' };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.driftDetected, false);
      assert.strictEqual(result.driftRecorded, false);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      assert.ok(!registry.drift_events || registry.drift_events.length === 0);
    });
  });

  describe('invalid drift decision', () => {
    it('returns DWA-E072 error for invalid decision value', async () => {
      // Create drift scenario
      const modifiedSpec = SPEC_CONTENT.replace(
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error; E1: Rate limit after 5 failures',
        'C1: Valid credentials redirect to dashboard; F1: Invalid credentials show error'
      );
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const options = { driftDecision: 'invalid_decision' };
      const result = await runComplete('DEL-001', options, tempDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
      assert.strictEqual(result.errors[0].code, 'DWA-E072');
    });
  });

  describe('idempotent completion', () => {
    it('re-completes already completed deliverable', async () => {
      // First completion
      await runComplete('DEL-001', { prUrl: 'https://github.com/user/repo/pull/42' }, tempDir);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const firstRegistry = await fs.readJSON(registryPath);
      const firstCompletedAt = firstRegistry.completed_at;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second completion
      const result = await runComplete('DEL-001', { prUrl: 'https://github.com/user/repo/pull/43' }, tempDir);

      assert.strictEqual(result.success, true);

      const secondRegistry = await fs.readJSON(registryPath);
      // completed_at should update
      assert.ok(secondRegistry.completed_at > firstCompletedAt);
      // pr_url should update
      assert.strictEqual(secondRegistry.pr_url, 'https://github.com/user/repo/pull/43');
    });
  });

  describe('integration with structural drift detection', () => {
    it('calls detectStructuralDrift during completion', async () => {
      // This test verifies integration by checking a specific drift type
      // Remove deliverable from spec to trigger spec_update_needed drift
      const modifiedSpec = `---
feature_id: FEAT-2026-TEST
title: "Test Feature"
status: draft
---

# Test Feature

## Deliverables Table

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies |
|----------------|------------|-------------|--------------------------------|---------------|--------------|
| DEL-002 | Different story | Different description | AC1 | Notes | |
`;
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), modifiedSpec);

      const result = await runComplete('DEL-001', { driftDecision: 'pending' }, tempDir);

      assert.strictEqual(result.driftDetected, true);
      assert.strictEqual(result.driftRecorded, true);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);
      // Should be spec_update_needed for removed deliverable
      assert.strictEqual(registry.drift_events[0].kind, 'spec_update_needed');
    });
  });

  describe('schema version preservation', () => {
    it('preserves schemaVersion in registry after completion', async () => {
      await runComplete('DEL-001', {}, tempDir);

      const registryPath = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const registry = await fs.readJSON(registryPath);

      assert.strictEqual(registry.schemaVersion, SCHEMA_VERSION);
    });
  });
});
