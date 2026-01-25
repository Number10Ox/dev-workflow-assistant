# Phase 6: Linear Integration - Research

**Researched:** 2026-01-24
**Domain:** Linear GraphQL API Integration
**Confidence:** MEDIUM-HIGH

## Summary

Linear provides a mature GraphQL API and official TypeScript SDK for creating and managing issues programmatically. The API uses standard GraphQL patterns with complexity-based and request-based rate limiting. Authentication is handled via personal API keys or OAuth2, with Linear returning partial successes (HTTP 200 with errors array) requiring explicit error checking.

The `@linear/sdk` package (v70.0.0+) provides strongly-typed access to all Linear operations and models, built on top of their GraphQL API at `https://api.linear.app/graphql`. For VS Code extensions, credentials should be stored in VS Code Secret Storage (backed by OS-native keystores), with environment variables as fallback for headless/CI environments.

Key architectural decisions already locked in from CONTEXT.md: use Linear SDK directly (not MCP), one-way sync DWA → Linear, dual ID strategy (registry `linear_issue_id` + Linear `externalId`), DWA-owned content section with BEGIN/END markers, exponential backoff for rate limits, and VS Code Secret Storage for credentials.

**Primary recommendation:** Use `@linear/sdk` for typed operations, implement per-deliverable atomic syncing with externalId-based deduplication, use Node.js crypto for sync fingerprint hashing, handle partial GraphQL errors explicitly, and implement exponential backoff with 2-5 concurrent request limit to stay under rate limits.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@linear/sdk` | 70.0.0+ | Official Linear TypeScript SDK for GraphQL API | TypeScript-native, strongly typed, maintained by Linear team, exposes all operations/models |
| `vscode` | Latest | VS Code Extension API (SecretStorage, commands, workspace config) | Required for extension development, provides secure credential storage via SecretStorage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `exponential-backoff` | 3.1.1+ | Retry logic with exponential backoff and jitter | Rate limit handling (429 errors), network failures |
| Node.js `crypto` | Built-in | SHA-256 hashing for sync fingerprints | Computing deterministic content hashes for change detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@linear/sdk` | Raw GraphQL client (e.g., `graphql-request`) | SDK provides types and error handling; raw client requires manual schema tracking |
| `exponential-backoff` | Manual retry with `setTimeout` | Library handles jitter, max retries, backoff calculation; manual is error-prone |
| `crypto-hash` (npm) | Node.js built-in `crypto` | Built-in has zero dependencies and ships with Node; npm package adds dependency for same functionality |

**Installation:**
```bash
npm install @linear/sdk exponential-backoff
```

Note: `vscode` and `crypto` are available in the extension runtime environment (no installation needed).

## Architecture Patterns

### Recommended Project Structure
```
src/
├── commands/
│   ├── syncToLinear.ts           # VS Code command: sync all deliverables
│   └── syncDeliverableToLinear.ts # VS Code command: sync one deliverable
├── linear/
│   ├── client.ts                  # Linear SDK client factory + config
│   ├── sync.ts                    # Core sync orchestration logic
│   ├── issueOperations.ts         # CRUD operations for Linear issues
│   ├── deduplication.ts           # externalId-based lookup + binding
│   ├── contentBuilder.ts          # DWA section markdown generation
│   ├── fingerprint.ts             # SHA-256 sync hash computation
│   └── rateLimit.ts               # Exponential backoff wrapper
├── config/
│   └── credentialService.ts       # VS Code SecretStorage + env fallback
└── types/
    └── linear.ts                  # Extended types for DWA registry fields
```

### Pattern 1: Dual ID Deduplication Strategy
**What:** Use both registry-stored `linear_issue_id` (fast path) and Linear's `externalId` field (safety net) for robust issue identity across machines/repos.

**When to use:** Every sync operation, to handle fresh clones, missing registry, or registry corruption.

