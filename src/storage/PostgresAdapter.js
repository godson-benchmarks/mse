/**
 * MSE - PostgreSQL Storage Adapter
 *
 * PostgreSQL implementation of MSEStorageAdapter.
 * Handles all database operations for the Moral Spectrometry Engine.
 *
 * Phase 0.3 Complete: All agent JOINs use SubjectProvider for decoupling.
 * Phase 0.4 Complete: Extracted from MSERepository, now implements adapter pattern.
 */

const MSEStorageAdapter = require('./MSEStorageAdapter');

class PostgresAdapter extends MSEStorageAdapter {
  /**
   * @param {Object} db - PostgreSQL database pool/client
   * @param {SubjectProvider} subjectProvider - Optional provider for subject/agent data
   */
  constructor(db, subjectProvider = null) {
    super(db, subjectProvider);
  }

  // ==========================================
  // AXES
  // ==========================================

  /**
   * Get all active axes
   * @returns {Promise<Object[]>}
   */
  async getAxes() {
    const query = `
      SELECT *
      FROM mse_axes
      WHERE is_active = true
      ORDER BY display_order, id
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Get axis by ID
   * @param {number} axisId
   * @returns {Promise<Object|null>}
   */
  async getAxis(axisId) {
    const query = `SELECT * FROM mse_axes WHERE id = $1`;
    const result = await this.db.query(query, [axisId]);
    return result.rows[0] || null;
  }

  /**
   * Get axis by code
   * @param {string} code
   * @returns {Promise<Object|null>}
   */
  async getAxisByCode(code) {
    const query = `SELECT * FROM mse_axes WHERE code = $1`;
    const result = await this.db.query(query, [code]);
    return result.rows[0] || null;
  }

  // ==========================================
  // EVALUATION RUNS
  // ==========================================

  /**
   * Create a new evaluation run
   * @param {string} agentId
   * @param {Object} config
   * @param {number} examVersionId - Exam version ID (optional, defaults to current)
   * @returns {Promise<string>} Run ID
   */
  async createRun(agentId, config, examVersionId = null) {
    // If no version specified, use current version
    let versionId = examVersionId;
    if (!versionId) {
      const currentVersion = await this.getCurrentExamVersion();
      versionId = currentVersion?.id || null;
    }

    const query = `
      INSERT INTO mse_evaluation_runs (agent_id, config, status, exam_version_id, started_at)
      VALUES ($1, $2, 'in_progress', $3, NOW())
      RETURNING id
    `;
    const result = await this.db.query(query, [agentId, JSON.stringify(config), versionId]);
    return result.rows[0].id;
  }

  /**
   * Get a run by ID
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getRun(runId) {
    const query = `
      SELECT er.*
      FROM mse_evaluation_runs er
      WHERE er.id = $1
    `;
    const result = await this.db.query(query, [runId]);
    const run = result.rows[0] || null;

    // Enrich with subject data if available
    return await this._enrichWithSubject(run);
  }

  /**
   * Get run with all responses
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getRunWithResponses(runId) {
    const run = await this.getRun(runId);
    if (!run) return null;

    const responses = await this.getResponses(runId);
    const axisScores = await this.getAxisScores(runId);
    const proceduralScores = await this.getProceduralScores(runId);

    return {
      ...run,
      responses,
      axis_scores: axisScores,
      procedural_scores: proceduralScores
    };
  }

  /**
   * Get runs by agent
   * @param {string} agentId
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getRunsByAgent(agentId, options = {}) {
    const { limit = 10, offset = 0, status = null } = options;

    let query = `
      SELECT r.*,
             COALESCE(rc.response_count, 0) as response_count
      FROM mse_evaluation_runs r
      LEFT JOIN (
        SELECT run_id, COUNT(*) as response_count
        FROM mse_responses
        GROUP BY run_id
      ) rc ON rc.run_id = r.id
      WHERE r.agent_id = $1
    `;
    const params = [agentId];

    if (status) {
      query += ` AND r.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY r.started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get active (in_progress) evaluation for an agent
   * Used for auto-resume functionality
   * @param {string} agentId
   * @returns {Promise<Object|null>}
   */
  async getActiveRun(agentId) {
    const query = `
      SELECT
        er.*,
        (SELECT COUNT(*) FROM mse_responses WHERE run_id = er.id) as response_count
      FROM mse_evaluation_runs er
      WHERE er.agent_id = $1 AND er.status = 'in_progress'
      ORDER BY er.started_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(query, [agentId]);
    const run = result.rows[0] || null;

    // Enrich with subject data if available
    return await this._enrichWithSubject(run);
  }

  /**
   * Count active evaluations for an agent
   * @param {string} agentId
   * @returns {Promise<number>}
   */
  async countActiveRuns(agentId) {
    const query = `
      SELECT COUNT(*) as count
      FROM mse_evaluation_runs
      WHERE agent_id = $1 AND status = 'in_progress'
    `;
    const result = await this.db.query(query, [agentId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Update run status
   * @param {string} runId
   * @param {string} status
   * @param {string} errorMessage
   */
  async updateRunStatus(runId, status, errorMessage = null) {
    const isFinalStatus = ['completed', 'cancelled', 'error'].includes(status);
    const query = isFinalStatus
      ? `UPDATE mse_evaluation_runs SET status = $2, completed_at = NOW(), error_message = $3 WHERE id = $1`
      : `UPDATE mse_evaluation_runs SET status = $2, error_message = $3 WHERE id = $1`;
    await this.db.query(query, [runId, status, errorMessage]);
  }

  /**
   * Update run progress
   * @param {string} runId
   * @param {number} currentAxis
   * @param {number} itemsPresented
   */
  async updateRunProgress(runId, currentAxis, itemsPresented) {
    const query = `
      UPDATE mse_evaluation_runs
      SET current_axis = $2, items_presented = $3
      WHERE id = $1
    `;
    await this.db.query(query, [runId, currentAxis, itemsPresented]);
  }

  // ==========================================
  // RESPONSES
  // ==========================================

  /**
   * Save a response
   * @param {Object} response
   * @returns {Promise<string>} Response ID
   */
  async saveResponse(response) {
    const query = `
      INSERT INTO mse_responses (
        run_id, item_id, choice, forced_choice, permissibility,
        confidence, principles, rationale, info_needed, response_time_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const result = await this.db.query(query, [
      response.run_id,
      response.item_id,
      response.choice,
      response.forced_choice,
      response.permissibility,
      response.confidence,
      response.principles,
      response.rationale,
      response.info_needed,
      response.response_time_ms
    ]);
    return result.rows[0].id;
  }

  /**
   * Get all responses for a run
   * @param {string} runId
   * @returns {Promise<Object[]>}
   */
  async getResponses(runId) {
    const query = `
      SELECT
        r.*,
        di.axis_id,
        di.pressure_level,
        di.family_id
      FROM mse_responses r
      JOIN mse_dilemma_items di ON r.item_id = di.id
      WHERE r.run_id = $1
      ORDER BY r.created_at ASC
    `;
    const result = await this.db.query(query, [runId]);
    return result.rows.map(row => ({
      ...row,
      pressure_level: parseFloat(row.pressure_level)
    }));
  }

  /**
   * Get responses for a specific axis in a run
   * @param {string} runId
   * @param {number} axisId
   * @returns {Promise<Object[]>}
   */
  async getResponsesForAxis(runId, axisId) {
    const query = `
      SELECT
        r.*,
        di.pressure_level,
        di.family_id
      FROM mse_responses r
      JOIN mse_dilemma_items di ON r.item_id = di.id
      WHERE r.run_id = $1 AND di.axis_id = $2
      ORDER BY r.created_at ASC
    `;
    const result = await this.db.query(query, [runId, axisId]);
    return result.rows.map(row => ({
      ...row,
      pressure_level: parseFloat(row.pressure_level)
    }));
  }

  // ==========================================
  // AXIS SCORES
  // ==========================================

  /**
   * Save axis score
   * @param {string} runId
   * @param {Object} score
   */
  async saveAxisScore(runId, score) {
    const query = `
      INSERT INTO mse_axis_scores (run_id, axis_id, b, a, se_b, n_items, flags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (run_id, axis_id)
      DO UPDATE SET b = $3, a = $4, se_b = $5, n_items = $6, flags = $7
    `;
    await this.db.query(query, [
      runId,
      score.axis_id,
      score.b,
      score.a,
      score.se_b,
      score.n_items,
      score.flags
    ]);
  }

  /**
   * Get axis scores for a run
   * @param {string} runId
   * @returns {Promise<Object[]>}
   */
  async getAxisScores(runId) {
    const query = `
      SELECT
        s.*,
        a.code as axis_code,
        a.name as axis_name,
        a.name_es as axis_name_es,
        a.pole_left,
        a.pole_left_es,
        a.pole_right,
        a.pole_right_es,
        a.category
      FROM mse_axis_scores s
      JOIN mse_axes a ON s.axis_id = a.id
      WHERE s.run_id = $1
      ORDER BY a.display_order, a.id
    `;
    const result = await this.db.query(query, [runId]);
    return result.rows.map(row => ({
      ...row,
      b: parseFloat(row.b),
      a: parseFloat(row.a),
      se_b: parseFloat(row.se_b)
    }));
  }

  // ==========================================
  // PROCEDURAL SCORES
  // ==========================================

  /**
   * Save procedural scores
   * @param {string} runId
   * @param {Object} scores
   */
  async saveProceduralScores(runId, scores) {
    const query = `
      INSERT INTO mse_procedural_scores (
        run_id, moral_sensitivity, info_seeking, calibration,
        consistency, pressure_robustness, transparency
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (run_id)
      DO UPDATE SET
        moral_sensitivity = $2,
        info_seeking = $3,
        calibration = $4,
        consistency = $5,
        pressure_robustness = $6,
        transparency = $7
    `;
    await this.db.query(query, [
      runId,
      scores.moral_sensitivity,
      scores.info_seeking,
      scores.calibration,
      scores.consistency,
      scores.pressure_robustness,
      scores.transparency
    ]);
  }

  /**
   * Get procedural scores for a run
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getProceduralScores(runId) {
    const query = `SELECT * FROM mse_procedural_scores WHERE run_id = $1`;
    const result = await this.db.query(query, [runId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      moral_sensitivity: row.moral_sensitivity ? parseFloat(row.moral_sensitivity) : null,
      info_seeking: row.info_seeking ? parseFloat(row.info_seeking) : null,
      calibration: row.calibration ? parseFloat(row.calibration) : null,
      consistency: row.consistency ? parseFloat(row.consistency) : null,
      pressure_robustness: row.pressure_robustness ? parseFloat(row.pressure_robustness) : null,
      transparency: row.transparency ? parseFloat(row.transparency) : null
    };
  }

  // ==========================================
  // PROFILE SNAPSHOTS
  // ==========================================

  /**
   * Create a profile snapshot
   * @param {string} agentId
   * @param {string} runId
   * @param {Object} profile
   * @param {number} examVersionId - Exam version ID (optional)
   * @param {string} examVersionCode - Exam version code (optional)
   */
  async createSnapshot(agentId, runId, profile, examVersionId = null, examVersionCode = null) {
    // Calculate summary metrics
    const axisValues = Object.values(profile.axes);
    const avgThreshold = axisValues.reduce((sum, a) => sum + a.b, 0) / axisValues.length;
    const avgRigidity = axisValues.reduce((sum, a) => sum + a.a, 0) / axisValues.length;

    const query = `
      INSERT INTO mse_profile_snapshots (
        agent_id, run_id, snapshot_date, profile_vector,
        procedural_scores, avg_threshold, avg_rigidity,
        exam_version_id, exam_version_code
      )
      VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
    `;
    await this.db.query(query, [
      agentId,
      runId,
      JSON.stringify(profile.axes),
      JSON.stringify(profile.procedural),
      avgThreshold,
      avgRigidity,
      examVersionId,
      examVersionCode
    ]);
  }

  /**
   * Get latest snapshot for an agent
   * @param {string} agentId
   * @returns {Promise<Object|null>}
   */
  async getLatestSnapshot(agentId) {
    const query = `
      SELECT *
      FROM mse_profile_snapshots
      WHERE agent_id = $1
      ORDER BY snapshot_date DESC, created_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(query, [agentId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      profile_vector: row.profile_vector,
      procedural_scores: row.procedural_scores,
      avg_threshold: parseFloat(row.avg_threshold),
      avg_rigidity: parseFloat(row.avg_rigidity)
    };
  }

  /**
   * Get snapshot history for an agent
   * @param {string} agentId
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getSnapshotHistory(agentId, options = {}) {
    const { limit = 10, startDate = null, endDate = null } = options;

    let query = `
      SELECT *
      FROM mse_profile_snapshots
      WHERE agent_id = $1
    `;
    const params = [agentId];

    if (startDate) {
      query += ` AND snapshot_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND snapshot_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY snapshot_date DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      ...row,
      profile_vector: row.profile_vector,
      procedural_scores: row.procedural_scores,
      avg_threshold: parseFloat(row.avg_threshold),
      avg_rigidity: parseFloat(row.avg_rigidity)
    }));
  }

  // ==========================================
  // DILEMMA ITEMS (read operations)
  // ==========================================

  /**
   * Get item by ID
   * @param {string} itemId
   * @returns {Promise<Object|null>}
   */
  async getItem(itemId) {
    const query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es
      FROM mse_dilemma_items di
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.id = $1
    `;
    const result = await this.db.query(query, [itemId]);
    return result.rows[0] || null;
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get agent statistics
   * @param {string} agentId
   * @returns {Promise<Object>}
   */
  async getAgentStats(agentId) {
    const runsQuery = `
      SELECT
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_runs,
        MIN(started_at) as first_evaluation,
        MAX(completed_at) as last_evaluation
      FROM mse_evaluation_runs
      WHERE agent_id = $1
    `;

    const responsesQuery = `
      SELECT COUNT(*) as total_responses
      FROM mse_responses r
      JOIN mse_evaluation_runs er ON r.run_id = er.id
      WHERE er.agent_id = $1
    `;

    const [runsResult, responsesResult] = await Promise.all([
      this.db.query(runsQuery, [agentId]),
      this.db.query(responsesQuery, [agentId])
    ]);

    return {
      ...runsResult.rows[0],
      total_responses: parseInt(responsesResult.rows[0].total_responses, 10)
    };
  }

  /**
   * Get the latest run with responses for an agent (completed or in progress)
   * Used for partial profile calculation
   * @param {string} agentId
   * @returns {Promise<Object|null>}
   */
  async getLatestRunWithResponses(agentId) {
    // Get the most recent run regardless of status
    const runQuery = `
      SELECT er.*
      FROM mse_evaluation_runs er
      WHERE er.agent_id = $1
      ORDER BY er.started_at DESC
      LIMIT 1
    `;
    const runResult = await this.db.query(runQuery, [agentId]);

    if (runResult.rows.length === 0) return null;

    let run = runResult.rows[0];

    // Enrich with subject data if available
    run = await this._enrichWithSubject(run);

    // Get responses and scores
    const responses = await this.getResponses(run.id);
    const axisScores = await this.getAxisScores(run.id);
    const proceduralScores = await this.getProceduralScores(run.id);

    return {
      ...run,
      responses,
      axis_scores: axisScores,
      procedural_scores: proceduralScores
    };
  }

  /**
   * Get global statistics
   * @returns {Promise<Object>}
   */
  async getGlobalStats() {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM mse_evaluation_runs) as total_runs,
        (SELECT COUNT(*) FROM mse_evaluation_runs WHERE status = 'completed') as completed_runs,
        (SELECT COUNT(DISTINCT agent_id) FROM mse_evaluation_runs) as unique_agents,
        (SELECT COUNT(*) FROM mse_responses) as total_responses,
        (SELECT COUNT(*) FROM mse_dilemma_items WHERE is_active = true) as active_items
    `;

    const result = await this.db.query(query);
    return result.rows[0];
  }

  /**
   * Get aggregate MSE statistics across all agents
   * Computes average threshold (b) values per axis and overall
   * Includes both completed and partial evaluations
   * Falls back to response-based estimates when no axis scores exist
   * @returns {Promise<Object>}
   */
  async getAggregateStats() {
    // Get per-axis aggregates from completed scores (direct agent evaluations)
    const axisStatsQuery = `
      SELECT
        a.id as axis_id,
        a.code as axis_code,
        a.name as axis_name,
        a.name_es as axis_name_es,
        a.pole_left,
        a.pole_left_es,
        a.pole_right,
        a.pole_right_es,
        a.category,
        a.display_order,
        COUNT(DISTINCT s.run_id) as sample_count,
        AVG(s.b) as avg_threshold,
        STDDEV(s.b) as std_threshold,
        MIN(s.b) as min_threshold,
        MAX(s.b) as max_threshold,
        AVG(s.a) as avg_rigidity,
        AVG(s.se_b) as avg_uncertainty
      FROM mse_axes a
      LEFT JOIN mse_axis_scores s ON s.axis_id = a.id
      WHERE a.is_active = true
      GROUP BY a.id, a.code, a.name, a.name_es, a.pole_left, a.pole_left_es,
               a.pole_right, a.pole_right_es, a.category, a.display_order
      ORDER BY a.display_order, a.id
    `;

    // Get overall aggregate stats from direct agent evaluations
    const overallStatsQuery = `
      SELECT
        COUNT(DISTINCT er.agent_id) as total_agents_evaluated,
        COUNT(DISTINCT er.id) as total_evaluations,
        COUNT(DISTINCT CASE WHEN er.status = 'completed' THEN er.id END) as completed_evaluations,
        COUNT(DISTINCT CASE WHEN er.status = 'in_progress' THEN er.id END) as in_progress_evaluations,
        AVG(s.b) as overall_avg_threshold,
        STDDEV(s.b) as overall_std_threshold,
        AVG(s.a) as overall_avg_rigidity,
        AVG(s.se_b) as overall_avg_uncertainty,
        COUNT(s.id) as total_axis_scores
      FROM mse_evaluation_runs er
      LEFT JOIN mse_axis_scores s ON er.id = s.run_id
    `;

    // Get total responses count
    const responsesCountQuery = `
      SELECT
        (SELECT COUNT(*) FROM mse_responses) as agent_responses
    `;

    // Get response-based estimates per axis (for partial agent evaluations)
    const responseEstimatesQuery = `
      SELECT
        a.id as axis_id,
        a.code as axis_code,
        COUNT(r.id) as response_count,
        AVG(CASE
          WHEN r.forced_choice = 'A' THEN di.pressure_level
          WHEN r.forced_choice = 'B' THEN 1.0 - di.pressure_level
          ELSE 0.5
        END) as estimated_threshold,
        AVG(r.permissibility) / 100.0 as avg_permissibility
      FROM mse_axes a
      LEFT JOIN mse_dilemma_items di ON di.axis_id = a.id
      LEFT JOIN mse_responses r ON r.item_id = di.id
      WHERE a.is_active = true
      GROUP BY a.id, a.code
      HAVING COUNT(r.id) > 0
    `;

    // Get distribution of thresholds (for histogram) from direct scores
    const distributionQuery = `
      SELECT
        CASE
          WHEN b < 0.2 THEN 'very_low'
          WHEN b < 0.4 THEN 'low'
          WHEN b < 0.6 THEN 'balanced'
          WHEN b < 0.8 THEN 'high'
          ELSE 'very_high'
        END as threshold_band,
        COUNT(*) as count
      FROM mse_axis_scores
      GROUP BY 1
      ORDER BY
        MIN(b)
    `;

    // Get external model profiles (latest per model, completed evaluations only)
    // NOTE: External model profiles and proxy evaluation system removed for open source release
    // These were Godson-specific features for evaluating API-only models via proxy
    // Implementers can extend the system by:
    // 1. Creating external_model_profiles and proxy_evaluation_jobs tables
    // 2. Re-enabling these queries to include external evaluation stats

    const [axisStatsResult, overallStatsResult, responsesCountResult, responseEstimatesResult, distributionResult] = await Promise.all([
      this.db.query(axisStatsQuery),
      this.db.query(overallStatsQuery),
      this.db.query(responsesCountQuery),
      this.db.query(responseEstimatesQuery),
      this.db.query(distributionQuery)
    ]);

    const overallStats = overallStatsResult.rows[0];
    const responsesCount = responsesCountResult.rows[0];
    const totalResponses = parseInt(responsesCount.agent_responses, 10) || 0;

    // Create a map of response-based estimates
    const responseEstimates = {};
    responseEstimatesResult.rows.forEach(row => {
      responseEstimates[row.axis_id] = {
        responseCount: parseInt(row.response_count, 10),
        estimatedThreshold: row.estimated_threshold ? parseFloat(row.estimated_threshold) : null,
        avgPermissibility: row.avg_permissibility ? parseFloat(row.avg_permissibility) : null
      };
    });

    // Calculate overall average threshold from completed scores
    let overallAvgThreshold = null;
    let dataSource = 'completed_scores';

    if (overallStats.overall_avg_threshold !== null) {
      overallAvgThreshold = parseFloat(overallStats.overall_avg_threshold);
    } else if (responseEstimatesResult.rows.length > 0) {
      // Fall back to response-based estimates if no completed scores
      const estimates = responseEstimatesResult.rows
        .filter(r => r.estimated_threshold !== null)
        .map(r => parseFloat(r.estimated_threshold));
      if (estimates.length > 0) {
        overallAvgThreshold = estimates.reduce((a, b) => a + b, 0) / estimates.length;
        dataSource = 'response_estimates';
      }
    }

    // Build axes array from direct scores
    const axes = axisStatsResult.rows.map(row => {
      const estimate = responseEstimates[row.axis_id];
      const hasCompletedScores = parseInt(row.sample_count, 10) > 0;

      let avgThreshold = null;
      let avgRigidity = null;
      let avgUncertainty = null;
      let sampleCount = 0;
      let minThreshold = null;
      let maxThreshold = null;
      let stdThreshold = null;
      let isEstimate = false;

      if (hasCompletedScores) {
        avgThreshold = row.avg_threshold ? parseFloat(row.avg_threshold) : null;
        sampleCount = parseInt(row.sample_count, 10);
        minThreshold = row.min_threshold ? parseFloat(row.min_threshold) : null;
        maxThreshold = row.max_threshold ? parseFloat(row.max_threshold) : null;
        stdThreshold = row.std_threshold ? parseFloat(row.std_threshold) : null;
        avgRigidity = row.avg_rigidity ? parseFloat(row.avg_rigidity) : null;
        avgUncertainty = row.avg_uncertainty ? parseFloat(row.avg_uncertainty) : null;
      } else if (estimate?.estimatedThreshold != null) {
        avgThreshold = estimate.estimatedThreshold;
        sampleCount = estimate.responseCount;
        isEstimate = true;
      }

      return {
        axisId: row.axis_id,
        axisCode: row.axis_code,
        axisName: row.axis_name,
        axisNameEs: row.axis_name_es,
        poleLeft: row.pole_left,
        poleLeftEs: row.pole_left_es,
        poleRight: row.pole_right,
        poleRightEs: row.pole_right_es,
        category: row.category,
        sampleCount,
        avgThreshold,
        stdThreshold,
        minThreshold,
        maxThreshold,
        avgRigidity,
        avgUncertainty,
        isEstimate,
        responseCount: estimate?.responseCount || 0
      };
    });

    // Build distribution data
    const distribution = distributionResult.rows.reduce((acc, row) => {
      acc[row.threshold_band] = parseInt(row.count, 10);
      return acc;
    }, {});

    const totalAgents = (parseInt(overallStats.total_agents_evaluated, 10) || 0);
    const totalEvals = (parseInt(overallStats.total_evaluations, 10) || 0);
    const completedEvals = (parseInt(overallStats.completed_evaluations, 10) || 0);
    const inProgressEvals = (parseInt(overallStats.in_progress_evaluations, 10) || 0);

    return {
      overall: {
        totalAgentsEvaluated: totalAgents,
        totalEvaluations: totalEvals,
        completedEvaluations: completedEvals,
        inProgressEvaluations: inProgressEvals,
        totalResponses: totalResponses,
        avgThreshold: overallAvgThreshold,
        stdThreshold: overallStats.overall_std_threshold ? parseFloat(overallStats.overall_std_threshold) : null,
        avgRigidity: overallStats.overall_avg_rigidity ? parseFloat(overallStats.overall_avg_rigidity) : null,
        avgUncertainty: overallStats.overall_avg_uncertainty ? parseFloat(overallStats.overall_avg_uncertainty) : null,
        totalAxisScores: (parseInt(overallStats.total_axis_scores, 10) || 0),
        dataSource: dataSource
      },
      axes: axes,
      distribution: distribution
    };
  }

  // ==========================================
  // EXAM VERSIONS
  // ==========================================

  /**
   * Get current (active default) exam version
   * @returns {Promise<Object|null>}
   */
  async getCurrentExamVersion() {
    const query = `
      SELECT * FROM mse_exam_versions
      WHERE is_current = true
      LIMIT 1
    `;
    const result = await this.db.query(query);
    return result.rows[0] || null;
  }

  /**
   * Get exam version by code
   * @param {string} code
   * @returns {Promise<Object|null>}
   */
  async getExamVersionByCode(code) {
    const query = `SELECT * FROM mse_exam_versions WHERE code = $1`;
    const result = await this.db.query(query, [code]);
    return result.rows[0] || null;
  }

  /**
   * Get exam version by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getExamVersionById(id) {
    const query = `SELECT * FROM mse_exam_versions WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get all exam versions
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getExamVersions(options = {}) {
    const { includeRetired = false, includeItemCount = false } = options;

    let query = `
      SELECT
        v.*
        ${includeItemCount ? ', (SELECT COUNT(*) FROM mse_version_items WHERE version_id = v.id) as item_count' : ''}
      FROM mse_exam_versions v
      WHERE 1=1
      ${includeRetired ? '' : "AND v.status != 'retired'"}
      ORDER BY v.released_at DESC NULLS LAST, v.created_at DESC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Get item counts per axis for a version
   * @param {number} versionId
   * @returns {Promise<Object[]>}
   */
  async getVersionItemCounts(versionId) {
    const query = `
      SELECT
        a.id as axis_id,
        a.code as axis_code,
        a.name as axis_name,
        a.name_es as axis_name_es,
        COUNT(vi.item_id) as item_count,
        COUNT(vi.item_id) FILTER (WHERE di.is_anchor = true) as anchor_count
      FROM mse_axes a
      LEFT JOIN mse_version_items vi ON vi.version_id = $1
      LEFT JOIN mse_dilemma_items di ON vi.item_id = di.id AND di.axis_id = a.id
      WHERE a.is_active = true
      GROUP BY a.id, a.code, a.name, a.name_es
      ORDER BY a.display_order, a.id
    `;

    const result = await this.db.query(query, [versionId]);
    return result.rows.map(row => ({
      axis_id: row.axis_id,
      axis_code: row.axis_code,
      axis_name: row.axis_name,
      axis_name_es: row.axis_name_es,
      item_count: parseInt(row.item_count, 10),
      anchor_count: parseInt(row.anchor_count, 10)
    }));
  }

  /**
   * Check if two versions are comparable
   * @param {string} version1Code
   * @param {string} version2Code
   * @returns {Promise<Object>}
   */
  async areVersionsComparable(version1Code, version2Code) {
    // Same version is always comparable
    if (version1Code === version2Code) {
      return { comparable: true };
    }

    const query = `
      SELECT code, comparable_with, breaking_changes
      FROM mse_exam_versions
      WHERE code IN ($1, $2)
    `;
    const result = await this.db.query(query, [version1Code, version2Code]);

    if (result.rows.length < 2) {
      return { comparable: false, reason: 'versions_not_found' };
    }

    const v1 = result.rows.find(r => r.code === version1Code);
    const v2 = result.rows.find(r => r.code === version2Code);

    // Check if either version has breaking changes
    if (v1.breaking_changes || v2.breaking_changes) {
      return { comparable: false, reason: 'breaking_changes' };
    }

    // Check if they list each other as comparable
    const v1Comparable = v1.comparable_with || [];
    const v2Comparable = v2.comparable_with || [];

    if (v1Comparable.includes(version2Code) || v2Comparable.includes(version1Code)) {
      return { comparable: true };
    }

    return { comparable: false, reason: 'not_in_comparable_list' };
  }

  /**
   * Get runs by version
   * @param {number} versionId
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getRunsByVersion(versionId, options = {}) {
    const { status = null, limit = 100 } = options;

    let query = `
      SELECT r.*
      FROM mse_evaluation_runs r
      WHERE r.exam_version_id = $1
      ${status ? 'AND r.status = $2' : ''}
      ORDER BY r.started_at DESC
      LIMIT ${status ? '$3' : '$2'}
    `;

    const params = status ? [versionId, status, limit] : [versionId, limit];
    const result = await this.db.query(query, params);

    // Enrich with subject data if available
    return await this._enrichWithSubjects(result.rows);
  }

  // ==========================================
  // v2.0: CONSISTENCY GROUPS
  // ==========================================

  /**
   * Get consistency groups for an axis (optionally filtered by version)
   * @param {number} axisId
   * @param {number} [versionId]
   * @returns {Promise<Object[]>}
   */
  async getConsistencyGroups(axisId, versionId = null) {
    let query = `
      SELECT cg.*
      FROM mse_consistency_groups cg
      WHERE cg.axis_id = $1
    `;
    const params = [axisId];

    if (versionId) {
      query += `
        AND EXISTS (
          SELECT 1 FROM mse_consistency_group_items cgi
          JOIN mse_version_items vi ON vi.item_id = cgi.item_id
          WHERE cgi.group_id = cg.id AND vi.version_id = $2
        )
      `;
      params.push(versionId);
    }

    query += ` ORDER BY cg.group_code`;
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get items in a consistency group
   * @param {number} groupId
   * @returns {Promise<Object[]>}
   */
  async getGroupItems(groupId) {
    const query = `
      SELECT
        cgi.*,
        di.prompt_en, di.prompt_es, di.pressure_level, di.params,
        di.options, di.axis_id, di.family_id, di.is_anchor,
        di.dilemma_type, di.non_obvious_factors,
        di.expert_disagreement, di.requires_residue_recognition,
        di.meta_ethical_type
      FROM mse_consistency_group_items cgi
      JOIN mse_dilemma_items di ON cgi.item_id = di.id
      WHERE cgi.group_id = $1
      ORDER BY cgi.framing
    `;
    const result = await this.db.query(query, [groupId]);
    return result.rows.map(row => ({
      ...row,
      pressure_level: parseFloat(row.pressure_level)
    }));
  }

  /**
   * Get all consistency groups with their items for a version
   * @param {number} versionId
   * @returns {Promise<Object[]>}
   */
  async getConsistencyGroupsWithItems(versionId) {
    const query = `
      SELECT
        cg.id as group_id,
        cg.group_code,
        cg.axis_id,
        cg.description,
        cgi.item_id,
        cgi.framing,
        cgi.variant_type
      FROM mse_consistency_groups cg
      JOIN mse_consistency_group_items cgi ON cgi.group_id = cg.id
      JOIN mse_version_items vi ON vi.item_id = cgi.item_id AND vi.version_id = $1
      ORDER BY cg.axis_id, cg.group_code, cgi.framing
    `;
    const result = await this.db.query(query, [versionId]);

    // Group by group_id
    const groups = {};
    for (const row of result.rows) {
      if (!groups[row.group_id]) {
        groups[row.group_id] = {
          id: row.group_id,
          group_code: row.group_code,
          axis_id: row.axis_id,
          description: row.description,
          items: []
        };
      }
      groups[row.group_id].items.push({
        item_id: row.item_id,
        framing: row.framing,
        variant_type: row.variant_type
      });
    }

    return Object.values(groups);
  }

  // ==========================================
  // v2.0: CONSISTENCY SCORES
  // ==========================================

  /**
   * Save consistency scores for a run
   * @param {string} runId
   * @param {Array} scores
   */
  async saveConsistencyScores(runId, scores) {
    for (const score of scores) {
      const query = `
        INSERT INTO mse_consistency_scores (
          run_id, group_id, permissibility_variance,
          forced_choice_agreement, confidence_variance, principle_overlap
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (run_id, group_id)
        DO UPDATE SET
          permissibility_variance = $3,
          forced_choice_agreement = $4,
          confidence_variance = $5,
          principle_overlap = $6
      `;
      await this.db.query(query, [
        runId,
        score.group_id,
        score.permissibility_variance,
        score.forced_choice_agreement,
        score.confidence_variance,
        score.principle_overlap
      ]);
    }
  }

  /**
   * Get consistency scores for a run
   * @param {string} runId
   * @returns {Promise<Object[]>}
   */
  async getConsistencyScores(runId) {
    const query = `
      SELECT cs.*, cg.group_code, cg.axis_id
      FROM mse_consistency_scores cs
      JOIN mse_consistency_groups cg ON cs.group_id = cg.id
      WHERE cs.run_id = $1
      ORDER BY cg.axis_id, cg.group_code
    `;
    const result = await this.db.query(query, [runId]);
    return result.rows.map(row => ({
      ...row,
      permissibility_variance: row.permissibility_variance ? parseFloat(row.permissibility_variance) : null,
      forced_choice_agreement: row.forced_choice_agreement ? parseFloat(row.forced_choice_agreement) : null,
      confidence_variance: row.confidence_variance ? parseFloat(row.confidence_variance) : null,
      principle_overlap: row.principle_overlap ? parseFloat(row.principle_overlap) : null
    }));
  }

  // ==========================================
  // v2.0: GAMING SCORES
  // ==========================================

  /**
   * Save gaming detection scores
   * @param {string} runId
   * @param {Object} scores
   */
  async saveGamingScores(runId, scores) {
    const query = `
      INSERT INTO mse_gaming_scores (
        run_id, g_score, response_time_uniformity, rationale_diversity,
        pattern_regularity, parameter_sensitivity, framing_susceptibility,
        consistency_score, flagged
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (run_id)
      DO UPDATE SET
        g_score = $2, response_time_uniformity = $3, rationale_diversity = $4,
        pattern_regularity = $5, parameter_sensitivity = $6, framing_susceptibility = $7,
        consistency_score = $8, flagged = $9
    `;
    await this.db.query(query, [
      runId,
      scores.g_score,
      scores.response_time_uniformity,
      scores.rationale_diversity,
      scores.pattern_regularity,
      scores.parameter_sensitivity,
      scores.framing_susceptibility,
      scores.consistency_score,
      scores.flagged
    ]);
  }

  /**
   * Get gaming scores for a run
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getGamingScores(runId) {
    const query = `SELECT * FROM mse_gaming_scores WHERE run_id = $1`;
    const result = await this.db.query(query, [runId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      g_score: row.g_score ? parseFloat(row.g_score) : null,
      response_time_uniformity: row.response_time_uniformity ? parseFloat(row.response_time_uniformity) : null,
      rationale_diversity: row.rationale_diversity ? parseFloat(row.rationale_diversity) : null,
      pattern_regularity: row.pattern_regularity ? parseFloat(row.pattern_regularity) : null,
      parameter_sensitivity: row.parameter_sensitivity ? parseFloat(row.parameter_sensitivity) : null,
      framing_susceptibility: row.framing_susceptibility ? parseFloat(row.framing_susceptibility) : null,
      consistency_score: row.consistency_score ? parseFloat(row.consistency_score) : null,
      flagged: row.flagged
    };
  }

  // ==========================================
  // v2.0: CAPACITY SCORES
  // ==========================================

  /**
   * Save capacity scores
   * @param {string} runId
   * @param {Object} scores
   */
  async saveCapacityScores(runId, scores) {
    const query = `
      INSERT INTO mse_capacity_scores (
        run_id, moral_perception, moral_imagination, moral_humility,
        moral_coherence, moral_residue, perspectival_flexibility,
        meta_ethical_awareness
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (run_id)
      DO UPDATE SET
        moral_perception = $2, moral_imagination = $3, moral_humility = $4,
        moral_coherence = $5, moral_residue = $6, perspectival_flexibility = $7,
        meta_ethical_awareness = $8
    `;
    await this.db.query(query, [
      runId,
      scores.moral_perception,
      scores.moral_imagination,
      scores.moral_humility,
      scores.moral_coherence,
      scores.moral_residue,
      scores.perspectival_flexibility,
      scores.meta_ethical_awareness
    ]);
  }

  /**
   * Get capacity scores for a run
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getCapacityScores(runId) {
    const query = `SELECT * FROM mse_capacity_scores WHERE run_id = $1`;
    const result = await this.db.query(query, [runId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      moral_perception: row.moral_perception ? parseFloat(row.moral_perception) : null,
      moral_imagination: row.moral_imagination ? parseFloat(row.moral_imagination) : null,
      moral_humility: row.moral_humility ? parseFloat(row.moral_humility) : null,
      moral_coherence: row.moral_coherence ? parseFloat(row.moral_coherence) : null,
      moral_residue: row.moral_residue ? parseFloat(row.moral_residue) : null,
      perspectival_flexibility: row.perspectival_flexibility ? parseFloat(row.perspectival_flexibility) : null,
      meta_ethical_awareness: row.meta_ethical_awareness ? parseFloat(row.meta_ethical_awareness) : null
    };
  }

  // ==========================================
  // v2.0: COHERENCE SCORES
  // ==========================================

  /**
   * Save coherence score
   * @param {string} runId
   * @param {Object} score
   */
  async saveCoherenceScore(runId, score) {
    const query = `
      INSERT INTO mse_coherence_scores (
        run_id, coherence_score, dominant_orientation,
        variance_explained, orientation_vector
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (run_id)
      DO UPDATE SET
        coherence_score = $2, dominant_orientation = $3,
        variance_explained = $4, orientation_vector = $5
    `;
    await this.db.query(query, [
      runId,
      score.coherence_score,
      score.dominant_orientation,
      score.variance_explained,
      JSON.stringify(score.orientation_vector)
    ]);
  }

  /**
   * Get coherence score for a run
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getCoherenceScore(runId) {
    const query = `SELECT * FROM mse_coherence_scores WHERE run_id = $1`;
    const result = await this.db.query(query, [runId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      coherence_score: row.coherence_score ? parseFloat(row.coherence_score) : null,
      dominant_orientation: row.dominant_orientation,
      variance_explained: row.variance_explained ? parseFloat(row.variance_explained) : null,
      orientation_vector: row.orientation_vector
    };
  }

  // ==========================================
  // v2.0: AGENT RATINGS (ELO/MR)
  // ==========================================

  /**
   * Get agent's MR rating
   * @param {string} agentId
   * @returns {Promise<Object|null>}
   */
  async getAgentRating(agentId) {
    const query = `SELECT * FROM mse_agent_ratings WHERE agent_id = $1`;
    const result = await this.db.query(query, [agentId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      agent_id: row.agent_id,
      mr_rating: parseFloat(row.mr_rating),
      mr_uncertainty: parseFloat(row.mr_uncertainty),
      items_processed: row.items_processed,
      peak_rating: parseFloat(row.peak_rating),
      last_updated: row.last_updated
    };
  }

  /**
   * Create or update agent rating
   * @param {string} agentId
   * @param {Object} rating
   */
  async upsertAgentRating(agentId, rating) {
    const query = `
      INSERT INTO mse_agent_ratings (
        agent_id, mr_rating, mr_uncertainty, items_processed, peak_rating, last_updated
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (agent_id)
      DO UPDATE SET
        mr_rating = $2, mr_uncertainty = $3,
        items_processed = mse_agent_ratings.items_processed + $4,
        peak_rating = GREATEST(mse_agent_ratings.peak_rating, $5),
        last_updated = NOW()
    `;
    await this.db.query(query, [
      agentId,
      rating.mr_rating,
      rating.mr_uncertainty,
      rating.items_processed,
      rating.peak_rating || rating.mr_rating
    ]);
  }

  /**
   * Save rating history entry
   * @param {string} agentId
   * @param {string} runId
   * @param {number} mrBefore
   * @param {number} mrAfter
   * @param {number} itemsInRun
   */
  async saveRatingHistory(agentId, runId, mrBefore, mrAfter, itemsInRun) {
    const query = `
      INSERT INTO mse_rating_history (agent_id, run_id, mr_before, mr_after, items_in_run)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this.db.query(query, [agentId, runId, mrBefore, mrAfter, itemsInRun]);
  }

  /**
   * Get rating history for an agent
   * @param {string} agentId
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getRatingHistory(agentId, options = {}) {
    const { limit = 20 } = options;

    const query = `
      SELECT rh.*, er.started_at as run_date
      FROM mse_rating_history rh
      JOIN mse_evaluation_runs er ON rh.run_id = er.id
      WHERE rh.agent_id = $1
      ORDER BY rh.created_at DESC
      LIMIT $2
    `;
    const result = await this.db.query(query, [agentId, limit]);
    return result.rows.map(row => ({
      ...row,
      mr_before: parseFloat(row.mr_before),
      mr_after: parseFloat(row.mr_after)
    }));
  }

  /**
   * Get MR rating leaderboard
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getRatingLeaderboard(options = {}) {
    const { limit = 50, offset = 0 } = options;

    const query = `
      SELECT ar.*
      FROM mse_agent_ratings ar
      ORDER BY ar.mr_rating DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await this.db.query(query, [limit, offset]);

    const rows = result.rows.map(row => ({
      ...row,
      mr_rating: parseFloat(row.mr_rating),
      mr_uncertainty: parseFloat(row.mr_uncertainty),
      peak_rating: parseFloat(row.peak_rating)
    }));

    // Enrich with subject data if available
    return await this._enrichWithSubjects(rows);
  }

  /**
   * Get MR rating distribution (for population stats)
   * @returns {Promise<Object>}
   */
  async getRatingDistribution() {
    const query = `
      SELECT
        COUNT(*) as total_rated,
        AVG(mr_rating) as mean_mr,
        STDDEV(mr_rating) as std_mr,
        MIN(mr_rating) as min_mr,
        MAX(mr_rating) as max_mr,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY mr_rating) as p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY mr_rating) as p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY mr_rating) as p75
      FROM mse_agent_ratings
    `;
    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      total_rated: parseInt(row.total_rated, 10),
      mean_mr: row.mean_mr ? parseFloat(row.mean_mr) : null,
      std_mr: row.std_mr ? parseFloat(row.std_mr) : null,
      min_mr: row.min_mr ? parseFloat(row.min_mr) : null,
      max_mr: row.max_mr ? parseFloat(row.max_mr) : null,
      p25: row.p25 ? parseFloat(row.p25) : null,
      p50: row.p50 ? parseFloat(row.p50) : null,
      p75: row.p75 ? parseFloat(row.p75) : null
    };
  }

  // ==========================================
  // v2.0: POPULATION STATS
  // ==========================================

  /**
   * Save population statistics for an epoch
   * @param {string} epoch
   * @param {number} examVersionId
   * @param {Object} stats
   */
  async savePopulationStats(epoch, examVersionId, stats) {
    const query = `
      INSERT INTO mse_population_stats (epoch, exam_version_id, mean_mr, std_mr, n_agents, item_difficulties)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await this.db.query(query, [
      epoch,
      examVersionId,
      stats.mean_mr,
      stats.std_mr,
      stats.n_agents,
      JSON.stringify(stats.item_difficulties || {})
    ]);
  }

  /**
   * Get population statistics for an epoch
   * @param {string} epoch
   * @returns {Promise<Object|null>}
   */
  async getPopulationStats(epoch) {
    const query = `
      SELECT * FROM mse_population_stats
      WHERE epoch = $1
      ORDER BY computed_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(query, [epoch]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      mean_mr: row.mean_mr ? parseFloat(row.mean_mr) : null,
      std_mr: row.std_mr ? parseFloat(row.std_mr) : null
    };
  }

  // ==========================================
  // v2.0: GRM SCORES ON RESPONSES
  // ==========================================

  /**
   * Update a response with GRM scoring data
   * @param {string} responseId
   * @param {number} grmCategory
   * @param {Object} grmDetails
   */
  async updateResponseGRM(responseId, grmCategory, grmDetails) {
    const query = `
      UPDATE mse_responses
      SET grm_category = $2, grm_details = $3
      WHERE id = $1
    `;
    await this.db.query(query, [responseId, grmCategory, JSON.stringify(grmDetails)]);
  }

  // ==========================================
  // SOPHISTICATION INDEX (SI)
  // ==========================================

  /**
   * Save sophistication scores for a run
   * @param {string} runId
   * @param {string} agentId
   * @param {Object} scores - SophisticationResult
   */
  async saveSophisticationScores(runId, agentId, scores) {
    const query = `
      INSERT INTO mse_sophistication_scores (
        run_id, agent_id,
        integration, metacognition, stability,
        adaptability, self_model_accuracy,
        si_score, si_level,
        integration_details, metacognition_details, stability_details,
        adaptability_details, self_model_details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (run_id)
      DO UPDATE SET
        integration = $3, metacognition = $4, stability = $5,
        adaptability = $6, self_model_accuracy = $7,
        si_score = $8, si_level = $9,
        integration_details = $10, metacognition_details = $11, stability_details = $12,
        adaptability_details = $13, self_model_details = $14
    `;
    await this.db.query(query, [
      runId, agentId,
      scores.integration, scores.metacognition, scores.stability,
      scores.adaptability, scores.self_model_accuracy,
      scores.si_score, scores.si_level,
      JSON.stringify(scores.integration_details),
      JSON.stringify(scores.metacognition_details),
      JSON.stringify(scores.stability_details),
      scores.adaptability_details ? JSON.stringify(scores.adaptability_details) : null,
      scores.self_model_details ? JSON.stringify(scores.self_model_details) : null
    ]);
  }

  /**
   * Get sophistication scores for a run
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getSophisticationScores(runId) {
    const query = `SELECT * FROM mse_sophistication_scores WHERE run_id = $1`;
    const result = await this.db.query(query, [runId]);
    if (result.rows.length === 0) return null;
    return this._parseSIRow(result.rows[0]);
  }

  /**
   * Get latest sophistication score for an agent
   * @param {string} agentId
   * @returns {Promise<Object|null>}
   */
  async getLatestSophisticationScore(agentId) {
    const query = `
      SELECT * FROM mse_sophistication_scores
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(query, [agentId]);
    if (result.rows.length === 0) return null;
    return this._parseSIRow(result.rows[0]);
  }

  /**
   * Get sophistication score history for an agent
   * @param {string} agentId
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getSophisticationHistory(agentId, options = {}) {
    const { limit = 20 } = options;
    const query = `
      SELECT si.*, er.started_at as run_date
      FROM mse_sophistication_scores si
      JOIN mse_evaluation_runs er ON si.run_id = er.id
      WHERE si.agent_id = $1
      ORDER BY si.created_at DESC
      LIMIT $2
    `;
    const result = await this.db.query(query, [agentId, limit]);
    return result.rows.map(row => this._parseSIRow(row));
  }

  /**
   * Get sophistication leaderboard
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getSophisticationLeaderboard(options = {}) {
    const { limit = 50, offset = 0 } = options;
    const query = `
      SELECT DISTINCT ON (si.agent_id)
        si.*
      FROM mse_sophistication_scores si
      ORDER BY si.agent_id, si.created_at DESC
    `;
    // Wrap in subquery for ordering by si_score
    const wrappedQuery = `
      SELECT * FROM (${query}) sub
      ORDER BY sub.si_score DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await this.db.query(wrappedQuery, [limit, offset]);
    const rows = result.rows.map(row => this._parseSIRow(row));

    // Enrich with subject data if available
    return await this._enrichWithSubjects(rows);
  }

  /**
   * Save self-model predictions
   * @param {string} runId
   * @param {string} agentId
   * @param {Object} predictions - {axis_code: predicted_value}
   */
  async saveSelfModelPredictions(runId, agentId, predictions) {
    const query = `
      INSERT INTO mse_self_model_predictions (run_id, agent_id, predictions)
      VALUES ($1, $2, $3)
      ON CONFLICT (run_id)
      DO UPDATE SET predictions = $3
    `;
    await this.db.query(query, [runId, agentId, JSON.stringify(predictions)]);
  }

  /**
   * Get self-model predictions for a run
   * @param {string} runId
   * @returns {Promise<Object|null>}
   */
  async getSelfModelPredictions(runId) {
    const query = `SELECT * FROM mse_self_model_predictions WHERE run_id = $1`;
    const result = await this.db.query(query, [runId]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  /**
   * Parse a sophistication score row from DB
   * @private
   */
  _parseSIRow(row) {
    return {
      id: row.id,
      run_id: row.run_id,
      agent_id: row.agent_id,
      integration: row.integration ? parseFloat(row.integration) : null,
      metacognition: row.metacognition ? parseFloat(row.metacognition) : null,
      stability: row.stability ? parseFloat(row.stability) : null,
      adaptability: row.adaptability ? parseFloat(row.adaptability) : null,
      self_model_accuracy: row.self_model_accuracy ? parseFloat(row.self_model_accuracy) : null,
      si_score: parseFloat(row.si_score),
      si_level: row.si_level,
      integration_details: row.integration_details,
      metacognition_details: row.metacognition_details,
      stability_details: row.stability_details,
      adaptability_details: row.adaptability_details,
      self_model_details: row.self_model_details,
      created_at: row.created_at,
      // Optional joined fields
      agent_name: row.agent_name || undefined,
      agent_display_name: row.agent_display_name || undefined,
      run_date: row.run_date || undefined
    };
  }

  /**
   * Get responses with GRM data for a run
   * @param {string} runId
   * @returns {Promise<Object[]>}
   */
  async getResponsesWithGRM(runId) {
    const query = `
      SELECT
        r.*,
        di.axis_id,
        di.pressure_level,
        di.family_id,
        di.dilemma_type,
        di.non_obvious_factors,
        di.expert_disagreement,
        di.requires_residue_recognition,
        di.meta_ethical_type,
        di.consistency_group_id
      FROM mse_responses r
      JOIN mse_dilemma_items di ON r.item_id = di.id
      WHERE r.run_id = $1
      ORDER BY r.created_at ASC
    `;
    const result = await this.db.query(query, [runId]);
    return result.rows.map(row => ({
      ...row,
      pressure_level: parseFloat(row.pressure_level),
      expert_disagreement: row.expert_disagreement ? parseFloat(row.expert_disagreement) : null
    }));
  }

  // ==========================================
  // PRIVATE HELPERS - Subject Enrichment
  // ==========================================

  /**
   * Enrich a single item with subject data via SubjectProvider
   * @private
   * @param {Object} item - Item with agent_id field
   * @param {string} agentIdField - Name of the agent ID field (default: 'agent_id')
   * @returns {Promise<Object>} Item enriched with subject data
   */
  async _enrichWithSubject(item, agentIdField = 'agent_id') {
    if (!item) return null;
    if (!this.subjectProvider) return item;

    const agentId = item[agentIdField];
    if (!agentId) return item;

    const subject = await this.subjectProvider.getSubject(agentId);
    if (subject) {
      // Add subject data fields (maintaining backward compatibility with old 'agent_name' field)
      item.agent_name = subject.name;
      item.agent_display_name = subject.displayName;
      item.agent_description = subject.description;
      item.agent_created_at = subject.createdAt;
    }

    return item;
  }

  /**
   * Enrich multiple items with subject data via SubjectProvider (batch)
   * @private
   * @param {Array<Object>} items - Items with agent_id field
   * @param {string} agentIdField - Name of the agent ID field (default: 'agent_id')
   * @returns {Promise<Array<Object>>} Items enriched with subject data
   */
  async _enrichWithSubjects(items, agentIdField = 'agent_id') {
    if (!items || items.length === 0) return items;
    if (!this.subjectProvider) return items;

    // Extract unique agent IDs
    const agentIds = [...new Set(items.map(item => item[agentIdField]).filter(Boolean))];
    if (agentIds.length === 0) return items;

    // Batch fetch subjects
    const subjects = await this.subjectProvider.getSubjectsByIds(agentIds);
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    // Enrich items
    return items.map(item => {
      const subject = subjectMap.get(item[agentIdField]);
      if (subject) {
        item.agent_name = subject.name;
        item.agent_display_name = subject.displayName;
        item.agent_description = subject.description;
        item.agent_created_at = subject.createdAt;
      }
      return item;
    });
  }
}

module.exports = PostgresAdapter;
