# Phase 7: Polish and Extended Features - Research

**Researched:** 2026-01-25
**Domain:** Google Docs import (MCP + conversion) and PR description generation
**Confidence:** HIGH

## Summary

Phase 7 delivers two convenience features: Google Docs import (command) converts Google Doc specs to canonical markdown via MCP-based Google Docs API access, and PR description generation (skill) produces narrative PR text from deliverable metadata using template-based rendering.

The Google Docs import is the more complex feature, requiring MCP client integration, Google Docs API structure traversal, markdown conversion with fidelity preservation, and robust error handling with diagnostic reporting. The PR description generation leverages existing Handlebars infrastructure with new templates and metadata extraction.

**Primary recommendation:** Use MCP SDK (@modelcontextprotocol/sdk) for Google Docs access, build custom remark plugin for Google Docs JSON → mdast conversion, use Node.js crypto module for content hashing, and extend existing Handlebars template infrastructure for PR descriptions.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.x | MCP client for Google Docs access | Official SDK, stable v1.x recommended for production until v2 ships Q1 2026 |
| googleapis | ^140.x | Direct Google Docs API v1 (fallback) | Official Google API client, handles OAuth and API structure |
| unified | ^11.0.5 | AST processing pipeline | Already in use (Phase 3), standard for markdown processing |
| remark-parse | ^11.0.0 | Markdown parsing | Already in use, required for AST |
| remark-gfm | ^4.0.1 | GFM table support | Already in use, handles standard markdown tables |
| unist-util-visit | ^5.1.0 | AST traversal | Already in use (Phase 3/4), visitor pattern for trees |
| handlebars | ^4.7.8 | Template rendering | Already in use (Phase 2), proven for DWA templates |
| crypto (Node built-in) | Node 18+ | SHA-256 hashing | Built-in, zero dependencies, standard for content hashing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs-extra | ^11.0.0 | File system operations | Already in use, needed for import reports and asset downloads |
| write-file-atomic | ^7.0.0 | Atomic file writes | Already in use, prevents partial writes on import |
| gray-matter | ^4.0.3 | YAML frontmatter | Already in use, needed for spec frontmatter |
| clipboardy | ^4.0.0 | Clipboard access | For PR description output to clipboard |
| ora | ^5.4.1 | Progress spinners | Already in use, for import progress feedback |
| chalk | ^4.1.2 | Terminal colors | Already in use, for diagnostic output formatting |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MCP SDK + googleapis | MCP community servers only | Community MCP servers do auto-conversion (Docs→MD) which loses control over table/formatting fidelity |
| Custom mdast plugin | Existing google-docs-converter | google-docs-converter doesn't support tables or images, has limited formatting control |
| Handlebars | Template literals | Handlebars already integrated, provides placeholder leakage detection (decision [02-01]) |
| crypto module | External hash library | Node crypto is sufficient, zero additional dependencies (consistent with [05-01]) |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk googleapis clipboardy
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── google-docs/           # Google Docs import subsystem
│   ├── mcp-client.js      # MCP client wrapper for Google Docs access
│   ├── gdoc-to-mdast.js   # Google Docs JSON → mdast converter (custom plugin)
│   ├── mdast-to-markdown.js # mdast → markdown stringifier with HTML table fallback
│   ├── import-report.js   # Import report generator (.dwa/import-reports/)
│   ├── hash-content.js    # Content hashing for change detection
│   └── diagnostics.js     # Diagnostic code registry (DWA-GDOC-XXX-NNN)
├── pr-description/        # PR description generation subsystem
│   ├── generate.js        # Main generator (metadata → template → output)
│   └── metadata-extract.js # Extract metadata from registry + drift log
├── commands/
│   └── import-gdoc.js     # CLI command: dwa import-gdoc <doc-url|doc-id>
└── utils/
    └── clipboard.js       # Clipboard wrapper (optional write)
templates/
└── pr-description-v1.hbs  # PR description template
skills/
└── dwa-generate-pr-description/
    └── skill.md           # Skill definition
