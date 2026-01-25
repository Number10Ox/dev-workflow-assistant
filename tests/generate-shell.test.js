const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// These modules don't exist yet - tests should fail
const { generatePacketShell } = require('../src/packets/generate-shell');
const { fetchTDDConstraints } = require('../src/packets/fetch-constraints');
const { fetchDriftData } = require('../src/packets/fetch-drift');
const { computeProvenance } = require('../src/packets/compute-provenance');
const { countWords, checkSizeAndSplit } = require('../src/packets/size-checker');

/**
 * Test fixture - TDD file with guardrails section
 */
const TEST_TDD_PATH = path.join(__dirname, 'fixtures', 'test-tdd.md');

/**
 * Test fixture - valid feature.json
 */
const FEATURE_JSON = {
  schemaVersion: '1.0.0',
  feature_id: 'FEAT-2026-TEST',
  title: 'Test Feature',
  spec_path: 'feature-spec.md',
  tdd_path: 'docs/tdds/test-feature.md',
  created_at: '2026-01-25T00:00:00Z'
};

/**
 * Test fixture - valid deliverable registry entry
 */
const DELIVERABLE_REGISTRY = {
  schemaVersion: '1.0.0',
  id: 'DEL-001',
  user_story: 'As a user, I want to login so that I can access my account',
  description: 'Implement user authentication with email and password',
  acceptance_criteria: 'C1: Valid credentials redirect to dashboard. F1: Invalid credentials show error. E1: Rate limit after 5 failures.',
  qa_notes: 'Test with valid and invalid credentials. Verify rate limiting.',
  dependencies: '',
  created_at: '2026-01-25T00:00:00Z'
};

/**
 * Test fixture - deliverable with drift (Phase 5 event-sourced structure)
 */
const DELIVERABLE_WITH_DRIFT = {
  schemaVersion: '1.0.0',
  id: 'DEL-002',
  user_story: 'As a user, I want to logout',
  description: 'Implement logout functionality',
  acceptance_criteria: 'F1: Logout clears session',
  qa_notes: 'Verify session cleared',
  dependencies: 'DEL-001',
  drift_events: [
    {
      id: 'drift-001',
      at: '2026-01-25T10:00:00Z',
      source: 'complete_command',
      kind: 'spec_update_needed',
      summary: 'User story wording changed',
      decision: 'pending',
      applies_to_next_work: true
    },
    {
      id: 'drift-002',
      at: '2026-01-25T10:05:00Z',
      source: 'complete_command',
      kind: 'impl_deviation',
      summary: 'Security constraint added',
      decision: 'accept',
      applies_to_next_work: false
    }
  ],
  created_at: '2026-01-25T00:00:00Z'
};

let tempDir;

describe('generatePacketShell', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-packet-test-'));

    // Setup .dwa directory structure
    const dwaDir = path.join(tempDir, '.dwa');
    await fs.ensureDir(path.join(dwaDir, 'deliverables'));
    await fs.ensureDir(path.join(dwaDir, 'packets'));

    // Create feature.json
    await fs.writeJSON(path.join(dwaDir, 'feature.json'), FEATURE_JSON, { spaces: 2 });

    // Create TDD file
    const tddDir = path.join(tempDir, 'docs', 'tdds');
    await fs.ensureDir(tddDir);
    await fs.copy(TEST_TDD_PATH, path.join(tddDir, 'test-feature.md'));

    // Create deliverable registry file
    await fs.writeJSON(
      path.join(dwaDir, 'deliverables', 'DEL-001.json'),
      DELIVERABLE_REGISTRY,
      { spaces: 2 }
    );
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  it('produces packet markdown given deliverable ID and project root', async () => {
    const result = await generatePacketShell('DEL-001', tempDir);

    assert.ok(result.packetPath);
    assert.ok(await fs.pathExists(result.packetPath));

    const content = await fs.readFile(result.packetPath, 'utf8');
    assert.ok(content.includes('DEL-001'));
    assert.ok(content.includes('Execution Packet'));
  });

  it('packet includes all 10 sections', async () => {
    const result = await generatePacketShell('DEL-001', tempDir);
    const content = await fs.readFile(result.packetPath, 'utf8');

    // Verify all 10 sections exist
    assert.ok(content.includes('## 0) Control Block'), 'Missing Control Block section');
    assert.ok(content.includes('## 1) MUST / MUST NOT Guardrails'), 'Missing Guardrails section');
    assert.ok(content.includes('## 2) Goal'), 'Missing Goal section');
    assert.ok(content.includes('## 3) User Story'), 'Missing User Story section');
    assert.ok(content.includes('## 4) Acceptance Criteria'), 'Missing Acceptance Criteria section');
    assert.ok(content.includes('## 5) QA Verification'), 'Missing QA Verification section');
    assert.ok(content.includes('## 6) Dependencies'), 'Missing Dependencies section');
    assert.ok(content.includes('## 7) Provenance'), 'Missing Provenance section');
    assert.ok(content.includes('## 8) Drift Since Last Packet'), 'Missing Drift section');
    assert.ok(content.includes('## 9) Stop Points'), 'Missing Stop Points section');
  });

  it('categorizes ACs by prefix (C#=Critical, F#=Functional, N#=Nice-to-have, E#=Edge)', async () => {
    const result = await generatePacketShell('DEL-001', tempDir);
    const content = await fs.readFile(result.packetPath, 'utf8');

    // DEL-001 has C1, F1, E1 prefixes in acceptance_criteria
    assert.ok(content.includes('### Critical (C#)'), 'Missing Critical section');
    assert.ok(content.includes('### Functional (F#)'), 'Missing Functional section');
    assert.ok(content.includes('### Edge Cases (E#)'), 'Missing Edge Cases section');
  });

  it('returns error when registry file missing', async () => {
    const result = await generatePacketShell('DEL-999', tempDir);

    assert.ok(result.error);
    assert.strictEqual(result.error.code, 'DWA-E041');
  });

  it('writes packet to .dwa/packets/{id}.md', async () => {
    const result = await generatePacketShell('DEL-001', tempDir);

    const expectedPath = path.join(tempDir, '.dwa', 'packets', 'DEL-001.md');
    assert.strictEqual(result.packetPath, expectedPath);
    assert.ok(await fs.pathExists(expectedPath));
  });

  it('returns word count in result', async () => {
    const result = await generatePacketShell('DEL-001', tempDir);

    assert.ok(typeof result.wordCount === 'number');
    assert.ok(result.wordCount > 0);
  });
});

