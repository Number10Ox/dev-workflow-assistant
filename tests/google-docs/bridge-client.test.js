const { describe, it } = require('node:test');
const assert = require('node:assert');

const { GoogleWorkspaceBridgeClient, WORKSPACE_PROVIDER_IDS } = require('../../src/google-docs/bridge-client');

describe('GoogleWorkspaceBridgeClient', () => {
  describe('constructor', () => {
    it('initializes with null provider', () => {
      const client = new GoogleWorkspaceBridgeClient();
      assert.strictEqual(client.provider, null);
    });

    it('accepts vscode module via dependency injection', () => {
      const mockVscode = { extensions: {} };
      const client = new GoogleWorkspaceBridgeClient({ vscode: mockVscode });
      assert.strictEqual(client._vscode, mockVscode);
    });
  });

  describe('hasRequiredCapabilities', () => {
    it('returns false when api is null', () => {
      const client = new GoogleWorkspaceBridgeClient();
      assert.strictEqual(client.hasRequiredCapabilities(null), false);
    });

    it('returns false when capabilities object is missing', () => {
      const client = new GoogleWorkspaceBridgeClient();
      const api = {};
      assert.strictEqual(client.hasRequiredCapabilities(api), false);
    });

    it('returns false when features array is missing', () => {
      const client = new GoogleWorkspaceBridgeClient();
      const api = { capabilities: { version: '1.0' } };
      assert.strictEqual(client.hasRequiredCapabilities(api), false);
    });

    it('returns false when version is missing', () => {
      const client = new GoogleWorkspaceBridgeClient();
      const api = { capabilities: { features: ['docs.readDocument', 'docs.getDocumentInfo'] } };
      assert.strictEqual(client.hasRequiredCapabilities(api), false);
    });

    it('returns false when version is incompatible (major version != 1)', () => {
      const client = new GoogleWorkspaceBridgeClient();
      const api = {
        capabilities: {
          version: '2.0',
          features: ['docs.readDocument', 'docs.getDocumentInfo']
        }
      };
      assert.strictEqual(client.hasRequiredCapabilities(api), false);
    });

    it('returns false when required capabilities are missing', () => {
      const client = new GoogleWorkspaceBridgeClient();
      const api = {
        capabilities: {
          version: '1.0',
          features: ['docs.readDocument'] // Missing docs.getDocumentInfo
        }
      };
      assert.strictEqual(client.hasRequiredCapabilities(api), false);
    });

    it('returns true when all required capabilities are present and version is 1.x', () => {
      const client = new GoogleWorkspaceBridgeClient();
      const api = {
        capabilities: {
          version: '1.0',
          features: ['docs.readDocument', 'docs.getDocumentInfo', 'drive.fetchByUrl']
        }
      };
      assert.strictEqual(client.hasRequiredCapabilities(api), true);
    });

    it('returns true for version 1.2.3 (accepts any 1.x)', () => {
      const client = new GoogleWorkspaceBridgeClient();
      const api = {
        capabilities: {
          version: '1.2.3',
          features: ['docs.readDocument', 'docs.getDocumentInfo']
        }
      };
      assert.strictEqual(client.hasRequiredCapabilities(api), true);
    });
  });

  describe('checkAvailability', () => {
    it('returns error when provider not initialized', async () => {
      const client = new GoogleWorkspaceBridgeClient();
      const result = await client.checkAvailability();

      assert.strictEqual(result.available, false);
      assert.strictEqual(result.error, 'Provider not initialized');
      assert.ok(result.setupInstructions);
    });

    it('delegates to provider when initialized', async () => {
      const mockProvider = {
        checkAvailability: async () => ({ available: true })
      };

      const client = new GoogleWorkspaceBridgeClient();
      client.provider = mockProvider;

      const result = await client.checkAvailability();
      assert.strictEqual(result.available, true);
    });
  });

  describe('readDocument', () => {
    it('throws when provider not initialized', async () => {
      const client = new GoogleWorkspaceBridgeClient();

      await assert.rejects(
        async () => await client.readDocument('doc-123'),
        /Bridge client not initialized/
      );
    });

    it('delegates to provider.docs.readDocument when initialized', async () => {
      const mockDoc = { documentId: 'doc-123', title: 'Test Doc', body: {} };
      const mockProvider = {
        docs: {
          readDocument: async (docId) => {
            assert.strictEqual(docId, 'doc-123');
            return mockDoc;
          }
        }
      };

      const client = new GoogleWorkspaceBridgeClient();
      client.provider = mockProvider;

      const result = await client.readDocument('doc-123');
      assert.strictEqual(result, mockDoc);
    });
  });

  describe('getDocumentInfo', () => {
    it('throws when provider not initialized', async () => {
      const client = new GoogleWorkspaceBridgeClient();

      await assert.rejects(
        async () => await client.getDocumentInfo('doc-123'),
        /Bridge client not initialized/
      );
    });

    it('delegates to provider.docs.getDocumentInfo when initialized', async () => {
      const mockInfo = {
        id: 'doc-123',
        title: 'Test Doc',
        revisionId: 'rev-456',
        etag: 'etag-789',
        modifiedTime: '2026-01-25T12:00:00Z'
      };
      const mockProvider = {
        docs: {
          getDocumentInfo: async (docId) => {
            assert.strictEqual(docId, 'doc-123');
            return mockInfo;
          }
        }
      };

      const client = new GoogleWorkspaceBridgeClient();
      client.provider = mockProvider;

      const result = await client.getDocumentInfo('doc-123');
      assert.strictEqual(result, mockInfo);
    });
  });

  describe('fetchAsset', () => {
    it('throws when provider not initialized', async () => {
      const client = new GoogleWorkspaceBridgeClient();

      await assert.rejects(
        async () => await client.fetchAsset('https://example.com/image.png'),
        /Bridge client not initialized/
      );
    });

    it('delegates to provider.drive.fetchByUrl when initialized', async () => {
      const mockAsset = {
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
        name: 'image.png'
      };
      const mockProvider = {
        drive: {
          fetchByUrl: async (url) => {
            assert.strictEqual(url, 'https://example.com/image.png');
            return mockAsset;
          }
        }
      };

      const client = new GoogleWorkspaceBridgeClient();
      client.provider = mockProvider;

      const result = await client.fetchAsset('https://example.com/image.png');
      assert.strictEqual(result, mockAsset);
    });
  });

  describe('WORKSPACE_PROVIDER_IDS', () => {
    it('exports provider ID constants', () => {
      assert.ok(Array.isArray(WORKSPACE_PROVIDER_IDS));
      assert.ok(WORKSPACE_PROVIDER_IDS.length > 0);
      assert.ok(WORKSPACE_PROVIDER_IDS.includes('jedwards.gworkspace-provider'));
      assert.ok(WORKSPACE_PROVIDER_IDS.includes('gworkspace-provider'));
    });
  });
});
