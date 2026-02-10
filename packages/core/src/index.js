/**
 * Motor de Espectrometria Moral (MSE)
 *
 * A system for mapping the ethical profile of AI agents through axes of moral tension,
 * parameterizable thresholds, and temporal evolution.
 *
 * This is not a pass/fail test, but a cartography of commitments, thresholds, and priorities.
 */

const types = require('./types');
const { DilemmaBank } = require('./dilemma-bank');
const { EvaluationSession } = require('./evaluator/session');
const { ResponseParser } = require('./evaluator/parser');
const { AxisScorer } = require('./evaluator/scorer');
const { AdaptiveSelector } = require('./evaluator/adaptive');
const { createSeededRNG } = require('./evaluator/seeded-random');
const { ProfileAnalyzer } = require('./analyzer/profile');
const { ProceduralAnalyzer } = require('./analyzer/procedural');
const { ComparisonAnalyzer } = require('./analyzer/comparison');
const { MSERepository } = require('./storage/repository'); // Deprecated, use PostgresAdapter
const PostgresAdapter = require('./storage/PostgresAdapter');
const SubjectProvider = require('./storage/subject-provider');
const PostgresSubjectProvider = require('./storage/postgres-subject-provider');
const { ProfileCardGenerator } = require('./visualization/data/profile-card');

// v2.0 modules
const GamingDetector = require('./evaluator/gaming-detection');
const GRMScorer = require('./evaluator/grm-scorer');
const MSERatingSystem = require('./evaluator/elo-rating');
const LLMJudge = require('./evaluator/llm-judge');
const CapacityAnalyzer = require('./analyzer/capacities');
const CoherenceAnalyzer = require('./analyzer/coherence');
const SophisticationAnalyzer = require('./analyzer/sophistication');

// LLM Providers for LLMJudge
const {
  LLMProvider,
  AnthropicProvider,
  OpenAIProvider,
  HeuristicProvider
} = require('./evaluator/llm-providers');

/**
 * Main MSE Engine class
 * Orchestrates the evaluation process
 */
class MSEEngine {
  /**
   * @param {Object} db - Database connection (pg pool)
   * @param {Object} options - Optional configuration
   * @param {string} options.anthropicApiKey - Anthropic API key for LLM Judge
   * @param {SubjectProvider} options.subjectProvider - Provider for subject/agent data lookup
   */
  constructor(db, options = {}) {
    this.db = db;
    this.subjectProvider = options.subjectProvider || null;
    this.repository = new PostgresAdapter(db, this.subjectProvider);
    this.dilemmaBank = new DilemmaBank(db);
    this.parser = new ResponseParser();
    this.scorer = new AxisScorer();
    this.profileAnalyzer = new ProfileAnalyzer();
    this.proceduralAnalyzer = new ProceduralAnalyzer();
    this.comparisonAnalyzer = new ComparisonAnalyzer();
    this.profileCardGenerator = new ProfileCardGenerator();

    // v2.0 modules
    const apiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    this.llmJudge = apiKey ? new LLMJudge({ apiKey }) : null;
    this.grmScorer = new GRMScorer({ llmJudge: this.llmJudge });
    this.eloRating = new MSERatingSystem();
    this.gamingDetector = new GamingDetector();
    this.capacityAnalyzer = new CapacityAnalyzer({ llmJudge: this.llmJudge });
    this.coherenceAnalyzer = new CoherenceAnalyzer();
    this.sophisticationAnalyzer = new SophisticationAnalyzer({ coherenceAnalyzer: this.coherenceAnalyzer });
  }

  /**
   * Start a new evaluation run for an agent
   * @param {string} agentId - Agent UUID
   * @param {Object} config - Evaluation configuration
   * @returns {Promise<EvaluationSession>}
   */
  async startEvaluation(agentId, config = {}) {
    const adaptiveSelector = new AdaptiveSelector({
      seed: config.seed  // Optional: enables reproducible item selection
    });

    const sessionConfig = {
      ...config,
      grmScorer: this.grmScorer,
      eloRating: this.eloRating,
      gamingDetector: this.gamingDetector,
      capacityAnalyzer: this.capacityAnalyzer,
      coherenceAnalyzer: this.coherenceAnalyzer,
      sophisticationAnalyzer: this.sophisticationAnalyzer
    };

    const session = new EvaluationSession(
      this.repository,
      this.dilemmaBank,
      this.parser,
      this.scorer,
      adaptiveSelector,
      sessionConfig
    );

    await session.initialize(agentId);
    return session;
  }

