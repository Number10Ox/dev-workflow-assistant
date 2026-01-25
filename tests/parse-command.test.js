const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const { runParse } = require('../src/commands/parse');
const { SCHEMA_VERSION } = require('../src/utils/schema');

/**
 * Test fixture - valid spec content
 */
const VALID_SPEC = `---
feature_id: FEAT-2026-001
title: "Test Feature"
owner: "test@example.com"
status: Draft
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

## 3) Work Breakdown (Deliverables = unit of execution)

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
| DEL-002 | As a user, I want logout | Implement logout button | Given logged in, when click logout, then session ends | Automated | DEL-001 | |
| DEL-003 | As a user, I want profile | Implement profile page | Given logged in, when navigate, then see user info | Manual test | | |
`;

const SPEC_WITH_ERRORS = `---
title: "Test Feature"
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
`;

let tempDir;

describe('runParse', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-parse-cmd-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  describe('successful parse flow', () => {
    it('returns success: true for valid spec', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.success, true);
    });

    it('returns summary with parsed count', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.summary.parsed, 3);
    });

    it('returns summary with created count for fresh parse', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.summary.created, 3);
      assert.strictEqual(result.summary.updated, 0);
      assert.strictEqual(result.summary.unchanged, 0);
      assert.strictEqual(result.summary.orphaned, 0);
    });

    it('creates .dwa/deliverables directory', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      await runParse(specPath, tempDir);

      const registryDir = path.join(tempDir, '.dwa', 'deliverables');
      assert.ok(await fs.pathExists(registryDir));
    });

    it('creates DEL-###.json files in registry', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      await runParse(specPath, tempDir);

      const registryDir = path.join(tempDir, '.dwa', 'deliverables');
      assert.ok(await fs.pathExists(path.join(registryDir, 'DEL-001.json')));
      assert.ok(await fs.pathExists(path.join(registryDir, 'DEL-002.json')));
      assert.ok(await fs.pathExists(path.join(registryDir, 'DEL-003.json')));
    });

    it('returns empty errors array on success', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      const result = await runParse(specPath, tempDir);

      assert.ok(Array.isArray(result.errors));
      assert.strictEqual(result.errors.length, 0);
    });

    it('returns warnings array (may be empty)', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      const result = await runParse(specPath, tempDir);

      assert.ok(Array.isArray(result.warnings));
    });
  });

  describe('validation failure flow', () => {
    it('returns success: false when spec has errors', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, SPEC_WITH_ERRORS);

      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.success, false);
    });

    it('returns errors array with validation errors', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, SPEC_WITH_ERRORS);

      const result = await runParse(specPath, tempDir);

      assert.ok(result.errors.length > 0);
      // Should have error for missing feature_id
      const codes = result.errors.map(e => e.code || e);
      assert.ok(codes.includes('DWA-E010'));
    });

    it('does not create registry files when validation fails', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, SPEC_WITH_ERRORS);

      await runParse(specPath, tempDir);

      const registryDir = path.join(tempDir, '.dwa', 'deliverables');
      const exists = await fs.pathExists(registryDir);
      if (exists) {
        const files = await fs.readdir(registryDir);
        assert.strictEqual(files.length, 0);
      }
    });
  });

  describe('re-parse behavior', () => {
    it('returns unchanged count on re-parse without changes', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      // First parse
      await runParse(specPath, tempDir);

      // Second parse
      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.summary.created, 0);
      assert.strictEqual(result.summary.updated, 0);
      assert.strictEqual(result.summary.unchanged, 3);
    });

    it('returns updated count when spec changes', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      // First parse
      await runParse(specPath, tempDir);

      // Modify spec
      const modifiedSpec = VALID_SPEC.replace(
        'As a user, I want login',
        'As a user, I want secure login'
      );
      await fs.writeFile(specPath, modifiedSpec);

      // Second parse
      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.summary.updated, 1);
      assert.strictEqual(result.summary.unchanged, 2);
    });

    it('returns orphaned count when deliverable removed from spec', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      // First parse (creates 3 files)
      await runParse(specPath, tempDir);

      // Remove DEL-002 from spec
      const reducedSpec = `---
feature_id: FEAT-2026-001
title: "Test Feature"
owner: "test@example.com"
status: Draft
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
| DEL-003 | As a user, I want profile | Implement profile page | Given logged in, when navigate, then see user info | Manual test | | |
`;
      await fs.writeFile(specPath, reducedSpec);

      // Second parse
      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.summary.orphaned, 1);
    });
  });

  describe('integration with registry', () => {
    it('preserves runtime fields after re-parse', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      // First parse
      await runParse(specPath, tempDir);

      // Simulate runtime update
      const del001Path = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const content = await fs.readJSON(del001Path);
      content.status = 'in_progress';
      content.linear_id = 'LIN-12345';
      await fs.writeJSON(del001Path, content, { spaces: 2 });

      // Modify spec and re-parse
      const modifiedSpec = VALID_SPEC.replace(
        'Implement login form',
        'Implement login form with MFA'
      );
      await fs.writeFile(specPath, modifiedSpec);
      await runParse(specPath, tempDir);

      // Verify runtime fields preserved
      const updated = await fs.readJSON(del001Path);
      assert.strictEqual(updated.status, 'in_progress');
      assert.strictEqual(updated.linear_id, 'LIN-12345');
      // Spec field should be updated
      assert.strictEqual(updated.description, 'Implement login form with MFA');
    });

    it('registry files have schemaVersion', async () => {
      const specPath = path.join(tempDir, 'feature-spec.md');
      await fs.writeFile(specPath, VALID_SPEC);

      await runParse(specPath, tempDir);

      const del001Path = path.join(tempDir, '.dwa', 'deliverables', 'DEL-001.json');
      const content = await fs.readJSON(del001Path);
      assert.strictEqual(content.schemaVersion, SCHEMA_VERSION);
    });
  });

  describe('file not found handling', () => {
    it('returns success: false when spec file does not exist', async () => {
      const specPath = path.join(tempDir, 'nonexistent.md');

      const result = await runParse(specPath, tempDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
    });
  });
});
