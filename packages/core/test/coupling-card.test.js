'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { CouplingCardGenerator } = require('../src/visualization/data/coupling-card');
const { CouplingAnalyzer } = require('../src/analyzer/coupling');

function makeResponses(axisCode, permissibilities) {
  return permissibilities.map((p, i) => ({
    axis_id: axisCode,
    axis_code: axisCode,
    permissibility: p,
    item_index: i
  }));
}

describe('CouplingCardGenerator', () => {
  describe('empty input', () => {
    it('returns empty card for null input', () => {
      const gen = new CouplingCardGenerator();
      const card = gen.generate(null);
      assert.deepStrictEqual(card.matrix_data, []);
      assert.deepStrictEqual(card.hub_bars, []);
      assert.deepStrictEqual(card.top_couplings, []);
      assert.strictEqual(card.reliability_badge.level, 'unknown');
    });

    it('returns empty card for default coupling result', () => {
      const gen = new CouplingCardGenerator();
      const analyzer = new CouplingAnalyzer();
      const result = analyzer.analyze([], {});
      const card = gen.generate(result);
      assert.deepStrictEqual(card.matrix_data, []);
    });
  });

  describe('with real coupling data', () => {
    let couplingResult;
    let card;

    // Generate coupling result once
    const analyzer = new CouplingAnalyzer({ bootstrapIterations: 20 });
    const responses = [
      ...makeResponses('rights-vs-consequences', [10, 20, 30, 40, 50, 60, 70, 80]),
      ...makeResponses('doing-vs-allowing', [15, 25, 35, 45, 55, 65, 75, 85]),
      ...makeResponses('means-vs-collateral', [80, 70, 60, 50, 40, 30, 20, 10]),
      ...makeResponses('privacy-vs-security', [20, 40, 60, 80, 20, 40, 60, 80])
    ];
    couplingResult = analyzer.analyze(responses, {});

    it('generates matrix_data with correct structure', () => {
      const gen = new CouplingCardGenerator();
      card = gen.generate(couplingResult);

      // Upper triangle: C(4,2) = 6 pairs
      assert.strictEqual(card.matrix_data.length, 6);

      for (const entry of card.matrix_data) {
        assert.ok(typeof entry.axis_a === 'string');
        assert.ok(typeof entry.axis_b === 'string');
        assert.ok(typeof entry.label_a === 'string');
        assert.ok(typeof entry.label_b === 'string');
        assert.ok(typeof entry.rho === 'number');
        assert.ok(typeof entry.significant === 'boolean');
      }
    });

    it('generates hub_bars sorted descending', () => {
      const gen = new CouplingCardGenerator();
      card = gen.generate(couplingResult);

      assert.ok(card.hub_bars.length > 0);
      for (let i = 0; i < card.hub_bars.length - 1; i++) {
        assert.ok(card.hub_bars[i].score >= card.hub_bars[i + 1].score,
          'Hub bars should be sorted by score descending');
      }

      for (const bar of card.hub_bars) {
        assert.ok(typeof bar.axis_code === 'string');
        assert.ok(typeof bar.label === 'string');
        assert.ok(typeof bar.score === 'number');
      }
    });

    it('generates top_couplings with strength labels', () => {
      const gen = new CouplingCardGenerator();
      card = gen.generate(couplingResult);

      assert.ok(card.top_couplings.length <= 5);
      for (const c of card.top_couplings) {
        assert.ok(['positive', 'negative'].includes(c.direction));
        assert.ok(['strong', 'moderate', 'weak', 'negligible'].includes(c.strength));
      }
    });

    it('generates reliability badge', () => {
      const gen = new CouplingCardGenerator();
      card = gen.generate(couplingResult);

      assert.ok(['excellent', 'good', 'moderate', 'low', 'unknown'].includes(card.reliability_badge.level));
      assert.ok(typeof card.reliability_badge.label === 'string');
    });

    it('includes metadata', () => {
      const gen = new CouplingCardGenerator();
      card = gen.generate(couplingResult);

      assert.strictEqual(card.metadata.n_axes, 4);
      assert.ok(typeof card.metadata.n_items_per_axis === 'number');
      assert.ok(typeof card.metadata.shrinkage_lambda === 'number');
      assert.ok(typeof card.metadata.fdr_threshold === 'number');
    });
  });

  describe('axis labels', () => {
    it('uses short labels for known MSE axes', () => {
      const gen = new CouplingCardGenerator();
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      const responses = [
        ...makeResponses('rights-vs-consequences', [10, 20, 30, 40, 50]),
        ...makeResponses('privacy-vs-security', [50, 40, 30, 20, 10]),
        ...makeResponses('autonomy-vs-paternalism', [15, 25, 35, 45, 55])
      ];
      const result = analyzer.analyze(responses, {});
      const card = gen.generate(result);

      const labels = card.hub_bars.map(b => b.label);
      assert.ok(labels.includes('Auton./Patern.') || labels.includes('Privacy/Security') || labels.includes('Rights/Conseq.'));
    });

    it('falls back to axis code for unknown axes', () => {
      const gen = new CouplingCardGenerator();
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      const responses = [
        ...makeResponses('custom-axis-x', [10, 20, 30, 40, 50]),
        ...makeResponses('custom-axis-y', [50, 40, 30, 20, 10]),
        ...makeResponses('custom-axis-z', [15, 25, 35, 45, 55])
      ];
      const result = analyzer.analyze(responses, {});
      const card = gen.generate(result);

      const labels = card.hub_bars.map(b => b.label);
      assert.ok(labels.includes('custom-axis-x'));
    });
  });
});
