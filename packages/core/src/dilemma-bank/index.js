/**
 * Dilemma Bank
 *
 * Manages the parametric bank of ethical dilemmas for the MSE system.
 * Each dilemma targets a specific axis at a specific pressure level.
 *
 * All content is stored in English (single canonical language).
 */

const { PressureLevels } = require('../types');

class DilemmaBank {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all active dilemma items for an axis
   * @param {number} axisId
   * @param {Object} options
   * @param {number} options.versionId - Filter by exam version ID
   * @returns {Promise<Object[]>}
   */
  async getItemsForAxis(axisId, options = {}) {
    const { includeInactive = false, limit = null, excludeIds = [], versionId = null } = options;

    // Build version join if versionId is specified
    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $2'
      : '';

    let query = `
      SELECT
        di.id,
        di.axis_id,
        di.family_id,
        di.pressure_level,
        di.params,
        di.prompt,
        di.options,
        di.version,
        di.is_anchor,
        df.name as family_name
      FROM mse_dilemma_items di
      ${versionJoin}
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.axis_id = $1
      ${includeInactive ? '' : 'AND di.is_active = true'}
    `;

    const params = versionId ? [axisId, versionId] : [axisId];
    let paramIndex = params.length + 1;

    // Exclude specific IDs if provided
    if (excludeIds.length > 0) {
      query += ` AND di.id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
      params.push(...excludeIds);
      paramIndex += excludeIds.length;
    }

    query += ` ORDER BY di.pressure_level ASC`;

    // Add limit if specified
    if (limit !== null && limit > 0) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this._formatItem(row));
  }

  /**
   * Get anchor items (L1 and L5) for an axis
   * @param {number} axisId
   * @param {number} versionId - Filter by exam version ID
   * @returns {Promise<{low: Object, high: Object}>}
   */
  async getAnchorItems(axisId, versionId = null) {
    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $2'
      : '';

    const query = `
      SELECT
        di.*,
        df.name as family_name
      FROM mse_dilemma_items di
      ${versionJoin}
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.axis_id = $1
        AND di.is_anchor = true
        AND di.is_active = true
      ORDER BY di.pressure_level ASC
    `;

    const params = versionId ? [axisId, versionId] : [axisId];
    const result = await this.db.query(query, params);
    const items = result.rows.map(row => this._formatItem(row));

    // Find lowest and highest pressure anchors
    const low = items.find(i => i.pressure_level <= PressureLevels.L2) || items[0];
    const high = items.find(i => i.pressure_level >= PressureLevels.L4) || items[items.length - 1];

    return { low, high };
  }

  /**
   * Get item closest to a target pressure level
   * @param {number} axisId
   * @param {number} targetPressure - Target pressure level (0-1)
   * @param {string[]} excludeIds - Item IDs to exclude
   * @param {number} versionId - Filter by exam version ID
   * @returns {Promise<Object|null>}
   */
  async getItemNearPressure(axisId, targetPressure, excludeIds = [], versionId = null) {
    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $3'
      : '';

    let query = `
      SELECT
        di.*,
        df.name as family_name,
        ABS(di.pressure_level - $2) as distance
      FROM mse_dilemma_items di
      ${versionJoin}
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.axis_id = $1
        AND di.is_active = true
    `;

    const params = versionId ? [axisId, targetPressure, versionId] : [axisId, targetPressure];
    let paramIndex = params.length + 1;

    if (excludeIds.length > 0) {
      query += ` AND di.id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
      params.push(...excludeIds);
    }

    query += ` ORDER BY distance ASC LIMIT 1`;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;

    return this._formatItem(result.rows[0]);
  }

  /**
   * Get a specific item by ID
   * @param {string} itemId
   * @returns {Promise<Object|null>}
   */
  async getItem(itemId) {
    const query = `
      SELECT
        di.*,
        df.name as family_name
      FROM mse_dilemma_items di
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.id = $1
    `;

    const result = await this.db.query(query, [itemId]);
    if (result.rows.length === 0) return null;

    return this._formatItem(result.rows[0]);
  }

