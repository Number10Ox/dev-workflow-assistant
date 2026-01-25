/**
 * Fetch TDD constraints (guardrails) for execution packets.
 *
 * Extracts MUST and MUST NOT constraints from TDD file's
 * "## 4) Guardrails" section.
 *
 * Subsections mapped to MUST:
 * - Performance
 * - Security
 * - Scalability
 * - Compatibility
 *
 * Subsection mapped to MUST NOT:
 * - Do NOT
 */

const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const unified = require('unified').unified;
const remarkParse = require('remark-parse').default;
const remarkGfm = require('remark-gfm').default;
const visit = require('unist-util-visit').visit;

/**
 * Fetch TDD constraints from a TDD file.
 *
 * @param {string} tddPath - Path to TDD markdown file
 * @returns {Promise<{must: string[], must_not: string[]}>}
 */
async function fetchTDDConstraints(tddPath) {
  const result = {
    must: [],
    must_not: []
  };

  // Check if file exists
  if (!await fs.pathExists(tddPath)) {
    return result;
  }

  try {
    // Read and parse TDD file
    const content = await fs.readFile(tddPath, 'utf8');
    const { content: markdown } = grayMatter(content);

    // Parse markdown to AST
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm);

    const tree = processor.parse(markdown);

    // Find the Guardrails section and extract constraints
    let inGuardrails = false;
    let currentSubsection = null;
    const mustSections = ['performance', 'security', 'scalability', 'compatibility'];

    visit(tree, (node, index, parent) => {
      // Track when we enter/exit Guardrails section
      if (node.type === 'heading' && node.depth === 2) {
        const headingText = getHeadingText(node).toLowerCase();
        if (headingText.includes('guardrails')) {
          inGuardrails = true;
        } else {
          inGuardrails = false;
        }
        currentSubsection = null;
        return;
      }

      // Track subsections within Guardrails
      if (inGuardrails && node.type === 'heading' && node.depth === 3) {
        const headingText = getHeadingText(node).toLowerCase();
        if (headingText.includes('do not')) {
          currentSubsection = 'do_not';
        } else if (mustSections.some(s => headingText.includes(s))) {
          currentSubsection = 'must';
        } else {
          currentSubsection = null;
        }
        return;
      }

      // Extract list items
      if (inGuardrails && currentSubsection && node.type === 'listItem') {
        const text = getListItemText(node);
        if (text) {
          if (currentSubsection === 'do_not') {
            result.must_not.push(text);
          } else if (currentSubsection === 'must') {
            result.must.push(text);
          }
        }
      }
    });

    return result;
  } catch (error) {
    // If parsing fails, return empty constraints
    return result;
  }
}

/**
 * Extract text from a heading node.
 *
 * @param {object} node - Heading AST node
 * @returns {string} Heading text
 */
function getHeadingText(node) {
  let text = '';
  visit(node, 'text', (textNode) => {
    text += textNode.value;
  });
  return text;
}

/**
 * Extract text from a list item node.
 *
 * @param {object} node - ListItem AST node
 * @returns {string} List item text
 */
function getListItemText(node) {
  let text = '';

  visit(node, (child) => {
    if (child.type === 'text') {
      text += child.value;
    } else if (child.type === 'inlineCode') {
      text += child.value;
    }
  });

  return text.trim();
}

module.exports = {
  fetchTDDConstraints
};
