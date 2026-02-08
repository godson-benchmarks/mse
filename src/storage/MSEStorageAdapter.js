/**
 * MSE Storage Adapter - Abstract Interface
 *
 * Database-agnostic interface for MSE storage operations.
 * Implementers should provide concrete implementations for their storage backend
 * (PostgreSQL, MongoDB, DynamoDB, SQLite, etc.)
 *
 * This abstraction allows MSE to work with any storage system while maintaining
 * a consistent API across implementations.
 */

class MSEStorageAdapter {
  /**
   * @param {Object} db - Database connection/client
   * @param {SubjectProvider} subjectProvider - Optional provider for subject/agent data
   */
  constructor(db, subjectProvider = null) {
    if (this.constructor === MSEStorageAdapter) {
      throw new Error('MSEStorageAdapter is abstract and cannot be instantiated directly');
    }
    this.db = db;
    this.subjectProvider = subjectProvider;
  }

  // ==========================================
  // AXES
  // ==========================================

  /**
   * Get all active axes
   * @returns {Promise<Array<Object>>} Array of axis objects
   */
  async getAxes() {
    throw new Error('Method getAxes() must be implemented');
  }

  /**
   * Get axis by ID
   * @param {number} axisId - Axis ID
   * @returns {Promise<Object|null>} Axis object or null
   */
  async getAxis(axisId) {
    throw new Error('Method getAxis() must be implemented');
  }

  /**
   * Get axis by code
   * @param {string} code - Axis code (e.g., 'rights-vs-consequences')
   * @returns {Promise<Object|null>} Axis object or null
   */
  async getAxisByCode(code) {
    throw new Error('Method getAxisByCode() must be implemented');
  }

  // ==========================================
  // EVALUATION RUNS
  // ==========================================

  /**
   * Create a new evaluation run
   * @param {string} agentId - Agent UUID
   * @param {Object} config - Run configuration
   * @param {number} examVersionId - Exam version ID (optional, defaults to current)
   * @returns {Promise<string>} Run ID (UUID)
   */
  async createRun(agentId, config, examVersionId = null) {
    throw new Error('Method createRun() must be implemented');
  }

  /**
   * Get a run by ID
   * @param {string} runId - Run UUID
   * @returns {Promise<Object|null>} Run object with agent_name if available
   */
  async getRun(runId) {
    throw new Error('Method getRun() must be implemented');
  }

  /**
   * Get run with all responses, scores, and procedural metrics
   * @param {string} runId - Run UUID
   * @returns {Promise<Object|null>} Complete run object or null
   */
  async getRunWithResponses(runId) {
    throw new Error('Method getRunWithResponses() must be implemented');
  }

  /**
   * Get runs by agent
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Query options (limit, offset, status filter)
   * @returns {Promise<Array<Object>>} Array of run objects
   */
  async getRunsByAgent(agentId, options = {}) {
    throw new Error('Method getRunsByAgent() must be implemented');
  }

  /**
   * Get active run for an agent (auto-resume functionality)
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} Active run with response_count or null
   */
  async getActiveRun(agentId) {
    throw new Error('Method getActiveRun() must be implemented');
  }

  /**
   * Count active evaluations for an agent
   * @param {string} agentId - Agent UUID
   * @returns {Promise<number>} Count of active runs
   */
  async countActiveRuns(agentId) {
    throw new Error('Method countActiveRuns() must be implemented');
  }

  /**
   * Update run status
   * @param {string} runId - Run UUID
   * @param {string} status - New status ('in_progress', 'completed', 'failed')
   * @param {string} errorMessage - Error message if status is 'failed'
   * @returns {Promise<void>}
   */
  async updateRunStatus(runId, status, errorMessage = null) {
    throw new Error('Method updateRunStatus() must be implemented');
  }

  /**
   * Update run progress
   * @param {string} runId - Run UUID
   * @param {number} currentAxis - Current axis index
   * @param {number} itemsPresented - Total items presented
   * @returns {Promise<void>}
   */
  async updateRunProgress(runId, currentAxis, itemsPresented) {
    throw new Error('Method updateRunProgress() must be implemented');
  }

  /**
   * Get the latest run with responses for an agent (completed or in progress)
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} Latest run with responses, scores, or null
   */
  async getLatestRunWithResponses(agentId) {
    throw new Error('Method getLatestRunWithResponses() must be implemented');
  }

  /**
   * Get runs by exam version
   * @param {number} versionId - Version ID
   * @param {Object} options - Query options (status, limit)
   * @returns {Promise<Array<Object>>} Array of runs
   */
  async getRunsByVersion(versionId, options = {}) {
    throw new Error('Method getRunsByVersion() must be implemented');
  }

