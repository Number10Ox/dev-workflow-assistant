# DWA Test Hardening Plan

**Purpose:** Add missing edge case tests identified by adversarial review before MVP use.

**Scope:** Top 10 HIGH-risk gaps that would cause runtime failures in production.

---

## Tests to Add

### 1. Sync Partial Failure: Remote Succeeds, Local Fails
**File:** `tests/linear/sync.test.js`
**Risk:** Issue created in Linear but registry not updated → orphaned remote issue

```javascript
test('syncDeliverable handles updateLinearFields failure after createIssue', async () => {
  // Mock createIssue succeeds
  mockBridgeClient.createIssue.mockResolvedValue({ id: 'issue-123', identifier: 'ENG-1' });
  // Mock updateLinearFields throws
  const originalUpdate = registry.updateLinearFields;
  registry.updateLinearFields = () => { throw new Error('ENOSPC: disk full'); };

  const result = await syncDeliverable(deliverable, mockBridgeClient, options);

  // Should return ERROR action with message about partial failure
  assert.strictEqual(result.action, SyncAction.ERROR);
  assert.match(result.error, /partial failure|registry update failed/i);

  registry.updateLinearFields = originalUpdate;
});
```

---

### 2. Bridge Initialize Failure (Provider Missing)
**File:** `tests/linear/sync.test.js`
**Risk:** Tests mock successful init; real missing provider crashes entire sync

```javascript
test('syncAllDeliverables handles bridge initialization failure', async () => {
  const mockClient = {
    initialize: () => { throw new Error('Google Workspace provider not found'); }
  };

  const result = await syncAllDeliverables(projectRoot, { client: mockClient });

  assert.strictEqual(result.success, false);
  assert.match(result.error, /provider not found|setup wizard/i);
});
```

---

### 3. Malformed YAML Frontmatter in Spec
**File:** `tests/parser/parse-spec.test.js`
**Risk:** Users hand-edit specs; malformed YAML crashes parser with cryptic error

```javascript
test('parseSpec returns friendly error for malformed YAML', async () => {
  const badYaml = `---
title: Test Feature
status: [unclosed bracket
---
# Feature Spec`;

  await fs.writeFile(specPath, badYaml);

  const result = await parseSpec(specPath);

  assert.ok(result.errors.length > 0);
  assert.match(result.errors[0].message, /YAML|frontmatter|parse error/i);
  assert.ok(result.errors[0].code); // Should have error code, not raw exception
});
```

---

### 4. Registry Directory Creation Fails (EACCES)
**File:** `tests/parser/registry.test.js`
**Risk:** Permission denied on .dwa/deliverables/ creation crashes with unhelpful error

```javascript
test('updateRegistry handles directory creation failure', async () => {
  const fs = require('fs-extra');
  const originalEnsureDir = fs.ensureDir;
  fs.ensureDir = () => {
    const err = new Error('EACCES: permission denied');
    err.code = 'EACCES';
    throw err;
  };

  const result = await updateRegistry(projectRoot, deliverables);

  assert.strictEqual(result.success, false);
  assert.match(result.error, /permission|cannot create|EACCES/i);

  fs.ensureDir = originalEnsureDir;
});
```

---

### 5. Template File Missing or Corrupt
**File:** `tests/scaffolding/scaffold.test.js`
**Risk:** If templates/ directory missing, scaffold crashes with MODULE_NOT_FOUND

```javascript
test('scaffoldFromTemplate handles missing template file', async () => {
  const result = await scaffoldFromTemplate(
    'nonexistent-template.hbs',
    targetPath,
    context
  );

  assert.strictEqual(result.success, false);
  assert.match(result.error, /template.*not found|ENOENT/i);
});

