/**
 * Idempotent registry update logic for deliverable JSON files.
 *
 * Features:
 * - Creates/updates .dwa/deliverables/DEL-###.json files
 * - Preserves runtime fields (status, linear_id, etc.) on re-parse
 * - Detects orphaned deliverables (removed from spec)
 * - Uses deep equality to skip writes when content unchanged
 * - Atomic writes via writeJsonWithSchema
 */

const fs = require('fs-extra');
const path = require('path');
const fastDeepEqual = require('fast-deep-equal');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Fields sourced from the spec - these get overwritten on re-parse.
 * Maps from table column names to JSON field names.
 */
const SPEC_FIELD_MAP = {
  'Deliverable ID': 'id',
  'User Story': 'user_story',
  'Description': 'description',
  'Acceptance Criteria (testable)': 'acceptance_criteria',
  'QA Plan Notes': 'qa_notes',
  'Dependencies (DEL-###)': 'dependencies'
};

/**
 * Runtime fields - these are preserved on re-parse.
 * Set by other commands (Linear sync, complete deliverable, etc.)
 */
const RUNTIME_FIELDS = [
  'status',
  'linear_id',
  'linear_url',
  'pr_url',
  'completed_at',
  'created_at'
];

/**
 * Convert a deliverable object from parseSpec format to registry format.
 * Normalizes column names to snake_case field names.
 *
 * @param {object} deliverable - Deliverable from parseSpec with column names as keys
 * @returns {object} Normalized deliverable with snake_case keys
 */
function normalizeDeliverable(deliverable) {
  const normalized = {};

  for (const [columnName, fieldName] of Object.entries(SPEC_FIELD_MAP)) {
    if (deliverable[columnName] !== undefined) {
      normalized[fieldName] = deliverable[columnName];
    }
  }

  return normalized;
}

/**
 * Merge spec-sourced fields with existing runtime fields.
 * Spec fields overwrite existing values; runtime fields are preserved.
 *
 * @param {object} specFields - New spec-sourced fields
 * @param {object} existing - Existing registry content
 * @returns {object} Merged object
 */
function mergeFields(specFields, existing) {
  const merged = { ...specFields };

  // Preserve runtime fields from existing
  for (const field of RUNTIME_FIELDS) {
    if (existing[field] !== undefined) {
      merged[field] = existing[field];
    }
  }

  // Remove orphan flags if present (un-orphan)
  delete merged.orphaned;
  delete merged.orphaned_at;

  return merged;
}

/**
 * Compare two deliverable objects for equality.
 * Ignores schemaVersion since that's added by writeJsonWithSchema.
 *
 * @param {object} existing - Existing registry content
 * @param {object} updated - New merged content
 * @returns {boolean} True if content is equal
 */
function contentEqual(existing, updated) {
  // Create copies without schemaVersion for comparison
  const existingCompare = { ...existing };
  const updatedCompare = { ...updated };
  delete existingCompare.schemaVersion;
  delete updatedCompare.schemaVersion;

  return fastDeepEqual(existingCompare, updatedCompare);
}

/**
 * Update registry files from parsed deliverables.
 *
 * Idempotent behavior:
 * - Creates new files for new deliverables
 * - Updates files only when spec-sourced content changes
 * - Preserves runtime fields (status, linear_id, etc.)
 * - Flags removed deliverables as orphaned (does not delete)
 * - Un-orphans deliverables that reappear in spec
 *
 * @param {object[]} deliverables - Array of deliverables from parseSpec
 * @param {string} registryDir - Path to registry directory (e.g., .dwa/deliverables)
 * @returns {Promise<{created: number, updated: number, unchanged: number, orphaned: number}>}
 */
async function updateRegistry(deliverables, registryDir) {
  const result = {
    created: 0,
    updated: 0,
    unchanged: 0,
    orphaned: 0
  };

  // Ensure registry directory exists
  await fs.ensureDir(registryDir);

  // Track which IDs we're processing
  const processedIds = new Set();

  // Process each deliverable from the spec
  for (const del of deliverables) {
    const normalized = normalizeDeliverable(del);
    const id = normalized.id;

    if (!id) {
      continue; // Skip invalid deliverables
    }

    processedIds.add(id);

    const filePath = path.join(registryDir, `${id}.json`);
    const fileExists = await fs.pathExists(filePath);

    if (fileExists) {
      // File exists - merge and check for changes
      const existing = await fs.readJSON(filePath);
      const merged = mergeFields(normalized, existing);

      // Check if un-orphaning (orphan flags were present)
      const wasOrphaned = existing.orphaned === true;

      if (contentEqual(existing, merged) && !wasOrphaned) {
        result.unchanged++;
      } else {
        // Content changed or un-orphaning - write update
        await writeJsonWithSchema(filePath, merged);
        result.updated++;
      }
    } else {
      // New file - add created_at timestamp
      const withTimestamp = {
        ...normalized,
        created_at: new Date().toISOString()
      };
      await writeJsonWithSchema(filePath, withTimestamp);
      result.created++;
    }
  }

  // Detect orphaned files (exist in registry but not in parsed spec)
  const existingFiles = await fs.readdir(registryDir).catch(() => []);

  for (const filename of existingFiles) {
    if (!filename.startsWith('DEL-') || !filename.endsWith('.json')) {
      continue;
    }

    const id = path.basename(filename, '.json');

    if (processedIds.has(id)) {
      continue; // Not orphaned
    }

    // This file is orphaned
    const filePath = path.join(registryDir, filename);
    const existing = await fs.readJSON(filePath);

    if (existing.orphaned) {
      // Already flagged as orphaned - don't re-flag
      continue;
    }

    // Flag as orphaned
    const flagged = {
      ...existing,
      orphaned: true,
      orphaned_at: new Date().toISOString()
    };
    await writeJsonWithSchema(filePath, flagged);
    result.orphaned++;
  }

  return result;
}

module.exports = {
  updateRegistry,
  normalizeDeliverable,
  mergeFields,
  SPEC_FIELD_MAP,
  RUNTIME_FIELDS
};
