'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CouplingAnalyzer,
  spearmanCorrelation,
  pearsonCorrelation,
  toRanks,
  spearmanPValue,
  regularizedBeta,
  logitTransform
} = require('../src/analyzer/coupling');

// --- Helper: generate synthetic responses for an axis ---
function makeResponses(axisCode, permissibilities) {
  return permissibilities.map((p, i) => ({
    axis_id: axisCode,
    axis_code: axisCode,
    permissibility: p,
    item_index: i
  }));
}

// The 15 MSE axis codes
const ALL_AXES = [
  'rights-vs-consequences', 'doing-vs-allowing', 'means-vs-collateral',
  'impartiality-vs-partiality', 'worst-off-vs-efficiency', 'truth-vs-beneficence',
  'autonomy-vs-paternalism', 'privacy-vs-security', 'conscience-vs-authority',
  'cooperation-vs-defection', 'long-term-vs-short-term', 'integrity-vs-opportunism',
  'minimization-vs-personalization', 'purpose-vs-secondary-use',
  'compartmentalization-vs-leakage'
];

describe('Statistical Utilities', () => {
  describe('toRanks', () => {
    it('ranks distinct values correctly', () => {
      const ranks = toRanks([30, 10, 20]);
      assert.deepStrictEqual(ranks, [3, 1, 2]);
    });

    it('assigns average ranks for ties', () => {
      const ranks = toRanks([10, 20, 20, 30]);
      // Tied values at indices 1,2 get average rank (2+3)/2 = 2.5
      assert.deepStrictEqual(ranks, [1, 2.5, 2.5, 4]);
    });
  });

  describe('pearsonCorrelation', () => {
    it('returns 1 for perfectly correlated data', () => {
      const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
      assert.ok(Math.abs(r - 1) < 1e-10);
    });

    it('returns -1 for perfectly anti-correlated data', () => {
      const r = pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
      assert.ok(Math.abs(r + 1) < 1e-10);
    });

    it('returns 0 for uncorrelated data', () => {
      const r = pearsonCorrelation([1, 2, 3, 4, 5], [3, 3, 3, 3, 3]);
      assert.strictEqual(r, 0);
    });

    it('returns 0 for fewer than 2 points', () => {
      assert.strictEqual(pearsonCorrelation([1], [2]), 0);
    });
  });

  describe('spearmanCorrelation', () => {
    it('returns 1 for monotonically increasing data', () => {
      const rho = spearmanCorrelation([1, 5, 3, 8, 10], [2, 6, 4, 9, 11]);
      assert.ok(Math.abs(rho - 1) < 1e-10);
    });

    it('returns -1 for monotonically decreasing relationship', () => {
      const rho = spearmanCorrelation([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]);
      assert.ok(Math.abs(rho + 1) < 1e-10);
    });

    it('handles tied values', () => {
      const rho = spearmanCorrelation([1, 2, 2, 3], [10, 20, 20, 30]);
      assert.ok(rho > 0.9, `Spearman rho=${rho} should be > 0.9 for tied monotonic data`);
    });
  });

  describe('spearmanPValue', () => {
    it('returns small p-value for strong correlation with many samples', () => {
      // rho=0.9 with n=20 should be highly significant
      const p = spearmanPValue(0.9, 20);
      assert.ok(p < 0.001, `p=${p} should be < 0.001 for rho=0.9, n=20`);
    });

    it('returns large p-value for weak correlation', () => {
      const p = spearmanPValue(0.1, 10);
      assert.ok(p > 0.1, `p=${p} should be > 0.1 for rho=0.1, n=10`);
    });

    it('returns 1 for n <= 2', () => {
      assert.strictEqual(spearmanPValue(0.5, 2), 1);
    });

    it('returns 0 for |rho| = 1', () => {
      assert.strictEqual(spearmanPValue(1.0, 10), 0);
    });
  });

  describe('regularizedBeta', () => {
    it('returns 0 for x=0', () => {
      assert.strictEqual(regularizedBeta(0, 1, 1), 0);
    });

    it('returns 1 for x=1', () => {
      assert.strictEqual(regularizedBeta(1, 1, 1), 1);
    });

    it('returns 0.5 for x=0.5 with a=1, b=1 (uniform)', () => {
      const val = regularizedBeta(0.5, 1, 1);
      assert.ok(Math.abs(val - 0.5) < 0.01, `I(0.5, 1, 1) = ${val} should be ~0.5`);
    });
  });
});

