/**
 * Content hashing utilities for freshness detection.
 *
 * Uses SHA-256 for deterministic change detection.
 * Extracted from google-docs/hash-content.js for reuse across DWA.
 */

const crypto = require('crypto');

/**
 * Hash content using SHA-256.
 *
 * @param {string} content - Content to hash
 * @returns {string} Hash in format: sha256:{64-char-hex}
 */
function hashContent(content) {
  const hash = crypto.createHash('sha256');
  hash.update(content, 'utf8');
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
  const currentHash = hashContent(currentContent);
  return {
    unchanged: currentHash === storedHash,
    currentHash,
    storedHash
  };
}

module.exports = {
  hashContent,
  verifyContentHash
};
