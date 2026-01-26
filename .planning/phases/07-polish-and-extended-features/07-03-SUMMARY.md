---
phase: 07-polish-extended
plan: 03
subsystem: google-docs
tags: [google-docs, import, markdown, bridge, idempotent, content-hashing, cli]

# Dependency graph
requires:
  - phase: 07-01
    provides: Bridge client, diagnostics system, content hashing, import reports
  - phase: 07-02
    provides: Google Docs JSON to mdast conversion, mdast to markdown stringification
provides:
  - Google Docs import command (--import-gdoc) with URL/ID parsing
  - Import orchestration: bridge access, conversion, file output, report generation
  - Idempotent reimport with content hash verification
  - Local edit detection with diff artifact generation
  - DWA provenance markers (SOURCE, IMPORT_BEGIN, IMPORT_END)
  - CLI integration with mutual exclusivity check
affects: [future-import-features, vscode-extension, gdocs-sync]

# Tech tracking
tech-stack:
  added: [write-file-atomic]
  patterns:
    - "Content hash-based idempotent reimport"
    - "DWA provenance markers for tracking imported content"
    - "Diff artifact generation for hash mismatches"
    - "Explicit output path resolution (--out required when no .dwa/)"
    - "Async IIFE pattern for CLI command handlers"

key-files:
  created:
    - src/google-docs/import.js
    - src/commands/import-gdoc.js
    - tests/google-docs/import.test.js
    - tests/commands/import-gdoc.test.js
    - tests/google-docs/import-e2e.test.js
  modified:
    - src/cli.js

key-decisions:
  - "CLI on hash mismatch: write diff artifact + exit with instructions (vs VS Code modal)"
  - "Default filename 'feature-spec.md' configurable via .dwa/config.json"
  - "Explicit output path: error when no .dwa/ and no --out (prevents ambiguity)"
  - "Trim markdown output before hashing for consistent hash verification"
  - "Use revisionId (preferred), etag, or modifiedTime for document change detection"

patterns-established:
  - "Import flow: initialize bridge → check availability → parse docId → read doc → convert → check hash → wrap → write → report"
  - "Mock bridge client pattern for testing import without actual Google Workspace access"
  - "Diff artifacts stored at .dwa/import-diffs/{docId}/{timestamp}.md"

# Metrics
duration: 10m 56s
completed: 2026-01-26
---

# Phase 07 Plan 03: Google Docs Import Command Summary

**CLI import command with idempotent reimport via SHA-256 content hashing, diff artifacts for local edits, and DWA provenance markers**

## Performance

- **Duration:** 10m 56s
- **Started:** 2026-01-26T03:31:58Z
- **Completed:** 2026-01-26T03:42:54Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Complete Google Docs import feature: `dwa --import-gdoc <url>` produces markdown with DWA markers
- Idempotent reimport: skips unchanged documents, detects local edits via content hash
- Diff artifact generation on hash mismatch with clear user instructions
- 28 tests across import orchestration, CLI command, and end-to-end flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create import orchestration module** - `fdaea84` (feat)
   - Import orchestration with bridge client integration
   - URL/ID parsing, marker wrapping, diff generation
   - Feature root discovery and explicit output path resolution

2. **Task 2: Create CLI command handler and integrate into CLI** - `f535509` (feat)
   - CLI wrapper with progress messages and diagnostics formatting
   - --import-gdoc and --out options added to src/cli.js
   - Mutual exclusivity check updated

3. **Task 3: End-to-end test and documentation** - `859018e` (test)
   - 17 e2e test cases covering full import flow
   - Bug fix: trim markdown output for consistent hashing
   - Documented import flow in test comments

## Files Created/Modified
- `src/google-docs/import.js` - Import orchestration: parseDocIdFromUrl, wrapWithMarkers, importGoogleDoc, generateImportDiff, findFeatureRoot
- `src/commands/import-gdoc.js` - CLI command handler with formatDiagnostics and importGdoc wrapper
- `src/cli.js` - Added --import-gdoc and --out options, mutual exclusivity check
- `tests/google-docs/import.test.js` - 11 test cases for import orchestration functions
- `tests/commands/import-gdoc.test.js` - 7 test cases for CLI command handler
- `tests/google-docs/import-e2e.test.js` - 17 test cases for full import flow (mock bridge client)

## Decisions Made

**1. CLI vs VS Code behavior for hash mismatch:**
- CLI: write diff artifact + exit non-zero with instructions
- VS Code (future): could show modal with choices (overwrite/preview/cancel)
- Rationale: CLI users need file-based diff for review; VS Code can leverage UI

**2. Explicit output path resolution:**
- If --out provided: use that path
- Else: find feature root (walk up for .dwa/)
- If no feature root: error requiring --out
- Rationale: Prevents ambiguous writes, forces intentional output location

**3. Trim markdown before hashing:**
- Bug discovered during e2e testing: markdown stringifier adds trailing newline
- Trimming both generated markdown and extracted content ensures consistent hashes
- Rationale: Prevents false hash mismatches from whitespace differences

**4. Document change detection strategy:**
- Prefer revisionId (most specific to document state)
- Fall back to etag (cache validation)
- Fall back to modifiedTime (timestamp)
- Rationale: Robust detection across different Google Docs API response patterns

## Deviations from Plan

None - plan executed exactly as written.

Note: The markdown trimming fix (Task 3) was necessary to achieve success criteria "Re-import of unchanged doc shows 'Already at latest revision'" - this was a bug fix to make planned behavior work correctly, not a deviation.

## Issues Encountered

**Hash mismatch on unchanged reimport:**
- **Problem:** Second import of unchanged document produced "Hash mismatch" error
- **Root cause:** `mdastToMarkdown` adds trailing newline; extracted content is trimmed but new markdown wasn't
- **Solution:** Added `.trim()` to markdown output before hashing (line 229 in import.js)
- **Verification:** All e2e idempotent reimport tests pass

## Next Phase Readiness

**Ready for:**
- Google Docs import feature complete and tested
- VS Code extension can build on CLI import command for UI-driven imports
- Future enhancements: bidirectional sync, conflict resolution UI, import history

**Dependencies delivered:**
- Import orchestration module ready for VS Code extension integration
- Diff artifact pattern established for other import sources (GitHub Gists, Notion, etc.)
- Content hashing pattern reusable for sync features

**No blockers.**

---
*Phase: 07-polish-extended*
*Completed: 2026-01-26*
