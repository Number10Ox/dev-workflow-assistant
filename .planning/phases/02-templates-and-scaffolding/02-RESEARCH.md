# Phase 2: Spec + TDD Scaffolding - Research

**Researched:** 2026-01-24
**Domain:** Technical Design Document (TDD) scaffolding, spec-to-TDD linking, Claude Code skills for LLM-assisted content generation
**Confidence:** HIGH

## Summary

Phase 2 extends the existing spec scaffolding system to add Technical Design Document (TDD) support. Research investigated three critical domains: (1) TDD template structure and sections used in industry, (2) linking patterns between feature specs and technical design docs, and (3) Claude Code skill design for LLM-assisted TDD drafting.

TDDs are separate artifacts from feature specs that capture technical decisions, architecture boundaries, risks, and test strategies. Industry standard TDD templates include: Introduction/Objectives, Architecture Diagrams, Design Details/Components, Implementation Plan, Testing Strategies, and Revision/Decision History. The Architecture Decision Record (ADR) format provides the structured pattern for decision logging, with each decision capturing context, the decision itself, and consequences.

Linking specs to TDDs is bidirectional: the spec's YAML frontmatter includes a `tdd_path` field, and the feature.json registry stores both paths for programmatic access. TDD files live at `docs/tdds/<feature>-tdd.md` (not in `.dwa/`) since they are technical documentation meant to be committed and versioned.

The `/dwa:draft-tdd` skill follows the same 4-step pattern as `/dwa:create-spec`: check existing, get feature info, scaffold from template, confirm. The skill reads the feature spec's frontmatter and deliverables to generate an initial TDD outline with context-specific sections. The scaffolding utilities from Phase 2-01 (scaffold.js) can be reused with a new TDD template.

**Primary recommendation:** Create a separate TDD template (templates/tdd-v1.hbs) with sections for Objectives, Architecture, Decision Log, Guardrails, Risks, and Test Strategy. Add tdd_path field to feature-spec-v2.hbs frontmatter. Store both spec_path and tdd_path in feature.json. Implement `/dwa:draft-tdd` skill that reads spec context and scaffolds TDD using existing scaffoldFromTemplate pattern.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| handlebars | ^4.7.8 | Template engine for TDD template | Already in Phase 2-01, reusable for TDD scaffolding |
| gray-matter | ^4.0.3 | YAML frontmatter parsing/stringifying | Already in Phase 2-01, needed to read spec frontmatter for TDD context |
| fs-extra | ^11.0.0 | File system utilities | Already in Phase 1, provides ensureDir, pathExists for docs/tdds/ |
| write-file-atomic | ^7.0.0 | Atomic file writes | Already in Phase 1, needed for TDD file creation |

**Why reuse existing stack:**
- No new dependencies needed — TDD scaffolding uses identical patterns to spec scaffolding
- Same template engine (Handlebars) for consistent rendering approach
- Same utilities (writeJsonWithSchema) for feature.json updates
- Same atomic write patterns for file safety

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| unified | ^11.0.0 | Markdown parsing (future) | Phase 3+ when parsing TDD sections programmatically |
| remark-parse | ^11.0.0 | Markdown AST parsing (future) | Phase 3+ for extracting decision log entries |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown (future) | Phase 3+ for table parsing in TDD |

**Notes:**
- TDD scaffolding in Phase 2 only creates template files — no parsing needed yet
- Markdown parsing libraries listed for future phases when TDD content needs extraction
- Phase 2 focus is template creation and linking, not content parsing

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate TDD template | Embed TDD in spec as sections | Spec file becomes too large; TDD evolution decoupled from spec |
| docs/tdds/ location | .dwa/tdds/ location | TDDs are technical docs meant for version control, not registry artifacts |
| tdd_path in frontmatter | Hard-coded convention | Explicit linking more robust; allows custom TDD locations |
| Handlebars template | Template literals | Phase 2-01 already uses Handlebars; consistency matters |

