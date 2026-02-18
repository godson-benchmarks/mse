-- MSE Seed 005: v3.0 Exam Version (Draft)
--
-- v3.0 introduces cross-axis dilemmas that activate two moral axes
-- simultaneously, enabling coupling measurement at the item level.
--
-- Status 'draft' prevents accidental use. Change to 'active' once
-- cross-axis dilemmas are authored and validated by ethicists.
--
-- v3.0 inherits all 270 v2.1 items (single-axis) and adds cross-axis items.
-- Profiles are comparable with v2.1 because the scoring model is backward-compatible.

INSERT INTO mse_exam_versions (
  code, name, description,
  status, is_current, released_at,
  comparable_with, breaking_changes
) VALUES (
  'v3.0',
  'Cross-Axis Release',
  'Extends v2.1 with cross-axis dilemmas that activate two moral axes simultaneously. '
  'Enables direct measurement of inter-axis coupling at the item level. '
  'Inherits all 270 single-axis items from v2.1 plus new cross-axis items.',
  'draft',
  false,
  NULL,
  ARRAY['v2.1', 'v3.0']::VARCHAR(20)[],
  false
) ON CONFLICT (code) DO NOTHING;

-- Link all existing v2.1 items to v3.0 (inheritance)
-- This runs idempotently: ON CONFLICT DO NOTHING handles re-runs.
INSERT INTO mse_version_items (version_id, item_id)
SELECT
  (SELECT id FROM mse_exam_versions WHERE code = 'v3.0'),
  vi.item_id
FROM mse_version_items vi
JOIN mse_exam_versions v ON vi.version_id = v.id
WHERE v.code = 'v2.1'
ON CONFLICT DO NOTHING;
