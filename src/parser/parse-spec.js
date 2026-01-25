/**
 * AST-based spec parser for feature-spec.md files.
 * Extracts deliverables from the Deliverables Table using remark's AST.
 *
 * Uses:
 * - gray-matter for YAML frontmatter extraction
 * - unified + remark-parse + remark-gfm for AST parsing
 * - unist-util-visit for AST traversal
 */

const fs = require('fs-extra');
const matter = require('gray-matter');
const { unified } = require('unified');
const remarkParse = require('remark-parse').default;
const remarkGfm = require('remark-gfm').default;
const { visit } = require('unist-util-visit');

const {
  ValidationError,
  validateFrontMatter,
  validateTableStructure,
  validateDeliverableContent,
  extractCellText
} = require('./validate');

/**
 * Find the Deliverables Table in the AST.
 * Looks for a table that follows the "### 3.1 Deliverables Table" heading,
 * or falls back to the first table with a "Deliverable ID" column.
 *
 * @param {object} tree - Remark AST
 * @returns {object|null} Table node or null if not found
 */
function findDeliverablesTable(tree) {
  let tables = [];

  visit(tree, 'table', (node) => {
    tables.push(node);
  });

  if (tables.length === 0) {
    return null;
  }

  // Try to find table with Deliverable ID column
  for (const table of tables) {
    if (table.children && table.children.length > 0) {
      const headerRow = table.children[0];
      if (headerRow.children) {
        const headers = headerRow.children.map(cell => extractCellText(cell));
        if (headers.includes('Deliverable ID')) {
          return table;
        }
      }
    }
  }

  // Fall back to first table (for testing flexibility)
  return tables[0];
}

/**
 * Extract rows from a table node into an array of objects.
 *
 * @param {object} tableNode - AST table node
 * @returns {object[]} Array of row objects with column names as keys
 */
function extractRowsFromTable(tableNode) {
  if (!tableNode || !tableNode.children || tableNode.children.length < 2) {
    return [];
  }

  const [headerRow, ...dataRows] = tableNode.children;

  // Extract header names
  const headers = headerRow.children.map(cell => extractCellText(cell));

  // Extract data rows
  return dataRows.map(row => {
    const rowData = {};
    if (row.children) {
      row.children.forEach((cell, idx) => {
        const header = headers[idx];
        if (header) {
          rowData[header] = extractCellText(cell);
        }
      });
    }
    return rowData;
  });
}

/**
 * Parse a feature-spec.md file and extract deliverables.
 *
 * Returns a result object with:
 * - frontMatter: Parsed YAML frontmatter
 * - deliverables: Array of deliverable objects from the table
 * - errors: Array of ValidationError objects (accumulated, not fail-fast)
 * - warnings: Array of warning messages
 *
 * @param {string} specPath - Path to feature-spec.md file
 * @returns {Promise<{frontMatter: object, deliverables: object[], errors: ValidationError[], warnings: string[]}>}
 */
async function parseSpec(specPath) {
  const result = {
    frontMatter: {},
    deliverables: [],
    errors: [],
    warnings: []
  };

  // Read file
  let fileContent;
  try {
    fileContent = await fs.readFile(specPath, 'utf8');
  } catch (err) {
    result.errors.push(new ValidationError('DWA-E001', `Failed to read file: ${err.message}`));
    return result;
  }

  // Extract frontmatter
  let markdown;
  try {
    const parsed = matter(fileContent);
    result.frontMatter = parsed.data;
    markdown = parsed.content;
  } catch (err) {
    result.errors.push(new ValidationError('DWA-E002', `Failed to parse frontmatter: ${err.message}`));
    return result;
  }

  // Validate frontmatter
  const frontMatterErrors = validateFrontMatter(result.frontMatter);
  result.errors.push(...frontMatterErrors);

  // Parse markdown to AST
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  let tree;
  try {
    tree = processor.parse(markdown);
  } catch (err) {
    result.errors.push(new ValidationError('DWA-E003', `Failed to parse markdown: ${err.message}`));
    return result;
  }

  // Find Deliverables Table
  const tableNode = findDeliverablesTable(tree);

  // Validate table structure
  const tableErrors = validateTableStructure(tableNode);
  result.errors.push(...tableErrors);

  // If table not found or missing columns, we can't extract rows
  if (tableErrors.some(e => e.code === 'DWA-E020' || e.code === 'DWA-E021')) {
    return result;
  }

  // Extract deliverables
  result.deliverables = extractRowsFromTable(tableNode);

  // Validate deliverable content
  const contentErrors = validateDeliverableContent(result.deliverables);
  result.errors.push(...contentErrors);

  return result;
}

module.exports = {
  parseSpec,
  findDeliverablesTable,
  extractRowsFromTable
};
