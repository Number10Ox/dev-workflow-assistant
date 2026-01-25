/**
 * Complete command - marks deliverables as completed and captures drift.
 *
 * Flow:
 * 1. Validate deliverable exists in registry (DWA-E080 if not)
 * 2. Run structural drift detection via detectStructuralDrift
 * 3. If drift detected AND driftDecision provided -> append drift event
 * 4. If drift detected AND no driftDecision -> set driftDetected: true (caller prompts)
 * 5. Update registry: status='completed', pr_url, completed_at, last_completed_commit
 * 6. Return structured result
 */

const path = require('path');
const fs = require('fs-extra');
const { detectStructuralDrift } = require('../drift/structural-compare');
const { appendDriftEvent } = require('../drift/append-event');
const { writeJsonWithSchema } = require('../utils/schema');
const { DRIFT_DECISIONS } = require('../drift/validate-event');

/**
 * Run the complete command to mark a deliverable as completed.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {object} options - Completion options
 * @param {string} [options.prUrl] - Pull request URL
 * @param {string} [options.commitSha] - Commit SHA
 * @param {string} [options.notes] - Notes about the completion
 * @param {string} [options.driftDecision] - Decision for drift handling: 'accept' | 'revert' | 'escalate' | 'pending'
 * @param {boolean} [options.appliesToNext] - Whether drift applies to next work (default false)
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{
 *   success: boolean,
 *   driftDetected: boolean,
 *   driftRecorded: boolean,
 *   errors: Array<{code: string, message: string}>
 * }>}
 */
async function runComplete(deliverableId, options = {}, projectRoot) {
  const result = {
    success: false,
    driftDetected: false,
    driftRecorded: false,
    errors: []
  };

  // Step 1: Check deliverable exists in registry
  const registryPath = path.join(projectRoot, '.dwa', 'deliverables', `${deliverableId}.json`);
  if (!await fs.pathExists(registryPath)) {
    result.errors.push({
      code: 'DWA-E080',
      message: `Deliverable ${deliverableId} not found`
    });
    return result;
  }

  // Read existing registry
  const registry = await fs.readJSON(registryPath);

  // Step 2: Run structural drift detection
  const driftResult = await detectStructuralDrift(registry, projectRoot);
  result.driftDetected = driftResult.detected;

  // Step 3: Handle drift if detected
  if (driftResult.detected && options.driftDecision) {
    // Validate drift decision
    if (!DRIFT_DECISIONS.includes(options.driftDecision)) {
      result.errors.push({
        code: 'DWA-E072',
        message: `Invalid drift decision: ${options.driftDecision}`
      });
      return result;
    }

    // Build drift event
    const driftEvent = {
      source: 'complete_command',
      kind: driftResult.kind,
      summary: driftResult.summary,
      decision: options.driftDecision
    };

    // Add optional fields
    if (options.appliesToNext) {
      driftEvent.applies_to_next_work = true;
    }

    if (options.notes) {
      driftEvent.author_notes = options.notes;
    }

    // Add evidence_refs from completion options
    if (options.prUrl || options.commitSha) {
      const refs = [];
      if (options.prUrl) refs.push(options.prUrl);
      if (options.commitSha) refs.push(options.commitSha);
      driftEvent.evidence_refs = refs;
    }

    // Append drift event via appendDriftEvent
    await appendDriftEvent(deliverableId, driftEvent, projectRoot);
    result.driftRecorded = true;

    // Re-read registry after drift event was appended
    const updatedRegistry = await fs.readJSON(registryPath);
    Object.assign(registry, updatedRegistry);
  }

  // Step 5: Update registry with completion info
  registry.status = 'completed';
  registry.completed_at = new Date().toISOString();

  if (options.prUrl) {
    registry.pr_url = options.prUrl;
  }

  if (options.commitSha) {
    registry.last_completed_commit = options.commitSha;
  }

  // Write updated registry
  await writeJsonWithSchema(registryPath, registry);

  // Step 6: Build success result
  result.success = true;

  return result;
}

module.exports = {
  runComplete
};
