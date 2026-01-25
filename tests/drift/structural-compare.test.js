/**
 * Tests for structural drift detection.
 * TDD RED phase: Write failing tests first.
 *
 * detectStructuralDrift compares spec vs registry to detect divergence.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { detectStructuralDrift } = require('../../src/drift/structural-compare');

describe('detectStructuralDrift', () => {
  let tempDir;
  let projectRoot;

  beforeEach(async () => {
    // Create temp directory for test isolation
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-structural-test-'));
    projectRoot = tempDir;

    // Create directory structure
    await fs.ensureDir(path.join(projectRoot, '.dwa', 'deliverables'));
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.remove(tempDir);
  });

  /**
   * Helper to create a feature.json file
   */
  async function createFeatureJson(specPath) {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'feature.json'), {
      schemaVersion: '1.0.0',
      feature_id: 'FEAT-2026-001',
      title: 'Test Feature',
      spec_path: specPath
    });
  }

  /**
   * Helper to create a feature spec with deliverables table.
   *
   * Note: Markdown table cells don't preserve newlines and pipes are column separators.
   * For AC count testing, we use semicolons as delimiters.
   *
   * The structural compare function counts ACs by splitting on:
   * - newlines (\n)
   * - <br> tags
   * - semicolons (;)
   */
  async function createSpec(deliverables) {
    const specPath = path.join(projectRoot, 'feature-spec.md');

    // Build deliverables table
    let table = `| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Story Points |\n`;
    table += `|----------------|------------|-------------|--------------------------------|---------------|------------------------|--------------|\n`;

    for (const del of deliverables) {
      // Convert acceptance_criteria array to semicolon-separated string for table
      // Each AC becomes one "line" when we split on semicolons
      const acs = Array.isArray(del.acceptance_criteria)
        ? del.acceptance_criteria.join('; ')
        : del.acceptance_criteria || '';
      table += `| ${del.id} | ${del.user_story || ''} | ${del.description || ''} | ${acs} | ${del.qa_notes || ''} | ${del.dependencies || ''} | ${del.points || ''} |\n`;
    }

    const content = `---
feature_id: FEAT-2026-001
title: Test Feature
status: Draft
spec_schema_version: v2.0
---

# Test Feature

## 3.1 Deliverables Table

${table}
`;

    await fs.writeFile(specPath, content, 'utf8');
    await createFeatureJson('feature-spec.md');

    return specPath;
  }

  describe('no drift detected', () => {
    it('returns detected: false when spec and registry match', async () => {
      // Create spec with one deliverable
      // The parser extracts table cells as single strings
      // ACs joined with '; ' become 'AC1; AC2; AC3' after parsing
      await createSpec([
        {
          id: 'DEL-001',
          user_story: 'As a user...',
          description: 'Implement feature X',
          acceptance_criteria: ['AC1: First criterion', 'AC2: Second criterion', 'AC3: Third criterion'],
          qa_notes: 'Test with fixtures'
        }
      ]);

      // Registry uses semicolon separation to match spec format
      // countACLines splits on semicolons, so 3 ACs in both
      const registry = {
        id: 'DEL-001',
        user_story: 'As a user...',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1: First criterion; AC2: Second criterion; AC3: Third criterion',
        qa_notes: 'Test with fixtures',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, false);
      assert.strictEqual(result.kind, null);
      assert.strictEqual(result.summary, null);
    });
  });

  describe('deliverable removed from spec', () => {
    it('detects when deliverable is removed from spec (orphaned)', async () => {
      // Create spec without DEL-001
      await createSpec([
        {
          id: 'DEL-002',
          description: 'Different deliverable'
        }
      ]);

      // Registry has DEL-001 which is not in spec
      const registry = {
        id: 'DEL-001',
        description: 'Original deliverable',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.kind, 'spec_update_needed');
      assert.ok(result.summary.includes('removed from spec'));
      assert.ok(result.summary.includes('DEL-001'));
    });
  });

  describe('AC count mismatch', () => {
    it('detects when spec has fewer ACs than registry', async () => {
      // Create spec with 3 ACs
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: ['AC1: First', 'AC2: Second', 'AC3: Third']
        }
      ]);

      // Registry has 5 ACs
      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1: First\nAC2: Second\nAC3: Third\nAC4: Fourth\nAC5: Fifth',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.kind, 'impl_deviation');
      assert.ok(result.summary.includes('AC count mismatch'));
      assert.ok(result.summary.includes('spec has 3'));
      assert.ok(result.summary.includes('registry has 5'));
    });

    it('detects when spec has more ACs than registry', async () => {
      // Create spec with 5 ACs
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: ['AC1: First', 'AC2: Second', 'AC3: Third', 'AC4: Fourth', 'AC5: Fifth']
        }
      ]);

      // Registry has 3 ACs
      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1: First\nAC2: Second\nAC3: Third',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.kind, 'impl_deviation');
      assert.ok(result.summary.includes('AC count mismatch'));
      assert.ok(result.summary.includes('spec has 5'));
      assert.ok(result.summary.includes('registry has 3'));
    });
  });

  describe('completed without PR URL', () => {
    it('detects qa_gap when completed but no PR URL', async () => {
      // Create spec
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: ['AC1: First']
        }
      ]);

      // Registry is completed but has no pr_url
      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1: First',
        status: 'completed'
        // No pr_url
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.kind, 'qa_gap');
      assert.ok(result.summary.includes('completed'));
      assert.ok(result.summary.includes('no PR URL'));
    });

    it('no qa_gap when completed with PR URL', async () => {
      // Create spec
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: ['AC1: First']
        }
      ]);

      // Registry is completed and has pr_url
      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1: First',
        status: 'completed',
        pr_url: 'https://github.com/org/repo/pull/42'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, false);
    });
  });

  describe('description changed', () => {
    it('detects when spec description differs from registry', async () => {
      // Create spec with updated description
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Updated description in spec',
          acceptance_criteria: ['AC1: First']
        }
      ]);

      // Registry has old description
      const registry = {
        id: 'DEL-001',
        description: 'Original description',
        acceptance_criteria: 'AC1: First',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.kind, 'spec_update_needed');
      assert.ok(result.summary.includes('Description changed'));
    });
  });

  describe('priority order', () => {
    it('reports removed from spec before AC count mismatch', async () => {
      // Create spec without DEL-001 (removed)
      await createSpec([
        {
          id: 'DEL-002',
          description: 'Different deliverable'
        }
      ]);

      // Registry has DEL-001 with different AC count too
      const registry = {
        id: 'DEL-001',
        description: 'Original deliverable',
        acceptance_criteria: 'AC1\nAC2\nAC3\nAC4\nAC5',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      // Should report removed from spec (priority 1) not AC count mismatch
      assert.strictEqual(result.kind, 'spec_update_needed');
      assert.ok(result.summary.includes('removed from spec'));
    });

    it('reports AC count mismatch before missing PR URL', async () => {
      // Create spec with 3 ACs
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: ['AC1', 'AC2', 'AC3']
        }
      ]);

      // Registry is completed with 5 ACs and no PR URL
      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1\nAC2\nAC3\nAC4\nAC5',
        status: 'completed'
        // No pr_url - would be qa_gap
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      // Should report AC count mismatch (priority 2) not missing PR URL
      assert.strictEqual(result.kind, 'impl_deviation');
      assert.ok(result.summary.includes('AC count mismatch'));
    });
  });

  describe('edge cases', () => {
    it('handles registry with empty acceptance_criteria', async () => {
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: ['AC1', 'AC2']
        }
      ]);

      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: '',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.kind, 'impl_deviation');
      assert.ok(result.summary.includes('AC count mismatch'));
      assert.ok(result.summary.includes('registry has 0'));
    });

    it('handles spec with empty acceptance_criteria', async () => {
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: []
        }
      ]);

      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1\nAC2',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.kind, 'impl_deviation');
      assert.ok(result.summary.includes('spec has 0'));
    });

    it('handles missing feature.json gracefully', async () => {
      // Don't create feature.json - just the deliverables dir
      const registry = {
        id: 'DEL-001',
        description: 'Test',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      // No spec to compare = no drift detected
      assert.strictEqual(result.detected, false);
    });

    it('handles missing spec_path in feature.json', async () => {
      // Create feature.json without spec_path
      await fs.writeJSON(path.join(projectRoot, '.dwa', 'feature.json'), {
        schemaVersion: '1.0.0',
        feature_id: 'FEAT-2026-001',
        title: 'Test Feature'
        // No spec_path
      });

      const registry = {
        id: 'DEL-001',
        description: 'Test',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      // No spec to compare = no drift detected
      assert.strictEqual(result.detected, false);
    });

    it('ignores whitespace differences in AC comparison', async () => {
      // Create spec with trailing/leading whitespace in ACs
      await createSpec([
        {
          id: 'DEL-001',
          description: 'Implement feature X',
          acceptance_criteria: ['  AC1: First  ', 'AC2: Second', '  AC3: Third']
        }
      ]);

      // Registry has same ACs (3 ACs) with different format but same count
      // countACLines trims whitespace and counts non-empty lines
      const registry = {
        id: 'DEL-001',
        description: 'Implement feature X',
        acceptance_criteria: 'AC1: First; AC2: Second; AC3: Third',
        status: 'in_progress'
      };

      const result = await detectStructuralDrift(registry, projectRoot);

      // Same count of ACs (3) = no mismatch
      assert.strictEqual(result.detected, false);
    });
  });
});
