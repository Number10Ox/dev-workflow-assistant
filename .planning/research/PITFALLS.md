# Domain Pitfalls

**Domain:** Dev workflow tools + Claude Code skills packages
**Project:** DWMF (Markdown spec parser → JSON registry → Linear sync → GSD packets)
**Researched:** 2026-01-24

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Markdown Table Parsing Assumes Consistent Formatting

**What goes wrong:** Markdown table parsers often hardcode assumptions about pipe alignment, whitespace, or column count. Real-world specs have inconsistent formatting: missing pipes, trailing spaces, merged cells (via colspan syntax), empty cells, pipes inside cell content (code blocks, URLs), and varying column widths.

**Why it happens:**
- Developers test with pretty-printed tables from markdown generators
- GitHub/VS Code markdown preview is forgiving and renders malformed tables correctly
- CommonMark spec allows significant formatting variation

**Consequences:**
- Parser silently skips malformed rows (data loss)
- Parser throws on first malformed table, blocking entire spec import
- Column misalignment causes data to land in wrong JSON fields
- Deliverable IDs extracted incorrectly (e.g., "DEL-001" becomes "DEL" if pipe is missing)

**Prevention:**
1. **Use a battle-tested markdown AST library** (e.g., `remark`, `markdown-it`) instead of regex parsing
2. **Normalize input before parsing**: Trim whitespace, ensure consistent pipe placement
3. **Validate table structure explicitly**: Check column count per row, detect alignment rows
4. **Handle edge cases explicitly**:
   - Escaped pipes: `\|` inside cell content
   - Code blocks inside cells: `` `foo|bar` ``
   - Empty cells: `| | value |` vs `|| value |`
   - Trailing pipes: `| A | B |` vs `| A | B`
5. **Test with malformed input**: Copy-paste from Google Docs, manual edits, mobile typing
6. **Fail loudly with line numbers**: "Table parse error at line 42: expected 5 columns, found 3"

**Detection:**
- Unit tests fail when fed real-world spec samples
- User reports "some deliverables missing from registry"
- Deliverable count doesn't match visible table rows
- JSON fields contain content from adjacent columns

**Phase mapping:** Phase 1 (Core parsing) must include comprehensive table parsing tests with malformed inputs.

---

### Pitfall 2: YAML Front Matter Encoding/Special Characters Break Parsing

**What goes wrong:** YAML front matter contains user-generated text (titles, descriptions, author names) with special characters: quotes, colons, pipes, emoji, non-ASCII Unicode, Windows line endings (CRLF). Standard YAML parsers throw errors or silently corrupt data.

**Why it happens:**
- YAML is whitespace/character-sensitive (`:` has special meaning, `"` needs escaping)
- Users copy-paste from other tools (Notion, Slack, Google Docs) with smart quotes, em-dashes
- International names/content with diacritics, CJK characters
- Windows-created files have `\r\n` line endings that break multiline YAML strings

**Consequences:**
- `yaml.parse()` throws "unexpected character" errors, blocking spec import
- Colons in titles (e.g., "Feature: User Authentication") break key-value parsing
- Emoji in descriptions corrupt encoding: "Add 🚀 button" becomes garbled
- Multi-line descriptions lose formatting or fail to parse

**Prevention:**
1. **Use a forgiving YAML parser** with error recovery (e.g., `js-yaml` with `{json: true}` mode)
2. **Normalize line endings** before parsing: Convert `\r\n` → `\n`
3. **Validate YAML structure** with schema validation (e.g., `ajv`, `zod`)
4. **Escape user content** or use block scalar syntax (`|` or `>`) for multiline fields
5. **Test with problematic content**:
   - Titles with colons: "Feature: Auth System"
   - Quotes: "User's Profile"
   - Emoji: "Add 🎉 celebration"
   - CJK: "機能追加"
   - Windows line endings
6. **Provide clear error messages** with line/column position
7. **Consider TOML or JSON front matter** as alternatives (more forgiving)

**Detection:**
- Parser throws on real-world specs that render fine in preview
- Metadata fields contain truncated or corrupted text
- Non-ASCII characters display as `�` or mojibake
- Multi-line descriptions collapse into single line

**Phase mapping:** Phase 1 (Core parsing) must validate encoding handling. Phase 3 (Import from Google Docs) is high-risk for encoding issues.

---

### Pitfall 3: JSON File Registry Race Conditions on Concurrent Writes

