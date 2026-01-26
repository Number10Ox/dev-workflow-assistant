/**
 * Import report generator for Google Docs import operations.
 *
 * Reports are written to .dwa/import-reports/ for auditability and debugging.
 */

const path = require('path');
const fs = require('fs-extra');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Generate structured import report.
 *
 * @param {string} docId - Google Docs document ID
 * @param {Array<ImportDiagnostic>} diagnostics - List of diagnostics from import
 * @param {Object} stats - Import statistics
 * @param {string} stats.revisionId - Document revision ID
 * @param {string} stats.title - Document title
 * @param {string} stats.outputPath - Output file path
 * @param {string} stats.importHash - Content hash
 * @param {Object} stats.elementCounts - Element counts by type
 * @param {Object} stats.conversionMode - Conversion mode settings
 * @param {number} stats.duration - Import duration in milliseconds
 * @returns {Object} Report object
 */
function generateImportReport(docId, diagnostics, stats) {
  const now = new Date().toISOString();

  // Count diagnostics by level
  const summary = {
    total: diagnostics.length,
    info: 0,
    warnings: 0,
    errors: 0,
    fatal: 0
  };

  for (const diag of diagnostics) {
    if (diag.level === 'info') {
      summary.info++;
    } else if (diag.level === 'warning') {
      summary.warnings++;
    } else if (diag.level === 'error') {
      summary.errors++;
    } else if (diag.level === 'fatal') {
      summary.fatal++;
    }
  }

  return {
    importTimestamp: now,
    source: {
      type: 'gdoc',
      docId,
      revisionId: stats.revisionId,
      title: stats.title
    },
    output: {
      path: stats.outputPath,
      importHash: stats.importHash
    },
    diagnostics: diagnostics.map(diag => ({
      code: diag.code,
      level: diag.level,
      message: diag.message,
      elementId: diag.elementId
    })),
    statistics: {
      elementCounts: stats.elementCounts,
      conversionMode: stats.conversionMode,
      duration: stats.duration
    },
    summary
  };
}

/**
 * Write import report to .dwa/import-reports/ directory.
 *
 * @param {string} projectRoot - Project root directory
 * @param {string} docId - Google Docs document ID
 * @param {Object} report - Report object from generateImportReport
 * @returns {Promise<string>} Path to written report file
 */
async function writeImportReport(projectRoot, docId, report) {
  const reportsDir = path.join(projectRoot, '.dwa', 'import-reports');
  await fs.ensureDir(reportsDir);

  // Filename: {docId}-{timestamp}.json
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${docId}-${timestamp}.json`;
  const reportPath = path.join(reportsDir, filename);

  await writeJsonWithSchema(reportPath, report);

  return reportPath;
}

module.exports = {
  generateImportReport,
  writeImportReport
};
