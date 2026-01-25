# Phase 1: Bootstrap and Installer - Research

**Researched:** 2026-01-24
**Domain:** NPM package distribution, CLI tools, file system operations, Claude Code skills installation
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 requires building an npx-installable package that copies DWA skills, templates, and references to `~/.claude/dwa/` and registers `/dwa:*` commands. The research reveals that this requires:

1. **NPM package with bin entry point** - A Node.js CLI executable with shebang that handles `--install`, `--upgrade`, and `--uninstall` flags
2. **Claude Code skills discovery** - Skills are auto-discovered from `~/.claude/skills/` (personal) or `.claude/skills/` (project), no explicit registration needed
3. **Safe file operations** - Atomic writes, recursive copying with fs-extra, and backup-before-upgrade patterns
4. **Schema versioning foundation** - Every JSON file needs `schemaVersion` field from day one for future migrations

The standard approach is to create a package with a bin script that performs file system operations (copy/remove) to the user's home directory, with the Claude Code skills system automatically discovering the installed skills.

**Primary recommendation:** Use Commander.js for CLI parsing, fs-extra for safe file operations, write-file-atomic for JSON writes, and implement lazy migration pattern for future schema evolution.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | ^12.x | CLI argument parsing | Lightweight, declarative, perfect for Git-style subcommands like `--install`, widely used by webpack-cli and babel-cli |
| fs-extra | ^11.x | File system operations | Adds promise support, recursive copy, and graceful-fs to prevent EMFILE errors |
| write-file-atomic | ^7.x | Atomic JSON writes | Prevents partial writes during crashes, writes to temp file then renames (atomic operation) |
| chalk | ^5.x | Terminal output styling | De facto standard for colored CLI output, 50M+ weekly downloads |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ora | ^8.x | CLI spinners | Show progress during file copy operations |
| semver | ^7.x | Version comparison | Compare installed vs package version for upgrade logic |
| glob | ^11.x | File matching | Find all skills/templates to copy during installation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander | yargs | Yargs has more validation features (290KB vs 174KB) but overkill for simple --install/--upgrade flags |
| fs-extra | native fs | Native fs lacks recursive copy, promise support, and EMFILE protection |
| write-file-atomic | fs.writeFileSync | Native write can leave partial JSON on crash, no atomic guarantee |

**Installation:**
```bash
npm install commander fs-extra write-file-atomic chalk ora semver glob
```

## Architecture Patterns

### Recommended Project Structure
```
dwa/
├── bin/
│   └── dwa.js              # CLI entry point (shebang, calls src/cli.js)
├── src/
│   ├── cli.js               # Commander.js setup
│   ├── commands/
│   │   ├── install.js       # --install logic
│   │   ├── upgrade.js       # --upgrade logic
│   │   └── uninstall.js     # --uninstall logic
│   ├── installer/
│   │   ├── copy-files.js    # fs-extra recursive copy
│   │   ├── version.js       # Read/write .dwa-version
│   │   └── backup.js        # Backup existing installation
│   └── utils/
│       ├── paths.js         # Cross-platform path resolution
│       └── schema.js        # Schema version constants
├── skills/                  # SKILL.md files to be installed
├── templates/               # Feature spec templates
├── references/              # Reference documentation
└── package.json
```

### Pattern 1: NPX Executable Entry Point

**What:** Package entry point with shebang for direct execution via npx

**When to use:** Required for any npx-installable tool

**Example:**
```javascript
// bin/dwa.js
#!/usr/bin/env node
// Source: https://deepgram.com/learn/npx-script

// Keep bin file minimal - delegate to src/cli.js
require('../src/cli.js');
```

**package.json:**
```json
{
  "name": "dwa",
  "version": "1.0.0",
  "bin": "./bin/dwa.js"
}
```

### Pattern 2: Cross-Platform Home Directory Resolution

**What:** Use `os.homedir()` and `path.join()` for all path operations

**When to use:** Always, when working with user directories

**Example:**
```javascript
// src/utils/paths.js
// Source: https://nodejs.org/en/learn/manipulating-files/nodejs-file-paths

const os = require('node:os');
const path = require('node:path');

function getInstallDir() {
  // Returns:
  // Linux: /home/USER/.claude/dwa
  // macOS: /Users/USER/.claude/dwa
  // Windows: C:\Users\USER\.claude\dwa
  return path.join(os.homedir(), '.claude', 'dwa');
}

function getSkillsDir() {
  return path.join(os.homedir(), '.claude', 'skills');
}
```

