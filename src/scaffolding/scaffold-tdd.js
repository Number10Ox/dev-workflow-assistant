const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('node:path');
const matter = require('gray-matter');
const { execSync } = require('node:child_process');
const writeFileAtomic = require('write-file-atomic');
const { writeJsonWithSchema } = require('../utils/schema');

function getGitUser() {
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return 'Unknown';
  }
}

/**
 * Scaffold a TDD from template, linked to existing feature spec.
 *
 * @param {string} featureId - Feature ID from spec (e.g., FEAT-2026-123)
 * @param {string} featureTitle - Feature title from spec
 * @param {string} specPath - Path to spec relative to targetDir (e.g., 'feature-spec.md')
 * @param {string} targetDir - Project root directory
 * @returns {Promise<string>} - Relative path to created TDD
 */
async function scaffoldTDD(featureId, featureTitle, specPath, targetDir) {
  // 1. Ensure docs/tdds/ directory exists
  const tddsDir = path.join(targetDir, 'docs', 'tdds');
  await fs.ensureDir(tddsDir);

  // 2. Generate TDD filename from feature title
  const slug = featureTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tddFilename = `${slug}-tdd.md`;
  const tddPath = path.join(tddsDir, tddFilename);

  // 3. Load and compile template
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'tdd-v1.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);

  // 4. Calculate relative path from TDD to spec
  const relativeSpecPath = path.relative(path.dirname(tddPath), path.join(targetDir, specPath));

  // 5. Render template
  const createdDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const rendered = template({
    feature_id: featureId,
    title: featureTitle,
    spec_path: relativeSpecPath,
    created_date: createdDate,
    owner: getGitUser()
  });

  // 6. Verify no placeholder leakage
  if (/\{\{[^}]+\}\}/.test(rendered)) {
    throw new Error('TDD template rendering incomplete: unreplaced placeholders remain');
  }

  // 7. Write TDD file atomically
  await writeFileAtomic(tddPath, rendered, { encoding: 'utf8' });

  // 8. Calculate relative path from project root
  const relativeTddPath = path.relative(targetDir, tddPath);

  // 9. Update feature.json with tdd_path
  const featureJsonPath = path.join(targetDir, '.dwa', 'feature.json');
  if (await fs.pathExists(featureJsonPath)) {
    const featureJson = await fs.readJson(featureJsonPath);
    featureJson.tdd_path = relativeTddPath;
    // Preserve schemaVersion from existing file
    const { schemaVersion, ...rest } = featureJson;
    await writeJsonWithSchema(featureJsonPath, rest);
  }

  // 10. Update spec frontmatter with tdd_path
  const fullSpecPath = path.join(targetDir, specPath);
  if (await fs.pathExists(fullSpecPath)) {
    const specContent = await fs.readFile(fullSpecPath, 'utf8');
    const { data, content } = matter(specContent);
    data.tdd_path = relativeTddPath;
    const updated = matter.stringify(content, data);
    await writeFileAtomic(fullSpecPath, updated, { encoding: 'utf8' });
  }

  return relativeTddPath;
}

module.exports = { scaffoldTDD };
