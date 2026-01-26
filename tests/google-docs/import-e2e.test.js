/**
 * End-to-end tests for Google Docs import flow.
 *
 * Tests the complete import pipeline:
 * 1. Initialize bridge client, check provider availability
 * 2. Parse doc ID from URL/ID input
 * 3. Read document JSON via bridge client (devex-service-bridge)
 * 4. Convert: gdoc JSON -> mdast -> markdown
 * 5. Check existing file for hash (idempotent reimport)
 * 6. Wrap with DWA markers
 * 7. Write file atomically
 * 8. Generate import report
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { importGoogleDoc } = require('../../src/google-docs/import');

/**
 * Create mock bridge client for testing.
 */
function createMockBridgeClient(options = {}) {
  const {
    available = true,
    docTitle = 'Test Document',
    docContent = [],
    revisionId = 'rev-abc123',
    etag = 'etag-xyz789',
    modifiedTime = '2024-01-01T00:00:00Z',
    shouldFail = false
  } = options;

  return {
    checkAvailability: async () => {
      if (!available) {
        return {
          available: false,
          error: 'Provider not configured',
          setupInstructions: 'Run DevEx Service Bridge setup wizard to configure Google Docs access.'
        };
      }
      return { available: true };
    },

    readDocument: async (docId) => {
      if (shouldFail) {
        throw new Error('Document not found or access denied');
      }
      return {
        documentId: docId,
        title: docTitle,
        body: {
          content: docContent
        }
      };
    },

    getDocumentInfo: async (docId) => {
      if (shouldFail) {
        throw new Error('Document not found or access denied');
      }
      return {
        id: docId,
        title: docTitle,
        revisionId,
        etag,
        modifiedTime
      };
    }
  };
}

