# Phase 6: Linear Integration — Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate DWA deliverables with Linear by creating/updating Linear issues from the deliverable registry. Linear becomes the team-visible execution surface (assignment, state), while the **repo canonical spec + registry remain the execution source-of-truth**.

The feature spec typically begins as a **human-authored "source spec"** in Google Docs (PM/designer/producer owned). For DWA, that source spec is mirrored into an **AI-friendly canonical spec** in repo Markdown (manual mirroring for MVP; automated import is deferred).

Sync must be deterministic, idempotent, and safe for multi-person collaboration.

</domain>

<decisions>
## Implementation Decisions

### API Approach

- Use **Linear's GraphQL API directly** from the VS Code extension/CLI.
- MCP support is deferred — direct API keeps it shippable, testable, and reduces user setup friction.
- Phase 6 sync is a deterministic command, not an LLM skill.

### Scope (Linear Only, MVP)

- Support **one-way sync** from DWA → Linear for issue content (title/body/labels/project), plus read-back of Linear identifiers and URLs into the registry.
- Do **not** implement two-way merging of edits from Linear back into the repo spec in Phase 6.
- Do not implement Google Docs integration in Phase 6 (manual mirroring assumed).

### Spec Sources / Ownership

- **Source Spec (Human-owned):**
  - Authored in Google Docs (or similar) by PM/designer/producer.
  - Source of intent for humans.
- **Canonical Spec (DWA execution source):**
  - Repo Markdown mirror of the Source Spec using Template v2.x.
  - Machine-parseable and used for registry parsing, execution packets, and ticket sync.
  - For MVP: created/updated manually; automation deferred.

### Canonical Sources / Ownership

- **Canonical contract** lives in repo artifacts:
  - Canonical Spec (Markdown)
  - TDD (Markdown)
  - Registry (`.dwa/deliverables/*.json`)
- **Human-owned in Linear**:
  - Assignee
  - State/status
  - Comments
- DWA sync must **never overwrite** assignee/state/comments by default.

### Feature Container Mapping (Linear "Epic" Equivalent)

- Linear grouping uses a **Project** (epic-like container).
- Canonical spec frontmatter stores:
  - `linear_project_url` OR `linear_project_id` (either accepted)
  - If URL provided, resolve to ID on first sync and persist
- If project is missing, Phase 6 may either:
  - fail with actionable error, or
  - create issues without project assignment (configurable).

### Deliverable Identity Strategy (Dual ID)

Use both registry tracking AND Linear's externalId for robust deduplication:

- **Registry `linear_issue_id`**: Fast "update this specific issue" once created.
- **Linear `externalId`**: Idempotency across machines, fresh clones, missing registry.

**externalId format**: `FEAT-YYYY-NNN-DEL-###` (globally unique in org)
- Example: `FEAT-2026-001-DEL-003`
- Avoids collisions across features.

**Sync logic**:
1. If registry has `linear_issue_id` → update that issue.
2. Else query Linear by `externalId`:
   - If exists → bind (store ids into registry) and update.
   - If not → create with `externalId`, then store ids.

Registry stores after sync:
- `linear_issue_id` (UUID)
- `linear_identifier` (e.g., `ENG-123`)
- `linear_url`

### Linear Issue Title Format

- Default title is human-scannable, not a user-story sentence:
  - `<short imperative summary>` (derived from deliverable description)
- Optional prefix setting:
  - `DEL-### — <summary>` (off by default)
- The DWA deliverable ID is always stored in the issue body metadata block.

### Linear Issue Body Template (DWA-Owned Section)

Each synced issue body includes a clearly delimited DWA section that DWA owns and can update safely:

- Links: canonical spec path, TDD path, packet path
- Deliverable summary
- Acceptance Criteria (C/F/E/N groups as checklists — same format as packets)
- QA verification steps
- Dependencies (if any)
- Provenance (optional short form)
- DWA metadata block including deliverable ID and sync fingerprint

