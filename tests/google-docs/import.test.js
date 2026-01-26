/**
 * Tests for Google Docs import orchestration.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
  importGoogleDoc,
  parseDocIdFromUrl,
  wrapWithMarkers,
  generateImportDiff,
  findFeatureRoot
} = require('../../src/google-docs/import');

describe('google-docs/import', () => {
  describe('parseDocIdFromUrl', () => {
    it('should extract document ID from standard URL', () => {
      const url = 'https://docs.google.com/document/d/1abc123XYZ_-/edit';
      const docId = parseDocIdFromUrl(url);
      assert.strictEqual(docId, '1abc123XYZ_-');
    });

    it('should extract document ID from URL with query params', () => {
      const url = 'https://docs.google.com/document/d/1abc123XYZ_-/edit?usp=sharing';
      const docId = parseDocIdFromUrl(url);
      assert.strictEqual(docId, '1abc123XYZ_-');
    });

    it('should accept raw document ID', () => {
      const rawId = '1abc123XYZ_-456';
      const docId = parseDocIdFromUrl(rawId);
      assert.strictEqual(docId, '1abc123XYZ_-456');
    });

    it('should throw error for invalid URL', () => {
      assert.throws(
        () => parseDocIdFromUrl('https://example.com/not-a-doc'),
        /Invalid Google Docs URL or ID/
      );
    });

    it('should throw error for too short input', () => {
      assert.throws(
        () => parseDocIdFromUrl('short'),
        /Invalid Google Docs URL or ID/
      );
    });

    it('should throw error for empty input', () => {
      assert.throws(
        () => parseDocIdFromUrl(''),
        /Invalid/
      );
    });

    it('should throw error for null input', () => {
      assert.throws(
        () => parseDocIdFromUrl(null),
        /Invalid input/
      );
    });
  });

  describe('wrapWithMarkers', () => {
    it('should wrap content with DWA markers', () => {
      const content = '# Test Document\n\nSome content.';
      const docId = '1abc123';
      const revisionId = 'rev456';
      const importHash = 'sha256:abcdef';

      const wrapped = wrapWithMarkers(content, docId, revisionId, importHash);

      assert.ok(wrapped.includes('<!-- DWA:SOURCE doc="gdoc" docId="1abc123" -->'));
      assert.ok(wrapped.includes('<!-- DWA:IMPORT_BEGIN docId="1abc123" revisionId="rev456" importHash="sha256:abcdef" -->'));
      assert.ok(wrapped.includes(content));
      assert.ok(wrapped.includes('<!-- DWA:IMPORT_END -->'));
    });

    it('should preserve content exactly between markers', () => {
      const content = '# Test\n\n- Item 1\n- Item 2\n\n**Bold text**';
      const wrapped = wrapWithMarkers(content, 'doc1', 'rev1', 'hash1');

      const lines = wrapped.split('\n');
      const beginIdx = lines.findIndex(l => l.includes('IMPORT_BEGIN'));
      const endIdx = lines.findIndex(l => l.includes('IMPORT_END'));

      const extracted = lines.slice(beginIdx + 1, endIdx).join('\n');
      assert.strictEqual(extracted, content);
    });
  });

  describe('generateImportDiff', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-import-diff-'));
    });

    it('should create diff file at expected path', async () => {
      const docId = 'test-doc-123';
      const existingContent = '# Old Title\n\nOld content.';
      const newContent = '# New Title\n\nNew content.';

      const diffPath = await generateImportDiff(docId, existingContent, newContent, tempDir);

      assert.ok(diffPath.includes(path.join('.dwa', 'import-diffs', docId)));
      assert.ok(await fs.pathExists(diffPath));
    });

    it('should include hash values in diff report', async () => {
      const docId = 'test-doc-123';
      const existingContent = '# Old Title\n\nOld content.';
      const newContent = '# New Title\n\nNew content.';

      const diffPath = await generateImportDiff(docId, existingContent, newContent, tempDir);
      const diffContent = await fs.readFile(diffPath, 'utf8');

      assert.ok(diffContent.includes('**Old hash:**'));
      assert.ok(diffContent.includes('**New hash:**'));
      assert.ok(diffContent.includes('sha256:'));
    });

    it('should show line-by-line diff', async () => {
      const docId = 'test-doc-123';
      const existingContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nModified Line 2\nLine 3';

      const diffPath = await generateImportDiff(docId, existingContent, newContent, tempDir);
      const diffContent = await fs.readFile(diffPath, 'utf8');

      assert.ok(diffContent.includes('```diff'));
      assert.ok(diffContent.includes('- Line 2'));
      assert.ok(diffContent.includes('+ Modified Line 2'));
    });
  });

  describe('findFeatureRoot', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-feature-root-'));
    });

    it('should find .dwa directory in current directory', () => {
      const dwaDir = path.join(tempDir, '.dwa');
      fs.ensureDirSync(dwaDir);

      const root = findFeatureRoot(tempDir);
      assert.strictEqual(root, tempDir);
    });

    it('should find .dwa directory in parent directory', () => {
      const dwaDir = path.join(tempDir, '.dwa');
      const subDir = path.join(tempDir, 'sub', 'nested');
      fs.ensureDirSync(dwaDir);
      fs.ensureDirSync(subDir);

      const root = findFeatureRoot(subDir);
      assert.strictEqual(root, tempDir);
    });

    it('should return null if no .dwa directory found', () => {
      const root = findFeatureRoot(tempDir);
      assert.strictEqual(root, null);
    });
  });

  describe('importGoogleDoc', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-import-test-'));
    });

    it('should handle provider unavailable via checkAvailability', async () => {
      const mockBridgeClient = {
        checkAvailability: async () => ({
          available: false,
          error: 'Not configured',
          setupInstructions: 'Run setup wizard to configure Google Docs access.'
        })
      };

      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        out: 'test.md',
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Run setup wizard'));
      assert.ok(result.diagnostics);
      assert.strictEqual(result.diagnostics[0].code, 'DWA-GDOC-404');
    });

    it('should handle invalid docId format', async () => {
      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true })
      };

      const result = await importGoogleDoc({
        docIdOrUrl: 'invalid',
        projectRoot: tempDir,
        out: 'test.md',
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid Google Docs URL or ID'));
    });

    it('should error when no .dwa/ and no --out provided', async () => {
      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => ({ title: 'Test', body: { content: [] } }),
        getDocumentInfo: async () => ({ id: '1abc', title: 'Test', revisionId: 'rev1' })
      };

      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        // No --out provided
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Cannot determine output path'));
      assert.ok(result.message.includes('No .dwa/ directory found'));
      assert.ok(result.message.includes('Use --out'));
    });

    it('should use --out when provided', async () => {
      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => ({ title: 'Test', body: { content: [] } }),
        getDocumentInfo: async () => ({ id: '1abc', title: 'Test', revisionId: 'rev1' })
      };

      const outputPath = path.join(tempDir, 'custom-spec.md');

      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        out: 'custom-spec.md',
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.outputPath.endsWith('custom-spec.md'));
      assert.ok(await fs.pathExists(outputPath));
    });

    it('should find feature root and use default filename', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => ({ title: 'Test', body: { content: [] } }),
        getDocumentInfo: async () => ({ id: '1abc', title: 'Test', revisionId: 'rev1' })
      };

      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        // No --out, but .dwa/ exists
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.outputPath.endsWith('feature-spec.md'));
      assert.ok(await fs.pathExists(path.join(tempDir, 'feature-spec.md')));
    });

    it('should skip unchanged import', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockDocument = { title: 'Test', body: { content: [] } };
      const mockInfo = { id: '1abc', title: 'Test', revisionId: 'rev1' };

      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => mockDocument,
        getDocumentInfo: async () => mockInfo
      };

      // First import
      const result1 = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result1.success, true);

      // Second import (unchanged)
      const result2 = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result2.success, true);
      assert.ok(result2.message.includes('Already at latest revision'));
    });

    it('should detect hash mismatch and create diff artifact', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockDocument = { title: 'Test', body: { content: [] } };
      const mockInfo = { id: '1abc', title: 'Test', revisionId: 'rev1' };

      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => mockDocument,
        getDocumentInfo: async () => mockInfo
      };

      // First import
      await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        bridgeClient: mockBridgeClient
      });

      // Modify file locally (simulate user edit)
      const specPath = path.join(tempDir, 'feature-spec.md');
      let content = await fs.readFile(specPath, 'utf8');
      content = content.replace('<!-- DWA:IMPORT_END -->', 'LOCAL EDIT\n<!-- DWA:IMPORT_END -->');
      await fs.writeFile(specPath, content, 'utf8');

      // Try to reimport (should detect hash mismatch)
      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Local edits detected'));
      assert.ok(result.message.includes('Hash mismatch'));
      assert.ok(result.diffPath);
      assert.ok(await fs.pathExists(result.diffPath));
    });

    it('should overwrite with --force flag', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockDocument = { title: 'Test', body: { content: [] } };
      const mockInfo = { id: '1abc', title: 'Test', revisionId: 'rev1' };

      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => mockDocument,
        getDocumentInfo: async () => mockInfo
      };

      // First import
      await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        bridgeClient: mockBridgeClient
      });

      // Modify file locally
      const specPath = path.join(tempDir, 'feature-spec.md');
      let content = await fs.readFile(specPath, 'utf8');
      content = content.replace('<!-- DWA:IMPORT_END -->', 'LOCAL EDIT\n<!-- DWA:IMPORT_END -->');
      await fs.writeFile(specPath, content, 'utf8');

      // Reimport with --force
      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        force: true,
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('updated'));

      // Verify file was overwritten (local edit removed)
      const newContent = await fs.readFile(specPath, 'utf8');
      assert.ok(!newContent.includes('LOCAL EDIT'));
    });

    it('should write import report', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => ({ title: 'Test', body: { content: [] } }),
        getDocumentInfo: async () => ({ id: '1abc', title: 'Test', revisionId: 'rev1' })
      };

      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.report);
      assert.ok(result.report.importTimestamp);
      assert.strictEqual(result.report.source.docId, '1abc123XYZ_-456');

      // Verify report file exists
      const reportsDir = path.join(tempDir, '.dwa', 'import-reports');
      const files = await fs.readdir(reportsDir);
      assert.strictEqual(files.length, 1);
      assert.ok(files[0].startsWith('1abc123XYZ_-456-'));
    });

    it('should handle dry-run mode', async () => {
      const dwaDir = path.join(tempDir, '.dwa');
      await fs.ensureDir(dwaDir);

      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => ({ title: 'Test', body: { content: [] } }),
        getDocumentInfo: async () => ({ id: '1abc', title: 'Test', revisionId: 'rev1' })
      };

      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        dryRun: true,
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('[DRY RUN]'));
      assert.ok(result.message.includes('Would create'));

      // Verify no files written
      const specPath = path.join(tempDir, 'feature-spec.md');
      assert.ok(!await fs.pathExists(specPath));
    });

    it('should handle document not found', async () => {
      const mockBridgeClient = {
        initialize: async () => {},
        checkAvailability: async () => ({ available: true }),
        readDocument: async () => {
          throw new Error('Document not found');
        },
        getDocumentInfo: async () => {
          throw new Error('Document not found');
        }
      };

      const result = await importGoogleDoc({
        docIdOrUrl: '1abc123XYZ_-456',
        projectRoot: tempDir,
        out: 'test.md',
        bridgeClient: mockBridgeClient
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Cannot access document'));
      assert.ok(result.diagnostics);
      assert.strictEqual(result.diagnostics[0].code, 'DWA-GDOC-402');
    });
  });
});
