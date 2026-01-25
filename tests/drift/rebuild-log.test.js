/**
 * Tests for drift log rebuild functionality.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const {
  rebuildDriftLog,
  aggregateDriftEvents,
  categorizeEvents,
  groupByDeliverable
} = require('../../src/drift/rebuild-log');

describe('aggregateDriftEvents', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-rebuild-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('returns empty array when directory does not exist', async () => {
    const nonExistent = path.join(tempDir, 'nonexistent');
    const events = await aggregateDriftEvents(nonExistent);
    assert.deepStrictEqual(events, []);
  });

  it('returns empty array when no registries exist', async () => {
    const dir = path.join(tempDir, 'deliverables');
    await fs.ensureDir(dir);
    const events = await aggregateDriftEvents(dir);
    assert.deepStrictEqual(events, []);
  });

  it('returns empty array when registries have no drift_events', async () => {
    const dir = path.join(tempDir, 'deliverables');
    await fs.ensureDir(dir);
    await fs.writeJSON(path.join(dir, 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      description: 'Test'
    });
    const events = await aggregateDriftEvents(dir);
    assert.deepStrictEqual(events, []);
  });

  it('extracts events from single registry with deliverable_id', async () => {
    const dir = path.join(tempDir, 'deliverables');
    await fs.ensureDir(dir);
    await fs.writeJSON(path.join(dir, 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Test', decision: 'pending', source: 'manual' }
      ]
    });

    const events = await aggregateDriftEvents(dir);

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].deliverable_id, 'DEL-001');
    assert.strictEqual(events[0].id, 'e1');
  });

  it('aggregates events from multiple registries', async () => {
    const dir = path.join(tempDir, 'deliverables');
    await fs.ensureDir(dir);

    await fs.writeJSON(path.join(dir, 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'First', decision: 'pending', source: 'manual' }
      ]
    });

    await fs.writeJSON(path.join(dir, 'DEL-002.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-002',
      drift_events: [
        { id: 'e2', at: '2026-01-24T11:00:00Z', kind: 'scope_change', summary: 'Second', decision: 'accept', source: 'manual' }
      ]
    });

    const events = await aggregateDriftEvents(dir);

    assert.strictEqual(events.length, 2);
    // Sorted newest first
    assert.strictEqual(events[0].id, 'e2');
    assert.strictEqual(events[0].deliverable_id, 'DEL-002');
    assert.strictEqual(events[1].id, 'e1');
    assert.strictEqual(events[1].deliverable_id, 'DEL-001');
  });

  it('sorts events by timestamp (newest first)', async () => {
    const dir = path.join(tempDir, 'deliverables');
    await fs.ensureDir(dir);

    await fs.writeJSON(path.join(dir, 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'old', at: '2026-01-20T10:00:00Z', kind: 'impl_deviation', summary: 'Old', decision: 'pending', source: 'manual' },
        { id: 'new', at: '2026-01-25T10:00:00Z', kind: 'impl_deviation', summary: 'New', decision: 'pending', source: 'manual' },
        { id: 'mid', at: '2026-01-22T10:00:00Z', kind: 'impl_deviation', summary: 'Mid', decision: 'pending', source: 'manual' }
      ]
    });

    const events = await aggregateDriftEvents(dir);

    assert.strictEqual(events.length, 3);
    assert.strictEqual(events[0].id, 'new');
    assert.strictEqual(events[1].id, 'mid');
    assert.strictEqual(events[2].id, 'old');
  });

  it('ignores non-DEL files', async () => {
    const dir = path.join(tempDir, 'deliverables');
    await fs.ensureDir(dir);

    await fs.writeJSON(path.join(dir, 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [{ id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Test', decision: 'pending', source: 'manual' }]
    });

    // Non-DEL file should be ignored
    await fs.writeJSON(path.join(dir, 'other.json'), {
      drift_events: [{ id: 'ignored', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Ignored', decision: 'pending', source: 'manual' }]
    });

    const events = await aggregateDriftEvents(dir);

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'e1');
  });
});

describe('categorizeEvents', () => {
  it('categorizes pending as open', () => {
    const events = [
      { id: 'e1', decision: 'pending' }
    ];
    const { open, accepted, reverted } = categorizeEvents(events);

    assert.strictEqual(open.length, 1);
    assert.strictEqual(accepted.length, 0);
    assert.strictEqual(reverted.length, 0);
  });

  it('categorizes escalate as open', () => {
    const events = [
      { id: 'e1', decision: 'escalate' }
    ];
    const { open, accepted, reverted } = categorizeEvents(events);

    assert.strictEqual(open.length, 1);
    assert.strictEqual(accepted.length, 0);
    assert.strictEqual(reverted.length, 0);
  });

  it('categorizes accept as accepted', () => {
    const events = [
      { id: 'e1', decision: 'accept' }
    ];
    const { open, accepted, reverted } = categorizeEvents(events);

    assert.strictEqual(open.length, 0);
    assert.strictEqual(accepted.length, 1);
    assert.strictEqual(reverted.length, 0);
  });

  it('categorizes revert as reverted', () => {
    const events = [
      { id: 'e1', decision: 'revert' }
    ];
    const { open, accepted, reverted } = categorizeEvents(events);

    assert.strictEqual(open.length, 0);
    assert.strictEqual(accepted.length, 0);
    assert.strictEqual(reverted.length, 1);
  });

  it('handles mixed decisions', () => {
    const events = [
      { id: 'e1', decision: 'pending' },
      { id: 'e2', decision: 'escalate' },
      { id: 'e3', decision: 'accept' },
      { id: 'e4', decision: 'revert' }
    ];
    const { open, accepted, reverted } = categorizeEvents(events);

    assert.strictEqual(open.length, 2);
    assert.strictEqual(accepted.length, 1);
    assert.strictEqual(reverted.length, 1);
  });
});

describe('groupByDeliverable', () => {
  it('groups events by deliverable_id', () => {
    const events = [
      { id: 'e1', deliverable_id: 'DEL-001', at: '2026-01-24T10:00:00Z' },
      { id: 'e2', deliverable_id: 'DEL-002', at: '2026-01-24T11:00:00Z' },
      { id: 'e3', deliverable_id: 'DEL-001', at: '2026-01-24T12:00:00Z' }
    ];

    const groups = groupByDeliverable(events);

    assert.strictEqual(groups.length, 2);
    assert.strictEqual(groups[0].deliverable_id, 'DEL-001');
    assert.strictEqual(groups[0].events.length, 2);
    assert.strictEqual(groups[1].deliverable_id, 'DEL-002');
    assert.strictEqual(groups[1].events.length, 1);
  });

  it('sorts deliverables alphabetically', () => {
    const events = [
      { id: 'e1', deliverable_id: 'DEL-003', at: '2026-01-24T10:00:00Z' },
      { id: 'e2', deliverable_id: 'DEL-001', at: '2026-01-24T11:00:00Z' },
      { id: 'e3', deliverable_id: 'DEL-002', at: '2026-01-24T12:00:00Z' }
    ];

    const groups = groupByDeliverable(events);

    assert.strictEqual(groups[0].deliverable_id, 'DEL-001');
    assert.strictEqual(groups[1].deliverable_id, 'DEL-002');
    assert.strictEqual(groups[2].deliverable_id, 'DEL-003');
  });

  it('sorts events within group chronologically (oldest first)', () => {
    const events = [
      { id: 'new', deliverable_id: 'DEL-001', at: '2026-01-25T10:00:00Z' },
      { id: 'old', deliverable_id: 'DEL-001', at: '2026-01-20T10:00:00Z' },
      { id: 'mid', deliverable_id: 'DEL-001', at: '2026-01-22T10:00:00Z' }
    ];

    const groups = groupByDeliverable(events);

    assert.strictEqual(groups[0].events[0].id, 'old');
    assert.strictEqual(groups[0].events[1].id, 'mid');
    assert.strictEqual(groups[0].events[2].id, 'new');
  });

  it('returns empty array for no events', () => {
    const groups = groupByDeliverable([]);
    assert.deepStrictEqual(groups, []);
  });
});

describe('rebuildDriftLog', () => {
  let tempDir;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-rebuild-test-'));
    projectRoot = tempDir;
    await fs.ensureDir(path.join(projectRoot, '.dwa', 'deliverables'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('creates drift-log.md in .dwa directory', async () => {
    const result = await rebuildDriftLog(projectRoot);

    assert.ok(await fs.pathExists(result.logPath));
    assert.strictEqual(result.logPath, path.join(projectRoot, '.dwa', 'drift-log.md'));
  });

  it('returns correct counts for no drift events', async () => {
    const result = await rebuildDriftLog(projectRoot);

    assert.strictEqual(result.openDrift, 0);
    assert.strictEqual(result.totalEvents, 0);
  });

  it('shows "No open drift" message when no open drift', async () => {
    const result = await rebuildDriftLog(projectRoot);
    const content = await fs.readFile(result.logPath, 'utf8');

    assert.ok(content.includes('No open drift'));
  });

  it('counts open drift correctly', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Pending', decision: 'pending', source: 'manual' },
        { id: 'e2', at: '2026-01-24T11:00:00Z', kind: 'scope_change', summary: 'Escalate', decision: 'escalate', source: 'manual' },
        { id: 'e3', at: '2026-01-24T12:00:00Z', kind: 'qa_gap', summary: 'Accepted', decision: 'accept', source: 'manual' }
      ]
    });

    const result = await rebuildDriftLog(projectRoot);

    assert.strictEqual(result.openDrift, 2);
    assert.strictEqual(result.totalEvents, 3);
  });

  it('renders open drift events in log', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Test open drift', decision: 'pending', source: 'manual' }
      ]
    });

    const result = await rebuildDriftLog(projectRoot);
    const content = await fs.readFile(result.logPath, 'utf8');

    assert.ok(content.includes('DEL-001'));
    assert.ok(content.includes('impl_deviation'));
    assert.ok(content.includes('Test open drift'));
    assert.ok(content.includes('pending'));
  });

  it('renders accepted drift in table', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Accepted drift', decision: 'accept', source: 'manual' }
      ]
    });

    const result = await rebuildDriftLog(projectRoot);
    const content = await fs.readFile(result.logPath, 'utf8');

    assert.ok(content.includes('Accepted drift'));
    assert.ok(content.includes('Accepted Drift (Applied)'));
  });

  it('renders reverted drift in table', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Reverted drift', decision: 'revert', source: 'manual' }
      ]
    });

    const result = await rebuildDriftLog(projectRoot);
    const content = await fs.readFile(result.logPath, 'utf8');

    assert.ok(content.includes('Reverted drift'));
    assert.ok(content.includes('Reverted Drift (Rolled Back)'));
  });

  it('renders by-deliverable section', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'First', decision: 'pending', source: 'manual' }
      ]
    });

    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-002.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-002',
      drift_events: [
        { id: 'e2', at: '2026-01-24T11:00:00Z', kind: 'scope_change', summary: 'Second', decision: 'accept', source: 'manual' }
      ]
    });

    const result = await rebuildDriftLog(projectRoot);
    const content = await fs.readFile(result.logPath, 'utf8');

    assert.ok(content.includes('By Deliverable'));
    assert.ok(content.includes('### DEL-001'));
    assert.ok(content.includes('### DEL-002'));
  });

  it('is deterministic (same input produces same output)', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Test', decision: 'pending', source: 'manual' }
      ]
    });

    // First rebuild
    const result1 = await rebuildDriftLog(projectRoot);
    const content1 = await fs.readFile(result1.logPath, 'utf8');

    // Wait a moment to ensure timestamp could differ if not deterministic
    await new Promise(resolve => setTimeout(resolve, 10));

    // Second rebuild
    const result2 = await rebuildDriftLog(projectRoot);
    const content2 = await fs.readFile(result2.logPath, 'utf8');

    // Compare non-timestamp parts (timestamps will differ but rest should match)
    // Extract just the drift event content, not the generated_at header
    const eventContent1 = content1.split('---').slice(1).join('---');
    const eventContent2 = content2.split('---').slice(1).join('---');

    assert.strictEqual(eventContent1, eventContent2, 'Non-timestamp content should be identical');
  });

  it('includes warning for applies_to_next_work events', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Warning test', decision: 'pending', source: 'manual', applies_to_next_work: true }
      ]
    });

    const result = await rebuildDriftLog(projectRoot);
    const content = await fs.readFile(result.logPath, 'utf8');

    assert.ok(content.includes('WARNING'));
    assert.ok(content.includes('Applies to next work'));
  });
});
