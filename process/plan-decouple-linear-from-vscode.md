# Plan: Decouple Linear Sync from VSCode

## Context

DWA's `--sync-linear` command requires the `vscode` module at module-load time (`src/linear/bridge-client.js:8`: `const vscode = require('vscode');`). Same pattern in `src/google-docs/bridge-client.js`, `src/utils/feature-detection.js`, and `src/pr-description/generate.js`. This means none of these commands can run from a plain terminal — they only work inside a VSCode extension host.

**Why this matters now:** Jon's primary environment is Claude Code terminal + Claude Desktop, not VSCode. Discovered while attempting to use DWA on the Primordial Ascension contract project (`~/workspace/ContractProjects/PrimordialAscension`). This is the first real friction surfaced by dogfooding DWA.

**Original architectural rationale** (`.planning/phases/06-linear-integration/06-CONTEXT.md`, 2026-01-24): Provider portability via a generic `IssueTracker` interface, deterministic-not-LLM sync, credential security via VS Code SecretStorage. Those reasons were valid for the assumed user (developer in VSCode, multi-provider future). The provider-portability goal is preserved by this plan — direct mode is a *second backend*, not a replacement.

## Goal

Run `npx dwa --sync-linear --project <id>` from a plain terminal (no VSCode) and have it create/update Linear issues using an API key stored locally.

## Acceptance Criteria

1. **Module loads outside VSCode.** `require('./src/linear/factory')` succeeds in a plain Node REPL — no top-level `require('vscode')`.
2. **Direct backend exists.** New `DirectLinearTracker` class implements the same `IssueTracker` interface as the bridge's `LinearTracker`: `createIssue`, `updateIssue`, `getIssue`, `queryByExternalId`, `listIssues`, with externalId support, container→projectId mapping, and exponential-backoff rate-limit handling.
3. **API key resolution.** Priority: `LINEAR_API_KEY` env var → `~/.dwa/config.json` (`config.linear.apiKey`) → fail with actionable error pointing to `dwa --setup linear`.
4. **Setup writes the key.** `npx dwa --setup linear` outside VSCode prompts for the API key (masked input), validates it via a single `client.viewer` call, writes to `~/.dwa/config.json` under namespaced key `linear.apiKey`. File created with `chmod 0600` on POSIX; on Windows, a one-time warning is emitted that the file is not OS-protected.
5. **Config schema is namespaced.** `~/.dwa/config.json` uses shape `{schemaVersion: 1, linear: {apiKey: "..."}}` from the start. Future integrations (Google Docs, GitHub, etc.) get their own top-level keys without migration.
6. **Mode selection is automatic with override.** `IssueTrackerFactory.initialize()` tries the VSCode bridge first; if `vscode` module is unavailable, falls back to direct mode. The env var `DWA_LINEAR_MODE=direct` forces direct mode even when VSCode is reachable. Either path produces the same `IssueTracker` for `sync.js` to consume.
7. **Class rename.** `BridgeClient` is renamed to `IssueTrackerFactory` to honestly describe its role. `sync.js` import updated. The `bridge-client.js` filename also moves to `factory.js`. (Old name retained nowhere — clean rename.)
8. **Feature detection is honest.** `feature-detection.js` reports Linear as available when either mode works (direct config exists OR VSCode extension reachable).
9. **Tests added and existing tests still pass.** New unit tests for `DirectLinearTracker` (mocked `@linear/sdk`), `config` (env precedence, namespaced shape, POSIX permissions, Windows warning), and `IssueTrackerFactory` (vscode-throws → direct; both unavailable → actionable error; `DWA_LINEAR_MODE=direct` forces direct even with vscode present). Full suite (368+ tests) green.
10. **Smoke test passes before setup wizard work begins** (see Step 3.5). Provides early-fail signal on the architecture before building UX on top.
11. **Manual verification on Primordial Ascension.** Set up DWA in `~/workspace/ContractProjects/PrimordialAscension`, configure direct mode, sync one deliverable to the Primordial Ascension Linear project, confirm issue appears with correct `externalId` (format `FEAT-YYYY-NNN-DEL-###`).
12. **Docs reflect new path.** README has a "Without VSCode" subsection under Linear setup. `.planning/PROJECT.md` Key Decisions table records the dual-mode decision and the dogfooding-friction origin.

## Docs in Scope

- `process/plan-decouple-linear-from-vscode.md` (this file)
- `README.md` — add non-VSCode setup section
- `.planning/STATE.md` — note the new deliverable and friction origin
- `.planning/PROJECT.md` — Key Decisions entry: dual-mode Linear backend
- `.planning/phases/07.2-workflow-friction-reduction/07.2-CONTEXT.md` — note that VSCode-decoupling is a *separate* phase from the originally-scoped 7.2 internal-state friction work (or formally split into 7.3)

