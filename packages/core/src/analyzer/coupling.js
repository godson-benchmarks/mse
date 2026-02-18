/**
 * MSE v3.0 - Coupling Analyzer
 *
 * Computes inter-axis structural analysis:
 * - 15x15 shrinkage-Spearman correlation matrix between moral axes
 * - Benjamini-Hochberg FDR correction for multiple comparisons
 * - Hub scores via eigenvector centrality (power iteration)
 * - Bootstrap confidence intervals for all pairwise correlations
 * - Split-half reliability estimate
 *
 * This module treats the 15 MSE axes as a network. Coupling between axes
 * reveals structural dependencies in moral reasoning: e.g., an agent whose
 * privacy threshold co-varies with its autonomy threshold has a coupled
 * privacy-autonomy structure. High hub scores indicate axes that are
 * central to the agent's moral framework.
 *
 * Reference: VAT framework (arXiv:2602.12134) for the concept of
 * inter-axis moral coupling and alignment tax.
 */

'use strict';

class CouplingAnalyzer {
  /**
   * @param {Object} options
   * @param {number} options.bootstrapIterations - Number of bootstrap resamples (default: 1000)
   * @param {number} options.fdrThreshold - Benjamini-Hochberg q threshold (default: 0.10)
   * @param {number} options.minItemsPerAxis - Minimum responses per axis to include (default: 3)
   * @param {number} options.maxEigenIterations - Max power iteration steps (default: 100)
   * @param {number} options.eigenTolerance - Convergence tolerance for eigenvector (default: 1e-8)
   */
  constructor(options = {}) {
    this.bootstrapIterations = options.bootstrapIterations || 1000;
    this.fdrThreshold = options.fdrThreshold || 0.10;
    this.minItemsPerAxis = options.minItemsPerAxis || 3;
    this.maxEigenIterations = options.maxEigenIterations || 100;
    this.eigenTolerance = options.eigenTolerance || 1e-8;
  }

  /**
   * Main entry point: compute full coupling analysis from evaluation responses.
   *
   * @param {Array} responses - All responses from an evaluation run.
   *   Each response must have: axis_id, axis_code, permissibility (0-100).
   * @param {Object} axisScores - Axis scores keyed by axis_code: {b, a, se_b, n_items}
   * @returns {Object} CouplingResult
   */
  analyze(responses, axisScores) {
    // Group responses by axis_code
    const responsesByAxis = this._groupByAxis(responses);

    // Filter to axes with sufficient data
    const axisCodes = Object.keys(responsesByAxis).filter(
      code => responsesByAxis[code].length >= this.minItemsPerAxis
    );

    if (axisCodes.length < 3) {
      return this._defaultResult(axisCodes);
    }

    // Sort axis codes for deterministic matrix ordering
    axisCodes.sort();

    // Extract permissibility vectors per axis
    const vectors = {};
    for (const code of axisCodes) {
      vectors[code] = responsesByAxis[code].map(r => r.permissibility);
    }

    // Find the minimum vector length (items may differ per axis)
    const minLen = Math.min(...axisCodes.map(c => vectors[c].length));
    // Truncate to equal lengths for pairwise correlation
    for (const code of axisCodes) {
      vectors[code] = vectors[code].slice(0, minLen);
    }

    const n = axisCodes.length;

    // Compute raw Spearman correlation matrix
    const rawMatrix = this._computeCorrelationMatrix(axisCodes, vectors);

    // Apply shrinkage
    const shrinkageLambda = this._computeShrinkageLambda(minLen);
    const shrunkMatrix = this._applyShrinkage(rawMatrix, n, shrinkageLambda);

    // Compute p-values for all pairs
    const pValues = this._computePValueMatrix(rawMatrix, n, minLen);

    // Apply Benjamini-Hochberg FDR
    const significant = this._applyBH(pValues, n);

    // Compute hub scores via eigenvector centrality on |coupling_matrix|
    const hubScores = this._computeHubScores(shrunkMatrix, n, axisCodes);

    // Bootstrap confidence intervals
    const bootstrap = this._bootstrap(responsesByAxis, axisCodes, minLen);

    // Split-half reliability
    const reliability = this._splitHalfReliability(responsesByAxis, axisCodes);

    // Extract strongest and weakest couplings
    const { strongest, weakest } = this._extractExtremes(
      shrunkMatrix, pValues, significant, axisCodes, bootstrap.ci_matrix
    );

    return {
      coupling_matrix: shrunkMatrix,
      p_values: pValues,
      significant,
      hub_scores: hubScores,
      strongest_couplings: strongest,
      weakest_couplings: weakest,
      bootstrap: {
        ci_matrix: bootstrap.ci_matrix,
        median_ci_width: bootstrap.median_ci_width,
        n_iterations: this.bootstrapIterations
      },
      reliability: {
        split_half_r: reliability
      },
      metadata: {
        method: 'shrinkage_spearman',
        shrinkage_lambda: round4(shrinkageLambda),
        fdr_threshold: this.fdrThreshold,
        n_items_per_axis: minLen,
        n_axes: n,
        axes_included: axisCodes
      }
    };
  }

