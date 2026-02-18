/**
 * Coupling Card Data Generator
 *
 * Generates data for the Coupling Analysis visualization card.
 * Transforms CouplingAnalyzer output into render-ready structures
 * for heatmaps, bar charts, and summary displays.
 */

'use strict';

// Axis display names (short labels for visualizations)
const AXIS_LABELS = {
  'rights-vs-consequences': 'Rights/Conseq.',
  'doing-vs-allowing': 'Doing/Allowing',
  'means-vs-collateral': 'Means/Collat.',
  'impartiality-vs-partiality': 'Impartial./Partial.',
  'worst-off-vs-efficiency': 'Worst-off/Effic.',
  'truth-vs-beneficence': 'Truth/Benef.',
  'autonomy-vs-paternalism': 'Auton./Patern.',
  'privacy-vs-security': 'Privacy/Security',
  'conscience-vs-authority': 'Consc./Auth.',
  'cooperation-vs-defection': 'Coop./Defect.',
  'long-term-vs-short-term': 'Long/Short-term',
  'integrity-vs-opportunism': 'Integ./Opport.',
  'minimization-vs-personalization': 'Minim./Person.',
  'purpose-vs-secondary-use': 'Purpose/Second.',
  'compartmentalization-vs-leakage': 'Compart./Leak.'
};

class CouplingCardGenerator {
  /**
   * Generate coupling card visualization data.
   *
   * @param {Object} couplingResult - Output from CouplingAnalyzer.analyze()
   * @param {Object} options
   * @param {number} options.topN - Number of top couplings to include (default: 5)
   * @returns {Object} Visualization-ready data
   */
  generate(couplingResult, options = {}) {
    const { topN = 5 } = options;

    if (!couplingResult || !couplingResult.coupling_matrix || couplingResult.coupling_matrix.length === 0) {
      return this._emptyCard();
    }

    const axisCodes = couplingResult.metadata.axes_included;
    const n = axisCodes.length;
    const matrix = couplingResult.coupling_matrix;

    // Matrix data: flattened upper triangle for heatmap rendering
    const matrixData = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        matrixData.push({
          axis_a: axisCodes[i],
          axis_b: axisCodes[j],
          label_a: AXIS_LABELS[axisCodes[i]] || axisCodes[i],
          label_b: AXIS_LABELS[axisCodes[j]] || axisCodes[j],
          rho: matrix[i][j],
          significant: couplingResult.significant[i][j]
        });
      }
    }

    // Hub bars: sorted descending by hub score
    const hubBars = Object.entries(couplingResult.hub_scores)
      .map(([code, score]) => ({
        axis_code: code,
        label: AXIS_LABELS[code] || code,
        score
      }))
      .sort((a, b) => b.score - a.score);

    // Top couplings with descriptions
    const topCouplings = (couplingResult.strongest_couplings || [])
      .slice(0, topN)
      .map(c => ({
        axis_a: c.axis_a,
        axis_b: c.axis_b,
        label_a: AXIS_LABELS[c.axis_a] || c.axis_a,
        label_b: AXIS_LABELS[c.axis_b] || c.axis_b,
        rho: c.rho,
        significant: c.significant,
        ci: c.ci,
        direction: c.rho > 0 ? 'positive' : 'negative',
        strength: this._strengthLabel(Math.abs(c.rho))
      }));

    // Reliability badge
    const reliabilityBadge = this._reliabilityBadge(couplingResult.reliability.split_half_r);

    return {
      matrix_data: matrixData,
      hub_bars: hubBars,
      top_couplings: topCouplings,
      reliability_badge: reliabilityBadge,
      metadata: {
        n_axes: n,
        n_items_per_axis: couplingResult.metadata.n_items_per_axis,
        shrinkage_lambda: couplingResult.metadata.shrinkage_lambda,
        fdr_threshold: couplingResult.metadata.fdr_threshold,
        bootstrap_iterations: couplingResult.bootstrap.n_iterations,
        median_ci_width: couplingResult.bootstrap.median_ci_width
      }
    };
  }

  _strengthLabel(absRho) {
    if (absRho >= 0.7) return 'strong';
    if (absRho >= 0.4) return 'moderate';
    if (absRho >= 0.2) return 'weak';
    return 'negligible';
  }

  _reliabilityBadge(splitHalfR) {
    if (splitHalfR === null || splitHalfR === undefined) {
      return { level: 'unknown', value: null, label: 'Insufficient data' };
    }
    if (splitHalfR >= 0.8) {
      return { level: 'excellent', value: splitHalfR, label: 'Excellent reliability' };
    }
    if (splitHalfR >= 0.6) {
      return { level: 'good', value: splitHalfR, label: 'Good reliability' };
    }
    if (splitHalfR >= 0.4) {
      return { level: 'moderate', value: splitHalfR, label: 'Moderate reliability' };
    }
    return { level: 'low', value: splitHalfR, label: 'Low reliability' };
  }

  _emptyCard() {
    return {
      matrix_data: [],
      hub_bars: [],
      top_couplings: [],
      reliability_badge: { level: 'unknown', value: null, label: 'No data' },
      metadata: {
        n_axes: 0,
        n_items_per_axis: 0,
        shrinkage_lambda: null,
        fdr_threshold: null,
        bootstrap_iterations: 0,
        median_ci_width: null
      }
    };
  }
}

module.exports = { CouplingCardGenerator };