## Files to Create

- `src/linear/direct-tracker.js` — `DirectLinearTracker` class. Port from `~/workspace/JobPrep/DevEx/devex-service-bridge/packages/linear-provider/src/linearTracker.ts`. **Verified 2026-04-29:** that file imports only `@linear/sdk` and `exponential-backoff`; no `vscode` references, no progress UI, no output-channel logging. The VSCode coupling lives entirely in `extension.ts`, which we don't port. Direct port is clean.
- `src/linear/config.js` — `loadApiKey()` reads env (`LINEAR_API_KEY`) then file (`~/.dwa/config.json` → `linear.apiKey`); `saveApiKey(key)` writes namespaced shape, sets `chmod 0600` on POSIX, emits one-time Windows warning. (`validateApiKey` lives in `direct-tracker.js`, not `config.js`, since it needs the SDK.)
- `src/linear/factory.js` — `IssueTrackerFactory` class (replaces `bridge-client.js`). See "Files to Modify" for the rename details.
- `scripts/smoke-direct-linear.js` — standalone Node script for Step 3.5. Reads `LINEAR_API_KEY` from env, instantiates `IssueTrackerFactory`, asserts `DirectLinearTracker` is returned, optionally creates a test issue against a throwaway Linear project (project ID via `SMOKE_PROJECT_ID` env var). Logged output, no test framework. Gitignored or kept under `scripts/` for reproducibility.
- `tests/linear/direct-tracker.test.js` — mocked `@linear/sdk` tests covering create/update/queryByExternalId, externalId presence, container→projectId mapping, rate-limit retry behavior, `validateApiKey` (mocked `viewer` call).
- `tests/linear/config.test.js` — env precedence, namespaced shape (`{schemaVersion: 1, linear: {apiKey}}`), POSIX permission bits, Windows warning emission (mocked `process.platform`), missing-key error message.
- `tests/linear/factory.test.js` — vscode-throws → direct path taken; vscode-and-config both unavailable → actionable error; `DWA_LINEAR_MODE=direct` forces direct even with vscode present.

## Files to Modify

- **Rename:** `src/linear/bridge-client.js` → `src/linear/factory.js`. Class `BridgeClient` → `IssueTrackerFactory`. `BRIDGE_EXTENSION_IDS` and `LINEAR_PROVIDER_IDS` exports stay (still needed for VSCode mode discovery). Move `require('vscode')` inside `initialize()` behind try/catch. Add fallback branch: if vscode unavailable OR `DWA_LINEAR_MODE === 'direct'`, instantiate `DirectLinearTracker` using key from `loadApiKey()`. Both paths assign `this.tracker` an `IssueTracker`-compatible object; `sync.js` is unchanged.
- `src/linear/sync.js` — single import line: `const { BridgeClient } = require('./bridge-client')` → `const { IssueTrackerFactory } = require('./factory')`. Single instantiation site updated. Otherwise untouched.
- `src/commands/setup.js` — `setupLinear()` detects VSCode reachability (lazy `try { require('vscode') }`). Non-VSCode path: prompt for API key (enquirer Password prompt), call `validateApiKey()` from `direct-tracker.js`, call `saveApiKey()` from `config.js`, print success. VSCode path: existing behavior. Add `--direct` and `--vscode-bridge` CLI flags to override auto-detect.
- `src/utils/feature-detection.js` — `checkFeature('linear')` returns available if either `loadApiKey()` returns a key OR VSCode extension found.
- `package.json` — add `@linear/sdk@^7.0.0` (pinned to bridge version) and `exponential-backoff`.
- `README.md` — Linear setup section gets "Without VSCode" subsection.
- `src/commands/sync-linear.js` — verify untouched: should work end-to-end since it goes through the renamed factory's interface.

## Steps

### Step 1 — Config module (engineering)
Write `src/linear/config.js` with `loadApiKey()` and `saveApiKey()` only. No external dependencies. Namespaced schema from the start: `{schemaVersion: 1, linear: {apiKey: "..."}}`. POSIX `chmod 0600`; Windows one-time warning. Tests in `tests/linear/config.test.js`.

### Step 2 — Port `LinearTracker` to JS + `validateApiKey` (engineering)
Add `@linear/sdk@^7.0.0` and `exponential-backoff` to `package.json`. Port the bridge's `LinearTracker` to `src/linear/direct-tracker.js` (TS → JS, drop interface declarations, preserve all runtime logic). Add `validateApiKey(key)` exported from this module — instantiates a temporary `LinearClient`, calls `await client.viewer`, returns `{valid: bool, viewer?, error?}`. Tests with mocked SDK.