**Installation:**
```bash
# No new dependencies needed
# Phase 2-01 already installed: handlebars, gray-matter
# Phase 1 already installed: fs-extra, write-file-atomic
```

## Architecture Patterns

### Recommended Project Structure
```
project-root/
├── feature-spec.md               # Canonical spec (Phase 2-01)
├── docs/
│   └── tdds/
│       └── <feature>-tdd.md      # Technical Design Doc (Phase 2)
├── .dwa/
│   └── feature.json              # Registry with spec_path AND tdd_path
└── (installed package at ~/.claude/dwa/)
    ├── templates/
    │   ├── feature-spec-v2.hbs   # Spec template (Phase 2-01)
    │   └── tdd-v1.hbs            # TDD template (NEW)
    ├── src/scaffolding/
    │   ├── scaffold.js           # Reusable scaffoldFromTemplate
    │   └── check-existing.js     # Reusable checkExisting
    └── skills/
        ├── dwa-create-spec/      # Spec skill (Phase 2-01)
        └── dwa-draft-tdd/        # TDD skill (NEW)
```

### Pattern 1: Bidirectional Spec ↔ TDD Linking
**What:** Feature spec frontmatter includes tdd_path field; feature.json includes both spec_path and tdd_path; TDD frontmatter includes spec_path for reverse link.

**When to use:** All features with technical design complexity requiring architecture decisions, guardrails, or risk documentation.

**Example:**

Feature spec frontmatter (feature-spec.md):
```yaml
---
feature_id: FEAT-2026-123
title: "User Authentication"
owner: "Jane Doe"
status: Draft
tdd_path: "docs/tdds/user-auth-tdd.md"  # NEW FIELD
spec_schema_version: v2.0
---
```

TDD frontmatter (docs/tdds/user-auth-tdd.md):
```yaml
---
feature_id: FEAT-2026-123
title: "User Authentication — Technical Design"
spec_path: "../feature-spec.md"  # Reverse link
tdd_schema_version: v1.0
created: 2026-01-24
updated: 2026-01-24
---
```

Feature registry (.dwa/feature.json):
```json
{
  "schemaVersion": "1.0.0",
  "feature_id": "FEAT-2026-123",
  "title": "User Authentication",
  "spec_path": "feature-spec.md",
  "tdd_path": "docs/tdds/user-auth-tdd.md",
  "created_at": "2026-01-24T10:00:00.000Z"
}
```

**Why bidirectional:**
- From spec: User editing spec can quickly jump to TDD
- From TDD: Developer editing TDD can jump back to requirements
- From registry: Commands can update both files programmatically
- Validation: Can detect broken links (spec exists but TDD missing)

### Pattern 2: TDD Template Structure (Industry Standard)
**What:** TDD templates follow a consistent structure derived from industry practice: Objectives → Architecture → Decisions → Guardrails → Risks → Testing.

**When to use:** All TDD scaffolding operations.

**Example structure:**
```markdown
---
# TDD Frontmatter (YAML)
feature_id: {{feature_id}}
title: "{{title}} — Technical Design"
spec_path: "{{spec_path}}"
tdd_schema_version: v1.0
created: {{created_date}}
updated: {{created_date}}
---

# Technical Design: {{title}}

## 1) Objectives

### Primary Goals
[SMART objectives derived from spec]

### Secondary Goals
[Nice-to-have objectives]

## 2) Architecture Overview

### System Context
[How this feature fits in the overall system]

### Component Diagram
[Placeholder for diagram or description]

### Key Interactions
[External systems, APIs, databases touched]

## 3) Decision Log

> Architecture Decision Records (ADR) format

### Decision 001: [Decision Title]
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Context:** [What situation forces this decision?]
- **Decision:** [What we're doing]
- **Consequences:** [Positive and negative outcomes]

## 4) Guardrails

> Architectural boundaries and "do not" constraints

- **Performance:** [Latency/throughput requirements]
- **Security:** [Authentication, authorization, data protection]
- **Scalability:** [Expected load, growth constraints]
- **Compatibility:** [Browser/platform/version requirements]
- **Do NOT:**
  - [Specific anti-patterns to avoid]

## 5) Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation Strategy | Owner |
|------|------------|--------|---------------------|-------|
| [Risk description] | High/Med/Low | High/Med/Low | [How to mitigate] | [Who] |

## 6) Test Strategy

### Unit Testing
- Coverage targets: [%]
- Key areas: [What to test]

### Integration Testing
- Critical paths: [User flows to test]
- Test environments: [Where to test]

### Evidence Requirements
- [ ] Unit tests for [component]
- [ ] Integration tests for [flow]
- [ ] Performance benchmarks for [metric]

## 7) Implementation Notes

[Open questions, technical debt, future work]

## 8) Revision History

| Date | Author | Changes | Related Deliverable |
|------|--------|---------|---------------------|
| {{created_date}} | {{owner}} | Initial draft | - |
```

