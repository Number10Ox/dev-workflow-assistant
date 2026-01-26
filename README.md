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

### Setup Wizard

Run the interactive setup wizard to configure optional features:

```bash
npx dwa --setup
```

This presents a menu to select which integrations to enable. You can also set up specific features directly:

```bash
npx dwa --setup linear       # Linear only
npx dwa --setup google-docs  # Google Docs only
```

### Linear Integration

Sync deliverables as Linear issues for project tracking.

**Setup:**

1. Run the setup wizard:
   ```bash
   npx dwa --setup linear
   ```
   This installs the `jedwards.linear-tracker-provider` VS Code extension.

2. Configure your Linear API key:
   - Open VS Code Settings
   - Search for "Linear Tracker"
   - Enter your Linear API key (get one from Linear → Settings → API)

3. Get your Linear project ID:
   - Open your Linear project
   - Copy the project ID from the URL: `https://linear.app/team/project/<project-id>`

**Usage:**

```bash
# Sync all deliverables to Linear
npx dwa --sync-linear --project <project-id>

# Preview without making changes
npx dwa --sync-linear --project <project-id> --dry-run

# Sync specific deliverables only
npx dwa --sync-linear --project <project-id> --deliverables DEL-001,DEL-002
```

### Google Docs Integration

Import feature specs from Google Docs as the canonical source.

**Setup:**

1. Run the setup wizard:
   ```bash
   npx dwa --setup google-docs
   ```
   This installs the `jedwards.gworkspace-provider` VS Code extension.

2. Authenticate with Google:
   - Open VS Code Command Palette (Cmd/Ctrl+Shift+P)
   - Run "Google Workspace: Sign In"
   - Complete OAuth flow in browser

**Usage:**

```bash
# Import a Google Doc as feature-spec.md
npx dwa --import-gdoc "https://docs.google.com/document/d/1abc123..."

# Import to a specific path
npx dwa --import-gdoc "https://docs.google.com/document/d/1abc123..." --out specs/my-feature.md
```

The imported spec includes DWA markers for change detection on re-import.

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
