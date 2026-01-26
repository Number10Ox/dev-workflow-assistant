/**
 * Interactive setup wizard for optional DWA features.
 *
 * Usage:
 *   dwa setup              # Interactive wizard
 *   dwa setup --linear     # Set up Linear only
 *   dwa setup --google-docs # Set up Google Docs only
 */

const { execSync } = require('child_process');
const { FEATURES } = require('../utils/feature-detection');

/**
 * Check if VS Code CLI is available.
 */
function isVSCodeAvailable() {
  try {
    execSync('code --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a VS Code extension.
 *
 * @param {string} extensionId - Extension ID
 * @returns {{ success: boolean, message: string }}
 */
function installExtension(extensionId) {
  try {
    execSync(`code --install-extension ${extensionId}`, { stdio: 'inherit' });
    return { success: true, message: `Installed ${extensionId}` };
  } catch (error) {
    return {
      success: false,
      message: `Failed to install ${extensionId}: ${error.message}`
    };
  }
}

/**
 * Run interactive setup wizard.
 *
 * @param {object} options - Setup options
 * @param {boolean} options.linear - Set up Linear only
 * @param {boolean} options.googleDocs - Set up Google Docs only
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function setup(options = {}) {
  // Check if specific feature requested
  if (options.linear) {
    return setupLinear();
  }
  if (options.googleDocs) {
    return setupGoogleDocs();
  }

  // Interactive wizard
  const { MultiSelect } = require('enquirer');

  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│           DWA Setup Wizard                      │');
  console.log('└─────────────────────────────────────────────────┘\n');

  // Check VS Code availability
  if (!isVSCodeAvailable()) {
    console.log('Note: VS Code CLI not found. Extensions must be installed manually.\n');
  }

  const prompt = new MultiSelect({
    name: 'features',
    message: 'What features do you want to enable?',
    choices: [
      {
        name: 'core',
        message: 'Core workflow (scaffold, parse, packets)',
        value: 'core',
        enabled: true,
        hint: 'always included'
      },
      {
        name: 'linear',
        message: 'Linear integration (sync deliverables to tickets)',
        value: 'linear'
      },
      {
        name: 'googleDocs',
        message: 'Google Docs import (import specs from Docs)',
        value: 'googleDocs'
      }
    ]
  });

  let selected;
  try {
    selected = await prompt.run();
  } catch (err) {
    // User cancelled
    return { success: false, message: 'Setup cancelled.' };
  }

  const results = [];

  // Core is always set up (it's just confirming install is complete)
  console.log('\n✓ Core workflow ready\n');

  // Set up selected features
  if (selected.includes('linear')) {
    const result = await setupLinear();
    results.push(result);
  }

  if (selected.includes('googleDocs')) {
    const result = await setupGoogleDocs();
    results.push(result);
  }

  // Summary
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    return {
      success: false,
      message: `Setup completed with ${failures.length} issue(s). Run 'dwa status' to check.`
    };
  }

  return {
    success: true,
    message: 'Setup complete! Run \'dwa status\' to verify configuration.'
  };
}

/**
 * Set up Linear integration.
 */
async function setupLinear() {
  console.log('Setting up Linear integration...\n');

  if (!isVSCodeAvailable()) {
    console.log(FEATURES.linear.setupInstructions);
    return {
      success: false,
      message: 'VS Code CLI not available. Install extension manually.'
    };
  }

  const extensionId = 'jedwards.linear-tracker-provider';
  const result = installExtension(extensionId);

  if (result.success) {
    console.log('✓ Linear extension installed');
    console.log('\nNext step: Configure your Linear API key in VS Code settings:');
    console.log('  Settings → Extensions → Linear Tracker → API Key\n');
  }

  return result;
}

/**
 * Set up Google Docs integration.
 */
async function setupGoogleDocs() {
  console.log('Setting up Google Docs integration...\n');

  if (!isVSCodeAvailable()) {
    console.log(FEATURES.googleDocs.setupInstructions);
    return {
      success: false,
      message: 'VS Code CLI not available. Install extension manually.'
    };
  }

  const extensionId = 'jedwards.gworkspace-provider';
  const result = installExtension(extensionId);

  if (result.success) {
    console.log('✓ Google Workspace extension installed');
    console.log('\nNext step: Authenticate via the extension:');
    console.log('  Command Palette → "Google Workspace: Sign In"\n');
  }

  return result;
}

module.exports = {
  setup,
  setupLinear,
  setupGoogleDocs,
  isVSCodeAvailable,
  installExtension
};