**Example:**
```typescript
// Source: Phase 6 CONTEXT.md + Linear SDK patterns
async function findOrCreateIssue(
  client: LinearClient,
  deliverable: Deliverable,
  externalId: string
): Promise<Issue> {
  // Fast path: registry has linear_issue_id
  if (deliverable.linear_issue_id) {
    try {
      return await client.issue(deliverable.linear_issue_id);
    } catch (err) {
      // Issue deleted in Linear, fall through to externalId lookup
    }
  }

  // Safety net: query by externalId
  const issues = await client.issues({
    filter: { externalId: { eq: externalId } }
  });

  if (issues.nodes.length > 0) {
    // Bind to registry
    const issue = issues.nodes[0];
    deliverable.linear_issue_id = issue.id;
    deliverable.linear_identifier = issue.identifier;
    deliverable.linear_url = issue.url;
    await saveRegistry(deliverable);
    return issue;
  }

  // Create new issue with externalId
  const payload = await client.createIssue({
    teamId: teamId,
    title: generateTitle(deliverable),
    description: buildDwaSection(deliverable),
    externalId: externalId
  });

  if (!payload.success) {
    throw new Error(`Failed to create issue: ${payload.errors}`);
  }

  // Store identifiers in registry
  const issue = payload.issue!;
  deliverable.linear_issue_id = issue.id;
  deliverable.linear_identifier = issue.identifier;
  deliverable.linear_url = issue.url;
  await saveRegistry(deliverable);

  return issue;
}
```

### Pattern 2: DWA-Owned Section with Markers
**What:** Wrap DWA-managed content in HTML comments `<!-- DWA:BEGIN -->` and `<!-- DWA:END -->`, allowing safe coexistence with human-authored content outside markers.

**When to use:** All issue description updates, to avoid clobbering human edits.

**Example:**
```typescript
// Source: Phase 6 CONTEXT.md
function buildDwaSection(deliverable: Deliverable): string {
  const acContent = formatAcGroups(deliverable.acceptance_criteria);
  const qaContent = formatQaSteps(deliverable.qa_verification_steps);

  return `
<!-- DWA:BEGIN -->
**DWA Deliverable:** ${deliverable.id}
**Spec:** [\`${deliverable.spec_path}\`](${repoUrl}/${deliverable.spec_path})
**TDD:** [\`${deliverable.tdd_path}\`](${repoUrl}/${deliverable.tdd_path})

## Summary
${deliverable.summary}

## Acceptance Criteria

${acContent}

## QA Verification
${qaContent}

**Sync Hash:** \`${computeSyncHash(deliverable)}\`
<!-- DWA:END -->
`.trim();
}

function updateDwaSection(existingBody: string, newDwaContent: string): string {
  const beginMarker = '<!-- DWA:BEGIN -->';
  const endMarker = '<!-- DWA:END -->';

  const beginIdx = existingBody.indexOf(beginMarker);
  const endIdx = existingBody.indexOf(endMarker);

  if (beginIdx === -1 || endIdx === -1) {
    // No existing DWA section, append
    return existingBody + '\n\n' + newDwaContent;
  }

  // Replace DWA section, preserve content outside markers
  return existingBody.slice(0, beginIdx) + newDwaContent + existingBody.slice(endIdx + endMarker.length);
}
```

### Pattern 3: Sync Fingerprint for Multi-Person Safety
**What:** Compute SHA-256 hash of DWA section content, store in Linear issue and registry, detect manual edits via hash mismatch.

**When to use:** Every sync operation, to prevent overwriting human edits in DWA section.

**Example:**
```typescript
// Source: Node.js crypto module + Phase 6 CONTEXT.md
import crypto from 'crypto';

function computeSyncHash(dwaContent: string): string {
  return crypto.createHash('sha256').update(dwaContent, 'utf8').digest('hex');
}

