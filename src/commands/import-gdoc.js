/**
 * CLI command: Import Google Doc as canonical spec.
 *
 * Usage:
 *   dwa --import-gdoc <doc> [options]
 *
 * Options:
 *   --out <path>      Output path for import (required if no .dwa/ found)
 *   --force           Overwrite even with local edits (hash mismatch)
 *   --dry-run         Preview import without writing files
 */

const path = require('path');
const { importGoogleDoc } = require('../google-docs/import');

/**
 * Format diagnostics for console output.
 *
 * @param {Array} diagnostics - Array of ImportDiagnostic objects
 * @returns {string} Formatted diagnostics summary
 */
function formatDiagnostics(diagnostics) {
  if (!diagnostics || diagnostics.length === 0) {
    return '';
  }

  const counts = {
    info: 0,
    warning: 0,
    error: 0,
    fatal: 0
  };

  for (const diag of diagnostics) {
    counts[diag.level] = (counts[diag.level] || 0) + 1;
  }

  const lines = [];
  lines.push('');
  lines.push('=== Import Diagnostics ===');

  if (counts.fatal > 0) {
    lines.push(`FATAL: ${counts.fatal}`);
  }
  if (counts.error > 0) {
    lines.push(`ERRORS: ${counts.error}`);
  }
  if (counts.warning > 0) {
    lines.push(`WARNINGS: ${counts.warning}`);
  }
  if (counts.info > 0) {
    lines.push(`INFO: ${counts.info}`);
  }

  // Show first few diagnostics
  const toShow = diagnostics.filter(d => d.level !== 'info').slice(0, 5);
  if (toShow.length > 0) {
    lines.push('');
    lines.push('Details:');
    for (const diag of toShow) {
      lines.push(`  ${diag.toString()}`);
    }
    if (diagnostics.length > toShow.length) {
      lines.push(`  ... and ${diagnostics.length - toShow.length} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Import Google Doc as markdown file.
 *
 * @param {object} options - Command options
 * @param {string} options.docIdOrUrl - Google Docs URL or document ID
 * @param {string} options.projectRoot - Project root directory
 * @param {string} [options.out] - Explicit output path
 * @param {boolean} [options.force] - Force overwrite
 * @param {boolean} [options.dryRun] - Preview mode
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function importGdoc(options) {
  const { docIdOrUrl, projectRoot, out, force, dryRun } = options;

  console.log('');
  console.log('=== Google Docs Import ===');
  console.log('');
  console.log(`Document: ${docIdOrUrl}`);
  if (out) {
    console.log(`Output: ${out}`);
  }
  if (force) {
    console.log('Mode: Force overwrite');
  }
  if (dryRun) {
    console.log('Mode: Dry run (no files will be written)');
  }
  console.log('');

  // Progress: Connecting
  console.log('→ Connecting to Google Workspace provider...');

  try {
    const result = await importGoogleDoc({
      docIdOrUrl,
      projectRoot,
      out,
      force,
      dryRun
    });

    // Show diagnostics if present
    if (result.diagnostics && result.diagnostics.length > 0) {
      const diagOutput = formatDiagnostics(result.diagnostics);
      console.log(diagOutput);
    }

    if (result.success) {
      console.log('');
      console.log('✔ Import successful!');
      if (result.outputPath) {
        console.log(`  Output: ${result.outputPath}`);
      }
      console.log('');
      return {
        success: true,
        message: result.message
      };
    } else {
      console.log('');
      console.log('✖ Import failed');
      console.log('');
      return {
        success: false,
        message: result.message
      };
    }
  } catch (error) {
    console.log('');
    console.log('✖ Import failed');
    console.log('');
    return {
      success: false,
      message: `Unexpected error: ${error.message}`
    };
  }
}

module.exports = {
  importGdoc,
  formatDiagnostics
};
