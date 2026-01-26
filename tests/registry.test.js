const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const { updateRegistry } = require('../src/parser/registry');
const { SCHEMA_VERSION } = require('../src/utils/schema');

/**
 * Test fixtures - deliverables parsed from spec
 */
const DELIVERABLES_3 = [
  {
    'Deliverable ID': 'DEL-001',
    'User Story': 'As a user, I want login',
    'Description': 'Implement login form',
    'Acceptance Criteria (testable)': 'Given valid creds, when submit, then redirect',
    'QA Plan Notes': 'Manual test',
    'Dependencies (DEL-###)': ''
  },
  {
    'Deliverable ID': 'DEL-002',
    'User Story': 'As a user, I want logout',
    'Description': 'Implement logout button',
    'Acceptance Criteria (testable)': 'Given logged in, when click logout, then session ends',
    'QA Plan Notes': 'Automated',
    'Dependencies (DEL-###)': 'DEL-001'
  },
  {
    'Deliverable ID': 'DEL-003',
    'User Story': 'As a user, I want profile',
    'Description': 'Implement profile page',
    'Acceptance Criteria (testable)': 'Given logged in, when navigate to profile, then see user info',
    'QA Plan Notes': 'Manual test',
    'Dependencies (DEL-###)': ''
  }
];

const DELIVERABLES_EDITED_001 = [
  {
    'Deliverable ID': 'DEL-001',
    'User Story': 'As a user, I want secure login', // Changed
    'Description': 'Implement login form with MFA', // Changed
    'Acceptance Criteria (testable)': 'Given valid creds, when submit, then redirect',
    'QA Plan Notes': 'Manual test',
    'Dependencies (DEL-###)': ''
  },
  {
    'Deliverable ID': 'DEL-002',
    'User Story': 'As a user, I want logout',
    'Description': 'Implement logout button',
    'Acceptance Criteria (testable)': 'Given logged in, when click logout, then session ends',
    'QA Plan Notes': 'Automated',
    'Dependencies (DEL-###)': 'DEL-001'
  },
  {
    'Deliverable ID': 'DEL-003',
    'User Story': 'As a user, I want profile',
    'Description': 'Implement profile page',
    'Acceptance Criteria (testable)': 'Given logged in, when navigate to profile, then see user info',
    'QA Plan Notes': 'Manual test',
    'Dependencies (DEL-###)': ''
  }
];

const DELIVERABLES_MISSING_002 = [
  {
    'Deliverable ID': 'DEL-001',
    'User Story': 'As a user, I want login',
    'Description': 'Implement login form',
    'Acceptance Criteria (testable)': 'Given valid creds, when submit, then redirect',
    'QA Plan Notes': 'Manual test',
    'Dependencies (DEL-###)': ''
  },
  {
    'Deliverable ID': 'DEL-003',
    'User Story': 'As a user, I want profile',
    'Description': 'Implement profile page',
    'Acceptance Criteria (testable)': 'Given logged in, when navigate to profile, then see user info',
    'QA Plan Notes': 'Manual test',
    'Dependencies (DEL-###)': ''
  }
];

let tempDir;
let registryDir;

