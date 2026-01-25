# Phase 7: Polish and Extended Features - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Convenience features for workflow completion: Google Docs import (command) converts Google Doc specs to canonical markdown via Google Docs API (implementation adapter TBD), and PR description generation (skill) produces narrative PR text from deliverable metadata.

</domain>

<decisions>
## Implementation Decisions

### Google Docs Import - Images

- Default: Placeholder marker + warning (not fatal)
- Placeholder format with HTML comment markers for stable idempotent parsing
- Stable IDs: derived from Google Docs element IDs when available, else stable traversal index
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
- Three strictness levels: `default` (best-effort), `normal`, `strict`
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

- Default: Feature-root autodetect (walk up looking for `.dwa/` or `.dwa/config.json`)
- `--out path/to/spec.md` override for explicit output
- Prompt only when ambiguous (multiple candidates)
- Assets co-located with spec in `_assets/` subdirectory

### Google Docs Import - Markers and Hashing

Unified marker strategy (mirrors Phase 6 sync block approach):

```md
<!-- DWA:SOURCE doc="gdoc" docId="..." -->
<!-- DWA:IMPORT_BEGIN docId="..." revisionId="..." importHash="sha256:..." -->
...imported content...
<!-- DWA:IMPORT_END -->
```

- Source marker lives **outside** import region (so humans can edit region without losing provenance)
- Import hash stored **inside** the begin marker attributes and in import report
- Hash check for local edits inside imported region:
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

### Google Docs Import - Footnotes

- Default: Preserve as Markdown footnotes
- Inline reference: `text[^fn1]`
- Definitions appended at end of imported region: `[^fn1]: Footnote content...`
- If footnote content contains rich formatting: simplify to plain text + links
- Warn only if a footnote cannot be extracted
- Config: `footnotes.mode = "preserve"` (default), `"drop-with-summary"`

### Google Docs Import - Page Breaks

- Default: Convert to horizontal rule with marker comment
  ```md
  <!-- DWA:PAGE_BREAK -->
  ---
  ```
- Config: `pageBreak.mode = "hr"` (default), `"drop"`, `"drop-with-summary"`

### Google Docs Import - Table of Contents

- Detect auto-generated TOC blocks → drop (Markdown viewers can generate TOC; plus TOC changes with headings)
- Emit info-level note: `DWA-GDOC-TOC-100 Dropped auto-generated table of contents`
- No config needed — always drop

### Google Docs Import - Equations / Math

- If Docs API exposes clean equation text: emit as inline `$...$` or block `$$...$$`
- Otherwise: placeholder + warning + link-out
  ```md
  <!-- DWA:EQUATION id="eq_002" status="unconverted" -->
  ```
- Config: `math.mode = "placeholder"` (default), `"latex"`, `"drop-with-warning"`

### Google Docs Import - Drawings / Diagrams

- Treat as images (reuse Images section logic):
  - If downloadable → save as asset (png) + embed
  - Else placeholder + warning
- Optionally link to the original Google Drawing

### Google Docs Import - Callouts / Info Boxes

- Normalize to Markdown blockquotes with tags:
  ```md
  > **Note:** ...
  > **Warning:** ...
  ```
- If callout type unknown: `> **Callout:** ...`
- Config: `callouts.mode = "blockquote"` (default), `"drop-style-keep-text"`

### Google Docs Import - Embedded Charts

- Treat as image (download if possible); else placeholder
- Add metadata comment if it's a Sheets-linked object:
  ```md
  <!-- DWA:EMBED type="chart" source="sheets" url="..." -->
  ```

### Google Docs Import - Smart Chips / @mentions

- Convert to plain text + link when possible:
  - Person: `@Name` (no link) or link if present
  - File: `[FileName](drive_url)`
  - Date: `2026-01-25` (normalize to ISO format)
- Warn only if a chip cannot be rendered sensibly

### Google Docs Import - Text Normalization

- Normalize line endings to `\n`
- Convert NBSP → space
- Typographic quotes: preserve as-is (no normalization)
- Keep text normalization summary in import report (not per-instance warnings)

### PR Description Generation - Safety Boundary

- **Read-only**: skill never modifies specs/registry automatically
- Output written to:
  - Clipboard / scratch buffer, OR
  - `.dwa/pr-descriptions/<deliverable_or_branch>.md`
- User explicitly copies or pastes to PR

### Claude's Discretion

The following areas were not discussed — Claude has flexibility during planning:

- **PR description structure:** What sections to include, depth of detail, whether to include drift history or QA notes
- **PR description tone:** Technical vs conversational, template-driven vs flexible
- **Import diagnostic code assignments:** Exact codes (DWA-GDOC-XXX-NNN) following the patterns discussed
- **Import report format details:** Exact JSON schema for import reports

</decisions>

<specifics>
## Specific Ideas

- "Stable IDs derived from Google Docs element IDs when available, else stable traversal index — so reimports don't churn"
- "Import should feel like pg_dump for Google Docs — predictable, automatable, CI-friendly"
- "Source marker lives outside import region so humans can edit without losing provenance"
- "Phase 7 importer stays narrow (conversion only); Phase 3 validation enforces 'registry-ready'"
- "No silent overwrites — hash mismatches always prompt"
- "Unified marker strategy mirrors Phase 6's sync block approach"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-polish-and-extended-features*
*Context gathered: 2026-01-25*