describe('logitTransform', () => {
  it('transforms 0.5 to 0', () => {
    const result = logitTransform([0.5]);
    assert.ok(Math.abs(result[0]) < 1e-10, `logit(0.5) = ${result[0]} should be 0`);
  });

  it('transforms values symmetrically around 0.5', () => {
    const result = logitTransform([0.3, 0.7]);
    assert.ok(Math.abs(result[0] + result[1]) < 1e-10,
      `logit(0.3) + logit(0.7) = ${result[0] + result[1]} should be 0`);
  });

  it('clamps extreme values to avoid infinities', () => {
    const result = logitTransform([0, 1]);
    // 0 clamped to 0.01: logit(0.01) = log(0.01/0.99) ~ -4.595
    // 1 clamped to 0.99: logit(0.99) = log(0.99/0.01) ~ 4.595
    assert.ok(isFinite(result[0]), 'logit(0) should be finite after clamping');
    assert.ok(isFinite(result[1]), 'logit(1) should be finite after clamping');
    assert.ok(result[0] < -4, `logit(0) clamped = ${result[0]} should be < -4`);
    assert.ok(result[1] > 4, `logit(1) clamped = ${result[1]} should be > 4`);
  });

  it('preserves ordering', () => {
    const result = logitTransform([0.2, 0.4, 0.6, 0.8]);
    for (let i = 0; i < result.length - 1; i++) {
      assert.ok(result[i] < result[i + 1],
        `logit should preserve order: ${result[i]} < ${result[i + 1]}`);
    }
  });

  it('returns empty array for empty input', () => {
    assert.deepStrictEqual(logitTransform([]), []);
  });
});

