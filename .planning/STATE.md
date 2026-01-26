# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Deliverables parsed from a canonical feature spec drive all downstream work -- Linear tickets, GSD execution packets, PR descriptions, and drift checks flow from the registry, not from manual coordination.
**Current focus:** Phase 7 complete, Phase 8 pending

## Current Position

Phase: 7.1 of 8 (Installation Simplification)
Plan: 1 of 1 complete (07.1-01)
Status: Phase complete
Last activity: 2026-01-26 - Completed 07.1-01-PLAN.md (installation simplification)

Progress: [███████████████████] 90.0% (27 of 30 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 27
- Average duration: 3m 42s
- Total execution time: 1.67 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 - Bootstrap | 3 | 17m 30s | 5m 50s |
| 02 - Templates | 4 | 8m 9s | 2m 2s |
| 03 - Parsing | 2 | 6m 19s | 3m 10s |
| 04 - Packets | 2 | 8m 0s | 4m 0s |
| 05 - Drift | 4 | 15m 14s | 3m 49s |
| 06 - Linear Integration | 3 | 10m 1s | 3m 20s |
| 07 - Polish & Extended | 8 | 48m 50s | 6m 6s |
| 07.1 - Installation Simplification | 1 | 5m 6s | 5m 6s |

**Recent Trend:**
- Last 5 plans: BRIDGE-01 (7m 6s), 07-01 (6m 53s), 07-02 (11m 48s), 07-03 (10m 56s), 07.1-01 (5m 6s)
- Phase 07.1: Installation simplification complete (setup wizard + graceful degradation)

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
- [04-01]: Use remark AST parsing for guardrails extraction (same as spec parsing).
- [04-01]: Categorize ACs by prefix: C#=Critical, F#=Functional, N#=Nice-to-have, E#=Edge.
- [04-01]: Size limits: 1500 word soft limit (warn), 2000 word hard limit (split to appendix).
- [04-01]: Already-started detection returns existingPath without regenerating.
- [04-01]: Drift filtering: pending decision OR applies_to_next_work: true.
- [04-02]: Enrichment appends after existing content with ENRICHMENT (LLM-Generated) header.
- [04-02]: Contract mutation forbidden in sections 0-8; changes go to Patch Proposal only.
- [04-02]: AC Coverage Map suggests test type per AC (unit/integration/manual).
- [04-02]: Appendix template handles Nice-to-have and Edge AC overflow.
- [05-01]: Use crypto.randomUUID() (Node built-in) instead of uuid package for zero additional dependencies.
- [05-01]: AC count comparison uses semicolon, newline, and <br> as delimiters to handle various formats.
- [05-01]: drift_open_count is derived (computed from events) not stored separately.
- [05-01]: Structural comparison priority: removed > AC count > no PR URL > description.
- [05-02]: Drift only recorded when both detected AND decision provided - allows caller to prompt user.
- [05-02]: evidence_refs stored as array containing prUrl and commitSha.
- [05-02]: Notes stored as author_notes field in drift events.
- [05-03]: Drift log is a derived artifact - always rebuilt from registry drift_events, never manually edited.
- [05-03]: Open drift (pending + escalate) shown prominently at top of drift log.
- [05-03]: By-deliverable section uses chronological order (oldest first) within each group for narrative flow.
- [05-04]: propose-drift-patches reads from registry drift_events, not drift-log.md.
- [05-04]: summarize-drift adapts tone for technical (PR) vs stakeholder (PM) audiences.
- [05-04]: Patch proposals are reviewable text, never auto-applied.
- [05-gap]: fetchDriftData reads from drift_events (not drift) and maps summary to description for packet consumption.
- [06-01]: Use IssueCreateInput interface instead of positional parameters for createIssue().
- [06-01]: Use IssueFilter interface instead of string status parameter for listIssues().
- [06-01]: Add queryByExternalId as required method in IssueTracker interface.
- [06-01]: Set BRIDGE_API_VERSION to 2.0.0 to indicate breaking interface changes.
- [06-01]: Use provider-agnostic 'container' field instead of 'projectId' for portability across Linear/JIRA/GitHub.
- [06-02]: Use type assertions (as any) for externalId/projectId when Linear SDK types are incomplete but GraphQL API supports fields.
- [06-02]: Wrap all API methods with exponential backoff for comprehensive rate limit handling.
- [07-04]: Prefer VS Code API over clipboardy for clipboard access (more reliable in extension context).
- [07-04]: Preserve Phase 4 grouped acceptance criteria structure (C/F/E/N) in PR descriptions.
- [07-04]: PR description generation is strictly read-only (never modifies registry or spec).
- [06-02]: Return null from queryByExternalId when no matching issue found (not throw error).
- [06-05]: Use async IIFE pattern to isolate async handling to sync-linear block only (no need to restructure entire CLI).
- [06-05]: Include syncLinear in mutual exclusivity check (not sub-options like --dry-run, --force).
- [06-05]: Commander.js camelCase conversion: --sync-linear becomes opts.syncLinear.
- [BRIDGE-01]: Use VS Code SecretStorage for Google Workspace credentials (not MCP path dependency).
- [BRIDGE-01]: Expose auth/docs/drive namespaces on provider API for clear separation of concerns.
- [BRIDGE-01]: Return etag, modifiedTime, revisionId from Docs API for robust change detection.
- [BRIDGE-01]: Name package gworkspace-provider (not gdocs-provider) for future Sheets/Calendar support.
- [BRIDGE-01]: Rename private field to authManager to avoid shadowing public auth namespace (bug fix).
- [07-01]: Use capability handshake (not method checks) for provider compatibility validation.
- [07-01]: Inject vscode module in constructor for testability in Node.js without extension host.
- [07-01]: SHA-256 for content hashing (deterministic, collision-resistant, industry standard).
- [07-01]: Four diagnostic severity levels: info (100), warning (200), error (300), fatal (400).
- [07-01]: Import reports written to .dwa/import-reports/ with docId and timestamp in filename.
- [07-02]: List detection via paragraph.bullet field (not namedStyleType) per Google Docs API v1 structure.
- [07-02]: Table complexity: simple (no spans) -> GFM, complex (merged cells) -> HTML with DWA-GDOC-202.
- [07-02]: Nested formatting order: strikethrough -> italic -> bold (innermost to outermost).
- [07-02]: Empty paragraphs (only whitespace/newline) skipped to prevent excessive blank lines.
- [07-02]: Footnotes collected during conversion and appended at document end (markdown reference-style).
- [07-03]: CLI hash mismatch behavior: write diff artifact + exit with instructions (vs VS Code modal).
- [07-03]: Explicit output path resolution: error when no .dwa/ and no --out (prevents ambiguity).
- [07-03]: Trim markdown output before hashing for consistent hash verification.
- [07-03]: Document change detection: prefer revisionId, fall back to etag, then modifiedTime.
- [07.1-01]: Use enquirer for interactive prompts (established pattern for wizard UIs).
- [07.1-01]: Feature detection via VS Code extension checks (graceful in CLI context).
- [07.1-01]: Separate --setup and --status from core operations (clear separation of concerns).
- [07.1-01]: Automatic extension installation via code CLI when available.

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Phase 3: Feature Spec Template v2.0 exact schema (column names, YAML fields) must be defined before parser implementation.~~ **RESOLVED:** Template structure finalized in 02-01 with 7-column Deliverables Table and structured frontmatter.
- ~~scaffoldTDD utility (src/scaffolding/scaffold-tdd.js) does not exist yet - will be created when TDD scaffolding is implemented.~~ **RESOLVED:** Created in 02-04 with bidirectional linking and comprehensive tests.
- ~~Phase 4: Idempotency edge cases (deliverable deletion, ID renumbering, splits) need design decisions during planning.~~ **RESOLVED:** Orphan flagging pattern established in 03-02 - soft delete with orphaned: true, un-orphan on restoration.
- ~~Phase 5: Linear API rate limits, GraphQL mutations, externalId support, and MCP tool names need verification.~~ **RESOLVED:** Implemented in 06-02 with withRateLimitHandling wrapper and queryByExternalId in Linear provider.

## Session Continuity

Last session: 2026-01-26
Stopped at: Completed 07.1-01-PLAN.md. Interactive setup wizard + graceful feature detection. 399 total tests passing.
Resume file: None
Next: Phase 07.2 (Workflow Friction Reduction) or Phase 8 (Ralph Runner)