DWA section must be wrapped with markers:
- `<!-- DWA:BEGIN -->`
- `<!-- DWA:END -->`

DWA only updates content within this marked block; any text outside remains human-owned.

### AC Format in Linear Body

Render grouped format (same as execution packets):

```markdown
## Acceptance Criteria

### Critical (C)
- [ ] C1: ...
- [ ] C2: ...

### Functional (F)
- [ ] F1: ...

### Edge Cases (E)
- [ ] E1: ...
```

Grouped checklists preserve intent; flat lists get unwieldy.

### Sync Fingerprint (Multi-person Safety)

- DWA computes a deterministic `dwa_sync_hash` of the rendered DWA block content.
- DWA stores the hash:
  - in the Linear issue (inside DWA block metadata)
  - in the deliverable registry
- On subsequent sync:
  - If the DWA block was edited manually (hash mismatch), DWA warns and:
    - defaults to **non-destructive mode** (does not overwrite), OR
    - allows `--force` / "Overwrite DWA Block" option (explicit).

### Idempotent Sync Behavior

- If registry has `linear_issue_id` → update that issue.
- Else: query by externalId, then create if not found.
- Sync is per-deliverable atomic:
  - each issue create/update is independent
  - failures do not block other deliverables.

### Rate Limit Handling (Explicit Policy)

On HTTP 429 or Linear rate-limit error:
- Exponential backoff with jitter
- Max 5 retries
- Respect `Retry-After` header if present
- Cap concurrency (2–5 parallel requests) to reduce rate-limit hits

On persistent failure:
- Report which deliverables failed
- Continue with remaining deliverables

### Credential Storage

**Primary (VS Code extension)**:
- API token in VS Code Secret Storage (secure, not in repo)
- Workspace settings for non-secret config (team key, project url/id)

**Fallback (CI/headless)**:
- `LINEAR_API_KEY` environment variable

**Project-level config**:
- `.dwa/config.json` for project-level defaults (non-secret only)
- Never store tokens in repo

### Labels / State

- Labels may be applied deterministically (optional MVP):
  - e.g., `dwa`, `deliverable`, feature key label
- State is **not** set by DWA by default.
- Status/state synchronization is deferred unless explicitly configured.

### Commands / UX

Deliver:

1. **Dev Workflow: Sync to Linear**
   - Syncs all deliverables in the current feature
   - Supports dry-run preview
   - Optional: VS Code quick-pick multi-select for subset

2. **Dev Workflow: Sync Deliverable to Linear**
   - Syncs one deliverable (DEL-###)

**CLI subset selection**: `--deliverables DEL-001,DEL-002` (comma-separated)

Commands produce a clear report:
- created/updated/skipped counts
- warnings (hash mismatch, missing project, missing required fields)
- links to created/updated issues

### Error Handling

- Fail fast for missing Linear credentials/configuration with actionable setup instructions.
- Per-deliverable errors are collected and reported at end (similar to Phase 3 validation style).
- Missing project: configurable error vs warning.

### Claude's Discretion

- Exact format of title shortening/truncation rules
- Exact schema fields added to registry for Linear mappings
- Whether to include a short provenance block in Linear issue body
- How verbose the dry-run diff/report should be

</decisions>

<specifics>
## Specific Ideas

- Treat Linear issues as the shared team coordination surface while keeping repo artifacts canonical for execution.
- BEGIN/END markers enable safe coexistence with human edits.
- Sync hash is a deterministic guardrail against accidental overwrites.
- externalId provides cross-machine idempotency beyond registry tracking.

</specifics>

<deferred>
## Deferred Ideas

- Google Docs import/write-back (source spec automation)
- Two-way sync (import edits from Linear back into spec/registry)
- Automatic creation of Linear projects from DWA
- Status/state synchronization between DWA registry and Linear
- Comment syncing
- MCP integration for Linear (if LLM skills need Linear access)
- JIRA integration (future phase)

</deferred>

---

*Phase: 06-linear-integration*
*Context gathered: 2026-01-25*
