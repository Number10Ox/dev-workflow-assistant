# Phase 5: Drift Tracking - Research

**Researched:** 2026-01-24
**Domain:** Drift detection, event sourcing, decision workflow management, structural comparison
**Confidence:** MEDIUM-HIGH

## Summary

Phase 5 implements drift tracking - capturing, recording, and resolving divergence between planned work (spec/TDD/registry) and actual implementation outcomes. The system records drift as append-only events in deliverable registry files, supports completion-time drift decisions (accept/revert/escalate/pending), generates derived drift logs, and provides skills for proposing spec/TDD updates based on implementation reality.

The standard approach uses event sourcing principles with append-only drift event arrays in existing registry JSON files (extending Phase 3's schema), builds on the existing Handlebars template infrastructure for drift log generation, leverages the structural comparison patterns already in place (Phase 4's source freshness checking), and implements decision workflow patterns (pending → accept/reject/escalate) common in approval automation systems.

**Key architectural insight:** Drift events are first-class, durable records stored at the source of truth (deliverable registry), NOT as separate files requiring synchronization. The rolling drift log (`.dwa/drift-log.md`) is a deterministically-rebuilt derived artifact, similar to how Phase 4 packets are generated from registry data. This "source of truth in registry + derived views" pattern maintains consistency and enables idempotent regeneration.

**Primary recommendation:** Extend existing registry JSON schema with `drift_events` array field, implement completion command as interactive prompt flow capturing evidence and decision, generate drift log via Handlebars template from registry aggregation, and create LLM skills for patch proposal generation (analyzing git diff + completion notes) and drift summarization (human-readable reports).

## Standard Stack

### Core Dependencies (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fs-extra | ^11.0.0 | File system operations | Read/write registry, ensureDir for drift log, already used in Phases 1-4 |
| write-file-atomic | ^7.0.0 | Atomic registry updates | Crash-safe drift event appends, proven in Phase 3 registry updates |
| handlebars | ^4.7.8 | Template rendering | Drift log generation, already used for specs/TDD/packets in Phases 2-4 |
| fast-deep-equal | ^3.1.3 | Deep equality comparison | Detect registry changes before write, used in Phase 3 for idempotency |
| gray-matter | ^4.0.3 | YAML frontmatter parsing | Parse spec/TDD for patch proposals, standard in Phases 2-4 |
| remark + remark-gfm | ^15.0.0 / ^4.0.0 | AST-based markdown parsing | Extract ACs/guardrails for patch proposals, core to Phase 3-4 parsing |

### New Dependencies Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| uuid | ^10.0.0 | Drift event ID generation | RFC4122 UUIDs for unique event IDs, 39M+ weekly downloads, Node built-in crypto.randomUUID() alternative |

**Note:** Could use built-in `crypto.randomUUID()` (Node 14.17+) instead of uuid package. Node built-in preferred for zero-dependency approach. Decision left to planner.

### Supporting Utilities (Built In-House)

| Utility | Purpose | Why Build |
|---------|---------|-----------|
| Drift event validator | Validate drift event schema | Internal schema, ~20 lines, validates required fields (id/at/source/kind/summary/decision) |
| Drift log rebuilder | Aggregate drift from all registries | Internal registry format, template-based, deterministic rebuild logic |
| Structural comparison | Detect spec vs registry divergence | Phase-specific logic (AC count, status mismatch, missing fields), builds on Phase 4 freshness |
| Decision workflow validator | Validate decision transitions | Internal business logic (pending→accept/reject/escalate, accept→closed) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Registry-embedded events | Separate drift database | Separate DB adds complexity, sync issues; registry is source of truth for deliverable state |
| Handlebars for drift log | Manual string building | Handlebars already installed, tested, provides iteration/conditionals; string concat error-prone |
| uuid package | crypto.randomUUID() | uuid adds 80KB; crypto.randomUUID() is Node built-in (14.17+); built-in preferred if Node version OK |
| Append-only events | Mutable drift records | Append-only provides audit trail, temporal queries; mutation loses history |
| Derived drift log | Manual drift log editing | Derived log is deterministic, rebuild-safe; manual editing causes drift-about-drift |