describe('fetchTDDConstraints', () => {
  it('extracts guardrails from TDD file "## 4) Guardrails" section', async () => {
    const result = await fetchTDDConstraints(TEST_TDD_PATH);

    assert.ok(result.must.length > 0, 'Should have MUST constraints');
    assert.ok(result.must_not.length > 0, 'Should have MUST NOT constraints');
  });

  it('returns Performance constraints as MUST items', async () => {
    const result = await fetchTDDConstraints(TEST_TDD_PATH);

    const hasPerformance = result.must.some(c => c.includes('200ms') || c.includes('connection pooling'));
    assert.ok(hasPerformance, 'Should include Performance constraints');
  });

  it('returns Security constraints as MUST items', async () => {
    const result = await fetchTDDConstraints(TEST_TDD_PATH);

    const hasSecurity = result.must.some(c =>
      c.includes('authentication') || c.includes('validated') || c.includes('parameterized')
    );
    assert.ok(hasSecurity, 'Should include Security constraints');
  });

  it('returns "Do NOT" items as MUST NOT items', async () => {
    const result = await fetchTDDConstraints(TEST_TDD_PATH);

    const hasDoNot = result.must_not.some(c =>
      c.includes('plaintext passwords') || c.includes('synchronous') || c.includes('CORS')
    );
    assert.ok(hasDoNot, 'Should include Do NOT constraints');
  });

  it('returns empty arrays if TDD file missing', async () => {
    const result = await fetchTDDConstraints('/nonexistent/path/tdd.md');

    assert.deepStrictEqual(result.must, []);
    assert.deepStrictEqual(result.must_not, []);
  });

  it('returns empty arrays if no guardrails section', async () => {
    // Create a temp TDD without guardrails section
    const tempTddDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-tdd-test-'));
    const tempTddPath = path.join(tempTddDir, 'no-guardrails.md');

    await fs.writeFile(tempTddPath, `---
feature_id: FEAT-TEST
title: "Test TDD"
---

# Technical Design

## 1) Objectives
- Some objective
`);

    try {
      const result = await fetchTDDConstraints(tempTddPath);
      assert.deepStrictEqual(result.must, []);
      assert.deepStrictEqual(result.must_not, []);
    } finally {
      await fs.remove(tempTddDir);
    }
  });
});

describe('fetchDriftData', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-drift-test-'));

    // Setup feature.json
    const dwaDir = path.join(tempDir, '.dwa');
    await fs.ensureDir(dwaDir);
    await fs.writeJSON(path.join(dwaDir, 'feature.json'), FEATURE_JSON, { spaces: 2 });

    // Create spec file
    await fs.writeFile(path.join(tempDir, 'feature-spec.md'), '# Spec');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  it('pulls drift items where decision is pending', async () => {
    const result = await fetchDriftData(DELIVERABLE_WITH_DRIFT, FEATURE_JSON, tempDir);

    // Should include the pending drift item
    const hasPending = result.items.some(item => item.decision === 'pending');
    assert.ok(hasPending, 'Should include pending drift items');
  });

  it('pulls drift items where applies_to_next_work is true', async () => {
    const result = await fetchDriftData(DELIVERABLE_WITH_DRIFT, FEATURE_JSON, tempDir);

    // Should include item with applies_to_next_work: true
    const hasApplies = result.items.some(item => item.applies_to_next_work === true);
    assert.ok(hasApplies, 'Should include items that apply to next work');
  });

  it('computes source freshness (spec changed since last packet)', async () => {
    const result = await fetchDriftData(DELIVERABLE_REGISTRY, FEATURE_JSON, tempDir);

    assert.ok('source_freshness' in result);
    assert.ok('spec_changed' in result.source_freshness);
    assert.ok('tdd_changed' in result.source_freshness);
  });

  it('returns empty drift if no drift items in registry', async () => {
    const result = await fetchDriftData(DELIVERABLE_REGISTRY, FEATURE_JSON, tempDir);

    assert.deepStrictEqual(result.items, []);
  });
});