**Why this structure:**
- Sections 1-2 (Objectives, Architecture): From industry TDD templates (NotePlan, Devplan)
- Section 3 (Decision Log): From ADR format (adr.github.io, MADR template)
- Section 4 (Guardrails): From agile architecture fitness functions and AI guardrails best practices
- Section 5 (Risks): Standard risk matrix used in TDD templates
- Section 6 (Test Strategy): Derived from PROJECT.md's evidence requirements
- Section 8 (Revision History): Maintains change log for living document

### Pattern 3: Reusable Scaffold Function for TDD
**What:** The scaffoldFromTemplate function from Phase 2-01 is reusable — same function, different template path.

**When to use:** TDD scaffolding from `/dwa:draft-tdd` skill.

**Example:**
```javascript
// File: src/scaffolding/scaffold-tdd.js

const path = require('node:path');
const { scaffoldFromTemplate } = require('./scaffold'); // REUSE PHASE 2-01
const fs = require('fs-extra');

/**
 * Scaffold a TDD from template, reading feature info from spec frontmatter
 */
async function scaffoldTDD(featureId, featureTitle, specPath, targetDir) {
  // 1. Ensure docs/tdds/ directory exists
  const tddsDir = path.join(targetDir, 'docs', 'tdds');
  await fs.ensureDir(tddsDir);

  // 2. Generate TDD filename from feature title
  const slug = featureTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const tddFilename = `${slug}-tdd.md`;
  const tddPath = path.join(tddsDir, tddFilename);

  // 3. Scaffold from TDD template (same pattern as spec)
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'tdd-v1.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');

  const Handlebars = require('handlebars');
  const template = Handlebars.compile(templateContent);
  const rendered = template({
    feature_id: featureId,
    title: featureTitle,
    spec_path: path.relative(path.dirname(tddPath), specPath),
    created_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    owner: getGitUser()
  });

  // 4. Write TDD file atomically
  const writeFileAtomic = require('write-file-atomic');
  await writeFileAtomic(tddPath, rendered, { encoding: 'utf8' });

  // 5. Return relative path from project root
  return path.relative(targetDir, tddPath);
}

function getGitUser() {
  const { execSync } = require('node:child_process');
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return 'Unknown';
  }
}

module.exports = { scaffoldTDD };
```

**Key characteristics:**
- Reuses scaffoldFromTemplate pattern (template + context → rendered file)
- Creates docs/tdds/ directory if missing (ensureDir)
- Generates slug from feature title for filename consistency
- Calculates relative path from TDD to spec for reverse link
- Returns relative path for storing in feature.json

### Pattern 4: /dwa:draft-tdd Skill Design (4-Step Process)
**What:** Claude Code skill that scaffolds TDD by reading spec context and calling scaffold utilities.

**When to use:** User invokes `/dwa:draft-tdd` after creating feature spec.

