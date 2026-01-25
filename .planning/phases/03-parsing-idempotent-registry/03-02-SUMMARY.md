---
phase: 03-parsing-idempotent-registry
plan: 02
subsystem: parser
tags: [idempotent, registry, json, fast-deep-equal, atomic-writes]

requires:
  - phase: 03-01
    provides: parseSpec function for AST-based deliverables extraction
provides:
  - updateRegistry function with idempotent merge logic
  - runParse command orchestrating spec parsing and registry updates
  - Runtime field preservation (status, linear_id, pr_url, completed_at)
  - Orphan detection and flagging
affects:
  - 03-03 (sync command will use runParse output)
  - 04-packets (packet generation will read from registry)
  - 05-linear (Linear sync will update runtime fields)

tech_stack:
  added: []
  patterns:
    - Idempotent file updates via deep equality comparison
    - Spec fields vs runtime fields segregation
    - Orphan flagging (soft delete) instead of deletion

key_files:
  created:
    - src/parser/registry.js
    - src/commands/parse.js
    - tests/registry.test.js
    - tests/parse-command.test.js
  modified: []

key_decisions:
  - "Normalize table column names to snake_case in registry JSON"
  - "Use fast-deep-equal for change detection (skip writes when unchanged)"
  - "Runtime fields preserved on re-parse: status, linear_id, linear_url, pr_url, completed_at, created_at"
  - "Orphan flagging adds orphaned: true and orphaned_at timestamp, does not delete"
  - "Un-orphan removes flags when deliverable reappears in spec"

patterns_established:
  - "SPEC_FIELD_MAP constant defines column-to-field normalization"
  - "RUNTIME_FIELDS constant lists fields preserved across re-parse"
  - "contentEqual function compares excluding schemaVersion"
  - "mergeFields function implements spec-overwrites-runtime-preserves pattern"

duration: 3m 29s
completed: 2026-01-25
---

# Phase 3 Plan 2: Idempotent Registry Updates Summary

**Idempotent registry updates with fast-deep-equal change detection, runtime field preservation, and orphan flagging for removed deliverables**

## Performance

- **Duration:** 3m 29s
- **Started:** 2026-01-25T01:37:20Z
- **Completed:** 2026-01-25T01:40:49Z
- **Tasks:** 4 (TDD: 2 RED + 2 GREEN phases)
- **Files modified:** 4

## Accomplishments

- Idempotent registry updates: re-parsing unchanged spec produces zero file writes
- Runtime field preservation: status, linear_id, pr_url survive spec re-parse
- Orphan handling: removed deliverables flagged with orphaned: true, restored ones un-orphaned
- Parse command orchestration: structured result for VS Code extension consumption

## Task Commits

Each task was committed atomically:

1. **TDD RED: Registry tests** - `033a336` (test)
2. **TDD GREEN: Registry implementation** - `e1a5b74` (feat)
3. **TDD RED: Parse command tests** - `0d9a9f8` (test)
4. **TDD GREEN: Parse command implementation** - `ab8615e` (feat)

## Files Created/Modified

- `src/parser/registry.js` - Idempotent registry update logic with SPEC_FIELD_MAP and RUNTIME_FIELDS
- `src/commands/parse.js` - Parse command orchestrating parseSpec + updateRegistry
- `tests/registry.test.js` - 23 tests covering fresh parse, re-parse, runtime fields, orphans
- `tests/parse-command.test.js` - 16 tests covering full parse flow and integration

## Decisions Made

1. **Normalize column names to snake_case**: Table column names like "Acceptance Criteria (testable)" become `acceptance_criteria` in JSON for cleaner API consumption.

2. **Use fast-deep-equal for change detection**: Skip file writes when content unchanged. Compare objects excluding schemaVersion since that's added by writeJsonWithSchema.

3. **Spec fields vs runtime fields segregation**: SPEC_FIELD_MAP defines what comes from spec (overwritten on re-parse). RUNTIME_FIELDS defines what's preserved (set by other commands).

4. **Orphan flagging, not deletion**: Removed deliverables get `orphaned: true` and `orphaned_at: timestamp`. Never deleted automatically. User can clean up with future command if needed.

5. **Un-orphan on restoration**: If a deliverable reappears in spec, orphan flags are removed and file is updated.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 03-03 (Sync Command):**
- runParse returns structured result with success/errors/summary
- Registry files have schemaVersion, created_at, and normalized field names
- Runtime fields ready for Linear sync to populate (linear_id, linear_url, status)

**Interface for next phase:**
```javascript
const { runParse } = require('./commands/parse');
const result = await runParse('/path/to/feature-spec.md', '/project/dir');
// result.success: boolean
// result.errors: ValidationError[] (if failed)
// result.summary: { parsed, created, updated, unchanged, orphaned }
// result.warnings: string[]
```

---
*Phase: 03-parsing-idempotent-registry*
*Completed: 2026-01-25*