**What goes wrong:** Multiple operations write to JSON files simultaneously (e.g., parsing spec + syncing Linear status + updating PR link). Without locking, last-write-wins causes data loss. Git operations (status, diff) hold file handles that block writes.

**Why it happens:**
- Node.js I/O is async; two `fs.writeFile()` calls can interleave
- Claude Code may spawn parallel tool invocations
- User runs CLI command while VS Code extension syncs in background
- Git commands (`git status`, `git diff`) acquire read locks on working tree files

**Consequences:**
- Partial updates lost: Status updated but PR link missing
- JSON corruption: File written mid-transaction contains `}{` or truncated JSON
- Registry out of sync with Linear: Issue created but not recorded locally
- File lock errors: "EBUSY: resource busy or locked"

**Prevention:**
1. **Implement file locking** with `proper-lockfile` or similar:
   ```typescript
   const lockfile = require('proper-lockfile');
   const release = await lockfile.lock(filePath, {retries: 5});
   try {
     // Read, modify, write
   } finally {
     await release();
   }
   ```
2. **Use atomic writes** with temp file + rename:
   ```typescript
   await fs.writeFile(tmpPath, data);
   await fs.rename(tmpPath, targetPath); // Atomic on POSIX
   ```
3. **Read-modify-write in single transaction**:
   - Lock → read → merge changes → write → unlock
   - Never read at start of function and write at end (stale data)
4. **Retry on EBUSY/EAGAIN** with exponential backoff
5. **Centralize registry writes** through single module/function (easier to control concurrency)
6. **Queue writes** instead of concurrent execution
7. **Test concurrent scenarios**:
   - Two processes updating different fields simultaneously
   - Write during git status/diff
   - Rapid successive updates (parse → sync → update loop)

**Detection:**
- JSON parse errors when reading registry: "Unexpected token }"
- Fields randomly revert to old values
- File lock timeout errors in logs
- Deliverable count mismatches between files
- Git reports "file changed" but no visible diff

**Phase mapping:** Phase 2 (Registry operations) must implement locking before any parallel operations. Phase 4 (Linear sync) high-risk for concurrent writes.

---

### Pitfall 4: Linear API Rate Limits Cause Silent Failures

**What goes wrong:** Linear API has rate limits (150 req/min for personal tokens, higher for OAuth). Bulk operations (syncing 50 deliverables) hit limits. API returns 429 but tool doesn't retry, causing partial syncs. User sees some issues created, others missing, no error message.

**Why it happens:**
- Batch operations loop through deliverables without rate limit awareness
- No retry logic on 429 responses
- API client doesn't track request count
- GraphQL queries can trigger multiple sub-requests

**Consequences:**
- Partial sync: First 20 issues created, remaining 30 silently skipped
- Registry believes sync succeeded (no error thrown)
- User discovers missing issues hours later
- Re-running sync creates duplicates (no idempotency)

**Prevention:**
1. **Implement exponential backoff** on 429 responses:
   ```typescript
   async function apiCall(query, retries = 3) {
     try {
       return await linearClient.query(query);
     } catch (err) {
       if (err.status === 429 && retries > 0) {
         const delay = Math.pow(2, 3 - retries) * 1000;
         await sleep(delay);
         return apiCall(query, retries - 1);
       }
       throw err;
     }
   }
   ```
2. **Batch with rate limiting**: Use `p-limit` or `bottleneck` to limit concurrent requests:
   ```typescript
   const pLimit = require('p-limit');
   const limit = pLimit(5); // Max 5 concurrent requests
   await Promise.all(deliverables.map(d => limit(() => syncToLinear(d))));
   ```
3. **Check rate limit headers** and preemptively delay:
   - `X-RateLimit-Remaining`
   - `X-RateLimit-Reset`
4. **Use bulk mutations** where available (Linear supports batching)
5. **Implement idempotency** with external IDs:
   - Set `externalId: "DEL-001"` on issue creation
   - Check if issue exists before creating: `query { issues(filter: {externalId: {eq: "DEL-001"}}) }`
6. **Log rate limit hits** and surface to user
7. **Test at scale**: Mock API with 429 responses after N requests

**Detection:**
- User reports "some issues missing in Linear"
- Logs show 429 errors but no retries
- Registry has `linearIssueId: null` for some deliverables
- Duplicate issues created on second sync
- API calls timeout or fail silently

**Phase mapping:** Phase 4 (Linear sync) must implement rate limiting and retries before batch operations.

---

### Pitfall 5: Claude Code Skills Assume Tool Availability