**Critical:** Never use string concatenation or hardcoded separators. Use `path.join()` for combining paths and `path.resolve()` for absolute paths.

### Pattern 3: Atomic JSON Writes with Schema Version

**What:** Write JSON files atomically with `schemaVersion` field

**When to use:** Every `.dwa/` JSON file and `.dwa-version` file

**Example:**
```javascript
// Source: https://www.npmjs.com/package/write-file-atomic
const writeFileAtomic = require('write-file-atomic');
const SCHEMA_VERSION = '1.0.0';

async function writeRegistry(filePath, data) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    ...data
  };

  // Writes to temp file, then renames (atomic)
  // Options prevent overwrite without error
  await writeFileAtomic(
    filePath,
    JSON.stringify(payload, null, 2),
    { encoding: 'utf8' }
  );
}
```

### Pattern 4: Backup-Before-Upgrade

**What:** Create timestamped backup before modifying existing installation

**When to use:** During `--upgrade` command

**Example:**
```javascript
const fs = require('fs-extra');
const path = require('node:path');

async function backupBeforeUpgrade(installDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${installDir}.backup.${timestamp}`;

  if (await fs.pathExists(installDir)) {
    await fs.copy(installDir, backupDir, {
      errorOnExist: true,
      preserveTimestamps: true
    });
    console.log(`Backup created: ${backupDir}`);
  }
}
```

### Pattern 5: Lazy Schema Migration

**What:** Migrate JSON schemas at read-time, not upgrade-time

**When to use:** Future schema version updates (foundation in Phase 1)

**Example:**
```javascript
// Source: https://developer.couchbase.com/tutorial-schema-versioning
const semver = require('semver');

async function readWithMigration(filePath, currentVersion) {
  const raw = await fs.readJson(filePath);
  const fileVersion = raw.schemaVersion || '1.0.0';

  if (semver.lt(fileVersion, currentVersion)) {
    // Apply migration chain
    const migrated = await migrateUp(raw, fileVersion, currentVersion);

    // Write back with new version (lazy migration)
    await writeFileAtomic(filePath, JSON.stringify(migrated, null, 2));

    return migrated;
  }

  return raw;
}
```

### Anti-Patterns to Avoid

- **String path concatenation:** Use `path.join()` instead of `dir + '/' + file` - breaks on Windows
- **Synchronous file operations in CLI:** Use async/await with fs-extra promises - prevents blocking during large copies
- **No backup before upgrade:** Always backup existing installation before destructive operations
- **Hardcoded paths:** Use `os.homedir()` and cross-platform path utilities
- **postinstall scripts:** Avoid npm postinstall hooks - they're slow, risky, and many users block them with `--ignore-scripts`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Manual process.argv parsing | Commander.js | Handles edge cases: quotes, equals signs, boolean flags, unknown options |
| Recursive directory copy | Manual fs.readdirSync loops | fs-extra.copy() | Handles symlinks, permissions, timestamps, EMFILE errors |
| Atomic file writes | fs.writeFileSync | write-file-atomic | Prevents partial writes on crash - writes to temp, then renames (atomic) |
| Cross-platform paths | String manipulation with / or \ | path.join(), path.resolve() | Handles Windows vs Unix separators, relative vs absolute |
| Version comparison | String splitting and parseInt | semver.lt(), semver.gt() | Handles pre-release versions, build metadata per SemVer spec |
| Terminal spinners | setInterval with ASCII frames | ora | Handles TTY detection, CI environments, 70+ spinner styles |

**Key insight:** File system operations have edge cases that look simple but aren't - permissions, symlinks, EMFILE limits, partial writes during crashes, cross-platform path separators. Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: Breaking on Windows Path Separators

**What goes wrong:** Hardcoding `/` in paths breaks on Windows (which uses `\`)

**Why it happens:** Developers on Mac/Linux don't test on Windows

**How to avoid:**
- Always use `path.join()` for combining paths
- Always use `os.homedir()` for home directory
- Never concatenate paths with `+` operator

**Warning signs:** Tests pass locally but fail on Windows CI

### Pitfall 2: Partial Writes During Crashes

**What goes wrong:** Using `fs.writeFileSync()` can leave partial JSON if process crashes mid-write

**Why it happens:** File writes aren't atomic - data is written in chunks

**How to avoid:** Use `write-file-atomic` which writes to `.tmp` file, then renames (rename is atomic operation at OS level)

**Warning signs:** Corrupted JSON files after crashes or ctrl+c during write

### Pitfall 3: EMFILE Errors on Large Copies

**What goes wrong:** Node.js runs out of file descriptors when copying many files

**Why it happens:** Native `fs` opens too many files simultaneously

**How to avoid:** Use `fs-extra` which includes `graceful-fs` to queue operations and prevent EMFILE

**Warning signs:** `Error: EMFILE, too many open files` during installation

### Pitfall 4: Skills Not Auto-Discovered

**What goes wrong:** Skills installed to `~/.claude/dwa/` aren't recognized by Claude Code

**Why it happens:** Claude Code auto-discovers from `~/.claude/skills/` not `~/.claude/dwa/`

**How to avoid:**
- Install skills to `~/.claude/skills/dwa-*` (each skill in its own folder)
- OR use plugin pattern with `~/.claude/plugins/dwa/skills/` structure
- Skills must follow naming pattern: each skill is a directory with `SKILL.md`

**Warning signs:** Running `/dwa:*` commands shows "skill not found"

### Pitfall 5: Losing User Configuration on Upgrade

**What goes wrong:** `--upgrade` overwrites user-modified config files

**Why it happens:** Naive upgrade just copies all files, clobbering existing ones

**How to avoid:**
- Identify config files that users might customize
- Use merge strategy: only update template files, preserve user configs
- Create `.user` suffix convention for user-editable files
- Document which files are safe to modify

**Warning signs:** Users report losing customizations after upgrade

### Pitfall 6: No Version Tracking

**What goes wrong:** Can't determine what version is installed when user runs `--upgrade`

**Why it happens:** Forgot to write `.dwa-version` file during install

**How to avoid:**
- Write `.dwa-version` file to install directory during `--install`
- Read this file during `--upgrade` to determine migration path
- Use semantic versioning for comparison (`semver` package)

**Warning signs:** Upgrade command can't determine current version

## Code Examples

Verified patterns for the installer implementation:

### Install Command Structure
```javascript
// src/commands/install.js
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const ora = require('ora');
const { getInstallDir, getSkillsDir } = require('../utils/paths');
const { SCHEMA_VERSION } = require('../utils/schema');

