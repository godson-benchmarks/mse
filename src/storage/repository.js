/**
 * MSE Repository (DEPRECATED)
 *
 * This class is deprecated and kept only for backward compatibility.
 * New code should use PostgresAdapter directly.
 *
 * @deprecated Use PostgresAdapter instead
 */

const PostgresAdapter = require('./PostgresAdapter');

/**
 * @deprecated Use PostgresAdapter instead
 */
class MSERepository extends PostgresAdapter {
  constructor(db, subjectProvider = null) {
    super(db, subjectProvider);
    // Emit deprecation warning in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[MSE] MSERepository is deprecated. Use PostgresAdapter instead.');
    }
  }
}

module.exports = { MSERepository };