async function safeUpdateIssue(
  client: LinearClient,
  issue: Issue,
  deliverable: Deliverable,
  force: boolean = false
): Promise<void> {
  const newDwaContent = buildDwaSection(deliverable);
  const newHash = computeSyncHash(newDwaContent);

  const existingBody = issue.description || '';
  const existingHash = extractSyncHash(existingBody);

  if (existingHash && existingHash !== deliverable.dwa_sync_hash && !force) {
    throw new Error(
      `DWA section was manually edited in Linear. Use --force to overwrite.\n` +
      `Issue: ${issue.identifier} (${issue.url})`
    );
  }

  const updatedBody = updateDwaSection(existingBody, newDwaContent);

  await client.updateIssue(issue.id, {
    description: updatedBody
  });

  // Update registry
  deliverable.dwa_sync_hash = newHash;
  await saveRegistry(deliverable);
}

function extractSyncHash(dwaContent: string): string | null {
  const match = dwaContent.match(/\*\*Sync Hash:\*\* `([a-f0-9]{64})`/);
  return match ? match[1] : null;
}
```

### Pattern 4: Rate Limit Handling with Exponential Backoff
**What:** Wrap Linear API calls in retry logic with exponential backoff, respect `Retry-After` header, cap concurrency.

**When to use:** All Linear API mutations and queries to handle 429 rate limit errors gracefully.

**Example:**
```typescript
// Source: exponential-backoff npm + Linear rate limiting docs
import { backOff } from 'exponential-backoff';
import { LinearError, InvalidInputLinearError } from '@linear/sdk';

async function withRateLimitHandling<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return backOff(
    async () => {
      try {
        return await operation();
      } catch (err) {
        if (err instanceof LinearError) {
          // Check for rate limit error
          const rateLimitError = err.errors?.find(e => e.extensions?.code === 'RATELIMITED');
          if (rateLimitError) {
            // Extract Retry-After if available
            const retryAfter = err.raw?.headers?.['retry-after'];
            if (retryAfter) {
              const delayMs = parseInt(retryAfter) * 1000;
              console.warn(`Rate limited, retrying after ${delayMs}ms`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            throw err; // Trigger backoff retry
          }

          // Don't retry user input errors
          if (err instanceof InvalidInputLinearError) {
            throw err;
          }
        }

        throw err; // Re-throw for backoff retry
      }
    },
    {
      numOfAttempts: 5,
      startingDelay: 1000,      // Start with 1s
      timeMultiple: 2,           // Exponential: 1s, 2s, 4s, 8s, 16s
      jitter: 'full',            // Add randomness to prevent thundering herd
      maxDelay: 30000,           // Cap at 30s
      retry: (err: any) => {
        // Retry on rate limit and network errors, not user input errors
        if (err instanceof InvalidInputLinearError) return false;
        if (err instanceof LinearError) {
          return err.errors?.some(e => e.extensions?.code === 'RATELIMITED') ?? false;
        }
        return true; // Retry other errors (network, etc.)
      }
    }
  );
}

// Usage:
await withRateLimitHandling(
  () => client.createIssue({ teamId, title, description }),
  'createIssue'
);
```

### Pattern 5: Concurrent Request Limiting
**What:** Limit concurrent Linear API requests to 2-5 parallel operations to avoid triggering complexity-based rate limits.

**When to use:** Bulk sync operations (syncing multiple deliverables).

**Example:**
```typescript
// Source: GraphQL concurrent requests best practices
async function syncDeliverablesBatched(
  client: LinearClient,
  deliverables: Deliverable[],
  concurrency: number = 3
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Process in batches
  for (let i = 0; i < deliverables.length; i += concurrency) {
    const batch = deliverables.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(deliverable =>
        syncOneDeliverable(client, deliverable)
      )
    );

    // Collect results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push({ success: true, deliverable: result.value });
      } else {
        results.push({ success: false, error: result.reason });
      }
    }
  }

  return results;
}
```

### Pattern 6: VS Code Secret Storage for Credentials
**What:** Use `context.secrets` (VS Code SecretStorage API) for Linear API tokens, with environment variable fallback for headless/CI.

**When to use:** Extension activation, Linear client initialization.

**Example:**
```typescript
// Source: VS Code Secret Storage API docs + best practices
import * as vscode from 'vscode';

