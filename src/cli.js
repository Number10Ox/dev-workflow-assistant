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
  .option('--status', 'Show DWA configuration status');

program.parse(process.argv);

const opts = program.opts();

// Check for mutual exclusivity
const operationCount = [opts.install, opts.upgrade, opts.uninstall, opts.syncLinear, opts.importGdoc, opts.setup !== undefined, opts.status].filter(Boolean).length;

if (operationCount > 1) {
  console.error('Error: Only one operation allowed at a time');
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
} else {
  // No operation specified - show help
  program.help();
}

module.exports = { program };
