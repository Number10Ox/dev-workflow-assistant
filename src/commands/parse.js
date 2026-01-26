/**
 * Parse command - orchestrates spec parsing and registry updates.
 *
 * Flow:
 * 1. Call parseSpec to extract deliverables from feature-spec.md
 * 2. If validation errors, return early with errors (no registry writes)
 * 3. Call updateRegistry to create/update .dwa/deliverables/*.json files
 * 4. Return structured result for VS Code extension consumption
 */

const path = require('path');
const fs = require('fs-extra');
const { parseSpec } = require('../parser/parse-spec');
const { updateRegistry } = require('../parser/registry');
const { hashContent } = require('../utils/hash-content');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Run the parse command.
 *
 * @param {string} specPath - Path to feature-spec.md file
 * @param {string} projectDir - Path to project directory (where .dwa/ lives)
 * @returns {Promise<{success: boolean, summary?: object, errors: array, warnings: array}>}
 */
async function runParse(specPath, projectDir) {
  const result = {
    success: false,
    summary: null,
    errors: [],
    warnings: []
  };

  // Step 1: Parse spec file
  const parseResult = await parseSpec(specPath);

  // Collect any warnings from parsing
  result.warnings.push(...parseResult.warnings);

  // Step 2: Check for validation errors
  if (parseResult.errors.length > 0) {
    result.errors = parseResult.errors;
    return result;
  }

  // Step 3: Update registry
  const registryDir = path.join(projectDir, '.dwa', 'deliverables');

  const registryResult = await updateRegistry(parseResult.deliverables, registryDir);

  // Step 4: Store spec content hash in feature.json for freshness detection
  const featureJsonPath = path.join(projectDir, '.dwa', 'feature.json');
  if (await fs.pathExists(featureJsonPath)) {
    try {
      const specContent = await fs.readFile(specPath, 'utf8');
      const featureJson = await fs.readJson(featureJsonPath);
      featureJson.spec_content_hash = hashContent(specContent);
      featureJson.parsed_at = new Date().toISOString();
      await writeJsonWithSchema(featureJsonPath, featureJson);
    } catch {
      // Non-fatal: freshness detection will fall back to mtime
    }
  }

  // Step 5: Build success result
  result.success = true;
  result.summary = {
    parsed: parseResult.deliverables.length,
    created: registryResult.created,
    updated: registryResult.updated,
    unchanged: registryResult.unchanged,
    orphaned: registryResult.orphaned
  };

  return result;
}

module.exports = {
  runParse
};
