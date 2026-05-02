---
name: D-1.1 — Wire DWA `--parse` into CLI
status: draft (awaiting review v2)
created: 2026-04-29
parent_plan: ../../ContractProjects/PrimordialAscension/process/plan-m1-bootstrap.md
deliverable_id: D-1.1
---

# D-1.1 — Wire `--parse` into CLI

## Reframing

Initial framing (from M1 bootstrap) was "decouple `--parse` from VSCode," parallel to Phase 7.3's Linear decoupling. Investigation (2026-04-29) shows `src/commands/parse.js` (`runParse`) and its dependency chain (`parse-spec.js`, `validate.js`, `registry.js`, `hash-content.js`, `schema.js`) have **zero `vscode` imports**. The implementation is already universal-runtime. The actual gap: `--parse` is not wired in `src/cli.js`. Phase 7.3 wired `--sync-linear`; this wires `--parse` analogously.

Friction note for `.planning/STATE.md` is canonicalized in Step 4 below.

## Verified shapes (Step 0 — investigation done)

Confirmed before drafting the handler so AC field names are a hard contract, not a sketch.

**`runParse(specPath, projectDir)` returns** (per `tests/parse-command.test.js` and `src/commands/parse.js`):

```js
{
  success: boolean,
  summary: { parsed, created, updated, unchanged, orphaned } | null,
  errors:  ValidationError[],   // each: { code, message, line } — line may be null
  warnings: string[]            // plain strings, per parseSpec JSDoc (line 103)
}
```

**`ValidationError`** (`src/parser/validate.js:14`): class with `code`, `message`, `line` (nullable). Has a `toString()` formatter producing `${code} Line ${line}: ${message}` when line present.

**Behavior in directory without `.dwa/`:** `runParse` (and downstream `updateRegistry`) auto-creates `.dwa/deliverables/`. Verified by `parse-command.test.js:92–100` ("creates .dwa/deliverables directory"). No CLI-side guard or pre-init check needed.

**Dependencies:** `fs-extra@^11` already in `package.json:39`. `commander@^12` at line 34. No new deps needed.

**Fixtures:** `tests/fixtures/` contains only `test-tdd.md`. No reusable feature-spec fixture exists. Smoke step will inline a minimal valid spec (the same shape as `VALID_SPEC` in `parse-command.test.js`).

## Goal

`npx dwa --parse [path]` runs from any terminal. Default `path` = `feature-spec.md` in the current directory. Parses spec → updates registry under `./.dwa/deliverables/`. Prints human-readable summary using verified field names. Exits 0 on success, non-zero on error.

## Acceptance criteria

