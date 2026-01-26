# Phase 9: JIRA Provider Demo

## Goal

Implement a JIRA issue tracker provider to prove DWA's extensibility and enable demos for enterprise audiences who use JIRA.

## Problem Statement

Linear is used by ~10% of development teams. JIRA dominates enterprise (~70% market share). For portfolio/pitch purposes, demonstrating JIRA support:
1. Proves the `IssueTracker` interface is truly provider-agnostic
2. Opens demos to enterprise audiences
3. Shows architectural foresight

## Non-Goal

This is NOT intended for heavy production use. It's a proof-of-concept to:
- Validate the interface design
- Enable demos
- Document extension points for future contributors

## Architecture Review

### Existing IssueTracker Interface

From `devex-service-bridge/packages/linear-provider/src/linearTracker.ts`:

```typescript
export interface IssueTracker {
  createIssue(input: IssueCreateInput): Promise<Issue>;
  updateIssue(id: string, updates: Partial<Issue>): Promise<Issue>;
  getIssue(id: string): Promise<Issue>;
  listIssues(filter?: IssueFilter): Promise<Issue[]>;
  queryByExternalId(externalId: string): Promise<Issue | null>;
}

export interface IssueCreateInput {
  title: string;
  description: string;
  labels?: string[];
  externalId?: string;      // For deduplication across systems
  container?: string;       // Project/epic (provider maps to native concept)
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee?: string;
  labels?: string[];
  url?: string;
  externalId?: string;
  identifier?: string;      // Human-readable ID (e.g., "PROJ-123")
  container?: string;
}
```

### JIRA Mapping

| DWA Concept | JIRA Concept |
|-------------|--------------|
| Issue | Issue |
| container | projectKey |
| externalId | Custom field or properties API |
| identifier | issue.key (e.g., "PROJ-123") |
| labels | labels array |
| status | status.name |

### JIRA API

Use JIRA REST API v3 (Cloud) or v2 (Server):

```
POST /rest/api/3/issue          # Create issue
PUT  /rest/api/3/issue/{id}     # Update issue
GET  /rest/api/3/issue/{id}     # Get issue
GET  /rest/api/3/search?jql=... # Search issues
```

Authentication: API token (Cloud) or OAuth/PAT (Server/DC).

## Technical Decisions

### Use jira.js SDK

The [jira.js](https://www.npmjs.com/package/jira.js) package provides typed access to JIRA Cloud/Server APIs:

```typescript
import { Version3Client } from 'jira.js';

const client = new Version3Client({
  host: 'https://your-domain.atlassian.net',
  authentication: {
    basic: {
      email: 'your-email@example.com',
      apiToken: 'your-api-token',
    },
  },
});
```

### External ID Storage

JIRA doesn't have native `externalId`. Options:

1. **Custom field** - Create "DWA External ID" field (requires admin)
2. **Issue properties** - Use JIRA's entity properties API (no admin needed)
3. **Label convention** - `dwa:FEAT-2026-001:DEL-001` (hacky but works)

**Decision:** Use issue properties API as primary, fall back to label convention.

### Rate Limiting

JIRA Cloud: 100 requests/minute per user
JIRA Server: Varies by instance

Use same exponential backoff pattern as LinearTracker.

## Success Criteria

1. `JiraTracker` implements `IssueTracker` interface completely
2. DWA `sync-linear` command works with JIRA provider when configured
3. External ID deduplication works (no duplicate issues on re-sync)
4. Demo: create deliverables in JIRA from DWA registry
5. Documentation explains how to add new providers

## Out of Scope

- JIRA Server/Data Center support (Cloud only for demo)
- Bidirectional sync (JIRA → DWA)
- Custom field creation automation
- JIRA workflow transitions

## References

- [jira.js SDK](https://www.npmjs.com/package/jira.js)
- [JIRA Cloud REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [JIRA Entity Properties](https://developer.atlassian.com/cloud/jira/platform/jira-entity-properties/)
