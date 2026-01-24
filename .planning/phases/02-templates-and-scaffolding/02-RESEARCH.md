# Phase 2: Templates and Scaffolding - Research

**Researched:** 2026-01-24
**Domain:** Claude Code skills, file scaffolding, template-based generation, Google Docs MCP integration
**Confidence:** HIGH

## Summary

Phase 2 implements `/dwa:init`, a Claude Code skill that scaffolds feature specs from Template v2.0 or imports from Google Docs via MCP. This research investigated three critical domains: (1) Claude Code skill file format and execution model, (2) file scaffolding patterns for Node.js, and (3) Google Docs MCP integration capabilities.

Claude Code skills are markdown files with YAML frontmatter that instruct Claude to execute specific workflows. Skills can invoke Node.js utilities installed by Phase 1, use template files for scaffolding, and call MCP servers for external integrations. The skill file itself contains no executable code — it's a prompt that Claude reads and follows.

Template scaffolding requires a template engine (Handlebars recommended), placeholder replacement logic, and atomic file writes. The Feature Spec Template v2.0 format (already user-provided) defines YAML front matter fields and a Deliverables Table structure that Phase 3 will parse. Google Docs import requires MCP integration via the dev-workflow-assistant extension, which provides OAuth-authenticated access to Google Drive.

**Primary recommendation:** Use Handlebars for template rendering with a dedicated `templates/` directory in the installed package. Create utility functions for file scaffolding that the skill instructs Claude to invoke. Support both local scaffolding and Google Docs import via conditional logic in the skill.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| handlebars | ^4.7.8 | Template engine | Industry standard, simple syntax, supports partials and helpers |
| gray-matter | ^4.0.3 | YAML frontmatter parsing/stringifying | Battle-tested (used by Gatsby, Netlify, Astro), supports both parse and stringify |
| fs-extra | ^11.0.0 | File system utilities | Already in Phase 1 dependencies, provides `ensureDir`, `copy`, atomic writes |
| write-file-atomic | ^7.0.0 | Atomic file writes | Already in Phase 1 dependencies, prevents partial state on write failures |

