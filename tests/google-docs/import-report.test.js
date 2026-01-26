const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const { generateImportReport, writeImportReport } = require('../../src/google-docs/import-report');
const { ImportDiagnostic } = require('../../src/google-docs/diagnostics');
const { SCHEMA_VERSION } = require('../../src/utils/schema');

let tempDir;

describe('generateImportReport', () => {
  it('generates report with all required fields', () => {
    const docId = 'test-doc-123';
    const diagnostics = [
      new ImportDiagnostic('DWA-GDOC-100', 'info', 'TOC dropped'),
      new ImportDiagnostic('DWA-GDOC-201', 'warning', 'Image placeholder', 'img-1')
    ];
    const stats = {
      revisionId: 'rev-456',
      title: 'Test Document',
      outputPath: '/path/to/output.md',
      importHash: 'sha256:abc123',
      elementCounts: { paragraphs: 10, headings: 3 },
      conversionMode: { tables: 'html-fallback' },
      duration: 1234
    };

    const report = generateImportReport(docId, diagnostics, stats);

    assert.ok(report.importTimestamp);
    assert.strictEqual(report.source.type, 'gdoc');
    assert.strictEqual(report.source.docId, 'test-doc-123');
    assert.strictEqual(report.source.revisionId, 'rev-456');
    assert.strictEqual(report.source.title, 'Test Document');
    assert.strictEqual(report.output.path, '/path/to/output.md');
    assert.strictEqual(report.output.importHash, 'sha256:abc123');
    assert.strictEqual(report.diagnostics.length, 2);
    assert.deepStrictEqual(report.statistics.elementCounts, { paragraphs: 10, headings: 3 });
    assert.deepStrictEqual(report.statistics.conversionMode, { tables: 'html-fallback' });
    assert.strictEqual(report.statistics.duration, 1234);
  });

  it('includes diagnostic details in report', () => {
    const diagnostics = [
      new ImportDiagnostic('DWA-GDOC-201', 'warning', 'Image placeholder', 'img-42')
    ];
    const stats = {
      revisionId: 'rev-1',
      title: 'Doc',
      outputPath: '/out.md',
      importHash: 'sha256:xyz',
      elementCounts: {},
      conversionMode: {},
      duration: 100
    };

    const report = generateImportReport('doc-1', diagnostics, stats);

    assert.strictEqual(report.diagnostics[0].code, 'DWA-GDOC-201');
    assert.strictEqual(report.diagnostics[0].level, 'warning');
    assert.strictEqual(report.diagnostics[0].message, 'Image placeholder');
    assert.strictEqual(report.diagnostics[0].elementId, 'img-42');
  });

  it('generates accurate summary counts', () => {
    const diagnostics = [
      new ImportDiagnostic('DWA-GDOC-100', 'info', 'Info 1'),
      new ImportDiagnostic('DWA-GDOC-101', 'info', 'Info 2'),
      new ImportDiagnostic('DWA-GDOC-201', 'warning', 'Warning 1'),
      new ImportDiagnostic('DWA-GDOC-202', 'warning', 'Warning 2'),
      new ImportDiagnostic('DWA-GDOC-203', 'warning', 'Warning 3'),
      new ImportDiagnostic('DWA-GDOC-301', 'error', 'Error 1'),
      new ImportDiagnostic('DWA-GDOC-401', 'fatal', 'Fatal 1')
    ];
    const stats = {
      revisionId: 'rev-1',
      title: 'Doc',
      outputPath: '/out.md',
      importHash: 'sha256:xyz',
      elementCounts: {},
      conversionMode: {},
      duration: 100
    };

    const report = generateImportReport('doc-1', diagnostics, stats);

    assert.strictEqual(report.summary.total, 7);
    assert.strictEqual(report.summary.info, 2);
    assert.strictEqual(report.summary.warnings, 3);
    assert.strictEqual(report.summary.errors, 1);
    assert.strictEqual(report.summary.fatal, 1);
  });

  it('handles empty diagnostics array', () => {
    const stats = {
      revisionId: 'rev-1',
      title: 'Doc',
      outputPath: '/out.md',
      importHash: 'sha256:xyz',
      elementCounts: {},
      conversionMode: {},
      duration: 100
    };

    const report = generateImportReport('doc-1', [], stats);

    assert.strictEqual(report.summary.total, 0);
    assert.strictEqual(report.summary.info, 0);
    assert.strictEqual(report.summary.warnings, 0);
    assert.strictEqual(report.summary.errors, 0);
    assert.strictEqual(report.summary.fatal, 0);
  });
});

