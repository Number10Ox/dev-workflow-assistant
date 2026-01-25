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
- Error format: line number + message (e.g., "Line 42: Missing 'Type' column")
- Errors reported in document order, not grouped by type
- Validation gates: structure AND content
  - Structure: YAML frontmatter exists, deliverables table found, required columns present
  - Content: IDs are unique, types are valid enum values, no empty required cells

### Claude's Discretion
- Whether to include fix suggestions in error messages (may depend on error type)
- Exact wording and formatting of error messages
- How to handle edge cases not explicitly covered (malformed tables, missing columns, duplicate IDs)
- Re-parse behavior: how removed/renamed deliverables are flagged
- Output verbosity on successful parse

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
