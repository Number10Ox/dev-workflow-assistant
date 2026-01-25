---
phase: 03-parsing-idempotent-registry
verified: 2026-01-25T01:50:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 3: Parsing + Idempotent Registry Verification Report

**Phase Goal:** Users can extract deliverables from spec and safely re-parse after edits
**Verified:** 2026-01-25T01:50:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Parsing uses AST-based extraction (remark-gfm), not regex | VERIFIED | `src/parser/parse-spec.js` uses `unified().use(remarkParse).use(remarkGfm)` (line 138-140), traverses via `visit(tree, 'table', ...)` (line 37) |
| 2 | Each deliverable row becomes `.dwa/deliverables/DEL-###.json` with all columns mapped | VERIFIED | `src/parser/registry.js` SPEC_FIELD_MAP (lines 21-28) maps all columns; tests confirm file creation (tests/parse-command.test.js line 5) |
| 3 | Spec is validated against Template v2.0 schema before parsing; failures report line numbers | VERIFIED | `src/parser/validate.js` validates frontmatter (feature_id, title, spec_schema_version), table structure, and content; ValidationError includes line property (lines 20-33) |
| 4 | Re-parsing updates spec-sourced fields but preserves runtime fields (status, linear_id, pr_url) | VERIFIED | `src/parser/registry.js` RUNTIME_FIELDS constant (lines 34-41), mergeFields function (lines 70-85) preserves them; 5 tests verify preservation |
| 5 | File writes are atomic (temp + rename) | VERIFIED | `src/utils/schema.js` uses write-file-atomic package (line 1, 24) for all registry writes |
| 6 | Removed deliverables are flagged, not silently deleted | VERIFIED | `src/parser/registry.js` orphan handling (lines 173-204) adds `orphaned: true` and `orphaned_at`; 4 tests verify behavior |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/parser/parse-spec.js` | AST-based deliverables table extraction | VERIFIED | 177 lines, exports parseSpec, findDeliverablesTable, extractRowsFromTable |
| `src/parser/validate.js` | Error accumulation validation with diagnostic codes | VERIFIED | 198 lines, exports ValidationError, validateFrontMatter, validateTableStructure, validateDeliverableContent |
| `src/parser/registry.js` | Idempotent registry update logic | VERIFIED | 216 lines, exports updateRegistry, normalizeDeliverable, mergeFields, SPEC_FIELD_MAP, RUNTIME_FIELDS |
| `src/commands/parse.js` | Parse command orchestration | VERIFIED | 64 lines, exports runParse, orchestrates parseSpec + updateRegistry |
| `tests/parse-spec.test.js` | TDD tests for parser and validation | VERIFIED | 541 lines, 31 tests covering validation and parsing |
| `tests/registry.test.js` | TDD tests for registry merge logic | VERIFIED | 391 lines, 23 tests covering idempotency, runtime fields, orphans |
| `tests/parse-command.test.js` | Integration tests for parse command | VERIFIED | 295 lines, 16 tests covering full parse flow |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| src/parser/parse-spec.js | gray-matter | frontmatter extraction | WIRED | `matter(fileContent)` at line 125 |
| src/parser/parse-spec.js | remark ecosystem | AST parsing | WIRED | `unified().use(remarkParse).use(remarkGfm)` at lines 138-140 |
| src/parser/registry.js | src/parser/parse-spec.js | parseSpec result consumption | WIRED | Imported and used via `require('./parser/parse-spec')` |
| src/parser/registry.js | fast-deep-equal | change detection | WIRED | `fastDeepEqual(existingCompare, updatedCompare)` at line 102 |
| src/parser/registry.js | src/utils/schema.js | atomic writes with schema | WIRED | `writeJsonWithSchema(filePath, merged)` at lines 159, 168, 202 |
| src/commands/parse.js | src/parser/parse-spec.js | parseSpec call | WIRED | `parseSpec(specPath)` at line 32 |
| src/commands/parse.js | src/parser/registry.js | updateRegistry call | WIRED | `updateRegistry(parseResult.deliverables, registryDir)` at line 46 |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| AST-based extraction (remark-gfm) | SATISFIED | unified + remark-parse + remark-gfm, traversed with unist-util-visit |
| Deliverable rows become DEL-###.json | SATISFIED | SPEC_FIELD_MAP normalizes columns, writes to .dwa/deliverables/ |
| Validation with line numbers | SATISFIED | ValidationError class with diagnostic codes (DWA-E0XX) and optional line number |
| Runtime field preservation | SATISFIED | RUNTIME_FIELDS constant, mergeFields function preserves on re-parse |
| Atomic file writes | SATISFIED | write-file-atomic package via writeJsonWithSchema |
| Removed deliverables flagged | SATISFIED | orphaned: true + orphaned_at timestamp, not deleted |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

No anti-patterns detected. All implementations are substantive with real logic.

### Human Verification Required

None. All success criteria can be programmatically verified:

1. AST usage: grep confirms unified/remark imports and visit() calls
2. File creation: tests verify DEL-###.json files created
3. Validation: tests cover all diagnostic codes
4. Runtime preservation: tests verify status, linear_id, pr_url survive re-parse
5. Atomic writes: write-file-atomic package usage confirmed
6. Orphan flagging: tests verify orphaned: true added, not deleted

### Test Results

All 89 tests pass (including 70 tests from Phase 3):
- ValidationError class: 4 tests
- validateFrontMatter: 6 tests
- validateTableStructure: 2 tests
- validateDeliverableContent: 6 tests
- parseSpec integration: 13 tests
- updateRegistry: 23 tests
- runParse: 16 tests

## Summary

Phase 3 goal **fully achieved**. Users can:

1. **Extract deliverables** from feature-spec.md using AST-based parsing (not regex)
2. **Validate specs** against Template v2.0 schema with diagnostic codes and line numbers
3. **Create registry files** (.dwa/deliverables/DEL-###.json) with all columns normalized to snake_case
4. **Re-parse safely** after edits -- spec-sourced fields updated, runtime fields preserved
5. **Avoid data loss** -- removed deliverables flagged as orphaned, not deleted
6. **Avoid corruption** -- atomic writes (temp + rename) via write-file-atomic

All artifacts exist, are substantive (not stubs), and are properly wired together. Test coverage is comprehensive (70 tests for Phase 3 components).

---

*Verified: 2026-01-25T01:50:00Z*
*Verifier: Claude (gsd-verifier)*
