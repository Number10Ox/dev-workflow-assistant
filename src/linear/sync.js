/**
 * Core sync logic for Linear integration.
 *
 * Orchestrates create/update/skip decisions based on:
 * - Registry linear_issue_id (fast path)
 * - Linear externalId query (safety net)
 * - Sync hash comparison (edit detection)
 */

const fs = require('fs-extra');
const path = require('path');
const { IssueTrackerFactory } = require('./factory');
const { buildDwaSection, extractDwaSection, updateDwaSection } = require('./content-builder');
const { computeSyncHash, extractSyncHash, checkForManualEdits } = require('./fingerprint');
const { generateExternalId } = require('./external-id');
const { updateLinearFields } = require('../parser/registry');

/**
 * Sync action types.
 */
const SyncAction = {
  CREATE: 'create',
  UPDATE: 'update',
  SKIP_UNCHANGED: 'skip_unchanged',
  SKIP_CONFLICT: 'skip_conflict',
  ERROR: 'error'
};

/**
 * Determine what sync action to take for a deliverable.
 *
 * @param {object} deliverable - Deliverable from registry
 * @param {object} existingIssue - Existing issue from Linear (or null)
 * @param {string} newDwaContent - New DWA section content
 * @param {object} options - Sync options
 * @param {boolean} options.force - Force overwrite even on conflict
 * @returns {{ action: string, reason: string }}
 */
function determineSyncAction(deliverable, existingIssue, newDwaContent, options = {}) {
  // No existing issue - create
  if (!existingIssue) {
    return { action: SyncAction.CREATE, reason: 'No existing issue found' };
  }

  // Check for manual edits in existing DWA section
  const existingDwa = extractDwaSection(existingIssue.description || '');

  if (existingDwa) {
    const { modified, storedHash } = checkForManualEdits(existingDwa.content);

    // Also compare against our registry hash
    const registryHash = deliverable.dwa_sync_hash;
    const linearHash = storedHash;

    if (modified && linearHash !== registryHash && !options.force) {
      return {
        action: SyncAction.SKIP_CONFLICT,
        reason: `DWA section was manually edited in Linear (hash mismatch). Use --force to overwrite.`
      };
    }
  }

  // Check if content actually changed
  const newHash = computeSyncHash(newDwaContent.replace(/\*\*Sync Hash:\*\*\s*`[a-f0-9]{64}`/i, '').trim());
  const existingHash = deliverable.dwa_sync_hash;

  if (newHash === existingHash) {
    return { action: SyncAction.SKIP_UNCHANGED, reason: 'Content unchanged since last sync' };
  }

  return { action: SyncAction.UPDATE, reason: 'Content changed, updating issue' };
}

/**
 * Sync a single deliverable to Linear.
 *
 * @param {object} client - Initialized IssueTrackerFactory
 * @param {object} deliverable - Deliverable from registry
 * @param {object} feature - Feature metadata (for externalId generation)
 * @param {object} options - Sync options
 * @param {string} options.registryDir - Path to registry directory
 * @param {string} options.specPath - Path to spec file
 * @param {string} [options.tddPath] - Path to TDD file
 * @param {string} [options.container] - Container/project ID
 * @param {boolean} [options.force] - Force overwrite on conflict
 * @param {boolean} [options.dryRun] - Don't actually sync, just report
 * @returns {Promise<{ success: boolean, action: string, reason: string, issue?: object, error?: string }>}
 */
