const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { writeJsonWithSchema } = require('../utils/schema');

/**
 * Check if .gitignore already contains a .dwa entry.
 * Handles variations: .dwa, .dwa/, .dwa/*, .dwa/**, with optional leading ./
 * Ignores whitespace and inline comments.
 *
 * @param {string} content - gitignore file content
 * @returns {boolean} true if .dwa entry exists
 */
function hasDwaEntry(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    // Remove inline comments and trim whitespace
    const trimmed = line.split('#')[0].trim();
    // Match .dwa with optional leading ./ and trailing / or globs
    if (/^\.?\/?\.dwa(\/\*{0,2})?$/.test(trimmed)) {
      return true;
    }
  }
  return false;
}

/**
 * Ensure .gitignore contains .dwa/ entry.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{action: 'exists'|'appended'|'created', path: string}>}
 */
async function ensureGitignore(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const dwaEntry = '.dwa/';

  if (await fs.pathExists(gitignorePath)) {
    const content = await fs.readFile(gitignorePath, 'utf8');

    if (hasDwaEntry(content)) {
      return { action: 'exists', path: gitignorePath };
    }

    // Append with comment and newline handling
    const prefix = content.endsWith('\n') ? '' : '\n';
    await fs.appendFile(gitignorePath, `${prefix}\n# DWA state (regenerated from source files)\n${dwaEntry}\n`);
    return { action: 'appended', path: gitignorePath };
  } else {
    // Create minimal .gitignore
    await fs.writeFile(gitignorePath, `# DWA state (regenerated from source files)\n${dwaEntry}\n`);
    return { action: 'created', path: gitignorePath };
  }
}

function getGitUser() {
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return 'Unknown';
  }
}

function generateFeatureId() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100); // 100-999
  return `FEAT-${year}-${seq}`;
}

async function scaffoldFromTemplate(featureTitle, targetDir) {
  // 1. Load template from package templates/ directory
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'feature-spec-v2.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');

  // 2. Generate feature ID
  const featureId = generateFeatureId();

  // 3. Compile and render
  const template = Handlebars.compile(templateContent);
  const rendered = template({
    title: featureTitle,
    feature_id: featureId,
    owner: getGitUser()
  });

  // 4. Verify no unreplaced placeholders remain
  if (/\{\{[^}]+\}\}/.test(rendered)) {
    throw new Error('Template rendering incomplete: unreplaced placeholders remain');
  }

  // 5. Write feature-spec.md atomically
  const specPath = path.join(targetDir, 'feature-spec.md');
  const writeFileAtomic = require('write-file-atomic');
  await writeFileAtomic(specPath, rendered, { encoding: 'utf8' });

  // 6. Create .dwa/ directory and feature.json
  const dwaDir = path.join(targetDir, '.dwa');
  await fs.ensureDir(dwaDir);

  const featureJsonPath = path.join(dwaDir, 'feature.json');
  await writeJsonWithSchema(featureJsonPath, {
    feature_id: featureId,
    title: featureTitle,
    spec_path: 'feature-spec.md',
    tdd_path: null,
    created_at: new Date().toISOString()
  });

  // 7. Ensure .gitignore contains .dwa/ entry
  const gitignoreResult = await ensureGitignore(targetDir);

  return { specPath, featureJsonPath, gitignoreResult };
}

module.exports = { scaffoldFromTemplate, hasDwaEntry, ensureGitignore };
