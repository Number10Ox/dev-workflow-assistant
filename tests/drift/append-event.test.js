/**
 * Tests for append drift event functionality.
 * TDD RED phase: Write failing tests first.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { appendDriftEvent } = require('../../src/drift/append-event');

describe('appendDriftEvent', () => {
  let tempDir;
  let projectRoot;

  beforeEach(async () => {
    // Create temp directory for test isolation
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-append-test-'));
    projectRoot = tempDir;

    // Create .dwa/deliverables directory
    await fs.ensureDir(path.join(projectRoot, '.dwa', 'deliverables'));
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.remove(tempDir);
  });

  describe('first drift event', () => {
    it('creates drift_events array and appends event', async () => {
      // Create a registry file without drift_events
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable',
        status: 'in_progress'
      });

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Added error handling not in original ACs',
        decision: 'pending'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      // Verify drift_events array was created
      assert.ok(Array.isArray(result.drift_events));
      assert.strictEqual(result.drift_events.length, 1);

      // Verify event was added
      const event = result.drift_events[0];
      assert.strictEqual(event.source, 'complete_command');
      assert.strictEqual(event.kind, 'impl_deviation');
      assert.strictEqual(event.summary, 'Added error handling not in original ACs');
      assert.strictEqual(event.decision, 'pending');

      // Verify file was updated
      const saved = await fs.readJSON(registryPath);
      assert.strictEqual(saved.drift_events.length, 1);
    });

    it('auto-generates id if not provided', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      const event = result.drift_events[0];
      // UUID format: 8-4-4-4-12 hex characters
      assert.ok(event.id, 'id should be generated');
      assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id),
        `id should be UUID format, got: ${event.id}`);
    });

    it('auto-generates at timestamp if not provided', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const beforeTime = new Date().toISOString();

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      const afterTime = new Date().toISOString();
      const event = result.drift_events[0];

      assert.ok(event.at, 'at should be generated');
      assert.ok(event.at >= beforeTime, 'at should be >= beforeTime');
      assert.ok(event.at <= afterTime, 'at should be <= afterTime');
    });
  });

  describe('subsequent drift events', () => {
    it('appends after first event, preserves first unchanged', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      const firstEventId = '550e8400-e29b-41d4-a716-446655440000';
      const firstEventAt = '2026-01-24T10:00:00Z';

      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable',
        drift_events: [
          {
            id: firstEventId,
            at: firstEventAt,
            source: 'complete_command',
            kind: 'impl_deviation',
            summary: 'First event',
            decision: 'pending'
          }
        ],
        drift_open_count: 1
      });

      const secondEventData = {
        source: 'manual',
        kind: 'scope_change',
        summary: 'Second event',
        decision: 'accept'
      };

      const result = await appendDriftEvent('DEL-001', secondEventData, projectRoot);

      // Verify both events exist
      assert.strictEqual(result.drift_events.length, 2);

      // Verify first event unchanged
      const firstEvent = result.drift_events[0];
      assert.strictEqual(firstEvent.id, firstEventId);
      assert.strictEqual(firstEvent.at, firstEventAt);
      assert.strictEqual(firstEvent.summary, 'First event');

      // Verify second event appended
      const secondEvent = result.drift_events[1];
      assert.strictEqual(secondEvent.source, 'manual');
      assert.strictEqual(secondEvent.kind, 'scope_change');
      assert.strictEqual(secondEvent.summary, 'Second event');
      assert.strictEqual(secondEvent.decision, 'accept');
    });
  });

  describe('preserves provided id and at', () => {
    it('uses provided id instead of generating', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const customId = 'custom-id-12345';
      const eventData = {
        id: customId,
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      assert.strictEqual(result.drift_events[0].id, customId);
    });

    it('uses provided at instead of generating', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const customAt = '2025-06-15T12:00:00Z';
      const eventData = {
        at: customAt,
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      assert.strictEqual(result.drift_events[0].at, customAt);
    });
  });

  describe('validation errors', () => {
    it('throws validation error for invalid kind, no write occurs', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      const originalContent = {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      };
      await fs.writeJSON(registryPath, originalContent);

      const eventData = {
        source: 'complete_command',
        kind: 'invalid_kind',
        summary: 'Test summary',
        decision: 'pending'
      };

      await assert.rejects(
        () => appendDriftEvent('DEL-001', eventData, projectRoot),
        (err) => {
          assert.ok(err.message.includes('DWA-E071'));
          return true;
        }
      );

      // Verify file unchanged
      const saved = await fs.readJSON(registryPath);
      assert.strictEqual(saved.drift_events, undefined);
    });
  });

  describe('deliverable not found', () => {
    it('throws DWA-E080 when deliverable does not exist', async () => {
      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      await assert.rejects(
        () => appendDriftEvent('DEL-999', eventData, projectRoot),
        (err) => {
          assert.ok(err.message.includes('DWA-E080'));
          assert.ok(err.message.includes('DEL-999'));
          return true;
        }
      );
    });
  });

  describe('drift_open_count updates', () => {
    it('counts pending decisions as open', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      assert.strictEqual(result.drift_open_count, 1);
    });

    it('counts escalate decisions as open', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'escalate'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      assert.strictEqual(result.drift_open_count, 1);
    });

    it('does not count accept decisions as open', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'accept'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      assert.strictEqual(result.drift_open_count, 0);
    });

    it('does not count revert decisions as open', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'revert'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      assert.strictEqual(result.drift_open_count, 0);
    });

    it('updates open count with multiple events', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable',
        drift_events: [
          {
            id: 'event-1',
            at: '2026-01-24T10:00:00Z',
            source: 'complete_command',
            kind: 'impl_deviation',
            summary: 'First event',
            decision: 'pending'
          },
          {
            id: 'event-2',
            at: '2026-01-24T11:00:00Z',
            source: 'manual',
            kind: 'scope_change',
            summary: 'Second event',
            decision: 'accept'
          }
        ],
        drift_open_count: 1
      });

      const eventData = {
        source: 'skill',
        kind: 'qa_gap',
        summary: 'Third event',
        decision: 'escalate'
      };

      const result = await appendDriftEvent('DEL-001', eventData, projectRoot);

      // 1 pending + 1 escalate = 2 open
      assert.strictEqual(result.drift_open_count, 2);
      assert.strictEqual(result.drift_events.length, 3);
    });
  });

  describe('atomic write with schemaVersion', () => {
    it('writes via writeJsonWithSchema (has schemaVersion)', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        id: 'DEL-001',
        description: 'Test deliverable'
      });

      const eventData = {
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      await appendDriftEvent('DEL-001', eventData, projectRoot);

      // Verify file has schemaVersion
      const saved = await fs.readJSON(registryPath);
      assert.strictEqual(saved.schemaVersion, '1.0.0');
    });
  });
});
