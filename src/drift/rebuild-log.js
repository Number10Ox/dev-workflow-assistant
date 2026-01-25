/**
 * Drift log rebuild utility.
 *
 * Aggregates drift events from all deliverable registries and generates
 * a deterministic drift log at .dwa/drift-log.md.
 *
 * Part of Phase 5: Drift Tracking infrastructure.
 */

const path = require('path');
const fs = require('fs-extra');
const Handlebars = require('handlebars');

/**
 * Aggregate drift events from all deliverable registries.
 *
 * Reads all DEL-*.json files from the deliverables directory,
 * extracts drift_events arrays, and adds deliverable_id to each event.
 *
 * @param {string} deliverableDir - Path to .dwa/deliverables directory
 * @returns {Promise<Array<object>>} Sorted array of drift events (newest first)
 */
async function aggregateDriftEvents(deliverableDir) {
  const events = [];

  // Check if directory exists
  if (!await fs.pathExists(deliverableDir)) {
    return events;
  }

  // Read all JSON files in deliverables directory
  const files = await fs.readdir(deliverableDir);
  const registryFiles = files.filter(f => f.startsWith('DEL-') && f.endsWith('.json'));

  for (const file of registryFiles) {
    const registryPath = path.join(deliverableDir, file);
    const registry = await fs.readJSON(registryPath);

    // Extract deliverable ID from registry or filename
    const deliverableId = registry.id || file.replace('.json', '');

    // Add each drift event with deliverable_id
    if (registry.drift_events && Array.isArray(registry.drift_events)) {
      for (const event of registry.drift_events) {
        events.push({
          ...event,
          deliverable_id: deliverableId
        });
      }
    }
  }

  // Sort by timestamp, newest first
  events.sort((a, b) => {
    const timeA = new Date(a.at).getTime();
    const timeB = new Date(b.at).getTime();
    return timeB - timeA;
  });

  return events;
}

/**
 * Categorize drift events by decision type.
 *
 * @param {Array<object>} events - All drift events
 * @returns {{open: Array, accepted: Array, reverted: Array}}
 */
function categorizeEvents(events) {
  const open = [];
  const accepted = [];
  const reverted = [];

  for (const event of events) {
    if (event.decision === 'pending' || event.decision === 'escalate') {
      open.push(event);
    } else if (event.decision === 'accept') {
      accepted.push(event);
    } else if (event.decision === 'revert') {
      reverted.push(event);
    }
  }

  return { open, accepted, reverted };
}

/**
 * Group drift events by deliverable ID.
 *
 * Events within each deliverable are sorted chronologically (oldest first).
 *
 * @param {Array<object>} events - All drift events
 * @returns {Array<{deliverable_id: string, events: Array}>}
 */
function groupByDeliverable(events) {
  const groups = {};

  for (const event of events) {
    const id = event.deliverable_id;
    if (!groups[id]) {
      groups[id] = [];
    }
    groups[id].push(event);
  }

  // Convert to array and sort events within each group chronologically (oldest first)
  const result = [];
  const sortedIds = Object.keys(groups).sort();

  for (const id of sortedIds) {
    const groupEvents = groups[id].sort((a, b) => {
      const timeA = new Date(a.at).getTime();
      const timeB = new Date(b.at).getTime();
      return timeA - timeB;
    });

    result.push({
      deliverable_id: id,
      events: groupEvents
    });
  }

  return result;
}

/**
 * Rebuild the drift log from all deliverable registries.
 *
 * Aggregates events, categorizes them, groups by deliverable,
 * renders via Handlebars template, and writes to .dwa/drift-log.md.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{openDrift: number, totalEvents: number, logPath: string}>}
 */
async function rebuildDriftLog(projectRoot) {
  const deliverableDir = path.join(projectRoot, '.dwa', 'deliverables');
  const logPath = path.join(projectRoot, '.dwa', 'drift-log.md');

  // Aggregate all drift events
  const allEvents = await aggregateDriftEvents(deliverableDir);

  // Categorize by decision
  const { open, accepted, reverted } = categorizeEvents(allEvents);

  // Group by deliverable
  const byDeliverable = groupByDeliverable(allEvents);

  // Load and compile template
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'drift-log-v1.hbs');
  const templateSource = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);

  // Render template
  const rendered = template({
    generated_at: new Date().toISOString(),
    open_count: open.length,
    total_events: allEvents.length,
    open_drift: open,
    accepted_drift: accepted,
    reverted_drift: reverted,
    by_deliverable: byDeliverable
  });

  // Ensure .dwa directory exists and write log
  await fs.ensureDir(path.join(projectRoot, '.dwa'));
  await fs.writeFile(logPath, rendered, 'utf8');

  return {
    openDrift: open.length,
    totalEvents: allEvents.length,
    logPath
  };
}

module.exports = {
  rebuildDriftLog,
  aggregateDriftEvents,
  categorizeEvents,
  groupByDeliverable
};