  // --- Private Methods ---

  /**
   * Group responses by axis_code
   */
  _groupByAxis(responses) {
    const groups = {};
    for (const r of responses) {
      const code = r.axis_code;
      if (!code) continue;
      if (!groups[code]) groups[code] = [];
      groups[code].push(r);
    }
    return groups;
  }

  /**
   * Default result for insufficient data
   */
  _defaultResult(axisCodes) {
    return {
      coupling_matrix: [],
      p_values: [],
      significant: [],
      hub_scores: {},
      strongest_couplings: [],
      weakest_couplings: [],
      bootstrap: {
        ci_matrix: [],
        median_ci_width: null,
        n_iterations: 0
      },
      reliability: {
        split_half_r: null
      },
      metadata: {
        method: 'shrinkage_spearman',
        shrinkage_lambda: null,
        fdr_threshold: this.fdrThreshold,
        n_items_per_axis: 0,
        n_axes: axisCodes.length,
        axes_included: axisCodes
      }
    };
  }

  /**
   * Compute NxN Spearman correlation matrix
   */
  _computeCorrelationMatrix(axisCodes, vectors) {
    const n = axisCodes.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        const rho = spearmanCorrelation(vectors[axisCodes[i]], vectors[axisCodes[j]]);
        matrix[i][j] = rho;
        matrix[j][i] = rho;
      }
    }

    return matrix;
  }

  /**
   * Compute shrinkage lambda: lambda = (n-3) / (n+10)
   * where n is the number of observations (items) per axis.
   * Shrinks toward zero to reduce noise in small samples.
   */
  _computeShrinkageLambda(nItems) {
    if (nItems <= 3) return 0;
    return (nItems - 3) / (nItems + 10);
  }

  /**
   * Apply shrinkage to correlation matrix: shrunk_ij = lambda * raw_ij (off-diagonal)
   */
  _applyShrinkage(matrix, n, lambda) {
    const shrunk = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      shrunk[i][i] = 1.0; // Diagonal stays 1
      for (let j = i + 1; j < n; j++) {
        const val = round4(lambda * matrix[i][j]);
        shrunk[i][j] = val;
        shrunk[j][i] = val;
      }
    }
    return shrunk;
  }

  /**
   * Compute p-value matrix using t-distribution approximation.
   * t = rho * sqrt((n-2) / (1-rho^2)), df = n-2
   */
  _computePValueMatrix(rawMatrix, nAxes, nItems) {
    const pValues = Array.from({ length: nAxes }, () => new Array(nAxes).fill(1));

    for (let i = 0; i < nAxes; i++) {
      pValues[i][i] = 0; // Self-correlation trivially significant
      for (let j = i + 1; j < nAxes; j++) {
        const p = spearmanPValue(rawMatrix[i][j], nItems);
        pValues[i][j] = p;
        pValues[j][i] = p;
      }
    }

    return pValues;
  }

  /**
   * Apply Benjamini-Hochberg FDR correction.
   * Operates on the upper triangle of the p-value matrix (105 tests for 15 axes).
   * Returns boolean matrix indicating significance after correction.
   */
  _applyBH(pValues, nAxes) {
    // Collect all upper-triangle p-values with indices
    const tests = [];
    for (let i = 0; i < nAxes; i++) {
      for (let j = i + 1; j < nAxes; j++) {
        tests.push({ i, j, p: pValues[i][j] });
      }
    }

    const m = tests.length;
    if (m === 0) {
      return Array.from({ length: nAxes }, () => new Array(nAxes).fill(false));
    }

    // Sort by p-value ascending
    tests.sort((a, b) => a.p - b.p);

    // Apply BH procedure
    const rejected = new Set();
    for (let k = m - 1; k >= 0; k--) {
      const threshold = (this.fdrThreshold * (k + 1)) / m;
      if (tests[k].p <= threshold) {
        // Reject this and all with smaller p-values
        for (let r = 0; r <= k; r++) {
          rejected.add(`${tests[r].i},${tests[r].j}`);
        }
        break;
      }
    }

    // Build boolean matrix
    const significant = Array.from({ length: nAxes }, () => new Array(nAxes).fill(false));
    for (let i = 0; i < nAxes; i++) {
      significant[i][i] = true; // Diagonal trivially significant
      for (let j = i + 1; j < nAxes; j++) {
        const sig = rejected.has(`${i},${j}`);
        significant[i][j] = sig;
        significant[j][i] = sig;
      }
    }

    return significant;
  }

  /**
   * Compute hub scores via eigenvector centrality using power iteration
   * on the absolute value of the coupling matrix.
   */
  _computeHubScores(couplingMatrix, nAxes, axisCodes) {
    if (nAxes < 2) {
      const scores = {};
      for (const code of axisCodes) scores[code] = 1 / axisCodes.length;
      return scores;
    }

    // Build absolute-value matrix (zero diagonal for centrality)
    const absMatrix = Array.from({ length: nAxes }, () => new Array(nAxes).fill(0));
    for (let i = 0; i < nAxes; i++) {
      for (let j = 0; j < nAxes; j++) {
        if (i !== j) {
          absMatrix[i][j] = Math.abs(couplingMatrix[i][j]);
        }
      }
    }

    const eigenvector = this._powerIteration(absMatrix, nAxes);

    // Map to axis codes
    const scores = {};
    for (let i = 0; i < nAxes; i++) {
      scores[axisCodes[i]] = round4(eigenvector[i]);
    }

    return scores;
  }

  /**
   * Power iteration to find the principal eigenvector.
   * Returns normalized eigenvector (L1 norm = 1).
   */
  _powerIteration(matrix, n) {
    // Initialize with uniform vector
    let v = new Array(n).fill(1 / n);

    for (let iter = 0; iter < this.maxEigenIterations; iter++) {
      // Matrix-vector multiply
      const newV = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newV[i] += matrix[i][j] * v[j];
        }
      }

      // Normalize (L2 for convergence check, then L1 for final output)
      const norm = Math.sqrt(newV.reduce((sum, x) => sum + x * x, 0));
      if (norm === 0) return new Array(n).fill(1 / n);

      for (let i = 0; i < n; i++) {
        newV[i] /= norm;
      }

      // Check convergence
      let diff = 0;
      for (let i = 0; i < n; i++) {
        diff += Math.abs(newV[i] - v[i]);
      }

      v = newV;

      if (diff < this.eigenTolerance) break;
    }

    // Normalize to L1 = 1 for interpretability as scores
    const l1 = v.reduce((sum, x) => sum + Math.abs(x), 0);
    if (l1 > 0) {
      for (let i = 0; i < n; i++) {
        v[i] = Math.abs(v[i]) / l1;
      }
    }

    return v;
  }

  /**
   * Bootstrap confidence intervals for the coupling matrix.
   * Resamples items within each axis, recomputes correlations each time.
   */
  _bootstrap(responsesByAxis, axisCodes, minLen) {
    const n = axisCodes.length;
    const nIter = this.bootstrapIterations;

    // Storage for all bootstrap matrices
    const allMatrices = [];

    for (let iter = 0; iter < nIter; iter++) {
      // Resample: for each axis, sample minLen items with replacement
      const resampledVectors = {};
      for (const code of axisCodes) {
        const items = responsesByAxis[code];
        const resampled = [];
        for (let k = 0; k < minLen; k++) {
          const idx = Math.floor(Math.random() * items.length);
          resampled.push(items[idx].permissibility);
        }
        resampledVectors[code] = resampled;
      }

      // Compute correlation matrix on resampled data
      const matrix = this._computeCorrelationMatrix(axisCodes, resampledVectors);
      allMatrices.push(matrix);
    }

    // Compute 95% CIs (2.5th and 97.5th percentiles)
    const ciMatrix = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => [0, 0])
    );
    const ciWidths = [];

    for (let i = 0; i < n; i++) {
      ciMatrix[i][i] = [1.0, 1.0]; // Diagonal
      for (let j = i + 1; j < n; j++) {
        const values = allMatrices.map(m => m[i][j]).sort((a, b) => a - b);
        const lo = values[Math.floor(nIter * 0.025)];
        const hi = values[Math.floor(nIter * 0.975)];
        const ci = [round4(lo), round4(hi)];
        ciMatrix[i][j] = ci;
        ciMatrix[j][i] = ci;
        ciWidths.push(hi - lo);
      }
    }

    // Median CI width
    ciWidths.sort((a, b) => a - b);
    const medianWidth = ciWidths.length > 0
      ? round4(ciWidths[Math.floor(ciWidths.length / 2)])
      : null;

    return {
      ci_matrix: ciMatrix,
      median_ci_width: medianWidth
    };
  }

  /**
   * Split-half reliability: split items per axis into odd/even,
   * compute two correlation matrices, measure their agreement (Pearson r
   * between the upper triangles).
   */
  _splitHalfReliability(responsesByAxis, axisCodes) {
    const vectorsOdd = {};
    const vectorsEven = {};

    let minOdd = Infinity;
    let minEven = Infinity;

    for (const code of axisCodes) {
      const items = responsesByAxis[code];
      const odd = [];
      const even = [];
      for (let k = 0; k < items.length; k++) {
        if (k % 2 === 0) {
          even.push(items[k].permissibility);
        } else {
          odd.push(items[k].permissibility);
        }
      }
      vectorsOdd[code] = odd;
      vectorsEven[code] = even;
      if (odd.length < minOdd) minOdd = odd.length;
      if (even.length < minEven) minEven = even.length;
    }

    // Need at least 2 items per half per axis
    if (minOdd < 2 || minEven < 2) return null;

    // Truncate to equal lengths within each half
    for (const code of axisCodes) {
      vectorsOdd[code] = vectorsOdd[code].slice(0, minOdd);
      vectorsEven[code] = vectorsEven[code].slice(0, minEven);
    }

    const matOdd = this._computeCorrelationMatrix(axisCodes, vectorsOdd);
    const matEven = this._computeCorrelationMatrix(axisCodes, vectorsEven);

    // Extract upper triangles and compute Pearson correlation
    const n = axisCodes.length;
    const triOdd = [];
    const triEven = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        triOdd.push(matOdd[i][j]);
        triEven.push(matEven[i][j]);
      }
    }

    if (triOdd.length < 2) return null;

    return round4(pearsonCorrelation(triOdd, triEven));
  }

  /**
   * Extract the strongest and weakest couplings from the matrix.
   */
  _extractExtremes(matrix, pValues, significant, axisCodes, ciMatrix) {
    const n = axisCodes.length;
    const pairs = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push({
          axis_a: axisCodes[i],
          axis_b: axisCodes[j],
          rho: matrix[i][j],
          p_adj: pValues[i][j],
          significant: significant[i][j],
          ci: ciMatrix[i][j]
        });
      }
    }

    // Sort by absolute rho descending
    pairs.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

    return {
      strongest: pairs.slice(0, 5),
      weakest: pairs.slice(-5).reverse()
    };
  }
}

