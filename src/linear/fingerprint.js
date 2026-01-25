/**
 * Sync fingerprint computation for multi-person safety.
 *
 * The sync hash is a SHA-256 of the normalized DWA block content.
 * It detects manual edits in Linear that would be overwritten by sync.
 */

const crypto = require('crypto');

/**
 * Normalize content for consistent hashing.
 * - Converts line endings to \n
 * - Trims leading/trailing whitespace
 * - Collapses multiple blank lines
 *
 * @param {string} content - Raw content
 * @returns {string} Normalized content
 */
function normalizeForHash(content) {
  return content
    .replace(/\r\n/g, '\n')      // Windows line endings
    .replace(/\r/g, '\n')        // Old Mac line endings
    .trim()
    .replace(/\n{3,}/g, '\n\n'); // Collapse multiple blank lines
}

/**
 * Compute SHA-256 hash of content for sync fingerprint.
 *
 * @param {string} content - Content to hash (will be normalized)
 * @returns {string} 64-character hex hash
 */
function computeSyncHash(content) {
  const normalized = normalizeForHash(content);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Extract sync hash from DWA section content.
 *
 * @param {string} dwaContent - DWA section content (may include markers)
 * @returns {string | null} 64-character hex hash or null if not found
 */
function extractSyncHash(dwaContent) {
  if (!dwaContent) return null;

  // Match: **Sync Hash:** `<64 hex chars>`
  const match = dwaContent.match(/\*\*Sync Hash:\*\*\s*`([a-f0-9]{64})`/i);
  return match ? match[1] : null;
}

/**
 * Check if a DWA section was manually edited.
 * Compares stored hash with recomputed hash of content (excluding the hash line itself).
 *
 * @param {string} dwaContent - DWA section content
 * @returns {{ modified: boolean, storedHash: string | null, computedHash: string }}
 */
function checkForManualEdits(dwaContent) {
  const storedHash = extractSyncHash(dwaContent);

  // Remove the hash line before recomputing
  const contentWithoutHash = dwaContent
    .replace(/\*\*Sync Hash:\*\*\s*`[a-f0-9]{64}`/i, '')
    .trim();

  const computedHash = computeSyncHash(contentWithoutHash);

  return {
    modified: storedHash !== null && storedHash !== computedHash,
    storedHash,
    computedHash
  };
}

module.exports = {
  computeSyncHash,
  extractSyncHash,
  checkForManualEdits,
  normalizeForHash
};
