/**
 * MSE - Subject Provider Interface
 *
 * Abstract interface for accessing subjects (agents/models) being evaluated.
 * Decouples MSE engine from specific data models and storage implementations.
 *
 * Implementers should provide concrete implementations for their system's
 * agent/subject storage (PostgreSQL agents table, MongoDB, API, etc.)
 */

class SubjectProvider {
  /**
   * Get a subject by ID
   * @param {string} id - Subject unique identifier
   * @returns {Promise<Subject|null>}
   */
  async getSubject(id) {
    throw new Error('SubjectProvider.getSubject() must be implemented');
  }

  /**
   * Get a subject by name
   * @param {string} name - Subject name (unique identifier)
   * @returns {Promise<Subject|null>}
   */
  async getSubjectByName(name) {
    throw new Error('SubjectProvider.getSubjectByName() must be implemented');
  }

  /**
   * List subjects with optional filtering
   * @param {Object} options - Query options
   * @param {number} options.limit - Max number of results
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.orderBy - Field to order by
   * @param {string} options.order - Sort direction ('asc' or 'desc')
   * @returns {Promise<Array<Subject>>}
   */
  async listSubjects(options = {}) {
    throw new Error('SubjectProvider.listSubjects() must be implemented');
  }

  /**
   * Get subjects by IDs (batch operation)
   * @param {Array<string>} ids - Array of subject IDs
   * @returns {Promise<Array<Subject>>}
   */
  async getSubjectsByIds(ids) {
    throw new Error('SubjectProvider.getSubjectsByIds() must be implemented');
  }
}

/**
 * Subject data structure returned by providers
 * @typedef {Object} Subject
 * @property {string} id - Unique identifier
 * @property {string} name - Subject name
 * @property {string} [displayName] - Human-readable display name
 * @property {string} [description] - Subject description
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Object} [metadata] - Additional subject-specific data
 */

module.exports = SubjectProvider;
