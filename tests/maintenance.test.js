/**
 * Tests for DWA Maintenance Utilities.
 *
 * Tests structured returns, safety checks, and freshness detection.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const DWAMaintenance = require('../src/maintenance');
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
  tdd_path: null,
  created_at: '2026-01-25T00:00:00Z'
};

/**
 * Test fixture - valid deliverable
 */
const VALID_DELIVERABLE = {
  schemaVersion: SCHEMA_VERSION,
  id: 'DEL-001',
  user_story: 'As a user, I want to test',
  description: 'Test description',
  acceptance_criteria: 'C1: Test passes',
  qa_notes: 'Manual test',
  status: 'pending',
  created_at: '2026-01-25T00:00:00Z'
};

/**
 * Test fixture - orphaned deliverable (old, safe to delete)
 */
function createOrphanedDeliverable(daysAgo, extras = {}) {
  const orphanedAt = new Date();
  orphanedAt.setDate(orphanedAt.getDate() - daysAgo);
  return {
    ...VALID_DELIVERABLE,
    orphaned: true,
    orphaned_at: orphanedAt.toISOString(),
    ...extras
  };
}

/**
 * Test fixture - spec content
 */
const SPEC_CONTENT = `---
feature_id: FEAT-2026-TEST
title: "Test Feature"
---

# Test Feature

Test content.
`;

