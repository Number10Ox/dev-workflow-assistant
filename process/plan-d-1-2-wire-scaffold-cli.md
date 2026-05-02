---
name: D-1.2 — Wire DWA `--scaffold` into CLI
status: draft (awaiting review v2)
created: 2026-04-29
parent_plan: ../../ContractProjects/PrimordialAscension/process/plan-m1-bootstrap.md
sibling_plan: ./plan-d-1-1-wire-parse-cli.md
deliverable_id: D-1.2
---

# D-1.2 — Wire `--scaffold` into CLI

## Reframing

Same as D-1.1: framing was "decouple from VSCode" but `src/scaffolding/scaffold.js` has zero `vscode` imports — its deps are `handlebars`, `fs-extra`, `node:path`, `node:child_process`, `write-file-atomic`, `../utils/schema`. The actual gap is that `--scaffold` was never wired in `src/cli.js`. Friction note already canonicalized in D-1.1's Step 4 covers this; no new friction note for D-1.2.

## Verified shapes (Step 0 — investigation done)

**`scaffoldFromTemplate(featureTitle, targetDir)` shape** (`src/scaffolding/scaffold.js:70`):

```js
// Inputs:  featureTitle (required, string), targetDir (path)
// Returns: { specPath, featureJsonPath, gitignoreResult }
//          gitignoreResult = { action: 'exists' | 'appended' | 'created', path }
// Side effects (silent overwrite):
//   - feature-spec.md written via write-file-atomic
//   - .dwa/ created (idempotent), .dwa/feature.json written
//   - .gitignore created or appended with .dwa/ entry
```

**`checkExisting(targetDir)` shape** (`src/scaffolding/check-existing.js`):

```js
// Returns:
//   { alreadyInitialized: boolean,                       // featureJsonExists || specExists  (OR)
//     files: { featureJson: boolean, spec: boolean } }
```

**Verified OR semantics** at `check-existing.js:12`. Partial-init case (only one of the two files present, e.g., from a crashed earlier run) trips the guard — caller refuses by default unless `--force` is passed. No hidden bypass.

**`gitignoreResult.action` semantics** (`src/scaffolding/scaffold.js:34–54`):
- `created` — `.gitignore` did not exist; created with `.dwa/` entry.
- `appended` — `.gitignore` existed without `.dwa/` entry; entry was appended.
- `exists` — `.gitignore` existed and already contained a `.dwa/` entry; no change.

This is **entry-presence based**, not file-presence based — important for the Step 3 smoke expectations.

**No built-in overwrite protection** in `scaffoldFromTemplate`. Protection is the CLI handler's responsibility. `checkExisting()` is the detection primitive.

**Existing test coverage:** `tests/scaffold.test.js` covers `scaffoldFromTemplate`, `checkExisting`, `hasDwaEntry`, `ensureGitignore`. No CLI-level scaffold tests exist.

**Existing skill `/dwa-create-spec`** is the Claude Code skill for interactive scaffolding. It runs from the Claude/VSCode context and prompts for title. CLI-only invocation is what D-1.2 adds.

**`--force` flag context:** `cli.js:13` declares `--force` with description scoped to `--sync-linear`. The scope note is documentation, not enforced. We can broaden the meaning to also apply to `--scaffold`.

## Goal

`npx dwa --scaffold <title>` runs from any terminal. Creates `feature-spec.md`, `.dwa/feature.json`, and updates `.gitignore` in the current directory. Refuses to overwrite existing artifacts unless `--force` is provided. Prints a summary of created/updated paths. Exits 0 on success, non-zero on refusal or error.

## Acceptance criteria