**Installation (if using uuid):**
```bash
npm install uuid
```

**No installation needed if using crypto.randomUUID()** (Node 14.17+ already in engines: >=18.0.0)

## Architecture Patterns

### Recommended Project Structure

```
src/
├── commands/
│   ├── complete.js               # NEW: Complete Deliverable command
│   ├── rebuild-drift-log.js      # NEW: Rebuild drift log command
│   └── start.js                  # Existing (Phase 4)
├── drift/
│   ├── append-event.js           # NEW: Append drift event to registry
│   ├── validate-event.js         # NEW: Validate drift event schema
│   ├── rebuild-log.js            # NEW: Aggregate drift from registries
│   ├── structural-compare.js     # NEW: Detect spec vs registry drift
│   └── decision-workflow.js      # NEW: Validate decision transitions
├── packets/
│   ├── generate-shell.js         # Existing (Phase 4)
│   └── fetch-drift.js            # Existing (Phase 4) - reused for packet drift section
templates/
├── drift-log-v1.hbs              # NEW: Rolling drift log template
└── packet-v1.hbs                 # Existing (Phase 4)
skills/
├── dwa-propose-drift-patches/    # NEW: LLM skill for patch proposals
│   └── SKILL.md
└── dwa-summarize-drift/          # NEW: LLM skill for drift summaries
    └── SKILL.md
tests/
├── drift/
│   ├── append-event.test.js
│   ├── rebuild-log.test.js
│   └── structural-compare.test.js
└── commands/
    ├── complete.test.js
    └── rebuild-drift-log.test.js
```

### Pattern 1: Event Sourcing with Append-Only Drift Events

**What:** Store drift as immutable events in deliverable registry, never modify/delete events.

**When to use:** All drift recording - completion-time capture, manual drift entry, skill-generated drift.

**Key principle:** Registry is append-only event log for drift; current state is derived from event sequence.

**Example:**
```javascript
// Source: Event sourcing pattern (Azure/AWS docs) + Phase 3 registry structure
const crypto = require('crypto');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Append a drift event to a deliverable registry.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {object} eventData - Drift event data
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<object>} Updated registry
 */
async function appendDriftEvent(deliverableId, eventData, projectRoot) {
  const registryPath = path.join(
    projectRoot,
    '.dwa/deliverables',
    `${deliverableId}.json`
  );

  // Read existing registry
  const registry = await fs.readJSON(registryPath);

  // Initialize drift_events array if not present
  if (!registry.drift_events) {
    registry.drift_events = [];
  }

  // Create drift event with auto-generated fields
  const driftEvent = {
    id: crypto.randomUUID(), // or require('uuid').v4()
    at: new Date().toISOString(),
    ...eventData, // source, kind, summary, decision, evidence_refs, etc.
  };

  // Validate event schema
  validateDriftEvent(driftEvent);

  // Append event (immutable - never modify existing events)
  registry.drift_events.push(driftEvent);

  // Update derived fields
  registry.drift_open_count = registry.drift_events.filter(
    e => e.decision === 'pending' || e.decision === 'escalate'
  ).length;

  // Atomic write
  await writeJsonWithSchema(registryPath, registry);

  return registry;
}

function validateDriftEvent(event) {
  const required = ['id', 'at', 'source', 'kind', 'summary', 'decision'];
  const validKinds = [
    'impl_deviation', 'scope_change', 'qa_gap',
    'spec_update_needed', 'tdd_update_needed',
    'followup_required', 'rollback_required'
  ];
  const validDecisions = ['pending', 'accept', 'revert', 'escalate'];
  const validSources = ['complete_command', 'manual', 'skill'];

  for (const field of required) {
    if (!event[field]) {
      throw new Error(`DWA-E070: Missing required drift field: ${field}`);
    }
  }

  if (!validKinds.includes(event.kind)) {
    throw new Error(`DWA-E071: Invalid drift kind: ${event.kind}`);
  }

  if (!validDecisions.includes(event.decision)) {
    throw new Error(`DWA-E072: Invalid drift decision: ${event.decision}`);
  }

  if (!validSources.includes(event.source)) {
    throw new Error(`DWA-E073: Invalid drift source: ${event.source}`);
  }
}
```

