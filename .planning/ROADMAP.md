# Roadmap: DWA

## Overview

DWA delivers a deliverable-driven development workflow combining VS Code extension commands (deterministic automation) with Claude Code skills (LLM-assisted content generation). The build follows a strict dependency chain: installer provides the foundation, scaffolding creates spec + TDD structure, parsing extracts deliverables into a registry, execution packets enable bounded AI work, drift tracking captures divergence, Linear sync creates tickets, and polish adds convenience features.

**Commands** = VS Code extension (deterministic, no tokens)
**Skills** = Claude Code (LLM judgment, content generation)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Bootstrap and Installer** - Package installation and schema versioning
- [x] **Phase 2: Spec + TDD Scaffolding** - Canonical spec and technical design doc templates
- [x] **Phase 3: Parsing + Idempotent Registry** - AST extraction with safe re-parse
- [x] **Phase 4: Execution Packets** - Rich bounded-context generation for GSD
- [ ] **Phase 5: Drift Tracking** - Per-deliverable drift with rolling log
- [ ] **Phase 6: Linear Integration** - Issue sync from registry
- [ ] **Phase 7: Polish and Extended Features** - Google Docs import, PR descriptions

## Phase Details

### Phase 1: Bootstrap and Installer ✓
**Goal**: Users can install DWA into any Claude Code environment via a single npx command
**Depends on**: Nothing (first phase)

**Commands Delivered**:
- `npx dwa --install` — copies skills, templates, references to expected locations
- `npx dwa --upgrade` — updates existing installation preserving config
- `npx dwa --uninstall` — cleanly removes all installed files

**Skills Delivered**: None (infrastructure only)

**Demo**: Run `npx dwa --install`, verify `/dwa:*` commands available in Claude Code

**Success Criteria**:
1. Running `npx dwa --install` copies skills to `.llms/skills/dwa/` and registers commands
2. Running `npx dwa --upgrade` updates without losing user configuration
3. Running `npx dwa --uninstall` cleanly removes all installed files
4. Every `.dwa/` JSON file includes a `schemaVersion` field from day one
5. A `.dwa-version` file tracks installed package version for migrations

**Plans**: 3 plans (complete)
- [x] 01-01-PLAN.md — Project scaffold, CLI entry point, shared utilities
- [x] 01-02-PLAN.md — Install command with file copy and version tracking
- [x] 01-03-PLAN.md — Upgrade and uninstall commands

---

### Phase 2: Spec + TDD Scaffolding ✓
**Goal**: Users can scaffold both canonical spec (repo mirror of human spec) and technical design doc
**Depends on**: Phase 1

**Commands Delivered**:
- `Dev Workflow: Create Spec` — scaffolds `feature-spec.md` from Template v2.0 with TDD link placeholder
- `Dev Workflow: Create TDD` — scaffolds `docs/tdds/<feature>-tdd.md` with decision log, guardrails, risks

**Skills Delivered**:
- `/dwa:draft-tdd` — LLM generates initial TDD outline from spec goals + constraints

**Demo**: Scaffold spec + TDD for a feature, see linked structure ready to fill in

**Success Criteria**:
1. `Dev Workflow: Create Spec` creates spec with YAML front matter including `tdd_path` field
2. `Dev Workflow: Create TDD` creates TDD at `docs/tdds/<feature>-tdd.md` with template sections
3. `/dwa:draft-tdd` generates decision log, guardrails, and risks from spec context
4. Both commands warn before overwriting existing files
5. `.dwa/feature.json` stores metadata linking spec path and TDD path

**Plans**: 4 plans
- [x] 02-01-PLAN.md — Update spec template with tdd_path field, update skill and tests (partial)
- [x] 02-02-PLAN.md — TDD template (tdd-v1.hbs), scaffold-tdd.js utility, and tests (partial)
- [x] 02-03-PLAN.md — /dwa:draft-tdd Claude Code skill (complete, awaits dependencies)
- [x] 02-04-PLAN.md — Gap closure: tdd_path field, TDD template, scaffold-tdd.js, tests

---

### Phase 3: Parsing + Idempotent Registry ✓
**Goal**: Users can extract deliverables from spec and safely re-parse after edits
**Depends on**: Phase 2

**Commands Delivered**:
- `Dev Workflow: Parse Spec → Update Registry` — AST extraction → `.dwa/deliverables/DEL-###.json`

**Skills Delivered**: None (deterministic parsing)

**Demo**: Fill in spec deliverables, parse, edit spec, re-parse — registry updates without losing status/PR links

**Success Criteria**:
1. Parsing uses AST-based extraction (remark-gfm), not regex
2. Each deliverable row becomes `.dwa/deliverables/DEL-###.json` with all columns mapped
3. Spec is validated against Template v2.0 schema before parsing; failures report line numbers
4. Re-parsing updates spec-sourced fields but preserves runtime fields (status, linear_id, pr_url)
5. File writes are atomic (temp + rename) — crash never leaves partial state
6. Removed deliverables are flagged, not silently deleted