**Example SKILL.md structure:**
```markdown
---
name: draft-tdd
description: Draft a Technical Design Document from an existing feature spec. Creates docs/tdds/<feature>-tdd.md with decision log, guardrails, and risks.
disable-model-invocation: true
argument-hint: [optional-tdd-filename]
---

# DWA: Draft Technical Design Document

## Purpose
Generate a TDD outline from the feature spec's goals, constraints, and deliverables. The TDD captures architecture decisions, guardrails, risks, and test strategy.

## Process

### Step 1: Check prerequisites
- Verify feature-spec.md exists in current directory
- Verify .dwa/feature.json exists (need feature_id for linking)
- If either missing: error "No feature spec found. Run /dwa:create-spec first."

### Step 2: Check for existing TDD
- Check if docs/tdds/ directory exists and contains TDD for this feature
- Check feature.json for tdd_path field
- If TDD exists: warn "TDD already exists at [path]. Overwrite? (y/n)"
- If user says no, stop

### Step 3: Read spec context
- Parse feature-spec.md frontmatter with gray-matter
- Extract: feature_id, title, owner
- Skim deliverables to identify technical complexity (number of deliverables, AC complexity)

### Step 4: Scaffold TDD
- Call scaffoldTDD(feature_id, title, spec_path, cwd)
- Update feature.json with tdd_path field
- Update feature-spec.md frontmatter with tdd_path field

### Step 5: Confirm success
- Report: "TDD created at [path]"
- "Next steps:"
- "1. Review Objectives section — align with spec goals"
- "2. Fill in Architecture Overview — diagram or description"
- "3. Document key decisions in Decision Log using ADR format"
- "4. Define Guardrails — performance, security, compatibility constraints"
```

**Why this structure:**
- Matches `/dwa:create-spec` pattern (consistent UX)
- Reads spec context before scaffolding (context-aware generation)
- Updates both feature.json AND spec frontmatter (bidirectional linking)
- Provides clear next steps (user knows what to edit)

### Anti-Patterns to Avoid
- **TDD in .dwa/ directory:** TDDs are technical docs for version control, not registry artifacts
- **Hard-coded TDD path in spec:** Use tdd_path field in frontmatter for flexibility
- **One-way linking:** Always update both spec and feature.json when creating TDD
- **TDD content in spec file:** Keep TDD separate; spec is for requirements, TDD is for technical decisions
- **Skipping tdd_schema_version:** Version TDD template format separately from spec template

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ADR format for decisions | Custom decision log format | MADR template (Markdown ADR) | Industry standard, tooling exists, widely understood |
| TDD template structure | Ad-hoc sections | Industry TDD templates (NotePlan, Devplan) | Proven sections cover objectives, architecture, risks, testing |
| Relative path calculation | String manipulation | path.relative() | Handles cross-platform paths, edge cases (../ traversal) |
| TDD filename slugification | Custom regex | String.replace(/[^a-z0-9]+/g, '-') | Simple, reliable, avoids filesystem-unsafe characters |
| Bidirectional linking | Manual path updates | Update both spec frontmatter AND feature.json | Prevents link drift, enables validation |

**Key insight:** TDD structure is well-established in industry (objectives, architecture, decisions, risks, testing). Don't invent new sections — follow proven patterns so developers recognize the format.

## Common Pitfalls

### Pitfall 1: TDD Path Drift (Spec and Registry Out of Sync)
**What goes wrong:** Spec frontmatter says `tdd_path: "docs/tdds/old-name.md"` but feature.json says `tdd_path: "docs/tdds/new-name.md"`. User clicks link in spec and gets 404.

**Why it happens:**
- TDD file renamed manually without updating spec or registry
- Spec frontmatter updated but feature.json not updated (or vice versa)
- Multiple sources of truth without consistency checks

**How to avoid:**
1. Always update BOTH spec frontmatter AND feature.json when creating/moving TDD
2. Add validation command (future phase): check spec tdd_path matches feature.json tdd_path
3. Use relative paths consistently (from project root)
4. Store canonical path in feature.json, derive from there

**Warning signs:**
- User reports "TDD link is broken"
- File exists but path doesn't match registry

**Example fix:**
```javascript
// When scaffolding TDD, update both sources
await updateSpecFrontmatter(specPath, { tdd_path: relativeTddPath });
await updateFeatureJson(featureJsonPath, { tdd_path: relativeTddPath });
```

