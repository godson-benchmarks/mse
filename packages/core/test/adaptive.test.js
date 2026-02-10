'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AdaptiveSelector } = require('../src/evaluator/adaptive');
const { AxisScorer } = require('../src/evaluator/scorer');
const { makeItem, makeResponse } = require('./fixtures');

describe('AdaptiveSelector', () => {
  const scorer = new AxisScorer();

  function makeItems(count) {
    return Array.from({ length: count }, (_, i) => makeItem({
      id: `item-${i}`,
      axis_id: 1,
      pressure_level: (i + 0.5) / count,
      is_anchor: i === 0 || i === count - 1
    }));
  }

  describe('anchor selection', () => {
    it('first item is low-pressure anchor', () => {
      const selector = new AdaptiveSelector({ seed: 42 });
      const items = makeItems(10);
      const selected = selector.selectNextItem(1, [], items, scorer);
      assert.ok(selected.pressure_level < 0.3,
        `first item pressure=${selected.pressure_level} should be < 0.3`);
    });

    it('second item is high-pressure anchor', () => {
      const selector = new AdaptiveSelector({ seed: 42 });
      const items = makeItems(10);
      const prev = [makeResponse({ item_id: items[0].id, pressure_level: items[0].pressure_level })];
      const selected = selector.selectNextItem(1, prev, items, scorer);
      assert.ok(selected.pressure_level > 0.7,
        `second item pressure=${selected.pressure_level} should be > 0.7`);
    });

    it('third item is mid-pressure anchor', () => {
      const selector = new AdaptiveSelector({ seed: 42 });
      const items = makeItems(10);
      const prev = [
        makeResponse({ item_id: items[0].id, pressure_level: items[0].pressure_level }),
        makeResponse({ item_id: items[9].id, pressure_level: items[9].pressure_level })
      ];
      const selected = selector.selectNextItem(1, prev, items, scorer);
      assert.ok(selected.pressure_level >= 0.3 && selected.pressure_level <= 0.7,
        `third item pressure=${selected.pressure_level} should be near 0.5`);
    });
  });

  describe('no repeat selection', () => {
    it('never selects an already-presented item', () => {
      const selector = new AdaptiveSelector({ seed: 42, minItemsPerAxis: 3 });
      const items = makeItems(10);
      const prev = [];
      const selectedIds = new Set();

      for (let i = 0; i < 8; i++) {
        const selected = selector.selectNextItem(1, prev, items, scorer);
        if (!selected) break;
        assert.ok(!selectedIds.has(selected.id),
          `item ${selected.id} was already presented`);
        selectedIds.add(selected.id);
        prev.push(makeResponse({
          item_id: selected.id,
          pressure_level: selected.pressure_level,
          permissibility: 30 + selected.pressure_level * 40
        }));
      }
    });
  });

  describe('returns null when exhausted', () => {
    it('returns null when no items available', () => {
      const selector = new AdaptiveSelector({ seed: 42 });
      const result = selector.selectNextItem(1, [], [], scorer);
      assert.strictEqual(result, null);
    });
  });

  describe('deterministic with same seed', () => {
    it('produces identical selection sequence', () => {
      const items = makeItems(10);

      function runSequence(seed) {
        const sel = new AdaptiveSelector({ seed, minItemsPerAxis: 3 });
        const prev = [];
        const ids = [];
        for (let i = 0; i < 5; i++) {
          const selected = sel.selectNextItem(1, prev, items, scorer);
          if (!selected) break;
          ids.push(selected.id);
          prev.push(makeResponse({
            item_id: selected.id,
            pressure_level: selected.pressure_level,
            permissibility: 50
          }));
        }
        return ids;
      }

      const seq1 = runSequence(42);
      const seq2 = runSequence(42);
      assert.deepStrictEqual(seq1, seq2);
    });
  });

  describe('shouldStopAxis', () => {
    it('returns false when fewer than minItems', () => {
      const selector = new AdaptiveSelector({ minItemsPerAxis: 5 });
      const responses = [makeResponse(), makeResponse()];
      assert.strictEqual(selector.shouldStopAxis(responses, scorer), false);
    });

    it('returns true when maxItems reached', () => {
      const selector = new AdaptiveSelector({ minItemsPerAxis: 3, maxItemsPerAxis: 5 });
      const responses = Array.from({ length: 5 }, (_, i) => makeResponse({
        pressure_level: (i + 1) / 6,
        permissibility: 30 + i * 10
      }));
      assert.strictEqual(selector.shouldStopAxis(responses, scorer), true);
    });
  });
});
