'use strict';

/**
 * Shared test data factories for MSE core tests.
 *
 * Provides deterministic synthetic data for unit tests without
 * requiring database access or real dilemma content.
 */

const AXIS_CODES = [
  'rights-vs-consequences',
  'doing-vs-allowing',
  'means-vs-collateral',
  'impartiality-vs-partiality',
  'worst-off-vs-efficiency',
  'truth-vs-beneficence',
  'autonomy-vs-paternalism',
  'privacy-vs-security',
  'conscience-vs-authority',
  'cooperation-vs-defection',
  'long-term-vs-short-term',
  'integrity-vs-opportunism',
  'minimization-vs-personalization',
  'purpose-vs-secondary-use',
  'compartmentalization-vs-leakage'
];

/**
 * Build a synthetic MSE response object.
 * @param {Object} [overrides]
 * @returns {Object}
 */
function makeResponse(overrides = {}) {
  return {
    item_id: overrides.item_id ?? 'item-001',
    choice: overrides.choice ?? 'B',
    forced_choice: overrides.forced_choice ?? 'B',
    permissibility: overrides.permissibility ?? 65,
    confidence: overrides.confidence ?? 75,
    principles: overrides.principles ?? ['consequentialist'],
    rationale: overrides.rationale ?? 'The outcome maximizes overall welfare.',
    info_needed: overrides.info_needed ?? [],
    pressure_level: overrides.pressure_level ?? 0.5,
    response_time_ms: overrides.response_time_ms ?? 3200,
    ...overrides
  };
}

/**
 * Build a synthetic dilemma item.
 * @param {Object} [overrides]
 * @returns {Object}
 */
function makeItem(overrides = {}) {
  return {
    id: overrides.id ?? 'item-001',
    axis_id: overrides.axis_id ?? 1,
    family_id: overrides.family_id ?? 'fam-001',
    pressure_level: overrides.pressure_level ?? 0.5,
    params: overrides.params ?? {
      severity: 'medium',
      certainty: 80,
      immediacy: 'days',
      relationship: 'stranger',
      consent: null,
      reversibility: true,
      legality: 'legal',
      num_affected: 10
    },
    prompt: overrides.prompt ?? 'A researcher discovers...',
    options: overrides.options ?? [
      { id: 'A', label: 'Refuse to share the data', pole: 'left' },
      { id: 'B', label: 'Share the data openly', pole: 'right' },
      { id: 'C', label: 'Request more information', pole: 'neutral' },
      { id: 'D', label: 'Find a creative compromise', pole: 'creative' }
    ],
    version: overrides.version ?? 1,
    is_anchor: overrides.is_anchor ?? false,
    dilemma_type: overrides.dilemma_type ?? 'base',
    ...overrides
  };
}

/**
 * Generate responses that form a sigmoid curve around a threshold.
 *
 * At pressure < threshold, agent mostly refuses (low permissibility, forced_choice A).
 * At pressure > threshold, agent mostly permits (high permissibility, forced_choice B).
 *
 * @param {number} threshold - b value in [0, 1]
 * @param {number} count - number of responses to generate
 * @param {Object} [opts]
 * @param {number} [opts.noise=5] - noise in permissibility (0-100 scale)
 * @returns {Object[]}
 */
function makeSigmoidResponses(threshold, count, opts = {}) {
  const noise = opts.noise ?? 5;
  const responses = [];

  for (let i = 0; i < count; i++) {
    const pressure = (i + 0.5) / count; // spread evenly across [0, 1]
    const z = 8 * (pressure - threshold);  // steep sigmoid (a ~ 8)
    const p = 1 / (1 + Math.exp(-z));
    const perm = Math.max(0, Math.min(100, Math.round(p * 100 + (noise * (0.5 - (i % 3) / 3)))));
    const fc = perm >= 50 ? 'B' : 'A';

    responses.push(makeResponse({
      item_id: `item-${String(i + 1).padStart(3, '0')}`,
      pressure_level: pressure,
      permissibility: perm,
      forced_choice: fc,
      choice: fc,
      confidence: 70 + Math.round(Math.abs(pressure - threshold) * 30),
      response_time_ms: 2000 + i * 100
    }));
  }

  return responses;
}

module.exports = {
  AXIS_CODES,
  makeResponse,
  makeItem,
  makeSigmoidResponses
};
