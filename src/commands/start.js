/**
 * Start command - generates execution packets for deliverables.
 *
 * Flow:
 * 1. Validate feature.json exists
 * 2. Check spec freshness (staleness detection)
 * 3. Validate deliverable exists in registry
 * 4. Check if packet already exists (already-started detection)
 * 5. Generate packet via generatePacketShell
 * 6. Update registry with started_at timestamp
 * 7. Return structured result
 */

const path = require('path');
const fs = require('fs-extra');
const { generatePacketShell } = require('../packets/generate-shell');
const { writeJsonWithSchema } = require('../utils/schema');
const DWAMaintenance = require('../maintenance');

/**
 * Human-readable messages for staleness reasons.
 */
const STALENESS_MESSAGES = {
  'hash-changed': 'Spec content has changed since last parse',
  'mtime-newer': 'Spec file modified since last parse (no content hash stored)',
  'no-provenance': 'No content hash stored; cannot verify freshness'
};

/**
 * Run the start command to generate an execution packet.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {string} projectRoot - Project root directory
 * @param {Object} options - Options
 * @param {boolean} options.force - Bypass staleness check
 * @returns {Promise<{
 *   success: boolean,
 *   alreadyStarted: boolean,
 *   stale: boolean,
 *   stalenessReason: string|null,
 *   packetPath: string|null,
 *   existingPath: string|null,
 *   appendixPath: string|null,
 *   wordCount: number|null,
 *   errors: Array<{code: string, message: string}>
 * }>}
 */
async function runStart(deliverableId, projectRoot, options = {}) {
  const result = {
    success: false,
    alreadyStarted: false,
    stale: false,
    stalenessReason: null,
    packetPath: null,
    existingPath: null,
    appendixPath: null,
    wordCount: null,
    errors: []
  };

  // Step 1: Check feature.json exists
  const featureJsonPath = path.join(projectRoot, '.dwa', 'feature.json');
  if (!await fs.pathExists(featureJsonPath)) {
    result.errors.push({
      code: 'DWA-E040',
      message: 'No feature.json found. Run create-spec first.'
    });
    return result;
  }

  // Step 2: Check freshness (staleness detection)
  const maint = new DWAMaintenance(projectRoot);
  const freshness = await maint.checkFreshness();

  if (freshness.stale) {
    result.stale = true;
    result.stalenessReason = STALENESS_MESSAGES[freshness.reason] || freshness.reason;

    if (!options.force) {
      result.errors.push({
        code: 'DWA-E045',
        message: `Spec modified since last parse (${freshness.reason}). Run 'dwa --parse' or use --force.`
      });
      return result;
    }
    // If --force, continue but mark as stale for packet warning
  }

  // Step 3: Check deliverable exists in registry
  const registryPath = path.join(projectRoot, '.dwa', 'deliverables', `${deliverableId}.json`);
  if (!await fs.pathExists(registryPath)) {
    result.errors.push({
      code: 'DWA-E041',
      message: `Deliverable ${deliverableId} not found in registry. Run parse first.`
    });
    return result;
  }

  // Step 4: Check if packet already exists
  const packetPath = path.join(projectRoot, '.dwa', 'packets', `${deliverableId}.md`);
  if (await fs.pathExists(packetPath)) {
    result.alreadyStarted = true;
    result.existingPath = packetPath;
    return result;
  }

  // Step 5: Generate packet (pass staleness info for warning when --force used)
  const genOptions = {};
  if (result.stale) {
    genOptions.stalenessWarning = result.stalenessReason;
  }
  const genResult = await generatePacketShell(deliverableId, projectRoot, genOptions);

  if (genResult.error) {
    result.errors.push(genResult.error);
    return result;
  }

  // Step 6: Update registry with started_at timestamp
  const registry = await fs.readJSON(registryPath);
  registry.started_at = new Date().toISOString();
  await writeJsonWithSchema(registryPath, registry);

  // Step 7: Build success result
  result.success = true;
  result.packetPath = genResult.packetPath;
  result.appendixPath = genResult.appendixPath || null;
  result.wordCount = genResult.wordCount;

  return result;
}

module.exports = {
  runStart
};