export class LinearCredentialService {
  private static readonly LINEAR_API_KEY = 'linearApiKey';

  constructor(private secrets: vscode.SecretStorage) {}

  async getApiKey(): Promise<string | undefined> {
    // Primary: VS Code Secret Storage
    let apiKey = await this.secrets.get(LinearCredentialService.LINEAR_API_KEY);

    // Fallback: environment variable (for CI/headless)
    if (!apiKey) {
      apiKey = process.env.LINEAR_API_KEY;
    }

    return apiKey;
  }

  async storeApiKey(apiKey: string): Promise<void> {
    await this.secrets.store(LinearCredentialService.LINEAR_API_KEY, apiKey);
  }

  async deleteApiKey(): Promise<void> {
    await this.secrets.delete(LinearCredentialService.LINEAR_API_KEY);
  }

  onDidChange(listener: () => void): vscode.Disposable {
    return this.secrets.onDidChange(e => {
      if (e.key === LinearCredentialService.LINEAR_API_KEY) {
        listener();
      }
    });
  }
}

// Usage in extension activation:
export async function activate(context: vscode.ExtensionContext) {
  const credentialService = new LinearCredentialService(context.secrets);

  // Register command to set API key
  context.subscriptions.push(
    vscode.commands.registerCommand('dwa.setLinearApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Linear API key',
        password: true,
        ignoreFocusOut: true
      });

      if (apiKey) {
        await credentialService.storeApiKey(apiKey);
        vscode.window.showInformationMessage('Linear API key stored securely');
      }
    })
  );
}
```

### Anti-Patterns to Avoid
- **Assuming GraphQL success from HTTP 200:** Linear returns HTTP 200 with `errors` array for partial failures; always check `payload.success` and `errors` field.
- **Ignoring sync hash mismatches:** Silently overwriting manually edited DWA sections destroys user work; always warn or require `--force`.
- **Unbounded concurrent requests:** Sending 20+ parallel requests triggers complexity rate limits; cap at 2-5 concurrent.
- **Storing API keys in workspace settings or repo:** VS Code workspace settings are plain JSON in `.vscode/settings.json`; use SecretStorage or env vars only.
- **Retrying user input errors:** `InvalidInputLinearError` indicates bad data; retrying won't help, fix the input instead.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GraphQL client for Linear | Custom `fetch()` wrapper with manual typing | `@linear/sdk` | SDK provides strongly-typed operations, error parsing, and schema updates from Linear team |
| Exponential backoff retry | Manual `setTimeout` with retry counter | `exponential-backoff` npm package | Handles jitter, max retries, backoff calculation, edge cases (already well-tested) |
| SHA-256 hashing | Third-party crypto libraries | Node.js built-in `crypto` module | Built-in, zero dependencies, cryptographically secure |
| Secure credential storage | Custom encryption + file storage | VS Code `SecretStorage` API | OS-native keystore (Keychain/Credential Manager), encrypted, managed by VS Code |
| GraphQL request batching | Custom batch queue | Limited concurrency with `Promise.allSettled` | GraphQL batching adds complexity and can slow down fast operations; controlled concurrency is simpler |

**Key insight:** Linear's SDK and error handling patterns are mature and well-documented. Custom GraphQL clients lose type safety and schema updates. Retry logic has many edge cases (thundering herd, jitter, max delay) that libraries handle correctly.

## Common Pitfalls

### Pitfall 1: Partial GraphQL Success (HTTP 200 with Errors)
**What goes wrong:** Code checks HTTP status 200 and assumes success, but GraphQL returns 200 even when mutations fail, with errors in `errors` array.

**Why it happens:** GraphQL spec allows partial success; Linear follows this pattern.

**How to avoid:** Always check `payload.success` boolean and inspect `errors` array before assuming operation succeeded.

**Warning signs:** Issues not created in Linear despite "success" logs; silent failures in bulk sync.

**Example:**
```typescript
// BAD: Assumes success from no exception
const payload = await client.createIssue({ teamId, title });
const issue = payload.issue; // May be undefined!

