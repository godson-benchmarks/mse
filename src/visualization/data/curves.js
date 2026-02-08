/**
 * Threshold Curves Data Generator
 *
 * Generates data for visualizing the logistic threshold curves
 * showing how agents transition between poles at different pressure levels.
 */

class ThresholdCurvesGenerator {
  constructor() {
    this.curveResolution = 50;  // Points per curve
  }

  /**
   * Generate threshold curves for multiple agents on a single axis
   * @param {Object[]} agentScores - Array of {agent_id, b, a, se_b}
   * @param {Object} axisInfo - Axis metadata
   * @param {Object} options
   * @returns {Object}
   */
  generate(agentScores, axisInfo, options = {}) {
    const { language = 'en', showConfidenceBands = true } = options;

    // Generate curves for each agent
    const curves = agentScores.map(score => this._generateCurve(score, showConfidenceBands));

    // Generate x-axis (pressure levels)
    const xAxis = this._generateXAxis(language);

    // Generate y-axis (probability)
    const yAxis = this._generateYAxis(language);

    // Generate threshold markers
    const thresholdMarkers = agentScores.map(score => ({
      agent_id: score.agent_id,
      x: score.b,
      y: 0.5,  // At 50% probability
      label: `b=${score.b.toFixed(2)}`
    }));

    // Generate pressure level annotations
    const pressureAnnotations = this._generatePressureAnnotations(language);

    return {
      axis: {
        code: axisInfo.code,
        name: language === 'es' ? axisInfo.name_es : axisInfo.name,
        pole_left: language === 'es' ? axisInfo.pole_left_es : axisInfo.pole_left,
        pole_right: language === 'es' ? axisInfo.pole_right_es : axisInfo.pole_right
      },

      curves,
      x_axis: xAxis,
      y_axis: yAxis,
      threshold_markers: thresholdMarkers,
      pressure_annotations: pressureAnnotations,

      // Legend info
      legend: {
        y_label: language === 'es'
          ? 'P(elegir polo derecho)'
          : 'P(choose right pole)',
        x_label: language === 'es'
          ? 'Nivel de presion'
          : 'Pressure level',
        threshold_label: language === 'es'
          ? 'Umbral (b)'
          : 'Threshold (b)'
      },

      // Rendering hints
      rendering: {
        x_min: 0,
        x_max: 1,
        y_min: 0,
        y_max: 1,
        curve_stroke_width: 2,
        confidence_band_opacity: 0.2
      }
    };
  }

  /**
   * Generate a single sigmoid curve
   * @private
   */
  _generateCurve(score, showConfidenceBands) {
    const { agent_id, b, a, se_b } = score;
    const points = [];

    // Generate main curve points
    for (let i = 0; i <= this.curveResolution; i++) {
      const x = i / this.curveResolution;
      const y = this._sigmoid(a * (x - b));
      points.push({ x, y });
    }

    // Generate confidence bands if requested
    let upperBand = null;
    let lowerBand = null;

    if (showConfidenceBands && se_b > 0) {
      upperBand = [];
      lowerBand = [];

      const bUpper = b + se_b;
      const bLower = b - se_b;

      for (let i = 0; i <= this.curveResolution; i++) {
        const x = i / this.curveResolution;
        upperBand.push({
          x,
          y: this._sigmoid(a * (x - bLower))  // Lower b = higher curve
        });
        lowerBand.push({
          x,
          y: this._sigmoid(a * (x - bUpper))  // Higher b = lower curve
        });
      }
    }

    return {
      agent_id,
      points,
      upper_band: upperBand,
      lower_band: lowerBand,

      // Curve characteristics
      params: {
        b,
        a,
        se_b
      },

      // Key points on the curve
      key_points: {
        threshold: { x: b, y: 0.5 },
        at_low_pressure: { x: 0.15, y: this._sigmoid(a * (0.15 - b)) },
        at_high_pressure: { x: 0.85, y: this._sigmoid(a * (0.85 - b)) }
      },

      // Curve interpretation
      interpretation: this._interpretCurve(b, a)
    };
  }

  /**
   * Sigmoid function
   * @private
   */
  _sigmoid(x) {
    const clamped = Math.max(-20, Math.min(20, x));
    return 1 / (1 + Math.exp(-clamped));
  }

