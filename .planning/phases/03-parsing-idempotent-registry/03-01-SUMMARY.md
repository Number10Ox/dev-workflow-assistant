---
phase: 03-parsing-idempotent-registry
plan: 01
subsystem: parser
tags: [remark, ast, validation, parsing, markdown]

requires:
  - 02-templates (feature-spec-v2.hbs template structure)
provides:
  - parseSpec function for AST-based deliverables extraction
  - ValidationError class with diagnostic codes
  - Error accumulation validation pattern
affects:
  - 03-02 (registry update will use parseSpec output)
  - 03-03 (sync command will depend on parseSpec)

tech_stack:
  added:
    - remark@15.0.1 (markdown AST parser)
    - remark-parse@11.0.0 (parser plugin)
    - remark-gfm@4.0.1 (GitHub Flavored Markdown tables)
    - unified@11.0.5 (processing pipeline)
    - unist-util-visit@5.1.0 (AST traversal)
    - fast-deep-equal@3.1.3 (deep equality for change detection)
  patterns:
    - AST-based table extraction via remark ecosystem
    - Error accumulation pattern (collect all before returning)
    - Diagnostic codes for structured error reporting

key_files:
  created:
    - src/parser/parse-spec.js
    - src/parser/validate.js
    - tests/parse-spec.test.js
  modified:
    - package.json
    - package-lock.json

decisions: []

metrics:
  duration: 2m 50s
  completed: 2026-01-24
---

# Phase 3 Plan 1: Spec Parser with Validation Summary

AST-based spec parser using remark ecosystem extracts deliverables from feature-spec.md Deliverables Table with error accumulation validation and diagnostic codes.

## What Was Built

### Core Parser (`src/parser/parse-spec.js`)

**parseSpec(specPath)** - Main entry point returning `{ frontMatter, deliverables, errors, warnings }`:
- Reads file and extracts YAML frontmatter with gray-matter
- Parses markdown to AST using unified + remark-parse + remark-gfm
- Finds Deliverables Table by looking for table with "Deliverable ID" column
- Validates frontmatter, table structure, and deliverable content
- Accumulates all errors before returning (not fail-fast)

**findDeliverablesTable(tree)** - Locates the Deliverables Table in AST:
- Traverses AST with unist-util-visit to find all tables
- Prioritizes table with "Deliverable ID" column header
- Falls back to first table if no exact match

**extractRowsFromTable(tableNode)** - Converts table AST to row objects:
- Extracts header row as column names
- Maps data rows to objects with column names as keys
- Handles nested markdown in cells via recursive text extraction

### Validation (`src/parser/validate.js`)

**ValidationError class** - Structured error with:
- `code`: Diagnostic code (DWA-E0XX)
- `message`: Human-readable description
- `line`: Optional line number
- `toString()`: Formatted output for display

**Validation functions** (all return `ValidationError[]`):

| Function | Validates | Error Codes |
|----------|-----------|-------------|
| `validateFrontMatter` | feature_id, title, spec_schema_version required | DWA-E010, DWA-E011, DWA-E012, DWA-E013 |
| `validateTableStructure` | Required columns present | DWA-E020, DWA-E021 |
| `validateDeliverableContent` | Unique IDs, non-empty fields | DWA-E030, DWA-E031, DWA-E032, DWA-E033 |

### Diagnostic Codes

| Code | Meaning |
|------|---------|
| DWA-E010 | Missing required field: feature_id |
| DWA-E011 | Missing required field: title |
| DWA-E012 | Missing required field: spec_schema_version |
| DWA-E013 | Unsupported spec_schema_version |
| DWA-E020 | Deliverables Table not found |
| DWA-E021 | Missing required column |
| DWA-E030 | Missing Deliverable ID |
| DWA-E031 | Duplicate Deliverable ID |
| DWA-E032 | Empty User Story |
| DWA-E033 | Empty Acceptance Criteria |

## Decisions Made

1. **Use `.default` for ES module imports in CommonJS**: remark-parse and remark-gfm export as ES modules with default exports. In CommonJS, access via `require('remark-parse').default`.

2. **Find table by column header**: Rather than relying on heading hierarchy ("### 3.1 Deliverables Table"), identify the correct table by looking for "Deliverable ID" column. More robust against spec structure variations.

3. **Required columns**: Deliverable ID, User Story, Description, Acceptance Criteria (testable), QA Plan Notes. Dependencies and Linear Issue URL are optional.

4. **Row numbering for errors**: Line numbers in errors are row indices +2 (accounting for header row and 0-indexing). Actual file line numbers would require position tracking from AST.

## Test Coverage

53 total tests (22 new parser tests, 31 existing):
- ValidationError class: 4 tests (formatting, line numbers)
- validateFrontMatter: 6 tests (all required fields, accumulation)
- validateTableStructure: 2 tests (null table, missing columns)
- validateDeliverableContent: 6 tests (duplicates, empty fields, line numbers)
- parseSpec integration: 13 tests (valid spec, all error cases, accumulation)

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| ea8733e | chore | Install remark ecosystem dependencies |
| f9d3eba | test | Add failing tests for spec parser and validation |
| a5065c6 | feat | Implement spec parser with validation |

## Next Phase Readiness

**Ready for 03-02 (Registry Update):**
- parseSpec returns structured deliverables array
- Each deliverable has all columns as keyed properties
- Errors array enables validation gate before registry write
- fast-deep-equal installed for idempotent change detection

**Interface for next plan:**
```javascript
const { parseSpec } = require('./parser/parse-spec');
const result = await parseSpec('/path/to/feature-spec.md');
// result.errors.length === 0 means valid
// result.deliverables is array of { 'Deliverable ID': 'DEL-001', ... }
```