// GOOD: Check success flag
const payload = await client.createIssue({ teamId, title });
if (!payload.success || !payload.issue) {
  throw new Error(`Failed to create issue: ${JSON.stringify(payload.errors)}`);
}
const issue = payload.issue;
```

### Pitfall 2: Complexity-Based Rate Limiting
**What goes wrong:** Staying under request-based rate limit (5,000 requests/hour) but hitting complexity limit (250,000 points/hour) due to deep queries or large pagination.

**Why it happens:** Linear calculates complexity per property (0.1 point), object (1 point), and connections multiply by pagination size (default 50). Deep queries accumulate points quickly.

**How to avoid:**
- Keep queries shallow (only fetch needed fields)
- Use explicit pagination limits instead of default 50
- Monitor `X-Complexity` and `X-RateLimit-Complexity-Remaining` headers
- Limit concurrent requests to 2-5

**Warning signs:**
- `RATELIMITED` errors with `X-RateLimit-Requests-Remaining` showing high remaining requests
- Errors occur during bulk operations fetching many issues

### Pitfall 3: ExternalId Not Set or Incorrect Format
**What goes wrong:** Creating issues without `externalId`, or using non-unique values (e.g., `DEL-001` instead of `FEAT-2026-001-DEL-001`), causing deduplication failures across features.

**Why it happens:** `externalId` is optional in `IssueCreateInput`; developers forget to set it or use deliverable ID alone.

**How to avoid:** Always generate externalId with format `FEAT-YYYY-NNN-DEL-###` including feature key and year for global uniqueness.

**Warning signs:** Duplicate issues created on re-sync; issues not found by externalId query.

**Example:**
```typescript
// BAD: Missing or non-unique externalId
await client.createIssue({ teamId, title, description });

// GOOD: Globally unique externalId
const externalId = `FEAT-${feature.year}-${feature.number.padStart(3, '0')}-DEL-${deliverable.id}`;
await client.createIssue({ teamId, title, description, externalId });
```

### Pitfall 4: Overwriting Human Edits in DWA Section
**What goes wrong:** Sync updates DWA section without checking if it was manually edited in Linear, destroying human changes.

**Why it happens:** No mechanism to detect edits between syncs.

**How to avoid:** Compute sync hash, store in Linear issue and registry, compare on update, require `--force` flag if mismatch.

**Warning signs:** Team members report lost edits in Linear issues; confusion about "source of truth."

### Pitfall 5: Not Handling Team ID vs Project ID
**What goes wrong:** Creating issues with `projectId` but no `teamId`, or vice versa, causing validation errors.

**Why it happens:** Linear requires `teamId` for issue creation; `projectId` is optional but adds grouping. Confusing which is required.

**How to avoid:**
- Always provide `teamId` (required)
- Optionally provide `projectId` for grouping
- Fetch project to extract `teamId` if only project URL/ID is known

**Warning signs:** `InvalidInputLinearError` with message about missing `teamId`.

**Example:**
```typescript
// Get teamId from project
const project = await client.project(projectId);
const teamId = project.team.id;

await client.createIssue({
  teamId: teamId,        // Required
  projectId: projectId,  // Optional, for grouping
  title,
  description
});
```

### Pitfall 6: Linear API Token Scope Issues
**What goes wrong:** API token lacks permissions to create/update issues, causing `FORBIDDEN` errors.

**Why it happens:** Linear personal API keys inherit user permissions; if user can't create issues in a team, neither can the token.

**How to avoid:**
- Verify user has "write" access to target team before sync
- Provide actionable error messages when forbidden
- Document required Linear permissions in setup docs

**Warning signs:** `LinearError` with `FORBIDDEN` or `UNAUTHORIZED` error code.

## Code Examples

Verified patterns from official sources:

