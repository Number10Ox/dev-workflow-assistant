# Phase 3: Parsing + Idempotent Registry - Research

**Researched:** 2026-01-24
**Domain:** AST-based markdown parsing, YAML validation, idempotent registry operations
**Confidence:** HIGH

## Summary

Phase 3 requires parsing a Deliverables Table from a feature spec markdown file into JSON registry files (`.dwa/deliverables/DEL-###.json`), with robust validation, atomic file operations, and idempotent re-parsing that preserves runtime fields.

The standard approach uses remark's unified/AST ecosystem for table extraction, gray-matter for YAML frontmatter validation, write-file-atomic for crash-safe writes, and deep equality comparison to detect actual changes before writing files.

**Key technical insight:** Idempotency requires content-aware change detection (not timestamp-based) and careful field segregation (spec-sourced vs runtime). The parser must distinguish between "spec changed" (update spec fields) and "no change" (skip write entirely) to avoid spurious diffs.

**Primary recommendation:** Use remark + remark-gfm for AST-based table parsing, validate frontmatter with gray-matter + custom schema checks, implement atomic writes with write-file-atomic, and use fast-deep-equal for change detection before writing.

## Standard Stack

### Core Dependencies (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | ^4.0.3 | YAML frontmatter extraction | De facto standard, 18M+ weekly downloads, handles edge cases |
| write-file-atomic | ^7.0.0 | Atomic file writes | Crash-safe writes via temp+rename pattern, used by npm itself |
| handlebars | ^4.7.8 | Template rendering | Already in use for Phase 2, reuse for error message templates |

### New Dependencies Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| remark | ^15.0.0 | Markdown AST parser | Unified ecosystem standard, plugin-based architecture |
| remark-parse | ^11.0.0 | Markdown to AST | Core remark parser, required for unified pipeline |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown | Essential for GFM table parsing (non-negotiable) |
| unified | ^11.0.0 | Content transformation pipeline | Core orchestrator for remark ecosystem |
| unist-util-visit | ^5.0.0 | AST traversal | Clean API for finding table nodes in remark AST |

### Optional but Recommended

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fast-deep-equal | ^3.1.3 | Deep equality comparison | Detect actual content changes before writes (10-100x faster than lodash) |
| vfile | ^6.0.0 | Virtual file handling | Better error reporting with line numbers (used by remark) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| remark | markdown-it | markdown-it is renderer-focused, not AST-focused; lacks structured table extraction |
| remark-gfm | regex parsing | Regex is fragile with multiline cells, escaped pipes, nested markdown in cells |
| fast-deep-equal | lodash.isEqual | lodash works but 10-100x slower; fast-deep-equal is optimized for deep equality |
| write-file-atomic | fs.writeFile | No crash safety; partial writes corrupt files if process crashes |

**Installation:**
```bash
npm install remark remark-parse remark-gfm unified unist-util-visit fast-deep-equal
```

## Architecture Patterns

### Recommended Processing Pipeline

```
1. Read feature-spec.md
2. Extract YAML frontmatter (gray-matter)
3. Validate frontmatter schema
4. Parse markdown to AST (unified + remark-parse + remark-gfm)
5. Find Deliverables Table (unist-util-visit)
6. Validate table structure (columns present)
7. Extract rows → deliverable objects
8. Validate deliverable content (IDs unique, required fields)
9. For each deliverable:
   a. Check if .dwa/deliverables/DEL-###.json exists
   b. If exists: merge spec fields, preserve runtime fields
   c. Deep compare with existing content
   d. Write atomically ONLY if changed
10. Detect orphans (existing files not in parsed set)
11. Flag orphans with orphaned: true, orphaned_at: timestamp
12. Generate report (summary, errors, warnings)
```

### Pattern 1: AST-Based Table Extraction

**What:** Parse markdown to AST, traverse to find table nodes, extract rows programmatically.

**When to use:** All table parsing (robust, handles edge cases).