### Pitfall 2: TDD Schema Version Mismatch
**What goes wrong:** TDD template evolves (add new sections, change ADR format). Old TDDs have v1.0 schema, new TDDs have v1.1 schema. Parsing commands break.

**Why it happens:**
- No schema versioning in TDD frontmatter
- Template changes without version bump
- No migration path for old TDDs

**How to avoid:**
1. Include tdd_schema_version in frontmatter (like spec_schema_version)
2. Bump version when template structure changes
3. Commands check schema version before parsing
4. Provide migration commands (future phase)

**Warning signs:**
- Parsing errors on old TDDs after template update
- New sections missing in old TDDs

**Example version check:**
```javascript
const { data } = matter(tddContent);
if (data.tdd_schema_version !== '1.0') {
  console.warn(`TDD schema version ${data.tdd_schema_version} may not be compatible`);
}
```

### Pitfall 3: Decision Log Format Inconsistency
**What goes wrong:** Developers add decisions to Decision Log in different formats. Some use ADR format (Context/Decision/Consequences), others use freeform text. Parsing logic can't extract decisions reliably.

**Why it happens:**
- Template shows ADR example but doesn't enforce structure
- No validation or linting for decision format
- Developers unfamiliar with ADR format

**How to avoid:**
1. Template includes clear ADR format example with all required fields
2. Skill instruction includes: "Use ADR format for all decisions"
3. Provide decision number sequence (001, 002, 003) for easy reference
4. Future: Validate decision format with remark parser

**Warning signs:**
- Decisions missing Status or Consequences fields
- Inconsistent heading levels (### vs ####)

**Example template guidance:**
```markdown
## 3) Decision Log

> Use Architecture Decision Record (ADR) format for all decisions.
> Each decision must include: Date, Status, Context, Decision, Consequences.

### Decision 001: [Example Decision Title]
- **Date:** 2026-01-24
- **Status:** Accepted
- **Context:** We need to choose between REST and GraphQL for the API.
- **Decision:** We will use GraphQL for flexible querying.
- **Consequences:**
  - Positive: Clients can request exactly what they need
  - Negative: Learning curve for team, more complex caching
```

### Pitfall 4: Guardrails Too Vague to Be Useful
**What goes wrong:** TDD Guardrails section says "must be performant" or "should be secure". When creating execution packets, these guardrails don't provide actionable constraints.

**Why it happens:**
- Template doesn't provide concrete examples
- Developers unfamiliar with writing testable constraints
- No link between spec's "Constraints" section and TDD guardrails

**How to avoid:**
1. Template includes specific guardrail examples (latency < 200ms, supports 10k concurrent users)
2. Skill instruction: "Convert spec constraints into measurable guardrails"
3. Guardrails organized by category (Performance, Security, Scalability, Compatibility)
4. Each guardrail should be testable (unit/integration/load test)

**Warning signs:**
- Guardrails use words like "should" or "must" without metrics
- No connection to spec's Constraints section
- Execution packets don't reference guardrails (because they're not actionable)

**Example specific guardrails:**
```markdown
## 4) Guardrails

### Performance
- API response time: < 200ms p95
- Database queries: < 50ms per query
- No N+1 queries in list endpoints

### Security
- Authentication: OAuth 2.0 with JWT tokens
- Authorization: RBAC with role checks on all mutations
- Data encryption: TLS 1.3 in transit, AES-256 at rest

### Scalability
- Supports 10,000 concurrent users
- Horizontal scaling via stateless services
- Database read replicas for query distribution

### Compatibility
- Browsers: Chrome 120+, Firefox 120+, Safari 17+
- Node.js: 18.x LTS or later
```

### Pitfall 5: TDD Not Updated as Implementation Evolves
**What goes wrong:** Implementation reveals new architectural decisions or risks. Developer updates code and tests but forgets to update TDD. TDD becomes stale, loses value as "living document".