1. CLI accepts `--parse [spec-path]` (optional positional value, commander's `[arg]` form).
2. Default spec path = `path.join(process.cwd(), 'feature-spec.md')` if no value provided.
3. Project root passed to `runParse` = `process.cwd()`.
4. **Success path:** stdout prints `Parsed N deliverable(s): C created, U updated, X unchanged, O orphaned` using `result.summary.{parsed, created, updated, unchanged, orphaned}` (locked names — see "Verified shapes"). Warnings (if any) print to stderr as `Warning: <text>`. Exits 0.
5. **Validation errors:** prints each error to stderr as `[CODE] [Line N: ]<message>` using `ValidationError.toString()` (or equivalent format using `code`, `line`, `message` fields). Exits 1.
6. **Missing spec file:** prints actionable error including the resolved path; refers user to `templates/feature-spec-v2.hbs` for the template (no reference to `--scaffold`, which D-1.2 will add and could rot this hint). Exits 1.
7. **Multi-operation guard:** existing centralized operations registry (`cli.js:32–43`) catches `--parse` combined with another op; no new guard needed. Add the entry consistently with peers.
8. **Operations-registry/handler agreement:** option declaration includes a one-line comment noting `opts.parse` semantics (`true` when bare flag, `string` when value, `undefined` when absent), so the registry's `enabled: opts.parse !== undefined` and the handler's `else if (opts.parse !== undefined)` stay in sync if anyone touches one.
9. **Idempotency on re-parse:** running `--parse` twice on identical input produces `0 created, 0 updated, N unchanged` exactly. Any `created` or `updated` count > 0 indicates a hash-detection bug; fail the smoke and investigate.
10. Friction note (per Step 4) appended to `.planning/STATE.md`. Not optional.
11. Existing test suite (368+) green: `npm test` from DWA repo root.
12. Manual smoke from a non-VSCode terminal completes per Step 3.

## Out of scope

- D-1.2 (`--scaffold` wiring) — sibling deliverable, same pattern.
- New CLI integration test framework. `tests/parse-command.test.js` covers `runParse` directly; the new CLI handler is a thin wrapper. Smoke verification covers the wiring. Matches the test posture used for `--sync-linear` in Phase 7.3.
- Multi-feature support (Phase B, post-M1).
- Refactoring the existing operations-routing if/else chain in `cli.js` (pre-existing pattern; out of scope).
- VSCode extension changes — no contract change.

## Files to modify

- `src/cli.js` — add `--parse [spec-path]` option, operations-registry entry, handler block. Hoist new `require()` calls to top of file (alongside existing top-level `commander` and `package.json` requires) so any load-time failure surfaces obviously rather than being swallowed by a misleading "command not available" catch.

## Files to create

None.

## Steps

### Step 1 — CLI wiring (engineering)

Edits to `src/cli.js`:

1. Add option declaration alongside other operations (around line 14–25). Include the semantics comment:
   ```js
   // --parse [spec-path]: opts.parse is undefined when absent, true when bare flag, string when value provided.
   .option('--parse [spec-path]', 'Parse feature-spec.md and update .dwa/deliverables/ registry')
   ```

2. Add to the operations registry (lines 32–43):
   ```js
   { key: 'parse', enabled: opts.parse !== undefined },
   ```

3. Hoist requires to top of file (next to existing top-level `commander` import). Add:
   ```js
   const path = require('node:path');
   const fs = require('fs-extra');
   ```
   (May already be imported elsewhere — check before duplicating.)

4. Add handler block after the existing `--sync-linear` block (after line 113). Use the locked shapes:
   ```js
   } else if (opts.parse !== undefined) {
     (async () => {
       try {
         const { runParse } = require('./commands/parse');

         const specPath = (typeof opts.parse === 'string' && opts.parse.length > 0)
           ? path.resolve(process.cwd(), opts.parse)
           : path.join(process.cwd(), 'feature-spec.md');

         if (!await fs.pathExists(specPath)) {
           const rel = path.relative(process.cwd(), specPath) || specPath;
           console.error(`Error: ${rel} not found`);
           console.error('Hint: create a feature-spec.md from templates/feature-spec-v2.hbs in the DWA package.');
           process.exit(1);
         }

         const result = await runParse(specPath, process.cwd());

         for (const w of result.warnings) {
           console.error(`Warning: ${w}`);
         }

         if (!result.success) {
           console.error('Parse failed:');
           for (const err of result.errors) {
             const linePart = err.line ? ` Line ${err.line}:` : '';
             console.error(`  [${err.code}]${linePart} ${err.message}`);
           }
           process.exit(1);
         }

         const s = result.summary;
         console.log(
           `Parsed ${s.parsed} deliverable(s): ${s.created} created, ${s.updated} updated, ${s.unchanged} unchanged, ${s.orphaned} orphaned`
         );
       } catch (err) {
         console.error('Error:', err.message);
         process.exit(1);
       }
     })();
   ```

   Note: no `MODULE_NOT_FOUND` special case. If `./commands/parse` is missing, that's a broken-install state; the generic catch surfaces it accurately.

### Step 2 — Run existing tests

```
cd /Users/jedwards/workspace/JobPrep/DevEx/dev-workflow-assistant && npm test
```

All 368+ tests must remain green. No test changes expected since `runParse` itself isn't changing.

### Step 3 — Manual smoke from a non-VSCode terminal

From a plain terminal (Claude Code Bash counts as non-VSCode):

1. `mkdir -p /tmp/dwa-smoke-parse && cd /tmp/dwa-smoke-parse`
2. Write a minimal valid spec at `./feature-spec.md`:
   ```yaml
   ---
   feature_id: FEAT-2026-999
   title: "Smoke Spec"
   owner: "smoke@local"
   status: Draft
   spec_schema_version: v2.0
   ---

   # Feature Spec: Smoke

   ## 3) Work Breakdown (Deliverables = unit of execution)

   ### 3.1 Deliverables Table (required)

   | Deliverable ID | User Story | Description | Acceptance Criteria (testable) | QA Plan Notes | Dependencies (DEL-###) | Linear Issue URL (auto) |
   |---|---|---|---|---|---|---|
   | DEL-001 | As a tester | Smoke deliverable | Given parse, when run, then registry exists | Manual | | |
   ```
3. Run `npx dwa --parse` (no arg → default path).
   - Expected stdout: `Parsed 1 deliverable(s): 1 created, 0 updated, 0 unchanged, 0 orphaned`
   - Expected exit: 0
   - Expected: `.dwa/deliverables/DEL-001.json` exists
4. Run `npx dwa --parse` again.
   - Expected stdout: `Parsed 1 deliverable(s): 0 created, 0 updated, 1 unchanged, 0 orphaned` exactly. Any `created>0` or `updated>0` is a hash bug — fail and investigate.
5. Run `npx dwa --parse ./feature-spec.md` (explicit path).
   - Expected: same as step 4.
6. `cd /tmp && npx dwa --parse`
   - Expected: actionable "not found" error, exit 1.
7. Cleanup: `rm -rf /tmp/dwa-smoke-parse`.

### Step 4 — Friction note (canonical text)

Append to `.planning/STATE.md` Pending Todos section. **This is the canonical wording; no other section duplicates it:**

> **2026-04-29 (M1 dogfood) — framing audit:** Phase 7.3's framing was "decouple from VSCode," but the parse/scaffold gaps that surfaced post-7.3 turned out to be CLI-wiring gaps, not coupling gaps. Implementation modules (`src/commands/parse.js`, `src/scaffolding/scaffold.js`) and their deps had zero `vscode` imports. Future audit habit: before scoping a "decouple X from VSCode" deliverable, grep `X` and its deps for `require('vscode')`. Misframed scope risks over-engineering; correct framing kept D-1.1/D-1.2 small.

Also add a one-line summary entry under STATE.md's "current work" or "completed deliverables" section per existing conventions (read STATE.md before appending to match its style).

## Risks / open questions

- **Commander option semantics with optional positional value.** `--parse [spec-path]` is documented as optional-value-form; `opts.parse` should be `true` when bare and a string when given. AC 8's semantics comment encodes this assumption. If smoke step 3 reveals different behavior, fix the handler and update the comment — do not silently work around it.

## Estimate

30–60 minutes including test run and smoke.
