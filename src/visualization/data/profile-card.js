/**
 * Profile Card Data Generator
 *
 * Generates data for the Ethical Profile Card visualization.
 * This is the main summary view for a single agent's profile.
 */

class ProfileCardGenerator {
  /**
   * Generate profile card data
   * @param {Object} profile - Agent profile from ProfileAnalyzer
   * @param {Object} options - Generation options
   * @returns {Object} Profile card data
   */
  generate(profile, options = {}) {
    const { language = 'en', includeFlags = true } = options;

    // Generate axis bars
    const moralAxes = [];
    const memoryAxes = [];

    for (const [code, axisData] of Object.entries(profile.axes)) {
      const bar = this._generateAxisBar(code, axisData, language);

      if (axisData.category === 'memory') {
        memoryAxes.push(bar);
      } else {
        moralAxes.push(bar);
      }
    }

    // Sort by display order (using b value as fallback)
    moralAxes.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    memoryAxes.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Generate procedural style radar
    const proceduralRadar = this._generateProceduralRadar(profile.procedural, language);

    // Generate flags summary
    const flags = includeFlags ? this._generateFlagsSummary(profile.global_flags, language) : [];

    // Generate summary stats
    const summary = this._generateSummary(profile, language);

    return {
      agent_id: profile.agent_id,
      run_id: profile.run_id,
      evaluated_at: profile.evaluated_at,
      confidence_level: profile.confidence_level,

      // Main data sections
      moral_axes: moralAxes,
      memory_axes: memoryAxes,
      procedural: proceduralRadar,
      flags,
      summary,

      // Metadata for rendering
      rendering: {
        bar_min: 0,
        bar_max: 1,
        bar_center: 0.5,
        procedural_min: 0,
        procedural_max: 1
      }
    };
  }

  /**
   * Generate data for a single axis bar
   * @private
   */
  _generateAxisBar(code, axisData, language) {
    const name = language === 'es' ? axisData.name_es : axisData.name;
    const poleLeft = language === 'es' ? axisData.pole_left_es : axisData.pole_left;
    const poleRight = language === 'es' ? axisData.pole_right_es : axisData.pole_right;

    // Calculate position relative to center
    const position = axisData.b;
    const deviation = position - 0.5;

    // Determine strength of preference
    let strength = 'neutral';
    if (Math.abs(deviation) > 0.25) strength = 'strong';
    else if (Math.abs(deviation) > 0.1) strength = 'moderate';

    // Determine direction
    const direction = deviation > 0 ? 'left' : deviation < 0 ? 'right' : 'center';

    return {
      code,
      name: name || code,
      pole_left: poleLeft,
      pole_right: poleRight,

      // Values for rendering
      b: axisData.b,
      a: axisData.a,
      se_b: axisData.se_b,
      n_items: axisData.n_items,

      // Computed display values
      position,
      deviation,
      strength,
      direction,

      // Error range for visualization
      error_min: Math.max(0, axisData.b - axisData.se_b),
      error_max: Math.min(1, axisData.b + axisData.se_b),

      // Flags for this axis
      flags: axisData.flags || [],
      has_warning: (axisData.flags || []).length > 0,

      // Display string
      display_value: `b=${axisData.b.toFixed(2)} ±${axisData.se_b.toFixed(2)}`
    };
  }

  /**
   * Generate procedural radar chart data
   * @private
   */
  _generateProceduralRadar(procedural, language) {
    if (!procedural) {
      return null;
    }

    const labels = language === 'es' ? {
      moral_sensitivity: 'Sensibilidad Moral',
      info_seeking: 'Busqueda de Info',
      calibration: 'Calibracion',
      consistency: 'Consistencia',
      principle_diversity: 'Diversidad de Principios',
      reasoning_depth: 'Profundidad de Razonamiento',
      transparency: 'Transparencia',
      pressure_robustness: 'Robustez'
    } : {
      moral_sensitivity: 'Moral Sensitivity',
      info_seeking: 'Info Seeking',
      calibration: 'Calibration',
      consistency: 'Consistency',
      principle_diversity: 'Principle Diversity',
      reasoning_depth: 'Reasoning Depth',
      transparency: 'Transparency',
      pressure_robustness: 'Robustness'
    };

    const dimensions = [];

    for (const [key, label] of Object.entries(labels)) {
      const value = procedural[key];
      if (value !== null && value !== undefined) {
        dimensions.push({
          key,
          label,
          value,
          display_value: (value * 100).toFixed(0) + '%'
        });
      }
    }

    return {
      dimensions,
      average: dimensions.length > 0
        ? dimensions.reduce((sum, d) => sum + d.value, 0) / dimensions.length
        : null
    };
  }