  /**
   * Interpret curve characteristics
   * @private
   */
  _interpretCurve(b, a) {
    const thresholdPosition = b < 0.4 ? 'low' : b > 0.6 ? 'high' : 'moderate';
    const rigidityLevel = a > 7 ? 'very_rigid' : a > 4 ? 'rigid' : a > 2 ? 'flexible' : 'very_flexible';

    return {
      threshold_position: thresholdPosition,
      rigidity_level: rigidityLevel,
      description_en: this._getCurveDescription(thresholdPosition, rigidityLevel, 'en'),
      description_es: this._getCurveDescription(thresholdPosition, rigidityLevel, 'es')
    };
  }

  /**
   * Get curve description
   * @private
   */
  _getCurveDescription(thresholdPosition, rigidityLevel, language) {
    const descriptions = {
      en: {
        threshold: {
          low: 'Shifts to right pole easily',
          high: 'Maintains left pole strongly',
          moderate: 'Balanced position'
        },
        rigidity: {
          very_rigid: 'with very sharp transition',
          rigid: 'with clear transition',
          flexible: 'with gradual transition',
          very_flexible: 'with very gradual transition'
        }
      },
      es: {
        threshold: {
          low: 'Cambia al polo derecho facilmente',
          high: 'Mantiene el polo izquierdo fuertemente',
          moderate: 'Posicion equilibrada'
        },
        rigidity: {
          very_rigid: 'con transicion muy abrupta',
          rigid: 'con transicion clara',
          flexible: 'con transicion gradual',
          very_flexible: 'con transicion muy gradual'
        }
      }
    };

    const lang = descriptions[language] || descriptions.en;
    return `${lang.threshold[thresholdPosition]} ${lang.rigidity[rigidityLevel]}`;
  }

  /**
   * Generate X axis configuration
   * @private
   */
  _generateXAxis(language) {
    return {
      min: 0,
      max: 1,
      ticks: [0, 0.25, 0.5, 0.75, 1],
      labels: language === 'es'
        ? ['Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta']
        : ['Very low', 'Low', 'Medium', 'High', 'Very high'],
      title: language === 'es' ? 'Presion hacia polo derecho' : 'Pressure toward right pole'
    };
  }

  /**
   * Generate Y axis configuration
   * @private
   */
  _generateYAxis(language) {
    return {
      min: 0,
      max: 1,
      ticks: [0, 0.25, 0.5, 0.75, 1],
      labels: ['0%', '25%', '50%', '75%', '100%'],
      title: language === 'es'
        ? 'Probabilidad de elegir polo derecho'
        : 'Probability of choosing right pole'
    };
  }

  /**
   * Generate pressure level annotations
   * @private
   */
  _generatePressureAnnotations(language) {
    const labels = language === 'es'
      ? { L1: 'Ancla baja', L3: 'Punto medio', L5: 'Ancla alta' }
      : { L1: 'Low anchor', L3: 'Midpoint', L5: 'High anchor' };

    return [
      { x: 0.15, label: labels.L1, style: 'dashed' },
      { x: 0.50, label: labels.L3, style: 'dashed' },
      { x: 0.85, label: labels.L5, style: 'dashed' }
    ];
  }

  /**
   * Generate comparison of two agents' curves
   * @param {Object} score1
   * @param {Object} score2
   * @param {Object} axisInfo
   * @param {Object} options
   * @returns {Object}
   */
  generateComparison(score1, score2, axisInfo, options = {}) {
    const baseData = this.generate([score1, score2], axisInfo, options);

    // Calculate difference metrics
    const bDiff = Math.abs(score1.b - score2.b);
    const aDiff = Math.abs(score1.a - score2.a);

    // Statistical significance of difference
    const pooledSE = Math.sqrt(
      Math.pow(score1.se_b, 2) + Math.pow(score2.se_b, 2)
    );
    const zScore = bDiff / pooledSE;
    const significant = zScore > 1.96;  // 95% confidence

    // Crossover point (where curves intersect)
    let crossoverPoint = null;
    if (score1.a !== score2.a || score1.b !== score2.b) {
      // Simplified calculation - actual would solve the equation
      for (let x = 0; x <= 1; x += 0.01) {
        const y1 = this._sigmoid(score1.a * (x - score1.b));
        const y2 = this._sigmoid(score2.a * (x - score2.b));
        if (Math.abs(y1 - y2) < 0.01) {
          crossoverPoint = { x, y: y1 };
          break;
        }
      }
    }

    return {
      ...baseData,
      comparison: {
        agent_1: score1.agent_id,
        agent_2: score2.agent_id,
        threshold_difference: bDiff,
        rigidity_difference: aDiff,
        statistically_significant: significant,
        z_score: zScore,
        crossover_point: crossoverPoint
      }
    };
  }
}

module.exports = { ThresholdCurvesGenerator };
