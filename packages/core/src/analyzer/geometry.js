/**
 * MSE v3.0 - Profile Geometry Analyzer
 *
 * Computes population-level geometric properties of agent b-value distributions:
 * - Per-axis interquartile range (IQR) across agents
 * - Bimodality coefficient per axis: BC = (skewness^2 + 1) / kurtosis
 *   BC > 0.555 suggests bimodal distribution (Pfister et al., 2013)
 * - Pairwise population Spearman correlation heatmap data
 *
 * These metrics characterize how the agent population distributes across the
 * 15 moral axes. Bimodal axes suggest "moral camps" where agents cluster at
 * opposing positions. High IQR axes show genuine moral diversity.
 *
 * Requires minimum 10 agents for meaningful results; warns below 50.
 */

'use strict';

const { spearmanCorrelation } = require('./coupling');

class ProfileGeometryAnalyzer {
  /**
   * @param {Object} options
   * @param {number} options.minAgents - Minimum agents for analysis (default: 10)
   * @param {number} options.warnBelowAgents - Warn below this count (default: 50)
   * @param {number} options.bimodalityThreshold - BC threshold for bimodality (default: 0.555)
   */
  constructor(options = {}) {
    this.minAgents = options.minAgents || 10;
    this.warnBelowAgents = options.warnBelowAgents || 50;
    this.bimodalityThreshold = options.bimodalityThreshold || 0.555;
  }

  /**
   * Analyze geometry of agent b-vectors across the population.
   *
   * @param {Object[]} agentBVectors - Array of objects, each with axis_code keys mapping to b-values.
   *   Example: [{ 'rights-vs-consequences': 0.6, 'doing-vs-allowing': 0.3, ... }, ...]
   * @returns {Object|null} Geometry result, or null if insufficient agents
   */
  analyze(agentBVectors) {
    const nAgents = agentBVectors.length;

    if (nAgents < this.minAgents) {
      return null;
    }

    // Collect all axis codes present across agents
    const axisSet = new Set();
    for (const vec of agentBVectors) {
      for (const code of Object.keys(vec)) {
        axisSet.add(code);
      }
    }
    const axisCodes = Array.from(axisSet).sort();

    // Build per-axis value arrays (only agents that have data for that axis)
    const axisValues = {};
    for (const code of axisCodes) {
      axisValues[code] = [];
      for (const vec of agentBVectors) {
        if (vec[code] !== undefined && vec[code] !== null) {
          axisValues[code].push(vec[code]);
        }
      }
    }

    // Compute per-axis statistics
    const perAxis = {};
    for (const code of axisCodes) {
      const values = axisValues[code];
      if (values.length < 3) {
        perAxis[code] = { iqr: null, bimodality_coefficient: null, n_agents: values.length };
        continue;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const q1 = percentile(sorted, 0.25);
      const q3 = percentile(sorted, 0.75);
      const iqr = round4(q3 - q1);

      const bc = this._bimodalityCoefficient(values);

      perAxis[code] = {
        iqr,
        bimodality_coefficient: round4(bc),
        is_bimodal: bc > this.bimodalityThreshold,
        n_agents: values.length
      };
    }

    // Compute pairwise population Spearman correlation heatmap
    const correlationMatrix = this._computePopulationCorrelation(axisCodes, agentBVectors);

    const warnings = [];
    if (nAgents < this.warnBelowAgents) {
      warnings.push(`Small sample (n=${nAgents}). Results may be unstable; recommend n >= ${this.warnBelowAgents}.`);
    }

    return {
      per_axis: perAxis,
      correlation_matrix: correlationMatrix,
      axis_codes: axisCodes,
      metadata: {
        n_agents: nAgents,
        n_axes: axisCodes.length,
        bimodality_threshold: this.bimodalityThreshold,
        warnings
      }
    };
  }

  /**
   * Compute bimodality coefficient: BC = (skewness^2 + 1) / kurtosis
   * Uses excess kurtosis + 3 for the denominator (i.e., Pearson kurtosis).
   */
  _bimodalityCoefficient(values) {
    const n = values.length;
    if (n < 3) return 0;

    const mean = values.reduce((s, v) => s + v, 0) / n;

    let m2 = 0, m3 = 0, m4 = 0;
    for (const v of values) {
      const d = v - mean;
      const d2 = d * d;
      m2 += d2;
      m3 += d2 * d;
      m4 += d2 * d2;
    }
    m2 /= n;
    m3 /= n;
    m4 /= n;

    if (m2 === 0) return 0;

    const skewness = m3 / Math.pow(m2, 1.5);
    const kurtosis = m4 / (m2 * m2); // Pearson kurtosis (not excess)

    if (kurtosis === 0) return 0;

    return (skewness * skewness + 1) / kurtosis;
  }

  /**
   * Compute pairwise Spearman correlation across agents for each pair of axes.
   * Each agent contributes one b-value per axis; correlations measure whether
   * agents who score high on one axis also score high on another.
   */
  _computePopulationCorrelation(axisCodes, agentBVectors) {
    const n = axisCodes.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        // Collect paired values (agents that have both axes)
        const xVals = [];
        const yVals = [];
        for (const vec of agentBVectors) {
          const xi = vec[axisCodes[i]];
          const xj = vec[axisCodes[j]];
          if (xi !== undefined && xi !== null && xj !== undefined && xj !== null) {
            xVals.push(xi);
            yVals.push(xj);
          }
        }

        const rho = xVals.length >= 3 ? round4(spearmanCorrelation(xVals, yVals)) : 0;
        matrix[i][j] = rho;
        matrix[j][i] = rho;
      }
    }

    return matrix;
  }
}

// --- Utility Functions ---

function percentile(sortedValues, p) {
  const n = sortedValues.length;
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

function round4(value) {
  if (value === null || value === undefined) return value;
  return Math.round(value * 10000) / 10000;
}

module.exports = { ProfileGeometryAnalyzer };
