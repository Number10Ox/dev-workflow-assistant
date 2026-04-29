const { describe, it } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const SDK_PATH = '@linear/sdk';

function withMockedSdk(mockSdk, fn) {
  const original = Module._load;
  Module._load = function patched(request, ...rest) {
    if (request === SDK_PATH) return mockSdk;
    return original.call(this, request, ...rest);
  };
  for (const k of Object.keys(require.cache)) {
    if (k.includes('direct-tracker.js') || k.includes('@linear/sdk')) {
      delete require.cache[k];
    }
  }
  try {
    return fn();
  } finally {
    Module._load = original;
    for (const k of Object.keys(require.cache)) {
      if (k.includes('direct-tracker.js') || k.includes('@linear/sdk')) {
        delete require.cache[k];
      }
    }
  }
}

class FakeLinearError extends Error {
  constructor(errors) {
    super('FakeLinearError');
    this.errors = errors || [];
  }
}
class FakeInvalidInputError extends FakeLinearError {}

function makeMockSdk(clientImpl) {
  return {
    LinearClient: function (opts) {
      Object.assign(this, clientImpl(opts));
    },
    LinearError: FakeLinearError,
    InvalidInputLinearError: FakeInvalidInputError
  };
}

// Build a fake Linear Issue object — fields that the SDK exposes lazily are
// represented as Promises (the JS SDK awaits them as `await issue.state` etc.).
function makeFakeIssue({ id, title, description, identifier, url, projectId, assigneeId, stateName, labels }) {
  return {
    id, title, description, identifier, url,
    state: Promise.resolve({ name: stateName || 'Backlog' }),
    assignee: Promise.resolve(assigneeId ? { id: assigneeId } : null),
    project: Promise.resolve(projectId ? { id: projectId } : null),
    labels: async () => ({ nodes: (labels || []).map((name) => ({ name })) })
  };
}

describe('DirectLinearTracker', () => {
  describe('constructor', () => {
    it('throws when no apiKey provided', () => {
      withMockedSdk(makeMockSdk(() => ({})), () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        assert.throws(() => new DirectLinearTracker(), /requires a Linear API key/);
        assert.throws(() => new DirectLinearTracker(''), /requires a Linear API key/);
      });
    });

    it('passes apiKey to LinearClient', () => {
      let received;
      withMockedSdk(makeMockSdk((opts) => { received = opts.apiKey; return {}; }), () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        new DirectLinearTracker('lin_api_test');
      });
      assert.strictEqual(received, 'lin_api_test');
    });
  });

  describe('createIssue', () => {
    it('does NOT pass externalId to Linear (Issue has no such field)', async () => {
      let createCall;
      let attachCall;
      const sdk = makeMockSdk(() => ({
        teams: async () => ({ nodes: [{ id: 'team_123' }] }),
        createIssue: async (input) => {
          createCall = input;
          return {
            success: true,
            issue: Promise.resolve(makeFakeIssue({
              id: 'iss_1', title: input.title, description: input.description,
              identifier: 'PA-1', url: 'https://linear.app/pa/issue/PA-1',
              projectId: input.projectId
            }))
          };
        },
        attachmentLinkURL: async (issueId, url, opts) => {
          attachCall = { issueId, url, opts };
          return { success: true };
        }
      }));

      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        const issue = await t.createIssue({
          title: 'Hello', description: 'Body',
          externalId: 'FEAT-2026-001-DEL-001',
          container: 'project_abc'
        });

        // Issue create does NOT include externalId (Linear would reject it).
        assert.strictEqual(createCall.externalId, undefined,
          'createIssue input must not contain externalId');
        // Container is mapped to projectId.
        assert.strictEqual(createCall.projectId, 'project_abc');

        // Attachment is created with the dedup URL.
        assert.strictEqual(attachCall.issueId, 'iss_1');
        assert.strictEqual(attachCall.url, 'dwa://deliverable/FEAT-2026-001-DEL-001');
        assert.match(attachCall.opts.title, /FEAT-2026-001-DEL-001/);

        // Returned object surfaces externalId from input.
        assert.strictEqual(issue.externalId, 'FEAT-2026-001-DEL-001');
        assert.strictEqual(issue.container, 'project_abc');
      });
    });

    it('skips the attachment call when externalId is not provided', async () => {
      let attachCalled = false;
      const sdk = makeMockSdk(() => ({
        teams: async () => ({ nodes: [{ id: 'team_x' }] }),
        createIssue: async (input) => ({
          success: true,
          issue: Promise.resolve(makeFakeIssue({
            id: 'iss', title: input.title, description: '', identifier: 'PA-2', url: ''
          }))
        }),
        attachmentLinkURL: async () => { attachCalled = true; return { success: true }; }
      }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        const issue = await t.createIssue({ title: 't', description: 'd' });
        assert.strictEqual(attachCalled, false);
        assert.strictEqual(issue.externalId, undefined);
      });
    });

    it('throws when no teams exist in workspace', async () => {
      const sdk = makeMockSdk(() => ({ teams: async () => ({ nodes: [] }) }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        await assert.rejects(
          () => t.createIssue({ title: 't', description: 'd' }),
          /No teams found/
        );
      });
    });
  });

  describe('queryByExternalId', () => {
    it('uses attachmentsForURL with the dwa:// dedup scheme', async () => {
      let queriedUrl;
      const sdk = makeMockSdk(() => ({
        attachmentsForURL: async (url) => {
          queriedUrl = url;
          return { nodes: [] };
        }
      }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        const result = await t.queryByExternalId('FEAT-2026-001-DEL-007');
        assert.strictEqual(queriedUrl, 'dwa://deliverable/FEAT-2026-001-DEL-007');
        assert.strictEqual(result, null);
      });
    });

    it('returns null when externalId is empty', async () => {
      const sdk = makeMockSdk(() => ({
        attachmentsForURL: async () => { throw new Error('should not be called'); }
      }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        assert.strictEqual(await t.queryByExternalId(''), null);
      });
    });

    it('returns mapped issue with externalId set when found', async () => {
      const fakeIssue = makeFakeIssue({
        id: 'iss_found', title: 'Existing', description: '',
        identifier: 'PA-9', url: 'https://linear.app/pa/issue/PA-9',
        assigneeId: 'user_1', projectId: 'proj_1', stateName: 'Started',
        labels: ['feature']
      });
      const sdk = makeMockSdk(() => ({
        attachmentsForURL: async () => ({
          nodes: [{ issue: Promise.resolve(fakeIssue) }]
        })
      }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        const issue = await t.queryByExternalId('FEAT-2026-001-DEL-001');
        assert.strictEqual(issue.identifier, 'PA-9');
        assert.strictEqual(issue.externalId, 'FEAT-2026-001-DEL-001');
        assert.strictEqual(issue.assignee, 'user_1');
        assert.deepStrictEqual(issue.labels, ['feature']);
      });
    });
  });

  describe('updateIssue', () => {
    it('passes assigneeId from updates.assignee', async () => {
      let updateArgs;
      const sdk = makeMockSdk(() => ({
        updateIssue: async (id, updates) => {
          updateArgs = { id, updates };
          return {
            success: true,
            issue: Promise.resolve(makeFakeIssue({
              id, title: updates.title, description: updates.description,
              identifier: 'PA-3', url: '', assigneeId: updates.assigneeId
            }))
          };
        }
      }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        const result = await t.updateIssue('issue_xyz', {
          title: 'New', description: 'New body', assignee: 'user_42'
        });
        assert.strictEqual(updateArgs.updates.assigneeId, 'user_42');
        assert.strictEqual(result.assignee, 'user_42');
      });
    });
  });

  describe('listIssues', () => {
    it('does not honor externalId filter (Issue has no such field)', async () => {
      let receivedFilter;
      const sdk = makeMockSdk(() => ({
        issues: async (args) => {
          receivedFilter = args.filter;
          return { nodes: [] };
        }
      }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        await t.listIssues({ externalId: 'FEAT-001', status: 'Done' });
        assert.strictEqual(receivedFilter.externalId, undefined);
        assert.deepStrictEqual(receivedFilter.state, { name: { eq: 'Done' } });
      });
    });
  });

  describe('rate limit handling', () => {
    it('does not retry InvalidInputLinearError', async () => {
      let callCount = 0;
      const sdk = makeMockSdk(() => ({
        teams: async () => {
          callCount++;
          throw new FakeInvalidInputError([{ extensions: { code: 'INVALID' } }]);
        }
      }));
      await withMockedSdk(sdk, async () => {
        const { DirectLinearTracker } = require('../../src/linear/direct-tracker');
        const t = new DirectLinearTracker('lin_api_x');
        await assert.rejects(() => t.createIssue({ title: 't', description: 'd' }));
        assert.strictEqual(callCount, 1, 'invalid input should not retry');
      });
    });
  });
});