test('scaffoldFromTemplate handles corrupt Handlebars syntax', async () => {
  await fs.writeFile(templatePath, '{{#if unclosed');

  const result = await scaffoldFromTemplate(templatePath, targetPath, context);

  assert.strictEqual(result.success, false);
  assert.match(result.error, /template.*syntax|parse error/i);
});
```

---

### 6. Import: findFeatureRoot Circular Symlink
**File:** `tests/google-docs/import.test.js`
**Risk:** Infinite loop on circular symlinks hangs process forever

```javascript
test('findFeatureRoot handles max depth to prevent infinite loop', async () => {
  // Create deeply nested path (100 levels)
  const deepPath = Array(100).fill('nested').join('/');
  const startPath = path.join(tmpDir, deepPath);
  await fs.ensureDir(startPath);

  // Should not hang - either finds root or returns null after max iterations
  const result = findFeatureRoot(startPath);

  // Should complete within reasonable time (test timeout would catch hang)
  assert.ok(result === null || typeof result === 'string');
});
```

---

### 7. Import: Output Path is Directory, Not File
**File:** `tests/google-docs/import.test.js`
**Risk:** `--out .dwa` writes to directory, causing EISDIR error

```javascript
test('importGoogleDoc rejects directory as output path', async () => {
  await fs.ensureDir(path.join(tmpDir, 'output-dir'));

  const result = await importGoogleDoc({
    docIdOrUrl: 'test-doc-id',
    projectRoot: tmpDir,
    out: 'output-dir'  // Directory, not file
  });

  assert.strictEqual(result.success, false);
  assert.match(result.message, /directory|not a file|specify filename/i);
});
```

---

### 8. PR Description: extractDeliverableMetadata Throws
**File:** `tests/pr-description/generate.test.js`
**Risk:** Missing deliverable crashes PR generation with unhandled exception

```javascript
test('generatePRDescription handles missing deliverable gracefully', async () => {
  const result = await generatePRDescription({
    deliverableId: 'DEL-999',  // Does not exist
    projectRoot: tmpDir,
    output: 'stdout'
  });

  assert.strictEqual(result.success, false);
  assert.match(result.error, /DEL-999.*not found|deliverable.*missing/i);
});
```

---

### 9. Sync-Linear: Corrupted feature.json
**File:** `tests/commands/sync-linear.test.js`
**Risk:** Invalid JSON in feature.json crashes with JSON.parse error

```javascript
test('syncLinear handles corrupted feature.json', async () => {
  await fs.writeFile(
    path.join(tmpDir, '.dwa', 'feature.json'),
    '{ invalid json here'
  );

  const result = await syncLinear({ projectRoot: tmpDir });

  assert.strictEqual(result.success, false);
  assert.match(result.message, /feature\.json.*corrupt|invalid JSON|parse error/i);
});
```

---

### 10. Parse-Spec: File Read Permission Denied
**File:** `tests/parser/parse-spec.test.js`
**Risk:** EACCES on spec file gives cryptic error instead of actionable message

```javascript
test('parseSpec handles file permission denied', async () => {
  // Create file then remove read permission
  await fs.writeFile(specPath, '# Spec');
  await fs.chmod(specPath, 0o000);  // No permissions

  try {
    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    assert.match(result.errors[0].message, /permission|cannot read|EACCES/i);
  } finally {
    await fs.chmod(specPath, 0o644);  // Restore for cleanup
  }
});
```

---

## Execution Plan

**Order:** Execute in dependency order (parser → registry → scaffolding → sync → import → pr-description)

| # | Test | File | Est. Time |
|---|------|------|-----------|
| 1 | Malformed YAML | parse-spec.test.js | 10 min |
| 2 | File permission denied | parse-spec.test.js | 10 min |
| 3 | Registry dir creation fails | registry.test.js | 10 min |
| 4 | Template missing/corrupt | scaffold.test.js | 15 min |
| 5 | Bridge init failure | sync.test.js | 10 min |
| 6 | Sync partial failure | sync.test.js | 15 min |
| 7 | Corrupted feature.json | sync-linear.test.js | 10 min |
| 8 | findFeatureRoot depth limit | import.test.js | 10 min |
| 9 | Output path is directory | import.test.js | 10 min |
| 10 | Missing deliverable | generate.test.js | 10 min |

**Total estimated time:** ~2 hours

---

## Success Criteria

1. All 10 new tests pass
2. Existing 368 tests still pass
3. Each error path returns actionable error message (not stack trace)
4. No test requires external services (all mocked)

---

## Notes

- Some tests require mocking fs-extra functions - use module-level mocking pattern from existing tests
- Permission tests may behave differently on Windows (skip with `process.platform` check if needed)
- Tests should restore original state in `finally` blocks to prevent test pollution
