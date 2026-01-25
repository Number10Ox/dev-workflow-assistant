/**
 * Start command - generates execution packets for deliverables.
 *
 * Flow:
 * 1. Validate feature.json exists
 * 2. Validate deliverable exists in registry
 * 3. Check if packet already exists (already-started detection)
 * 4. Generate packet via generatePacketShell
 * 5. Update registry with started_at timestamp
 * 6. Return structured result
 */

const path = require('path');
const fs = require('fs-extra');
const { generatePacketShell } = require('../packets/generate-shell');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Run the start command to generate an execution packet.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{
 *   success: boolean,
 *   alreadyStarted: boolean,
 *   packetPath: string|null,
 *   existingPath: string|null,
 *   appendixPath: string|null,
 *   wordCount: number|null,
 *   errors: Array<{code: string, message: string}>
 * }>}
 */
async function runStart(deliverableId, projectRoot) {
  const result = {
    success: false,
    alreadyStarted: false,
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

  // Step 2: Check deliverable exists in registry
  const registryPath = path.join(projectRoot, '.dwa', 'deliverables', `${deliverableId}.json`);
  if (!await fs.pathExists(registryPath)) {
    result.errors.push({
      code: 'DWA-E041',
      message: `Deliverable ${deliverableId} not found in registry. Run parse first.`
    });
    return result;
  }

  // Step 3: Check if packet already exists
  const packetPath = path.join(projectRoot, '.dwa', 'packets', `${deliverableId}.md`);
  if (await fs.pathExists(packetPath)) {
    result.alreadyStarted = true;
    result.existingPath = packetPath;
    return result;
  }

  // Step 4: Generate packet
  const genResult = await generatePacketShell(deliverableId, projectRoot);

  if (genResult.error) {
    result.errors.push(genResult.error);
    return result;
  }

  // Step 5: Update registry with started_at timestamp
  const registry = await fs.readJSON(registryPath);
  registry.started_at = new Date().toISOString();
  await writeJsonWithSchema(registryPath, registry);

  // Step 6: Build success result
  result.success = true;
  result.packetPath = genResult.packetPath;
  result.appendixPath = genResult.appendixPath || null;
  result.wordCount = genResult.wordCount;

  return result;
}

module.exports = {
  runStart
};
