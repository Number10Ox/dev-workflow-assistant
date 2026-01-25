# Technology Stack

**Project:** DWA (Dev Workflow Meta-Framework)
**Researched:** 2026-01-24
**Confidence:** MEDIUM (based on training data + GSD reference analysis)

## Recommended Stack

### Core Runtime
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20.x LTS | Runtime environment | Current LTS, matches user's environment (v20.20.0), stable for CLI tools |
| npm | 10.x+ | Package manager | Ships with Node 20, standard for distribution via `npx` |

**Rationale:** Node 20 is the current LTS (until April 2026), providing stability and long-term support. The user's environment is already on v20.20.0, ensuring compatibility.

**Confidence:** HIGH (verified from user environment)

### CLI Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| commander | ^12.0.0 | CLI argument parsing | Industry standard, simple API, excellent for install scripts and skill commands |

**Rationale:**
- **Why commander over alternatives:**
  - **vs yargs:** Cleaner API, smaller bundle size, sufficient features for this use case
  - **vs oclif:** Too heavyweight for simple install + command pattern; oclif is overkill for non-plugin architectures
  - **vs meow:** Too minimal; lacks subcommand support needed for potential future expansion

- **Use case fit:** DWA needs `--install` flag and potentially skill-specific commands. Commander's subcommand pattern maps cleanly to this.

**Confidence:** HIGH (standard choice, well-established pattern)

### Markdown + YAML Front Matter Parsing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| gray-matter | ^4.0.3 | YAML front matter extraction | De facto standard for parsing markdown with front matter; battle-tested, fast, simple API |
| remark | ^15.0.0 | Markdown AST parsing | Unified ecosystem standard; needed for robust table extraction |
| remark-parse | ^11.0.0 | Markdown to AST | Core remark parser |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown | Essential for table parsing (GFM tables are the standard) |
| unist-util-visit | ^5.0.0 | AST traversal | Clean API for finding table nodes in remark AST |

**Rationale:**

**gray-matter:**
- Parse YAML front matter from feature specs
- Returns `{ data, content }` cleanly separating metadata from markdown body
- Handles edge cases (multiline YAML, nested objects)
- 18M+ weekly downloads, extremely stable

**remark ecosystem:**
- **Why remark over markdown-it:** Remark provides an AST (abstract syntax tree), making table extraction programmatic and reliable. Markdown-it is renderer-focused, not parser-focused.
- **Why remark-gfm is critical:** Deliverables Tables use GitHub Flavored Markdown table syntax. GFM support is non-negotiable.
- **AST approach:** Parse markdown → get AST → traverse to find table nodes → extract rows → parse into JSON. This is far more robust than regex-based approaches.

**Example workflow:**
```javascript
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

// 1. Extract front matter
const { data: frontMatter, content: markdown } = matter(fileContent);

// 2. Parse markdown to AST
const tree = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .parse(markdown);

// 3. Find Deliverables Table
visit(tree, 'table', (node) => {
  // Extract table rows and parse into deliverable objects
});
```

**Confidence:** HIGH (gray-matter, remark are industry standards)

### File Operations
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| fs/promises | Built-in | File I/O | Native Node.js, async/await support, no dependencies |
| path | Built-in | Path manipulation | Native Node.js, cross-platform path handling |
| os | Built-in | Home directory resolution | Native `os.homedir()` for `~/.claude/dwa/` |

**Rationale:**
- **Why NOT fs-extra:** Modern Node (16+) has `fs/promises` with async/await. No need for external dependency when built-in suffices.
- **Cross-platform:** `path.join()` handles Windows vs Unix path separators automatically
- **Home directory:** `os.homedir()` is the standard for resolving `~` across platforms

**Example:**
```javascript
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const installDir = join(homedir(), '.claude', 'dwa');
await mkdir(installDir, { recursive: true });
await writeFile(join(installDir, 'skill.md'), content);
```

**Confidence:** HIGH (built-in Node.js APIs)

### JSON Schema Validation (Optional but Recommended)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ajv | ^8.12.0 | JSON schema validation | Validate `.dwa/deliverables/DEL-###.json` structure; fast, standard-compliant |

