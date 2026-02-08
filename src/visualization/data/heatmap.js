/**
 * Heatmap Data Generator
 *
 * Generates data for the multi-agent comparison heatmap visualization.
 * Shows axes (rows) vs agents (columns) with threshold values as colors.
 */

class HeatmapGenerator {
  /**
   * Generate heatmap data from a comparison result
   * @param {Object} comparison - Result from ComparisonAnalyzer
   * @param {Object} options - Generation options
   * @returns {Object} Heatmap data
   */
  generate(comparison, options = {}) {
    const {
      language = 'en',
      sortBy = 'axis',  // 'axis', 'cluster', 'variance'
      includeUncertainty = true
    } = options;

    // Build rows (axes) and columns (agents)
    const rows = this._buildRows(comparison.matrix, comparison.axes_metadata, language);
    const columns = this._buildColumns(comparison.agents);
    const cells = this._buildCells(comparison.matrix, rows, columns, includeUncertainty);

    // Sort rows based on option
    if (sortBy === 'variance') {
      rows.sort((a, b) => b.variance - a.variance);
    } else if (sortBy === 'cluster') {
      // Group by category, then by variance
      rows.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return b.variance - a.variance;
      });
    }

    // Calculate column statistics
    const columnStats = this._calculateColumnStats(comparison.matrix, columns);

    // Generate color scale info
    const colorScale = this._generateColorScale();

    return {
      rows,
      columns,
      cells,
      column_stats: columnStats,
      color_scale: colorScale,

      // Summary
      summary: {
        total_axes: rows.length,
        total_agents: columns.length,
        highest_variance_axis: rows.reduce((max, r) =>
          r.variance > max.variance ? r : max
        , rows[0]),
        clusters: comparison.clusters
      },

      // Rendering hints
      rendering: {
        cell_min: 0,
        cell_max: 1,
        cell_center: 0.5,
        uncertainty_threshold: 0.15
      }
    };
  }

  /**
   * Build row data (axes)
   * @private
   */
  _buildRows(matrix, axesMetadata, language) {
    const rows = [];

    for (const axisMeta of axesMetadata) {
      const axisValues = matrix[axisMeta.code] || {};
      const bValues = Object.values(axisValues).map(v => v.b);

      // Calculate variance
      const mean = bValues.length > 0
        ? bValues.reduce((a, b) => a + b, 0) / bValues.length
        : 0.5;
      const variance = bValues.length > 0
        ? bValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / bValues.length
        : 0;

      rows.push({
        code: axisMeta.code,
        name: axisMeta.name,
        pole_left: axisMeta.pole_left,
        pole_right: axisMeta.pole_right,
        category: axisMeta.category || 'moral',
        mean: mean,
        variance: variance,
        std_dev: Math.sqrt(variance),
        range: bValues.length > 0
          ? Math.max(...bValues) - Math.min(...bValues)
          : 0
      });
    }

    return rows;
  }

  /**
   * Build column data (agents)
   * @private
   */
  _buildColumns(agents) {
    return agents.map((agent, index) => ({
      id: agent.agent_id,
      snapshot_date: agent.snapshot_date,
      index
    }));
  }

  /**
   * Build cell data (intersection of axes and agents)
   * @private
   */
  _buildCells(matrix, rows, columns, includeUncertainty) {
    const cells = [];

    for (const row of rows) {
      for (const col of columns) {
        const axisData = matrix[row.code]?.[col.id];

        if (axisData) {
          cells.push({
            row: row.code,
            column: col.id,
            value: axisData.b,
            rigidity: axisData.a,
            uncertainty: axisData.se_b,
            flags: axisData.flags || [],

            // Visual attributes
            color: this._valueToColor(axisData.b),
            opacity: includeUncertainty
              ? Math.max(0.3, 1 - axisData.se_b * 3)
              : 1,
            has_uncertainty: axisData.se_b > 0.15,
            display_value: axisData.b.toFixed(2)
          });
        } else {
          // Missing data
          cells.push({
            row: row.code,
            column: col.id,
            value: null,
            missing: true,
            color: '#cccccc',
            opacity: 0.3
          });
        }
      }
    }

    return cells;
  }

  /**
   * Calculate statistics per column (agent)
   * @private
   */
  _calculateColumnStats(matrix, columns) {
    const stats = {};

    for (const col of columns) {
      const values = [];

      for (const axisCode of Object.keys(matrix)) {
        const axisData = matrix[axisCode]?.[col.id];
        if (axisData) {
          values.push(axisData.b);
        }
      }

      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) =>
          sum + Math.pow(v - mean, 2), 0) / values.length;

        stats[col.id] = {
          mean,
          variance,
          std_dev: Math.sqrt(variance),
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    }

    return stats;
  }

  /**
   * Generate color scale configuration
   * @private
   */
  _generateColorScale() {
    return {
      type: 'diverging',
      domain: [0, 0.5, 1],
      range: ['#3182bd', '#f7f7f7', '#e34a33'],  // Blue (right) - White (center) - Red (left)
      labels: {
        min: 'Right Pole',
        center: 'Balanced',
        max: 'Left Pole'
      }
    };
  }

  /**
   * Convert value to hex color
   * @private
   */
  _valueToColor(value) {
    // Interpolate between blue (0) -> white (0.5) -> red (1)
    if (value <= 0.5) {
      // Blue to white
      const t = value * 2;
      const r = Math.round(49 + (247 - 49) * t);
      const g = Math.round(130 + (247 - 130) * t);
      const b = Math.round(189 + (247 - 189) * t);
      return `rgb(${r},${g},${b})`;
    } else {
      // White to red
      const t = (value - 0.5) * 2;
      const r = Math.round(247 + (227 - 247) * t);
      const g = Math.round(247 + (74 - 247) * t);
      const b = Math.round(247 + (51 - 247) * t);
      return `rgb(${r},${g},${b})`;
    }
  }

  /**
   * Generate ordered heatmap for specific axes
   * @param {Object} comparison
   * @param {string[]} axisCodes - Specific axes to include
   * @param {Object} options
   * @returns {Object}
   */
  generateForAxes(comparison, axisCodes, options = {}) {
    // Filter axes metadata
    const filteredMetadata = comparison.axes_metadata.filter(a =>
      axisCodes.includes(a.code)
    );

    // Filter matrix
    const filteredMatrix = {};
    for (const code of axisCodes) {
      if (comparison.matrix[code]) {
        filteredMatrix[code] = comparison.matrix[code];
      }
    }

    // Generate with filtered data
    return this.generate({
      ...comparison,
      matrix: filteredMatrix,
      axes_metadata: filteredMetadata
    }, options);
  }
}

module.exports = { HeatmapGenerator };
