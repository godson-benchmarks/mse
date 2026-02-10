'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const GamingDetector = require('../src/evaluator/gaming-detection');
const { makeResponse, makeItem } = require('./fixtures');

describe('GamingDetector', () => {
  const detector = new GamingDetector();

  describe('empty / few responses', () => {
    it('returns all zeros for empty array', () => {
      const result = detector.analyze([]);
      assert.strictEqual(result.g_score, 0);
      assert.strictEqual(result.response_time_uniformity, 0);
      assert.strictEqual(result.rationale_diversity, 0);
      assert.strictEqual(result.pattern_regularity, 0);
      assert.strictEqual(result.flagged, false);
    });

    it('returns all zeros for 2 responses', () => {
      const responses = [makeResponse(), makeResponse()];
      const result = detector.analyze(responses);
      assert.strictEqual(result.g_score, 0);
      assert.strictEqual(result.flagged, false);
    });
  });

  describe('suspicious responses (gaming pattern)', () => {
    it('flags uniform times + identical rationales + regular pattern', () => {
      const responses = Array.from({ length: 10 }, (_, i) => makeResponse({
        item_id: `item-${i}`,
        response_time_ms: 1000,             // perfectly uniform
        rationale: 'I choose this option.',  // identical
        permissibility: 50,                  // constant (perfect autocorrelation)
        pressure_level: i / 10
      }));
      const items = responses.map((r, i) => makeItem({
        id: r.item_id,
        axis_id: 1,
        pressure_level: i / 10
      }));
      const result = detector.analyze(responses, [], items);
      assert.ok(result.response_time_uniformity > 0.5,
        `time_uniformity=${result.response_time_uniformity} should be high`);
      assert.ok(result.rationale_diversity > 0.3,
        `rationale_diversity=${result.rationale_diversity} should indicate low diversity`);
    });
  });

  describe('genuine responses (not gaming)', () => {
    it('produces low g_score for diverse genuine responses', () => {
      const rationales = [
        'The rights of the individual must be protected however the community also suffers.',
        'Maximizing total welfare seems best although there are concerns about fairness here.',
        'I believe the virtuous action requires courage in the face of social pressure.',
        'The contractual obligations create a binding duty, despite practical challenges.',
        'Care ethics suggests attending to the relationship dynamics and dependencies.',
        'A pragmatic approach considers feasibility while maintaining ethical standards.'
      ];
      const responses = rationales.map((rat, i) => makeResponse({
        item_id: `item-${i}`,
        response_time_ms: 2000 + Math.floor(i * 700 + (i % 3) * 1200),
        rationale: rat,
        permissibility: 20 + i * 12,
        pressure_level: (i + 1) / 7
      }));
      const items = responses.map((r, i) => makeItem({
        id: r.item_id,
        axis_id: 1,
        pressure_level: (i + 1) / 7
      }));
      const result = detector.analyze(responses, [], items);
      assert.ok(result.g_score < 0.6,
        `g_score=${result.g_score} should be < 0.6 for genuine responses`);
      assert.strictEqual(result.flagged, false);
    });
  });

  describe('individual signal directions', () => {
    it('response_time_uniformity is high for perfectly uniform times', () => {
      const responses = Array.from({ length: 6 }, (_, i) => makeResponse({
        item_id: `item-${i}`,
        response_time_ms: 1500 // no variance
      }));
      const result = detector.analyze(responses);
      assert.ok(result.response_time_uniformity > 0.5);
    });

    it('response_time_uniformity is low for highly variable times', () => {
      const times = [500, 3000, 800, 5000, 1200, 7000];
      const responses = times.map((t, i) => makeResponse({
        item_id: `item-${i}`,
        response_time_ms: t
      }));
      const result = detector.analyze(responses);
      assert.ok(result.response_time_uniformity < 0.3,
        `time_uniformity=${result.response_time_uniformity} should be low for variable times`);
    });

    it('g_score is always in [0, 1]', () => {
      const responses = Array.from({ length: 10 }, (_, i) => makeResponse({
        item_id: `item-${i}`,
        response_time_ms: 1000 + i * 10,
        permissibility: 50
      }));
      const result = detector.analyze(responses);
      assert.ok(result.g_score >= 0 && result.g_score <= 1);
    });
  });

  describe('flagged threshold', () => {
    it('flagged matches g_score > 0.6 threshold', () => {
      const responses = Array.from({ length: 10 }, (_, i) => makeResponse({
        item_id: `item-${i}`,
        permissibility: 50,
        response_time_ms: 1000,
        rationale: 'Same rationale.'
      }));
      const result = detector.analyze(responses);
      assert.strictEqual(result.flagged, result.g_score > 0.6);
    });
  });
});
