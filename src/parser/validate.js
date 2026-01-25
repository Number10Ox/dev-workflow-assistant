/**
 * Validation utilities for feature-spec.md parsing.
 * Error accumulation pattern - collects all errors before failing.
 *
 * Diagnostic Codes:
 * - DWA-E01X: Frontmatter errors
 * - DWA-E02X: Table structure errors
 * - DWA-E03X: Deliverable content errors
 */

/**
 * ValidationError class with diagnostic code, message, and optional line number.
 */
class ValidationError {
  /**
   * @param {string} code - Diagnostic code (e.g., DWA-E010)
   * @param {string} message - Human-readable error message
   * @param {number|null} line - Optional line number where error occurred
   */
  constructor(code, message, line = null) {
    this.code = code;
    this.message = message;
    this.line = line;
  }

  /**
   * Format error for display.
   * @returns {string} Formatted error string
   */
  toString() {
    const linePrefix = this.line ? `Line ${this.line}: ` : '';
    return `${this.code} ${linePrefix}${this.message}`;
  }
}

/**
 * Required frontmatter fields for a valid spec.
 */
const REQUIRED_FRONTMATTER_FIELDS = ['feature_id', 'title', 'spec_schema_version'];

/**
 * Supported spec schema version.
 */
const SUPPORTED_SCHEMA_VERSION = 'v2.0';

/**
 * Validate YAML frontmatter for required fields.
 *
 * @param {object} frontMatter - Parsed frontmatter object
 * @returns {ValidationError[]} Array of validation errors (empty if valid)
 */
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
  } else if (frontMatter.spec_schema_version !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(new ValidationError(
      'DWA-E013',
      `Unsupported spec_schema_version: ${frontMatter.spec_schema_version} (expected ${SUPPORTED_SCHEMA_VERSION})`
    ));
  }

  return errors;
}

/**
 * Required columns in the Deliverables Table.
 */
const REQUIRED_COLUMNS = [
  'Deliverable ID',
  'User Story',
  'Description',
  'Acceptance Criteria (testable)',
  'QA Plan Notes'
];

/**
 * Extract text from an AST cell node.
 * Recursively extracts text values from nested nodes.
 *
 * @param {object} cellNode - AST table cell node
 * @returns {string} Extracted text content
 */
function extractCellText(cellNode) {
  if (!cellNode || !cellNode.children) {
    return '';
  }

  let text = '';

  function traverse(node) {
    if (node.type === 'text') {
      text += node.value;
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(cellNode);
  return text.trim();
}

/**
 * Validate table structure - check for required columns.
 *
 * @param {object|null} tableNode - AST table node
 * @returns {ValidationError[]} Array of validation errors (empty if valid)
 */
function validateTableStructure(tableNode) {
  const errors = [];

  if (!tableNode) {
    errors.push(new ValidationError('DWA-E020', 'Deliverables Table not found'));
    return errors;
  }

  // Extract header row
  if (!tableNode.children || tableNode.children.length === 0) {
    errors.push(new ValidationError('DWA-E020', 'Deliverables Table not found'));
    return errors;
  }

  const headerRow = tableNode.children[0];
  if (!headerRow.children) {
    errors.push(new ValidationError('DWA-E020', 'Deliverables Table not found'));
    return errors;
  }

  const headers = headerRow.children.map(cell => extractCellText(cell));

  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      errors.push(new ValidationError('DWA-E021', `Missing required column: ${required}`));
    }
  }

  return errors;
}

/**
 * Validate deliverable content - check for unique IDs, non-empty required fields.
 *
 * @param {object[]} deliverables - Array of deliverable objects
 * @returns {ValidationError[]} Array of validation errors (empty if valid)
 */
function validateDeliverableContent(deliverables) {
  const errors = [];
  const ids = new Set();

  deliverables.forEach((del, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 0-index

    const delId = del['Deliverable ID'];

    if (!delId) {
      errors.push(new ValidationError('DWA-E030', `Row ${rowNum}: Missing Deliverable ID`, rowNum));
    } else if (ids.has(delId)) {
      errors.push(new ValidationError('DWA-E031', `Row ${rowNum}: Duplicate Deliverable ID: ${delId}`, rowNum));
    } else {
      ids.add(delId);
    }

    const userStory = del['User Story'];
    if (!userStory || userStory.trim() === '') {
      errors.push(new ValidationError('DWA-E032', `Row ${rowNum}: Empty User Story`, rowNum));
    }

    const acceptanceCriteria = del['Acceptance Criteria (testable)'];
    if (!acceptanceCriteria || acceptanceCriteria.trim() === '') {
      errors.push(new ValidationError('DWA-E033', `Row ${rowNum}: Empty Acceptance Criteria`, rowNum));
    }
  });

  return errors;
}

module.exports = {
  ValidationError,
  validateFrontMatter,
  validateTableStructure,
  validateDeliverableContent,
  extractCellText,
  REQUIRED_COLUMNS,
  SUPPORTED_SCHEMA_VERSION
};