```

### Pattern 1: MCP Client for Google Docs Access

**What:** Use MCP SDK Client class to connect to Google Drive MCP server and read Google Docs content
**When to use:** Primary method for Google Docs access; fallback to googleapis only if MCP unavailable
**Example:**
```javascript
// Source: MCP SDK documentation + research findings
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function connectToGoogleDocsMCP() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'google-docs-mcp'] // Community MCP server
  });

  const client = new Client({
    name: 'dwa-google-docs-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  return client;
}

async function readGoogleDoc(client, docId) {
  // Use readGoogleDoc tool from MCP server
  const result = await client.callTool({
    name: 'readGoogleDoc',
    arguments: {
      docId: docId,
      format: 'json' // Get structured JSON, not auto-converted Markdown
    }
  });

  return result.content; // Google Docs API v1 JSON structure
}
```

### Pattern 2: Google Docs JSON → mdast Conversion (Custom Remark Plugin)

**What:** Build custom unified plugin that converts Google Docs API JSON structure to mdast nodes
**When to use:** Core conversion logic - transforms Google's StructuralElement tree to markdown AST
**Example:**
```javascript
// Source: Google Docs API structure + unified plugin patterns
const { visit } = require('unist-util-visit');

/**
 * Convert Google Docs JSON to mdast tree
 * Input: Google Docs API v1 Document structure
 * Output: mdast tree (compatible with remark)
 */
function gdocToMdast(gdocDocument) {
  const mdast = {
    type: 'root',
    children: []
  };

  // Process body content (StructuralElements)
  const body = gdocDocument.body;
  if (body && body.content) {
    for (const element of body.content) {
      const node = convertStructuralElement(element, gdocDocument);
      if (node) {
        mdast.children.push(node);
      }
    }
  }

  return mdast;
}

function convertStructuralElement(element, gdocDocument) {
  if (element.paragraph) {
    return convertParagraph(element.paragraph, gdocDocument);
  } else if (element.table) {
    return convertTable(element.table, gdocDocument);
  } else if (element.sectionBreak) {
    // Convert to thematic break
    return { type: 'thematicBreak' };
  } else if (element.tableOfContents) {
    // Drop TOC (per CONTEXT.md decision)
    return null;
  }

  return null;
}

function convertParagraph(paragraph, gdocDocument) {
  const children = [];

  if (paragraph.elements) {
    for (const element of paragraph.elements) {
      if (element.textRun) {
        const textNode = convertTextRun(element.textRun);
        if (textNode) children.push(textNode);
      } else if (element.inlineObjectElement) {
        const imageNode = convertInlineObject(element.inlineObjectElement, gdocDocument);
        if (imageNode) children.push(imageNode);
      } else if (element.horizontalRule) {
        // Horizontal rule in paragraph - convert to thematic break
        return { type: 'thematicBreak' };
      }
    }
  }

  // Check if this is a heading
  const style = paragraph.paragraphStyle;
  if (style && style.namedStyleType) {
    const depth = parseHeadingDepth(style.namedStyleType);
    if (depth) {
      return { type: 'heading', depth, children };
    }
  }

  return { type: 'paragraph', children };
}

function convertTextRun(textRun) {
  const text = textRun.content || '';
  const style = textRun.textStyle || {};

  let node = { type: 'text', value: text };

  // Apply formatting (innermost to outermost)
  if (style.strikethrough) {
    node = { type: 'delete', children: [node] };
  }
  if (style.italic) {
    node = { type: 'emphasis', children: [node] };
  }
  if (style.bold) {
    node = { type: 'strong', children: [node] };
  }

  return node;
}

function convertTable(table, gdocDocument) {
  // Three-level approach (per CONTEXT.md)
  const complexity = analyzeTableComplexity(table);

  if (complexity === 'simple') {
    // Level 0: GFM Markdown table
    return convertToGfmTable(table);
  } else {
    // Level 1: HTML table fallback for merged cells
    return convertToHtmlTable(table);
  }
}

function analyzeTableComplexity(table) {
  // Simple: no merged cells, single header row
  for (const row of table.tableRows || []) {
    for (const cell of row.tableCells || []) {
      if (cell.tableCellStyle) {
        const rowSpan = cell.tableCellStyle.rowSpan || 1;
        const colSpan = cell.tableCellStyle.columnSpan || 1;
        if (rowSpan > 1 || colSpan > 1) {
          return 'complex';
        }
      }
    }
  }
  return 'simple';
}
```

### Pattern 3: Content Hashing for Change Detection

**What:** Generate SHA-256 hash of imported content for idempotent re-import detection
**When to use:** Every import - store hash in import markers and report, compare on re-import
**Example:**
```javascript
// Source: Node.js crypto module documentation
const crypto = require('crypto');

/**
 * Generate SHA-256 hash of imported content
 * Used for change detection on re-import
 */
function hashImportedContent(markdownContent) {
  // Hash the content between IMPORT_BEGIN and IMPORT_END markers
  const hash = crypto.createHash('sha256')
    .update(markdownContent)
    .digest('hex');

  return `sha256:${hash}`;
}

/**
 * Verify imported content hasn't been locally edited
 * Returns: { unchanged: boolean, currentHash: string, storedHash: string }
 */
function verifyContentHash(currentContent, storedHash) {
  const currentHash = hashImportedContent(currentContent);

  return {
    unchanged: currentHash === storedHash,
    currentHash,
    storedHash
  };
}

/**
 * Extract import region from markdown with markers
 */
function extractImportRegion(markdownContent) {
  const beginRegex = /<!-- DWA:IMPORT_BEGIN[^>]*-->/;
  const endRegex = /<!-- DWA:IMPORT_END -->/;

  const beginMatch = markdownContent.match(beginRegex);
  const endMatch = markdownContent.match(endRegex);

  if (!beginMatch || !endMatch) {
    return null;
  }

  const beginIndex = beginMatch.index + beginMatch[0].length;
  const endIndex = endMatch.index;

  return markdownContent.substring(beginIndex, endIndex);
}
```

### Pattern 4: Import Markers (Unified with Phase 6 Sync Blocks)

**What:** Use HTML comment markers to track import source, revision, and content hash
**When to use:** Wrap all imported content with markers for idempotent re-imports
**Example:**
```javascript
/**
 * Wrap imported content with DWA markers
 * Mirrors Phase 6 sync block approach (per CONTEXT.md)
 */
function wrapWithImportMarkers(content, docId, revisionId, importHash) {
  return `<!-- DWA:SOURCE doc="gdoc" docId="${docId}" -->
<!-- DWA:IMPORT_BEGIN docId="${docId}" revisionId="${revisionId}" importHash="${importHash}" -->
${content}
<!-- DWA:IMPORT_END -->`;
}

/**
 * Parse existing import markers to extract metadata
 */
function parseImportMarkers(markdownContent) {
  const beginRegex = /<!-- DWA:IMPORT_BEGIN docId="([^"]+)" revisionId="([^"]+)" importHash="([^"]+)" -->/;
  const sourceRegex = /<!-- DWA:SOURCE doc="gdoc" docId="([^"]+)" -->/;

  const beginMatch = markdownContent.match(beginRegex);
  const sourceMatch = markdownContent.match(sourceRegex);

  if (!beginMatch || !sourceMatch) {
    return null;
  }

  return {
    docId: beginMatch[1],
    revisionId: beginMatch[2],
    importHash: beginMatch[3]
  };
}
```

### Pattern 5: Diagnostic Code System (Extended for Google Docs)

**What:** Extend existing ValidationError pattern with Google Docs-specific diagnostic codes
**When to use:** All import warnings and errors - enables structured error reporting
**Example:**
```javascript
// Source: Existing src/parser/validate.js pattern
/**
 * Google Docs import diagnostic codes
 * Pattern: DWA-GDOC-XXX-NNN
 *
 * Categories:
 * - DWA-GDOC-100-NNN: Informational (dropped elements)
 * - DWA-GDOC-200-NNN: Warnings (lossy conversions)
 * - DWA-GDOC-300-NNN: Errors (conversion failures)
 * - DWA-GDOC-400-NNN: Fatal errors (auth, corrupt doc)
 */
