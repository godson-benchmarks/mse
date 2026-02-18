/**
 * MSE v3.0 - Population Analyzer
 *
 * Performs population-level analysis across multiple agent profiles:
 * - Population-level Spearman coupling of b-vectors across agents
 * - Geometry analysis (delegates to ProfileGeometryAnalyzer)
 * - Summary statistics with power assessment and recommended analyses
 *
 * Power thresholds:
 *   < 10 agents  = basic descriptive statistics only
 *   10-49 agents = coupling with stability warnings
 *   50-74 agents = full analysis suite
 *   75+ agents   = PCA-ready (sufficient for stable factor extraction)
 *
 * This module is the main entry point for any cross-agent analysis.
 * Individual agent coupling (within-agent across axes) is handled
 * by CouplingAnalyzer; this module handles between-agent patterns.
 */

'use strict';

const { spearmanCorrelation } = require('./coupling');
const { ProfileGeometryAnalyzer } = require('./geometry');

class PopulationAnalyzer {
  /**
   * @param {Object} options
   * @param {number} options.minAgentsBasic - Minimum for any analysis (default: 3)
   * @param {number} options.minAgentsCoupling - Minimum for coupling (default: 10)
   * @param {number} options.minAgentsFull - Minimum for full analysis (default: 50)
   * @param {number} options.minAgentsPCA - Minimum for PCA readiness (default: 75)
   */
  constructor(options = {}) {
    this.minAgentsBasic = options.minAgentsBasic || 3;
    this.minAgentsCoupling = options.minAgentsCoupling || 10;
    this.minAgentsFull = options.minAgentsFull || 50;
    this.minAgentsPCA = options.minAgentsPCA || 75;
    this.geometryAnalyzer = new ProfileGeometryAnalyzer({
      minAgents: this.minAgentsCoupling
    });
  }

  /**
   * Extract b-vectors from agent profiles.
   * @param {Object[]} agentProfiles - Array of MSE agent profiles
   * @returns {Object[]} Array of {axis_code: b_value} objects
   */
  _extractBVectors(agentProfiles) {
    return agentProfiles.map(profile => {
      const vec = {};
      if (profile.axes) {
        for (const [code, data] of Object.entries(profile.axes)) {
          if (data && typeof data.b === 'number') {
            vec[code] = data.b;
          }
        }
      }
      return vec;
    }).filter(vec => Object.keys(vec).length > 0);
  }

