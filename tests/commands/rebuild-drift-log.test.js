/**
 * Tests for rebuild drift log command.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { runRebuildDriftLog } = require('../../src/commands/rebuild-drift-log');

describe('runRebuildDriftLog', () => {
  let tempDir;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-rebuild-cmd-test-'));
    projectRoot = tempDir;
    await fs.ensureDir(path.join(projectRoot, '.dwa', 'deliverables'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('returns success true on successful rebuild', async () => {
    const result = await runRebuildDriftLog(projectRoot);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('returns correct counts', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Open', decision: 'pending', source: 'manual' },
        { id: 'e2', at: '2026-01-24T11:00:00Z', kind: 'scope_change', summary: 'Closed', decision: 'accept', source: 'manual' }
      ]
    });

    const result = await runRebuildDriftLog(projectRoot);

    assert.strictEqual(result.openDrift, 1);
    assert.strictEqual(result.totalEvents, 2);
  });

  it('returns logPath on success', async () => {
    const result = await runRebuildDriftLog(projectRoot);

    assert.ok(result.logPath);
    assert.ok(result.logPath.endsWith('drift-log.md'));
  });

  it('returns structured result format for VS Code extension', async () => {
    const result = await runRebuildDriftLog(projectRoot);

    // Verify all expected fields exist
    assert.ok('success' in result);
    assert.ok('openDrift' in result);
    assert.ok('totalEvents' in result);
    assert.ok('logPath' in result);
    assert.ok('errors' in result);
    assert.ok(Array.isArray(result.errors));
  });

  it('handles empty deliverables directory', async () => {
    const result = await runRebuildDriftLog(projectRoot);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.openDrift, 0);
    assert.strictEqual(result.totalEvents, 0);
  });

  it('handles multiple deliverables with mixed drift', async () => {
    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-001',
      drift_events: [
        { id: 'e1', at: '2026-01-24T10:00:00Z', kind: 'impl_deviation', summary: 'Pending', decision: 'pending', source: 'manual' }
      ]
    });

    await fs.writeJSON(path.join(projectRoot, '.dwa', 'deliverables', 'DEL-002.json'), {
      schemaVersion: '1.0.0',
      id: 'DEL-002',
      drift_events: [
        { id: 'e2', at: '2026-01-24T11:00:00Z', kind: 'scope_change', summary: 'Escalate', decision: 'escalate', source: 'manual' },
        { id: 'e3', at: '2026-01-24T12:00:00Z', kind: 'qa_gap', summary: 'Accept', decision: 'accept', source: 'manual' }
      ]
    });

    const result = await runRebuildDriftLog(projectRoot);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.openDrift, 2); // pending + escalate
    assert.strictEqual(result.totalEvents, 3);
  });

  it('creates drift-log.md file', async () => {
    const result = await runRebuildDriftLog(projectRoot);

    assert.ok(await fs.pathExists(result.logPath));
    const content = await fs.readFile(result.logPath, 'utf8');
    assert.ok(content.includes('# Drift Log'));
  });
});
