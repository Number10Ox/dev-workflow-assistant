---
phase: 07
plan: 04
subsystem: pr-description
tags: [pr-description, templates, handlebars, clipboard, metadata-extraction]

requires:
  - 05-drift (drift_events in registry)
  - 04-packets (template rendering patterns)

provides:
  - pr-description-generator (read-only PR text generation from deliverable metadata)
  - metadata-extraction (deliverable and drift data readers)
  - claude-code-skill (generate-pr-description)

affects:
  - future: PR workflow automation

tech-stack:
  added:
    - clipboardy (CLI clipboard access with VS Code fallback)
  patterns:
    - handlebars-templates (pr-description-v1.hbs)
    - read-only-operations (never modifies registry or spec)
    - multi-output-modes (clipboard/file/stdout)

key-files:
  created:
    - src/pr-description/metadata-extract.js
    - src/pr-description/generate.js
    - templates/pr-description-v1.hbs
    - skills/dwa-generate-pr-description/skill.md
    - tests/pr-description/metadata-extract.test.js
    - tests/pr-description/generate.test.js
  modified:
    - package.json (added clipboardy dependency)

decisions:
  - id: prefer-vscode-api-clipboard
    title: "Prefer VS Code API over clipboardy for clipboard access"
    rationale: "VS Code env.clipboard.writeText is more reliable when running in extension context"
    alternatives: ["clipboardy only", "custom clipboard per platform"]
    chosen: "VS Code API with clipboardy fallback"

  - id: preserve-grouped-ac
    title: "Preserve Phase 4 grouped acceptance criteria structure in PR descriptions"
    rationale: "Grouped AC (C/F/E/N) provides better organization than flat list"
    alternatives: ["flatten to simple list", "only support array format"]
    chosen: "Support both grouped and array formats with template conditionals"

  - id: read-only-skill
    title: "PR description generation is strictly read-only"
    rationale: "Safety boundary - PR descriptions should never modify source of truth"
    alternatives: ["allow auto-updating spec from PR", "bidirectional sync"]
    chosen: "Read-only from registry, output to clipboard/file only"

metrics:
  duration: 4m 56s
  completed: 2026-01-25
---

# Phase 07 Plan 04: PR Description Generation Summary

**One-liner:** Template-based PR description generator with drift summary, clipboard output, and grouped AC support using Handlebars.

## What Was Built

Built a read-only PR description generator that transforms deliverable metadata into narrative PR text. The generator uses Handlebars templates to render structured PR descriptions including user story, acceptance criteria (with Phase 4 grouped format support), and drift summaries. Output modes support clipboard (with VS Code API preference), file, and stdout.

**Key capabilities:**
- Extract deliverable metadata and drift summaries from registry
- Render PR descriptions using pr-description-v1.hbs template
- Support grouped acceptance criteria (C/F/E/N format) from Phase 4
- Clipboard output with VS Code API fallback to clipboardy
- File output with timestamped files in .dwa/pr-descriptions/
- Claude Code skill invocable as /dwa:generate-pr-description

## Implementation Details

### Metadata Extraction (Task 1)

**src/pr-description/metadata-extract.js:**
- `extractDeliverableMetadata(deliverableId, projectRoot)` - Loads deliverable from registry
- `extractAcceptanceCriteria(deliverable)` - Preserves grouped AC structure, falls back to array or string split
- `splitAcceptanceCriteria(acText)` - Legacy text splitting (semicolon, newline, <br>)
- `extractDriftSummary(deliverableId, projectRoot)` - Categorizes open vs accepted drift events

**Tests:** 20 tests covering all metadata extraction scenarios, grouped AC preservation, and drift event filtering.

### PR Description Generator (Task 2)

**templates/pr-description-v1.hbs:**
- Summary section with deliverable ID and Linear URL
- User story and description
- Acceptance criteria (conditional rendering for grouped vs array format)
- Drift summary (only when hasOpenDrift is true)
- Generated timestamp footer

**src/pr-description/generate.js:**
- `generatePRDescription(options)` - Main orchestrator
- `outputToClipboard(content, deliverableId, projectRoot)` - VS Code API first, clipboardy fallback, file fallback
- `outputToFile(content, deliverableId, projectRoot)` - Timestamped file creation

**Tests:** 9 tests covering template rendering, output modes, drift section conditional, and error handling.

### Claude Code Skill (Task 3)

**skills/dwa-generate-pr-description/skill.md:**
- 5-step process: parse args, verify deliverable, generate, report result, suggest next steps
- Output format examples with grouped AC structure
- Read-only safety boundary documentation
- Clipboard fallback strategy

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

All tests passing:
- metadata-extract.test.js: 20/20 ✓
- generate.test.js: 9/9 ✓
- Total: 29 tests, 0 failures

## Verification

**Template rendering:**
```bash
node --test tests/pr-description/generate.test.js
# All 9 tests pass
```

**Metadata extraction:**
```bash
node --test tests/pr-description/metadata-extract.test.js
# All 20 tests pass
```

**Skill structure:**
```bash
diff skills/dwa-generate-pr-description/skill.md skills/dwa-summarize-drift/skill.md | head -20
# Confirms consistent frontmatter and structure
```

## Dependencies Added

- **clipboardy** (^6.0.0) - CLI clipboard access with platform detection

## Next Phase Readiness

**Phase 7 Status:** 4/4 plans complete (100%)

**Blockers for Phase 8 (Ralph Runner):** None

**Artifacts delivered:**
- ✅ PR description generator with template
- ✅ Metadata extraction utilities
- ✅ Claude Code skill definition
- ✅ Comprehensive test coverage

**Integration points verified:**
- Reads from deliverable registry (Phase 3)
- Consumes drift_events (Phase 5)
- Uses Handlebars templates (Phase 4 pattern)

## Production Readiness

**Status:** Ready for use

**Usage:**
```bash
# Via Claude Code skill
/dwa:generate-pr-description DEL-001

# With explicit output mode
/dwa:generate-pr-description DEL-001 --output=file
```

**Notes:**
- Clipboard requires platform clipboard access (VS Code extension or terminal with clipboard)
- Headless environments automatically fall back to file output
- Generated PR descriptions are templates - user must fill in "Changes Made" section

## Lessons Learned

1. **Handlebars context paths:** `{{../property}}` navigation can be tricky; `{{#with}}` blocks simplify context management
2. **VS Code API availability:** Wrapping vscode require in try/catch allows graceful fallback to clipboardy
3. **Grouped AC structure:** Preserving Phase 4 grouped format provides better PR organization than flattening
4. **Read-only boundary:** Clear documentation of read-only nature prevents expectations of bidirectional sync

## Commits

- b7a08fe: feat(07-04): create metadata extraction utilities
- 48fe32f: feat(07-04): create PR description template and generator
- a98496b: feat(07-04): create Claude Code skill definition
