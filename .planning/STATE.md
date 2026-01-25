# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Deliverables parsed from a canonical feature spec drive all downstream work -- Linear tickets, GSD execution packets, PR descriptions, and drift checks flow from the registry, not from manual coordination.
**Current focus:** Phase 4: Execution Packets

## Current Position

Phase: 3 of 7 (Parsing + Idempotent Registry)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-01-25 - Completed Phase 3 (Parsing + Idempotent Registry)

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 3m 22s
- Total execution time: 0.51 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 - Bootstrap | 3 | 17m 30s | 5m 50s |
| 02 - Templates | 4 | 8m 9s | 2m 2s |
| 03 - Parsing | 2 | 6m 19s | 3m 10s |

**Recent Trend:**
- Last 5 plans: 02-03 (1m 6s), 02-04 (2m 27s), 03-01 (2m 50s), 03-02 (3m 29s)
- Trend: Consistent velocity - Phase 3 averaging 3m 10s for TDD plans

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8-phase linear dependency chain derived from requirements. Each phase delivers one coherent capability.
- [Roadmap]: REQ-011 (schema versioning) grouped with Phase 1 installer since versioning must exist before any JSON files are created.
- [Roadmap]: REQ-010 (template validation) grouped with Phase 3 parsing since validation is a prerequisite gate for the parser.
- [01-01]: Use Commander.js options (--install) instead of subcommands for simpler API.
- [01-01]: Use CommonJS module system for compatibility with commander and fs-extra.
- [01-01]: Enforce schemaVersion in all JSON files via writeJsonWithSchema helper (supports REQ-011).
- [01-02]: Use DWA_TEST_HOME environment variable for test isolation instead of mocking.
- [01-02]: Use node:test built-in test runner instead of Jest for zero test dependencies.
- [01-02]: Create placeholder .gitkeep files for empty source directories to track in git.
- [01-03]: Use semver library for version comparison to properly handle semantic versioning.
- [01-03]: Create timestamped backups before upgrade with preserved file timestamps.
- [01-03]: Only remove dwa-* prefixed skill directories for uninstall safety.
- [01-03]: Use node:test built-in test runner (corrected from Jest by orchestrator for consistency).
- [02-01]: Use Handlebars for template rendering with placeholder leakage detection.
- [02-01]: Generate feature_id in FEAT-YYYY-NNN format with random 3-digit sequence.
- [02-01]: Check both .dwa/feature.json AND feature-spec.md for existing feature detection.
- [02-01]: Template path resolution uses package source (../../templates) not installed location for scaffolding.
- [02-02]: Claude Code skill uses 4-step process: check existing, get title, scaffold, confirm.
- [02-02]: [DWA_INSTALL_PATH] placeholder resolved by Claude at runtime to actual package location.
- [02-02]: Tests use temp directory isolation via fs.mkdtemp, no DWA_TEST_HOME needed for scaffold tests.
- [02-03]: Skill uses 5-step process (vs 4-step for create-spec) adding prerequisite check for spec existence.
- [02-03]: Prerequisite validation requires both feature-spec.md AND .dwa/feature.json.
- [02-03]: TDD overwrite check looks at both feature.json tdd_path and docs/tdds/ directory.
- [02-04]: TDD files stored in docs/tdds/ (not .dwa/) as they are technical documentation.
- [02-04]: Use gray-matter for YAML frontmatter parsing and updating.
- [02-04]: Bidirectional linking: both spec and TDD reference each other via tdd_path.
- [02-04]: TDD filename slugification: lowercase, hyphens, remove special chars.
- [03-01]: Use `.default` for ES module imports (remark-parse, remark-gfm) in CommonJS context.
- [03-01]: Find Deliverables Table by column header ("Deliverable ID") not by heading hierarchy.
- [03-01]: Required columns: Deliverable ID, User Story, Description, Acceptance Criteria (testable), QA Plan Notes.
- [03-01]: Row numbering in errors uses index +2 (header row + 0-index offset).
- [03-02]: Normalize table column names to snake_case in registry JSON (e.g., "Acceptance Criteria (testable)" -> acceptance_criteria).
- [03-02]: Use fast-deep-equal for change detection - skip writes when content unchanged.
- [03-02]: Runtime fields preserved on re-parse: status, linear_id, linear_url, pr_url, completed_at, created_at.
- [03-02]: Orphan flagging adds orphaned: true and orphaned_at timestamp, does not delete files.
- [03-02]: Un-orphan removes flags when deliverable reappears in spec.

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Phase 3: Feature Spec Template v2.0 exact schema (column names, YAML fields) must be defined before parser implementation.~~ **RESOLVED:** Template structure finalized in 02-01 with 7-column Deliverables Table and structured frontmatter.
- ~~scaffoldTDD utility (src/scaffolding/scaffold-tdd.js) does not exist yet - will be created when TDD scaffolding is implemented.~~ **RESOLVED:** Created in 02-04 with bidirectional linking and comprehensive tests.
- ~~Phase 4: Idempotency edge cases (deliverable deletion, ID renumbering, splits) need design decisions during planning.~~ **RESOLVED:** Orphan flagging pattern established in 03-02 - soft delete with orphaned: true, un-orphan on restoration.
- Phase 5: Linear API rate limits, GraphQL mutations, externalId support, and MCP tool names need verification.

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed Phase 3 (Parsing + Idempotent Registry). 2 plans executed, all verified (6/6 must-haves). 89 tests passing.
Resume file: None
