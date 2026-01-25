/**
 * Rebuild drift log command - generates .dwa/drift-log.md from registry events.
 *
 * Wrapper for VS Code extension consumption with structured result format.
 *
 * Part of Phase 5: Drift Tracking infrastructure.
 */

const { rebuildDriftLog } = require('../drift/rebuild-log');

/**
 * Run the rebuild drift log command.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{
 *   success: boolean,
 *   openDrift: number,
 *   totalEvents: number,
 *   logPath: string|null,
 *   errors: Array<{code: string, message: string}>
 * }>}
 */
async function runRebuildDriftLog(projectRoot) {
  const result = {
    success: false,
    openDrift: 0,
    totalEvents: 0,
    logPath: null,
    errors: []
  };

  try {
    const rebuildResult = await rebuildDriftLog(projectRoot);

    result.success = true;
    result.openDrift = rebuildResult.openDrift;
    result.totalEvents = rebuildResult.totalEvents;
    result.logPath = rebuildResult.logPath;
  } catch (error) {
    // Extract error code if present (DWA-Exxx format)
    const codeMatch = error.message.match(/^(DWA-E\d{3})/);
    const code = codeMatch ? codeMatch[1] : 'DWA-E099';

    result.errors.push({
      code,
      message: error.message
    });
  }

  return result;
}

module.exports = {
  runRebuildDriftLog
};
