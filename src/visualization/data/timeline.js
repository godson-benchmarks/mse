/**
 * Timeline Data Generator
 *
 * Generates data for visualizing the temporal evolution of an agent's
 * ethical profile over multiple evaluations.
 */

class TimelineGenerator {
  /**
   * Generate timeline data from profile history
   * @param {Object[]} history - Array of profile snapshots
   * @param {Object} options
   * @returns {Object}
   */
  generate(history, options = {}) {
    const {
      language = 'en',
      showAxes = null,  // null = all axes
      includeDeltas = true
    } = options;

    if (!history || history.length === 0) {
      return {
        empty: true,
        message: language === 'es'
          ? 'No hay historial de evaluaciones'
          : 'No evaluation history'
      };
    }

    // Sort by date
    const sorted = [...history].sort((a, b) =>
      new Date(a.snapshot_date) - new Date(b.snapshot_date)
    );

    // Get all axis codes
    const allAxisCodes = new Set();
    for (const snapshot of sorted) {
      for (const code of Object.keys(snapshot.profile_vector)) {
        allAxisCodes.add(code);
      }
    }

    // Filter axes if specified
    const axisCodes = showAxes
      ? Array.from(allAxisCodes).filter(c => showAxes.includes(c))
      : Array.from(allAxisCodes);

    // Generate time series per axis
    const series = {};
    for (const code of axisCodes) {
      series[code] = this._generateAxisSeries(sorted, code, includeDeltas);
    }

    // Generate summary timeline
    const summaryTimeline = this._generateSummaryTimeline(sorted);

    // Generate change events
    const changeEvents = includeDeltas
      ? this._detectChangeEvents(sorted, axisCodes)
      : [];

    // Generate stability metrics
    const stability = this._calculateStabilityMetrics(series);

    return {
      timepoints: sorted.map(s => ({
        date: s.snapshot_date,
        run_id: s.run_id
      })),

      series,
      summary_timeline: summaryTimeline,
      change_events: changeEvents,
      stability,

      // Axis metadata
      axis_codes: axisCodes,

      // Rendering hints
      rendering: {
        y_min: 0,
        y_max: 1,
        significance_threshold: 0.1,  // Change > 0.1 is highlighted
        date_format: 'YYYY-MM-DD'
      }
    };
  }

  /**
   * Generate time series for a single axis
   * @private
   */
  _generateAxisSeries(history, axisCode, includeDeltas) {
    const points = [];
    let prevValue = null;

    for (const snapshot of history) {
      const axisData = snapshot.profile_vector[axisCode];

      if (axisData) {
        const point = {
          date: snapshot.snapshot_date,
          run_id: snapshot.run_id,
          b: axisData.b,
          a: axisData.a,
          se_b: axisData.se_b,
          error_min: Math.max(0, axisData.b - axisData.se_b),
          error_max: Math.min(1, axisData.b + axisData.se_b)
        };

        if (includeDeltas && prevValue !== null) {
          point.delta = axisData.b - prevValue;
          point.delta_significant = Math.abs(point.delta) > axisData.se_b;
        }

        points.push(point);
        prevValue = axisData.b;
      }
    }

    // Calculate trend
    const trend = this._calculateTrend(points);

    return {
      axis_code: axisCode,
      points,
      trend,
      start_value: points.length > 0 ? points[0].b : null,
      end_value: points.length > 0 ? points[points.length - 1].b : null,
      total_change: points.length > 1
        ? points[points.length - 1].b - points[0].b
        : 0
    };
  }

  /**
   * Generate summary timeline (avg threshold over time)
   * @private
   */
  _generateSummaryTimeline(history) {
    return history.map(snapshot => ({
      date: snapshot.snapshot_date,
      run_id: snapshot.run_id,
      avg_threshold: snapshot.avg_threshold,
      avg_rigidity: snapshot.avg_rigidity
    }));
  }

  /**
   * Detect significant change events
   * @private
   */
  _detectChangeEvents(history, axisCodes) {
    const events = [];

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];

