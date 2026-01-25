# Project Research Summary

**Project:** DWA (Dev Workflow Meta-Framework)
**Domain:** Installable Claude Code skills package — deliverable-driven development workflow
**Researched:** 2026-01-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

DWA is a Claude Code skills package that bridges the gap between human-authored feature specs and per-deliverable AI execution via GSD. The core value proposition is treating deliverables as first-class units: a markdown feature spec is parsed into structured JSON registry entries, each of which can be synced to Linear and used to generate bounded execution packets for GSD. This is an emerging pattern with no established competition — most teams manually copy-paste between spec documents, issue trackers, and AI prompts. The architecture is well-understood because it follows the proven GSD installation pattern (npx install to ~/.claude/, skills as markdown orchestrators, file-based state in the user's project).

The recommended approach is a layered build: installer CLI first (Node.js + commander), then markdown parsing pipeline (gray-matter + remark for robust table extraction), then file-based registry (.dwa/ directory with per-deliverable JSON), then Linear sync via MCP, and finally GSD packet generation. Each layer depends on the previous one, making the build order unambiguous. The stack is entirely standard Node.js tooling with high-confidence library choices — no novel technology bets.

The primary risks are in parsing robustness and integration reliability. Markdown table parsing with regex is the single biggest technical debt trap — the research strongly recommends AST-based parsing via remark-gfm. Idempotency is the hardest logic problem: re-parsing a spec must update content fields without destroying runtime state (Linear issue IDs, PR links, status). Linear API rate limits can cause silent partial syncs if not handled with retries and idempotency tokens. Schema evolution will break existing registries unless versioning is built in from day one. All of these are preventable with known patterns, but each requires deliberate implementation.

## Key Findings

### Recommended Stack

The stack is Node.js 20 LTS with ESM modules, distributed via npm. The CLI layer uses commander for argument parsing and the `bin` field for `npx dwa --install`. Parsing uses gray-matter (YAML front matter extraction) and the remark ecosystem (remark-parse + remark-gfm + unist-util-visit) for AST-based markdown table extraction. File operations use Node.js built-ins (fs/promises, path, os). TypeScript for development, compiled to JS for distribution.

**Core technologies:**
- **commander**: CLI argument parsing -- industry standard, clean API, sufficient for install + subcommands
- **gray-matter**: YAML front matter extraction -- de facto standard, 18M+ weekly downloads, handles edge cases
- **remark + remark-gfm**: Markdown AST parsing with GFM table support -- programmatic table extraction far more robust than regex
- **unist-util-visit**: AST traversal -- clean API for finding table nodes in parsed markdown
- **Node.js built-ins (fs/promises, path, os)**: File I/O and path resolution -- no external dependencies needed
- **ajv** (optional): JSON schema validation for registry files -- catches malformed data early
- **TypeScript + vitest**: Development tooling -- type safety for complex parsing logic, fast modern test runner

### Expected Features

**Must have (table stakes):**
- Spec parsing into structured data (YAML front matter + markdown table extraction)
- Idempotent updates (re-parse preserves runtime state like Linear IDs, PR links)
- Deliverable registry (.dwa/deliverables/DEL-###.json as single source of truth)
- Issue tracker sync (Linear -- create/update tickets per deliverable)
- Spec scaffolding (template instantiation for new features)
- Bounded execution context (GSD packets scoped to single deliverable)
- Drift detection (spec vs registry vs Linear comparison)
- PR description generation (auto-generate from deliverable metadata)

**Should have (differentiators):**
- Deliverables as first-class units (individual lifecycle per atomic work item)
- Multi-source spec import (Google Docs via MCP, not just local files)
- Registry-driven sync (spec changes propagate automatically to Linear)
- File-based git-trackable state (no external database, works offline)
- Template compliance validation (reject malformed specs with actionable errors)

**Defer (v2+):**
- Google Docs write-back (conflict resolution too complex)
- Multi-user collaboration (git handles sharing; single-engineer workflow for v1)
- Custom issue tracker adapters (Linear-only for v1; adapter pattern allows future extension)
- Deliverable dependency graphs (keep flat; users order in spec)
- Visual spec editor, mobile/web UI, CI/CD integration

### Architecture Approach

DWA uses a layered architecture: installer copies skill files to ~/.claude/dwa/, skills are markdown orchestrators invoked as /dwa:* commands, templates provide scaffolding structure, references share parsing/validation logic, and the .dwa/ registry stores per-project state. Skills communicate exclusively through file I/O (no shared memory), making them stateless and idempotent. External integrations (Linear, Google Docs) are bridged via MCP servers, keeping skills pure orchestration without API credentials.

**Major components:**
1. **Installer** (CLI) -- copies skills/templates/references to ~/.claude/dwa/, registers in settings.json
2. **Skills** (/dwa:init, parse, sync, start, check-drift) -- markdown-based orchestrators, each with single responsibility
3. **Templates** -- passive scaffolds for feature specs, deliverable JSON, execution packets, drift reports
4. **References** -- shared parsing patterns, validation schemas, integration logic used by multiple skills
5. **Registry** (.dwa/) -- project-local file-based state: feature.json, deliverables/*.json, packets/*.md
6. **MCP Bridges** -- Linear and Google Docs integration via dev-workflow-assistant extension

### Critical Pitfalls

1. **Markdown table parsing fragility** -- Use remark-gfm AST parsing, never regex. Test with malformed inputs, escaped pipes, empty cells, inconsistent formatting. Fail loudly with line numbers.
2. **Idempotency failures causing data loss or duplicates** -- Separate immutable spec fields from mutable runtime fields. Store linearIssueId in registry after creation. Use Linear's externalId for deduplication. Read-modify-write in single transaction.
3. **Linear API rate limits causing silent partial syncs** -- Implement exponential backoff on 429 responses, batch with p-limit, check rate limit headers, use externalId for idempotent creates.
4. **Schema evolution breaking existing registries** -- Include schemaVersion in every JSON file from day one. Implement read-time migrations. New fields are optional with defaults. Never remove or rename fields.
5. **MCP tool availability assumptions** -- Skills must check tool availability before invoking. Fail fast with helpful setup instructions. Core features (parsing, registry) work without integrations. Provide setup wizard that validates dependencies.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Package Bootstrap and Installer
**Rationale:** Nothing works without the installation mechanism. This is the foundation all other phases depend on.
**Delivers:** Working `npx dwa --install` that copies skills to ~/.claude/dwa/ and registers commands in settings.json. VERSION tracking. Uninstall/upgrade support.
**Addresses:** Installable skills package (differentiator), incremental adoption
**Avoids:** Path assumption pitfall (use os.homedir()), overwrite protection
**Stack:** Node.js 20, commander, fs/promises, path, os

### Phase 2: Templates and Spec Scaffolding
**Rationale:** Skills need templates to reference. Users need a starting point before they can parse anything.
**Delivers:** Feature Spec Template v2.0 (markdown with YAML front matter + Deliverables Table), deliverable JSON schema, execution packet template, drift report template. /dwa:init skill.
**Addresses:** Spec scaffolding (table stakes), template compliance validation
**Avoids:** Template overwrite (check existing files), encoding issues in templates

### Phase 3: Core Parsing Pipeline
**Rationale:** Parsing is the critical path -- every downstream feature depends on structured deliverables extracted from specs.
**Delivers:** /dwa:parse skill. YAML front matter extraction. Markdown table AST parsing. Deliverable JSON generation to .dwa/deliverables/. Schema validation.
**Addresses:** Spec parsing (table stakes), deliverable registry (table stakes), deliverables as first-class units (differentiator)
**Avoids:** Regex-based table parsing (use remark-gfm AST), YAML encoding issues (normalize, test edge cases), schema evolution (version from day one)
**Stack:** gray-matter, remark, remark-parse, remark-gfm, unist-util-visit, ajv

### Phase 4: Idempotent Registry Operations
**Rationale:** Before any sync or re-parse, idempotency must work or runtime state gets destroyed. This is the hardest logic problem and must be solid before external integrations.
**Delivers:** Safe re-parse that preserves runtime fields (linearIssueId, status, pr_url, completed_at). Atomic file writes. Conflict-free merge strategy.
**Addresses:** Idempotent updates (table stakes)
**Avoids:** Race conditions (atomic writes, centralized registry access), data loss on re-parse

### Phase 5: Linear Integration
**Rationale:** This is where user-visible value starts: deliverables become Linear tickets automatically.
**Delivers:** /dwa:sync skill. Linear issue creation per deliverable. Registry update with linearIssueId. Status sync. Field mapping configuration.
**Addresses:** Issue tracker sync (table stakes), registry-driven sync (differentiator)
**Avoids:** Rate limits (exponential backoff, p-limit batching), duplicate issues (externalId), field mapping assumptions (query workspace schema first)
**Stack:** Linear MCP (via dev-workflow-assistant)

### Phase 6: GSD Execution Packets
**Rationale:** Completes the core loop: spec -> deliverables -> Linear -> bounded AI execution context.
**Delivers:** /dwa:start DEL-### skill. Bounded context packets with deliverable AC, QA notes, dependencies. Stop conditions. Success criteria extraction.
**Addresses:** Bounded execution context (table stakes), GSD execution packets (differentiator)
**Avoids:** Context overflow (token budgeting, include only relevant section), scope creep in packets (strict template, explicit stop conditions)

### Phase 7: Drift Detection
**Rationale:** Only meaningful after execution has happened. Compares spec vs registry vs Linear to catch divergence.
**Delivers:** /dwa:check-drift skill. Spec-to-registry diff. Registry-to-Linear diff. Actionable drift report.
**Addresses:** Drift detection (table stakes), file-based git-trackable state
**Avoids:** False positives (semantic comparison, normalize before diff), noise (ignore whitespace/formatting changes)

### Phase 8: Polish and Extended Features
**Rationale:** Enhances the core loop with convenience features and expanded input sources.
**Delivers:** PR description generation. Google Docs import via MCP. Template validation. Help skill. Error DX improvements.
**Addresses:** PR description generation (table stakes), multi-source spec import (differentiator), template compliance validation
**Avoids:** Google Docs write-back (read-only import), scope creep into v2 features

### Phase Ordering Rationale

- **Phases 1-2 first** because skills and templates are prerequisites for everything. You cannot test parsing without an installed skill and a template to parse.
- **Phase 3 before 4** because idempotency logic requires a working parser to test against. Build the parser, then make it safe to re-run.
- **Phase 4 before 5** because Linear sync writes to the registry. If re-parsing can destroy Linear IDs, the sync is fragile. Idempotency must be solid first.
- **Phase 5 before 6** because execution packets reference Linear issue context. Having tickets created validates the full metadata chain.
- **Phase 7 after 6** because drift detection compares execution results against registry and spec. It only makes sense once deliverables have been executed.
- **Phase 8 last** because these are enhancements to a working core loop.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Parsing):** Need the exact Feature Spec Template v2.0 schema (column names, YAML fields) to finalize parser logic. Prototype with sample spec recommended.
- **Phase 4 (Idempotency):** Merge strategy edge cases (deliverable deletion, ID renumbering) need design spikes during planning.
- **Phase 5 (Linear):** Verify Linear API rate limits, GraphQL mutations for issue creation, externalId support, and MCP tool names against current documentation.
- **Phase 7 (Drift):** Multi-way semantic diff is non-trivial. May need phased implementation (spec-registry drift first, then registry-Linear drift).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Installer):** Well-documented npx + file copy pattern. Verified from GSD reference implementation.
- **Phase 2 (Templates):** Straightforward file scaffolding. No complex logic.
- **Phase 6 (Packets):** Template-driven generation with clear bounded context rules from GSD.
- **Phase 8 (Polish):** Standard CLI DX improvements, no novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries are industry standards (commander, gray-matter, remark). Verified from GSD reference. Only version numbers are estimates. |
| Features | MEDIUM | Feature categories well-reasoned from domain analysis. Not verified against 2026 competitor landscape (WebSearch unavailable). |
| Architecture | HIGH | Verified from direct GSD package inspection. Skills-as-markdown pattern is proven. File-based registry is straightforward. |
| Pitfalls | MEDIUM | Pitfalls drawn from domain expertise and known patterns. Linear API limits not verified against current docs. |

**Overall confidence:** MEDIUM-HIGH

The architecture and stack choices are high-confidence (verified from working GSD reference). Feature prioritization and pitfall identification are medium-confidence (based on domain expertise, not verified against current ecosystem).

### Gaps to Address

- **Feature Spec Template v2.0 exact schema:** Parser logic depends on knowing exact column names, YAML fields, and table structure. Must be defined before Phase 3 implementation.
- **Linear API current state:** Rate limits, GraphQL mutations, externalId support, and MCP tool names should be verified against official docs before Phase 5.
- **Idempotency edge cases:** What happens when deliverables are deleted from spec? When IDs are renumbered? When a deliverable is split into two? Design decisions needed before Phase 4.
- **GSD packet contract:** Exact format expected by GSD for execution packets. What sections are required? What token budget? Verify against GSD docs before Phase 6.
- **settings.json registration format:** How Claude Code discovers custom skills. Verify the exact JSON structure for skill registration during Phase 1.
- **npm version verification:** All library versions are estimates from training data. Run `npm view <package> version` before finalizing package.json.

## Sources

### Primary (HIGH confidence)
- GSD package structure at /Users/jedwards/.claude/get-shit-done/ -- installation pattern, file layout, skill format, VERSION tracking
- DWA PROJECT.md at /Users/jedwards/workspace/JobPrep/dwa/.planning/PROJECT.md -- project requirements, scope

### Secondary (MEDIUM confidence)
- Training knowledge of commander, gray-matter, remark ecosystem -- library capabilities and APIs
- Training knowledge of Linear GraphQL API -- mutations, rate limits, externalId
- Training knowledge of Claude Code skills architecture -- stateless orchestrators, MCP integration
- Domain expertise in file-based registries, markdown parsing, idempotency patterns

### Tertiary (LOW confidence)
- Specific library version numbers -- estimates from training data, need npm registry verification
- 2026 ecosystem landscape -- WebSearch unavailable, potential competitors unknown
- Linear API current rate limits -- training knowledge may be outdated

---
*Research completed: 2026-01-24*
*Ready for roadmap: yes*
