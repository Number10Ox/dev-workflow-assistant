---
phase: 02-templates-and-scaffolding
plan: 01
subsystem: scaffolding
tags: [handlebars, gray-matter, templating, feature-spec]

# Dependency graph
requires:
  - phase: 01-bootstrap-and-installer
    provides: writeJsonWithSchema helper, paths utilities, fs-extra patterns
provides:
  - Feature Spec Template v2.0 with structured YAML frontmatter
  - scaffoldFromTemplate function for creating feature-spec.md and .dwa/feature.json
  - checkExisting function for detecting existing feature files
affects: [03-spec-parsing-and-validation, 04-deliverables-registry]

# Tech tracking
tech-stack:
  added: [handlebars@^4.7.8, gray-matter@^4.0.3]
  patterns: [Handlebars templating, atomic file writes, placeholder leakage detection]

key-files:
  created:
    - templates/feature-spec-v2.hbs
    - src/scaffolding/scaffold.js
    - src/scaffolding/check-existing.js
  modified:
    - src/utils/paths.js

key-decisions:
  - "Use Handlebars for template rendering with placeholder leakage detection"
  - "Generate feature_id in FEAT-YYYY-NNN format with random 3-digit sequence"
  - "Check both .dwa/feature.json AND feature-spec.md for existing feature detection"
  - "Use write-file-atomic for spec file, writeJsonWithSchema for feature.json"

patterns-established:
  - "Template path resolution: use package source (../../templates) not installed location for scaffolding"
  - "Feature spec structure: 8 major sections with structured YAML frontmatter"
  - "Deliverables Table: 7 columns (ID, User Story, Description, AC, QA, Dependencies, Linear URL)"

# Metrics
duration: 2m 40s
completed: 2026-01-24
---

# Phase 02 Plan 01: Template Scaffolding Foundation Summary

**Handlebars-based Feature Spec Template v2.0 with scaffoldFromTemplate renderer creating structured frontmatter, 8-section spec, and .dwa/feature.json with schemaVersion**

## Performance

- **Duration:** 2 min 40 sec
- **Started:** 2026-01-24T20:10:07Z
- **Completed:** 2026-01-24T20:12:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Feature Spec Template v2.0 with structured YAML frontmatter (feature_id, title, owner, status, spec_schema_version: v2.0, links, linear)
- scaffoldFromTemplate function generates unique FEAT-YYYY-NNN IDs, renders template, writes spec + feature.json atomically
- checkExisting function detects both .dwa/feature.json and feature-spec.md for collision prevention
- 7-column Deliverables Table ready for Phase 3 parser (Deliverable ID, User Story, Description, Acceptance Criteria, QA Plan Notes, Dependencies, Linear Issue URL)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Handlebars template** - `4813863` (feat)
2. **Task 2: Create scaffold utilities and update paths** - `60f0b64` (feat)

## Files Created/Modified

- `templates/feature-spec-v2.hbs` - Handlebars template with 8 sections: Intent & Context, Experience, Work Breakdown, Architecture, Risks, Open Questions, Post-Implementation, Progress
- `src/scaffolding/scaffold.js` - scaffoldFromTemplate function: loads template, generates feature_id, renders with Handlebars, verifies no placeholder leakage, writes spec atomically + creates .dwa/feature.json with schemaVersion
- `src/scaffolding/check-existing.js` - checkExisting function: checks both .dwa/feature.json and feature-spec.md, returns alreadyInitialized flag + per-file status
- `src/utils/paths.js` - Added getTemplatesDir() and getPackageTemplatesDir() for template resolution
- `package.json` - Added handlebars@^4.7.8 and gray-matter@^4.0.3 dependencies
- `package-lock.json` - Lockfile updated with new dependencies

## Decisions Made

- **Handlebars for templating:** Mature library with simple mustache-style placeholders. Includes placeholder leakage detection via regex check after rendering.
- **Feature ID format FEAT-YYYY-NNN:** Year prefix for human readability, 3-digit random sequence (100-999) for uniqueness without centralized counter.
- **Dual existence check:** checkExisting returns both overall alreadyInitialized flag AND per-file status so skills can provide specific warnings ("feature.json exists but spec missing").
- **Template path resolution:** Use package source (../../templates) not installed location since skills invoke via `node` before installation runs.
- **Atomic writes:** Use write-file-atomic for spec file to prevent partial writes, writeJsonWithSchema for feature.json to enforce schemaVersion.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 02 Plan 02 (skill implementation):**
- Template and scaffold utilities are in place
- Template has all required fields for Phase 3 parser (feature_id, spec_schema_version, Deliverables Table)
- checkExisting provides collision detection for skill
- gray-matter dependency available for frontmatter parsing in Phase 3

**Blockers/Concerns:**
- None

---
*Phase: 02-templates-and-scaffolding*
*Completed: 2026-01-24*
