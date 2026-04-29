#!/usr/bin/env node
/**
 * Smoke test: prove DirectLinearTracker + IssueTrackerFactory work
 * end-to-end against a real Linear workspace, from a plain Node process.
 *
 * This is the gate before building setup-wizard UX on top of the new path.
 * If this fails, the architecture is wrong; debug here, not in the wizard.
 *
 * Usage:
 *   LINEAR_API_KEY=lin_api_xxx \
 *   SMOKE_PROJECT_ID=<linear-project-id> \
 *   node scripts/smoke-direct-linear.js
 *
 * The script:
 *   1. Verifies LINEAR_API_KEY is set.
 *   2. Validates the key (calls client.viewer).
 *   3. Initializes IssueTrackerFactory; asserts mode === 'direct'.
 *   4. Resolves SMOKE_PROJECT_ID — if it's a UUID, uses it directly; if it
 *      looks like a slug or URL fragment, queries client.projects() and
 *      finds a match. Prints all projects on no-match so the user can pick.
 *   5. Creates one issue with a unique externalId in that project.
 *   6. Queries that externalId back; asserts the issue is found.
 *   7. Logs the issue URL so you can manually delete it from the Linear UI.
 *
 * Issues created here intentionally have a "[SMOKE]" prefix so they're
 * easy to spot and delete. Do NOT run this against a real production
 * Linear project — use a throwaway "DWA Test" project.
 */

const path = require('path');
const { LinearClient } = require('@linear/sdk');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function kebabCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function resolveProjectId(client, supplied) {
  if (!supplied) return null;
  if (UUID_RE.test(supplied)) return supplied;

  console.log(`     SMOKE_PROJECT_ID isn't a UUID; resolving "${supplied}" via client.projects()...`);
  const projects = await client.projects();
  const all = projects.nodes;

  // Linear URL slugs look like "<kebab-cased-name>-<12-hex-slugId>".
  // Strip the trailing hex segment (if present) and match the kebab-cased name.
  const stripped = supplied.replace(/-[0-9a-f]{12}$/i, '');
  const inputKebab = kebabCase(stripped);

  let match = all.find((p) => kebabCase(p.name) === inputKebab);
  if (match) {
    console.log(`     Resolved by kebab-name to "${match.name}" (id=${match.id})`);
    return match.id;
  }

  // Fallback: exact case-insensitive name match (in case user passed the actual name).
  match = all.find((p) => p.name?.toLowerCase() === supplied.toLowerCase());
  if (match) {
    console.log(`     Resolved by name to "${match.name}" (id=${match.id})`);
    return match.id;
  }

  console.error(`FAIL: could not resolve SMOKE_PROJECT_ID="${supplied}". Available projects:`);
  for (const p of all) {
    console.error(`  - ${p.name}  (id=${p.id})`);
  }
  process.exit(1);
}

async function main() {
  if (!process.env.LINEAR_API_KEY) {
    console.error('FAIL: LINEAR_API_KEY env var is required.');
    process.exit(1);
  }

  const { validateApiKey } = require(path.join('..', 'src', 'linear', 'direct-tracker'));
  const { IssueTrackerFactory } = require(path.join('..', 'src', 'linear', 'factory'));

  console.log('[1/6] Validating API key via client.viewer...');
  const validation = await validateApiKey(process.env.LINEAR_API_KEY);
  if (!validation.valid) {
    console.error(`FAIL: API key validation failed: ${validation.error}`);
    process.exit(1);
  }
  console.log(`     OK — authenticated as ${validation.viewer.name} <${validation.viewer.email}>`);

  console.log('[2/6] Initializing IssueTrackerFactory (no vscode)...');
  const factory = new IssueTrackerFactory();
  await factory.initialize();
  if (factory.mode !== 'direct') {
    console.error(`FAIL: expected mode 'direct', got '${factory.mode}'`);
    process.exit(1);
  }
  console.log(`     OK — mode = ${factory.mode}`);

  const externalId = `SMOKE-TEST-${Date.now()}`;
  const title = `[SMOKE] DirectLinearTracker test ${new Date().toISOString()}`;

  // Resolve the project ID up front using a temporary client. (Factory's
  // tracker doesn't expose projects() directly — that's intentional, since
  // project resolution is a sync-time concern, not part of the IssueTracker
  // interface. Here we just need it for the smoke test.)
  console.log('[3/6] Resolving SMOKE_PROJECT_ID...');
  const tmpClient = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
  const projectId = await resolveProjectId(tmpClient, process.env.SMOKE_PROJECT_ID);
  if (projectId) {
    console.log(`     OK — projectId = ${projectId}`);
  } else {
    console.log('     (no SMOKE_PROJECT_ID — issue will be created without project)');
  }

  console.log('[4/6] Creating issue with externalId:', externalId);
  const created = await factory.createIssue({
    title,
    description:
      'This issue was created by `scripts/smoke-direct-linear.js` to verify DWA can ' +
      'sync to Linear without VS Code. Safe to delete.',
    externalId,
    container: projectId
  });
  console.log(`     OK — created ${created.identifier} → ${created.url}`);

  console.log('[5/6] Querying back by externalId...');
  const found = await factory.queryByExternalId(externalId);
  if (!found) {
    console.error('FAIL: queryByExternalId returned null for the issue we just created');
    process.exit(1);
  }
  if (found.id !== created.id) {
    console.error(`FAIL: queryByExternalId returned a different issue (${found.id} vs ${created.id})`);
    process.exit(1);
  }
  console.log(`     OK — round-tripped externalId ${externalId}`);

  console.log('[6/6] Done. Smoke test passed.');
  console.log('');
  console.log('Manual cleanup: open the Linear UI and delete the test issue:');
  console.log('  ' + created.url);
}

main().catch((err) => {
  console.error('FAIL:', err?.stack || err);
  process.exit(1);
});
