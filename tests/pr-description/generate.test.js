/**
 * Tests for PR description generator.
 */

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { generatePRDescription } = require('../../src/pr-description/generate');

describe('pr-description/generate', () => {
  let tempDir;
  let projectRoot;

  beforeEach(async () => {
    // Create temp directory for test isolation
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-pr-gen-test-'));
    projectRoot = tempDir;

    // Create .dwa/deliverables directory
    await fs.ensureDir(path.join(projectRoot, '.dwa', 'deliverables'));
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.remove(tempDir);
  });

  describe('generatePRDescription', () => {
    it('produces valid markdown with all fields', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-001.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-001',
        user_story: 'As a developer, I want to generate PR descriptions',
        description: 'Build PR description generator feature',
        acceptance_criteria: ['AC1: Generate from template', 'AC2: Support clipboard output'],
        qa_notes: 'Test with real deliverables',
        linear_url: 'https://linear.app/team/issue/DEL-001'
      });

      const result = await generatePRDescription({
        deliverableId: 'DEL-001',
        projectRoot,
        output: 'stdout'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('## Summary'));
      assert.ok(result.content.includes('**Deliverable:** DEL-001'));
      assert.ok(result.content.includes('**Linear:** [DEL-001](https://linear.app/team/issue/DEL-001)'));
      assert.ok(result.content.includes('As a developer, I want to generate PR descriptions'));
      assert.ok(result.content.includes('Build PR description generator feature'));
      assert.ok(result.content.includes('## Acceptance Criteria'));
      assert.ok(result.content.includes('AC1: Generate from template'));
      assert.ok(result.content.includes('AC2: Support clipboard output'));
      assert.ok(result.content.includes('**QA Notes:** Test with real deliverables'));
    });

    it('renders grouped acceptance criteria correctly', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-002.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-002',
        user_story: 'Test grouped AC',
        description: 'Test description',
        acceptance_criteria_grouped: {
          core: [
            { id: 'C1', text: 'Core requirement 1' },
            { id: 'C2', text: 'Core requirement 2' }
          ],
          functional: [
            { id: 'F1', text: 'Functional requirement 1' }
          ],
          edge: [],
          nonfunctional: []
        }
      });

      const result = await generatePRDescription({
        deliverableId: 'DEL-002',
        projectRoot,
        output: 'stdout'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('### Core (C#)'));
      assert.ok(result.content.includes('**C1:** Core requirement 1'));
      assert.ok(result.content.includes('**C2:** Core requirement 2'));
      assert.ok(result.content.includes('### Functional (F#)'));
      assert.ok(result.content.includes('**F1:** Functional requirement 1'));
    });

    it('includes drift section when open drift exists', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-003.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-003',
        user_story: 'Test drift summary',
        description: 'Test description',
        acceptance_criteria: ['AC1'],
        drift_events: [
          {
            id: 'evt-1',
            at: '2026-01-25T10:00:00Z',
            summary: 'Added retry logic',
            decision: 'pending'
          },
          {
            id: 'evt-2',
            at: '2026-01-25T11:00:00Z',
            summary: 'Changed error format',
            decision: 'accept'
          }
        ]
      });

      const result = await generatePRDescription({
        deliverableId: 'DEL-003',
        projectRoot,
        output: 'stdout'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('## Drift Summary'));
      assert.ok(result.content.includes('**Open items:** 1'));
      assert.ok(result.content.includes('**Accepted changes:** 1'));
      assert.ok(result.content.includes('**pending:** Added retry logic'));
      assert.ok(result.content.includes('**accept:** Changed error format'));
      assert.ok(result.content.includes('/dwa:propose-drift-patches DEL-003'));
    });

    it('omits drift section when no open drift', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-004.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-004',
        user_story: 'Test no drift',
        description: 'Test description',
        acceptance_criteria: ['AC1']
      });

      const result = await generatePRDescription({
        deliverableId: 'DEL-004',
        projectRoot,
        output: 'stdout'
      });

      assert.strictEqual(result.success, true);
      assert.ok(!result.content.includes('## Drift Summary'));
    });

    it('file output creates file at expected path', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-005.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-005',
        user_story: 'Test file output',
        description: 'Test description',
        acceptance_criteria: ['AC1']
      });

      const result = await generatePRDescription({
        deliverableId: 'DEL-005',
        projectRoot,
        output: 'file'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.outputPath);
      assert.ok(result.outputPath.includes('.dwa/pr-descriptions'));
      assert.ok(result.outputPath.includes('DEL-005'));
      assert.ok(result.outputPath.endsWith('.md'));

      // Verify file exists
      const fileExists = await fs.pathExists(result.outputPath);
      assert.strictEqual(fileExists, true);

      // Verify file content
      const fileContent = await fs.readFile(result.outputPath, 'utf8');
      assert.ok(fileContent.includes('**Deliverable:** DEL-005'));
    });

    it('stdout output returns content without file', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-006.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-006',
        user_story: 'Test stdout output',
        description: 'Test description',
        acceptance_criteria: ['AC1']
      });

      const result = await generatePRDescription({
        deliverableId: 'DEL-006',
        projectRoot,
        output: 'stdout'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.content);
      assert.strictEqual(result.outputPath, undefined);
    });

    it('handles missing deliverable gracefully', async () => {
      const result = await generatePRDescription({
        deliverableId: 'DEL-999',
        projectRoot,
        output: 'stdout'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('DEL-999'));
      assert.ok(result.message.includes('not found'));
    });

    it('includes generated timestamp', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-007.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-007',
        user_story: 'Test timestamp',
        description: 'Test description',
        acceptance_criteria: ['AC1']
      });

      const beforeTime = new Date().toISOString();

      const result = await generatePRDescription({
        deliverableId: 'DEL-007',
        projectRoot,
        output: 'stdout'
      });

      const afterTime = new Date().toISOString();

      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('*Generated by DWA at'));

      // Extract timestamp from content
      const timestampMatch = result.content.match(/Generated by DWA at (.+)\*/);
      assert.ok(timestampMatch);
      const timestamp = timestampMatch[1];

      assert.ok(timestamp >= beforeTime);
      assert.ok(timestamp <= afterTime);
    });

    it('handles missing Linear URL', async () => {
      const registryPath = path.join(projectRoot, '.dwa', 'deliverables', 'DEL-008.json');
      await fs.writeJSON(registryPath, {
        schemaVersion: '1.0.0',
        deliverable_id: 'DEL-008',
        user_story: 'Test no Linear URL',
        description: 'Test description',
        acceptance_criteria: ['AC1']
      });

      const result = await generatePRDescription({
        deliverableId: 'DEL-008',
        projectRoot,
        output: 'stdout'
      });

      assert.strictEqual(result.success, true);
      assert.ok(!result.content.includes('**Linear:**'));
    });
  });
});