describe('validateApiKey', () => {
  it('returns invalid when no key provided', async () => {
    await withMockedSdk(makeMockSdk(() => ({})), async () => {
      const { validateApiKey } = require('../../src/linear/direct-tracker');
      const result = await validateApiKey('');
      assert.strictEqual(result.valid, false);
    });
  });

  it('returns invalid when SDK throws', async () => {
    const sdk = makeMockSdk(() => ({
      get viewer() { return Promise.reject(new Error('Unauthorized')); }
    }));
    await withMockedSdk(sdk, async () => {
      const { validateApiKey } = require('../../src/linear/direct-tracker');
      const result = await validateApiKey('lin_api_bad');
      assert.strictEqual(result.valid, false);
      assert.match(result.error, /Unauthorized/);
    });
  });

  it('returns valid with viewer info when authenticated', async () => {
    const sdk = makeMockSdk(() => ({
      get viewer() {
        return Promise.resolve({ id: 'user_1', name: 'Jon', email: 'j@example.com' });
      }
    }));
    await withMockedSdk(sdk, async () => {
      const { validateApiKey } = require('../../src/linear/direct-tracker');
      const result = await validateApiKey('lin_api_good');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.viewer.id, 'user_1');
      assert.strictEqual(result.viewer.name, 'Jon');
    });
  });

  it('returns invalid when viewer is missing id', async () => {
    const sdk = makeMockSdk(() => ({
      get viewer() { return Promise.resolve(null); }
    }));
    await withMockedSdk(sdk, async () => {
      const { validateApiKey } = require('../../src/linear/direct-tracker');
      const result = await validateApiKey('lin_api_x');
      assert.strictEqual(result.valid, false);
      assert.match(result.error, /no viewer/i);
    });
  });
});

describe('makeDedupUrl', () => {
  it('uses the dwa://deliverable/ scheme', () => {
    withMockedSdk(makeMockSdk(() => ({})), () => {
      const { makeDedupUrl, DEDUP_URL_PREFIX } = require('../../src/linear/direct-tracker');
      assert.strictEqual(DEDUP_URL_PREFIX, 'dwa://deliverable/');
      assert.strictEqual(makeDedupUrl('FEAT-2026-001-DEL-003'), 'dwa://deliverable/FEAT-2026-001-DEL-003');
    });
  });
});