**Why it happens:**
- No workflow hook to update TDD during implementation
- Developers see TDD as "planning artifact" not "living document"
- No reminder to update TDD in execution packet template

**How to avoid:**
1. Execution packet template includes: "Section 8: TDD Updates" (captures decisions made during implementation)
2. Complete Deliverable command prompts: "Were new architectural decisions made? Update TDD."
3. TDD frontmatter includes updated field (timestamp of last change)
4. Future: Drift check validates TDD updated field vs last commit date

**Warning signs:**
- TDD created date months old, no updates
- Implementation includes architecture decisions not in TDD
- Execution packets don't reference TDD sections

**Example workflow integration:**
```markdown
# Execution Packet — DEL-003 — Database Layer

## 8) TDD Updates

Decisions made during implementation:

### Decision 004: Use Connection Pooling
- **Date:** 2026-01-25
- **Status:** Accepted
- **Context:** Initial implementation created new DB connection per request
- **Decision:** Implemented connection pooling with max 20 connections
- **Consequences:**
  - Positive: Reduced connection overhead, improved latency
  - Negative: Need to handle pool exhaustion errors

[Action: Add this decision to TDD after deliverable completion]
```

## Code Examples

Verified patterns from existing code and industry sources:

### Updating Spec Frontmatter with TDD Path
```javascript
// Source: gray-matter stringify pattern (https://github.com/jonschlinkert/gray-matter)
const matter = require('gray-matter');
const fs = require('fs-extra');

async function updateSpecWithTDDPath(specPath, tddPath) {
  // 1. Read and parse existing spec
  const specContent = await fs.readFile(specPath, 'utf8');
  const { data, content } = matter(specContent);

  // 2. Add tdd_path to frontmatter
  data.tdd_path = tddPath;

  // 3. Stringify back to file (preserves frontmatter structure)
  const updated = matter.stringify(content, data);

  // 4. Write atomically
  const writeFileAtomic = require('write-file-atomic');
  await writeFileAtomic(specPath, updated, { encoding: 'utf8' });
}
```

### Scaffolding TDD from Template
```javascript
// Source: Reuse Phase 2-01 pattern from src/scaffolding/scaffold.js
const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('node:path');

async function scaffoldTDD(featureId, featureTitle, specPath, targetDir) {
  // 1. Ensure docs/tdds/ exists
  const tddsDir = path.join(targetDir, 'docs', 'tdds');
  await fs.ensureDir(tddsDir);

  // 2. Generate TDD filename
  const slug = featureTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const tddFilename = `${slug}-tdd.md`;
  const tddPath = path.join(tddsDir, tddFilename);

  // 3. Load and render template
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'tdd-v1.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);

  // Calculate relative path from TDD to spec
  const relativeSpecPath = path.relative(path.dirname(tddPath), path.join(targetDir, specPath));

  const rendered = template({
    feature_id: featureId,
    title: featureTitle,
    spec_path: relativeSpecPath,
    created_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    owner: getGitUser()
  });

  // 4. Verify no placeholder leakage
  if (/\{\{[^}]+\}\}/.test(rendered)) {
    throw new Error('TDD template rendering incomplete: unreplaced placeholders remain');
  }

  // 5. Write atomically
  const writeFileAtomic = require('write-file-atomic');
  await writeFileAtomic(tddPath, rendered, { encoding: 'utf8' });

  // 6. Return path relative to project root
  return path.relative(targetDir, tddPath);
}

function getGitUser() {
  const { execSync } = require('node:child_process');
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return 'Unknown';
  }
}
```

### Updating Feature Registry with TDD Path
```javascript
// Source: Phase 1 writeJsonWithSchema pattern
const { writeJsonWithSchema } = require('../utils/schema');
const fs = require('fs-extra');
const path = require('node:path');

async function updateFeatureJsonWithTDD(targetDir, tddPath) {
  const featureJsonPath = path.join(targetDir, '.dwa', 'feature.json');

  // 1. Read existing feature.json
  const existing = await fs.readJSON(featureJsonPath);

  // 2. Add tdd_path field
  existing.tdd_path = tddPath;

  // 3. Write back with schema version preserved
  await writeJsonWithSchema(featureJsonPath, {
    ...existing,
    schemaVersion: undefined // writeJsonWithSchema adds this
  });
}
```

