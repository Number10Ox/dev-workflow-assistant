# Phase 7: Polish and Extended Features - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Convenience features for workflow completion: Google Docs import (command) converts Google Doc specs to canonical markdown via MCP, and PR description generation (skill) produces narrative PR text from deliverable metadata.

</domain>

<decisions>
## Implementation Decisions

### Google Docs Import - Images

- Default: Placeholder marker + warning (not fatal)
- Placeholder format with HTML comment markers for stable idempotent parsing
- Download to repo assets (`_assets/dwa-images/`) when auth allows
- Optional `--strict-images` flag: fail if required images (tagged `[required]`) cannot be imported
- Link-out fallback: include link to source doc if download fails

### Google Docs Import - Tables

- Three-level approach based on complexity:
  - Level 0: Simple tables → GFM Markdown (no merged cells, one header row)
  - Level 1: Complex structures → HTML `<table>` (merged cells, multi-row headers)
  - Level 2: Simplify-only mode → flatten merged cells + warn (for "pure Markdown" preference)
- Default: `tables.mode = "html-fallback"` for maximum fidelity
- Deterministic output: stable column count, ordering, whitespace normalization, escape `|` in Markdown
- Inline formatting preserved when possible; bullets → `• item<br>` in Markdown tables

### Google Docs Import - Comments

- Default: Drop with summary (list of dropped comments in report)
- Config flags:
  - `--export-comments` → sidecar file with comments
  - `--include-comments-inline` → inline in markdown (discouraged)
  - `--fail-on-comments` → strict mode, rarely used

### Google Docs Import - Error Handling

- Default: Best-effort import + report (continue with warnings)
- Fatal only for:
  - Authentication/authorization failures (can't read doc at all)
  - Unparseable document structure (empty/corrupt)
- Missing deliverables table: warning only (Phase 3 parser validates "registry-ready")
- Three strictness levels: `lenient` (default), `normal`, `strict`
- Import report always generated: `.dwa/import-reports/<docId>-<timestamp>.json`

### Google Docs Import - Headings

- Preserve relative hierarchy from Google Docs
- Normalize absolute Markdown levels:
  - Doc Title → `#`
  - First heading level → `##`
  - Nested levels continue from there
- Clamp heading level jumps (H2→H4 becomes H2→H3)
- Cap at `######` with warning
- Optional `template-align` mode: recognize known section names, normalize to expected levels
- Default: `headings.mode = "preserve-relative"`

### Google Docs Import - Links

- External web links: preserve as-is
- Internal doc links (headings/bookmarks): preserve + warn, with optional deterministic rewrite to local anchors when mapping is confident
- Google Drive file links: preserve + optional metadata comment
- Broken links (missing URL): keep text, emit warning
- Modes: `preserve` (default), `preserve+rewrite-internal`, `strict`

### Google Docs Import - Output Location

- Default: Feature-root autodetect (walk up looking for `.dwa/`, `dwa.config.json`, or standard directories)
- `--out path/to/spec.md` override for explicit output
- Prompt only when ambiguous (multiple candidates)
- Provenance marker (`<!-- DWA:SOURCE ... -->`) prevents wrong overwrites
- Assets co-located with spec in `_assets/` subdirectory

### Google Docs Import - Re-import Behavior

- Bounded import region markers: `<!-- DWA:IMPORT_BEGIN -->` ... `<!-- DWA:IMPORT_END -->`
- Replace only imported region on reimport, leaving human edits outside intact
- Hash check (`dwa_import_hash`) for local edits inside imported region:
  - Match: safe to update
  - Mismatch: write preview + show diff + prompt (don't clobber)
- No automatic merges (MVP) — too complex, can add later
- Flags: `--force` (overwrite even if local edits), `--write-preview` (always side-by-side)

### Google Docs Import - Lists

- Bullets → `-` (consistent)
- Numbered → always `1.` (Markdown auto-numbers, reduces diff churn)
- Checklists → `- [ ]` / `- [x]`
- Nesting preserved with 2-space indent
- Clamp if nesting jumps > +1 level
- Mixed list types allowed, normalized markers
- AC labels (C1:, F1:) preserved as-is for DWA parser

### Google Docs Import - Code

- Inline code (monospace) → backticks, escape properly if content contains backticks
- Fenced code blocks: triple backticks (or longer fence if content contains backticks)
- Language tags: only when confident from Docs API metadata, otherwise omit
- Heuristic detection: opt-in (`code.detectHeuristics = false` default)
- Strip rich formatting inside code blocks with warning

### Google Docs Import - Dividers

- Convert to `---` (standard Markdown horizontal rule) by default
- Surround with blank lines for clean separation
- Configurable: `hr.mode = "preserve"` (default), `"drop"`, `"drop-with-warning"`

### Google Docs Import - Inline Formatting

- Bold → `**`
- Italic → `_` (not `*`, to reduce collision with lists)
- Strikethrough → `~~` (preserve always — semantic meaning in specs)
- Bold+italic nesting → `**_text_**`
- Drop: underline, font family, size, color
- Normalize whitespace inside delimiters, collapse redundant runs
- Modes: `markdown` (default), `minimal`, `markdown+html` (allows `<u>`)

### Claude's Discretion

The following areas were not discussed — Claude has flexibility during planning:

- **PR description structure:** What sections to include, depth of detail, whether to include drift history or QA notes
- **PR description tone:** Technical vs conversational, template-driven vs flexible
- **Import diagnostic code assignments:** Exact codes (DWA-GDOC-XXX-NNN) following the patterns discussed
- **Import report format details:** Exact JSON schema for import reports

</decisions>

<specifics>
## Specific Ideas

- "Placeholder IDs should be stable (deterministic from doc structure) so reimports don't churn"
- "Import should feel like pg_dump for Google Docs — predictable, automatable, CI-friendly"
- "Provenance markers preserve source tracking even after local edits"
- "Phase 7 importer stays narrow (conversion only); Phase 3 validation enforces 'registry-ready'"
- "No silent overwrites — hash mismatches always prompt"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-polish-and-extended-features*
*Context gathered: 2026-01-25*
