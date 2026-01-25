# DWA — Deliverable Work Artifacts

## What This Is

A hybrid system combining VS Code extension commands (deterministic automation) with Claude Code skills (LLM-assisted content generation). DWA implements a deliverable-driven workflow that bridges human feature specs with per-deliverable AI execution via GSD.

**Commands** handle mechanical work: parsing, syncing, generating packet shells.
**Skills** add value where LLM judgment helps: drafting TDDs, enriching packets, proposing drift fixes.

## Core Value

Deliverables parsed from a canonical feature spec drive all downstream work — Linear tickets, execution packets, PR descriptions, and drift checks flow from the registry, not from manual coordination.

## Architecture

### Two-Tier Spec Model

```
Human Feature Spec (source of intent)
├── Owner: PM / designer / producer
├── Format: Google Docs / Figma-linked doc
└── Purpose: Defines WHY and WHAT (goals, UX, success criteria)
        ↓ manual mirror (MVP) / import (Phase 7)
Canonical AI-Friendly Spec (repo mirror)
├── Owner: Engineering system
├── Format: Repo Markdown (YAML front matter + Deliverables Table)
└── Purpose: Machine-usable for automation (tickets, packets, drift)
```

### Technical Design Doc (TDD-lite)

Separate artifact at `docs/tdds/<feature>-tdd.md`, linked from canonical spec.

Contains:
- Architecture boundaries
- Key decisions + rationale
- Risks
- Test strategy / evidence requirements

Updated as reality emerges — a living decision log and guardrails.

### Execution Packet Format

Per-deliverable bounded context for GSD (or any framework):

```markdown
# Execution Packet — DEL-### — <Short name>

## 0) Quick Context
- Feature, Deliverable, Links (spec, ticket, TDD)

## 1) Goal
What "done" means in plain English

## 2) User Story
As a <user>, I want <thing>, so that <value>

## 3) Acceptance Criteria (testable)
- [ ] AC1 ...
- [ ] AC2 ...

## 4) QA Notes
Environment, manual steps, expected results

## 5) Constraints / Guardrails (from TDD)
Architectural boundaries, performance constraints, "do not" list

## 6) Implementation Targets
Files likely touched, new files expected, key APIs

## 7) Plan Request
How GSD should behave (produce plan, then STOP)

## 8) Drift Since Last Packet
Observed drift, decision (accept/revert/escalate), required updates

## 9) Stop Points
Human checkpoints (after plan, after core logic, after tests, etc.)
```

### Drift as First-Class

- **Per-deliverable**: Tracked in registry + packet section 8
- **Rolling log**: `.dwa/drift-log.md` aggregated from per-deliverable drift
- **Decisions captured**: accept change / revert / escalate to PM

## Commands vs Skills

### Commands (Deterministic — VS Code Extension)

| Command | Purpose |
|---------|---------|
| `Dev Workflow: Create Spec` | Scaffold canonical spec from template |
| `Dev Workflow: Parse Spec → Update Registry` | AST extraction → `.dwa/deliverables/DEL-###.json` |
| `Dev Workflow: Start Deliverable` | Generate packet shell with structured data |
| `Dev Workflow: Sync Linear` | Create/update Linear issues from registry |
| `Dev Workflow: Drift Check` | Structural comparison (missing ACs, status mismatch) |
| `Dev Workflow: Complete Deliverable` | Capture outcomes, PR link, evidence |

### Skills (LLM-Assisted — Claude Code)

| Skill | Purpose |
|-------|---------|
| `/dwa:draft-tdd` | Generate TDD outline from spec goals + constraints |
| `/dwa:enrich-packet` | Add implementation targets, stop points, risk notes |
| `/dwa:normalize-spec` | Clean messy spec edits into template-compliant structure |
| `/dwa:propose-drift-fix` | Suggest spec/TDD updates based on implementation delta |

### Mixed (Command + Skill)

| Operation | Command does | Skill adds |
|-----------|--------------|------------|
| PR Description | Generate template from fields | Fill narrative sections |
| Complete Deliverable | Capture structured outcomes | Propose delta (spec/TDD updates) |

### Skill Distribution

- Repo ships skills under: `.llms/skills/dwa/`
- Installer copies/links them into Claude's expected directory
- Repo remains self-contained

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scaffold canonical spec from Template v2.0 with TDD link placeholder
- [ ] Scaffold TDD from template with decision log, guardrails, risks
- [ ] Parse Deliverables Table into `.dwa/deliverables/DEL-###.json` registry (idempotent)
- [ ] Generate rich execution packets with TDD constraints and drift section
- [ ] Track per-deliverable drift with rolling `.dwa/drift-log.md`
- [ ] Create/update Linear issues per deliverable with full context
- [ ] Generate PR descriptions from deliverable metadata
- [ ] Installable as a package (npx) for any project

### Out of Scope

- Google Docs write-back — read-only import; no syncing changes back to Docs
- Non-GSD execution runtimes — extensible design, but only GSD adapter in v1
- Multi-user collaboration features — single-engineer workflow for now

## Context

- **Dependency:** `dev-workflow-assistant` VS Code extension provides Linear API integration and Google Drive MCP access.
- **Feature Spec Template v2.0:** Defines YAML front matter schema and Deliverables Table format.
- **TDD Template:** Defines decision log, guardrails, risks, test strategy sections.
- **GSD integration:** Execution packets are formatted for GSD consumption — bounded context, TDD guardrails, stop points.
- **Data model:** `.dwa/feature.json` (metadata) + `.dwa/deliverables/DEL-###.json` (parsed) + `.dwa/packets/` (execution) + `.dwa/drift-log.md` (rolling drift).
- **Two spec paths:** Manual mirror from Google Docs (MVP) OR import via MCP (Phase 7).

## Constraints

- **Distribution:** Installable via npx; skills to `.llms/skills/dwa/`, commands via extension
- **AI Runtime:** Claude Code in VS Code (skills invoked via `/dwa:*`)
- **Linear dependency:** Requires `dev-workflow-assistant` extension or equivalent Linear MCP
- **Template compliance:** Specs must conform to Feature Spec Template v2.0; TDDs to TDD Template
- **File-based registry:** All state in `.dwa/` directory — no databases, no servers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Commands vs Skills separation | Commands for deterministic work (no tokens); skills where LLM adds value | — Decided |
| Two-tier spec (human → canonical) | Human spec is source of intent; repo spec is machine-usable mirror | — Decided |
| TDD as separate artifact | Keeps technical decisions in living doc; guardrails flow to packets | — Decided |
| Drift as first-class | Per-deliverable tracking + rolling log; enables "delta" in next packet | — Decided |
| Framework-agnostic packets | Bounded context consumable by GSD, BMAD, or manual execution | — Decided |
| File-based `.dwa/` registry | No server dependencies; works offline; git-trackable | — Decided |
| Skills in repo (`.llms/skills/`) | Repo self-contained; installer copies to Claude directory | — Decided |

---
*Last updated: 2026-01-24 — revised architecture (commands vs skills, two-tier spec, TDD, drift)*
