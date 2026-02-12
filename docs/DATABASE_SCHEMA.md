# MSE Database Schema

**Version:** 2.1
**Last Updated:** February 2026
**Database:** PostgreSQL 14+

> Complete database schema for the Moral Spectrometry Engine.

---

## Table of Contents

1. [Core Tables](#core-tables)
2. [V2.0 Enhancements](#v20-enhancements)
3. [Ratings & Rankings](#ratings--rankings)
4. [Entity Relationships](#entity-relationships)
5. [Indices & Performance](#indices--performance)
6. [Migrations](#migrations)

---

## Core Tables

### mse_axes

Defines the 15 axes of moral tension.

```sql
CREATE TABLE mse_axes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('moral', 'memory')),
  pole_a_code VARCHAR(50) NOT NULL,
  pole_a_label VARCHAR(100) NOT NULL,
  pole_b_code VARCHAR(50) NOT NULL,
  pole_b_label VARCHAR(100) NOT NULL,
  description TEXT,
  philosophical_sources TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_axes_code ON mse_axes(code);
CREATE INDEX idx_mse_axes_category ON mse_axes(category) WHERE is_active = true;
```

**Notes:**
- `philosophical_sources`: Array of citations (e.g., ["Kant (1785)", "Mill (1863)"])
- `is_active`: Allows soft deletion of deprecated axes
- All text fields are in English

---

### mse_exam_versions

Tracks different versions of the MSE exam.

```sql
CREATE TABLE mse_exam_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'active', 'deprecated', 'retired')),
  items_per_axis INTEGER NOT NULL,
  description TEXT,
  parent_version_id UUID REFERENCES mse_exam_versions(id),
  comparability_notes TEXT,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_exam_versions_status ON mse_exam_versions(status);
CREATE INDEX idx_mse_exam_versions_code ON mse_exam_versions(code);
```

**Notes:**
- `parent_version_id`: Links to previous version for tracking evolution
- `comparability_notes`: Documents how scores translate between versions

---

### mse_dilemma_items

Stores all ethical dilemmas (270 items: 18 per axis × 15 axes).

```sql
CREATE TABLE mse_dilemma_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  axis_id INTEGER NOT NULL REFERENCES mse_axes(id),
  pressure_level NUMERIC(3,2) NOT NULL CHECK (pressure_level BETWEEN 0 AND 1),
  dilemma_type VARCHAR(30) NOT NULL
    CHECK (dilemma_type IN ('base', 'framing', 'pressure', 'consistency_trap', 'particularist', 'dirty_hands', 'tragic', 'stakes')),
  variant_type VARCHAR(30) CHECK (variant_type IN ('positive', 'negative', 'neutral', 'authority', 'social', 'economic')),

  prompt TEXT NOT NULL,

  option_a_text TEXT NOT NULL,
  option_b_text TEXT NOT NULL,
  option_c_text TEXT NOT NULL,
  option_d_text TEXT NOT NULL,

  -- 8 contextual parameters
  param_severity NUMERIC(3,2) CHECK (param_severity BETWEEN 0 AND 1),
  param_certainty NUMERIC(3,2) CHECK (param_certainty BETWEEN 0 AND 1),
  param_immediacy NUMERIC(3,2) CHECK (param_immediacy BETWEEN 0 AND 1),
  param_relationship NUMERIC(3,2) CHECK (param_relationship BETWEEN 0 AND 1),
  param_consent NUMERIC(3,2) CHECK (param_consent BETWEEN 0 AND 1),
  param_reversibility NUMERIC(3,2) CHECK (param_reversibility BETWEEN 0 AND 1),
  param_legality NUMERIC(3,2) CHECK (param_legality BETWEEN 0 AND 1),
  param_num_affected INTEGER,

  -- V2.0 metadata
  non_obvious_factors TEXT[],
  expert_disagreement NUMERIC(3,2) CHECK (expert_disagreement BETWEEN 0 AND 1),
  requires_residue_recognition BOOLEAN DEFAULT false,
  meta_ethical_type VARCHAR(30)
    CHECK (meta_ethical_type IN ('justice', 'rights', 'consequentialist', 'virtue', 'care', 'contractualist')),
  consistency_group_id UUID REFERENCES mse_consistency_groups(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_items_axis ON mse_dilemma_items(axis_id);
CREATE INDEX idx_mse_items_pressure ON mse_dilemma_items(pressure_level);
CREATE INDEX idx_mse_items_type ON mse_dilemma_items(dilemma_type);
CREATE INDEX idx_mse_items_code ON mse_dilemma_items(code);
```

---

### mse_evaluation_runs

Tracks individual evaluation sessions.

```sql
CREATE TABLE mse_evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,  -- External reference (via SubjectProvider)
  version_id UUID NOT NULL REFERENCES mse_exam_versions(id),
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('in_progress', 'completed', 'abandoned', 'flagged')),
  config JSONB NOT NULL,  -- Evaluation configuration (itemsPerAxis, etc.)

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_items_count INTEGER DEFAULT 0,
  total_items_count INTEGER NOT NULL,

  -- Computed scores (denormalized for performance)
  avg_threshold NUMERIC(4,3),
  gaming_score NUMERIC(4,3),
  si_overall INTEGER,
  ism_composite INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_runs_agent ON mse_evaluation_runs(agent_id);
CREATE INDEX idx_mse_runs_status ON mse_evaluation_runs(status);
CREATE INDEX idx_mse_runs_completed ON mse_evaluation_runs(completed_at DESC);
CREATE UNIQUE INDEX idx_mse_runs_active ON mse_evaluation_runs(agent_id)
  WHERE status = 'in_progress';
```

**Notes:**
- One active (in_progress) run per agent enforced by unique index
- `config` JSONB stores flexible evaluation parameters
- Denormalized scores for fast profile retrieval

---

### mse_responses

Stores agent responses to dilemmas.

```sql
CREATE TABLE mse_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES mse_dilemma_items(id),

  choice VARCHAR(1) NOT NULL CHECK (choice IN ('A', 'B', 'C', 'D')),
  forced_choice VARCHAR(1) NOT NULL CHECK (forced_choice IN ('A', 'B')),
  permissibility INTEGER NOT NULL CHECK (permissibility BETWEEN 0 AND 100),
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  principles TEXT[],
  rationale TEXT,
  info_needed TEXT[],

  -- GRM scoring
  grm_score INTEGER CHECK (grm_score BETWEEN 0 AND 4),
  grm_reasoning TEXT,
  grm_model VARCHAR(50),

  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_responses_run ON mse_responses(run_id);
CREATE INDEX idx_mse_responses_item ON mse_responses(item_id);
CREATE UNIQUE INDEX idx_mse_responses_unique ON mse_responses(run_id, item_id);
```

**Notes:**
- One response per (run, item) pair enforced by unique index
- `grm_model`: Which LLM provider scored this (e.g., "claude-haiku-3-5")

---

### mse_axis_scores

Threshold estimates per axis per evaluation.

```sql
CREATE TABLE mse_axis_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,
  axis_id INTEGER NOT NULL REFERENCES mse_axes(id),

  threshold NUMERIC(4,3) NOT NULL CHECK (threshold BETWEEN 0 AND 1),
  discrimination NUMERIC(4,2) NOT NULL CHECK (discrimination > 0),
  se_threshold NUMERIC(4,3) NOT NULL CHECK (se_threshold >= 0),

  items_count INTEGER NOT NULL,
  flags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(run_id, axis_id)
);

CREATE INDEX idx_mse_axis_scores_run ON mse_axis_scores(run_id);
CREATE INDEX idx_mse_axis_scores_axis ON mse_axis_scores(axis_id);
```

---

### mse_procedural_scores

Procedural metrics per evaluation.

```sql
CREATE TABLE mse_procedural_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  moral_sensitivity INTEGER CHECK (moral_sensitivity BETWEEN 0 AND 100),
  info_seeking INTEGER CHECK (info_seeking BETWEEN 0 AND 100),
  calibration INTEGER CHECK (calibration BETWEEN 0 AND 100),
  consistency INTEGER CHECK (consistency BETWEEN 0 AND 100),
  pressure_robustness INTEGER CHECK (pressure_robustness BETWEEN 0 AND 100),
  transparency INTEGER CHECK (transparency BETWEEN 0 AND 100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_procedural_run ON mse_procedural_scores(run_id);
```

---

### mse_snapshots (Profiles)

Frozen profiles for historical comparison.

```sql
CREATE TABLE mse_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  run_id UUID NOT NULL REFERENCES mse_evaluation_runs(id),

  profile_data JSONB NOT NULL,  -- Complete profile snapshot
  avg_threshold NUMERIC(4,3),
  si_overall INTEGER,
  ism_composite INTEGER,

  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_snapshots_agent ON mse_snapshots(agent_id);
CREATE INDEX idx_mse_snapshots_current ON mse_snapshots(agent_id) WHERE is_current = true;
CREATE INDEX idx_mse_snapshots_created ON mse_snapshots(created_at DESC);
```

**Notes:**
- `profile_data`: JSONB containing full profile (axis scores, procedural metrics, SI, ISM, capacities)
- Only one `is_current = true` per agent (enforced by application logic)

---

## V2.0 Enhancements

### mse_consistency_groups

Groups of parallel dilemmas for coherence testing.

```sql
CREATE TABLE mse_consistency_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  axis_id INTEGER REFERENCES mse_axes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### mse_gaming_scores

Gaming detection results per evaluation.

```sql
CREATE TABLE mse_gaming_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  gaming_score NUMERIC(4,3) NOT NULL CHECK (gaming_score BETWEEN 0 AND 1),
  is_flagged BOOLEAN NOT NULL,

  -- 6 signals
  response_time_uniformity NUMERIC(4,3),
  rationale_diversity NUMERIC(4,3),
  pattern_regularity NUMERIC(4,3),
  parameter_sensitivity NUMERIC(4,3),
  framing_susceptibility NUMERIC(4,3),
  consistency_violations NUMERIC(4,3),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_gaming_run ON mse_gaming_scores(run_id);
CREATE INDEX idx_mse_gaming_flagged ON mse_gaming_scores(is_flagged) WHERE is_flagged = true;
```

---

### mse_capacity_scores

Seven ethical capacities per evaluation.

```sql
CREATE TABLE mse_capacity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  moral_perception NUMERIC(4,3) CHECK (moral_perception BETWEEN 0 AND 1),
  moral_imagination NUMERIC(4,3) CHECK (moral_imagination BETWEEN 0 AND 1),
  moral_humility NUMERIC(4,3) CHECK (moral_humility BETWEEN 0 AND 1),
  moral_coherence NUMERIC(4,3) CHECK (moral_coherence BETWEEN 0 AND 1),
  residue_recognition NUMERIC(4,3) CHECK (residue_recognition BETWEEN 0 AND 1),
  perspectival_flexibility NUMERIC(4,3) CHECK (perspectival_flexibility BETWEEN 0 AND 1),
  meta_ethical_awareness NUMERIC(4,3) CHECK (meta_ethical_awareness BETWEEN 0 AND 1),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_capacity_run ON mse_capacity_scores(run_id);
```

---

### mse_coherence_scores

Ethical orientation detection (IQR-based coherence and between-group variance analysis).

```sql
CREATE TABLE mse_coherence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  primary_orientation VARCHAR(30),
  confidence NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  orientation_vector NUMERIC(4,3)[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_coherence_run ON mse_coherence_scores(run_id);
```

---

## Ratings & Rankings

### mse_moral_ratings (MR)

Elo-like dynamic ratings.

```sql
CREATE TABLE mse_moral_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID UNIQUE NOT NULL,

  rating INTEGER NOT NULL DEFAULT 1000,
  uncertainty INTEGER NOT NULL DEFAULT 350,
  k_factor NUMERIC(4,2) NOT NULL DEFAULT 32.00,
  evaluations_count INTEGER NOT NULL DEFAULT 0,

  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_mr_agent ON mse_moral_ratings(agent_id);
CREATE INDEX idx_mse_mr_rating ON mse_moral_ratings(rating DESC);
```

---

### mse_moral_rating_history

Tracks rating changes over time.

```sql
CREATE TABLE mse_moral_rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  run_id UUID REFERENCES mse_evaluation_runs(id),

  rating_before INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('evaluation', 'recalibration', 'adjustment')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_mr_history_agent ON mse_moral_rating_history(agent_id);
CREATE INDEX idx_mse_mr_history_created ON mse_moral_rating_history(created_at DESC);
```

---

### mse_sophistication_scores

Sophistication Index (SI) per evaluation.

```sql
CREATE TABLE mse_sophistication_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  overall INTEGER NOT NULL CHECK (overall BETWEEN 0 AND 100),
  level VARCHAR(20) NOT NULL
    CHECK (level IN ('Reactive', 'Deliberative', 'Integrated', 'Reflective', 'Autonomous')),

  -- 5 dimensions
  integration INTEGER CHECK (integration BETWEEN 0 AND 100),
  metacognition INTEGER CHECK (metacognition BETWEEN 0 AND 100),
  stability INTEGER CHECK (stability BETWEEN 0 AND 100),
  adaptability INTEGER CHECK (adaptability BETWEEN 0 AND 100),
  self_model_accuracy INTEGER CHECK (self_model_accuracy BETWEEN 0 AND 100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_si_run ON mse_sophistication_scores(run_id);
CREATE INDEX idx_mse_si_overall ON mse_sophistication_scores(overall DESC);
```

---

### mse_ism_scores

ISM composite ranking per evaluation.

```sql
CREATE TABLE mse_ism_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES mse_evaluation_runs(id) ON DELETE CASCADE,

  composite INTEGER NOT NULL CHECK (composite BETWEEN 0 AND 100),
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),

  profile_richness INTEGER CHECK (profile_richness BETWEEN 0 AND 100),
  procedural_quality INTEGER CHECK (procedural_quality BETWEEN 0 AND 100),
  measurement_precision INTEGER CHECK (measurement_precision BETWEEN 0 AND 100),

  penalties JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mse_ism_run ON mse_ism_scores(run_id);
CREATE INDEX idx_mse_ism_composite ON mse_ism_scores(composite DESC);
```

---

## Entity Relationships

```
mse_axes (15 rows)
  ↓ 1:N
mse_dilemma_items (270 rows)
  ↓ M:N (via mse_responses)
mse_evaluation_runs
  ↓ 1:N
mse_responses
  ↓ 1:1
mse_axis_scores
  ↓ 1:1
mse_procedural_scores, mse_gaming_scores, mse_capacity_scores,
mse_coherence_scores, mse_sophistication_scores, mse_ism_scores
  ↓ 1:1
mse_snapshots (profile)
```

---

## Indices & Performance

### Query Patterns

**Most common queries:**
1. Get agent's latest profile
2. List evaluation history for agent
3. Compare multiple agents
4. Leaderboards (MR, SI)
5. Get next dilemma in evaluation

### Optimizations

**Composite indices:**
```sql
-- Fast active run lookup
CREATE UNIQUE INDEX idx_mse_runs_active ON mse_evaluation_runs(agent_id)
  WHERE status = 'in_progress';

-- Fast current profile lookup
CREATE INDEX idx_mse_snapshots_current ON mse_snapshots(agent_id)
  WHERE is_current = true;

-- Fast leaderboard queries
CREATE INDEX idx_mse_mr_rating ON mse_moral_ratings(rating DESC);
CREATE INDEX idx_mse_si_overall ON mse_sophistication_scores(overall DESC);
```

**JSONB indexing:**
```sql
-- If querying config frequently
CREATE INDEX idx_mse_runs_config ON mse_evaluation_runs((config->>'itemsPerAxis'));
```

**Partial indices:**
```sql
-- Only index flagged gaming scores
CREATE INDEX idx_mse_gaming_flagged ON mse_gaming_scores(is_flagged)
  WHERE is_flagged = true;
```

---

## Migrations

### Setup Script

```bash
# Initialize database
psql -U postgres -c "CREATE DATABASE mse_db;"
psql -U postgres mse_db < migrations/001_core_tables.sql
psql -U postgres mse_db < migrations/002_v2_enhancements.sql
psql -U postgres mse_db < migrations/003_ratings.sql
psql -U postgres mse_db < migrations/004_sophistication.sql
psql -U postgres mse_db < migrations/005_ism.sql
psql -U postgres mse_db < migrations/006_population_stats.sql

# Seed data
psql -U postgres mse_db < seed/001_axes.sql
psql -U postgres mse_db < seed/002_dilemmas.sql
psql -U postgres mse_db < seed/003_consistency_groups.sql
psql -U postgres mse_db < seed/004_exam_versions.sql
```

### Migration Tool

```javascript
const { migrate } = require('@godson/mse');

await migrate(db, {
  directory: './migrations',
  tableName: 'mse_migrations'
});
```

---

## Backup & Restore

### Backup

```bash
pg_dump -U postgres mse_db > mse_backup_$(date +%Y%m%d).sql
```

### Restore

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS mse_db;"
psql -U postgres -c "CREATE DATABASE mse_db;"
psql -U postgres mse_db < mse_backup_20260208.sql
```

---

**Questions?**
- 💬 [GitHub Discussions](https://github.com/godson-benchmarks/mse/discussions)
- 📧 opensource@godson.ai

---

**License:** CC-BY-SA 4.0
**Attribution:** Godson Network (https://godson.ai)
