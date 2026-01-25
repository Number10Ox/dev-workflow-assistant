---
name: propose-drift-patches
description: Propose spec/TDD updates based on implementation drift. Analyzes drift events and generates reviewable patch suggestions.
disable-model-invocation: false
argument-hint: [deliverable-id] [--pr <url>] [--commit <sha>]
---

# DWA: Propose Drift Patches

## Purpose

Analyze drift events for a deliverable and generate concrete patch proposals for spec and TDD documents. This skill helps close the feedback loop between implementation changes and contract documentation by suggesting human-reviewable updates.

## Critical Rules

**MUST NOT:**
- Auto-apply any changes to spec or TDD files
- Modify deliverable registry files
- Close or resolve drift events (that requires explicit user decision)
- Assume acceptance of any drift - all proposals are suggestions

**MUST:**
- Read drift_events from deliverable registry (source of truth)
- Filter to pending/escalate decisions only
- Reference specific drift event IDs in proposals
- Generate reviewable text that can be copy-pasted
- Preserve existing spec/TDD structure in proposals

## Process

### Step 1: Load deliverable registry

Read the deliverable registry file to access drift events:

```javascript
const fs = require('fs-extra');
const path = require('path');

const registryPath = path.join(process.cwd(), '.dwa', 'deliverables', `${deliverableId}.json`);

if (!await fs.pathExists(registryPath)) {
  throw new Error(`Deliverable not found: ${deliverableId}. Run /dwa:parse first.`);
}

const registry = await fs.readJson(registryPath);
const driftEvents = registry.drift_events || [];
```

### Step 2: Filter to actionable drift

Extract only drift events that need decisions:

```javascript
const actionableDrift = driftEvents.filter(event =>
  event.decision === 'pending' || event.decision === 'escalate'
);

if (actionableDrift.length === 0) {
  // Report: "No pending drift for this deliverable"
  return;
}
```

Categorize drift by type:
- `impl_deviation` - Implementation differs from spec
- `scope_addition` - New functionality added
- `scope_removal` - Planned functionality removed
- `constraint_change` - Non-functional requirements changed

### Step 3: Load linked documents

Read the feature spec and TDD (if exists) for context:

```javascript
// Load feature spec (should exist in parent feature.json)
const featureJsonPath = path.join(process.cwd(), '.dwa', 'feature.json');
const featureJson = await fs.readJson(featureJsonPath);
const specPath = path.join(process.cwd(), featureJson.spec_path || 'feature-spec.md');
const specContent = await fs.readFile(specPath, 'utf8');

// Load TDD if referenced
let tddContent = null;
if (featureJson.tdd_path) {
  const tddPath = path.join(process.cwd(), featureJson.tdd_path);
  if (await fs.pathExists(tddPath)) {
    tddContent = await fs.readFile(tddPath, 'utf8');
  }
}
```

Parse the spec to find the deliverables table and locate the row for this deliverable.

### Step 4: Analyze drift and generate proposals

For each actionable drift event, analyze:
- The drift summary and evidence
- Current spec text (description, ACs)
- Current TDD content (if applicable)
- Pattern of the change (addition, modification, removal)

Generate proposals using LLM analysis:

**For Spec Updates:**
- Acceptance Criteria additions/modifications
- Description text updates
- QA Plan Notes adjustments

**For TDD Updates:**
- Guardrails section additions
- Decision log entries
- Out of Scope clarifications

**For QA Updates:**
- New test scenarios
- Changed verification approaches
- Edge cases discovered during implementation

### Step 5: Generate patch proposal output

Format the output as reviewable markdown:

```markdown
## Proposed Patches for {deliverable-id}

### Drift Events Analyzed

- [{event-id}] {drift_type}: {summary}
- [{event-id}] {drift_type}: {summary}

### Spec Updates (feature-spec.md)

**Acceptance Criteria additions:**
- [ ] {New AC based on impl_deviation}
- [ ] {Modified AC based on scope_addition}

**Description update:**
> Add: "{Text to append to description}"

**QA Plan Notes update:**
> Add: "{New test scenario discovered}"

### TDD Updates ({tdd-filename}.md)

**Guardrails addition:**
- {New constraint discovered during implementation}

**Decision log addition:**
- [{date}] {Decision made during implementation}

**Out of Scope clarification:**
- {Scope boundary clarified by drift}

---
*Review these proposals and apply manually to spec/TDD files.*
*After applying, run `/dwa:complete {deliverable-id}` to mark drift as accepted.*
```

### Step 6: Handle optional PR context

If user provides PR URL or commit SHA:

```markdown
### Additional Context

**PR/Commit provided:** {url or sha}

For detailed analysis, review the git diff:
\`\`\`bash
git diff {base}..{sha} -- {relevant-paths}
\`\`\`

Consider these implementation details when applying patches.
```

### Step 7: Confirm output

Report to user:
- "Analyzed {N} drift events for {deliverable-id}"
- "Generated patch proposals for: [Spec] [TDD] [QA]"
- ""
- "Review the proposals above and apply changes manually."
- "Use `/dwa:complete {deliverable-id} --decision accept` after applying."

## Output Format Examples

### When drift events exist:

```markdown
## Proposed Patches for DEL-003

### Drift Events Analyzed
- [D1] impl_deviation: Added error handling not in ACs
- [D2] scope_addition: Implemented retry logic for network calls

### Spec Updates (feature-spec.md)

**Acceptance Criteria additions:**
- [ ] System handles connection timeout with retry (3 attempts)
- [ ] Error message displayed to user on final failure

**Description update:**
> Add: "Includes robust error handling for network failures"

### TDD Updates (docs/tdds/feature-tdd.md)

**Guardrails addition:**
- Network calls must use timeout wrapper with configurable duration

**Decision log addition:**
- [2026-01-24] Added retry logic for transient failures (3 attempts with exponential backoff)

---
*Review these proposals and apply manually to spec/TDD files.*
```

### When no drift events:

```markdown
## Proposed Patches for DEL-003

No pending drift for this deliverable.

All drift events have been resolved:
- Accepted: {N}
- Reverted: {M}
- Deferred: {K}

No action needed.
```

## Notes

- This skill uses LLM capabilities (`disable-model-invocation: false`) for analyzing drift patterns and generating human-readable proposals
- Drift events in registry are the source of truth (not drift-log.md which is derived)
- Never auto-apply changes - humans must review and decide
- Proposals can be regenerated as new drift events are recorded
- Works best after `/dwa:complete` has recorded drift events during deliverable completion
