-- MSE Migration 005: ISM (Indice de Sofisticacion Moral) Columns
-- ISM replaces avgThreshold as the ranking metric because higher threshold
-- does NOT equal more ethical. ISM measures quality and depth of moral reasoning.
--
-- ISM = 0.35 * ProfileRichness + 0.45 * ProceduralQuality + 0.20 * MeasurementPrecision - Penalty
--
-- ISM is computed by the ISMCalculator and stored on profile snapshots.

-- ============================================
-- ADD ISM COLUMNS TO PROFILE SNAPSHOTS
-- ============================================

ALTER TABLE mse_profile_snapshots
ADD COLUMN IF NOT EXISTS ism_score DECIMAL(5,3),
ADD COLUMN IF NOT EXISTS ism_tier SMALLINT,
ADD COLUMN IF NOT EXISTS ism_components JSONB;
-- ism_components: {profileRichness, proceduralQuality, measurementPrecision, penalty, tier}

CREATE INDEX IF NOT EXISTS idx_mse_snapshots_ism ON mse_profile_snapshots(ism_score DESC NULLS LAST);
