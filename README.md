# DWA - Dev Workflow Assistant

AI coding assistants are powerful but unconstrained. Give one a feature spec and it builds something. It also drifts from the spec, makes undocumented decisions, and loses context between sessions. The bigger the feature, the worse this gets.

DWA constrains AI-assisted development to bounded, traceable units of work. Define deliverables in a markdown spec. DWA parses them into a registry, generates scoped execution packets, and tracks drift between what was specified and what was built.

## How It Works

```
Feature Spec (markdown)
    │
    ▼
AST Parse (remark + unified)
    │
    ▼
Deliverable Registry (.dwa/deliverables/*.json)
    │
    ▼
Execution Packets (bounded context for AI implementation)
    │
    ▼
Drift Tracking (spec vs. implementation divergence)
```

The CLI handles deterministic work: parsing, validation, registry management, issue sync, staleness detection.

Claude Code skills handle LLM judgment: drafting technical designs, enriching packets with context, proposing drift fixes, generating PR descriptions.

This separation is intentional. Deterministic operations shouldn't burn tokens. LLM judgment shouldn't be faked with templates.

## Design Decisions

**AST-based parsing, not regex.** Feature specs are structured markdown with YAML frontmatter and deliverable tables. DWA uses remark and unified to extract deliverables reliably regardless of formatting variation.

**Idempotent operations.** Re-parsing is safe. Registry updates preserve runtime fields (completion status, PR links, drift logs). Schema versioning handles upgrades across DWA versions.

**Bounded AI execution.** Execution packets give an AI assistant exactly the context it needs for one deliverable: goal, acceptance criteria categorized by priority, guardrails from the technical design, and provenance (git SHAs, spec versions). No more, no less.

**Drift detection.** Structural comparison between spec and implementation surfaces divergence early. Drift logs are per-deliverable and append-only. An audit trail of how implementation evolved against the contract.

**Pluggable integrations.** Issue tracker sync (Linear implemented, JIRA interface designed), Google Docs import, and a setup wizard with graceful degradation for optional features.

## What's Here

- 49 source files across CLI commands, parser, packet generator, drift tracker, and integrations
- 458 tests using node:test. Zero external test dependencies. Fixture-based, temp directory isolation.
- Atomic file writes (write-file-atomic) to prevent corruption during registry updates
- Actionable error codes (DWA-E041, DWA-E045) with line numbers for validation failures
- 6 Claude Code skills for the LLM-assisted parts of the workflow
- Schema versioning with migration support across releases

## Status

Phases 1 through 7 are complete and tested. Two phases remain designed but unbuilt.

| Phase | Status | What It Does |
|-------|--------|-------------|
| 1. Bootstrap & Installer | Done | `npx dwa --install`, upgrade, uninstall with schema versioning |
| 2. Spec & TDD Scaffolding | Done | Template-based spec and technical design creation |
| 3. Parsing & Registry | Done | AST extraction, validation, safe re-parse, frontmatter handling |
| 4. Execution Packets | Done | Bounded-context generation with provenance and constraint fetching |
| 5. Drift Tracking | Done | Per-deliverable drift logs, structural comparison, rebuild logic |
| 6. Linear Integration | Done | Bi-directional sync, deduplication, external ID tracking, dry-run mode |
| 7. Polish & Extensions | Done | Google Docs import, PR descriptions, setup wizard, maintenance commands |
| 8. Ralph Runner | Designed | Autonomous agent loop: iterate until tests pass and acceptance criteria met |
| 9. JIRA Provider | Designed | Prove extensibility via second issue tracker backend |

## What I Learned

I built DWA to structure AI-assisted feature development. Then I spent two months building AI agent systems where LLM agents are first-class actors, with 1,300+ tests across the ecosystem. Working on the other side of the problem taught me things about AI collaboration that tooling alone can't solve.

The failure modes are different than I expected. AI assistants don't just drift from specs. They accumulate rules in response to feedback until the output is lifeless. They apply point fixes instead of pattern fixes. They lose lessons between sessions even when you document them. Some of these are tooling problems. DWA addresses drift and scope. Some are workflow problems. Some are fundamental to how LLMs process context.

## Usage

### Quick Start

```bash
npm install dwa
npx dwa --install    # Install skills and templates
npx dwa --status     # Verify installation
```

### Core Workflow

```bash
# 1. Create a feature spec
/dwa-create-spec "User Authentication"

# 2. Define deliverables in the generated feature-spec.md table

# 3. Parse spec into registry
npx dwa --parse

# 4. Generate execution packet and start work
/dwa-start DEL-001

# 5. Complete with evidence
/dwa-complete DEL-001 --pr https://github.com/org/repo/pull/123
```

### Optional Integrations

```bash
npx dwa --setup                              # Interactive setup wizard
npx dwa --setup linear                       # Linear (auto-detects mode)
npx dwa --setup linear --mode=direct         # Linear without VS Code (API key in ~/.dwa/config.json)
npx dwa --setup linear --mode=vscode-bridge  # Linear via the VS Code extension
npx dwa --setup google-docs                  # Google Docs import (VS Code only)
```

**Linear without VS Code.** `--mode=direct` prompts for an API key, validates it
against Linear, and writes it to `~/.dwa/config.json` (mode `0600` on POSIX).
Subsequent `npx dwa --sync-linear` calls run from any terminal — no extension
host required. Resolution priority: `LINEAR_API_KEY` env var → file →
actionable error. Force the path explicitly with `DWA_LINEAR_MODE=direct`
or `DWA_LINEAR_MODE=bridge` if both are configured.

### Commands

| Command | Description |
|---------|-------------|
| `dwa --install` | Install skills, templates, and references |
| `dwa --upgrade` | Upgrade existing installation |
| `dwa --uninstall` | Remove DWA completely |
| `dwa --status` | Show configuration status |
| `dwa --parse` | Parse spec and update registry |
| `dwa --sync-linear` | Sync deliverables to Linear issues |
| `dwa --import-gdoc <url>` | Import Google Doc as canonical spec |
| `dwa --validate` | Check DWA state integrity |
| `dwa --stats` | Show deliverable and drift statistics |
| `dwa --clean` | Remove orphaned deliverables |

### Claude Code Skills

| Skill | Description |
|-------|-------------|
| `/dwa-create-spec` | Scaffold a new feature spec |
| `/dwa-draft-tdd` | Generate technical design document |
| `/dwa-enrich-packet` | Add implementation context to execution packet |
| `/dwa-generate-pr-description` | Create PR description from deliverable |
| `/dwa-propose-drift-patches` | Suggest spec updates from code drift |
| `/dwa-summarize-drift` | Summarize divergence for PR comments or stakeholders |

## Requirements

- Node.js >= 18.0.0
- Claude Code CLI (for skills)

## License

MIT