async function syncDeliverable(client, deliverable, feature, options) {
  const { registryDir, specPath, tddPath, container, force, dryRun } = options;

  try {
    // Generate external ID
    const externalId = generateExternalId(feature, deliverable.id);

    // Build DWA section content
    const dwaContent = buildDwaSection(deliverable, { specPath, tddPath });

    // Look up existing issue
    let existingIssue = null;

    // Fast path: registry has linear_issue_id
    if (deliverable.linear_issue_id) {
      try {
        existingIssue = await client.getIssue(deliverable.linear_issue_id);
      } catch (err) {
        // Issue may have been deleted, fall through to externalId lookup
        console.log(`Issue ${deliverable.linear_issue_id} not found, checking externalId`);
      }
    }

    // Safety net: query by externalId
    if (!existingIssue) {
      existingIssue = await client.queryByExternalId(externalId);
    }

    // Determine action
    const { action, reason } = determineSyncAction(deliverable, existingIssue, dwaContent, { force });

    // Dry run - just report
    if (dryRun) {
      return { success: true, action, reason, deliverableId: deliverable.id };
    }

    // Execute action
    let issue;

    switch (action) {
      case SyncAction.CREATE:
        issue = await client.createIssue({
          title: deliverable.description || deliverable.user_story || deliverable.id,
          description: dwaContent,
          externalId,
          container
        });
        break;

      case SyncAction.UPDATE:
        const updatedBody = updateDwaSection(existingIssue.description || '', dwaContent);
        issue = await client.updateIssue(existingIssue.id, {
          description: updatedBody
        });
        break;

      case SyncAction.SKIP_UNCHANGED:
      case SyncAction.SKIP_CONFLICT:
        return { success: true, action, reason, deliverableId: deliverable.id };

      default:
        return { success: false, action: SyncAction.ERROR, reason: `Unknown action: ${action}`, deliverableId: deliverable.id };
    }

    // Update registry with Linear fields
    const syncHash = computeSyncHash(dwaContent.replace(/\*\*Sync Hash:\*\*\s*`[a-f0-9]{64}`/i, '').trim());

    await updateLinearFields(registryDir, deliverable.id, {
      linear_issue_id: issue.id,
      linear_identifier: issue.identifier,
      linear_url: issue.url,
      linear_external_id: externalId,
      linear_project_id: container,
      dwa_sync_hash: syncHash
    });

    return {
      success: true,
      action,
      reason,
      deliverableId: deliverable.id,
      issue: {
        id: issue.id,
        identifier: issue.identifier,
        url: issue.url
      }
    };

  } catch (error) {
    return {
      success: false,
      action: SyncAction.ERROR,
      reason: error.message,
      deliverableId: deliverable.id,
      error: error.message
    };
  }
}

/**
 * Sync all deliverables in a feature to Linear.
 *
 * @param {object} options - Sync options
 * @param {string} options.registryDir - Path to registry directory
 * @param {object} options.feature - Feature metadata
 * @param {string} options.specPath - Path to spec file
 * @param {string} [options.tddPath] - Path to TDD file
 * @param {string} [options.container] - Container/project ID
 * @param {boolean} [options.force] - Force overwrite on conflict
 * @param {boolean} [options.dryRun] - Don't actually sync
 * @param {string[]} [options.deliverableIds] - Specific IDs to sync (sync all if empty)
 * @param {number} [options.concurrency=3] - Max concurrent syncs
 * @returns {Promise<{ results: object[], summary: { created: number, updated: number, skipped: number, failed: number } }>}
 */
async function syncAllDeliverables(options) {
  const {
    registryDir,
    feature,
    specPath,
    tddPath,
    container,
    force,
    dryRun,
    deliverableIds,
    concurrency = 3
  } = options;

  // Initialize issue tracker (auto-selects bridge or direct mode)
  const client = new IssueTrackerFactory();
  await client.initialize();

  // Check capabilities
  const caps = client.checkCapabilities(['externalId', 'queryByExternalId']);
  if (!caps.supported) {
    throw new Error(
      `Bridge provider missing required features: ${caps.missing.join(', ')}. ` +
      `Update the linear-tracker-provider extension.`
    );
  }

  // Load deliverables from registry
  const files = await fs.readdir(registryDir).catch(() => []);
  const deliverableFiles = files.filter(f => f.startsWith('DEL-') && f.endsWith('.json'));

  const deliverables = [];
  for (const file of deliverableFiles) {
    const data = await fs.readJSON(path.join(registryDir, file));
    if (data.orphaned) continue; // Skip orphaned deliverables
    if (deliverableIds && deliverableIds.length > 0 && !deliverableIds.includes(data.id)) continue;
    deliverables.push(data);
  }

  if (deliverables.length === 0) {
    return {
      results: [],
      summary: { created: 0, updated: 0, skipped: 0, failed: 0 }
    };
  }

  // Sync in batches for concurrency control
  const results = [];
  for (let i = 0; i < deliverables.length; i += concurrency) {
    const batch = deliverables.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(del => syncDeliverable(client, del, feature, {
        registryDir,
        specPath,
        tddPath,
        container,
        force,
        dryRun
      }))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          action: SyncAction.ERROR,
          reason: result.reason?.message || 'Unknown error',
          error: result.reason?.message
        });
      }
    }
  }

  // Compute summary
  const summary = {
    created: results.filter(r => r.action === SyncAction.CREATE && r.success).length,
    updated: results.filter(r => r.action === SyncAction.UPDATE && r.success).length,
    skipped: results.filter(r => r.action === SyncAction.SKIP_UNCHANGED || r.action === SyncAction.SKIP_CONFLICT).length,
    failed: results.filter(r => !r.success).length
  };

  return { results, summary };
}

module.exports = {
  syncDeliverable,
  syncAllDeliverables,
  determineSyncAction,
  SyncAction
};