// --- Statistical Utility Functions ---

/**
 * Convert values to ranks (average rank for ties).
 */
function toRanks(values) {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    // Find run of tied values
    while (j < indexed.length && indexed[j].v === indexed[i].v) {
      j++;
    }
    // Average rank for ties
    const avgRank = (i + j + 1) / 2; // ranks are 1-based
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

/**
 * Pearson correlation coefficient.
 */
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 2) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Spearman rank correlation coefficient.
 */
function spearmanCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  const rankX = toRanks(x);
  const rankY = toRanks(y);
  return pearsonCorrelation(rankX, rankY);
}

/**
 * Approximate two-tailed p-value for Spearman correlation.
 * Uses t-distribution approximation: t = rho * sqrt((n-2) / (1-rho^2))
 * with n-2 degrees of freedom.
 */
function spearmanPValue(rho, n) {
  if (n <= 2) return 1;
  if (Math.abs(rho) >= 1) return 0;

  const df = n - 2;
  const t = rho * Math.sqrt(df / (1 - rho * rho));

  // Two-tailed p-value using regularized incomplete beta function approximation
  return tDistPValue(Math.abs(t), df);
}

/**
 * Two-tailed p-value from t-distribution.
 * Uses approximation via the regularized incomplete beta function.
 */
function tDistPValue(t, df) {
  // Use the relationship: p = I(df/(df+t^2), df/2, 1/2)
  const x = df / (df + t * t);
  const p = regularizedBeta(x, df / 2, 0.5);
  return clamp(p, 0, 1);
}

