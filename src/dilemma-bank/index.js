/**
 * Dilemma Bank
 *
 * Manages the parametric bank of ethical dilemmas for the MSE system.
 * Each dilemma targets a specific axis at a specific pressure level.
 */

const { PressureLevels } = require('../../types');

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
    const { includeInactive = false, language = 'en', limit = null, excludeIds = [], versionId = null } = options;

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
        di.prompt_en,
        di.prompt_es,
        di.options,
        di.version,
        di.is_anchor,
        df.name as family_name,
        df.name_es as family_name_es
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
    return result.rows.map(row => this._formatItem(row, language));
  }

  /**
   * Get anchor items (L1 and L5) for an axis
   * @param {number} axisId
   * @param {string} language
   * @param {number} versionId - Filter by exam version ID
   * @returns {Promise<{low: Object, high: Object}>}
   */
  async getAnchorItems(axisId, language = 'en', versionId = null) {
    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $2'
      : '';

    const query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es
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
    const items = result.rows.map(row => this._formatItem(row, language));

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
   * @param {string} language
   * @param {number} versionId - Filter by exam version ID
   * @returns {Promise<Object|null>}
   */
  async getItemNearPressure(axisId, targetPressure, excludeIds = [], language = 'en', versionId = null) {
    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $3'
      : '';

    let query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es,
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

    return this._formatItem(result.rows[0], language);
  }

  /**
   * Get a specific item by ID
   * @param {string} itemId
   * @param {string} language
   * @returns {Promise<Object|null>}
   */
  async getItem(itemId, language = 'en') {
    const query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es
      FROM mse_dilemma_items di
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.id = $1
    `;

    const result = await this.db.query(query, [itemId]);
    if (result.rows.length === 0) return null;

    return this._formatItem(result.rows[0], language);
  }

  /**
   * Get items by family
   * @param {string} familyId
   * @param {string} language
   * @returns {Promise<Object[]>}
   */
  async getItemsByFamily(familyId, language = 'en') {
    const query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es
      FROM mse_dilemma_items di
      LEFT JOIN mse_dilemma_families df ON di.family_id = df.id
      WHERE di.family_id = $1
        AND di.is_active = true
      ORDER BY di.axis_id, di.pressure_level
    `;

    const result = await this.db.query(query, [familyId]);
    return result.rows.map(row => this._formatItem(row, language));
  }

  /**
   * Get all families
   * @param {string} language
   * @returns {Promise<Object[]>}
   */
  async getFamilies(language = 'en') {
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
      name: language === 'es' ? row.name_es : row.name,
      description: language === 'es' ? row.description_es : row.description,
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
   * @param {string} language
   * @returns {Promise<Object[]>}
   */
  async getGroupItems(groupId, language = 'en') {
    const query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es,
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
      ...this._formatItem(row, language),
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
   * @param {string} language
   * @returns {Promise<Object[]>}
   */
  async getFramingVariants(itemId, language = 'en') {
    const query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es,
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
      ...this._formatItem(row, language),
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
    const { versionId = null, language = 'en', excludeIds = [] } = options;

    const versionJoin = versionId
      ? 'JOIN mse_version_items vi ON di.id = vi.item_id AND vi.version_id = $2'
      : '';

    let query = `
      SELECT
        di.*,
        df.name as family_name,
        df.name_es as family_name_es
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
      ...this._formatItem(row, language),
      dilemma_type: row.dilemma_type || 'base',
      consistency_group_id: row.consistency_group_id,
      variant_type: row.variant_type,
      non_obvious_factors: row.non_obvious_factors,
      expert_disagreement: row.expert_disagreement ? parseFloat(row.expert_disagreement) : null,
      requires_residue_recognition: row.requires_residue_recognition || false,
      meta_ethical_type: row.meta_ethical_type
    }));
  }

  /**
   * Format item for API response
   * @private
   */
  _formatItem(row, language) {
    const options = row.options.map(opt => ({
      id: opt.id,
      label: language === 'es' ? opt.label_es : opt.label_en,
      pole: opt.pole
    }));

    return {
      id: row.id,
      axis_id: row.axis_id,
      family_id: row.family_id,
      family_name: language === 'es' ? row.family_name_es : row.family_name,
      pressure_level: parseFloat(row.pressure_level),
      params: row.params,
      prompt: language === 'es' ? row.prompt_es : row.prompt_en,
      options,
      version: row.version,
      is_anchor: row.is_anchor
    };
  }
}

module.exports = { DilemmaBank };