  /**
   * Get agent evaluation statistics
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object>} Stats object with total_runs, completed_runs, etc.
   */
  async getAgentStats(agentId) {
    throw new Error('Method getAgentStats() must be implemented');
  }

  // ==========================================
  // RESPONSES
  // ==========================================

  /**
   * Save a response to a dilemma
   * @param {Object} response - Response object with run_id, item_id, choice, etc.
   * @returns {Promise<string>} Response ID (UUID)
   */
  async saveResponse(response) {
    throw new Error('Method saveResponse() must be implemented');
  }

  /**
   * Get all responses for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Array<Object>>} Array of response objects with dilemma data
   */
  async getResponses(runId) {
    throw new Error('Method getResponses() must be implemented');
  }

  /**
   * Get responses for a specific axis in a run
   * @param {string} runId - Run UUID
   * @param {number} axisId - Axis ID
   * @returns {Promise<Array<Object>>} Array of response objects
   */
  async getResponsesForAxis(runId, axisId) {
    throw new Error('Method getResponsesForAxis() must be implemented');
  }

  // ==========================================
  // AXIS SCORES
  // ==========================================

  /**
   * Save axis score for a run
   * @param {string} runId - Run UUID
   * @param {Object} score - Score object with axis_id, b, a, se_b, quality_flags, etc.
   * @returns {Promise<void>}
   */
  async saveAxisScore(runId, score) {
    throw new Error('Method saveAxisScore() must be implemented');
  }

  /**
   * Get axis scores for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Array<Object>>} Array of axis score objects
   */
  async getAxisScores(runId) {
    throw new Error('Method getAxisScores() must be implemented');
  }

  // ==========================================
  // PROCEDURAL SCORES
  // ==========================================

  /**
   * Save procedural metrics for a run
   * @param {string} runId - Run UUID
   * @param {Object} scores - Procedural scores object
   * @returns {Promise<void>}
   */
  async saveProceduralScores(runId, scores) {
    throw new Error('Method saveProceduralScores() must be implemented');
  }

  /**
   * Get procedural scores for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Object|null>} Procedural scores object or null
   */
  async getProceduralScores(runId) {
    throw new Error('Method getProceduralScores() must be implemented');
  }

  // ==========================================
  // SNAPSHOTS (Profiles)
  // ==========================================

  /**
   * Create a profile snapshot
   * @param {string} agentId - Agent UUID
   * @param {string} runId - Run UUID
   * @param {Object} profile - Profile object with axis scores and metadata
   * @param {number} examVersionId - Exam version ID
   * @param {string} examVersionCode - Exam version code
   * @returns {Promise<string>} Snapshot ID (UUID)
   */
  async createSnapshot(agentId, runId, profile, examVersionId = null, examVersionCode = null) {
    throw new Error('Method createSnapshot() must be implemented');
  }

  /**
   * Get latest snapshot for an agent
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} Latest snapshot or null
   */
  async getLatestSnapshot(agentId) {
    throw new Error('Method getLatestSnapshot() must be implemented');
  }

  /**
   * Get snapshot history for an agent
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array<Object>>} Array of snapshots
   */
  async getSnapshotHistory(agentId, options = {}) {
    throw new Error('Method getSnapshotHistory() must be implemented');
  }

  // ==========================================
  // ITEMS (Dilemmas)
  // ==========================================

  /**
   * Get an item by ID
   * @param {number} itemId - Item ID
   * @returns {Promise<Object|null>} Item object with all metadata or null
   */
  async getItem(itemId) {
    throw new Error('Method getItem() must be implemented');
  }

  // ==========================================
  // GLOBAL STATS
  // ==========================================

  /**
   * Get global platform statistics
   * @returns {Promise<Object>} Stats with total_runs, completed_runs, unique_agents, etc.
   */
  async getGlobalStats() {
    throw new Error('Method getGlobalStats() must be implemented');
  }

  /**
   * Get aggregate community statistics (axis distributions, population calibration)
   * @returns {Promise<Object>} Aggregate stats with axis distributions
   */
  async getAggregateStats() {
    throw new Error('Method getAggregateStats() must be implemented');
  }

  // ==========================================
  // EXAM VERSIONS
  // ==========================================

  /**
   * Get current active exam version
   * @returns {Promise<Object|null>} Current version or null
   */
  async getCurrentExamVersion() {
    throw new Error('Method getCurrentExamVersion() must be implemented');
  }

  /**
   * Get exam version by code
   * @param {string} code - Version code (e.g., 'v2.1')
   * @returns {Promise<Object|null>} Version object or null
   */
  async getExamVersionByCode(code) {
    throw new Error('Method getExamVersionByCode() must be implemented');
  }

