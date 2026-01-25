/**
 * Structural drift detection.
 *
 * Compares spec vs registry to detect divergence.
 * Part of Phase 5: Drift Tracking infrastructure.
 */

const fs = require('fs-extra');
const path = require('path');
const { parseSpec } = require('../parser/parse-spec');

/**
 * Count acceptance criteria items.
 * Handles multiple formats:
 * - Newline-separated (registry format)
 * - Semicolon-separated (markdown table cells)
 * - <br> separated (HTML in markdown tables)
 *
 * @param {string} acText - Acceptance criteria as string
 * @returns {number} Count of non-empty items
 */
function countACLines(acText) {
  if (!acText || typeof acText !== 'string') {
    return 0;
  }

  // Normalize various separators to newlines
  let normalized = acText
    .replace(/<br\s*\/?>/gi, '\n')  // Handle <br>, <br/>, <br />
    .replace(/;\s*/g, '\n');        // Handle semicolon separators

  return normalized
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .length;
}

/**
 * Extract AC count from spec deliverable.
 * Uses the same counting logic as registry ACs.
 *
 * @param {object} specDel - Deliverable from spec
 * @returns {number} Count of ACs
 */
function countSpecACs(specDel) {
  const ac = specDel['Acceptance Criteria (testable)'];
  return countACLines(ac);
}

/**
 * Detect structural drift between spec and registry.
 *
 * Detection rules (in priority order):
 * 1. Deliverable removed from spec -> kind: spec_update_needed
 * 2. AC count mismatch -> kind: impl_deviation
 * 3. Missing PR URL when status=completed -> kind: qa_gap
 * 4. Description changed -> kind: spec_update_needed
 *
 * @param {object} registry - Deliverable registry object
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{detected: boolean, kind: string|null, summary: string|null, details: object|null}>}
 */
async function detectStructuralDrift(registry, projectRoot) {
  const result = {
    detected: false,
    kind: null,
    summary: null,
    details: null
  };

  // Load feature.json to get spec path
  const featureJsonPath = path.join(projectRoot, '.dwa', 'feature.json');

  if (!await fs.pathExists(featureJsonPath)) {
    return result; // No feature.json = no spec to compare
  }

  const featureJson = await fs.readJSON(featureJsonPath);

  if (!featureJson.spec_path) {
    return result; // No spec_path = no spec to compare
  }

  // Parse current spec
  const specPath = path.join(projectRoot, featureJson.spec_path);

  if (!await fs.pathExists(specPath)) {
    return result; // Spec file doesn't exist = no comparison possible
  }

  const { deliverables } = await parseSpec(specPath);

  // Find matching deliverable in spec
  const specDel = deliverables.find(
    d => d['Deliverable ID'] === registry.id
  );

  // Priority 1: Deliverable removed from spec (orphaned)
  if (!specDel) {
    result.detected = true;
    result.kind = 'spec_update_needed';
    result.summary = `Deliverable ${registry.id} removed from spec but exists in registry`;
    result.details = { registry_id: registry.id };
    return result;
  }

  // Priority 2: AC count mismatch
  const specACCount = countSpecACs(specDel);
  const registryACCount = countACLines(registry.acceptance_criteria);

  if (specACCount !== registryACCount) {
    result.detected = true;
    result.kind = 'impl_deviation';
    result.summary = `AC count mismatch: spec has ${specACCount}, registry has ${registryACCount}`;
    result.details = { spec_ac_count: specACCount, registry_ac_count: registryACCount };
    return result;
  }

  // Priority 3: Missing PR URL when completed
  if (registry.status === 'completed' && !registry.pr_url) {
    result.detected = true;
    result.kind = 'qa_gap';
    result.summary = 'Deliverable marked completed but no PR URL recorded';
    result.details = { status: registry.status };
    return result;
  }

  // Priority 4: Description changed
  const specDesc = (specDel['Description'] || '').trim();
  const registryDesc = (registry.description || '').trim();

  if (specDesc !== registryDesc) {
    result.detected = true;
    result.kind = 'spec_update_needed';
    result.summary = 'Description changed in spec since registry update';
    result.details = { spec_description: specDesc, registry_description: registryDesc };
    return result;
  }

  return result; // No drift detected
}

module.exports = {
  detectStructuralDrift,
  countACLines,
  countSpecACs
};
