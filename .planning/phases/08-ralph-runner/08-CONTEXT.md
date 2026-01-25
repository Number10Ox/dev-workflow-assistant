# Phase 8: Ralph Runner — Deterministic Iterate-Until-Done (MVP Spec)

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a DWA "Ralph Runner" execution mode that iterates with Claude Code until a deliverable reaches an objective goal state: **verification commands pass + UI wiring audit passes + completion promise emitted**.

Primary target: **Web (React + Playwright)**.
Secondary target: **Unity (UIToolkit)** supported via compile/audit hooks (Unity Test Runner integration deferred).

This phase is intentionally **single-agent persistence**, not multi-agent orchestration.
</domain>

<decisions>
## Implementation Decisions

### Runner Mode

* New DWA command executes a deliverable in a loop:
  * Apply changes (Claude Code iteration)
  * Run verification contract
  * Repeat until success or stop conditions
* Stop conditions (hard):
  * `maxIterations` cap
  * stop if the **same failure signature** repeats `failRepeatLimit` times
* "Done" requires:
  1. all verify steps pass (exit 0)
  2. UI audit passes (web MVP)
  3. agent prints completion promise **exactly**
* Runner produces artifacts under `.dwa/runs/…` and never loops forever.

### Safety Defaults

* No automatic "dangerous permissions" escalation.
* Runner must never modify "human-owned" content outside DWA-owned/contracted targets.
* If a task requires manual action (credentials, environment), runner must surface a clear actionable message and stop.

### Artifacts

* Always write:
  * `.dwa/runs/<deliverable_id>/<run_id>/PROMPT.md`
  * `.dwa/runs/<deliverable_id>/<run_id>/verify_log.txt`
  * `.dwa/runs/<deliverable_id>/<run_id>/diff_summary.txt`
  * `.dwa/runs/<deliverable_id>/<run_id>/run_report.md`
* Optional (nice-to-have): update registry runtime fields with last run status/ID.

</decisions>

---

# Command Surface

## 1) `Dev Workflow: Run Deliverable (Ralph)`

Runs one deliverable until objective done.

**CLI (example):**

