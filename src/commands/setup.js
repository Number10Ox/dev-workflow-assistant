/**
 * Interactive setup wizard for optional DWA features.
 *
 * Usage:
 *   dwa setup              # Interactive wizard
 *   dwa setup --linear     # Set up Linear only
 *   dwa setup --google-docs # Set up Google Docs only
 */

const { execSync } = require('child_process');
const https = require('https');
const { FEATURES } = require('../utils/feature-detection');

// GitHub repo for VS Code extensions
const GITHUB_REPO = 'Number10Ox/devex-service-bridge';

// Extension configurations
const EXTENSIONS = {
  linear: {
    id: 'jedwards.linear-tracker-provider',
    vsixPattern: /linear-tracker.*\.vsix$/i,
    name: 'Linear Tracker'
  },
  googleDocs: {
    id: 'jedwards.gworkspace-provider',
    vsixPattern: /gworkspace.*\.vsix$/i,
    name: 'Google Workspace'
  }
};

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
 * Check if a VS Code extension is installed.
 *
 * @param {string} extensionId - Extension ID
 * @returns {boolean}
 */
function isExtensionInstalled(extensionId) {
  try {
    const output = execSync('code --list-extensions', { encoding: 'utf8' });
    return output.toLowerCase().includes(extensionId.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Fetch JSON from a URL.
 *
 * @param {string} url - URL to fetch
 * @returns {Promise<object>}
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': 'dwa-setup' }
    };

    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Get the latest release from GitHub and find VSIX asset.
 *
 * @param {RegExp} vsixPattern - Pattern to match VSIX filename
 * @returns {Promise<{version: string, downloadUrl: string}|null>}
 */
async function getLatestVsixRelease(vsixPattern) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    const release = await fetchJson(url);

    // Find VSIX asset matching pattern
    const asset = release.assets?.find(a => vsixPattern.test(a.name));
    if (!asset) {
      return null;
    }

    return {
      version: release.tag_name,
      downloadUrl: asset.browser_download_url
    };
  } catch (error) {
    return null;
  }
}

/**
 * Install a VS Code extension from a URL.
 *
 * @param {string} url - URL to VSIX file
 * @returns {{ success: boolean, message: string }}
 */
function installExtensionFromUrl(url) {
  try {
    execSync(`code --install-extension "${url}"`, { stdio: 'inherit' });
    return { success: true, message: `Installed from ${url}` };
  } catch (error) {
    return {
      success: false,
      message: `Failed to install: ${error.message}`
    };
  }
}

/**
 * Install extension - tries GitHub release first, falls back to marketplace.
 *
 * @param {object} extConfig - Extension configuration
 * @returns {Promise<{ success: boolean, alreadyInstalled: boolean, message: string, version?: string }>}
 */
async function installExtension(extConfig) {
  // Check if already installed
  if (isExtensionInstalled(extConfig.id)) {
    return { success: true, alreadyInstalled: true, message: `${extConfig.name} already installed` };
  }

  // Try to get latest release from GitHub
  console.log(`  Checking for ${extConfig.name} release...`);
  const release = await getLatestVsixRelease(extConfig.vsixPattern);

  if (release) {
    console.log(`  Found ${release.version}, downloading...`);
    const result = installExtensionFromUrl(release.downloadUrl);
    return {
      ...result,
      alreadyInstalled: false,
      version: release.version
    };
  }

  // No GitHub release found
  return {
    success: false,
    alreadyInstalled: false,
    message: `No release found at github.com/${GITHUB_REPO}. Publish a release with VSIX assets.`
  };
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

  const result = await installExtension(EXTENSIONS.linear);

  if (result.success) {
    if (result.alreadyInstalled) {
      console.log('✓ Linear extension already installed\n');
    } else {
      console.log(`✓ Linear extension installed (${result.version})\n`);
    }
  } else {
    console.log(`✗ ${result.message}\n`);
    return result;
  }

  // Always show next steps
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│  NEXT STEPS - Linear Configuration              │');
  console.log('└─────────────────────────────────────────────────┘\n');
  console.log('1. Get your Linear API key:');
  console.log('   → Go to: https://linear.app/settings/api');
  console.log('   → Click "Create key" and copy it\n');
  console.log('2. Configure the extension in VS Code:');
  console.log('   → Open Settings (Cmd/Ctrl + ,)');
  console.log('   → Search for "Linear Tracker"');
  console.log('   → Paste your API key in the "Api Key" field\n');
  console.log('3. Get your Linear project ID:');
  console.log('   → Open your project in Linear');
  console.log('   → Copy the ID from URL: linear.app/team/project/<project-id>\n');
  console.log('4. Sync deliverables:');
  console.log('   → npx dwa --sync-linear --project <project-id>\n');

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

  const result = await installExtension(EXTENSIONS.googleDocs);

  if (result.success) {
    if (result.alreadyInstalled) {
      console.log('✓ Google Workspace extension already installed\n');
    } else {
      console.log(`✓ Google Workspace extension installed (${result.version})\n`);
    }
  } else {
    console.log(`✗ ${result.message}\n`);
    return result;
  }

  // Always show next steps
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│  NEXT STEPS - Google Docs Configuration         │');
  console.log('└─────────────────────────────────────────────────┘\n');
  console.log('1. Authenticate with Google in VS Code:');
  console.log('   → Open Command Palette (Cmd/Ctrl + Shift + P)');
  console.log('   → Type "Google Workspace: Sign In"');
  console.log('   → Complete OAuth flow in your browser\n');
  console.log('2. Import a Google Doc as your feature spec:');
  console.log('   → npx dwa --import-gdoc "https://docs.google.com/document/d/..."\n');
  console.log('Note: The imported spec will include DWA markers for');
  console.log('      change detection on future re-imports.\n');

  return result;
}

module.exports = {
  setup,
  setupLinear,
  setupGoogleDocs,
  isVSCodeAvailable,
  isExtensionInstalled,
  installExtension,
  getLatestVsixRelease,
  EXTENSIONS,
  GITHUB_REPO
};
