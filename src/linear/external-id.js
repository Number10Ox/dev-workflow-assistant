/**
 * External ID generation for Linear deduplication.
 *
 * Format: FEAT-YYYY-NNN-DEL-### (e.g., FEAT-2026-001-DEL-003)
 * - Globally unique within a Linear organization
 * - Deterministic from feature metadata + deliverable ID
 * - Stable across machines and fresh clones
 */

/**
 * Generate a globally unique external ID for a deliverable.
 *
 * @param {object} feature - Feature metadata
 * @param {string} feature.id - Feature ID (e.g., "FEAT-2026-001")
 * @param {string} deliverableId - Deliverable ID (e.g., "DEL-003")
 * @returns {string} External ID (e.g., "FEAT-2026-001-DEL-003")
 */
function generateExternalId(feature, deliverableId) {
  if (!feature || !feature.id) {
    throw new Error('Feature ID is required to generate external ID');
  }
  if (!deliverableId) {
    throw new Error('Deliverable ID is required to generate external ID');
  }

  // Format: FEAT-YYYY-NNN-DEL-###
  return `${feature.id}-${deliverableId}`;
}

/**
 * Parse an external ID into its components.
 *
 * @param {string} externalId - External ID (e.g., "FEAT-2026-001-DEL-003")
 * @returns {{ featureId: string, deliverableId: string } | null}
 */
function parseExternalId(externalId) {
  if (!externalId) return null;

  // Match: FEAT-YYYY-NNN-DEL-###
  const match = externalId.match(/^(FEAT-\d{4}-\d{3})-(DEL-\d{3})$/);
  if (!match) return null;

  return {
    featureId: match[1],
    deliverableId: match[2]
  };
}

/**
 * Validate an external ID format.
 *
 * @param {string} externalId - External ID to validate
 * @returns {boolean} True if valid format
 */
function isValidExternalId(externalId) {
  return parseExternalId(externalId) !== null;
}

module.exports = {
  generateExternalId,
  parseExternalId,
  isValidExternalId
};
