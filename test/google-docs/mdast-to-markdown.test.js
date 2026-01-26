/**
 * Tests for mdast to markdown stringifier.
 */

const test = require('node:test');
const assert = require('node:assert');
const { mdastToMarkdown, stringifyTable } = require('../../src/google-docs/mdast-to-markdown');

test('mdast-to-markdown: converts simple mdast tree to markdown', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Hello world' }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('Hello world'));
});

test('mdast-to-markdown: converts heading with correct # count', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'heading',
        depth: 1,
        children: [{ type: 'text', value: 'Heading 1' }]
      },
      {
        type: 'heading',
        depth: 2,
        children: [{ type: 'text', value: 'Heading 2' }]
      },
      {
        type: 'heading',
        depth: 3,
        children: [{ type: 'text', value: 'Heading 3' }]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('# Heading 1'));
  assert(markdown.includes('## Heading 2'));
  assert(markdown.includes('### Heading 3'));
});

test('mdast-to-markdown: converts bold with **', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'strong',
            children: [{ type: 'text', value: 'bold text' }]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('**bold text**'));
});

test('mdast-to-markdown: converts italic with _ (underscore)', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'emphasis',
            children: [{ type: 'text', value: 'italic text' }]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('_italic text_'));
});

test('mdast-to-markdown: converts strikethrough with ~~', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'delete',
            children: [{ type: 'text', value: 'strikethrough' }]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('~~strikethrough~~'));
});

test('mdast-to-markdown: converts nested formatting (bold + italic)', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'strong',
            children: [
              {
                type: 'emphasis',
                children: [{ type: 'text', value: 'bold and italic' }]
              }
            ]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('**_bold and italic_**'));
});

test('mdast-to-markdown: converts simple table to GFM format', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'table',
        align: ['left', 'right'],
        children: [
          {
            type: 'tableRow',
            children: [
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'Header A' }]
              },
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'Header B' }]
              }
            ]
          },
          {
            type: 'tableRow',
            children: [
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'Cell 1' }]
              },
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'Cell 2' }]
              }
            ]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  // Should contain table structure
  assert(markdown.includes('Header A'));
  assert(markdown.includes('Header B'));
  assert(markdown.includes('Cell 1'));
  assert(markdown.includes('Cell 2'));
  assert(markdown.includes('|'));
  assert(markdown.includes('---'));
});

test('mdast-to-markdown: HTML table node passes through unchanged', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'html',
        value: '<table>\n  <tr>\n    <td colspan="2">Merged</td>\n  </tr>\n</table>'
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('<table>'));
  assert(markdown.includes('colspan="2"'));
  assert(markdown.includes('</table>'));
});

test('mdast-to-markdown: converts bullet list with - bullets', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'list',
        ordered: false,
        spread: false,
        children: [
          {
            type: 'listItem',
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Item 1' }]
              }
            ]
          },
          {
            type: 'listItem',
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Item 2' }]
              }
            ]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('- Item 1'));
  assert(markdown.includes('- Item 2'));
});

test('mdast-to-markdown: converts numbered list with 1. format', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'list',
        ordered: true,
        spread: false,
        children: [
          {
            type: 'listItem',
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'First' }]
              }
            ]
          },
          {
            type: 'listItem',
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Second' }]
              }
            ]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast);

  assert(markdown.includes('1. First'));
  assert(markdown.includes('1. Second'));
});

test('mdast-to-markdown: stringifyTable handles mdast table node', () => {
  const tableNode = {
    type: 'table',
    children: [
      {
        type: 'tableRow',
        children: [
          {
            type: 'tableCell',
            children: [{ type: 'text', value: 'A' }]
          }
        ]
      }
    ]
  };

  const markdown = stringifyTable(tableNode);

  assert(markdown.includes('A'));
  assert(markdown.includes('|'));
});

test('mdast-to-markdown: stringifyTable handles HTML node', () => {
  const htmlNode = {
    type: 'html',
    value: '<table><tr><td>HTML</td></tr></table>'
  };

  const result = stringifyTable(htmlNode);

  assert.strictEqual(result, '<table><tr><td>HTML</td></tr></table>');
});

test('mdast-to-markdown: uses custom list bullet option', () => {
  const mdast = {
    type: 'root',
    children: [
      {
        type: 'list',
        ordered: false,
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Item' }]
              }
            ]
          }
        ]
      }
    ]
  };

  const markdown = mdastToMarkdown(mdast, { listBullet: '-' });

  assert(markdown.includes('- Item'));
});