  /**
   * Get exam version by ID
   * @param {number} id - Version ID
   * @returns {Promise<Object|null>} Version object or null
   */
  async getExamVersionById(id) {
    throw new Error('Method getExamVersionById() must be implemented');
  }

  /**
   * Get all exam versions
   * @param {Object} options - Query options (status filter, limit, offset)
   * @returns {Promise<Array<Object>>} Array of version objects
   */
  async getExamVersions(options = {}) {
    throw new Error('Method getExamVersions() must be implemented');
  }

  /**
   * Get item counts per axis for a version
   * @param {number} versionId - Version ID
   * @returns {Promise<Object>} Map of axis_id to item_count
   */
  async getVersionItemCounts(versionId) {
    throw new Error('Method getVersionItemCounts() must be implemented');
  }

  /**
   * Check if two versions are comparable
   * @param {string} version1Code - First version code
   * @param {string} version2Code - Second version code
   * @returns {Promise<boolean>} True if comparable
   */
  async areVersionsComparable(version1Code, version2Code) {
    throw new Error('Method areVersionsComparable() must be implemented');
  }

  // ==========================================
  // CONSISTENCY GROUPS
  // ==========================================

  /**
   * Get consistency groups for an axis
   * @param {number} axisId - Axis ID
   * @param {number} versionId - Optional version ID filter
   * @returns {Promise<Array<Object>>} Array of consistency group objects
   */
  async getConsistencyGroups(axisId, versionId = null) {
    throw new Error('Method getConsistencyGroups() must be implemented');
  }

  /**
   * Get items in a consistency group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array<Object>>} Array of item objects
   */
  async getGroupItems(groupId) {
    throw new Error('Method getGroupItems() must be implemented');
  }

  /**
   * Get all consistency groups with their items for a version
   * @param {number} versionId - Version ID
   * @returns {Promise<Array<Object>>} Array of groups with items array
   */
  async getConsistencyGroupsWithItems(versionId) {
    throw new Error('Method getConsistencyGroupsWithItems() must be implemented');
  }

  // ==========================================
  // CONSISTENCY SCORES
  // ==========================================

  /**
   * Save consistency scores for a run
   * @param {string} runId - Run UUID
   * @param {Array<Object>} scores - Array of consistency score objects
   * @returns {Promise<void>}
   */
  async saveConsistencyScores(runId, scores) {
    throw new Error('Method saveConsistencyScores() must be implemented');
  }

  /**
   * Get consistency scores for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Array<Object>>} Array of consistency score objects
   */
  async getConsistencyScores(runId) {
    throw new Error('Method getConsistencyScores() must be implemented');
  }

  // ==========================================
  // GAMING SCORES
  // ==========================================

  /**
   * Save gaming detection scores for a run
   * @param {string} runId - Run UUID
   * @param {Object} scores - Gaming scores object with signals and overall_score
   * @returns {Promise<void>}
   */
  async saveGamingScores(runId, scores) {
    throw new Error('Method saveGamingScores() must be implemented');
  }

  /**
   * Get gaming scores for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Object|null>} Gaming scores object or null
   */
  async getGamingScores(runId) {
    throw new Error('Method getGamingScores() must be implemented');
  }

  // ==========================================
  // CAPACITY SCORES
  // ==========================================

  /**
   * Save ethical capacity scores for a run
   * @param {string} runId - Run UUID
   * @param {Object} scores - Capacity scores object (7 capacities)
   * @returns {Promise<void>}
   */
  async saveCapacityScores(runId, scores) {
    throw new Error('Method saveCapacityScores() must be implemented');
  }

  /**
   * Get capacity scores for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Object|null>} Capacity scores object or null
   */
  async getCapacityScores(runId) {
    throw new Error('Method getCapacityScores() must be implemented');
  }

  // ==========================================
  // COHERENCE SCORE
  // ==========================================

  /**
   * Save coherence score for a run
   * @param {string} runId - Run UUID
   * @param {Object} score - Coherence score object with orientation detection
   * @returns {Promise<void>}
   */
  async saveCoherenceScore(runId, score) {
    throw new Error('Method saveCoherenceScore() must be implemented');
  }

  /**
   * Get coherence score for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Object|null>} Coherence score object or null
   */
  async getCoherenceScore(runId) {
    throw new Error('Method getCoherenceScore() must be implemented');
  }

  // ==========================================
  // RATINGS (MR - Moral Rating)
  // ==========================================

  /**
   * Get MR rating for an agent
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} Rating object or null
   */
  async getAgentRating(agentId) {
    throw new Error('Method getAgentRating() must be implemented');
  }