### Pattern 2: Derived Drift Log Generation

**What:** Rebuild `.dwa/drift-log.md` from all deliverable drift events via template.

**When to use:** After completion command, on-demand via rebuild command, pre-commit hook (optional).

**Key principle:** Drift log is derived artifact - deterministically rebuilt, never manually edited.

**Example:**
```javascript
// Source: Phase 4 packet generation + Handlebars patterns
const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');

/**
 * Rebuild drift log from all deliverable registries.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{openDrift: number, totalEvents: number, logPath: string}>}
 */
async function rebuildDriftLog(projectRoot) {
  const deliverableDir = path.join(projectRoot, '.dwa/deliverables');
  const driftLogPath = path.join(projectRoot, '.dwa/drift-log.md');

  // Aggregate drift events from all deliverables
  const allDrift = await aggregateDriftEvents(deliverableDir);

  // Categorize drift
  const openDrift = allDrift.filter(
    d => d.decision === 'pending' || d.decision === 'escalate'
  );
  const acceptedDrift = allDrift.filter(d => d.decision === 'accept');
  const revertedDrift = allDrift.filter(d => d.decision === 'revert');

  // Group by deliverable
  const byDeliverable = groupByDeliverable(allDrift);

  // Render template
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'drift-log-v1.hbs');
  const template = Handlebars.compile(await fs.readFile(templatePath, 'utf8'));

  const rendered = template({
    generated_at: new Date().toISOString(),
    open_count: openDrift.length,
    total_events: allDrift.length,
    open_drift: openDrift,
    accepted_drift: acceptedDrift,
    reverted_drift: revertedDrift,
    by_deliverable: byDeliverable
  });

  // Write atomically
  await fs.writeFile(driftLogPath, rendered, 'utf8');

  return {
    openDrift: openDrift.length,
    totalEvents: allDrift.length,
    logPath: driftLogPath
  };
}

async function aggregateDriftEvents(deliverableDir) {
  const files = await fs.readdir(deliverableDir);
  const allEvents = [];

  for (const file of files) {
    if (!file.startsWith('DEL-') || !file.endsWith('.json')) {
      continue;
    }

    const registry = await fs.readJSON(path.join(deliverableDir, file));

    if (registry.drift_events && Array.isArray(registry.drift_events)) {
      for (const event of registry.drift_events) {
        allEvents.push({
          deliverable_id: registry.id,
          ...event
        });
      }
    }
  }

  // Sort by timestamp (newest first)
  return allEvents.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function groupByDeliverable(events) {
  const grouped = {};

  for (const event of events) {
    const delId = event.deliverable_id;
    if (!grouped[delId]) {
      grouped[delId] = [];
    }
    grouped[delId].push(event);
  }

  return Object.entries(grouped).map(([id, events]) => ({ id, events }));
}
```

### Pattern 3: Completion Command with Decision Workflow

**What:** Interactive command prompts for completion evidence and drift decision.

**When to use:** Deliverable completion - capture PR URL, outcomes, drift observations.

**Key principle:** Drift decision is explicit user choice, not auto-determined.

