/**
 * Dual-Axis Scorer (v3.0)
 *
 * Distributes scoring information from a cross-axis dilemma response
 * between its primary and secondary axes using information-weighted splitting.
 *
 * When a dilemma activates two axes, the response contains signal for both.
 * The weight assigned to each axis is inversely proportional to the current
 * uncertainty (SE) on that axis: axes with higher uncertainty receive more
 * weight because they have more to gain from new information.
 *
 * Weight formula (precision-weighted):
 *   w_primary = (1/SE_p^2) / ((1/SE_p^2) + (1/SE_s^2))
 *   w_secondary = 1 - w_primary
 *
 * This is the standard precision-weighting from meta-analysis (inverse-variance).
 */

'use strict';

class DualAxisScorer {
  /**
   * @param {Object} options
   * @param {number} options.minSE - Floor for SE to prevent division by zero (default: 0.01)
   * @param {number} options.maxWeight - Cap on any single axis weight (default: 0.95)
   */
  constructor(options = {}) {
    this.minSE = options.minSE || 0.01;
    this.maxWeight = options.maxWeight || 0.95;
  }

  /**
   * Score a cross-axis response, distributing information between primary and secondary axes.
   *
   * @param {Object} response - Parsed response data (permissibility, forced_choice, etc.)
   * @param {Object} item - Dilemma item with axis_id and secondary_axis_id
   * @param {Object} currentScores - Current axis scores keyed by axis_id, each with {se_b}
   * @returns {Object} Scoring result with primary and secondary contributions
   */
  score(response, item, currentScores = {}) {
    const primaryAxisId = item.axis_id;
    const secondaryAxisId = item.secondary_axis_id;

    // Single-axis item: all weight to primary
    if (!secondaryAxisId) {
      return {
        primary: { axis_id: primaryAxisId, weight: 1.0 },
        secondary: null,
        is_cross_axis: false
      };
    }

    // Get current SE values (default to high uncertainty if no prior data)
    const sePrimary = Math.max(this.minSE, this._getSE(currentScores, primaryAxisId));
    const seSecondary = Math.max(this.minSE, this._getSE(currentScores, secondaryAxisId));

    // Precision-weighted split
    const precPrimary = 1 / (sePrimary * sePrimary);
    const precSecondary = 1 / (seSecondary * seSecondary);
    const totalPrec = precPrimary + precSecondary;

    let wPrimary = precPrimary / totalPrec;
    let wSecondary = precSecondary / totalPrec;

    // Clamp to prevent any axis from dominating completely
    if (wPrimary > this.maxWeight) {
      wPrimary = this.maxWeight;
      wSecondary = 1 - this.maxWeight;
    } else if (wSecondary > this.maxWeight) {
      wSecondary = this.maxWeight;
      wPrimary = 1 - this.maxWeight;
    }

    return {
      primary: {
        axis_id: primaryAxisId,
        weight: Math.round(wPrimary * 1000) / 1000
      },
      secondary: {
        axis_id: secondaryAxisId,
        weight: Math.round(wSecondary * 1000) / 1000
      },
      is_cross_axis: true
    };
  }

  /**
   * Get SE for an axis from current scores.
   * @private
   */
  _getSE(currentScores, axisId) {
    const score = currentScores[axisId];
    if (score && typeof score.se_b === 'number') {
      return score.se_b;
    }
    // Default: high uncertainty (no prior data)
    return 0.5;
  }
}

module.exports = { DualAxisScorer };