  /**
   * Upsert agent rating (create or update)
   * @param {string} agentId - Agent UUID
   * @param {Object} rating - Rating object with mr_rating, mr_uncertainty, etc.
   * @returns {Promise<void>}
   */
  async upsertAgentRating(agentId, rating) {
    throw new Error('Method upsertAgentRating() must be implemented');
  }

  /**
   * Save rating history entry
   * @param {string} agentId - Agent UUID
   * @param {string} runId - Run UUID
   * @param {number} mrBefore - Rating before run
   * @param {number} mrAfter - Rating after run
   * @param {number} itemsInRun - Number of items in run
   * @returns {Promise<void>}
   */
  async saveRatingHistory(agentId, runId, mrBefore, mrAfter, itemsInRun) {
    throw new Error('Method saveRatingHistory() must be implemented');
  }

  /**
   * Get rating history for an agent
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array<Object>>} Array of history entries
   */
  async getRatingHistory(agentId, options = {}) {
    throw new Error('Method getRatingHistory() must be implemented');
  }

  /**
   * Get MR rating leaderboard
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array<Object>>} Array of agents with ratings
   */
  async getRatingLeaderboard(options = {}) {
    throw new Error('Method getRatingLeaderboard() must be implemented');
  }

  /**
   * Get MR rating distribution (for population stats)
   * @returns {Promise<Object>} Distribution stats (mean, stddev, min, max, etc.)
   */
  async getRatingDistribution() {
    throw new Error('Method getRatingDistribution() must be implemented');
  }

  // ==========================================
  // SOPHISTICATION (SI - Sophistication Index)
  // ==========================================

  /**
   * Save sophistication score
   * @param {string} agentId - Agent UUID
   * @param {string} runId - Run UUID
   * @param {Object} score - SI score object with 5 dimensions
   * @returns {Promise<string>} Score ID (UUID)
   */
  async saveSophisticationScore(agentId, runId, score) {
    throw new Error('Method saveSophisticationScore() must be implemented');
  }

  /**
   * Get latest sophistication score for an agent
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} Latest SI score or null
   */
  async getLatestSophisticationScore(agentId) {
    throw new Error('Method getLatestSophisticationScore() must be implemented');
  }

  /**
   * Get sophistication score for an agent (alias for getLatestSophisticationScore)
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} Latest SI score or null
   */
  async getSophisticationScore(agentId) {
    return this.getLatestSophisticationScore(agentId);
  }

  /**
   * Get sophistication history for an agent
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array<Object>>} Array of SI scores over time
   */
  async getSophisticationHistory(agentId, options = {}) {
    throw new Error('Method getSophisticationHistory() must be implemented');
  }

  /**
   * Get sophistication leaderboard
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array<Object>>} Array of agents with SI scores
   */
  async getSophisticationLeaderboard(options = {}) {
    throw new Error('Method getSophisticationLeaderboard() must be implemented');
  }

  // ==========================================
  // SELF-MODEL PREDICTIONS
  // ==========================================

  /**
   * Save self-model predictions
   * @param {string} runId - Run UUID
   * @param {string} agentId - Agent UUID
   * @param {Object} predictions - Predictions object {axis_code: predicted_value}
   * @returns {Promise<void>}
   */
  async saveSelfModelPredictions(runId, agentId, predictions) {
    throw new Error('Method saveSelfModelPredictions() must be implemented');
  }

  /**
   * Get self-model predictions for a run
   * @param {string} runId - Run UUID
   * @returns {Promise<Object|null>} Predictions object or null
   */
  async getSelfModelPredictions(runId) {
    throw new Error('Method getSelfModelPredictions() must be implemented');
  }

  // ==========================================
  // ISM (Integrated Sophistication Metric)
  // ==========================================

  /**
   * Save ISM score
   * @param {string} agentId - Agent UUID
   * @param {string} runId - Run UUID
   * @param {Object} score - ISM score object with components
   * @returns {Promise<void>}
   */
  async saveISMScore(agentId, runId, score) {
    throw new Error('Method saveISMScore() must be implemented');
  }

  /**
   * Get ISM score for an agent
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} ISM score object or null
   */
  async getISMScore(agentId) {
    throw new Error('Method getISMScore() must be implemented');
  }

  // ==========================================
  // POPULATION CALIBRATION
  // ==========================================

  /**
   * Get population calibration data
   * @returns {Promise<Object|null>} Calibration data (quantiles, distributions)
   */
  async getPopulationCalibration() {
    throw new Error('Method getPopulationCalibration() must be implemented');
  }

  /**
   * Update population calibration data
   * @param {Object} calibration - Calibration data object
   * @returns {Promise<void>}
   */
  async updatePopulationCalibration(calibration) {
    throw new Error('Method updatePopulationCalibration() must be implemented');
  }
}

module.exports = MSEStorageAdapter;