/**
 * Regularized incomplete beta function I_x(a, b) via continued fraction (Lentz's method).
 * Accurate for most practical cases in statistical tests.
 */
function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use the symmetry relation if x > (a+1)/(a+b+2) for better convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedBeta(1 - x, b, a);
  }

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Lentz's continued fraction
  const maxIter = 200;
  const eps = 1e-14;
  let f = 1;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < eps) d = eps;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= maxIter; m++) {
    // Even step
    let numerator = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + numerator / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    f *= c * d;

    // Odd step
    numerator = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + numerator / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < eps) break;
  }

  return front * f;
}

/**
 * Log-gamma function (Lanczos approximation).
 */
function lnGamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }

  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Logit transform for b-value vectors.
 * Converts b-values from [0,1] to (-inf, +inf) via z_i = log(b_i / (1 - b_i)).
 * Clamped to [0.01, 0.99] before transform to avoid infinities.
 * Needed for future PCA on the logit-transformed space (proposal Section 5).
 *
 * @param {number[]} bValues - Array of b-values in [0, 1]
 * @returns {number[]} Array of logit-transformed values
 */
function logitTransform(bValues) {
  return bValues.map(b => {
    const clamped = clamp(b, 0.01, 0.99);
    return Math.log(clamped / (1 - clamped));
  });
}

// --- Simple Utility Functions ---

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round4(value) {
  if (value === null || value === undefined) return value;
  return Math.round(value * 10000) / 10000;
}

module.exports = {
  CouplingAnalyzer,
  // Export utilities for testing and reuse
  spearmanCorrelation,
  pearsonCorrelation,
  toRanks,
  spearmanPValue,
  regularizedBeta,
  logitTransform
};