**Example:**
```javascript
// Source: https://github.com/remarkjs/remark + https://github.com/syntax-tree/unist-util-visit
const matter = require('gray-matter');
const { unified } = require('unified');
const remarkParse = require('remark-parse');
const remarkGfm = require('remark-gfm');
const { visit } = require('unist-util-visit');

async function parseDeliverables(specPath) {
  const fileContent = await fs.readFile(specPath, 'utf8');

  // 1. Extract YAML frontmatter
  const { data: frontMatter, content: markdown } = matter(fileContent);

  // 2. Parse markdown to AST
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown);

  // 3. Find Deliverables Table
  let deliverablesTable = null;
  visit(tree, 'table', (node) => {
    // Check if this is the Deliverables Table (by heading or column names)
    // For now, assume first table is Deliverables Table
    if (!deliverablesTable) {
      deliverablesTable = node;
    }
  });

  if (!deliverablesTable) {
    throw new Error('DWA-E001: No Deliverables Table found in spec');
  }

  // 4. Extract rows
  const deliverables = extractRowsFromTable(deliverablesTable);

  return { frontMatter, deliverables };
}

function extractRowsFromTable(tableNode) {
  // tableNode.children[0] is header row
  // tableNode.children[1+] are data rows
  const [headerRow, ...dataRows] = tableNode.children;

  const headers = headerRow.children.map(cell => {
    // cell.children[0] is typically a paragraph, cell.children[0].children[0] is text
    return extractCellText(cell);
  });

  return dataRows.map(row => {
    const rowData = {};
    row.children.forEach((cell, idx) => {
      const header = headers[idx];
      rowData[header] = extractCellText(cell);
    });
    return rowData;
  });
}

function extractCellText(cellNode) {
  // Recursively extract text from cell (handles nested markdown)
  let text = '';
  visit(cellNode, 'text', (node) => {
    text += node.value;
  });
  return text.trim();
}
```

### Pattern 2: Idempotent Registry Updates

**What:** Preserve runtime fields when re-parsing; write only if content changed.

**When to use:** All registry write operations.

**Example:**
```javascript
const writeFileAtomic = require('write-file-atomic');
const fastDeepEqual = require('fast-deep-equal');
const { writeJsonWithSchema } = require('../utils/schema');

async function updateRegistry(deliverables, registryDir) {
  const existingIds = new Set();

  for (const del of deliverables) {
    const filePath = path.join(registryDir, `${del.id}.json`);
    existingIds.add(del.id);

    let merged = del;

    // If file exists, preserve runtime fields
    if (await fs.pathExists(filePath)) {
      const existing = await fs.readJSON(filePath);

      merged = {
        ...del,  // Spec-sourced fields (overwrite)
        // Runtime fields (preserve)
        linear_issue_id: existing.linear_issue_id,
        linear_url: existing.linear_url,
        status: existing.status,
        pr_url: existing.pr_url,
        completed_at: existing.completed_at,
        // Remove orphan flags if present
        orphaned: undefined,
        orphaned_at: undefined
      };

      // Only write if content actually changed
      if (fastDeepEqual(existing, merged)) {
        continue; // Skip write, no changes
      }
    }

    // Atomic write with schema version
    await writeJsonWithSchema(filePath, merged);
  }

  // Detect orphans
  const allFiles = await fs.readdir(registryDir);
  const orphanedFiles = allFiles.filter(f =>
    f.startsWith('DEL-') && !existingIds.has(path.basename(f, '.json'))
  );

  for (const orphanFile of orphanedFiles) {
    const filePath = path.join(registryDir, orphanFile);
    const existing = await fs.readJSON(filePath);

    // Flag as orphaned (in-place)
    if (!existing.orphaned) {
      const flagged = {
        ...existing,
        orphaned: true,
        orphaned_at: new Date().toISOString()
      };
      await writeJsonWithSchema(filePath, flagged);
    }
  }
}
```

### Pattern 3: Validation with Error Accumulation

**What:** Collect all validation errors before failing; report with diagnostic codes and line numbers.

**When to use:** All validation (frontmatter, table structure, deliverable content).

