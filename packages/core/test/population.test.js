'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PopulationAnalyzer } = require('../src/analyzer/population');

const AXES = ['axis-a', 'axis-b', 'axis-c'];

// Helper: create agent profiles with b-values
function makeProfiles(n, axisCodes, generator) {
  const profiles = [];
  for (let i = 0; i < n; i++) {
    const axes = {};
    for (const code of axisCodes) {
      axes[code] = { b: generator(i, code), a: 5.0, se_b: 0.1 };
    }
    profiles.push({ agent_id: `agent-${i}`, axes });
  }
  return profiles;
}

describe('PopulationAnalyzer', () => {
  describe('analyzeCoupling', () => {
    it('returns default for insufficient agents', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 5 });
      const profiles = makeProfiles(2, AXES, () => Math.random());
      const result = analyzer.analyzeCoupling(profiles);

      assert.deepStrictEqual(result.coupling_matrix, []);
      assert.ok(result.metadata.warnings.length > 0);
    });

    it('produces symmetric matrix for sufficient agents', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 3 });
      const profiles = makeProfiles(15, AXES, (i) => (i + Math.random()) / 15);
      const result = analyzer.analyzeCoupling(profiles);

      const m = result.coupling_matrix;
      const n = result.axis_codes.length;
      assert.ok(n >= 2);

      for (let i = 0; i < n; i++) {
        assert.strictEqual(m[i][i], 1.0);
        for (let j = i + 1; j < n; j++) {
          assert.strictEqual(m[i][j], m[j][i]);
        }
      }
    });

    it('detects population coupling between co-varying axes', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 3 });
      // axis-a and axis-b increase together
      const profiles = makeProfiles(20, AXES, (i, code) => {
        if (code === 'axis-a') return i / 20;
        if (code === 'axis-b') return i / 20 + Math.random() * 0.03;
        return Math.random();
      });
      const result = analyzer.analyzeCoupling(profiles);

      const idxA = result.axis_codes.indexOf('axis-a');
      const idxB = result.axis_codes.indexOf('axis-b');
      assert.ok(result.coupling_matrix[idxA][idxB] > 0.5,
        `Population coupling should be positive: ${result.coupling_matrix[idxA][idxB]}`);
    });

    it('returns top couplings sorted by absolute rho', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 3 });
      const profiles = makeProfiles(20, AXES, (i) => (i + Math.random()) / 20);
      const result = analyzer.analyzeCoupling(profiles);

      if (result.top_couplings.length > 1) {
        for (let i = 0; i < result.top_couplings.length - 1; i++) {
          assert.ok(
            Math.abs(result.top_couplings[i].rho) >= Math.abs(result.top_couplings[i + 1].rho),
            'Top couplings should be sorted by |rho| descending'
          );
        }
      }
    });
  });

  describe('analyzeGeometry', () => {
    it('delegates to ProfileGeometryAnalyzer', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsCoupling: 5 });
      const profiles = makeProfiles(12, AXES, () => Math.random());
      const result = analyzer.analyzeGeometry(profiles);

      assert.ok(result !== null);
      assert.ok(result.per_axis);
      assert.ok(result.correlation_matrix);
    });

    it('returns null for insufficient agents', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsCoupling: 20 });
      const profiles = makeProfiles(5, AXES, () => Math.random());
      const result = analyzer.analyzeGeometry(profiles);

      assert.strictEqual(result, null);
    });
  });

  describe('getPopulationSummary', () => {
    it('reports insufficient power below minimum', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 5 });
      const profiles = makeProfiles(2, AXES, () => Math.random());
      const summary = analyzer.getPopulationSummary(profiles);

      assert.strictEqual(summary.power_assessment, 'insufficient');
      assert.strictEqual(summary.recommended_analyses.length, 0);
    });

    it('reports basic power for small samples', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 3, minAgentsCoupling: 10 });
      const profiles = makeProfiles(5, AXES, () => Math.random());
      const summary = analyzer.getPopulationSummary(profiles);

      assert.strictEqual(summary.power_assessment, 'basic');
      assert.ok(summary.recommended_analyses.includes('descriptive_statistics'));
      assert.ok(!summary.recommended_analyses.includes('population_coupling'));
    });

    it('reports coupling_with_warnings for moderate samples', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 3, minAgentsCoupling: 10, minAgentsFull: 50 });
      const profiles = makeProfiles(20, AXES, () => Math.random());
      const summary = analyzer.getPopulationSummary(profiles);

      assert.strictEqual(summary.power_assessment, 'coupling_with_warnings');
      assert.ok(summary.recommended_analyses.includes('population_coupling'));
    });

    it('reports pca_ready for large samples', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsPCA: 75 });
      const profiles = makeProfiles(80, AXES, () => Math.random());
      const summary = analyzer.getPopulationSummary(profiles);

      assert.strictEqual(summary.power_assessment, 'pca_ready');
      assert.ok(summary.recommended_analyses.includes('pca'));
    });

    it('includes descriptive statistics', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 3 });
      const profiles = makeProfiles(10, AXES, () => Math.random());
      const summary = analyzer.getPopulationSummary(profiles);

      assert.ok(summary.descriptive !== null);
      for (const code of AXES) {
        assert.ok(summary.descriptive[code]);
        assert.ok(typeof summary.descriptive[code].mean === 'number');
        assert.ok(typeof summary.descriptive[code].std === 'number');
        assert.ok(typeof summary.descriptive[code].min === 'number');
        assert.ok(typeof summary.descriptive[code].max === 'number');
      }
    });

    it('includes power thresholds in response', () => {
      const analyzer = new PopulationAnalyzer();
      const profiles = makeProfiles(5, AXES, () => Math.random());
      const summary = analyzer.getPopulationSummary(profiles);

      assert.ok(summary.thresholds);
      assert.strictEqual(summary.thresholds.basic, 3);
      assert.strictEqual(summary.thresholds.coupling, 10);
      assert.strictEqual(summary.thresholds.full, 50);
      assert.strictEqual(summary.thresholds.pca, 75);
    });
  });

  describe('edge cases', () => {
    it('handles profiles with missing axes', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 3 });
      const profiles = [
        { agent_id: '1', axes: { 'axis-a': { b: 0.5 }, 'axis-b': { b: 0.6 } } },
        { agent_id: '2', axes: { 'axis-a': { b: 0.3 } } },
        { agent_id: '3', axes: { 'axis-a': { b: 0.7 }, 'axis-b': { b: 0.4 }, 'axis-c': { b: 0.5 } } },
        { agent_id: '4', axes: { 'axis-a': { b: 0.2 }, 'axis-b': { b: 0.8 } } }
      ];
      const result = analyzer.analyzeCoupling(profiles);

      // Should not throw
      assert.ok(result);
      assert.ok(result.axis_codes.includes('axis-a'));
    });

    it('handles profiles with no axes', () => {
      const analyzer = new PopulationAnalyzer({ minAgentsBasic: 2 });
      const profiles = [
        { agent_id: '1', axes: {} },
        { agent_id: '2', axes: {} }
      ];
      const result = analyzer.analyzeCoupling(profiles);

      assert.deepStrictEqual(result.coupling_matrix, []);
    });
  });
});
