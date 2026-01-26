/**
 * Diagnostic code system for Google Docs import.
 *
 * Uses DWA-GDOC-XXX-NNN pattern with severity levels:
 * - 100-series: Info (informational, non-blocking)
 * - 200-series: Warning (potential issues, continues)
 * - 300-series: Error (conversion issues, may affect correctness)
 * - 400-series: Fatal (blocking failures)
 */

/**
 * Diagnostic class for import operations.
 */
class ImportDiagnostic {
  /**
   * @param {string} code - Diagnostic code (e.g., 'DWA-GDOC-201')
   * @param {'info' | 'warning' | 'error' | 'fatal'} level - Severity level
   * @param {string} message - Human-readable message
   * @param {string} [elementId] - Optional Google Docs element ID
   */
  constructor(code, level, message, elementId = null) {
    this.code = code;
    this.level = level;
    this.message = message;
    this.elementId = elementId;
  }

  /**
   * Format diagnostic as string.
   * @returns {string} Formatted as: {code} [{LEVEL}] {prefix}{message}
   */
  toString() {
    const levelUpper = this.level.toUpperCase();
    const prefix = this.elementId ? `Element ${this.elementId}: ` : '';
    return `${this.code} [${levelUpper}] ${prefix}${this.message}`;
  }
}

/**
 * Registry of predefined diagnostic codes.
 */
const DIAGNOSTICS = {
  // Info (100-series): Informational, non-blocking transformations
  TOC_DROPPED: {
    code: 'DWA-GDOC-100',
    level: 'info',
    template: 'Dropped auto-generated table of contents'
  },
  PAGE_BREAK_CONVERTED: {
    code: 'DWA-GDOC-101',
    level: 'info',
    template: 'Converted page break to horizontal rule'
  },
  HEADING_NORMALIZED: {
    code: 'DWA-GDOC-102',
    level: 'info',
    template: 'Normalized heading level from {originalLevel} to {normalizedLevel}'
  },

  // Warning (200-series): Potential issues, continues with best-effort
  IMAGE_PLACEHOLDER: {
    code: 'DWA-GDOC-201',
    level: 'warning',
    template: 'Image {imageId} replaced with placeholder (download failed or unavailable)'
  },
  TABLE_TO_HTML: {
    code: 'DWA-GDOC-202',
    level: 'warning',
    template: 'Complex table converted to HTML (contains merged cells or multi-row headers)'
  },
  COMMENT_DROPPED: {
    code: 'DWA-GDOC-203',
    level: 'warning',
    template: 'Comment dropped: "{commentText}"'
  },
  EQUATION_PLACEHOLDER: {
    code: 'DWA-GDOC-204',
    level: 'warning',
    template: 'Equation replaced with placeholder (LaTeX conversion not available)'
  },
  FOOTNOTE_SIMPLIFIED: {
    code: 'DWA-GDOC-205',
    level: 'warning',
    template: 'Footnote {footnoteId} simplified (rich formatting removed)'
  },
  LINK_BROKEN: {
    code: 'DWA-GDOC-206',
    level: 'warning',
    template: 'Broken link detected: text "{linkText}" has no URL'
  },

  // Error (300-series): Conversion issues that may affect correctness
  INVALID_TABLE_STRUCTURE: {
    code: 'DWA-GDOC-301',
    level: 'error',
    template: 'Invalid table structure at {elementId}: {reason}'
  },
  ELEMENT_PARSE_FAILED: {
    code: 'DWA-GDOC-302',
    level: 'error',
    template: 'Failed to parse element {elementId}: {error}'
  },

  // Fatal (400-series): Blocking failures
  AUTH_FAILURE: {
    code: 'DWA-GDOC-401',
    level: 'fatal',
    template: 'Authentication failed: {reason}'
  },
  DOC_NOT_FOUND: {
    code: 'DWA-GDOC-402',
    level: 'fatal',
    template: 'Document {docId} not found or not accessible'
  },
  CORRUPT_DOCUMENT: {
    code: 'DWA-GDOC-403',
    level: 'fatal',
    template: 'Document structure is corrupt or unparseable: {reason}'
  },
  MCP_UNAVAILABLE: {
    code: 'DWA-GDOC-404',
    level: 'fatal',
    template: 'Google Workspace provider unavailable: {reason}'
  }
};

/**
 * Factory function to create diagnostic instances.
 *
 * @param {string} type - Key from DIAGNOSTICS object
 * @param {Object} [vars={}] - Template variables to interpolate
 * @param {string} [elementId] - Optional element ID
 * @returns {ImportDiagnostic}
 */
function createDiagnostic(type, vars = {}, elementId = null) {
  const def = DIAGNOSTICS[type];
  if (!def) {
    throw new Error(`Unknown diagnostic type: ${type}`);
  }

  // Simple template interpolation: replace {varName} with vars.varName
  let message = def.template;
  for (const [key, value] of Object.entries(vars)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  return new ImportDiagnostic(def.code, def.level, message, elementId);
}

module.exports = {
  ImportDiagnostic,
  DIAGNOSTICS,
  createDiagnostic
};
