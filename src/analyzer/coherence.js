/**
 * MSE v2.0 - Coherence Analyzer
 *
 * Uses PCA-inspired analysis on b-values to determine:
 * - How internally consistent an agent's ethical positions are
 * - What dominant ethical orientation they follow
 * - How much variance is explained by a single framework
 */

class CoherenceAnalyzer {
  constructor(options = {}) {
    // Mapping of axes to ethical traditions (theoretical groupings)
    // Each axis maps to which tradition its LEFT pole aligns with
    this.axisOrientations = options.axisOrientations || {
      'rights-vs-consequences': { left: 'deontological', right: 'consequentialist' },
      'doing-vs-allowing': { left: 'deontological', right: 'consequentialist' },
      'means-vs-collateral': { left: 'deontological', right: 'consequentialist' },
      'impartiality-vs-partiality': { left: 'contractualist', right: 'care' },
      'worst-off-vs-efficiency': { left: 'care', right: 'consequentialist' },
      'truth-vs-beneficence': { left: 'deontological', right: 'care' },
      'autonomy-vs-paternalism': { left: 'contractualist', right: 'care' },
      'privacy-vs-security': { left: 'deontological', right: 'consequentialist' },
      'conscience-vs-authority': { left: 'virtue', right: 'contractualist' },
      'cooperation-vs-defection': { left: 'care', right: 'pragmatic' },
      'long-term-vs-short-term': { left: 'consequentialist', right: 'pragmatic' },
      'integrity-vs-opportunism': { left: 'virtue', right: 'pragmatic' },
      'minimization-vs-personalization': { left: 'deontological', right: 'consequentialist' },
      'purpose-vs-secondary-use': { left: 'deontological', right: 'pragmatic' },
      'compartmentalization-vs-leakage': { left: 'deontological', right: 'pragmatic' }
    };
  }

  /**
   * Analyze coherence from axis scores
   * @param {Object} axisScores - {axis_code: {b, a, se_b, ...}}
   * @returns {import('../../types').CoherenceResult}
   */
  analyze(axisScores) {
    const axisCodes = Object.keys(axisScores || {});
    if (axisCodes.length < 3) {
      return {
        coherence_score: 0.5,
        dominant_orientation: 'undetermined',
        variance_explained: 0,
        orientation_vector: {}
      };
    }

    // Extract b-values as vector
    const bValues = axisCodes.map(code => axisScores[code].b);

    // 1. Compute coherence via PCA-like analysis
    const coherenceScore = this._computeCoherence(bValues);

    // 2. Determine dominant orientation
    const orientationVector = this._computeOrientationVector(axisScores);
    const dominantOrientation = this._findDominantOrientation(orientationVector);

    // 3. Variance explained by dominant orientation
    const varianceExplained = this._computeVarianceExplained(bValues);

    return {
      coherence_score: round3(coherenceScore),
      dominant_orientation: dominantOrientation,
      variance_explained: round3(varianceExplained),
      orientation_vector: roundObject(orientationVector)
    };
  }

  /**
   * Compute coherence score using eigenvalue analysis
   * High coherence = positions form a consistent ethical framework
   * Low coherence = positions seem random or ad-hoc
   */
  _computeCoherence(bValues) {
    if (bValues.length < 3) return 0.5;

    const n = bValues.length;
    const mean = bValues.reduce((a, b) => a + b, 0) / n;

    // Center the data
    const centered = bValues.map(b => b - mean);

    // Compute variance
    const totalVariance = centered.reduce((sum, v) => sum + v * v, 0) / n;
    if (totalVariance < 0.001) return 1.0; // All values nearly identical

    // Compute covariance matrix for 1D (this is just variance)
    // For multi-dimensional coherence, we project onto theoretical axes

    // Group axes by their theoretical pairs (left=deontological etc.)
    // If most b-values cluster together, coherence is high
    const sorted = [...bValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    // IQR relative to range: small IQR = tight cluster = coherent
    const range = sorted[sorted.length - 1] - sorted[0];
    if (range < 0.001) return 1.0;

    const normalizedIQR = iqr / range;

    // Coherence is inverse of normalized spread
    // Low spread = high coherence
    return clamp(1 - normalizedIQR, 0, 1);
  }

  /**
   * Compute orientation vector: how strongly positions align with each tradition
   */
  _computeOrientationVector(axisScores) {
    const traditions = {};
    const traditionCounts = {};

    for (const [code, score] of Object.entries(axisScores)) {
      const mapping = this.axisOrientations[code];
      if (!mapping) continue;

      const b = score.b;

      // b < 0.5 → leans toward left pole, b > 0.5 → leans toward right pole
      const leftWeight = 1 - b;  // How much agent favors left pole
      const rightWeight = b;      // How much agent favors right pole

      // Accumulate weights for each tradition
      const leftTradition = mapping.left;
      const rightTradition = mapping.right;

      traditions[leftTradition] = (traditions[leftTradition] || 0) + leftWeight;
      traditions[rightTradition] = (traditions[rightTradition] || 0) + rightWeight;

      traditionCounts[leftTradition] = (traditionCounts[leftTradition] || 0) + 1;
      traditionCounts[rightTradition] = (traditionCounts[rightTradition] || 0) + 1;
    }

    // Normalize by count to get average weight per tradition
    const normalized = {};
    let total = 0;

    for (const [tradition, weight] of Object.entries(traditions)) {
      normalized[tradition] = weight / (traditionCounts[tradition] || 1);
      total += normalized[tradition];
    }

    // Normalize to sum to 1
    if (total > 0) {
      for (const tradition of Object.keys(normalized)) {
        normalized[tradition] = normalized[tradition] / total;
      }
    }

    return normalized;
  }

  /**
   * Find the dominant ethical orientation from the vector
   */
  _findDominantOrientation(orientationVector) {
    let maxWeight = 0;
    let dominant = 'mixed';

    for (const [tradition, weight] of Object.entries(orientationVector)) {
      if (weight > maxWeight) {
        maxWeight = weight;
        dominant = tradition;
      }
    }

    // Only label as dominant if significantly above average
    const numTraditions = Object.keys(orientationVector).length;
    if (numTraditions > 0 && maxWeight < 1.3 / numTraditions) {
      return 'mixed';
    }

    return dominant;
  }

  /**
   * Compute variance explained by the first principal component
   * Uses power iteration for dominant eigenvalue
   */
  _computeVarianceExplained(bValues) {
    if (bValues.length < 3) return 0;

    const n = bValues.length;
    const mean = bValues.reduce((a, b) => a + b, 0) / n;
    const centered = bValues.map(b => b - mean);

    const totalVariance = centered.reduce((sum, v) => sum + v * v, 0) / n;
    if (totalVariance < 0.001) return 1.0;

    // For 1D data, the first PC explains all variance
    // For our multi-dimensional ethical space, we approximate by
    // checking how much variance is along the dominant axis

    // Group b-values by high/low pattern
    // If there's a clear bimodal pattern, variance_explained is high
    const above = centered.filter(v => v > 0);
    const below = centered.filter(v => v <= 0);

    if (above.length === 0 || below.length === 0) return 0.8;

    const aboveMean = above.reduce((a, b) => a + b, 0) / above.length;
    const belowMean = below.reduce((a, b) => a + b, 0) / below.length;

    // Between-group variance
    const betweenVariance = (
      above.length * aboveMean * aboveMean +
      below.length * belowMean * belowMean
    ) / n;

    return clamp(betweenVariance / totalVariance, 0, 1);
  }
}

// --- Utility Functions ---

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function roundObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = round3(value);
  }
  return result;
}

module.exports = CoherenceAnalyzer;
