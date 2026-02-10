-- MSE Seed 004: Exam Version Definitions
--
-- Exam versions define sets of dilemmas used for evaluation.
-- Different versions may not be directly comparable if breaking_changes = true.

-- ============================================================================
-- VERSION: v0.1b (Beta Release)
-- 75 dilemmas (5 per axis), initial calibration
-- ============================================================================

INSERT INTO mse_exam_versions (
  code, name, description,
  status, is_current, released_at,
  comparable_with, breaking_changes
) VALUES (
  'v0.1b',
  'Beta Release',
  'Initial beta release with 75 parametric dilemmas covering 15 moral axes. '
  '5 items per axis at pressure levels [0.15, 0.35, 0.50, 0.65, 0.85].',
  'deprecated',
  false,
  '2025-12-01',
  ARRAY['v0.1b']::VARCHAR(20)[],
  false
) ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- VERSION: v2.1 (Full Coverage Release)
-- 270 dilemmas (18 per axis), research-grade precision SE(b) <= 0.08
-- ============================================================================

INSERT INTO mse_exam_versions (
  code, name, description,
  status, is_current, released_at,
  comparable_with, breaking_changes
) VALUES (
  'v2.1',
  'Full Coverage Release',
  'Research-grade release with 270 parametric dilemmas (18 per axis). '
  'Uniform pressure spacing ~0.05 for precise threshold estimation. '
  'Includes consistency traps, GRM scoring, and gaming detection.',
  'active',
  true,
  '2026-02-01',
  ARRAY['v2.1']::VARCHAR(20)[],
  true
) ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- After inserting dilemmas (seed/002_dilemmas.sql), link them to versions:
--
-- INSERT INTO mse_version_items (version_id, item_id)
-- SELECT
--   (SELECT id FROM mse_exam_versions WHERE code = 'v2.1'),
--   id
-- FROM mse_dilemma_items
-- WHERE is_active = true;
-- ============================================================================
