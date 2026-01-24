---
phase: 01-bootstrap-and-installer
plan: 01
subsystem: cli-foundation
tags: [commander, npm, cli, paths, schema, utilities]
requires: []
provides:
  - npm-package-scaffold
  - cli-entry-point
  - cross-platform-paths
  - schema-versioning
affects:
  - 01-02-install-command
  - 01-03-upgrade-uninstall
  - all-future-phases
tech-stack:
  added:
    - commander@^12.0.0
    - fs-extra@^11.0.0
    - chalk@^4.1.2
    - ora@^5.4.1
    - semver@^7.0.0
    - write-file-atomic@^7.0.0
  patterns:
    - commonjs-module-system
    - cross-platform-path-resolution
    - atomic-json-writes-with-schema
key-files:
  created:
    - package.json
    - bin/dwa.js
    - src/cli.js
    - src/utils/paths.js
    - src/utils/schema.js
  modified: []
key-decisions:
  - id: use-commander-options
    decision: "Use Commander.js options (--install) instead of subcommands (dwa install)"
    rationale: "Simpler API for single-purpose tool with 3 operations"
  - id: use-commonjs
    decision: "Use CommonJS (type: commonjs) instead of ESM"
    rationale: "Commander and fs-extra use CJS; chalk v4 and ora v5 are last CJS versions"
  - id: use-schema-version
    decision: "Enforce schemaVersion in all JSON files via writeJsonWithSchema helper"
    rationale: "Supports REQ-011 for future upgrade compatibility and data migration"
duration: 4m 7s
completed: 2026-01-24
---

# Phase 1 Plan 01: CLI Foundation Summary

Commander.js CLI with cross-platform paths, schema versioning, and atomic JSON writes ready for install/upgrade/uninstall command implementations.

## Performance

**Duration:** 4 minutes 7 seconds
**Started:** 2026-01-24T18:17:56Z
**Completed:** 2026-01-24T18:22:03Z
**Tasks:** 3/3 (100%)
**Files:** 5 created, 0 modified

## Accomplishments

Built the npm package foundation for the DWA CLI:

1. **Package scaffold** - Created package.json with correct bin entry, CommonJS module type, Node.js 18+ requirement, and all dependencies (commander, fs-extra, chalk, ora, semver, write-file-atomic)

2. **CLI entry point** - Created bin/dwa.js with shebang and delegation to src/cli.js for minimal bin file pattern

3. **Commander.js program** - Built CLI skeleton with --install, --upgrade, --uninstall options, mutual exclusivity validation, and routing to command modules (not yet implemented)

4. **Cross-platform paths** - Created paths.js utility with getInstallDir(), getSkillsDir(), getVersionFilePath() using os.homedir() + path.join() exclusively

5. **Schema versioning** - Created schema.js with SCHEMA_VERSION constant (1.0.0) and writeJsonWithSchema() helper for atomic JSON writes with schema metadata

## Task Commits

| Task | Name | Commit | Description |
|------|------|--------|-------------|
| 1 | Create package.json and bin entry point | d01fbe6 | Package scaffold with dependencies and bin entry |
| 2 | Create shared utility modules | 5613a3e | paths.js and schema.js utilities |
| 3 | Create Commander.js CLI program skeleton | 06e88ba | CLI routing with mutual exclusivity |

## Files Created

**Core:**
- `package.json` - NPM package config with bin entry, dependencies, metadata
- `package-lock.json` - Dependency lock file
- `bin/dwa.js` - Executable CLI entry point with shebang
- `src/cli.js` - Commander.js program with option routing

**Utilities:**
- `src/utils/paths.js` - Cross-platform path resolution (getInstallDir, getSkillsDir, getVersionFilePath)
- `src/utils/schema.js` - Schema versioning (SCHEMA_VERSION, writeJsonWithSchema)

## Decisions Made

**1. Commander.js options vs subcommands**
- **Decision:** Use options (--install) instead of subcommands (dwa install)
- **Rationale:** Simpler API for single-purpose tool with only 3 operations
- **Impact:** CLI surface area is minimal and intuitive

**2. CommonJS module system**
- **Decision:** Use CommonJS (type: "commonjs") instead of ESM
- **Rationale:** Commander and fs-extra use CJS; chalk v4 and ora v5 are last CJS versions before ESM-only
- **Impact:** No async import() gymnastics needed; straightforward require() throughout
- **Alternative considered:** Dynamic import() for ESM-only packages - rejected for simplicity

**3. Schema versioning enforcement**
- **Decision:** All JSON writes must use writeJsonWithSchema() helper
- **Rationale:** Supports REQ-011 for future upgrade compatibility and data migration
- **Impact:** Every .dwa/ JSON file will have schemaVersion field automatically
- **Implementation:** write-file-atomic ensures no partial writes during crashes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully on first attempt.

## Next Phase Readiness

**Blockers:** None

**Ready for:**
- Plan 01-02: Install command implementation can now import paths and schema utilities
- Plan 01-03: Upgrade/uninstall commands can now import shared utilities

**Assumptions validated:**
- Commander.js v12 works with CommonJS
- chalk v4 and ora v5 provide CJS compatibility
- write-file-atomic provides atomic JSON writes for crash safety

**Technical debt:** None

**Dependencies provided:**
- Cross-platform path resolution for all future commands
- Schema versioning infrastructure for all JSON files
- CLI routing scaffold ready for command modules
