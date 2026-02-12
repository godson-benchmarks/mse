-- MSE Seed 003: Consistency Groups for Gaming Detection
--
-- Consistency groups link dilemmas that test the same moral axis concept
-- but with different framing. An agent with genuine moral principles should
-- respond consistently across framings; a gaming agent will be susceptible
-- to framing effects.
--
-- Group Code Format: {axis-code}-{family}-{sequence}
-- Framing Types: 'base', 'positive', 'negative', 'neutral'
-- Variant Types: 'framing', 'pressure', 'domain', 'stakes'
--
-- NOTE: Consistency groups reference specific dilemma items by UUID.
-- This seed file shows the structure; actual group-item linkages depend
-- on your dilemma bank content.
--
-- For the full consistency group configuration, see:
-- https://github.com/godson-benchmarks/mse/tree/main/packages/dilemmas

-- ============================================================================
-- EXAMPLE: Consistency group structure for Axis 1 (Rights vs Consequences)
-- ============================================================================

-- Create a consistency group
-- INSERT INTO mse_consistency_groups (group_code, axis_id, description) VALUES
-- ('rights-trolley-01', 1, 'Trolley-style rights vs consequences with varied framing');

-- Link dilemma items to the group
-- INSERT INTO mse_consistency_group_items (group_id, item_id, framing, variant_type) VALUES
-- ((SELECT id FROM mse_consistency_groups WHERE group_code = 'rights-trolley-01'),
--  'item-uuid-base', 'base', 'framing'),
-- ((SELECT id FROM mse_consistency_groups WHERE group_code = 'rights-trolley-01'),
--  'item-uuid-positive', 'positive', 'framing');

-- ============================================================================
-- When populated, consistency groups enable:
-- 1. Gaming Detection: Agents that change positions based on framing score high on g_score
-- 2. Consistency Scoring: Permissibility variance and principle overlap across framings
-- 3. Framing Susceptibility: Measures genuine principled reasoning vs surface-level responses
-- ============================================================================