describe('updateRegistry', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-registry-test-'));
    registryDir = path.join(tempDir, '.dwa', 'deliverables');
    await fs.ensureDir(registryDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  describe('fresh parse (no existing files)', () => {
    it('creates 3 files for 3 deliverables', async () => {
      const result = await updateRegistry(DELIVERABLES_3, registryDir);

      assert.strictEqual(result.created, 3);
      assert.strictEqual(result.updated, 0);
      assert.strictEqual(result.unchanged, 0);
      assert.strictEqual(result.orphaned, 0);

      // Verify files exist
      assert.ok(await fs.pathExists(path.join(registryDir, 'DEL-001.json')));
      assert.ok(await fs.pathExists(path.join(registryDir, 'DEL-002.json')));
      assert.ok(await fs.pathExists(path.join(registryDir, 'DEL-003.json')));
    });

    it('writes files with schemaVersion from writeJsonWithSchema', async () => {
      await updateRegistry(DELIVERABLES_3, registryDir);

      const content = await fs.readJSON(path.join(registryDir, 'DEL-001.json'));
      assert.strictEqual(content.schemaVersion, SCHEMA_VERSION);
    });

    it('normalizes column names to snake_case in output', async () => {
      await updateRegistry(DELIVERABLES_3, registryDir);

      const content = await fs.readJSON(path.join(registryDir, 'DEL-001.json'));
      assert.strictEqual(content.id, 'DEL-001');
      assert.strictEqual(content.user_story, 'As a user, I want login');
      assert.strictEqual(content.description, 'Implement login form');
      assert.strictEqual(content.acceptance_criteria, 'Given valid creds, when submit, then redirect');
      assert.strictEqual(content.qa_notes, 'Manual test');
      assert.strictEqual(content.dependencies, '');
    });

    it('adds created_at timestamp to new files', async () => {
      const before = new Date().toISOString();
      await updateRegistry(DELIVERABLES_3, registryDir);
      const after = new Date().toISOString();

      const content = await fs.readJSON(path.join(registryDir, 'DEL-001.json'));
      assert.ok(content.created_at);
      assert.ok(content.created_at >= before.slice(0, 19)); // Compare without milliseconds
      assert.ok(content.created_at <= after);
    });
  });

  describe('re-parse unchanged spec', () => {
    it('returns unchanged count when no content changed', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Second parse with same data
      const result = await updateRegistry(DELIVERABLES_3, registryDir);

      assert.strictEqual(result.created, 0);
      assert.strictEqual(result.updated, 0);
      assert.strictEqual(result.unchanged, 3);
      assert.strictEqual(result.orphaned, 0);
    });

    it('does not modify files when content unchanged', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Get mtime of file
      const filePath = path.join(registryDir, 'DEL-001.json');
      const statBefore = await fs.stat(filePath);
      const contentBefore = await fs.readFile(filePath, 'utf8');

      // Wait a bit to ensure mtime would change if file was written
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      const contentAfter = await fs.readFile(filePath, 'utf8');
      assert.strictEqual(contentBefore, contentAfter);
    });
  });

  describe('re-parse with spec changes', () => {
    it('updates only changed file when one deliverable edited', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Second parse with DEL-001 edited
      const result = await updateRegistry(DELIVERABLES_EDITED_001, registryDir);

      assert.strictEqual(result.created, 0);
      assert.strictEqual(result.updated, 1);
      assert.strictEqual(result.unchanged, 2);
      assert.strictEqual(result.orphaned, 0);
    });

    it('overwrites spec-sourced fields on update', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Second parse with DEL-001 edited
      await updateRegistry(DELIVERABLES_EDITED_001, registryDir);

      const content = await fs.readJSON(path.join(registryDir, 'DEL-001.json'));
      assert.strictEqual(content.user_story, 'As a user, I want secure login');
      assert.strictEqual(content.description, 'Implement login form with MFA');
    });
  });

  describe('runtime field preservation', () => {
    it('preserves status field on re-parse', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Simulate runtime update
      const filePath = path.join(registryDir, 'DEL-001.json');
      const content = await fs.readJSON(filePath);
      content.status = 'in_progress';
      await fs.writeJSON(filePath, content, { spaces: 2 });

      // Re-parse with edit to trigger update
      await updateRegistry(DELIVERABLES_EDITED_001, registryDir);

      const updated = await fs.readJSON(filePath);
      assert.strictEqual(updated.status, 'in_progress');
    });

    it('preserves linear_id field on re-parse', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Simulate Linear sync
      const filePath = path.join(registryDir, 'DEL-001.json');
      const content = await fs.readJSON(filePath);
      content.linear_id = 'LIN-12345';
      content.linear_url = 'https://linear.app/team/issue/LIN-12345';
      await fs.writeJSON(filePath, content, { spaces: 2 });

      // Re-parse with edit
      await updateRegistry(DELIVERABLES_EDITED_001, registryDir);

      const updated = await fs.readJSON(filePath);
      assert.strictEqual(updated.linear_id, 'LIN-12345');
      assert.strictEqual(updated.linear_url, 'https://linear.app/team/issue/LIN-12345');
    });

    it('preserves pr_url field on re-parse', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Simulate PR link
      const filePath = path.join(registryDir, 'DEL-001.json');
      const content = await fs.readJSON(filePath);
      content.pr_url = 'https://github.com/org/repo/pull/42';
      await fs.writeJSON(filePath, content, { spaces: 2 });

      // Re-parse with edit
      await updateRegistry(DELIVERABLES_EDITED_001, registryDir);

      const updated = await fs.readJSON(filePath);
      assert.strictEqual(updated.pr_url, 'https://github.com/org/repo/pull/42');
    });

    it('preserves completed_at field on re-parse', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Simulate completion
      const filePath = path.join(registryDir, 'DEL-001.json');
      const content = await fs.readJSON(filePath);
      content.completed_at = '2026-01-24T12:00:00Z';
      await fs.writeJSON(filePath, content, { spaces: 2 });

      // Re-parse with edit
      await updateRegistry(DELIVERABLES_EDITED_001, registryDir);

      const updated = await fs.readJSON(filePath);
      assert.strictEqual(updated.completed_at, '2026-01-24T12:00:00Z');
    });

    it('preserves created_at field from original creation', async () => {
      // First parse
      await updateRegistry(DELIVERABLES_3, registryDir);

      const filePath = path.join(registryDir, 'DEL-001.json');
      const original = await fs.readJSON(filePath);
      const originalCreatedAt = original.created_at;

      // Re-parse with edit
      await updateRegistry(DELIVERABLES_EDITED_001, registryDir);

      const updated = await fs.readJSON(filePath);
      assert.strictEqual(updated.created_at, originalCreatedAt);
    });
  });

  describe('orphan handling', () => {
    it('flags removed deliverable with orphaned: true', async () => {
      // First parse with 3 deliverables
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Second parse missing DEL-002
      const result = await updateRegistry(DELIVERABLES_MISSING_002, registryDir);

      assert.strictEqual(result.orphaned, 1);

      const orphaned = await fs.readJSON(path.join(registryDir, 'DEL-002.json'));
      assert.strictEqual(orphaned.orphaned, true);
    });

    it('adds orphaned_at timestamp when flagging', async () => {
      // First parse with 3 deliverables
      await updateRegistry(DELIVERABLES_3, registryDir);

      const before = new Date().toISOString();

      // Second parse missing DEL-002
      await updateRegistry(DELIVERABLES_MISSING_002, registryDir);

      const after = new Date().toISOString();

      const orphaned = await fs.readJSON(path.join(registryDir, 'DEL-002.json'));
      assert.ok(orphaned.orphaned_at);
      assert.ok(orphaned.orphaned_at >= before.slice(0, 19));
      assert.ok(orphaned.orphaned_at <= after);
    });

    it('does not re-flag already orphaned deliverables', async () => {
      // First parse with 3 deliverables
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Second parse missing DEL-002 (flags it)
      await updateRegistry(DELIVERABLES_MISSING_002, registryDir);

      const firstOrphan = await fs.readJSON(path.join(registryDir, 'DEL-002.json'));
      const firstOrphanedAt = firstOrphan.orphaned_at;

      // Third parse still missing DEL-002
      const result = await updateRegistry(DELIVERABLES_MISSING_002, registryDir);

      // Should not count as newly orphaned
      assert.strictEqual(result.orphaned, 0);

      // orphaned_at should not change
      const secondOrphan = await fs.readJSON(path.join(registryDir, 'DEL-002.json'));
      assert.strictEqual(secondOrphan.orphaned_at, firstOrphanedAt);
    });

    it('un-orphans deliverable when it reappears in spec', async () => {
      // First parse with 3 deliverables
      await updateRegistry(DELIVERABLES_3, registryDir);

      // Second parse missing DEL-002 (flags it)
      await updateRegistry(DELIVERABLES_MISSING_002, registryDir);

      // Third parse with DEL-002 restored
      const result = await updateRegistry(DELIVERABLES_3, registryDir);

      assert.strictEqual(result.updated, 1); // DEL-002 was un-orphaned (updated)

      const restored = await fs.readJSON(path.join(registryDir, 'DEL-002.json'));
      assert.strictEqual(restored.orphaned, undefined);
      assert.strictEqual(restored.orphaned_at, undefined);
    });
  });

  describe('edge cases', () => {
    it('handles empty deliverables array', async () => {
      const result = await updateRegistry([], registryDir);

      assert.strictEqual(result.created, 0);
      assert.strictEqual(result.updated, 0);
      assert.strictEqual(result.unchanged, 0);
      assert.strictEqual(result.orphaned, 0);
    });

    it('handles empty registry directory', async () => {
      const result = await updateRegistry(DELIVERABLES_3, registryDir);

      assert.strictEqual(result.created, 3);
    });

    it('creates registry directory if it does not exist', async () => {
      const newRegistryDir = path.join(tempDir, 'new', 'path', 'deliverables');

      await updateRegistry(DELIVERABLES_3, newRegistryDir);

      assert.ok(await fs.pathExists(newRegistryDir));
      assert.ok(await fs.pathExists(path.join(newRegistryDir, 'DEL-001.json')));
    });

    // === HARDENING TESTS: Error handling edge cases ===

    it('throws descriptive error when directory creation fails (EACCES)', async function() {
      // Skip on Windows - chmod doesn't work the same way
      if (process.platform === 'win32') {
        this.skip();
        return;
      }

      // Create a parent directory with no write permission
      const noWriteDir = path.join(tempDir, 'no-write');
      await fs.ensureDir(noWriteDir);
      await fs.chmod(noWriteDir, 0o555); // Read + execute only

      const restrictedRegistry = path.join(noWriteDir, 'nested', 'deliverables');

      try {
        // This should throw because we can't create subdirectories
        await assert.rejects(
          async () => updateRegistry(DELIVERABLES_3, restrictedRegistry),
          (err) => {
            // Error should be thrown (currently no try-catch in source)
            assert.ok(err.code === 'EACCES' || err.message.includes('permission'),
              `Expected EACCES error, got: ${err.message}`);
            return true;
          }
        );
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(noWriteDir, 0o755);
      }
    });

    it('handles deliverable with undefined id gracefully', async () => {
      const badDeliverables = [
        {
          'Deliverable ID': undefined,
          'User Story': 'As a user, I want something',
          'Description': 'Do something'
        },
        ...DELIVERABLES_3.slice(0, 1) // Include one valid deliverable
      ];

      // Should not throw, should skip the undefined ID
      const result = await updateRegistry(badDeliverables, registryDir);

      // Only the valid deliverable should be created
      assert.strictEqual(result.created, 1);
    });

    it('handles deliverable with null id gracefully', async () => {
      const badDeliverables = [
        {
          'Deliverable ID': null,
          'User Story': 'As a user, I want something',
          'Description': 'Do something'
        },
        ...DELIVERABLES_3.slice(0, 1)
      ];

      const result = await updateRegistry(badDeliverables, registryDir);
      assert.strictEqual(result.created, 1);
    });

    it('handles deliverable with empty string id gracefully', async () => {
      const badDeliverables = [
        {
          'Deliverable ID': '',
          'User Story': 'As a user, I want something',
          'Description': 'Do something'
        },
        ...DELIVERABLES_3.slice(0, 1)
      ];

      const result = await updateRegistry(badDeliverables, registryDir);
      // Empty string is falsy, so should be skipped
      assert.strictEqual(result.created, 1);
    });

    it('handles corrupted JSON in existing registry file', async () => {
      // Create a corrupted file
      const corruptPath = path.join(registryDir, 'DEL-001.json');
      await fs.writeFile(corruptPath, '{ invalid json here');

      // This should throw when trying to read the corrupted file
      await assert.rejects(
        async () => updateRegistry(DELIVERABLES_3, registryDir),
        (err) => {
          // fs.readJSON throws on invalid JSON
          assert.ok(err.message.includes('JSON') || err.message.includes('Unexpected token'),
            `Expected JSON parse error, got: ${err.message}`);
          return true;
        }
      );
    });
  });
});
