-- MSE Migration 001: Core Tables
-- Moral Spectrometry Engine - Base schema for ethical profiling
--
-- Requirements: PostgreSQL 14+, uuid-ossp extension
--
-- NOTE: agent_id columns are UUID references without foreign key constraints.
-- The MSE engine uses SubjectProvider for agent/subject data decoupling.
-- Integrators should ensure agent_id values correspond to their user/agent system.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AXES OF MORAL TENSION (15 core axes)
-- ============================================

CREATE TABLE IF NOT EXISTS mse_axes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  pole_left VARCHAR(100) NOT NULL,
  pole_right VARCHAR(100) NOT NULL,
  category VARCHAR(20) NOT NULL,        -- 'moral', 'memory'
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_axes_code ON mse_axes(code);
CREATE INDEX IF NOT EXISTS idx_mse_axes_category ON mse_axes(category);

-- ============================================
-- DILEMMA FAMILIES
-- ============================================

CREATE TABLE IF NOT EXISTS mse_dilemma_families (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EXAM VERSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS mse_exam_versions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,              -- 'v0.1b', 'v1.0', 'v2.1', etc.
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Lifecycle management
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'deprecated', 'retired')),
  is_current BOOLEAN DEFAULT false,              -- Only ONE should be current at a time

  -- Metadata
  released_at TIMESTAMP WITH TIME ZONE,
  deprecated_at TIMESTAMP WITH TIME ZONE,
  retired_at TIMESTAMP WITH TIME ZONE,

  -- Comparability flags
  comparable_with VARCHAR(20)[],                 -- Version codes that are comparable
  breaking_changes BOOLEAN DEFAULT false,        -- If true, direct threshold comparison is invalid

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_versions_status ON mse_exam_versions(status);
CREATE INDEX IF NOT EXISTS idx_mse_versions_current ON mse_exam_versions(is_current) WHERE is_current = true;

-- ============================================
-- PARAMETRIC DILEMMA ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS mse_dilemma_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  axis_id INTEGER NOT NULL REFERENCES mse_axes(id),
  family_id VARCHAR(50) REFERENCES mse_dilemma_families(id),
  pressure_level DECIMAL(3,2) NOT NULL
    CHECK (pressure_level >= 0 AND pressure_level <= 1),

  -- Context parameters (JSONB for flexibility)
  params JSONB NOT NULL DEFAULT '{}',
  -- params contains: severity, certainty, immediacy, relationship,
  --                  consent, reversibility, legality, num_affected

  -- Content (English canonical)
  prompt TEXT NOT NULL,

  -- Options as JSONB array: [{id: 'A', label: '...', pole: 'left|right|neutral|creative'}]
  options JSONB NOT NULL,

  -- Metadata
  version INTEGER DEFAULT 1,
  is_anchor BOOLEAN DEFAULT false,               -- L1 or L5 anchor items
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_items_axis ON mse_dilemma_items(axis_id);
CREATE INDEX IF NOT EXISTS idx_mse_items_pressure ON mse_dilemma_items(pressure_level);
CREATE INDEX IF NOT EXISTS idx_mse_items_family ON mse_dilemma_items(family_id);
CREATE INDEX IF NOT EXISTS idx_mse_items_anchor ON mse_dilemma_items(is_anchor) WHERE is_anchor = true;

-- Unique constraint: one active item per (axis_id, prompt) combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_mse_items_unique_prompt
  ON mse_dilemma_items (axis_id, md5(prompt))
  WHERE is_active = true;

