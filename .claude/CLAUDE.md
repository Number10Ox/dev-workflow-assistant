# Claude Code Rules

## Project

**DWA (Dev Workflow Assistant)** — A deliverable-driven development framework for Claude Code. Bridges human feature specs with per-deliverable AI execution via structured, auditable processes. Phase 7.1 complete; Phase 7.2 (Workflow Friction Reduction) pending.

## Session Start

At the start of each session, read:
- `.planning/STATE.md` — current position, accumulated context, session continuity, performance metrics
- `.planning/PROJECT.md` — core architecture, 2-tier spec model, key decisions

Reference as needed:
- `.planning/ROADMAP.md` — 9-phase roadmap with dependency chain
- `.planning/REQUIREMENTS.md` — 11 requirements with phase mapping
- Phase-specific docs in `.planning/phases/[NN]-*/`

## Write-Back Before Session End or Context Risk

Context compaction loses in-session details. To survive it, **write back to docs before losing context**:

1. **After every significant change** (new decision, completed plan, architecture change):
   - Update `.planning/STATE.md` current position and accumulated context
   - Add decisions to the PROJECT.md Key Decisions table if any were made
   - Update phase SUMMARY docs if a plan was completed

2. **When the user mentions compaction risk** (e.g., "99% context", "running out of context"):
   - Immediately write back ALL pending state to docs before doing anything else
   - Prioritize STATE.md (it's the session-start file) and PROJECT.md (key decisions)

3. **Rule: docs must always be current enough that a fresh session reading only the Session Start files can pick up where we left off.** If something is only in conversation context and not in a doc, it's at risk.

## Tech Stack

- Node.js 18+ (CommonJS modules)
- `node:test` built-in test runner (no Jest or Vitest)
- Commander.js for CLI
- remark/unified for Markdown AST parsing
- Handlebars for template rendering

## Coding Style

### Naming
- Files: camelCase for modules, PascalCase for classes
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Test files: `[module-name].test.js`

### Code Organization
- `src/parser/` — Spec parsing and registry management
- `src/google-docs/` — Google Docs import subsystem
- `src/linear/` — Linear integration
- `src/scaffolding/` — Template scaffolding
- `src/utils/` — Shared utilities
- `skills/` — Claude Code skills (LLM-assisted)
- `tests/` — Mirrors src/ structure

### Principles
- Deterministic CLI for mechanical work, LLM skills for judgment-heavy content
- Registry is a cache — parsed deliverables are derived, re-generatable
- Drift events are append-only (never manually edit drift-log.md)
- Idempotent operations (re-parsing preserves runtime fields)
- Atomic file writes via write-file-atomic

## Source of Truth

- The committed codebase + .planning/ docs are the only source of truth
- Do NOT retrieve or reuse old code from git history unless explicitly asked
- STATE.md accumulated context section is the decision log
- .dwa/ directory is derived state (registry, packets, drift log)

## Constraints

- Skills never modify registry or spec (read-only)
- Google Docs import is read-only (no bidirectional sync)
- All JSON files include schemaVersion from day one
- 368+ tests must pass before any deliverable is signed off