class ImportDiagnostic {
  constructor(code, level, message, elementId = null) {
    this.code = code;        // e.g., 'DWA-GDOC-201'
    this.level = level;      // 'info' | 'warning' | 'error' | 'fatal'
    this.message = message;
    this.elementId = elementId; // Google Docs element ID (if applicable)
  }

  toString() {
    const prefix = this.elementId ? `Element ${this.elementId}: ` : '';
    return `${this.code} [${this.level.toUpperCase()}] ${prefix}${this.message}`;
  }
}

// Example diagnostic codes (Claude's discretion per CONTEXT.md)
const DIAGNOSTICS = {
  // Informational (100-series)
  TOC_DROPPED: { code: 'DWA-GDOC-100', level: 'info', template: 'Dropped auto-generated table of contents' },
  PAGE_BREAK_CONVERTED: { code: 'DWA-GDOC-101', level: 'info', template: 'Converted page break to horizontal rule' },

  // Warnings (200-series)
  IMAGE_PLACEHOLDER: { code: 'DWA-GDOC-201', level: 'warning', template: 'Image not downloadable - inserted placeholder: {imageId}' },
  TABLE_TO_HTML: { code: 'DWA-GDOC-202', level: 'warning', template: 'Table has merged cells - converted to HTML table' },
  COMMENT_DROPPED: { code: 'DWA-GDOC-203', level: 'warning', template: 'Dropped comment by {author}: "{preview}"' },
  EQUATION_PLACEHOLDER: { code: 'DWA-GDOC-204', level: 'warning', template: 'Equation not convertible - inserted placeholder: {equationId}' },

  // Errors (300-series)
  INVALID_TABLE_STRUCTURE: { code: 'DWA-GDOC-301', level: 'error', template: 'Table has inconsistent column count' },

  // Fatal errors (400-series)
  AUTH_FAILURE: { code: 'DWA-GDOC-401', level: 'fatal', template: 'Authentication failed: {error}' },
  DOC_NOT_FOUND: { code: 'DWA-GDOC-402', level: 'fatal', template: 'Document not found or not accessible: {docId}' },
  CORRUPT_DOCUMENT: { code: 'DWA-GDOC-403', level: 'fatal', template: 'Document structure is unparseable' }
};
```

### Pattern 6: Import Report Generation

**What:** Generate structured JSON report for every import with diagnostics, statistics, and metadata
**When to use:** Always - provides auditability and debugging info
**Example:**
```javascript
/**
 * Generate import report
 * Saved to .dwa/import-reports/<docId>-<timestamp>.json
 */