1. CLI accepts `--scaffold <title>` (required value via commander's `<arg>` form).
2. Bare `--scaffold` (no title): commander emits its standard "missing argument" error and exits non-zero. No custom handler logic.
3. `targetDir` passed to `scaffoldFromTemplate` = `process.cwd()`.
4. **Overwrite-protection (default).** Before scaffolding, call `checkExisting(process.cwd())`. If `alreadyInitialized` is `true`, print an actionable error that names which existing file(s) tripped the guard (`feature-spec.md`, `.dwa/feature.json`, or both) and mentions `--force` as the override. Exit 1. (Exact wording is not the contract; *naming the files and mentioning --force* is. The pseudocode in Step 1 is illustrative — smoke verifies the functional contract.)
5. **Overwrite with `--force`.** If `--force` is set, skip the existence check and proceed. Existing files are overwritten by the underlying functions; that's intended given the explicit flag.
6. **Success path.** Stdout prints a multi-line summary that includes the title, the spec path, the feature-json path, and the gitignore action. Exit 0. (Exact format is illustrative pseudocode in Step 1; the contract is "summary contains those four pieces of information.")
7. **`--force` description updated** in `cli.js`. New text: `'Overwrite existing artifacts (scope depends on operation)'`. Per-operation semantics live in README and command docs, not in the help string.
8. **Operations registry agreement:** `{ key: 'scaffold', enabled: opts.scaffold !== undefined }` matches handler gate. Add semantics comment near the option declaration: `--scaffold <title>: opts.scaffold is undefined when absent, string when value provided. Required value form so commander rejects bare flag.`
9. **No regressions.** Existing test suite green vs. baseline (509 tests at last D-1.1 run; baseline may have grown — gate is "no failures introduced," not a fixed count). Run: `npm test`.
10. Manual smoke from non-VSCode terminal completes per Step 3, with explicit assertions on file contents (success path) and unchanged-file checks (refuse path).
11. **`--force` description change verified** — AC 7's new text appears in `--help` output and the old "(requires --sync-linear)" note is gone.

## Out of scope

- New CLI integration test framework. Module-level tests for `scaffoldFromTemplate` and `checkExisting` already exist; CLI handler is a thin wrapper. Smoke covers wiring.
- Interactive title prompt. The Claude skill `/dwa-create-spec` is the interactive path.
- TDD scaffolding (`scaffoldTDD`).
- VSCode extension changes — no contract change.

## Files to modify

- `src/cli.js` —
  - Update `--force` option description.
  - Add `--scaffold <title>` option declaration with semantics comment.
  - Add `{ key: 'scaffold', enabled: opts.scaffold !== undefined }` to operations registry.
  - Add handler block after the `--parse` block (added in D-1.1).

## Files to create

None.

## Steps

### Step 1 — CLI wiring (engineering)

Edits to `src/cli.js`:

1. Update `--force` option description (currently line 13). New text:
   ```js
   .option('--force', 'Overwrite existing artifacts (scope depends on operation)')
   ```

2. Add `--scaffold` option declaration alongside other operations (right after `--parse`, before `--sync-linear`). Include semantics comment:
   ```js
   // --scaffold <title>: opts.scaffold is undefined when absent, string when value provided. Required value form so commander rejects bare flag.
   .option('--scaffold <title>', 'Scaffold a new feature-spec.md and .dwa/ in the current directory')
   ```

3. Add to operations registry (between `parse` and `syncLinear`):
   ```js
   { key: 'scaffold', enabled: opts.scaffold !== undefined },
   ```

4. Add handler block after the `--parse` block (added in D-1.1) and before the `--sync-linear` block. Note the **defensive local re-requires** of `path` and `fs-extra` — node caches modules, cost is zero, and this insulates D-1.2 from any future refactor that might move the top-of-file requires:
   ```js
   } else if (opts.scaffold !== undefined) {
     (async () => {
       try {
         const path = require('node:path');
         const fs = require('fs-extra'); // cached; defensive re-require so D-1.2 doesn't depend on D-1.1's hoisting staying in place
         const { scaffoldFromTemplate } = require('./scaffolding/scaffold');
         const { checkExisting } = require('./scaffolding/check-existing');
         void fs; // present for parity with --parse handler; not used directly here

         const title = opts.scaffold;
         const targetDir = process.cwd();

         if (!opts.force) {
           const existing = await checkExisting(targetDir);
           if (existing.alreadyInitialized) {
             console.error('Error: scaffold target already initialized.');
             if (existing.files.spec) console.error('  - feature-spec.md exists');
             if (existing.files.featureJson) console.error('  - .dwa/feature.json exists');
             console.error('Hint: pass --force to overwrite, or remove existing files first.');
             process.exit(1);
           }
         }

         const result = await scaffoldFromTemplate(title, targetDir);

         console.log(`Scaffolded feature '${title}':`);
         console.log(`  ${path.relative(targetDir, result.specPath)}`);
         console.log(`  ${path.relative(targetDir, result.featureJsonPath)}`);
         console.log(`  .gitignore (${result.gitignoreResult.action})`);
       } catch (err) {
         console.error('Error:', err.message);
         process.exit(1);
       }
     })();
   ```

   (The `void fs` is removable — included only as a hedge if linter complains about unused import. Remove if no warning.)

### Step 2 — Run existing tests

```
cd /Users/jedwards/workspace/JobPrep/DevEx/dev-workflow-assistant && npm test
```

Gate: no failures introduced vs. baseline. (Baseline at last D-1.1 run = 509 tests.) No test changes expected since `scaffoldFromTemplate` and `checkExisting` are unchanged.

### Step 3 — Manual smoke from a non-VSCode terminal

From a plain terminal:

#### Case 1 — Bare invocation (commander rejects)
```
cd /tmp && npx dwa --scaffold
```
Expected: commander's "error: option '--scaffold <title>' argument missing" (or equivalent). Non-zero exit. No output from our handler.

#### Case 2 — Fresh dir scaffold
```
mkdir -p /tmp/dwa-smoke-scaffold && cd /tmp/dwa-smoke-scaffold
npx dwa --scaffold "Smoke Feature"
```
Expected stdout (paths relative):
```
Scaffolded feature 'Smoke Feature':
  feature-spec.md
  .dwa/feature.json
  .gitignore (created)
```
Expected exit 0. Verify file presence: `ls feature-spec.md .dwa/feature.json .gitignore` → all three exist.

`.gitignore (created)` is correct here because `.gitignore` did not exist before this scaffold (per `gitignoreResult.action` semantics — file-creation, not entry-creation).

#### Case 3 — Refuse-on-existing (with explicit unchanged-file check)
```
cd /tmp/dwa-smoke-scaffold

# Capture pre-state hashes so we can prove files are untouched
SPEC_HASH_BEFORE=$(shasum feature-spec.md | awk '{print $1}')
JSON_HASH_BEFORE=$(shasum .dwa/feature.json | awk '{print $1}')

npx dwa --scaffold "Smoke Feature 2"
RC=$?

SPEC_HASH_AFTER=$(shasum feature-spec.md | awk '{print $1}')
JSON_HASH_AFTER=$(shasum .dwa/feature.json | awk '{print $1}')

# Assertions
[ "$RC" -eq 1 ] || echo "FAIL: expected exit 1, got $RC"
[ "$SPEC_HASH_BEFORE" = "$SPEC_HASH_AFTER" ] || echo "FAIL: feature-spec.md changed"
[ "$JSON_HASH_BEFORE" = "$JSON_HASH_AFTER" ] || echo "FAIL: .dwa/feature.json changed"
```
Expected stderr names both files and mentions `--force`. Hashes unchanged. Exit 1.

#### Case 4 — Force-overwrite (with explicit overwrite check)
```
cd /tmp/dwa-smoke-scaffold

SPEC_HASH_BEFORE=$(shasum feature-spec.md | awk '{print $1}')

npx dwa --scaffold "Smoke Feature Forced" --force
RC=$?

# Verify content actually changed
grep -q '"Smoke Feature Forced"' feature-spec.md \
  || echo "FAIL: new title not present in feature-spec.md"
grep -q '"title": "Smoke Feature Forced"' .dwa/feature.json \
  || echo "FAIL: new title not present in .dwa/feature.json"

SPEC_HASH_AFTER=$(shasum feature-spec.md | awk '{print $1}')
[ "$SPEC_HASH_BEFORE" != "$SPEC_HASH_AFTER" ] \
  || echo "FAIL: feature-spec.md hash unchanged after force-overwrite"
[ "$RC" -eq 0 ] || echo "FAIL: expected exit 0, got $RC"
```
Expected stdout matches case 2's shape but with `.gitignore (exists)` — because `.gitignore` already exists *and* contains the `.dwa/` entry (entry-presence semantics, per Verified shapes). Exit 0.

#### Case 5 — Composition smoke (verifies wiring composes; not a parse correctness check)
```
cd /tmp/dwa-smoke-scaffold
npx dwa --parse
echo "parse exit: $?"
```
This case verifies that `--parse` and `--scaffold` *compose* — i.e., the freshly-scaffolded artifacts are loadable by `--parse` without crashing. **It is not a test of parse correctness.** Acceptable outcomes:
- Clean parse (exit 0) — template ships with valid placeholder rows.
- Validation error (exit 1) with clean error output — template ships with placeholder text that isn't strictly parse-clean.

Either outcome counts as composition success. Failure mode that *does* fail this case: an unhandled exception, crash, or non-coherent output. Log the actual outcome in the smoke notes for future reference (it tells us whether the shipped template needs polish).

#### Cleanup
```
rm -rf /tmp/dwa-smoke-scaffold
```

### Step 4 — STATE.md summary line

Append to `.planning/STATE.md` Pending Todos:

> **D-1.2 complete (PA M1):** `npx dwa --scaffold <title>` wired into CLI with `--force` overwrite protection (uses existing `checkExisting` helper; OR-semantics catches partial-init). `--force` description broadened to "Overwrite existing artifacts (scope depends on operation)". Smoke verified across 5 cases including explicit unchanged-file hash checks and force-overwrite content verification. Plan: `process/plan-d-1-2-wire-scaffold-cli.md`.

Update Current Position's "Active dogfood" line to advance D-1.2 → D-1.3.

## Risks / open questions

- **Template content during composition smoke (Case 5).** If the shipped template has empty deliverables-table rows, parse may fail validation. Acceptable per case definition. Failure that *isn't* acceptable: crash or non-coherent output.
- **`--force` semantic broadening.** Going from sync-linear-only to "scope depends on operation" risks confusion if a user reads `--help` and doesn't check per-operation docs. Tradeoff accepted — keeping the description short was the bigger ergonomic win, and per-op docs cover the detail.
- **`writeFileAtomic` overwrite path.** Confirmed silent-overwrite by reading `scaffold.js`. Force path uses this. No issue.
- ~~**Partial-init bypass (one of two files exists).**~~ **Resolved.** `checkExisting.alreadyInitialized = featureJsonExists || specExists` (OR semantics, verified at `check-existing.js:12`). Either file present trips the guard. No bypass.

## Estimate

30–45 minutes including tests run and 5-case smoke. Slightly less than D-1.1 because the pattern is established and `checkExisting` already exists.
