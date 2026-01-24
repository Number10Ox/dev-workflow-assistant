# Feature Landscape: Dev Workflow Meta-Frameworks

**Domain:** Deliverable-driven development tools, AI-assisted execution workflows
**Researched:** 2026-01-24
**Confidence:** MEDIUM (based on training knowledge of workflow automation, issue tracking integration, and AI coding assistants; WebSearch unavailable for 2026 ecosystem verification)

## Executive Summary

Dev workflow meta-frameworks bridge the gap between planning artifacts (specs, issues) and execution. The landscape splits into three tiers:

1. **Spec management tools** (Notion, Confluence) — store docs but don't drive execution
2. **Issue trackers** (Linear, Jira) — track work but disconnected from specs and code
3. **Meta-frameworks** (emerging category) — parse specs into executable units, sync state across planning/tracking/code

DWMF sits in tier 3: it treats the feature spec as the source of truth, extracts deliverables as first-class units, and generates bounded execution contexts for AI. This is a **novel integration pattern** — most teams manually copy-paste between spec → Linear → AI prompts.

## Table Stakes

Features users expect from a deliverable-driven workflow system. Missing these = workflow doesn't function.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Parse spec into structured data** | Can't operate on unstructured markdown; need machine-readable deliverables | Medium | Requires robust YAML + markdown table parsing; must handle malformed input gracefully |
| **Idempotent updates** | Specs change; re-parsing must not destroy runtime state (PR links, status) | High | Merge strategy: spec fields override, runtime fields preserve |
| **Issue tracker sync** | Deliverables need tickets for team visibility; manual creation doesn't scale | Medium | Create on first sync, update on subsequent; handle API rate limits |
| **Deliverable registry** | Single source of truth for what exists, what's done, what's blocked | Low | File-based JSON works; schema validation critical |
| **Spec scaffolding** | Users can't start without a template; reduce friction to adoption | Low | Template instantiation with placeholders |
| **Bounded execution context** | AI needs focused scope (one deliverable at a time) to avoid hallucination/scope creep | Medium | Extract relevant spec sections, ACs, QA notes into packet |
| **Drift detection** | Inevitable: spec changes, Linear diverges, code reality differs | High | Multi-way diff: spec ↔ registry ↔ Linear ↔ code state |
| **PR description generation** | Manual PR descriptions skip context; auto-gen from deliverable metadata ensures consistency | Low | Template with deliverable ID, user story, ACs, QA notes |

### Dependency Chain

```
Spec scaffolding
  ↓
Spec parsing → Registry
  ↓
Issue sync (requires registry)
  ↓
Execution packet generation (requires registry)
  ↓
PR description (requires registry + execution results)
  ↓
Drift detection (requires all above)
```

**Critical path:** Parsing must work before anything else. Idempotency must work before sync (or re-parses destroy state).

## Differentiators

Features that set DWMF apart from manual coordination or simpler tools. Not expected, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Deliverables as first-class units** | Most tools track "features" or "issues"; DWMF tracks atomic deliverables with individual lifecycle | Medium | Each deliverable gets: JSON file, Linear ticket, execution packet, PR link |
| **Multi-source spec import** | Scaffold locally OR import from Google Docs; meets users where specs already live | Medium | Google Docs MCP integration avoids "rewrite your specs" friction |
| **GSD execution packets** | Not just "here's the spec" — generate bounded context optimized for AI execution (stop points, success criteria) | High | Requires understanding GSD contract; format must prevent scope creep |
| **Registry-driven sync** | Linear issues update from registry, not manual edits; spec → registry → Linear ensures consistency | Medium | Prevents "update the ticket" toil; changes propagate automatically |
| **Installable skills package** | Not per-project setup — `npx dwmf --install` makes skills available globally | Low | Reusability across projects; shareable via npm |
| **File-based, git-trackable state** | `.dwa/` directory commits with code; no external database; works offline | Low | Enables PR reviews to see deliverable changes; audit trail |
| **Template compliance validation** | Reject malformed specs early with actionable errors | Medium | Prevents "garbage in" scenarios; schema validation on parse |
| **Incremental adoption** | Works for one feature at a time; doesn't require team-wide process change | Low | Start small, prove value, expand usage |

### Why These Matter

