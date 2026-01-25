# Phase 5: Drift Tracking - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Track divergence between planned work (spec/registry) and actual implementation. Deliver commands to detect drift and complete deliverables with drift decisions, plus skills to propose fixes and normalize specs. Rolling drift log aggregates per-deliverable drift records.

</domain>

<decisions>
## Implementation Decisions

### Drift Detection Types

Four drift types detected by commands (deterministic only):

1. **Freshness Drift (Provenance-Based)**
   - Spec changed (git SHA or content hash differs)
   - TDD changed
   - Registry changed
   - Packet provenance missing or inconsistent
   - Behavior: mark packet STALE, recommend regeneration

2. **Structural Drift (Schema/Hygiene)**
   - Missing required registry fields (ID, description, AC list)
   - Missing required links (spec/TDD) based on configuration
   - Broken references (linked file paths do not exist)
   - Orphan status present (`orphaned: true`)
   - Behavior: emit warnings; errors only if packet cannot generate safely

3. **Contract Drift (Deterministic Content Changes)**
   - Acceptance Criteria changed (added/removed/edited lines)
   - QA verification steps changed
   - Deliverable description changed
   - Dependencies/type changed
   - Behavior: emit warnings, recommend packet regeneration

4. **Execution-State Drift (Runtime vs Links/Status)**
   - `status=Done` but missing `pr_url`
   - `pr_url` present but `status=Not Started`
   - `linear_id` present but Linear URL missing/malformed
   - Required evidence fields missing if configured
   - Behavior: emit warnings/info; packet generation proceeds

**Not detected by commands (deferred to skills):**
- Semantic "AC wording changed significantly" beyond deterministic diff
- AC quality judgments ("vague," "not testable")
- "Implementation diverged from intent" (requires PR/code analysis)
- Architectural correctness or refactor judgments

### Severity Policy

- **Error:** Prevents safe packet generation (missing deliverable contract, malformed required data)
- **Warning:** Packet generated but may be stale/incomplete/misaligned
- **Info:** Coordination hygiene reminders (status/link mismatch, missing recommended fields)

### Diagnostic Code Ranges

- `DWA-W3xx` Freshness drift (STALE sources)
- `DWA-W4xx` Structural drift (missing/broken prerequisites)
- `DWA-W5xx` Contract drift (AC/QA/desc/deps changed)
- `DWA-W6xx` Execution-state drift (status/PR/Linear inconsistencies)
- `DWA-E1xx` Fatal errors preventing packet generation

### Provenance Tracking

Record per source (spec, TDD):
- `git_commit_sha` (if repo is in git)
- `git_dirty` (true/false at generation time)
- `content_sha256` (hash of file contents) — **primary change detector**
- `file_mtime` (optional; for debugging and quick comparisons)
- `path`

Example provenance structure:
```yaml
provenance:
  spec:
    path: docs/specs/FEAT-2026-001.md
    git_commit: a1b2c3d
    git_dirty: true
    content_sha256: "..."
    mtime: "2026-01-24T18:12:03Z"
```

If `git_dirty=true`, label packet as "generated from uncommitted changes".

### Magnitude Scoring (Contract Drift)

Simple deterministic scoring for AC/QA changes:

1. **Compare by item ID** (C#, F#, E#, N# prefixes)
   - Unchanged: exact normalized text match
   - Edited: same ID, text differs
   - Added/Removed: ID present/absent

2. **Normalize text before comparing**
   - Trim whitespace
   - Collapse multiple spaces
   - Normalize line endings
   - Keep case-sensitive

3. **Score with weights**
   - Added item: +3
   - Removed item: +3
   - Edited item: +2

4. **Thresholds**
   - Minor: points <= 2 and no adds/removes (pure edits)
   - Major: any add/remove OR points >= 4 OR >= 20% items changed

5. **Output format**
   - `DWA-W501 (minor): AC text edited: F7`
   - `DWA-W502 (major): AC changed: +2, -1, ~3 edited`
   - Include diff summary: Added: F21, E9 / Removed: N4 / Edited: C3, F7, F8

### Invocation Pattern

- **Automatic:** Start Deliverable runs drift check internally (non-blocking, warns as needed)
- **Standalone:** Separate `Dev Workflow: Drift Check` command for explicit/batch review

### Claude's Discretion

- Exact implementation of content hashing (crypto module choice)
- How to handle files outside git (still hash, skip git fields)
- Formatting of drift warnings in terminal output
- Whether to cache provenance to avoid re-hashing unchanged files

</decisions>

<specifics>
## Specific Ideas

- Diagnostic codes follow pattern established in other commands (DWA-Wxxx for warnings, DWA-Exxx for errors)
- Provenance structure should be consistent with what's already stored in packets (section 9)
- Magnitude scoring uses the C#/F#/E#/N# prefix convention already established for AC categorization

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-drift-tracking*
*Context gathered: 2026-01-24*
