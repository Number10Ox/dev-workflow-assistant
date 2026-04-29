/**
 * Direct Linear API backend.
 *
 * Implements the same IssueTracker interface as the devex-service-bridge's
 * LinearTracker, but talks to @linear/sdk directly instead of going through
 * a VS Code extension. Used by IssueTrackerFactory when DWA is run outside
 * the VSCode extension host.
 *
 * IMPORTANT — externalId is NOT a field on Linear's Issue. Linear's pattern
 * for "this issue corresponds to entity X in my external system" is
 * Attachments, where the attachment URL acts as the unique identifier:
 *   - Create issue, then call attachmentLinkURL(issueId, "dwa://deliverable/<externalId>").
 *     Linear de-dupes attachments by URL within the workspace.
 *   - Query by externalId via attachmentsForURL("dwa://deliverable/<externalId>").
 *
 * The bridge's `linearTracker.ts` has the same wrong assumption (passes
 * externalId on IssueCreateInput with `as any`); fixing the bridge is
 * out of scope for this plan but tracked.
 */

const { LinearClient, LinearError, InvalidInputLinearError } = require('@linear/sdk');
const { backOff } = require('exponential-backoff');

// URL scheme namespacing the dedup attachments. Future DWA artifact types
// (drift events, plans, etc.) can use sibling paths like dwa://drift/<id>.
const DEDUP_URL_PREFIX = 'dwa://deliverable/';

function makeDedupUrl(externalId) {
  return `${DEDUP_URL_PREFIX}${externalId}`;
}

class DirectLinearTracker {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('DirectLinearTracker requires a Linear API key');
    }
    this.client = new LinearClient({ apiKey });
  }

  async _withRateLimitHandling(operation) {
    return backOff(
      async () => {
        try {
          return await operation();
        } catch (err) {
          if (err instanceof LinearError) {
            const rateLimited = err.errors?.find(
              (e) => e.extensions?.code === 'RATELIMITED'
            );
            if (rateLimited) throw err;
            if (err instanceof InvalidInputLinearError) throw err;
          }
          throw err;
        }
      },
      {
        numOfAttempts: 5,
        startingDelay: 1000,
        timeMultiple: 2,
        jitter: 'full',
        maxDelay: 30000,
        retry: (err) => {
          if (err instanceof InvalidInputLinearError) return false;
          if (err instanceof LinearError) {
            return err.errors?.some((e) => e.extensions?.code === 'RATELIMITED') ?? false;
          }
          return true;
        }
      }
    );
  }

  async createIssue(input) {
    return this._withRateLimitHandling(async () => {
      const teams = await this.client.teams();
      const team = teams.nodes[0];
      if (!team) {
        throw new Error('No teams found in Linear workspace');
      }

      const issueCreate = await this.client.createIssue({
        teamId: team.id,
        title: input.title,
        description: input.description,
        projectId: input.container
      });

      if (!issueCreate.success || !issueCreate.issue) {
        throw new Error('Failed to create Linear issue');
      }

      const issue = await issueCreate.issue;

      // Attach a dedup link if caller provided an externalId. Linear treats the
      // attachment URL as a unique identifier — re-creating the same URL on a
      // future sync (or on a fresh clone) updates the existing attachment
      // instead of duplicating, which gives us cross-machine idempotency.
      if (input.externalId) {
        await this.client.attachmentLinkURL(
          issue.id,
          makeDedupUrl(input.externalId),
          { title: `DWA: ${input.externalId}` }
        );
      }

      const mapped = await this._mapIssue(issue);
      if (input.externalId) mapped.externalId = input.externalId;
      return mapped;
    });
  }

  async updateIssue(id, updates) {
    return this._withRateLimitHandling(async () => {
      const issueUpdate = await this.client.updateIssue(id, {
        title: updates.title,
        description: updates.description,
        assigneeId: updates.assignee
      });

      if (!issueUpdate.success || !issueUpdate.issue) {
        throw new Error('Failed to update Linear issue');
      }

      return this._mapIssue(await issueUpdate.issue);
    });
  }

  async getIssue(id) {
    return this._withRateLimitHandling(async () => {
      const issue = await this.client.issue(id);
      if (!issue) {
        throw new Error('Issue not found');
      }
      return this._mapIssue(issue);
    });
  }

  async listIssues(filter = {}) {
    return this._withRateLimitHandling(async () => {
      const linearFilter = {};
      if (filter.status) linearFilter.state = { name: { eq: filter.status } };
      if (filter.container) linearFilter.project = { id: { eq: filter.container } };
      // Note: filter.externalId is intentionally not honored here.
      // Linear has no Issue.externalId field; use queryByExternalId() instead,
      // which goes through the Attachments path.

      const issues = await this.client.issues({
        filter: Object.keys(linearFilter).length > 0 ? linearFilter : undefined
      });

      return Promise.all(issues.nodes.map((i) => this._mapIssue(i)));
    });
  }

  async queryByExternalId(externalId) {
    return this._withRateLimitHandling(async () => {
      if (!externalId) return null;
      const url = makeDedupUrl(externalId);
      const attachments = await this.client.attachmentsForURL(url);
      if (!attachments?.nodes?.length) return null;

      // Defensively take the first attachment. The same URL shouldn't
      // appear on multiple issues for our use case, but Linear's API
      // doesn't enforce that constraint across issues.
      const issue = await attachments.nodes[0].issue;
      if (!issue) return null;
      const mapped = await this._mapIssue(issue);
      mapped.externalId = externalId;
      return mapped;
    });
  }

  async _mapIssue(linearIssue) {
    // Resolve lazy fields. Issue.externalId does NOT exist on Linear (the
    // dedup identity lives on Attachment.url); callers that know the
    // externalId set it on the returned object themselves.
    const [state, assignee, project] = await Promise.all([
      linearIssue.state,
      linearIssue.assignee,
      linearIssue.project
    ]);

    let labels = [];
    try {
      const labelsConn = await linearIssue.labels();
      labels = labelsConn?.nodes?.map((l) => l.name) || [];
    } catch {
      // Labels are optional; tolerate absence.
    }

    return {
      id: linearIssue.id,
      title: linearIssue.title,
      description: linearIssue.description || '',
      status: state?.name || 'Unknown',
      assignee: assignee?.id,
      labels,
      url: linearIssue.url,
      externalId: undefined,
      identifier: linearIssue.identifier,
      container: project?.id
    };
  }
}

/**
 * Validate a Linear API key by issuing a single low-cost authenticated request.
 * Uses `client.viewer` (current user) — smaller payload than `teams()` and
 * works even for keys without team-create scope.
 *
 * @returns {Promise<{ valid: boolean, viewer?: { id, name, email }, error?: string }>}
 */
async function validateApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, error: 'No API key provided' };
  }
  try {
    const client = new LinearClient({ apiKey });
    const viewer = await client.viewer;
    if (!viewer || !viewer.id) {
      return { valid: false, error: 'Linear returned no viewer for this key' };
    }
    return {
      valid: true,
      viewer: { id: viewer.id, name: viewer.name, email: viewer.email }
    };
  } catch (err) {
    return { valid: false, error: err?.message || String(err) };
  }
}

module.exports = {
  DirectLinearTracker,
  validateApiKey,
  // Exported for tests/diagnostics.
  DEDUP_URL_PREFIX,
  makeDedupUrl
};
