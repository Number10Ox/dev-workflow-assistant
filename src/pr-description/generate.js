/**
 * PR description generator.
 *
 * Generates narrative PR descriptions from deliverable metadata using
 * template-based rendering. Read-only operation - never modifies registry.
 */

const fs = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');
const writeFileAtomic = require('write-file-atomic');

const {
  extractDeliverableMetadata,
  extractDriftSummary
} = require('./metadata-extract');

/**
 * Generate PR description from deliverable metadata.
 *
 * @param {object} options - Generation options
 * @param {string} options.deliverableId - Deliverable ID (e.g., DEL-001)
 * @param {string} options.projectRoot - Project root directory
 * @param {string} options.output - Output mode: 'clipboard' | 'file' | 'stdout'
 * @returns {Promise<{success: boolean, message: string, content: string, outputPath?: string}>}
 */
async function generatePRDescription(options) {
  const {
    deliverableId,
    projectRoot,
    output = 'clipboard'
  } = options;

  try {
    // 1. Extract deliverable metadata
    const metadata = await extractDeliverableMetadata(deliverableId, projectRoot);

    // 2. Extract drift summary
    const drift = await extractDriftSummary(deliverableId, projectRoot);

    // 3. Load and compile template
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'pr-description-v1.hbs');
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);

    // 4. Prepare template data
    const templateData = {
      deliverable_id: metadata.deliverable_id,
      linear_url: metadata.linear_url,
      user_story: metadata.user_story,
      description: metadata.description,
      acceptance_criteria: Array.isArray(metadata.acceptance_criteria)
        ? metadata.acceptance_criteria
        : [],
      acceptance_criteria_grouped: typeof metadata.acceptance_criteria === 'object' &&
                                     !Array.isArray(metadata.acceptance_criteria)
        ? metadata.acceptance_criteria
        : null,
      qa_plan_notes: metadata.qa_plan_notes,
      drift: {
        ...drift,
        deliverable_id: metadata.deliverable_id // Make deliverable_id accessible in drift context
      },
      generated_at: new Date().toISOString()
    };

    // 5. Render template
    const content = template(templateData);

    // 6. Output based on mode
    let result;
    switch (output) {
      case 'clipboard':
        result = await outputToClipboard(content, deliverableId, projectRoot);
        break;
      case 'file':
        result = await outputToFile(content, deliverableId, projectRoot);
        break;
      case 'stdout':
        result = {
          success: true,
          message: 'PR description generated successfully',
          content
        };
        break;
      default:
        throw new Error(`Invalid output mode: ${output}`);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: error.message,
      content: ''
    };
  }
}

/**
 * Write content to clipboard.
 *
 * Prefers VS Code API when available, falls back to clipboardy CLI.
 * If clipboard fails, falls back to file output.
 *
 * @param {string} content - Content to write
 * @param {string} deliverableId - Deliverable ID
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<object>} Result object
 */
async function outputToClipboard(content, deliverableId, projectRoot) {
  // Try VS Code API first (more reliable when in extension context)
  try {
    const vscode = require('vscode');
    if (vscode && vscode.env && vscode.env.clipboard) {
      await vscode.env.clipboard.writeText(content);
      return {
        success: true,
        message: 'PR description copied to clipboard',
        content
      };
    }
  } catch (err) {
    // VS Code not available, fall through to clipboardy
  }

  // Try clipboardy (CLI mode)
  try {
    const clipboardy = require('clipboardy');
    await clipboardy.write(content);
    return {
      success: true,
      message: 'PR description copied to clipboard',
      content
    };
  } catch (err) {
    // Clipboard failed, fall back to file
    const fileResult = await outputToFile(content, deliverableId, projectRoot);
    return {
      ...fileResult,
      message: `Clipboard unavailable. ${fileResult.message}`
    };
  }
}

/**
 * Write content to file.
 *
 * @param {string} content - Content to write
 * @param {string} deliverableId - Deliverable ID
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<object>} Result object
 */
async function outputToFile(content, deliverableId, projectRoot) {
  const prDescDir = path.join(projectRoot, '.dwa', 'pr-descriptions');
  await fs.ensureDir(prDescDir);

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const outputPath = path.join(prDescDir, `${deliverableId}-${timestamp}.md`);

  await writeFileAtomic(outputPath, content, { encoding: 'utf8' });

  return {
    success: true,
    message: `PR description saved to: ${outputPath}`,
    content,
    outputPath
  };
}

module.exports = {
  generatePRDescription
};
