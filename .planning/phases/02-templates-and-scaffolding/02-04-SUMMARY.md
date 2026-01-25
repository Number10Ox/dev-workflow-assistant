---
phase: 02-templates-and-scaffolding
plan: 04
subsystem: templates
tags: [handlebars, scaffolding, tdd, yaml, gray-matter]

# Dependency graph
requires:
  - phase: 02-01
    provides: Feature spec template and scaffolding infrastructure
provides:
  - TDD template (tdd-v1.hbs) with 8 sections and ADR format
  - scaffoldTDD utility for creating linked TDD documents
  - Bidirectional linking between specs and TDDs via tdd_path field
  - Comprehensive test coverage for TDD scaffolding
affects: [03-core-parsing, skill-draft-tdd]

# Tech tracking
tech-stack:
  added: [gray-matter]
  patterns: [bidirectional-linking, slug-generation, atomic-writes]

key-files:
  created:
    - templates/tdd-v1.hbs
    - src/scaffolding/scaffold-tdd.js
    - tests/scaffold-tdd.test.js
  modified:
    - templates/feature-spec-v2.hbs
    - src/scaffolding/scaffold.js
    - tests/scaffold.test.js

key-decisions:
  - "TDD files stored in docs/tdds/ (not .dwa/) as they are technical documentation"
  - "Use gray-matter for YAML frontmatter parsing and updating"
  - "Bidirectional linking: both spec and TDD reference each other via tdd_path"
  - "TDD filename slugification: lowercase, hyphens, remove special chars"

patterns-established:
  - "Bidirectional linking: scaffoldTDD updates both feature.json AND spec frontmatter"
  - "Slug generation: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')"
  - "Relative path calculation from TDD to spec for reverse linking"

# Metrics
duration: 2m 27s
completed: 2026-01-24
---

# Phase 2 Plan 4: Gap Closure Summary

**TDD scaffolding system with bidirectional linking, 8-section template using ADR format, and comprehensive test coverage closing all Phase 2 verification gaps**

## Performance

- **Duration:** 2 min 27 sec
- **Started:** 2026-01-25T00:48:55Z
- **Completed:** 2026-01-25T00:51:22Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added tdd_path field to spec template and feature.json infrastructure
- Created TDD template with all 8 required sections and ADR-format decision log
- Implemented scaffoldTDD utility with bidirectional linking (spec <-> TDD)
- Added 7 comprehensive tests for TDD scaffolding (22 tests total now passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tdd_path to spec template and scaffold.js** - `2457e21` (feat)
2. **Task 2: Create TDD template and scaffold-tdd utility** - `dc04965` (feat)
3. **Task 3: Create TDD scaffolding tests** - `ede2289` (test)

## Files Created/Modified

**Created:**
- `templates/tdd-v1.hbs` - TDD template with 8 sections (Objectives, Architecture, Decision Log with ADR format, Guardrails, Risks, Test Strategy, Implementation Notes, Revision History)
- `src/scaffolding/scaffold-tdd.js` - TDD scaffolding utility with bidirectional linking
- `tests/scaffold-tdd.test.js` - 7 comprehensive tests for TDD scaffolding

**Modified:**
- `templates/feature-spec-v2.hbs` - Added tdd_path: null to frontmatter
- `src/scaffolding/scaffold.js` - Added tdd_path: null to feature.json output
- `tests/scaffold.test.js` - Added assertions verifying tdd_path field

## Decisions Made

**Technical Design Document Location**
- Stored in `docs/tdds/` directory (not `.dwa/`)
- Rationale: TDDs are technical documentation, not hidden metadata. Developers should see them alongside other docs.

**Bidirectional Linking Strategy**
- `scaffoldTDD` updates BOTH `feature.json` tdd_path AND spec frontmatter tdd_path
- TDD frontmatter contains `spec_path` with relative path back to spec
- Rationale: Enables navigation in both directions - from spec to TDD and from TDD back to spec

**Filename Generation**
- Slugify title: lowercase, replace non-alphanumeric with hyphens, trim edges
- Pattern: `${slug}-tdd.md`
- Rationale: Predictable, URL-safe filenames from arbitrary feature titles

**YAML Frontmatter Handling**
- Use `gray-matter` library for parsing and updating frontmatter
- Preserve all existing fields when updating
- Rationale: Atomic updates to frontmatter without manual string parsing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementations worked as specified on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 3 (Core Parsing):**
- Feature spec template v2.0 now complete with tdd_path field
- TDD template v1.0 ready for use
- Bidirectional linking infrastructure in place
- Comprehensive test coverage (22 tests passing)

**Blocker resolved:**
- scaffoldTDD utility now exists, unblocking /dwa:draft-tdd skill functionality
- All Phase 2 verification gaps closed

**Context for Phase 3:**
- Parser will need to handle tdd_path field in spec frontmatter
- TDD documents exist in docs/tdds/ directory (not in .dwa/)
- Both feature.json and spec frontmatter contain tdd_path for bidirectional links

---
*Phase: 02-templates-and-scaffolding*
*Completed: 2026-01-24*
