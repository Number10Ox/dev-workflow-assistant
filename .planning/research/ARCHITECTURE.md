# Architecture Research: Claude Code Skills Package with File-Based Registry

**Domain:** Installable Claude Code skills package
**Researched:** 2026-01-24
**Confidence:** HIGH

## System Overview

DWA implements a layered architecture with clear separation between installation, skill invocation, template management, and registry operations.

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INVOCATION                          │
│  /dwa:init  /dwa:parse  /dwa:sync  /dwa:start  etc.      │
├─────────────────────────────────────────────────────────────┤
│                     SKILL LAYER                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ init.md  │  │ parse.md │  │  sync.md │  │ start.md │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │              │             │           │
│       └─────────────┴──────────────┴─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│                     SHARED CONTEXT                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ references/ (parsing patterns, validation schemas)  │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    TEMPLATE LAYER                            │
│  ┌──────────────────────┐  ┌──────────────────────────┐     │
│  │ Feature Spec v2.0    │  │ GSD Execution Packet     │     │
│  └──────────────────────┘  └──────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                    FILE REGISTRY (.dwa/)                     │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │ feature   │  │ deliverables/│  │ packets/        │      │
│  │ .json     │  │ DEL-###.json │  │ DEL-###.md      │      │
│  └───────────┘  └──────────────┘  └─────────────────┘      │
└─────────────────────────────────────────────────────────────┘
       ↓                    ↓                    ↓
