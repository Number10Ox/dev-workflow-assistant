/**
 * mdast to markdown stringifier.
 *
 * Converts mdast AST to markdown string using unified + remark-stringify + remark-gfm.
 * Handles HTML table passthrough for complex tables.
 */

const { unified } = require('unified');
const remarkStringify = require('remark-stringify').default;
const remarkGfm = require('remark-gfm').default;

/**
 * Convert mdast tree to markdown string.
 *
 * @param {object} mdastTree - mdast AST
 * @param {object} [options={}] - Stringification options
 * @param {string} [options.listBullet='-'] - Bullet character for unordered lists
 * @param {string} [options.emphasis='_'] - Emphasis character (underscore)
 * @returns {string} Markdown string
 */
function mdastToMarkdown(mdastTree, options = {}) {
  const listBullet = options.listBullet || '-';
  const emphasis = options.emphasis || '_';

  const processor = unified()
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: listBullet,
      emphasis: emphasis,
      listItemIndent: 'one',
      rule: '-',
      ruleRepetition: 3,
      strong: '*',
      fences: true,
      incrementListMarker: false
    });

  const markdown = processor.stringify(mdastTree);

  return markdown;
}

/**
 * Stringify a table node.
 *
 * For mdast table nodes, delegates to remark-stringify (GFM).
 * For html nodes (complex tables), returns HTML as-is.
 *
 * @param {object} tableNode - mdast table or html node
 * @returns {string} Markdown or HTML string
 */
function stringifyTable(tableNode) {
  if (tableNode.type === 'html') {
    // HTML table - return value as-is
    return tableNode.value;
  } else if (tableNode.type === 'table') {
    // GFM table - wrap in root and stringify
    const tree = {
      type: 'root',
      children: [tableNode]
    };

    return mdastToMarkdown(tree);
  }

  throw new Error(`Unsupported table node type: ${tableNode.type}`);
}

module.exports = {
  mdastToMarkdown,
  stringifyTable
};
