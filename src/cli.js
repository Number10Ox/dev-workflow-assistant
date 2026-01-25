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
  .option('--project <id>', 'Linear project ID or URL (requires --sync-linear)');

program.parse(process.argv);

const opts = program.opts();

// Check for mutual exclusivity
const operationCount = [opts.install, opts.upgrade, opts.uninstall, opts.syncLinear].filter(Boolean).length;

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
} else {
  // No operation specified - show help
  program.help();
}

module.exports = { program };
