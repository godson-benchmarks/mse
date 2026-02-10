/**
 * MSE - PostgreSQL Subject Provider
 *
 * PostgreSQL implementation of SubjectProvider interface.
 * Maps to a configurable table (default: 'agents') with standard schema.
 */

const SubjectProvider = require('./subject-provider');

// Strict pattern for SQL identifiers — prevents SQL injection via column/table names.
// Allows only letters, digits, and underscores (standard PostgreSQL unquoted identifiers).
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

class PostgresSubjectProvider extends SubjectProvider {
  /**
   * @param {Object} db - PostgreSQL pool or client
   * @param {Object} options - Configuration options
   * @param {string} options.tableName - Name of subjects table (default: 'agents')
   * @param {string} options.idColumn - ID column name (default: 'id')
   * @param {string} options.nameColumn - Name column name (default: 'name')
   * @param {string} options.displayNameColumn - Display name column (default: 'display_name')
   * @param {string} options.descriptionColumn - Description column (default: 'description')
   * @param {string} options.createdAtColumn - Created timestamp column (default: 'created_at')
   */
  constructor(db, options = {}) {
    super();
    this.db = db;

    const validateIdentifier = (name, value) => {
      if (!SAFE_IDENTIFIER.test(value)) {
        throw new Error(`Invalid SQL identifier for ${name}: "${value}". Only letters, digits, and underscores are allowed.`);
      }
      return value;
    };

    this.tableName = validateIdentifier('tableName', options.tableName || 'agents');
    this.idColumn = validateIdentifier('idColumn', options.idColumn || 'id');
    this.nameColumn = validateIdentifier('nameColumn', options.nameColumn || 'name');
    this.displayNameColumn = validateIdentifier('displayNameColumn', options.displayNameColumn || 'display_name');
    this.descriptionColumn = validateIdentifier('descriptionColumn', options.descriptionColumn || 'description');
    this.createdAtColumn = validateIdentifier('createdAtColumn', options.createdAtColumn || 'created_at');
  }

  /**
   * Get a subject by ID
   * @param {string} id - Subject unique identifier
   * @returns {Promise<Subject|null>}
   */
  async getSubject(id) {
    const query = `
      SELECT
        ${this.idColumn} as id,
        ${this.nameColumn} as name,
        ${this.displayNameColumn} as "displayName",
        ${this.descriptionColumn} as description,
        ${this.createdAtColumn} as "createdAt"
      FROM ${this.tableName}
      WHERE ${this.idColumn} = $1
      LIMIT 1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get a subject by name
   * @param {string} name - Subject name (unique identifier)
   * @returns {Promise<Subject|null>}
   */
  async getSubjectByName(name) {
    const query = `
      SELECT
        ${this.idColumn} as id,
        ${this.nameColumn} as name,
        ${this.displayNameColumn} as "displayName",
        ${this.descriptionColumn} as description,
        ${this.createdAtColumn} as "createdAt"
      FROM ${this.tableName}
      WHERE ${this.nameColumn} = $1
      LIMIT 1
    `;

    const result = await this.db.query(query, [name]);
    return result.rows[0] || null;
  }

  /**
   * List subjects with optional filtering
   * @param {Object} options - Query options
   * @returns {Promise<Array<Subject>>}
   */
  async listSubjects(options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const orderBy = this._mapOrderByColumn(options.orderBy || 'createdAt');
    const order = options.order === 'desc' ? 'DESC' : 'ASC';

    const query = `
      SELECT
        ${this.idColumn} as id,
        ${this.nameColumn} as name,
        ${this.displayNameColumn} as "displayName",
        ${this.descriptionColumn} as description,
        ${this.createdAtColumn} as "createdAt"
      FROM ${this.tableName}
      ORDER BY ${orderBy} ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await this.db.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Get subjects by IDs (batch operation)
   * @param {Array<string>} ids - Array of subject IDs
   * @returns {Promise<Array<Subject>>}
   */
  async getSubjectsByIds(ids) {
    if (!ids || ids.length === 0) {
      return [];
    }

    const query = `
      SELECT
        ${this.idColumn} as id,
        ${this.nameColumn} as name,
        ${this.displayNameColumn} as "displayName",
        ${this.descriptionColumn} as description,
        ${this.createdAtColumn} as "createdAt"
      FROM ${this.tableName}
      WHERE ${this.idColumn} = ANY($1)
    `;

    const result = await this.db.query(query, [ids]);
    return result.rows;
  }

  /**
   * Map generic field names to actual column names
   * @private
   */
  _mapOrderByColumn(field) {
    const mapping = {
      id: this.idColumn,
      name: this.nameColumn,
      displayName: this.displayNameColumn,
      createdAt: this.createdAtColumn
    };
    return mapping[field] || this.createdAtColumn;
  }
}

module.exports = PostgresSubjectProvider;