describe('computeProvenance', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-prov-test-'));

    // Create spec and TDD files
    await fs.writeFile(path.join(tempDir, 'feature-spec.md'), '# Spec');
    await fs.ensureDir(path.join(tempDir, 'docs', 'tdds'));
    await fs.writeFile(path.join(tempDir, 'docs', 'tdds', 'test.md'), '# TDD');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  it('extracts git SHA for spec file', async () => {
    const result = await computeProvenance(tempDir, 'feature-spec.md', 'docs/tdds/test.md');

    assert.ok('spec' in result);
    assert.ok('path' in result.spec);
    assert.ok('sha' in result.spec);
    assert.strictEqual(result.spec.path, 'feature-spec.md');
  });

  it('extracts git SHA for TDD file', async () => {
    const result = await computeProvenance(tempDir, 'feature-spec.md', 'docs/tdds/test.md');

    assert.ok('tdd' in result);
    assert.ok('path' in result.tdd);
    assert.ok('sha' in result.tdd);
    assert.strictEqual(result.tdd.path, 'docs/tdds/test.md');
  });

  it('falls back to null if file not in git', async () => {
    // tempDir is not a git repo, so SHA should be null
    const result = await computeProvenance(tempDir, 'feature-spec.md', 'docs/tdds/test.md');

    // Should gracefully handle non-git files
    assert.ok(result.spec.sha === null || typeof result.spec.sha === 'string');
  });

  it('records packet generator version from package.json', async () => {
    const result = await computeProvenance(tempDir, 'feature-spec.md', 'docs/tdds/test.md');

    assert.ok('generator_version' in result);
    // Should match version in package.json (1.0.0)
    assert.strictEqual(result.generator_version, '1.0.0');
  });

  it('includes generated_at timestamp', async () => {
    const before = new Date().toISOString();
    const result = await computeProvenance(tempDir, 'feature-spec.md', 'docs/tdds/test.md');
    const after = new Date().toISOString();

    assert.ok('generated_at' in result);
    assert.ok(result.generated_at >= before.slice(0, 19));
    assert.ok(result.generated_at <= after);
  });
});

describe('countWords', () => {
  it('counts words in plain text', () => {
    const content = 'This is a test with seven words.';
    const count = countWords(content);

    assert.strictEqual(count, 7);
  });

  it('removes code blocks before counting', () => {
    const content = `
# Header

Some text here.

\`\`\`javascript
const x = 1;
const y = 2;
const z = x + y;
\`\`\`

More text after.
`;
    const count = countWords(content);

    // Should only count: Header, Some, text, here, More, text, after = 7
    assert.ok(count < 15, 'Should not count code block words');
  });

  it('handles empty content', () => {
    const count = countWords('');
    assert.strictEqual(count, 0);
  });
});

describe('checkSizeAndSplit', () => {
  it('returns content unchanged if under soft limit (1500 words)', async () => {
    const content = 'word '.repeat(500); // 500 words
    const result = await checkSizeAndSplit(content, 'DEL-001');

    assert.strictEqual(result.finalContent, content);
    assert.strictEqual(result.appendixContent, null);
    assert.ok(!result.warning);
  });

  it('warns but continues if between soft (1500) and hard (2000) limit', async () => {
    const content = 'word '.repeat(1700); // 1700 words
    const result = await checkSizeAndSplit(content, 'DEL-001');

    assert.ok(result.warning, 'Should have warning');
    assert.ok(result.warning.includes('1700') || result.warning.includes('soft limit'));
    assert.strictEqual(result.appendixContent, null);
  });

  it('splits content and creates appendix if over hard limit', async () => {
    const content = 'word '.repeat(2500); // 2500 words
    const result = await checkSizeAndSplit(content, 'DEL-001');

    assert.ok(result.appendixContent, 'Should have appendix content');
    assert.ok(result.wordCount <= 2000, 'Final content should be under hard limit');
  });

  it('returns word count in result', async () => {
    const content = 'word '.repeat(100);
    const result = await checkSizeAndSplit(content, 'DEL-001');

    assert.strictEqual(result.wordCount, 100);
  });
});