**Example:**
```javascript
class ValidationError {
  constructor(code, message, line = null) {
    this.code = code;
    this.message = message;
    this.line = line;
  }

  toString() {
    const linePrefix = this.line ? `Line ${this.line}: ` : '';
    return `${this.code} ${linePrefix}${this.message}`;
  }
}

function validateFrontMatter(frontMatter) {
  const errors = [];

  if (!frontMatter.feature_id) {
    errors.push(new ValidationError('DWA-E010', 'Missing required field: feature_id'));
  }

  if (!frontMatter.title) {
    errors.push(new ValidationError('DWA-E011', 'Missing required field: title'));
  }

  if (!frontMatter.spec_schema_version) {
    errors.push(new ValidationError('DWA-E012', 'Missing required field: spec_schema_version'));
  } else if (frontMatter.spec_schema_version !== 'v2.0') {
    errors.push(new ValidationError('DWA-E013', `Unsupported spec_schema_version: ${frontMatter.spec_schema_version} (expected v2.0)`));
  }

  return errors;
}

function validateTableStructure(tableNode) {
  const errors = [];
  const requiredColumns = [
    'Deliverable ID',
    'User Story',
    'Description',
    'Acceptance Criteria (testable)',
    'QA Plan Notes'
  ];

  if (!tableNode) {
    errors.push(new ValidationError('DWA-E020', 'Deliverables Table not found'));
    return errors;
  }

  const [headerRow] = tableNode.children;
  const headers = headerRow.children.map(cell => extractCellText(cell));

  for (const required of requiredColumns) {
    if (!headers.includes(required)) {
      errors.push(new ValidationError('DWA-E021', `Missing required column: ${required}`));
    }
  }

  return errors;
}

function validateDeliverableContent(deliverables) {
  const errors = [];
  const ids = new Set();

  deliverables.forEach((del, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 0-index

    if (!del['Deliverable ID']) {
      errors.push(new ValidationError('DWA-E030', `Row ${rowNum}: Missing Deliverable ID`, rowNum));
    } else if (ids.has(del['Deliverable ID'])) {
      errors.push(new ValidationError('DWA-E031', `Row ${rowNum}: Duplicate Deliverable ID: ${del['Deliverable ID']}`, rowNum));
    } else {
      ids.add(del['Deliverable ID']);
    }

    if (!del['User Story'] || del['User Story'].trim() === '') {
      errors.push(new ValidationError('DWA-E032', `Row ${rowNum}: Empty User Story`, rowNum));
    }

    if (!del['Acceptance Criteria (testable)'] || del['Acceptance Criteria (testable)'].trim() === '') {
      errors.push(new ValidationError('DWA-E033', `Row ${rowNum}: Empty Acceptance Criteria`, rowNum));
    }
  });

  return errors;
}

async function parseWithValidation(specPath) {
  const allErrors = [];

  // Validate frontmatter
  const { frontMatter, markdown } = await parseFrontMatter(specPath);
  allErrors.push(...validateFrontMatter(frontMatter));

  // Validate table structure
  const tree = await parseMarkdownToAST(markdown);
  const tableNode = findDeliverablesTable(tree);
  allErrors.push(...validateTableStructure(tableNode));

  if (allErrors.length > 0) {
    throw new Error(`Validation failed:\n${allErrors.map(e => e.toString()).join('\n')}`);
  }

  // Extract deliverables
  const deliverables = extractRowsFromTable(tableNode);

  // Validate deliverable content
  allErrors.push(...validateDeliverableContent(deliverables));

  if (allErrors.length > 0) {
    throw new Error(`Validation failed:\n${allErrors.map(e => e.toString()).join('\n')}`);
  }

  return { frontMatter, deliverables };
}
```

### Anti-Patterns to Avoid

- **Regex-based table parsing:** Fragile with multiline cells, escaped pipes (`\|`), nested markdown. Use AST instead.
- **Timestamp-based change detection:** Leads to spurious diffs. Use deep equality on content.
- **Global error state:** Validation functions should return error arrays, not throw immediately. Collect all errors first.
- **Overwriting runtime fields:** Preserve `status`, `linear_issue_id`, `pr_url` from existing registry. Never replace with spec values.
- **Silent orphan deletion:** Flag orphans with metadata, don't delete. User decides retention policy.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown table parsing | Custom regex parser | remark + remark-gfm + unist-util-visit | Edge cases: multiline cells, escaped pipes, nested markdown, alignment |
| Atomic file writes | fs.writeFile wrapper | write-file-atomic | Crash safety, process kill handling, temp file cleanup |
| Deep object equality | Custom recursive comparison | fast-deep-equal | Handles circular refs, typed arrays, edge cases; 10-100x faster |
| YAML parsing | Custom YAML parser | gray-matter | Handles multiline YAML, nested objects, edge cases; 18M+ weekly downloads |
| AST traversal | Manual recursion | unist-util-visit | Handles node filtering, parent tracking, index management |

**Key insight:** Markdown parsing has many edge cases (nested structures, escape sequences, varied whitespace). AST-based parsing with battle-tested libraries (remark ecosystem) handles these robustly. Custom regex solutions fail on real-world specs.

## Common Pitfalls

### Pitfall 1: Mutating AST During Traversal

**What goes wrong:** Modifying AST nodes while `visit()` is traversing can cause infinite loops or skipped nodes.

**Why it happens:** AST transformations work recursively. If you add new nodes, the transformer finds them and tries to transform them too.

