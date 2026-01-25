# DWA Requirements

## v1 Requirements

### REQ-001: Package Installation via npx
**Priority:** Critical
**Phase:** 1
Install DWA skills globally via `npx dwa --install`. Copies skills, templates, and references to `~/.claude/dwa/`. Registers `/dwa:*` commands in Claude Code settings. Supports `--upgrade` and `--uninstall`.

### REQ-002: Feature Spec Scaffolding
**Priority:** Critical
**Phase:** 2
`/dwa:create-spec` scaffolds a feature spec from Template v2.0 (YAML front matter + Deliverables Table) or imports from Google Docs via MCP. Creates `.dwa/feature.json` with feature metadata.

### REQ-003: Deliverables Table Parsing
**Priority:** Critical
**Phase:** 3
`/dwa:parse` extracts the Deliverables Table from a feature spec into `.dwa/deliverables/DEL-###.json` registry files. Uses AST-based parsing (remark-gfm), not regex. Validates against schema. Handles malformed input with actionable error messages.

### REQ-004: Idempotent Registry Updates
**Priority:** Critical
**Phase:** 4
Re-parsing a spec updates spec-sourced fields (title, user story, AC, QA notes) without destroying runtime fields (linear_issue_id, status, pr_url, completed_at). Atomic file writes prevent partial state.

### REQ-005: Linear Issue Sync
**Priority:** High
**Phase:** 5
`/dwa:sync` creates or updates Linear issues per deliverable with full context (user story, AC, QA notes, spec link). Uses MCP bridge via dev-workflow-assistant extension. Handles rate limits with exponential backoff. Uses externalId for deduplication.

### REQ-006: Bounded Execution Packets
**Priority:** High
**Phase:** 6
`/dwa:start DEL-###` generates a framework-agnostic execution packet at `.dwa/packets/DEL-###.md` containing only the relevant deliverable context, acceptance criteria, dependencies, success criteria, and stop conditions. User decides how to execute (GSD, BMAD, manual, etc.).

### REQ-007: Drift Detection
**Priority:** Medium
**Phase:** 7
`/dwa:check-drift` compares spec vs registry vs Linear state and produces an actionable `.dwa/drift-report.md`. Ignores whitespace/formatting; focuses on semantic changes. Reports: missing deliverables, field mismatches, orphaned registry entries.

### REQ-008: PR Description Generation
**Priority:** Medium
**Phase:** 8
Generate PR description drafts from deliverable metadata (user story, ACs, QA notes, deliverable ID). Template-based with variable substitution.

### REQ-009: Google Docs Import
**Priority:** Medium
**Phase:** 8
Import feature specs from Google Docs via MCP (read-only). Convert to local markdown preserving table structure. Warn on lossy conversion.

### REQ-010: Template Compliance Validation
**Priority:** Medium
**Phase:** 3
Validate spec format before parsing: YAML front matter schema, required Deliverables Table columns, row completeness. Fail fast with line numbers and fix suggestions.

### REQ-011: Schema Versioning
**Priority:** High
**Phase:** 1
Include `schemaVersion` in every `.dwa/` JSON file from day one. Track `.dwa-version` in registry. Enable future read-time migrations without breaking existing registries.

## Out of Scope (v1)

- Google Docs write-back (read-only import only)
- Multi-user collaboration (single-engineer workflow)
- Custom issue tracker adapters (Linear-only; adapter pattern for future)
- Visual spec editor (markdown in VS Code)
- Automated code generation (packets guide, don't replace)
- CI/CD integration (expose metadata, let pipelines consume)
- Deliverable dependency graphs (keep flat)
- Time tracking per deliverable (use Linear's)
- Mobile/web UI (CLI/skills only)
- Advanced drift auto-resolution (detect only; user fixes manually)

## Success Criteria

1. `npx dwa --install` installs successfully and skills are invocable
2. `/dwa:create-spec` produces a valid feature spec from template
3. `/dwa:parse` extracts deliverables into `.dwa/deliverables/` with schema validation
4. Re-running `/dwa:parse` preserves runtime fields (idempotent)
5. `/dwa:sync` creates Linear issues with correct fields
6. `/dwa:start DEL-001` generates a bounded GSD execution packet
7. `/dwa:check-drift` produces actionable drift report
8. All `.dwa/` state is git-trackable and human-inspectable

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-001 | Phase 1: Bootstrap and Installer | Complete |
| REQ-011 | Phase 1: Bootstrap and Installer | Complete |
| REQ-002 | Phase 2: Templates and Scaffolding | Complete |
| REQ-003 | Phase 3: Core Parsing | Complete |
| REQ-010 | Phase 3: Core Parsing | Complete |
| REQ-004 | Phase 4: Idempotent Registry | Pending |
| REQ-005 | Phase 5: Linear Integration | Pending |
| REQ-006 | Phase 6: Execution Packets | Pending |
| REQ-007 | Phase 7: Drift Detection | Pending |
| REQ-008 | Phase 8: Polish and Extended Features | Pending |
| REQ-009 | Phase 8: Polish and Extended Features | Pending |
