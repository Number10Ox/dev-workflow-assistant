---
phase: 06-linear-integration
plan: 04
subsystem: linear-integration
tags: [linear, sync, bridge-api, cli, registry, deduplication, conflict-detection]

# Dependency graph
requires:
  - phase: 06-linear-integration
    plan: 03
    provides: DWA section builder, fingerprinting, externalId generation, BridgeClient
  - phase: 06-linear-integration
    plan: 02
    provides: linear-tracker-provider with bridge API support
provides:
  - Sync command (--sync-linear) for CLI
  - Core sync orchestration (create/update/skip/conflict logic)
  - Registry fields for Linear issue tracking
  - Conflict detection via hash comparison
  - Deduplication via externalId
affects: [06-05-cli-integration, user-workflows, deliverable-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sync orchestration with deterministic action selection (CREATE/UPDATE/SKIP_UNCHANGED/SKIP_CONFLICT)"
    - "Registry-based fast path with externalId safety net for issue lookups"
    - "Hash-based conflict detection to prevent overwriting manual edits"
    - "Batch processing with concurrency control for multi-deliverable syncs"

key-files:
  created:
    - src/linear/sync.js
    - src/commands/sync-linear.js
  modified:
    - src/parser/registry.js

key-decisions:
  - "Extended RUNTIME_FIELDS in registry.js to include Linear sync metadata (linear_issue_id, linear_identifier, linear_external_id, linear_project_id, dwa_sync_hash)"
  - "Implemented dual-lookup strategy: registry linear_issue_id (fast) + externalId query (safety net)"
  - "Hash-based conflict detection prevents overwriting manually edited DWA sections unless --force"
  - "Concurrency control (batch size 3) prevents API rate limiting during bulk syncs"

patterns-established:
  - "Sync actions as enum (SyncAction.CREATE/UPDATE/SKIP_UNCHANGED/SKIP_CONFLICT/ERROR)"
  - "Registry updateLinearFields() for atomic field updates after sync"
  - "CLI formatResults() grouping by action type for clear user feedback"

# Metrics
duration: 5min
completed: 2026-01-25
---

# Phase 6 Plan 4: Sync Command Implementation Summary

**Complete Linear sync workflow with CLI command, conflict detection, deduplication via externalId, and registry field tracking**

## Performance

- **Duration:** ~5 min (including checkpoint time)
- **Started:** 2026-01-25T16:45:00Z (estimated)
- **Completed:** 2026-01-25T16:50:00Z (estimated)
- **Tasks:** 3 (+ 1 checkpoint)
- **Files modified:** 3

## Accomplishments

- Registry extended with 5 new Linear sync fields while preserving all existing fields
- Core sync orchestration with deterministic action selection (create/update/skip/conflict)
- CLI command with --dry-run, --force, --deliverables, --project options
- Checkpoint approved with module-level verification (full E2E requires VS Code extension context)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update registry.js to include Linear runtime fields** - `46654f4` (feat)
   - Extended RUNTIME_FIELDS from 7 to 12 fields
   - Added updateLinearFields() helper for atomic registry updates

2. **Task 2: Create sync.js with core sync orchestration logic** - `949536d` (feat)
   - Implemented syncDeliverable() and syncAllDeliverables()
   - determineSyncAction() with hash-based conflict detection
   - Dual-lookup strategy: registry fast path + externalId safety net
   - Batch processing with concurrency=3 to prevent rate limiting

3. **Task 3: Create sync-linear.js command** - `72758ef` (feat)
   - CLI interface for sync workflow
   - formatResults() with grouped output (created/updated/skipped/conflicts/failed)
   - Support for --dry-run, --force, --deliverables, --project flags

**Plan metadata:** (pending - will be added on continuation)

## Files Created/Modified

- **src/parser/registry.js** - Extended RUNTIME_FIELDS array with 5 new Linear sync fields:
  - `linear_issue_id` - Linear UUID for fast lookup
  - `linear_identifier` - Human-readable identifier (e.g., "ENG-123")
  - `linear_external_id` - Our externalId stored in Linear for deduplication
  - `linear_project_id` - Resolved container/project ID
  - `dwa_sync_hash` - Fingerprint of last sync for change detection
  - Added `updateLinearFields()` function for atomic registry updates

- **src/linear/sync.js** - Core sync orchestration logic:
  - `syncDeliverable()` - Single deliverable sync with create/update/skip/conflict logic
  - `syncAllDeliverables()` - Batch sync with concurrency control
  - `determineSyncAction()` - Decision logic based on existence, hash comparison, manual edits
  - `SyncAction` enum - CREATE/UPDATE/SKIP_UNCHANGED/SKIP_CONFLICT/ERROR

- **src/commands/sync-linear.js** - CLI command implementation:
  - `syncLinear()` - Main command handler
  - `formatResults()` - User-facing output formatter
  - Feature and registry validation
  - Option parsing (dry-run, force, deliverables, project)

## Decisions Made

1. **Registry field extension strategy**: Extended existing RUNTIME_FIELDS array rather than creating separate Linear-specific array to maintain single source of truth for runtime field preservation during re-parse.

2. **Dual-lookup pattern**: Registry linear_issue_id provides fast path, externalId query provides safety net if issue deleted/registry corrupted. Ensures robustness.

3. **Hash-based conflict detection**: Compare dwa_sync_hash from registry against Linear's stored hash to detect manual edits. Requires --force to overwrite, preventing accidental data loss.

4. **Concurrency control**: Batch size of 3 concurrent syncs balances performance with API rate limit avoidance. Prevents 429 errors during bulk operations.

5. **Checkpoint verification scope**: Module-level verification (imports, exports, logic) approved. Full E2E sync testing deferred until VS Code extension context available with configured Linear API key.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Checkpoint Details

**Type:** human-verify
**Status:** APPROVED

**What was verified:**
Module-level correctness of sync implementation:
- Registry exports RUNTIME_FIELDS with all 12 fields (7 original + 5 new)
- Registry exports updateLinearFields() function
- sync.js exports syncDeliverable, syncAllDeliverables, determineSyncAction, SyncAction
- sync-linear.js exports syncLinear command function
- All modules load without syntax errors

**Full E2E testing deferred:**
Complete sync workflow testing (actual Linear API calls, issue creation, conflict detection, registry updates) requires:
- VS Code extension environment
- linear-tracker-provider installed
- Linear API key configured
- Test feature with deliverables

This will be verified during Plan 05 (CLI Integration) or manually during user acceptance.

## User Setup Required

**External services require manual configuration.** See [06-USER-SETUP.md](./06-USER-SETUP.md) for:
- LINEAR_API_KEY environment variable
- VS Code linearTrackerProvider.apiKey setting
- Verification commands

## Next Phase Readiness

**Ready for:**
- Plan 05: CLI Integration (wire sync-linear.js into main CLI)
- User workflows (sync deliverables after parsing)

**Blockers/Concerns:**
None. Module implementation complete and verified at code level.

**Future enhancements:**
- Retry logic for transient API failures
- Progress indicators for large batch syncs
- Selective field updates (only sync changed fields rather than full DWA section)
- Webhook support for bidirectional sync (Linear -> DWA registry updates)

---
*Phase: 06-linear-integration*
*Completed: 2026-01-25*