### Creating Issues with Linear SDK
```typescript
// Source: https://linear.app/developers/sdk-fetching-and-modifying-data
import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const teams = await client.teams();
const team = teams.nodes[0];

if (team.id) {
  const issuePayload = await client.createIssue({
    teamId: team.id,
    title: "Issue title",
    description: "Issue description in markdown",
    priority: 1,
    externalId: "FEAT-2026-001-DEL-001"
  });

  if (issuePayload.success) {
    const issue = issuePayload.issue;
    console.log(`Created issue: ${issue?.identifier} (${issue?.url})`);
  } else {
    console.error(`Failed to create issue:`, issuePayload.errors);
  }
}
```

### Querying Issues by ExternalId
```typescript
// Source: Linear SDK + GraphQL filter patterns
const issues = await client.issues({
  filter: {
    externalId: { eq: "FEAT-2026-001-DEL-001" }
  }
});

if (issues.nodes.length > 0) {
  const issue = issues.nodes[0];
  console.log(`Found existing issue: ${issue.identifier}`);
} else {
  console.log('No issue found with that externalId');
}
```

### Updating Issue Description
```typescript
// Source: https://linear.app/developers/sdk-fetching-and-modifying-data
await client.updateIssue(issue.id, {
  description: updatedMarkdownContent
});

// Alternative: via model instance
await issue.update({
  description: updatedMarkdownContent
});
```

### Error Handling with Linear SDK
```typescript
// Source: https://linear.app/developers/sdk-errors
import { LinearError, InvalidInputLinearError } from '@linear/sdk';

try {
  const payload = await client.createIssue({ teamId, title });
  if (!payload.success) {
    throw new Error(`Create failed: ${JSON.stringify(payload.errors)}`);
  }
} catch (err) {
  if (err instanceof InvalidInputLinearError) {
    // User input error, don't retry
    console.error('Invalid input:', err.message);
    console.error('Errors:', err.errors);
  } else if (err instanceof LinearError) {
    // Rate limit or other Linear API error
    console.error('Linear API error:', err.message);
    console.error('Query:', err.query);
    console.error('Status:', err.status);
  } else {
    // Unknown error
    throw err;
  }
}
```

### Computing SHA-256 Hash for Sync Fingerprint
```typescript
// Source: https://nodejs.org/api/crypto.html
import crypto from 'crypto';

function computeSyncHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

const dwaContent = buildDwaSection(deliverable);
const hash = computeSyncHash(dwaContent); // 64-char hex string
```

### Rate Limit Headers Inspection
```typescript
// Source: https://linear.app/developers/rate-limiting
// Linear returns rate limit info in response headers (access via raw error)
try {
  await client.createIssue({ teamId, title });
} catch (err) {
  if (err instanceof LinearError && err.raw?.headers) {
    const headers = err.raw.headers;
    console.log('Requests remaining:', headers['x-ratelimit-requests-remaining']);
    console.log('Complexity remaining:', headers['x-ratelimit-complexity-remaining']);
    console.log('Reset time:', headers['x-ratelimit-requests-reset']);
    console.log('Retry after:', headers['retry-after']);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Keytar library for VS Code secrets | Electron `safeStorage` API | 2025 | VS Code Secret Storage now more secure and maintained; extensions don't need to handle encryption |
| OAuth without refresh tokens | OAuth with refresh tokens (default) | Oct 2025, mandatory Apr 2026 | New OAuth apps issue refresh tokens by default; existing apps must migrate by 2026-04-01 |
| MD5/SHA-1 for hashing | SHA-256 for cryptographic hashing | Ongoing (security best practice) | SHA-256 is cryptographically secure; MD5/SHA-1 are weak and deprecated |

**Deprecated/outdated:**
- **Keytar library:** VS Code switched to Electron safeStorage API for Secret Storage backend; extensions should use `context.secrets`, not Keytar directly.
- **Linear OAuth without refresh tokens:** Linear requires all OAuth apps to support refresh tokens by April 1, 2026.

## Open Questions

Things that couldn't be fully resolved:

1. **Linear externalId support for issues (LOW confidence)**
   - What we know: Linear API documentation and GitHub schema confirm `externalId` field exists for Customers and other entities; integrations use it for deduplication.
   - What's unclear: Official Linear API schema at Apollo Studio could not be accessed (403 error). WebSearch and GitHub schema snippets suggest `externalId` exists in `IssueCreateInput`, but complete schema definition not verified.
   - Recommendation: Verify `externalId` field availability in `IssueCreateInput` and `IssueFilter` via GraphQL introspection query against `https://api.linear.app/graphql` during implementation. If unavailable, fallback to title-based or identifier-based deduplication (less robust).