**How to avoid:**
- Treat ASTs as mutable for performance (don't deep copy).
- But don't add/remove nodes during traversal.
- Collect changes in an array, apply after traversal completes.

**Warning signs:** Infinite loops, missing nodes in output, unexpected node counts.

**Source:** [remark best practices](https://www.ryanfiller.com/blog/remark-and-rehype-plugins)

### Pitfall 2: Losing Runtime Fields on Re-parse

**What goes wrong:** Re-parsing overwrites `status`, `linear_issue_id`, `pr_url` from registry with empty values.

**Why it happens:** Parser doesn't distinguish spec-sourced fields from runtime fields.

**How to avoid:**
- Explicitly list spec-sourced fields (title, user_story, acceptance_criteria, etc.).
- Explicitly list runtime fields (status, linear_issue_id, pr_url, completed_at).
- On re-parse: overwrite spec fields, preserve runtime fields.

**Warning signs:** Linear URLs disappear after re-parse, status resets to default, PR links lost.

### Pitfall 3: File Corruption from Partial Writes

**What goes wrong:** Process crashes mid-write, leaving corrupted JSON file.

**Why it happens:** `fs.writeFile()` writes directly to target file. Crash before flush = partial content.

**How to avoid:**
- Use `write-file-atomic` which writes to temp file first, then renames.
- Rename is atomic at filesystem level (crash-safe).
- Temp files auto-cleaned if process killed.

**Warning signs:** JSON parse errors after crashes, missing registry files, truncated content.

**Source:** [write-file-atomic](https://www.npmjs.com/package/write-file-atomic)

### Pitfall 4: Spurious Diffs from Timestamp Updates

**What goes wrong:** Re-parsing unchanged spec writes files anyway, updating `last_parsed` timestamp. Git shows diffs even though content unchanged.

**Why it happens:** Code doesn't check if content actually changed before writing.

**How to avoid:**
- Deep compare existing file content with new content.
- Skip write if `fastDeepEqual(existing, merged) === true`.
- Only update timestamps when content changes.

**Warning signs:** Git shows changes to all deliverables after re-parse, but only timestamps differ.

### Pitfall 5: Validation Fails Without Context

**What goes wrong:** Error says "Missing column" but doesn't say which column or where in file.

**Why it happens:** Validation throws generic errors without line numbers or context.

**How to avoid:**
- Include diagnostic code (DWA-E001), line number (if available), and specific detail.
- Example: `DWA-E021 Line 42: Missing required column: Acceptance Criteria (testable)`.
- Collect all errors before failing (user fixes everything in one pass).

**Warning signs:** Users ask "Which line?", "Which column?", "What's wrong?".

**Source:** [JSON schema validation best practices](https://python-jsonschema.readthedocs.io/en/stable/errors/)

## Code Examples

Verified patterns from official sources:

### Parsing Markdown with Remark + GFM

```javascript
// Source: https://github.com/remarkjs/remark-gfm
const { unified } = require('unified');
const remarkParse = require('remark-parse');
const remarkGfm = require('remark-gfm');

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm);

const tree = processor.parse(markdownContent);
```

### Finding Table Nodes with unist-util-visit

```javascript
// Source: https://github.com/syntax-tree/unist-util-visit
const { visit } = require('unist-util-visit');

let tables = [];

visit(tree, 'table', (node) => {
  // node.children[0] is header row (tableRow)
  // node.children[1+] are data rows (tableRow)
  tables.push(node);
});
```

### Atomic File Writes

```javascript
// Source: https://github.com/npm/write-file-atomic
const writeFileAtomic = require('write-file-atomic');

// Writes to temp file first, then renames (atomic)
await writeFileAtomic(filePath, jsonContent, { encoding: 'utf8' });
```

### Deep Equality Check Before Write

```javascript
// Source: https://www.npmjs.com/package/fast-deep-equal
const fastDeepEqual = require('fast-deep-equal');

const existing = await fs.readJSON(filePath);
const updated = { ...existing, ...newFields };

if (!fastDeepEqual(existing, updated)) {
  await writeFileAtomic(filePath, JSON.stringify(updated, null, 2));
}
```

### Extracting Frontmatter with gray-matter

```javascript
// Source: https://github.com/jonschlinkert/gray-matter
const matter = require('gray-matter');

const { data: frontMatter, content: markdown } = matter(fileContent);

// frontMatter = { feature_id: 'FEAT-2026-001', title: '...' }
// markdown = body content after ---
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex table parsing | AST-based with remark-gfm | 2020+ (remark v13+) | Robust handling of edge cases, nested markdown in cells |
| Custom YAML parsers | gray-matter standard | 2016+ | Handles frontmatter edge cases, 18M+ weekly downloads |
| fs.writeFile | write-file-atomic | NPM standard since 2015 | Crash-safe writes, used by npm itself |
| JSON.stringify equality | fast-deep-equal | 2018+ | 10-100x faster, handles edge cases |
| Fail-fast validation | Error accumulation | Modern UX pattern | User fixes all errors in one pass |

**Deprecated/outdated:**
- **marked library:** Less robust AST than remark, poor GFM table support. Use remark instead.
- **markdown-it:** Renderer-focused, not parser-focused. Use remark for AST extraction.
- **lodash.isEqual:** Works but slow. Use fast-deep-equal for performance-critical equality checks.

## Open Questions

Things that couldn't be fully resolved:

1. **Line number tracking for table rows**
   - What we know: remark provides position info (`node.position.start.line`)
   - What's unclear: Whether table row positions are accurate for error reporting
   - Recommendation: Test with sample specs; fall back to row index if positions unreliable

2. **Handling malformed tables**
   - What we know: remark-gfm is lenient, parses even invalid tables
   - What's unclear: How to detect "malformed but parseable" vs "well-formed"
   - Recommendation: Validate column count consistency across rows after parsing

3. **Performance at scale**
   - What we know: AST parsing is O(n) where n = file size
   - What's unclear: Performance with 100+ deliverables in one table
   - Recommendation: Benchmark with large tables; consider caching if slow

4. **Orphan retention policy**
   - What we know: Flag orphans with `orphaned: true`
   - What's unclear: When/how to delete old orphans (never? after 30 days?)
   - Recommendation: Defer deletion to manual cleanup command (`/dwa:clean-orphans`)

## Sources

### Primary (HIGH confidence)

- [remark GitHub](https://github.com/remarkjs/remark) - Markdown processor powered by plugins
- [remark-gfm GitHub](https://github.com/remarkjs/remark-gfm) - GFM support (tables, strikethrough, etc.)
- [mdast specification](https://github.com/syntax-tree/mdast) - Markdown AST format
- [unist-util-visit GitHub](https://github.com/syntax-tree/unist-util-visit) - AST traversal utility
- [write-file-atomic npm](https://www.npmjs.com/package/write-file-atomic) - Atomic file writes
- [gray-matter GitHub](https://github.com/jonschlinkert/gray-matter) - YAML frontmatter parser

### Secondary (MEDIUM confidence)

- [Transforming Markdown with Remark & Rehype](https://www.ryanfiller.com/blog/remark-and-rehype-plugins) - Best practices for remark plugins
- [mdast-util-gfm-table](https://github.com/syntax-tree/mdast-util-gfm-table) - GFM table utilities
- [fast-deep-equal npm](https://www.npmjs.com/package/fast-deep-equal) - Performance comparison for deep equality
- [Validating YAML frontmatter with JSONSchema](https://ndumas.com/2023/06/validating-yaml-frontmatter-with-jsonschema/) - Frontmatter validation patterns

### Tertiary (LOW confidence)

- [JSON Schema validation error handling](https://python-jsonschema.readthedocs.io/en/stable/errors/) - Python-based but general patterns apply
- [Orphaned data management strategies](https://www.komprise.com/glossary_terms/orphaned-data/) - High-level concepts, not implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - remark ecosystem is industry standard, verified from official docs
- Architecture patterns: HIGH - AST traversal patterns verified from official examples
- Idempotency patterns: MEDIUM - atomic writes verified, deep equality patterns inferred from npm docs
- Validation patterns: MEDIUM - error accumulation is best practice, specific diagnostic code scheme is discretionary
- Pitfalls: HIGH - based on remark docs warnings and write-file-atomic guarantees

**Research date:** 2026-01-24
**Valid until:** 60 days (remark ecosystem is stable, infrequent breaking changes)

**Sources used:**
- Context7: Not available for these libraries
- Official GitHub repos: remark, remark-gfm, unist-util-visit, write-file-atomic, gray-matter
- npm package pages: Verified current versions and usage examples
- WebSearch: Best practices articles, validation patterns (verified against official docs)

**Key research outcomes:**
1. ✅ Identified standard stack (remark + unified + unist-util-visit)
2. ✅ Documented AST-based table extraction pattern
3. ✅ Clarified idempotency approach (deep equality + atomic writes)
4. ✅ Catalogued validation error handling (accumulate, diagnostic codes, line numbers)
5. ✅ Identified orphan flagging strategy (in-place metadata)
6. ⚠️ Open question: line number accuracy for table rows (needs testing)
