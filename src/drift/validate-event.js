/**
 * Drift event schema validation.
 *
 * Validates drift events against required fields and enum values.
 * Part of Phase 5: Drift Tracking infrastructure.
 */

/**
 * Valid drift kinds - types of divergence that can be recorded.
 * @type {readonly string[]}
 */
const DRIFT_KINDS = Object.freeze([
  'impl_deviation',      // Implementation differs from contract
  'scope_change',        // Work added/removed vs planned deliverable
  'qa_gap',              // Missing/changed verification, tests not added
  'spec_update_needed',  // Contract should change to match reality
  'tdd_update_needed',   // Guardrails/architecture plan needs update
  'followup_required',   // New deliverable/ticket needed
  'rollback_required'    // Must revert or re-align code
]);

/**
 * Valid drift decisions - user choices for how to handle drift.
 * @type {readonly string[]}
 */
const DRIFT_DECISIONS = Object.freeze([
  'pending',   // Record now, decide later
  'accept',    // Update spec/TDD to match reality
  'revert',    // Bring implementation back to spec
  'escalate'   // Needs stakeholder decision
]);

/**
 * Valid drift sources - where the drift event originated.
 * @type {readonly string[]}
 */
const DRIFT_SOURCES = Object.freeze([
  'complete_command',  // From dwa complete deliverable command
  'manual',            // User-entered drift
  'skill'              // LLM skill detected drift
]);

/**
 * Required fields for a drift event.
 */
const REQUIRED_FIELDS = ['id', 'at', 'source', 'kind', 'summary', 'decision'];

/**
 * Validate a drift event against the required schema.
 *
 * Required fields: id, at, source, kind, summary, decision
 * Optional fields: applies_to_next_work, evidence_refs, patch_proposals, author
 *
 * Extra fields are allowed for forward compatibility.
 *
 * @param {object} event - Drift event object to validate
 * @returns {true} Returns true if valid
 * @throws {Error} DWA-E070 if required field is missing
 * @throws {Error} DWA-E071 if kind is invalid
 * @throws {Error} DWA-E072 if decision is invalid
 * @throws {Error} DWA-E073 if source is invalid
 */
function validateDriftEvent(event) {
  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (event[field] === undefined || event[field] === null) {
      throw new Error(`DWA-E070: Missing required drift field: ${field}`);
    }
  }

  // Validate kind enum
  if (!DRIFT_KINDS.includes(event.kind)) {
    throw new Error(`DWA-E071: Invalid drift kind: ${event.kind}`);
  }

  // Validate decision enum
  if (!DRIFT_DECISIONS.includes(event.decision)) {
    throw new Error(`DWA-E072: Invalid drift decision: ${event.decision}`);
  }

  // Validate source enum
  if (!DRIFT_SOURCES.includes(event.source)) {
    throw new Error(`DWA-E073: Invalid drift source: ${event.source}`);
  }

  return true;
}

module.exports = {
  validateDriftEvent,
  DRIFT_KINDS,
  DRIFT_DECISIONS,
  DRIFT_SOURCES
};