**Example:**
```javascript
// Source: Approval workflow patterns (Cflow/Kissflow) + existing command structure
const fs = require('fs-extra');
const path = require('path');
const { appendDriftEvent } = require('../drift/append-event');
const { detectStructuralDrift } = require('../drift/structural-compare');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Run complete command - mark deliverable complete, capture drift.
 *
 * @param {string} deliverableId - Deliverable ID
 * @param {object} options - Completion options from CLI prompts
 * @param {string} projectRoot - Project root
 * @returns {Promise<object>} Completion result
 */
async function runComplete(deliverableId, options, projectRoot) {
  const result = {
    success: false,
    driftRecorded: false,
    errors: []
  };

  // Validate deliverable exists
  const registryPath = path.join(
    projectRoot,
    '.dwa/deliverables',
    `${deliverableId}.json`
  );

  if (!await fs.pathExists(registryPath)) {
    result.errors.push({
      code: 'DWA-E080',
      message: `Deliverable ${deliverableId} not found`
    });
    return result;
  }

  const registry = await fs.readJSON(registryPath);

  // Detect structural drift (spec vs registry vs implementation)
  const drift = await detectStructuralDrift(registry, projectRoot);

  // If drift detected, prompt for decision
  if (drift.detected) {
    // CLI would prompt here:
    // "Drift detected: [drift.summary]"
    // "Decision? (accept/revert/escalate/pending): "

    const driftEvent = {
      source: 'complete_command',
      kind: drift.kind, // e.g., 'impl_deviation'
      summary: drift.summary,
      decision: options.driftDecision || 'pending',
      applies_to_next_work: options.appliesToNext || false,
      evidence_refs: [
        options.prUrl,
        options.commitSha
      ].filter(Boolean),
      author: 'user'
    };

    await appendDriftEvent(deliverableId, driftEvent, projectRoot);
    result.driftRecorded = true;
  }

  // Update registry with completion data
  registry.status = 'completed';
  registry.completed_at = new Date().toISOString();
  registry.pr_url = options.prUrl;
  registry.last_completed_commit = options.commitSha;

  await writeJsonWithSchema(registryPath, registry);

  result.success = true;
  return result;
}
```

### Pattern 4: Structural Drift Detection

**What:** Compare spec/TDD/registry state to detect divergence (missing ACs, status mismatch, etc.).

**When to use:** Pre-completion check, on-demand drift check command, packet generation.

**Key principle:** Detect semantic changes, ignore whitespace/formatting.

**Example:**
```javascript
// Source: Semantic diff concepts + Phase 4 source freshness
const fs = require('fs-extra');
const path = require('path');
const { parseSpec } = require('../parser/parse-spec');
const fastDeepEqual = require('fast-deep-equal');

/**
 * Detect structural drift between spec and registry.
 *
 * @param {object} registry - Deliverable registry
 * @param {string} projectRoot - Project root
 * @returns {Promise<{detected: boolean, kind: string|null, summary: string|null}>}
 */
async function detectStructuralDrift(registry, projectRoot) {
  const result = { detected: false, kind: null, summary: null };

  // Load feature.json to get spec path
  const featureJson = await fs.readJSON(
    path.join(projectRoot, '.dwa/feature.json')
  );

  if (!featureJson.spec_path) {
    return result; // No spec to compare
  }

  // Parse current spec
  const specPath = path.join(projectRoot, featureJson.spec_path);
  const { deliverables } = await parseSpec(specPath);

  // Find matching deliverable in spec
  const specDel = deliverables.find(
    d => d['Deliverable ID'] === registry.id
  );

  if (!specDel) {
    // Deliverable removed from spec (orphaned)
    result.detected = true;
    result.kind = 'spec_update_needed';
    result.summary = `Deliverable ${registry.id} removed from spec but marked complete in registry`;
    return result;
  }

  // Compare AC count
  const specACLines = (specDel['Acceptance Criteria (testable)'] || '')
    .split('\n')
    .filter(line => line.trim().length > 0);
  const registryACLines = (registry.acceptance_criteria || '')
    .split('\n')
    .filter(line => line.trim().length > 0);

  if (specACLines.length !== registryACLines.length) {
    result.detected = true;
    result.kind = 'impl_deviation';
    result.summary = `AC count mismatch: spec has ${specACLines.length}, registry has ${registryACLines.length}`;
    return result;
  }

  // Compare status (spec should not have status, but registry does)
  // Check if registry status is advanced beyond spec expectation
  if (registry.status === 'completed' && !registry.pr_url) {
    result.detected = true;
    result.kind = 'qa_gap';
    result.summary = 'Deliverable marked completed but no PR URL recorded';
    return result;
  }

  // Compare description
  const specDesc = (specDel['Description'] || '').trim();
  const registryDesc = (registry.description || '').trim();

  if (specDesc !== registryDesc) {
    result.detected = true;
    result.kind = 'spec_update_needed';
    result.summary = 'Description changed in spec since registry update';
    return result;
  }

  return result; // No drift detected
}
```

