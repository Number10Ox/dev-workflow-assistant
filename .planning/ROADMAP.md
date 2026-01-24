# Roadmap: DWMF

## Overview

DWMF delivers a complete deliverable-driven development workflow as an installable Claude Code skills package. The build follows a strict dependency chain: installer provides the foundation, templates give specs structure, parsing extracts deliverables into a registry, idempotency makes the registry safe to re-parse, Linear sync creates tickets from deliverables, execution packets enable bounded AI work, drift detection catches divergence, and polish rounds out the experience with convenience features and extended input sources.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Bootstrap and Installer** - Package installation mechanism and schema versioning foundation
- [ ] **Phase 2: Templates and Scaffolding** - Feature spec template and /dwmf:init skill
- [ ] **Phase 3: Core Parsing** - AST-based deliverables extraction with validation
- [ ] **Phase 4: Idempotent Registry** - Safe re-parse preserving runtime state
- [ ] **Phase 5: Linear Integration** - Issue sync per deliverable via MCP
- [ ] **Phase 6: Execution Packets** - Framework-agnostic bounded context generation
- [ ] **Phase 7: Drift Detection** - Spec vs registry vs Linear divergence reporting
- [ ] **Phase 8: Polish and Extended Features** - PR descriptions, Google Docs import, DX improvements

## Phase Details

### Phase 1: Bootstrap and Installer
**Goal**: Users can install DWMF skills into any Claude Code environment via a single npx command
**Depends on**: Nothing (first phase)
**Requirements**: REQ-001, REQ-011
**Success Criteria** (what must be TRUE):
  1. Running `npx dwmf --install` copies skills, templates, and references to `~/.claude/dwmf/` and registers `/dwmf:*` commands
  2. Running `npx dwmf --upgrade` updates existing installation without losing user configuration
  3. Running `npx dwmf --uninstall` cleanly removes all installed files and deregisters commands
  4. Every `.dwa/` JSON file created by any skill includes a `schemaVersion` field from day one
  5. A `.dwmf-version` file tracks the installed package version for future migration support
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Templates and Scaffolding
**Goal**: Users can initialize a new feature with a properly structured spec ready for deliverable extraction
**Depends on**: Phase 1
**Requirements**: REQ-002
**Success Criteria** (what must be TRUE):
  1. `/dwmf:init` creates a feature spec file from Template v2.0 with valid YAML front matter and an empty Deliverables Table
  2. `/dwmf:init` creates `.dwa/feature.json` with feature metadata (name, created date, spec path)
  3. `/dwmf:init` with Google Docs source imports a spec via MCP and converts it to local markdown preserving table structure
  4. Running `/dwmf:init` in a directory with an existing spec warns before overwriting
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Core Parsing
**Goal**: Users can extract structured deliverables from a feature spec into individual registry files
**Depends on**: Phase 2
**Requirements**: REQ-003, REQ-010
**Success Criteria** (what must be TRUE):
  1. `/dwmf:parse` extracts each row from the Deliverables Table into a separate `.dwa/deliverables/DEL-###.json` file with all columns mapped to JSON fields
  2. Parsing uses AST-based extraction (remark-gfm), not regex, producing correct results for escaped pipes, empty cells, and multiline content
  3. Before parsing, the spec is validated against Template v2.0 schema (YAML front matter fields, required table columns, row completeness) with failures reporting line numbers and fix suggestions
  4. Malformed specs that fail validation produce actionable error messages and do not create partial registry state
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Idempotent Registry
**Goal**: Users can safely re-parse a spec after edits without losing runtime state accumulated during execution
**Depends on**: Phase 3
**Requirements**: REQ-004
**Success Criteria** (what must be TRUE):
  1. Re-running `/dwmf:parse` on a modified spec updates spec-sourced fields (title, user story, AC, QA notes) in existing registry files
  2. Re-parsing preserves runtime fields (linear_issue_id, status, pr_url, completed_at) that were set by other skills
  3. File writes are atomic (write to temp, rename) so a crash mid-parse never leaves partial state
  4. New deliverables added to the spec create new registry files; deliverables removed from the spec are flagged (not silently deleted)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Linear Integration
**Goal**: Users can sync deliverables to Linear as individual issues with full context, driven from the registry
**Depends on**: Phase 4
**Requirements**: REQ-005
**Success Criteria** (what must be TRUE):
  1. `/dwmf:sync` creates a Linear issue for each deliverable that lacks a `linear_issue_id`, populated with user story, acceptance criteria, QA notes, and spec link
  2. `/dwmf:sync` updates existing Linear issues when spec-sourced fields have changed in the registry
  3. Linear issues use `externalId` for deduplication, preventing duplicate issues on re-sync
  4. Rate limit responses (429) are handled with exponential backoff, and partial sync failures report which deliverables succeeded and which failed
  5. After sync, each registry file stores its `linear_issue_id` for future reference
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Execution Packets
**Goal**: Users can start work on a single deliverable with a framework-agnostic bounded context packet
**Depends on**: Phase 5
**Requirements**: REQ-006
**Success Criteria** (what must be TRUE):
  1. `/dwmf:start DEL-###` generates a packet at `.dwa/packets/DEL-###.md` containing only the targeted deliverable's context
  2. The packet includes acceptance criteria, QA notes, dependencies, success criteria, and explicit stop conditions
  3. The packet is framework-agnostic (objective, context, ACs, stop conditions) — consumable by GSD, BMAD, or manual execution
  4. Starting an already-started deliverable warns the user and requires confirmation before regenerating the packet
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Drift Detection
**Goal**: Users can detect divergence between their spec, registry, and Linear state with an actionable report
**Depends on**: Phase 6
**Requirements**: REQ-007
**Success Criteria** (what must be TRUE):
  1. `/dwmf:check-drift` produces a `.dwa/drift-report.md` comparing spec content against registry state
  2. The report identifies missing deliverables (in spec but not registry, or vice versa), field mismatches, and orphaned entries
  3. Comparison ignores whitespace and formatting differences, focusing on semantic content changes
  4. When Linear integration is available, the report also compares registry state against Linear issue state
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: Polish and Extended Features
**Goal**: Users have convenience features that round out the workflow: PR descriptions from metadata, Google Docs import, and improved error experience
**Depends on**: Phase 7
**Requirements**: REQ-008, REQ-009
**Success Criteria** (what must be TRUE):
  1. PR description drafts are generated from deliverable metadata (user story, ACs, QA notes, deliverable ID) using template-based variable substitution
  2. Google Docs specs can be imported via MCP read-only access, converting to local markdown with table structure preserved
  3. Lossy conversions from Google Docs (unsupported formatting, embedded images) produce warnings listing what was lost
  4. Skills that depend on MCP tools (Linear, Google Docs) check tool availability before invoking and fail fast with setup instructions when unavailable
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bootstrap and Installer | 0/TBD | Not started | - |
| 2. Templates and Scaffolding | 0/TBD | Not started | - |
| 3. Core Parsing | 0/TBD | Not started | - |
| 4. Idempotent Registry | 0/TBD | Not started | - |
| 5. Linear Integration | 0/TBD | Not started | - |
| 6. Execution Packets | 0/TBD | Not started | - |
| 7. Drift Detection | 0/TBD | Not started | - |
| 8. Polish and Extended Features | 0/TBD | Not started | - |