**What goes wrong:** Skills invoke MCP tools (Linear, Google Drive) assuming they're installed and configured. If tools missing, skill fails cryptically. User doesn't know they need to install `dev-workflow-assistant` extension first.

**Why it happens:**
- Claude Code skills are just markdown files with prompts
- No dependency declaration or runtime checks
- User installs DWMF package but not VS Code extension
- MCP servers fail to start (config error, auth expired)

**Consequences:**
- Skill invocation fails: "Tool not found: mcp__linear__create_issue"
- No helpful error message directing user to install dependencies
- User thinks DWMF is broken, abandons project
- Debugging requires checking Claude Code logs (non-obvious)

**Prevention:**
1. **Document dependencies prominently** in README and installation output:
   ```
   DWMF requires the following MCP servers:
   - dev-workflow-assistant (Linear + Google Drive)

   Install: [link to setup guide]
   ```
2. **Check tool availability** at skill initialization:
   ```typescript
   // In skill prompt
   <instructions>
   1. First check if Linear MCP is available:
      - Try: mcp__linear__get_viewer
      - If fails: Explain user needs to install dev-workflow-assistant
   2. Then proceed with workflow
   </instructions>
   ```
3. **Fail fast with helpful errors**:
   - "Linear MCP not found. Install dev-workflow-assistant: [link]"
   - "Google Drive auth expired. Run: dwmf --setup-google-drive"
4. **Provide setup wizard** that validates dependencies:
   ```bash
   npx dwmf --install
   # Checks:
   # ✓ Claude Code detected
   # ✗ Linear MCP not found → Install dev-workflow-assistant?
   # ✓ Google Drive MCP configured
   ```
5. **Graceful degradation**: Allow core features (parsing, registry) to work without integrations
6. **Test without dependencies**: Run skills with MCP servers disabled

**Detection:**
- User reports "Linear sync doesn't work"
- Logs show "Unknown tool: mcp__linear__*"
- Skill execution stops after first tool call attempt
- No error message visible in UI

**Phase mapping:** Phase 7 (Installation/setup) must validate dependencies. Phase 4 (Linear sync) needs graceful fallback if MCP unavailable.

---

### Pitfall 6: Schema Evolution Breaks Existing Registry Files

**What goes wrong:** You add new fields to deliverable JSON schema (e.g., `priority`, `dependencies`). Old registry files lack these fields. Code expects fields to exist, throws "Cannot read property 'priority' of undefined". User's existing data becomes unusable.

**Why it happens:**
- No schema version tracking in JSON files
- Code doesn't handle missing optional fields
- No migration script for old data
- Breaking changes deployed without upgrade path

**Consequences:**
- Existing projects break after DWMF update
- User must manually edit JSON files to add missing fields
- Data loss if migration doesn't preserve old fields
- Users pin to old version, missing new features

**Prevention:**
1. **Version your schema** in every JSON file:
   ```json
   {
     "schemaVersion": "2.1.0",
     "deliverableId": "DEL-001",
     ...
   }
   ```
2. **Implement migrations** on read:
   ```typescript
   function loadDeliverable(path) {
     const data = JSON.parse(fs.readFileSync(path));
     return migrateToLatest(data);
   }

   function migrateToLatest(data) {
     if (!data.schemaVersion) return migrateV1toV2(data);
     if (data.schemaVersion === "2.0.0") return migrateV2toV2_1(data);
     return data;
   }
   ```
3. **Backward compatible additions**:
   - New fields are optional with defaults
   - Never remove or rename fields (deprecate instead)
   - Use `field_v2` instead of changing `field` semantics
4. **Validate schema on load** with runtime checks (Zod, AJV):
   ```typescript
   const DeliverableSchema = z.object({
     schemaVersion: z.string(),
     deliverableId: z.string(),
     priority: z.enum(['P0', 'P1', 'P2']).optional(),
     // ...
   });
   ```
5. **Run migration on install**: `dwmf --migrate` command
6. **Test upgrade paths**: Load v1 JSON, verify it works with v2 code
7. **Document breaking changes** in CHANGELOG

**Detection:**
- Errors reading registry after upgrade: "undefined property"
- Old projects don't load after installing new version
- Fields show `undefined` in UI/output
- Unit tests pass but integration tests fail with existing data

**Phase mapping:** Phase 2 (Registry format) must include schema versioning from day 1. Phase 6+ (any schema changes) must include migrations.

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 7: Markdown Parser Doesn't Handle Nested Structures