### Anti-Patterns to Avoid

- **Mutating drift events:** Never modify existing events. Append new events (e.g., decision_changed event).
- **Manual drift log editing:** Drift log is derived. Edits will be lost on rebuild.
- **Drift in separate database:** Keep drift with deliverable state (registry). Separate storage causes sync issues.
- **Auto-accepting drift:** Always require explicit user decision. Auto-accept loses audit trail intent.
- **Timestamp-only comparison:** Use structural comparison (AC count, field presence) not just file mtime.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random ID generator | crypto.randomUUID() (Node 14.17+) | RFC4122 compliance, collision resistance, built-in to Node |
| Event schema validation | Manual field checks | Structured validator function | Centralized validation, consistent error codes, testable |
| Drift log aggregation | Manual file reading loops | Template-based generation (Handlebars) | Handles iteration, conditionals, formatting; proven in Phase 4 |
| Deep object comparison | Manual recursive comparison | fast-deep-equal (already installed) | Handles edge cases (NaN, Date, circular refs), 10-100x faster |
| Decision workflow state machine | If-else chains | Enum validation + transition map | Validates allowed transitions, prevents invalid states |

**Key insight:** Event sourcing is well-understood pattern with known pitfalls (event schema evolution, projection consistency, archive strategy). Use established patterns rather than inventing custom solutions.

## Common Pitfalls

### Pitfall 1: Event Schema Evolution Without Versioning

**What goes wrong:** Adding new required fields breaks parsing of old drift events.

**Why it happens:** Events are append-only and immutable - can't "update" old events to new schema.

**How to avoid:**
- Make all event fields optional except core fields (id, at, kind, decision)
- Version drift events if schema changes significantly (add `event_schema_version`)
- Read events tolerantly (missing fields = default values)
- Never fail on unknown fields (forward compatibility)

**Warning signs:**
- Old drift events fail validation after code update
- Can't rebuild drift log from historical events
- Error: "Missing required field" for events written months ago

**Source:** [Event Sourcing pattern - Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)

### Pitfall 2: Derived State Inconsistency

**What goes wrong:** `drift_open_count` in registry doesn't match actual count of pending events.

**Why it happens:** Updating derived fields manually instead of computing from events.

**How to avoid:**
- Always recompute derived fields when appending events
- Treat derived fields as cache, not source of truth
- Validate derived fields match event state in tests
- Consider removing derived fields entirely (compute on read)

**Warning signs:**
- Drift log shows 3 open items, registry.drift_open_count = 5
- Counts drift over time without event changes
- Test failures on derived field assertions

