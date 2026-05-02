# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Deliverables parsed from a canonical feature spec drive all downstream work -- Linear tickets, GSD execution packets, PR descriptions, and drift checks flow from the registry, not from manual coordination.
**Current focus:** Phase 7.3 (VSCode-decoupling) in flight; first DWA dogfooding on Primordial Ascension

## Current Position

Phase: 7.3 of 9 (Deployment-Context Decoupling) — IN PROGRESS
Plan: process/plan-decouple-linear-from-vscode.md
Status: Steps 1-5 + 7 complete; smoke test passed end-to-end against real Linear; Step 6 (Primordial Ascension manual verification) being executed via PA's M1 bootstrap (see Active dogfood below)
Last activity: 2026-04-29 - D-1.1 (parse CLI wiring) complete

**Active dogfood:** PA M1 (process foundation) underway. Stages A, B, C complete. M1 deliverables tracked in Linear (`pa-m1-process-foundation`, HER-7 through HER-19). Phase 7.3 Step 6 (PA end-to-end verification) — DONE via PA D-1.4. Three DWA bugs surfaced and fixed during M1 so far: parser dropped inlineCode nodes; feature_id naming mismatch in external-id; sync hash inconsistency causing 100% false-positive re-sync conflicts. Next: Stage D — skills (D-1.8/9/10) + stop hook (D-1.11). Each Stage D skill requires its own sub-plan before build per skill-prerequisite gate.

**Phase 7.3 origin (friction-driven, not roadmap-driven):**
- Jon's workflow shifted to Claude Code terminal/desktop; original VSCode-bridge architecture blocked dogfooding DWA on the Primordial Ascension contract project.
- Discovered while attempting to use DWA on PA: Linear bridge required `vscode` module at top of `src/linear/bridge-client.js`. Rebuilt as `IssueTrackerFactory` with auto-selecting bridge OR direct backend.
- Smoke test against real Linear surfaced a deeper bug: Phase 6's externalId design was wrong (Linear `Issue` has no externalId field). Fixed in DirectLinearTracker via Attachments. Bridge has same bug; cross-repo follow-up.

**Last sync activity (2026-04-29):**
- 509/509 tests passing
- Smoke test created Linear issue HER-6 in "Agentic Feature Development Workflow" project; round-trip dedup via attachments confirmed
- HER-6 is test detritus; safe for Jon to delete

