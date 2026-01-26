/**
 * DWA Maintenance Utilities
 *
 * Handles .dwa/ directory management, cleanup, validation, and freshness detection.
 * All methods return structured data for testability and CLI consumption.
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { hashContent } = require('./utils/hash-content');

/**
 * List files in a directory matching a pattern.
 * @param {string} dir - Directory path
 * @param {string} extension - File extension to filter (e.g., '.json')
 * @returns {Promise<string[]>} Array of filenames (not full paths)
 */
async function listFiles(dir, extension) {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter(f => f.endsWith(extension));
  } catch {
    return [];
  }
}

class DWAMaintenance {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.dwaDir = path.join(projectRoot, '.dwa');
  }

  /**
   * Remove orphaned deliverables older than threshold days.
   * Safety: Only deletes if orphaned AND no runtime links (linear_issue_id, pr_url, drift_events).
   *
   * @param {number} thresholdDays - Days before cleanup (default 30)
   * @returns {Promise<{
   *   cleaned: Array<{id: string, reason: string}>,
   *   skipped: Array<{id: string, reason: string}>,
   *   errors: Array<{code: string, message: string, path?: string}>,
   *   thresholdDays: number
   * }>}
   */
  async cleanupOrphaned(thresholdDays = 30) {
    const result = { cleaned: [], skipped: [], errors: [], thresholdDays };

    if (!await fs.pathExists(this.dwaDir)) {
      return result;
    }

    const deliverablesDir = path.join(this.dwaDir, 'deliverables');
    if (!await fs.pathExists(deliverablesDir)) {
      return result;
    }

    const deliverableFiles = await listFiles(deliverablesDir, '.json');
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

    for (const file of deliverableFiles) {
      const id = path.basename(file, '.json');
      const filePath = path.join(deliverablesDir, file);

      try {
        const data = await fs.readJson(filePath);

        if (!data.orphaned) {
          continue; // Not orphaned, skip
        }

        // Safety checks: preserve deliverables with runtime links
        if (data.linear_issue_id) {
          result.skipped.push({ id, reason: 'has-linear-link' });
          continue;
        }

        if (data.pr_url) {
          result.skipped.push({ id, reason: 'has-pr-link' });
          continue;
        }

        if (data.drift_events && data.drift_events.length > 0) {
          result.skipped.push({ id, reason: 'has-drift-events' });
          continue;
        }

        // Check age threshold
        const orphanedAt = new Date(data.orphaned_at);
        if (orphanedAt >= thresholdDate) {
          result.skipped.push({ id, reason: 'too-recent' });
          continue;
        }

        // Safe to delete
        await fs.remove(filePath);
        result.cleaned.push({ id, reason: 'orphaned-safe' });
      } catch (error) {
        result.errors.push({
          code: 'DWA-M001',
          message: `Failed to process ${id}: ${error.message}`,
          path: filePath
        });
      }
    }

    return result;
  }

  /**
   * Validate DWA state integrity.
   *
   * @returns {Promise<{valid: boolean, issues: Array<{code: string, message: string, path?: string}>}>}
   */
  async validateState() {
    const issues = [];

    if (!await fs.pathExists(this.dwaDir)) {
      issues.push({
        code: 'DWA-V001',
        message: 'Missing .dwa directory',
        path: this.dwaDir
      });
      return { valid: false, issues };
    }

    // Check required files
    const requiredFiles = ['feature.json'];
    for (const file of requiredFiles) {
      const filePath = path.join(this.dwaDir, file);
      if (!await fs.pathExists(filePath)) {
        issues.push({
          code: 'DWA-V001',
          message: `Missing required file: ${file}`,
          path: filePath
        });
      }
    }

    // Check deliverables
    const deliverablesDir = path.join(this.dwaDir, 'deliverables');
    if (await fs.pathExists(deliverablesDir)) {
      const deliverableFiles = await listFiles(deliverablesDir, '.json');

      for (const file of deliverableFiles) {
        const filePath = path.join(deliverablesDir, file);
        try {
          const data = await fs.readJson(filePath);
          if (!data.schemaVersion) {
            issues.push({
              code: 'DWA-V003',
              message: `Missing schemaVersion in deliverable`,
              path: filePath
            });
          }
        } catch (error) {
          issues.push({
            code: 'DWA-V002',
            message: `Invalid JSON: ${error.message}`,
            path: filePath
          });
        }
      }
    }

    // Check feature.json structure
    const featureJsonPath = path.join(this.dwaDir, 'feature.json');
    if (await fs.pathExists(featureJsonPath)) {
      try {
        const featureJson = await fs.readJson(featureJsonPath);
        if (!featureJson.schemaVersion) {
          issues.push({
            code: 'DWA-V003',
            message: 'Missing schemaVersion in feature.json',
            path: featureJsonPath
          });
        }
      } catch (error) {
        issues.push({
          code: 'DWA-V002',
          message: `Invalid JSON in feature.json: ${error.message}`,
          path: featureJsonPath
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Get DWA statistics.
   *
   * @returns {Promise<{
   *   deliverables: number,
   *   orphaned: number,
   *   packets: number,
   *   driftEvents: number,
   *   diskUsage: string,
   *   diskUsageBytes: number
   * }|null>}
   */
  async getStats() {
    if (!await fs.pathExists(this.dwaDir)) {
      return null;
    }

    let deliverables = 0;
    let orphaned = 0;
    let driftEvents = 0;

    const deliverablesDir = path.join(this.dwaDir, 'deliverables');
    if (await fs.pathExists(deliverablesDir)) {
      const files = await listFiles(deliverablesDir, '.json');
      deliverables = files.length;

      for (const file of files) {
        try {
          const data = await fs.readJson(path.join(deliverablesDir, file));
          if (data.orphaned) orphaned++;
          if (data.drift_events) driftEvents += data.drift_events.length;
        } catch {
          // Skip invalid files for stats
        }
      }
    }

    let packets = 0;
    const packetsDir = path.join(this.dwaDir, 'packets');
    if (await fs.pathExists(packetsDir)) {
      const files = await listFiles(packetsDir, '.md');
      packets = files.length;
    }

    const { diskUsage, diskUsageBytes } = await this.getDirSize(this.dwaDir);

    return {
      deliverables,
      orphaned,
      packets,
      driftEvents,
      diskUsage,
      diskUsageBytes
    };
  }

  /**
   * Check if spec is newer than registry using content hash (preferred) or mtime (fallback).
   * Sources spec path from feature.json, not hardcoded.
   *
   * @returns {Promise<{
   *   stale: boolean,
   *   reason: 'hash-changed'|'mtime-newer'|'no-provenance'|'no-spec'|'no-registry'|null,
   *   specPath: string|null,
   *   currentHash: string|null,
   *   storedHash: string|null,
   *   specModified: Date|null,
   *   registryModified: Date|null
   * }>}
   */
  async checkFreshness() {
    const featureJsonPath = path.join(this.dwaDir, 'feature.json');

    // 1. Check if registry exists
    if (!await fs.pathExists(featureJsonPath)) {
      return {
        stale: true,
        reason: 'no-registry',
        specPath: null,
        currentHash: null,
        storedHash: null,
        specModified: null,
        registryModified: null
      };
    }

    // 2. Load feature.json to get spec_path
    const featureJson = await fs.readJson(featureJsonPath);
    const specRelPath = featureJson.spec_path || 'feature-spec.md';
    const specPath = path.join(this.projectRoot, specRelPath);

    // 3. Check if spec exists
    if (!await fs.pathExists(specPath)) {
      return {
        stale: false,
        reason: 'no-spec',
        specPath: specRelPath,
        currentHash: null,
        storedHash: null,
        specModified: null,
        registryModified: null
      };
    }

    // 4. Get file stats
    const specStat = await fs.stat(specPath);
    const featureStat = await fs.stat(featureJsonPath);

    // 5. Check content hash first (if stored)
    const storedHash = featureJson.spec_content_hash;
    const specContent = await fs.readFile(specPath, 'utf8');
    const currentHash = hashContent(specContent);

    if (storedHash) {
      const hashChanged = currentHash !== storedHash;
      return {
        stale: hashChanged,
        reason: hashChanged ? 'hash-changed' : null,
        specPath: specRelPath,
        currentHash,
        storedHash,
        specModified: specStat.mtime,
        registryModified: featureStat.mtime
      };
    }

    // 6. Fall back to mtime comparison (no stored hash)
    const mtimeNewer = specStat.mtime > featureStat.mtime;

    return {
      stale: mtimeNewer,
      reason: mtimeNewer ? 'mtime-newer' : 'no-provenance',
      specPath: specRelPath,
      currentHash,
      storedHash: null,
      specModified: specStat.mtime,
      registryModified: featureStat.mtime
    };
  }

  /**
   * Remove all DWA state (for --all flag).
   *
   * @param {Object} options
   * @param {boolean} options.backup - Create backup first (default true)
   * @returns {Promise<{removed: boolean, path: string, backupPath?: string}>}
   */
  async removeAllState(options = { backup: true }) {
    if (!await fs.pathExists(this.dwaDir)) {
      return { removed: false, path: this.dwaDir };
    }

    let backupPath;
    if (options.backup) {
      backupPath = await this.backupState();
    }

    await fs.remove(this.dwaDir);
    return { removed: true, path: this.dwaDir, backupPath };
  }

  /**
   * Create timestamped backup of .dwa/ directory.
   *
   * @returns {Promise<string|null>} Backup file path or null on failure
   */
  async backupState() {
    if (!await fs.pathExists(this.dwaDir)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.projectRoot, `.dwa-backup-${timestamp}.tar.gz`);

    try {
      execSync(`tar -czf "${backupFile}" .dwa/`, {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      return backupFile;
    } catch {
      return null;
    }
  }

  /**
   * Repair DWA state by ensuring directories exist and re-parsing spec.
   *
   * @returns {Promise<{repaired: boolean, actions: string[]}>}
   */
  async repairState() {
    const actions = [];

    // Ensure directories exist
    const dirs = ['deliverables', 'packets', 'import-reports'];
    for (const dir of dirs) {
      const dirPath = path.join(this.dwaDir, dir);
      if (!await fs.pathExists(dirPath)) {
        await fs.ensureDir(dirPath);
        actions.push(`Created ${dir}/`);
      }
    }

    // Re-parse spec if it exists
    const featureJsonPath = path.join(this.dwaDir, 'feature.json');
    if (await fs.pathExists(featureJsonPath)) {
      try {
        const featureJson = await fs.readJson(featureJsonPath);
        const specRelPath = featureJson.spec_path || 'feature-spec.md';
        const specPath = path.join(this.projectRoot, specRelPath);

        if (await fs.pathExists(specPath)) {
          execSync('npx dwa --parse', {
            cwd: this.projectRoot,
            stdio: 'pipe'
          });
          actions.push('Re-parsed spec');
        }
      } catch (error) {
        actions.push(`Parse failed: ${error.message}`);
      }
    }

    return { repaired: actions.length > 0, actions };
  }

  /**
   * Get directory size.
   *
   * @param {string} dirPath - Directory path
   * @returns {Promise<{diskUsage: string, diskUsageBytes: number}>}
   */
  async getDirSize(dirPath) {
    try {
      // Get human-readable size
      const output = execSync(`du -sh "${dirPath}" | cut -f1`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const diskUsage = output.trim();

      // Get bytes for programmatic use
      const bytesOutput = execSync(`du -sb "${dirPath}" | cut -f1`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const diskUsageBytes = parseInt(bytesOutput.trim(), 10) || 0;

      return { diskUsage, diskUsageBytes };
    } catch {
      return { diskUsage: 'unknown', diskUsageBytes: 0 };
    }
  }
}

module.exports = DWAMaintenance;