**What goes wrong:** Deliverables Table contains nested markdown (lists, code blocks, links inside cells). Parser extracts raw text, losing structure. Acceptance criteria become unreadable single line.

**Why it happens:**
- Table parser only extracts cell text content, ignores inline formatting
- Nested lists (`- Item 1\n  - Subitem`) collapse to "Item 1 Subitem"
- Code blocks lose syntax highlighting info

**Prevention:**
- Use AST-based parsing (remark) to preserve inline nodes
- Convert nested structures to JSON representation:
  ```json
  "acceptanceCriteria": [
    {"type": "list", "items": ["AC1", "AC2"]},
    {"type": "code", "lang": "typescript", "content": "..."}
  ]
  ```
- Provide markdown→HTML conversion for display
- Test with complex cell content

**Detection:**
- AC/QA notes display as unformatted wall of text
- Code blocks lose indentation
- Links show as `[text](url)` instead of rendering

**Phase mapping:** Phase 1 (Parsing) - consider if needed for MVP. Defer if specs don't use nested content.

---

### Pitfall 8: Linear Field Mapping Assumptions Break

**What goes wrong:** Code assumes Linear workspace has specific fields (Status, Priority, Labels). User's workspace uses different field names or types. Sync fails or creates issues with wrong data.

**Why it happens:**
- Linear allows custom field names per workspace
- Status values vary: "Todo/In Progress/Done" vs "Backlog/Active/Shipped"
- Priority might be numeric vs enum vs missing entirely

**Prevention:**
1. **Query workspace schema** before sync:
   ```graphql
   query {
     organization {
       teams { id name }
     }
     workflowStates { id name type }
   }
   ```
2. **User config for field mapping**:
   ```json
   {
     "linear": {
       "statusMapping": {
         "TODO": "Backlog",
         "IN_PROGRESS": "In Progress",
         "DONE": "Done"
       }
     }
   }
   ```
3. **Validate mappings** before bulk sync
4. **Graceful fallback**: Skip optional fields if not available

**Detection:**
- Sync fails with "Invalid status value"
- Issues created with wrong status
- Labels don't appear on issues

**Phase mapping:** Phase 4 (Linear sync) should query schema. Phase 7 (Setup) can generate config with detected fields.

---

### Pitfall 9: GSD Execution Packets Exceed Context Limits

**What goes wrong:** Packet includes entire spec content + all related deliverables + full file tree. Token count exceeds Claude's context limit. GSD execution fails or truncates critical context.

**Why it happens:**
- Developer copies all related content "to be helpful"
- Specs are verbose (10-20 pages)
- File trees for large projects (1000+ files)

**Prevention:**
1. **Extract only relevant content**:
   - Single deliverable's AC/QA notes (not entire spec)
   - Files mentioned in deliverable context (not all files)
   - Related deliverable IDs (not full content)
2. **Summarize large sections**:
   - Spec overview: 3-4 paragraphs max
   - Related deliverables: Title + ID + status only
3. **Link instead of embed**:
   - "See full spec: [path/to/spec.md]"
   - GSD can read files on demand
4. **Token budget awareness**:
   - Count tokens before generation (use `tiktoken`)
   - Warn if packet >50k tokens
5. **Test with large specs**: 50+ deliverables, complex AC

**Detection:**
- GSD fails to start: "Context too large"
- Packet generation times out
- Packets are 100+ KB markdown files
- GSD responses reference wrong context (truncation)

**Phase mapping:** Phase 5 (GSD packet generation) must enforce token budgets.

---

### Pitfall 10: npm Package Installation Path Assumptions

**What goes wrong:** Install script writes to `~/.claude/dwmf/` but `~` expands differently on Windows vs Unix. Windows uses `%USERPROFILE%`, leading to path resolution failures. Skills installed to wrong location, Claude Code doesn't find them.