function generateImportReport(docId, diagnostics, stats) {
  const timestamp = new Date().toISOString();

  return {
    schemaVersion: '1.0',
    importTimestamp: timestamp,
    source: {
      type: 'gdoc',
      docId: docId,
      revisionId: stats.revisionId,
      title: stats.docTitle
    },
    output: {
      path: stats.outputPath,
      importHash: stats.importHash
    },
    diagnostics: diagnostics.map(d => ({
      code: d.code,
      level: d.level,
      message: d.message,
      elementId: d.elementId
    })),
    statistics: {
      elementCounts: stats.elementCounts,
      conversionMode: stats.conversionMode, // e.g., { tables: 'html-fallback' }
      duration: stats.duration
    },
    summary: {
      total: diagnostics.length,
      info: diagnostics.filter(d => d.level === 'info').length,
      warnings: diagnostics.filter(d => d.level === 'warning').length,
      errors: diagnostics.filter(d => d.level === 'error').length,
      fatal: diagnostics.filter(d => d.level === 'fatal').length
    }
  };
}
```

### Pattern 7: PR Description Template with Metadata Extraction

**What:** Use Handlebars template populated with deliverable metadata from registry + drift log
**When to use:** Generate PR descriptions from deliverable context
**Example:**
```javascript
// Source: Existing Handlebars usage (Phase 2) + research on PR templates
const Handlebars = require('handlebars');
const fs = require('fs-extra');

/**
 * Generate PR description from deliverable metadata
 */