**Rationale:**
- Ensure parsed deliverables conform to expected schema
- Catch malformed tables early
- Provide clear error messages for spec authors
- **Alternative considered:** zod (more TypeScript-native), but ajv is lighter and JSON Schema is an open standard

**When to use:** Validate deliverable JSON after parsing from markdown table, before writing to `.dwa/deliverables/`.

**Confidence:** MEDIUM (optional dependency, but valuable for robustness)

## Supporting Libraries

### Development Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | ^5.3.0 | Type safety | Recommended for maintainability; compile to JS for distribution |
| @types/node | ^20.x | Node.js type definitions | TypeScript development |
| vitest | ^1.2.0 | Testing framework | Fast, modern alternative to Jest; excellent TS support |
| prettier | ^3.1.0 | Code formatting | Consistent style |
| eslint | ^8.56.0 | Linting | Code quality |

**Rationale:**
- **TypeScript:** Strongly recommended for CLI tools with complex parsing logic. Catch errors at compile time, not runtime.
- **vitest over Jest:** Faster, better ESM support, simpler config for modern Node projects
- **Standard tooling:** prettier + eslint are table stakes for professional packages

**Confidence:** HIGH (standard development setup)

## Package Structure (NPM Distribution)

### package.json Structure
```json
{
  "name": "dwa",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "dwa": "./dist/cli.js"
  },
  "files": [
    "dist/",
    "skills/",
    "templates/"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "gray-matter": "^4.0.3",
    "remark": "^15.0.0",
    "remark-parse": "^11.0.0",
    "remark-gfm": "^4.0.0",
    "unist-util-visit": "^5.0.0"
  }
}
```

**Key decisions:**
- **`"type": "module"`**: Use ES modules (modern standard, better tree-shaking)
- **`bin` field**: Makes `npx dwa --install` work
- **`files` field**: Only ship necessary files (dist/, skills/, templates/); keep package size small
- **`engines`**: Enforce Node 20+ for consistency

### Installation Mechanism (How GSD Does It)