      for (const code of axisCodes) {
        const prevData = prev.profile_vector[code];
        const currData = curr.profile_vector[code];

        if (prevData && currData) {
          const delta = currData.b - prevData.b;
          const avgSE = (prevData.se_b + currData.se_b) / 2;

          // Significant if change > 1.5 * average SE
          if (Math.abs(delta) > avgSE * 1.5) {
            events.push({
              date: curr.snapshot_date,
              run_id: curr.run_id,
              axis_code: code,
              delta,
              direction: delta > 0 ? 'left' : 'right',
              magnitude: Math.abs(delta) > 0.2 ? 'large' : 'moderate',
              prev_value: prevData.b,
              new_value: currData.b
            });
          }
        }
      }
    }

    // Sort by magnitude
    events.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return events;
  }

  /**
   * Calculate trend for a series of points
   * @private
   */
  _calculateTrend(points) {
    if (points.length < 2) {
      return { direction: 'stable', slope: 0, r_squared: null };
    }

    // Simple linear regression
    const n = points.length;
    const xs = points.map((_, i) => i);
    const ys = points.map(p => p.b);

    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
    const sumXX = xs.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTot = ys.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssRes = ys.reduce((sum, y, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Determine direction
    let direction = 'stable';
    if (Math.abs(slope) > 0.01) {  // Per evaluation
      direction = slope > 0 ? 'increasing_left' : 'increasing_right';
    }

    return {
      direction,
      slope,
      r_squared: rSquared,
      significant: rSquared > 0.5 && Math.abs(slope) > 0.01
    };
  }

  /**
   * Calculate stability metrics
   * @private
   */
  _calculateStabilityMetrics(series) {
    const metrics = {};

    for (const [code, data] of Object.entries(series)) {
      if (data.points.length < 2) {
        metrics[code] = { stability: 1, variance: 0 };
        continue;
      }

      const values = data.points.map(p => p.b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) =>
        sum + Math.pow(v - mean, 2), 0) / values.length;

      // Stability = inverse of coefficient of variation
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      const stability = Math.max(0, 1 - cv);

      metrics[code] = {
        stability,
        variance,
        mean,
        std_dev: Math.sqrt(variance),
        range: Math.max(...values) - Math.min(...values)
      };
    }

    // Overall stability
    const stabilities = Object.values(metrics).map(m => m.stability);
    const overallStability = stabilities.length > 0
      ? stabilities.reduce((a, b) => a + b, 0) / stabilities.length
      : 1;

    return {
      per_axis: metrics,
      overall: overallStability,
      interpretation: overallStability > 0.9 ? 'very_stable' :
                     overallStability > 0.7 ? 'stable' :
                     overallStability > 0.5 ? 'moderate' : 'volatile'
    };
  }

  /**
   * Generate waterfall chart data for changes between two points
   * @param {Object} fromProfile
   * @param {Object} toProfile
   * @param {Object} options
   * @returns {Object}
   */
  generateWaterfall(fromProfile, toProfile, options = {}) {
    const { language = 'en', significanceThreshold = 0.05 } = options;

    const changes = [];

    // Get all axis codes
    const axisCodes = new Set([
      ...Object.keys(fromProfile),
      ...Object.keys(toProfile)
    ]);

    for (const code of axisCodes) {
      const from = fromProfile[code];
      const to = toProfile[code];

      if (from && to) {
        const delta = to.b - from.b;
        const significant = Math.abs(delta) > significanceThreshold;

        changes.push({
          axis_code: code,
          from_value: from.b,
          to_value: to.b,
          delta,
          direction: delta > 0 ? 'left' : delta < 0 ? 'right' : 'unchanged',
          significant,
          bar_length: Math.abs(delta),
          bar_start: delta > 0 ? from.b : to.b
        });
      }
    }

    // Sort by magnitude of change
    changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return {
      changes,
      summary: {
        total_axes: changes.length,
        significant_changes: changes.filter(c => c.significant).length,
        moved_left: changes.filter(c => c.direction === 'left').length,
        moved_right: changes.filter(c => c.direction === 'right').length,
        largest_change: changes[0] || null
      },
      labels: language === 'es' ? {
        from: 'Antes',
        to: 'Despues',
        change: 'Cambio',
        no_change: 'Sin cambio'
      } : {
        from: 'Before',
        to: 'After',
        change: 'Change',
        no_change: 'No change'
      }
    };
  }
}

module.exports = { TimelineGenerator };
