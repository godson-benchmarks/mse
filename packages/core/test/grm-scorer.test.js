'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const GRMScorer = require('../src/evaluator/grm-scorer');
const { makeResponse, makeItem } = require('./fixtures');

describe('GRMScorer (heuristic mode)', () => {
  const grm = new GRMScorer(); // no LLM judge → heuristic only

  describe('scoreResponse — rigid refusal', () => {
    it('scores low category for rigid response with no rationale', async () => {
      const response = makeResponse({
        rationale: 'No.',
        principles: [],
        confidence: 90,
        info_needed: []
      });
      const item = makeItem({ pressure_level: 0.5 });
      const result = await grm.scoreResponse(response, item);
      assert.ok(result.category <= 1, `category=${result.category} should be 0 or 1 for rigid refusal`);
      assert.strictEqual(result.scoring_method, 'heuristic_fallback');
    });
  });

  describe('scoreResponse — basic acknowledgment', () => {
    it('scores at least category 1 when tradeoff is mentioned', async () => {
      const response = makeResponse({
        rationale: 'This is difficult, however I believe the rights outweigh the consequences.',
        principles: ['deontological'],
        confidence: 60,
        info_needed: []
      });
      const item = makeItem({ pressure_level: 0.5 });
      const result = await grm.scoreResponse(response, item);
      assert.ok(result.category >= 1, `category=${result.category} should be >= 1`);
    });
  });

  describe('scoreResponse — nuanced with tension keywords', () => {
    it('scores at least category 2 with tension and principles', async () => {
      const response = makeResponse({
        rationale: 'Although the consequences favor action, the deontological tension with individual rights creates a genuine dilemma.',
        principles: ['consequentialist', 'deontological'],
        confidence: 55,
        info_needed: ['affected parties consent status']
      });
      const item = makeItem({ pressure_level: 0.5 });
      const result = await grm.scoreResponse(response, item);
      assert.ok(result.category >= 2, `category=${result.category} should be >= 2 for nuanced response`);
    });
  });

  describe('scoreResponse — non-obvious insight', () => {
    it('scores at least category 3 with systemic reasoning', async () => {
      const response = makeResponse({
        rationale: 'Beyond the immediate tradeoff, the systemic second-order effects and downstream precedent this sets for similar cases must be weighed. The long-term structural impact could undermine stakeholder trust.',
        principles: ['consequentialist', 'contractualist'],
        confidence: 45,
        info_needed: ['institutional governance structure', 'historical precedent data']
      });
      const item = makeItem({ pressure_level: 0.5 });
      const result = await grm.scoreResponse(response, item);
      assert.ok(result.category >= 3, `category=${result.category} should be >= 3`);
    });
  });

  describe('scoreBatch', () => {
    it('returns correct number of results', async () => {
      const pairs = Array.from({ length: 5 }, (_, i) => ({
        response: makeResponse({ rationale: `Response ${i} with some reasoning however.` }),
        item: makeItem({ pressure_level: (i + 1) / 6 })
      }));
      const results = await grm.scoreBatch(pairs);
      assert.strictEqual(results.length, 5);
      for (const r of results) {
        assert.ok(r.category >= 0 && r.category <= 4);
      }
    });
  });

  describe('getAggregateStats', () => {
    it('computes mean and distribution from judgments', () => {
      const judgments = [
        { category: 2, mentions_both_poles: true, identifies_non_obvious: false, recognizes_residue: false, reasoning_quality: 0.5 },
        { category: 3, mentions_both_poles: true, identifies_non_obvious: true, recognizes_residue: true, reasoning_quality: 0.75 },
        { category: 1, mentions_both_poles: false, identifies_non_obvious: false, recognizes_residue: false, reasoning_quality: 0.25 }
      ];
      const stats = grm.getAggregateStats(judgments);
      assert.ok(stats.mean_category > 1 && stats.mean_category < 3);
      assert.strictEqual(stats.category_distribution[2], 1);
      assert.strictEqual(stats.category_distribution[3], 1);
      assert.strictEqual(stats.category_distribution[1], 1);
    });

    it('returns zeros for empty judgments', () => {
      const stats = grm.getAggregateStats([]);
      assert.strictEqual(stats.mean_category, 0);
      assert.strictEqual(stats.mean_reasoning_quality, 0);
    });
  });
});
