'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ProfileGeometryAnalyzer } = require('../src/analyzer/geometry');

// Helper: generate n agents with b-values for given axes
function makeAgents(n, axisCodes, generator) {
  const agents = [];
  for (let i = 0; i < n; i++) {
    const vec = {};
    for (const code of axisCodes) {
      vec[code] = generator(i, code);
    }
    agents.push(vec);
  }
  return agents;
}

const AXES = ['axis-a', 'axis-b', 'axis-c'];

describe('ProfileGeometryAnalyzer', () => {
  describe('insufficient data', () => {
    it('returns null for fewer than minAgents', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 10 });
      const agents = makeAgents(5, AXES, () => Math.random());
      assert.strictEqual(analyzer.analyze(agents), null);
    });
  });

  describe('per-axis IQR', () => {
    it('computes correct IQR for uniform spread', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5 });
      // Agents with b-values evenly spaced 0.0 to 1.0
      const agents = makeAgents(11, ['axis-a'], (i) => i / 10);
      const result = analyzer.analyze(agents);

      assert.ok(result !== null);
      const iqr = result.per_axis['axis-a'].iqr;
      // For 0,0.1,...,1.0: Q1=0.25, Q3=0.75, IQR=0.5
      assert.ok(Math.abs(iqr - 0.5) < 0.01, `IQR=${iqr} should be ~0.5`);
    });

    it('computes zero IQR for identical values', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5 });
      const agents = makeAgents(10, ['axis-a'], () => 0.5);
      const result = analyzer.analyze(agents);

      assert.strictEqual(result.per_axis['axis-a'].iqr, 0);
    });
  });

  describe('bimodality coefficient', () => {
    it('detects bimodal distribution', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5 });
      // Two clusters: half at ~0.2, half at ~0.8
      const agents = makeAgents(20, ['axis-a'], (i) =>
        i < 10 ? 0.2 + Math.random() * 0.05 : 0.8 + Math.random() * 0.05
      );
      const result = analyzer.analyze(agents);

      assert.ok(result.per_axis['axis-a'].bimodality_coefficient > 0.4,
        `BC=${result.per_axis['axis-a'].bimodality_coefficient} should suggest bimodality`);
    });

    it('reports low BC for unimodal distribution', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5 });
      // Deterministic bell-shaped values around 0.5 (avoids flaky Math.random)
      // Using squared mapping to create peaked center distribution
      const vals = [0.46, 0.47, 0.48, 0.48, 0.49, 0.49, 0.49, 0.50, 0.50, 0.50,
                    0.50, 0.50, 0.51, 0.51, 0.51, 0.52, 0.52, 0.53, 0.53, 0.54];
      const agents = makeAgents(20, ['axis-a'], (i) => vals[i]);
      const result = analyzer.analyze(agents);

      assert.ok(result.per_axis['axis-a'].bimodality_coefficient < 0.555,
        `BC=${result.per_axis['axis-a'].bimodality_coefficient} should be below bimodality threshold`);
    });
  });

  describe('population Spearman correlation', () => {
    it('produces symmetric matrix with 1.0 diagonal', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5 });
      const agents = makeAgents(15, AXES, (i) => (i + Math.random()) / 15);
      const result = analyzer.analyze(agents);

      const m = result.correlation_matrix;
      const n = result.axis_codes.length;

      for (let i = 0; i < n; i++) {
        assert.strictEqual(m[i][i], 1.0);
        for (let j = i + 1; j < n; j++) {
          assert.strictEqual(m[i][j], m[j][i]);
        }
      }
    });

    it('detects strong positive correlation between co-varying axes', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5 });
      // axis-a and axis-b move together; axis-c is noise
      const agents = makeAgents(20, AXES, (i, code) => {
        if (code === 'axis-a') return i / 20;
        if (code === 'axis-b') return i / 20 + Math.random() * 0.05;
        return Math.random();
      });
      const result = analyzer.analyze(agents);

      // Find indices
      const idxA = result.axis_codes.indexOf('axis-a');
      const idxB = result.axis_codes.indexOf('axis-b');
      assert.ok(result.correlation_matrix[idxA][idxB] > 0.7,
        `Correlation between co-varying axes should be high, got ${result.correlation_matrix[idxA][idxB]}`);
    });
  });

  describe('warnings', () => {
    it('warns when below recommended sample size', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5, warnBelowAgents: 50 });
      const agents = makeAgents(15, AXES, () => Math.random());
      const result = analyzer.analyze(agents);

      assert.ok(result.metadata.warnings.length > 0);
      assert.ok(result.metadata.warnings[0].includes('Small sample'));
    });

    it('does not warn with sufficient agents', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5, warnBelowAgents: 10 });
      const agents = makeAgents(15, AXES, () => Math.random());
      const result = analyzer.analyze(agents);

      assert.strictEqual(result.metadata.warnings.length, 0);
    });
  });

  describe('metadata', () => {
    it('includes expected fields', () => {
      const analyzer = new ProfileGeometryAnalyzer({ minAgents: 5 });
      const agents = makeAgents(12, AXES, () => Math.random());
      const result = analyzer.analyze(agents);

      assert.strictEqual(result.metadata.n_agents, 12);
      assert.strictEqual(result.metadata.n_axes, 3);
      assert.strictEqual(result.metadata.bimodality_threshold, 0.555);
      assert.ok(Array.isArray(result.axis_codes));
    });
  });
});