**Plans**: 2 plans (complete)
- [x] 03-01-PLAN.md — AST parser with validation (TDD)
- [x] 03-02-PLAN.md — Idempotent registry merge logic (TDD)

---

### Phase 4: Execution Packets ✓
**Goal**: Users can generate rich bounded-context packets that feed GSD (or any framework)
**Depends on**: Phase 3

**Commands Delivered**:
- `Dev Workflow: Start Deliverable` — generates packet shell at `.dwa/packets/DEL-###.md`

**Skills Delivered**:
- `/dwa:enrich-packet` — adds implementation targets, stop points, risk notes from codebase context

**Demo**: Start DEL-001, see packet with TDD guardrails and stop points, feed to GSD

**Success Criteria**:
1. Packet includes all 10 sections (context, goal, story, ACs, QA, constraints, targets, plan request, drift, stops)
2. Section 5 (Constraints) pulls from linked TDD file
3. Section 8 (Drift) populated from registry drift data if present
4. `/dwa:enrich-packet` suggests files likely touched and key APIs from codebase analysis
5. Starting already-started deliverable warns and requires confirmation

**Plans**: 2 plans (complete)
- [x] 04-01-PLAN.md — Packet shell generator (TDD): template, generation utilities, start command
- [x] 04-02-PLAN.md — /dwa:enrich-packet skill: codebase analysis, implementation targets, enrichment sections

---

### Phase 5: Drift Tracking
**Goal**: Users can track per-deliverable drift and see a rolling summary
**Depends on**: Phase 4

**Commands Delivered**:
- `Dev Workflow: Drift Check` — structural comparison (missing ACs, status mismatch, outdated timestamps)
- `Dev Workflow: Complete Deliverable` — captures outcomes, PR link, evidence; records drift decision

**Skills Delivered**:
- `/dwa:propose-drift-fix` — suggests spec/TDD updates based on implementation delta
- `/dwa:normalize-spec` — cleans messy spec edits into template-compliant structure

**Demo**: Complete a deliverable with implementation changes, see drift logged, view rolling `.dwa/drift-log.md`

**Success Criteria**:
1. Per-deliverable drift stored in registry (`drift` field with observed/decision/patch)
2. Rolling `.dwa/drift-log.md` aggregated from per-deliverable drift records
3. `Dev Workflow: Drift Check` detects: missing ACs, status mismatch, missing links, spec vs registry divergence
4. `/dwa:propose-drift-fix` generates concrete patch suggestions from git diff / PR description
5. Drift section in next packet (section 8) populated from previous deliverable's drift

**Plans**: TBD
- [ ] 05-01: Drift check command and registry schema
- [ ] 05-02: Complete deliverable command with drift capture
- [ ] 05-03: /dwa:propose-drift-fix and /dwa:normalize-spec skills

---

### Phase 6: Linear Integration
**Goal**: Users can sync deliverables to Linear as individual issues
**Depends on**: Phase 5

**Commands Delivered**:
- `Dev Workflow: Sync Linear` — creates/updates Linear issues from registry

**Skills Delivered**: None (API calls are deterministic)

**Demo**: Sync deliverables, see tickets created in Linear with user story, ACs, QA notes, spec link

**Success Criteria**:
1. Creates Linear issue for each deliverable lacking `linear_issue_id`
2. Updates existing issues when spec-sourced fields changed in registry
3. Uses `externalId` for deduplication — no duplicate issues on re-sync
4. Rate limits (429) handled with exponential backoff
5. Partial failures report which deliverables succeeded/failed
6. Registry stores `linear_issue_id` and `linear_url` after sync

**Plans**: TBD
- [ ] 06-01: Linear API integration with MCP
- [ ] 06-02: Sync command with idempotent create/update

---

### Phase 7: Polish and Extended Features
**Goal**: Convenience features round out the workflow
**Depends on**: Phase 6

**Commands Delivered**:
- `Dev Workflow: Import Google Doc` — read-only import → canonical spec (via MCP)

**Skills Delivered**:
- `/dwa:generate-pr-description` — narrative PR text from deliverable metadata

**Demo**: Import existing Google Doc spec, see conversion to canonical format with table preserved

**Success Criteria**:
1. Google Docs import converts to local markdown preserving table structure
2. Lossy conversions (images, complex formatting) produce warnings listing what was lost
3. PR description generated from user story, ACs, QA notes, deliverable ID
4. Skills that depend on MCP check availability before invoking; fail fast with setup instructions

**Plans**: TBD
- [ ] 07-01: Google Docs MCP import
- [ ] 07-02: /dwa:generate-pr-description skill

---

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Bootstrap and Installer | ✓ Complete | 2026-01-24 |
| 2. Spec + TDD Scaffolding | ✓ Complete | 2026-01-24 |
| 3. Parsing + Idempotent Registry | ✓ Complete | 2026-01-25 |
| 4. Execution Packets | ✓ Complete | 2026-01-25 |
| 5. Drift Tracking | Not started | — |
| 6. Linear Integration | Not started | — |
| 7. Polish and Extended Features | Not started | — |