**Why these choices:**
- **Handlebars over template literals:** Supports external template files (in `templates/` directory), helpers for date formatting, conditional logic
- **gray-matter over front-matter:** Provides `stringify()` method (not just parse), which is needed if importing from Google Docs and converting to markdown with frontmatter
- **Reuse Phase 1 dependencies:** fs-extra and write-file-atomic already installed, no new dependencies needed for file operations

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/* | Latest | MCP client integration | Google Docs import feature (if using official MCP SDK) |
| google-drive-mcp | Community | Google Drive/Docs access | If dev-workflow-assistant extension not available |

**Notes:**
- Google Docs integration assumes dev-workflow-assistant extension provides MCP bridge
- If extension unavailable, community MCP servers exist (google-drive-mcp, google-docs-mcp)
- Phase 2 focuses on scaffolding; actual Google Docs fetch happens via MCP tools Claude already has access to

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Handlebars | Mustache | Simpler but no helpers (date formatting, case conversion) |
| Handlebars | Template literals | No external template files, harder to maintain templates |
| gray-matter | front-matter | Parse-only (no stringify), would need separate library for writing frontmatter |
| fs-extra | fs/promises | Phase 1 already uses fs-extra (CommonJS), consistency matters |

**Installation:**
```bash
npm install handlebars gray-matter
```

## Architecture Patterns

### Recommended Project Structure
```
~/.claude/dwa/                        # Installed by Phase 1
├── skills/
│   └── init/
│       ├── SKILL.md                  # /dwa:init skill (instructs Claude)
│       └── examples/
│           └── sample-spec.md        # Example output for reference
├── templates/
│   └── feature-spec-v2.hbs           # Handlebars template (user-provided structure)
├── utils/
│   ├── scaffold.js                   # Scaffolding utilities (called by Claude)
│   └── schema.js                     # Schema version helper (from Phase 1)
└── references/
    └── template-spec.md              # Documentation of Template v2.0 format

.dwa/                                 # Project-local registry (created by /dwa:init)
├── feature.json                      # Feature metadata
└── (deliverables/ added in Phase 3)
```

### Pattern 1: Skill as Orchestrator (Claude Code Skills)
**What:** A Claude Code skill is a markdown file with YAML frontmatter and markdown instructions. Claude reads the file and executes the instructions using available tools.

**When to use:** All user-facing commands (`/dwa:init`, `/dwa:parse`, etc.)

**Example:**
```markdown
---
name: init
description: Initialize a new feature spec from Template v2.0 or import from Google Docs
disable-model-invocation: true
---

# DWA: Initialize Feature Spec

## Purpose
Scaffold a feature spec from Template v2.0 or import from Google Docs via MCP.

## Prerequisites
- DWA installed via `npx dwa --install`
- Current directory is project root

## Process

### Step 1: Check for existing spec
<task type="auto">
  <action>
Check if feature-spec.md or .dwa/feature.json exists in current directory.
If exists, warn user: "Feature spec already initialized. Overwrite? (y/n)"
If user says no, stop.
  </action>
</task>

### Step 2: Determine source (template or Google Docs)
<task type="interactive">
  <action>
Ask user: "Initialize from (1) Template or (2) Google Docs URL?"

If template:
  - Ask: "Feature title?"
  - Call scaffoldFromTemplate(title)

If Google Docs:
  - Ask: "Google Docs URL?"
  - Call importFromGoogleDocs(url)
  </action>
</task>

### Step 3: Create .dwa/feature.json
<task type="auto">
  <action>
Use writeJsonWithSchema from Phase 1 utils to create .dwa/feature.json:
{
  "schemaVersion": "1.0.0",
  "title": "[user-provided title]",
  "spec_path": "feature-spec.md",
  "created_at": "[current ISO timestamp]"
}
  </action>
  <verify>
.dwa/feature.json exists and contains schemaVersion field
  </verify>
</task>

### Step 4: Confirm success
<task type="auto">
  <action>
Print success message:
"✓ Feature spec initialized: feature-spec.md
✓ Feature registry created: .dwa/feature.json

Next steps:
1. Edit feature-spec.md to add deliverables
2. Run /dwa:parse to extract deliverables"
  </action>
</task>
```

**Key characteristics:**
- YAML frontmatter controls invocation (`disable-model-invocation: true` means only user can invoke)
- Markdown content is instructions for Claude to follow
- References utility functions that Claude will invoke via Bash tool
- Uses `<task>` blocks for structured workflow (GSD pattern)

### Pattern 2: Template-Based Scaffolding
**What:** Generate files by rendering Handlebars templates with user-provided data, then writing atomically.

**When to use:** Creating feature-spec.md from Template v2.0

**Example:**
```javascript
// Source: Based on generate-template-files and scaffold-generator patterns
// File: ~/.claude/dwa/utils/scaffold.js

const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');
const { writeJsonWithSchema } = require('./schema');

// Register Handlebars helpers
Handlebars.registerHelper('isoDate', () => new Date().toISOString());
Handlebars.registerHelper('gitUser', () => {
  // Shell out to get git config user.name
  const { execSync } = require('child_process');
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return 'Unknown';
  }
});

async function scaffoldFromTemplate(featureTitle, targetDir = process.cwd()) {
  // 1. Load template from installed location
  const templatePath = path.join(__dirname, '..', 'templates', 'feature-spec-v2.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');

  // 2. Compile template
  const template = Handlebars.compile(templateContent);

  // 3. Render with context
  const rendered = template({
    title: featureTitle,
    author: '{{gitUser}}', // Helper will resolve
    date: '{{isoDate}}'    // Helper will resolve
  });

  // 4. Write feature spec atomically
  const specPath = path.join(targetDir, 'feature-spec.md');
  await fs.writeFile(specPath, rendered, 'utf8');

  // 5. Create .dwa directory and feature.json
  const dwaDir = path.join(targetDir, '.dwa');
  await fs.ensureDir(dwaDir);

  const featureJson = path.join(dwaDir, 'feature.json');
  await writeJsonWithSchema(featureJson, {
    title: featureTitle,
    spec_path: 'feature-spec.md',
    created_at: new Date().toISOString()
  });

  return { specPath, featureJson };
}

module.exports = { scaffoldFromTemplate };
```

**Template structure (feature-spec-v2.hbs):**
```markdown
---
title: {{title}}
author: {{author}}
created: {{date}}
status: draft
---

# {{title}}

## Overview
[Brief description of the feature]

## User Stories
[User stories go here]

## Deliverables Table

| ID | Title | User Story | Acceptance Criteria | QA Notes | Dependencies | Estimate |
|----|-------|------------|---------------------|----------|--------------|----------|
| DEL-001 | [Example deliverable] | As a user... | - AC1<br>- AC2 | Test with... | - | 2d |

## Technical Notes
[Any technical considerations]
```

**Why this pattern:**
- Templates live in `~/.claude/dwa/templates/`, not hardcoded in JavaScript
- Upgrades to DWA package update templates automatically
- Handlebars helpers handle dynamic values (dates, git user)
- Clear separation: structure in templates, logic in utilities

### Pattern 3: Google Docs Import via MCP
**What:** Use MCP tools to fetch Google Docs content, convert to markdown, parse/preserve tables.

**When to use:** User chooses Google Docs import option in `/dwa:init`

**Implementation approach:**
```markdown
## Google Docs Import Process

<task type="auto">
  <name>Import from Google Docs</name>
  <action>
1. Parse Google Docs URL to extract document ID
2. Use MCP tool to fetch document content (assumes dev-workflow-assistant extension provides MCP bridge)
3. Convert Google Docs format to markdown:
   - Parse tables → markdown table syntax
   - Parse text → markdown paragraphs
   - Preserve formatting where possible
4. Extract YAML frontmatter if present, or generate default frontmatter
5. Write to feature-spec.md
6. Warn user about any lossy conversions (complex formatting, images)
  </action>
  <verify>
- feature-spec.md contains valid YAML frontmatter
- Deliverables Table (if present) uses GitHub Flavored Markdown table syntax
- No Google Docs-specific formatting remains
  </verify>
</task>
```

**Key considerations:**
- MCP integration depends on dev-workflow-assistant extension (external dependency)
- Skill instructs Claude to use MCP tools, doesn't implement MCP client itself
- Table conversion is critical: Google Docs tables → GFM markdown tables
- Warn on lossy conversion (images, complex formatting not supported)

### Anti-Patterns to Avoid
- **Hard-coding template structure in JavaScript:** Templates should be external files, not string literals
- **Non-atomic writes:** Always use write-file-atomic or fs-extra writeFile for JSON files (prevents partial state)
- **Silent overwrites:** Always check for existing files and warn user before overwriting
- **Skipping schema versioning:** Every JSON file must include `schemaVersion` field (use `writeJsonWithSchema` helper from Phase 1)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Regex-based parser | gray-matter | Handles edge cases (quoted strings, nested objects, YAML/JSON/TOML formats) |
| Template rendering | String replacement with ${} | Handlebars | Supports helpers, partials, complex logic, external template files |
| Atomic file writes | fs.writeFile with try/catch | write-file-atomic | Prevents partial writes on crashes, handles cross-platform temp file cleanup |
| Date formatting | Manual ISO string construction | Handlebars helper + Date.toISOString() | Consistent formatting, timezone handling |
| Google Docs table conversion | HTML parser + regex | MCP tool response + markdown-table | MCP servers already handle Google Docs API, table export format complexities |

**Key insight:** Template scaffolding has dozens of edge cases (Unicode, file permissions, cross-platform paths, partial writes on crash). Battle-tested libraries handle these; custom solutions don't.

## Common Pitfalls

### Pitfall 1: Template Placeholder Leakage
**What goes wrong:** Scaffolding completes but generated file contains unreplaced placeholders like `{{AUTHOR}}` or `{{DATE}}`.

**Why it happens:**
- Handlebars template uses placeholders not in context object
- Typo in placeholder name (template has `{{featureTitle}}`, context provides `title`)
- Helpers not registered before template compilation

**How to avoid:**
1. Register all Handlebars helpers BEFORE calling `Handlebars.compile()`
2. Validate template context: ensure all required fields present
3. Add verification step: grep for `{{` in output file, fail if found

**Warning signs:**
- User reports "template file has weird {{brackets}} text"
- Frontmatter missing values (empty author field)

**Example verification:**
```javascript
// After rendering template
const hasPlaceholders = /\{\{[^}]+\}\}/.test(rendered);
if (hasPlaceholders) {
  throw new Error('Template rendering incomplete: placeholders remain');
}
```

### Pitfall 2: YAML Frontmatter Syntax Errors
**What goes wrong:** Scaffolded spec has invalid YAML frontmatter. Phase 3 parsing fails with "YAML parse error".

**Why it happens:**
- Template generates frontmatter with unquoted special characters (`: # [ ]`)
- User-provided title contains YAML-unsafe characters: `Feature: Login & Signup`
- Newlines or quotes in values not escaped

**How to avoid:**
1. Use gray-matter's `stringify()` method instead of string templates for frontmatter
2. Sanitize user input: quote strings with special characters
3. Validate frontmatter immediately after generation: parse with gray-matter, fail if error

**Warning signs:**
- Error message: "bad indentation of a mapping entry"
- Frontmatter looks correct visually but won't parse

**Example safe generation:**
```javascript
const matter = require('gray-matter');

// Generate frontmatter safely
const frontmatter = matter.stringify('', {
  title: userProvidedTitle,  // gray-matter handles quoting automatically
  author: authorName,
  created: new Date().toISOString(),
  status: 'draft'
});

// Append markdown content
const fullContent = frontmatter + '\n\n' + markdownBody;
```

### Pitfall 3: Overwriting Existing Work Without Warning
**What goes wrong:** User runs `/dwa:init` in directory with existing feature-spec.md. Command silently overwrites file, losing work.

**Why it happens:**
- No existence check before scaffolding
- Skill assumes new project, doesn't handle re-initialization
- User accidentally runs command twice

**How to avoid:**
1. Check for `.dwa/feature.json` FIRST (indicates initialization already happened)
2. Check for `feature-spec.md` SECOND (user might have manually created spec)
3. Prompt user with clear warning: "Feature already initialized. Overwrite? (y/n)"
4. If user declines, exit cleanly with no changes

**Warning signs:**
- User reports "my spec disappeared after running /dwa:init again"
- Loss of deliverables data

**Example check:**
```javascript
const fs = require('fs-extra');
const path = require('path');

async function checkExisting(targetDir) {
  const featureJson = path.join(targetDir, '.dwa', 'feature.json');
  const specPath = path.join(targetDir, 'feature-spec.md');

  const jsonExists = await fs.pathExists(featureJson);
  const specExists = await fs.pathExists(specPath);

  if (jsonExists || specExists) {
    return {
      alreadyInitialized: true,
      files: { featureJson: jsonExists, spec: specExists }
    };
  }

  return { alreadyInitialized: false };
}
```

### Pitfall 4: Google Docs Table Structure Lost in Conversion
**What goes wrong:** User imports from Google Docs. Deliverables Table in original doc becomes unformatted text in markdown. Phase 3 parsing fails.

**Why it happens:**
- MCP tool returns HTML or plain text, not markdown tables
- Table cell newlines become literal `\n` characters instead of `<br>` tags
- Column alignment lost (Google Docs uses rich formatting, markdown uses `|` delimiters)

**How to avoid:**
1. Explicitly request markdown format from MCP tool (if supported)
2. Parse HTML tables → convert to GitHub Flavored Markdown table syntax
3. Test table conversion: ensure `|` delimiters, header row separator (`|---|---|`)
4. Validate with remark-gfm parser: can it parse the generated table?
5. Warn user if complex table formatting detected (merged cells not supported in markdown)

**Warning signs:**
- Spec looks correct visually but Phase 3 parse fails with "table not found"
- Cell content has `\n` instead of line breaks
- Table missing header separator row

**Example validation:**
```javascript
const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkGfm = require('remark-gfm');
const { visit } = require('unist-util-visit');

async function validateTableStructure(markdownContent) {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdownContent);

  let foundTable = false;
  visit(tree, 'table', (node) => {
    foundTable = true;
    // Check for required columns
    const headers = node.children[0].children.map(cell =>
      cell.children[0]?.value || ''
    );
    const requiredCols = ['ID', 'Title', 'User Story', 'Acceptance Criteria'];
    const hasRequired = requiredCols.every(col => headers.includes(col));

    if (!hasRequired) {
      throw new Error(`Table missing required columns: ${requiredCols.join(', ')}`);
    }
  });

  if (!foundTable) {
    throw new Error('No table found in imported content');
  }
}
```

### Pitfall 5: Schema Version Mismatch Between Components
**What goes wrong:** Phase 1 installer writes `schemaVersion: "1.0.0"` to version file. Phase 2 scaffolding writes `schemaVersion: "1.0"` to feature.json. Version comparison logic breaks.

**Why it happens:**
- Hardcoded version strings in multiple places
- No central SCHEMA_VERSION constant
- String comparison instead of semver comparison

**How to avoid:**
1. Import `SCHEMA_VERSION` constant from Phase 1's `utils/schema.js`
2. Always use `writeJsonWithSchema()` helper (already includes version)
3. Never hardcode version strings in skills or utilities

**Warning signs:**
- Error: "Schema version mismatch" when reading feature.json
- Upgrade command reports registry needs migration when it doesn't

**Example correct usage:**
```javascript
const { writeJsonWithSchema, SCHEMA_VERSION } = require('./schema');

// CORRECT: Use helper
await writeJsonWithSchema(featureJsonPath, {
  title: 'My Feature',
  spec_path: 'feature-spec.md',
  created_at: new Date().toISOString()
});

// WRONG: Manual version
await fs.writeJSON(featureJsonPath, {
  schemaVersion: '1.0.0',  // Hardcoded, will drift
  // ...
});
```

## Code Examples

Verified patterns from official sources:

### Claude Code Skill Structure
```yaml
# Source: https://code.claude.com/docs/en/skills
---
name: init
description: Initialize a new feature spec from Template v2.0 or import from Google Docs. Creates feature-spec.md and .dwa/feature.json.
disable-model-invocation: true
argument-hint: [optional-google-docs-url]
---

# DWA: Initialize Feature Spec

## Purpose
Scaffold a feature spec from Template v2.0 or import from Google Docs via MCP.

## Required Reading
@~/.claude/dwa/references/template-spec.md

## Process
[Step-by-step instructions for Claude to follow]
```

**Key YAML fields:**
- `name`: Becomes `/dwa:init` command
- `description`: Helps Claude decide when to load skill automatically (though disabled here)
- `disable-model-invocation: true`: Only user can invoke, Claude won't auto-trigger
- `argument-hint`: Shows in autocomplete (e.g., `/dwa:init [optional-google-docs-url]`)

### Handlebars Template with Helpers
```javascript
// Source: https://handlebarsjs.com/guide/
const Handlebars = require('handlebars');
const { execSync } = require('child_process');

// Register helper for current date
Handlebars.registerHelper('isoDate', () => new Date().toISOString());

// Register helper for git user
Handlebars.registerHelper('gitUser', () => {
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return 'Unknown';
  }
});

// Compile and render template
const template = Handlebars.compile(`
---
title: {{title}}
author: {{gitUser}}
created: {{isoDate}}
---

# {{title}}
`);

const output = template({ title: 'My Feature' });
// Output:
// ---
// title: My Feature
// author: John Doe
// created: 2026-01-24T10:00:00.000Z
// ---
//
// # My Feature
```

### YAML Frontmatter Parse and Stringify
```javascript
// Source: https://github.com/jonschlinkert/gray-matter
const matter = require('gray-matter');

// Parse existing file
const fileContent = `---
title: Login Feature
author: Jane
---

# Login Feature`;

const { data, content } = matter(fileContent);
// data = { title: 'Login Feature', author: 'Jane' }
// content = '# Login Feature'

// Stringify (create frontmatter from object)
const newFile = matter.stringify('# New Feature', {
  title: 'New Feature',
  author: 'John',
  created: new Date().toISOString()
});
// Output:
// ---
// title: New Feature
// author: John
// created: 2026-01-24T10:00:00.000Z
// ---
//
// # New Feature
```

### Atomic File Write with Verification
```javascript
// Source: Phase 1 implementation pattern
const fs = require('fs-extra');
const writeFileAtomic = require('write-file-atomic');
const { writeJsonWithSchema } = require('./schema');

async function scaffoldFeature(title, targetDir) {
  // 1. Check for existing files first
  const featureJsonPath = path.join(targetDir, '.dwa', 'feature.json');
  const exists = await fs.pathExists(featureJsonPath);

  if (exists) {
    throw new Error('Feature already initialized. Use /dwa:parse to update.');
  }

  // 2. Create .dwa directory
  await fs.ensureDir(path.join(targetDir, '.dwa'));

  // 3. Write feature.json atomically with schema
  await writeJsonWithSchema(featureJsonPath, {
    title: title,
    spec_path: 'feature-spec.md',
    created_at: new Date().toISOString()
  });

  // 4. Render and write spec file
  const specContent = renderTemplate(title);
  const specPath = path.join(targetDir, 'feature-spec.md');
  await writeFileAtomic(specPath, specContent, 'utf8');

  // 5. Verify writes succeeded
  const jsonExists = await fs.pathExists(featureJsonPath);
  const specExists = await fs.pathExists(specPath);

  if (!jsonExists || !specExists) {
    throw new Error('Scaffolding verification failed');
  }

  return { featureJsonPath, specPath };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `.claude/commands/` directory for slash commands | Skills in `.claude/skills/` with SKILL.md files | December 2025 | Commands still work, but skills support additional features (supporting files, frontmatter controls) |
| Manual template string replacement | Handlebars/Mustache template engines | Ongoing standard | Template files separate from code, easier to maintain and upgrade |
| fs.writeFile for JSON | write-file-atomic | Phase 1 decision | Prevents partial state on crashes, critical for registry integrity |
| Regex-based YAML parsing | gray-matter library | Industry standard since ~2015 | Handles all YAML edge cases (quotes, special chars, nested objects) |

**Deprecated/outdated:**
- **Custom slash commands in `.claude/commands/`**: Still supported but deprecated in favor of skills with SKILL.md format (more flexible, supports frontmatter, supporting files)
- **fs-extra over fs/promises**: Phase 1 already uses fs-extra (CommonJS compatibility), but note that modern Node.js 18+ has built-in fs/promises that would suffice for new projects

## Open Questions

Things that couldn't be fully resolved:

1. **Feature Spec Template v2.0 exact format**
   - What we know: YAML front matter + Deliverables Table (markdown table). Fields include: title, author, created, status. Table columns: ID, Title, User Story, Acceptance Criteria, QA Notes, Dependencies, Estimate.
   - What's unclear: Exact column order, optional vs required columns, whether template already exists in user's possession or needs to be created
   - Recommendation: Create example template based on patterns in .planning/research/ARCHITECTURE.md. User can customize before Phase 2 implementation. Store in `templates/feature-spec-v2.hbs`.

2. **Google Docs MCP integration specifics**
   - What we know: dev-workflow-assistant extension provides MCP bridge. Community MCP servers exist (google-drive-mcp, google-docs-mcp). Google announced official MCP support for Google services in 2026.
   - What's unclear: Exact MCP tool names/signatures available via dev-workflow-assistant extension. Does it return HTML, markdown, or JSON? Table conversion strategy.
   - Recommendation: Implement local template scaffolding first (Phase 2.1). Add Google Docs import as enhancement (Phase 2.2) after confirming MCP tool availability. Skill should gracefully handle MCP tool absence with clear error message.

3. **Template upgrade strategy**
   - What we know: Templates stored in `~/.claude/dwa/templates/`. When user runs `npx dwa --upgrade`, newer templates replace old ones.
   - What's unclear: What happens to feature-spec.md files created from old template version when template upgrades? Migration needed?
   - Recommendation: Template format is user-facing contract. Major template changes should bump schemaVersion. Include template version in feature.json metadata for future drift detection.

4. **Deliverables Table validation scope**
   - What we know: Phase 3 will parse table. Phase 2 scaffolds empty table structure.
   - What's unclear: Should Phase 2 validate table structure at scaffolding time, or only at parse time (Phase 3)?
   - Recommendation: Phase 2 scaffolds valid structure from template (no validation needed). Phase 3 implements full validation with line numbers and fix suggestions (REQ-010).

## Sources

### Primary (HIGH confidence)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official Anthropic documentation on skill structure, YAML frontmatter, invocation control
- [Anthropic Skills GitHub Repository](https://github.com/anthropics/skills) - Official skill examples and templates
- Phase 1 implementation (`src/utils/schema.js`, `src/utils/paths.js`) - Established patterns for schema versioning and file paths
- .planning/research/ARCHITECTURE.md - Project-specific architecture decisions and file structure

### Secondary (MEDIUM confidence)
- [gray-matter NPM package](https://www.npmjs.com/package/gray-matter) - YAML frontmatter parsing library (verified by multiple sources)
- [Handlebars.js Official Documentation](https://handlebarsjs.com/) - Template engine documentation
- [Google Cloud MCP Announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services) - Official Google MCP support announcement
- [Google Drive MCP GitHub](https://github.com/piotr-agier/google-drive-mcp) - Community MCP server for Google Drive integration

### Tertiary (LOW confidence - require validation)
- WebSearch results on template scaffolding patterns (generate-template-files, simple-scaffold) - Patterns verified against official Handlebars docs
- Community MCP servers (google-docs-mcp by a-bonus) - Functionality described but not tested with dev-workflow-assistant extension

## Metadata

**Confidence breakdown:**
- Claude Code skills structure: HIGH - Official documentation verified, local examples examined
- Template scaffolding: HIGH - Industry-standard libraries (Handlebars, gray-matter) with official documentation
- Google Docs MCP: MEDIUM - Official Google announcement confirmed, but dev-workflow-assistant extension integration details unclear
- Feature Spec Template v2.0 format: MEDIUM - Inferred from requirements and architecture docs, exact format not in codebase yet

**Research date:** 2026-01-24
**Valid until:** 60 days (skills format stable, libraries mature, MCP ecosystem evolving but core patterns established)
