/**
 * Google Docs import orchestration.
 *
 * Orchestrates bridge access, conversion, and file output with idempotent reimport support.
 * Uses content hashing to detect local edits and prevent accidental overwrites.
 */

const path = require('path');
const fs = require('fs-extra');
const writeFileAtomic = require('write-file-atomic');
const { GoogleWorkspaceBridgeClient } = require('./bridge-client');
const { gdocToMdast } = require('./gdoc-to-mdast');
const { mdastToMarkdown } = require('./mdast-to-markdown');
const { hashImportedContent, verifyContentHash, extractImportRegion } = require('./hash-content');
const { generateImportReport, writeImportReport } = require('./import-report');
const { createDiagnostic } = require('./diagnostics');

/**
 * Parse Google Docs document ID from URL or raw ID.
 *
 * @param {string} input - URL or document ID
 * @returns {string} Document ID
 * @throws {Error} If input format is invalid
 */
function parseDocIdFromUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: expected Google Docs URL or document ID');
  }

  const trimmed = input.trim();

  // Pattern: docs.google.com/document/d/{id}/...
  const urlPattern = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
  const match = urlPattern.exec(trimmed);

  if (match) {
    return match[1];
  }

  // If no slashes and reasonable length (10-100 chars), assume it's an ID
  if (!trimmed.includes('/') && trimmed.length >= 10 && trimmed.length <= 100) {
    return trimmed;
  }

  throw new Error(
    'Invalid Google Docs URL or ID. Expected: docs.google.com/document/d/{id} or document ID'
  );
}

/**
 * Wrap markdown content with DWA markers for provenance tracking.
 *
 * @param {string} content - Markdown content to wrap
 * @param {string} docId - Google Docs document ID
 * @param {string} revisionId - Document revision ID
 * @param {string} importHash - SHA-256 hash of content
 * @returns {string} Content with markers
 */
function wrapWithMarkers(content, docId, revisionId, importHash) {
  const lines = [
    `<!-- DWA:SOURCE doc="gdoc" docId="${docId}" -->`,
    `<!-- DWA:IMPORT_BEGIN docId="${docId}" revisionId="${revisionId}" importHash="${importHash}" -->`,
    content,
    '<!-- DWA:IMPORT_END -->'
  ];
  return lines.join('\n');
}

/**
 * Generate unified diff between existing and new content.
 *
 * @param {string} docId - Google Docs document ID
 * @param {string} existingContent - Current file content
 * @param {string} newContent - New imported content
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Path to written diff file
 */
async function generateImportDiff(docId, existingContent, newContent, projectRoot) {
  const diffsDir = path.join(projectRoot, '.dwa', 'import-diffs', docId);
  await fs.ensureDir(diffsDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const diffPath = path.join(diffsDir, `${timestamp}.md`);

  // Extract import regions for comparison
  const existingRegion = extractImportRegion(existingContent);
  const newRegion = extractImportRegion(newContent);

  const existingText = existingRegion ? existingRegion.content : existingContent;
  const newText = newRegion ? newRegion.content : newContent;

  const existingHash = hashImportedContent(existingText);
  const newHash = hashImportedContent(newText);

  // Simple line-by-line diff (unified format)
  const existingLines = existingText.split('\n');
  const newLines = newText.split('\n');

  const diffLines = [];
  const maxLen = Math.max(existingLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = existingLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine !== newLine) {
      if (oldLine) {
        diffLines.push(`- ${oldLine}`);
      }
      if (newLine) {
        diffLines.push(`+ ${newLine}`);
      }
    } else {
      diffLines.push(`  ${oldLine}`);
    }
  }

  const report = [
    `# Import Diff: ${docId}`,
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Old hash:** ${existingHash}`,
    `**New hash:** ${newHash}`,
    '',
    '## Changes',
    '',
    '```diff',
    ...diffLines,
    '```',
    ''
  ].join('\n');

  await fs.writeFile(diffPath, report, 'utf8');
  return diffPath;
}

/**
 * Find feature root by walking up directory tree looking for .dwa/
 *
 * @param {string} startDir - Starting directory
 * @returns {string | null} Feature root path or null if not found
 */
