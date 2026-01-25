---
phase: 04-execution-packets
plan: 01
subsystem: packets
tags: [handlebars, packet-generation, tdd, constraints, provenance, drift]

# Dependency graph
requires:
  - phase: 03-parsing-idempotent-registry
    provides: Registry JSON files with deliverable data
  - phase: 02-templates-and-scaffolding
    provides: Handlebars template patterns, TDD file structure
provides:
  - Packet template (packet-v1.hbs) with all 10 execution sections
  - generatePacketShell orchestrator for packet generation
  - Constraint extraction from TDD guardrails
  - Drift data filtering with source freshness
  - Provenance tracking (git SHAs, generator version)
  - Size checker with word limits (1500 soft, 2000 hard)
  - Start command with already-started detection
affects: [05-linear-integration, 06-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Packet generation from registry + spec + TDD data
    - AC categorization by prefix (C#/F#/N#/E#)
    - Guardrails extraction from TDD ## 4) section

key-files:
  created:
    - templates/packet-v1.hbs
    - src/packets/generate-shell.js
    - src/packets/fetch-constraints.js
    - src/packets/fetch-drift.js
    - src/packets/compute-provenance.js
    - src/packets/size-checker.js
    - src/commands/start.js
    - tests/generate-shell.test.js
    - tests/start-command.test.js
    - tests/fixtures/test-tdd.md
  modified: []

key-decisions:
  - "Use remark AST parsing for guardrails extraction (same as spec parsing)"
  - "Categorize ACs by prefix: C#=Critical, F#=Functional, N#=Nice-to-have, E#=Edge"
  - "Size limits: 1500 word soft limit (warn), 2000 word hard limit (split)"
  - "Already-started detection returns existingPath without regenerating"
  - "Drift filtering: pending decision OR applies_to_next_work: true"

patterns-established:
  - "Packet template: 10 sections (Control, Guardrails, Goal, Story, ACs, QA, Dependencies, Provenance, Drift, Stop Points)"
  - "Provenance block: spec SHA + TDD SHA + registry SHA + generator version + timestamp"
  - "AC prefix pattern: C1:, F1:, N1:, E1: parsed and categorized"

# Metrics
duration: 6min
completed: 2026-01-25
---

# Phase 4 Plan 1: Packet Shell Generation Summary

**Handlebars packet template with 10 sections, TDD constraint extraction, drift filtering, and start command with already-started detection**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-25T02:42:22Z
- **Completed:** 2026-01-25T02:48:12Z
- **Tasks:** 3
- **Files created:** 10

## Accomplishments
- Complete packet template (packet-v1.hbs) with all 10 sections from CONTEXT.md
- TDD guardrails extraction from ## 4) Guardrails section (MUST/MUST NOT constraints)
- Drift data filtering with source freshness detection
- Start command that warns on already-started deliverables
- 42 new tests (28 for packet utilities, 14 for start command)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create packet template and generation utilities (TDD RED)** - `0de83b4` (test)
   - 28 failing tests for generatePacketShell, fetchTDDConstraints, fetchDriftData, computeProvenance, countWords, checkSizeAndSplit
   - Test fixture test-tdd.md with guardrails section

2. **Task 2: Implement packet template and generation utilities (TDD GREEN)** - `593a8f5` (feat)
   - templates/packet-v1.hbs with all 10 sections
   - src/packets/*.js: 5 utility modules
   - All 28 tests passing

3. **Task 3: Create start command with already-started warning** - `def6484` (feat)
   - src/commands/start.js with runStart function
   - tests/start-command.test.js with 14 tests
   - All 131 tests passing

## Files Created/Modified

### Templates
- `templates/packet-v1.hbs` - Handlebars template with 10 execution packet sections

### Packet Utilities
- `src/packets/generate-shell.js` - Main orchestrator for packet generation
- `src/packets/fetch-constraints.js` - Extract MUST/MUST NOT from TDD guardrails
- `src/packets/fetch-drift.js` - Filter drift items and compute source freshness
- `src/packets/compute-provenance.js` - Git SHA and version tracking
- `src/packets/size-checker.js` - Word count and size limit enforcement

### Commands
- `src/commands/start.js` - Start deliverable command with already-started detection

### Tests
- `tests/generate-shell.test.js` - 28 tests for packet generation utilities
- `tests/start-command.test.js` - 14 tests for start command
- `tests/fixtures/test-tdd.md` - TDD fixture with guardrails section

## Decisions Made

1. **Remark AST for guardrails extraction:** Reused same pattern as spec parsing for consistency
2. **AC prefix categorization:** Parse "C1:", "F1:", "N1:", "E1:" prefixes into critical/functional/nice-to-have/edge arrays
3. **Size limits:** 1500 word soft limit (warning only), 2000 word hard limit (split to appendix)
4. **Already-started behavior:** Return existingPath without regenerating, let caller decide overwrite
5. **Drift filtering criteria:** Include items where decision='pending' OR applies_to_next_work=true

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Packet generation complete and tested
- Ready for Phase 4 Plan 2: Enrich Packet skill (if planned)
- Ready for Phase 5: Linear Integration

---
*Phase: 04-execution-packets*
*Completed: 2026-01-25*
