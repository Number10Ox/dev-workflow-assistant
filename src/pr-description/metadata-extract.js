/**
 * Metadata extraction utilities for PR description generation.
 *
 * Read-only operations - never modifies registry or spec files.
 * Extracts deliverable metadata and drift summaries for PR templates.
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * Extract deliverable metadata from registry.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<object>} Deliverable metadata
 * @throws {Error} If deliverable not found
 */
async function extractDeliverableMetadata(deliverableId, projectRoot) {
  const registryPath = path.join(
    projectRoot,
    '.dwa',
    'deliverables',
    `${deliverableId}.json`
  );

  if (!await fs.pathExists(registryPath)) {
    throw new Error(
      `Deliverable ${deliverableId} not found.\n` +
      `Expected: ${registryPath}\n` +
      `Run 'dwa parse' to generate registry.`
    );
  }

  const registry = await fs.readJSON(registryPath);

  // Extract acceptance criteria (prefer structured over text)
  const acceptanceCriteria = extractAcceptanceCriteria(registry);

  return {
    deliverable_id: registry.deliverable_id || registry.id || deliverableId,
    user_story: registry.user_story || 'No user story provided.',
    description: registry.description || 'No description provided.',
    acceptance_criteria: acceptanceCriteria,
    qa_plan_notes: registry.qa_notes || registry.qa_plan_notes || '',
    status: registry.status || 'unknown',
    pr_url: registry.pr_url || null,
    linear_url: registry.linear_url || null
  };
}

/**
 * Extract acceptance criteria from deliverable.
 *
 * Prefers structured AC from registry over text splitting.
 *
 * Priority:
 * 1. If acceptance_criteria_grouped (C/F/E/N format) exists → preserve groups
 * 2. If acceptance_criteria is array → use directly
 * 3. If acceptance_criteria is string → split using legacy method
 *
 * @param {object} deliverable - Deliverable registry object
 * @returns {string[]|object} AC array or grouped object
 */
function extractAcceptanceCriteria(deliverable) {
  // Priority 1: Grouped AC (Phase 4 format)
  if (deliverable.acceptance_criteria_grouped) {
    return deliverable.acceptance_criteria_grouped;
  }

  // Priority 2: Array format
  if (Array.isArray(deliverable.acceptance_criteria)) {
    return deliverable.acceptance_criteria;
  }

  // Priority 3: String format (legacy) - split it
  if (typeof deliverable.acceptance_criteria === 'string') {
    return splitAcceptanceCriteria(deliverable.acceptance_criteria);
  }

  // No AC found
  return [];
}

/**
 * Split acceptance criteria string into array (legacy fallback).
 *
 * Handles multiple separator formats:
 * - Semicolons (;)
 * - Newlines (\n)
 * - HTML breaks (<br>)
 *
 * @param {string} acText - Acceptance criteria text
 * @returns {string[]} Array of criteria
 */
function splitAcceptanceCriteria(acText) {
  if (!acText || typeof acText !== 'string') {
    return [];
  }

  // Split by semicolon, newline, or <br> tag
  return acText
    .split(/[;\n]|<br\s*\/?>/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Extract drift summary from deliverable registry.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<object>} Drift summary
 */
async function extractDriftSummary(deliverableId, projectRoot) {
  const registryPath = path.join(
    projectRoot,
    '.dwa',
    'deliverables',
    `${deliverableId}.json`
  );

  if (!await fs.pathExists(registryPath)) {
    // Return empty summary if deliverable doesn't exist
    return {
      hasOpenDrift: false,
      openCount: 0,
      acceptedCount: 0,
      events: []
    };
  }

  const registry = await fs.readJSON(registryPath);
  const driftEvents = registry.drift_events || [];

  if (driftEvents.length === 0) {
    return {
      hasOpenDrift: false,
      openCount: 0,
      acceptedCount: 0,
      events: []
    };
  }

  // Filter to relevant events
  const openEvents = driftEvents.filter(
    e => e.decision === 'pending' || e.decision === 'escalate'
  );
  const acceptedEvents = driftEvents.filter(
    e => e.decision === 'accept'
  );

  // Map events to summary format
  const events = [...openEvents, ...acceptedEvents].map(e => ({
    decision: e.decision,
    summary: e.summary || e.description || 'No summary provided',
    detected_at: e.at || e.detected_at || ''
  }));

  return {
    hasOpenDrift: openEvents.length > 0,
    openCount: openEvents.length,
    acceptedCount: acceptedEvents.length,
    events
  };
}

module.exports = {
  extractDeliverableMetadata,
  extractDriftSummary,
  extractAcceptanceCriteria,
  splitAcceptanceCriteria
};
