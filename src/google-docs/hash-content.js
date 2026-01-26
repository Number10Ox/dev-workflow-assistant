/**
 * Content hashing utilities for Google Docs import change detection.
 *
 * Uses SHA-256 for deterministic, idempotent reimports.
 * Markers enable detection of local edits inside imported regions.
 */

const crypto = require('crypto');

/**
 * Marker patterns for parsing import regions.
 */
const IMPORT_BEGIN_PATTERN = /<!--\s*DWA:IMPORT_BEGIN\s+([^>]+)\s*-->/;
const IMPORT_END_PATTERN = /<!--\s*DWA:IMPORT_END\s*-->/;
const SOURCE_PATTERN = /<!--\s*DWA:SOURCE\s+([^>]+)\s*-->/;
const ATTR_PATTERN = /(\w+)=["']([^"']+)["']/g;

/**
 * Hash imported content using SHA-256.
 *
 * @param {string} markdownContent - Markdown content to hash
 * @returns {string} Hash in format: sha256:{64-char-hex}
 */
function hashImportedContent(markdownContent) {
  const hash = crypto.createHash('sha256');
  hash.update(markdownContent, 'utf8');
  return `sha256:${hash.digest('hex')}`;
}

/**
 * Verify if content has changed by comparing hashes.
 *
 * @param {string} currentContent - Current content to hash
 * @param {string} storedHash - Previously stored hash (sha256:...)
 * @returns {{ unchanged: boolean, currentHash: string, storedHash: string }}
 */
function verifyContentHash(currentContent, storedHash) {
  const currentHash = hashImportedContent(currentContent);
  return {
    unchanged: currentHash === storedHash,
    currentHash,
    storedHash
  };
}

/**
 * Parse marker attributes from HTML comment.
 *
 * @param {string} markerLine - Line containing marker comment
 * @returns {Object} Extracted attributes as key-value pairs
 */
function parseMarkerAttributes(markerLine) {
  const attrs = {};
  let match;

  // Reset regex lastIndex
  ATTR_PATTERN.lastIndex = 0;

  while ((match = ATTR_PATTERN.exec(markerLine)) !== null) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

/**
 * Extract content between DWA:IMPORT_BEGIN and DWA:IMPORT_END markers.
 *
 * Returns the first import region found. If multiple regions exist, uses first
 * and emits console warning.
 *
 * @param {string} markdownContent - Full markdown content
 * @returns {{ content: string, metadata: object } | null} Extracted region and metadata, or null if markers not found
 */
function extractImportRegion(markdownContent) {
  const lines = markdownContent.split('\n');

  let beginIndex = -1;
  let endIndex = -1;
  let metadata = null;

  // Find first IMPORT_BEGIN marker
  for (let i = 0; i < lines.length; i++) {
    const match = IMPORT_BEGIN_PATTERN.exec(lines[i]);
    if (match) {
      beginIndex = i;
      metadata = parseMarkerAttributes(match[1]);
      break;
    }
  }

  if (beginIndex === -1) {
    return null; // No import region
  }

  // Find corresponding IMPORT_END marker
  for (let i = beginIndex + 1; i < lines.length; i++) {
    if (IMPORT_END_PATTERN.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    console.warn('DWA: Found IMPORT_BEGIN without IMPORT_END marker');
    return null;
  }

  // Check for additional IMPORT_BEGIN markers (warn if found)
  for (let i = endIndex + 1; i < lines.length; i++) {
    if (IMPORT_BEGIN_PATTERN.test(lines[i])) {
      console.warn('DWA: Multiple IMPORT_BEGIN markers found. Using first region only.');
      break;
    }
  }

  // Extract content between markers (exclusive of marker lines)
  const regionLines = lines.slice(beginIndex + 1, endIndex);
  const content = regionLines.join('\n').trim();

  return {
    content,
    metadata
  };
}

module.exports = {
  hashImportedContent,
  verifyContentHash,
  extractImportRegion,
  parseMarkerAttributes,
  IMPORT_BEGIN_PATTERN,
  IMPORT_END_PATTERN,
  SOURCE_PATTERN,
  ATTR_PATTERN
};
