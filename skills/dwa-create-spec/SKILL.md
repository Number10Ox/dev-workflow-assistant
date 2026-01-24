---
name: create-spec
description: Create a new feature spec from Template v2.0. Creates feature-spec.md and .dwa/feature.json in the current directory.
disable-model-invocation: true
argument-hint: [feature-title]
---

# DWA: Create Feature Spec

## Purpose
Scaffold a new feature spec from Template v2.0, creating `feature-spec.md` with YAML front matter and an empty Deliverables Table, plus `.dwa/feature.json` with feature metadata.

## Process

### Step 1: Check for existing spec
Run the check-existing utility to see if this directory already has a feature spec:

```javascript
const { checkExisting } = require('[DWA_INSTALL_PATH]/src/scaffolding/check-existing');
const result = await checkExisting(process.cwd());
```

If `result.alreadyInitialized` is true:
- Tell the user which files already exist (feature-spec.md, .dwa/feature.json, or both)
- Ask: "Feature spec already exists. Overwrite? (y/n)"
- If user says no, stop with message: "Creation cancelled. Existing files preserved."
- If user says yes, continue to Step 2

### Step 2: Get feature title
If a feature title was provided as an argument, use it.
Otherwise, ask the user: "What is the feature title?"

The title will be used in:
- YAML frontmatter `title` field
- H1 heading in the spec
- `title` field in .dwa/feature.json

### Step 3: Scaffold the feature spec
Run the scaffold utility:

```javascript
const { scaffoldFromTemplate } = require('[DWA_INSTALL_PATH]/src/scaffolding/scaffold');
const result = await scaffoldFromTemplate(featureTitle, process.cwd());
```

This creates:
- `feature-spec.md` - Feature spec with YAML front matter and empty Deliverables Table
- `.dwa/feature.json` - Feature metadata with schemaVersion, title, spec_path, created_at

### Step 4: Confirm success
Report to user:
- "Feature spec created: feature-spec.md"
- "Feature registry created: .dwa/feature.json"
- ""
- "Next steps:"
- "1. Edit feature-spec.md to fill in Overview, User Stories, and Deliverables Table"
- "2. Run /dwa:parse to extract deliverables into the registry"

## Notes
- [DWA_INSTALL_PATH] resolves to the DWA package installation directory (where npx dwa was installed from)
- The scaffold utility uses the package's templates/feature-spec-v2.hbs template
- feature.json always includes schemaVersion field via writeJsonWithSchema utility
- Google Docs import is planned for Phase 8 (not yet implemented)
