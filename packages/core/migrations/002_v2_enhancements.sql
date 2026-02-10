-- MSE Migration 002: v2.0 Enhancements
-- Consistency traps, gaming detection, ethical capacities, and coherence analysis
--
-- These features were introduced in MSE v2.0 to address saturation effects
-- observed in v0.1b where most agents scored near the midpoint.

-- ============================================
-- CONSISTENCY TRAP INFRASTRUCTURE
-- ============================================

-- Consistency groups link dilemmas that test the same axis concept
-- with different framing to detect gaming vs genuine reasoning
CREATE TABLE IF NOT EXISTS mse_consistency_groups (
  id SERIAL PRIMARY KEY,
  group_code VARCHAR(50) UNIQUE NOT NULL,        -- e.g., 'truth-medical-01'
  axis_id INTEGER NOT NULL REFERENCES mse_axes(id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_cg_axis ON mse_consistency_groups(axis_id);

-- Link items that are "disguised repeats"
CREATE TABLE IF NOT EXISTS mse_consistency_group_items (
  group_id INTEGER NOT NULL REFERENCES mse_consistency_groups(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES mse_dilemma_items(id) ON DELETE CASCADE,
  framing VARCHAR(30) NOT NULL,                  -- 'base', 'positive', 'negative', 'neutral'
  variant_type VARCHAR(30) DEFAULT 'framing',    -- 'framing', 'pressure', 'domain', 'stakes'
  PRIMARY KEY (group_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_cgi_group ON mse_consistency_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_mse_cgi_item ON mse_consistency_group_items(item_id);

-- ============================================
-- CONSISTENCY SCORES PER EVALUATION
-- ============================================

CREATE TABLE IF NOT EXISTS mse_consistency_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES mse_consistency_groups(id),

  -- Variance in responses across group items
  permissibility_variance DECIMAL(8,3),
  forced_choice_agreement DECIMAL(4,3),          -- 0-1: did they agree on A/B?
  confidence_variance DECIMAL(8,3),
  principle_overlap DECIMAL(4,3),                -- Jaccard similarity of principles

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_cs_run ON mse_consistency_scores(run_id);

-- ============================================
-- GAMING DETECTION SCORES
-- ============================================

CREATE TABLE IF NOT EXISTS mse_gaming_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  g_score DECIMAL(4,3),                          -- Overall gaming score 0-1
  response_time_uniformity DECIMAL(4,3),         -- Low variance = suspicious
  rationale_diversity DECIMAL(4,3),              -- Low = template responses
  pattern_regularity DECIMAL(4,3),               -- High autocorrelation = formula
  parameter_sensitivity DECIMAL(4,3),            -- Low = ignoring context
  framing_susceptibility DECIMAL(4,3),           -- High = no real principles
  consistency_score DECIMAL(4,3),                -- From consistency traps

  flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_gs_run ON mse_gaming_scores(run_id);
CREATE INDEX IF NOT EXISTS idx_mse_gs_flagged ON mse_gaming_scores(flagged) WHERE flagged = true;

-- ============================================
-- 7 ETHICAL CAPACITIES
-- ============================================

CREATE TABLE IF NOT EXISTS mse_capacity_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  moral_perception DECIMAL(4,3),                 -- Detects non-obvious moral dimensions
  moral_imagination DECIMAL(4,3),                -- Generates alternatives not offered
  moral_humility DECIMAL(4,3),                   -- Appropriate uncertainty
  moral_coherence DECIMAL(4,3),                  -- Cross-axis consistency
  moral_residue DECIMAL(4,3),                    -- Acknowledges cost of "right" choice
  perspectival_flexibility DECIMAL(4,3),         -- Reasons from multiple traditions
  meta_ethical_awareness DECIMAL(4,3),           -- Knows what kind of question it is

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_cap_run ON mse_capacity_scores(run_id);

-- ============================================
-- COHERENCE ANALYSIS (PCA-based)
-- ============================================

CREATE TABLE IF NOT EXISTS mse_coherence_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  coherence_score DECIMAL(4,3),                  -- 0-1, PCA-based
  dominant_orientation VARCHAR(30),              -- deontological, consequentialist, etc.
  variance_explained DECIMAL(4,3),               -- by first principal component
  orientation_vector JSONB,                      -- {deontological: 0.7, care: 0.3, ...}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_coh_run ON mse_coherence_scores(run_id);

-- ============================================
-- ADDITIONAL METADATA ON DILEMMA ITEMS
-- ============================================

ALTER TABLE mse_dilemma_items
ADD COLUMN IF NOT EXISTS dilemma_type VARCHAR(30) DEFAULT 'base',
ADD COLUMN IF NOT EXISTS consistency_group_id INTEGER REFERENCES mse_consistency_groups(id),
ADD COLUMN IF NOT EXISTS variant_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS non_obvious_factors TEXT[],
ADD COLUMN IF NOT EXISTS expert_disagreement DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS requires_residue_recognition BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meta_ethical_type VARCHAR(30);

-- ============================================
-- GRM SCORING ON RESPONSES
-- ============================================

ALTER TABLE mse_responses
ADD COLUMN IF NOT EXISTS grm_category INTEGER CHECK (grm_category >= 0 AND grm_category <= 4),
ADD COLUMN IF NOT EXISTS grm_details JSONB;
