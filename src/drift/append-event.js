/**
 * Append-only drift event recording.
 *
 * Appends drift events to deliverable registry files without mutation.
 * Part of Phase 5: Drift Tracking infrastructure.
 */

const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const { validateDriftEvent } = require('./validate-event');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Append a drift event to a deliverable registry.
 *
 * Event sourcing pattern: Never modifies existing events, only appends.
 *
 * Auto-generates id (UUID) and at (timestamp) if not provided.
 * Validates event via validateDriftEvent before appending.
 * Updates drift_open_count (count of pending + escalate decisions).
 * Uses writeJsonWithSchema for atomic writes.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {object} eventData - Drift event data (source, kind, summary, decision, etc.)
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<object>} Updated registry object
 * @throws {Error} DWA-E080 if deliverable not found
 * @throws {Error} DWA-E070-E073 if event validation fails
 */
async function appendDriftEvent(deliverableId, eventData, projectRoot) {
  const registryPath = path.join(
    projectRoot,
    '.dwa',
    'deliverables',
    `${deliverableId}.json`
  );

  // Check if deliverable exists
  if (!await fs.pathExists(registryPath)) {
    throw new Error(`DWA-E080: Deliverable ${deliverableId} not found`);
  }

  // Read existing registry
  const registry = await fs.readJSON(registryPath);

  // Initialize drift_events array if not present
  if (!registry.drift_events) {
    registry.drift_events = [];
  }

  // Create drift event with auto-generated fields if not provided
  const driftEvent = {
    id: eventData.id || crypto.randomUUID(),
    at: eventData.at || new Date().toISOString(),
    ...eventData
  };

  // Ensure id and at are set (in case eventData had them, they're now at top level)
  if (eventData.id) {
    driftEvent.id = eventData.id;
  }
  if (eventData.at) {
    driftEvent.at = eventData.at;
  }

  // Validate event schema (throws if invalid)
  validateDriftEvent(driftEvent);

  // Append event (immutable - never modify existing events)
  registry.drift_events.push(driftEvent);

  // Update derived fields - count of pending + escalate decisions
  registry.drift_open_count = registry.drift_events.filter(
    e => e.decision === 'pending' || e.decision === 'escalate'
  ).length;

  // Atomic write with schema version
  await writeJsonWithSchema(registryPath, registry);

  return registry;
}

module.exports = {
  appendDriftEvent
};
