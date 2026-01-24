# DWMF — Dev Workflow Meta-Framework

## What This Is

An installable Claude Code skills package that implements a deliverable-driven workflow meta-framework. It bridges feature specs (markdown with YAML front matter and a Deliverables Table) with per-deliverable AI execution via GSD. Users install it like GSD (`npx dwmf --install`) and get skills for managing the full lifecycle: spec scaffolding, deliverable extraction, Linear sync, bounded execution packet generation, and drift detection.

## Core Value

Deliverables parsed from a canonical feature spec drive all downstream work — Linear tickets, GSD execution packets, PR descriptions, and drift checks flow from the registry, not from manual coordination.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Initialize a feature by scaffolding a canonical spec from Template v2.0 or importing from Google Docs
- [ ] Extract Deliverables Table from spec into `.dwa/deliverables/DEL-###.json` registry (idempotent)
- [ ] Create/update Linear issues per deliverable with full context (user story, AC, QA notes, spec link)
- [ ] Start a deliverable and generate a bounded GSD execution packet (`.dwa/packets/DEL-###.md`)
- [ ] Sync artifacts: update Linear issues from registry, generate PR description drafts
- [ ] Run drift check producing actionable `.dwa/drift-report.md`
- [ ] Installable as a package (npx) into `~/.claude/dwmf/` for any project

### Out of Scope

- VS Code extension code — Linear/Google integrations live in separate `dev-workflow-assistant` repo
- Non-GSD execution runtimes — extensible design, but only GSD adapter implemented in v1
- Google Docs write-back — read-only import; no syncing changes back to Docs
- Multi-user collaboration features — single-engineer workflow for now

## Context

- **Dependency:** `dev-workflow-assistant` VS Code extension provides Linear API integration and Google Drive MCP access. DWMF skills assume these are available in the user's environment.
- **Feature Spec Template v2.0:** Already exists (user-provided). Defines YAML front matter schema and Deliverables Table format.
- **GSD integration:** Execution packets are formatted for GSD consumption — bounded context, success criteria, stop points.
- **Data model:** `.dwa/feature.json` (feature metadata) + `.dwa/deliverables/DEL-###.json` (parsed from spec) + `.dwa/packets/` (generated execution artifacts).
- **Two spec paths:** Scaffold locally from template OR import from Google Docs via MCP.
- **Parsing contract:** Robust markdown table parsing with YAML front matter validation. Idempotent updates preserve runtime fields (status, PR links).

## Constraints

- **Distribution:** Installable via npx, installs Claude Code skills to `~/.claude/dwmf/`
- **AI Runtime:** Claude Code in VS Code (skills invoked via `/dwmf:*` commands)
- **Linear dependency:** Requires `dev-workflow-assistant` extension or equivalent Linear MCP for issue sync
- **Template compliance:** Specs must conform to Feature Spec Template v2.0 schema
- **File-based registry:** All state in `.dwa/` directory — no databases, no servers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate repo from VS Code extension | Extension is infrastructure; DWMF is the workflow layer. Clean separation. | — Pending |
| Claude Code skills (not extension commands) | User wants minimal extension work; skills are standard Claude Code pattern | — Pending |
| Framework-agnostic execution packets | Packets are bounded context documents (objective, ACs, stop conditions); any framework (GSD, BMAD, manual) can consume them. User decides execution approach. | — Decided |
| File-based `.dwa/` registry | No server dependencies; works offline; git-trackable | — Pending |
| Installable package via npx | Reusable across projects; shareable with others | — Pending |

---
*Last updated: 2026-01-24 after initialization*
