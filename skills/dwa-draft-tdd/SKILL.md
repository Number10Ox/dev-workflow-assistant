---
name: draft-tdd
description: Draft a Technical Design Document from an existing feature spec. Creates docs/tdds/<feature>-tdd.md with decision log, guardrails, and risks.
disable-model-invocation: true
argument-hint: [optional-tdd-filename]
---

# DWA: Draft Technical Design Document

## Purpose
Generate a TDD outline from the feature spec's goals, constraints, and deliverables. The TDD captures architecture decisions, guardrails, risks, and test strategy in a structured format linked to the feature spec.

## Process

### Step 1: Check prerequisites
Verify the feature spec exists before proceeding:

```javascript
const { checkExisting } = require('[DWA_INSTALL_PATH]/src/scaffolding/check-existing');
const fs = require('fs-extra');
const path = require('path');

// Check spec and registry exist
const result = await checkExisting(process.cwd());
const specPath = path.join(process.cwd(), 'feature-spec.md');

if (!result.files.spec) {
  throw new Error('No feature spec found. Run /dwa:create-spec first.');
}

if (!result.files.featureJson) {
  throw new Error('No feature registry found. Run /dwa:create-spec first.');
}
```

If either check fails, tell the user to run `/dwa:create-spec` first and stop.

### Step 2: Check for existing TDD
Check if a TDD already exists for this feature:

```javascript
const featureJson = await fs.readJson(path.join(process.cwd(), '.dwa', 'feature.json'));

if (featureJson.tdd_path) {
  const tddExists = await fs.pathExists(path.join(process.cwd(), featureJson.tdd_path));
  if (tddExists) {
    // TDD already exists - ask before overwriting
  }
}

// Also check docs/tdds/ directory for any TDD files
const tddsDir = path.join(process.cwd(), 'docs', 'tdds');
if (await fs.pathExists(tddsDir)) {
  const tddFiles = await fs.readdir(tddsDir);
  if (tddFiles.some(f => f.endsWith('-tdd.md'))) {
    // TDD file exists - check if it matches this feature
  }
}
```

If TDD already exists:
- Tell the user which TDD file already exists
- Ask: "TDD already exists at [path]. Overwrite? (y/n)"
- If user says no, stop with message: "Creation cancelled. Existing TDD preserved."
- If user says yes, continue to Step 3

### Step 3: Read spec context
Parse the feature spec to get metadata for the TDD:

```javascript
const matter = require('gray-matter');
const specContent = await fs.readFile(specPath, 'utf8');
const { data } = matter(specContent);

const featureId = data.feature_id;
const featureTitle = data.title;
```

### Step 4: Scaffold TDD
Run the scaffold utility to create the TDD:

```javascript
const { scaffoldTDD } = require('[DWA_INSTALL_PATH]/src/scaffolding/scaffold-tdd');

const tddPath = await scaffoldTDD(
  featureId,
  featureTitle,
  'feature-spec.md',
  process.cwd()
);
```

This creates:
- `docs/tdds/<feature-slug>-tdd.md` - Technical Design Document with all sections
- Updates `.dwa/feature.json` with `tdd_path` field
- Updates `feature-spec.md` frontmatter with `tdd_path` field

### Step 5: Confirm success
Report to user:
- "TDD created: [tddPath]"
- "Feature registry updated: .dwa/feature.json"
- "Spec linked: feature-spec.md frontmatter now includes tdd_path"
- ""
- "Next steps:"
- "1. Review Objectives section - align with spec goals"
- "2. Fill in Architecture Overview - diagram or description"
- "3. Document key decisions in Decision Log using ADR format"
- "4. Define Guardrails - performance, security, compatibility constraints"
- "5. Identify Risks and mitigation strategies"
- "6. Outline Test Strategy with evidence requirements"

## Notes
- [DWA_INSTALL_PATH] resolves to the DWA package installation directory (where npx dwa was installed from)
- The scaffold utility uses templates/tdd-v1.hbs template
- TDD files go in docs/tdds/ (not .dwa/) because they are technical documentation meant for version control
- Bidirectional linking: TDD contains spec_path, spec contains tdd_path, feature.json contains both
- ADR format (Architecture Decision Record) is used for the Decision Log section
