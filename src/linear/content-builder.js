/**
 * Builds and manipulates the DWA-owned section of Linear issue descriptions.
 *
 * The DWA section is wrapped in markers:
 * <!-- DWA:BEGIN -->
 * ... DWA content ...
 * <!-- DWA:END -->
 *
 * Content outside markers is human-owned and never modified by DWA.
 */

const { computeSyncHash } = require('./fingerprint');

const DWA_BEGIN_MARKER = '<!-- DWA:BEGIN -->';
const DWA_END_MARKER = '<!-- DWA:END -->';
const DWA_SCHEMA_VERSION = '1.0.0';

/**
 * Format acceptance criteria in grouped checklist format.
 * Groups by prefix: C=Critical, F=Functional, E=Edge, N=Nice-to-have
 *
 * @param {string} acRaw - Raw acceptance criteria string (semicolon or newline separated)
 * @returns {string} Formatted markdown with grouped checklists
 */
function formatAcceptanceCriteria(acRaw) {
  if (!acRaw) return '_No acceptance criteria defined_';

  // Split by common delimiters
  const items = acRaw
    .split(/[;\n]|<br\s*\/?>/)
    .map(s => s.trim())
    .filter(Boolean);

  if (items.length === 0) return '_No acceptance criteria defined_';

  // Group by prefix
  const groups = {
    C: { name: 'Critical', items: [] },
    F: { name: 'Functional', items: [] },
    E: { name: 'Edge Cases', items: [] },
    N: { name: 'Nice-to-have', items: [] },
    other: { name: 'Other', items: [] }
  };

  for (const item of items) {
    const match = item.match(/^([CFEN])\d+[:\s]/i);
    if (match) {
      const prefix = match[1].toUpperCase();
      groups[prefix].items.push(item);
    } else {
      groups.other.items.push(item);
    }
  }

  // Render groups that have items
  const sections = [];
  for (const [key, group] of Object.entries(groups)) {
    if (group.items.length > 0) {
      sections.push(`### ${group.name}\n${group.items.map(i => `- [ ] ${i}`).join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Build the DWA-owned section content for a Linear issue.
 *
 * @param {object} deliverable - Deliverable from registry
 * @param {object} options - Build options
 * @param {string} options.specPath - Path to spec file
 * @param {string} [options.tddPath] - Path to TDD file
 * @param {string} [options.repoUrl] - Repository URL for links
 * @returns {string} DWA section markdown with BEGIN/END markers
 */
function buildDwaSection(deliverable, options = {}) {
  const { specPath, tddPath, repoUrl } = options;

  const parts = [];

  // Metadata block
  parts.push(`**DWA Deliverable:** ${deliverable.id}`);
  parts.push(`**Schema Version:** ${DWA_SCHEMA_VERSION}`);

  if (specPath) {
    const specLink = repoUrl ? `[${specPath}](${repoUrl}/${specPath})` : specPath;
    parts.push(`**Spec:** ${specLink}`);
  }

  if (tddPath) {
    const tddLink = repoUrl ? `[${tddPath}](${repoUrl}/${tddPath})` : tddPath;
    parts.push(`**TDD:** ${tddLink}`);
  }

  parts.push('');

  // User story
  if (deliverable.user_story) {
    parts.push('## User Story');
    parts.push(deliverable.user_story);
    parts.push('');
  }

  // Description/Summary
  if (deliverable.description) {
    parts.push('## Summary');
    parts.push(deliverable.description);
    parts.push('');
  }

  // Acceptance Criteria (grouped format)
  parts.push('## Acceptance Criteria');
  parts.push('');
  parts.push(formatAcceptanceCriteria(deliverable.acceptance_criteria));
  parts.push('');

  // QA Verification
  if (deliverable.qa_notes) {
    parts.push('## QA Verification');
    parts.push(deliverable.qa_notes);
    parts.push('');
  }

  // Dependencies
  if (deliverable.dependencies && deliverable.dependencies.trim()) {
    parts.push('## Dependencies');
    parts.push(deliverable.dependencies);
    parts.push('');
  }

  // Build the wrapped content with a placeholder hash line, then compute the
  // hash over the same shape that `sync.js` and `checkForManualEdits` will see
  // (with markers, with hash line stripped). All three hash computations must
  // agree to keep idempotent re-sync working — see fingerprint.js.
  const placeholder = `**Sync Hash:** \`${'0'.repeat(64)}\``;
  parts.push(placeholder);

  let dwaContent = `${DWA_BEGIN_MARKER}\n${parts.join('\n').trim()}\n${DWA_END_MARKER}`;

  const contentForHash = dwaContent
    .replace(/\*\*Sync Hash:\*\*\s*`[a-f0-9]{64}`/i, '')
    .trim();
  const syncHash = computeSyncHash(contentForHash);

  dwaContent = dwaContent.replace(placeholder, `**Sync Hash:** \`${syncHash}\``);

  return dwaContent;
}

/**
 * Extract the DWA section from an issue description.
 *
 * @param {string} body - Full issue description
 * @returns {{ content: string, startIndex: number, endIndex: number } | null}
 */
function extractDwaSection(body) {
  if (!body) return null;

  const beginIdx = body.indexOf(DWA_BEGIN_MARKER);
  const endIdx = body.indexOf(DWA_END_MARKER);

  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
    return null;
  }

  return {
    content: body.slice(beginIdx, endIdx + DWA_END_MARKER.length),
    startIndex: beginIdx,
    endIndex: endIdx + DWA_END_MARKER.length
  };
}

/**
 * Update the DWA section in an existing issue body.
 * Preserves content outside the markers.
 *
 * @param {string} existingBody - Current issue description
 * @param {string} newDwaContent - New DWA section (with markers)
 * @returns {string} Updated body
 */
function updateDwaSection(existingBody, newDwaContent) {
  const existing = extractDwaSection(existingBody);

  if (!existing) {
    // No existing DWA section, append
    return existingBody ? `${existingBody}\n\n${newDwaContent}` : newDwaContent;
  }

  // Replace DWA section, preserve content outside markers
  const before = existingBody.slice(0, existing.startIndex);
  const after = existingBody.slice(existing.endIndex);

  return `${before}${newDwaContent}${after}`;
}

module.exports = {
  buildDwaSection,
  extractDwaSection,
  updateDwaSection,
  formatAcceptanceCriteria,
  DWA_BEGIN_MARKER,
  DWA_END_MARKER,
  DWA_SCHEMA_VERSION
};