### Claude Code Skill for TDD Drafting
```markdown
# Source: Phase 2-02 /dwa:create-spec skill pattern
---
name: draft-tdd
description: Draft a Technical Design Document from an existing feature spec. Creates docs/tdds/<feature>-tdd.md with decision log, guardrails, and risks.
disable-model-invocation: true
argument-hint: [optional-tdd-filename]
---

# DWA: Draft Technical Design Document

## Purpose
Generate a TDD outline from the feature spec's goals, constraints, and deliverables.

## Process

### Step 1: Check prerequisites
```javascript
const { checkExisting } = require('[DWA_INSTALL_PATH]/src/scaffolding/check-existing');
const fs = require('fs-extra');
const path = require('path');

// Check spec exists
const specPath = path.join(process.cwd(), 'feature-spec.md');
if (!await fs.pathExists(specPath)) {
  throw new Error('No feature spec found. Run /dwa:create-spec first.');
}

// Check registry exists
const result = await checkExisting(process.cwd());
if (!result.files.featureJson) {
  throw new Error('No feature registry found. Run /dwa:create-spec first.');
}
```

### Step 2: Check for existing TDD
```javascript
const featureJson = await fs.readJSON(path.join(process.cwd(), '.dwa', 'feature.json'));
if (featureJson.tdd_path) {
  const tddExists = await fs.pathExists(path.join(process.cwd(), featureJson.tdd_path));
  if (tddExists) {
    // Ask user before overwriting
  }
}
```

### Step 3: Read spec context
```javascript
const matter = require('gray-matter');
const specContent = await fs.readFile(specPath, 'utf8');
const { data } = matter(specContent);

const featureId = data.feature_id;
const featureTitle = data.title;
```

### Step 4: Scaffold TDD
```javascript
const { scaffoldTDD } = require('[DWA_INSTALL_PATH]/src/scaffolding/scaffold-tdd');
const tddPath = await scaffoldTDD(featureId, featureTitle, 'feature-spec.md', process.cwd());

// Update feature.json
await updateFeatureJsonWithTDD(process.cwd(), tddPath);

