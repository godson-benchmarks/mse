-- MSE Migration 006: Population Statistics & Calibration
-- Tracks aggregate statistics across all evaluated agents per epoch.
-- Used for population-level calibration and normative comparisons.

-- ============================================
-- POPULATION CALIBRATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS mse_population_stats (
  id SERIAL PRIMARY KEY,
  epoch VARCHAR(20) NOT NULL,                    -- '2026-Q1'
  exam_version_id INTEGER REFERENCES mse_exam_versions(id),

  mean_mr DECIMAL(8,2),
  std_mr DECIMAL(8,2),
  n_agents INTEGER,
  item_difficulties JSONB,                       -- {item_id: calibrated_difficulty}

  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mse_ps_epoch ON mse_population_stats(epoch);
