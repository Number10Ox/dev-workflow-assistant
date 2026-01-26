const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ImportDiagnostic, DIAGNOSTICS, createDiagnostic } = require('../../src/google-docs/diagnostics');

describe('ImportDiagnostic', () => {
  describe('constructor', () => {
    it('creates diagnostic with all fields', () => {
      const diag = new ImportDiagnostic('DWA-GDOC-201', 'warning', 'Image not found', 'elem-123');

      assert.strictEqual(diag.code, 'DWA-GDOC-201');
      assert.strictEqual(diag.level, 'warning');
      assert.strictEqual(diag.message, 'Image not found');
      assert.strictEqual(diag.elementId, 'elem-123');
    });

    it('creates diagnostic without elementId', () => {
      const diag = new ImportDiagnostic('DWA-GDOC-100', 'info', 'TOC dropped');

      assert.strictEqual(diag.code, 'DWA-GDOC-100');
      assert.strictEqual(diag.level, 'info');
      assert.strictEqual(diag.message, 'TOC dropped');
      assert.strictEqual(diag.elementId, null);
    });
  });

  describe('toString', () => {
    it('formats diagnostic without elementId', () => {
      const diag = new ImportDiagnostic('DWA-GDOC-100', 'info', 'TOC dropped');
      const str = diag.toString();

      assert.strictEqual(str, 'DWA-GDOC-100 [INFO] TOC dropped');
    });

    it('formats diagnostic with elementId', () => {
      const diag = new ImportDiagnostic('DWA-GDOC-201', 'warning', 'Image placeholder', 'elem-456');
      const str = diag.toString();

      assert.strictEqual(str, 'DWA-GDOC-201 [WARNING] Element elem-456: Image placeholder');
    });

    it('uppercases severity level', () => {
      const diag = new ImportDiagnostic('DWA-GDOC-401', 'fatal', 'Auth failure');
      const str = diag.toString();

      assert.ok(str.includes('[FATAL]'));
    });
  });
});

describe('DIAGNOSTICS registry', () => {
  it('contains info codes (100-series)', () => {
    assert.strictEqual(DIAGNOSTICS.TOC_DROPPED.code, 'DWA-GDOC-100');
    assert.strictEqual(DIAGNOSTICS.TOC_DROPPED.level, 'info');

    assert.strictEqual(DIAGNOSTICS.PAGE_BREAK_CONVERTED.code, 'DWA-GDOC-101');
    assert.strictEqual(DIAGNOSTICS.PAGE_BREAK_CONVERTED.level, 'info');

    assert.strictEqual(DIAGNOSTICS.HEADING_NORMALIZED.code, 'DWA-GDOC-102');
    assert.strictEqual(DIAGNOSTICS.HEADING_NORMALIZED.level, 'info');
  });

  it('contains warning codes (200-series)', () => {
    assert.strictEqual(DIAGNOSTICS.IMAGE_PLACEHOLDER.code, 'DWA-GDOC-201');
    assert.strictEqual(DIAGNOSTICS.IMAGE_PLACEHOLDER.level, 'warning');

    assert.strictEqual(DIAGNOSTICS.TABLE_TO_HTML.code, 'DWA-GDOC-202');
    assert.strictEqual(DIAGNOSTICS.TABLE_TO_HTML.level, 'warning');

    assert.strictEqual(DIAGNOSTICS.COMMENT_DROPPED.code, 'DWA-GDOC-203');
    assert.strictEqual(DIAGNOSTICS.COMMENT_DROPPED.level, 'warning');

    assert.strictEqual(DIAGNOSTICS.EQUATION_PLACEHOLDER.code, 'DWA-GDOC-204');
    assert.strictEqual(DIAGNOSTICS.EQUATION_PLACEHOLDER.level, 'warning');

    assert.strictEqual(DIAGNOSTICS.FOOTNOTE_SIMPLIFIED.code, 'DWA-GDOC-205');
    assert.strictEqual(DIAGNOSTICS.FOOTNOTE_SIMPLIFIED.level, 'warning');

    assert.strictEqual(DIAGNOSTICS.LINK_BROKEN.code, 'DWA-GDOC-206');
    assert.strictEqual(DIAGNOSTICS.LINK_BROKEN.level, 'warning');
  });

  it('contains error codes (300-series)', () => {
    assert.strictEqual(DIAGNOSTICS.INVALID_TABLE_STRUCTURE.code, 'DWA-GDOC-301');
    assert.strictEqual(DIAGNOSTICS.INVALID_TABLE_STRUCTURE.level, 'error');

    assert.strictEqual(DIAGNOSTICS.ELEMENT_PARSE_FAILED.code, 'DWA-GDOC-302');
    assert.strictEqual(DIAGNOSTICS.ELEMENT_PARSE_FAILED.level, 'error');
  });

  it('contains fatal codes (400-series)', () => {
    assert.strictEqual(DIAGNOSTICS.AUTH_FAILURE.code, 'DWA-GDOC-401');
    assert.strictEqual(DIAGNOSTICS.AUTH_FAILURE.level, 'fatal');

    assert.strictEqual(DIAGNOSTICS.DOC_NOT_FOUND.code, 'DWA-GDOC-402');
    assert.strictEqual(DIAGNOSTICS.DOC_NOT_FOUND.level, 'fatal');

    assert.strictEqual(DIAGNOSTICS.CORRUPT_DOCUMENT.code, 'DWA-GDOC-403');
    assert.strictEqual(DIAGNOSTICS.CORRUPT_DOCUMENT.level, 'fatal');

    assert.strictEqual(DIAGNOSTICS.MCP_UNAVAILABLE.code, 'DWA-GDOC-404');
    assert.strictEqual(DIAGNOSTICS.MCP_UNAVAILABLE.level, 'fatal');
  });
});

describe('createDiagnostic', () => {
  it('creates diagnostic from type without variables', () => {
    const diag = createDiagnostic('TOC_DROPPED');

    assert.strictEqual(diag.code, 'DWA-GDOC-100');
    assert.strictEqual(diag.level, 'info');
    assert.strictEqual(diag.message, 'Dropped auto-generated table of contents');
  });

  it('creates diagnostic with template variables', () => {
    const diag = createDiagnostic('IMAGE_PLACEHOLDER', { imageId: 'img_42' });

    assert.strictEqual(diag.code, 'DWA-GDOC-201');
    assert.strictEqual(diag.level, 'warning');
    assert.strictEqual(diag.message, 'Image img_42 replaced with placeholder (download failed or unavailable)');
  });

  it('creates diagnostic with multiple template variables', () => {
    const diag = createDiagnostic('HEADING_NORMALIZED', {
      originalLevel: '4',
      normalizedLevel: '3'
    });

    assert.strictEqual(diag.code, 'DWA-GDOC-102');
    assert.strictEqual(diag.message, 'Normalized heading level from 4 to 3');
  });

  it('creates diagnostic with elementId', () => {
    const diag = createDiagnostic('ELEMENT_PARSE_FAILED', {
      elementId: 'elem-789',
      error: 'Unexpected structure'
    }, 'elem-789');

    assert.strictEqual(diag.elementId, 'elem-789');
    assert.ok(diag.message.includes('elem-789'));
  });

  it('throws for unknown diagnostic type', () => {
    assert.throws(
      () => createDiagnostic('UNKNOWN_TYPE'),
      /Unknown diagnostic type: UNKNOWN_TYPE/
    );
  });
});
