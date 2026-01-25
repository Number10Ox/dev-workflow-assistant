# Phase 4: Execution Packets - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate bounded-context packets (markdown documents) that provide everything an AI assistant needs to implement one deliverable. Packets pull from registry, spec, and TDD. Two deliverables: `Dev Workflow: Start Deliverable` command generates packet shell, `/dwa:enrich-packet` skill adds implementation targets from codebase analysis.

</domain>

<decisions>
## Implementation Decisions

### Content Verbosity
- Self-contained for execution — include everything needed to implement without opening other files
- Reference-based for traceability — point to source files (spec, TDD, registry) for audit trail
- Big, volatile, or source-of-truth content stays as references, not duplicated

### Format Structure
- Structured format: headings + bullets + checklists
- One short prose paragraph max for "Goal" section
- Requirements as explicit, testable lists
- Use checklists (`- [ ]`) for actionable items
- Use bullets for constraints, targets
- Numbered steps for QA verification
- Imperative language, avoid long narrative
- Mark critical rules as MUST/MUST NOT

### Section Ordering
- Constraints first — AI knows boundaries before doing anything
- Goal second — AI understands intent after boundaries set
- Testable contract third — ACs, QA, stop points

### Acceptance Criteria Handling
- Always inline ACs in packet, even if list is long
- Group by type with prefixed IDs:
  - C# = Critical
  - F# = Functional
  - N# = Nice-to-have
  - E# = Edge cases
- Only externalize when truly huge, but keep critical ACs inline even then
- Require AI to produce AC coverage map in response

### Claude's Discretion
- Exact markdown formatting within structure guidelines
- How to detect "truly huge" AC lists (threshold)
- Implementation of AC coverage map requirement (prompt instruction vs template section)

</decisions>

<specifics>
## Specific Ideas

- "Self-contained for execution, reference-based for traceability" — the packet is both implementation guide AND audit trail
- "Fence them in, then point them forward" — constraints before goal is deliberate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-execution-packets*
*Context gathered: 2026-01-24*