* `dwa run DEL-003 --mode ralph`
* Flags:
  * `--max-iterations 12` (default 12)
  * `--fail-repeat 3` (default 3)
  * `--dry-run` (generate prompt + contract, don't execute)
  * `--force` (only affects DWA-owned areas; never overrides human-owned)

## 2) `Dev Workflow: Verify Deliverable`

Runs verification contract only (no agent) and prints a report summary.

---

# Configuration

## `.dwa/config.json` additions (MVP)

```json
{
  "runner": {
    "mode": "ralph",
    "completionPromise": "<promise>READY_FOR_REVIEW</promise>",
    "maxIterations": 12,
    "failRepeatLimit": 3,
    "verify": {
      "web": {
        "commands": [
          { "name": "lint", "cmd": "npm run lint" },
          { "name": "unit", "cmd": "npm test" },
          { "name": "playwright", "cmd": "npx playwright test" },
          { "name": "ui-audit", "cmd": "node scripts/dwa-ui-audit-react.js" }
        ]
      },
      "unity": {
        "commands": [
          {
            "name": "compile",
            "cmd": "unity -batchmode -quit -projectPath . -logFile -executeMethod Dwa.Build.VerifyCompile"
          }
        ]
      }
    }
  }
}
```

Notes:

* The runner chooses `web` vs `unity` based on deliverable metadata or a CLI flag (MVP can be `--target web|unity`).
* Unity UI audit is deferred; this phase establishes the runner and plugs in compile/command hooks.

---

# Ralph Loop: Objective Done Contract

## Done Criteria

Runner finishes successfully only when:

1. Every configured verify command returns exit code **0**
2. UI audit command returns **0**
3. Claude output contains the exact completion promise token:
   * default: `<promise>READY_FOR_REVIEW</promise>`

## Stop Conditions

* Stop after `maxIterations`
* Stop early if failure repeats:
  * Compute a **failure signature** from:
    * failing step name + normalized first error line (or a stable hash of last 30 lines)
  * If the same signature repeats `failRepeatLimit` times consecutively → stop with `REPEAT_FAILURE_STOP`

## Status Codes (for reports)

* `SUCCESS`
* `VERIFY_FAILED`
* `REPEAT_FAILURE_STOP`
* `MAX_ITERATIONS`
* `AGENT_ERROR`

---

# Generated Prompt Template

Runner must generate `.dwa/runs/<deliverable_id>/<run_id>/PROMPT.md` with this structure:

1. **Goal**: implement deliverable `<deliverable_id>`
2. **Constraints & contract**: paste relevant packet content (constraints first)
3. **Verification Contract**: list verify commands in order
4. **Rules**:
   * Do not claim done until verify passes
   * Only emit completion promise when all verifications pass
   * Prefer minimal diff; do not touch out-of-scope files
   * If stuck, propose a plan for the next iteration and keep going
5. **Completion Promise** (exact token)

---

# Web UI Wiring Audit (React) — `scripts/dwa-ui-audit-react.js`

## Purpose

Catch "UI that looks implemented but does nothing" by failing CI-like checks **before** the runner can declare success.

This is intentionally heuristic and conservative: **minimize false negatives**, allow controlled opt-outs.

## Inputs

* Repository workspace root
* Default scan targets (configurable):
  * `src/**/*.tsx`, `src/**/*.jsx`
* Exclusions:
  * `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`

## Output

* Exit code `0` when no violations found
* Exit code `1` when violations exist
* Print violations as lines:
  * `path:line:col <CODE> <message>`

Example:

* `src/ui/Menu.tsx:42:9 DWA-UI-001 <button> missing onClick and not disabled`

## Allowlist / Ignore Mechanisms (MVP)

Support **two explicit opt-outs**:

1. Attribute opt-out on element:
   * `data-dwa-ignore="unwired"`
2. Comment opt-out on same line or previous line:
   * `// DWA:IGNORE_UI_WIRING`

These opt-outs should suppress only the audit rule violations, not the entire file.

## Rules (MVP)

### Rule DWA-UI-001: `<button>` requires handler or disabled

Flag a violation if a `<button>`:

* does **not** include `onClick={...}`
* and is not clearly disabled:
  * `disabled`
  * `aria-disabled="true"`
  * `disabled={true}`
* and is not ignored via allowlist

Allowed:

* `<button disabled>…`
* `<button onClick={handleFoo}>…`
* `<button data-dwa-ignore="unwired">…`

Violation:

* `<button>Play</button>`

### Rule DWA-UI-002: empty onClick handler is forbidden

Flag if `onClick` is present but empty/no-op:

* `onClick={() => {}}`
* `onClick={() => null}`
* `onClick={() => undefined}`
* `onClick={noop}` **only if** `noop` is imported from a known no-op util (optional; can skip in MVP)

### Rule DWA-UI-003: role="button" must be interactive

Flag if an element with `role="button"`:

* lacks `onClick`
* and lacks keyboard activation handler (`onKeyDown` or `onKeyUp`)
* and is not ignored

This prevents "div button" traps.

### Rule DWA-UI-004: "TODO wire" markers fail

Flag if a line contains:

* `TODO: wire`
* `DWA:WIRE_ME`
* `UNWIRED_BUTTON`

These markers are helpful during development but must be eliminated for "done."

## Recommended Implementation Approach

* Prefer using a parser (Babel/TypeScript AST) for correctness.
* MVP acceptable: regex-based scanning with conservative patterns if AST is too heavy.
* If regex-based:
  * ensure line/col are computed reliably (count characters)
  * keep patterns narrow to reduce false positives
  * provide allowlist markers to unblock legitimate cases

## Config Extensions (optional)

Allow `.dwa/config.json` to override:

* include globs
* exclude globs
* rule toggles

---

# Runner Reporting Templates

## `diff_summary.txt` (MVP)

Run:

* `git diff --stat` → write to file
* optionally also `git diff --name-only`

## `verify_log.txt` (MVP)

Append per iteration:

* iteration number
* each command executed
* exit code
* last N lines of output (recommend N=200)
* full output can be truncated; avoid multi-MB logs

## `run_report.md` (MVP Template)

```md
# DWA Run Report

- Deliverable: DEL-XXX
- Run ID: 2026-01-25T12-34-56Z_ab12cd
- Mode: ralph
- Target: web|unity
- Result: SUCCESS | VERIFY_FAILED | REPEAT_FAILURE_STOP | MAX_ITERATIONS | AGENT_ERROR
- Iterations: 7 / 12
- Completion Promise: <promise>READY_FOR_REVIEW</promise>

## Summary

- What changed (high level):
  - …
- Notes:
  - …

## Verification Results (final iteration)

| Step | Command | Result |
|------|---------|--------|
| lint | npm run lint | PASS |
| unit | npm test | PASS |
| playwright | npx playwright test | PASS |
| ui-audit | node scripts/dwa-ui-audit-react.js | PASS |

## Failure History (if not SUCCESS)

- Iteration 3: playwright failed (timeout on …)
- Iteration 4: ui-audit failed (DWA-UI-001 in …)
- …

## Diff Summary

```text
(paste git diff --stat here)
```

## Next Steps (if not SUCCESS)

1. …
2. …
3. …
```

---

# Acceptance Criteria

## Critical
- `dwa run <DEL> --mode ralph` loops until verify commands pass and completion promise is emitted, then stops.
- Stops on `maxIterations` and on repeated identical failure signatures.
- Writes all run artifacts under `.dwa/runs/<DEL>/<run_id>/…`.

## Functional
- Web UI audit catches at least:
  - `<button>` without `onClick` and not disabled
  - empty `onClick` handlers
- `dwa verify <DEL>` runs the same verify contract and reports pass/fail.

## Safety
- Runner never overwrites human-owned content outside DWA-owned regions/contracts.
- No automatic dangerous permission escalation.

---

# Deferred

- Unity UIToolkit audit tool (binder mapping + UXML parsing)
- Unity Test Runner (EditMode/PlayMode) integration
- Dual-model review loop (Claude ↔ ChatGPT)
- PR description generator consumes `run_report.md` automatically

</decisions>

---

*Phase: 08-ralph-runner*
*Context gathered: 2026-01-25*