-- ============================================
-- VERSION-ITEMS JUNCTION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS mse_version_items (
  version_id INTEGER NOT NULL REFERENCES mse_exam_versions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES mse_dilemma_items(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (version_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_version_items_version ON mse_version_items(version_id);
CREATE INDEX IF NOT EXISTS idx_mse_version_items_item ON mse_version_items(item_id);

-- ============================================
-- EVALUATION RUNS (sessions)
-- ============================================

CREATE TABLE IF NOT EXISTS mse_evaluation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL,                        -- References external subject/agent system

  -- Configuration for this run
  config JSONB NOT NULL DEFAULT '{}',
  -- config contains: temperature, model, language, max_items_per_axis, etc.

  -- Exam version
  exam_version_id INTEGER REFERENCES mse_exam_versions(id),

  -- Status tracking
  status VARCHAR(20) DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled', 'error')),
  current_axis INTEGER DEFAULT 1,
  items_presented INTEGER DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Error info if failed
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_runs_agent ON mse_evaluation_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_mse_runs_status ON mse_evaluation_runs(status);
CREATE INDEX IF NOT EXISTS idx_mse_runs_date ON mse_evaluation_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_mse_runs_version ON mse_evaluation_runs(exam_version_id);

-- ============================================
-- INDIVIDUAL RESPONSES TO DILEMMAS
-- ============================================

CREATE TABLE IF NOT EXISTS mse_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES mse_dilemma_items(id),

  -- Primary choice
  choice CHAR(1) NOT NULL CHECK (choice IN ('A', 'B', 'C', 'D')),

  -- Forced binary choice (even if chose C/D)
  forced_choice CHAR(1) NOT NULL CHECK (forced_choice IN ('A', 'B')),

  -- Continuous signal for threshold estimation
  permissibility INTEGER NOT NULL CHECK (permissibility >= 0 AND permissibility <= 100),

  -- Calibration
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),

  -- Justification
  principles VARCHAR(20)[] NOT NULL DEFAULT '{}',
  -- principles: consequentialist, deontological, virtue, contractualist, care, pragmatic

  rationale TEXT,

  -- Information seeking
  info_needed TEXT[],

  -- Performance metrics
  response_time_ms INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_responses_run ON mse_responses(run_id);
CREATE INDEX IF NOT EXISTS idx_mse_responses_item ON mse_responses(item_id);

-- ============================================
-- CALCULATED SCORES PER AXIS
-- ============================================

CREATE TABLE IF NOT EXISTS mse_axis_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,
  axis_id INTEGER NOT NULL REFERENCES mse_axes(id),

  -- Core metrics (Regularized Logistic Threshold Model)
  b DECIMAL(4,3) NOT NULL,                       -- threshold (0-1)
  a DECIMAL(4,2) NOT NULL,                       -- rigidity/slope
  se_b DECIMAL(4,3) NOT NULL,                    -- standard error
  n_items INTEGER NOT NULL,

  -- Quality flags
  flags VARCHAR(30)[] DEFAULT '{}',
  -- flags: few_items, out_of_range, high_uncertainty, inconsistent, non_monotonic

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(run_id, axis_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_axis_scores_run ON mse_axis_scores(run_id);

-- ============================================
-- PROCEDURAL METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS mse_procedural_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  -- All metrics are 0-1 (proportion or correlation)
  moral_sensitivity DECIMAL(4,3),                -- Identifies morally relevant factors
  info_seeking DECIMAL(4,3),                     -- Requests critical info before deciding
  calibration DECIMAL(4,3),                      -- Low confidence near threshold
  consistency DECIMAL(4,3),                      -- Stable on parallel items
  pressure_robustness DECIMAL(4,3),              -- Resists social/authority pressure
  transparency DECIMAL(4,3),                     -- Explains tradeoffs

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(run_id)
);

CREATE INDEX IF NOT EXISTS idx_mse_procedural_run ON mse_procedural_scores(run_id);

-- ============================================
-- HISTORICAL PROFILE SNAPSHOTS
-- ============================================

CREATE TABLE IF NOT EXISTS mse_profile_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL,                        -- References external subject/agent system
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id),
  snapshot_date DATE NOT NULL,

  -- Exam version reference
  exam_version_id INTEGER REFERENCES mse_exam_versions(id),
  exam_version_code VARCHAR(20),

  -- Full profile as JSONB: {axis_code: {b, a, se_b, flags}}
  profile_vector JSONB NOT NULL,

  -- Procedural scores: {moral_sensitivity, info_seeking, ...}
  procedural_scores JSONB NOT NULL,

  -- Summary metrics
  avg_threshold DECIMAL(4,3),
  avg_rigidity DECIMAL(4,2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_snapshots_agent ON mse_profile_snapshots(agent_id);
CREATE INDEX IF NOT EXISTS idx_mse_snapshots_date ON mse_profile_snapshots(agent_id, snapshot_date DESC);
