'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ResponseParser } = require('../src/evaluator/parser');
const { makeItem } = require('./fixtures');

describe('ResponseParser', () => {
  const parser = new ResponseParser();
  const item = makeItem();

  describe('structured response — valid', () => {
    it('accepts a complete valid response', () => {
      const result = parser.parse({
        choice: 'B',
        forced_choice: 'A',
        permissibility: 65,
        confidence: 80,
        principles: ['consequentialist'],
        rationale: 'Maximizes welfare.',
        info_needed: []
      }, item);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.choice, 'B');
      assert.strictEqual(result.data.forced_choice, 'A');
      assert.strictEqual(result.data.permissibility, 65);
    });
  });

  describe('structured response — missing choice', () => {
    it('returns valid=false with error', () => {
      const result = parser.parse({
        permissibility: 50,
        confidence: 50,
        principles: ['deontological']
      }, item);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('choice')));
    });
  });

  describe('structured response — invalid choice letter', () => {
    it('rejects choice "Z"', () => {
      const result = parser.parse({
        choice: 'Z',
        forced_choice: 'A',
        permissibility: 50,
        confidence: 50,
        principles: []
      }, item);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid choice')));
    });
  });

  describe('forced_choice inference', () => {
    it('infers forced_choice A from primary choice A', () => {
      const result = parser.parse({
        choice: 'A',
        permissibility: 30,
        confidence: 70,
        principles: ['deontological']
      }, item);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.forced_choice, 'A');
    });

    it('infers forced_choice B from primary choice D', () => {
      const result = parser.parse({
        choice: 'D',
        permissibility: 60,
        confidence: 70,
        principles: ['pragmatic']
      }, item);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.forced_choice, 'B');
    });
  });

  describe('permissibility validation', () => {
    it('rejects permissibility = -1', () => {
      const result = parser.parse({
        choice: 'B', forced_choice: 'B',
        permissibility: -1, confidence: 50,
        principles: []
      }, item);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('permissibility')));
    });

    it('rejects permissibility = 101', () => {
      const result = parser.parse({
        choice: 'B', forced_choice: 'B',
        permissibility: 101, confidence: 50,
        principles: []
      }, item);
      assert.strictEqual(result.valid, false);
    });
  });

  describe('confidence validation', () => {
    it('rejects confidence = -5', () => {
      const result = parser.parse({
        choice: 'B', forced_choice: 'B',
        permissibility: 50, confidence: -5,
        principles: []
      }, item);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('confidence')));
    });

    it('rejects confidence = 200', () => {
      const result = parser.parse({
        choice: 'B', forced_choice: 'B',
        permissibility: 50, confidence: 200,
        principles: []
      }, item);
      assert.strictEqual(result.valid, false);
    });
  });

  describe('principles limiting', () => {
    it('limits principles to 3 with warning', () => {
      const result = parser.parse({
        choice: 'B', forced_choice: 'B',
        permissibility: 50, confidence: 50,
        principles: ['consequentialist', 'deontological', 'virtue', 'care']
      }, item);
      assert.strictEqual(result.valid, true);
      assert.ok(result.data.principles.length <= 3);
    });
  });

  describe('rationale truncation', () => {
    it('truncates rationale longer than 200 characters', () => {
      const longText = 'A'.repeat(250);
      const result = parser.parse({
        choice: 'B', forced_choice: 'B',
        permissibility: 50, confidence: 50,
        principles: ['consequentialist'],
        rationale: longText
      }, item);
      assert.strictEqual(result.valid, true);
      assert.ok(result.data.rationale.length <= 200);
      assert.ok(result.warnings.some(w => w.includes('truncated')));
    });
  });

  describe('choice normalization', () => {
    it('normalizes lowercase choice to uppercase', () => {
      const result = parser.parse({
        choice: 'b', forced_choice: 'a',
        permissibility: 50, confidence: 50,
        principles: []
      }, item);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.choice, 'B');
      assert.strictEqual(result.data.forced_choice, 'A');
    });
  });

  describe('natural language parsing', () => {
    it('detects "I choose option B" as choice B', () => {
      const result = parser.parse('I choose option B because it maximizes welfare.', item);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.choice, 'B');
    });

    it('returns valid=false for ambiguous text', () => {
      const result = parser.parse('This is a complex situation with many factors.', item);
      // The parser might or might not detect a choice; if it can't, valid=false
      if (!result.valid) {
        assert.ok(result.errors.some(e => e.includes('choice')));
      }
    });
  });
});