function findFeatureRoot(startDir) {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const dwaDir = path.join(current, '.dwa');
    if (fs.existsSync(dwaDir)) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Import Google Doc as markdown file with idempotent reimport support.
 *
 * @param {object} options - Import options
 * @param {string} options.docIdOrUrl - Google Docs URL or document ID
 * @param {string} options.projectRoot - Project root directory
 * @param {string} [options.out] - Explicit output path (required if no .dwa/ found)
 * @param {boolean} [options.force] - Force overwrite even with hash mismatch
 * @param {boolean} [options.dryRun] - Preview mode (no file writes)
 * @param {object} [options.bridgeClient] - Injected bridge client (for testing)
 * @returns {Promise<{ success: boolean, message: string, outputPath?: string, report?: object, diagnostics?: array, diffPath?: string }>}
 */
async function importGoogleDoc(options) {
  const { docIdOrUrl, projectRoot, out, force = false, dryRun = false } = options;
  const startTime = Date.now();

  // Initialize bridge client
  const bridgeClient = options.bridgeClient || new GoogleWorkspaceBridgeClient();

  try {
    // Only initialize if not injected (for testing)
    if (!options.bridgeClient) {
      await bridgeClient.initialize();
    }
  } catch (error) {
    const diagnostic = createDiagnostic('MCP_UNAVAILABLE', { reason: error.message });
    return {
      success: false,
      message: `Google Docs provider not available. Run DevEx Service Bridge setup wizard to configure Google Docs access.\nError: ${error.message}`,
      diagnostics: [diagnostic]
    };
  }

  // Check provider availability
  const availability = await bridgeClient.checkAvailability();
  if (!availability.available) {
    const diagnostic = createDiagnostic('MCP_UNAVAILABLE', { reason: availability.error });
    return {
      success: false,
      message: availability.setupInstructions || 'Google Docs provider unavailable.',
      diagnostics: [diagnostic]
    };
  }

  // Parse document ID
  let docId;
  try {
    docId = parseDocIdFromUrl(docIdOrUrl);
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }

  // Read document via bridge
  let gdocDocument;
  let docInfo;
  try {
    gdocDocument = await bridgeClient.readDocument(docId);
    docInfo = await bridgeClient.getDocumentInfo(docId);
  } catch (error) {
    const diagnostic = createDiagnostic('DOC_NOT_FOUND', { docId });
    return {
      success: false,
      message: `Cannot access document. Verify you have permission to view this Google Doc.\nError: ${error.message}`,
      diagnostics: [diagnostic]
    };
  }

  // Convert: gdocToMdast -> mdastToMarkdown
  const conversionResult = gdocToMdast(gdocDocument);
  const markdown = mdastToMarkdown(conversionResult.mdast);

  // Determine output path
  let outputPath;
  if (out) {
    outputPath = path.resolve(projectRoot, out);
  } else {
    const featureRoot = findFeatureRoot(projectRoot);
    if (!featureRoot) {
      return {
        success: false,
        message: 'Cannot determine output path. No .dwa/ directory found. Use --out to specify output path, or run from within a DWA feature directory.'
      };
    }
    outputPath = path.join(featureRoot, 'feature-spec.md');
  }

  // Check existing file for hash mismatch
  let existingContent = null;
  if (await fs.pathExists(outputPath)) {
    existingContent = await fs.readFile(outputPath, 'utf8');
    const existingRegion = extractImportRegion(existingContent);

    if (existingRegion) {
      const storedHash = existingRegion.metadata.importHash;
      const storedRevisionId = existingRegion.metadata.revisionId;

      // Check if document has changed at source
      const docUnchanged =
        (docInfo.etag && docInfo.etag === storedRevisionId) ||
        (docInfo.modifiedTime && docInfo.modifiedTime === storedRevisionId) ||
        (docInfo.revisionId && docInfo.revisionId === storedRevisionId);

      // Check if local content has changed
      const verification = verifyContentHash(existingRegion.content, storedHash);

      if (docUnchanged && verification.unchanged) {
        return {
          success: true,
          message: `Already at latest revision (rev: ${docInfo.revisionId || storedRevisionId})`,
          outputPath,
          diagnostics: conversionResult.diagnostics
        };
      }

      if (!verification.unchanged && !force) {
        // Local edits detected - create diff artifact
        const importHash = hashImportedContent(markdown);
        const wrappedNew = wrapWithMarkers(markdown, docId, docInfo.revisionId, importHash);
        const diffPath = await generateImportDiff(docId, existingContent, wrappedNew, projectRoot);

        return {
          success: false,
          message: `Local edits detected. Hash mismatch.\nDiff saved to: ${diffPath}\nUse --force to overwrite.`,
          diffPath,
          diagnostics: conversionResult.diagnostics
        };
      }
    }
  }

  // Wrap content with markers
  const importHash = hashImportedContent(markdown);
  const revisionId = docInfo.revisionId || docInfo.etag || docInfo.modifiedTime || 'unknown';
  const wrappedContent = wrapWithMarkers(markdown, docId, revisionId, importHash);

  // Write file atomically (unless dry-run)
  if (!dryRun) {
    await fs.ensureDir(path.dirname(outputPath));
    await writeFileAtomic(outputPath, wrappedContent, 'utf8');
  }

  // Generate and write import report
  const duration = Date.now() - startTime;
  const report = generateImportReport(docId, conversionResult.diagnostics, {
    revisionId,
    title: gdocDocument.title || docInfo.title || 'Untitled',
    outputPath,
    importHash,
    elementCounts: {
      // Could extract from mdast traversal in future
      paragraphs: 0,
      tables: 0,
      images: 0
    },
    conversionMode: {
      tableMode: 'html-fallback'
    },
    duration
  });

  let reportPath;
  if (!dryRun) {
    reportPath = await writeImportReport(projectRoot, docId, report);
  }

  const action = existingContent ? 'updated' : 'created';
  const message = dryRun
    ? `[DRY RUN] Would ${action}: ${outputPath}`
    : `Import complete: ${action} ${outputPath}${reportPath ? `\nReport: ${reportPath}` : ''}`;

  return {
    success: true,
    message,
    outputPath,
    report,
    diagnostics: conversionResult.diagnostics
  };
}

module.exports = {
  importGoogleDoc,
  parseDocIdFromUrl,
  wrapWithMarkers,
  generateImportDiff,
  findFeatureRoot
};