async function generatePRDescription(deliverableId, featureRoot) {
  // Extract metadata
  const registry = await fs.readJSON(`${featureRoot}/.dwa/registry.json`);
  const deliverable = registry.deliverables.find(d => d.deliverable_id === deliverableId);

  if (!deliverable) {
    throw new Error(`Deliverable ${deliverableId} not found in registry`);
  }

  // Read drift log for context (optional)
  const driftLog = await fs.readFile(`${featureRoot}/docs/drift-log.md`, 'utf-8').catch(() => null);
  const driftEntries = driftLog ? extractDriftForDeliverable(driftLog, deliverableId) : [];

  // Load template
  const templatePath = require.resolve('../../templates/pr-description-v1.hbs');
  const templateSource = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateSource);

  // Populate template
  const description = template({
    deliverable_id: deliverable.deliverable_id,
    user_story: deliverable.user_story,
    description: deliverable.description,
    acceptance_criteria: deliverable.acceptance_criteria,
    qa_plan_notes: deliverable.qa_plan_notes,
    drift_entries: driftEntries,
    feature_title: registry.feature?.title || 'Unknown Feature',
    generated_at: new Date().toISOString()
  });

  return description;
}

// Handlebars helper for formatting AC list
Handlebars.registerHelper('formatAC', function(acText) {
  // Split by semicolon, newline, or <br> (per decision [05-01])
  const criteria = acText.split(/[;\n]|<br\s*\/?>/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return criteria.map(ac => `- ${ac}`).join('\n');
});
```

### Anti-Patterns to Avoid

- **Auto-applying Google Docs auto-conversion:** Community MCP servers auto-convert to Markdown, losing control over table/image handling. Always request JSON format and convert manually.
- **Silent overwrites on re-import:** Never overwrite without checking content hash first. Hash mismatches MUST prompt user (per CONTEXT.md).
- **Hand-rolling table converters:** Google Docs tables have edge cases (merged cells, nested formatting). Use systematic three-level approach.
- **Importing without provenance markers:** Source marker outside import region ensures humans can edit content without losing provenance trail.
- **Modifying specs from PR skill:** PR description skill is read-only (per CONTEXT.md safety boundary). Never write back to registry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP client | Custom MCP protocol implementation | @modelcontextprotocol/sdk | Official SDK handles transport, capabilities negotiation, tool invocation |
| Google Docs API | Custom OAuth + API client | googleapis package | Official client handles auth flows, API versions, rate limiting |
| SHA-256 hashing | Custom hash algorithm | crypto.createHash('sha256') | Node built-in, zero dependencies, well-tested |
| AST traversal | Manual tree walking | unist-util-visit | Already in use, handles edge cases, provides SKIP/EXIT controls |
| Markdown parsing | Custom parser | unified + remark-parse + remark-gfm | Already in use, handles GFM tables, extensible via plugins |
| Clipboard access | Platform-specific clipboard APIs | clipboardy package | Cross-platform (Windows/macOS/Linux/WSL), fallback strategies |
| Template rendering | String concatenation | Handlebars | Already in use, provides placeholder leakage detection ([02-01]) |

**Key insight:** The Google Docs API structure is complex with many element types (20+ ParagraphElement types, nested formatting, table cells with properties). Custom conversion logic will miss edge cases. Build on unified's AST infrastructure (already proven in Phase 3/4) rather than inventing new tree processing.

## Common Pitfalls

### Pitfall 1: Ignoring Google Docs Revision IDs

**What goes wrong:** Re-importing same doc version creates false "new revision" noise
**Why it happens:** Treating every import as new without checking revisionId from API
**How to avoid:**
- Store revisionId in IMPORT_BEGIN marker
- Compare on re-import: if revisionId unchanged AND hash matches, skip with message "Already at latest revision"
- Only update if revisionId changed OR user forces with --force flag
**Warning signs:** Import reports showing reimports of unchanged documents

### Pitfall 2: UTF-16 Index Confusion in Google Docs API

**What goes wrong:** Element positions are off-by-one or skip content (e.g., emoji handling)
**Why it happens:** Google Docs indexes use UTF-16 code units (surrogate pairs consume 2 indexes)
**How to avoid:**
- Don't use indexes for content extraction - traverse element tree directly
- If indexes needed for debugging, document that they're UTF-16 units
- Test with emoji/special characters (e.g., 😄 = \uD83D\uDE00 = 2 indexes)
**Warning signs:** Missing content after emoji or special characters

### Pitfall 3: Table Cell Alignment Loss

**What goes wrong:** Table alignment (left/center/right) lost in GFM conversion
**Why it happens:** GFM supports alignment but it's in separator row (`:---`, `:---:`, `---:`), not in Google Docs API structure
**How to avoid:**
- Extract tableCellStyle.alignment from Google Docs API
- Map to GFM separator syntax: LEFT → `:---`, CENTER → `:---:`, RIGHT → `---:`
- For HTML tables, use CSS or align attribute
**Warning signs:** All table cells left-aligned despite different alignment in source

### Pitfall 4: Nested Formatting Collapse

**What goes wrong:** Text with multiple styles (bold + italic) loses one style
**Why it happens:** Incorrect mdast nesting order (innermost to outermost matters)
**How to avoid:**
- Apply formatting in correct order: strikethrough → italic → bold (innermost to outermost)
- Test: `**_strikethrough_**` works, `_**strikethrough**_` may not
- Verify mdast tree structure matches markdown precedence rules
**Warning signs:** Text with multiple styles renders with only one style

### Pitfall 5: Image Download Without Auth Check

**What goes wrong:** Image download fails silently or hangs on auth-required images
**Why it happens:** Not checking if MCP/API has sufficient permissions before attempting download
**How to avoid:**
- Check MCP capabilities or API scopes before download attempt
- Implement timeout (5s per image)
- Fall back to placeholder + link-out if download fails
- Use --strict-images flag only when required images MUST succeed
**Warning signs:** Long import times with no progress, silent failures

### Pitfall 6: Comment Flood in Reports

**What goes wrong:** Import report becomes unreadable with 100+ dropped comment entries
**Why it happens:** Treating every dropped comment as individual diagnostic
**How to avoid:**
- Default: Single summary diagnostic "Dropped N comments" with count
- Detailed comment list only in sidecar file (--export-comments) or import report JSON
- Per-comment diagnostics only with --fail-on-comments flag
**Warning signs:** Import report longer than actual imported content

### Pitfall 7: Handlebars Placeholder Leakage in PR Descriptions

**What goes wrong:** PR description contains `{{undefined}}` or `{{missing_field}}`
**Why it happens:** Template references metadata field that doesn't exist in registry
**How to avoid:**
- Use existing placeholder leakage detection from Phase 2 ([02-01])
- Test templates with minimal registry (only required fields)
- Provide sensible defaults for optional fields (e.g., drift_entries defaults to empty array)
**Warning signs:** PR descriptions with literal `{{...}}` text

### Pitfall 8: MCP Server Unavailability Handling

**What goes wrong:** Import command fails with cryptic error when MCP server not configured
**Why it happens:** Assuming MCP is always available, no fallback strategy
**How to avoid:**
- Check MCP availability before import (call listTools to verify connection)
- Provide clear error: "Google Docs MCP server not configured. See: <setup-docs-link>"
- Optional: Fall back to googleapis with warning "Using direct API (MCP recommended)"
- Document MCP server setup in skill prerequisites
**Warning signs:** Users unable to import without clear error message

## Code Examples

Verified patterns from official sources:

### Connecting to MCP Server (StdioTransport)

```javascript
// Source: @modelcontextprotocol/sdk documentation
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function createMcpClient() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'google-docs-mcp']
  });

  const client = new Client({
    name: 'dwa-google-docs-importer',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  await client.connect(transport);

  // Verify tools available
  const tools = await client.listTools();
  console.log('Available tools:', tools.tools.map(t => t.name));

  return client;
}
```

### Reading Google Docs via googleapis (Fallback)

```javascript
// Source: googleapis documentation + Google Docs API v1 reference
const { google } = require('googleapis');

async function readGoogleDocDirect(docId, auth) {
  const docs = google.docs({ version: 'v1', auth });

  const response = await docs.documents.get({
    documentId: docId
  });

  return response.data; // Full Document structure with body, revisionId, etc.
}
```

### Converting GFM Table with Alignment

```javascript
// Source: remark-gfm + mdast specification
function convertToGfmTable(gdocTable) {
  const rows = gdocTable.tableRows || [];
  const mdastRows = [];

  // Extract alignments from first row cells
  const alignments = [];
  if (rows.length > 0) {
    const firstRow = rows[0];
    for (const cell of firstRow.tableCells || []) {
      const alignment = cell.tableCellStyle?.contentAlignment || 'START';
      alignments.push(mapAlignment(alignment));
    }
  }

  // Convert rows
  for (const row of rows) {
    const mdastCells = [];
    for (const cell of row.tableCells || []) {
      const cellContent = extractTableCellContent(cell);
      mdastCells.push({
        type: 'tableCell',
        children: cellContent
      });
    }
    mdastRows.push({
      type: 'tableRow',
      children: mdastCells
    });
  }

  return {
    type: 'table',
    align: alignments, // ['left', 'center', 'right', null]
    children: mdastRows
  };
}

function mapAlignment(gdocAlignment) {
  // Google Docs: START, CENTER, END, JUSTIFIED
  // mdast: 'left', 'center', 'right', null
  const map = {
    'START': 'left',
    'CENTER': 'center',
    'END': 'right',
    'JUSTIFIED': null
  };
  return map[gdocAlignment] || null;
}
```

### Writing to Clipboard

```javascript
// Source: clipboardy npm package
const clipboardy = require('clipboardy');

async function writeToClipboard(content) {
  try {
    await clipboardy.write(content);
    console.log('PR description copied to clipboard');
    return true;
  } catch (error) {
    console.warn('Failed to write to clipboard:', error.message);
    console.log('PR description written to file instead');
    return false;
  }
}
```

### Atomic File Write with Hash Check

```javascript
// Source: write-file-atomic + crypto module
const writeFileAtomic = require('write-file-atomic');
const crypto = require('crypto');

async function writeImportedContent(outputPath, content, existingHash = null) {
  const newHash = crypto.createHash('sha256').update(content).digest('hex');

  // Check for existing import
  if (existingHash && existingHash !== newHash) {
    // Hash mismatch - prompt user
    console.warn('Local edits detected. Overwrite? Use --force to skip prompt.');
    // ... prompt logic
    return { written: false, reason: 'hash_mismatch' };
  }

  // Write atomically
  await writeFileAtomic(outputPath, content, { encoding: 'utf-8' });

  return { written: true, hash: `sha256:${newHash}` };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Docs→MD copy-paste | MCP-based automated import | Q4 2025 | MCP standardizes AI-tool integration, replacing ad-hoc conversions |
| Auto-convert to Markdown | Request JSON + custom conversion | N/A | Preserves fidelity for tables/images vs lossy auto-conversion |
| v1.0 MCP SDK (alpha) | v1.x stable, v2 coming Q1 2026 | Q4 2025 | v1.x recommended for production, v2 will add streaming improvements |
| remark-rehype for MD→HTML | Direct mdast manipulation | N/A | More control for hybrid MD+HTML table output |

**Deprecated/outdated:**
- **google-docs-converter (SimonGZ):** No table support, images not supported, limited to basic formatting
- **Docs to Markdown add-on (GD2md-html):** Browser-based, doesn't preserve colors/styles, requires manual export
- **Community MCP servers with auto-conversion:** Useful for quick reads but lose control over formatting fidelity

## Open Questions

Things that couldn't be fully resolved:

1. **MCP Server Stability for Production Use**
   - What we know: MCP SDK v1.x is stable, v2 coming Q1 2026; community Google Docs MCP servers exist
   - What's unclear: Which community MCP server is most reliable? Should DWA bundle a preferred server or document multiple options?
   - Recommendation: Start with documented setup for `google-docs-mcp` (most popular), provide fallback to googleapis for users without MCP. Phase 7 planning should document both paths.

2. **Google Docs API Rate Limits**
   - What we know: googleapis package has exponential backoff support (similar to Linear integration in Phase 6)
   - What's unclear: Exact rate limits for Google Docs API v1 (not clearly documented in search results)
   - Recommendation: Implement same exponential backoff pattern as Phase 6 Linear integration ([06-02]), add rate limit handling to diagnostics

3. **HTML Table Compatibility Across Markdown Renderers**
   - What we know: HTML tables work in GitHub/GitLab markdown, may not render in all viewers
   - What's unclear: Should DWA emit warnings when using HTML tables? Should there be a --strict-markdown flag that fails on complex tables?
   - Recommendation: Default to `tables.mode = "html-fallback"` (per CONTEXT.md), emit DWA-GDOC-202 warning when HTML used, document viewer compatibility in import report

4. **PR Description Tone and Structure**
   - What we know: Templates should include summary, changes, testing (standard sections per research)
   - What's unclear: Technical vs conversational tone? Include drift history by default? (Marked as Claude's discretion in CONTEXT.md)
   - Recommendation: Start with technical tone, include drift summary (not full history), make configurable via template variants in later iterations

## Sources

### Primary (HIGH confidence)

- **@modelcontextprotocol/sdk npm package** - Official MCP SDK documentation, v1.x stable for production
  - https://www.npmjs.com/package/@modelcontextprotocol/sdk
  - https://github.com/modelcontextprotocol/typescript-sdk
- **Google Docs API v1 Structure Documentation** - Authoritative reference for Document, StructuralElement, Paragraph, Table structures
  - https://developers.google.com/workspace/docs/api/concepts/structure
  - https://developers.google.com/workspace/docs/api/reference/rest/v1/documents
- **mdast specification (GitHub: syntax-tree/mdast)** - AST node types for markdown (Table, Paragraph, Heading, etc.)
  - https://github.com/syntax-tree/mdast
- **Node.js crypto module documentation** - SHA-256 hashing via createHash
  - https://nodejs.org/api/crypto.html
- **unist-util-visit documentation** - AST traversal with visitor pattern
  - https://github.com/syntax-tree/unist-util-visit
- **clipboardy GitHub repository** - Cross-platform clipboard access
  - https://github.com/sindresorhus/clipboardy
- **Existing DWA codebase** - Validation patterns (src/parser/validate.js), Handlebars usage (Phase 2), AST parsing (Phase 3)

### Secondary (MEDIUM confidence)

- **MCP Google Docs Integration Articles** - Community implementations and patterns
  - https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services
  - https://github.com/a-bonus/google-docs-mcp
- **PR Template Best Practices** - Structure and content recommendations
  - https://axolo.co/blog/p/part-3-github-pull-request-template
  - https://everhour.com/blog/github-pr-template/
- **JSON Schema Validation Error Handling** - Structured error reporting patterns
  - https://python-jsonschema.readthedocs.io/en/stable/errors/
- **Markdown Table Conversion Patterns** - GFM limitations and HTML fallback strategies
  - https://www.docstomarkdown.pro/tables-in-markdown/
  - https://github.com/microsoft/markitdown/issues/1211

### Tertiary (LOW confidence)

- **google-docs-converter (SimonGZ)** - Existing OSS converter, but lacks table/image support (verification needed for current state)
  - https://github.com/SimonGZ/google-docs-converter
- **Various PR auto-generation tools** - LLM-based PR description generation (informational only, DWA uses template-based)
  - https://github.com/vblagoje/pr-auto

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs/npm, MCP SDK confirmed stable v1.x
- Architecture: HIGH - Patterns based on existing DWA codebase (Phase 3 AST, Phase 2 Handlebars, Phase 6 error handling) + official Google Docs API structure
- Pitfalls: MEDIUM - Mix of documented gotchas (UTF-16 indexes from official docs) and inferred issues (comment flood, MCP availability)

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days for stable ecosystem - MCP SDK, Google Docs API, unified/remark are mature)

---

**Key Decision Points for Planning:**

1. **MCP vs Direct API:** Recommend MCP primary + googleapis fallback pattern
2. **Table Conversion:** Three-level approach locked in CONTEXT.md, use remark-gfm for simple, HTML for complex
3. **Diagnostic Codes:** Use DWA-GDOC-XXX-NNN pattern (100=info, 200=warning, 300=error, 400=fatal)
4. **Import Report Schema:** JSON with diagnostics array, statistics, source metadata
5. **PR Template Sections:** Summary, Changes Made, Testing Notes, References (technical tone default)
6. **Clipboard Strategy:** Try clipboard write, fall back to file if fails (cross-platform compatibility)
