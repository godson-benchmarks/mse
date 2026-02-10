-- MSE Migration 003: Moral Rating (MR) System
-- Elo-like dynamic rating that evolves with each evaluation run.
-- MR measures the quality and depth of moral reasoning, not just threshold positions.

-- ============================================
-- AGENT RATINGS (ELO-LIKE, UNBOUNDED)
-- ============================================

CREATE TABLE IF NOT EXISTS mse_agent_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL,                        -- References external subject/agent system

  mr_rating DECIMAL(8,2) DEFAULT 1000,
  mr_uncertainty DECIMAL(6,2) DEFAULT 350,
  items_processed INTEGER DEFAULT 0,
  peak_rating DECIMAL(8,2) DEFAULT 1000,

  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_ar_rating ON mse_agent_ratings(mr_rating DESC);

-- ============================================
-- MR RATING HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS mse_rating_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL,                        -- References external subject/agent system
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  mr_before DECIMAL(8,2),
  mr_after DECIMAL(8,2),
  items_in_run INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_rh_agent ON mse_rating_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_mse_rh_run ON mse_rating_history(run_id);