// Update spec frontmatter
await updateSpecWithTDDPath(specPath, tddPath);
```

### Step 5: Confirm success
Report to user:
- "TDD created at [tddPath]"
- "Next steps:"
- "1. Review Objectives section"
- "2. Fill in Architecture Overview"
- "3. Document decisions in Decision Log (ADR format)"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TDD embedded in spec file | TDD as separate artifact at docs/tdds/ | PROJECT.md architecture decision | TDD evolves independently, cleaner spec files |
| Freeform decision notes | ADR (Architecture Decision Record) format | Industry standard ~2019 | Structured decisions, tooling support, widely recognized |
| Hard-coded TDD location | tdd_path field in spec frontmatter | This phase | Flexible TDD organization, validation possible |
| Manual TDD creation | Scaffolded from template with spec context | This phase | Consistent structure, auto-linked to spec |
| TDD as static doc | Living document updated during implementation | Agile architecture trend ~2020 | TDD stays relevant, captures emergent decisions |

**Deprecated/outdated:**
- **TDD in spec file:** Causes spec to grow too large, couples requirements to technical decisions
- **Word/PDF TDDs:** Version control issues, hard to link programmatically, not diff-friendly
- **No decision log:** Architecture decisions lost in chat/email, not captured for future reference

## Open Questions

Things that couldn't be fully resolved:

1. **TDD content generation depth**
   - What we know: `/dwa:draft-tdd` scaffolds TDD template from spec context
   - What's unclear: How much content should the LLM generate vs leaving for user to fill? (Objectives from spec goals? Risks from spec constraints?)
   - Recommendation: Phase 2 scaffolds empty template structure. Future phase adds LLM content generation from spec analysis. Start simple, add intelligence later.

2. **ADR numbering scheme**
   - What we know: Decisions numbered sequentially (001, 002, 003) for reference
   - What's unclear: Should numbering be global per-project or per-feature? Reset on new feature or continue sequence?
   - Recommendation: Number per-feature (001-999). If decisions span features, reference them explicitly: "See Feature A Decision 005".

3. **TDD diagram support**
   - What we know: TDD template includes "Architecture Diagrams" section
   - What's unclear: What format for diagrams? (Mermaid, PlantUML, image files, external tools?)
   - Recommendation: Phase 2 includes placeholder text. Phase 3+ can add Mermaid diagram scaffolding (text-based, version-controllable). Leave external tools as option.

4. **Guardrails extraction from spec**
   - What we know: Spec has "Constraints" section (1.4 Non-Goals / Constraints)
   - What's unclear: Should `/dwa:draft-tdd` auto-extract spec constraints into TDD guardrails? Manual or automated?
   - Recommendation: Phase 2 manual (user fills guardrails). Future skill `/dwa:sync-guardrails` can extract spec constraints → TDD guardrails.

5. **TDD update workflow during execution**
   - What we know: TDD should be updated during implementation (living document)
   - What's unclear: How to remind developers to update TDD? Execution packet template? Git pre-commit hook?
   - Recommendation: Execution packet Section 8 includes "TDD Updates" reminder. Complete Deliverable command (future phase) prompts for TDD updates. No automated enforcement (trust over process).

## Sources

### Primary (HIGH confidence)
- Phase 2-01 implementation (templates/feature-spec-v2.hbs, src/scaffolding/scaffold.js, src/scaffolding/check-existing.js) — Existing scaffolding patterns to reuse
- .planning/PROJECT.md — Architectural decision for TDD as separate artifact, TDD content definition
- gray-matter NPM package documentation (https://github.com/jonschlinkert/gray-matter) — Frontmatter parse/stringify API
- Phase 1 implementation (src/utils/schema.js) — Schema versioning pattern

### Secondary (MEDIUM confidence)
- [NotePlan Technical Design Document Template](https://noteplan.co/templates/technical-design-document-template) — Industry TDD structure (Objectives, Architecture, Design Details, Testing)
- [MADR (Markdown Architectural Decision Records)](https://adr.github.io/madr/) — ADR format for Decision Log
- [ADR GitHub Organization](https://adr.github.io/) — Architecture Decision Record templates and patterns
- [Stack Overflow: Practical Guide to Writing Technical Specs](https://stackoverflow.blog/2020/04/06/a-practical-guide-to-writing-technical-specs/) — Relationship between feature specs and technical specs
- [Thoughtworks: Spec-Driven Development 2025](https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices) — Current industry thinking on specs vs technical design docs
- [Medium: Agile Architecture Fitness Functions & Guardrails](https://medium.com/@stefano.rossini.mail/agile-architecture-part-7-fitness-functions-architectural-guardrails-28ed22ade476) — Guardrails best practices

### Tertiary (LOW confidence - require validation)
- WebSearch results on TDD best practices 2026 (Asana, Monday.com, Document360) — General TDD structure guidance
- Google Cloud MCP announcement (Google services MCP support) — Future integration potential (not needed for Phase 2)

## Metadata

**Confidence breakdown:**
- TDD template structure: HIGH — Multiple industry sources agree (NotePlan, Devplan, ADR templates)
- Spec ↔ TDD linking: HIGH — Based on PROJECT.md architecture decisions and industry practices
- Reuse of Phase 2-01 utilities: HIGH — Code already exists and tested, pattern proven
- /dwa:draft-tdd skill design: HIGH — Follows established /dwa:create-spec pattern from Phase 2-02
- ADR format for decision log: HIGH — Industry standard (adr.github.io, MADR), widely adopted

**Research date:** 2026-01-24
**Valid until:** 60 days (TDD practices stable, templates evolve slowly, ADR format mature)