**Analysis of GSD reference:**
- GSD installs to `~/.claude/get-shit-done/`
- Structure: `templates/`, `workflows/`, `references/`, `VERSION`
- Files are markdown skill files and JSON configs
- No package.json in install directory (it's not an npm package there, just copied files)

**DWA installation pattern:**
```javascript
// cli.js
import { Command } from 'commander';
import { mkdir, cp } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const program = new Command();

program
  .option('--install', 'Install DWA skills to ~/.claude/dwa')
  .action(async (options) => {
    if (options.install) {
      const installDir = join(homedir(), '.claude', 'dwa');
      const sourceDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

      await mkdir(installDir, { recursive: true });
      await cp(sourceDir, installDir, { recursive: true });

      console.log(`✓ DWA skills installed to ${installDir}`);
    }
  });

program.parse();
```

**Confidence:** HIGH (verified from GSD installation structure)

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI Framework | commander | yargs | More complex API, larger bundle size; commander is sufficient |
| CLI Framework | commander | oclif | Overkill; designed for plugin architectures like Heroku CLI |
| CLI Framework | commander | meow | Too minimal; lacks structured subcommand support |
| Front Matter | gray-matter | js-yaml + manual split | gray-matter handles edge cases, well-tested |
| Markdown Parsing | remark | markdown-it | markdown-it is renderer-focused; remark provides AST for extraction |
| Markdown Parsing | remark | marked | No first-class GFM table support, less robust AST |
| Table Parsing | remark-gfm + AST | Regex on markdown | Regex is fragile with edge cases (multiline cells, escaped pipes) |
| File Operations | fs/promises | fs-extra | Modern Node has async/await built-in; no need for fs-extra |
| Schema Validation | ajv | zod | ajv is lighter, JSON Schema is standard; zod is more TS-native but heavier |

## Installation

### For Development
```bash
# Initialize package
npm init -y

# Core dependencies
npm install commander gray-matter remark remark-parse remark-gfm unist-util-visit

# Optional validation
npm install ajv

# Dev dependencies
npm install -D typescript @types/node vitest prettier eslint
```

### For Users (How They Install DWA)
```bash
# Install skills to ~/.claude/dwa/
npx dwa --install

# Or via global install (if preferred)
npm install -g dwa
dwa --install
```

## Architecture Notes

### File Copying Strategy
- **Source:** `skills/` directory in npm package
- **Destination:** `~/.claude/dwa/`
- **Method:** `fs/promises.cp()` with `{ recursive: true }`
- **Overwrite behavior:** Decide per-file (VERSION always overwrites, user configs preserve?)

### ESM vs CommonJS
**Recommendation:** Use ESM (`"type": "module"`)
- Modern standard
- Better tree-shaking
- Native in Node 20+
- All recommended libraries support ESM

**Migration path if needed:** Package can ship both ESM and CJS builds, but ESM-only is simpler and sufficient for Node 20+.

### TypeScript Compilation
```bash
# tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true
  }
}
```

Compile TS to JS in `dist/`, ship `dist/` in npm package.

## Version Pinning Strategy

**Caret ranges (`^`) recommended:**
- `^12.0.0` allows `12.1.0`, `12.2.0`, but not `13.0.0`
- Safe for minor/patch updates
- Prevents breaking changes from major versions

**Lock file:** Commit `package-lock.json` for reproducible builds.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| CLI Framework (commander) | HIGH | Industry standard, well-established |
| Front Matter (gray-matter) | HIGH | De facto standard, 18M+ weekly downloads |
| Markdown Parsing (remark) | HIGH | Unified ecosystem is standard for AST-based parsing |
| GFM Tables (remark-gfm) | HIGH | Official GFM support, required for table parsing |
| File Operations (Node built-ins) | HIGH | Standard Node.js APIs, proven reliable |
| Package Structure | HIGH | Verified from GSD reference installation |
| Specific Versions | LOW | Unable to verify current npm registry versions; ranges are conservative estimates |

## Sources

**Reference Implementation:**
- GSD installation structure: `/Users/jedwards/.claude/get-shit-done/` (local analysis)
- GSD version: 1.9.13 (verified from VERSION file)

**Library Knowledge:**
- Based on training data (January 2025 cutoff)
- gray-matter: https://github.com/jonschlinkert/gray-matter (de facto standard)
- remark: https://github.com/remarkjs/remark (unified ecosystem)
- commander: https://github.com/tj/commander.js (most popular CLI framework)

**Limitations:**
- Unable to verify latest npm versions via WebSearch (permission denied)
- Version numbers are conservative estimates based on training data
- Recommend verifying versions via `npm view <package> version` before finalizing package.json

## Recommendations for Roadmap

### Phase 1: Package Bootstrap
**Stack implications:**
- Set up package.json with `"type": "module"` and `bin` field
- Install commander, implement `--install` flag
- Test file copying from package to `~/.claude/dwa/`

**Complexity:** LOW (standard npm package setup)

### Phase 2: Markdown Parsing Pipeline
**Stack implications:**
- Install gray-matter, remark, remark-gfm, unist-util-visit
- Build parser: YAML front matter → validate → markdown → AST → table extraction
- Test with Feature Spec Template v2.0

**Complexity:** MEDIUM (AST traversal requires careful logic)

### Phase 3: Deliverable Registry
**Stack implications:**
- Use fs/promises for `.dwa/` directory management
- Optional: Add ajv for JSON schema validation
- Implement idempotent updates (preserve runtime fields)

**Complexity:** MEDIUM (idempotency logic, schema design)

### Tech Debt Avoidance
- **Don't use regex for table parsing:** Fragile with edge cases; AST is robust
- **Don't use fs-extra:** Modern Node has fs/promises; avoid unnecessary deps
- **Don't use CommonJS:** ESM is the future; package should be ESM-first
- **Do version-lock engines:** Prevent users on old Node from broken installs

## Open Questions for Phase-Specific Research

1. **Feature Spec Template v2.0 Schema:** What exact YAML fields and table columns does it define? (Need template to finalize parser)
2. **Idempotency Strategy:** How to merge parsed deliverables with existing `.dwa/deliverables/*.json` (preserve status, PR links)?
3. **Error Handling:** What errors should halt vs. warn? (Malformed table, missing YAML, etc.)
4. **Update Mechanism:** How do users update DWA skills after initial install? (Re-run `--install` vs. `--update` flag?)

---

**Next Steps:**
- Verify latest npm versions for dependencies
- Obtain Feature Spec Template v2.0 to finalize parser schema
- Prototype table extraction with remark-gfm on sample spec
