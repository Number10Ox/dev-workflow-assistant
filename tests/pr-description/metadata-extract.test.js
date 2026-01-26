/**
 * Tests for PR description metadata extraction utilities.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const {
  extractDeliverableMetadata,
  extractDriftSummary,
  splitAcceptanceCriteria,
  extractAcceptanceCriteria
} = require('../../src/pr-description/metadata-extract');

describe('metadata-extract', () => {
  let tempDir;
  let projectRoot;

  beforeEach(async () => {
    // Create temp directory for test isolation
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-metadata-test-'));
    projectRoot = tempDir;

    // Create .dwa/deliverables directory
    await fs.ensureDir(path.join(projectRoot, '.dwa', 'deliverables'));
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.remove(tempDir);
  });

  describe('extractDeliverableMetadata', () => {
    it('extracts all fields from valid deliverable', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-001',
        user_story: 'As a developer, I want to test PR generation',
        description: 'Build PR description generator',
        acceptance_criteria: 'AC1; AC2; AC3',
        qa_notes: 'Test with real deliverables',
        status: 'in_progress',
        pr_url: 'https://github.com/org/repo/pull/123',
        linear_url: 'https://linear.app/team/issue/DEL-001'
      });

      const metadata = await extractDeliverableMetadata('DEL-001', projectRoot);

      assert.strictEqual(metadata.deliverable_id, 'DEL-001');
      assert.strictEqual(metadata.user_story, 'As a developer, I want to test PR generation');
      assert.strictEqual(metadata.description, 'Build PR description generator');
      assert.deepStrictEqual(metadata.acceptance_criteria, ['AC1', 'AC2', 'AC3']);
      assert.strictEqual(metadata.qa_plan_notes, 'Test with real deliverables');
      assert.strictEqual(metadata.status, 'in_progress');
      assert.strictEqual(metadata.pr_url, 'https://github.com/org/repo/pull/123');
      assert.strictEqual(metadata.linear_url, 'https://linear.app/team/issue/DEL-001');
    });

    it('handles missing optional fields gracefully', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-002.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-002'
      });

      const metadata = await extractDeliverableMetadata('DEL-002', projectRoot);

      assert.strictEqual(metadata.deliverable_id, 'DEL-002');
      assert.strictEqual(metadata.user_story, 'No user story provided.');
      assert.strictEqual(metadata.description, 'No description provided.');
      assert.deepStrictEqual(metadata.acceptance_criteria, []);
      assert.strictEqual(metadata.qa_plan_notes, '');
      assert.strictEqual(metadata.status, 'unknown');
      assert.strictEqual(metadata.pr_url, null);
      assert.strictEqual(metadata.linear_url, null);
    });

    it('throws clear error when deliverable not found', async () => {
      await assert.rejects(
        () => extractDeliverableMetadata('DEL-999', projectRoot),
        (err) => {
          assert.ok(err.message.includes('DEL-999'));
          assert.ok(err.message.includes('not found'));
          assert.ok(err.message.includes('Run \'dwa parse\''));
          return true;
        }
      );
    });

    it('uses qa_plan_notes field if qa_notes missing', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-003.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-003',
        qa_plan_notes: 'Test from qa_plan_notes field'
      });

      const metadata = await extractDeliverableMetadata('DEL-003', projectRoot);

      assert.strictEqual(metadata.qa_plan_notes, 'Test from qa_plan_notes field');
    });
  });

  describe('extractAcceptanceCriteria', () => {
    it('preserves grouped AC format (Phase 4 structure)', () => {
      const deliverable = {
        acceptance_criteria_grouped: {
          core: [
            { id: 'C1', text: 'Core requirement 1' },
            { id: 'C2', text: 'Core requirement 2' }
          ],
          functional: [
            { id: 'F1', text: 'Functional requirement 1' }
          ],
          edge: [],
          nonfunctional: []
        }
      };

      const result = extractAcceptanceCriteria(deliverable);

      assert.deepStrictEqual(result, deliverable.acceptance_criteria_grouped);
    });

    it('uses array format when grouped not available', () => {
      const deliverable = {
        acceptance_criteria: ['AC1', 'AC2', 'AC3']
      };

      const result = extractAcceptanceCriteria(deliverable);

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3']);
    });

    it('falls back to splitting string format (legacy)', () => {
      const deliverable = {
        acceptance_criteria: 'AC1; AC2; AC3'
      };

      const result = extractAcceptanceCriteria(deliverable);

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3']);
    });

    it('returns empty array when no AC present', () => {
      const deliverable = {};

      const result = extractAcceptanceCriteria(deliverable);

      assert.deepStrictEqual(result, []);
    });
  });

  describe('splitAcceptanceCriteria', () => {
    it('splits by semicolons', () => {
      const result = splitAcceptanceCriteria('AC1; AC2; AC3');

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3']);
    });

    it('splits by newlines', () => {
      const result = splitAcceptanceCriteria('AC1\nAC2\nAC3');

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3']);
    });

    it('splits by <br> tags', () => {
      const result = splitAcceptanceCriteria('AC1<br>AC2<br/>AC3');

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3']);
    });

    it('splits by mixed separators', () => {
      const result = splitAcceptanceCriteria('AC1; AC2\nAC3<br>AC4');

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3', 'AC4']);
    });

    it('trims whitespace from each item', () => {
      const result = splitAcceptanceCriteria('  AC1  ;  AC2  ;  AC3  ');

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3']);
    });

    it('filters empty entries', () => {
      const result = splitAcceptanceCriteria('AC1;;AC2;\n\nAC3');

      assert.deepStrictEqual(result, ['AC1', 'AC2', 'AC3']);
    });

    it('returns empty array for null or undefined', () => {
      assert.deepStrictEqual(splitAcceptanceCriteria(null), []);
      assert.deepStrictEqual(splitAcceptanceCriteria(undefined), []);
      assert.deepStrictEqual(splitAcceptanceCriteria(''), []);
    });
  });

  describe('extractDriftSummary', () => {
    it('returns summary with open drift events', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-001',
        drift_events: [
          {
            id: 'evt-1',
            at: '2026-01-25T10:00:00Z',
            source: 'complete_command',
            kind: 'impl_deviation',
            summary: 'Added retry logic',
            decision: 'pending'
          },
          {
            id: 'evt-2',
            at: '2026-01-25T11:00:00Z',
            source: 'manual',
            kind: 'scope_change',
            summary: 'Changed error format',
            decision: 'escalate'
          }
        ]
      });

      const summary = await extractDriftSummary('DEL-001', projectRoot);

      assert.strictEqual(summary.hasOpenDrift, true);
      assert.strictEqual(summary.openCount, 2);
      assert.strictEqual(summary.acceptedCount, 0);
      assert.strictEqual(summary.events.length, 2);
      assert.strictEqual(summary.events[0].decision, 'pending');
      assert.strictEqual(summary.events[0].summary, 'Added retry logic');
      assert.strictEqual(summary.events[1].decision, 'escalate');
      assert.strictEqual(summary.events[1].summary, 'Changed error format');
    });

    it('includes accepted events in summary', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-002.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-002',
        drift_events: [
          {
            id: 'evt-1',
            at: '2026-01-25T10:00:00Z',
            summary: 'Pending change',
            decision: 'pending'
          },
          {
            id: 'evt-2',
            at: '2026-01-25T11:00:00Z',
            summary: 'Accepted change',
            decision: 'accept'
          },
          {
            id: 'evt-3',
            at: '2026-01-25T12:00:00Z',
            summary: 'Reverted change',
            decision: 'revert'
          }
        ]
      });

      const summary = await extractDriftSummary('DEL-002', projectRoot);

      assert.strictEqual(summary.hasOpenDrift, true);
      assert.strictEqual(summary.openCount, 1);
      assert.strictEqual(summary.acceptedCount, 1);
      // Events includes pending and accepted (not revert)
      assert.strictEqual(summary.events.length, 2);
      assert.strictEqual(summary.events[0].decision, 'pending');
      assert.strictEqual(summary.events[1].decision, 'accept');
    });

    it('returns empty summary when no drift events', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-003.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-003'
      });

      const summary = await extractDriftSummary('DEL-003', projectRoot);

      assert.strictEqual(summary.hasOpenDrift, false);
      assert.strictEqual(summary.openCount, 0);
      assert.strictEqual(summary.acceptedCount, 0);
      assert.deepStrictEqual(summary.events, []);
    });

    it('returns empty summary when deliverable not found', async () => {
      const summary = await extractDriftSummary('DEL-999', projectRoot);

      assert.strictEqual(summary.hasOpenDrift, false);
      assert.strictEqual(summary.openCount, 0);
      assert.strictEqual(summary.acceptedCount, 0);
      assert.deepStrictEqual(summary.events, []);
    });

    it('handles events with description field instead of summary', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-004.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-004',
        drift_events: [
          {
            id: 'evt-1',
            at: '2026-01-25T10:00:00Z',
            description: 'Using description field',
            decision: 'pending'
          }
        ]
      });

      const summary = await extractDriftSummary('DEL-004', projectRoot);

      assert.strictEqual(summary.events[0].summary, 'Using description field');
    });
  });
});