  /**
   * Resume an existing evaluation run
   * @param {string} runId - Evaluation run UUID
   * @returns {Promise<EvaluationSession>}
   */
  async resumeEvaluation(runId) {
    const runData = await this.repository.getRun(runId);
    if (!runData) {
      throw new Error(`Evaluation run not found: ${runId}`);
    }

    if (runData.status !== 'in_progress') {
      throw new Error(`Cannot resume run with status: ${runData.status}`);
    }

    const adaptiveSelector = new AdaptiveSelector({
      seed: runData.config.seed  // Restore seed from persisted config for deterministic resume
    });

    const sessionConfig = {
      ...runData.config,
      grmScorer: this.grmScorer,
      eloRating: this.eloRating,
      gamingDetector: this.gamingDetector,
      capacityAnalyzer: this.capacityAnalyzer,
      coherenceAnalyzer: this.coherenceAnalyzer,
      sophisticationAnalyzer: this.sophisticationAnalyzer
    };

    const session = new EvaluationSession(
      this.repository,
      this.dilemmaBank,
      this.parser,
      this.scorer,
      adaptiveSelector,
      sessionConfig
    );

    await session.resume(runData);
    return session;
  }

  /**
   * Get agent's current ethical profile
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Options (language, etc)
   * @returns {Promise<Object|null>}
   */
  async getAgentProfile(agentId, options = {}) {
    return this.profileAnalyzer.getCurrentProfile(this.repository, agentId, options);
  }

  /**
   * Get agent's partial profile (from in-progress or abandoned evaluations)
   * Falls back to completed profile if available
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Options (language, etc)
   * @returns {Promise<Object|null>}
   */
  async getPartialProfile(agentId, options = {}) {
    return this.profileAnalyzer.getPartialProfile(
      this.repository,
      this.scorer,
      agentId,
      options
    );
  }

  /**
   * Get profile card visualization data for an agent
   * Automatically includes partial profiles from in-progress evaluations
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Options (language, etc)
   * @returns {Promise<Object>}
   */
  async getProfileCardData(agentId, options = {}) {
    // Try completed profile first
    let profile = await this.getAgentProfile(agentId, options);

    // If no completed profile, try partial profile
    if (!profile || !profile.axisScores || profile.axisScores.length === 0) {
      profile = await this.getPartialProfile(agentId, options);
    }

    // If still no profile, return empty card
    if (!profile) {
      return {
        agent: { id: agentId, name: null },
        run: null,
        confidence: 'none',
        axes: { moral: [], memory: [] },
        procedural: null,
        flags: []
      };
    }

    // Generate card from profile (works with both complete and partial profiles)
    return this.profileCardGenerator.generate(profile, options);
  }

  /**
   * Get agent's profile evolution over time
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Query options
   * @returns {Promise<Object[]>}
   */
  async getProfileHistory(agentId, options = {}) {
    return this.profileAnalyzer.getHistory(this.repository, agentId, options);
  }

  /**
   * Compare multiple agents
   * @param {string[]} agentIds - Array of agent UUIDs
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>}
   */
  async compareAgents(agentIds, options = {}) {
    return this.comparisonAnalyzer.compare(this.repository, agentIds, options);
  }

  /**
   * Get all axes
   * @returns {Promise<Object[]>}
   */
  async getAxes() {
    return this.repository.getAxes();
  }

  /**
   * Get dilemma items for an axis
   * @param {number} axisId - Axis ID
   * @param {Object} options - Query options
   * @returns {Promise<Object[]>}
   */
  async getAxisItems(axisId, options = {}) {
    return this.dilemmaBank.getItemsForAxis(axisId, options);
  }

  /**
   * Get evaluation run details
   * @param {string} runId - Run UUID
   * @returns {Promise<Object>}
   */
  async getRunDetails(runId) {
    return this.repository.getRunWithResponses(runId);
  }

  /**
   * Get all runs for an agent
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Query options
   * @returns {Promise<Object[]>}
   */
  async getAgentRuns(agentId, options = {}) {
    return this.repository.getRunsByAgent(agentId, options);
  }

  /**
   * Get enriched profile with v2.0 data (capacities, meta, coherence, gaming)
   * @param {string} agentId - Agent UUID
   * @param {Object} options - Options (language, etc)
   * @returns {Promise<Object|null>}
   */
  async getEnrichedProfile(agentId, options = {}) {
    return this.profileAnalyzer.getEnrichedProfile(this.repository, agentId, options);
  }

  /**
   * Get latest sophistication score for an agent
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>}
   */
  async getSophisticationScore(agentId) {
    return this.repository.getLatestSophisticationScore(agentId);
  }

  /**
   * Get sophistication score history for an agent
   * @param {string} agentId - Agent UUID
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getSophisticationHistory(agentId, options = {}) {
    return this.repository.getSophisticationHistory(agentId, options);
  }
}

module.exports = {
  MSEEngine,
  types,
  DilemmaBank,
  EvaluationSession,
  ResponseParser,
  AxisScorer,
  AdaptiveSelector,
  ProfileAnalyzer,
  ProceduralAnalyzer,
  ComparisonAnalyzer,
  MSERepository, // Deprecated, use PostgresAdapter
  PostgresAdapter,
  SubjectProvider,
  PostgresSubjectProvider,
  // v2.0
  GamingDetector,
  GRMScorer,
  MSERatingSystem,
  LLMJudge,
  CapacityAnalyzer,
  CoherenceAnalyzer,
  SophisticationAnalyzer,
  // LLM Providers
  LLMProvider,
  AnthropicProvider,
  OpenAIProvider,
  HeuristicProvider,
  // Utilities
  createSeededRNG
};
