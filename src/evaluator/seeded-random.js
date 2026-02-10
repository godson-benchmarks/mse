/**
 * Seeded PRNG — Mulberry32
 *
 * Deterministic pseudo-random number generator for reproducible evaluations.
 * Without a seeded PRNG, the adaptive item selector's explore/exploit decisions
 * use Math.random(), making identical evaluations produce different item sequences.
 * This is unacceptable for a scientific instrument — peer reviewers expect reproducibility.
 *
 * Algorithm: Mulberry32 — a simple, well-studied 32-bit PRNG.
 * The random numbers here only drive a binary decision (explore vs exploit at ~20%
 * probability), so 32-bit precision is more than sufficient.
 *
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 *
 * @module seeded-random
 */

/**
 * Create a seeded PRNG function using the Mulberry32 algorithm.
 *
 * @param {number|string} seed - Integer seed or string (hashed to integer).
 *   If not provided or falsy, returns Math.random (non-deterministic fallback).
 * @returns {Function} A function that returns a pseudo-random float in [0, 1)
 *   each time it is called. Successive calls advance the internal state deterministically.
 */
function createSeededRNG(seed) {
  if (seed == null) {
    return Math.random;
  }

  let state = typeof seed === 'string' ? hashString(seed) : seed;

  // Ensure state is a 32-bit integer
  state |= 0;

  return function mulberry32() {
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string to a 32-bit integer using a simple DJB2-like hash.
 *
 * @param {string} str
 * @returns {number} 32-bit integer
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

module.exports = { createSeededRNG, hashString };
