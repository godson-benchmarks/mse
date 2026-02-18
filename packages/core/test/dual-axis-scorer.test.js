const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DualAxisScorer } = require('../src/evaluator/dual-axis-scorer');

describe('DualAxisScorer', () => {
  const scorer = new DualAxisScorer();

  describe('single-axis items', () => {
    it('returns full weight to primary for single-axis item', () => {
      const result = scorer.score(
        { permissibility: 70, forced_choice: 'B' },
        { axis_id: 1, secondary_axis_id: null },
        {}
      );
      assert.equal(result.primary.axis_id, 1);
      assert.equal(result.primary.weight, 1.0);
      assert.equal(result.secondary, null);
      assert.equal(result.is_cross_axis, false);
    });

    it('returns full weight when secondary_axis_id is undefined', () => {
      const result = scorer.score(
        { permissibility: 50 },
        { axis_id: 3 },
        {}
      );
      assert.equal(result.primary.weight, 1.0);
      assert.equal(result.is_cross_axis, false);
    });
  });

  describe('cross-axis items', () => {
    it('splits weight based on SE values', () => {
      const result = scorer.score(
        { permissibility: 60, forced_choice: 'A' },
        { axis_id: 1, secondary_axis_id: 2 },
        {
          1: { se_b: 0.1 },   // lower SE = higher precision
          2: { se_b: 0.2 }    // higher SE = lower precision
        }
      );

      assert.equal(result.is_cross_axis, true);
      assert.equal(result.primary.axis_id, 1);
      assert.equal(result.secondary.axis_id, 2);

      // Primary has lower SE -> higher precision -> higher weight
      assert.ok(result.primary.weight > result.secondary.weight,
        `Expected primary weight (${result.primary.weight}) > secondary weight (${result.secondary.weight})`);

      // Weights sum to 1
      const total = result.primary.weight + result.secondary.weight;
      assert.ok(Math.abs(total - 1.0) < 0.01, `Weights should sum to 1, got ${total}`);
    });

    it('gives equal weight when SEs are equal', () => {
      const result = scorer.score(
        { permissibility: 50 },
        { axis_id: 5, secondary_axis_id: 8 },
        {
          5: { se_b: 0.15 },
          8: { se_b: 0.15 }
        }
      );

      assert.equal(result.primary.weight, 0.5);
      assert.equal(result.secondary.weight, 0.5);
    });

    it('uses default SE (0.5) when no prior scores exist', () => {
      const result = scorer.score(
        { permissibility: 40 },
        { axis_id: 1, secondary_axis_id: 7 },
        {} // no prior scores
      );

      // Both default to SE=0.5, so equal weight
      assert.equal(result.primary.weight, 0.5);
      assert.equal(result.secondary.weight, 0.5);
    });

    it('clamps weight to maxWeight', () => {
      const result = scorer.score(
        { permissibility: 60 },
        { axis_id: 1, secondary_axis_id: 2 },
        {
          1: { se_b: 0.01 },  // very precise (tiny SE)
          2: { se_b: 0.5 }    // very uncertain (huge SE)
        }
      );

      // Primary would dominate, but clamped to maxWeight (0.95)
      assert.ok(result.primary.weight <= 0.95,
        `Weight should be clamped to 0.95, got ${result.primary.weight}`);
      assert.ok(result.secondary.weight >= 0.05,
        `Secondary weight should be at least 0.05, got ${result.secondary.weight}`);
    });

    it('handles SE at minSE floor', () => {
      const scorer2 = new DualAxisScorer({ minSE: 0.05 });
      const result = scorer2.score(
        { permissibility: 50 },
        { axis_id: 1, secondary_axis_id: 2 },
        {
          1: { se_b: 0.001 },  // below minSE, floored to 0.05
          2: { se_b: 0.001 }   // below minSE, floored to 0.05
        }
      );

      // Both floored to same SE, so equal weight
      assert.equal(result.primary.weight, 0.5);
      assert.equal(result.secondary.weight, 0.5);
    });
  });

  describe('precision weighting math', () => {
    it('verifies 2:1 SE ratio produces 4:1 precision ratio', () => {
      // SE_p = 0.1, SE_s = 0.2
      // Precision_p = 1/0.01 = 100, Precision_s = 1/0.04 = 25
      // w_p = 100/125 = 0.8, w_s = 25/125 = 0.2
      const result = scorer.score(
        { permissibility: 50 },
        { axis_id: 1, secondary_axis_id: 2 },
        {
          1: { se_b: 0.1 },
          2: { se_b: 0.2 }
        }
      );

      assert.equal(result.primary.weight, 0.8);
      assert.equal(result.secondary.weight, 0.2);
    });

    it('verifies symmetric swap: SE values swapped changes weights', () => {
      const result = scorer.score(
        { permissibility: 50 },
        { axis_id: 1, secondary_axis_id: 2 },
        {
          1: { se_b: 0.2 },
          2: { se_b: 0.1 }
        }
      );

      assert.equal(result.primary.weight, 0.2);
      assert.equal(result.secondary.weight, 0.8);
    });
  });
});
