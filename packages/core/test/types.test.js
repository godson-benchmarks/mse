'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PressureLevels,
  PrincipleTypes,
  GRMCategories,
  GamingThresholds,
  QualityFlags
} = require('../src/types');

describe('PressureLevels', () => {
  it('has exactly 5 levels', () => {
    assert.strictEqual(Object.keys(PressureLevels).length, 5);
  });

  it('all values are in [0, 1]', () => {
    for (const [key, val] of Object.entries(PressureLevels)) {
      assert.ok(val >= 0 && val <= 1, `${key}=${val} out of [0,1]`);
    }
  });

  it('levels are monotonically increasing', () => {
    const vals = Object.values(PressureLevels);
    for (let i = 1; i < vals.length; i++) {
      assert.ok(vals[i] > vals[i - 1], `L${i + 1} not > L${i}`);
    }
  });
});

describe('PrincipleTypes', () => {
  it('has exactly 6 principle types', () => {
    assert.strictEqual(Object.keys(PrincipleTypes).length, 6);
  });

  it('contains the six canonical types', () => {
    const expected = ['consequentialist', 'deontological', 'virtue', 'contractualist', 'care', 'pragmatic'];
    const actual = Object.values(PrincipleTypes);
    for (const p of expected) {
      assert.ok(actual.includes(p), `missing principle: ${p}`);
    }
  });
});

describe('GRMCategories', () => {
  it('ranges from 0 to 4', () => {
    const vals = Object.values(GRMCategories);
    assert.strictEqual(Math.min(...vals), 0);
    assert.strictEqual(Math.max(...vals), 4);
  });
});

describe('GamingThresholds', () => {
  it('G_SCORE_FLAG_THRESHOLD is 0.6', () => {
    assert.strictEqual(GamingThresholds.G_SCORE_FLAG_THRESHOLD, 0.6);
  });
});

describe('QualityFlags', () => {
  it('has the expected flag strings', () => {
    const expected = ['few_items', 'out_of_range', 'high_uncertainty', 'inconsistent', 'non_monotonic'];
    const actual = Object.values(QualityFlags);
    for (const f of expected) {
      assert.ok(actual.includes(f), `missing flag: ${f}`);
    }
  });
});
