const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { writeJsonWithSchema } = require('../utils/schema');

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

  return { specPath, featureJsonPath };
}

module.exports = { scaffoldFromTemplate };