**Deliverables as first-class units:** Current workflow = "ship login feature" (vague). DWMF workflow = ship DEL-001 (email input), DEL-002 (password validation), DEL-003 (OAuth flow). Granularity enables:
- Parallel work (different devs, different deliverables)
- Incremental shipping (DEL-001 ships before DEL-003 done)
- Precise tracking (know exactly what's blocked vs done)

**GSD execution packets:** Unbounded AI context = hallucination, scope creep, wasted iterations. Bounded packet = "implement DEL-001, stop when tests pass, these are the ACs." Faster, more predictable.

**Registry-driven sync:** Manual workflow = update spec, update Linear, update PR. DWMF = update spec, run sync. Reduces toil, eliminates sync errors.

## Anti-Features

Features to explicitly NOT build in v1. Common mistakes or scope creep traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Google Docs write-back** | Bidirectional sync = conflict resolution hell; Google Docs API quota limits; minimal value (specs rarely edited in Docs after import) | Read-only import; edit locally after import |
| **Multi-user collaboration** | Merge conflicts in `.dwa/` registry; concurrent edits to deliverables; authentication/permissions overhead | Single-engineer workflow; git handles sharing |
| **Custom issue tracker adapters** | Linear is sufficient for v1; each tracker has unique API quirks; maintenance burden | Linear-only; adapter pattern allows future extension |
| **Visual spec editor** | Markdown is familiar; WYSIWYG editors are complex; users already have editors (VS Code, Docs) | Use existing editors; provide clear template |
| **Automated code generation** | AI code quality varies; debugging generated code harder than writing it; false promise | Execution packets guide humans/AI, don't replace them |
| **Built-in CI/CD integration** | Out of scope; users have existing pipelines; DWMF provides metadata, pipelines consume it | Expose deliverable status via registry; let pipelines read it |
| **Spec versioning UI** | Git already handles versioning; reinventing version control adds no value | Commit `.dwa/` directory; use git for history |
| **Deliverable dependencies graph** | Complex to parse from specs; manual dependency tracking error-prone; adds significant complexity | Keep flat; users order deliverables in spec |
| **Time tracking per deliverable** | Feature creep; Linear already has estimates; adds noise | Link to Linear ticket; use Linear's time tracking |
| **Mobile app / web UI** | VS Code + Claude Code is the runtime; web UI is separate product | CLI/skills only; web UI out of scope |

### Why Avoid These

**Google Docs write-back:** Seems useful ("edit spec in Docs, sync back!") but:
- Conflict: User edits Docs, another edits local spec — which wins?
- Quota: Google API limits writes; sync loop = quota exhaustion
- Value: After import, specs live in repo; Docs is archive, not active source

**Multi-user collaboration:** Seems essential ("teams work together!") but:
- v1 targets single engineer proving workflow value
- Git already handles multi-user at repo level
- Registry conflicts need custom merge logic (complex, error-prone)

**Visual spec editor:** Seems friendly ("GUI > markdown!") but:
- Markdown is universal, version-controllable, AI-parseable
- WYSIWYG editors are large dependencies (CKEditor, TipTap)
- Users already comfortable with markdown (if using VS Code + Claude Code)

## Feature Dependencies

### Hard Dependencies (must exist first)

```
Spec parsing
  ↓
  +-- Registry creation (DEL-###.json files)
  ↓
  +-- Issue sync (requires parsed deliverables)
  +-- Execution packets (requires parsed deliverables)
  ↓
  +-- PR description (requires deliverable metadata)
  +-- Drift detection (requires registry + Linear + spec)
```

### Soft Dependencies (enhanced if both exist)

- **Spec import from Google Docs** enhances **Spec scaffolding** (two entry points, not one)
- **Template validation** enhances **Spec parsing** (fail fast on malformed input)
- **Idempotent updates** enhances **Issue sync** (safe to re-sync without data loss)

### Anti-Dependencies (deliberately decoupled)

- **Execution runtime** is decoupled from **Execution packet format** — packets are just markdown, any runtime can consume them
- **Issue tracker** is decoupled from **Registry** — registry is source of truth, Linear is sync target
- **Spec format** is decoupled from **Storage location** — template schema independent of Google Docs vs local file

## MVP Recommendation

### Ship First (Critical Path)

1. **Spec scaffolding** — Users need a starting point
2. **Spec parsing** — Core value: structured deliverables from markdown
3. **Registry creation** — File-based state: `.dwa/deliverables/DEL-###.json`
4. **Issue sync (Linear)** — Visibility: tickets per deliverable
5. **Execution packet generation** — Bounded context for GSD
6. **Idempotent updates** — Re-parsing must not destroy state

**Rationale:** This is the minimum viable loop. User scaffolds spec → parses deliverables → syncs to Linear → generates execution packet → implements deliverable. Without these, the workflow is incomplete.

### Ship Second (High-Value Additions)

7. **PR description generation** — Reduces toil, ensures consistency
8. **Drift detection** — Inevitable in real usage; catch divergence early
9. **Google Docs import** — Meets users where specs exist
10. **Template validation** — Fail fast on malformed specs

**Rationale:** These enhance the core loop but aren't blockers. PR descriptions save time but manual fallback exists. Drift detection catches problems but workflow functions without it. Google Docs import expands adoption but local scaffolding works.

### Defer to Post-MVP

- **Multi-source sync** (beyond Linear) — Adapter pattern allows future, but Linear sufficient for v1
- **Advanced drift resolution** — v1 detects drift, user fixes manually; auto-resolution is v2
- **Deliverable templates** (beyond default) — User-defined deliverable types (UI component, API endpoint, etc.) with custom fields
- **Execution runtime adapters** (beyond GSD) — Support Cursor, Aider, other AI coding tools
- **Analytics dashboard** — Deliverable velocity, completion rates, drift frequency

**Rationale:** These are nice-to-haves requiring significant complexity. Prove core workflow value first, expand based on user feedback.

## Feature Complexity Assessment

| Feature | Complexity | Risk | Mitigation |
|---------|-----------|------|------------|
| Spec parsing | Medium | Malformed tables break parsing | Schema validation, graceful error messages |
| Idempotent updates | High | Merge logic bugs = data loss | Extensive test cases, clear override rules |
| Issue sync | Medium | API rate limits, auth failures | Retry logic, batch operations |
| Drift detection | High | False positives annoy users | Clear diff display, actionable recommendations |
| GSD packets | Medium | Scope creep in packets | Strict template, explicit stop conditions |
| Google Docs import | Medium | API quota, auth complexity | MCP handles auth, rate limit with backoff |

### Complexity Notes

**High complexity = needs deeper research or phased implementation:**

- **Idempotent updates:** Merge strategy must handle: (1) spec field changes (override registry), (2) runtime field preservation (status, PR links), (3) deliverable deletions (orphan registry files?), (4) ID renumbering (spec table reordered). Consider phased: v1 = simple override, v2 = smart merge.

- **Drift detection:** Multi-way diff is complex. Phases: (1) detect spec ↔ registry drift, (2) detect registry ↔ Linear drift, (3) detect registry ↔ code drift (deliverable marked done but no PR). Each phase adds comparison logic.

**Medium complexity = standard patterns exist:**

- **Spec parsing:** YAML front matter (use `gray-matter`), markdown table parsing (regex or `markdown-it` + plugin). Known problem, known solutions.

- **Issue sync:** Linear GraphQL API is well-documented. Batch mutations, error handling. Standard API integration patterns.

**Low complexity = straightforward implementation:**

- **Spec scaffolding:** Template file + variable substitution. No branching logic.
- **Registry creation:** Write JSON files. Schema validation with JSON Schema.
- **PR description:** Template string + variable replacement.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Parsing** | Assuming table format consistency | Accept variations: extra columns, missing rows, different delimiters |
| **Idempotency** | Overwriting runtime state | Separate spec-sourced fields from runtime-sourced fields in schema |
| **Linear sync** | API rate limits during bulk operations | Batch creates/updates, add exponential backoff |
| **Execution packets** | Including too much context (entire spec) | Strict template: only relevant deliverable, not full spec |
| **Drift detection** | Too noisy (flagging trivial changes) | Ignore whitespace, formatting; focus on semantic changes |
| **Google Docs import** | Formatting loss (tables, code blocks) | Preserve markdown; warn on lossy conversion |

## Comparison to Existing Tools

### DWMF vs Notion/Confluence (Spec Management)
| Criterion | DWMF | Notion | Winner |
|-----------|------|--------|--------|
| Spec → Code integration | Parsed deliverables drive execution | Manual copy-paste | DWMF |
| Issue sync | Automated (registry → Linear) | Manual or Zapier | DWMF |
| Version control | Git (file-based) | Built-in (opaque) | Tie |
| Editing UX | Markdown in VS Code | WYSIWYG | Notion |
| Offline support | Full (file-based) | Limited | DWMF |

**Recommendation:** DWMF for execution-focused workflows; Notion for collaborative spec editing.

### DWMF vs Linear (Issue Tracking)
| Criterion | DWMF | Linear | Winner |
|-----------|------|--------|--------|
| Deliverable granularity | First-class (each deliverable = JSON + ticket) | Manual (create tickets per deliverable) | DWMF |
| Spec integration | Registry syncs from spec | Manual copy-paste | DWMF |
| AI execution context | Generates bounded packets | No integration | DWMF |
| Project management | Lightweight (file-based) | Full-featured (roadmaps, cycles) | Linear |
| Team collaboration | Single-user | Multi-user | Linear |

**Recommendation:** DWMF + Linear together. DWMF manages deliverable lifecycle, Linear provides team visibility.

### DWMF vs Cursor/Aider (AI Coding)
| Criterion | DWMF | Cursor | Aider | Winner |
|-----------|------|--------|-------|--------|
| Bounded execution | Packets limit scope per deliverable | Full codebase context | File-level context | DWMF |
| Spec integration | Registry drives packets | None | None | DWMF |
| Code generation | Guides AI, doesn't generate | Inline generation | CLI generation | Cursor (UX) |
| Drift detection | Tracks deliverable status vs code | None | None | DWMF |

**Recommendation:** DWMF generates execution context, Cursor/Aider consume it. Complementary tools.

## Sources

**Confidence: MEDIUM**

Findings based on:
- Training knowledge of workflow automation patterns (Linear API, spec management, AI coding assistants)
- Understanding of GSD execution model (bounded context, stop points)
- Common pitfalls in multi-system sync (issue trackers, specs, code)
- DWMF project context from PROJECT.md

**Not verified against:**
- Current 2026 ecosystem (WebSearch unavailable)
- Latest Linear API capabilities (training knowledge ~2025)
- Emerging meta-framework tools (potential competitors)

**Recommendation:** Treat technology/API claims as hypotheses. Verify Linear GraphQL API, Google Docs MCP, and GSD packet format against official documentation before implementation.
