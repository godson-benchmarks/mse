'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AxisScorer } = require('../src/evaluator/scorer');
const { makeSigmoidResponses, makeResponse } = require('./fixtures');

describe('AxisScorer', () => {
  const scorer = new AxisScorer();

  describe('score() — empty / null input', () => {
    it('returns default score for null responses', () => {
      const result = scorer.score(null, 1);
      assert.strictEqual(result.b, 0.5);
      assert.strictEqual(result.n_items, 0);
      assert.ok(result.flags.includes('few_items'));
      assert.ok(result.flags.includes('high_uncertainty'));
    });

    it('returns default score for empty array', () => {
      const result = scorer.score([], 1);
      assert.strictEqual(result.b, 0.5);
      assert.strictEqual(result.n_items, 0);
    });
  });

  describe('score() — all-permit responses', () => {
    it('produces low threshold (b < 0.25)', () => {
      const responses = Array.from({ length: 8 }, (_, i) => makeResponse({
        pressure_level: (i + 1) / 9,
        permissibility: 90,
        forced_choice: 'B'
      }));
      const result = scorer.score(responses, 1);
      assert.ok(result.b < 0.25, `b=${result.b} should be < 0.25 for all-permit`);
    });
  });

  describe('score() — all-refuse responses', () => {
    it('produces high threshold (b > 0.75)', () => {
      const responses = Array.from({ length: 8 }, (_, i) => makeResponse({
        pressure_level: (i + 1) / 9,
        permissibility: 10,
        forced_choice: 'A'
      }));
      const result = scorer.score(responses, 1);
      assert.ok(result.b > 0.75, `b=${result.b} should be > 0.75 for all-refuse`);
    });
  });

  describe('score() — sigmoid responses', () => {
    it('estimates threshold near true value for threshold=0.5', () => {
      const responses = makeSigmoidResponses(0.5, 10);
      const result = scorer.score(responses, 1);
      assert.ok(result.b >= 0.3 && result.b <= 0.7,
        `b=${result.b} should be near 0.5 for sigmoid(0.5)`);
    });

    it('estimates threshold near true value for threshold=0.3', () => {
      const responses = makeSigmoidResponses(0.3, 12);
      const result = scorer.score(responses, 1);
      assert.ok(result.b >= 0.15 && result.b <= 0.50,
        `b=${result.b} should be near 0.3`);
    });
  });

  describe('score() — SE decreases with more items', () => {
    it('SE with 5 items > SE with 15 items', () => {
      const few = makeSigmoidResponses(0.5, 5);
      const many = makeSigmoidResponses(0.5, 15);
      const resultFew = scorer.score(few, 1);
      const resultMany = scorer.score(many, 1);
      assert.ok(resultFew.se_b >= resultMany.se_b,
        `SE(5)=${resultFew.se_b} should be >= SE(15)=${resultMany.se_b}`);
    });
  });

  describe('score() — flag detection', () => {
    it('flags few_items when < minItems', () => {
      const responses = makeSigmoidResponses(0.5, 2);
      const result = scorer.score(responses, 1);
      assert.ok(result.flags.includes('few_items'));
    });

    it('flags out_of_range when b is extreme', () => {
      const responses = Array.from({ length: 8 }, (_, i) => makeResponse({
        pressure_level: (i + 1) / 9,
        permissibility: 95,
        forced_choice: 'B'
      }));
      const result = scorer.score(responses, 1);
      if (result.b < 0.1 || result.b > 0.9) {
        assert.ok(result.flags.includes('out_of_range'));
      }
    });
  });

  describe('score() — clamping', () => {
    it('b is clamped to [0.05, 0.95]', () => {
      // Extreme all-permit
      const responses = Array.from({ length: 10 }, (_, i) => makeResponse({
        pressure_level: (i + 1) / 11,
        permissibility: 99,
        forced_choice: 'B'
      }));
      const result = scorer.score(responses, 1);
      assert.ok(result.b >= 0.05 && result.b <= 0.95,
        `b=${result.b} should be in [0.05, 0.95]`);
    });

    it('a is clamped to [0.5, 10]', () => {
      const responses = makeSigmoidResponses(0.5, 10);
      const result = scorer.score(responses, 1);
      assert.ok(result.a >= 0.5 && result.a <= 10,
        `a=${result.a} should be in [0.5, 10]`);
    });
  });

  describe('quickEstimate()', () => {
    it('returns 0.5 for empty responses', () => {
      assert.strictEqual(scorer.quickEstimate([]), 0.5);
    });

    it('returns 0.5 for null responses', () => {
      assert.strictEqual(scorer.quickEstimate(null), 0.5);
    });

    it('returns estimate in [0.1, 0.9] for valid data', () => {
      const responses = makeSigmoidResponses(0.4, 6);
      const est = scorer.quickEstimate(responses);
      assert.ok(est >= 0.1 && est <= 0.9, `estimate=${est} out of range`);
    });
  });

  describe('estimateSE()', () => {
    it('returns 0.5 for fewer than 2 responses', () => {
      assert.strictEqual(scorer.estimateSE([makeResponse()], 0.5), 0.5);
      assert.strictEqual(scorer.estimateSE([], 0.5), 0.5);
    });

    it('returns value <= 0.5', () => {
      const responses = makeSigmoidResponses(0.5, 10);
      const se = scorer.estimateSE(responses, 0.5);
      assert.ok(se <= 0.5, `SE=${se} should be <= 0.5`);
    });
  });
});