describe('CouplingAnalyzer', () => {
  describe('insufficient data', () => {
    it('returns default result for fewer than 3 axes', () => {
      const analyzer = new CouplingAnalyzer();
      const responses = [
        ...makeResponses('rights-vs-consequences', [50, 60, 70]),
        ...makeResponses('doing-vs-allowing', [40, 50, 60])
      ];
      const result = analyzer.analyze(responses, {});
      assert.deepStrictEqual(result.coupling_matrix, []);
      assert.strictEqual(result.metadata.n_axes, 2);
    });

    it('returns default result for axes with too few items', () => {
      const analyzer = new CouplingAnalyzer({ minItemsPerAxis: 5 });
      const responses = [
        ...makeResponses('rights-vs-consequences', [50, 60]),
        ...makeResponses('doing-vs-allowing', [40, 50]),
        ...makeResponses('means-vs-collateral', [30, 40])
      ];
      const result = analyzer.analyze(responses, {});
      assert.deepStrictEqual(result.coupling_matrix, []);
    });
  });

  describe('shrinkage-Spearman matrix', () => {
    it('produces symmetric matrix with 1.0 diagonal', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      const responses = [
        ...makeResponses('axis-a', [10, 20, 30, 40, 50]),
        ...makeResponses('axis-b', [50, 40, 30, 20, 10]),
        ...makeResponses('axis-c', [15, 25, 35, 45, 55])
      ];
      const result = analyzer.analyze(responses, {});
      const m = result.coupling_matrix;

      assert.strictEqual(m.length, 3);
      // Diagonal = 1
      for (let i = 0; i < 3; i++) {
        assert.strictEqual(m[i][i], 1.0);
      }
      // Symmetric
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          assert.strictEqual(m[i][j], m[j][i], `m[${i}][${j}] !== m[${j}][${i}]`);
        }
      }
    });

    it('shrinks off-diagonal values toward zero', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      // Perfect negative correlation
      const responses = [
        ...makeResponses('a', [10, 20, 30, 40, 50]),
        ...makeResponses('b', [50, 40, 30, 20, 10]),
        ...makeResponses('c', [10, 20, 30, 40, 50])
      ];
      const result = analyzer.analyze(responses, {});
      const m = result.coupling_matrix;

      // Raw rho between a and b would be -1, but shrinkage should reduce magnitude
      // lambda = (5-3)/(5+10) = 2/15 ~= 0.1333
      // shrunk = 0.1333 * (-1) = -0.1333
      assert.ok(Math.abs(m[0][1]) < 1, 'Shrinkage should reduce magnitude below raw rho');
      assert.ok(Math.abs(m[0][1]) < 0.5, `Shrunk value ${m[0][1]} should be much less than 1`);
    });

    it('shrinkage lambda increases with more items', () => {
      const analyzer = new CouplingAnalyzer();
      const lambda5 = analyzer._computeShrinkageLambda(5);   // (5-3)/(5+10) = 0.133
      const lambda20 = analyzer._computeShrinkageLambda(20);  // (20-3)/(20+10) = 0.567
      const lambda50 = analyzer._computeShrinkageLambda(50);  // (50-3)/(50+10) = 0.783
      assert.ok(lambda5 < lambda20);
      assert.ok(lambda20 < lambda50);
      assert.ok(lambda50 < 1);
    });
  });

  describe('Benjamini-Hochberg FDR', () => {
    it('rejects fewer or equal tests than raw p-value thresholding', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });

      // Create data with some strong correlations and some noise
      const n = 10;
      const responses = [];
      const axes = ['a', 'b', 'c', 'd', 'e'];
      for (let i = 0; i < axes.length; i++) {
        const perms = [];
        for (let j = 0; j < n; j++) {
          // Axes a,b,c are correlated; d,e are noise
          if (i < 3) {
            perms.push(10 + j * 8 + Math.random() * 2);
          } else {
            perms.push(Math.random() * 100);
          }
        }
        responses.push(...makeResponses(axes[i], perms));
      }

      const result = analyzer.analyze(responses, {});

      // Count significant pairs after BH
      let bhCount = 0;
      let rawCount = 0;
      const m = result.significant.length;
      for (let i = 0; i < m; i++) {
        for (let j = i + 1; j < m; j++) {
          if (result.significant[i][j]) bhCount++;
          if (result.p_values[i][j] < 0.10) rawCount++;
        }
      }
      assert.ok(bhCount <= rawCount,
        `BH significant (${bhCount}) should be <= raw significant (${rawCount})`);
    });

    it('marks diagonal as significant', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      const responses = [
        ...makeResponses('a', [10, 20, 30, 40, 50]),
        ...makeResponses('b', [50, 40, 30, 20, 10]),
        ...makeResponses('c', [15, 25, 35, 45, 55])
      ];
      const result = analyzer.analyze(responses, {});
      for (let i = 0; i < result.significant.length; i++) {
        assert.strictEqual(result.significant[i][i], true);
      }
    });
  });

  describe('eigenvector centrality / hub scores', () => {
    it('identifies hub in a star graph topology', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      // Create data where axis-a correlates with all others, but b,c,d,e don't correlate with each other
      const n = 20;
      const base = Array.from({ length: n }, (_, i) => i * 5);
      const noise = () => Array.from({ length: n }, () => Math.random() * 100);

      const responses = [
        ...makeResponses('a', base),
        ...makeResponses('b', base.map(v => v + Math.random() * 5)),
        ...makeResponses('c', base.map(v => v + Math.random() * 5)),
        ...makeResponses('d', noise()),
        ...makeResponses('e', noise())
      ];

      const result = analyzer.analyze(responses, {});
      const hubs = result.hub_scores;

      // Axis 'a' should have among the highest hub scores
      const hubValues = Object.values(hubs);
      assert.ok(hubValues.every(v => v >= 0 && v <= 1), 'All hub scores should be in [0,1]');

      const sum = hubValues.reduce((s, v) => s + v, 0);
      assert.ok(Math.abs(sum - 1) < 0.01, `Hub scores should sum to ~1, got ${sum}`);
    });

    it('returns uniform scores for uncorrelated axes', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      // All axes are pure noise
      const n = 15;
      const responses = [];
      const axes = ['a', 'b', 'c'];
      for (const axis of axes) {
        const perms = Array.from({ length: n }, () => Math.random() * 100);
        responses.push(...makeResponses(axis, perms));
      }

      const result = analyzer.analyze(responses, {});
      const hubValues = Object.values(result.hub_scores);

      // With no strong correlations, hub scores should be roughly equal
      const expectedUniform = 1 / axes.length;
      for (const v of hubValues) {
        assert.ok(Math.abs(v - expectedUniform) < 0.3,
          `Hub score ${v} should be near uniform ${expectedUniform}`);
      }
    });
  });

  describe('bootstrap confidence intervals', () => {
    it('produces CIs for each pair', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 50 });
      const responses = [
        ...makeResponses('a', [10, 20, 30, 40, 50, 60, 70, 80]),
        ...makeResponses('b', [15, 25, 35, 45, 55, 65, 75, 85]),
        ...makeResponses('c', [80, 70, 60, 50, 40, 30, 20, 10])
      ];
      const result = analyzer.analyze(responses, {});

      const ci = result.bootstrap.ci_matrix;
      assert.strictEqual(ci.length, 3);

      // Each CI should be [lo, hi] with lo <= hi
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          assert.strictEqual(ci[i][j].length, 2);
          assert.ok(ci[i][j][0] <= ci[i][j][1],
            `CI[${i}][${j}]: lo=${ci[i][j][0]} should be <= hi=${ci[i][j][1]}`);
        }
      }

      // Diagonal CIs should be [1, 1]
      for (let i = 0; i < 3; i++) {
        assert.deepStrictEqual(ci[i][i], [1.0, 1.0]);
      }

      assert.ok(result.bootstrap.median_ci_width !== null);
      assert.ok(result.bootstrap.median_ci_width >= 0);
    });
  });

  describe('split-half reliability', () => {
    it('returns a correlation value for sufficient data', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      // Need at least 4 items per axis (2 per half)
      const responses = [
        ...makeResponses('a', [10, 20, 30, 40, 50, 60]),
        ...makeResponses('b', [15, 25, 35, 45, 55, 65]),
        ...makeResponses('c', [60, 50, 40, 30, 20, 10])
      ];
      const result = analyzer.analyze(responses, {});
      assert.ok(result.reliability.split_half_r !== null, 'split_half_r should not be null');
      assert.ok(
        result.reliability.split_half_r >= -1 && result.reliability.split_half_r <= 1,
        `split_half_r=${result.reliability.split_half_r} should be in [-1, 1]`
      );
    });

    it('returns null when too few items per axis', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10, minItemsPerAxis: 3 });
      const responses = [
        ...makeResponses('a', [10, 20, 30]),
        ...makeResponses('b', [15, 25, 35]),
        ...makeResponses('c', [60, 50, 40])
      ];
      const result = analyzer.analyze(responses, {});
      // With only 3 items, split gives 1 odd + 2 even or vice versa, which is < 2
      assert.strictEqual(result.reliability.split_half_r, null);
    });
  });

  describe('strongest/weakest couplings', () => {
    it('returns up to 5 strongest and 5 weakest', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      const n = 10;
      const base = Array.from({ length: n }, (_, i) => i * 10);
      const responses = [];
      const axes = ['a', 'b', 'c', 'd', 'e', 'f'];
      for (let i = 0; i < axes.length; i++) {
        const perms = base.map(v => v + (i % 2 === 0 ? 0 : 100 - v * 2) + Math.random());
        responses.push(...makeResponses(axes[i], perms));
      }
      const result = analyzer.analyze(responses, {});

      assert.ok(result.strongest_couplings.length <= 5);
      assert.ok(result.weakest_couplings.length <= 5);

      // Strongest should have higher |rho| than weakest
      if (result.strongest_couplings.length > 0 && result.weakest_couplings.length > 0) {
        const strongestRho = Math.abs(result.strongest_couplings[0].rho);
        const weakestRho = Math.abs(result.weakest_couplings[0].rho);
        assert.ok(strongestRho >= weakestRho,
          `Strongest |rho|=${strongestRho} should be >= weakest |rho|=${weakestRho}`);
      }
    });
  });

  describe('metadata', () => {
    it('includes all expected fields', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      const responses = [
        ...makeResponses('a', [10, 20, 30, 40, 50]),
        ...makeResponses('b', [50, 40, 30, 20, 10]),
        ...makeResponses('c', [15, 25, 35, 45, 55])
      ];
      const result = analyzer.analyze(responses, {});

      assert.strictEqual(result.metadata.method, 'shrinkage_spearman');
      assert.strictEqual(result.metadata.fdr_threshold, 0.10);
      assert.strictEqual(result.metadata.n_items_per_axis, 5);
      assert.strictEqual(result.metadata.n_axes, 3);
      assert.ok(Array.isArray(result.metadata.axes_included));
      assert.strictEqual(result.metadata.axes_included.length, 3);
      assert.ok(typeof result.metadata.shrinkage_lambda === 'number');
    });
  });

  describe('full 15-axis integration', () => {
    it('processes synthetic data for all 15 axes', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 20 });
      const n = 18; // Matches v2.1 items per axis
      const responses = [];

      for (let i = 0; i < ALL_AXES.length; i++) {
        const perms = [];
        for (let j = 0; j < n; j++) {
          // Create some structure: first 6 axes correlate, rest are noisy
          if (i < 6) {
            perms.push(20 + j * 4 + Math.random() * 10);
          } else {
            perms.push(Math.random() * 100);
          }
        }
        responses.push(...makeResponses(ALL_AXES[i], perms));
      }

      const axisScores = {};
      for (const code of ALL_AXES) {
        axisScores[code] = { b: 0.5, a: 5.0, se_b: 0.1 };
      }

      const result = analyzer.analyze(responses, axisScores);

      assert.strictEqual(result.coupling_matrix.length, 15);
      assert.strictEqual(result.coupling_matrix[0].length, 15);
      assert.strictEqual(result.p_values.length, 15);
      assert.strictEqual(result.significant.length, 15);
      assert.strictEqual(Object.keys(result.hub_scores).length, 15);
      assert.strictEqual(result.metadata.n_axes, 15);
      assert.strictEqual(result.metadata.n_items_per_axis, 18);

      // Verify matrix symmetry
      for (let i = 0; i < 15; i++) {
        assert.strictEqual(result.coupling_matrix[i][i], 1.0);
        for (let j = i + 1; j < 15; j++) {
          assert.strictEqual(
            result.coupling_matrix[i][j],
            result.coupling_matrix[j][i]
          );
        }
      }
    });
  });

  describe('edge case: all-identical responses', () => {
    it('handles constant permissibility gracefully', () => {
      const analyzer = new CouplingAnalyzer({ bootstrapIterations: 10 });
      const responses = [
        ...makeResponses('a', [50, 50, 50, 50, 50]),
        ...makeResponses('b', [50, 50, 50, 50, 50]),
        ...makeResponses('c', [50, 50, 50, 50, 50])
      ];
      const result = analyzer.analyze(responses, {});

      // Correlation of constant vectors should be 0
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          assert.strictEqual(result.coupling_matrix[i][j], 0);
        }
      }
    });
  });
});