2. **Retry-After header presence on 429 errors**
   - What we know: Linear rate limiting docs mention HTTP headers for tracking limits (`X-RateLimit-*`). WebSearch mentions `Retry-After` in context of rate limiting best practices.
   - What's unclear: Linear docs don't explicitly confirm `Retry-After` header is returned on 429 errors.
   - Recommendation: Implement exponential backoff regardless; check for `Retry-After` header and respect if present, otherwise use backoff algorithm.

3. **GraphQL batching support in Linear API**
   - What we know: Linear uses GraphQL; batching is a common GraphQL optimization. Best practices recommend avoiding batching due to slowest-operation bottleneck.
   - What's unclear: Whether Linear API supports query batching (multiple operations in single request).
   - Recommendation: Don't implement batching (adds complexity, slows responses). Use controlled concurrency (2-5 parallel requests) instead.

4. **Linear project URL parsing to extract project ID**
   - What we know: CONTEXT.md allows `linear_project_url` or `linear_project_id` in spec frontmatter.
   - What's unclear: Linear project URL format (e.g., `https://linear.app/team/project/PROJECT_ID` or different format).
   - Recommendation: Implement URL parsing during implementation once Linear project URL format is observed. Fallback to requiring `linear_project_id` if URL parsing is fragile.

## Sources

### Primary (HIGH confidence)
- [Linear GraphQL API Documentation](https://linear.app/developers/graphql) - API endpoint, authentication, request structure
- [Linear Rate Limiting Documentation](https://linear.app/developers/rate-limiting) - Request limits (5,000/hour), complexity limits (250,000 points/hour), HTTP headers, error codes
- [Linear SDK Documentation](https://linear.app/developers/sdk-fetching-and-modifying-data) - Creating/updating issues, error handling patterns
- [Linear SDK Error Handling](https://linear.app/developers/sdk-errors) - Error types (LinearError, InvalidInputLinearError), error properties
- [Node.js Crypto Module Documentation](https://nodejs.org/api/crypto.html) - SHA-256 hashing with `crypto.createHash('sha256')`
- [@linear/sdk on npm](https://www.npmjs.com/package/@linear/sdk) - Package version 70.0.0+

### Secondary (MEDIUM confidence)
- [VS Code Secret Storage Best Practices](https://dev.to/kompotkot/how-to-use-secretstorage-in-your-vscode-extensions-2hco) - SecretStorage API usage patterns (verified with VS Code docs)
- [exponential-backoff npm package](https://www.npmjs.com/package/exponential-backoff) - Retry logic with jitter, max attempts, backoff configuration
- [GraphQL Concurrent Requests Best Practices](https://www.apollographql.com/docs/graphos/routing/performance/query-batching) - Avoid batching, limit concurrency to 5-10 operations
- [Linear API Common Mistakes](https://linear.app/developers/graphql) - Partial success with HTTP 200, rate limiting, authentication errors

### Tertiary (LOW confidence)
- WebSearch: Linear externalId usage - Found references to externalId in Customer API and integration guides, but IssueCreateInput schema not fully verified
- WebSearch: Retry-After header - Mentioned in rate limiting context but not explicitly confirmed for Linear API 429 responses

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Linear SDK and VS Code APIs are well-documented and stable
- Architecture: MEDIUM-HIGH - Patterns are based on official docs and best practices, but externalId support for issues needs verification
- Pitfalls: HIGH - Based on Linear error handling docs, GraphQL best practices, and VS Code security patterns

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - Linear API is stable, SDK has frequent releases but backwards compatible)
