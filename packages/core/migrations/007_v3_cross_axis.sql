-- MSE Migration 007: v3.0 Cross-Axis Infrastructure
--
-- Adds secondary_axis_id to dilemma items for cross-axis dilemmas.
-- Items with a non-NULL secondary_axis_id activate two axes simultaneously,
-- enabling the DualAxisScorer to distribute information between both.
--
-- Existing v2.1 items remain unchanged (secondary_axis_id = NULL = single-axis).

ALTER TABLE mse_dilemma_items
  ADD COLUMN IF NOT EXISTS secondary_axis_id INTEGER REFERENCES mse_axes(id);

-- Partial index: only index rows that actually have a secondary axis
CREATE INDEX IF NOT EXISTS idx_mse_items_secondary_axis
  ON mse_dilemma_items(secondary_axis_id) WHERE secondary_axis_id IS NOT NULL;
