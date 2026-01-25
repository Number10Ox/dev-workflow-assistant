---
name: enrich-packet
description: Enrich an execution packet with implementation targets, file suggestions, and risk notes from codebase analysis. Does NOT modify contract sections (ACs, QA, constraints).
disable-model-invocation: false
argument-hint: [deliverable-id]
---

# DWA: Enrich Execution Packet

## Purpose
Add non-deterministic implementation guidance to an existing execution packet through codebase analysis. The skill enhances packets with AI-assisted insights about likely files, APIs, gotchas, and test locations while preserving the deterministic contract.

## Critical Rules

**MUST NOT:**
- Edit text in sections 0-8 (control, guardrails, goal, story, ACs, QA, dependencies, provenance, drift)
- Remove or reorder existing content
- Modify acceptance criteria inline
- Change QA verification steps
- Alter constraint lists

**MUST:**
- Append all enrichment AFTER existing content
- Mark enrichment clearly with "ENRICHMENT (LLM-Generated)" header
- Put any suggested contract changes in "Patch Proposal" section only
- Preserve the execution contract exactly as generated

## Process

### Step 1: Locate packet

Read the packet from `.dwa/packets/{deliverable-id}.md`:

```javascript
const fs = require('fs-extra');
const path = require('path');

const packetPath = path.join(process.cwd(), '.dwa', 'packets', `${deliverableId}.md`);

if (!await fs.pathExists(packetPath)) {
  throw new Error(`Packet not found: ${packetPath}. Run /dwa:start first.`);
}

const packetContent = await fs.readFile(packetPath, 'utf8');
```

Extract key context from the packet:
- Goal (section 2)
- User story (section 3)
- Acceptance criteria (section 4)
- MUST/MUST NOT constraints (section 1)
- Dependencies (section 6)

### Step 2: Analyze codebase

Use Claude's tools to search the codebase for relevant patterns:

**Grep for keywords:**
- Extract nouns and verbs from goal and AC descriptions
- Search for existing implementations of similar features
- Find API patterns and utilities

```
Grep: pattern="[keyword from goal]" path="src/"
Grep: pattern="[pattern from AC]" type="js"
```

**Glob for file patterns:**
- Find files in feature areas mentioned in the packet
- Locate test files for similar features
- Identify configuration files that may need updates

```
Glob: pattern="src/**/*[feature-area]*.js"
Glob: pattern="test/**/*.test.js"
```

**Read relevant files:**
- Review matched files to understand existing patterns
- Note API signatures, conventions, and anti-patterns
- Identify test harness and assertion patterns

### Step 3: Generate enrichment sections

Based on codebase analysis, produce content for:

**a) Implementation Targets:**
- Files likely touched (existing files with grep matches)
- New files expected (based on naming conventions in codebase)
- Key APIs to use (from existing code patterns)
- Key APIs to avoid (deprecated, anti-patterns found)

**b) Gotchas & Risk Notes:**
- Lifecycle constraints (initialization order, cleanup requirements)
- Threading considerations (async patterns, race conditions)
- Serialization edge cases (JSON handling, encoding)
- Platform-specific issues (if detected)
- Error handling patterns to follow

**c) Test Additions:**
- Where unit tests live (detected from codebase structure)
- Test harness conventions (describe/it, test runner patterns)
- Recommended test coverage areas
- Integration test patterns if applicable

**d) AC Coverage Map:**
- For each AC, suggest: unit test / integration test / manual check
- Flag ACs that may be hard to test automatically
- Note any ACs that overlap or have dependencies

### Step 4: Append enrichment to packet

Add the enrichment sections AFTER all existing content. Use this exact format:

```markdown
---

## ENRICHMENT (LLM-Generated)

> The following sections were added by /dwa:enrich-packet and contain AI-assisted analysis.
> Contract sections above (Goal, ACs, QA, Constraints) are authoritative and unchanged.

### Implementation Targets

**Files Likely Touched:**
- `path/to/file.js` - [reason from analysis]
- `path/to/other.js` - [reason from analysis]

**New Files Expected:**
- `path/to/new-file.js` - [based on naming conventions]

**Key APIs:**
- USE: `apiName()` - [why recommended]
- USE: `utilityFunction()` - [pattern found in codebase]
- AVOID: `deprecatedApi()` - [why to avoid]

### Gotchas & Risk Notes

- [Specific warning from codebase analysis]
- [Threading or async consideration]
- [Edge case to watch for]

### Test Additions

**Unit Tests:** `test/unit/[feature-area]/`
**Integration Tests:** `test/integration/` (if applicable)

**AC Coverage Map:**

| AC | Test Type | Location | Notes |
|----|-----------|----------|-------|
| C1 | Unit | `test/unit/feature.test.js` | [suggestion] |
| C2 | Integration | `test/integration/` | [suggestion] |
| F1 | Unit | `test/unit/feature.test.js` | [suggestion] |

### Patch Proposal

> If contract changes are recommended based on codebase analysis, list them here.
> User decides whether to accept these changes. Do NOT apply them inline.

[No changes proposed]
OR
[Specific proposed changes to ACs, QA, or constraints with rationale]
```

Write the enriched packet back to the same path:

```javascript
const enrichedContent = packetContent + '\n' + enrichmentSections;
await fs.writeFile(packetPath, enrichedContent, 'utf8');
```

### Step 5: Confirm enrichment

Report to user:
- "Packet enriched: .dwa/packets/{id}.md"
- "Added sections: Implementation Targets, Gotchas, Test Additions, AC Coverage Map"
- "Contract sections (Goal, ACs, QA, Constraints) unchanged"
- ""
- "Review the Patch Proposal section if any contract changes are suggested."

## Notes

- This skill uses LLM capabilities (`disable-model-invocation: false`) for codebase analysis and content generation
- Enrichment is optional - packets are fully usable without it
- Run this skill AFTER `/dwa:start` generates the packet shell
- Enrichment can be re-run to update analysis as codebase evolves
- Contract changes ONLY in Patch Proposal - never modify sections 0-8 inline
