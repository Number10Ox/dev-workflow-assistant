/**
 * Generate execution packet shell from registry + spec + TDD data.
 *
 * Main orchestrator for packet generation:
 * 1. Load deliverable from registry
 * 2. Load feature.json for spec_path and tdd_path
 * 3. Fetch constraints from TDD guardrails
 * 4. Fetch drift data from registry
 * 5. Compute provenance (git SHAs, versions)
 * 6. Categorize acceptance criteria
 * 7. Render Handlebars template
 * 8. Check size and split if needed
 * 9. Write packet atomically
 */

const path = require('path');
const fs = require('fs-extra');
const Handlebars = require('handlebars');
const writeFileAtomic = require('write-file-atomic');

const { fetchTDDConstraints } = require('./fetch-constraints');
const { fetchDriftData } = require('./fetch-drift');
const { computeProvenance } = require('./compute-provenance');
const { checkSizeAndSplit, countWords } = require('./size-checker');

// Register Handlebars helper for 1-based indexing
Handlebars.registerHelper('add', function(a, b) {
  return a + b;
});

/**
 * Generate an execution packet for a deliverable.
 *
 * @param {string} deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{
 *   packetPath: string,
 *   appendixPath: string|null,
 *   wordCount: number,
 *   error?: {code: string, message: string}
 * }>}
 */
async function generatePacketShell(deliverableId, projectRoot) {
  // 1. Load deliverable from registry
  const registryPath = path.join(projectRoot, '.dwa', 'deliverables', `${deliverableId}.json`);

  if (!await fs.pathExists(registryPath)) {
    return {
      error: {
        code: 'DWA-E041',
        message: `Deliverable ${deliverableId} not found in registry. Run parse first.`
      }
    };
  }

  const registry = await fs.readJSON(registryPath);

  // 2. Load feature.json
  const featureJsonPath = path.join(projectRoot, '.dwa', 'feature.json');

  if (!await fs.pathExists(featureJsonPath)) {
    return {
      error: {
        code: 'DWA-E040',
        message: 'No feature.json found. Run create-spec first.'
      }
    };
  }

  const featureJson = await fs.readJSON(featureJsonPath);

  // 3. Fetch constraints from TDD
  let constraints = { must: [], must_not: [] };
  if (featureJson.tdd_path) {
    const tddPath = path.join(projectRoot, featureJson.tdd_path);
    constraints = await fetchTDDConstraints(tddPath);
  }

  // 4. Fetch drift data
  const drift = await fetchDriftData(registry, featureJson, projectRoot);

  // 5. Compute provenance
  const provenance = await computeProvenance(
    projectRoot,
    featureJson.spec_path,
    featureJson.tdd_path
  );

  // 6. Categorize acceptance criteria
  const acceptanceCriteria = categorizeAcceptanceCriteria(registry.acceptance_criteria || '');

  // 7. Parse dependencies
  const dependencies = parseDependencies(registry.dependencies);

  // 8. Build template data
  const templateData = {
    deliverable_id: deliverableId,
    short_name: extractShortName(registry.description || registry.user_story),
    generated_at: new Date().toISOString(),
    word_count: 0, // Will be updated after rendering
    staleness_warning: buildStalenessWarning(drift),
    constraints,
    goal: registry.description || 'No description provided.',
    user_story: registry.user_story || 'No user story provided.',
    acceptance_criteria: acceptanceCriteria,
    qa_notes: registry.qa_notes || 'No QA notes provided.',
    dependencies,
    provenance,
    drift,
    appendix_path: null
  };

  // 9. Load and render template
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'packet-v1.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);

  let renderedContent = template(templateData);

  // 10. Check size and split if needed
  const sizeResult = await checkSizeAndSplit(renderedContent, deliverableId);

  // Update word count in frontmatter
  renderedContent = sizeResult.finalContent.replace(
    /word_count: \d+/,
    `word_count: ${sizeResult.wordCount}`
  );

  // 11. Write packet atomically
  const packetsDir = path.join(projectRoot, '.dwa', 'packets');
  await fs.ensureDir(packetsDir);

  const packetPath = path.join(packetsDir, `${deliverableId}.md`);
  await writeFileAtomic(packetPath, renderedContent, { encoding: 'utf8' });

  // 12. Write appendix if needed
  let appendixPath = null;
  if (sizeResult.appendixContent) {
    const appendicesDir = path.join(packetsDir, 'appendices');
    await fs.ensureDir(appendicesDir);
    appendixPath = path.join(appendicesDir, `${deliverableId}-appendix.md`);
    await writeFileAtomic(appendixPath, sizeResult.appendixContent, { encoding: 'utf8' });
  }

  return {
    packetPath,
    appendixPath,
    wordCount: sizeResult.wordCount
  };
}

/**
 * Categorize acceptance criteria by prefix.
 *
 * Prefixes:
 * - C# = Critical
 * - F# = Functional
 * - N# = Nice-to-have
 * - E# = Edge cases
 *
 * @param {string} acString - Acceptance criteria string from registry
 * @returns {{critical: string[], functional: string[], nice_to_have: string[], edge: string[]}}
 */
function categorizeAcceptanceCriteria(acString) {
  const result = {
    critical: [],
    functional: [],
    nice_to_have: [],
    edge: []
  };

  if (!acString) {
    return result;
  }

  // Split by common delimiters (period, semicolon, newline)
  const items = acString
    .split(/[.;\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const item of items) {
    // Check for prefix pattern: C1:, F1:, N1:, E1:, etc.
    const prefixMatch = item.match(/^([CFNE])(\d+):\s*(.+)$/i);

    if (prefixMatch) {
      const prefix = prefixMatch[1].toUpperCase();
      const text = prefixMatch[3];

      switch (prefix) {
        case 'C':
          result.critical.push(text);
          break;
        case 'F':
          result.functional.push(text);
          break;
        case 'N':
          result.nice_to_have.push(text);
          break;
        case 'E':
          result.edge.push(text);
          break;
      }
    } else {
      // No prefix - default to functional
      result.functional.push(item);
    }
  }

  return result;
}

/**
 * Parse dependencies string into array.
 *
 * @param {string} depsString - Dependencies string (e.g., "DEL-001, DEL-002")
 * @returns {string[]} Array of dependency IDs
 */
function parseDependencies(depsString) {
  if (!depsString || depsString.trim() === '') {
    return [];
  }

  return depsString
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(s => s.startsWith('DEL-'));
}

/**
 * Extract a short name from description or user story.
 *
 * @param {string} text - Description or user story text
 * @returns {string} Short name (first 5 words)
 */
function extractShortName(text) {
  if (!text) {
    return 'Untitled';
  }

  const words = text.split(/\s+/).slice(0, 5);
  return words.join(' ');
}

/**
 * Build staleness warning if sources changed.
 *
 * @param {object} drift - Drift data with source_freshness
 * @returns {string|null} Warning message or null
 */
function buildStalenessWarning(drift) {
  const warnings = [];

  if (drift.source_freshness.spec_changed) {
    warnings.push('Spec file modified since last packet');
  }
  if (drift.source_freshness.tdd_changed) {
    warnings.push('TDD file modified since last packet');
  }

  return warnings.length > 0 ? warnings.join('. ') + '.' : null;
}

module.exports = {
  generatePacketShell,
  categorizeAcceptanceCriteria,
  parseDependencies
};