### Step 3 — Rename `BridgeClient` to `IssueTrackerFactory` and add direct-mode fallback (engineering)
Rename file `src/linear/bridge-client.js` → `src/linear/factory.js`. Rename class. Move `require('vscode')` inside `initialize()` behind try/catch. Add fallback: vscode unavailable OR `DWA_LINEAR_MODE === 'direct'` → instantiate `DirectLinearTracker` from `loadApiKey()`. Update single import in `sync.js`. Tests in `tests/linear/factory.test.js` covering all three branches.

### Step 3.5 — Smoke test against real Linear (verification)
Write `scripts/smoke-direct-linear.js`. Execute it manually:
- Throwaway Linear workspace/project for testing (NOT Primordial Ascension at this stage — avoid polluting real project with test issues).
- Set `LINEAR_API_KEY` and `SMOKE_PROJECT_ID` in env.
- Run `node scripts/smoke-direct-linear.js`.
- Asserts: factory returns `DirectLinearTracker`, `createIssue()` succeeds and the issue is queryable by externalId.
- **Gate:** if this fails, debug architecture before proceeding to setup wizard. Don't pile UX on a broken load path.
- **Open question for Jon:** is there a throwaway Linear workspace, or should we create one for this purpose?

### Step 4 — Update setup command (engineering)
Add the non-VSCode branch in `setupLinear()`. enquirer Password prompt → `validateApiKey()` → `saveApiKey()`. Add `--direct` / `--vscode-bridge` CLI flags. Update post-setup messaging for both paths.

### Step 5 — Update feature-detection (engineering)
`checkFeature('linear')` honors direct-mode availability.

### Step 6 — Manual verification on Primordial Ascension (verification)
- Install DWA in `~/workspace/ContractProjects/PrimordialAscension` (`npm link` or file dep)
- `npx dwa --install`
- `npx dwa --setup linear` → enter API key
- Create minimal canonical spec with one deliverable
- `npx dwa --sync-linear --project <primordial-ascension-id>`
- Confirm issue appears in Linear with correct `externalId`

### Step 7 — Documentation (engineering)
README "Without VSCode" subsection. `.planning/PROJECT.md` Key Decisions update. `.planning/STATE.md` current-position update. Note in 07.2-CONTEXT.md that VSCode-decoupling is separate scope (Phase 7.3).

## Out of Scope

- Decoupling Google Docs import from VSCode (separate plan, when Primordial Ascension Docs import is needed).
- Decoupling PR description generation from VSCode (separate plan).
- Migrating `.planning/` docs to CGDW format (separate decision; revisit after 1-2 deliverables in CGDW style).
- JIRA backend (Phase 9).
- Migrating credential storage to OS keychain (`keytar`). File + 0600 is sufficient for now; revisit if real teams adopt DWA.

## Risks / Open Questions

- **`@linear/sdk` version drift.** Bridge uses 7.0.0. Pin DWA to the same to avoid behavior divergence between backends. If Linear releases a breaking change, both repos update together.
- **Rate-limit logic duplication.** Both bridge tracker and direct tracker will implement backoff. Acceptable — extracting shared code would re-couple DWA to the bridge.
- **Credential storage choice.** `~/.dwa/config.json` with `0600` is the simplest path. Keychain (`keytar`) is more secure but adds a native dep. Going with file. On Windows the chmod is a no-op (NTFS uses ACLs); we emit a one-time warning so users aren't misled about file protection.
- **Throwaway Linear workspace for smoke testing.** Step 3.5 needs a Linear project to create test issues against. Using Primordial Ascension would pollute it. Need to either create a throwaway workspace or get OK to create-and-immediately-delete in PA. Flagged for Jon.

### Resolved (moved out of risks)

- **Force-direct override** → promoted to AC #6, env var `DWA_LINEAR_MODE=direct`, test in `factory.test.js`.
- **Setup wizard UX** → auto-detect by default; `--direct` / `--vscode-bridge` CLI flags for explicit override.
- **Bridge LinearTracker VSCode contamination** → verified clean (2026-04-29). Source has no `vscode` imports. Direct port without modification.

## Estimate

Half-day to a day of focused work. Steps 2 (port + tests) and 4 (setup wizard) are the bulk.

## Connection to Roadmap

This work doesn't fit the originally-scoped Phase 7.2 (internal-state friction: lazy parsing, stale packets, gitignore, `dwa stats`/`validate`/`clean`). Recommend either:

- **(a)** Insert as Phase 7.3 "Deployment-Context Decoupling" — keeps 7.2 scope clean.
- **(b)** Broaden Phase 7.2 to "Workflow Friction Reduction (deployment + internal state)" and add this as 07.2-02-PLAN.md.

Lean toward (a) since the friction categories are different and we want to track the dogfooding-driven nature of this work distinctly.
