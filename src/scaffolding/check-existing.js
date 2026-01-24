const fs = require('fs-extra');
const path = require('node:path');

async function checkExisting(targetDir) {
  const featureJsonPath = path.join(targetDir, '.dwa', 'feature.json');
  const specPath = path.join(targetDir, 'feature-spec.md');

  const featureJsonExists = await fs.pathExists(featureJsonPath);
  const specExists = await fs.pathExists(specPath);

  return {
    alreadyInitialized: featureJsonExists || specExists,
    files: {
      featureJson: featureJsonExists,
      spec: specExists
    }
  };
}

module.exports = { checkExisting };
