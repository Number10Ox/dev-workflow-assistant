---
phase: 05-drift-tracking
plan: 01
subsystem: drift
tags: [event-sourcing, validation, structural-comparison, uuid]

# Dependency graph
requires:
  - phase: 03-spec-parsing
    provides: parseSpec for structural comparison
  - phase: 01-bootstrap
    provides: writeJsonWithSchema for atomic writes
provides:
  - Drift event schema validation (validateDriftEvent)
  - Append-only drift event recording (appendDriftEvent)
  - Structural drift detection (detectStructuralDrift)
  - Error codes DWA-E070 through DWA-E080
affects: [05-02, 05-03, 06-linear-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Event sourcing with append-only drift_events array
    - crypto.randomUUID() for event ID generation (no external dependency)
    - Multi-format AC counting (newlines, semicolons, <br>)

key-files:
  created:
    - src/drift/validate-event.js
    - src/drift/append-event.js
    - src/drift/structural-compare.js
    - tests/drift/validate-event.test.js
    - tests/drift/append-event.test.js
    - tests/drift/structural-compare.test.js
  modified: []

key-decisions:
  - "Use crypto.randomUUID() (Node built-in) instead of uuid package for zero additional dependencies"
  - "AC count comparison uses semicolon, newline, and <br> as delimiters to handle various formats"
  - "drift_open_count is derived (computed from events) not stored separately"
  - "Structural comparison priority: removed > AC count > no PR URL > description"

patterns-established:
  - "Event sourcing: Never mutate existing events, always append"
  - "Validation before write: validateDriftEvent called before appendDriftEvent completes"
  - "Graceful degradation: detectStructuralDrift returns no-drift when spec missing"

# Metrics
duration: 7m 40s
completed: 2026-01-25
---

# Phase 5 Plan 01: Drift Event Infrastructure Summary

**TDD-driven drift utilities: validation with DWA-E07x errors, append-only event recording with auto-generated UUIDs, and structural comparison for spec vs registry divergence**

## Performance

- **Duration:** 7m 40s
- **Started:** 2026-01-25T04:01:44Z
- **Completed:** 2026-01-25T04:09:24Z
- **Tasks:** 3 TDD features (6 commits: test + feat for each)
- **Files created:** 6

## Accomplishments

- Drift event validation with required field and enum checking (DWA-E070-E073)
- Append-only event recording using crypto.randomUUID() and writeJsonWithSchema
- Structural drift detection comparing spec vs registry (AC count, description, PR URL, orphans)
- drift_open_count derived field counting pending + escalate decisions

## Task Commits

Each TDD feature produced test + implementation commits:

1. **Feature 1: Drift Event Validation**
   - `4c5149a` (test) - Add failing tests for drift event validation
   - `27d5e2e` (feat) - Implement drift event validation

2. **Feature 2: Append Drift Event**
   - `b94b24b` (test) - Add failing tests for append drift event
   - `ae63166` (feat) - Implement append-only drift event recording

3. **Feature 3: Structural Drift Detection**
   - `bb72780` (test) - Add failing tests for structural drift detection
   - `01e3dda` (feat) - Implement structural drift detection

## Files Created

- `src/drift/validate-event.js` - Drift event schema validation with DRIFT_KINDS, DRIFT_DECISIONS, DRIFT_SOURCES
- `src/drift/append-event.js` - Append-only event recording to deliverable registry
- `src/drift/structural-compare.js` - Spec vs registry comparison for drift detection
- `tests/drift/validate-event.test.js` - 19 tests for validation
- `tests/drift/append-event.test.js` - 14 tests for append functionality
- `tests/drift/structural-compare.test.js` - 14 tests for structural comparison

## Decisions Made

1. **crypto.randomUUID() over uuid package** - Node 14.17+ built-in provides RFC4122 UUIDs without additional dependency
2. **Semicolon delimiter for AC counting** - Markdown tables can't use pipes or newlines in cells, semicolons work reliably
3. **Derived drift_open_count** - Computed on each append from pending + escalate decisions, not stored separately
4. **Detection priority order** - Removed from spec (highest) > AC count mismatch > no PR URL > description changed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Markdown table AC format:** Initially tried using `|` as AC delimiter but pipes are column separators in markdown tables. Switched to semicolons which the parser preserves correctly.
- **Resolution:** Updated both structural compare logic and tests to use semicolon-delimited ACs. The countACLines function now handles newlines, semicolons, and `<br>` tags uniformly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Drift validation and recording infrastructure complete
- 05-02 (Complete Deliverable Command) can use appendDriftEvent and detectStructuralDrift
- 05-03 (Rebuild Drift Log) can aggregate from drift_events arrays
- 47 tests added (178 total), all passing

---
*Phase: 05-drift-tracking*
*Completed: 2026-01-25*
