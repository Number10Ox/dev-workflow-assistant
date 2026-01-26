# DWA - Dev Workflow Assistant

A deliverable-driven development framework for Claude Code. DWA helps you break features into trackable deliverables, generate execution packets for AI-assisted implementation, and maintain traceability from spec to code.

## Quick Start

```bash
# Install DWA in your project
npm install dwa

# Install skills and templates globally
npx dwa --install

# Check installation status
npx dwa --status
```

## Core Workflow

DWA follows a **spec → parse → start → complete** workflow:

### 1. Create a Feature Spec

Use the `/dwa-create-spec` skill in Claude Code:

```
/dwa-create-spec "User Authentication"
```

This creates:
- `feature-spec.md` - Your feature specification with a deliverables table
- `.dwa/feature.json` - Feature metadata
- `.gitignore` entry for `.dwa/`

### 2. Define Deliverables

Edit `feature-spec.md` to add deliverables to the table:

```markdown
## Deliverables

| Deliverable ID | User Story | Description | Acceptance Criteria | QA Notes | Dependencies |
|----------------|------------|-------------|---------------------|----------|--------------|
| DEL-001 | As a user, I want to login... | Implement login form | C1: Valid creds redirect. F1: Invalid shows error. | Test rate limiting | - |
| DEL-002 | As a user, I want to logout... | Add logout button | C1: Clears session. C2: Redirects to home. | Verify token cleared | DEL-001 |
```

**Acceptance Criteria Prefixes:**
- `C#` - Critical (must have)
- `F#` - Functional (should have)
- `N#` - Nice-to-have (could have)
- `E#` - Edge cases

### 3. Parse the Spec

```bash
npx dwa --parse
```

This extracts deliverables into `.dwa/deliverables/DEL-###.json` registry files.

### 4. Start a Deliverable

Use the `/dwa-start` skill or generate a packet manually:

```bash
# In Claude Code
/dwa-start DEL-001

# Or via CLI (coming soon)
npx dwa start DEL-001
```

This generates an **execution packet** at `.dwa/packets/DEL-001.md` containing:
- Guardrails (MUST/MUST NOT from TDD)
- Goal and user story
- Categorized acceptance criteria
- QA notes
- Provenance (git SHAs, versions)

### 5. Implement with the Packet

Give the packet to Claude Code:

```
@.dwa/packets/DEL-001.md implement this deliverable
```

The packet constrains Claude to the specific deliverable scope.

### 6. Complete the Deliverable

After implementation and PR merge:

```
/dwa-complete DEL-001 --pr https://github.com/org/repo/pull/123
```

This records completion evidence in the registry.

## CLI Commands

### Installation & Status

| Command | Description |
|---------|-------------|
| `dwa --install` | Install skills, templates, and references |
| `dwa --upgrade` | Upgrade existing installation |
| `dwa --uninstall` | Remove DWA completely |
| `dwa --status` | Show configuration status |

### Feature Management

| Command | Description |
|---------|-------------|
| `dwa --parse` | Parse spec and update registry (coming soon) |
| `dwa --setup` | Run interactive setup wizard |
| `dwa --setup linear` | Configure Linear integration |
| `dwa --setup google-docs` | Configure Google Docs import |

### Maintenance

| Command | Description |
|---------|-------------|
| `dwa --validate` | Check DWA state integrity |
| `dwa --stats` | Show statistics (deliverables, packets, drift) |
| `dwa --clean` | Remove orphaned deliverables (30+ days old) |
| `dwa --clean-all` | Remove all `.dwa/` state (auto-backups first) |
| `dwa --clean-all --no-backup` | Remove without backup |

### Integrations

| Command | Description |
|---------|-------------|
| `dwa --sync-linear` | Sync deliverables to Linear issues |
| `dwa --import-gdoc <url>` | Import Google Doc as canonical spec |

## Claude Code Skills

After `dwa --install`, these skills are available:

| Skill | Description |
|-------|-------------|
| `/dwa-create-spec` | Scaffold a new feature spec |
| `/dwa-draft-tdd` | Generate technical design document |
| `/dwa-enrich-packet` | Add context to execution packet |
| `/dwa-generate-pr-description` | Create PR description from deliverable |
| `/dwa-propose-drift-patches` | Suggest spec updates from code changes |
| `/dwa-summarize-drift` | Summarize drift between spec and implementation |

## Project Structure

```
your-project/
├── feature-spec.md          # Feature specification (source of truth)
├── docs/
│   └── tdds/
│       └── feature-name.md  # Technical design document (optional)
└── .dwa/                    # DWA state (gitignored)
    ├── feature.json         # Feature metadata
    ├── deliverables/        # Registry files
    │   ├── DEL-001.json
    │   └── DEL-002.json
    └── packets/             # Execution packets
        ├── DEL-001.md
        └── DEL-002.md
```

## Optional Integrations

### Linear

Sync deliverables as Linear issues:

```bash
dwa --setup linear
dwa --sync-linear --project <project-id>
```

### Google Docs

Import specs from Google Docs:

```bash
dwa --setup google-docs
dwa --import-gdoc "https://docs.google.com/document/d/..."
```

## Staleness Detection

DWA tracks when your spec changes after parsing. If you modify `feature-spec.md`:

```bash
# This will error with DWA-E045
npx dwa start DEL-001

# Re-parse to update registry
npx dwa --parse

# Or force generation (packet includes warning)
npx dwa start DEL-001 --force
```

## Requirements

- Node.js >= 18.0.0
- Claude Code CLI (for skills)

## License

MIT
