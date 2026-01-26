#!/usr/bin/env node

/**
 * DWA Maintenance Utilities
 * Handles .dwa/ directory management and cleanup
 */

const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');

class DWAMaintenance {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.dwaDir = path.join(projectRoot, '.dwa');
  }

  async cleanupOrphaned() {
    console.log('🧹 Cleaning up orphaned deliverables...');

    if (!await fs.pathExists(this.dwaDir)) {
      console.log('No .dwa directory found');
      return;
    }

    const deliverablesDir = path.join(this.dwaDir, 'deliverables');
    if (!await fs.pathExists(deliverablesDir)) {
      console.log('No deliverables directory found');
      return;
    }

    // Get all deliverable files
    const deliverableFiles = await glob('*.json', { cwd: deliverablesDir });
    const deliverableIds = deliverableFiles.map(f => path.basename(f, '.json'));

    // Check which ones are marked as orphaned
    let cleaned = 0;
    for (const id of deliverableIds) {
      const filePath = path.join(deliverablesDir, `${id}.json`);
      const data = await fs.readJson(filePath);

      if (data.orphaned) {
        // Check if orphaned more than 30 days ago
        const orphanedAt = new Date(data.orphaned_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (orphanedAt < thirtyDaysAgo) {
          await fs.remove(filePath);
          cleaned++;
          console.log(`  Removed orphaned deliverable: ${id}`);
        }
      }
    }

    console.log(`✅ Cleaned up ${cleaned} orphaned deliverables`);
  }

  async validateState() {
    console.log('🔍 Validating DWA state...');

    const issues = [];

    // Check required files
    const requiredFiles = [
      'feature.json',
      '.dwa-version'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.dwaDir, file);
      if (!await fs.pathExists(filePath)) {
        issues.push(`Missing required file: ${file}`);
      }
    }

    // Check schema versions
    const deliverablesDir = path.join(this.dwaDir, 'deliverables');
    if (await fs.pathExists(deliverablesDir)) {
      const deliverableFiles = await glob('*.json', { cwd: deliverablesDir });

      for (const file of deliverableFiles) {
        const filePath = path.join(deliverablesDir, file);
        try {
          const data = await fs.readJson(filePath);
          if (!data.schemaVersion) {
            issues.push(`Missing schemaVersion in: ${file}`);
          } else if (data.schemaVersion !== '1.0.0') {
            issues.push(`Unexpected schemaVersion in ${file}: ${data.schemaVersion}`);
          }
        } catch (error) {
          issues.push(`Invalid JSON in: ${file} (${error.message})`);
        }
      }
    }

    if (issues.length === 0) {
      console.log('✅ DWA state is valid');
    } else {
      console.log('❌ Found issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return issues;
  }

  async repairState() {
    console.log('🔧 Repairing DWA state...');

    // Ensure directories exist
    await fs.ensureDir(path.join(this.dwaDir, 'deliverables'));
    await fs.ensureDir(path.join(this.dwaDir, 'packets'));
    await fs.ensureDir(path.join(this.dwaDir, 'import-reports'));

    // Re-parse spec if it exists
    const specPath = path.join(this.projectRoot, 'feature-spec.md');
    if (await fs.pathExists(specPath)) {
      console.log('  Re-parsing spec to regenerate state...');
      try {
        execSync('npx dwa --parse', { stdio: 'pipe', cwd: this.projectRoot });
        console.log('  ✅ State repaired');
      } catch (error) {
        console.log('  ⚠️  Could not re-parse spec:', error.message);
      }
    } else {
      console.log('  No spec file found to re-parse');
    }
  }

  async backupState() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `.dwa-backup-${timestamp}.tar.gz`;

    console.log(`💾 Creating backup: ${backupFile}`);

    try {
      execSync(`tar -czf ${backupFile} .dwa/`, { cwd: this.projectRoot });
      console.log(`✅ Backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      return null;
    }
  }

  async showStats() {
    console.log('📊 DWA Statistics:');

    if (!await fs.pathExists(this.dwaDir)) {
      console.log('  No .dwa directory found');
      return;
    }

    // Count deliverables
    const deliverablesDir = path.join(this.dwaDir, 'deliverables');
    let deliverableCount = 0;
    let orphanedCount = 0;

    if (await fs.pathExists(deliverablesDir)) {
      const files = await glob('*.json', { cwd: deliverablesDir });
      deliverableCount = files.length;

      for (const file of files) {
        const data = await fs.readJson(path.join(deliverablesDir, file));
        if (data.orphaned) orphanedCount++;
      }
    }

    // Count packets
    const packetsDir = path.join(this.dwaDir, 'packets');
    let packetCount = 0;
    if (await fs.pathExists(packetsDir)) {
      const files = await glob('*.md', { cwd: packetsDir });
      packetCount = files.length;
    }

    console.log(`  Deliverables: ${deliverableCount} (${orphanedCount} orphaned)`);
    console.log(`  Packets: ${packetCount}`);
    console.log(`  Disk usage: ${await this.getDirSize(this.dwaDir)}`);
  }

  async getDirSize(dirPath) {
    try {
      const output = execSync(`du -sh "${dirPath}" | cut -f1`, { encoding: 'utf8' });
      return output.trim();
    } catch (error) {
      return 'unknown';
    }
  }
}

// CLI interface
const { execSync } = require('child_process');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const maintenance = new DWAMaintenance();

  switch (command) {
    case 'cleanup':
      await maintenance.cleanupOrphaned();
      break;

    case 'validate':
      await maintenance.validateState();
      break;

    case 'repair':
      await maintenance.repairState();
      break;

    case 'backup':
      await maintenance.backupState();
      break;

    case 'stats':
      await maintenance.showStats();
      break;

    default:
      console.log('DWA Maintenance Utilities');
      console.log('========================');
      console.log('Usage: node maintenance.js <command>');
      console.log('');
      console.log('Commands:');
      console.log('  cleanup  - Remove old orphaned deliverables');
      console.log('  validate - Check state integrity');
      console.log('  repair   - Fix corrupted state');
      console.log('  backup   - Create state backup');
      console.log('  stats    - Show statistics');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DWAMaintenance;