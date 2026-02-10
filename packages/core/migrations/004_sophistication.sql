-- MSE Migration 004: Sophistication Index (SI)
-- The SI is a behavioral proxy for reasoning sophistication derived from MSE data.
-- It measures integration, metacognition, stability, adaptability, and self-model accuracy.

-- ============================================
-- SOPHISTICATION SCORES PER EVALUATION RUN
-- ============================================

CREATE TABLE IF NOT EXISTS mse_sophistication_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,                        -- References external subject/agent system

  -- Core dimensions (always computed)
  integration DECIMAL(5,4),
  metacognition DECIMAL(5,4),
  stability DECIMAL(5,4),

  -- Contextual dimensions (null when data not available yet)
  adaptability DECIMAL(5,4),                     -- null if < 2 completed runs
  self_model_accuracy DECIMAL(5,4),              -- null if no predictions collected

  -- Composite
  si_score DECIMAL(5,4) NOT NULL,
  si_level VARCHAR(20) NOT NULL,

  -- Sub-component details (JSONB for flexibility)
  integration_details JSONB,
  metacognition_details JSONB,
  stability_details JSONB,
  adaptability_details JSONB,
  self_model_details JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(run_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_si_agent ON mse_sophistication_scores(agent_id);
CREATE INDEX IF NOT EXISTS idx_mse_si_level ON mse_sophistication_scores(si_level);

-- ============================================
-- SELF-MODEL PREDICTIONS
-- Collected before evaluation begins (optional)
-- ============================================

CREATE TABLE IF NOT EXISTS mse_self_model_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,                        -- References external subject/agent system

  predictions JSONB NOT NULL,                    -- {axis_code: predicted_b_value (0-100)}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(run_id)
);