  /**
   * Generate flags summary
   * @private
   */
  _generateFlagsSummary(globalFlags, language) {
    if (!globalFlags || globalFlags.length === 0) {
      return [];
    }

    const descriptions = language === 'es' ? {
      high_uncertainty: 'Alta incertidumbre',
      few_items: 'Pocos items',
      out_of_range: 'Fuera de rango',
      inconsistent: 'Respuestas inconsistentes',
      non_monotonic: 'Patron no monotonico'
    } : {
      high_uncertainty: 'High uncertainty',
      few_items: 'Few items',
      out_of_range: 'Out of range',
      inconsistent: 'Inconsistent responses',
      non_monotonic: 'Non-monotonic pattern'
    };

    return globalFlags.map(f => ({
      axis: f.axis,
      flag: f.flag,
      description: descriptions[f.flag] || f.flag
    }));
  }

  /**
   * Generate summary statistics
   * @private
   */
  _generateSummary(profile, language) {
    const axes = Object.values(profile.axes);

    // Calculate averages
    const avgB = axes.reduce((sum, a) => sum + a.b, 0) / axes.length;
    const avgA = axes.reduce((sum, a) => sum + a.a, 0) / axes.length;
    const avgSE = axes.reduce((sum, a) => sum + a.se_b, 0) / axes.length;
    const totalItems = axes.reduce((sum, a) => sum + a.n_items, 0);

    // Find extremes
    const sorted = [...axes].sort((a, b) => a.b - b.b);
    const mostRight = sorted[0];
    const mostLeft = sorted[sorted.length - 1];

    // Count preferences
    const leftLeaning = axes.filter(a => a.b > 0.6).length;
    const rightLeaning = axes.filter(a => a.b < 0.4).length;
    const balanced = axes.length - leftLeaning - rightLeaning;

    return {
      total_axes: axes.length,
      total_items_answered: totalItems,
      average_threshold: avgB.toFixed(3),
      average_rigidity: avgA.toFixed(2),
      average_uncertainty: avgSE.toFixed(3),

      // Preference distribution
      left_leaning_count: leftLeaning,
      right_leaning_count: rightLeaning,
      balanced_count: balanced,

      // Extremes
      strongest_left: {
        code: Object.keys(profile.axes).find(k =>
          profile.axes[k].b === mostLeft.b
        ),
        value: mostLeft.b
      },
      strongest_right: {
        code: Object.keys(profile.axes).find(k =>
          profile.axes[k].b === mostRight.b
        ),
        value: mostRight.b
      },

      // Confidence interpretation
      confidence_description: language === 'es'
        ? this._getConfidenceDescription(profile.confidence_level, 'es')
        : this._getConfidenceDescription(profile.confidence_level, 'en')
    };
  }

  /**
   * Get confidence level description
   * @private
   */
  _getConfidenceDescription(level, language) {
    const descriptions = {
      es: {
        high: 'Alta confianza en los resultados',
        medium: 'Confianza moderada - algunos ejes pueden necesitar mas items',
        low: 'Baja confianza - se recomienda completar mas escenarios'
      },
      en: {
        high: 'High confidence in results',
        medium: 'Moderate confidence - some axes may need more items',
        low: 'Low confidence - completing more scenarios recommended'
      }
    };

    return descriptions[language]?.[level] || level;
  }
}

module.exports = { ProfileCardGenerator };