  /**
   * Get items by family
   * @param {string} familyId
   * @returns {Promise<Object[]>}
   */
  async getItemsByFamily(familyId) {
    const query = `
      SELECT
        di.*,
        df.name as family_name
      FROM mse_dilemma_items di
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.family_id = $1
        AND di.is_active = true
      ORDER BY di.axis_id, di.pressure_level
    `;

    const result = await this.db.query(query, [familyId]);
    return result.rows.map(row => this._formatItem(row));
  }

  /**
   * Get all families
   * @returns {Promise<Object[]>}
   */
  async getFamilies() {
    const query = `
      SELECT
        f.*,
        COUNT(di.id) as item_count
      FROM mse_dilemma_families f
      LEFT JOIN mse_dilemma_items di ON f.id = di.family_id AND di.is_active = true
      GROUP BY f.id
      ORDER BY f.name
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      item_count: parseInt(row.item_count, 10)
    }));
  }

  /**
   * Count items per axis
   * @returns {Promise<Object>}
   */
  async countItemsByAxis() {
    const query = `
      SELECT
        axis_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_anchor = true) as anchors
      FROM mse_dilemma_items
      WHERE is_active = true
      GROUP BY axis_id
      ORDER BY axis_id
    `;

    const result = await this.db.query(query);
    const counts = {};
    for (const row of result.rows) {
      counts[row.axis_id] = {
        total: parseInt(row.total, 10),
        anchors: parseInt(row.anchors, 10)
      };
    }
    return counts;
  }

  // ==========================================
  // v2.0: CONSISTENCY GROUPS
  // ==========================================

  /**
   * Get consistency groups for an axis
   * @param {number} axisId
   * @param {number} [versionId] - Filter by exam version
   * @returns {Promise<Object[]>}
   */
  async getConsistencyGroups(axisId, versionId = null) {
    let query = `
      SELECT cg.*
      FROM mse_consistency_groups cg
      WHERE cg.axis_id = $1
    `;
    const params = [axisId];

    if (versionId) {
      query += `
        AND EXISTS (
          SELECT 1 FROM mse_consistency_group_items cgi
          JOIN mse_version_items vi ON vi.item_id = cgi.item_id
          WHERE cgi.group_id = cg.id AND vi.version_id = $2
        )
      `;
      params.push(versionId);
    }

    query += ` ORDER BY cg.group_code`;
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get items in a consistency group
   * @param {number} groupId
   * @returns {Promise<Object[]>}
   */
  async getGroupItems(groupId) {
    const query = `
      SELECT
        di.*,
        df.name as family_name,
        cgi.framing,
        cgi.variant_type
      FROM mse_consistency_group_items cgi
      JOIN mse_dilemma_items di ON cgi.item_id = di.id
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE cgi.group_id = $1
      ORDER BY cgi.framing
    `;
    const result = await this.db.query(query, [groupId]);
    return result.rows.map(row => ({
      ...this._formatItem(row),
      framing: row.framing,
      variant_type: row.variant_type,
      dilemma_type: row.dilemma_type,
      non_obvious_factors: row.non_obvious_factors,
      expert_disagreement: row.expert_disagreement ? parseFloat(row.expert_disagreement) : null,
      requires_residue_recognition: row.requires_residue_recognition,
      meta_ethical_type: row.meta_ethical_type,
      consistency_group_id: groupId
    }));
  }

  /**
   * Get framing variants of an item (via consistency group)
   * @param {string} itemId
   * @returns {Promise<Object[]>}
   */
  async getFramingVariants(itemId) {
    const query = `
      SELECT
        di.*,
        df.name as family_name,
        cgi2.framing,
        cgi2.variant_type
      FROM mse_consistency_group_items cgi1
      JOIN mse_consistency_group_items cgi2 ON cgi1.group_id = cgi2.group_id AND cgi1.item_id != cgi2.item_id
      JOIN mse_dilemma_items di ON cgi2.item_id = di.id
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE cgi1.item_id = $1
      ORDER BY cgi2.framing
    `;
    const result = await this.db.query(query, [itemId]);
    return result.rows.map(row => ({
      ...this._formatItem(row),
      framing: row.framing,
      variant_type: row.variant_type
    }));
  }

  /**
   * Get items for an axis including v2.0 metadata
   * @param {number} axisId
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  async getItemsForAxisV2(axisId, options = {}) {
    const { versionId = null, excludeIds = [] } = options;

    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $2'
      : '';

    let query = `
      SELECT
        di.*,
        df.name as family_name
      FROM mse_dilemma_items di
      ${versionJoin}
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.axis_id = $1
        AND di.is_active = true
    `;

    const params = versionId ? [axisId, versionId] : [axisId];
    let paramIndex = params.length + 1;

    if (excludeIds.length > 0) {
      query += ` AND di.id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
      params.push(...excludeIds);
    }

    query += ` ORDER BY di.pressure_level ASC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      ...this._formatItem(row),
      dilemma_type: row.dilemma_type || 'base',
      consistency_group_id: row.consistency_group_id,
      variant_type: row.variant_type,
      non_obvious_factors: row.non_obvious_factors,
      expert_disagreement: row.expert_disagreement ? parseFloat(row.expert_disagreement) : null,
      requires_residue_recognition: row.requires_residue_recognition || false,
      meta_ethical_type: row.meta_ethical_type
    }));
  }

  // ==========================================
  // v3.0: CROSS-AXIS DILEMMAS
  // ==========================================

  /**
   * Get items for an axis including cross-axis items (v3.0+)
   *
   * Returns items where the axis appears as either primary or secondary axis.
   * This is the v3 replacement for getItemsForAxis: items that activate a given
   * axis are those where axis_id = X OR secondary_axis_id = X.
   *
   * @param {number} axisId
   * @param {Object} options
   * @param {number} options.versionId - Filter by exam version ID
   * @param {string[]} options.excludeIds - Item IDs to exclude
   * @returns {Promise<Object[]>}
   */
  async getItemsForAxisV3(axisId, options = {}) {
    const { versionId = null, excludeIds = [] } = options;

    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $2'
      : '';

    let query = `
      SELECT
        di.*,
        df.name as family_name
      FROM mse_dilemma_items di
      ${versionJoin}
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE (di.axis_id = $1 OR di.secondary_axis_id = $1)
        AND di.is_active = true
    `;

    const params = versionId ? [axisId, versionId] : [axisId];
    let paramIndex = params.length + 1;

    if (excludeIds.length > 0) {
      query += ` AND di.id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
      params.push(...excludeIds);
    }

    query += ` ORDER BY di.pressure_level ASC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this._formatItem(row));
  }

  /**
   * Get items that activate exactly a specific pair of axes (v3.0+)
   *
   * Returns only cross-axis items where primary=axisA and secondary=axisB
   * (or vice versa). Useful for targeted coupling analysis.
   *
   * @param {number} primaryAxisId
   * @param {number} secondaryAxisId
   * @param {Object} options
   * @param {number} options.versionId - Filter by exam version ID
   * @returns {Promise<Object[]>}
   */
  async getCrossAxisItems(primaryAxisId, secondaryAxisId, options = {}) {
    const { versionId = null } = options;

    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $3'
      : '';

    const query = `
      SELECT
        di.*,
        df.name as family_name
      FROM mse_dilemma_items di
      ${versionJoin}
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.is_active = true
        AND (
          (di.axis_id = $1 AND di.secondary_axis_id = $2)
          OR (di.axis_id = $2 AND di.secondary_axis_id = $1)
        )
      ORDER BY di.pressure_level ASC
    `;

    const params = versionId
      ? [primaryAxisId, secondaryAxisId, versionId]
      : [primaryAxisId, secondaryAxisId];

    const result = await this.db.query(query, params);
    return result.rows.map(row => this._formatItem(row));
  }

  /**
   * Format item for API response
   * @private
   */
  _formatItem(row) {
    const options = row.options.map(opt => ({
      id: opt.id,
      label: opt.label,
      pole: opt.pole
    }));

    return {
      id: row.id,
      axis_id: row.axis_id,
      secondary_axis_id: row.secondary_axis_id || null,
      family_id: row.family_id,
      family_name: row.family_name,
      pressure_level: parseFloat(row.pressure_level),
      params: row.params,
      prompt: row.prompt,
      options,
      version: row.version,
      is_anchor: row.is_anchor
    };
  }
}

module.exports = { DilemmaBank };
