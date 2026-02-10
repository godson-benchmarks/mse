'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createSeededRNG, hashString } = require('../src/evaluator/seeded-random');

describe('createSeededRNG', () => {
  it('returns deterministic sequence for same integer seed', () => {
    const rng1 = createSeededRNG(42);
    const rng2 = createSeededRNG(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    assert.deepStrictEqual(seq1, seq2);
  });

  it('returns different sequences for different seeds', () => {
    const rng1 = createSeededRNG(42);
    const rng2 = createSeededRNG(99);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    assert.notDeepStrictEqual(seq1, seq2);
  });

  it('accepts string seed via DJB2 hash', () => {
    const rng1 = createSeededRNG('eval-run-abc');
    const rng2 = createSeededRNG('eval-run-abc');
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    assert.deepStrictEqual(seq1, seq2);
  });

  it('string and integer seeds produce different sequences', () => {
    const rngStr = createSeededRNG('42');
    const rngInt = createSeededRNG(42);
    // hashString('42') !== 42, so sequences must differ
    assert.notStrictEqual(rngStr(), rngInt());
  });

  it('output is always in [0, 1)', () => {
    const rng = createSeededRNG(123);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      assert.ok(val >= 0, `value ${val} below 0`);
      assert.ok(val < 1, `value ${val} >= 1`);
    }
  });

  it('returns Math.random for null seed', () => {
    const rng = createSeededRNG(null);
    assert.strictEqual(rng, Math.random);
  });

  it('returns Math.random for undefined seed', () => {
    const rng = createSeededRNG(undefined);
    assert.strictEqual(rng, Math.random);
  });
});

describe('hashString', () => {
  it('returns same hash for same string', () => {
    assert.strictEqual(hashString('test'), hashString('test'));
  });

  it('returns different hash for different strings', () => {
    assert.notStrictEqual(hashString('abc'), hashString('xyz'));
  });
});
