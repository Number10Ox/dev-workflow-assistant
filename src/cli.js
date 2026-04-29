const { program } = require('commander');
const packageJson = require('../package.json');

program
  .name('dwa')
  .description('Dev Workflow Meta-Framework - deliverable-driven skills for Claude Code')
  .version(packageJson.version)
  .option('--install', 'Install DWA skills, templates, and references')
  .option('--upgrade', 'Upgrade existing DWA installation')
  .option('--uninstall', 'Remove DWA installation completely')
  .option('--sync-linear', 'Sync deliverables to Linear')
  .option('--dry-run', 'Preview sync without making changes (requires --sync-linear)')
  .option('--force', 'Overwrite DWA sections even if manually edited (requires --sync-linear)')
  .option('--deliverables <ids>', 'Comma-separated deliverable IDs to sync (requires --sync-linear)')
  .option('--project <id>', 'Linear project ID or URL (requires --sync-linear)')
  .option('--import-gdoc <doc>', 'Import Google Doc as canonical spec')
  .option('--out <path>', 'Output path for import (requires --import-gdoc)')
  .option('--setup [feature]', 'Run setup wizard (or setup specific: --setup linear, --setup google-docs)')
  .option('--mode <mode>', 'Setup mode: "direct" (no VS Code) or "vscode-bridge" (requires --setup linear)')
  .option('--status', 'Show DWA configuration status')
  .option('--clean', 'Remove orphaned deliverables (30+ days old)')
  .option('--clean-all', 'Remove all .dwa/ state (auto-backups unless --no-backup)')
  .option('--no-backup', 'Skip backup before --clean-all')
  .option('--validate', 'Check DWA state integrity')
  .option('--stats', 'Show DWA statistics');

program.parse(process.argv);

const opts = program.opts();

// Centralized operations registry (reduces future brittleness)
const operations = [
  { key: 'install', enabled: opts.install },
  { key: 'upgrade', enabled: opts.upgrade },
  { key: 'uninstall', enabled: opts.uninstall },
  { key: 'syncLinear', enabled: opts.syncLinear },
  { key: 'importGdoc', enabled: opts.importGdoc },
  { key: 'setup', enabled: opts.setup !== undefined },
  { key: 'status', enabled: opts.status },
  { key: 'clean', enabled: opts.clean },
  { key: 'cleanAll', enabled: opts.cleanAll },
  { key: 'validate', enabled: opts.validate },
  { key: 'stats', enabled: opts.stats }
];
const enabledOps = operations.filter(op => op.enabled);

if (enabledOps.length > 1) {
  console.error(`Error: Only one operation allowed. Got: ${enabledOps.map(o => o.key).join(', ')}`);
  process.exit(1);
}

// Route to appropriate command handler
if (opts.install) {
  try {
    const { install } = require('./commands/install');
    install();
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('Error: Install command not yet implemented');
      console.error('This will be available in plan 01-02');
      process.exit(1);
    }
    throw err;
  }
} else if (opts.upgrade) {
  try {
    const { upgrade } = require('./commands/upgrade');
    upgrade();
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('Error: Upgrade command not yet implemented');
      console.error('This will be available in plan 01-03');
      process.exit(1);
    }
    throw err;
  }
} else if (opts.uninstall) {
  try {
    const { uninstall } = require('./commands/uninstall');
    uninstall();
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('Error: Uninstall command not yet implemented');
      console.error('This will be available in plan 01-03');
      process.exit(1);
    }
    throw err;
  }
} else if (opts.syncLinear) {
  (async () => {
    try {
      const { syncLinear } = require('./commands/sync-linear');
      const result = await syncLinear({
        projectRoot: process.cwd(),
        dryRun: opts.dryRun,
        force: opts.force,
        deliverables: opts.deliverables,
        project: opts.project
      });
      if (!result.success) {
        console.error(result.message);
        process.exit(1);
      }
      console.log(result.message);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        console.error('Error: sync-linear command not available');
        process.exit(1);
      }
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else if (opts.importGdoc) {
  (async () => {
    try {
      const { importGdoc } = require('./commands/import-gdoc');
      const result = await importGdoc({
        docIdOrUrl: opts.importGdoc,
        projectRoot: process.cwd(),
        out: opts.out,
        force: opts.force,
        dryRun: opts.dryRun
      });
      if (!result.success) {
        console.error(result.message);
        process.exit(1);
      }
      console.log(result.message);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        console.error('Error: import-gdoc command not available');
        process.exit(1);
      }
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else if (opts.setup !== undefined) {
  (async () => {
    try {
      const { setup } = require('./commands/setup');
      const setupOpts = {};

      // Handle specific feature setup
      if (opts.setup === 'linear') {
        setupOpts.linear = true;
      } else if (opts.setup === 'google-docs') {
        setupOpts.googleDocs = true;
      }
      // If opts.setup === true, no specific feature (interactive mode)

      // --mode applies only to --setup linear
      if (opts.mode) {
        setupOpts.mode = opts.mode;
      }

      const result = await setup(setupOpts);
      if (!result.success) {
        console.error(result.message);
        process.exit(1);
      }
      console.log(result.message);
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else if (opts.status) {
  (async () => {
    try {
      const { status } = require('./commands/status');
      await status();
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else if (opts.clean || opts.cleanAll) {
  (async () => {
    try {
      const DWAMaintenance = require('./maintenance');
      const maint = new DWAMaintenance();

      if (opts.cleanAll) {
        // Safety: auto-backup unless --no-backup
        const backup = opts.backup !== false;
        const result = await maint.removeAllState({ backup });

        if (result.removed) {
          if (result.backupPath) {
            console.log(`Backup created: ${result.backupPath}`);
          }
          console.log(`Removed all DWA state: ${result.path}`);
        } else {
          console.log('No .dwa directory found');
        }
      } else {
        const result = await maint.cleanupOrphaned();
        console.log(`Cleaned ${result.cleaned.length} orphaned deliverables`);
        if (result.skipped.length > 0) {
          console.log(`Skipped ${result.skipped.length}:`);
          // Group by reason
          const byReason = {};
          result.skipped.forEach(s => {
            byReason[s.reason] = (byReason[s.reason] || 0) + 1;
          });
          Object.entries(byReason).forEach(([reason, count]) => {
            console.log(`  - ${count} ${reason}`);
          });
        }
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else if (opts.validate) {
  (async () => {
    try {
      const DWAMaintenance = require('./maintenance');
      const maint = new DWAMaintenance();
      const result = await maint.validateState();

      if (result.valid) {
        console.log('DWA state is valid');
      } else {
        console.log('Issues found:');
        result.issues.forEach(i => {
          const pathSuffix = i.path ? ` (${i.path})` : '';
          console.log(`  - [${i.code}] ${i.message}${pathSuffix}`);
        });
        process.exit(1);
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else if (opts.stats) {
  (async () => {
    try {
      const DWAMaintenance = require('./maintenance');
      const maint = new DWAMaintenance();
      const stats = await maint.getStats();

      if (!stats) {
        console.log('No .dwa directory found');
        return;
      }

      console.log('DWA Statistics:');
      console.log(`  Deliverables: ${stats.deliverables} (${stats.orphaned} orphaned)`);
      console.log(`  Packets: ${stats.packets}`);
      console.log(`  Drift events: ${stats.driftEvents}`);
      console.log(`  Disk usage: ${stats.diskUsage}`);
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else {
  // No operation specified - show help
  program.help();
}

module.exports = { program };
