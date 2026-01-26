/**
 * Tests for Google Docs JSON to mdast converter.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const { gdocToMdast, analyzeTableComplexity } = require('../../src/google-docs/gdoc-to-mdast');

const fixturesDir = path.join(__dirname, '..', 'fixtures');

test('gdoc-to-mdast: converts heading to mdast heading node', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            elements: [{ textRun: { content: 'Test Heading\n', textStyle: {} } }]
          }
        }
      ]
    }
  };

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.type, 'root');
  assert.strictEqual(result.mdast.children.length, 1);
  assert.strictEqual(result.mdast.children[0].type, 'heading');
  assert.strictEqual(result.mdast.children[0].depth, 1);
  assert.strictEqual(result.mdast.children[0].children[0].type, 'text');
  assert.strictEqual(result.mdast.children[0].children[0].value, 'Test Heading');
});

test('gdoc-to-mdast: converts all heading levels (HEADING_1 through HEADING_6)', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            elements: [{ textRun: { content: 'H1\n' } }]
          }
        },
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_2' },
            elements: [{ textRun: { content: 'H2\n' } }]
          }
        },
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_6' },
            elements: [{ textRun: { content: 'H6\n' } }]
          }
        }
      ]
    }
  };

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.children.length, 3);
  assert.strictEqual(result.mdast.children[0].depth, 1);
  assert.strictEqual(result.mdast.children[1].depth, 2);
  assert.strictEqual(result.mdast.children[2].depth, 6);
});

test('gdoc-to-mdast: converts paragraph with bold text', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
            elements: [
              { textRun: { content: 'Normal ', textStyle: {} } },
              { textRun: { content: 'bold', textStyle: { bold: true } } },
              { textRun: { content: ' text\n', textStyle: {} } }
            ]
          }
        }
      ]
    }
  };

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.children.length, 1);
  const para = result.mdast.children[0];
  assert.strictEqual(para.type, 'paragraph');
  assert.strictEqual(para.children.length, 3);

  assert.strictEqual(para.children[0].type, 'text');
  assert.strictEqual(para.children[0].value, 'Normal ');

  assert.strictEqual(para.children[1].type, 'strong');
  assert.strictEqual(para.children[1].children[0].value, 'bold');

  assert.strictEqual(para.children[2].type, 'text');
  assert.strictEqual(para.children[2].value, ' text');
});

test('gdoc-to-mdast: preserves nested formatting (bold + italic)', () => {
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

  const result = gdocToMdast(gdoc);

  const para = result.mdast.children[0];
  assert.strictEqual(para.children[0].type, 'strong');
  assert.strictEqual(para.children[0].children[0].type, 'emphasis');
  assert.strictEqual(para.children[0].children[0].children[0].value, 'bold and italic');
});

test('gdoc-to-mdast: converts strikethrough text', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            elements: [
              { textRun: { content: 'strikethrough\n', textStyle: { strikethrough: true } } }
            ]
          }
        }
      ]
    }
  };

  const result = gdocToMdast(gdoc);

  const para = result.mdast.children[0];
  assert.strictEqual(para.children[0].type, 'delete');
  assert.strictEqual(para.children[0].children[0].value, 'strikethrough');
});

test('gdoc-to-mdast: converts bullet list via paragraph.bullet', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            bullet: { listId: 'list1', nestingLevel: 0 },
            elements: [{ textRun: { content: 'Item 1\n' } }]
          }
        },
        {
          paragraph: {
            bullet: { listId: 'list1', nestingLevel: 0 },
            elements: [{ textRun: { content: 'Item 2\n' } }]
          }
        }
      ]
    },
    lists: {
      list1: {
        listProperties: {
          nestingLevels: [
            { glyphType: 'GLYPH_TYPE_UNSPECIFIED', glyphSymbol: '●' }
          ]
        }
      }
    }
  };

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.children.length, 2);
  assert.strictEqual(result.mdast.children[0].type, 'listItem');
  assert.strictEqual(result.mdast.children[1].type, 'listItem');

  assert.strictEqual(result.mdast.children[0].children[0].children[0].value, 'Item 1');
  assert.strictEqual(result.mdast.children[1].children[0].children[0].value, 'Item 2');
});

test('gdoc-to-mdast: converts simple table to mdast table node', () => {
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
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'B\n' } }] } }] }
                ]
              },
              {
                tableCells: [
                  { content: [{ paragraph: { elements: [{ textRun: { content: '1\n' } }] } }] },
                  { content: [{ paragraph: { elements: [{ textRun: { content: '2\n' } }] } }] }
                ]
              }
            ]
          }
        }
      ]
    }
  };

  const result = gdocToMdast(gdoc, { tableMode: 'html-fallback' });

  assert.strictEqual(result.mdast.children.length, 1);
  const table = result.mdast.children[0];
  assert.strictEqual(table.type, 'table');
  assert.strictEqual(table.children.length, 2);

  // Check first row
  const row1 = table.children[0];
  assert.strictEqual(row1.type, 'tableRow');
  assert.strictEqual(row1.children[0].children[0].value, 'A');
  assert.strictEqual(row1.children[1].children[0].value, 'B');

  // Check second row
  const row2 = table.children[1];
  assert.strictEqual(row2.children[0].children[0].value, '1');
  assert.strictEqual(row2.children[1].children[0].value, '2');
});

test('gdoc-to-mdast: analyzeTableComplexity detects simple table', () => {
  const table = {
    tableRows: [
      {
        tableCells: [
          { content: [{ paragraph: {} }] },
          { content: [{ paragraph: {} }] }
        ]
      }
    ]
  };

  const complexity = analyzeTableComplexity(table);
  assert.strictEqual(complexity, 'simple');
});

test('gdoc-to-mdast: analyzeTableComplexity detects complex table with merged cells', () => {
  const table = {
    tableRows: [
      {
        tableCells: [
          {
            tableCellStyle: { columnSpan: 2 },
            content: [{ paragraph: {} }]
          },
          { content: [{ paragraph: {} }] }
        ]
      }
    ]
  };

  const complexity = analyzeTableComplexity(table);
  assert.strictEqual(complexity, 'complex');
});

test('gdoc-to-mdast: complex table converts to HTML with DWA-GDOC-202 diagnostic', () => {
  const gdoc = {
    body: {
      content: [
        {
          table: {
            tableRows: [
              {
                tableCells: [
                  {
                    tableCellStyle: { columnSpan: 2 },
                    content: [{ paragraph: { elements: [{ textRun: { content: 'Merged\n' } }] } }]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  };

  const result = gdocToMdast(gdoc, { tableMode: 'html-fallback' });

  assert.strictEqual(result.mdast.children[0].type, 'html');
  assert(result.mdast.children[0].value.includes('<table>'));
  assert(result.mdast.children[0].value.includes('colspan="2"'));

  // Check diagnostic
  assert.strictEqual(result.diagnostics.length, 1);
  assert.strictEqual(result.diagnostics[0].code, 'DWA-GDOC-202');
  assert.strictEqual(result.diagnostics[0].level, 'warning');
});

test('gdoc-to-mdast: drops table of contents with DWA-GDOC-100 diagnostic', () => {
  const gdoc = {
    body: {
      content: [
        { tableOfContents: {} },
        {
          paragraph: {
            elements: [{ textRun: { content: 'Content\n' } }]
          }
        }
      ]
    }
  };

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.children.length, 1);
  assert.strictEqual(result.mdast.children[0].type, 'paragraph');

  // Check diagnostic
  assert.strictEqual(result.diagnostics.length, 1);
  assert.strictEqual(result.diagnostics[0].code, 'DWA-GDOC-100');
});

test('gdoc-to-mdast: converts page break with DWA-GDOC-101 diagnostic', () => {
  const gdoc = {
    body: {
      content: [
        { pageBreak: {} }
      ]
    }
  };

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.children.length, 1);
  assert.strictEqual(result.mdast.children[0].type, 'thematicBreak');

  // Check diagnostic
  assert.strictEqual(result.diagnostics.length, 1);
  assert.strictEqual(result.diagnostics[0].code, 'DWA-GDOC-101');
});

test('gdoc-to-mdast: converts footnote reference', () => {
  const gdoc = {
    body: {
      content: [
        {
          paragraph: {
            elements: [
              { textRun: { content: 'Text' } },
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
          { paragraph: { elements: [{ textRun: { content: 'Footnote text\n' } }] } }
        ]
      }
    }
  };

  const result = gdocToMdast(gdoc);

  const para = result.mdast.children[0];
  assert.strictEqual(para.children[1].type, 'footnoteReference');
  assert.strictEqual(para.children[1].identifier, 'fn1');

  // Check footnote definition appended
  assert.strictEqual(result.footnoteDefinitions.length, 1);
  assert.strictEqual(result.footnoteDefinitions[0].type, 'footnoteDefinition');
  assert.strictEqual(result.footnoteDefinitions[0].identifier, 'fn1');
  assert.strictEqual(result.footnoteDefinitions[0].children[0].children[0].value, 'Footnote text');
});

test('gdoc-to-mdast: skips empty paragraphs', () => {
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

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.children.length, 1);
  assert.strictEqual(result.mdast.children[0].children[0].value, 'Content');
});

test('gdoc-to-mdast: loads and converts gdoc-simple.json fixture', async () => {
  const fixturePath = path.join(fixturesDir, 'gdoc-simple.json');
  const gdoc = await fs.readJSON(fixturePath);

  const result = gdocToMdast(gdoc);

  assert.strictEqual(result.mdast.type, 'root');
  assert(result.mdast.children.length > 0);

  // Verify heading
  const heading = result.mdast.children.find(n => n.type === 'heading');
  assert(heading);
  assert.strictEqual(heading.depth, 1);

  // Verify table
  const table = result.mdast.children.find(n => n.type === 'table');
  assert(table);
  assert.strictEqual(table.children.length, 2);

  // Verify list items
  const listItems = result.mdast.children.filter(n => n.type === 'listItem');
  assert.strictEqual(listItems.length, 2);
});
