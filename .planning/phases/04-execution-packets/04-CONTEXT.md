# Phase 4: Execution Packets - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate bounded-context packets (markdown documents) that provide everything an AI assistant needs to implement one deliverable. Packets pull from registry, spec, and TDD. Two deliverables: `Dev Workflow: Start Deliverable` command generates packet shell, `/dwa:enrich-packet` skill adds implementation targets from codebase analysis.

</domain>

<decisions>
## Implementation Decisions

### Command vs Skill Division
- **Command (deterministic, complete, usable):**
  - Produces a fully runnable execution packet — never requires LLM to be useful
  - Fills all contract sections from known sources (registry, spec, TDD)
  - Can be fed to GSD immediately without enrichment
- **Skill (optional enrichment):**
  - Adds higher-value "smart" content from model judgment + repo analysis
  - Never rewrites contract (AC/QA/constraints) unless explicitly asked
  - Changes to contract go in a "Patch Proposal" section, not inline edits

### Command Generates (Deterministic Contract)
- Deliverable ID + links (spec, TDD, ticket)
- MUST/MUST NOT guardrails
- Goal paragraph (from deliverable description — no LLM needed)
- Acceptance criteria (verbatim, categorized)
- QA verification (verbatim from deliverable row)
- Dependencies (from registry)
- Provenance block
- Control block (stop-after-plan, required outputs)
- Drift section (from registry + freshness check)
- "Files likely touched" placeholder (basic, can be enriched)

### Skill Enriches (Non-Deterministic)
- Likely files/components from code search + patterns
- APIs to use/avoid
- Gotchas (Unity lifecycle, threading, serialization, playmode constraints)
- Test additions (where unit tests live, harness conventions)
- Quality improvements (suggest-only, not overwriting)
- AC coverage map and recommended tests/manual checks
- Patch Proposal section (if skill wants to change contract)

### Provenance Block
- Spec path + git SHA (or timestamp if not in git)
- TDD path + git SHA
- Registry revision
- Packet generator version

### Control Block
- Default: stop-after-plan — AI must produce plan and get approval before implementing
- Required outputs: plan, file list, tests, PR draft
- Packet size marker
- Staleness marker (if sources changed since generation)

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
- Always inline ACs in packet
- Group by type with prefixed IDs:
  - C# = Critical
  - F# = Functional
  - N# = Nice-to-have
  - E# = Edge cases
- Inline caps before externalization:
  - Critical (C#): max 10
  - Functional (F#): max 20
  - Edge (E#): max 15
  - Nice-to-have (N#): max 10
- If caps exceeded: include Critical ACs + AC Index inline, move rest to appendix
- Require AI to produce AC coverage map in response

### Size Budget
- Soft budget: 800–1,500 words (~1-3 pages)
- Hard backstop: 2,000 words / ~4,000 tokens
- If over budget: externalize long-tail content to appendix, keep execution contract inline
- Always inline (execution contract):
  - Control block
  - MUST/MUST NOT guardrails
  - Goal (≤1 short paragraph)
  - Critical ACs and minimal critical-path QA
  - Drift Since Last Packet (short)

### Storage Paths
- Packets: `.dwa/packets/DEL-###.md`
- Appendices: `.dwa/packets/appendices/DEL-###-appendix.md`
- History (optional): `.dwa/packets/history/DEL-###/<timestamp>.md`

### Drift Section Sourcing
- **On start (command):**
  - Pull open drift items from registry where: decision is pending, OR applies_to_next_work: true, OR kind is spec_mismatch/tdd_mismatch
  - Compute source freshness: "Spec changed since last packet" / "TDD changed since last packet"
  - Include carry-forward summary: "known divergence we're living with" vs "needs resolution"
- Start surfaces drift signals, does not invent drift
- Drift creation happens in Phase 5 (complete deliverable)

### Claude's Discretion
- Exact markdown formatting within structure guidelines
- History folder implementation (whether to version packets)
- Appendix file structure details

</decisions>

<specifics>
## Specific Ideas

- "Self-contained for execution, reference-based for traceability" — the packet is both implementation guide AND audit trail
- "Fence them in, then point them forward" — constraints before goal is deliberate
- "Automation first, AI second" — command produces complete packet, skill is optional enhancement
- "Skill must not mutate the contract silently" — changes go to Patch Proposal section

</specifics>

<deferred>
## Deferred Ideas

- Drift creation/capture — Phase 5 (Complete Deliverable command)
- Drift fix proposals — Phase 5 (/dwa:propose-drift-fix skill)

</deferred>

---

*Phase: 04-execution-packets*
*Context gathered: 2026-01-24*