describe('DWAMaintenance', () => {
  let tempDir;
  let maintenance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-maint-test-'));
    maintenance = new DWAMaintenance(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('cleanupOrphaned', () => {
    it('removes deliverables orphaned > threshold days with no links', async () => {
      // Setup: create .dwa with orphaned deliverable (45 days old)
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(path.join(delDir, 'DEL-001.json'), createOrphanedDeliverable(45));

      const result = await maintenance.cleanupOrphaned(30);

      assert.strictEqual(result.cleaned.length, 1);
      assert.strictEqual(result.cleaned[0].id, 'DEL-001');
      assert.strictEqual(result.cleaned[0].reason, 'orphaned-safe');
      assert.ok(!await fs.pathExists(path.join(delDir, 'DEL-001.json')));
    });

    it('preserves deliverables orphaned < threshold days', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(path.join(delDir, 'DEL-001.json'), createOrphanedDeliverable(15));

      const result = await maintenance.cleanupOrphaned(30);

      assert.strictEqual(result.cleaned.length, 0);
      assert.strictEqual(result.skipped.length, 1);
      assert.strictEqual(result.skipped[0].reason, 'too-recent');
      assert.ok(await fs.pathExists(path.join(delDir, 'DEL-001.json')));
    });

    it('preserves orphaned deliverables with linear_issue_id', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(
        path.join(delDir, 'DEL-001.json'),
        createOrphanedDeliverable(45, { linear_issue_id: 'abc123' })
      );

      const result = await maintenance.cleanupOrphaned(30);

      assert.strictEqual(result.cleaned.length, 0);
      assert.strictEqual(result.skipped.length, 1);
      assert.strictEqual(result.skipped[0].reason, 'has-linear-link');
    });

    it('preserves orphaned deliverables with pr_url', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(
        path.join(delDir, 'DEL-001.json'),
        createOrphanedDeliverable(45, { pr_url: 'https://github.com/test/pr/1' })
      );

      const result = await maintenance.cleanupOrphaned(30);

      assert.strictEqual(result.cleaned.length, 0);
      assert.strictEqual(result.skipped[0].reason, 'has-pr-link');
    });

    it('preserves orphaned deliverables with drift_events', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(
        path.join(delDir, 'DEL-001.json'),
        createOrphanedDeliverable(45, { drift_events: [{ type: 'test' }] })
      );

      const result = await maintenance.cleanupOrphaned(30);

      assert.strictEqual(result.cleaned.length, 0);
      assert.strictEqual(result.skipped[0].reason, 'has-drift-events');
    });

    it('handles missing .dwa directory gracefully', async () => {
      const result = await maintenance.cleanupOrphaned(30);

      assert.strictEqual(result.cleaned.length, 0);
      assert.strictEqual(result.skipped.length, 0);
      assert.strictEqual(result.errors.length, 0);
    });

    it('returns thresholdDays in result metadata', async () => {
      const result = await maintenance.cleanupOrphaned(45);

      assert.strictEqual(result.thresholdDays, 45);
    });
  });

  describe('validateState', () => {
    it('returns valid=true when state is correct', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(path.join(delDir, 'DEL-001.json'), VALID_DELIVERABLE);

      const result = await maintenance.validateState();

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.issues.length, 0);
    });

    it('returns issues with code/message/path structure', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      // Missing feature.json

      const result = await maintenance.validateState();

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.length > 0);
      assert.ok(result.issues[0].code);
      assert.ok(result.issues[0].message);
      assert.ok(result.issues[0].path);
    });

    it('detects missing schemaVersion (DWA-V003)', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(path.join(delDir, 'DEL-001.json'), { id: 'DEL-001' }); // Missing schemaVersion

      const result = await maintenance.validateState();

      assert.strictEqual(result.valid, false);
      const v003 = result.issues.find(i => i.code === 'DWA-V003');
      assert.ok(v003, 'Should have DWA-V003 issue');
    });

    it('detects invalid JSON files (DWA-V002)', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeFile(path.join(delDir, 'DEL-001.json'), '{ invalid json }');

      const result = await maintenance.validateState();

      assert.strictEqual(result.valid, false);
      const v002 = result.issues.find(i => i.code === 'DWA-V002');
      assert.ok(v002, 'Should have DWA-V002 issue');
    });

    it('detects missing required files (DWA-V001)', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      // No feature.json

      const result = await maintenance.validateState();

      assert.strictEqual(result.valid, false);
      const v001 = result.issues.find(i => i.code === 'DWA-V001');
      assert.ok(v001, 'Should have DWA-V001 issue');
    });
  });

  describe('getStats', () => {
    it('returns null when no .dwa directory', async () => {
      const result = await maintenance.getStats();

      assert.strictEqual(result, null);
    });

    it('returns accurate counts for deliverables/packets', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      const packetsDir = path.join(dwaDir, 'packets');
      await fs.ensureDir(delDir);
      await fs.ensureDir(packetsDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(path.join(delDir, 'DEL-001.json'), VALID_DELIVERABLE);
      await fs.writeJson(path.join(delDir, 'DEL-002.json'), VALID_DELIVERABLE);
      await fs.writeFile(path.join(packetsDir, 'DEL-001.md'), '# Packet');

      const result = await maintenance.getStats();

      assert.strictEqual(result.deliverables, 2);
      assert.strictEqual(result.packets, 1);
    });

    it('counts orphaned deliverables separately', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const delDir = path.join(dwaDir, 'deliverables');
      await fs.ensureDir(delDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      await fs.writeJson(path.join(delDir, 'DEL-001.json'), VALID_DELIVERABLE);
      await fs.writeJson(path.join(delDir, 'DEL-002.json'), createOrphanedDeliverable(10));

      const result = await maintenance.getStats();

      assert.strictEqual(result.deliverables, 2);
      assert.strictEqual(result.orphaned, 1);
    });

    it('returns diskUsageBytes for programmatic use', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);

      const result = await maintenance.getStats();

      assert.ok(typeof result.diskUsageBytes === 'number');
      assert.ok(result.diskUsageBytes >= 0);
    });
  });

  describe('checkFreshness', () => {
    it('sources spec path from feature.json', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), {
        ...FEATURE_JSON,
        spec_path: 'docs/my-spec.md'
      });
      await fs.ensureDir(path.join(tempDir, 'docs'));
      await fs.writeFile(path.join(tempDir, 'docs', 'my-spec.md'), SPEC_CONTENT);

      const result = await maintenance.checkFreshness();

      assert.strictEqual(result.specPath, 'docs/my-spec.md');
    });

    it('returns stale=false with reason=null when hash matches', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), SPEC_CONTENT);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), {
        ...FEATURE_JSON,
        spec_content_hash: hashContent(SPEC_CONTENT)
      });

      const result = await maintenance.checkFreshness();

      assert.strictEqual(result.stale, false);
      assert.strictEqual(result.reason, null);
    });

    it('returns stale=true with reason=hash-changed when hash differs', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), SPEC_CONTENT + '\n# Changed');
      await fs.writeJson(path.join(dwaDir, 'feature.json'), {
        ...FEATURE_JSON,
        spec_content_hash: hashContent(SPEC_CONTENT) // Old hash
      });

      const result = await maintenance.checkFreshness();

      assert.strictEqual(result.stale, true);
      assert.strictEqual(result.reason, 'hash-changed');
    });

    it('falls back to mtime with reason=mtime-newer when no stored hash', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      // Wait a bit to ensure mtime difference
      await new Promise(r => setTimeout(r, 50));
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), SPEC_CONTENT);

      const result = await maintenance.checkFreshness();

      assert.strictEqual(result.stale, true);
      assert.strictEqual(result.reason, 'mtime-newer');
      assert.strictEqual(result.storedHash, null);
    });

    it('returns reason=no-provenance when mtime matches but no hash', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      // Create spec first, then feature.json (so feature.json is newer)
      await fs.writeFile(path.join(tempDir, 'feature-spec.md'), SPEC_CONTENT);
      await new Promise(r => setTimeout(r, 50));
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);

      const result = await maintenance.checkFreshness();

      assert.strictEqual(result.stale, false);
      assert.strictEqual(result.reason, 'no-provenance');
    });

    it('handles missing spec gracefully (reason=no-spec)', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);
      // No spec file

      const result = await maintenance.checkFreshness();

      assert.strictEqual(result.stale, false);
      assert.strictEqual(result.reason, 'no-spec');
    });

    it('handles missing registry gracefully (reason=no-registry)', async () => {
      // No .dwa directory at all

      const result = await maintenance.checkFreshness();

      assert.strictEqual(result.stale, true);
      assert.strictEqual(result.reason, 'no-registry');
    });
  });

  describe('removeAllState', () => {
    it('creates backup before removal by default', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);

      const result = await maintenance.removeAllState();

      assert.strictEqual(result.removed, true);
      assert.ok(result.backupPath);
      assert.ok(await fs.pathExists(result.backupPath));
      assert.ok(!await fs.pathExists(dwaDir));

      // Cleanup backup
      await fs.remove(result.backupPath);
    });

    it('skips backup when options.backup=false', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);
      await fs.writeJson(path.join(dwaDir, 'feature.json'), FEATURE_JSON);

      const result = await maintenance.removeAllState({ backup: false });

      assert.strictEqual(result.removed, true);
      assert.strictEqual(result.backupPath, undefined);
      assert.ok(!await fs.pathExists(dwaDir));
    });

    it('returns removed=false when no .dwa exists', async () => {
      const result = await maintenance.removeAllState();

      assert.strictEqual(result.removed, false);
    });
  });
});

describe('hashContent utility', () => {
  it('returns consistent hash for same content', () => {
    const content = 'test content';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);

    assert.strictEqual(hash1, hash2);
  });

  it('returns different hash for different content', () => {
    const hash1 = hashContent('content A');
    const hash2 = hashContent('content B');

    assert.notStrictEqual(hash1, hash2);
  });

  it('returns hash in sha256:hex format', () => {
    const hash = hashContent('test');

    assert.ok(hash.startsWith('sha256:'));
    assert.strictEqual(hash.length, 7 + 64); // 'sha256:' + 64 hex chars
  });
});
