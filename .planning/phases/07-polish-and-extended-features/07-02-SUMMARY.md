---
phase: 07-polish-extended
plan: 02
subsystem: google-docs-conversion
tags: [google-docs, mdast, remark, unified, markdown, gfm, html-tables]

# Dependency graph
requires:
  - phase: 07-01
    provides: Bridge client infrastructure, diagnostics, content hashing, import reports
provides:
  - Google Docs JSON to mdast converter with table complexity detection
  - mdast to markdown stringifier with GFM and HTML table support
  - Complete conversion pipeline from Google Docs API structure to markdown
affects: [07-03-import-command, google-docs-import]

# Tech tracking
tech-stack:
  added: [remark-stringify, diff]
  patterns:
    - Google Docs StructuralElement traversal pattern
    - List detection via paragraph.bullet (not namedStyleType)
    - Three-level table conversion: simple GFM vs complex HTML
    - Nested formatting application: strikethrough -> italic -> bold
    - Footnote reference collection with definition appending

key-files:
  created:
    - src/google-docs/gdoc-to-mdast.js
    - src/google-docs/mdast-to-markdown.js
    - test/fixtures/gdoc-simple.json
    - test/fixtures/gdoc-complex-table.json
  modified: []

key-decisions:
  - "List detection via paragraph.bullet field (not namedStyleType)"
  - "Table complexity analysis checks rowSpan/columnSpan and multi-paragraph cells"
  - "HTML table fallback for complex tables with DWA-GDOC-202 diagnostic"
  - "Nested formatting order: strikethrough innermost, then italic, then bold outermost"
  - "Empty paragraphs (only whitespace/newline) are skipped entirely"
  - "Footnotes collected during conversion and appended at document end"

patterns-established:
  - "convertStructuralElement dispatcher for Google Docs element types"
  - "mdast subset emitted: heading, paragraph, text, strong, emphasis, delete, inlineCode, link, table, html, list, listItem, thematicBreak, footnoteReference, footnoteDefinition, image"
  - "Diagnostic collection in context object during conversion"
  - "Table conversion mode: 'gfm' | 'html-fallback' (default html-fallback)"

# Metrics
duration: 11m 48s
completed: 2026-01-26
---

# Phase 07 Plan 02: Google Docs to Markdown Converter Summary

**Complete Google Docs API v1 to markdown conversion pipeline with mdast AST transformation, GFM table support, HTML fallback for merged cells, and comprehensive formatting preservation**

## Performance

- **Duration:** 11 min 48 sec
- **Started:** 2026-01-26T02:59:41Z
- **Completed:** 2026-01-26T03:11:29Z
- **Tasks:** 3
- **Files created:** 6 (2 converters + 2 fixtures + 2 test suites)
- **Tests:** 39 passing (15 gdoc-to-mdast + 13 mdast-to-markdown + 11 integration)

## Accomplishments

- Google Docs JSON to mdast converter handling paragraphs, headings, lists, tables, inline formatting, footnotes
- mdast to markdown stringifier using unified + remark-stringify + remark-gfm pipeline
- Table complexity detection with GFM output for simple tables, HTML for merged cells
- Complete integration tests verifying end-to-end conversion pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Google Docs JSON to mdast converter** - `5f7163e` (feat)
2. **Task 2: Create mdast to markdown stringifier with HTML table fallback** - `37fb9ec` (feat)
3. **Task 3: Integration test for full conversion pipeline** - `2025b1d` (feat)

## Files Created/Modified

### Created

- `src/google-docs/gdoc-to-mdast.js` - Main converter: Google Docs API v1 Document structure to mdast AST
  - `gdocToMdast(gdocDocument, options)` - Returns { mdast, diagnostics, footnoteDefinitions }
  - `convertStructuralElement()` - Dispatcher for paragraph/table/sectionBreak/tableOfContents/pageBreak
  - `convertParagraph()` - Handles headings, list items, regular paragraphs
  - `convertInlineElement()` - Processes textRun, footnoteReference, inlineObjectElement, equation
  - `convertTextRun()` - Applies formatting (bold, italic, strikethrough) with correct nesting
  - `analyzeTableComplexity()` - Detects merged cells (rowSpan/columnSpan) and multi-paragraph cells
  - `convertTable()` - Routes to GFM or HTML based on complexity
  - `convertToGfmTable()` - Creates mdast table nodes with alignment
  - `convertToHtmlTable()` - Generates HTML with colspan/rowspan attributes
- `src/google-docs/mdast-to-markdown.js` - Stringifier: mdast AST to markdown string
  - `mdastToMarkdown(mdastTree, options)` - Uses unified + remark-stringify + remark-gfm
  - `stringifyTable(tableNode)` - Handles both mdast table and html nodes
- `test/fixtures/gdoc-simple.json` - Test fixture with heading, paragraph, bold text, list, table, footnote
- `test/fixtures/gdoc-complex-table.json` - Test fixture with merged cells (columnSpan: 2)
- `test/google-docs/gdoc-to-mdast.test.js` - 15 tests for converter
- `test/google-docs/mdast-to-markdown.test.js` - 13 tests for stringifier
- `test/google-docs/conversion-integration.test.js` - 11 integration tests

## Decisions Made

**List detection via paragraph.bullet (not namedStyleType):**
- Google Docs API represents lists via `paragraph.bullet` field (with listId and nestingLevel)
- namedStyleType does not indicate list status - it's for paragraph styling only
- List style determined by looking up document.lists[listId].listProperties.nestingLevels[level]
- Rationale: Matches Google Docs API v1 structure; namedStyleType alone insufficient

**Table complexity heuristic:**
- Simple: All rowSpan = 1, columnSpan = 1, single paragraph per cell
- Complex: Any rowSpan > 1, columnSpan > 1, or multi-paragraph cells
- Rationale: GFM markdown tables don't support merged cells; HTML fallback required for fidelity

**Nested formatting order (innermost to outermost):**
- Apply strikethrough first, then italic, then bold
- Results in: `{ strong: { emphasis: { delete: { text } } } }`
- Renders as: `**_~~text~~_**`
- Rationale: Matches markdown precedence rules and visual hierarchy

**Empty paragraph handling:**
- Paragraphs with only `\n` or whitespace are skipped entirely (return null)
- Prevents excessive blank lines in output markdown
- Rationale: Google Docs adds `\n` to all textRuns; filtering prevents noise

**Footnote collection pattern:**
- Footnote references inline: `{ type: 'footnoteReference', identifier: 'fn1' }`
- Definitions collected during conversion and appended at document end
- Rationale: Markdown footnotes are reference-style with definitions at bottom

**HTML table fallback diagnostic:**
- Complex tables emit DWA-GDOC-202 warning
- Informs user that table uses HTML (may not render in all viewers)
- Rationale: Transparency about conversion trade-offs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Converter operates on Google Docs API v1 JSON structure provided by bridge client (07-01).

## Next Phase Readiness

**Ready for 07-03 (Import Command):**
- Conversion pipeline complete: gdocToMdast -> mdastToMarkdown
- All Google Docs element types handled (paragraphs, headings, tables, lists, inline formatting, footnotes)
- Diagnostic collection during conversion provides transparency
- Table complexity detection ensures fidelity vs compatibility trade-off
- Fixtures available for testing full import flow

**Notes:**
- 39 tests cover all conversion paths and edge cases
- Both simple (GFM) and complex (HTML) table modes tested
- Integration tests verify end-to-end pipeline correctness
- Footnote reference and definition handling validated
- Empty paragraph filtering prevents noise in output

---
*Phase: 07-polish-extended*
*Completed: 2026-01-26*
