# Phase 5: Drift Tracking - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture, record, and resolve divergence between planned work (spec/TDD/registry contract) and actual implementation outcomes. Phase 5 turns drift into first-class, durable records per deliverable, supports explicit drift decisions at completion time, and produces a rolling drift log for visibility.

Inputs include Phase 4 drift signals (freshness/structural/contract/execution-state warnings) and completion evidence (PR URL, commit SHA, test outcomes).

</domain>

<decisions>
## Implementation Decisions

### Source of Truth

- Drift is persisted in the deliverable registry (`.dwa/deliverables/DEL-###.json`) as an append-only event log
- The rolling drift log (`.dwa/drift-log.md`) is a derived artifact deterministically rebuilt from registry drift events (no manual edits)

### Drift Event Model (Registry)

Each deliverable registry file contains:
- `drift_events: []` (append-only)
- `drift_open_count` (derived or maintained)
- `last_completed_at`, `last_completed_commit`, `last_completed_pr_url` (optional convenience fields)

**drift_event fields (minimum):**
- `id` (e.g., D1, D2 or UUID)
- `at` (timestamp)
- `source` (complete_command | manual | skill)
- `kind` (enum; see below)
- `summary` (one paragraph max)
- `decision` (pending | accept | revert | escalate)
- `applies_to_next_work` (bool)
- `evidence_refs` (PR URL, commit SHA, test output link, screenshot link)
- `patch_proposals` (optional array of proposed edits; text or diff-style)
- `author` (user/tool)

### Drift Kinds (Phase 5)

Phase 5 records drift created by implementation outcomes, not pre-execution checks. Drift kinds include:

- `impl_deviation` (implementation differs from contract)
- `scope_change` (work added/removed vs planned deliverable)
- `qa_gap` (missing/changed verification, tests not added, manual QA required)
- `spec_update_needed` (contract should change to match reality)
- `tdd_update_needed` (guardrails/architecture plan needs update)
- `followup_required` (new deliverable/ticket needed)
- `rollback_required` (must revert or re-align code)

(Phase 4 "freshness/structural/contract/execution-state drift signals" may be referenced as evidence, but do not replace Phase 5 drift events.)

### Commands Delivered in Phase 5 (Deterministic)

**Dev Workflow: Complete Deliverable**
- Prompts for completion evidence: PR URL, commit SHA, test status (pass/fail), notes
- If Phase 4 flagged major drift (or contract changed), prompts user to choose a drift decision:
  - `accept` (update spec/TDD to match reality)
  - `revert` (bring implementation back to spec)
  - `escalate` (needs stakeholder decision)
  - `pending` (record now, decide later)
- Appends a `drift_event` when drift exists (or records no_drift outcome if configured)
- Updates runtime fields: status, pr_url, last_completed_at, etc.

**Dev Workflow: Rebuild Drift Log**
- Rebuilds `.dwa/drift-log.md` from all deliverables' `drift_events`
- Produces:
  - "Open Drift" summary at top (pending/escalate/applies_to_next_work)
  - Chronological log grouped by deliverable

### Skills Delivered in Phase 5 (LLM)

**/dwa:propose-drift-patches**
- Given the packet + completion notes (+ optional PR diff if available), proposes edits to:
  - canonical spec deliverable row (AC/QA/desc)
  - TDD guardrails/decisions
  - Linear issue description (optional, later)
- Outputs patch proposals only; never applies automatically

**/dwa:summarize-drift**
- Produces a human-readable summary for the drift log or PR comment

### Resolution Mechanics

- If `decision=accept`: next action is to apply patch proposals to spec/TDD (manual or via separate command later)
- If `decision=revert`: next action is a follow-up deliverable/ticket to realign code (record as followup_required)
- If `decision=escalate`: mark as open drift requiring stakeholder review; optionally generate a Linear ticket (Phase 6/7 integration)

### Claude's Discretion

- Exact drift_event schema names (snake_case vs camelCase)
- Whether drift_open_count is derived on rebuild or updated on each complete
- Formatting of `.dwa/drift-log.md` (sections, grouping)

</decisions>

<specifics>
## Specific Ideas

- Drift is created primarily at completion time, because that's when implementation reality is known
- Drift log is regenerated from registry to minimize merge conflicts and ensure correctness
- Patch proposals are reviewable artifacts; contract changes are never silently applied

</specifics>

<deferred>
## Deferred Ideas

- Automatic semantic drift detection from PR diffs (future)
- Auto-creating follow-up deliverables from drift decisions (future)
- Two-way Google Docs / Linear write-back automation (later phases)

</deferred>

---

*Phase: 05-drift-tracking*
*Context gathered: 2026-01-24*