**Why it happens:**
- `~` is shell expansion, not Node.js built-in
- Windows path separators (`\` vs `/`)
- Permission differences (macOS/Linux vs Windows)

**Prevention:**
1. **Use `os.homedir()`** instead of `~`:
   ```typescript
   const path = require('path');
   const os = require('os');
   const installPath = path.join(os.homedir(), '.claude', 'dwmf');
   ```
2. **Use `path.join()`** for all path construction (handles separators)
3. **Check permissions** before write:
   ```typescript
   try {
     await fs.access(installPath, fs.constants.W_OK);
   } catch {
     throw new Error(`No write permission: ${installPath}`);
   }
   ```
4. **Test on Windows + Mac + Linux**:
   - Run install in CI for all platforms
   - Verify skills directory structure matches expected
5. **Handle spaces in paths**: `C:\Users\John Doe\.claude\`

**Detection:**
- Installation succeeds but skills don't appear in Claude Code
- Path errors on Windows: "Cannot find module..."
- Permission denied errors on Linux without sudo
- Skills in wrong directory: `/Users/user/~/.claude/` (literal `~`)

**Phase mapping:** Phase 7 (Installation) must test cross-platform before release.

---

### Pitfall 11: Idempotency Failure Causes Duplicate Issues

**What goes wrong:** Running sync twice creates duplicate Linear issues. No mechanism to detect "this deliverable already has an issue." User ends up with DEL-001 created 3 times.

**Why it happens:**
- Sync doesn't check registry before creating issue
- No unique constraint (Linear doesn't dedupe by title)
- Error during initial sync → retry creates duplicates

**Prevention:**
1. **Store `linearIssueId` in registry** after creation:
   ```json
   {
     "deliverableId": "DEL-001",
     "linearIssueId": "ISS-123",
     ...
   }
   ```
2. **Check before create**:
   ```typescript
   if (deliverable.linearIssueId) {
     return updateLinearIssue(deliverable.linearIssueId);
   } else {
     return createLinearIssue(deliverable);
   }
   ```
3. **Use Linear's `externalId`** field for mapping:
   ```graphql
   mutation {
     issueCreate(input: {
       teamId: "...",
       title: "...",
       externalId: "DEL-001"  # Unique constraint
     })
   }
   ```
4. **Query before create** using externalId
5. **Test retry scenarios**: Fail after issue creation but before registry update

**Detection:**
- Multiple Linear issues with same title
- Registry missing `linearIssueId` after sync
- User reports "duplicates after error"

**Phase mapping:** Phase 4 (Linear sync) must implement idempotency from start.

---

### Pitfall 12: Drift Detection False Positives

**What goes wrong:** Drift check reports spec/registry out of sync even when they match. Whitespace differences, reordering, or case sensitivity cause false alarms. User loses trust in drift detection.

**Why it happens:**
- String comparison instead of semantic comparison
- Markdown formatting variations (extra spaces, line breaks)
- Field order in JSON changes but content identical
- Case differences: "TODO" vs "Todo"

**Prevention:**
1. **Normalize before comparison**:
   - Trim whitespace
   - Sort arrays consistently
   - Lowercase string comparisons where appropriate
2. **Semantic diffing**:
   - Compare parsed structures, not raw text
   - Deep equality for objects
3. **Ignore non-semantic changes**:
   - Field order in JSON
   - Trailing newlines
   - Comment additions/removals
4. **Show concrete diff** instead of binary "drift detected":
   ```diff
   - Acceptance Criteria: User can login
   + Acceptance Criteria: User can log in with email
   ```
5. **Test with formatting variations**: Same content, different whitespace

**Detection:**
- Drift report shows differences but manual inspection reveals none
- User ignores drift warnings (alert fatigue)
- Drift check always reports changes after sync

**Phase mapping:** Phase 6 (Drift detection) must use semantic comparison, not string diff.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 13: Git Merge Conflicts in JSON Registry

**What goes wrong:** Two branches modify same deliverable JSON file. Git merge conflict markers (`<<<<<<<`) break JSON parsing. User must manually resolve.

**Why it happens:**
- JSON is not merge-friendly (no line-based semantics)
- Concurrent updates in different branches
- No automatic conflict resolution

**Prevention:**
1. **One file per deliverable** (reduces conflict surface):
   - `.dwa/deliverables/DEL-001.json`
   - `.dwa/deliverables/DEL-002.json`
2. **Provide merge tool** or resolution guide:
   ```bash
   dwmf --resolve-conflicts
   # Parses both versions, merges non-conflicting fields
   ```
3. **Document merge process** in README
4. **Consider append-only event log** instead of mutable JSON (advanced)

**Detection:**
- JSON parse errors after git merge
- Conflict markers in registry files
- User asks "how to fix merge conflicts in .dwa/"

**Phase mapping:** Phase 2 (Registry design) - one file per deliverable reduces risk. Document in Phase 7.

---

### Pitfall 14: Template Scaffolding Overwrites Existing Spec

**What goes wrong:** User runs scaffold command in directory with existing spec. Command overwrites `FEATURE-SPEC.md` without warning. Work lost.

**Why it happens:**
- No check for existing files before write
- No confirmation prompt

**Prevention:**
1. **Check before overwrite**:
   ```typescript
   if (fs.existsSync(specPath)) {
     const answer = await prompt('Spec exists. Overwrite? (y/n)');
     if (answer !== 'y') return;
   }
   ```
2. **Offer to merge** or create new version: `FEATURE-SPEC-v2.md`
3. **Add `--force` flag** for non-interactive overwrite
4. **Back up before overwrite**: Save to `FEATURE-SPEC.md.backup`

**Detection:**
- User reports "my spec disappeared"
- Scaffold command doesn't ask permission
- Git diff shows entire spec replaced

**Phase mapping:** Phase 3 (Scaffolding) must add overwrite protection.

---

### Pitfall 15: Error Messages Don't Include Fix Instructions

**What goes wrong:** Error message says "YAML parse error at line 23" but doesn't explain how to fix it. User struggles to debug.

**Why it happens:**
- Generic error handling: `catch (err) { console.error(err.message); }`
- No context about what was being parsed
- No suggestions for common mistakes

**Prevention:**
1. **Wrap errors with context**:
   ```typescript
   try {
     yaml.parse(frontMatter);
   } catch (err) {
     throw new Error(
       `YAML front matter invalid at line ${err.line}:\n` +
       `${err.message}\n\n` +
       `Common fixes:\n` +
       `- Escape colons in titles: "title: \\"Feature: Auth\\\""\n` +
       `- Use block scalars for multiline: "description: |"\n` +
       `- Check for unclosed quotes\n\n` +
       `See: docs/yaml-troubleshooting.md`
     );
   }
   ```
2. **Include file path + line number** in all errors
3. **Link to troubleshooting docs**
4. **Suggest automatic fixes** where possible:
   - "Run: dwmf --fix-yaml"
   - "Run: dwmf --validate-spec"

**Detection:**
- User reports "error but don't know how to fix"
- GitHub issues asking "what does this error mean?"
- Error messages just stack traces

**Phase mapping:** All phases - wrap errors on write. Dedicated "error DX" pass in Phase 7.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Core Parsing | Pitfall 1 (table parsing), Pitfall 2 (YAML encoding) | Use remark + js-yaml, test malformed inputs, normalize encoding |
| Phase 2: Registry Format | Pitfall 3 (race conditions), Pitfall 6 (schema evolution) | Implement locking + schema versioning from start |
| Phase 3: Scaffolding | Pitfall 14 (overwrite), Pitfall 2 (template encoding) | Check existing files, test templates with special chars |
| Phase 4: Linear Sync | Pitfall 4 (rate limits), Pitfall 8 (field mapping), Pitfall 11 (idempotency) | Rate limiter + retry logic, query workspace schema, use externalId |
| Phase 5: GSD Packets | Pitfall 9 (context limits) | Token budgeting, extract only relevant context |
| Phase 6: Drift Detection | Pitfall 12 (false positives) | Semantic comparison, normalize before diff |
| Phase 7: Installation | Pitfall 5 (tool availability), Pitfall 10 (path assumptions) | Dependency validation wizard, use os.homedir() |

---

## Sources

**Confidence level: MEDIUM**

This research draws on:
- **Domain expertise**: My training includes extensive knowledge of markdown parsing libraries (remark, markdown-it), YAML parsing challenges, file system concurrency patterns, Linear API documentation, and Claude Code skills architecture
- **Project context**: Specific risks identified from DWMF's architecture (.dwa/ registry, Linear sync, GSD packets, npm installation)
- **Known pitfall patterns**: Common mistakes in similar dev tools (markdown-based project management, file-based registries, API integrations)

**Verification limitations**:
- WebSearch unavailable for current (2026) blog posts about recent pitfalls
- Linear API documentation not verified via Context7 or WebFetch (assumed unchanged from training)
- Claude Code skills best practices not verified against official 2026 docs

**Recommendations for validation**:
- Verify Linear API rate limits with official docs: https://developers.linear.app/docs/graphql/working-with-the-graphql-api#rate-limiting
- Check remark markdown parsing docs for latest table parsing capabilities
- Review Claude Code MCP tool invocation patterns for dependency checking
- Test all identified pitfalls with real-world scenarios during Phase 1-2

---

**Note to roadmap creator**: Pitfalls 1-6 are critical and must be addressed in their respective phases BEFORE moving to next phase. Pitfalls 7-12 can be deferred if timeline-constrained. Pitfalls 13-15 are polish items for post-MVP.
