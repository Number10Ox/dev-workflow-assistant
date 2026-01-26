const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  checkFeature,
  getSetupInstructions,
  getAllFeatureStatus,
  FEATURES
} = require('../../src/utils/feature-detection');

describe('feature-detection', () => {
  it('checkFeature returns available: false when not in VS Code', () => {
    const result = checkFeature('linear');
    assert.strictEqual(result.available, false);
    assert.ok(result.reason);
    assert.match(result.reason, /not running in vs code context/i);
  });

  it('checkFeature returns error for unknown feature', () => {
    const result = checkFeature('unknown-feature');
    assert.strictEqual(result.available, false);
    assert.match(result.reason, /unknown feature/i);
  });

  it('getSetupInstructions returns correct text for linear', () => {
    const instructions = getSetupInstructions('linear');
    assert.ok(instructions.includes('linear-tracker-provider'));
    assert.ok(instructions.includes('dwa setup --linear'));
  });

  it('getSetupInstructions returns correct text for googleDocs', () => {
    const instructions = getSetupInstructions('googleDocs');
    assert.ok(instructions.includes('gworkspace-provider'));
    assert.ok(instructions.includes('dwa setup --google-docs'));
  });

  it('getSetupInstructions returns message for unknown feature', () => {
    const instructions = getSetupInstructions('unknown');
    assert.match(instructions, /unknown feature/i);
  });

  it('getAllFeatureStatus returns all features', () => {
    const status = getAllFeatureStatus();
    assert.strictEqual(status.length, 2);

    const linearFeature = status.find(f => f.id === 'linear');
    assert.ok(linearFeature);
    assert.strictEqual(linearFeature.name, 'Linear Integration');
    assert.strictEqual(linearFeature.available, false);

    const googleFeature = status.find(f => f.id === 'googleDocs');
    assert.ok(googleFeature);
    assert.strictEqual(googleFeature.name, 'Google Docs Import');
    assert.strictEqual(googleFeature.available, false);
  });

  it('FEATURES constant contains expected structure', () => {
    assert.ok(FEATURES.linear);
    assert.ok(FEATURES.googleDocs);
    assert.ok(Array.isArray(FEATURES.linear.providerIds));
    assert.ok(Array.isArray(FEATURES.googleDocs.providerIds));
  });
});
