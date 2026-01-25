const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const { parseSpec } = require('../src/parser/parse-spec');
const {
  ValidationError,
  validateFrontMatter,
  validateTableStructure,
  validateDeliverableContent
} = require('../src/parser/validate');

/**
 * Test fixtures - valid and invalid spec content
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
`;

const SPEC_MISSING_FEATURE_ID = `---
title: "Test Feature"
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
`;

const SPEC_MISSING_TITLE = `---
feature_id: FEAT-2026-001
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
`;

const SPEC_MISSING_SCHEMA_VERSION = `---
feature_id: FEAT-2026-001
title: "Test Feature"
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
`;

const SPEC_NO_TABLE = `---
feature_id: FEAT-2026-001
title: "Test Feature"
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

## 3) Work Breakdown

No table here.
`;

const SPEC_DUPLICATE_IDS = `---
feature_id: FEAT-2026-001
title: "Test Feature"
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
| DEL-001 | As a user, I want logout | Implement logout | Given logged in, when click logout, then session ends | Automated | | |
`;

const SPEC_EMPTY_USER_STORY = `---
feature_id: FEAT-2026-001
title: "Test Feature"
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 |  | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
`;

const SPEC_EMPTY_ACCEPTANCE_CRITERIA = `---
feature_id: FEAT-2026-001
title: "Test Feature"
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form |  | Manual test | | |
`;

const SPEC_MISSING_COLUMN = `---
feature_id: FEAT-2026-001
title: "Test Feature"
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | QA Plan Notes |
|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Manual test |
`;

let tempDir;

describe('ValidationError class', () => {
  it('creates error with code, message, and optional line number', () => {
    const err = new ValidationError('DWA-E010', 'Missing required field: feature_id');
    assert.strictEqual(err.code, 'DWA-E010');
    assert.strictEqual(err.message, 'Missing required field: feature_id');
    assert.strictEqual(err.line, null);
  });

  it('includes line number when provided', () => {
    const err = new ValidationError('DWA-E031', 'Duplicate Deliverable ID: DEL-001', 3);
    assert.strictEqual(err.code, 'DWA-E031');
    assert.strictEqual(err.line, 3);
  });

  it('formats toString without line number', () => {
    const err = new ValidationError('DWA-E010', 'Missing required field: feature_id');
    assert.strictEqual(err.toString(), 'DWA-E010 Missing required field: feature_id');
  });

  it('formats toString with line number', () => {
    const err = new ValidationError('DWA-E031', 'Duplicate Deliverable ID: DEL-001', 3);
    assert.strictEqual(err.toString(), 'DWA-E031 Line 3: Duplicate Deliverable ID: DEL-001');
  });
});

describe('validateFrontMatter', () => {
  it('returns empty array for valid frontmatter', () => {
    const frontMatter = {
      feature_id: 'FEAT-2026-001',
      title: 'Test Feature',
      spec_schema_version: 'v2.0'
    };
    const errors = validateFrontMatter(frontMatter);
    assert.strictEqual(errors.length, 0);
  });

  it('returns error for missing feature_id', () => {
    const frontMatter = {
      title: 'Test Feature',
      spec_schema_version: 'v2.0'
    };
    const errors = validateFrontMatter(frontMatter);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E010');
    assert.ok(errors[0].message.includes('feature_id'));
  });

  it('returns error for missing title', () => {
    const frontMatter = {
      feature_id: 'FEAT-2026-001',
      spec_schema_version: 'v2.0'
    };
    const errors = validateFrontMatter(frontMatter);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E011');
    assert.ok(errors[0].message.includes('title'));
  });

  it('returns error for missing spec_schema_version', () => {
    const frontMatter = {
      feature_id: 'FEAT-2026-001',
      title: 'Test Feature'
    };
    const errors = validateFrontMatter(frontMatter);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E012');
    assert.ok(errors[0].message.includes('spec_schema_version'));
  });

  it('returns error for unsupported spec_schema_version', () => {
    const frontMatter = {
      feature_id: 'FEAT-2026-001',
      title: 'Test Feature',
      spec_schema_version: 'v1.0'
    };
    const errors = validateFrontMatter(frontMatter);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E013');
    assert.ok(errors[0].message.includes('v1.0'));
  });

  it('accumulates multiple errors', () => {
    const frontMatter = {};
    const errors = validateFrontMatter(frontMatter);
    assert.strictEqual(errors.length, 3);
    const codes = errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E010'));
    assert.ok(codes.includes('DWA-E011'));
    assert.ok(codes.includes('DWA-E012'));
  });
});

describe('validateTableStructure', () => {
  it('returns error when table node is null', () => {
    const errors = validateTableStructure(null);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E020');
    assert.ok(errors[0].message.includes('Deliverables Table not found'));
  });

  it('returns error for missing required columns', () => {
    // Mock table node with incomplete headers
    const tableNode = {
      children: [
        {
          children: [
            { children: [{ children: [{ value: 'Deliverable ID' }] }] },
            { children: [{ children: [{ value: 'Description' }] }] }
          ]
        }
      ]
    };
    const errors = validateTableStructure(tableNode);
    assert.ok(errors.length > 0);
    assert.strictEqual(errors[0].code, 'DWA-E021');
  });
});

describe('validateDeliverableContent', () => {
  it('returns empty array for valid deliverables', () => {
    const deliverables = [
      {
        'Deliverable ID': 'DEL-001',
        'User Story': 'As a user, I want login',
        'Acceptance Criteria (testable)': 'Given valid creds, then redirect'
      },
      {
        'Deliverable ID': 'DEL-002',
        'User Story': 'As a user, I want logout',
        'Acceptance Criteria (testable)': 'Given logged in, when click logout, then session ends'
      }
    ];
    const errors = validateDeliverableContent(deliverables);
    assert.strictEqual(errors.length, 0);
  });

  it('returns error for missing Deliverable ID', () => {
    const deliverables = [
      {
        'User Story': 'As a user, I want login',
        'Acceptance Criteria (testable)': 'Given valid creds, then redirect'
      }
    ];
    const errors = validateDeliverableContent(deliverables);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E030');
  });

  it('returns error for duplicate Deliverable IDs', () => {
    const deliverables = [
      {
        'Deliverable ID': 'DEL-001',
        'User Story': 'As a user, I want login',
        'Acceptance Criteria (testable)': 'Given valid creds, then redirect'
      },
      {
        'Deliverable ID': 'DEL-001',
        'User Story': 'As a user, I want logout',
        'Acceptance Criteria (testable)': 'Given logged in, when click logout, then session ends'
      }
    ];
    const errors = validateDeliverableContent(deliverables);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E031');
    assert.ok(errors[0].message.includes('DEL-001'));
  });

  it('returns error for empty User Story', () => {
    const deliverables = [
      {
        'Deliverable ID': 'DEL-001',
        'User Story': '',
        'Acceptance Criteria (testable)': 'Given valid creds, then redirect'
      }
    ];
    const errors = validateDeliverableContent(deliverables);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E032');
  });

  it('returns error for empty Acceptance Criteria', () => {
    const deliverables = [
      {
        'Deliverable ID': 'DEL-001',
        'User Story': 'As a user, I want login',
        'Acceptance Criteria (testable)': ''
      }
    ];
    const errors = validateDeliverableContent(deliverables);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'DWA-E033');
  });

  it('includes line numbers in errors', () => {
    const deliverables = [
      {
        'Deliverable ID': 'DEL-001',
        'User Story': 'As a user, I want login',
        'Acceptance Criteria (testable)': 'Given valid creds, then redirect'
      },
      {
        'Deliverable ID': 'DEL-001', // duplicate at row 3
        'User Story': 'As a user, I want logout',
        'Acceptance Criteria (testable)': 'Given logged in, when click logout, then session ends'
      }
    ];
    const errors = validateDeliverableContent(deliverables);
    assert.strictEqual(errors[0].line, 3); // row 2 is index 1, +2 for header and 0-index
  });
});

describe('parseSpec', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-parse-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  it('parses valid spec and extracts deliverables', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, VALID_SPEC);

    const result = await parseSpec(specPath);

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.deliverables.length, 2);
    assert.strictEqual(result.deliverables[0]['Deliverable ID'], 'DEL-001');
    assert.strictEqual(result.deliverables[1]['Deliverable ID'], 'DEL-002');
    assert.strictEqual(result.frontMatter.feature_id, 'FEAT-2026-001');
    assert.strictEqual(result.frontMatter.title, 'Test Feature');
  });

  it('returns error for missing feature_id', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_MISSING_FEATURE_ID);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E010'));
  });

  it('returns error for missing title', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_MISSING_TITLE);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E011'));
  });

  it('returns error for missing spec_schema_version', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_MISSING_SCHEMA_VERSION);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E012'));
  });

  it('returns error when no table found', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_NO_TABLE);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E020'));
  });

  it('returns error for duplicate IDs', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_DUPLICATE_IDS);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E031'));
  });

  it('returns error for empty user story', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_EMPTY_USER_STORY);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E032'));
  });

  it('returns error for empty acceptance criteria', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_EMPTY_ACCEPTANCE_CRITERIA);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E033'));
  });

  it('returns error for missing required columns', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, SPEC_MISSING_COLUMN);

    const result = await parseSpec(specPath);

    assert.ok(result.errors.length > 0);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E021'));
  });

  it('accumulates all errors before returning', async () => {
    // Spec with multiple issues: no feature_id, no title, duplicate IDs
    const multiErrorSpec = `---
spec_schema_version: v2.0
---

# Feature Spec: Test Feature

### 3.1 Deliverables Table (required)

| Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
|---|---|---|---|---|---|---|
| DEL-001 | As a user, I want login | Implement login form | Given valid creds, when submit, then redirect | Manual test | | |
| DEL-001 | As a user, I want logout | Implement logout | Given logged in, when click logout, then session ends | Automated | | |
`;
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, multiErrorSpec);

    const result = await parseSpec(specPath);

    // Should have at least 3 errors: missing feature_id, missing title, duplicate ID
    assert.ok(result.errors.length >= 3);
    const codes = result.errors.map(e => e.code);
    assert.ok(codes.includes('DWA-E010')); // missing feature_id
    assert.ok(codes.includes('DWA-E011')); // missing title
    assert.ok(codes.includes('DWA-E031')); // duplicate ID
  });

  it('extracts all columns from deliverable rows', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, VALID_SPEC);

    const result = await parseSpec(specPath);

    assert.strictEqual(result.errors.length, 0);
    const del = result.deliverables[0];
    assert.strictEqual(del['Deliverable ID'], 'DEL-001');
    assert.strictEqual(del['User Story'], 'As a user, I want login');
    assert.strictEqual(del['Description'], 'Implement login form');
    assert.strictEqual(del['Acceptance Criteria (testable)'], 'Given valid creds, when submit, then redirect');
    assert.strictEqual(del['QA Plan Notes'], 'Manual test');
  });

  it('handles deliverables with dependencies', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, VALID_SPEC);

    const result = await parseSpec(specPath);

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.deliverables[1]['Dependencies (DEL-###)'], 'DEL-001');
  });

  it('returns warnings array (may be empty)', async () => {
    const specPath = path.join(tempDir, 'feature-spec.md');
    await fs.writeFile(specPath, VALID_SPEC);

    const result = await parseSpec(specPath);

    assert.ok(Array.isArray(result.warnings));
  });
});