describe('google-docs/import-e2e', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-import-e2e-'));
  });

  describe('Full import flow', () => {
    it('should complete full import with markers and report', async () => {
      // Create .dwa directory
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      // Create mock provider with simple content
      const mockContent = [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Hello World\n',
                  textStyle: {}
                }
              }
            ]
          }
        }
      ];

      const mockClient = createMockBridgeClient({
        docContent: mockContent,
        docTitle: 'Test Feature Spec'
      });

      // Run import
      const result = await importGoogleDoc({
        docIdOrUrl: 'https://docs.google.com/document/d/1testDoc123/edit',
        projectRoot: tempDir,
        bridgeClient: mockClient
      });

      // Verify success
      assert.strictEqual(result.success, true);
      assert.ok(result.outputPath);
      assert.ok(result.report);

      // Verify output file exists
      const outputPath = path.join(tempDir, 'feature-spec.md');
      assert.ok(await fs.pathExists(outputPath));

      // Verify file content has markers
      const content = await fs.readFile(outputPath, 'utf8');
      assert.ok(content.includes('<!-- DWA:SOURCE doc="gdoc" docId="1testDoc123" -->'));
      assert.ok(content.includes('<!-- DWA:IMPORT_BEGIN'));
      assert.ok(content.includes('docId="1testDoc123"'));
      assert.ok(content.includes('revisionId="rev-abc123"'));
      assert.ok(content.includes('importHash="sha256:'));
      assert.ok(content.includes('<!-- DWA:IMPORT_END -->'));
      assert.ok(content.includes('Hello World'));

      // Verify import report created
      const reportsDir = path.join(tempDir, '.dwa', 'import-reports');
      assert.ok(await fs.pathExists(reportsDir));

      const reportFiles = await fs.readdir(reportsDir);
      assert.strictEqual(reportFiles.length, 1);
      assert.ok(reportFiles[0].startsWith('1testDoc123-'));

      // Verify report content
      const reportPath = path.join(reportsDir, reportFiles[0]);
      const report = await fs.readJSON(reportPath);
      assert.strictEqual(report.source.docId, '1testDoc123');
      assert.strictEqual(report.source.title, 'Test Feature Spec');
      assert.ok(report.importTimestamp);
      assert.ok(report.summary);
    });
  });

  describe('Idempotent reimport behavior', () => {
    it('should skip reimport when document unchanged', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockContent = [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Test content\n',
                  textStyle: {}
                }
              }
            ]
          }
        }
      ];

      // Use same revisionId for both calls to simulate unchanged document
      const fixedRevisionId = 'rev-unchanged-123';

      const mockClient = createMockBridgeClient({
        docContent: mockContent,
        revisionId: fixedRevisionId
      });

      // First import
      const result1 = await importGoogleDoc({
        docIdOrUrl: '1testDoc456',
        projectRoot: tempDir,
        bridgeClient: mockClient
      });

      assert.strictEqual(result1.success, true);

      // Second import (unchanged)
      const result2 = await importGoogleDoc({
        docIdOrUrl: '1testDoc456',
        projectRoot: tempDir,
        bridgeClient: mockClient
      });

      assert.strictEqual(result2.success, true);
      assert.ok(result2.message.includes('Already at latest'));
    });

    it('should detect hash mismatch when file locally edited', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockContent = [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Original content\n',
                  textStyle: {}
                }
              }
            ]
          }
        }
      ];

      const mockClient = createMockBridgeClient({
        docContent: mockContent,
        revisionId: 'rev-123'
      });

      // First import
      await importGoogleDoc({
        docIdOrUrl: '1testDoc789',
        projectRoot: tempDir,
        bridgeClient: mockClient
      });

      // Modify file locally (simulate user edit)
      const specPath = path.join(tempDir, 'feature-spec.md');
      let content = await fs.readFile(specPath, 'utf8');
      content = content.replace('Original content', 'Locally modified content');
      await fs.writeFile(specPath, content, 'utf8');

      // Try to reimport (should detect hash mismatch)
      const result = await importGoogleDoc({
        docIdOrUrl: '1testDoc789',
        projectRoot: tempDir,
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Local edits detected'));
      assert.ok(result.message.includes('Hash mismatch'));
      assert.ok(result.diffPath);

      // Verify diff artifact created
      assert.ok(await fs.pathExists(result.diffPath));
      const diffContent = await fs.readFile(result.diffPath, 'utf8');
      assert.ok(diffContent.includes('Import Diff:'));
      assert.ok(diffContent.includes('1testDoc789'));
    });

    it('should overwrite on hash mismatch with --force flag', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockContent = [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Original content\n',
                  textStyle: {}
                }
              }
            ]
          }
        }
      ];

      const mockClient = createMockBridgeClient({
        docContent: mockContent
      });

      // First import
      await importGoogleDoc({
        docIdOrUrl: '1testDocForce',
        projectRoot: tempDir,
        bridgeClient: mockClient
      });

      // Modify file locally
      const specPath = path.join(tempDir, 'feature-spec.md');
      let content = await fs.readFile(specPath, 'utf8');
      content = content.replace('Original content', 'Locally modified content');
      await fs.writeFile(specPath, content, 'utf8');

      // Reimport with --force
      const result = await importGoogleDoc({
        docIdOrUrl: '1testDocForce',
        projectRoot: tempDir,
        force: true,
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, true);

      // Verify file was overwritten (local edit removed)
      const newContent = await fs.readFile(specPath, 'utf8');
      assert.ok(newContent.includes('Original content'));
      assert.ok(!newContent.includes('Locally modified content'));
    });
  });

  describe('Error handling', () => {
    it('should handle provider unavailable gracefully', async () => {
      const mockClient = createMockBridgeClient({ available: false });

      const result = await importGoogleDoc({
        docIdOrUrl: '1testDoc',
        projectRoot: tempDir,
        out: 'test.md',
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Run DevEx Service Bridge setup wizard'));
      assert.ok(result.diagnostics);
      assert.strictEqual(result.diagnostics[0].code, 'DWA-GDOC-404');
    });

    it('should handle document access errors', async () => {
      const mockClient = createMockBridgeClient({ shouldFail: true });

      const result = await importGoogleDoc({
        docIdOrUrl: '1testDocFail',
        projectRoot: tempDir,
        out: 'test.md',
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Cannot access document'));
      assert.ok(result.diagnostics);
      assert.strictEqual(result.diagnostics[0].code, 'DWA-GDOC-402');
    });

    it('should provide clear error when no .dwa/ and no --out', async () => {
      const mockContent = [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Test\n',
                  textStyle: {}
                }
              }
            ]
          }
        }
      ];

      const mockClient = createMockBridgeClient({ docContent: mockContent });

      const result = await importGoogleDoc({
        docIdOrUrl: '1testDocNoOut',
        projectRoot: tempDir,
        // No --out and no .dwa/
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Cannot determine output path'));
      assert.ok(result.message.includes('No .dwa/ directory found'));
      assert.ok(result.message.includes('Use --out'));
    });

    it('should handle invalid document ID format', async () => {
      const mockClient = createMockBridgeClient();

      const result = await importGoogleDoc({
        docIdOrUrl: 'bad',  // Too short (< 10 chars)
        projectRoot: tempDir,
        out: 'test.md',
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid Google Docs URL or ID'));
    });
  });

  describe('Complex document conversion', () => {
    it('should handle document with headings, lists, and formatting', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockContent = [
        // Heading
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Feature Title\n',
                  textStyle: {}
                }
              }
            ],
            paragraphStyle: {
              namedStyleType: 'HEADING_1'
            }
          }
        },
        // Bullet list
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'First item\n',
                  textStyle: {}
                }
              }
            ],
            bullet: {
              listId: 'list1',
              nestingLevel: 0
            }
          }
        },
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Second item\n',
                  textStyle: {}
                }
              }
            ],
            bullet: {
              listId: 'list1',
              nestingLevel: 0
            }
          }
        },
        // Bold text
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Important note\n',
                  textStyle: {
                    bold: true
                  }
                }
              }
            ]
          }
        }
      ];

      const mockClient = createMockBridgeClient({
        docContent: mockContent,
        docTitle: 'Complex Document'
      });

      const result = await importGoogleDoc({
        docIdOrUrl: '1complexDoc',
        projectRoot: tempDir,
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, true);

      const outputPath = path.join(tempDir, 'feature-spec.md');
      const content = await fs.readFile(outputPath, 'utf8');

      // Verify heading converted
      assert.ok(content.includes('# Feature Title'));

      // Verify list converted
      assert.ok(content.includes('- First item'));
      assert.ok(content.includes('- Second item'));

      // Verify bold converted
      assert.ok(content.includes('**Important note**'));
    });
  });

  describe('Dry run mode', () => {
    it('should preview import without writing files', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockContent = [
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'Test content\n',
                  textStyle: {}
                }
              }
            ]
          }
        }
      ];

      const mockClient = createMockBridgeClient({ docContent: mockContent });

      const result = await importGoogleDoc({
        docIdOrUrl: '1dryRunDoc',
        projectRoot: tempDir,
        dryRun: true,
        bridgeClient: mockClient
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('[DRY RUN]'));

      // Verify no files written
      const specPath = path.join(tempDir, 'feature-spec.md');
      assert.ok(!await fs.pathExists(specPath));

      // Verify no report written
      const reportsDir = path.join(tempDir, '.dwa', 'import-reports');
      const reportFiles = await fs.readdir(reportsDir).catch(() => []);
      assert.strictEqual(reportFiles.length, 0);
    });
  });
});
