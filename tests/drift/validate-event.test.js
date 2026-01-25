/**
 * Tests for drift event validation.
 * TDD RED phase: Write failing tests first.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  validateDriftEvent,
  DRIFT_KINDS,
  DRIFT_DECISIONS,
  DRIFT_SOURCES
} = require('../../src/drift/validate-event');

describe('validateDriftEvent', () => {
  describe('valid events', () => {
    it('returns true for valid event with all required fields', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Added error handling not in original ACs',
        decision: 'pending'
      };

      const result = validateDriftEvent(event);
      assert.strictEqual(result, true);
    });

    it('returns true for event with optional fields', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'skill',
        kind: 'scope_change',
        summary: 'Feature scope expanded',
        decision: 'accept',
        applies_to_next_work: true,
        evidence_refs: ['https://github.com/example/pr/42'],
        patch_proposals: ['Add AC for error handling'],
        author: 'user'
      };

      const result = validateDriftEvent(event);
      assert.strictEqual(result, true);
    });

    it('returns true for event with extra fields (forward compatibility)', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'manual',
        kind: 'qa_gap',
        summary: 'Missing test coverage',
        decision: 'escalate',
        unknown_future_field: 'some value',
        another_new_field: 123
      };

      const result = validateDriftEvent(event);
      assert.strictEqual(result, true);
    });
  });

  describe('missing required fields', () => {
    it('throws DWA-E070 when id field is missing', () => {
      const event = {
        at: '2026-01-24T10:30:00Z',
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E070'));
          assert.ok(err.message.includes('id'));
          return true;
        }
      );
    });

    it('throws DWA-E070 when at field is missing', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E070'));
          assert.ok(err.message.includes('at'));
          return true;
        }
      );
    });

    it('throws DWA-E070 when source field is missing', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E070'));
          assert.ok(err.message.includes('source'));
          return true;
        }
      );
    });

    it('throws DWA-E070 when kind field is missing', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'complete_command',
        summary: 'Test summary',
        decision: 'pending'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E070'));
          assert.ok(err.message.includes('kind'));
          return true;
        }
      );
    });

    it('throws DWA-E070 when summary field is missing', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'complete_command',
        kind: 'impl_deviation',
        decision: 'pending'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E070'));
          assert.ok(err.message.includes('summary'));
          return true;
        }
      );
    });

    it('throws DWA-E070 when decision field is missing', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E070'));
          assert.ok(err.message.includes('decision'));
          return true;
        }
      );
    });
  });

  describe('invalid enum values', () => {
    it('throws DWA-E071 for invalid kind', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'complete_command',
        kind: 'unknown_kind',
        summary: 'Test summary',
        decision: 'pending'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E071'));
          assert.ok(err.message.includes('unknown_kind'));
          return true;
        }
      );
    });

    it('throws DWA-E072 for invalid decision', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'complete_command',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'reject'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E072'));
          assert.ok(err.message.includes('reject'));
          return true;
        }
      );
    });

    it('throws DWA-E073 for invalid source', () => {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        at: '2026-01-24T10:30:00Z',
        source: 'api',
        kind: 'impl_deviation',
        summary: 'Test summary',
        decision: 'pending'
      };

      assert.throws(
        () => validateDriftEvent(event),
        (err) => {
          assert.ok(err.message.includes('DWA-E073'));
          assert.ok(err.message.includes('api'));
          return true;
        }
      );
    });
  });

  describe('all valid enum values accepted', () => {
    it('accepts all valid drift kinds', () => {
      const validKinds = [
        'impl_deviation',
        'scope_change',
        'qa_gap',
        'spec_update_needed',
        'tdd_update_needed',
        'followup_required',
        'rollback_required'
      ];

      for (const kind of validKinds) {
        const event = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          at: '2026-01-24T10:30:00Z',
          source: 'complete_command',
          kind,
          summary: 'Test summary',
          decision: 'pending'
        };

        assert.strictEqual(validateDriftEvent(event), true, `Kind '${kind}' should be valid`);
      }
    });

    it('accepts all valid drift decisions', () => {
      const validDecisions = ['pending', 'accept', 'revert', 'escalate'];

      for (const decision of validDecisions) {
        const event = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          at: '2026-01-24T10:30:00Z',
          source: 'complete_command',
          kind: 'impl_deviation',
          summary: 'Test summary',
          decision
        };

        assert.strictEqual(validateDriftEvent(event), true, `Decision '${decision}' should be valid`);
      }
    });

    it('accepts all valid drift sources', () => {
      const validSources = ['complete_command', 'manual', 'skill'];

      for (const source of validSources) {
        const event = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          at: '2026-01-24T10:30:00Z',
          source,
          kind: 'impl_deviation',
          summary: 'Test summary',
          decision: 'pending'
        };

        assert.strictEqual(validateDriftEvent(event), true, `Source '${source}' should be valid`);
      }
    });
  });
});

describe('exported constants', () => {
  it('DRIFT_KINDS contains all valid kinds', () => {
    assert.ok(Array.isArray(DRIFT_KINDS));
    assert.ok(DRIFT_KINDS.includes('impl_deviation'));
    assert.ok(DRIFT_KINDS.includes('scope_change'));
    assert.ok(DRIFT_KINDS.includes('qa_gap'));
    assert.ok(DRIFT_KINDS.includes('spec_update_needed'));
    assert.ok(DRIFT_KINDS.includes('tdd_update_needed'));
    assert.ok(DRIFT_KINDS.includes('followup_required'));
    assert.ok(DRIFT_KINDS.includes('rollback_required'));
    assert.strictEqual(DRIFT_KINDS.length, 7);
  });

  it('DRIFT_DECISIONS contains all valid decisions', () => {
    assert.ok(Array.isArray(DRIFT_DECISIONS));
    assert.ok(DRIFT_DECISIONS.includes('pending'));
    assert.ok(DRIFT_DECISIONS.includes('accept'));
    assert.ok(DRIFT_DECISIONS.includes('revert'));
    assert.ok(DRIFT_DECISIONS.includes('escalate'));
    assert.strictEqual(DRIFT_DECISIONS.length, 4);
  });

  it('DRIFT_SOURCES contains all valid sources', () => {
    assert.ok(Array.isArray(DRIFT_SOURCES));
    assert.ok(DRIFT_SOURCES.includes('complete_command'));
    assert.ok(DRIFT_SOURCES.includes('manual'));
    assert.ok(DRIFT_SOURCES.includes('skill'));
    assert.strictEqual(DRIFT_SOURCES.length, 3);
  });

  it('constants are frozen (immutable)', () => {
    // Try to modify - should either throw or silently fail
    const originalKindsLength = DRIFT_KINDS.length;
    try {
      DRIFT_KINDS.push('new_kind');
    } catch (e) {
      // Expected in strict mode with frozen array
    }
    // If frozen, length should be unchanged
    assert.strictEqual(DRIFT_KINDS.length, originalKindsLength);
  });
});
