---
phase: 06-linear-integration
plan: 03
subsystem: linear-sync
tags: [linear, sync, sha256, content-builder, fingerprint, external-id, bridge-client]

# Dependency graph
requires:
  - phase: 06-01
    provides: Extended IssueTracker interface with externalId, container, queryByExternalId
provides:
  - DWA section content builder with BEGIN/END markers
  - SHA-256 fingerprint for change detection
  - ExternalId generator (FEAT-YYYY-NNN-DEL-### format)
  - Bridge client wrapper for VS Code extension API
affects: [06-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DWA-owned sections with HTML comment markers for safe coexistence"
    - "SHA-256 fingerprinting for multi-person conflict detection"
    - "Deterministic external ID generation for global deduplication"
    - "VS Code extension API wrapper pattern for provider discovery"

key-files:
  created:
    - src/linear/content-builder.js
    - src/linear/fingerprint.js
    - src/linear/external-id.js
    - src/linear/bridge-client.js
  modified: []

key-decisions:
  - "DWA section wrapped in <!-- DWA:BEGIN --> / <!-- DWA:END --> markers for human/machine coexistence"
  - "Sync hash computed on normalized content (consistent line endings, collapsed blank lines)"
  - "ExternalId format: FEAT-YYYY-NNN-DEL-### for global uniqueness"
  - "BridgeClient discovers providers via vscode.extensions.getExtension()"
  - "Grouped AC format (C/F/E/N sections) matches execution packet style"

patterns-established:
  - "Content normalization: LF line endings, trimmed whitespace, collapsed blank lines for stable hashing"
  - "Section extraction with markers: find BEGIN/END indexes, preserve content outside markers"
  - "Capability checking: validate required methods exist before operations"

# Metrics
duration: 2m 39s
completed: 2026-01-25
---

# Phase 6 Plan 03: DWA Linear Sync Infrastructure Summary

**Content builder renders DWA sections with BEGIN/END markers, SHA-256 fingerprints detect manual edits, external IDs provide global deduplication, and bridge client wraps VS Code extension API for provider-agnostic sync.**

## Performance

- **Duration:** 2 min 39 sec
- **Started:** 2026-01-25T06:43:56Z
- **Completed:** 2026-01-25T06:46:35Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Created content-builder.js that renders DWA-owned sections with BEGIN/END markers, grouped acceptance criteria (C/F/E/N), and sync hash metadata
- Created fingerprint.js that computes SHA-256 hashes of normalized content, extracts stored hashes, and detects manual edits
- Created external-id.js that generates globally unique FEAT-YYYY-NNN-DEL-### format IDs for Linear deduplication
- Created bridge-client.js that discovers and wraps Linear tracker provider via VS Code extension API

## Task Commits

Each task was committed atomically:

1. **Task 1: Create content-builder.js for DWA section generation** - `b995b54` (feat)
2. **Task 2: Create fingerprint.js for sync hash computation** - `4468e39` (feat)
3. **Task 3: Create external-id.js for externalId generation** - `4b39c04` (feat)
4. **Task 4: Create bridge-client.js for VS Code extension API wrapper** - `62d71c1` (feat)

**Plan metadata:** (to be committed after summary)

## Files Created/Modified

- `src/linear/content-builder.js` - Builds DWA sections with markers, formats grouped ACs, computes sync hash, extracts/updates sections
- `src/linear/fingerprint.js` - Computes SHA-256 hashes with normalization, extracts hashes, detects manual edits
- `src/linear/external-id.js` - Generates FEAT-YYYY-NNN-DEL-### format IDs, parses components, validates format
- `src/linear/bridge-client.js` - Discovers Linear tracker provider, validates API, wraps createIssue/updateIssue/queryByExternalId

## Decisions Made

**DWA section markers:**
- Use HTML comment style (`<!-- DWA:BEGIN -->` / `<!-- DWA:END -->`) for compatibility with Linear's markdown rendering
- Content outside markers is human-owned and never modified by DWA

**Content normalization for stable hashing:**
- Convert all line endings to LF (`\n`)
- Trim leading/trailing whitespace
- Collapse multiple blank lines to double newline
- Hash computed on normalized content ensures consistent fingerprints across platforms

**Grouped AC format:**
- Parse AC items by prefix (C/F/E/N) and render grouped sections
- Matches execution packet format for consistency
- Unprefixed items go to "Other" group

**Bridge client discovery:**
- Try multiple extension IDs (published and development mode)
- Validate required methods before accepting provider
- Fail with actionable error if provider missing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all modules loaded successfully. Bridge-client requires VS Code context (vscode module), which is expected and correct for its runtime environment.

## Next Phase Readiness

**Ready for 06-04 (sync command implementation):**
- Content builder can render full DWA sections with all deliverable fields
- Fingerprint can detect manual edits to prevent accidental overwrites
- External ID generator provides deterministic, globally unique IDs
- Bridge client provides abstract API wrapper for provider discovery

**Notes:**
- All modules are pure logic - no external dependencies added
- Bridge client will require linear-tracker-provider extension at runtime (cross-repo dependency)
- Sync command (06-04) will orchestrate these utilities for end-to-end sync

---
*Phase: 06-linear-integration*
*Completed: 2026-01-25*
