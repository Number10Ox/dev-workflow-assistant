const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  hashImportedContent,
  verifyContentHash,
  extractImportRegion,
  parseMarkerAttributes
} = require('../../src/google-docs/hash-content');

describe('hashImportedContent', () => {
  it('produces sha256 hash in expected format', () => {
    const content = 'Hello, world!';
    const hash = hashImportedContent(content);

    assert.ok(hash.startsWith('sha256:'));
    assert.strictEqual(hash.length, 71); // 'sha256:' (7 chars) + 64 hex chars
  });

  it('produces consistent hashes for same content', () => {
    const content = 'Test content for hashing';
    const hash1 = hashImportedContent(content);
    const hash2 = hashImportedContent(content);

    assert.strictEqual(hash1, hash2);
  });

  it('produces different hashes for different content', () => {
    const content1 = 'Content A';
    const content2 = 'Content B';

    const hash1 = hashImportedContent(content1);
    const hash2 = hashImportedContent(content2);

    assert.notStrictEqual(hash1, hash2);
  });

  it('is sensitive to whitespace', () => {
    const content1 = 'Content';
    const content2 = 'Content '; // Trailing space

    const hash1 = hashImportedContent(content1);
    const hash2 = hashImportedContent(content2);

    assert.notStrictEqual(hash1, hash2);
  });

  it('handles empty string', () => {
    const hash = hashImportedContent('');

    assert.ok(hash.startsWith('sha256:'));
    assert.strictEqual(hash.length, 71);
  });
});

describe('verifyContentHash', () => {
  it('returns unchanged: true when hashes match', () => {
    const content = 'Test content';
    const storedHash = hashImportedContent(content);

    const result = verifyContentHash(content, storedHash);

    assert.strictEqual(result.unchanged, true);
    assert.strictEqual(result.currentHash, storedHash);
    assert.strictEqual(result.storedHash, storedHash);
  });

  it('returns unchanged: false when content changed', () => {
    const originalContent = 'Original content';
    const modifiedContent = 'Modified content';
    const storedHash = hashImportedContent(originalContent);

    const result = verifyContentHash(modifiedContent, storedHash);

    assert.strictEqual(result.unchanged, false);
    assert.notStrictEqual(result.currentHash, result.storedHash);
  });

  it('includes both current and stored hashes in result', () => {
    const content = 'Content';
    const storedHash = 'sha256:abc123';

    const result = verifyContentHash(content, storedHash);

    assert.ok(result.currentHash);
    assert.strictEqual(result.storedHash, storedHash);
  });
});

describe('parseMarkerAttributes', () => {
  it('parses single attribute with double quotes', () => {
    const marker = 'docId="abc123"';
    const attrs = parseMarkerAttributes(marker);

    assert.strictEqual(attrs.docId, 'abc123');
  });

  it('parses single attribute with single quotes', () => {
    const marker = "docId='abc123'";
    const attrs = parseMarkerAttributes(marker);

    assert.strictEqual(attrs.docId, 'abc123');
  });

  it('parses multiple attributes', () => {
    const marker = 'docId="abc123" revisionId="rev456" importHash="sha256:xyz"';
    const attrs = parseMarkerAttributes(marker);

    assert.strictEqual(attrs.docId, 'abc123');
    assert.strictEqual(attrs.revisionId, 'rev456');
    assert.strictEqual(attrs.importHash, 'sha256:xyz');
  });

  it('handles mixed quote styles', () => {
    const marker = `docId="abc123" revisionId='rev456'`;
    const attrs = parseMarkerAttributes(marker);

    assert.strictEqual(attrs.docId, 'abc123');
    assert.strictEqual(attrs.revisionId, 'rev456');
  });

  it('returns empty object for no attributes', () => {
    const marker = '';
    const attrs = parseMarkerAttributes(marker);

    assert.deepStrictEqual(attrs, {});
  });
});

describe('extractImportRegion', () => {
  it('extracts content between IMPORT_BEGIN and IMPORT_END markers', () => {
    const markdown = `# Document

<!-- DWA:IMPORT_BEGIN docId="abc123" revisionId="rev456" importHash="sha256:xyz" -->
Imported content line 1
Imported content line 2
<!-- DWA:IMPORT_END -->

Additional content`;

    const result = extractImportRegion(markdown);

    assert.ok(result);
    assert.strictEqual(result.content, 'Imported content line 1\nImported content line 2');
    assert.strictEqual(result.metadata.docId, 'abc123');
    assert.strictEqual(result.metadata.revisionId, 'rev456');
    assert.strictEqual(result.metadata.importHash, 'sha256:xyz');
  });

  it('returns null when no markers found', () => {
    const markdown = `# Document

Just regular content`;

    const result = extractImportRegion(markdown);

    assert.strictEqual(result, null);
  });

  it('returns null when IMPORT_BEGIN found but no IMPORT_END', () => {
    const markdown = `# Document

<!-- DWA:IMPORT_BEGIN docId="abc123" -->
Content without end marker`;

    const result = extractImportRegion(markdown);

    assert.strictEqual(result, null);
  });

  it('trims leading and trailing whitespace from extracted content', () => {
    const markdown = `<!-- DWA:IMPORT_BEGIN docId="abc123" -->

  Content with whitespace

<!-- DWA:IMPORT_END -->`;

    const result = extractImportRegion(markdown);

    assert.ok(result);
    assert.strictEqual(result.content, 'Content with whitespace');
  });

  it('uses first region when multiple IMPORT_BEGIN markers exist', () => {
    const markdown = `<!-- DWA:IMPORT_BEGIN docId="first" -->
First region
<!-- DWA:IMPORT_END -->

<!-- DWA:IMPORT_BEGIN docId="second" -->
Second region
<!-- DWA:IMPORT_END -->`;

    const result = extractImportRegion(markdown);

    assert.ok(result);
    assert.strictEqual(result.content, 'First region');
    assert.strictEqual(result.metadata.docId, 'first');
  });

  it('handles markers with extra whitespace', () => {
    const markdown = `<!--   DWA:IMPORT_BEGIN   docId="abc123"   -->
Content
<!--   DWA:IMPORT_END   -->`;

    const result = extractImportRegion(markdown);

    assert.ok(result);
    assert.strictEqual(result.content, 'Content');
  });

  it('preserves internal line breaks and formatting', () => {
    const markdown = `<!-- DWA:IMPORT_BEGIN docId="abc" -->
Line 1

Line 3 (blank above)
  Indented line
<!-- DWA:IMPORT_END -->`;

    const result = extractImportRegion(markdown);

    assert.ok(result);
    assert.ok(result.content.includes('Line 1\n\nLine 3'));
    assert.ok(result.content.includes('  Indented line'));
  });
});