  /**
   * Compute population-level Spearman coupling matrix from agent b-vectors.
   * Measures how axes co-vary across the agent population: if agents with
   * high autonomy thresholds also tend to have high privacy thresholds,
   * those axes are population-coupled.
   *
   * @param {Object[]} agentProfiles - Array of MSE agent profiles
   * @returns {Object} Population coupling result
   */
  analyzeCoupling(agentProfiles) {
    const bVectors = this._extractBVectors(agentProfiles);
    const nAgents = bVectors.length;

    if (nAgents < this.minAgentsBasic) {
      return this._defaultCouplingResult(nAgents);
    }

    // Collect axis codes
    const axisSet = new Set();
    for (const vec of bVectors) {
      for (const code of Object.keys(vec)) {
        axisSet.add(code);
      }
    }
    const axisCodes = Array.from(axisSet).sort();

    if (axisCodes.length < 2) {
      return this._defaultCouplingResult(nAgents);
    }

    // Compute pairwise Spearman correlations
    const n = axisCodes.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        const xVals = [];
        const yVals = [];
        for (const vec of bVectors) {
          const xi = vec[axisCodes[i]];
          const xj = vec[axisCodes[j]];
          if (xi !== undefined && xj !== undefined) {
            xVals.push(xi);
            yVals.push(xj);
          }
        }

        const rho = xVals.length >= 3 ? round4(spearmanCorrelation(xVals, yVals)) : 0;
        matrix[i][j] = rho;
        matrix[j][i] = rho;
      }
    }

    // Extract top couplings
    const pairs = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push({
          axis_a: axisCodes[i],
          axis_b: axisCodes[j],
          rho: matrix[i][j]
        });
      }
    }
    pairs.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

    const warnings = [];
    if (nAgents < this.minAgentsCoupling) {
      warnings.push(`Very small sample (n=${nAgents}). Population coupling estimates are unreliable.`);
    } else if (nAgents < this.minAgentsFull) {
      warnings.push(`Small sample (n=${nAgents}). Population coupling may be unstable; recommend n >= ${this.minAgentsFull}.`);
    }

    return {
      coupling_matrix: matrix,
      axis_codes: axisCodes,
      top_couplings: pairs.slice(0, 10),
      metadata: {
        n_agents: nAgents,
        n_axes: axisCodes.length,
        method: 'population_spearman',
        warnings
      }
    };
  }

  /**
   * Analyze geometry of the agent population.
   * Delegates to ProfileGeometryAnalyzer.
   *
   * @param {Object[]} agentProfiles - Array of MSE agent profiles
   * @returns {Object|null} Geometry result
   */
  analyzeGeometry(agentProfiles) {
    const bVectors = this._extractBVectors(agentProfiles);
    return this.geometryAnalyzer.analyze(bVectors);
  }

  /**
   * Get a comprehensive population summary with power assessment.
   *
   * @param {Object[]} agentProfiles - Array of MSE agent profiles
   * @returns {Object} Summary with n_agents, power_assessment, recommended_analyses
   */
  getPopulationSummary(agentProfiles) {
    const bVectors = this._extractBVectors(agentProfiles);
    const nAgents = bVectors.length;

    let powerLevel;
    const recommendedAnalyses = [];

    if (nAgents < this.minAgentsBasic) {
      powerLevel = 'insufficient';
    } else if (nAgents < this.minAgentsCoupling) {
      powerLevel = 'basic';
      recommendedAnalyses.push('descriptive_statistics');
    } else if (nAgents < this.minAgentsFull) {
      powerLevel = 'coupling_with_warnings';
      recommendedAnalyses.push('descriptive_statistics', 'population_coupling', 'geometry');
    } else if (nAgents < this.minAgentsPCA) {
      powerLevel = 'full';
      recommendedAnalyses.push('descriptive_statistics', 'population_coupling', 'geometry', 'bimodality_analysis');
    } else {
      powerLevel = 'pca_ready';
      recommendedAnalyses.push('descriptive_statistics', 'population_coupling', 'geometry', 'bimodality_analysis', 'pca');
    }

    // Compute basic descriptive stats if we have enough agents
    let descriptive = null;
    if (nAgents >= this.minAgentsBasic) {
      const axisSet = new Set();
      for (const vec of bVectors) {
        for (const code of Object.keys(vec)) axisSet.add(code);
      }
      const axisCodes = Array.from(axisSet).sort();

      descriptive = {};
      for (const code of axisCodes) {
        const values = bVectors
          .map(v => v[code])
          .filter(v => v !== undefined && v !== null);

        if (values.length < 2) continue;

        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);

        descriptive[code] = {
          mean: round4(mean),
          std: round4(Math.sqrt(variance)),
          min: round4(Math.min(...values)),
          max: round4(Math.max(...values)),
          n: values.length
        };
      }
    }

    return {
      n_agents: nAgents,
      power_assessment: powerLevel,
      recommended_analyses: recommendedAnalyses,
      descriptive,
      thresholds: {
        basic: this.minAgentsBasic,
        coupling: this.minAgentsCoupling,
        full: this.minAgentsFull,
        pca: this.minAgentsPCA
      }
    };
  }

  _defaultCouplingResult(nAgents) {
    return {
      coupling_matrix: [],
      axis_codes: [],
      top_couplings: [],
      metadata: {
        n_agents: nAgents,
        n_axes: 0,
        method: 'population_spearman',
        warnings: ['Insufficient agents for population coupling analysis.']
      }
    };
  }
}

function round4(value) {
  if (value === null || value === undefined) return value;
  return Math.round(value * 10000) / 10000;
}

module.exports = { PopulationAnalyzer };