async function install() {
  const installDir = getInstallDir();
  const spinner = ora('Installing DWA...').start();

  try {
    // Check if already installed
    if (await fs.pathExists(installDir)) {
      spinner.fail('DWA already installed. Use --upgrade to update.');
      process.exit(1);
    }

    // Create installation directory
    await fs.ensureDir(installDir);

    // Copy skills to ~/.claude/skills/dwa-*/
    const skillsSource = path.join(__dirname, '../../skills');
    const skillsTarget = path.join(getSkillsDir());

    await fs.copy(skillsSource, skillsTarget, {
      overwrite: false,
      errorOnExist: false,
      preserveTimestamps: true
    });

    // Copy templates and references
    await fs.copy(
      path.join(__dirname, '../../templates'),
      path.join(installDir, 'templates')
    );

    await fs.copy(
      path.join(__dirname, '../../references'),
      path.join(installDir, 'references')
    );

    // Write version file
    await writeVersion(installDir);

    spinner.succeed('DWA installed successfully!');
    console.log(`\nSkills installed to: ${skillsTarget}`);
    console.log(`Templates installed to: ${installDir}/templates`);
    console.log('\nYou can now use /dwa:* commands in Claude Code.');
  } catch (error) {
    spinner.fail('Installation failed');
    console.error(error);
    process.exit(1);
  }
}

async function writeVersion(installDir) {
  const writeFileAtomic = require('write-file-atomic');
  const packageJson = require('../../package.json');

  const versionData = {
    schemaVersion: SCHEMA_VERSION,
    dwaVersion: packageJson.version,
    installedAt: new Date().toISOString()
  };

  await writeFileAtomic(
    path.join(installDir, '.dwa-version'),
    JSON.stringify(versionData, null, 2)
  );
}

module.exports = { install };
```

### Upgrade Command with Backup
```javascript
// src/commands/upgrade.js
const fs = require('fs-extra');
const path = require('node:path');
const ora = require('ora');
const semver = require('semver');
const { getInstallDir } = require('../utils/paths');

