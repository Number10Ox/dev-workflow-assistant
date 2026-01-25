/**
 * Fetch drift data for execution packets.
 *
 * Drift items are pulled from registry where:
 * - decision is pending, OR
 * - applies_to_next_work is true
 *
 * Also computes source freshness by comparing file mtimes.
 */

const path = require('path');
const fs = require('fs-extra');

/**
 * Fetch drift data for a deliverable.
 *
 * @param {object} registry - Deliverable registry object
 * @param {object} featureJson - Feature.json contents
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{
 *   items: Array<{kind: string, description: string, decision: string, applies_to_next_work?: boolean}>,
 *   source_freshness: {spec_changed: boolean, tdd_changed: boolean}
 * }>}
 */
async function fetchDriftData(registry, featureJson, projectRoot) {
  const result = {
    items: [],
    source_freshness: {
      spec_changed: false,
      tdd_changed: false
    }
  };

  // Filter drift items from registry drift_events (Phase 5 event-sourced structure)
  if (registry.drift_events && Array.isArray(registry.drift_events)) {
    result.items = registry.drift_events
      .filter(event => {
        // Include if decision is pending
        if (event.decision === 'pending') {
          return true;
        }
        // Include if applies_to_next_work is true
        if (event.applies_to_next_work === true) {
          return true;
        }
        return false;
      })
      .map(event => ({
        // Map event structure to packet item structure
        kind: event.kind,
        description: event.summary, // drift_events uses 'summary', packets use 'description'
        decision: event.decision,
        applies_to_next_work: event.applies_to_next_work
      }));
  }

  // Compute source freshness
  result.source_freshness = await computeSourceFreshness(registry, featureJson, projectRoot);

  return result;
}

/**
 * Compute whether source files have changed since last packet generation.
 *
 * @param {object} registry - Deliverable registry object
 * @param {object} featureJson - Feature.json contents
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{spec_changed: boolean, tdd_changed: boolean}>}
 */
async function computeSourceFreshness(registry, featureJson, projectRoot) {
  const freshness = {
    spec_changed: false,
    tdd_changed: false
  };

  // Get last packet generation time from registry
  const lastPacketTime = registry.last_packet_at || registry.updated_at;
  if (!lastPacketTime) {
    return freshness;
  }

  const lastPacketDate = new Date(lastPacketTime);

  // Check spec file mtime
  if (featureJson.spec_path) {
    const specPath = path.join(projectRoot, featureJson.spec_path);
    try {
      const stat = await fs.stat(specPath);
      if (stat.mtime > lastPacketDate) {
        freshness.spec_changed = true;
      }
    } catch {
      // File doesn't exist or can't be read
    }
  }

  // Check TDD file mtime
  if (featureJson.tdd_path) {
    const tddPath = path.join(projectRoot, featureJson.tdd_path);
    try {
      const stat = await fs.stat(tddPath);
      if (stat.mtime > lastPacketDate) {
        freshness.tdd_changed = true;
      }
    } catch {
      // File doesn't exist or can't be read
    }
  }

  return freshness;
}

module.exports = {
  fetchDriftData,
  computeSourceFreshness
};
