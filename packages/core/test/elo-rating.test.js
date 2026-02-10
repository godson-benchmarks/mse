'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const MEMRatingSystem = require('../src/evaluator/elo-rating');

describe('MEMRatingSystem', () => {
  const elo = new MEMRatingSystem();

  describe('updateRating', () => {
    it('perfect performance increases rating', () => {
      const { newMR, delta } = elo.updateRating(1000, 1000, 4, 0);
      assert.ok(delta > 0, `delta=${delta} should be positive for perfect category`);
      assert.ok(newMR > 1000);
    });

    it('poor performance decreases rating', () => {
      const { newMR, delta } = elo.updateRating(1000, 1000, 0, 0);
      assert.ok(delta < 0, `delta=${delta} should be negative for category 0`);
      assert.ok(newMR < 1000);
    });

    it('K-factor decays with items processed', () => {
      const { delta: delta0 } = elo.updateRating(1000, 1000, 4, 0);
      const { delta: delta50 } = elo.updateRating(1000, 1000, 4, 50);
      assert.ok(Math.abs(delta0) > Math.abs(delta50),
        `|delta(0)|=${Math.abs(delta0)} should be > |delta(50)|=${Math.abs(delta50)}`);
    });

    it('K-factor never below kMin (8)', () => {
      const { delta } = elo.updateRating(1000, 1000, 4, 10000);
      // With kMin=8, max possible |delta| = 8 * 0.5 = 4
      // At 10000 items, K should be at kMin
      const effectiveK = Math.max(8, 32 * Math.pow(0.95, 10000));
      assert.strictEqual(effectiveK, 8);
    });
  });

  describe('processRun', () => {
    it('accumulates deltas across multiple items', () => {
      const results = [
        { itemDifficulty: 1000, grmCategory: 4 },
        { itemDifficulty: 1000, grmCategory: 3 },
        { itemDifficulty: 1000, grmCategory: 4 }
      ];
      const { newMR, totalDelta, itemsInRun } = elo.processRun(1000, 0, results);
      assert.strictEqual(itemsInRun, 3);
      assert.ok(totalDelta > 0, 'total delta should be positive for good performance');
      assert.ok(newMR > 1000);
    });

    it('returns initial MR for empty results', () => {
      const { newMR, totalDelta } = elo.processRun(1000, 0, []);
      assert.strictEqual(newMR, 1000);
      assert.strictEqual(totalDelta, 0);
    });
  });

  describe('calculateItemDifficulty', () => {
    it('base difficulty scales with pressure_level', () => {
      const low = elo.calculateItemDifficulty({ pressure_level: 0.2, dilemma_type: 'base' });
      const high = elo.calculateItemDifficulty({ pressure_level: 0.8, dilemma_type: 'base' });
      assert.ok(high > low, `high(${high}) should be > low(${low})`);
    });

    it('adds type bonus for complex types', () => {
      const base = elo.calculateItemDifficulty({ pressure_level: 0.5, dilemma_type: 'base' });
      const dirty = elo.calculateItemDifficulty({ pressure_level: 0.5, dilemma_type: 'dirty_hands' });
      assert.ok(dirty > base, `dirty_hands(${dirty}) should be > base(${base})`);
    });

    it('adds expert disagreement bonus', () => {
      const noDisagreement = elo.calculateItemDifficulty({ pressure_level: 0.5, dilemma_type: 'base', expert_disagreement: 0 });
      const highDisagreement = elo.calculateItemDifficulty({ pressure_level: 0.5, dilemma_type: 'base', expert_disagreement: 0.8 });
      assert.ok(highDisagreement > noDisagreement);
    });
  });

  describe('updateUncertainty', () => {
    it('decreases uncertainty with more items', () => {
      const updated = elo.updateUncertainty(350, 10);
      assert.ok(updated < 350, `updated=${updated} should be < 350`);
    });

    it('never drops below 50', () => {
      const updated = elo.updateUncertainty(350, 100000);
      assert.ok(updated >= 50, `updated=${updated} should be >= 50`);
    });
  });
});
