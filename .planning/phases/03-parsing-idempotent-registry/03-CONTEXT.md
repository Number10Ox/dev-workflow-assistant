# Phase 3: Parsing + Idempotent Registry - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract deliverables from feature spec markdown into JSON registry files (`.dwa/deliverables/DEL-###.json`). Support safe re-parsing after spec edits that preserves runtime fields (status, linear_id, pr_url). Parser validates spec against Template v2.0 schema before extraction.

</domain>

<decisions>
## Implementation Decisions

### Validation feedback
- Collect all errors before failing (not fail-fast) — user fixes everything in one pass
- Error format: diagnostic code + line number + message (e.g., "DWA-E001 Line 42: Missing 'Type' column")
- Errors reported in document order, not grouped by type
- Validation gates: structure AND content
  - Structure: YAML frontmatter exists, deliverables table found, required columns present
  - Content: IDs are unique, types are valid enum values, no empty required cells
- Fix suggestions are optional, never required — keep errors actionable but minimal

### Output behavior
- Report always generated: errors, warnings, and success summary
- On success: summary of deliverables parsed, any warnings, registry changes made
- On failure: all validation errors with diagnostic codes

### Re-parse behavior
- Registry updates are per-deliverable atomic (each DEL-###.json written independently)
- Orphaned deliverables (in registry but removed from spec) are soft-deleted by default
  - Moved to `.dwa/deliverables/_orphaned/` or flagged with `orphaned: true`
- Runtime fields preserved on re-parse: status, linear_id, pr_url, etc.

### Claude's Discretion
- Exact diagnostic code scheme (DWA-E### for errors, DWA-W### for warnings)
- Exact wording and formatting of messages
- Soft-delete implementation (separate folder vs flag)
- Warning thresholds and edge case handling

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for AST parsing and registry management.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-parsing-idempotent-registry*
*Context gathered: 2026-01-24*
