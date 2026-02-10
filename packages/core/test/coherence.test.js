'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const CoherenceAnalyzer = require('../src/analyzer/coherence');

describe('CoherenceAnalyzer', () => {
  const analyzer = new CoherenceAnalyzer();

  describe('fewer than 3 axes', () => {
    it('returns default result', () => {
      const result = analyzer.analyze({
        'rights-vs-consequences': { b: 0.4 },
        'doing-vs-allowing': { b: 0.5 }
      });
      assert.strictEqual(result.coherence_score, 0.5);
      assert.strictEqual(result.dominant_orientation, 'undetermined');
      assert.strictEqual(result.variance_explained, 0);
    });

    it('returns default for null input', () => {
      const result = analyzer.analyze(null);
      assert.strictEqual(result.coherence_score, 0.5);
    });
  });

  describe('identical b-values → high coherence', () => {
    it('produces coherence_score close to 1', () => {
      const scores = {};
      const axes = [
        'rights-vs-consequences', 'doing-vs-allowing', 'means-vs-collateral',
        'impartiality-vs-partiality', 'worst-off-vs-efficiency'
      ];
      for (const axis of axes) {
        scores[axis] = { b: 0.5 };
      }
      const result = analyzer.analyze(scores);
      assert.ok(result.coherence_score >= 0.9,
        `coherence=${result.coherence_score} should be >= 0.9 for identical b-values`);
    });
  });

  describe('spread b-values → lower coherence', () => {
    it('produces lower coherence than identical values', () => {
      const identicalScores = {};
      const spreadScores = {};
      const axes = [
        'rights-vs-consequences', 'doing-vs-allowing', 'means-vs-collateral',
        'impartiality-vs-partiality', 'worst-off-vs-efficiency',
        'truth-vs-beneficence', 'autonomy-vs-paternalism'
      ];
      for (let i = 0; i < axes.length; i++) {
        identicalScores[axes[i]] = { b: 0.5 };
        spreadScores[axes[i]] = { b: 0.1 + (i / (axes.length - 1)) * 0.8 };
      }
      const identical = analyzer.analyze(identicalScores);
      const spread = analyzer.analyze(spreadScores);
      assert.ok(identical.coherence_score > spread.coherence_score,
        `identical(${identical.coherence_score}) should be > spread(${spread.coherence_score})`);
    });
  });

  describe('orientation_vector', () => {
    it('returns an object with ethical tradition keys', () => {
      const scores = {
        'rights-vs-consequences': { b: 0.3 },
        'doing-vs-allowing': { b: 0.3 },
        'means-vs-collateral': { b: 0.3 },
        'impartiality-vs-partiality': { b: 0.3 }
      };
      const result = analyzer.analyze(scores);
      assert.ok(typeof result.orientation_vector === 'object');
      assert.ok(Object.keys(result.orientation_vector).length > 0);
    });

    it('values sum to approximately 1', () => {
      const scores = {
        'rights-vs-consequences': { b: 0.3 },
        'doing-vs-allowing': { b: 0.4 },
        'means-vs-collateral': { b: 0.2 },
        'truth-vs-beneficence': { b: 0.35 }
      };
      const result = analyzer.analyze(scores);
      const sum = Object.values(result.orientation_vector).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 0.05,
        `orientation_vector sum=${sum} should be approximately 1`);
    });
  });

  describe('dominant orientation for deontological profile', () => {
    it('identifies deontological for low b-values on deontic axes', () => {
      // Low b = leans left pole; for most axes, left = deontological
      const scores = {
        'rights-vs-consequences': { b: 0.15 },
        'doing-vs-allowing': { b: 0.15 },
        'means-vs-collateral': { b: 0.15 },
        'truth-vs-beneficence': { b: 0.15 },
        'privacy-vs-security': { b: 0.15 },
        'minimization-vs-personalization': { b: 0.15 },
        'purpose-vs-secondary-use': { b: 0.15 },
        'compartmentalization-vs-leakage': { b: 0.15 }
      };
      const result = analyzer.analyze(scores);
      assert.strictEqual(result.dominant_orientation, 'deontological');
    });
  });
});
