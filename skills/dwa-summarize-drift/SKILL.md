---
name: summarize-drift
description: Generate human-readable drift summary for PR comments or stakeholder updates. Adapts tone and detail for technical or non-technical audiences.
disable-model-invocation: false
argument-hint: [scope: all | DEL-###] [--audience technical|stakeholder]
---

# DWA: Summarize Drift

## Purpose

Produce human-readable summaries of implementation drift for different audiences. Technical summaries help developers in PR reviews; stakeholder summaries help PMs and product owners understand what changed from the original plan without needing to parse technical details.

## Critical Rules

**MUST NOT:**
- Include implementation details in stakeholder summaries
- Use jargon without explanation for stakeholders
- Omit actionable next steps
- Present accepted/reverted drift as needing decision

**MUST:**
- Adapt tone and detail level for audience
- Highlight decisions that still need input
- Reference specific deliverable IDs
- Include actionable next steps for the audience
- Distinguish between open (pending/escalate) and resolved drift

## Process

### Step 1: Determine scope and audience

Parse user input for scope and audience:

```javascript
// Scope options:
// - "all" - project-wide summary
// - "DEL-###" - specific deliverable

// Audience options:
// - "technical" (default) - for PR comments, developers
// - "stakeholder" - for PM/product updates

const scope = args[0] || 'all';
const audience = args.find(a => a.startsWith('--audience'))?.split('=')[1] || 'technical';
```

### Step 2: Load drift data

**For specific deliverable (scope = DEL-###):**

```javascript
const registryPath = path.join(process.cwd(), '.dwa', 'deliverables', `${scope}.json`);
const registry = await fs.readJson(registryPath);
const driftEvents = registry.drift_events || [];
const deliverableName = registry.user_story || registry.description || scope;
```

**For project-wide (scope = "all"):**

```javascript
// Option A: Read drift log for formatted view
const driftLogPath = path.join(process.cwd(), '.dwa', 'drift-log.md');

// Option B: Scan all deliverable registries for drift_events
const deliverablesDir = path.join(process.cwd(), '.dwa', 'deliverables');
const deliverableFiles = await fs.readdir(deliverablesDir);
const allDriftEvents = [];

for (const file of deliverableFiles) {
  if (file.endsWith('.json')) {
    const registry = await fs.readJson(path.join(deliverablesDir, file));
    if (registry.drift_events?.length > 0) {
      allDriftEvents.push({
        deliverableId: registry.deliverable_id,
        name: registry.user_story || registry.description,
        events: registry.drift_events
      });
    }
  }
}
```

### Step 3: Filter and categorize drift

Separate drift by decision status:

```javascript
const openDrift = events.filter(e =>
  e.decision === 'pending' || e.decision === 'escalate'
);
const resolvedDrift = events.filter(e =>
  e.decision === 'accept' || e.decision === 'revert' || e.decision === 'defer'
);
```

Categorize by type for structured output:
- Implementation deviations
- Scope additions
- Scope removals
- Constraint changes

### Step 4: Generate audience-appropriate summary

**For technical audience (PR comments, developers):**

Use specific terminology, include IDs, reference commands:

```markdown
## Drift Summary

**Scope:** {deliverable-id} ({deliverable-name})
**Open items:** {count}
**Resolved:** {count}

### Implementation Deviations

1. **{brief-description}** - {technical-detail}
   - Decision: {pending|escalate}
   - Event ID: {event-id}
   - Recommendation: {Accept and update spec | Revert | Defer to next iteration}

2. **{brief-description}** - {technical-detail}
   - Decision: {pending|escalate}
   - Event ID: {event-id}
   - Recommendation: {recommendation}

### Scope Changes

- **Added:** {description}
- **Removed:** {description}

### Next Steps
- [ ] Review patches: Run `/dwa:propose-drift-patches {deliverable-id}`
- [ ] Update spec with accepted changes
- [ ] Close drift events with `/dwa:complete {id} --decision accept`
```

**For stakeholder audience (PM/product updates):**

Use plain language, focus on impact, hide technical details:

```markdown
## Implementation Update: {feature-name}

During implementation, we made {N} changes from the original plan:

1. **{user-friendly-title}** - {plain-language-explanation-of-change}
   - Impact: {positive|neutral|needs-attention}
   - Why: {simple rationale}

2. **{user-friendly-title}** - {plain-language-explanation-of-change}
   - Impact: {positive|neutral|needs-attention}
   - Why: {simple rationale}

### Summary

| Category | Count | Impact |
|----------|-------|--------|
| Improvements | {N} | {summary} |
| Changes | {N} | {summary} |
| Items removed | {N} | {summary} |

### Timeline Impact
{None expected | May add {X} time | Needs discussion}

### Decision Needed
{Please confirm these changes are acceptable, or flag concerns.}
OR
{No decisions needed - all changes are informational.}
```

### Step 5: Handle edge cases

**No drift events:**
```markdown
## Drift Summary

**Scope:** {scope}
**Status:** No drift recorded

Implementation is tracking exactly to spec. No deviations detected.
```

**All drift resolved:**
```markdown
## Drift Summary

**Scope:** {scope}
**Open items:** 0
**Resolved:** {N}

All drift has been addressed:
- Accepted: {N} (spec updated to match implementation)
- Reverted: {N} (implementation changed to match spec)
- Deferred: {N} (tracked for future consideration)

No action needed.
```

### Step 6: Confirm output

Report to user what was generated:
- "Generated {audience} summary for {scope}"
- "Open drift items: {N}"
- "Resolved drift items: {M}"
- ""
- "Copy this summary to your PR comment or stakeholder update."

## Output Format Examples

### Technical summary (for PR):

```markdown
## Drift Summary

**Scope:** DEL-001 (User Authentication)
**Open items:** 2

### Implementation Deviations

1. **Added retry logic** - Network calls now include 3-attempt retry with exponential backoff. Not in original ACs but improves reliability.
   - Decision: Pending
   - Event ID: D1
   - Recommendation: Accept and update spec

2. **Changed error format** - Errors now return structured {code, message} instead of string.
   - Decision: Pending
   - Event ID: D2
   - Recommendation: Accept (breaking change documented)

### Next Steps
- [ ] Review patches: Run `/dwa:propose-drift-patches DEL-001`
- [ ] Update spec with accepted changes
- [ ] Close drift events with decisions
```

### Stakeholder summary (for PM):

```markdown
## Implementation Update: User Authentication

During implementation, we made two changes from the original plan:

1. **Improved reliability** - Added automatic retry for network issues. Users will see fewer connection errors.
   - Impact: Positive
   - Why: Common user complaint during testing

2. **Better error messages** - Error responses now include specific codes for easier debugging.
   - Impact: Positive
   - Why: Support team requested this for troubleshooting

### Summary

| Category | Count | Impact |
|----------|-------|--------|
| Improvements | 2 | Better user experience |
| Changes | 0 | - |
| Items removed | 0 | - |

### Timeline Impact
None expected - both changes were small additions.

### Decision Needed
Please confirm these changes are acceptable, or flag if we should revert.
```

## Notes

- This skill uses LLM capabilities (`disable-model-invocation: false`) for adapting language and tone to audience
- Drift log (.dwa/drift-log.md) can be used as reference but registry drift_events are source of truth
- Technical summaries are designed for copy-paste into GitHub PR comments
- Stakeholder summaries avoid jargon and focus on business impact
- Can be regenerated as drift events are added or resolved