async function upgrade() {
  const installDir = getInstallDir();
  const spinner = ora('Upgrading DWA...').start();

  try {
    // Check if installed
    if (!await fs.pathExists(installDir)) {
      spinner.fail('DWA not installed. Use --install first.');
      process.exit(1);
    }

    // Read current version
    const versionFile = path.join(installDir, '.dwa-version');
    const currentVersion = await readVersion(versionFile);
    const packageJson = require('../../package.json');

    // Check if upgrade needed
    if (!semver.lt(currentVersion.dwaVersion, packageJson.version)) {
      spinner.info(`Already on latest version (${currentVersion.dwaVersion})`);
      return;
    }

    // Create backup
    spinner.text = 'Creating backup...';
    await backupInstallation(installDir);

    // Upgrade (merge strategy - preserve user configs)
    spinner.text = 'Upgrading files...';
    await upgradeFiles(installDir);

    // Update version
    await writeVersion(installDir);

    spinner.succeed(`Upgraded from ${currentVersion.dwaVersion} to ${packageJson.version}`);
  } catch (error) {
    spinner.fail('Upgrade failed');
    console.error(error);
    console.log('\nRestore from backup if needed.');
    process.exit(1);
  }
}

async function backupInstallation(installDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${installDir}.backup.${timestamp}`;

  await fs.copy(installDir, backupDir, {
    errorOnExist: true,
    preserveTimestamps: true
  });
}

async function upgradeFiles(installDir) {
  // Only upgrade templates and references (not user data)
  await fs.copy(
    path.join(__dirname, '../../templates'),
    path.join(installDir, 'templates'),
    { overwrite: true }
  );

  await fs.copy(
    path.join(__dirname, '../../references'),
    path.join(installDir, 'references'),
    { overwrite: true }
  );

  // Upgrade skills (each in separate directory)
  const skillsSource = path.join(__dirname, '../../skills');
  const skillsTarget = path.join(getSkillsDir());

  await fs.copy(skillsSource, skillsTarget, {
    overwrite: true,
    preserveTimestamps: true
  });
}

async function readVersion(versionFile) {
  if (!await fs.pathExists(versionFile)) {
    // Legacy installation without version file
    return { dwaVersion: '0.0.0', schemaVersion: '1.0.0' };
  }

  return await fs.readJson(versionFile);
}

module.exports = { upgrade };
```

### Uninstall Command
```javascript
// src/commands/uninstall.js
const fs = require('fs-extra');
const ora = require('ora');
const { getInstallDir, getSkillsDir } = require('../utils/paths');
const path = require('node:path');

async function uninstall() {
  const installDir = getInstallDir();
  const spinner = ora('Uninstalling DWA...').start();

  try {
    // Remove installation directory
    if (await fs.pathExists(installDir)) {
      await fs.remove(installDir);
    }

    // Remove skills (find all dwa-* directories)
    const skillsDir = getSkillsDir();
    const skillDirs = await fs.readdir(skillsDir);

    for (const dir of skillDirs) {
      if (dir.startsWith('dwa-')) {
        await fs.remove(path.join(skillsDir, dir));
      }
    }

    spinner.succeed('DWA uninstalled successfully');
  } catch (error) {
    spinner.fail('Uninstall failed');
    console.error(error);
    process.exit(1);
  }
}

module.exports = { uninstall };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `.claude/commands/` | Skills with `.claude/skills/` | Late 2024 | Skills support subdirectories, frontmatter, auto-discovery |
| Global npm install | npx direct execution | 2020+ | No global pollution, always latest version |
| Callbacks | Async/await with promises | Node 8+ (2017) | Cleaner error handling, no callback hell |
| String paths | path module methods | Always recommended | Cross-platform compatibility |
| fs module | fs-extra | Ongoing | Promises, recursive ops, graceful-fs protection |

**Deprecated/outdated:**
- `.claude/commands/` folder: Still works but skills are preferred (supports directories, frontmatter, supporting files)
- Explicit skill registration: Claude Code auto-discovers from `.claude/skills/`, no config needed
- npm postinstall scripts: Security risk, often blocked by `--ignore-scripts` flag

## Open Questions

Things that couldn't be fully resolved:

1. **Plugin vs Direct Skills Installation**
   - What we know: Claude Code supports both `~/.claude/skills/` (direct) and `~/.claude/plugins/*/skills/` (plugin pattern)
   - What's unclear: Which pattern is better for DWA? Plugin provides namespacing but may be overkill for single package
   - Recommendation: Start with direct installation to `~/.claude/skills/dwa-*/` for simplicity. Each skill gets own directory with `dwa-` prefix to avoid collisions. Can migrate to plugin pattern in future if needed.

2. **Skill Naming Convention**
   - What we know: Skill names become `/skill-name` commands
   - What's unclear: Should skills be named `dwa-init`, `dwa-parse` (with prefix) or just `init`, `parse` (relying on directory structure)?
   - Recommendation: Use unprefixed names (`init`, `parse`) but install to directories like `~/.claude/skills/dwa-init/` so `/init` doesn't collide with other packages. Alternatively, use namespaced commands if Claude Code supports it (need to verify).

3. **Migration Strategy for Future Schema Changes**
   - What we know: Lazy migration (read-time) is cost-effective for mostly-cold data
   - What's unclear: Should migrations write back immediately or only on next write operation?
   - Recommendation: Implement read-time migration that writes back immediately (REQ-011 says "read-time migrations"). This ensures registry stays current even for rarely-modified deliverables.

4. **Handling Interrupted Installations**
   - What we know: Atomic file writes prevent partial JSON corruption
   - What's unclear: What if installation is interrupted mid-copy? Partial directory structure left behind
   - Recommendation: Check for `.dwa-version` file to determine if installation is complete. If directory exists but no version file, consider it incomplete and allow re-install (with warning).

## Sources

### Primary (HIGH confidence)

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official skill structure, directory locations, SKILL.md format
- [Claude Code Skills Deep Dive](https://mikhail.io/2025/10/claude-code-skills/) - Technical details on skill discovery and invocation
- [Node.js File Paths](https://nodejs.org/en/learn/manipulating-files/nodejs-file-paths) - Official path module documentation
- [Cross-platform Directory Locations](https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/3_filesystem/directory_locations.md) - os.homedir() and cross-platform paths
- [fs-extra Documentation](https://github.com/jprichardson/node-fs-extra/blob/master/docs/copy.md) - Recursive copy with options
- [write-file-atomic](https://www.npmjs.com/package/write-file-atomic) - Atomic write operations
- [Creating NPX Commands](https://deepgram.com/learn/npx-script) - bin field, shebang, entry points

### Secondary (MEDIUM confidence)

- [npm Scripts and Lifecycle Hooks](https://docs.npmjs.com/cli/v9/using-npm/scripts/) - Postinstall patterns (to avoid)
- [Schema Versioning Tutorial](https://developer.couchbase.com/tutorial-schema-versioning) - Lazy migration pattern
- [Commander.js vs Yargs Comparison](https://npm-compare.com/commander,yargs) - CLI parsing libraries
- [Semantic Versioning in NPM](https://docs.npmjs.com/about-semantic-versioning/) - Version comparison best practices
- [Testing NPM Packages Locally](https://dev.to/scooperdev/use-npm-pack-to-test-your-packages-locally-486e) - npm pack for pre-publish testing
- [Cross-Platform Node.js Paths](https://shapeshed.com/writing-cross-platform-node/) - Path best practices

### Tertiary (LOW confidence)

- [CLI Spinners with Ora](https://github.com/sindresorhus/ora) - Community standard but not critical
- [Common npm Mistakes](https://medium.com/@jacob.h.page/common-npm-mistakes-51bf8989079f) - Anecdotal pitfalls

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - fs-extra, commander, write-file-atomic are industry standard
- Architecture: MEDIUM-HIGH - Patterns verified from official docs but DWA-specific structure is custom
- Pitfalls: MEDIUM - Based on common issues in cross-platform CLI tools and WebSearch findings
- Claude Code integration: HIGH - Official documentation clearly describes skills discovery mechanism

**Research date:** 2026-01-24
**Valid until:** ~30 days (Node.js ecosystem is relatively stable, but Claude Code is evolving)

**Notes:**
- Could not access Context7 for library-specific documentation verification
- GSD installation pattern not publicly documented, so followed general npm CLI installer best practices
- Some uncertainty around plugin vs direct skill installation - recommend starting simple with direct installation