describe('writeImportReport', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-import-report-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  it('creates .dwa/import-reports directory if not exists', async () => {
    const report = {
      importTimestamp: new Date().toISOString(),
      source: { type: 'gdoc', docId: 'doc-1', revisionId: 'rev-1', title: 'Doc' },
      output: { path: '/out.md', importHash: 'sha256:xyz' },
      diagnostics: [],
      statistics: { elementCounts: {}, conversionMode: {}, duration: 100 },
      summary: { total: 0, info: 0, warnings: 0, errors: 0, fatal: 0 }
    };

    const reportPath = await writeImportReport(tempDir, 'doc-1', report);

    const reportsDir = path.join(tempDir, '.dwa', 'import-reports');
    assert.ok(await fs.pathExists(reportsDir));
    assert.ok(await fs.pathExists(reportPath));
  });

  it('writes report to expected path with docId and timestamp', async () => {
    const report = {
      importTimestamp: new Date().toISOString(),
      source: { type: 'gdoc', docId: 'doc-123', revisionId: 'rev-1', title: 'Doc' },
      output: { path: '/out.md', importHash: 'sha256:xyz' },
      diagnostics: [],
      statistics: { elementCounts: {}, conversionMode: {}, duration: 100 },
      summary: { total: 0, info: 0, warnings: 0, errors: 0, fatal: 0 }
    };

    const reportPath = await writeImportReport(tempDir, 'doc-123', report);

    assert.ok(reportPath.includes('doc-123'));
    assert.ok(reportPath.endsWith('.json'));
    assert.ok(await fs.pathExists(reportPath));
  });

  it('writes JSON with schema version', async () => {
    const report = {
      importTimestamp: new Date().toISOString(),
      source: { type: 'gdoc', docId: 'doc-1', revisionId: 'rev-1', title: 'Doc' },
      output: { path: '/out.md', importHash: 'sha256:xyz' },
      diagnostics: [],
      statistics: { elementCounts: {}, conversionMode: {}, duration: 100 },
      summary: { total: 0, info: 0, warnings: 0, errors: 0, fatal: 0 }
    };

    const reportPath = await writeImportReport(tempDir, 'doc-1', report);

    const written = await fs.readJSON(reportPath);
    assert.strictEqual(written.schemaVersion, SCHEMA_VERSION);
  });

  it('preserves all report data when writing', async () => {
    const report = {
      importTimestamp: '2026-01-25T12:00:00Z',
      source: { type: 'gdoc', docId: 'doc-456', revisionId: 'rev-789', title: 'Test Doc' },
      output: { path: '/path/to/output.md', importHash: 'sha256:abc123' },
      diagnostics: [
        { code: 'DWA-GDOC-100', level: 'info', message: 'TOC dropped', elementId: null }
      ],
      statistics: {
        elementCounts: { paragraphs: 5 },
        conversionMode: { tables: 'html-fallback' },
        duration: 500
      },
      summary: { total: 1, info: 1, warnings: 0, errors: 0, fatal: 0 }
    };

    const reportPath = await writeImportReport(tempDir, 'doc-456', report);

    const written = await fs.readJSON(reportPath);
    assert.strictEqual(written.importTimestamp, '2026-01-25T12:00:00Z');
    assert.strictEqual(written.source.docId, 'doc-456');
    assert.strictEqual(written.source.revisionId, 'rev-789');
    assert.strictEqual(written.diagnostics.length, 1);
    assert.strictEqual(written.statistics.duration, 500);
    assert.strictEqual(written.summary.total, 1);
  });

  it('returns path to written report', async () => {
    const report = {
      importTimestamp: new Date().toISOString(),
      source: { type: 'gdoc', docId: 'doc-1', revisionId: 'rev-1', title: 'Doc' },
      output: { path: '/out.md', importHash: 'sha256:xyz' },
      diagnostics: [],
      statistics: { elementCounts: {}, conversionMode: {}, duration: 100 },
      summary: { total: 0, info: 0, warnings: 0, errors: 0, fatal: 0 }
    };

    const reportPath = await writeImportReport(tempDir, 'doc-1', report);

    assert.ok(reportPath.startsWith(tempDir));
    assert.ok(reportPath.includes('.dwa/import-reports/'));
  });
});