**Source:** [CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

### Pitfall 3: Decision Workflow Bypass

**What goes wrong:** Code sets drift decision without user choice (e.g., auto-accept on completion).

**Why it happens:** Trying to reduce friction by "smart defaults."

**How to avoid:**
- Always prompt for decision when drift detected
- Default to 'pending' if user skips decision
- Log all decision changes as separate events
- Never change decision without user action

**Warning signs:**
- All drift events have decision='accept' automatically
- No pending drift despite known divergence
- Audit question: "Who decided to accept this drift?"

**Source:** [Approval Process workflow patterns](https://kissflow.com/workflow/approval-process/)

### Pitfall 4: Unbounded Drift Event Growth

**What goes wrong:** Registry files grow to 100KB+ with thousands of drift events.

**Why it happens:** Append-only log with no archival strategy.

**How to avoid:**
- Archive closed drift events (decision=accept, applied) to `.dwa/drift-archive/`
- Keep only open + recent (last 30 days) events in registry
- Link archived events in drift log for audit trail
- Document archival policy in README

**Warning signs:**
- Git diffs show 500+ line registry changes
- Registry file > 50KB
- Parse/read performance degrades over time

**Source:** [Event Sourcing scalability concerns](https://risingwave.com/blog/comprehensive-guide-to-event-sourcing-database-architecture/)

### Pitfall 5: Structural Comparison False Positives

**What goes wrong:** Whitespace changes in ACs flagged as drift.

**Why it happens:** String comparison without normalization.

**How to avoid:**
- Normalize whitespace before comparison (trim, collapse multiple spaces)
- Ignore formatting differences (bullet style, line breaks)
- Compare semantic structure (AC count, presence of critical terms)
- Allow opt-out for known formatting-only changes

**Warning signs:**
- Every spec re-parse triggers drift events
- Drift summary: "AC changed: added trailing space"
- User confusion: "Nothing actually changed"

## Code Examples

Verified patterns from official sources:

### Handlebars Template for Drift Log

```handlebars
{{!-- Source: Handlebars docs + Phase 4 packet template patterns --}}
# Drift Log

**Generated:** {{generated_at}}
**Open Drift:** {{open_count}} events
**Total Events:** {{total_events}}

---

## Open Drift (Requires Decision)

{{#if open_drift.length}}
{{#each open_drift}}
### {{deliverable_id}} - {{kind}}

**Summary:** {{summary}}
**Decision:** {{decision}}
**Recorded:** {{at}}
**Evidence:** {{#each evidence_refs}}[{{this}}]({{this}}) {{/each}}
{{#if applies_to_next_work}}
⚠️ **Applies to next work on this deliverable**
{{/if}}

{{#if patch_proposals.length}}
**Patch Proposals:**
{{#each patch_proposals}}
- {{this}}
{{/each}}
{{/if}}

---
{{/each}}
{{else}}
No open drift. All drift decisions resolved.
{{/if}}

---

## Accepted Drift (Applied)

{{#if accepted_drift.length}}
{{#each accepted_drift}}
- **{{deliverable_id}}** ({{at}}): {{summary}}
{{/each}}
{{else}}
No accepted drift recorded.
{{/if}}

---

## Reverted Drift (Rolled Back)

{{#if reverted_drift.length}}
{{#each reverted_drift}}
- **{{deliverable_id}}** ({{at}}): {{summary}}
{{/each}}
{{else}}
No reverted drift recorded.
{{/if}}

---

## By Deliverable

{{#each by_deliverable}}
### {{id}}

{{#each events}}
- **{{kind}}** ({{decision}}) - {{at}}: {{summary}}
{{/each}}

---
{{/each}}
```

### Registry Schema with Drift Events

```javascript
// Source: Phase 3 registry schema + event sourcing pattern
{
  "schemaVersion": "1.0.0",
  "id": "DEL-001",
  "user_story": "As a developer...",
  "description": "Implement feature X",
  "acceptance_criteria": "- AC1\n- AC2\n- AC3",
  "qa_notes": "Test with...",
  "dependencies": [],

  // Runtime fields (Phase 3)
  "status": "completed",
  "linear_id": "PROJ-123",
  "linear_url": "https://linear.app/...",
  "pr_url": "https://github.com/.../pull/42",
  "completed_at": "2026-01-24T10:30:00Z",
  "created_at": "2026-01-20T09:00:00Z",

  // Phase 5: Drift tracking fields
  "drift_events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "at": "2026-01-24T10:30:00Z",
      "source": "complete_command",
      "kind": "impl_deviation",
      "summary": "Added error handling not in original ACs",
      "decision": "accept",
      "applies_to_next_work": false,
      "evidence_refs": [
        "https://github.com/.../pull/42",
        "abc123def"
      ],
      "patch_proposals": [
        "Add AC: 'System handles connection timeout gracefully'"
      ],
      "author": "user"
    }
  ],
  "drift_open_count": 0,
  "last_completed_at": "2026-01-24T10:30:00Z",
  "last_completed_commit": "abc123def",
  "last_completed_pr_url": "https://github.com/.../pull/42"
}
```

### Node.js UUID Generation

```javascript
// Source: Node.js crypto documentation
const crypto = require('crypto');

// Node 14.17+ built-in UUID v4
const driftEventId = crypto.randomUUID();
// Returns: '550e8400-e29b-41d4-a716-446655440000'

// Alternative: uuid package (if need v1, v3, v5)
// const { v4: uuidv4 } = require('uuid');
// const driftEventId = uuidv4();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mutable drift records | Append-only event log | Event sourcing standard (2015+) | Full audit trail, temporal queries, replayability |
| Manual drift tracking | Automated structural comparison | CI/CD drift detection (2020+) | Earlier detection, consistent checks |
| Text-based diff | Semantic/structural diff | AST-based tooling (2022+) | Ignore formatting, focus on semantic changes |
| Single decision field | Decision workflow with states | Approval automation (2024+) | Explicit transitions, escalation paths |
| Separate drift database | Co-located with source of truth | Domain-driven design (2018+) | No sync issues, transactional consistency |

**Deprecated/outdated:**
- **Mutable drift tracking:** Loses history, can't replay decisions. Use append-only events.
- **Text-only diff tools:** Flag whitespace changes as drift. Use structural comparison.
- **Auto-accept drift:** Loses audit trail intent. Always require explicit decision.
- **Separate drift storage:** Causes synchronization issues. Keep drift with deliverable state.

## Open Questions

### Question 1: Drift Event Archival Strategy

**What we know:** Append-only events can grow unbounded (Phase context marks this as concern).

**What's unclear:** When/how to archive closed drift events without losing audit trail.

**Recommendation:**
- Start without archival (premature optimization)
- Monitor registry file sizes in production
- If > 50KB or > 100 events per deliverable, implement archive:
  - Move closed events (decision=accept + applied) to `.dwa/drift-archive/{deliverable-id}.json`
  - Keep references in drift log
  - Archive after 30 days closed

### Question 2: Patch Proposal Format

**What we know:** Skills propose spec/TDD changes based on drift (Phase context specifies this).

**What's unclear:** Format for patch proposals - plain text descriptions vs. structured diffs vs. actual patch files.

**Recommendation:**
- Phase 5: Plain text descriptions in `patch_proposals` array (simplest, human-readable)
- Phase 6+: Could enhance to unified diff format if auto-apply desired
- User workflow: Read proposals, manually edit spec/TDD, re-parse

### Question 3: Drift Decision Transitions

**What we know:** Decisions have states (pending → accept/reject/escalate).

**What's unclear:** Valid state transitions and whether to enforce them.

**Recommendation:**
- Phase 5: Allow any decision change (flexible, don't over-constrain)
- Log decision changes as new events: `{ kind: 'decision_changed', from: 'pending', to: 'accept' }`
- Phase 6+: Could add workflow validator if rigid process needed

### Question 4: Structural Drift Detection Depth

**What we know:** Detect missing ACs, status mismatch, spec divergence (Phase context examples).

**What's unclear:** How deep to compare (field-by-field deep equality vs. high-level checks).

**Recommendation:**
- Start simple: AC count, required field presence, status consistency
- Avoid deep text comparison (too many false positives from formatting)
- Phase 6+: Could add semantic diff for AC text if users request it

## Sources

### Primary (HIGH confidence)

- [Event Sourcing pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) - Append-only log pattern, projection consistency
- [Event sourcing pattern - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing.html) - Implementation considerations, scalability
- [Approval Process: Ultimate Guide to Automated Approval Processes 2026](https://kissflow.com/workflow/approval-process/) - Decision workflow (accept/reject/escalate), approval routing
- [Escalation Rules in Workflow Automation - Cflow](https://www.cflowapps.com/glossary/escalation-rules-in-workflow-automation/) - Escalation patterns, time-based triggers
- Node.js crypto.randomUUID() documentation - Built-in UUID v4 generation (Node 14.17+)
- Phase 3 RESEARCH.md - Registry structure, atomic writes, idempotent updates (authoritative)
- Phase 4 RESEARCH.md - Packet generation, Handlebars templates, provenance tracking (authoritative)

### Secondary (MEDIUM confidence)

- [SemanticDiff - Language Aware Diff](https://semanticdiff.com/) - Semantic vs textual diff concepts, ignoring whitespace
- [A Comprehensive Review of Semantic Code Diff Analysis](https://mgx.dev/insights/a-comprehensive-review-of-semantic-code-diff-analysis-from-foundations-to-future-trends/f78dabc3a2394fb18d57f3e8736acbb7) - AST-based comparison, structural diff
- [Acceptance Criteria in Agile Testing - TestRail](https://www.testrail.com/blog/acceptance-criteria-agile/) - AC validation, test alignment
- [GitHub - benjamine/jsondiffpatch](https://github.com/benjamine/jsondiffpatch) - JavaScript diff library for object comparison
- [npm: uuid](https://www.npmjs.com/package/uuid) - UUID generation library (alternative to built-in)
- [Comprehensive Guide to Event Sourcing Database Architecture](https://risingwave.com/blog/comprehensive-guide-to-event-sourcing-database-architecture/) - Scalability, archival, projections

### Tertiary (LOW confidence)

- WebSearch results on drift detection - General concepts, not implementation-specific
- WebSearch results on approval workflows - SaaS product features, not code patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already installed except uuid (and crypto.randomUUID() is built-in)
- Event sourcing pattern: HIGH - Well-documented in Azure/AWS official docs, proven pattern
- Decision workflow: MEDIUM-HIGH - Approval automation well-understood, adapted to drift context
- Structural comparison: MEDIUM - Semantic diff concepts clear, specific AC comparison needs validation
- Drift log generation: HIGH - Template-based generation proven in Phase 4, straightforward aggregation

**Research date:** 2026-01-24
**Valid until:** 60 days (event sourcing is stable pattern, decision workflows mature, Node crypto API stable)

**Key dependencies:**
- Phase 3: Registry structure (DEL-###.json), writeJsonWithSchema, RUNTIME_FIELDS preservation
- Phase 4: Handlebars templates, fetch-drift.js patterns, structural freshness detection
- Existing stack: fs-extra, write-file-atomic, fast-deep-equal, gray-matter, remark ecosystem

**Research scope:**
- ✅ Event sourcing patterns for append-only drift log
- ✅ Decision workflow (pending/accept/reject/escalate) automation
- ✅ Registry schema extension with drift_events array
- ✅ Drift log generation via Handlebars templates
- ✅ Structural comparison approaches (AC count, field presence)
- ✅ UUID generation (built-in vs library)
- ⚠️ Patch proposal format (deferred to planning - start with plain text)
- ⚠️ Archival strategy (deferred - implement when needed)
- ⚠️ Deep semantic diff (out of scope for Phase 5 - simple comparison sufficient)

**Key research outcomes:**
1. ✅ Identified append-only event log as standard pattern for drift tracking
2. ✅ Confirmed registry-embedded events preferred over separate storage
3. ✅ Documented decision workflow states and transitions
4. ✅ Validated Handlebars template approach for drift log generation
5. ✅ Catalogued structural comparison pitfalls (whitespace sensitivity)
6. ✅ Determined crypto.randomUUID() sufficient (no uuid package needed)
7. ⚠️ Flagged event schema evolution as key risk (versioning needed)
8. ⚠️ Flagged unbounded growth as concern (archival strategy for future)