┌──────────────┐   ┌──────────────┐    ┌─────────────────┐
│ Google Docs  │   │    Linear    │    │       GSD       │
│     MCP      │   │     MCP      │    │   (execution)   │
└──────────────┘   └──────────────┘    └─────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| **Installer** | Copy skill files to ~/.claude/dwa/, register in settings.json | CLI entry point (npx) |
| **Skills** | Orchestrate workflow steps, parse user commands, coordinate operations | ~/.claude/dwa/skills/*.md |
| **Templates** | Provide scaffolds for specs, packets, and structured documents | ~/.claude/dwa/templates/*.md |
| **References** | Shared parsing logic, validation patterns, schema definitions | ~/.claude/dwa/references/*.md |
| **Registry** | Store parsed deliverables, track status, maintain single source of truth | PROJECT/.dwa/ (user's project) |
| **Integrations** | Bridge to external systems (Linear, Google Docs, GSD) | VS Code extension + MCP |

## Recommended Package Structure

Analysis of GSD reveals the standard pattern for Claude Code skills packages. DWA should follow this proven structure:

```
~/.claude/dwa/                    # Installation target
├── VERSION                        # Version string (e.g., "1.0.0")
├── CHANGELOG.md                   # Release history
├── skills/                        # User-invocable commands (/dwa:*)
│   ├── init.md                    # Initialize feature from template or Docs
│   ├── parse.md                   # Extract deliverables to registry
│   ├── sync.md                    # Sync artifacts (Linear, registry)
│   ├── start.md                   # Generate GSD execution packet
│   ├── check-drift.md             # Run drift detection
│   └── help.md                    # Usage guide
├── templates/                     # File templates for scaffolding
│   ├── feature-spec-v2.md         # Feature Spec Template v2.0
│   ├── deliverable.json           # Deliverable registry entry schema
│   ├── execution-packet.md        # GSD-compatible packet format
│   └── drift-report.md            # Drift check output format
├── references/                    # Shared context for skills
│   ├── parsing-patterns.md        # Markdown table parser, YAML frontmatter
│   ├── validation-schemas.md      # JSON schemas for registry files
│   ├── linear-integration.md      # Linear API patterns via MCP
│   └── gsd-integration.md         # GSD packet generation patterns
└── workflows/                     # Multi-step orchestrations (if needed)
    └── full-feature-workflow.md   # Init → Parse → Sync → Start (optional)
```

### Structure Rationale

**skills/ vs workflows/:**
- **skills/**: Single-purpose, user-invocable commands. Each skill has one clear job.
- **workflows/**: Multi-step orchestrations (like GSD's execute-plan.md). Only needed if you have complex multi-agent coordination.
- **DWA decision**: Start with skills/ only. Add workflows/ if orchestration complexity demands it.

**templates/ separation:**
- Templates are passive artifacts, not executable logic.
- Skills reference templates (e.g., init.md copies feature-spec-v2.md).
- Clean separation: skills orchestrate, templates provide structure.

**references/ for shared logic:**
- Parsing patterns, validation rules, integration patterns used by multiple skills.
- Skills use @references/parsing-patterns.md for consistent parsing logic.
- Avoids duplication across skill files.

**No agents/ directory:**
- GSD has agents/ for sub-agents (gsd-planner, gsd-executor, gsd-researcher).
- DWA doesn't spawn sub-agents in v1 — orchestration is sequential.
- Only add agents/ if you need parallel research or complex delegation.

## File Registry Architecture (.dwa/)

The file-based registry lives in the user's project, not in the installed package. This is the single source of truth for all workflow state.

```
PROJECT_ROOT/
├── .dwa/                          # Registry root (created by /dwa:init)
│   ├── feature.json               # Feature metadata (title, spec path, Linear project)
│   ├── deliverables/              # Parsed deliverable entries
│   │   ├── DEL-001.json           # Individual deliverable (immutable from spec)
│   │   ├── DEL-002.json
│   │   └── ...
│   ├── packets/                   # Generated execution artifacts
│   │   ├── DEL-001.md             # GSD-compatible execution packet
│   │   ├── DEL-002.md
│   │   └── ...
│   ├── drift-report.md            # Latest drift check output
│   └── .dwa-version              # Version of DWA that created registry
└── feature-spec.md                # The canonical feature spec (source of truth)
```

### Registry Schema Design

**feature.json** (feature-level metadata):
```json
{
  "title": "Feature name",
  "spec_path": "feature-spec.md",
  "linear_project_id": "PRJ-123",
  "created_at": "2026-01-24T10:00:00Z",
  "last_parsed": "2026-01-24T10:05:00Z"
}
```

**deliverables/DEL-###.json** (per-deliverable state):
```json
{
  "id": "DEL-001",
  "title": "Implement user authentication",
  "user_story": "As a user...",
  "acceptance_criteria": ["AC1", "AC2"],
  "qa_notes": "Test with...",
  "dependencies": ["DEL-002"],
  "estimate": "3 days",
  "linear_issue_id": "TEAM-123",
  "linear_url": "https://linear.app/...",
  "status": "in-progress",
  "pr_url": null,
  "completed_at": null
}
```

**Immutability Contract:**
- Fields from spec (title, user_story, AC, QA notes) are immutable.
- Runtime fields (status, linear_issue_id, pr_url) are mutable.
- Parsing is idempotent: re-parsing updates runtime fields only if spec unchanged.

## Architectural Patterns

### Pattern 1: Skill as Orchestrator

**What:** Each skill file is a self-contained orchestrator with clear input/output contract.

**Structure:**
```markdown
<purpose>
One-sentence description of what this skill does.
</purpose>

<required_reading>
@/Users/username/.claude/dwa/references/parsing-patterns.md
@/Users/username/.claude/dwa/templates/feature-spec-v2.md
</required_reading>

<context>
@.dwa/feature.json
@feature-spec.md
</context>

<process>
Step-by-step execution logic with verification gates.
</process>
```

**When to use:** All user-facing skills (/dwa:init, /dwa:parse, etc.).

**Trade-offs:**
- **Pro:** Each skill is independently understandable.
- **Pro:** Skills can be tested in isolation.
- **Con:** Duplication if multiple skills need same setup logic (mitigated by references/).

### Pattern 2: Template-Based Scaffolding

**What:** Skills generate files by copying/transforming templates, not hard-coding structure.

**Implementation:**
```markdown
<task type="auto">
  <name>Scaffold feature spec from template</name>
  <files>feature-spec.md</files>
  <action>
Copy template from:
@/Users/username/.claude/dwa/templates/feature-spec-v2.md

Replace placeholders:
- {{FEATURE_TITLE}} → user-provided title
- {{DATE}} → current date
- {{AUTHOR}} → git config user.name

Write to: feature-spec.md
  </action>
  <verify>grep "{{" feature-spec.md should return nothing</verify>
  <done>feature-spec.md exists with no template placeholders</done>
</task>
```

**When to use:** Any file generation (specs, packets, drift reports).

**Trade-offs:**
- **Pro:** Template updates benefit all users (upgrade ~/.claude/dwa/).
- **Pro:** Clear separation: logic in skills, structure in templates.
- **Con:** Versioning complexity if template schema changes (handle with .dwa-version tracking).

### Pattern 3: Idempotent Registry Operations

**What:** Parsing and syncing operations can run multiple times safely. State converges, never diverges.

**Implementation strategy:**
```typescript
// Pseudo-code showing idempotency pattern
function parseDeliverables(specPath: string): void {
  const spec = readMarkdownFile(specPath);
  const deliverables = extractDeliverablesTable(spec);

  for (const del of deliverables) {
    const existingPath = `.dwa/deliverables/${del.id}.json`;
    const existing = fileExists(existingPath) ? readJSON(existingPath) : null;

    if (existing) {
      // Preserve runtime fields
      del.linear_issue_id = existing.linear_issue_id;
      del.linear_url = existing.linear_url;
      del.status = existing.status;
      del.pr_url = existing.pr_url;
      del.completed_at = existing.completed_at;
    }

    writeJSON(existingPath, del);
  }
}
```

**When to use:** All registry write operations (parse, sync).

**Trade-offs:**
- **Pro:** Safe to re-run after spec edits, no data loss.
- **Pro:** Recovery from partial failures is trivial (just re-run).
- **Con:** Must track immutable vs mutable fields carefully.

### Pattern 4: File-Based Inter-Skill Communication

**What:** Skills communicate via registry files, not in-memory state.

**Flow:**
```
/dwa:init
  ↓ writes: .dwa/feature.json, feature-spec.md

/dwa:parse
  ↓ reads: feature-spec.md
  ↓ writes: .dwa/deliverables/*.json

/dwa:sync
  ↓ reads: .dwa/deliverables/*.json
  ↓ writes: .dwa/deliverables/*.json (updates linear_issue_id)

/dwa:start DEL-001
  ↓ reads: .dwa/deliverables/DEL-001.json, feature-spec.md
  ↓ writes: .dwa/packets/DEL-001.md
```

**When to use:** All skill interactions.

**Trade-offs:**
- **Pro:** Skills are truly independent (no shared runtime state).
- **Pro:** State is git-trackable and human-inspectable.
- **Pro:** Works seamlessly with MCP integrations (read files, call APIs).
- **Con:** File I/O overhead (negligible for small registries).

### Pattern 5: External Integration via MCP Bridges

**What:** Skills don't call APIs directly. They read/write registry files. Separate MCP servers handle external sync.

**Architecture:**
```
Skill (parse.md)
  ↓ writes
.dwa/deliverables/DEL-001.json
  ↓ read by
Linear MCP Server
  ↓ creates/updates
Linear Issue (TEAM-123)
  ↓ writes back
.dwa/deliverables/DEL-001.json (with linear_issue_id)
```

**When to use:** All external integrations (Linear, Google Docs, GitHub).

**Trade-offs:**
- **Pro:** Skills are pure orchestration, no API credentials.
- **Pro:** MCP servers can be reused across tools.
- **Pro:** Offline-first: skills work without network, sync later.
- **Con:** Requires MCP infrastructure (dependency on dev-workflow-assistant extension).

### Pattern 6: Bounded Context Packet Generation

**What:** Execution packets include ONLY the context needed for a single deliverable, not entire project.

**Structure:**
```markdown
# Execution Packet: DEL-001 — Implement User Authentication

<objective>
Implement user authentication as described in deliverable DEL-001.
</objective>

<context>
Feature Spec (relevant section):
@feature-spec.md#user-authentication

Deliverable Details:
@.dwa/deliverables/DEL-001.json

Dependencies (completed):
@.dwa/deliverables/DEL-002.json (database schema)
</context>

<success_criteria>
- User can log in with email/password
- Session persists across page reloads
- AC1: Login form validates email format
- AC2: Failed login shows error message
</success_criteria>

<stop_conditions>
- User authentication works end-to-end
- All acceptance criteria pass
- Tests written and passing
</stop_conditions>
```

**When to use:** Generating GSD execution packets.

**Trade-offs:**
- **Pro:** Bounded context prevents scope creep.
- **Pro:** GSD execution stays focused on deliverable.
- **Con:** Must carefully include dependency context (DEL-002 if DEL-001 depends on it).

## Data Flow

### Primary Workflow: Feature → Deliverables → Linear → Execution

```
1. User creates/imports feature spec
   /dwa:init
     ↓
   feature-spec.md (canonical source)
   .dwa/feature.json (metadata)

2. Parse deliverables from spec
   /dwa:parse
     ↓ reads feature-spec.md
     ↓ extracts Deliverables Table
     ↓
   .dwa/deliverables/DEL-*.json (registry)

3. Sync to Linear
   /dwa:sync
     ↓ reads .dwa/deliverables/*.json
     ↓ calls Linear MCP
     ↓ creates/updates issues
     ↓
   .dwa/deliverables/*.json (updated with linear_issue_id)

4. Start a deliverable
   /dwa:start DEL-001
     ↓ reads .dwa/deliverables/DEL-001.json
     ↓ reads feature-spec.md (relevant section)
     ↓ generates bounded packet
     ↓
   .dwa/packets/DEL-001.md (GSD-ready)

5. User executes with GSD
   (outside DWA — GSD reads packet and executes)

6. Check for drift
   /dwa:check-drift
     ↓ reads feature-spec.md
     ↓ reads .dwa/deliverables/*.json
     ↓ compares spec vs registry
     ↓
   .dwa/drift-report.md (actionable diffs)
```

### State Transitions

Deliverable lifecycle:
```
[not-started] → [in-progress] → [completed]
     ↓                ↓               ↓
  parsed        packet generated   PR merged
```

Status field updates:
- **not-started**: Default after parsing
- **in-progress**: Set by /dwa:start or manual status update
- **completed**: Set by drift check (detects merged PR) or manual

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 deliverables | Current architecture is perfect. Single feature.json, flat deliverables/ directory. |
| 10-50 deliverables | Still flat structure. Consider deliverables/by-status/ subdirs if browsing becomes unwieldy. |
| 50+ deliverables | Likely multiple features. Add .dwa/features/*.json with per-feature deliverables/ subdirs. |

### Performance Characteristics

**Registry operations:**
- Parse: O(n) where n = rows in Deliverables Table. Typical: <100ms for 20 deliverables.
- Sync: O(n) API calls to Linear. Batching possible but likely unnecessary (Linear is fast).
- Drift check: O(n) file reads + O(n) spec comparisons. Typical: <500ms for 20 deliverables.

**File I/O:**
- All operations are file-based, so git performance matters.
- Large registries (>1000 files) should use .dwa/features/ sharding.

### Scaling Priorities

1. **First bottleneck:** Linear API rate limits (600 requests/hour).
   - **Mitigation:** Batch issue creation/updates (10 at a time).

2. **Second bottleneck:** Spec parsing for large tables (>100 deliverables).
   - **Mitigation:** Cache parsed results in .dwa/.cache/ with checksum validation.

## Anti-Patterns

### Anti-Pattern 1: Mixing Registry and Spec Truth

**What people do:** Store deliverable details in both feature-spec.md and .dwa/deliverables/*.json with divergent content.

**Why it's wrong:** Creates sync conflicts. Which is the source of truth for acceptance criteria? If they differ, parsing becomes non-deterministic.

**Do this instead:**
- **Spec is immutable truth:** Title, user story, AC, QA notes live ONLY in spec.
- **Registry adds runtime state:** linear_issue_id, status, pr_url live ONLY in registry.
- **Parsing contract:** Registry copies spec fields verbatim. Never edit spec fields in registry manually.

### Anti-Pattern 2: Stateful Skills

**What people do:** Store state in memory across skill invocations (e.g., "remember last parsed deliverable ID").

**Why it's wrong:** Claude Code skills are stateless by design. Each invocation is a fresh context. In-memory state is lost.

**Do this instead:**
- **File-based state:** Write state to registry (.dwa/last-action.json if needed).
- **Idempotent operations:** Skills should work correctly regardless of prior invocations.
- **Discovery over memory:** Skills discover state by reading registry, not remembering.

### Anti-Pattern 3: Embedding Large Context in Packets

**What people do:** Include entire feature spec in every execution packet.

**Why it's wrong:**
- Wastes tokens (GSD reads packet as context).
- Increases confusion (executor sees irrelevant deliverables).
- Violates bounded context principle.

**Do this instead:**
- **Include only relevant section:** Use spec anchors (feature-spec.md#section-name).
- **Reference dependencies explicitly:** If DEL-001 depends on DEL-002, include DEL-002.json in context.
- **Trust GSD to ask:** If executor needs more context, they can read spec directly.

### Anti-Pattern 4: Manual JSON Editing

**What people do:** Hand-edit .dwa/deliverables/DEL-001.json to fix parsing errors.

**Why it's wrong:**
- Breaks idempotency (next parse will overwrite changes).
- Creates drift between spec and registry.
- Bypasses validation.

**Do this instead:**
- **Fix the source:** Edit feature-spec.md Deliverables Table, then re-run /dwa:parse.
- **Add validation:** Skills should validate spec format BEFORE writing registry.
- **Runtime fields only:** Only edit status, pr_url, etc. (fields NOT in spec).

### Anti-Pattern 5: Skill Chaining via Side Effects

**What people do:** /dwa:sync implicitly runs /dwa:parse if deliverables/ is empty.

**Why it's wrong:**
- Violates single responsibility (sync should sync, not parse).
- Creates hidden dependencies (user doesn't know sync will parse).
- Debugging becomes harder (which skill caused the error?).

**Do this instead:**
- **Explicit prerequisites:** /dwa:sync checks if deliverables/ exists, errors if not: "Run /dwa:parse first."
- **Workflow skills:** If chaining is needed, create /dwa:full-workflow that explicitly calls init → parse → sync → start.
- **User clarity:** Better to require two commands than hide one inside the other.

## Installation Architecture

### NPX Installation Flow

```bash
npx dwa --install
```

**Steps:**
1. **Download package:** npm downloads dwa package to temp directory.
2. **Run installer script:** package.json "bin" points to install.js.
3. **Copy skill files:**
   ```javascript
   const targetDir = path.join(os.homedir(), '.claude', 'dwa');
   fs.cpSync(path.join(__dirname, 'dist'), targetDir, { recursive: true });
   ```
4. **Register skills:** Update ~/.claude/settings.json to add /dwa:* commands.
   ```json
   {
     "customInstructions": {
       "dwa:init": "file:///Users/username/.claude/dwa/skills/init.md",
       "dwa:parse": "file:///Users/username/.claude/dwa/skills/parse.md",
       "dwa:sync": "file:///Users/username/.claude/dwa/skills/sync.md"
     }
   }
   ```
5. **Success message:** Print installed skills list and usage guide.

### Version Management

**Upgrade flow:**
```bash
npx dwa --upgrade
```

**Steps:**
1. Check ~/.claude/dwa/VERSION vs latest npm version.
2. Backup existing skills (if user customized).
3. Overwrite with new version.
4. Compare .dwa-version in project vs installed version.
5. Offer migration if registry schema changed.

### Uninstallation

```bash
npx dwa --uninstall
```

**Steps:**
1. Remove ~/.claude/dwa/ directory.
2. Remove skill registrations from settings.json.
3. Warn user: "Project registries (.dwa/) are preserved. Delete manually if needed."

## Integration Points

### External Services

| Service | Integration Pattern | Location | Notes |
|---------|---------------------|----------|-------|
| Google Docs | MCP (read-only) | dev-workflow-assistant extension | Import spec from Docs via /dwa:init --from-docs |
| Linear | MCP (read/write) | dev-workflow-assistant extension | Create/update issues, sync status |
| GSD | File-based (read) | ~/.claude/get-shit-done/ | Packets generated by DWA, executed by GSD |
| GitHub | Future (via Linear or direct MCP) | TBD | PR creation, status sync |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Installer ↔ Settings | JSON file writes | settings.json registration must be idempotent |
| Skills ↔ Templates | File copy | Skills read from ~/.claude/dwa/templates/ |
| Skills ↔ References | Context inclusion | @references/*.md included in skill prompts |
| Skills ↔ Registry | File I/O | Read/write .dwa/*.json via standard fs operations |
| Registry ↔ MCP | File reads → API calls | MCP servers watch .dwa/ or triggered by skills |

## Build Order Implications

Based on this architecture, recommended build phases:

### Phase 1: Foundation (installer + basic registry)
**Why first:** Can't test skills without installation mechanism.
- Installer CLI (npx entry point)
- settings.json registration
- Basic registry structure (.dwa/feature.json, deliverables/)
- VERSION and .dwa-version tracking

**Validation:** npx dwa --install succeeds, ~/.claude/dwa/ exists.

### Phase 2: Template Layer
**Why next:** Skills need templates to scaffold files.
- Feature Spec Template v2.0 (markdown with YAML frontmatter)
- Deliverable JSON schema
- Execution packet template
- Drift report template

**Validation:** Templates have no placeholders, follow schema.

### Phase 3: Core Skills (init, parse)
**Why next:** These enable the basic flow (spec → registry).
- /dwa:init (scaffold or import from Docs)
- /dwa:parse (extract Deliverables Table → .dwa/deliverables/)
- Parsing patterns reference (markdown table parser, YAML parser)
- Validation schemas reference

**Validation:** /dwa:init → /dwa:parse produces valid .dwa/ structure.

### Phase 4: Linear Integration (sync)
**Why next:** Value delivery starts here (Linear issues created).
- /dwa:sync skill
- Linear integration reference
- MCP bridge (assumes dev-workflow-assistant extension installed)

**Validation:** /dwa:sync creates Linear issues with correct fields.

### Phase 5: Execution (start, GSD packets)
**Why next:** Enables AI execution workflow.
- /dwa:start skill
- Execution packet generation
- GSD integration reference
- Bounded context logic

**Validation:** /dwa:start DEL-001 generates valid GSD packet.

### Phase 6: Drift Detection (check-drift)
**Why last:** Depends on completed execution to detect drift.
- /dwa:check-drift skill
- Drift detection logic (spec vs registry comparison)
- Drift report template

**Validation:** Drift check produces actionable report after execution.

## Key Architectural Decisions

### Decision 1: Skills in Markdown, Not TypeScript
**Rationale:** Claude Code skills are prompt files, not code. Orchestration logic lives in natural language, execution happens in Claude context.
**Implication:** No build step for skills. Templates and references are plain markdown. Only installer needs TypeScript/JavaScript.

### Decision 2: Registry in Project, Not in ~/.claude/dwa/
**Rationale:** Each project has its own feature specs and deliverables. Registry must be project-local, not global.
**Implication:** Skills operate on cwd's .dwa/ directory. Installation is global, state is local.

### Decision 3: File-Based, Not Database
**Rationale:** Git-trackable, human-inspectable, no server dependencies, works offline.
**Implication:** Sync is eventual (skills write files, MCP reads files asynchronously). Performance is file I/O bound.

### Decision 4: MCP Integration, Not Direct API Calls
**Rationale:** Skills are pure orchestration. MCP servers handle credentials, rate limiting, API complexity.
**Implication:** Dependency on dev-workflow-assistant extension. Skills work offline (write registry), sync happens when MCP is available.

### Decision 5: Immutable Spec, Mutable Registry Runtime Fields
**Rationale:** Spec is the source of truth for WHAT to build. Registry adds WHERE it's tracked and WHEN it's done.
**Implication:** Parsing is idempotent. Registry writes preserve runtime fields across re-parses.

## Sources

**Reference Implementation:**
- GSD package structure: /Users/jedwards/.claude/get-shit-done/ (VERSION, workflows/, templates/, references/)
- GSD workflow patterns: execute-plan.md (orchestration), map-codebase.md (parallel agents)
- GSD template patterns: phase-prompt.md (YAML frontmatter + task structure), project.md (living document)

**Project Context:**
- DWA PROJECT.md: /Users/jedwards/workspace/JobPrep/dwa/.planning/PROJECT.md
- Feature Spec Template v2.0: (user-provided, referenced in PROJECT.md)
- dev-workflow-assistant extension: (separate repo, provides Linear/Google MCP)

**Architecture Insights:**
- Claude Code skills are stateless, file-based orchestrators
- Installation pattern: npx copies files to ~/.claude/PACKAGE_NAME/, registers in settings.json
- Skills communicate via file I/O, not shared memory
- Templates are passive structures referenced by skills
- References provide shared context (patterns, schemas, integration logic)

**Confidence Level:** HIGH
- GSD structure analysis: Direct file inspection (HIGH confidence)
- Skills architecture: Observed pattern from GSD workflows (HIGH confidence)
- Registry design: Inferred from DWA requirements + file-based best practices (MEDIUM confidence)
- Installation mechanism: Standard npx pattern + settings.json (HIGH confidence)

---
*Architecture research for: DWA - Dev Workflow Assistant*
*Researched: 2026-01-24*