Progress: [███████████████████] 90.0% (27 of 30 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 27
- Average duration: 3m 42s
- Total execution time: 1.67 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 - Bootstrap | 3 | 17m 30s | 5m 50s |
| 02 - Templates | 4 | 8m 9s | 2m 2s |
| 03 - Parsing | 2 | 6m 19s | 3m 10s |
| 04 - Packets | 2 | 8m 0s | 4m 0s |
| 05 - Drift | 4 | 15m 14s | 3m 49s |
| 06 - Linear Integration | 3 | 10m 1s | 3m 20s |
| 07 - Polish & Extended | 8 | 48m 50s | 6m 6s |
| 07.1 - Installation Simplification | 1 | 5m 6s | 5m 6s |

**Recent Trend:**
- Last 5 plans: BRIDGE-01 (7m 6s), 07-01 (6m 53s), 07-02 (11m 48s), 07-03 (10m 56s), 07.1-01 (5m 6s)
- Phase 07.1: Installation simplification complete (setup wizard + graceful degradation)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8-phase linear dependency chain derived from requirements. Each phase delivers one coherent capability.
- [Roadmap]: REQ-011 (schema versioning) grouped with Phase 1 installer since versioning must exist before any JSON files are created.
- [Roadmap]: REQ-010 (template validation) grouped with Phase 3 parsing since validation is a prerequisite gate for the parser.
- [01-01]: Use Commander.js options (--install) instead of subcommands for simpler API.
- [01-01]: Use CommonJS module system for compatibility with commander and fs-extra.
- [01-01]: Enforce schemaVersion in all JSON files via writeJsonWithSchema helper (supports REQ-011).
- [01-02]: Use DWA_TEST_HOME environment variable for test isolation instead of mocking.
- [01-02]: Use node:test built-in test runner instead of Jest for zero test dependencies.
- [01-02]: Create placeholder .gitkeep files for empty source directories to track in git.
- [01-03]: Use semver library for version comparison to properly handle semantic versioning.
- [01-03]: Create timestamped backups before upgrade with preserved file timestamps.
- [01-03]: Only remove dwa-* prefixed skill directories for uninstall safety.
- [01-03]: Use node:test built-in test runner (corrected from Jest by orchestrator for consistency).
- [02-01]: Use Handlebars for template rendering with placeholder leakage detection.
- [02-01]: Generate feature_id in FEAT-YYYY-NNN format with random 3-digit sequence.
- [02-01]: Check both .dwa/feature.json AND feature-spec.md for existing feature detection.
- [02-01]: Template path resolution uses package source (../../templates) not installed location for scaffolding.
- [02-02]: Claude Code skill uses 4-step process: check existing, get title, scaffold, confirm.
- [02-02]: [DWA_INSTALL_PATH] placeholder resolved by Claude at runtime to actual package location.
- [02-02]: Tests use temp directory isolation via fs.mkdtemp, no DWA_TEST_HOME needed for scaffold tests.
- [02-03]: Skill uses 5-step process (vs 4-step for create-spec) adding prerequisite check for spec existence.
- [02-03]: Prerequisite validation requires both feature-spec.md AND .dwa/feature.json.
- [02-03]: TDD overwrite check looks at both feature.json tdd_path and docs/tdds/ directory.
- [02-04]: TDD files stored in docs/tdds/ (not .dwa/) as they are technical documentation.
- [02-04]: Use gray-matter for YAML frontmatter parsing and updating.
- [02-04]: Bidirectional linking: both spec and TDD reference each other via tdd_path.
- [02-04]: TDD filename slugification: lowercase, hyphens, remove special chars.
- [03-01]: Use `.default` for ES module imports (remark-parse, remark-gfm) in CommonJS context.
- [03-01]: Find Deliverables Table by column header ("Deliverable ID") not by heading hierarchy.
- [03-01]: Required columns: Deliverable ID, User Story, Description, Acceptance Criteria (testable), QA Plan Notes.
- [03-01]: Row numbering in errors uses index +2 (header row + 0-index offset).
- [03-02]: Normalize table column names to snake_case in registry JSON (e.g., "Acceptance Criteria (testable)" -> acceptance_criteria).
- [03-02]: Use fast-deep-equal for change detection - skip writes when content unchanged.
- [03-02]: Runtime fields preserved on re-parse: status, linear_id, linear_url, pr_url, completed_at, created_at.
- [03-02]: Orphan flagging adds orphaned: true and orphaned_at timestamp, does not delete files.
- [03-02]: Un-orphan removes flags when deliverable reappears in spec.
- [04-01]: Use remark AST parsing for guardrails extraction (same as spec parsing).
- [04-01]: Categorize ACs by prefix: C#=Critical, F#=Functional, N#=Nice-to-have, E#=Edge.
- [04-01]: Size limits: 1500 word soft limit (warn), 2000 word hard limit (split to appendix).
- [04-01]: Already-started detection returns existingPath without regenerating.
- [04-01]: Drift filtering: pending decision OR applies_to_next_work: true.
- [04-02]: Enrichment appends after existing content with ENRICHMENT (LLM-Generated) header.
- [04-02]: Contract mutation forbidden in sections 0-8; changes go to Patch Proposal only.
- [04-02]: AC Coverage Map suggests test type per AC (unit/integration/manual).
- [04-02]: Appendix template handles Nice-to-have and Edge AC overflow.
- [05-01]: Use crypto.randomUUID() (Node built-in) instead of uuid package for zero additional dependencies.
- [05-01]: AC count comparison uses semicolon, newline, and <br> as delimiters to handle various formats.
- [05-01]: drift_open_count is derived (computed from events) not stored separately.
- [05-01]: Structural comparison priority: removed > AC count > no PR URL > description.
- [05-02]: Drift only recorded when both detected AND decision provided - allows caller to prompt user.
- [05-02]: evidence_refs stored as array containing prUrl and commitSha.
- [05-02]: Notes stored as author_notes field in drift events.
- [05-03]: Drift log is a derived artifact - always rebuilt from registry drift_events, never manually edited.
- [05-03]: Open drift (pending + escalate) shown prominently at top of drift log.
- [05-03]: By-deliverable section uses chronological order (oldest first) within each group for narrative flow.
- [05-04]: propose-drift-patches reads from registry drift_events, not drift-log.md.
- [05-04]: summarize-drift adapts tone for technical (PR) vs stakeholder (PM) audiences.
- [05-04]: Patch proposals are reviewable text, never auto-applied.
- [05-gap]: fetchDriftData reads from drift_events (not drift) and maps summary to description for packet consumption.
- [06-01]: Use IssueCreateInput interface instead of positional parameters for createIssue().
- [06-01]: Use IssueFilter interface instead of string status parameter for listIssues().
- [06-01]: Add queryByExternalId as required method in IssueTracker interface.
- [06-01]: Set BRIDGE_API_VERSION to 2.0.0 to indicate breaking interface changes.
- [06-01]: Use provider-agnostic 'container' field instead of 'projectId' for portability across Linear/JIRA/GitHub.
- [06-02]: Use type assertions (as any) for externalId/projectId when Linear SDK types are incomplete but GraphQL API supports fields.
- [06-02]: Wrap all API methods with exponential backoff for comprehensive rate limit handling.
- [07-04]: Prefer VS Code API over clipboardy for clipboard access (more reliable in extension context).
- [07-04]: Preserve Phase 4 grouped acceptance criteria structure (C/F/E/N) in PR descriptions.
- [07-04]: PR description generation is strictly read-only (never modifies registry or spec).
- [06-02]: Return null from queryByExternalId when no matching issue found (not throw error).
- [06-05]: Use async IIFE pattern to isolate async handling to sync-linear block only (no need to restructure entire CLI).
- [06-05]: Include syncLinear in mutual exclusivity check (not sub-options like --dry-run, --force).
- [06-05]: Commander.js camelCase conversion: --sync-linear becomes opts.syncLinear.
- [BRIDGE-01]: Use VS Code SecretStorage for Google Workspace credentials (not MCP path dependency).
- [BRIDGE-01]: Expose auth/docs/drive namespaces on provider API for clear separation of concerns.
- [BRIDGE-01]: Return etag, modifiedTime, revisionId from Docs API for robust change detection.
- [BRIDGE-01]: Name package gworkspace-provider (not gdocs-provider) for future Sheets/Calendar support.
- [BRIDGE-01]: Rename private field to authManager to avoid shadowing public auth namespace (bug fix).
- [07-01]: Use capability handshake (not method checks) for provider compatibility validation.
- [07-01]: Inject vscode module in constructor for testability in Node.js without extension host.
- [07-01]: SHA-256 for content hashing (deterministic, collision-resistant, industry standard).
- [07-01]: Four diagnostic severity levels: info (100), warning (200), error (300), fatal (400).
- [07-01]: Import reports written to .dwa/import-reports/ with docId and timestamp in filename.
- [07-02]: List detection via paragraph.bullet field (not namedStyleType) per Google Docs API v1 structure.
- [07-02]: Table complexity: simple (no spans) -> GFM, complex (merged cells) -> HTML with DWA-GDOC-202.
- [07-02]: Nested formatting order: strikethrough -> italic -> bold (innermost to outermost).
- [07-02]: Empty paragraphs (only whitespace/newline) skipped to prevent excessive blank lines.
- [07-02]: Footnotes collected during conversion and appended at document end (markdown reference-style).
- [07-03]: CLI hash mismatch behavior: write diff artifact + exit with instructions (vs VS Code modal).
- [07-03]: Explicit output path resolution: error when no .dwa/ and no --out (prevents ambiguity).
- [07-03]: Trim markdown output before hashing for consistent hash verification.
- [07-03]: Document change detection: prefer revisionId, fall back to etag, then modifiedTime.
- [07.1-01]: Use enquirer for interactive prompts (established pattern for wizard UIs).
- [07.1-01]: Feature detection via VS Code extension checks (graceful in CLI context).
- [07.1-01]: Separate --setup and --status from core operations (clear separation of concerns).
- [07.1-01]: Automatic extension installation via code CLI when available.

### Pending Todos

- **Step 6: PA verification** — `npx dwa --sync-linear --project primordial-ascension-ba94fe04fb4e` against a real spec in `~/workspace/ContractProjects/PrimordialAscension`. Jon completed setup steps 1-4 (npm install, dwa --install, dwa --setup linear --mode=direct) on 2026-04-29. Remaining: create canonical spec, parse, sync, confirm issue + attachment.
- **Bridge LinearTracker fix** — `~/workspace/JobPrep/DevEx/devex-service-bridge/packages/linear-provider/src/linearTracker.ts` has the same `externalId on IssueCreateInput` bug. DWA's direct-tracker is the reference implementation. Cross-repo deliverable, not in DWA scope. See memory note `bridge_linear_tracker_bug.md`.
- **HER-6 cleanup** — smoke test detritus in heroiclogic Linear workspace (Agentic Feature Development Workflow project). Safe to delete from UI.
- **Possible Phase 7.4** — same VSCode-decoupling treatment for Google Docs import (`src/google-docs/bridge-client.js`) and PR description generation (`src/pr-description/generate.js`). Not pressing until those features actually block PA work.
- **2026-04-29 (M1 dogfood) — framing audit:** Phase 7.3's framing was "decouple from VSCode," but the parse/scaffold gaps that surfaced post-7.3 turned out to be CLI-wiring gaps, not coupling gaps. Implementation modules (`src/commands/parse.js`, `src/scaffolding/scaffold.js`) and their deps had zero `vscode` imports. Future audit habit: before scoping a "decouple X from VSCode" deliverable, grep `X` and its deps for `require('vscode')`. Misframed scope risks over-engineering; correct framing kept D-1.1/D-1.2 small.
- **D-1.1 complete (PA M1):** `npx dwa --parse [path]` wired into CLI (mirrors `--sync-linear` shape). 509 tests pass. Smoke verified from non-VSCode terminal: success, idempotent re-parse (`0 created, 0 updated, 1 unchanged`), explicit-path arg, missing-file actionable error. Plan: `process/plan-d-1-1-wire-parse-cli.md`.
- **D-1.2 complete (PA M1):** `npx dwa --scaffold <title>` wired into CLI with `--force` overwrite protection (uses existing `checkExisting` helper; OR-semantics catches partial-init). `--force` description broadened to "Overwrite existing artifacts (scope depends on operation)". 509 tests pass. Smoke verified across 5 cases including explicit unchanged-file hash checks (refuse path) and content/hash-changed checks (force path). Composition smoke: `--scaffold` then `--parse` against the freshly-scaffolded spec returns exit 0 with `Parsed 0 deliverable(s)` — template ships with empty placeholder rows. Plan: `process/plan-d-1-2-wire-scaffold-cli.md`.
- **Minor UX observation (not in M1 scope):** `--parse` returns exit 0 with `Parsed 0 deliverable(s)` for a freshly-scaffolded spec. Technically correct (no validation errors), but quiet for a user who just ran `--scaffold` and is wondering why nothing happened. Future polish: consider a non-fatal warning when parse extracts zero deliverables.
- **Stage B complete (PA M1):** D-1.5 `process/source-docs.md` (six Doc IDs + MCP-gdrive workaround + self-flag for Phase 7.4 obsolescence), D-1.6 minimal `.claude/CLAUDE.md` (paths only, no process gates), D-1.7 `Docs/` skeletons (`Now.md`, `Decisions.md`, `CampaignPillars.md`, `Glossary.md`). All four scaffolds in place; populated where structure is durable, marked `*To be filled*` where designer input is required.
- **2026-04-30 (M1 dogfood) — parser bug fixed:** `extractCellText` in `src/parser/validate.js:93` only captured `text` AST nodes during traversal, silently dropping `inlineCode` nodes. Effect: every backtick-wrapped reference in a hand-authored spec table was stripped from the registry (e.g., "Wire `--parse` into `src/cli.js`" became "Wire  into ."). Pre-existing bug; surfaced when D-1.3 hand-authored the first real spec with code references via the new CLI parse path. Fix: also capture `inlineCode` nodes, wrapping value in backticks so Linear renders the markdown. 509 tests still pass (no test had asserted on the stripping behavior — confirms it was unintentional). PA M1 spec re-parsed: 12 deliverables updated to preserve code refs, 1 unchanged.
- **D-1.3 complete (PA M1):** M1 `feature-spec.md` hand-authored with all 13 deliverables. `dwa --parse` extracts 13 deliverables; idempotent re-parse gives `0 created, 0 updated, 13 unchanged`. Registry at `.dwa/deliverables/DEL-001.json` through `DEL-013.json`. Format friction surfaced (above) was fixed in-line as the M1 plan's risk acknowledgment had pre-authorized.
- **2026-04-30 (M1 dogfood) — feature_id naming mismatch fixed:** `external-id.js:19` checked `feature.id`, but `scaffold.js` writes `feature.feature_id` to `feature.json`. Phase 7.3's smoke used a synthetic `{id: ...}` object directly so this never surfaced end-to-end. First real `--sync-linear` from the production load path failed all 13 deliverables with "Feature ID is required to generate external ID." Fix: made `generateExternalId` accept either `feature.id` or `feature.feature_id` defensively. JSDoc updated to document both. 509 tests still pass.
- **2026-04-30 (M1 dogfood) — sync hash inconsistency fixed:** Three places computed the sync hash, and the embedded hash didn't match the storage/recheck hash. `buildDwaSection` (`content-builder.js:132`) computed embedded `H` over `parts.join('\n').trim()` (no markers, no hash line). `sync.js:154` and `fingerprint.js:67` computed over `dwaContent.replace(/<hash line>/).trim()` (with markers, no hash line). Result: every idempotent re-sync hit a 100% false-positive "DWA section was manually edited" conflict — non-destructive but functionally broken. Fix: `buildDwaSection` now inserts a placeholder hash line, builds the full marker-wrapped content, computes the hash over `replace(/<hash line>/).trim()` (matching the other two places), then substitutes. All three hash computations now use the same shape. 509 tests still pass. Verified end-to-end: force-sync after clearing stale registry hashes pushed 13 updates with consistent-shape embedded hashes; subsequent re-sync without `--force` reports `0 created, 0 updated, 13 unchanged` cleanly.
- **2026-04-30 (M1 dogfood) — minor friction observation (not blocking):** Linear issue titles are derived from `deliverable.description || deliverable.user_story || deliverable.id` (`sync.js:131`), which produces ugly truncated kebab-cased URLs (e.g. `wire-parse-path-into-srcclijs-investigation-parse-module-is-already`). Future polish: deliverables should have an explicit short `title` field for issue-title use, or sync should derive a cleaner title from a leading sentence/the user_story phrase before "so that".
- **2026-04-30 (M1 dogfood) — minor friction observation (not blocking):** No slug→UUID resolution exists for `--project` arg. Handoff claimed "the script kebab-name-resolves it to the UUID" — that resolution doesn't exist; only literal UUIDs work. Workaround for now: pass UUID directly. Future polish: accept slug or URL form and resolve via Linear SDK.
- **D-1.4 complete (PA M1):** First Linear sync working end-to-end. 13 issues in `pa-m1-process-foundation` (HER-7 through HER-19) with externalIds `FEAT-2026-112-DEL-001` through `FEAT-2026-112-DEL-013`. Idempotent re-sync verified: `0 created, 0 updated, 13 unchanged`. Two DWA bugs surfaced and fixed during this deliverable (feature_id mismatch, sync hash inconsistency); both noted above. Phase 7.3's Step 6 (PA verification) is now genuinely complete.
- **2026-04-30 (PA M1) — Claude Code platform behavior (not DWA):** Project-local skills (`<project>/.claude/skills/<name>/SKILL.md`) are not picked up dynamically during a running Claude Code session. The available-skills list is set at session start and not refreshed when new skill files are written. Implication: any project-local skill must be smoke-tested in a session that started *after* the skill file was created. Verified during D-1.8 (PA `/pa-session-start`): skill file written with verified frontmatter, but `Skill({skill: "pa-session-start"})` returned `Unknown skill`. Manual execution of the skill body's instructions confirmed the logic is correct; live Skill-tool verification deferred to next session. Workflow implication for PA: each Stage D skill (D-1.8/9/10) gets logic-verified at write time; live invocation verification batches at end of Stage D after a single session restart.
- **D-1.8 (PA M1) — implementation complete, live verification deferred:** `/pa-session-start` skill at `.claude/skills/pa-session-start/SKILL.md`. Frontmatter verified against DWA's `dwa-create-spec`/`dwa-draft-tdd` templates. Logic manually executed and verified: Now.md active-plan extraction (`process/plan-m1-bootstrap.md`), Decisions tail (80 lines), mode marker (absent → "no mode active"). Output structure matches AC 7 of `process/plan-pa-session-start.md`. Live invocation deferred per platform behavior above. Conventions extracted to `process/conventions.md` (single source of truth for state-file formats, Now.md format, Decisions.md format) — read by D-1.8, will be read by D-1.9 / D-1.10.
- **D-1.9 (PA M1) — implementation complete, live verification deferred:** `/pa-design-mode` skill at `.claude/skills/pa-design-mode/SKILL.md`. Mode-write semantics, output conventions, and rule reminders all sourced from `process/conventions.md` (the latter sourced into the plan from CGDW design-mode workflow, adapted for PA's documentation-project layers). Manual logic verification: state mutations exercised directly (mode = `design`, work file removed); SKILL.md body static-reviewed for AC 4 success-line emission and AC 5 rule-reminder emission. Live invocation deferred per platform behavior. Plan: `process/plan-pa-design-mode.md`.
- **D-1.10 (PA M1) — implementation complete, live verification deferred:** `/pa-execution-mode <work-name>` skill at `.claude/skills/pa-execution-mode/SKILL.md`. Three-stage validation: slug regex (`^[a-z0-9][a-z0-9-]*$`) → file exists (`test -f`) → file non-empty (`test -s` AND `grep -q '[^[:space:]]'` to catch zero-byte and whitespace-only files). All 5 manual logic cases pass: bad slug refused, plan missing refused, plan present-and-non-empty succeeds and writes state, zero-byte refused (test -s), whitespace-only refused (grep — the genuinely new check). Conventions-locked refusal text and success-line format. Live invocation deferred per platform behavior. Plan: `process/plan-pa-execution-mode.md`.
- **Stage D batched verification gate** added to PA's M1 plan: 7-item checklist runs at end-of-Stage-D session restart before D-1.8/9/10 are marked fully done. Covers skill discovery, all three skill invocations, refusal paths for execution mode (bad slug + missing plan), and a final session-start to confirm state-marker round-trip.
- **2026-04-30 (PA M1) — terminology friction:** M1 plan called D-1.11 the "stop hook," conflating with Claude Code's actual `Stop` hook (which fires per-turn). Correct hook for session-end behavior is `SessionEnd`. Reframed and verified via Claude Code docs. Worth a future-readers note: hook taxonomy in Claude Code has at least `Stop` (per-turn) and `SessionEnd` (actual session end); they're not interchangeable.
- **D-1.11 (PA M1) — implementation complete, live verification deferred:** SessionEnd cleanup hook at `.claude/hooks/session-cleanup.sh` + `.claude/settings.json` configured. Hook is best-effort (no `set -e`); skips on `reason` = clear/resume; updates `Docs/Now.md` `**Updated:**` line; conditionally appends `.claude/state/decision-pending` to `Docs/Decisions.md`; clears `.claude/state/work` and `.claude/state/mode`; prints summary to stderr. macOS-only with `uname` guard. 3 manual logic cases pass: skip, full cleanup no pending, full cleanup with pending (test decision appended cleanly with blank-line separator). Live verification batches with Stage D session-restart gate. Plan: `process/plan-pa-stop-hook.md`.
- **2026-04-30 (PA M1) — workflow gap addressed via D-1.11.5:** Manual red-teaming during D-1.11 plan review surfaced 12 distinct fixes that should have been caught by an in-house plan-review skill. ContextDrift's `/plan` skill (`~/workspace/ContextDrift/.claude/skills/plan/`) has the full pattern: parallel red team + hold-out reviewer agents, structured D1–D6 checks, mandatory sections gate. Adapted for PA: dropped game-specific bits (engine purity, immutability, "behavioral specs in player terms", deterministic scoring), replaced "Design Spec" with "Parent Plan" (PA's plans implement portions of milestone bootstrap plans), generalized "predecessor pattern transfer" check to "cross-repo pattern transfer" (DWA, CGDW, etc.). Skill + checklist installed at `.claude/skills/plan/`. Will be live-verified at end-of-Stage-D session restart and used for D-1.12 / D-1.13 + all M2+ plans.
- **2026-05-01 (PA M1) — SessionEnd hook stderr not visible in Claude Code UI.** Surfaced during HER-18 live verification at end of Stage D. Hook ran successfully (`Docs/Now.md` `**Updated:**` line bumped 2026-04-30 → 2026-05-01; state files cleared) — Now.md timestamp confirms the hook fired. But the stderr summary (`PA session-cleanup: ...`) that the hook prints per `process/plan-pa-stop-hook.md` AC was not visible to the user on session-end. Three possible mitigations (not yet evaluated): (a) relax the AC — Now.md timestamp + state cleanup are themselves visible-enough proof that the hook ran; (b) change the sink — append a one-line log to a file that `/pa-session-start` reads and surfaces on the next session; (c) hook event change — investigate whether `SessionStart` could emit "previous session ended at X" instead. Severity: medium — hook works, contract is intact, but the visibility AC is currently unmet. Disposition pending PA D-1.12 triage. (Reference: PA `process/plan-pa-stop-hook.md` AC; PA M1 plan HER-18 quality gate; observed by Jon 2026-05-01 post-/exit.)
- **2026-05-01 (PA M1) — `/plan` skill hold-out reviewer was rubric-disguised-as-no-rubric; consumer-purpose framing now installed.** Surfaced during D-1.12 plan iteration. PA's `/plan` skill ran two parallel review agents (red team + hold-out) per its spec. Red team correctly caught conformance issues. Hold-out was supposed to be holistic ("no checklist") but its skill spec immediately enumerated six rubric-shaped categories (internal contradictions, rationale mismatches, incomplete specs, gaps in coverage, unnecessary complexity, pre-existing behavior interaction) — which made it a second conformance pass with different shape, not a genuinely different review. External Claude review (browser session) caught 11 lifecycle/purpose findings the in-skill agents missed across two passes: signal density (informational entries crowding friction sections), missing completeness furniture (no estimate, no owner-of-debt for HER-18 verification), forward-reference fragility, downstream-consumer hostility. Root cause: agents satisfice on whatever rubric the prompt cites; consumer-purpose questions weren't on any rubric. Fix landed in `~/workspace/ContractProjects/PrimordialAscension/.claude/skills/plan/SKILL.md` (Hold-Out Review section) and `references/CHECKLIST.md` (section D) — replaced rubric body with cold-read-as-downstream-consumer framing: identify the consumer, adopt their frame, ask "can I do my next task with what's here?" Implication for future PA plans: hold-out reviews now produce different-shaped findings (lifecycle, ownership, signal density) than red-team findings (conformance, ambiguity, completeness-against-rules). Cross-repo implication: any DWA skill that runs paired review agents should check whether its "non-rubric" reviewer has a hidden rubric in its prompt.
- **2026-05-01 (PA M1) — DWA gap: no completion path for deliverables.** Surfaced when PA's Stage D verification gate finished and three deliverables (HER-14/15/16) needed status-flip in Linear. DWA has no surface for this: (a) CLI lacks `--complete`/`--mark-done`/`--status` flag; (b) `direct-tracker.js:114` `updateIssue()` only accepts `title`, `description`, `assigneeId` — `stateId` not plumbed (LinearClient supports it via `client.updateIssue(id, { stateId })`); (c) registry JSONs have no `status` or `completed_at` field; (d) `sync.js` is one-way create/update for tracked fields only. Workaround taken: HER-14/15/16 flipped manually in Linear UI. Severity: high — this is the spine of "deliverables-driven, Linear-synced." DWA today creates tickets but cannot close them. Disposition pending PA D-1.12 triage; expect ticket here. Implementation surface needs design (CLI shape, registry schema migration with back-compat for existing JSONs, workflow-state-ID lookup per project since "Done" state IDs are project-scoped, idempotency: re-running `--complete DEL-008` should be no-op if already Done). Cross-references: this is the kind of finding that motivated the dogfood mandate — "DWA needs to support this; it's the whole point" (Jon, 2026-05-01).

### Blockers/Concerns

- ~~Phase 3: Feature Spec Template v2.0 exact schema (column names, YAML fields) must be defined before parser implementation.~~ **RESOLVED:** Template structure finalized in 02-01 with 7-column Deliverables Table and structured frontmatter.
- ~~scaffoldTDD utility (src/scaffolding/scaffold-tdd.js) does not exist yet - will be created when TDD scaffolding is implemented.~~ **RESOLVED:** Created in 02-04 with bidirectional linking and comprehensive tests.
- ~~Phase 4: Idempotency edge cases (deliverable deletion, ID renumbering, splits) need design decisions during planning.~~ **RESOLVED:** Orphan flagging pattern established in 03-02 - soft delete with orphaned: true, un-orphan on restoration.
- ~~Phase 5: Linear API rate limits, GraphQL mutations, externalId support, and MCP tool names need verification.~~ **RESOLVED:** Implemented in 06-02 with withRateLimitHandling wrapper and queryByExternalId in Linear provider.

## Session Continuity

Last session: 2026-04-29
Stopped at: Phase 7.3 implementation complete (steps 1-5 + 7 of 7 done). Smoke test passed end-to-end against real Linear (HER-6 created with attachment-based dedup, round-trip confirmed). 509 total tests passing. Jon ran setup steps 1-4 in `~/workspace/ContractProjects/PrimordialAscension`.
Resume file: `process/plan-decouple-linear-from-vscode.md`
Next: Step 6 — Primordial Ascension end-to-end verification (will continue in a fresh Claude Code session in the PA directory). After that: commit Phase 7.3, decide on Phase 7.4 (Google Docs + PR description decoupling) vs other priorities.
