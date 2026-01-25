/**
 * CLI command: Sync deliverables to Linear.
 *
 * Usage:
 *   dwa --sync-linear [options]
 *
 * Options:
 *   --dry-run         Show what would be synced without making changes
 *   --force           Overwrite DWA sections even if manually edited
 *   --deliverables    Comma-separated list of deliverable IDs to sync
 *   --project         Linear project ID or URL for grouping
 */

const fs = require('fs-extra');
const path = require('path');
const { syncAllDeliverables, SyncAction } = require('../linear/sync');

/**
 * Format sync results for display.
 *
 * @param {object[]} results - Sync results
 * @param {object} summary - Summary counts
 * @returns {string} Formatted output
 */
function formatResults(results, summary) {
  const lines = [];

  lines.push('');
  lines.push('=== Linear Sync Results ===');
  lines.push('');

  // Group by action
  const created = results.filter(r => r.action === SyncAction.CREATE && r.success);
  const updated = results.filter(r => r.action === SyncAction.UPDATE && r.success);
  const skipped = results.filter(r => r.action === SyncAction.SKIP_UNCHANGED);
  const conflicts = results.filter(r => r.action === SyncAction.SKIP_CONFLICT);
  const failed = results.filter(r => !r.success);

  if (created.length > 0) {
    lines.push('CREATED:');
    for (const r of created) {
      lines.push(`  + ${r.deliverableId} -> ${r.issue?.identifier || 'created'} (${r.issue?.url || 'no url'})`);
    }
    lines.push('');
  }

  if (updated.length > 0) {
    lines.push('UPDATED:');
    for (const r of updated) {
      lines.push(`  ~ ${r.deliverableId} -> ${r.issue?.identifier || 'updated'}`);
    }
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push('UNCHANGED (skipped):');
    for (const r of skipped) {
      lines.push(`  - ${r.deliverableId}`);
    }
    lines.push('');
  }

  if (conflicts.length > 0) {
    lines.push('CONFLICTS (skipped - use --force to overwrite):');
    for (const r of conflicts) {
      lines.push(`  ! ${r.deliverableId}: ${r.reason}`);
    }
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('FAILED:');
    for (const r of failed) {
      lines.push(`  X ${r.deliverableId}: ${r.error || r.reason}`);
    }
    lines.push('');
  }

  // Summary
  lines.push('---');
  lines.push(`Summary: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`);

  return lines.join('\n');
}

/**
 * Sync deliverables to Linear.
 *
 * @param {object} options - Command options
 * @param {string} options.projectRoot - Project root directory
 * @param {boolean} [options.dryRun] - Preview mode
 * @param {boolean} [options.force] - Force overwrite conflicts
 * @param {string} [options.deliverables] - Comma-separated deliverable IDs
 * @param {string} [options.project] - Linear project ID or URL
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function syncLinear(options) {
  const { projectRoot, dryRun, force, deliverables, project } = options;

  const dwaDir = path.join(projectRoot, '.dwa');
  const registryDir = path.join(dwaDir, 'deliverables');

  // Check feature exists
  const featurePath = path.join(dwaDir, 'feature.json');
  if (!await fs.pathExists(featurePath)) {
    return {
      success: false,
      message: 'No feature found. Run "dwa --scaffold" first to create a feature.'
    };
  }

  const feature = await fs.readJSON(featurePath);

  // Check registry exists
  if (!await fs.pathExists(registryDir)) {
    return {
      success: false,
      message: 'No deliverables found. Run "dwa --parse" first to populate the registry.'
    };
  }

  // Parse deliverable IDs if provided
  const deliverableIds = deliverables
    ? deliverables.split(',').map(s => s.trim()).filter(Boolean)
    : undefined;

  // Get spec and TDD paths from feature
  const specPath = feature.spec_path || 'feature-spec.md';
  const tddPath = feature.tdd_path;

  // Resolve container from options or feature config
  let container = project;
  if (!container) {
    // Check for linear_project_id in feature.json or .dwa/config.json
    container = feature.linear_project_id;

    const configPath = path.join(dwaDir, 'config.json');
    if (!container && await fs.pathExists(configPath)) {
      const config = await fs.readJSON(configPath);
      container = config.linear_project_id;
    }
  }

  // Run sync
  try {
    console.log(dryRun ? 'DRY RUN - No changes will be made\n' : 'Syncing to Linear...\n');

    const { results, summary } = await syncAllDeliverables({
      registryDir,
      feature,
      specPath,
      tddPath,
      container,
      force,
      dryRun,
      deliverableIds,
      concurrency: 3
    });

    const output = formatResults(results, summary);
    console.log(output);

    const hasFailures = summary.failed > 0;
    const hasConflicts = results.some(r => r.action === SyncAction.SKIP_CONFLICT);

    if (hasFailures) {
      return {
        success: false,
        message: `Sync completed with ${summary.failed} failure(s).`
      };
    }

    if (hasConflicts && !force) {
      return {
        success: true,
        message: `Sync completed. ${results.filter(r => r.action === SyncAction.SKIP_CONFLICT).length} conflict(s) skipped. Use --force to overwrite.`
      };
    }

    return {
      success: true,
      message: `Sync complete: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} unchanged.`
    };

  } catch (error) {
    return {
      success: false,
      message: `Sync failed: ${error.message}`
    };
  }
}

module.exports = {
  syncLinear,
  formatResults
};
