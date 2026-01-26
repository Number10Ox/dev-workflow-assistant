/**
 * Integration tests for full Google Docs to markdown conversion pipeline.
 *
 * Tests: gdocToMdast -> mdastToMarkdown
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const { gdocToMdast } = require('../../src/google-docs/gdoc-to-mdast');
const { mdastToMarkdown } = require('../../src/google-docs/mdast-to-markdown');

const fixturesDir = path.join(__dirname, '..', 'fixtures');

test('conversion-integration: gdoc-simple.json -> mdast -> markdown', async () => {
  const fixturePath = path.join(fixturesDir, 'gdoc-simple.json');
  const gdoc = await fs.readJSON(fixturePath);

  // Convert to mdast
  const { mdast, diagnostics } = gdocToMdast(gdoc);

  // Convert to markdown
  const markdown = mdastToMarkdown(mdast);

  // Verify heading
  assert(markdown.includes('# Test Heading'));

  // Verify bold text
  assert(markdown.includes('**bold**'));

  // Verify table structure
  assert(markdown.includes('Header A'));
  assert(markdown.includes('Header B'));
  assert(markdown.includes('Cell 1'));
  assert(markdown.includes('Cell 2'));
  assert(markdown.includes('|'));

  // Verify list items
  assert(markdown.includes('First bullet'));
  assert(markdown.includes('Second bullet'));

  // No critical errors
  const errors = diagnostics.filter(d => d.level === 'error' || d.level === 'fatal');
  assert.strictEqual(errors.length, 0);
});

test('conversion-integration: gdoc-complex-table.json produces HTML table', async () => {
  const fixturePath = path.join(fixturesDir, 'gdoc-complex-table.json');
  const gdoc = await fs.readJSON(fixturePath);

  // Convert to mdast
  const { mdast, diagnostics } = gdocToMdast(gdoc, { tableMode: 'html-fallback' });

  // Convert to markdown
  const markdown = mdastToMarkdown(mdast);

  // Should contain HTML table
  assert(markdown.includes('<table>'));
  assert(markdown.includes('colspan="2"'));
  assert(markdown.includes('Merged Header'));
  assert(markdown.includes('</table>'));

  // Should have DWA-GDOC-202 diagnostic
  const tableWarning = diagnostics.find(d => d.code === 'DWA-GDOC-202');
  assert(tableWarning);
  assert.strictEqual(tableWarning.level, 'warning');
});

test('conversion-integration: formatting combinations (bold + italic)', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'bold and italic\n',
                  textStyle: { bold: true, italic: true }
                }
              }
            ]
          }
        }
      ]
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  // Should have nested formatting
  assert(markdown.includes('**_bold and italic_**'));
});

test('conversion-integration: strikethrough formatting', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'strikethrough text\n',
                  textStyle: { strikethrough: true }
                }
              }
            ]
          }
        }
      ]
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('~~strikethrough text~~'));
});

test('conversion-integration: bullet list with nesting', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            bullet: { listId: 'list1', nestingLevel: 0 },
            elements: [{ textRun: { content: 'Level 1\n' } }]
          }
        },
        {
          paragraph: {
            bullet: { listId: 'list1', nestingLevel: 1 },
            elements: [{ textRun: { content: 'Level 2\n' } }]
          }
        },
        {
          paragraph: {
            bullet: { listId: 'list1', nestingLevel: 0 },
            elements: [{ textRun: { content: 'Back to Level 1\n' } }]
          }
        }
      ]
    },
    lists: {
      list1: {
        listProperties: {
          nestingLevels: [
            { glyphType: 'GLYPH_TYPE_UNSPECIFIED', glyphSymbol: '●' },
            { glyphType: 'GLYPH_TYPE_UNSPECIFIED', glyphSymbol: '○' }
          ]
        }
      }
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  // Should contain list items
  assert(markdown.includes('Level 1'));
  assert(markdown.includes('Level 2'));
  assert(markdown.includes('Back to Level 1'));
});

test('conversion-integration: numbered list', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            bullet: { listId: 'list2', nestingLevel: 0 },
            elements: [{ textRun: { content: 'First item\n' } }]
          }
        },
        {
          paragraph: {
            bullet: { listId: 'list2', nestingLevel: 0 },
            elements: [{ textRun: { content: 'Second item\n' } }]
          }
        }
      ]
    },
    lists: {
      list2: {
        listProperties: {
          nestingLevels: [
            { glyphType: 'DECIMAL', glyphSymbol: null }
          ]
        }
      }
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  // Should contain numbered list items
  assert(markdown.includes('First item'));
  assert(markdown.includes('Second item'));
});

test('conversion-integration: empty paragraph is skipped', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            elements: [{ textRun: { content: '\n' } }]
          }
        },
        {
          paragraph: {
            elements: [{ textRun: { content: 'Content\n' } }]
          }
        }
      ]
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  // Only one paragraph should appear
  assert(markdown.includes('Content'));
  // Should not have extra blank lines beyond markdown structure
  const lines = markdown.trim().split('\n');
  assert(lines.length <= 2); // Content + potential trailing newline
});

test('conversion-integration: table with empty cells preserves structure', () => {
  const gdoc = {
    body: {
      content: [
        {
          table: {
            rows: 2,
            columns: 2,
            tableRows: [
              {
                tableCells: [
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'A\n' } }] } }] },
                  { content: [{ paragraph: { elements: [] } }] }
                ]
              },
              {
                tableCells: [
                  { content: [{ paragraph: { elements: [] } }] },
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'D\n' } }] } }] }
                ]
              }
            ]
          }
        }
      ]
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  // Should have 2 rows with 2 cells each
  assert(markdown.includes('A'));
  assert(markdown.includes('D'));
  assert(markdown.includes('|'));
});

test('conversion-integration: link conversion', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Click here\n',
                  textStyle: {
                    link: {
                      url: 'https://example.com'
                    }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('[Click here](https://example.com)'));
});

test('conversion-integration: footnote reference and definition', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            elements: [
              { textRun: { content: 'Text with footnote' } },
              { footnoteReference: { footnoteId: 'fn1', footnoteNumber: 1 } },
              { textRun: { content: '.\n' } }
            ]
          }
        }
      ]
    },
    footnotes: {
      fn1: {
        footnoteId: 'fn1',
        content: [
          { paragraph: { elements: [{ textRun: { content: 'Footnote content\n' } }] } }
        ]
      }
    }
  };

  const { mdast } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  // Should contain footnote reference and definition
  assert(markdown.includes('[^fn1]'));
  assert(markdown.includes('Footnote content'));
});

test('conversion-integration: complete pipeline with all features', async () => {
  const gdoc = {
    documentId: 'test-full',
    title: 'Complete Test',
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            elements: [{ textRun: { content: 'Document Title\n' } }]
          }
        },
        {
          paragraph: {
            elements: [
              { textRun: { content: 'This is ' } },
              { textRun: { content: 'bold', textStyle: { bold: true } } },
              { textRun: { content: ' and ' } },
              { textRun: { content: 'italic', textStyle: { italic: true } } },
              { textRun: { content: '.\n' } }
            ]
          }
        },
        {
          paragraph: {
            bullet: { listId: 'list1', nestingLevel: 0 },
            elements: [{ textRun: { content: 'List item\n' } }]
          }
        },
        {
          table: {
            rows: 2,
            columns: 2,
            tableRows: [
              {
                tableCells: [
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'H1\n' } }] } }] },
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'H2\n' } }] } }] }
                ]
              },
              {
                tableCells: [
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'C1\n' } }] } }] },
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'C2\n' } }] } }] }
                ]
              }
            ]
          }
        }
      ]
    },
    lists: {
      list1: {
        listProperties: {
          nestingLevels: [{ glyphSymbol: '●' }]
        }
      }
    }
  };

  const { mdast, diagnostics } = gdocToMdast(gdoc);
  const markdown = mdastToMarkdown(mdast);

  // Verify all components present
  assert(markdown.includes('# Document Title'));
  assert(markdown.includes('**bold**'));
  assert(markdown.includes('_italic_'));
  assert(markdown.includes('List item'));
  assert(markdown.includes('H1'));
  assert(markdown.includes('H2'));
  assert(markdown.includes('C1'));
  assert(markdown.includes('C2'));

  // No critical errors
  const errors = diagnostics.filter(d => d.level === 'error' || d.level === 'fatal');
  assert.strictEqual(errors.length, 0);
});
